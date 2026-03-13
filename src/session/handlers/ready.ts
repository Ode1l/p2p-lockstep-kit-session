import type { CommandMessage } from "../commandBus";
import { getState, send } from "../context";

const handleReady = (command: CommandMessage) => {
  const sessionState = getState();
  const ready = (command.payload as { ready?: boolean } | undefined)?.ready ?? true;
  if (command.origin === "local") {
    sessionState.dispatch("self", ready ? "READY" : "UNREADY");
    send({
      type: 'READY',
      payload: { ready },
      from: '',
    });
    return;
  }
  sessionState.dispatch("peer", ready ? "PEER_READY" : "PEER_UNREADY");
};
