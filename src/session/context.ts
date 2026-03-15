import type { State } from "./state/state";
import type { CommandBus } from "./commandBus";
import type { NetAdapter } from "./net";
import type { SessionMessage } from "../utils";

class SessionContext {
  private state: State;
  private bus: CommandBus;
  private net: NetAdapter;
  private sid?: string;

  constructor(deps: { state: State; bus: CommandBus; net: NetAdapter; sid?: string }) {
    this.state = deps.state;
    this.bus = deps.bus;
    this.net = deps.net;
    this.sid = deps.sid;
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

  getSid() {
    return this.sid;
  }
}

let instance: SessionContext | null = null;

export const initializeContext = (deps: { state: State; bus: CommandBus; net: NetAdapter; sid?: string; game?: string }) => {
  instance = new SessionContext(deps);
};

const requireContext = () => {
  if (!instance) {
    throw new Error("Session context is not initialized");
  }
  return instance;
};

export const getState = () => requireContext().getState();
export const getBus = () => requireContext().getBus();
export const getSid = () => requireContext().getSid();
export const send = (message: SessionMessage) => requireContext().getNet().send(message);
