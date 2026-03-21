import type { CommandListener } from '../commandBus';
import { getState, send } from '../context';
import type { PlayerLabel } from '../state/state';

const flipStarter = (last: PlayerLabel | null): PlayerLabel => {
  if (!last) {
    return Math.random() < 0.5 ? 'self' : 'peer';
  }
  return last === 'self' ? 'peer' : 'self';
};

const starterPayload = (starter: PlayerLabel): 'sender' | 'receiver' =>
  starter === 'self' ? 'sender' : 'receiver';

const resolveStarterFromPayload = (
  value?: 'sender' | 'receiver',
): PlayerLabel => (value === 'receiver' ? 'self' : 'peer');

export const start: CommandListener = (command) => {
  const state = getState();
  // todo
  if (command.origin === 'local') {
    const starter = flipStarter(state.getLastStart());
    const selfNext = starter === 'self' ? 'my_turn' : 'peer_turn';
    const peerNext = starter === 'self' ? 'peer_turn' : 'my_turn';
    if (
      !state.canAction('self', 'START', selfNext) ||
      !state.canAction('peer', 'PEER_START', peerNext)
    ) {
      return;
    }
    state.dispatch('self', 'START', selfNext);
    state.dispatch('peer', 'PEER_START', peerNext);
    state.setLastStart(starter);
    send({
      type: 'START',
      from: '',
      payload: { starter: starterPayload(starter) },
    });
    return;
  }

  const starterSide = resolveStarterFromPayload(
    (command.payload as { starter?: 'sender' | 'receiver' } | undefined)
      ?.starter,
  );
  const selfNext = starterSide === 'self' ? 'my_turn' : 'peer_turn';
  const peerNext = starterSide === 'self' ? 'peer_turn' : 'my_turn';
  if (
    !state.canAction('self', 'PEER_START', selfNext) ||
    !state.canAction('peer', 'START', peerNext)
  ) {
    return;
  }
  state.dispatch('self', 'PEER_START', selfNext);
  state.dispatch('peer', 'START', peerNext);
  state.setLastStart(starterSide);
};
