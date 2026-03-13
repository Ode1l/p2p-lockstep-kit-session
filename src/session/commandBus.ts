export type CommandOrigin = "local" | "remote";

export type CommandMessage<T = unknown> = {
  type: string;
  payload?: T;
  origin: CommandOrigin;
};

export type CommandListener = (message: CommandMessage) => void;

export class CommandBus {
  private readonly listeners = new Set<CommandListener>();

  public emit(type: string, payload?: unknown): void {
    this.dispatch({ type, payload, origin: "local" });
  }

  public on(listener: CommandListener): void {
    this.listeners.add(listener);
  }

  public off(listener: CommandListener): void {
    this.listeners.delete(listener);
  }

  public dispatch(message: CommandMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}
