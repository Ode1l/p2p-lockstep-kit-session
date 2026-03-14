import type { State } from "./state/state";
import type { CommandBus } from "./commandBus";
import type { NetAdapter } from "./net";
import type { SessionMessage } from "../utils";

class SessionContextImpl {
  private state: State;
  private bus: CommandBus;
  private net: NetAdapter;

  constructor(deps: { state: State; bus: CommandBus; net: NetAdapter }) {
    this.state = deps.state;
    this.bus = deps.bus;
    this.net = deps.net;
  }

  getState() {
    return this.state;
  }

  getBus() {
    return this.bus;
  }

  getNet() {
    return this.net;
  }
}

let instance: SessionContextImpl | null = null;

export const initializeContext = (deps: { state: State; bus: CommandBus; net: NetAdapter }) => {
  instance = new SessionContextImpl(deps);
};

const requireContext = () => {
  if (!instance) {
    throw new Error("Session context is not initialized");
  }
  return instance;
};

export const getState = () => requireContext().getState();
export const getBus = () => requireContext().getBus();
export const send = (message: SessionMessage) => requireContext().getNet().send(message);
