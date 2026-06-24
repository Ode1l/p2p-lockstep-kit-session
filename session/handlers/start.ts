import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import type { PlayerLabel } from '../state/state';

/**
 * Determine next starter (turn order rotation)
 * If no previous starter, randomly pick one
 * Otherwise, alternate between local and remote
 */
const getNextStarter = (lastStarter: PlayerLabel | null): PlayerLabel => {
  if (!lastStarter) {
    return Math.random() < 0.5 ? 'local' : 'remote';
  }
  return lastStarter === 'local' ? 'remote' : 'local';
};

/**
 * Handle game start request
 *
 * Determines who plays first and transitions both FSMs accordingly.
 */
export const start: CommandListener = (command) => {
  const state = getState();

  if (command.from === 'local') {
    // Local player initiating START
    if (
      !state.canAction('local', 'START') ||
      !state.canAction('remote', 'REMOTE_START')
    ) {
      console.warn('[Start] Cannot START from current state', {
        localState: state.getState('local'),
        remoteState: state.getState('remote'),
      });
      return;
    }

    const nextStarter = getNextStarter(state.getLastStart());
    const localTarget = nextStarter === 'local' ? 'turn' : 'remote_turn';
    const remoteTarget = nextStarter === 'local' ? 'remote_turn' : 'turn';

    state.setLastStart(nextStarter);
    state.dispatch('local', 'START', localTarget);
    state.dispatch('remote', 'REMOTE_START', remoteTarget);

    // Send message with starter info (encoded as 'sender'/'receiver')
    send({
      type: 'START',
      payload: { starter: nextStarter === 'local' ? 'sender' : 'receiver' },
    });
    return;
  }

  // Remote player sent START message
  const starterInfo = (command as any).payload?.starter;

  if (!starterInfo) {
    console.warn('[Start] Invalid START message format', { payload: command });
    return;
  }

  // Check if transition is valid
  if (
    !state.canAction('local', 'REMOTE_START') ||
    !state.canAction('remote', 'START')
  ) {
    console.warn('[Start] Cannot START from current state', {
      localState: state.getState('local'),
      remoteState: state.getState('remote'),
    });
    return;
  }

  // Decode from the receiver's perspective: the sender is the remote peer.
  const starter = starterInfo === 'sender' ? 'remote' : 'local';
  const localTarget = starter === 'local' ? 'turn' : 'remote_turn';
  const remoteTarget = starter === 'local' ? 'remote_turn' : 'turn';

  state.setLastStart(starter);
  state.dispatch('local', 'REMOTE_START', localTarget);
  state.dispatch('remote', 'START', remoteTarget);
};
