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

  private getMachine(player: PlayerLabel): SessionFsm {
    return player === 'self' ? this.self : this.peer;
  }

  public getState(player: PlayerLabel): SessionState {
    return this.getMachine(player).getState();
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
    return this.getMachine(player).hasNextState(action);
  }

  public dispatch(player: PlayerLabel, action: SessionEvent): void {
    this.getMachine(player).dispatch(action);
  }
}
