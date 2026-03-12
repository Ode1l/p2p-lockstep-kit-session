import type { Logger, MessageType } from "../../utils";
import type { CommandOrigin } from "../commandRegistry";
import type { GameStatus } from "../../game/types";

export type SessionPhase =
  | "OFFLINE"
  | "LOBBY"
  | "READY"
  | "MY_TURN"
  | "PEER_TURN"
  | "WAITING_APPROVAL";

export type SessionFsm = {
  getPhase: () => SessionPhase;
  onConnected: () => void;
  onDisconnected: () => void;
  onReadyStateChange: (ready: { self: boolean; peer: boolean }) => void;
  onMatchStart: () => void;
  onMatchEnd: () => void;
  onLocalMove: () => void;
  onRemoteMove: () => void;
  onAwaitApproval: () => void;
  onApprovalResolved: () => void;
  refreshTurn: () => void;
  guard: (type: MessageType, origin: CommandOrigin) => { ok: boolean; reason?: string };
};

const matchPhases: SessionPhase[] = ["MY_TURN", "PEER_TURN", "WAITING_APPROVAL"];

export const createSessionFsm = (deps: {
  logger: Logger;
  getStatus: () => GameStatus;
  getMyColor: () => 1 | 2 | null;
}): SessionFsm => {
  const { logger, getStatus, getMyColor } = deps;
  let phase: SessionPhase = "OFFLINE";
  let connected = false;

  const setPhase = (next: SessionPhase, reason?: string) => {
    if (phase === next) {
      return;
    }
    phase = next;
    logger.info("[session:fsm] transition", { next, reason });
  };

  const inMatch = () => matchPhases.includes(phase);

  const computeTurnPhase = (reason?: string) => {
    const myColor = getMyColor();
    if (!myColor) {
      setPhase(connected ? "LOBBY" : "OFFLINE", reason ?? "no-color");
      return;
    }
    const status = getStatus();
    setPhase(status.currentPlayer === myColor ? "MY_TURN" : "PEER_TURN", reason ?? "turn");
  };

  const onConnected = () => {
    connected = true;
    if (inMatch()) {
      return;
    }
    setPhase("LOBBY", "connected");
  };

  const onDisconnected = () => {
    connected = false;
    setPhase("OFFLINE", "disconnected");
  };

  const onReadyStateChange = (ready: { self: boolean; peer: boolean }) => {
    if (!connected) {
      return;
    }
    if (inMatch()) {
      return;
    }
    setPhase(ready.self && ready.peer ? "READY" : "LOBBY", "ready-change");
  };

  const onMatchStart = () => {
    connected = true;
    computeTurnPhase("match-start");
  };

  const onMatchEnd = () => {
    if (connected) {
      setPhase("LOBBY", "match-end");
    } else {
      setPhase("OFFLINE", "match-end");
    }
  };

  const onLocalMove = () => {
    setPhase("PEER_TURN", "local-move");
  };

  const onRemoteMove = () => {
    setPhase("MY_TURN", "remote-move");
  };

  const onAwaitApproval = () => {
    setPhase("WAITING_APPROVAL", "await-approval");
  };

  const onApprovalResolved = () => {
    computeTurnPhase("approval-resolved");
  };

  const refreshTurn = () => {
    if (inMatch()) {
      computeTurnPhase("refresh-turn");
    }
  };

  const guard = (type: MessageType, origin: CommandOrigin) => {
    if (phase === "WAITING_APPROVAL" && origin === "local") {
      return { ok: false, reason: "Awaiting approval." };
    }

    const allowLobbyAction = phase === "LOBBY" || phase === "READY";

    const check = (allowed: boolean, reason: string) => (allowed ? { ok: true } : { ok: false, reason });

    if (origin === "local") {
      switch (type) {
        case "READY":
          return check(allowLobbyAction, "Not in lobby.");
        case "START":
          return check(phase === "READY", "Both players must be ready.");
        case "MOVE":
          return check(phase === "MY_TURN", "Wait for your turn.");
        case "UNDO":
          return check(phase === "MY_TURN", "Undo only on your turn.");
        case "RESTART":
          return check(allowLobbyAction, "Restart only in lobby.");
        case "SYNC_REQUEST":
        case "SYNC_STATE":
          return { ok: true };
        default:
          return { ok: true };
      }
    }

    // Remote commands
    switch (type) {
      case "READY":
      case "START":
      case "RESTART":
        return check(allowLobbyAction, "Remote action ignored during match.");
      case "MOVE":
        return check(phase === "PEER_TURN", "Out-of-turn move ignored.");
      case "UNDO":
        return check(phase === "PEER_TURN", "Undo only allowed on opponent turn.");
      default:
        return { ok: true };
    }
  };

  return {
    getPhase: () => phase,
    onConnected,
    onDisconnected,
    onReadyStateChange,
    onMatchStart,
    onMatchEnd,
    onLocalMove,
    onRemoteMove,
    onAwaitApproval,
    onApprovalResolved,
    refreshTurn,
    guard,
  };
};
