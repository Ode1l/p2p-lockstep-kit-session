import type { SessionDeps } from "../sessionTypes";
import { createEnvelope } from "../net";

export const createRejoinChoiceControl = (deps: SessionDeps) => {
  const { state, ui, net, sid, nextSeq, pending } = deps;

  return async () => {
    if (!state.hasCache()) {
      return;
    }
    const choice = await (ui.promptRejoinChoice?.() ?? Promise.resolve("restart"));
    if (choice === "restart") {
      state.resetToLobby();
      return;
    }
    const { cacheHash, cacheTurn } = state.getCacheMeta();
    void pending.begin("rejoin");
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "session",
        type: "REJOIN",
        sid,
        from,
        seq: nextSeq(),
        turn: cacheTurn,
        stateHash: cacheHash,
      }),
    );
  };
};
