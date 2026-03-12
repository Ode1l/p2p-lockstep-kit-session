export type SessionState =
  | "IDLE"
  | "READY"
  | "MY_TURN"
  | "PEER_TURN"
  | "APPROVING"
  | "WAITING_APPROVAL"
  | "SYNCING";

export type SessionEvent =
  | "READY"
  | "START"
  | "UNREADY"
  | "MY_MOVE"
  | "PEER_MOVE"
  | "REQUEST"
  | "APPROVE"
  | "REJECT"
  | "GAME_OVER"
  | "REJOIN"
  | "SYNC";

export type Transition = {
  from: SessionState;
  event: SessionEvent;
  to: SessionState;
};

const transitions: Transition[] = [
  { from: "IDLE", event: "READY", to: "READY" },
];

export const nextSessionState = (
  state: SessionState,
  event: SessionEvent,
): SessionState => {
  const hit = transitions.find((t) => t.from === state && t.event === event);
  return hit ? hit.to : state;
};
