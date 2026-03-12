import { createClient, type Facade } from "../../p2p-lockstep-kit-network/network";

export type NetAdapter = Facade;

export const createNetClient = (): NetAdapter => createClient();
