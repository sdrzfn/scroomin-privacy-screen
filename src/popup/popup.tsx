import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

function Popup() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("Protection is off");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "SCROOMIN_GET_PROTECTION" }, (response) => {
      if (response?.enabled !== undefined) {
        setEnabled(response.enabled);
        setStatus(response.enabled ? "Screen protected" : "Protection is off");
      }
    });
  }, []);

  async function toggleProtection() {
    if (loading) return;
    setLoading(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      if (tab?.id == null) {
        setStatus("No active tab found.");
        return;
      }

      const next = !enabled;

      await chrome.tabs.sendMessage(tab.id, {
        type: "SCROOMIN_SET_PROTECTION",
        enabled: next,
      });

      setEnabled(next);
      setStatus(next ? "Screen protected" : "Protection is off");
    } catch {
      setStatus("Unable to reach this page. Try refreshing it.");
    } finally {
      setLoading(false);
    }
  }

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
              <span className={`status-dot ${enabled ? "active" : ""}`} aria-hidden="true"></span>
              <span>{enabled ? "Protected" : "Visible"}</span>
            </div>
            <p className="toggle-desc">{status}</p>
          </div>

          <button
            className={`toggle-switch ${enabled ? "on" : ""}`}
            onClick={toggleProtection}
            disabled={loading}
            aria-pressed={enabled}
            aria-label={enabled ? "Disable protection" : "Enable protection"}
          >
            <span className="toggle-thumb" aria-hidden="true"></span>
            <span className="toggle-track" aria-hidden="true"></span>
          </button>
        </div>

        {loading && <div className="loading" aria-live="polite">Applying…</div>}
      </main>

      <footer>
        Local-first privacy · Camera detection coming next
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);