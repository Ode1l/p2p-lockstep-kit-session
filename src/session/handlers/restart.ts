import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';

/**
 * Handle restart request from local or remote player
 *
 * Validates restart is legal (no pending action, valid state)
 * and initiates restart request with peer approval flow.
 *
 * Restart clears all history but keeps player order for next match.
 */
export const restart: CommandListener = (command) => {
  if (command.type !== 'RESTART') {
    return;
  }

  const state = getState();

  if (command.from === 'local') {
    // Validate no pending action
    if (state.hasPendingAction()) {
      return;
    }

    // Validate state transitions
    if (!state.canAction('local', 'RESTART')) {
      console.warn('[Restart] Cannot RESTART from current state');
      return;
    }

    // Determine who will go first in next match
    const resumePlayer = state.getState('local') === 'turn' ? 'local' : 'remote';

    // Initialize pending restart state
    state.initializeRestartRequest(resumePlayer);

    // Transition to approval waiting state
    state.dispatch('local', 'RESTART');
    state.dispatch('remote', 'REMOTE_RESTART');

    send({ type: 'RESTART' });
    return;
  }

  // Remote player requested restart
  if (state.hasPendingAction()) {
    send({ type: 'REJECT', payload: { action: 'restart', reason: 'busy' } });
    return;
  }

  // Validate state transitions
  if (!state.canAction('local', 'REMOTE_RESTART')) {
    console.warn('[Restart] Cannot accept remote RESTART request');
    send({ type: 'REJECT', payload: { action: 'restart', reason: 'invalid_state' } });
    return;
  }

  // Determine who will go first in next match
  const resumePlayer = state.getState('local') === 'turn' ? 'local' : 'remote';

  // Initialize pending restart state
  state.initializeRestartRequest(resumePlayer);

  // Transition to approval waiting state (remote initiated, local approving)
  state.dispatch('local', 'REMOTE_RESTART');
  state.dispatch('remote', 'RESTART');
};
