import type { CommandListener } from "../commandBus";
import type { SessionMessage } from "../../utils";
import { getState, send } from "../context";
import { TurnEntry } from '../state/state.ts';

export const sync: CommandListener = (command) => {
  const state = getState();
  // todo
  if (command.type === "SYNC_REQUEST") {
    state.dispatch("self", "SYNC", "syncing");
    state.dispatch("peer", "SYNC", "syncing");
    if (command.origin === "remote") {
      const payload: SessionMessage["payload"] = {
        history: state.getHistory(),
        lastStart: state.getLastStart(),
        turn: state.getState("self") === "my_turn" ? "self" : "peer",
      };
      send({ type: "SYNC_STATE", from: "", payload });
      return;
    }
    send({ type: "SYNC_REQUEST", from: "", payload: command.payload });
    return;
  }

  if (command.type !== "SYNC_STATE") {
    return;
  }

  const payload = (command.payload as {
    history?: { turn: number; player: "self" | "peer"; move?: unknown }[];
    lastStart?: "self" | "peer";
    turn?: "self" | "peer";
  }) || {};

  const history = payload.history ?? [];
  const normalized = history.map((entry: TurnEntry) => ({
    turn: entry.turn,
    player: entry.player === "self" ? "peer" : "self",
    move: entry.move,
  }));
  state.replaceHistory(normalized);
  state.setLastStart(payload.lastStart ? (payload.lastStart === "self" ? "peer" : "self") : null);

  state.dispatch("self", "SYNC", "syncing");
  state.dispatch("peer", "SYNC", "syncing");

  const resume = payload.turn === "peer" ? "self" : "peer";
  if (resume === "self") {
    state.dispatch("self", "SYNC_COMPLETE", "my_turn");
    state.dispatch("peer", "SYNC_COMPLETE", "peer_turn");
  } else {
    state.dispatch("self", "SYNC_COMPLETE", "peer_turn");
    state.dispatch("peer", "SYNC_COMPLETE", "my_turn");
  }
};
