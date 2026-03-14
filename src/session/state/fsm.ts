export type SessionState =
  | "idle"
  | "ready"
  | "could_start"
  | "my_turn"
  | "peer_turn"
  | "approving"
  | "waiting_approval"
  | "syncing";

export type SessionEvent =
  | "PEER_READY"
  | "READY"
  | "START"
  | "PEER_START"
  | "MOVE"
  | "PEER_MOVE"
  | "REQUEST"
  | "APPROVE"
  | "REJECT"
  | "GAME_OVER"
  | "REJOIN"
  | "SYNC"
  | "SYNC_COMPLETE"
  | "RESTART";

export type Transition = {
  from: SessionState;
  event: SessionEvent;
  to: SessionState;
};

const transitions: Transition[] = [
  // Lobby readiness
  { from: 'idle', event: 'READY', to: 'ready' },
  { from: 'ready', event: 'READY', to: 'idle' },
  { from: 'idle', event: 'PEER_READY', to: 'could_start' },
  { from: 'could_start', event: 'PEER_READY', to: 'idle' },

  // Match start / turn assignment
  { from: 'ready', event: 'PEER_START', to: 'my_turn' },
  { from: 'ready', event: 'PEER_START', to: 'peer_turn' },
  { from: 'could_start', event: 'START', to: 'my_turn' },
  { from: 'could_start', event: 'START', to: 'peer_turn' },

  // Turn swapping after moves
  { from: 'my_turn', event: 'MOVE', to: 'peer_turn' },
  { from: 'peer_turn', event: 'PEER_MOVE', to: 'my_turn' },

  // Requests initiated by local player (undo/restart)
  { from: 'my_turn', event: 'REQUEST', to: 'waiting_approval' },
  { from: 'peer_turn', event: 'REQUEST', to: 'waiting_approval' },

  // Requests coming from peer (we need to approve)
  { from: 'my_turn', event: 'REQUEST', to: 'approving' },
  { from: 'peer_turn', event: 'REQUEST', to: 'approving' },

  // Approval outcomes when we were waiting
  { from: 'waiting_approval', event: 'APPROVE', to: 'my_turn' },
  { from: 'waiting_approval', event: 'REJECT', to: 'my_turn' },

  // Approval outcomes when we were confirming
  { from: 'approving', event: 'APPROVE', to: 'peer_turn' },
  { from: 'approving', event: 'REJECT', to: 'peer_turn' },

  // Game end resets back to lobby idle
  { from: 'my_turn', event: 'GAME_OVER', to: 'idle' },
  { from: 'peer_turn', event: 'GAME_OVER', to: 'idle' },
  { from: 'waiting_approval', event: 'GAME_OVER', to: 'idle' },
  { from: 'approving', event: 'GAME_OVER', to: 'idle' },

  // Rejoin/sync flows
  { from: 'my_turn', event: 'SYNC', to: 'syncing' },
  { from: 'peer_turn', event: 'SYNC', to: 'syncing' },
  { from: 'waiting_approval', event: 'SYNC', to: 'syncing' },
  { from: 'approving', event: 'SYNC', to: 'syncing' },
  { from: 'idle', event: 'REJOIN', to: 'syncing' },
  { from: 'ready', event: 'REJOIN', to: 'syncing' },
  { from: 'syncing', event: 'SYNC_COMPLETE', to: 'my_turn' },
  { from: 'syncing', event: 'SYNC_COMPLETE', to: 'peer_turn' },
];

const nextState = (state: SessionState, event: SessionEvent): SessionState => {
  const hit = transitions.find((t) => t.from === state && t.event === event);
  return hit ? hit.to : state;
};

const hasNextState = (
  state: SessionState,
  action: SessionEvent): boolean => {
  return !!transitions.find((t) => t.from === state && t.event === action);
}

export class SessionFsm {
  private state: SessionState;

  constructor(state: SessionState = "idle") {
    this.state = state;
  }

  public getState(): SessionState {
    return this.state;
  }

  public hasNextState(event: SessionEvent): boolean {
    return hasNextState(this.state, event);
  }

  public getNextState(event: SessionEvent): SessionState {
    return nextState(this.state, event);
  }

  public dispatch(action: SessionEvent) {
     this.state = nextState(this.state, action);
  }
}