import type { CommandListener } from '../commandBus';
import { getBus, getState } from '../context';

export const offline: CommandListener = (command) => {
  if (command.type !== 'OFFLINE' && command.type !== 'ONLINE') {
    return;
  }
  const state = getState();
  const bus = getBus();

  if (command.type === 'OFFLINE') {
    if (!state.canAction('remote', 'OFFLINE')) {
      return;
    }
    state.dispatch('remote', 'OFFLINE', 'offline');
    return;
  }

  if (!state.canAction('remote', 'ONLINE')) {
    return;
  }
  state.dispatch('remote', 'ONLINE', 'syncing');
  bus.emit('SYNC_REQUEST', undefined, 'local');
};
