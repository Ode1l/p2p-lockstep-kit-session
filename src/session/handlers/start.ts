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
 * Use dispatchStart() for automatic turn assignment based on starter.
 */
export const start: CommandListener = (command) => {
  const state = getState();

  if (command.from === 'local') {
    // Local player initiating START
    if (!state.canAction('local', 'START')) {
      console.warn('[Start] Cannot START from current state', {
        state: state.getState('local'),
      });
      return;
    }

    const nextStarter = getNextStarter(state.getLastStart());

    // Use helper method for complex turn assignment
    state.dispatchStart(nextStarter);

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
  if (!state.canAction('local', 'REMOTE_START')) {
    console.warn('[Start] Cannot START from current state', {
      state: state.getState('local'),
    });
    return;
  }

  // Decode starter: if sender started, local player (sender) is the starter
  const starter = starterInfo === 'sender' ? 'local' : 'remote';

  // Use helper method for complex turn assignment
  state.dispatchStart(starter);
};
