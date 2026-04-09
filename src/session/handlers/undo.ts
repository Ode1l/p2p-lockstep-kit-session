import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';

/**
 * Handle undo request from local or remote player
 *
 * Validates undo is legal (enough history, no pending action, valid state)
 * and initiates undo request with peer approval flow.
 *
 * Determines undo count (1 or 2 moves) based on current turn holder.
 * Records pending undo state for approval/rejection handling by request handler.
 */
export const undo: CommandListener = (command) => {
  if (command.type !== 'UNDO') {
    return;
  }

  const state = getState();

  if (command.from === 'local') {
    // Validate no pending action
    if (state.hasPendingAction()) {
      return;
    }

    // Validate state transitions
    if (!state.canAction('local', 'UNDO')) {
      console.warn('[Undo] Cannot UNDO from current state');
      return;
    }

    // Determine undo count based on whose turn it is
    const localState = state.getState('local');
    const undoCount = localState === 'turn' ? 1 : 2;

    // Validate history is long enough
    if (state.getHistory().length < undoCount) {
      console.warn('[Undo] Not enough history to undo', { count: undoCount });
      return;
    }

    // Initialize pending undo state
    state.initializeUndoRequest(undoCount as 1 | 2, 'local');

    // Transition to approval waiting state
    state.dispatch('local', 'UNDO');
    state.dispatch('remote', 'REMOTE_UNDO');

    send({ type: 'UNDO', payload: { count: undoCount } });
    return;
  }

  // Remote player requested undo
  if (state.hasPendingAction()) {
    send({ type: 'REJECT', payload: { action: 'undo', reason: 'busy' } });
    return;
  }

  // Validate state transitions
  if (!state.canAction('local', 'REMOTE_UNDO')) {
    console.warn('[Undo] Cannot accept remote UNDO request');
    send({ type: 'REJECT', payload: { action: 'undo', reason: 'invalid_state' } });
    return;
  }

  // Extract undo count from payload
  const payload = command.payload as { count?: number } | undefined;
  const count = payload?.count === 2 ? 2 : 1;

  // Validate count value
  if (payload?.count && payload.count !== 1 && payload.count !== 2) {
    send({ type: 'REJECT', payload: { action: 'undo', reason: 'invalid' } });
    return;
  }

  // Validate history is long enough
  if (count === 2 && state.getHistory().length < 2) {
    send({ type: 'REJECT', payload: { action: 'undo', reason: 'no_history' } });
    return;
  }

  // Determine who will resume after undo
  const resumePlayer = state.getState('local') === 'turn' ? 'local' : 'remote';

  // Initialize pending undo state
  state.initializeUndoRequest(count as 1 | 2, resumePlayer);

  // Transition to approval waiting state (remote initiated, local approving)
  state.dispatch('local', 'REMOTE_UNDO');
  state.dispatch('remote', 'UNDO');
};
