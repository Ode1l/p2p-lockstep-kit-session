import type { PlayerId, WinnerId } from "../game/types";

export type VoiceUiState = {
  status: "idle" | "starting" | "active" | "error";
  remote?: boolean;
  error?: string;
};

export type ShellUi = {
  updatePanel: (info: {
    peerId: string;
    connected: boolean;
    gameTitle: string;
    readySelf: boolean;
    readyPeer: boolean;
    started: boolean;
    myColor: PlayerId | null;
    currentTurn: number;
    currentPlayer: PlayerId;
    hasCache: boolean;
  }) => void;
  log?: (message: string) => void;
  promptUndo?: () => Promise<boolean>;
  promptRestart?: () => Promise<boolean>;
  promptRejoinChoice?: () => Promise<"rejoin" | "restart">;
  promptRejoinApprove?: () => Promise<boolean>;
  showStart?: () => void;
  showWinner?: (winner: WinnerId) => void;
  showNotice?: (message: string) => void;
  updateVoiceState?: (state: VoiceUiState) => void;
  setVoiceStream?: (stream: MediaStream | null) => void;
};
