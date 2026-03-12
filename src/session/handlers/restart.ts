import type { SessionDeps } from "../sessionTypes";
import { createEnvelope } from "../net";

export const createRestartHandler = (
  deps: SessionDeps,
  hooks: {
    resetToLobby: () => void;
  },
) => {
  const { state, ui, net, sid, nextSeq, pending } = deps;
  const { resetToLobby } = hooks;

  const sendSession = (
    type: "RESTART" | "APPROVE" | "REJECT",
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

  const sendRestart = () => sendSession("RESTART");
  const sendApprove = () => sendSession("APPROVE");
  const sendReject = (reason: string) => {
    const status = state.getStatus();
    sendSession(
      "REJECT",
      { action: "restart", reason },
      { turn: status.turn, stateHash: state.game.getHash() },
    );
  };

  return async (origin: "local" | "remote") => {
    if (origin === "local") {
      if (!state.peer.getId()) {
        return;
      }
      const wait = pending.begin("restart");
      sendRestart();
      await wait;
      return;
    }
    const approved = await (ui.promptRestart?.() ?? false);
    if (approved) {
      sendApprove();
      resetToLobby();
    } else {
      sendReject("rejected");
    }
  };
};
