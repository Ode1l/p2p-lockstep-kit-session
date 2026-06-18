import type { CommandListener } from '../commandBus';
import { getBus, getState, send } from '../context';
import type { SessionMessage } from '../../utils';

/**
 * Handle player move in game
 *
 * Flow:
 * 1. Validate move using game plugin (rule checking)
 * 2. Dispatch state transitions
 * 3. Record move in history
 * 4. Check win condition using game plugin
 * 5. Send to peer or emit GAME_OVER if won
 *
 * The game plugin is injected via state.setGamePlugin(), allowing
 * different games to provide their own rule validation and win logic.
 */
export const move: CommandListener = (command) => {
  const state = getState();
  const bus = getBus();
  const movePayload = command.payload;

  if (command.from === 'local') {
    // Local player making a move
    if (!state.canAction('local', 'MOVE')) {
      console.warn('[Move] Cannot MOVE from current state', {
        state: state.getState('local'),
      });
      return;
    }

    // ===== PROXY POINT 1: Validate move using game plugin =====
    const validation = state.validateMove(movePayload);
    if (!validation.valid) {
      console.warn('[Move] Move validation failed', {
        reason: validation.reason,
        move: movePayload,
      });
      // Could send REJECT to inform peer, but for now silently return
      return;
    }

    // Dispatch state transitions
    state.dispatch('local', 'MOVE');
    state.dispatch('remote', 'REMOTE_MOVE');

    // Record move in history
    const turn = state.getTurnCount();
    state.pushHistory({
      turn,
      player: 'local',
      move: movePayload,
    });

    // ===== PROXY POINT 2: Check win condition using game plugin =====
    const winner = state.checkWin();
    if (winner) {
      // Game ended - someone won
      console.log('[Move] Game over, winner:', winner);

      // Notify bus that game ended (for UI to display winner)
      bus.emit('GAME_OVER', { winner, turn }, 'local');

      // Send game over to peer
      send({
        type: 'GAME_OVER',
        payload: { winner, turn },
      });

      // Transition both FSMs back to idle (game ready to restart)
      state.dispatch('local', 'GAME_OVER');
      state.dispatch('remote', 'GAME_OVER');
      state.cleanupGame();
      return;
    }

    // Send move to peer
    const message: SessionMessage = {
      type: 'MOVE',
      turn,
      payload: movePayload,
    };
    send(message);
    return;
  }

  // Remote player made a move
  if (!state.canAction('remote', 'MOVE')) {
    console.warn('[Move] Cannot MOVE for remote player', {
      state: state.getState('remote'),
    });
    return;
  }

  // ===== PROXY POINT 1: Validate remote move =====
  const validation = state.validateMove(movePayload);
  if (!validation.valid) {
    console.warn('[Move] Remote move validation failed', {
      reason: validation.reason,
      move: movePayload,
    });
    return;
  }

  // Dispatch state transitions
  state.dispatch('remote', 'MOVE');
  state.dispatch('local', 'REMOTE_MOVE');

  // Record move in history
  const turn = state.getTurnCount();
  state.pushHistory({
    turn,
    player: 'remote',
    move: movePayload,
  });

  // ===== PROXY POINT 2: Check win condition =====
  const winner = state.checkWin();
  if (winner) {
    // Game ended - someone won
    console.log('[Move] Game over, winner:', winner);

    // Notify bus that game ended (for UI to display winner)
    bus.emit('GAME_OVER', { winner, turn }, 'local');

    // Transition both FSMs back to idle (game ready to restart)
    state.dispatch('local', 'GAME_OVER');
    state.dispatch('remote', 'GAME_OVER');
    state.cleanupGame();
  }
};
