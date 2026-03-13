import { createClient } from "../../p2p-lockstep-kit-network/network";
import { CommandBus } from "./commandBus";
import { State } from "./state/state";
import { createNetClient } from "./net";

export const createSession = () => {
  const bus = new CommandBus();
  const state = new State();
  const client = createClient();
  const net = createNetClient(client, bus);

  return {
    bus,
    state,
    net,
    send: net.send,
  };
};
