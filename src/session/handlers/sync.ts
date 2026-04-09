import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import type { PlayerLabel } from '../state/state';

/**
 * Handle game state synchronization after disconnect/reconnect
 *
 * SYNC_REQUEST: Initiator sends sync request, responder sends back complete game state
 * SYNC_STATE: Received game state, restore it, and transition both players to correct turn
 *
 * Synced data:
 * - history: All moves in order
 * - lastStart: Who started the last match (for turn rotation)
 * - turn: Current turn holder (to determine resume turn)
 * - resumeTurn: Who should have turn after sync (saved before disconnect)
 *
 * Flow:
 * 1. Local disconnects -> offline handler records resumeTurn
 * 2. Local reconnects -> online handler sends SYNC_REQUEST
 * 3. Remote responds with SYNC_STATE (history, lastStart, turn, resumeTurn)
 * 4. Local receives SYNC_STATE -> restores everything, calls dispatchSyncComplete
 * 5. Both FSMs now in correct 'turn'/'remote_turn' state
 */
export const sync: CommandListener = (command) => {
  const state = getState();

  if (command.type === 'SYNC_REQUEST') {
    if (command.from === 'local') {
      // Local player initiated sync (after reconnection)
      if (!state.canAction('local', 'SYNC')) {
        console.warn('[Sync] Cannot SYNC from current state');
        return;
      }

      // Both transition to syncing state
      state.dispatch('local', 'SYNC', 'syncing');
      state.dispatch('remote', 'SYNC', 'syncing');

      // Send request to peer (peer will respond with SYNC_STATE)
      send({ type: 'SYNC_REQUEST', from: '', payload: command.payload });
      return;
    }

    // Remote initiated sync - respond with complete game state
    const payload = {
      history: state.getHistory(),
      lastStart: state.getLastStart(),
      turn: state.getState('local') === 'turn' ? 'local' : 'remote',
      resumeTurn: state.getResumeTurn(), // Send back the saved resume turn
    };
    send({ type: 'SYNC_STATE', from: '', payload });
    return;
  }

  if (command.type !== 'SYNC_STATE') {
    return;
  }

  // Received complete game state from peer
  const payload = (command.payload as {
    history?: Array<{ turn: number; player: 'local' | 'remote'; move?: unknown }>;
    lastStart?: 'local' | 'remote' | null;
    turn?: 'local' | 'remote';
    resumeTurn?: 'local' | 'remote' | null;
  }) || {};

  // Restore game history from peer
  if (payload.history && payload.history.length > 0) {
    state.replaceHistory(payload.history);
  } else {
    state.clearHistory();
  }

  // Restore match start player (for turn rotation in next match)
  if (payload.lastStart) {
    state.setLastStart(payload.lastStart);
  } else {
    state.setLastStart(null);
  }

  // Determine who should have turn after sync
  // Priority: 1) resumeTurn from peer (what they saved on disconnect)
  //          2) turn from payload (whose turn it actually was)
  let nextPlayer: PlayerLabel;

  if (payload.resumeTurn) {
    // Use the saved resume turn if available
    nextPlayer = payload.resumeTurn;
  } else if (payload.turn) {
    // Otherwise use current turn from peer
    nextPlayer = payload.turn === 'local' ? 'local' : 'remote';
  } else {
    // Fallback to current state
    nextPlayer = state.getState('local') === 'turn' ? 'local' : 'remote';
  }

  console.log('[Sync] Restored game state', {
    historyLength: state.getHistory().length,
    lastStart: state.getLastStart(),
    nextTurnPlayer: nextPlayer,
  });

  // Use special method for complex SYNC_COMPLETE transition
  // This sets both local and remote FSM to correct 'turn'/'remote_turn' state
  state.dispatchSyncComplete(nextPlayer);
};
