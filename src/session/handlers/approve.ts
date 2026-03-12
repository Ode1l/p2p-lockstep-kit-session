import type { SessionDeps } from "../sessionTypes";
import { createEnvelope } from "../net";

export const createApproveHandler = (
  deps: SessionDeps,
  hooks: {
    resetToLobby: () => void;
  },
) => {
  const { state, net, sid, nextSeq, fsm, pending } = deps;
  const { resetToLobby } = hooks;

  return () => {
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
      const from = state.peer.getId();
      if (from) {
        net.send(
          createEnvelope({
            domain: "session",
            type: "SYNC_STATE",
            sid,
            from,
            seq: nextSeq(),
            payload: { state: state.game.getSnapshot() },
          }),
        );
      }
      state.startedState.set(true);
      state.ready.clear();
      fsm.onMatchStart("rejoin-approve");
      pending.resolve("rejoin");
      return;
    }
    if (current === "restart") {
      resetToLobby();
      pending.resolve("restart");
    }
  };
};
