export type SessionState =
  | 'idle'
  | 'ready'
  | 'could_start'
  | 'my_turn'
  | 'remote_turn'
  | 'approving'
  | 'waiting_approval'
  | 'syncing';

export type SessionEvent =
  | 'REMOTE_READY'
  | 'READY'
  | 'START'
  | 'REMOTE_START'
  | 'MOVE'
  | 'REMOTE_MOVE'
  | 'UNDO'
  | 'REMOTE_UNDO'
  | 'RESTART'
  | 'REMOTE_RESTART'
  | 'APPROVE'
  | 'REJECT'
  | 'GAME_OVER'
  | 'REJOIN'
  | 'SYNC'
  | 'SYNC_COMPLETE';

export type Transition = {
  from: SessionState;
  event: SessionEvent;
  to: SessionState;
};

const transitions: Transition[] = [
  // Lobby readiness
  { from: 'idle', event: 'READY', to: 'ready' },
  { from: 'ready', event: 'READY', to: 'idle' },
  { from: 'idle', event: 'REMOTE_READY', to: 'could_start' },
  { from: 'could_start', event: 'REMOTE_READY', to: 'idle' },
  { from: 'ready', event: 'REJECT', to: 'idle' },
  { from: 'could_start', event: 'REJECT', to: 'idle' },

  // Match start / turn assignment
  { from: 'ready', event: 'REMOTE_START', to: 'my_turn' },
  { from: 'ready', event: 'REMOTE_START', to: 'remote_turn' },
  { from: 'could_start', event: 'START', to: 'my_turn' },
  { from: 'could_start', event: 'START', to: 'remote_turn' },

  // Turn swapping after moves
  { from: 'my_turn', event: 'MOVE', to: 'remote_turn' },
  { from: 'remote_turn', event: 'REMOTE_MOVE', to: 'my_turn' },
  { from: 'my_turn', event: 'REJECT', to: 'my_turn' },
  { from: 'remote_turn', event: 'REJECT', to: 'remote_turn' },

  // Requests initiated by local player (undo/restart)
  { from: 'my_turn', event: 'UNDO', to: 'waiting_approval' },
  { from: 'remote_turn', event: 'UNDO', to: 'waiting_approval' },
  { from: 'my_turn', event: 'RESTART', to: 'waiting_approval' },
  { from: 'remote_turn', event: 'RESTART', to: 'waiting_approval' },

  // Requests coming from remote (we need to approve)
  { from: 'my_turn', event: 'REMOTE_UNDO', to: 'approving' },
  { from: 'remote_turn', event: 'REMOTE_UNDO', to: 'approving' },
  { from: 'my_turn', event: 'REMOTE_RESTART', to: 'approving' },
  { from: 'remote_turn', event: 'REMOTE_RESTART', to: 'approving' },

  // Approval outcomes when we were waiting
  { from: 'waiting_approval', event: 'APPROVE', to: 'my_turn' },
  { from: 'waiting_approval', event: 'REJECT', to: 'my_turn' },
  { from: 'waiting_approval', event: 'REJECT', to: 'remote_turn' },

  // Approval outcomes when we were confirming
  { from: 'approving', event: 'APPROVE', to: 'remote_turn' },
  { from: 'approving', event: 'REJECT', to: 'remote_turn' },
  { from: 'approving', event: 'REJECT', to: 'my_turn' },

  // Game end resets back to lobby idle
  { from: 'my_turn', event: 'GAME_OVER', to: 'idle' },
  { from: 'remote_turn', event: 'GAME_OVER', to: 'idle' },

  // Rejoin/sync flows
  { from: 'my_turn', event: 'SYNC', to: 'syncing' },
  { from: 'remote_turn', event: 'SYNC', to: 'syncing' },
  { from: 'waiting_approval', event: 'SYNC', to: 'syncing' },
  { from: 'approving', event: 'SYNC', to: 'syncing' },
  { from: 'idle', event: 'SYNC', to: 'syncing' },
  { from: 'ready', event: 'SYNC', to: 'syncing' },
  { from: 'could_start', event: 'SYNC', to: 'syncing' },
  { from: 'syncing', event: 'SYNC_COMPLETE', to: 'my_turn' },
  { from: 'syncing', event: 'SYNC_COMPLETE', to: 'remote_turn' },
];

const nextState = (
  state: SessionState,
  event: SessionEvent,
  to?: SessionState,
): SessionState => {
  if (to) {
    if (
      !!transitions.find(
        (t) => t.from === state && t.event === event && t.to === to,
      )
    ) {
      return to;
    } else {
      return state;
    }
  } else {
    const hit = transitions.find((t) => t.from === state && t.event === event);
    return hit ? hit.to : state;
  }
};

const hasNextState = (
  state: SessionState,
  action: SessionEvent,
  to?: SessionState,
): boolean => {
  if (to) {
    return !!transitions.find(
      (t) => t.from === state && t.event === action && t.to === to,
    );
  }
  return !!transitions.find((t) => t.from === state && t.event === action);
};

export class SessionFsm {
  private state: SessionState;

  constructor(state: SessionState = 'idle') {
    this.state = state;
  }

  public getState(): SessionState {
    return this.state;
  }

  public hasNextState(event: SessionEvent, to?: SessionState): boolean {
    return hasNextState(this.state, event, to);
  }

  public dispatch(action: SessionEvent, to?: SessionState) {
    this.state = nextState(this.state, action, to);
  }
}
