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

console.log("serialization smoke passed");
