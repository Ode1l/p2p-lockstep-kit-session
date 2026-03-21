import { createClient } from "../../p2p-lockstep-kit-network/network";
import { CommandBus } from "./commandBus";
import { State } from "./state/state";
import { busOnNet } from './net';
import { initializeContext } from "./context";
import { registerHandlers } from "./handlers/register.ts";

export const createSession = (sid?: string) => {
  const bus = new CommandBus();
  const client = createClient();
  const id = client.getLocalPeerId();
  const peerId = client.getRemotePeerId();
  const state = new State(id, peerId);
  const net = busOnNet(client, bus, id);

  initializeContext({ bus, state, net, sid });
  registerHandlers(bus);

  return {
    bus,
    state,
    net,
    send: net.send,
  };
};
