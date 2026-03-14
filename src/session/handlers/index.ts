import { CommandBus } from "../commandBus";
import { ready } from "./ready";
import { start } from "./start";
import { move } from "./move";
import { undo } from "./undo";
import { restart } from "./restart";
import { rejoin } from "./rejoin";

export const registerHandlers = (bus: CommandBus) => {
  [ready, start, move, undo, restart, rejoin].forEach((handler) => bus.on(handler));
};
