import type { CommandListener } from "../commandBus";
import type { SessionEvent } from "../state/fsm";
import type { SessionMessage } from "../../utils";
import { getState, send } from "../context";

type PendingType = "undo" | "restart";

type RequestConfig = {
  selfEvent: SessionEvent;
  peerEvent: SessionEvent;
  pending: PendingType;
  messageType: "UNDO" | "RESTART";
};

const createRequestHandler = (config: RequestConfig): CommandListener => (command) => {
  const state = getState();
  if (command.origin === "local") {
    if (!state.canAction("self", config.selfEvent) || !state.canAction("peer", config.peerEvent)) {
      return;
    }
    state.setPendingAction(config.pending);
    state.dispatch("self", config.selfEvent);
    state.dispatch("peer", config.peerEvent);
    const message: SessionMessage = { type: config.messageType, from: "", payload: command.payload };
    send(message);
    return;
  }
  if (!state.canAction("peer", config.selfEvent) || !state.canAction("self", config.peerEvent)) {
    return;
  }
  state.setPendingAction(config.pending);
  state.dispatch("peer", config.selfEvent);
  state.dispatch("self", config.peerEvent);
};

const createResponseHandler = (event: SessionEvent, type: "APPROVE" | "REJECT"): CommandListener => (command) => {
  const state = getState();
  if (!state.canAction("self", event)) {
    return;
  }
  state.dispatch("self", event);
  state.setPendingAction(null);
  if (command.origin === "local") {
    const message: SessionMessage = { type, from: "", payload: command.payload };
    send(message);
  }
};

export const undo = createRequestHandler({
  selfEvent: "UNDO",
  peerEvent: "PEER_UNDO",
  pending: "undo",
  messageType: "UNDO",
});

export const restart = createRequestHandler({
  selfEvent: "RESTART",
  peerEvent: "PEER_RESTART",
  pending: "restart",
  messageType: "RESTART",
});

export const approve = createResponseHandler("APPROVE", "APPROVE");
export const reject = createResponseHandler("REJECT", "REJECT");
