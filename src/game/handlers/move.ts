import type { MovePayload, RejectPayload, WireEnvelope as Envelope } from "../../utils";
import type { GameMove, GameStatus } from "../types";
import { createMovePolicy } from "../rules";
import type { SessionState } from "../../session/state/state";
import type { Notifier } from "../../session/ports/notifier";
import type { SessionFsm } from "../../session/state/fsm";

export const createMoveHandlers = (deps: {
  state: SessionState;
  sid: string;
  nextSeq: () => number;
  notifier: Notifier;
  fsm: SessionFsm;
  sendEnvelope: <T>(msg: Envelope<T>) => void;
}) => {
  const { state, sid, nextSeq, notifier, fsm, sendEnvelope } = deps;
  const movePolicy = createMovePolicy({
    getStatus: state.getStatus,
    isStarted: state.startedState.is,
    hasPeer: () => !!state.peer.getId(),
    getMyColor: state.player.getMyColor,
    canApplyByRule: state.ruleGuard.canApplyMove,
    onLocalRejected: notifier.onMoveRejected,
  });

  const sendSession = (
    type: "SYNC_REQUEST" | "REJECT",
    payload?: unknown,
    meta?: { turn?: number; stateHash?: string },
  ) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    sendEnvelope({
      domain: "session",
      type,
      sid,
      from,
      seq: nextSeq(),
      payload,
      turn: meta?.turn,
      stateHash: meta?.stateHash,
    });
  };

  const sendGameMove = (move: GameMove) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    sendEnvelope({
      domain: "game",
      type: "MOVE",
      from,
      seq: nextSeq(),
      turn: move.turn,
      stateHash: state.game.getHash(),
      payload: { x: move.x, y: move.y, player: move.player },
    });
  };

  const sendReject = (reason: string) => {
    const status = state.getStatus();
    sendSession(
      "REJECT",
      { action: "move", reason },
      { turn: status.turn, stateHash: state.game.getHash() },
    );
  };

  const sendSyncRequest = () => sendSession("SYNC_REQUEST");

  const handleMoveReject = (
    payload: RejectPayload,
    meta: { turn?: number; stateHash?: string },
  ) => {
      notifier.onMoveRejected(payload.reason);
      const status = state.getStatus();
      if (meta.turn === undefined) {
        notifier.onRejectSync("[shell] reject missing turn, requesting sync");
        sendSyncRequest();
        return;
      }
      const turnDiff = status.turn - meta.turn;
      if (turnDiff === 1) {
        const ok = state.rollbackLastMove();
        if (!ok) {
          sendSyncRequest();
          return;
        }
        if (meta.stateHash && state.game.getHash() !== meta.stateHash) {
          notifier.onRejectSync("[shell] reject hash mismatch, requesting sync");
          sendSyncRequest();
        }
      } else {
        notifier.onRejectSync("[shell] reject mismatch, requesting sync");
        sendSyncRequest();
      }
    };

  const handleMove = (
    payload: MovePayload,
    meta: { turn?: number; stateHash?: string },
    origin: "local" | "remote",
  ) => {
    const move: GameMove = {
      x: payload.x,
      y: payload.y,
      player: payload.player,
      turn: meta.turn ?? state.getStatus().turn,
    };
    const guard =
      origin === "local"
        ? movePolicy.validateLocalMove(move)
        : movePolicy.validateRemoteMove(move);
    if (!guard.ok) {
      if (origin === "remote") {
        sendReject(guard.reason ?? "invalid");
      }
      return;
    }
    const prevStatus: GameStatus = state.getStatus();
    state.applyMove(move);
    if (origin === "remote" && meta.stateHash && meta.stateHash !== state.game.getHash()) {
      state.rollbackLastMove();
      sendReject("hash-mismatch");
      return;
    }
    state.finalizeMove(prevStatus);
    if (origin === "local") {
      fsm.onLocalMove();
    } else {
      fsm.onRemoteMove();
    }
    if (origin === "local") {
      sendGameMove(move);
    }
  };

  return {
    validateLocalMove: movePolicy.validateLocalMove,
    validateRemoteMove: movePolicy.validateRemoteMove,
    handleMove,
    handleMoveReject,
  };
};
