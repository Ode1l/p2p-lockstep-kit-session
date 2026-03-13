import type { Facade } from "../../p2p-lockstep-kit-network/network";
import  { CommandBus } from "./commandBus";
import type { SessionMessage } from "../utils";

export type NetAdapter = {
  send: (message: SessionMessage) => void;
};

export const createNetClient = (
  client: Facade,
  bus: CommandBus,
): NetAdapter => {
  client.onMessage((data) => {
    const message = data as Partial<SessionMessage> & { type?: string };
    if (!message || typeof message !== "object" || !message.type) {
      return;
    }
    bus.emit(
      String(message.type),
      message as SessionMessage,
      "remote"
    );
  });

  return {
    send: (message) => {
      client.send(message as unknown as string);
    },
  };
};
