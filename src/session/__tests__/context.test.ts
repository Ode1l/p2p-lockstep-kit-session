import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { State } from '../state/state';
import { initializeContext, resetContext, getState, getBus, getSid } from '../context';
import { CommandBus } from '../commandBus';
import { NetClient } from '../net';
import type { NetworkClient } from '../../../p2p-lockstep-kit-network/network';

class MockNetworkClient implements Partial<NetworkClient> {
  onMessage(handler: any) {}
  onStateChange(handler: any) {}
  onRemoteStream(handler: any) {}
  send(data: unknown) {}
}

describe('SessionContext', () => {
  beforeEach(() => {
    resetContext();
  });

  afterEach(() => {
    resetContext();
  });

  it('should throw if not initialized', () => {
    expect(() => getState()).toThrow('[SessionContext] Not initialized');
    expect(() => getBus()).toThrow('[SessionContext] Not initialized');
    expect(() => getSid()).toThrow('[SessionContext] Not initialized');
  });

  it('should initialize and retrieve context', () => {
    const state = new State(null, null);
    const bus = new CommandBus();
    const net = new NetClient(
      new MockNetworkClient() as unknown as NetworkClient,
      bus,
      null,
    );
    const sid = 'session-123';

    initializeContext(state, bus, net, sid);

    expect(getState()).toBe(state);
    expect(getBus()).toBe(bus);
    expect(getSid()).toBe(sid);
  });

  it('should allow context to be reset', () => {
    const state = new State(null, null);
    const bus = new CommandBus();
    const net = new NetClient(
      new MockNetworkClient() as unknown as NetworkClient,
      bus,
      null,
    );

    initializeContext(state, bus, net);
    resetContext();

    expect(() => getState()).toThrow('[SessionContext] Not initialized');
  });

  it('should allow context to be reinitialized (for multiple sessions)', () => {
    const state1 = new State(null, null);
    const bus1 = new CommandBus();
    const net1 = new NetClient(
      new MockNetworkClient() as unknown as NetworkClient,
      bus1,
      null,
    );

    initializeContext(state1, bus1, net1, 'session-1');
    expect(getState()).toBe(state1);

    const state2 = new State(null, null);
    const bus2 = new CommandBus();
    const net2 = new NetClient(
      new MockNetworkClient() as unknown as NetworkClient,
      bus2,
      null,
    );

    initializeContext(state2, bus2, net2, 'session-2');
    expect(getState()).toBe(state2);
    expect(getSid()).toBe('session-2');
  });

  it('should default sid to undefined', () => {
    const state = new State(null, null);
    const bus = new CommandBus();
    const net = new NetClient(
      new MockNetworkClient() as unknown as NetworkClient,
      bus,
      null,
    );

    initializeContext(state, bus, net);

    expect(getSid()).toBeUndefined();
  });
});

