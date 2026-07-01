import assert from 'node:assert/strict';
import { createSession } from '../dist/session/index.js';

const waitForBus = () => new Promise((resolve) => setTimeout(resolve, 0));

class BoundaryClient {
  messageHandler = null;
  stateHandler = null;
  sent = [];

  onMessage(handler) {
    this.messageHandler = handler;
  }

  onStateChange(handler) {
    this.stateHandler = handler;
    handler('passive');
  }

  onRemoteStream() {}

  send(data) {
    this.sent.push(data);
  }

  connect() {
    this.stateHandler?.('connected');
  }

  inbound(data) {
    this.messageHandler?.(data);
  }
}

const createConnectedSession = () => {
  const client = new BoundaryClient();
  const session = createSession(client, 'demo-session');

  session.net.setPeerIds({ local: 'local', remote: 'remote' });
  client.connect();

  return { client, session };
};

const startGame = async () => {
  const runtime = createConnectedSession();
  runtime.client.inbound({ type: 'READY', sid: 'demo-session', from: 'remote' });
  await waitForBus();
  runtime.session.actions.start();
  await waitForBus();

  assert.match(runtime.session.state.getState('local'), /^(turn|remote_turn)$/);
  assert.match(
    runtime.session.state.getState('remote'),
    /^(turn|remote_turn)$/,
  );

  return runtime;
};

const startGameWithFirstPlayer = async (firstPlayer) => {
  const runtime = createConnectedSession();
  runtime.client.inbound({ type: 'READY', sid: 'demo-session', from: 'remote' });
  await waitForBus();
  runtime.session.state.setLastStart(
    firstPlayer === 'local' ? 'remote' : 'local',
  );
  runtime.session.actions.start();
  await waitForBus();

  assert.equal(
    runtime.session.state.getState('local'),
    firstPlayer === 'local' ? 'turn' : 'remote_turn',
  );
  assert.equal(
    runtime.session.state.getState('remote'),
    firstPlayer === 'local' ? 'remote_turn' : 'turn',
  );

  return runtime;
};

const oneMoveWinPlugin = {
  validateMove() {
    return { valid: true };
  },
  checkWin(_gameState, history) {
    return history.at(-1)?.player ?? null;
  },
};

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  session.actions.ready();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(typeof sent, 'object');
  assert.equal(sent.type, 'READY');
  assert.equal(sent.sid, 'demo-session');
  assert.equal(session.state.getState('local'), 'ready');
  assert.equal(session.state.getState('remote'), 'could_start');
}

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  client.inbound({ type: 'READY', sid: 'demo-session', from: 'remote' });
  await waitForBus();

  assert.equal(session.state.getState('local'), 'could_start');
  assert.equal(session.state.getState('remote'), 'ready');
}

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  client.inbound(
    JSON.stringify({ type: 'READY', sid: 'demo-session', from: 'remote' }),
  );
  await waitForBus();

  assert.equal(session.state.getState('local'), 'could_start');
  assert.equal(session.state.getState('remote'), 'ready');
}

{
  const { client, session } = await startGame();
  const snapshots = [];
  session.observer.subscribe({
    onStateChange(snapshot) {
      snapshots.push(snapshot);
    },
    onGameEvent() {},
  });

  session.actions.restart();
  await waitForBus();

  assert.equal(session.state.getPendingAction(), 'restart');
  assert.equal(session.state.getState('local'), 'waiting_approval');
  assert.equal(session.state.getState('remote'), 'approving');

  client.inbound({
    type: 'APPROVE',
    payload: { action: 'restart' },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');
  assert.equal(
    snapshots.some(
      (snapshot) =>
        snapshot.localState === 'idle' &&
        snapshot.remoteState === 'idle' &&
        snapshot.pendingAction === 'restart',
    ),
    false,
  );
}

{
  const { client, session } = await startGame();
  const snapshots = [];
  session.observer.subscribe({
    onStateChange(snapshot) {
      snapshots.push(snapshot);
    },
    onGameEvent() {},
  });

  if (session.state.getState('local') !== 'turn') {
    client.inbound({
      type: 'MOVE',
      payload: { step: 'remote-first' },
      from: 'remote',
    });
    await waitForBus();
    snapshots.splice(0, snapshots.length);
  }

  const beforeHistory = session.state.getHistory().length;
  session.actions.move({ step: 'local-move' });
  await waitForBus();

  assert.equal(session.state.getHistory().length, beforeHistory + 1);
  assert.equal(
    snapshots.some((snapshot) => snapshot.history.length === beforeHistory + 1),
    true,
  );
}

{
  const { client, session } = await startGameWithFirstPlayer('local');
  session.state.setGamePlugin(oneMoveWinPlugin);

  session.actions.move({ step: 'winning-local-move' });
  await waitForBus();

  assert.equal(client.sent.at(-1).type, 'MOVE');
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getHistory()[0].move.step, 'winning-local-move');
}

{
  const { client, session } = await startGameWithFirstPlayer('remote');
  session.state.setGamePlugin(oneMoveWinPlugin);

  client.inbound({
    type: 'MOVE',
    payload: { step: 'winning-remote-move' },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getHistory()[0].move.step, 'winning-remote-move');
}

{
  const { client, session } = await startGameWithFirstPlayer('local');
  session.state.setGamePlugin(oneMoveWinPlugin);

  session.actions.move({ step: 'winning-local-move' });
  await waitForBus();
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');

  client.inbound({ type: 'READY', sid: 'demo-session', from: 'remote' });
  await waitForBus();
  session.actions.start();
  await waitForBus();

  assert.equal(session.state.getHistory().length, 0);
  assert.match(session.state.getState('local'), /^(turn|remote_turn)$/);
  assert.match(session.state.getState('remote'), /^(turn|remote_turn)$/);
}

{
  const { client, session } = await startGameWithFirstPlayer('remote');
  session.state.setGamePlugin(oneMoveWinPlugin);

  client.inbound({
    type: 'MOVE',
    payload: { step: 'winning-remote-move' },
    from: 'remote',
  });
  await waitForBus();
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');

  session.actions.ready();
  await waitForBus();
  client.inbound({
    type: 'START',
    payload: { starter: 'sender' },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getHistory().length, 0);
  assert.equal(session.state.getState('local'), 'remote_turn');
  assert.equal(session.state.getState('remote'), 'turn');
}

{
  const { client, session } = await startGameWithFirstPlayer('local');

  session.actions.move({ step: 'local-just-moved' });
  await waitForBus();
  assert.equal(session.state.getState('local'), 'remote_turn');
  assert.equal(session.state.getHistory().length, 1);

  session.actions.undo();
  await waitForBus();

  assert.equal(client.sent.at(-1).type, 'UNDO');
  assert.equal(client.sent.at(-1).payload.count, 1);
  assert.equal(session.state.getPendingUndoCount(), 1);

  client.inbound({
    type: 'APPROVE',
    payload: { action: 'undo' },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getHistory().length, 0);
  assert.equal(session.state.getState('local'), 'turn');
  assert.equal(session.state.getState('remote'), 'remote_turn');
}

{
  const { client, session } = await startGameWithFirstPlayer('local');

  session.actions.move({ step: 'local-first' });
  await waitForBus();
  client.inbound({
    type: 'MOVE',
    payload: { step: 'remote-reply' },
    from: 'remote',
  });
  await waitForBus();
  assert.equal(session.state.getState('local'), 'turn');
  assert.equal(session.state.getHistory().length, 2);

  session.actions.undo();
  await waitForBus();

  assert.equal(client.sent.at(-1).type, 'UNDO');
  assert.equal(client.sent.at(-1).payload.count, 2);
  assert.equal(session.state.getPendingUndoCount(), 2);

  client.inbound({
    type: 'APPROVE',
    payload: { action: 'undo' },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getHistory().length, 0);
  assert.equal(session.state.getState('local'), 'turn');
  assert.equal(session.state.getState('remote'), 'remote_turn');
}

{
  const { client, session } = await startGameWithFirstPlayer('local');

  session.actions.move({ step: 'local-just-moved' });
  await waitForBus();
  assert.equal(session.state.getState('local'), 'remote_turn');

  session.actions.undo();
  await waitForBus();
  client.inbound({
    type: 'REJECT',
    payload: { action: 'undo' },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getState('local'), 'remote_turn');
  assert.equal(session.state.getState('remote'), 'turn');
  assert.equal(
    client.sent.some((message) => message.type === 'UNDO'),
    true,
  );
}

{
  const { client } = createConnectedSession();
  await waitForBus();

  client.inbound({ type: 'UNDO', payload: { count: 3 }, from: 'remote' });
  await waitForBus();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, 'REJECT');
  assert.equal(sent.payload.action, 'undo');
  assert.equal(sent.payload.reason, 'invalid_state');
}

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  session.actions.ready();
  await waitForBus();
  client.inbound({ type: 'RESTART', from: 'remote' });
  await waitForBus();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, 'REJECT');
  assert.equal(sent.payload.action, 'restart');
  assert.equal(sent.payload.reason, 'invalid_state');
}

{
  const { client, session } = await startGame();
  const beforeRestart = {
    local: session.state.getState('local'),
    remote: session.state.getState('remote'),
  };

  session.actions.restart();
  await waitForBus();

  client.inbound({
    type: 'REJECT',
    payload: { action: 'restart' },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState('local'), beforeRestart.local);
  assert.equal(session.state.getState('remote'), beforeRestart.remote);
}

{
  const { client, session } = await startGame();
  session.actions.restart();
  await waitForBus();

  assert.equal(session.state.getPendingAction(), 'restart');

  session.bus.dispatch({ type: 'OFFLINE', from: 'local' });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState('local'), 'syncing');
  assert.equal(session.state.getState('remote'), 'offline');

  session.bus.dispatch({ type: 'ONLINE', from: 'local' });
  await waitForBus();
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(client.sent.at(-1).type, 'SYNC_STATE');
  assert.match(session.state.getState('local'), /^(turn|remote_turn)$/);
  assert.match(session.state.getState('remote'), /^(turn|remote_turn)$/);
}

{
  const { client, session } = await startGame();
  const snapshots = [];
  session.observer.subscribe({
    onStateChange(snapshot) {
      snapshots.push(snapshot);
    },
    onGameEvent() {},
  });

  client.inbound({ type: 'RESTART', from: 'remote' });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), 'restart');
  assert.equal(session.state.getState('local'), 'approving');
  assert.equal(session.state.getState('remote'), 'waiting_approval');

  session.actions.approve();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, 'APPROVE');
  assert.equal(sent.payload.action, 'restart');
  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');
  assert.equal(
    snapshots.some(
      (snapshot) =>
        snapshot.localState === 'idle' &&
        snapshot.remoteState === 'idle' &&
        snapshot.pendingAction === 'restart',
    ),
    false,
  );
}

{
  const { client, session } = await startGame();
  const beforeRestart = {
    local: session.state.getState('local'),
    remote: session.state.getState('remote'),
  };

  client.inbound({ type: 'RESTART', from: 'remote' });
  await waitForBus();

  session.actions.reject();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, 'REJECT');
  assert.equal(sent.payload.action, 'restart');
  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState('local'), beforeRestart.local);
  assert.equal(session.state.getState('remote'), beforeRestart.remote);
}

{
  const { client, session } = await startGame();
  client.inbound({ type: 'RESTART', from: 'remote' });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), 'restart');

  session.bus.dispatch({ type: 'OFFLINE', from: 'local' });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState('local'), 'syncing');
  assert.equal(session.state.getState('remote'), 'offline');

  session.bus.dispatch({ type: 'ONLINE', from: 'local' });
  await waitForBus();
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(client.sent.at(-1).type, 'SYNC_STATE');
  assert.match(session.state.getState('local'), /^(turn|remote_turn)$/);
  assert.match(session.state.getState('remote'), /^(turn|remote_turn)$/);
}

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  client.inbound({
    type: 'SYNC_STATE',
    payload: {
      history: [{ turn: 1, player: 'local', move: { step: 'peer-move' } }],
      lastStart: 'local',
      turn: 'remote',
      resumeTurn: 'remote',
    },
    from: 'remote',
  });
  await waitForBus();

  assert.equal(session.state.getState('local'), 'turn');
  assert.equal(session.state.getState('remote'), 'remote_turn');
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getHistory()[0].player, 'remote');
  assert.equal(session.state.getLastStart(), 'remote');
}

{
  const { client, session } = await startGameWithFirstPlayer('local');
  session.actions.move({ step: 'local-before-disconnect' });
  await waitForBus();

  assert.equal(session.state.getState('local'), 'remote_turn');
  assert.equal(session.state.getState('remote'), 'turn');
  assert.equal(session.state.getHistory().length, 1);

  session.bus.dispatch({ type: 'OFFLINE', from: 'local' });
  await waitForBus();

  assert.equal(session.state.getState('local'), 'remote_turn');
  assert.equal(session.state.getState('remote'), 'offline');

  client.inbound({ type: 'SYNC_REQUEST', from: 'remote' });
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, 'SYNC_STATE');
  assert.equal(sent.payload.resumeTurn, 'remote');
  assert.equal(session.state.getState('local'), 'remote_turn');
  assert.equal(session.state.getState('remote'), 'turn');
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getHistory()[0].player, 'local');
}

{
  const { client, session } = await startGameWithFirstPlayer('local');
  session.actions.move({ step: 'keep-this-move' });
  await waitForBus();

  session.actions.offerDraw();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, 'REQUEST');
  assert.equal(sent.payload.action, 'draw');
  assert.equal(session.state.getPendingAction(), 'draw');
  assert.equal(session.state.getState('local'), 'waiting_approval');
  assert.equal(session.state.getState('remote'), 'approving');

  client.inbound({
    type: 'APPROVE',
    payload: { action: 'draw' },
    from: 'remote',
  });
  await waitForBus();

  assert.deepEqual(session.state.getOutcome(), {
    kind: 'draw',
    reason: 'agreement',
  });
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');
  assert.equal(session.observer.getSnapshot().outcome.kind, 'draw');
}

{
  const { client, session } = await startGame();
  const before = {
    local: session.state.getState('local'),
    remote: session.state.getState('remote'),
  };

  client.inbound({
    type: 'REQUEST',
    payload: { action: 'draw' },
    from: 'remote',
  });
  await waitForBus();
  assert.equal(session.state.getPendingAction(), 'draw');
  assert.equal(session.state.getState('local'), 'approving');

  session.actions.reject();
  await waitForBus();
  assert.equal(client.sent.at(-1).payload.action, 'draw');
  assert.equal(session.state.getOutcome(), null);
  assert.equal(session.state.getState('local'), before.local);
  assert.equal(session.state.getState('remote'), before.remote);
}

{
  const { client, session } = await startGame();
  session.actions.resign();
  await waitForBus();

  assert.equal(client.sent.at(-1).type, 'RESIGN');
  assert.deepEqual(session.state.getOutcome(), {
    kind: 'win',
    winner: 'remote',
    reason: 'resignation',
  });
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');
}

{
  const { client, session } = await startGame();
  client.inbound({ type: 'RESIGN', from: 'remote' });
  await waitForBus();

  assert.deepEqual(session.state.getOutcome(), {
    kind: 'win',
    winner: 'local',
    reason: 'resignation',
  });
}

{
  const { client, session } = createConnectedSession();
  await waitForBus();
  client.inbound({
    type: 'SYNC_STATE',
    payload: {
      history: [],
      lastStart: 'local',
      turn: 'local',
      outcome: {
        kind: 'win',
        winner: 'local',
        reason: 'resignation',
      },
    },
    from: 'remote',
  });
  await waitForBus();

  assert.deepEqual(session.state.getOutcome(), {
    kind: 'win',
    winner: 'remote',
    reason: 'resignation',
  });
  assert.equal(session.state.getState('local'), 'idle');
  assert.equal(session.state.getState('remote'), 'idle');
}

console.log('serialization smoke passed');
