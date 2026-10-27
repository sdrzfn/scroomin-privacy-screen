import { useCallback, useEffect, useRef, useState } from "react";
import {
  startAttentionMonitor,
  type AttentionState,
} from "./lib/attention";
import { setActiveTabProtection } from "./lib/protection";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopMonitorRef = useRef<(() => void) | null>(null);

  const [monitoring, setMonitoring] = useState(false);
  const [attentionState, setAttentionState] =
    useState<AttentionState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Monitoring is off."
  );

  const applyProtection = useCallback(async () => {
    if (!monitoring) return;

    const shouldProtect = attentionState === "away";
    const success = await setActiveTabProtection(shouldProtect);

    if (!success) {
      setStatusMessage(
        "Could not update this tab. Try refreshing the webpage."
      );
    } else {
      setStatusMessage(
        shouldProtect
          ? "Screen protected: no face detected."
          : "Face detected: protection is off."
      );
    }
  }, [monitoring, attentionState]);

  useEffect(() => {
    void applyProtection();
  }, [applyProtection]);

  // Apply the current protection state when the active tab changes.
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

    try {
      setStatusMessage("Requesting camera access...");

      const stop = await startAttentionMonitor(
        video,
        (nextState) => {
          setAttentionState(nextState);
        }
      );

      stopMonitorRef.current = stop;
      setMonitoring(true);
      setStatusMessage("Monitoring is running.");
    } catch (error) {
      console.error("Umbra start error:", error);
      setMonitoring(false);
      setAttentionState("error");
      setStatusMessage(
        "Unable to start. Check camera permission and model files."
      );
    }
  };

  const stopMonitoring = async () => {
    stopMonitorRef.current?.();
    stopMonitorRef.current = null;

    setMonitoring(false);
    setAttentionState("idle");
    setStatusMessage("Monitoring is off.");

    // Always remove the overlay when the user stops monitoring.
    const success = await setActiveTabProtection(false);

    if (!success) {
      setStatusMessage(
        "Monitoring stopped, but this tab could not be updated."
      );
    }
  };

  return (
    <main className="umbra-panel">
      <h1>Umbra Browser</h1>
      <p className="muted">
        Local face detection for your privacy screen.
      </p>

      <video
        ref={videoRef}
        muted
        playsInline
        className="camera-preview"
      />

      <section className="status-section">
        <p>
          <strong>Monitoring:</strong>{" "}
          {monitoring ? "On" : "Off"}
        </p>

        <p>
          <strong>Detection:</strong>{" "}
          {attentionState}
        </p>

        <p className="status-message">{statusMessage}</p>
      </section>

      {!monitoring ? (
        <button onClick={startMonitoring}>
          Start monitoring
        </button>
      ) : (
        <button onClick={stopMonitoring}>
          Stop monitoring
        </button>
      )}

      <p className="muted small">
        Camera frames are processed locally by this extension.
        Face detection alone does not establish where your eyes
        are looking.
      </p>
    </main>
  );
}
