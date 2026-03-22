import { createClient } from '../../p2p-lockstep-kit-network/network';
import { CommandBus } from './commandBus';
import { State } from './state/state';
import { createNetClient } from './net';
import { initializeContext } from './context';
import { registerHandlers } from './handlers/busRegister.ts';

export const createSession = (sid?: string) => {
  const bus = new CommandBus();
  const client = createClient();
  const state = new State(null, null);
  const net = createNetClient(client, bus, null);

  let lastConnectionState: RTCPeerConnectionState | null = null;
  net.onConnectionStateChange((connectionState) => {
    if (connectionState === lastConnectionState) {
      return;
    }
    lastConnectionState = connectionState;
    if (connectionState === 'connected') {
      bus.emit('ONLINE', undefined, 'local');
      return;
    }
    if (connectionState === 'disconnected' || connectionState === 'failed') {
      bus.emit('OFFLINE', undefined, 'local');
    }
  });

  initializeContext(state, bus, net, sid);
  registerHandlers(bus);

  return {
    bus,
    state,
    net,
    send: net.send.bind(net),
  };
};
