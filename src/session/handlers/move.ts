import type { CommandListener } from "../commandBus";
import { getState, send } from "../context";

export const move: CommandListener = (command) => {
  const state = getState();
  const movePayload = command.payload;

  if (command.origin === "local") {
    const canSelf = state.canAction("self", "MOVE");
    const canPeer = state.canAction("peer", "PEER_MOVE");
    if (!canSelf || !canPeer) {
      return;
    }
    state.pushHistory({ turn: state.getTurnCount(), player: "self", move: movePayload });
    state.dispatch("self", "MOVE");
    state.dispatch("peer", "PEER_MOVE");
    send({ type: "MOVE", payload: movePayload, from: "" });
    return;
  }

  const canPeer = state.canAction("peer", "MOVE");
  const canSelf = state.canAction("self", "PEER_MOVE");
  if (!canPeer || !canSelf) {
    return;
  }
  state.pushHistory({ turn: state.getTurnCount(), player: "peer", move: movePayload });
  state.dispatch("peer", "MOVE");
  state.dispatch("self", "PEER_MOVE");
};
