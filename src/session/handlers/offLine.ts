import type { CommandListener } from '../commandBus';
import { getBus, getState } from '../context';

/**
 * Handle connection state changes (OFFLINE/ONLINE)
 *
 * OFFLINE: Record current turn state before disconnecting
 * ONLINE: Trigger sync to restore game state after reconnect
 *
 * Flow:
 * 1. OFFLINE arrives -> save resumeTurn, transition to offline
 * 2. ONLINE arrives -> transition to syncing, emit SYNC_REQUEST
 * 3. sync handler takes over -> restore history and turn assignment
 */
export const offline: CommandListener = (command) => {
  if (command.type !== 'OFFLINE' && command.type !== 'ONLINE') {
    return;
  }

  const state = getState();
  const bus = getBus();

  if (command.type === 'OFFLINE') {
    // Peer disconnected - save current turn state for later recovery
    if (!state.canAction('remote', 'OFFLINE')) {
      console.warn('[Offline] Cannot transition to OFFLINE from current state');
      return;
    }

    // Record who had the turn before going offline
    const currentTurn = state.getState('local') === 'turn' ? 'local' : 'remote';
    state.setResumeTurn(currentTurn);

    // Transition to offline state
    state.dispatch('remote', 'OFFLINE', 'offline');
    return;
  }

  // ONLINE - peer reconnected
  if (!state.canAction('remote', 'ONLINE')) {
    console.warn('[Offline] Cannot transition to ONLINE from current state');
    return;
  }

  // Transition to syncing state
  state.dispatch('remote', 'ONLINE', 'syncing');

  // Trigger sync to restore game state
  // sync handler will:
  // 1. Send SYNC_REQUEST
  // 2. Receive SYNC_STATE from peer
  // 3. Restore history and correct turn assignment
  bus.emit('SYNC_REQUEST', undefined, 'local');
};
