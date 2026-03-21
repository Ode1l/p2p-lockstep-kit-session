import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import type { SessionMessage } from '../../utils';

export const move: CommandListener = (command) => {
  const state = getState();
  const movePayload = command.payload;

  if (command.from === 'local') {
    const canSelf = state.canAction('local', 'MOVE');
    const canPeer = state.canAction('remote', 'REMOTE_MOVE');
    if (!canSelf || !canPeer) {
      return;
    }
    state.dispatch('local', 'MOVE');
    state.dispatch('remote', 'REMOTE_MOVE');
    const turn = state.getTurnCount();
    state.pushHistory({
      turn: turn,
      player: 'local',
      move: movePayload,
    });
    const message: SessionMessage = {
      type: 'MOVE',
      turn: turn,
      payload: movePayload,
    };
    send(message);
    return;
  }

  const canPeer = state.canAction('remote', 'MOVE');
  const canSelf = state.canAction('local', 'REMOTE_MOVE');
  if (!canPeer || !canSelf) {
    return;
  }
  state.dispatch('remote', 'MOVE');
  state.dispatch('local', 'REMOTE_MOVE');
  state.pushHistory({
    turn: state.getTurnCount(),
    player: 'remote',
    move: movePayload,
  });
};
