import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import type { PlayerLabel } from '../state/state';

const getStarter = (last: PlayerLabel | null): PlayerLabel => {
  if (!last) {
    return Math.random() < 0.5 ? 'local' : 'remote';
  }
  return last === 'local' ? 'remote' : 'local';
};

export const start: CommandListener = (command) => {
  const state = getState();
  // todo
  if (command.from === 'local') {
    const starter = getStarter(state.getLastStart());
    const localNext = starter === 'local' ? 'local_turn' : 'remote_turn';
    const remoteNext = starter === 'local' ? 'remote_turn' : 'local_turn';
    if (
      !state.canAction('local', 'START', localNext) ||
      !state.canAction('remote', 'REMOTE_START', remoteNext)
    ) {
      return;
    }
    state.dispatch('local', 'START', localNext);
    state.dispatch('remote', 'REMOTE_START', remoteNext);
    state.setLastStart(starter);
    send({
      type: 'START',
      from: '',
      payload: { starter: starter === 'local' ? 'sender' : 'receiver' },
    });
    return;
  }
  const starter = command.payload.starter === 'sender' ? 'local' : 'remote';
  const selfNext = starter === 'local' ? 'local_turn' : 'remote_turn';
  const peerNext = starter === 'local' ? 'remote_turn' : 'local_turn';
  if (
    !state.canAction('local', 'START', selfNext) ||
    !state.canAction('remote', 'REMOTE_START', peerNext)
  ) {
    return;
  }
  state.dispatch('local', 'REMOTE_START', selfNext);
  state.dispatch('remote', 'START', peerNext);
  state.setLastStart(starter);
};
