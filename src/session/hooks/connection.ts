import type { SessionDeps } from "../sessionTypes";

export const createConnectionControl = (
  deps: SessionDeps,
  hooks: { maybePromptRejoin: () => Promise<void> },
) => {
  const { state, notifier, fsm, pending } = deps;
  const { maybePromptRejoin } = hooks;
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
      void maybePromptRejoin();
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
