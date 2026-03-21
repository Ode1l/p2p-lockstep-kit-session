import { SessionMessage, SessionMessageType } from '../utils';

export type CommandOrigin = 'local' | 'remote';

export type CommandListener = (message: SessionMessage) => Promise<void> | void;

export class CommandBus {
  private readonly listeners = new Map<string, Set<CommandListener>>();

  public emit(
    type: SessionMessageType,
    payload?: unknown,
    from: CommandOrigin = 'local',
  ): void {
    this.dispatch({ type, payload, from });
  }

  public on(listener: CommandListener): void {
    const set = this.listeners.get('*') ?? new Set<CommandListener>();
    set.add(listener);
    this.listeners.set('*', set);
  }

  public off(listener: CommandListener): void {
    const set = this.listeners.get('*');
    set?.delete(listener);
  }

  public dispatch(message: SessionMessage): void {
    const wildcards = this.listeners.get('*') ?? new Set();
    for (const listener of wildcards) {
      void listener(message);
    }
  }
}
