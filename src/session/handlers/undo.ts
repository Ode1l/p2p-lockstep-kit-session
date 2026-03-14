import type { CommandMessage, CommandListener } from "../commandBus";
import { getState, send } from "../context";

export const undo: CommandListener = (command: CommandMessage) => {
  const state = getState();
  if (command.origin === "local") {
    if (!state.canAction("self", "REQUEST")) {
      return;
    }
    state.dispatch("self", "REQUEST");
    send({ type: "UNDO", payload: command.payload, from: "" });
    return;
  }
  if (!state.canAction("peer", "REQUEST")) {
    return;
  }
  state.dispatch("peer", "REQUEST");
};
