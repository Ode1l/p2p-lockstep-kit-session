import type { TurnEntry, PlayerLabel } from '../state/state';

/**
 * Game Plugin Interface
 *
 * Games implement this interface to provide:
 * - Move validation (rule checking)
 * - Win condition checking
 * - Game state serialization
 */
export interface IGamePlugin {
  /**
   * Validate if a move is legal according to game rules
   * @param move The move to validate
   * @param gameState Current game state for validation context
   * @returns Validation result with reason if invalid
   */
  validateMove(
    move: unknown,
    gameState: GameState,
  ): ValidationResult;

  /**
   * Check if game has ended (someone won or draw)
   * @param gameState Current game state
   * @param history All moves so far
   * @returns Winner (local/remote) or null if game continues
   */
  checkWin(
    gameState: GameState,
    history: TurnEntry[],
  ): PlayerLabel | null;

  /**
   * Optional: Initialize game state
   * Called when game starts
   */
  initialize?(): void;

  /**
   * Optional: Cleanup when game ends
   * Called when GAME_OVER or RESTART
   */
  cleanup?(): void;
}

/**
 * Validation result from rule checking
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string; // Error reason if invalid
}

/**
 * Game state context passed to plugin
 */
export interface GameState {
  history: TurnEntry[];
  localState: 'turn' | 'remote_turn' | string;
  remoteState: 'turn' | 'remote_turn' | string;
  turn: number;
  lastStart: PlayerLabel | null;
}

/**
 * Default plugin (allow all moves, no win condition)
 * Used when no custom plugin is provided
 */
export class DefaultGamePlugin implements IGamePlugin {
  validateMove(): ValidationResult {
    return { valid: true };
  }

  checkWin(): PlayerLabel | null {
    return null;
  }
}

