import type { SyncStatePayload } from "../utils";
import type { GameMove, GameStatus, IGameSession } from "../game/types";
import type { ShellUi } from "../ui/types";
import type { PendingActionType, PendingResult } from "./state/pending";
import type { SessionFsm } from "./state/fsm";
import type { NetAdapter } from "./net";

export type SessionState = {
  game: IGameSession;
  ruleGuard: {
    canApplyMove: (move: GameMove, status: GameStatus) => { ok: boolean; reason?: string };
  };
  getStatus: () => GameStatus;
  peer: {
    getId: () => string;
    setId: (next: string) => void;
  };
  connectionState: {
    set: (connected: boolean) => void;
  };
  player: {
    getMyColor: () => 1 | 2 | null;
    setMyColor: (color: 1 | 2 | null) => void;
  };
  ready: {
    get: () => { self: boolean; peer: boolean };
    setSelf: (ready: boolean) => void;
    setPeer: (ready: boolean) => void;
    clear: () => void;
  };
  startedState: {
    set: (started: boolean) => void;
    is: () => boolean;
  };
  hasCache: () => boolean;
  history: {
    has: () => boolean;
    length: () => number;
  };
  resetToLobby: () => void;
  startMatch: (myColor: 1 | 2) => void;
  applyMove: (move: GameMove) => void;
  finalizeMove: (prevStatus: GameStatus) => void;
  rollbackLastMove: () => boolean;
  applyUndoCount: (count: 1 | 2) => boolean;
  resetMatch: () => void;
  render: () => void;
  applySnapshot: (payload: SyncStatePayload) => void;
  canRestore: (payload: { cacheHash: string; turn: number }, ttlMs: number) => boolean;
  clearCache: () => void;
  getCacheMeta: () => { cacheHash: string; cacheTurn: number };
};

export type SessionDeps = {
  state: SessionState;
  ui: ShellUi;
  fsm: SessionFsm;
  net: NetAdapter;
  sid: string;
  nextSeq: () => number;
  notifier: {
    onRejectNotice: (message: string) => void;
    onConnection: (message: string) => void;
    onMoveRejected: (reason?: string) => void;
    onRejectSync: (message: string) => void;
  };
  pending: {
    begin: (
      action: PendingActionType,
      options?: { undoCount?: 1 | 2 },
    ) => Promise<PendingResult>;
    resolve: (action: PendingActionType) => void;
    reject: (action: PendingActionType, reason?: string) => void;
    clear: (reason?: string) => void;
    getAction: () => PendingActionType | null;
    getUndoCount: () => 1 | 2 | null;
    getPhase: () => "idle" | "waiting" | "resolved" | "rejected";
    onChange: (
      handler: (event: {
        phase: "idle" | "waiting" | "resolved" | "rejected";
        action: PendingActionType | null;
        reason?: string;
      }) => void,
    ) => () => void;
  };
};
