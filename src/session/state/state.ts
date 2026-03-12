import { nextSessionState, type SessionEvent, type SessionState } from "./fsm";

export type TurnEntry = {
  turn: number;
  player: "self" | "peer";
  move?: any;
};

type PlayerLabel = "self" | "peer";

export class State {
  private selfState: SessionState;
  private peerState: SessionState;
  private readonly history: TurnEntry[] = [];

  public constructor() {
    this.selfState = "idle";
    this.peerState = "idle";
  }

  public nextState(event: SessionEvent): SessionState {
    return nextSessionState(this.selfState, event);
  }

  public transitionPeer(event: SessionEvent): SessionState {
    this.peerState = nextSessionState(this.peerState, event);
    return this.peerState;
  }

  public getSelfState(): SessionState {
    return this.selfState;
  }

  public getPeerState(): SessionState {
    return this.peerState;
  }

  public isReady(): boolean {
    return this.selfState === "ready";
  }

  public isPeerReady(): boolean {
    return this.peerState === "ready";
  }

  public getCurrentPlayer(): PlayerLabel | null {
    if (this.selfState === "my_turn") {
      return "self";
    }
    if (this.selfState === "peer_turn") {
      return "peer";
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
}
