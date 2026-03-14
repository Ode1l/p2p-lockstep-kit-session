import { CommandListener, CommandMessage } from "../commandBus";
import { getState, send } from "../context";

export const ready: CommandListener = (command: CommandMessage) => {
  const state = getState();

  if (command.origin === "local") {
    if (!state.canAction("self", "READY")) {
      return;
    }
    state.dispatch("self", "READY");
    send({
      type: "READY",
      from: "",
      payload: { ready: true },
    });
    return;
  }

  if (!state.canAction("peer", "PEER_READY")) {
    return;
  }
  state.dispatch("peer", "PEER_READY");
};
