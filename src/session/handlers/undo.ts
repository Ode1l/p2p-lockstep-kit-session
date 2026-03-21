import type { CommandListener, CommandMessage } from '../commandBus';
import { getState, send } from '../context';

export const undo: CommandListener = (command: CommandMessage) => {
  const state = getState();
  // todo
  if (command.origin === 'local') {
    if (
      !state.canAction('self', 'UNDO') ||
      !state.canAction('peer', 'PEER_UNDO')
    ) {
      return;
    }
    state.setPendingAction('undo');
    state.dispatch('self', 'UNDO');
    state.dispatch('peer', 'PEER_UNDO');
    send({ type: 'UNDO', payload: command.payload, from: '' });
    return;
  }
  if (
    !state.canAction('peer', 'UNDO') ||
    !state.canAction('self', 'PEER_UNDO')
  ) {
    return;
  }
  state.setPendingAction('undo');
  state.dispatch('peer', 'UNDO');
  state.dispatch('self', 'PEER_UNDO');
};
