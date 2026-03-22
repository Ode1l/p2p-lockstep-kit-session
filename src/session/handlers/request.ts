import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import type { PlayerLabel } from '../state/state';

type PendingAction = 'undo' | 'restart';

type RequestPayload = {
  action?: PendingAction;
  reason?: string;
} | undefined;

const cleanupPending = () => {
  const state = getState();
  state.setPendingAction(null);
  state.setPendingUndoCount(null);
  state.setResumeTurn(null);
};

const applyUndo = () => {
  const state = getState();
  const count = state.getPendingUndoCount();
  if (!count) {
    return;
  }
  for (let i = 0; i < count; i += 1) {
    state.popHistory();
  }
};

const applyRestart = () => {
  const state = getState();
  state.clearHistory();
  state.setLastStart(null);
  if (state.canAction('local', 'GAME_OVER', 'idle')) {
    state.dispatch('local', 'GAME_OVER', 'idle');
  }
  if (state.canAction('remote', 'GAME_OVER', 'idle')) {
    state.dispatch('remote', 'GAME_OVER', 'idle');
  }
};

const localResumeState = (turn: PlayerLabel | null) =>
  turn === 'remote' ? 'remote_turn' : 'local_turn';

const remoteResumeState = (turn: PlayerLabel | null) =>
  turn === 'remote' ? 'local_turn' : 'remote_turn';

export const request: CommandListener = (command) => {
  if (command.type !== 'APPROVE' && command.type !== 'REJECT') {
    return;
  }
  const state = getState();
  const action = state.getPendingAction();
  if (!action) {
    return;
  }
  const payload = command.payload as RequestPayload;
  if (payload?.action && payload.action !== action) {
    return;
  }

  if (command.from === 'local') {
    if (command.type === 'APPROVE') {
      if (
        !state.canAction('local', 'APPROVE', 'remote_turn') ||
        !state.canAction('remote', 'APPROVE', 'local_turn')
      ) {
        return;
      }
      state.dispatch('local', 'APPROVE', 'remote_turn');
      state.dispatch('remote', 'APPROVE', 'local_turn');
      if (action === 'undo') {
        applyUndo();
      } else {
        applyRestart();
      }
      send({ type: 'APPROVE', payload: { action } });
      cleanupPending();
      return;
    }

    const resume = state.getResumeTurn();
    const localTarget = localResumeState(resume);
    const remoteTarget = remoteResumeState(resume);
    if (
      !state.canAction('local', 'REJECT', localTarget) ||
      !state.canAction('remote', 'REJECT', remoteTarget)
    ) {
      return;
    }
    state.dispatch('local', 'REJECT', localTarget);
    state.dispatch('remote', 'REJECT', remoteTarget);
    send({
      type: 'REJECT',
      payload: { action, reason: payload?.reason ?? 'rejected' },
    });
    cleanupPending();
    return;
  }

  if (command.type === 'APPROVE') {
    if (
      !state.canAction('local', 'APPROVE', 'local_turn') ||
      !state.canAction('remote', 'APPROVE', 'remote_turn')
    ) {
      return;
    }
    state.dispatch('local', 'APPROVE', 'local_turn');
    state.dispatch('remote', 'APPROVE', 'remote_turn');
    if (action === 'undo') {
      applyUndo();
    } else {
      applyRestart();
    }
    cleanupPending();
    return;
  }

  const resume = state.getResumeTurn();
  const localTarget = localResumeState(resume);
  const remoteTarget = remoteResumeState(resume);
  if (
    state.canAction('local', 'REJECT', localTarget) &&
    state.canAction('remote', 'REJECT', remoteTarget)
  ) {
    state.dispatch('local', 'REJECT', localTarget);
    state.dispatch('remote', 'REJECT', remoteTarget);
  }
  cleanupPending();
};
