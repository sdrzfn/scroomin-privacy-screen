import { applyCoverToTab, applyCoverToVisibleTabs } from "./lib/protection";
import {
  INITIAL_STATE,
  OFFSCREEN_PAGE,
  STATE_KEY,
  shouldCover,
  toErrorInfo,
  type AttentionReport,
  type Command,
  type CommandResult,
  type CoverQuery,
  type CoverResponse,
  type Mode,
  type OffscreenCommand,
  type OffscreenResult,
  type ScroominState,
} from "./lib/messages";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Scroomin Browser installed");
});

// --- INI DIGUNAKAN UNTUK SIDEPANEL ---
// chrome.sidePanel.setPanelBehavior({
//   openPanelOnActionClick: true,
// });

/* ---------- Serialized work ---------- */

// Commands, attention reports and tab events all read-modify-write the same state,
// so they run one at a time.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/* ---------- State ---------- */

// Kept in storage.session so it survives the service worker being stopped.
// It is cleared when the browser closes, so the camera never restarts by itself.
async function getState(): Promise<ScroominState> {
  const items = await chrome.storage.session.get(STATE_KEY);
  return { ...INITIAL_STATE, ...(items[STATE_KEY] as Partial<ScroominState> | undefined) };
}

async function setState(patch: Partial<ScroominState>): Promise<ScroominState> {
  const previous = await getState();
  const next: ScroominState = { ...previous, ...patch };

  await chrome.storage.session.set({ [STATE_KEY]: next });

  const covered = shouldCover(next);
  if (covered !== shouldCover(previous)) {
    await applyCoverToVisibleTabs(covered);
  }

  return next;
}

/* ---------- Offscreen document ---------- */

let creatingOffscreen: Promise<void> | null = null;

async function hasOffscreen(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreen()) return;

  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_PAGE,
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: "Run on-device face detection on the camera feed while the popup is closed.",
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }

  await creatingOffscreen;
}

async function startCamera(): Promise<OffscreenResult> {
  try {
    await ensureOffscreen();

    const command: OffscreenCommand = { target: "offscreen", type: "SCROOMIN_OFFSCREEN_START" };
    const result = (await chrome.runtime.sendMessage(command)) as OffscreenResult | undefined;

    return (
      result ?? {
        ok: false,
        error: { name: "OffscreenUnavailable", message: "The camera worker did not respond." },
      }
    );
  } catch (error) {
    return { ok: false, error: toErrorInfo(error) };
  }
}

async function stopCamera(): Promise<void> {
  try {
    if (!(await hasOffscreen())) return;

    const command: OffscreenCommand = { target: "offscreen", type: "SCROOMIN_OFFSCREEN_STOP" };
    await chrome.runtime.sendMessage(command).catch(() => undefined);
    await chrome.offscreen.closeDocument();
  } catch (error) {
    console.warn("Scroomin: could not close the camera worker:", error);
  }
}

/* ---------- Handlers ---------- */

async function handleStart(mode: Mode): Promise<CommandResult> {
  if (mode === "manual") {
    await stopCamera();
    const state = await setState({ enabled: true, mode, attention: "idle", error: null });
    return { ok: true, state };
  }

  // Camera mode: enabled while starting, but nothing is covered until a face state arrives.
  await setState({ enabled: true, mode, attention: "idle", error: null });

  const result = await startCamera();

  if (result.ok) {
    return { ok: true, state: await getState() };
  }

  await stopCamera();
  const state = await setState({ enabled: false, mode, attention: "idle", error: result.error });
  return { ok: false, error: result.error, state };
}

async function handleStop(): Promise<CommandResult> {
  await stopCamera();
  const state = await setState({ enabled: false, attention: "idle", error: null });
  return { ok: true, state };
}

async function handleAttention(report: AttentionReport): Promise<void> {
  const state = await getState();
  if (!state.enabled || state.mode !== "camera") return;

  if (report.state === "error") {
    // The camera stopped working mid-session. Stay enabled so the screen stays covered.
    await setState({
      attention: "error",
      error: { name: "CameraLost", message: "The camera stopped or face detection failed." },
    });
    return;
  }

  await setState({ attention: report.state });
}

/* ---------- Messages ---------- */

function isExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && !!sender.url?.startsWith(chrome.runtime.getURL(""));
}

chrome.runtime.onMessage.addListener(
  (message: Command | AttentionReport | CoverQuery, sender, sendResponse) => {
    switch (message?.type) {
      case "SCROOMIN_START":
        if (!isExtensionPage(sender)) return false;
        void enqueue(() => handleStart(message.mode)).then(sendResponse);
        return true;

      case "SCROOMIN_STOP":
        if (!isExtensionPage(sender)) return false;
        void enqueue(handleStop).then(sendResponse);
        return true;

      case "SCROOMIN_ATTENTION":
        if (!isExtensionPage(sender)) return false;
        void enqueue(() => handleAttention(message));
        return false;

      case "SCROOMIN_QUERY_COVER":
        // Sent by content scripts when a page loads.
        void getState().then((state) => {
          const response: CoverResponse = { covered: shouldCover(state) };
          sendResponse(response);
        });
        return true;

      default:
        return false;
    }
  }
);

// A tab that became visible may be out of date: it could have been covered earlier
// while it was in the background, or opened while protection was off.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void enqueue(async () => {
    const state = await getState();
    await applyCoverToTab(tabId, shouldCover(state));
  });
});