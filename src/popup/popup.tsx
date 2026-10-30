import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  CAMERA,
  INITIAL_STATE,
  PERMISSION_PAGE,
  STATE_KEY,
  type Command,
  type CommandResult,
  type Mode,
  type ScroominState,
} from "../lib/messages";
import "./popup.css";

type Theme = "light" | "dark" | "system";
type ViewState = "off" | "starting" | "attending" | "away" | "multiple" | "error" | "manual";

const STATE_LABELS: Record<ViewState, string> = {
  off: "Off",
  starting: "Starting",
  attending: "Attending",
  away: "Away",
  multiple: "Multiple faces",
  error: "Camera error",
  manual: "Manual",
};

const MODE_HINTS: Record<Mode, string> = {
  camera: "Covers the tab when you look away or someone else appears.",
  manual: "Covers the tab until you turn protection off.",
};

const POLICY_ITEMS: Array<[string, string]> = [
  ["No data collection.", "We do not collect, store, or transmit any personal data."],
  ["No camera recordings.", "Camera frames are processed locally in your browser and never saved or uploaded."],
  ["No face data stored.", "Face landmarks are computed in real-time and discarded immediately after each frame."],
  ["Local-first.", "All detection runs on your device using MediaPipe. Nothing leaves your machine."],
  ["Permission-based.", 'Camera access is only requested when you explicitly enable "Auto" mode.'],
  ["Open source.", "This extension is transparent about its operations."],
];

/* ---------- Camera permission ---------- */

type CameraPermission = "granted" | "prompt" | "denied";

/** Reads the camera permission for this extension's origin without triggering a prompt. */
async function getCameraPermission(): Promise<CameraPermission> {
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return "prompt";
  }
}

/* ---------- Icons ---------- */

const ICONS = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  system: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  camera: (
    <>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  manual: (
    <>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <circle cx="16" cy="12" r="2.5" />
    </>
  ),
  chevron: <polyline points="6 9 12 15 18 9" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
} satisfies Record<string, ReactNode>;

function Icon({ name, size = 16, className }: { name: keyof typeof ICONS; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ---------- Viewfinder glyph ---------- */

const LANDMARKS: Array<[number, number]> = [
  [48, 24], [38, 35], [58, 35], [41, 43], [55, 43], [48, 51],
  [35, 53], [61, 53], [41, 61], [48, 64], [55, 61], [48, 73],
];

function Glyph({ state }: { state: ViewState }) {
  let body: ReactNode;

  switch (state) {
    case "attending":
      body = (
        <>
          <ellipse cx="48" cy="48" rx="19" ry="25" />
          <g fill="currentColor" stroke="none">
            {LANDMARKS.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />
            ))}
          </g>
        </>
      );
      break;
    case "multiple":
      body = (
        <>
          <ellipse cx="36" cy="51" rx="14" ry="19" />
          <ellipse cx="60" cy="46" rx="14" ry="19" />
          <g fill="currentColor" stroke="none">
            <circle cx="31" cy="47" r="1.6" />
            <circle cx="41" cy="47" r="1.6" />
            <circle cx="36" cy="59" r="1.6" />
            <circle cx="55" cy="42" r="1.6" />
            <circle cx="65" cy="42" r="1.6" />
            <circle cx="60" cy="54" r="1.6" />
          </g>
        </>
      );
      break;
    case "away":
      body = (
        <>
          <ellipse cx="48" cy="48" rx="19" ry="25" strokeDasharray="3 4" />
          <rect x="25" y="43" width="46" height="10" rx="2" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "manual":
      body = (
        <>
          <rect x="30" y="44" width="36" height="28" rx="5" />
          <path d="M38 44v-8a10 10 0 0 1 20 0v8" />
          <circle cx="48" cy="57" r="3" fill="currentColor" stroke="none" />
          <path d="M48 60v5" />
        </>
      );
      break;
    case "error":
      body = (
        <>
          <ellipse cx="48" cy="48" rx="19" ry="25" strokeDasharray="3 4" />
          <path d="M48 36v14" />
          <circle cx="48" cy="59" r="1.8" fill="currentColor" stroke="none" />
        </>
      );
      break;
    default:
      // off, starting
      body = <ellipse cx="48" cy="48" rx="19" ry="25" strokeDasharray="3 4" />;
  }

  return (
    <svg
      className="vf-glyph"
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M48 6v8M48 82v8M6 48h8M82 48h8" opacity="0.45" />
      {body}
    </svg>
  );
}

/* ---------- Popup ---------- */

function describeState(state: ScroominState): string {
  if (state.error) {
    return state.enabled
      ? "Camera lost. The screen stays covered until you turn protection off."
      : "Couldn't start the camera.";
  }

  if (!state.enabled) return "Protection is off.";
  if (state.mode === "manual") return "Manual protection: screen covered.";

  switch (state.attention) {
    case "attending":
      return "Face detected: protection is off.";
    case "away":
      return "Screen protected: no face detected.";
    case "multiple-faces":
      return "Screen protected: multiple faces detected.";
    default:
      return "Looking for a face...";
  }
}

async function sendCommand(command: Command): Promise<CommandResult | null> {
  try {
    const result = (await chrome.runtime.sendMessage(command)) as CommandResult | undefined;
    return result ?? null;
  } catch (error) {
    console.error("Scroomin: background did not respond:", error);
    return null;
  }
}

function Popup() {
  // The camera, face detection and protection state live in the background service worker
  // (and its offscreen document), so they keep running after this popup closes.
  // This component only displays that state and sends commands.
  const [state, setState] = useState<ScroominState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");

  const { enabled: protectionEnabled, mode } = state;
  const isCameraMode = protectionEnabled && mode === "camera";
  const isManualMode = protectionEnabled && mode === "manual";
  const cameraLive = isCameraMode && !state.error;

  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", newTheme);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("scroomin-theme") as Theme | null;
    const initialTheme = stored ?? "system";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, [applyTheme]);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("scroomin-theme", newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  const cycleTheme = () => {
    const themes: Theme[] = ["light", "dark", "system"];
    handleThemeChange(themes[(themes.indexOf(theme) + 1) % themes.length]);
  };

  // Load the current state, then follow every change the background makes.
  useEffect(() => {
    let mounted = true;

    chrome.storage.session.get(STATE_KEY).then((items) => {
      const stored = items[STATE_KEY] as ScroominState | undefined;
      if (mounted && stored) setState(stored);
    });

    const handleChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      const next = changes[STATE_KEY]?.newValue as ScroominState | undefined;
      if (area === "session" && next) setState(next);
    };

    chrome.storage.onChanged.addListener(handleChanged);

    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(handleChanged);
    };
  }, []);

  /**
   * Chrome does not show the camera prompt for getUserMedia() called from an action popup
   * or an offscreen document; the call is rejected. The prompt only appears in a full tab,
   * so we ask from permission.html. Permission is stored per extension origin, so once it is
   * granted there, the offscreen document can use the camera without any prompt.
   */
  const ensureCameraPermission = async (): Promise<boolean> => {
    const permission = await getCameraPermission();
    if (permission === "granted") return true;

    setShowPermissionGuide(true);

    if (permission === "denied") {
      setNotice("Camera is blocked for Scroomin. Allow it in Chrome site settings.");
    } else {
      setNotice("Camera access needed. Allow it in the tab that just opened.");
      void chrome.tabs.create({ url: chrome.runtime.getURL(PERMISSION_PAGE) });
    }

    return false;
  };

  const startProtection = async (nextMode: Mode) => {
    setLoading(true);
    setNotice(null);
    setShowPermissionGuide(false);

    try {
      if (nextMode === "camera" && !(await ensureCameraPermission())) return;

      const result = await sendCommand({ type: "SCROOMIN_START", mode: nextMode });

      if (!result) {
        setNotice("Scroomin's background service did not respond. Try reloading the extension.");
        return;
      }

      setState(result.state);

      if (!result.ok && (result.error.name === "NotAllowedError" || result.error.name === "SecurityError")) {
        setShowPermissionGuide(true);
        setNotice("Camera permission denied. Please allow camera access.");
      }
    } finally {
      setLoading(false);
    }
  };

  const stopProtection = async () => {
    setLoading(true);
    setNotice(null);
    setShowPermissionGuide(false);

    try {
      const result = await sendCommand({ type: "SCROOMIN_STOP" });
      if (result) setState(result.state);
    } finally {
      setLoading(false);
    }
  };

  const handleProtectionToggle = (enabled: boolean) =>
    enabled ? startProtection(mode) : stopProtection();

  const handleModeChange = async (newMode: Mode) => {
    if (newMode === mode) return;
    await startProtection(newMode);
  };

  const handlePermissionGuideAction = async () => {
    const permission = await getCameraPermission();

    if (permission === "granted") {
      await startProtection("camera");
    } else if (permission === "denied") {
      // A blocked permission cannot be re-prompted; the user must unblock it in site settings.
      const origin = new URL(chrome.runtime.getURL("")).origin;
      void chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}` });
    } else {
      void chrome.tabs.create({ url: chrome.runtime.getURL(PERMISSION_PAGE) });
    }
  };

  const statusMessage = notice ?? describeState(state);

  // Single value that drives the viewfinder (glyph, color, label, scan line).
  const viewState: ViewState = loading
    ? "starting"
    : state.error
      ? "error"
      : !protectionEnabled
        ? "off"
        : isManualMode
          ? "manual"
          : state.attention === "attending"
            ? "attending"
            : state.attention === "away"
              ? "away"
              : state.attention === "multiple-faces"
                ? "multiple"
                : "starting";

  const themeIcon = theme === "light" ? "sun" : theme === "dark" ? "moon" : "system";
  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <div className="popup">
      <header className="top">
        <div className="brand">
          <img src="/icons/logo-scroomin-no-text.png" alt="" className="brand-logo" aria-hidden="true" />
          <div>
            <h1>Scroomin</h1>
            <p>Privacy, by design.</p>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={cycleTheme}
          aria-label={`Theme: ${themeLabel}. Click to change.`}
          title={`Theme: ${themeLabel}`}
        >
          <Icon name={themeIcon} />
        </button>
      </header>

      <main>
        <section className="vf" data-state={viewState} aria-label="Protection status">
          <div className="vf-stage">
            <span className="vf-corner tl" aria-hidden="true" />
            <span className="vf-corner tr" aria-hidden="true" />
            <span className="vf-corner bl" aria-hidden="true" />
            <span className="vf-corner br" aria-hidden="true" />
            <Glyph state={viewState} />
            <span className="vf-scan" aria-hidden="true" />
          </div>

          <div className="vf-readout" role={viewState === "error" ? "alert" : "status"}>
            <div className="vf-head">
              <span className="vf-state">{STATE_LABELS[viewState]}</span>
              {cameraLive && (
                <span className="vf-live">
                  <span className="vf-live-dot" aria-hidden="true" />
                  Camera on
                </span>
              )}
            </div>
            <p className="vf-message">{statusMessage}</p>
          </div>

          <dl className="vf-meta">
            <div>
              <dt>Feed</dt>
              <dd>{cameraLive ? `${CAMERA.width}×${CAMERA.height}, ${CAMERA.frameRate} fps` : "Not in use"}</dd>
            </div>
            <div>
              <dt>Processing</dt>
              <dd>On-device</dd>
            </div>
          </dl>
        </section>

        <button
          type="button"
          role="switch"
          aria-checked={protectionEnabled}
          className="master"
          onClick={() => handleProtectionToggle(!protectionEnabled)}
          disabled={loading}
        >
          <span className="master-icon">
            <Icon name="shield" size={18} />
          </span>
          <span className="master-text">
            <strong>Protection</strong>
            <span>{protectionEnabled ? "Active" : "Covers the tab when you look away"}</span>
          </span>
          <span className="switch" aria-hidden="true" />
        </button>

        {showPermissionGuide && (
          <div className="notice guide" role="alert">
            <Icon name="camera" size={18} />
            <div>
              <strong>Camera access needed</strong>
              <p>Scroomin opens a tab to ask for camera access. Click "Allow" there, then reopen this popup and turn Protection on.</p>
              <button type="button" className="notice-btn" onClick={handlePermissionGuideAction}>
                Set up camera access
              </button>
            </div>
          </div>
        )}

        {state.error && !showPermissionGuide && (
          <div className="notice error" role="alert">
            <Icon name="alert" size={18} />
            <div>
              <strong>{protectionEnabled ? "The camera stopped working" : "Couldn't start the camera"}</strong>
              <p>
                {protectionEnabled
                  ? "The screen stays covered. Turn protection off and on again to retry."
                  : "Check the camera permission and that the model files are bundled."}
              </p>
              <code>
                {state.error.name}: {state.error.message}
              </code>
            </div>
          </div>
        )}

        {protectionEnabled && (
          <div className="mode">
            <div className="segmented" role="radiogroup" aria-label="Protection mode">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "camera"}
                className="segment"
                onClick={() => handleModeChange("camera")}
                disabled={loading}
              >
                <Icon name="camera" />
                <span>Auto</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "manual"}
                className="segment"
                onClick={() => handleModeChange("manual")}
                disabled={loading}
              >
                <Icon name="manual" />
                <span>Manual</span>
              </button>
            </div>
            <p className="mode-hint">{MODE_HINTS[mode]}</p>
          </div>
        )}

        <details className="policy">
          <summary>
            <Icon name="lock" />
            <span>Privacy policy</span>
            <Icon name="chevron" className="chev" />
          </summary>
          <ul className="policy-body">
            {POLICY_ITEMS.map(([lead, text]) => (
              <li key={lead}>
                <strong>{lead}</strong> {text}
              </li>
            ))}
          </ul>
        </details>
      </main>

    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);