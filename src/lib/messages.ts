import type { AttentionState } from "./attention";

export type { AttentionState };

export type Mode = "camera" | "manual";

export interface ErrorInfo {
  name: string;
  message: string;
}

/**
 * Single source of truth for protection. Owned by the background service worker,
 * persisted in chrome.storage.session, and only displayed by the popup.
 */
export interface ScroominState {
  enabled: boolean;
  mode: Mode;
  attention: AttentionState;
  /** Set when the camera could not start, or was lost while protection was on. */
  error: ErrorInfo | null;
}

export const INITIAL_STATE: ScroominState = {
  enabled: false,
  mode: "camera",
  attention: "idle",
  error: null,
};

export const STATE_KEY = "scroomin:state";

/** Paths are relative to the built extension root (same layout as popup.html in the manifest). */
export const OFFSCREEN_PAGE = "src/offscreen/offscreen.html";
export const PERMISSION_PAGE = "src/permission/permission.html";

/** Used for the camera config and for the readout in the popup. */
export const CAMERA = { facingMode: "user", width: 640, height: 480, frameRate: 15 } as const;

/**
 * Whether visible tabs should be covered right now.
 * Fails closed: if the camera is lost while protection is on ("error"), the screen stays covered.
 */
export function shouldCover(state: ScroominState): boolean {
  if (!state.enabled) return false;
  if (state.mode === "manual") return true;
  return (
    state.attention === "away" ||
    state.attention === "multiple-faces" ||
    state.attention === "error"
  );
}

export function toErrorInfo(error: unknown): ErrorInfo {
  const e = error as { name?: unknown; message?: unknown } | null;
  return {
    name: typeof e?.name === "string" ? e.name : "Error",
    message: typeof e?.message === "string" ? e.message : String(error),
  };
}

/* ---------- Messages ---------- */

/** popup -> background */
export type Command =
  | { type: "SCROOMIN_START"; mode: Mode }
  | { type: "SCROOMIN_STOP" };

export type CommandResult =
  | { ok: true; state: ScroominState }
  | { ok: false; error: ErrorInfo; state: ScroominState };

/** background -> offscreen document */
export type OffscreenCommand = {
  target: "offscreen";
  type: "SCROOMIN_OFFSCREEN_START" | "SCROOMIN_OFFSCREEN_STOP";
};

export type OffscreenResult = { ok: true } | { ok: false; error: ErrorInfo };

/** offscreen document -> background */
export type AttentionReport = {
  target: "background";
  type: "SCROOMIN_ATTENTION";
  state: AttentionState;
};

/** content script -> background (asked once when a page loads) */
export type CoverQuery = { type: "SCROOMIN_QUERY_COVER" };
export type CoverResponse = { covered: boolean };