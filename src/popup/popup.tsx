import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { startAttentionMonitor, type AttentionState } from "../lib/attention";
import { setActiveTabProtection, getActiveTabProtection } from "../lib/protection";
import "./popup.css";

type Mode = "camera" | "manual";
type Theme = "light" | "dark" | "system";
type ViewState = "off" | "starting" | "attending" | "away" | "multiple" | "error" | "manual";

/** One source of truth: used for the camera config and for the readout in the UI. */
const CAMERA = { facingMode: "user", width: 640, height: 480, frameRate: 15 } as const;

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

function Popup() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopMonitorRef = useRef<(() => void) | null>(null);

  const [protectionEnabled, setProtectionEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("camera");
  const [attentionState, setAttentionState] = useState<AttentionState>("idle");
  const [statusMessage, setStatusMessage] = useState("Protection is off.");
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");

  const isCameraMode = protectionEnabled && mode === "camera";
  const isManualMode = protectionEnabled && mode === "manual";

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

  useEffect(() => {
    let mounted = true;

    const checkProtectionState = async () => {
      const isProtected = await getActiveTabProtection();
      if (mounted) {
        setProtectionEnabled(isProtected);
        if (isProtected) {
          setStatusMessage("Manual protection: screen covered.");
        }
      }
    };

    checkProtectionState();

    return () => {
      mounted = false;
    };
  }, []);

  const applyProtection = useCallback(async (forceState?: boolean) => {
    if (!protectionEnabled) return;

    const shouldProtect = isCameraMode
      ? attentionState === "away" || attentionState === "multiple-faces"
      : forceState ?? true;

    const success = await setActiveTabProtection(shouldProtect);

    if (!success) {
      setStatusMessage("Could not update this tab. Try refreshing the webpage.");
    } else if (isCameraMode) {
      if (attentionState === "multiple-faces") {
        setStatusMessage("Screen protected: multiple faces detected.");
      } else {
        setStatusMessage(
          shouldProtect ? "Screen protected: no face detected." : "Face detected: protection is off."
        );
      }
    } else {
      setStatusMessage(shouldProtect ? "Manual protection: screen covered." : "Manual protection: screen visible.");
    }
  }, [protectionEnabled, isCameraMode, isManualMode, attentionState]);

  useEffect(() => {
    void applyProtection();
  }, [applyProtection]);

  useEffect(() => {
    if (!isCameraMode) return;

    const handleTabActivated = () => {
      void applyProtection();
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [isCameraMode, applyProtection]);

  const startCameraMonitoring = async () => {
    const video = videoRef.current;

    if (!video || isCameraMode) return;

    setLoading(true);
    setCameraError(null);
    setShowPermissionGuide(false);
    setStatusMessage("Requesting camera access...");

    try {
      const stop = await startAttentionMonitor(
        video,
        (nextState) => {
          setAttentionState(nextState);
        },
        {
          modelAssetPath: chrome.runtime.getURL("models/face_landmarker.task"),
          wasmPath: chrome.runtime.getURL("wasm"),
          ...CAMERA,
        }
      );

      stopMonitorRef.current = stop;
      setMode("camera");
      setProtectionEnabled(true);
      setStatusMessage("Camera monitoring started.");
    } catch (error) {
      console.error("Scroomin camera error:", error);
      setProtectionEnabled(false);
      setAttentionState("error");
      const msg = error instanceof Error ? error.message : "Unknown error";
      setCameraError(msg);

      if (msg.includes("Permission") || msg.includes("denied") || msg.includes("dismissed")) {
        setShowPermissionGuide(true);
        setStatusMessage("Camera permission denied. Please allow camera access.");
      } else {
        // The raw message is shown in the error notice below, not repeated here.
        setStatusMessage("Couldn't start the camera.");
      }
    } finally {
      setLoading(false);
    }
  };

  const stopCameraMonitoring = async () => {
    stopMonitorRef.current?.();
    stopMonitorRef.current = null;

    setProtectionEnabled(false);
    setAttentionState("idle");
    setStatusMessage("Protection is off.");

    const success = await setActiveTabProtection(false);

    if (!success) {
      setStatusMessage("Stopped, but this tab could not be updated.");
    }
  };

  const handleProtectionToggle = async (enabled: boolean) => {
    if (enabled) {
      if (mode === "camera") {
        await startCameraMonitoring();
      } else {
        setProtectionEnabled(true);
        setStatusMessage("Manual protection enabled.");
        await applyProtection(true);
      }
    } else {
      if (isCameraMode) {
        await stopCameraMonitoring();
      } else {
        setProtectionEnabled(false);
        setStatusMessage("Protection is off.");
        await applyProtection(false);
      }
    }
  };

  const handleModeChange = async (newMode: Mode) => {
    if (newMode === mode) return;

    if (mode === "camera") {
      await stopCameraMonitoring();
    } else {
      await applyProtection(false);
    }

    setMode(newMode);

    if (newMode === "camera") {
      await startCameraMonitoring();
    } else {
      setProtectionEnabled(true);
      setStatusMessage("Manual protection enabled.");
      await applyProtection(true);
    }
  };

  const handlePermissionGuideAction = () => {
    setShowPermissionGuide(false);
    startCameraMonitoring();
  };

  // Single value that drives the viewfinder (glyph, color, label, scan line).
  const viewState: ViewState = loading
    ? "starting"
    : attentionState === "error" && !protectionEnabled
      ? "error"
      : !protectionEnabled
        ? "off"
        : isManualMode
          ? "manual"
          : attentionState === "attending"
            ? "attending"
            : attentionState === "away"
              ? "away"
              : attentionState === "multiple-faces"
                ? "multiple"
                : "starting";

  const themeIcon = theme === "light" ? "sun" : theme === "dark" ? "moon" : "system";
  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <div className="popup">
      <header className="top">
        <div className="brand">
          <img src="/icons/logo_scroomin.png" alt="" className="brand-logo" aria-hidden="true" />
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
              {isCameraMode && (
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
              <dd>{isCameraMode ? `${CAMERA.width}×${CAMERA.height}, ${CAMERA.frameRate} fps` : "Not in use"}</dd>
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
              <p>Click "Allow" in the browser prompt at the top-left to enable face detection.</p>
              <button type="button" className="notice-btn" onClick={handlePermissionGuideAction}>
                Try again
              </button>
            </div>
          </div>
        )}

        {cameraError && !showPermissionGuide && (
          <div className="notice error" role="alert">
            <Icon name="alert" size={18} />
            <div>
              <strong>Couldn't start the camera</strong>
              <p>Check the camera permission and that the model files are bundled.</p>
              <code>{cameraError}</code>
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

      <video ref={videoRef} muted playsInline className="camera-preview" />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);