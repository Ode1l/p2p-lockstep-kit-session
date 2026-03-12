// Session Controller (core): composition root that wires flow + command registry + state.
// Responsibilities:
// - Build core session components and connect their boundaries.
// - Expose a minimal API to the shell layer.
import { createNetClient, type NetAdapter } from "./net";
import type { GameMove, IGamePlugin } from "../game/types";
import type { ShellUi } from "../ui/types";
import { createSessionState, type SessionState } from "./state/state";
import { createRegisterPolicy } from "./policy";
import { createSessionFlow } from "./flow";
import { consoleLogger, type Logger } from "../utils";
import { createCommandBus } from "./commandRegistry";
import { createDefaultMiddlewares, createFsmGuardMiddleware } from "./commandMiddleware";
import { createNotifier } from "./ports/notifier";
import { createPendingState } from "./state/pending";
import { createMoveHandlers } from "../game/handlers/move";
import { createLobbyHandlers } from "./handlers/lobby";
import { createUndoHandler } from "../game/handlers/undo";
import { createConnectionControl } from "./hooks/connection";
import { createVoiceControl } from "./hooks/voice";
import { createRejoinControl } from "./rejoin/control";
import { createSessionFsm } from "./state/fsm";
import {
  resolveMessageDomain,
  type MessageType,
  type Envelope,
} from "../utils";
type PendingActionType = "undo" | "restart" | "rejoin";

export type SessionOptions = {
  mount: HTMLElement;
  plugin: IGamePlugin;
  ui: ShellUi;
  sid?: string;
  resumeTTLms?: number;
  net?: NetAdapter;
  logger?: Logger;
  retry?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    multiplier?: number;
    jitter?: number;
    shouldRetry?: (error: unknown) => boolean;
  };
};

export const createSessionController = (options: SessionOptions) => {
  const { mount, plugin, ui } = options;
  const sid = options.sid ?? plugin.id;
  const net = options.net ?? createNetClient();
  const logger = options.logger ?? consoleLogger;
  const pending = createPendingState();
  let seq = 1;
  let lastStartSenderColor: 1 | 2 | null = null;
  let handleLocalMove: ((move: GameMove) => void) | null = null;
  const sendEnvelope = <T>(msg: Envelope<T>) => {
    net.send(msg);
  };

  let state: SessionState | null = null;

  const fsm = createSessionFsm({
    logger,
    getStatus: () => state?.getStatus() ?? { turn: 0, currentPlayer: 1, winner: 0 },
    getMyColor: () => state?.player.getMyColor() ?? null,
  });

  state = createSessionState(
    {
      sid,
      plugin,
      ui,
      mount,
      logger,
      onLocalMove: (move) => {
        handleLocalMove?.(move);
      },
    },
    {
      onReadyChange: (ready) => fsm.onReadyStateChange(ready),
      onMatchStart: () => fsm.onMatchStart(),
      onMatchEnd: () => fsm.onMatchEnd(),
    },
  );

  if (!state) {
    throw new Error("Session state initialization failed");
  }
  const sessionState = state;

  const registerPolicy = createRegisterPolicy(options.retry);

  const notifier = createNotifier({
    logger,
    showNotice: ui.showNotice,
    log: ui.log,
  });
  const sharedDeps = {
    state: sessionState,
    ui,
    fsm,
    sid,
    nextSeq: () => seq++,
    notifier,
    pending,
    sendEnvelope,
  };
  const pendingLabel: Record<PendingActionType, string> = {
    undo: "confirm undo",
    restart: "confirm restart",
    rejoin: "accept rejoin",
  };
  pending.onChange(({ phase, action, reason }) => {
    if (!ui.showNotice || !action) {
      return;
    }
    if (phase === "waiting") {
      ui.showNotice?.(`Waiting for opponent to ${pendingLabel[action]}`);
      return;
    }
    if (phase === "resolved") {
      ui.showNotice?.(`Opponent approved ${action}`);
      return;
    }
    if (phase === "rejected") {
      const label = reason ? `${action} rejected: ${reason}` : `${action} rejected`;
      ui.showNotice?.(label);
    }
  });
  const moveHandlers = createMoveHandlers(sharedDeps);
  const lobbyHandlers = createLobbyHandlers(sharedDeps, {
    startMatch: sessionState.startMatch,
    setLastStartSenderColor: (color) => {
      lastStartSenderColor = color;
    },
    getLastStartSenderColor: () => lastStartSenderColor,
    canStart: () => !!sessionState.peer.getId() && sessionState.ready.get().peer,
    resetToLobby: sessionState.resetToLobby,
  });
  const handleUndo = createUndoHandler(sharedDeps);
  const rejoinControl = createRejoinControl(sharedDeps, {
    resetToLobby: sessionState.resetToLobby,
  });
  const onConnectionState = createConnectionControl(sharedDeps, {
    maybeAutoRejoin: rejoinControl.maybeAutoRejoin,
  });
  const middlewares = [
    createFsmGuardMiddleware({
      fsm,
      logger,
      onLocalBlock: notifier.onRejectNotice,
    }),
    ...createDefaultMiddlewares(logger),
  ];

  const voiceControl = createVoiceControl({ net, ui, logger });

  const bus = createCommandBus({
    sid,
    handlers: {
      READY: (payload, _meta, origin) => lobbyHandlers.handleReady(payload as { ready: boolean }, origin),
      START: (payload, _meta, origin) =>
        lobbyHandlers.handleStart(
          payload as { senderColor: 1 | 2; receiverColor: 1 | 2; firstPlayer: 1 | 2 },
          origin,
        ),
      UNDO: (payload, _meta, origin) => handleUndo(payload as { count?: 1 | 2 }, origin),
      RESTART: (_payload, _meta, origin) => lobbyHandlers.handleRestart(origin),
      APPROVE: () => lobbyHandlers.handleApprove(),
      REJECT: (payload, meta) =>
        (payload as { action: "undo" | "rejoin" | "restart" | "move"; reason?: string })
          .action === "move"
          ? moveHandlers.handleMoveReject(
              payload as { action: "move"; reason?: string },
              meta,
            )
          : lobbyHandlers.handleReject(
              payload as { action: "undo" | "rejoin" | "restart"; reason?: string },
            ),
      REJOIN: (payload, meta) =>
        rejoinControl.handleRejoinMessage(payload as { state: unknown }, meta),
      MOVE: (payload, meta, origin) =>
        moveHandlers.handleMove(
          payload as { x: number; y: number; player: 1 | 2 },
          meta,
          origin,
        ),
      SYNC_REQUEST: () => {
        const from = sessionState.peer.getId();
        if (!from) {
          return;
        }
        sendEnvelope({
          domain: "session",
          type: "SYNC_STATE",
          sid,
          from,
          seq: seq++,
          payload: { state: sessionState.game.getSnapshot() },
        });
      },
      SYNC_STATE: (payload) => {
        sessionState.applySnapshot(payload as { state: unknown });
        fsm.refreshTurn();
      },
    },
    afterHandle: sessionState.render,
    middlewares,
  });
  handleLocalMove = (move) => {
    void bus.emit("MOVE", { x: move.x, y: move.y, player: move.player });
  };

  const flow = createSessionFlow({
    net,
    state,
    ui,
    logger,
    registerPolicy,
    shouldRetry: options.retry?.shouldRetry,
  });

  const start = (startOptions?: { autoRegisterUrl?: string; autoConnectId?: string }) => {
    const parseMessage = (raw: unknown) => {
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        const type = (data as { type: MessageType }).type as MessageType;
        return {
          ...(data as Envelope),
          type,
          domain: resolveMessageDomain({ type, domain: (data as Envelope).domain }),
        } as Envelope;
      } catch {
        return null;
      }
    };

    net.onMessage((raw) => {
      const msg = parseMessage(raw);
      if (msg) {
        bus.handleMessage(msg);
      }
    });
    net.onConnectionState((connState) => onConnectionState(connState));
    flow.start(startOptions);
    sessionState.render();
  };

  return {
    start,
    onRegister: flow.register,
    onConnect: flow.connect,
    onReady: (ready?: boolean) => bus.emit("READY", { ready: ready ?? true }),
    onUndo: () => bus.emit("UNDO"),
    onRestart: () => bus.emit("RESTART"),
    onStart: () => bus.emit("START"),
    onToggleVoice: () => voiceControl.toggle(),
  };
};
