import { SessionEvent, SessionFsm, SessionState } from './fsm';

export type TurnEntry = {
  turn: number;
  player: 'local' | 'remote';
  move?: any;
};

export type PlayerLabel = 'local' | 'remote';
export type TurnSide = 'local' | 'remote';
export type TurnStateLabel = 'my_turn' | 'remote_turn';

export class State {
  private local = new SessionFsm('idle');
  private remote = new SessionFsm('idle');
  private readonly localId: string | null = null;
  private remoteId: string | null = null;
  private readonly history: TurnEntry[] = [];
  private pendingAction: 'undo' | 'restart' | null = null;
  private lastStart: PlayerLabel | null = null;
  private resumeTurn: PlayerLabel | null = null;

  constructor(id: string | null, remoteId: string | null) {
    if (id) {
      this.localId = id;
    }
    if (remoteId) {
      this.remoteId = remoteId;
    }
  }

  public setremoteId(id: string) {
    this.remoteId = id;
  }

  public getId(): string | null {
    return this.localId;
  }

  public getremoteId(): string | null {
    return this.remoteId;
  }

  public resolveSide(side: TurnSide): PlayerLabel {
    return side === 'local' ? 'local' : 'remote';
  }

  public getState(player: PlayerLabel): SessionState {
    return this.getPlayer(player).getState();
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
      entry.player = this.reversePlayer(entry.player);
      this.pushHistory(entry);
    });
  }

  public clearHistory(): void {
    this.history.splice(0, this.history.length);
  }

  public pushHistory(entry: TurnEntry): void {
    this.history.push(entry);
  }

  public popHistory(): TurnEntry | null {
    return this.history.pop() ?? null;
  }

  public canAction(
    player: PlayerLabel,
    action: SessionEvent,
    to?: SessionState | TurnStateLabel,
  ): boolean {
    return this.getPlayer(player).hasNextState(action, to); // todo resolve diff type of to
  }

  public dispatch(
    player: PlayerLabel,
    action: SessionEvent,
    to?: SessionState | TurnStateLabel,
  ): void {
    this.getPlayer(player).dispatch(action, to); // todo resolve diff type of to
  }

  public setPendingAction(action: 'undo' | 'restart' | null) {
    this.pendingAction = action;
  }

  public getPendingAction() {
    return this.pendingAction;
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

  public getAvailableActions(player: PlayerLabel): SessionEvent[] {
    const candidates: SessionEvent[] = [
      'READY',
      'REMOTE_READY',
      'START',
      'REMOTE_START',
      'MOVE',
      'REMOTE_MOVE',
      'UNDO',
      'REMOTE_UNDO',
      'APPROVE',
      'REJECT',
      'GAME_OVER',
      'REJOIN',
      'SYNC',
      'SYNC_COMPLETE',
      'RESTART',
    ];
    return candidates.filter((action) => this.canAction(player, action));
  }

  private getPlayer(player: PlayerLabel): SessionFsm {
    return player === 'local' ? this.local : this.remote;
  }

  private reversePlayer(player: PlayerLabel): PlayerLabel {
    return player === 'local' ? 'remote' : 'local';
  }
}
