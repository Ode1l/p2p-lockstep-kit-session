import { createEnvelope } from "../net";
import type { SessionDeps } from "../sessionTypes";

export type RejoinControl = {
  handleRejoinMessage: (meta: { turn?: number; stateHash?: string }) => Promise<void>;
  maybePromptRejoin: () => Promise<void>;
};

export const createRejoinControl = (
  deps: SessionDeps,
  hooks: { resumeTTLms: number; resetToLobby: () => void },
): RejoinControl => {
  const { state, ui, net, sid, nextSeq, pending } = deps;
  const { resumeTTLms, resetToLobby } = hooks;

  const sendSession = (
    type: "REJOIN" | "APPROVE" | "REJECT",
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

  const handleRejoinMessage = async (meta: { turn?: number; stateHash?: string }) => {
    if (meta.turn === undefined || !meta.stateHash) {
      sendReject("cache-mismatch");
      resetToLobby();
      return;
    }
    const canResume = state.canRestore({ cacheHash: meta.stateHash, turn: meta.turn }, resumeTTLms);
    if (!canResume) {
      sendReject("cache-mismatch");
      resetToLobby();
      return;
    }
    const approved = await (ui.promptRejoinApprove?.() ?? Promise.resolve(false));
    if (approved) {
      sendApprove();
      state.startedState.set(true);
      state.ready.clear();
    } else {
      sendReject("rejected");
      resetToLobby();
    }
    state.render();
  };

  const maybePromptRejoin = async () => {
    if (!state.hasCache()) {
      return;
    }
    const choice = await (ui.promptRejoinChoice?.() ?? Promise.resolve("restart"));
    if (choice === "restart") {
      state.resetToLobby();
      return;
    }
    const { cacheHash, cacheTurn } = state.getCacheMeta();
    void pending.begin("rejoin");
    sendRejoin(cacheTurn, cacheHash);
  };

  return {
    handleRejoinMessage,
    maybePromptRejoin,
  };
};
