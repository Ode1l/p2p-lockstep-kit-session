import { SessionMessage, SessionMessageType } from '../utils';

export type CommandOrigin = 'local' | 'remote';
export type BusMessageType = SessionMessageType | 'OFFLINE' | 'ONLINE' | 'GAME_OVER';
export type BusMessage = Omit<SessionMessage, 'type'> & { type: BusMessageType };
export type CommandListener = (message: BusMessage) => Promise<void> | void;

type HandlerMap = Partial<Record<BusMessageType, CommandListener>>;

export class CommandBus {
  private handlers: HandlerMap = {};
  private processingQueue: Promise<void> = Promise.resolve();

  public emit(type: BusMessageType, payload?: unknown, from: CommandOrigin = 'local'): void {
    this.dispatch({ type, payload, from });
  }

  public register(type: BusMessageType, handler: CommandListener): void {
    this.handlers[type] = handler;
  }

  public dispatch(message: BusMessage): void {
    this.processingQueue = this.processingQueue.then(async () => {
      const handler = this.handlers[message.type];
      if (handler) {
        try {
          await handler(message);
        } catch (err) {
          console.error(`[CommandBus] Error in ${message.type}:`, err);
        }
      }
    });
  }
}

