import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetClient } from '../net';
import type { NetworkClient } from '../../../p2p-lockstep-kit-network/network';
import { CommandBus } from '../commandBus';

/**
 * Mock NetworkClient for testing
 */
class MockNetworkClient implements Partial<NetworkClient> {
  private messageHandlers: Array<(data: unknown) => void> = [];
  private stateHandlers: Array<(state: any) => void> = [];
  private mediaHandlers: Array<(stream: MediaStream | null) => void> = [];

  onMessage(handler: (data: unknown) => void) {
    this.messageHandlers.push(handler);
  }

  onStateChange(handler: (state: any) => void) {
    this.stateHandlers.push(handler);
  }

  onRemoteStream(handler: (stream: MediaStream | null) => void) {
    this.mediaHandlers.push(handler);
  }

  send(data: unknown) {
    // Mock implementation
  }

  // Simulate incoming message
  simulateMessage(data: unknown) {
    this.messageHandlers.forEach((handler) => handler(data));
  }

  // Simulate state change
  simulateStateChange(state: string) {
    this.stateHandlers.forEach((handler) => handler(state));
  }

  // Simulate remote stream
  simulateRemoteStream(stream: MediaStream | null) {
    this.mediaHandlers.forEach((handler) => handler(stream));
  }
}

describe('NetClient', () => {
  let netClient: NetClient;
  let mockNetwork: MockNetworkClient;
  let bus: CommandBus;

  beforeEach(() => {
    mockNetwork = new MockNetworkClient() as unknown as NetworkClient;
    bus = new CommandBus();
    netClient = new NetClient(mockNetwork as unknown as NetworkClient, bus, 'local-peer-id');
  });

  describe('message forwarding', () => {
    it('should emit valid messages to bus', () => {
      const busEmitSpy = vi.spyOn(bus, 'emit');

      mockNetwork.simulateMessage({
        type: 'MOVE',
        payload: { x: 10 },
        from: 'remote-peer-id',
      });

      expect(busEmitSpy).toHaveBeenCalledWith(
        'MOVE',
        {
          type: 'MOVE',
          payload: { x: 10 },
          from: 'remote-peer-id',
        },
        'remote',
      );
    });

    it('should ignore messages without type', () => {
      const busEmitSpy = vi.spyOn(bus, 'emit');

      mockNetwork.simulateMessage({ payload: 'data' });
      mockNetwork.simulateMessage(null);
      mockNetwork.simulateMessage('string');

      expect(busEmitSpy).not.toHaveBeenCalled();
    });
  });

  describe('connection state management', () => {
    it('should track connection state', () => {
      expect(netClient.getIsConnected()).toBe(false);

      mockNetwork.simulateStateChange('connected');
      expect(netClient.getIsConnected()).toBe(true);

      mockNetwork.simulateStateChange('disconnected');
      expect(netClient.getIsConnected()).toBe(false);
    });

    it('should emit ONLINE when connecting', () => {
      const busEmitSpy = vi.spyOn(bus, 'emit');

      mockNetwork.simulateStateChange('connected');

      expect(busEmitSpy).toHaveBeenCalledWith(
        'ONLINE',
        undefined,
        'local',
      );
    });

    it('should emit OFFLINE when disconnecting', () => {
      const busEmitSpy = vi.spyOn(bus, 'emit');

      mockNetwork.simulateStateChange('connected');
      busEmitSpy.mockClear();

      mockNetwork.simulateStateChange('disconnected');

      expect(busEmitSpy).toHaveBeenCalledWith(
        'OFFLINE',
        undefined,
        'local',
      );
    });

    it('should not emit ONLINE/OFFLINE on non-transition state changes', () => {
      const busEmitSpy = vi.spyOn(bus, 'emit');

      mockNetwork.simulateStateChange('connected');
      mockNetwork.simulateStateChange('connected');

      expect(busEmitSpy).toHaveBeenCalledTimes(1); // Only first transition
    });

    it('should call connection listeners', () => {
      const listener = vi.fn();
      netClient.onConnectionChange(listener);

      // Should immediately call with current state
      expect(listener).toHaveBeenCalledWith(false);

      listener.mockClear();
      mockNetwork.simulateStateChange('connected');

      expect(listener).toHaveBeenCalledWith(true);
    });
  });

  describe('send', () => {
    it('should reject send when not connected', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
      const sendSpy = vi.spyOn(mockNetwork, 'send');

      netClient.send({ type: 'MOVE', payload: { x: 10 } });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[NetClient] Cannot send message: not connected'),
        'MOVE',
      );
      expect(sendSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should allow send when connected', () => {
      const sendSpy = vi.spyOn(mockNetwork, 'send');
      mockNetwork.simulateStateChange('connected');

      netClient.send({ type: 'MOVE', payload: { x: 10 } });

      expect(sendSpy).toHaveBeenCalled();
      const sentData = JSON.parse(sendSpy.mock.calls[0][0] as string);
      expect(sentData.type).toBe('MOVE');
      expect(sentData.from).toBe('local-peer-id');
    });

    it('should use provided from field', () => {
      const sendSpy = vi.spyOn(mockNetwork, 'send');
      mockNetwork.simulateStateChange('connected');

      netClient.send({ type: 'MOVE', payload: {}, from: 'custom-id' });

      const sentData = JSON.parse(sendSpy.mock.calls[0][0] as string);
      expect(sentData.from).toBe('custom-id');
    });
  });

  describe('peer IDs', () => {
    it('should set and get peer IDs', () => {
      netClient.setPeerIds({ local: 'new-local', remote: 'new-remote' });
      const ids = netClient.getPeerIds();

      expect(ids.local).toBe('new-local');
      expect(ids.remote).toBe('new-remote');
    });

    it('should update only provided peer IDs', () => {
      netClient.setPeerIds({ local: 'local-id' });
      const ids = netClient.getPeerIds();

      expect(ids.local).toBe('local-id');
      expect(ids.remote).toBeNull();
    });
  });

  describe('media state', () => {
    it('should notify media state changes', () => {
      const listener = vi.fn();
      netClient.onMediaStateChange(listener);

      // Simulate stream with live tracks
      const mockStream = {
        getTracks: () => [
          { readyState: 'live' },
        ],
      } as any;

      mockNetwork.simulateRemoteStream(mockStream);
      expect(listener).toHaveBeenCalledWith(true);

      // Simulate stream removal
      mockNetwork.simulateRemoteStream(null);
      expect(listener).toHaveBeenCalledWith(false);
    });
  });
});

