import { SessionMessage, SessionMessageType } from '../utils';

export type CommandOrigin = 'local' | 'remote';

export type BusMessageType = SessionMessageType | 'OFFLINE' | 'ONLINE' | 'GAME_OVER';

export type BusMessage = Omit<SessionMessage, 'type'> & { type: BusMessageType };

export type CommandListener = (message: BusMessage) => Promise<void> | void;

/**
 * Command bus for inter-component communication
 * Broadcasts messages to all registered listeners, handling both sync and async handlers
 */
export class CommandBus {
  private readonly listeners = new Map<string, Set<CommandListener>>();

  /**
   * Emit a command message to all listeners
   * @param type Command type
   * @param payload Command data
   * @param from Origin of the command ('local' or 'remote')
   */
  public emit(
    type: BusMessageType,
    payload?: unknown,
    from: CommandOrigin = 'local',
  ): void {
    this.dispatch({ type, payload, from });
  }

  /**
   * Register a listener for all command messages
   * @param listener Callback function (can be async)
   */
  public on(listener: CommandListener): void {
    const set = this.listeners.get('*') ?? new Set<CommandListener>();
    set.add(listener);
    this.listeners.set('*', set);
  }

  /**
   * Unregister a listener
   * @param listener The callback to remove
   */
  public off(listener: CommandListener): void {
    const set = this.listeners.get('*');
    if (set) {
      set.delete(listener);
      // Clean up empty Set to prevent memory leak
      if (set.size === 0) {
        this.listeners.delete('*');
      }
    }
  }

  /**
   * Dispatch message to all listeners with error handling
   * All listeners are executed in parallel, errors are caught and logged
   * @param message The message to dispatch
   */
  public dispatch(message: BusMessage): void {
    const wildcards = this.listeners.get('*') ?? new Set();
    for (const listener of wildcards) {
      // Execute listener and catch any errors (sync or async)
      Promise.resolve(listener(message)).catch((err) => {
        console.error(
          `[CommandBus] Error in listener for "${message.type}":`,
          err,
        );
      });
    }
  }
}
