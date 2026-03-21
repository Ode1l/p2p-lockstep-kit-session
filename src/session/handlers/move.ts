import type { CommandListener } from "../commandBus";
import { getState, send } from "../context";
import type { SessionMessage } from '../../utils';

export const move: CommandListener = (command) => {
  const state = getState();
  const movePayload = command.payload;

  if (command.origin === "local") {
    const canSelf = state.canAction("self", "MOVE");
    const canPeer = state.canAction("peer", "PEER_MOVE");
    if (!canSelf || !canPeer) {
      return;
    }
    state.dispatch("self", "MOVE");
    state.dispatch("peer", "PEER_MOVE");
    const turn = state.getTurnCount();
    state.pushHistory({
      turn: turn,
      player: 'self',
      move: movePayload,
    });
    const message: SessionMessage = {
      type: 'MOVE',
      turn: turn,
      payload: movePayload
    };
    send(message);
    return;
  }

  const canPeer = state.canAction("peer", "MOVE");
  const canSelf = state.canAction("self", "PEER_MOVE");
  if (!canPeer || !canSelf) {
    return;
  }
  state.dispatch("peer", "MOVE");
  state.dispatch("self", "PEER_MOVE");
  state.pushHistory({
    turn: state.getTurnCount(),
    player: 'peer',
    move: movePayload,
  });
};
