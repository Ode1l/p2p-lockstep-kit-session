import type { CommandListener } from "../commandBus";
import { getState, send } from "../context";

export const move: CommandListener = (command) => {
  const state = getState();
  const event = command.origin === "local" ? "MOVE" : "PEER_MOVE";
  const player = command.origin === "local" ? "self" : "peer";

  if (!state.canAction(player, event)) {
    return;
  }

  state.dispatch(player, event);

  if (command.origin === "local") {
    send({ type: "MOVE", payload: command.payload, from: "" });
  }
};
