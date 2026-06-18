import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';

/**
 * Handle approval/rejection of pending requests (undo/restart)
 *
 * When local player approves/rejects a pending request:
 * - Apply undo/restart state changes (clear history, pop moves)
 * - Use dispatchApprove/dispatchReject for complex state transitions
 * - Notify peer of decision
 *
 * When remote player approves/rejects local's request:
 * - Similar flow but opposite state transitions
 */
export const request: CommandListener = (command) => {
  if (command.type !== 'APPROVE' && command.type !== 'REJECT') {
    return;
  }

  const state = getState();
  const action = state.getPendingAction();

  // No pending action to respond to
  if (!action) {
    console.warn('[Request] No pending action', { commandType: command.type });
    return;
  }

  const payload = command.payload as { action?: string; reason?: string } | undefined;

  // Verify payload matches pending action
  if (payload?.action && payload.action !== action) {
    console.warn('[Request] Action mismatch', { pending: action, payload: payload.action });
    return;
  }

  if (command.from === 'local') {
    if (command.type === 'APPROVE') {
      // Local player approves the request
      if (!state.canAction('local', 'APPROVE')) {
        console.warn('[Request] Cannot APPROVE from current state');
        return;
      }

      // Use special method for complex APPROVE transition
      state.dispatchApprove();

      // Apply the approved action (undo or restart)
      if (action === 'undo') {
        state.applyUndo(state.getPendingUndoCount() ?? 1);
      } else if (action === 'restart') {
        state.resetGame();
      }

      send({ type: 'APPROVE', payload: { action } });
      state.clearPendingStates();
      return;
    }

    // REJECT from local
    if (!state.canAction('local', 'REJECT')) {
      console.warn('[Request] Cannot REJECT from current state');
      return;
    }

    // Use special method for complex REJECT transition
    state.dispatchReject();

    send({
      type: 'REJECT',
      payload: { action, reason: payload?.reason ?? 'rejected' },
    });
    state.clearPendingStates();
    return;
  }

  // Remote player responded to local's request
  if (command.type === 'APPROVE') {
    // Remote player approves
    if (!state.canAction('local', 'APPROVE')) {
      console.warn('[Request] Cannot APPROVE from current state (remote approved)');
      return;
    }

    // Use special method for complex APPROVE transition
    state.dispatchApprove();

    // Apply the approved action (undo or restart)
    if (action === 'undo') {
      state.applyUndo(state.getPendingUndoCount() ?? 1);
    } else if (action === 'restart') {
      state.resetGame();
    }

    state.clearPendingStates();
    return;
  }

  // REJECT from remote
  if (!state.canAction('local', 'REJECT')) {
    console.warn('[Request] Cannot REJECT from current state (remote rejected)');
    state.clearPendingStates();
    return;
  }

  // Use special method for complex REJECT transition
  state.dispatchReject();
  state.clearPendingStates();
};
