import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';

const sendUndoReject = (reason: string) => {
  send({ type: 'REJECT', payload: { action: 'undo', reason } });
};

const getTurnLabel = () =>
  getState().getState('local') === 'local_turn' ? 'local' : 'remote';

export const undo: CommandListener = (command) => {
  if (command.type !== 'UNDO') {
    return;
  }
  const state = getState();

  if (command.from === 'local') {
    if (state.getPendingAction()) {
      return;
    }
    const canSelf = state.canAction('local', 'UNDO');
    const canPeer = state.canAction('remote', 'REMOTE_UNDO');
    if (!canSelf || !canPeer) {
      return;
    }
    const historyLength = state.getHistory().length;
    const localState = state.getState('local');
    const count: 1 | 2 = localState === 'local_turn' ? 2 : 1;
    if (historyLength < count) {
      return;
    }
    state.setPendingAction('undo');
    state.setPendingUndoCount(count);
    state.setResumeTurn(localState === 'local_turn' ? 'local' : 'remote');
    state.dispatch('local', 'UNDO');
    state.dispatch('remote', 'REMOTE_UNDO');
    send({ type: 'UNDO', payload: { count } });
    return;
  }

  if (state.getPendingAction()) {
    sendUndoReject('busy');
    return;
  }
  const canSelf = state.canAction('local', 'REMOTE_UNDO');
  const canPeer = state.canAction('remote', 'UNDO');
  if (!canSelf || !canPeer) {
    sendUndoReject('invalid_state');
    return;
  }
  const payload = (command.payload as { count?: number }) ?? {};
  const count = payload.count === 2 ? 2 : 1;
  if (payload.count && payload.count !== 1 && payload.count !== 2) {
    sendUndoReject('invalid');
    return;
  }
  if (count === 2 && state.getHistory().length < 2) {
    sendUndoReject('no_history');
    return;
  }
  state.setPendingAction('undo');
  state.setPendingUndoCount(count);
  state.setResumeTurn(getTurnLabel());
  state.dispatch('local', 'REMOTE_UNDO');
  state.dispatch('remote', 'UNDO');
};
