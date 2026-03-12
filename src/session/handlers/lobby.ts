import type { ReadyPayload, RejectPayload, StartPayload, SessionMessageType } from "../../utils";
import { createEnvelope } from "../net";
import type { SessionDeps } from "../sessionTypes";

export type LobbyHandlers = {
  handleReady: (payload: ReadyPayload, origin: "local" | "remote") => void;
  handleStart: (payload: StartPayload, origin: "local" | "remote") => void;
  handleRestart: (origin: "local" | "remote") => Promise<void>;
  handleApprove: () => void;
  handleReject: (payload: RejectPayload) => void;
};

export const createLobbyHandlers = (
  deps: SessionDeps,
  hooks: {
    startMatch: (myColor: 1 | 2) => void;
    setLastStartSenderColor: (color: 1 | 2) => void;
    getLastStartSenderColor: () => 1 | 2 | null;
    canStart: () => boolean;
    resetToLobby: () => void;
  },
): LobbyHandlers => {
  const { state, ui, net, sid, nextSeq, notifier, pending } = deps;
  const { startMatch, setLastStartSenderColor, getLastStartSenderColor, canStart, resetToLobby } =
    hooks;

  const sendSession = (
    type: SessionMessageType,
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

  const sendReady = (ready: boolean) => sendSession("READY", { ready });
  const sendStart = (payload: StartPayload) => sendSession("START", payload);
  const sendRestart = () => sendSession("RESTART");
  const sendApprove = () => sendSession("APPROVE");
  const sendReject = (action: "restart" | "undo", reason: string) => {
    const status = state.getStatus();
    sendSession(
      "REJECT",
      { action, reason },
      { turn: status.turn, stateHash: state.game.getHash() },
    );
  };

  const handleReady = (payload: ReadyPayload, origin: "local" | "remote") => {
    if (origin === "local") {
      if (!state.peer.getId()) {
        return;
      }
      state.ready.setSelf(payload.ready);
      state.startedState.set(false);
      sendReady(payload.ready);
      state.render();
      return;
    }
    state.ready.setPeer(payload.ready);
    state.startedState.set(false);
    state.render();
  };

  const handleStart = (payload: StartPayload, origin: "local" | "remote") => {
    if (origin === "local") {
      if (!canStart()) {
        return;
      }
      const last = getLastStartSenderColor();
      const senderColor = last ? (last === 1 ? 2 : 1) : Math.random() < 0.5 ? 1 : 2;
      const receiverColor = senderColor === 1 ? 2 : 1;
      setLastStartSenderColor(senderColor);
      sendStart({ senderColor, receiverColor, firstPlayer: 1 });
      startMatch(senderColor);
      return;
    }
    setLastStartSenderColor(payload.senderColor);
    startMatch(payload.receiverColor);
  };

  const handleRestart = async (origin: "local" | "remote") => {
    if (origin === "local") {
      if (!state.peer.getId()) {
        return;
      }
      const wait = pending.begin("restart");
      sendRestart();
      await wait;
      return;
    }
    const approved = await (ui.promptRestart?.() ?? Promise.resolve(false));
    if (approved) {
      sendApprove();
      resetToLobby();
    } else {
      sendReject("restart", "rejected");
    }
  };

  const handleApprove = () => {
    const current = pending.getAction();
    if (!current) {
      return;
    }
    if (current === "undo") {
      const count = pending.getUndoCount();
      if (count) {
        state.applyUndoCount(count);
      }
      pending.resolve("undo");
      return;
    }
    if (current === "rejoin") {
      sendSession("SYNC_STATE", { state: state.game.getSnapshot() });
      state.startedState.set(true);
      state.ready.clear();
      pending.resolve("rejoin");
      return;
    }
    if (current === "restart") {
      resetToLobby();
      pending.resolve("restart");
    }
  };

  const handleReject = (payload: RejectPayload) => {
    if (payload.action === "undo") {
      notifier.onRejectNotice("Undo rejected");
      pending.reject("undo", payload.reason);
      return;
    }
    if (payload.action === "rejoin") {
      resetToLobby();
      pending.reject("rejoin", payload.reason);
      return;
    }
    if (payload.action === "restart") {
      notifier.onRejectNotice("Restart rejected");
      pending.reject("restart", payload.reason);
    }
  };

  return {
    handleReady,
    handleStart,
    handleRestart,
    handleApprove,
    handleReject,
  };
};
