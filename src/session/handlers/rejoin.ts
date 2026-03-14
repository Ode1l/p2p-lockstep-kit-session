import type { CommandMessage, CommandListener } from "../commandBus";
import { getState, send } from "../context";

export const rejoin: CommandListener = (command: CommandMessage) => {
  const state = getState();
  if (command.origin === "local") {
    if (!state.canAction("self", "REJOIN")) {
      return;
    }
    state.dispatch("self", "REJOIN");
    send({ type: "REJOIN", payload: command.payload, from: "" });
    return;
  }
  if (!state.canAction("peer", "REJOIN")) {
    return;
  }
  state.dispatch("peer", "REJOIN");
};
