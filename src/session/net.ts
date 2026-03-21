import type { NetworkClient } from "../../p2p-lockstep-kit-network/network";
import type { SessionMessage } from "../utils";
import type { CommandBus } from "./commandBus";

class net {
  private readonly client: NetworkClient;
  private readonly bus: CommandBus;
  private readonly id: string | null = null;

  public constructor(
    client: NetworkClient,
    bus: CommandBus,
    id: string | null = null,
  ) {
    this.client = client;
    this.bus = bus;
    if (id) this.id = id;
    this.client.onMessage((data) => {
      const message = data as Partial<SessionMessage> & { type?: string };
      if (!message || typeof message !== "object" || !message.type) {
        return;
      }
      this.bus.emit(String(message.type), message as SessionMessage, "remote");
    });
  }

  public send(message: SessionMessage) {
    const enriched: SessionMessage = {
      ...message,
      from: message.from ?? this.id ?? "",
    };
    this.client.send(JSON.stringify(enriched));
  }
}

export const busOnNet = (client: NetworkClient, bus: CommandBus, id: string | null) =>
  new net(client, bus, id);
