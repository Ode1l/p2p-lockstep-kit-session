export type Facade = {
  start: (options?: { autoRegisterUrl?: string; autoConnectId?: string }) => Promise<void>;
  register: (url: string) => Promise<{ peerId: string }>;
  connect: (targetId: string) => Promise<void>;
  ready: (ready?: boolean) => Promise<void>;
  matchStart: () => Promise<void>;
  undo: () => Promise<void>;
  restart: () => Promise<void>;
  rejoin: () => Promise<void>;
  sync: () => Promise<void>;
  toggleVoice: () => Promise<void>;
};

export { State } from "./state/state";
export { JusticeState } from "./state/justiceState";
