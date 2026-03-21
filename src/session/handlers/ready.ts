import { CommandListener } from '../commandBus';
import { getBus, getSid, getState, send } from '../context';
import type { SessionMessage } from '../../utils';

export const ready: CommandListener = (command) => {
  const state = getState();
  const bus = getBus();
  const sid = getSid();

  if (command.from === 'local') {
    const canSelf = state.canAction('local', 'READY');
    const canPeer = state.canAction('remote', 'REMOTE_READY');
    if (!canSelf || !canPeer) {
      return;
    }
    state.dispatch('local', 'READY');
    state.dispatch('remote', 'REMOTE_READY');

    const message: SessionMessage = {
      type: 'READY',
      sid: sid,
    };
    send(message);
    return;
  }

  if (sid !== command.sid) {
    bus.emit('REJECT', { reason: 'sid-mismatch' }, 'local');
    return;
  }
  if (
    !state.canAction('remote', 'READY') &&
    state.canAction('local', 'REMOTE_READY')
  ) {
    return;
  }
  state.dispatch('remote', 'READY');
  state.dispatch('local', 'REMOTE_READY');
};
