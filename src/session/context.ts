import type { State } from './state/state';
import type { CommandBus } from './commandBus';
import type { SessionMessage } from '../utils';
import { net } from './net';

class SessionContext {
  private state: State;
  private bus: CommandBus;
  private net: net;
  private sid?: string;

  constructor(state: State, bus: CommandBus, net: net, sid?: string) {
    this.state = state;
    this.bus = bus;
    this.net = net;
    this.sid = sid;
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

export const initializeContext = (
  state: State,
  bus: CommandBus,
  net: net,
  sid?: string,
) => {
  instance = new SessionContext(state, bus, net, sid);
};

const requireContext = () => {
  if (!instance) {
    throw new Error('Session context is not initialized');
  }
  return instance;
};

export const getState = () => requireContext().getState();
export const getBus = () => requireContext().getBus();
export const getSid = () => requireContext().getSid();
export const send = (message: SessionMessage) =>
  requireContext().getNet().send(message);
