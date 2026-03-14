import type { CommandListener } from "../commandBus";
import { getState, send } from "../context";

export const start: CommandListener = (command) => {
  const state = getState();
  if (command.origin === "local") {
    if (!state.canAction("self", "START")) {
      return;
    }
    state.dispatch("self", "START");
    send({
      type: "START",
      payload: command.payload,
      from: "",
    });
    return;
  }
  if (!state.canAction("peer", "PEER_START")) {
    return;
  }
  state.dispatch("peer", "PEER_START");
};
