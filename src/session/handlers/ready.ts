import { CommandListener, CommandMessage } from "../commandBus";
import { getState, send, getSid } from "../context";
import type { SessionMessage } from "../../utils";
import { getBus } from "../context";

export const ready: CommandListener = (command: CommandMessage) => {
  const state = getState();

  if (command.origin === "local") {
    if (!state.canAction("self", "READY")) {
      return;
    }
    state.dispatch("self", "READY");
    const message: SessionMessage = {
      type: "READY",
      sid: getSid(),
    };
    send(message);
    return;
  }

  if (!state.canAction("peer", "PEER_READY")) {
    return;
  }
  const sid = getSid();
  if (!sid || command.sid === sid) {
    state.dispatch("peer", "PEER_READY");
    return;
  }
  getBus().emit("REJECT", { reason: "sid-mismatch" }, "local");
};
