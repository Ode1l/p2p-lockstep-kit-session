import { CommandListener } from "../commandBus";
import { getState, send, getSid, getBus } from "../context";
import type { SessionMessage } from "../../utils";

export const ready: CommandListener = (command) => {
  const state = getState();
  const bus = getBus();
  const sid = getSid();

  if (command.origin === "local") {
    const canSelf = state.canAction("self", "READY");
    const canPeer = state.canAction("peer", "PEER_READY");
    if (!canSelf || !canPeer) {
      return;
    }
    state.dispatch("self", "READY");
    state.dispatch("peer", "PEER_READY");

    const message: SessionMessage = {
      type: "READY",
      from: "",
      sid: sid,
      payload: { ready: true },
    };
    send(message);
    return;
  }

  if (sid && command.sid) {
    bus.emit("REJECT", { reason: "sid-mismatch" }, "local");
    return;
  }
  if (!state.canAction("peer", "PEER_READY")) {
    return;
  }
  state.dispatch("peer", "PEER_READY");
};
