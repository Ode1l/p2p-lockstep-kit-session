import type { BusMessage } from '../commandBus';
import type { PlayerLabel, TurnEntry } from '../state/state';
import type { SessionState } from '../state/fsm';

/**
 * Game state snapshot for UI rendering
 * Minimal data structure that UI needs to display game state
 */
export interface GameStateSnapshot {
  // Player states
  localState: SessionState;
  remoteState: SessionState;

  // Game info
  turn: number;
  history: TurnEntry[];
  lastStart: PlayerLabel | null;

  // Pending actions
  pendingAction: 'undo' | 'restart' | null;

  // Connection
  connected: boolean;
}

/**
 * Game events that trigger UI updates
 */
export interface GameEvent {
  type: 'READY' | 'START' | 'MOVE' | 'GAME_OVER' | 'UNDO' | 'RESTART' | 'OFFLINE' | 'ONLINE' | 'SYNC' | 'ERROR';
  payload?: any;
  from?: 'local' | 'remote';
  timestamp?: number;
}

/**
 * UI Observer Interface
 * Implement this to receive game state updates
 */
export interface IGameObserver {
  /**
   * Called when game state changes
   * UI should re-render based on this snapshot
   */
  onStateChange(snapshot: GameStateSnapshot): void;

  /**
   * Called when a game event occurs
   * Use this for animations, sounds, notifications, etc.
   */
  onGameEvent(event: GameEvent): void;

  /**
   * Called when connection status changes
   */
  onConnectionChange?(connected: boolean): void;

  /**
   * Called when error occurs
   */
  onError?(error: { message: string; context?: any }): void;
}

/**
 * Game State Observer Manager
 * Manages UI observers and notifies them of state changes
 */
export class GameStateObserver {
  private observers: Set<IGameObserver> = new Set();
  private currentSnapshot: GameStateSnapshot | null = null;
  private lastEventTimestamp: number = 0;

  /**
   * Register a UI observer
   */
  public subscribe(observer: IGameObserver): () => void {
    this.observers.add(observer);

    // Return unsubscribe function
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Unregister a UI observer
   */
  public unsubscribe(observer: IGameObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Notify all observers of state change
   */
  public notifyStateChange(snapshot: GameStateSnapshot): void {
    this.currentSnapshot = snapshot;

    for (const observer of this.observers) {
      try {
        observer.onStateChange(snapshot);
      } catch (err) {
        console.error('[GameStateObserver] Error notifying state change:', err);
      }
    }
  }

  /**
   * Notify all observers of game event
   */
  public notifyGameEvent(event: GameEvent): void {
    event.timestamp = Date.now();

    for (const observer of this.observers) {
      try {
        observer.onGameEvent(event);
      } catch (err) {
        console.error('[GameStateObserver] Error notifying game event:', err);
      }
    }
  }

  /**
   * Notify all observers of connection change
   */
  public notifyConnectionChange(connected: boolean): void {
    for (const observer of this.observers) {
      try {
        observer.onConnectionChange?.(connected);
      } catch (err) {
        console.error('[GameStateObserver] Error notifying connection change:', err);
      }
    }
  }

  /**
   * Notify all observers of error
   */
  public notifyError(error: { message: string; context?: any }): void {
    for (const observer of this.observers) {
      try {
        observer.onError?.(error);
      } catch (err) {
        console.error('[GameStateObserver] Error notifying error:', err);
      }
    }
  }

  /**
   * Get current snapshot
   */
  public getSnapshot(): GameStateSnapshot | null {
    return this.currentSnapshot;
  }

  /**
   * Get observer count (useful for debugging)
   */
  public getObserverCount(): number {
    return this.observers.size;
  }
}

