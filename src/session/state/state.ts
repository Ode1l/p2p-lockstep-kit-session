import { nextSessionState, type SessionEvent, type SessionState } from "./fsm";

export type TurnEntry = {
  turn: number;
  player: "self" | "peer";
  move?: any;
};

type PlayerLabel = "self" | "peer";

export class State {
  private self: SessionState;
  private peer: SessionState;
  private readonly history: TurnEntry[] = [];

  public constructor() {
    this.self = 'idle';
    this.peer = 'idle';
  }

  public nextState(player: PlayerLabel, event: SessionEvent): SessionState {
    return nextSessionState(this[player], event);
  }

  public getSelfState(): SessionState {
    return this.self;
  }

  public getPeerState(): SessionState {
    return this.peer;
  }

  public isReady(): boolean {
    return this.self === 'ready';
  }

  public isPeerReady(): boolean {
    return this.peer === 'ready';
  }

  public getCurrentPlayer(): PlayerLabel | null {
    if (this.self === 'my_turn') {
      return 'self';
    }
    if (this.self === 'peer_turn') {
      return 'peer';
    }
    return null;
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

  private getOtherPlayer(player: PlayerLabel): PlayerLabel {
    return player === 'self' ? 'peer' : 'self';
  }

  public move(step: TurnEntry): void {
    this.pushHistory(step);
    const other = this.getOtherPlayer(step.player);
    this[step.player] = nextSessionState(this[step.player], 'MOVE');
    this[other] = nextSessionState(this[other], 'PEER_MOVE');
  }
}
