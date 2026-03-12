import type { NetAdapter } from "../net";
import type { ShellUi, VoiceUiState } from "../../ui/types";
import type { Logger } from "../../utils";

const isStreamLive = (stream: MediaStream | null) =>
  !!stream && stream.getTracks().some((track) => track.readyState === "live");

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Microphone unavailable";
};

export type VoiceControl = {
  toggle: () => Promise<void>;
  stop: () => void;
};

export const createVoiceControl = (deps: {
  net: NetAdapter;
  ui: ShellUi;
  logger: Logger;
}): VoiceControl => {
  const { net, ui, logger } = deps;
  let status: VoiceUiState["status"] = "idle";
  let localStream: MediaStream | null = null;
  let remoteActive = false;
  let lastError: string | undefined;

  const pushUiState = () => {
    ui.updateVoiceState?.({ status, remote: remoteActive, error: lastError });
  };

  const releaseLocalStream = () => {
    if (!localStream) {
      return;
    }
    for (const track of localStream.getTracks()) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
    localStream = null;
  };

  const setStatus = (next: VoiceUiState["status"], error?: string) => {
    status = next;
    lastError = error;
    pushUiState();
  };

  const ensureMediaStream = async () => {
    if (isStreamLive(localStream)) {
      return localStream as MediaStream;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Media devices API unavailable");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    releaseLocalStream();
    localStream = stream;
    return stream;
  };

  const start = async () => {
    if (status === "starting") {
      return;
    }
    setStatus("starting");
    try {
      const stream = await ensureMediaStream();
      net.startMedia(stream);
      setStatus("active");
      logger.info("[voice] enabled");
    } catch (error) {
      const message = formatError(error);
      logger.warn("[voice] start failed", error);
      setStatus("error", message);
      ui.showNotice?.(message);
    }
  };

  const stop = () => {
    if (status === "idle") {
      return;
    }
    net.stopMedia();
    releaseLocalStream();
    setStatus("idle");
    logger.info("[voice] disabled");
  };

  const toggle = async () => {
    if (status === "active") {
      stop();
      return;
    }
    await start();
  };

  net.onRemoteStream((stream) => {
    remoteActive = isStreamLive(stream);
    ui.setVoiceStream?.(stream);
    pushUiState();
  });

  pushUiState();
  ui.setVoiceStream?.(null);

  return {
    toggle,
    stop: () => {
      stop();
      remoteActive = false;
      ui.setVoiceStream?.(null);
      pushUiState();
    },
  };
};
