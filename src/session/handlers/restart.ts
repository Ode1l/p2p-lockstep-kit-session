import type { CommandMessage, CommandListener } from "../commandBus";
import { getState, send } from "../context";

export const restart: CommandListener = (command: CommandMessage) => {
  const state = getState();
  // todo
  if (command.origin === "local") {
    if (!state.canAction("self", "RESTART") || !state.canAction("peer", "PEER_RESTART")) {
      return;
    }
    state.setPendingAction("restart");
    state.dispatch('self', 'RESTART');
    state.dispatch('peer', 'PEER_RESTART');
    send({ type: "RESTART", payload: command.payload, from: "" });
    return;
  }
  if (!state.canAction('peer', 'RESTART') || !state.canAction('self', 'PEER_RESTART')) {
    return;
  }
  state.setPendingAction("restart");
  state.dispatch('peer', 'RESTART');
  state.dispatch('self', 'PEER_RESTART');
};
