import { createEnvelope, type NetAdapter } from "../net";
import type { SyncStatePayload } from "../../utils";
import type { SessionState } from "../state/state";
import type { SessionFsm } from "../state/fsm";
import type { PendingController } from "../state/pending";

export type RejoinControl = {
  handleRejoinMessage: (payload: SyncStatePayload, meta: { turn?: number; stateHash?: string }) => Promise<void>;
  maybeAutoRejoin: () => Promise<void>;
};

export const createRejoinControl = (
  deps: {
    state: SessionState;
    net: NetAdapter;
    sid: string;
    nextSeq: () => number;
    pending: PendingController;
    fsm: SessionFsm;
  },
  hooks: { resetToLobby: () => void },
): RejoinControl => {
  const { state, net, sid, nextSeq, pending, fsm } = deps;
  const { resetToLobby } = hooks;

  const sendSession = (
    type: "REJOIN" | "APPROVE" | "REJECT" | "SYNC_STATE",
    payload?: unknown,
    meta?: { turn?: number; stateHash?: string },
  ) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "session",
        type,
        sid,
        from,
        seq: nextSeq(),
        payload,
        turn: meta?.turn,
        stateHash: meta?.stateHash,
      }),
    );
  };

  const sendReject = (reason: string) => {
    const status = state.getStatus();
    sendSession(
      "REJECT",
      { action: "rejoin", reason },
      { turn: status.turn, stateHash: state.game.getHash() },
    );
  };

  const sendApprove = () => sendSession("APPROVE");

  const sendRejoin = (turn: number, cacheHash: string) => {
    sendSession("REJOIN", undefined, { turn, stateHash: cacheHash });
  };

  const sendSyncState = (statePayload: SyncStatePayload) => {
    sendSession("SYNC_STATE", statePayload);
  };

  const applyRemoteState = (payload: SyncStatePayload) => {
    state.applySnapshot(payload);
    state.startedState.set(true);
    state.ready.clear();
    state.render();
    fsm.refreshTurn();
  };

  const handleRejoinMessage = async (
    payload: SyncStatePayload,
    meta: { turn?: number; stateHash?: string },
  ) => {
    if (meta.turn === undefined || !meta.stateHash) {
      sendReject("cache-mismatch");
      resetToLobby();
      return;
    }

    const localHash = state.game.getHash();
    const localTurn = state.getStatus().turn;

    if (meta.stateHash === localHash && meta.turn === localTurn) {
      sendApprove();
      state.startedState.set(true);
      state.ready.clear();
      state.render();
      fsm.refreshTurn();
      return;
    }

    if (localTurn >= meta.turn) {
      sendSyncState({ state: state.game.getSnapshot() });
      sendApprove();
      fsm.refreshTurn();
      return;
    }

    applyRemoteState(payload);
    sendApprove();
  };

  const maybeAutoRejoin = async () => {
    if (!state.hasCache()) {
      return;
    }
    const { cacheHash, cacheTurn } = state.getCacheMeta();
    void pending.begin("rejoin");
    sendRejoin(cacheTurn, cacheHash);
  };

  return {
    handleRejoinMessage,
    maybeAutoRejoin,
  };
};
