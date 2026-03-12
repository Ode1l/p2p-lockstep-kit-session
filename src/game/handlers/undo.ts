import type { UndoPayload, Envelope } from "../../utils";
import type { SessionState } from "../../session/state/state";
import type { ShellUi } from "../../ui/types";
import type { SessionFsm } from "../../session/state/fsm";
import type { PendingController } from "../../session/state/pending";

export const createUndoHandler = (deps: {
  state: SessionState;
  ui: ShellUi;
  sid: string;
  nextSeq: () => number;
  pending: PendingController;
  fsm: SessionFsm;
  sendEnvelope: <T>(msg: Envelope<T>) => void;
}) => {
  const { state, ui, sid, nextSeq, pending, fsm, sendEnvelope } = deps;

  const sendSession = (
    type: "UNDO" | "APPROVE" | "REJECT",
    payload?: unknown,
    meta?: { turn?: number; stateHash?: string },
  ) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    sendEnvelope({
      domain: "session",
      type,
      sid,
      from,
      seq: nextSeq(),
      payload,
      turn: meta?.turn,
      stateHash: meta?.stateHash,
    });
  };

  const sendUndoRequest = (count: 1 | 2) => sendSession("UNDO", { count });
  const sendApprove = () => sendSession("APPROVE");
  const sendReject = (reason: string) => {
    const status = state.getStatus();
    sendSession(
      "REJECT",
      { action: "undo", reason },
      { turn: status.turn, stateHash: state.game.getHash() },
    );
  };

  return async (payload: { count?: UndoPayload["count"] }, origin: "local" | "remote") => {
    if (origin === "local") {
      if (!state.peer.getId() || !state.startedState.is() || !state.history.has()) {
        return;
      }
      const status = state.getStatus();
      const myColor = state.player.getMyColor();
      const count: 1 | 2 = myColor && status.currentPlayer === myColor ? 2 : 1;
      if (count === 2 && state.history.length() < 2) {
        return;
      }
      const wait = pending.begin("undo", { undoCount: count });
      fsm.onAwaitApproval();
      sendUndoRequest(count);
      await wait;
      return;
    }

    if (!state.startedState.is()) {
      sendReject("not-started");
      return;
    }
    if (!payload.count) {
      sendReject("invalid");
      return;
    }
    if (payload.count === 2 && state.history.length() < 2) {
      sendReject("no-history");
      return;
    }
    const approved = await (ui.promptUndo?.() ?? Promise.resolve(false));
    if (approved) {
      sendApprove();
      state.applyUndoCount(payload.count);
    } else {
      sendReject("rejected");
    }
    fsm.onApprovalResolved();
  };
};
