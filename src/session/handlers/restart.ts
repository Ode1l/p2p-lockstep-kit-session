import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';

const sendRestartReject = (reason: string) => {
  send({ type: 'REJECT', payload: { action: 'restart', reason } });
};

const currentTurnLabel = () =>
  getState().getState('local') === 'local_turn' ? 'local' : 'remote';

export const restart: CommandListener = (command) => {
  if (command.type !== 'RESTART') {
    return;
  }
  const state = getState();

  if (command.from === 'local') {
    if (state.getPendingAction()) {
      return;
    }
    const canSelf = state.canAction('local', 'RESTART');
    const canPeer = state.canAction('remote', 'REMOTE_RESTART');
    if (!canSelf || !canPeer) {
      return;
    }
    state.setPendingAction('restart');
    state.setPendingUndoCount(null);
    state.setResumeTurn(currentTurnLabel());
    state.dispatch('local', 'RESTART');
    state.dispatch('remote', 'REMOTE_RESTART');
    send({ type: 'RESTART' });
    return;
  }

  if (state.getPendingAction()) {
    sendRestartReject('busy');
    return;
  }
  const canSelf = state.canAction('local', 'REMOTE_RESTART');
  const canPeer = state.canAction('remote', 'RESTART');
  if (!canSelf || !canPeer) {
    sendRestartReject('invalid_state');
    return;
  }
  state.setPendingAction('restart');
  state.setPendingUndoCount(null);
  state.setResumeTurn(currentTurnLabel());
  state.dispatch('local', 'REMOTE_RESTART');
  state.dispatch('remote', 'RESTART');
};
