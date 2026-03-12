import type { ReadyPayload } from "../../utils";
import type { SessionDeps } from "../sessionTypes";
import { createEnvelope } from "../net";

export const createReadyHandler = (deps: SessionDeps) => {
  const { state, net, sid, nextSeq } = deps;

  const sendReady = (ready: boolean) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "session",
        type: "READY",
        sid,
        from,
        seq: nextSeq(),
        payload: { ready },
      }),
    );
  };

  return (payload: ReadyPayload, origin: "local" | "remote") => {
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
};
