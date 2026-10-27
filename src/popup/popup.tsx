import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { startAttentionMonitor, type AttentionState } from "../lib/attention";
import { setActiveTabProtection } from "../lib/protection";
import "./popup.css";

type Mode = "camera" | "manual";

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
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const isCameraMode = protectionEnabled && mode === "camera";
  const isManualMode = protectionEnabled && mode === "manual";

  const applyProtection = useCallback(async (forceState?: boolean) => {
    if (!protectionEnabled) return;

    const shouldProtect = isCameraMode
      ? attentionState === "away"
      : forceState ?? true;

    const success = await setActiveTabProtection(shouldProtect);

    if (!success) {
      setStatusMessage("Could not update this tab. Try refreshing the webpage.");
    } else if (isCameraMode) {
      setStatusMessage(
        shouldProtect ? "Screen protected: no face detected." : "Face detected: protection is off."
      );
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
      const stop = await startAttentionMonitor(video, (nextState) => {
        setAttentionState(nextState);
      });

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
        setStatusMessage(`Unable to start camera: ${msg}. Check permission and model files.`);
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

  const statusColors = {
    idle: "#6b7280",
    attending: "#22c55e",
    away: "#ef4444",
    error: "#f59e0b",
  };

  const statusLabels: Record<AttentionState, string> = {
    idle: "Idle",
    attending: "Attending",
    away: "Away",
    error: "Error",
  };

  return (
    <div className="popup">
      <header>
        <div className="brand">
          <span className="brand-dot" aria-hidden="true"></span>
          <div className="brand-text">
            <h1>Scroomin</h1>
            <p>Privacy, by design.</p>
          </div>
        </div>
      </header>

      <main>
        <section className="master-toggle-section">
          <label className="master-toggle">
            <div className="master-toggle-info">
              <span className="master-toggle-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </span>
              <div>
                <strong>Protection</strong>
                <span>{protectionEnabled ? "Active" : "Off"}</span>
              </div>
            </div>
            <button
              className={`toggle-switch ${protectionEnabled ? "on" : ""}`}
              onClick={() => handleProtectionToggle(!protectionEnabled)}
              disabled={loading}
              aria-pressed={protectionEnabled}
              aria-label={protectionEnabled ? "Disable protection" : "Enable protection"}
            >
              <span className="toggle-thumb" aria-hidden="true"></span>
              <span className="toggle-track" aria-hidden="true"></span>
            </button>
          </label>
        </section>

        {protectionEnabled && (
          <section className="mode-section">
            <div className="mode-label">Mode</div>
            <div className="segmented-control" role="radiogroup" aria-label="Protection mode">
              <button
                role="radio"
                aria-checked={mode === "camera"}
                className={`segment ${mode === "camera" ? "active" : ""}`}
                onClick={() => handleModeChange("camera")}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="12" r="4"></circle>
                </svg>
                <span>Auto (Camera)</span>
              </button>
              <button
                role="radio"
                aria-checked={mode === "manual"}
                className={`segment ${mode === "manual" ? "active" : ""}`}
                onClick={() => handleModeChange("manual")}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M8 21h8M12 17v4"></path>
                </svg>
                <span>Manual</span>
              </button>
            </div>

            {isCameraMode && (
              <div className="mode-status-indicator">
                <span className="status-dot" style={{ background: statusColors[attentionState] }} aria-hidden="true"></span>
                <span>{statusLabels[attentionState]}</span>
              </div>
            )}

            {isManualMode && (
              <div className="mode-status-indicator manual">
                <span className="status-dot" style={{ background: "#22c55e" }} aria-hidden="true"></span>
                <span>Manual Active</span>
              </div>
            )}

            {showPermissionGuide && (
              <div className="permission-guide" role="alert">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <div className="permission-guide-content">
                  <strong>Camera access needed</strong>
                  <p>Click "Allow" in the browser prompt at the top-left to enable face detection.</p>
                </div>
                <button className="permission-guide-btn" onClick={handlePermissionGuideAction}>
                  Try Again
                </button>
              </div>
            )}

            {cameraError && !showPermissionGuide && (
              <div className="error-message" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Camera error: {cameraError}</span>
              </div>
            )}

            {loading && <div className="loading" aria-live="polite">Starting…</div>}
          </section>
        )}

        <section className="status-section">
          <div className="status-row">
            <span className="status-label">Status</span>
            <span className={`status-value ${protectionEnabled ? "active" : ""}`}>
              {!protectionEnabled ? "Off" : isCameraMode ? statusLabels[attentionState] : "Manual Active"}
            </span>
          </div>
          <p className="status-message">{statusMessage}</p>
        </section>

        <details className="privacy-policy" open={showPrivacyPolicy}>
          <summary onClick={() => setShowPrivacyPolicy(!showPrivacyPolicy)}>
            <span>Privacy Policy</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </summary>
          <div className="privacy-policy-content">
            <h4>Your Privacy, Our Priority</h4>
            <ul>
              <li><strong>No data collection:</strong> We do not collect, store, or transmit any personal data.</li>
              <li><strong>No camera recordings:</strong> Camera frames are processed locally in your browser and never saved or uploaded.</li>
              <li><strong>No face data stored:</strong> Face landmarks are computed in real-time and discarded immediately after each frame.</li>
              <li><strong>Local-first:</strong> All detection runs on your device using MediaPipe. Nothing leaves your machine.</li>
              <li><strong>Permission-based:</strong> Camera access is only requested when you explicitly enable "Auto (Camera)" mode.</li>
              <li><strong>Open source:</strong> This extension is transparent about its operations.</li>
            </ul>
            <p className="privacy-footer">Scroomin respects your privacy. Period.</p>
          </div>
        </details>
      </main>

      <footer>
        Local-first privacy · Camera detection running locally
      </footer>

      <video ref={videoRef} muted playsInline className="camera-preview" />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);