import type { CommandMessage, CommandListener } from "../commandBus";
import { getState, send } from "../context";

export const restart: CommandListener = (command: CommandMessage) => {
  const state = getState();
  if (command.origin === "local") {
    if (!state.canAction("self", "RESTART")) {
      return;
    }
    state.dispatch('self', 'RESTART');
    send({ type: "RESTART", payload: command.payload, from: "" });
    return;
  }
  if (!state.canAction('peer', 'RESTART')) {
    return;
  }
  state.dispatch('peer', 'RESTART');
};
