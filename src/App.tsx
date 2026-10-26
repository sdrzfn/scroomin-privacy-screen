import { useState } from "react";

export default function App() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("Protection is off");


  async function toggleProtection() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      // Only check whether we have a valid tab ID (subject to change)
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
      setStatus(
        next ? "Screen protected" : "Protection is off",
      );
    } catch (error) {
      console.error("scroomin protection error:", error);

      setStatus(
        "Unable to reach this page. Try refreshing it.",
      );
    }
  }


  return (
    <main className="app">
      <header>
        <div className="brand-mark">U</div>
        <div>
          <h1>Scroomin</h1>
          <p>Privacy, by design.</p>
        </div>
      </header>

      <section className="protection-card">
        <p className="eyebrow">PROTECTION STATUS</p>
        <h2>{enabled ? "You're protected" : "You're visible"}</h2>
        <p>{status}</p>

        <button
          className={enabled ? "active" : ""}
          onClick={toggleProtection}
        >
          {enabled ? "Disable protection" : "Protect this tab"}
        </button>
      </section>

      <footer>
        Local-first privacy · Camera detection coming next
      </footer>
    </main>
  );
}
