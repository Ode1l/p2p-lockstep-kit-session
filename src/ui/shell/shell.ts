import { createSessionController, SessionOptions } from '../../session';

export const createShell = (options: SessionOptions) =>
  createSessionController(options);
