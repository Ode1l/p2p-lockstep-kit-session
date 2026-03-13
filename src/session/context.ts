import type { State } from "./state/state";
import type { CommandBus } from "./commandBus";
import type { NetAdapter } from "./net";
import type { SessionMessage } from "../utils";

export class SessionContext {
  private static instance: SessionContext | null = null;

  private constructor(
    private readonly bus: CommandBus,
    private readonly state: State,
    private readonly net: NetAdapter,
  ) {}

  public static initialize(deps: { bus: CommandBus; state: State; net: NetAdapter }) {
    SessionContext.instance = new SessionContext(deps.bus, deps.state, deps.net);
  }

  public static current(): SessionContext {
    if (!SessionContext.instance) {
      throw new Error("Session context is not initialized");
    }
    return SessionContext.instance;
  }

  public static state(): State {
    return SessionContext.current().getState();
  }

  public static bus(): CommandBus {
    return SessionContext.current().getBus();
  }

  public static net(): NetAdapter {
    return SessionContext.current().getNet();
  }

  public static send(message: SessionMessage): void {
    SessionContext.net().send(message);
  }

  public getBus(): CommandBus {
    return this.bus;
  }

  public getState(): State {
    return this.state;
  }

  public getNet(): NetAdapter {
    return this.net;
  }
}

export const getState = (): State => SessionContext.state();
export const getBus = (): CommandBus => SessionContext.bus();
export const send = (message: SessionMessage): void => {
  SessionContext.send(message);
};

