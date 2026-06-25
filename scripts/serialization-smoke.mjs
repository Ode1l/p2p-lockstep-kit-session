import assert from "node:assert/strict";
import { createSession } from "../dist/session/index.js";

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
    handler("passive");
  }

  onRemoteStream() {}

  send(data) {
    this.sent.push(data);
  }

  connect() {
    this.stateHandler?.("connected");
  }

  inbound(data) {
    this.messageHandler?.(data);
  }
}

const createConnectedSession = () => {
  const client = new BoundaryClient();
  const session = createSession(client, "demo-room");

  session.net.setPeerIds({ local: "local", remote: "remote" });
  client.connect();

  return { client, session };
};

const startGame = async () => {
  const runtime = createConnectedSession();
  runtime.client.inbound({ type: "READY", sid: "demo-room", from: "remote" });
  await waitForBus();
  runtime.session.actions.start();
  await waitForBus();

  assert.match(
    runtime.session.state.getState("local"),
    /^(turn|remote_turn)$/,
  );
  assert.match(
    runtime.session.state.getState("remote"),
    /^(turn|remote_turn)$/,
  );

  return runtime;
};

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  session.actions.ready();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(typeof sent, "object");
  assert.equal(sent.type, "READY");
  assert.equal(sent.sid, "demo-room");
  assert.equal(session.state.getState("local"), "ready");
  assert.equal(session.state.getState("remote"), "could_start");
}

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  client.inbound({ type: "READY", sid: "demo-room", from: "remote" });
  await waitForBus();

  assert.equal(session.state.getState("local"), "could_start");
  assert.equal(session.state.getState("remote"), "ready");
}

{
  const { client, session } = createConnectedSession();
  await waitForBus();

  client.inbound(
    JSON.stringify({ type: "READY", sid: "demo-room", from: "remote" }),
  );
  await waitForBus();

  assert.equal(session.state.getState("local"), "could_start");
  assert.equal(session.state.getState("remote"), "ready");
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

  assert.equal(session.state.getPendingAction(), "restart");
  assert.equal(session.state.getState("local"), "waiting_approval");
  assert.equal(session.state.getState("remote"), "approving");

  client.inbound({
    type: "APPROVE",
    payload: { action: "restart" },
    from: "remote",
  });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "idle");
  assert.equal(session.state.getState("remote"), "idle");
  assert.equal(
    snapshots.some(
      (snapshot) =>
        snapshot.localState === "idle" &&
        snapshot.remoteState === "idle" &&
        snapshot.pendingAction === "restart",
    ),
    false,
  );
}

{
  const { client, session } = await startGame();
  const beforeRestart = {
    local: session.state.getState("local"),
    remote: session.state.getState("remote"),
  };

  session.actions.restart();
  await waitForBus();

  client.inbound({
    type: "REJECT",
    payload: { action: "restart" },
    from: "remote",
  });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), beforeRestart.local);
  assert.equal(session.state.getState("remote"), beforeRestart.remote);
}

{
  const { client, session } = await startGame();
  session.actions.restart();
  await waitForBus();

  assert.equal(session.state.getPendingAction(), "restart");

  session.bus.dispatch({ type: "OFFLINE", from: "local" });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "syncing");
  assert.equal(session.state.getState("remote"), "offline");

  session.bus.dispatch({ type: "ONLINE", from: "local" });
  await waitForBus();
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "syncing");
  assert.equal(session.state.getState("remote"), "syncing");
  assert.equal(client.sent.at(-1).type, "SYNC_REQUEST");

  client.inbound({
    type: "SYNC_STATE",
    payload: {
      history: [{ turn: 1, player: "local", move: { step: "peer-move" } }],
      lastStart: "local",
      turn: "local",
      resumeTurn: "local",
    },
    from: "remote",
  });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "remote_turn");
  assert.equal(session.state.getState("remote"), "turn");
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getHistory()[0].player, "remote");
  assert.equal(session.state.getLastStart(), "remote");
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

  client.inbound({ type: "RESTART", from: "remote" });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), "restart");
  assert.equal(session.state.getState("local"), "approving");
  assert.equal(session.state.getState("remote"), "waiting_approval");

  session.actions.approve();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, "APPROVE");
  assert.equal(sent.payload.action, "restart");
  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "idle");
  assert.equal(session.state.getState("remote"), "idle");
  assert.equal(
    snapshots.some(
      (snapshot) =>
        snapshot.localState === "idle" &&
        snapshot.remoteState === "idle" &&
        snapshot.pendingAction === "restart",
    ),
    false,
  );
}

{
  const { client, session } = await startGame();
  const beforeRestart = {
    local: session.state.getState("local"),
    remote: session.state.getState("remote"),
  };

  client.inbound({ type: "RESTART", from: "remote" });
  await waitForBus();

  session.actions.reject();
  await waitForBus();

  const sent = client.sent.at(-1);
  assert.equal(sent.type, "REJECT");
  assert.equal(sent.payload.action, "restart");
  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), beforeRestart.local);
  assert.equal(session.state.getState("remote"), beforeRestart.remote);
}

{
  const { client, session } = await startGame();
  client.inbound({ type: "RESTART", from: "remote" });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), "restart");

  session.bus.dispatch({ type: "OFFLINE", from: "local" });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "syncing");
  assert.equal(session.state.getState("remote"), "offline");

  session.bus.dispatch({ type: "ONLINE", from: "local" });
  await waitForBus();
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "syncing");
  assert.equal(session.state.getState("remote"), "syncing");
  assert.equal(client.sent.at(-1).type, "SYNC_REQUEST");

  client.inbound({
    type: "SYNC_STATE",
    payload: {
      history: [{ turn: 1, player: "remote", move: { step: "local-move" } }],
      lastStart: "remote",
      turn: "remote",
      resumeTurn: "remote",
    },
    from: "remote",
  });
  await waitForBus();

  assert.equal(session.state.getPendingAction(), null);
  assert.equal(session.state.getState("local"), "turn");
  assert.equal(session.state.getState("remote"), "remote_turn");
  assert.equal(session.state.getHistory().length, 1);
  assert.equal(session.state.getHistory()[0].player, "local");
  assert.equal(session.state.getLastStart(), "local");
}

console.log("serialization smoke passed");
