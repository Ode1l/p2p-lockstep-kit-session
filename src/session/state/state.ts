import { SessionFsm, SessionState, SessionEvent } from './fsm';

export type TurnEntry = {
  turn: number;
  player: 'self' | 'peer';
  move?: any;
};

export type PlayerLabel = "self" | "peer";

export class State {
  private self = new SessionFsm('idle');
  private peer = new SessionFsm('idle');
  private readonly history: TurnEntry[] = [];

  public getState(player: PlayerLabel): SessionState {
    return this[player].getState();
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

  public canAction(player: PlayerLabel, action: SessionEvent): boolean {
    return this[player].hasNextState(action);
  }

  public dispatch(player: PlayerLabel, action: SessionEvent): void {
    this[player].dispatch(action);
  }
}
