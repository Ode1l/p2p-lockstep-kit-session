import type { IGamePlugin, GameState, ValidationResult } from './index';
import type { PlayerLabel, TurnEntry } from '../state/state';

/**
 * Example Game Plugin Implementation
 *
 * This template shows how to implement a game plugin for the framework.
 * Each game should create its own plugin class implementing IGamePlugin.
 *
 * Usage:
 * ```typescript
 * const session = createSession();
 * const gamePlugin = new MyGamePlugin();
 * session.state.setGamePlugin(gamePlugin);
 * ```
 */
export class GamePluginTemplate implements IGamePlugin {
  private gameData: any = null;

  /**
   * Validate if a move is legal according to game rules
   *
   * @param move The move data (format depends on your game)
   * @param gameState Current game state with history and FSM states
   * @returns { valid: true } if move is legal, { valid: false, reason: '...' } otherwise
   *
   * Example:
   * ```typescript
   * validateMove(move: ChessMove, gameState) {
   *   // Check if position is empty
   *   if (!gameState.board.isEmpty(move.to)) {
   *     return { valid: false, reason: 'Target position occupied' };
   *   }
   *   // Check if move is in legal moves
   *   if (!isLegalMove(move)) {
   *     return { valid: false, reason: 'Illegal move' };
   *   }
   *   return { valid: true };
   * }
   * ```
   */
  validateMove(move: unknown, gameState: GameState): ValidationResult {
    // Extract game-specific data from history
    // Example: const board = this.buildBoard(gameState.history);

    // Validate move against game rules
    // Example: if (!board.isValidMove(move as ChessMove)) { ... }

    // For template, allow all moves
    return { valid: true };
  }

  /**
   * Check if game has ended (someone won or draw)
   *
   * Called after each move to determine if game should continue.
   * Return winner if game ended, null if game continues.
   *
   * @param gameState Current game state
   * @param history All moves so far (complete game history)
   * @returns Winner ('local' or 'remote') if game ended, null to continue
   *
   * Example:
   * ```typescript
   * checkWin(gameState, history) {
   *   const board = this.buildBoard(history);
   *
   *   // Check local wins
   *   if (board.isWin('local')) return 'local';
   *
   *   // Check remote wins
   *   if (board.isWin('remote')) return 'remote';
   *
   *   // Check draw
   *   if (board.isFull()) return null; // or 'draw'?
   *
   *   // Game continues
   *   return null;
   * }
   * ```
   */
  checkWin(gameState: GameState, history: TurnEntry[]): PlayerLabel | null {
    // Build game state from history
    // Example: const board = this.buildBoard(history);

    // Check win conditions
    // Example:
    // - if (board.hasThreeInARow('local')) return 'local';
    // - if (board.hasThreeInARow('remote')) return 'remote';

    // Check draw conditions
    // Example:
    // - if (board.isFull() && !winner) return null; // draw

    // For template, no winner
    return null;
  }

  /**
   * Optional: Initialize game state
   * Called when game starts (session created or START handler executed)
   *
   * Use this to:
   * - Initialize internal game data structures
   * - Set up board/game state
   * - Load initial configuration
   *
   * Example:
   * ```typescript
   * initialize() {
   *   this.gameData = {
   *     board: new ChessBoard(),
   *     moves: [],
   *     captured: { local: [], remote: [] }
   *   };
   * }
   * ```
   */
  initialize(): void {
    console.log('[GamePlugin] Initialized');
    this.gameData = {
      // Initialize your game data here
    };
  }

  /**
   * Optional: Cleanup when game ends
   * Called when game ends (GAME_OVER or RESTART handlers)
   *
   * Use this to:
   * - Clear internal state
   * - Save game statistics
   * - Clean up resources
   *
   * Example:
   * ```typescript
   * cleanup() {
   *   this.gameData = null;
   *   console.log('Game ended');
   * }
   * ```
   */
  cleanup(): void {
    console.log('[GamePlugin] Cleanup');
    this.gameData = null;
  }

  /**
   * Helper: Build game state from move history
   * Reconstruct the complete game board/state from move sequence
   *
   * @param history All moves in sequence
   * @returns Your game's internal state representation
   *
   * Example for Chess:
   * ```typescript
   * private buildBoard(history: TurnEntry[]) {
   *   const board = new ChessBoard();
   *   for (const entry of history) {
   *     const move = entry.move as ChessMove;
   *     board.makeMove(move);
   *   }
   *   return board;
   * }
   * ```
   */
  private buildBoard(history: TurnEntry[]): any {
    // TODO: Implement for your game
    // This should reconstruct the complete game state from move history
    return {};
  }
}

/**
 * Usage Example in your game:
 *
 * ```typescript
 * import { createSession } from 'p2p-lockstep-kit-session';
 * import { GamePluginTemplate } from './GamePluginTemplate';
 *
 * // Create session
 * const session = createSession();
 *
 * // Create and inject your game plugin
 * const plugin = new GamePluginTemplate();
 * session.state.setGamePlugin(plugin);
 *
 * // Now the framework will:
 * // 1. Validate all moves using your validateMove()
 * // 2. Check win conditions using your checkWin()
 * // 3. Call initialize() on game start
 * // 4. Call cleanup() on game end
 *
 * // Game loop
 * session.bus.emit('READY', undefined, 'local');
 * // ... game progresses ...
 * session.bus.emit('MOVE', { x: 3, y: 5 }, 'local'); // Will be validated!
 * // ... on GAME_OVER, your plugin's cleanup() is called
 * ```
 */

