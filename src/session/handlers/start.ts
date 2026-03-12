import type { StartPayload } from "../../utils";
import type { SessionDeps } from "../sessionTypes";
import { createEnvelope } from "../net";

export const createStartHandler = (
  deps: SessionDeps,
  hooks: {
    startMatch: (myColor: 1 | 2) => void;
    setLastStartSenderColor: (color: 1 | 2) => void;
    getLastStartSenderColor: () => 1 | 2 | null;
    canStart: () => boolean;
  },
) => {
  const { state, net, sid, nextSeq } = deps;
  const { startMatch, setLastStartSenderColor, getLastStartSenderColor, canStart } = hooks;

  const sendStart = (payload: StartPayload) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "session",
        type: "START",
        sid,
        from,
        seq: nextSeq(),
        payload,
      }),
    );
  };

  return (payload: StartPayload, origin: "local" | "remote") => {
    if (origin === "local") {
      if (!canStart()) {
        return;
      }
      const last = getLastStartSenderColor();
      const senderColor = last ? (last === 1 ? 2 : 1) : Math.random() < 0.5 ? 1 : 2;
      const receiverColor = senderColor === 1 ? 2 : 1;
      setLastStartSenderColor(senderColor);
      sendStart({ senderColor, receiverColor, firstPlayer: 1 });
      startMatch(senderColor);
      return;
    }
    setLastStartSenderColor(payload.senderColor);
    startMatch(payload.receiverColor);
  };
};
