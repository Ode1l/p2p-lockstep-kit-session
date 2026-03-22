import type { NetworkClient } from '../../p2p-lockstep-kit-network/network';
import type { SessionMessage } from '../utils';
import type { BusMessageType, CommandBus } from './commandBus';
import { PeerState } from '../../p2p-lockstep-kit-network/network/state/peerState.ts';

export class NetClient {
  private localPeerId: string | null;
  private remotePeerId: string | null;
  private stateListener?: (state: PeerState) => void;
  private mediaListener?: (active: boolean) => void;

  public constructor(
    private readonly client: NetworkClient,
    private readonly bus: CommandBus,
    peerId: string | null,
  ) {
    this.localPeerId = peerId ?? null;
    this.remotePeerId = null;

    this.client.onMessage((data) => {
      const message = data as Partial<SessionMessage> & { type?: string };
      if (!message || typeof message !== 'object' || !message.type) {
        return;
      }
      this.bus.emit(
        message.type as BusMessageType,
        message as SessionMessage,
        'remote',
      );
    });

    this.client.onStateChange((state) => {
      this.stateListener?.(state);
    });

    this.client.onRemoteStream((stream) => {
      const active = !!stream && stream.getTracks().some((track) => track.readyState === 'live');
      this.mediaListener?.(active);
    });
  }

  public send(message: SessionMessage) {
    const enriched: SessionMessage = {
      ...message,
      from: message.from ?? this.localPeerId ?? '',
    };
    this.client.send(JSON.stringify(enriched));
  }

  public setPeerIds(ids: { local?: string | null; remote?: string | null }) {
    if (ids.local !== undefined) {
      this.localPeerId = ids.local;
    }
    if (ids.remote !== undefined) {
      this.remotePeerId = ids.remote;
    }
  }

  public getPeerIds() {
    return { local: this.localPeerId, remote: this.remotePeerId };
  }

  public onStateChange(handler: (state: PeerState) => void) {
    this.stateListener = handler;
  }

  public onMediaStateChange(handler: (active: boolean) => void) {
    this.mediaListener = handler;
  }
}

export const createNetClient = (
  client: NetworkClient,
  bus: CommandBus,
  peerId: string | null,
) => new NetClient(client, bus, peerId);
