import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { startAttentionMonitor, type AttentionState } from "../lib/attention";
import { setActiveTabProtection } from "../lib/protection";
import "./popup.css";

function Popup() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopMonitorRef = useRef<(() => void) | null>(null);

  const [monitoring, setMonitoring] = useState(false);
  const [attentionState, setAttentionState] = useState<AttentionState>("idle");
  const [statusMessage, setStatusMessage] = useState("Monitoring is off.");
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  const applyProtection = useCallback(async () => {
    if (!monitoring) return;

    const shouldProtect = attentionState === "away";
    const success = await setActiveTabProtection(shouldProtect);

    if (!success) {
      setStatusMessage("Could not update this tab. Try refreshing the webpage.");
    } else {
      setStatusMessage(
        shouldProtect ? "Screen protected: no face detected." : "Face detected: protection is off."
      );
    }
  }, [monitoring, attentionState]);

  useEffect(() => {
    void applyProtection();
  }, [applyProtection]);

  useEffect(() => {
    if (!monitoring) return;

    const handleTabActivated = () => {
      void applyProtection();
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [monitoring, applyProtection]);

  const startMonitoring = async () => {
    const video = videoRef.current;

    if (!video || monitoring) return;

    setLoading(true);
    setCameraError(null);
    setShowPermissionGuide(false);
    setStatusMessage("Requesting camera access...");

    try {
      const stop = await startAttentionMonitor(video, (nextState) => {
        setAttentionState(nextState);
      });

      stopMonitorRef.current = stop;
      setMonitoring(true);
      setStatusMessage("Monitoring is running.");
    } catch (error) {
      console.error("Scroomin start error:", error);
      setMonitoring(false);
      setAttentionState("error");
      const msg = error instanceof Error ? error.message : "Unknown error";
      setCameraError(msg);

      // Check if it's a permission error
      if (msg.includes("Permission") || msg.includes("denied") || msg.includes("dismissed")) {
        setShowPermissionGuide(true);
        setStatusMessage("Camera permission denied. Please allow camera access.");
      } else {
        setStatusMessage(`Unable to start: ${msg}. Check camera permission and model files.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const stopMonitoring = async () => {
    stopMonitorRef.current?.();
    stopMonitorRef.current = null;

    setMonitoring(false);
    setAttentionState("idle");
    setStatusMessage("Monitoring is off.");

    const success = await setActiveTabProtection(false);

    if (!success) {
      setStatusMessage("Monitoring stopped, but this tab could not be updated.");
    }
  };

  const handlePermissionGuideAction = () => {
    setShowPermissionGuide(false);
    // Trigger getUserMedia again to show the prompt
    startMonitoring();
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
        <div className="toggle-card">
          <div className="toggle-info">
            <div className="toggle-label">
              <span
                className={`status-dot ${monitoring ? "active" : ""}`}
                style={{ background: monitoring ? statusColors[attentionState] : "#4b5563" }}
                aria-hidden="true"
              ></span>
              <span>{monitoring ? statusLabels[attentionState] : "Visible"}</span>
            </div>
            <p className="toggle-desc">{statusMessage}</p>
          </div>

          <button
            className={`toggle-switch ${monitoring ? "on" : ""}`}
            onClick={monitoring ? stopMonitoring : startMonitoring}
            disabled={loading}
            aria-pressed={monitoring}
            aria-label={monitoring ? "Stop monitoring" : "Start monitoring"}
          >
            <span className="toggle-thumb" aria-hidden="true"></span>
            <span className="toggle-track" aria-hidden="true"></span>
          </button>
        </div>

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