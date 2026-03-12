// Session Controller (core): composition root that wires flow + command registry + state.
// Responsibilities:
// - Build core session components and connect their boundaries.
// - Expose a minimal API to the shell layer.
import { createNetClient, createEnvelope, type NetAdapter } from "./net";
import type { GameMove, IGamePlugin } from "../game/types";
import type { ShellUi } from "../ui/types";
import { createSessionState } from "./state/state";
import { createRegisterPolicy } from "./policy";
import { createSessionFlow } from "./flow";
import { consoleLogger, type Logger } from "../utils";
import { createCommandBus } from "./commandRegistry";
import { createDefaultMiddlewares, createFsmGuardMiddleware } from "./commandMiddleware";
import { createNotifier } from "./ports/notifier";
import { createPendingState } from "./state/pending";
import type { PendingActionType } from "./state/pending";
import { createMoveHandlers } from "../game/handlers/move";
import { createLobbyHandlers } from "./handlers/lobby";
import { createUndoHandler } from "../game/handlers/undo";
import { createConnectionControl } from "./hooks/connection";
import { createVoiceControl } from "./hooks/voice";
import { createRejoinControl } from "./rejoin/control";
import { createSessionFsm } from "./state/fsm";
import type { SessionDeps } from "./sessionTypes";

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

  const fsm = createSessionFsm({ logger });

  const state = createSessionState(
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

  const registerPolicy = createRegisterPolicy(options.retry);

  const notifier = createNotifier({
    logger,
    showNotice: ui.showNotice,
    log: ui.log,
  });
  const handlerDeps: SessionDeps = {
    state,
    ui,
    fsm,
    net,
    sid,
    nextSeq: () => seq++,
    notifier,
    pending,
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
  const moveHandlers = createMoveHandlers(handlerDeps);
  const lobbyHandlers = createLobbyHandlers(handlerDeps, {
    startMatch: state.startMatch,
    setLastStartSenderColor: (color) => {
      lastStartSenderColor = color;
    },
    getLastStartSenderColor: () => lastStartSenderColor,
    canStart: () => !!state.peer.getId() && state.ready.get().peer,
    resetToLobby: state.resetToLobby,
  });
  const handleUndo = createUndoHandler(handlerDeps);
  const rejoinControl = createRejoinControl(handlerDeps, {
    resetToLobby: state.resetToLobby,
  });
  const onConnectionState = createConnectionControl(handlerDeps, {
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
        const from = state.peer.getId();
        if (!from) {
          return;
        }
        net.send(
          createEnvelope({
            domain: "session",
            type: "SYNC_STATE",
            sid,
            from,
            seq: seq++,
            payload: { state: state.game.getSnapshot() },
          }),
        );
      },
      SYNC_STATE: (payload) => state.applySnapshot(payload as { state: unknown }),
    },
    afterHandle: state.render,
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
    net.onMessage((msg) => bus.handleMessage(msg));
    net.onConnectionState((connState) => onConnectionState(connState));
    flow.start(startOptions);
    state.render();
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
