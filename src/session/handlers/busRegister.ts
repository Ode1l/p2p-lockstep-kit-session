import { CommandBus } from '../commandBus';
import { ready } from './ready';
import { start } from './start';
import { move } from './move';
import { request } from './request';
import { sync } from './sync';
import { undo } from './undo';
import { restart } from './restart';

export const registerHandlers = (bus: CommandBus) => {
  [ready, start, move, undo, restart, request, sync].forEach((handler) =>
    bus.on(handler),
  );
};
