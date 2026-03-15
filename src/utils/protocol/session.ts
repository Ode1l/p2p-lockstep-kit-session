export type SessionMessageType =
  | "READY"
  | "START"
  | "MOVE"
  | "UNDO"
  | "RESTART"
  | "APPROVE"
  | "REJECT"
  | "REJOIN"
  | "SYNC_REQUEST"
  | "SYNC_STATE";

export type SessionMessage = {
  type: SessionMessageType;
  from?: string;
  seq?: number;
  sid?: string;
  turn?: number;
  stateHash?: string;
  payload?: any;
}