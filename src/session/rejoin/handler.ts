import type { SessionDeps } from "../sessionTypes";
import { createEnvelope } from "../net";

export const createRejoinHandler = (
  deps: SessionDeps,
  hooks: { resumeTTLms: number; resetToLobby: () => void },
) => {
  const { state, ui, net, sid, nextSeq, fsm } = deps;
  const { resumeTTLms, resetToLobby } = hooks;

  const sendReject = (reason: string) => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    const status = state.getStatus();
    net.send(
      createEnvelope({
        domain: "session",
        type: "REJECT",
        sid,
        from,
        seq: nextSeq(),
        payload: { action: "rejoin", reason },
        turn: status.turn,
        stateHash: state.game.getHash(),
      }),
    );
  };

  const sendApprove = () => {
    const from = state.peer.getId();
    if (!from) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "session",
        type: "APPROVE",
        sid,
        from,
        seq: nextSeq(),
      }),
    );
  };

  return async (meta: { turn?: number; stateHash?: string }) => {
    if (meta.turn === undefined) {
      sendReject("cache-mismatch");
      resetToLobby();
      return;
    }
    const cacheHash = meta.stateHash ?? "";
    const canResume =
      !!cacheHash && state.canRestore({ cacheHash, turn: meta.turn }, resumeTTLms);
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
      fsm.onMatchStart("rejoin-approved");
    } else {
      sendReject("rejected");
      resetToLobby();
    }
    state.render();
  };
};
