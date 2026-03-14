export type CommandOrigin = "local" | "remote";

export type CommandMessage<T = unknown> = {
  type: string;
  payload?: T;
  origin: CommandOrigin;
  seq?: number;
  turn?: number;
  sid?: string;
  stateHash?: string;
};

export type CommandListener = (message: CommandMessage) => Promise<void> | void;

export class CommandBus {
  private readonly listeners = new Map<string, Set<CommandListener>>();

  public emit(type: string, payload?: unknown, origin: CommandOrigin = "local"): void {
    this.dispatch({ type, payload, origin });
  }

  public on(listener: CommandListener): void {
    const set = this.listeners.get("*") ?? new Set<CommandListener>();
    set.add(listener);
    this.listeners.set("*", set);
  }

  public off(listener: CommandListener): void {
    const set = this.listeners.get("*");
    set?.delete(listener);
  }

  public once(type: string, listener: CommandListener): void {
    const wrapped: CommandListener = async (message) => {
      if (message.type !== type) {
        return;
      }
      this.off(wrapped);
      await listener(message);
    };
    this.on(wrapped);
  }

  public dispatch(message: CommandMessage): void {
    const wildcards = this.listeners.get("*") ?? new Set();
    for (const listener of wildcards) {
      void listener(message);
    }
  }
}
