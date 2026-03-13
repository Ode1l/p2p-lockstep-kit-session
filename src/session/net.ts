import type { NetworkClient } from '../../p2p-lockstep-kit-network/network';
import type { SessionMessage } from "../utils";
import { CommandBus } from "./commandBus";

export type NetAdapter = {
  send: (message: SessionMessage) => void;
};

export const createNetClient = (
  client: NetworkClient,
  bus: CommandBus,
) => {
  client.onMessage((data) => {
    const message = data as Partial<SessionMessage> & { type?: string };
    if (!message || typeof message !== "object" || !message.type) {
      return;
    }
    bus.emit(String(message.type), message as SessionMessage, "remote");
  });

  return {
    send: (message: SessionMessage) => {
      client.send(JSON.stringify(message));
    },
  };
};
