import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';

export const sync: CommandListener = (command) => {
  const state = getState();

  if (command.type === 'SYNC_REQUEST') {
    if (command.from === 'local') {
    if (!state.canAction('local', 'SYNC', 'syncing') || !state.canAction('remote', 'SYNC', 'syncing')) {
      return;
    }
    state.dispatch('local', 'SYNC', 'syncing');
    state.dispatch('remote', 'SYNC', 'syncing');
      send({ type: 'SYNC_REQUEST', from: '', payload: command.payload });
      return;
    }

    const payload = {
      history: state.getHistory(),
      lastStart: state.getLastStart(),
      turn: state.getState('local') === 'local_turn' ? 'local' : 'remote',
    };
    send({ type: 'SYNC_STATE', from: '', payload });
    return;
  }

  if (command.type !== 'SYNC_STATE') {
    return;
  }

  const payload = (command.payload as {
    history?: { turn: number; player: 'local' | 'remote'; move?: unknown }[];
    lastStart?: 'local' | 'remote' | null;
    turn?: 'local' | 'remote';
  }) || {};

  if (payload.history) {
    state.replaceHistory(payload.history);
  } else {
    state.clearHistory();
  }

  if (payload.lastStart) {
    state.setLastStart(payload.lastStart === 'local' ? 'remote' : 'local');
  } else {
    state.setLastStart(null);
  }

  if (state.canAction('local', 'SYNC', 'syncing')) {
    state.dispatch('local', 'SYNC', 'syncing');
  }
  if (state.canAction('remote', 'SYNC', 'syncing')) {
    state.dispatch('remote', 'SYNC', 'syncing');
  }

  const resumeLocal = payload.turn === 'remote' ? 'local' : 'remote';
  const localNext = resumeLocal === 'local' ? 'local_turn' : 'remote_turn';
  const remoteNext = resumeLocal === 'local' ? 'remote_turn' : 'local_turn';

  if (state.canAction('local', 'SYNC_COMPLETE', localNext)) {
    state.dispatch('local', 'SYNC_COMPLETE', localNext);
  }
  if (state.canAction('remote', 'SYNC_COMPLETE', remoteNext)) {
    state.dispatch('remote', 'SYNC_COMPLETE', remoteNext);
  }
};
