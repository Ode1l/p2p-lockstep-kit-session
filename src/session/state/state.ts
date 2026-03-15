import { SessionFsm, SessionState, SessionEvent } from './fsm';

export type TurnEntry = {
  turn: number;
  player: 'self' | 'peer';
  move?: any;
};

export type PlayerLabel = "self" | "peer";
export type TurnSide = "local" | "remote";

export class State {
  private self = new SessionFsm('idle');
  private peer = new SessionFsm('idle');
  private readonly history: TurnEntry[] = [];
  private pendingAction: "undo" | "restart" | null = null;
  private lastStart: PlayerLabel | null = null;
  private resumeTurn: PlayerLabel | null = null;

  private getPlayer(player: PlayerLabel): SessionFsm {
    return player === 'self' ? this.self : this.peer;
  }

  public resolveSide(side: TurnSide): PlayerLabel {
    return side === "local" ? "self" : "peer";
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

  public pushHistory(entry: TurnEntry): void {
    this.history.push(entry);
  }

  public popHistory(): TurnEntry | null {
    return this.history.pop() ?? null;
  }

  public canAction(player: PlayerLabel, action: SessionEvent, to?: SessionState): boolean {
    return this.getPlayer(player).hasNextState(action, to);
  }

  public dispatch(player: PlayerLabel, action: SessionEvent, turn?: PlayerLabel): void {
    if (turn) {
      // todo
      this.getPlayer(player).dispatch(action);
    }
    this.getPlayer(player).dispatch(action);
  }

  public setPendingAction(action: "undo" | "restart") {
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
}
