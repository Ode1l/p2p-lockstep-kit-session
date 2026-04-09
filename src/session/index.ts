import {
  createClient,
  NetworkClient,
} from 'p2p-lockstep-kit-network';
import { CommandBus } from './commandBus';
import { State } from './state/state';
import { createNetClient } from './net';
import { initializeContext } from './context';
import { registerHandlers } from './handlers/busRegister.ts';

/**
 * Create a new game session with state management and networking
 * @param sid Session ID for rejoining (optional)
 * @param networkClient Custom network client (optional, creates default if not provided)
 * @returns Session manager with bus, state, net, and send method
 *
 * @example
 * const session = createSession();
 * session.bus.emit('READY', undefined, 'local');
 * await session.net.connect(remotePeerId);
 */
export const createSession = (sid?: string, networkClient?: NetworkClient) => {
  const bus = new CommandBus();
  let client;
  if (networkClient) {
    client = networkClient;
  } else {
    client = createClient();
  }
  const state = new State(null, null);
  const net = createNetClient(client, bus, null);

  initializeContext(state, bus, net, sid);
  registerHandlers(bus);

  net.onConnectionChange((isConnected) => {
    bus.emit(isConnected ? 'ONLINE' : 'OFFLINE', undefined, 'local');
  });

  return {
    bus,
    state,
    net,
    send: net.send.bind(net),
  };
};

export * from './plugins';
