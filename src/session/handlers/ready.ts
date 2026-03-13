import type { CommandMessage } from "../commandBus";
import type {send, state } from "../index"

const Ready = (command: CommandMessage) => {
  const ready = (command.payload as { ready?: boolean } | undefined)?.ready ?? true;
  if (command.origin === "local") {
    state.dispatch("self", ready ? "READY" : "UNREADY");
    return;
  }
  state.dispatch("peer", ready ? "PEER_READY" : "PEER_UNREADY");
};
