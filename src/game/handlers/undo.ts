import type { UndoPayload } from "../../utils";
import type { SessionDeps } from "../../session/sessionTypes";
import { createEnvelope } from "../../session/net";

export const createUndoHandler = (deps: SessionDeps) => {
  const { state, ui, net, sid, nextSeq, pending } = deps;

  const sendSession = (
    type: "UNDO" | "APPROVE" | "REJECT",
    payload?: unknown,
    meta?: { turn?: number; stateHash?: string },
  ) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "session",
        type,
        sid,
        from,
        seq: nextSeq(),
        payload,
        turn: meta?.turn,
        stateHash: meta?.stateHash,
      }),
    );
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
  };
};
