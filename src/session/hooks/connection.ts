import type { SessionState } from "../state/state";
import type { SessionFsm } from "../state/fsm";
import type { Notifier } from "../ports/notifier";
import type { PendingController } from "../state/pending";

export const createConnectionControl = (
  deps: {
    state: SessionState;
    notifier: Notifier;
    fsm: SessionFsm;
    pending: PendingController;
  },
  hooks: { maybeAutoRejoin: () => Promise<void> },
) => {
  const { state, notifier, fsm, pending } = deps;
  const { maybeAutoRejoin } = hooks;
  let connected = false;

  return (connState: RTCPeerConnectionState) => {
    const nowConnected = connState === "connected";
    if (nowConnected && !connected) {
      connected = true;
      fsm.onConnected();
      state.connectionState.set(true);
      state.ready.clear();
      state.startedState.set(false);
      notifier.onConnection("[shell] datachannel connected");
      void maybeAutoRejoin();
    }
    if (!nowConnected && connected) {
      connected = false;
      fsm.onDisconnected();
      state.connectionState.set(false);
      state.ready.clear();
      state.startedState.set(false);
      pending.clear("disconnected");
      notifier.onConnection("[shell] datachannel disconnected");
    }
    state.render();
  };
};
