import { createClient } from "../../p2p-lockstep-kit-network/network";
import { CommandBus } from "./commandBus";
import { State } from "./state/state";
import { createNetClient } from "./net";
import { initializeContext } from "./context";
import { registerHandlers } from "./handlers/register.ts";

export type SessionOptions = {
  sid?: string;
};

export const createSession = (options: SessionOptions = {}) => {
  const bus = new CommandBus();
  const state = new State();
  const client = createClient();
  const net = createNetClient(client, bus);
  const { sid } = options;

  initializeContext({ bus, state, net, sid });
  registerHandlers(bus);

  return {
    bus,
    state,
    net,
    send: net.send,
  };
};
