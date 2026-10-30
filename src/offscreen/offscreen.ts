import { startAttentionMonitor } from "../lib/attention";
import {
  CAMERA,
  toErrorInfo,
  type AttentionReport,
  type OffscreenCommand,
  type OffscreenResult,
} from "../lib/messages";

const video = document.getElementById("camera") as HTMLVideoElement;

let stopMonitor: (() => void) | null = null;

async function start(): Promise<OffscreenResult> {
  if (stopMonitor) return { ok: true };

  // The monitor publishes "error" while a failed start is being thrown. The caller gets the
  // thrown error instead, so state reports are ignored until the monitor is actually running.
  let running = false;

  try {
    const stop = await startAttentionMonitor(
      video,
      (state) => {
        if (!running) return;

        const report: AttentionReport = { target: "background", type: "SCROOMIN_ATTENTION", state };
        void chrome.runtime.sendMessage(report).catch(() => undefined);
      },
      {
        modelAssetPath: chrome.runtime.getURL("models/face_landmarker.task"),
        wasmPath: chrome.runtime.getURL("wasm"),
        ...CAMERA,
      }
    );

    stopMonitor = stop;
    running = true;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toErrorInfo(error) };
  }
}

function stop(): void {
  stopMonitor?.();
  stopMonitor = null;
}

chrome.runtime.onMessage.addListener((message: OffscreenCommand, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return false;

  if (message.type === "SCROOMIN_OFFSCREEN_START") {
    void start().then(sendResponse);
    return true;
  }

  if (message.type === "SCROOMIN_OFFSCREEN_STOP") {
    stop();
    sendResponse({ ok: true } satisfies OffscreenResult);
  }

  return false;
});