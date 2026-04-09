import { SessionEvent, SessionFsm, SessionState } from './fsm';
import type {
  IGamePlugin,
  GameState,
  ValidationResult,
  IStateObserver,
} from '../observer';
import { DefaultGamePlugin, StateObserverManager } from '../observer';

export type TurnEntry = {
  turn: number;
  player: 'local' | 'remote';
  move?: any;
};

export type PlayerLabel = 'local' | 'remote';

export class State {
  // will update map when multi-players (>=3)
  private local = new SessionFsm('idle');
  private remote = new SessionFsm('idle');
  // for compare remote is same people or not
  private readonly localId: string | null = null;
  private remoteId: string | null = null;
  // store all actions
  private readonly history: TurnEntry[] = [];
  // pending some state
  private pendingAction: 'undo' | 'restart' | null = null;
  private pendingUndoCount: 1 | 2 | null = null;
  private resumeTurn: PlayerLabel | null = null;
  private lastStart: PlayerLabel | null = null;

  // Game plugin for rule validation and win checking
  private gamePlugin: IGamePlugin = new DefaultGamePlugin();

  // Internal state observer for UI notifications
  private stateObserverManager = new StateObserverManager();

  constructor(id: string | null, remoteId: string | null) {
    if (id) {
      this.localId = id;
    }
    if (remoteId) {
      this.remoteId = remoteId;
    }
  }

  /**
   * Register an internal observer (like plugin pattern)
   * Use this to connect State mutations to UI updates
   */
  public subscribeStateObserver(observer: IStateObserver): void {
    this.stateObserverManager.subscribe(observer);
  }

  // ...existing code...

  public getId(): string | null {
    return this.localId;
  }

  public getremoteId(): string | null {
    return this.remoteId;
  }

  public setremoteId(id: string) {
    this.remoteId = id;
  }

  public getState(player: PlayerLabel): SessionState {
    return this.getPlayerFsm(player).getState();
  }

  public getTurnCount(): number {
    return this.history.length + 1;
  }

  public getHistory(): TurnEntry[] {
    return this.history.slice();
  }

  public replaceHistory(entries: TurnEntry[]): void {
    this.clearHistory();
    entries.forEach((entry) => {
      this.pushHistory({
        turn: entry.turn,
        player: entry.player,
        move: entry.move,
      });
    });
  }

  public clearHistory(): void {
    this.history.splice(0, this.history.length);
    this.stateObserverManager.notifyHistoryChanged();
  }

  public pushHistory(entry: TurnEntry): void {
    this.history.push(entry);
    this.stateObserverManager.notifyHistoryChanged();
  }

  public popHistory(): TurnEntry | null {
    return this.history.pop() ?? null;
  }

  public canAction(
    player: PlayerLabel,
    action: SessionEvent,
  ): boolean {
    return this.getPlayerFsm(player).hasNextState(action);
  }

  /**
   * Dispatch an action and automatically determine target state if unique
   * Only use explicit 'to' parameter for ambiguous transitions (APPROVE, REJECT, etc.)
   *
   * For most actions (READY, MOVE, START, etc.), there's only one valid transition,
   * so we automatically find and apply it.
   */
  public dispatch(
    player: PlayerLabel,
    action: SessionEvent,
    to?: SessionState,
  ): void {
    this.getPlayerFsm(player).dispatch(action, to);
    // Notify all state observers after state change
    this.stateObserverManager.notifyStateChanged();
  }

  public setPendingAction(action: 'undo' | 'restart' | null) {
    this.pendingAction = action;
  }

  public getPendingAction() {
    return this.pendingAction;
  }

  public setPendingUndoCount(count: 1 | 2 | null) {
    this.pendingUndoCount = count;
  }

  public getPendingUndoCount(): 1 | 2 | null {
    return this.pendingUndoCount;
  }

  public setLastStart(player: PlayerLabel | null) {
    this.lastStart = player;
  }

  public getLastStart(): PlayerLabel | null {
    return this.lastStart;
  }

  public setResumeTurn(player: PlayerLabel | null) {
    this.resumeTurn = player;
  }

  public getResumeTurn(): PlayerLabel | null {
    return this.resumeTurn;
  }

  private getPlayerFsm(player: PlayerLabel): SessionFsm {
    return player === 'local' ? this.local : this.remote;
  }

  // ===== Helper Methods for Undo/Restart Request Handling =====

  /**
   * Save game state snapshot for undo/restart operations
   */
  private gameSnapshot: unknown = null;

  public saveGameSnapshot(snapshot: unknown): void {
    this.gameSnapshot = snapshot;
  }

  public getGameSnapshot(): unknown {
    return this.gameSnapshot;
  }

  public clearGameSnapshot(): void {
    this.gameSnapshot = null;
  }

  /**
   * Check if there's a pending action (undo/restart)
   */
  public hasPendingAction(): boolean {
    return this.pendingAction !== null;
  }

  /**
   * Clear all pending states (called after approval/rejection)
   */
  public clearPendingStates(): void {
    this.pendingAction = null;
    this.pendingUndoCount = null;
    this.resumeTurn = null;
  }

  /**
   * Initialize undo request with undo count and current turn holder
   */
  public initializeUndoRequest(undoCount: 1 | 2, resumeTurn: PlayerLabel): void {
    this.pendingAction = 'undo';
    this.pendingUndoCount = undoCount;
    this.resumeTurn = resumeTurn;
  }

  /**
   * Initialize restart request with resume turn
   */
  public initializeRestartRequest(resumeTurn: PlayerLabel): void {
    this.pendingAction = 'restart';
    this.resumeTurn = resumeTurn;
  }

  /**
   * Check if pending action is undo
   */
  public isPendingUndo(): boolean {
    return this.pendingAction === 'undo';
  }

  /**
   * Check if pending action is restart
   */
  public isPendingRestart(): boolean {
    return this.pendingAction === 'restart';
  }

  /**
   * Apply undo by popping history N times
   */
  public applyUndo(count: 1 | 2 = 1): void {
    for (let i = 0; i < count; i++) {
      this.popHistory();
    }
  }

  /**
   * Reset game state to initial (for restart)
   */
  public resetGame(): void {
    this.clearHistory();
    this.local = new SessionFsm('idle');
    this.remote = new SessionFsm('idle');
    this.lastStart = null;
    this.resumeTurn = null;
    this.stateObserverManager.notifyGameReset();
  }

  /**
   * Save start player for rejoin flow
   */
  public recordStartPlayer(player: PlayerLabel): void {
    this.lastStart = player;
  }

  /**
   * Get move to undo from history
   */
  public getLastMove(): TurnEntry | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  // ===== Specialized FSM Dispatch Methods =====

  /**
   * Dispatch APPROVE action with automatic target state resolution
   * Multiple valid transitions exist - use state context to determine target
   */
  public dispatchApprove(): void {
    const localState = this.local.getState();
    if (localState === 'waiting_approval') {
      // Local was waiting, always go back to turn
      this.local.dispatch('APPROVE', 'turn');
      this.remote.dispatch('APPROVE', 'turn');
    } else if (localState === 'approving') {
      // Local was confirming, peer takes turn
      this.local.dispatch('APPROVE', 'remote_turn');
      this.remote.dispatch('APPROVE', 'remote_turn');
    }
  }

  /**
   * Dispatch REJECT action with automatic target state resolution
   * Multiple valid transitions exist - use resumeTurn to determine who continues
   */
  public dispatchReject(): void {
    const localState = this.local.getState();

    if (localState === 'waiting_approval' || localState === 'approving') {
      // resumeTurn tells us who should have turn after rejection
      const targetState = this.resumeTurn === 'local' ? 'turn' : 'remote_turn';
      this.local.dispatch('REJECT', targetState);
      this.remote.dispatch('REJECT', targetState);
    }
  }

  /**
   * Dispatch START action with automatic target state resolution
   * Determines who plays first based on starter parameter
   */
  public dispatchStart(firstPlayer: PlayerLabel): void {
    if (firstPlayer === 'local') {
      this.local.dispatch('START', 'turn');
      this.remote.dispatch('START', 'remote_turn');
      this.lastStart = 'local';
    } else {
      this.local.dispatch('START', 'remote_turn');
      this.remote.dispatch('START', 'turn');
      this.lastStart = 'remote';
    }
  }

  /**
   * Dispatch SYNC_COMPLETE with automatic target state resolution
   * Based on who should have the turn after sync
   */
  public dispatchSyncComplete(nextPlayer: PlayerLabel): void {
    if (nextPlayer === 'local') {
      this.local.dispatch('SYNC_COMPLETE', 'turn');
      this.remote.dispatch('SYNC_COMPLETE', 'remote_turn');
    } else {
      this.local.dispatch('SYNC_COMPLETE', 'remote_turn');
      this.remote.dispatch('SYNC_COMPLETE', 'turn');
    }
    this.resumeTurn = nextPlayer;
  }

  // ===== Game Plugin Integration (Proxy Pattern) =====

  /**
   * Set the game plugin for rule validation and win checking
   * @param plugin Implementation of IGamePlugin
   */
  public setGamePlugin(plugin: IGamePlugin): void {
    this.gamePlugin = plugin;
    if (plugin.initialize) {
      plugin.initialize();
    }
  }

  /**
   * Get current game plugin
   */
  public getGamePlugin(): IGamePlugin {
    return this.gamePlugin;
  }

  /**
   * Validate a move using the game plugin
   * Called by move handler to check if move is legal
   * @param move The move data to validate
   * @returns Validation result with reason if invalid
   */
  public validateMove(move: unknown): ValidationResult {
    const gameState = this.buildGameState();
    return this.gamePlugin.validateMove(move, gameState);
  }

  /**
   * Check if game has ended (someone won)
   * Called by move handler after move is applied
   * @returns Winner (local/remote) or null if game continues
   */
  public checkWin(): PlayerLabel | null {
    const gameState = this.buildGameState();
    return this.gamePlugin.checkWin(gameState, this.getHistory());
  }

  /**
   * Cleanup when game ends (for plugin to reset internal state)
   */
  public cleanupGame(): void {
    if (this.gamePlugin.cleanup) {
      this.gamePlugin.cleanup();
    }
  }

  /**
   * Build game state for plugin
   * @private
   */
  private buildGameState(): GameState {
    return {
      history: this.getHistory(),
      localState: this.getState('local'),
      remoteState: this.getState('remote'),
      turn: this.getTurnCount(),
      lastStart: this.getLastStart(),
    };
  }
}
