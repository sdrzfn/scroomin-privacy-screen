const OVERLAY_ID = "__scroomin_privacy_overlay__";

const LOCK_SVG = `
<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
</svg>
`;

/** What we were last told to do. The DOM can lag behind it during the fade-out. */
let enabledState = false;
/** True once the background has pushed a state to this page, so a late reply to our own query is ignored. */
let receivedPush = false;
let removeTimer: number | undefined;

// Inject styles for the overlay (including ::before blur layer)
function injectOverlayStyles() {
  if (document.getElementById("__scroomin_overlay_styles__")) return;

  const style = document.createElement("style");
  style.id = "__scroomin_overlay_styles__";
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      gap: 16px;
      color: #ffffff;
      font: 500 16px system-ui;
    }

    #${OVERLAY_ID}::before {
      content: "";
      position: absolute;
      inset: 0;
      background: rgba(15, 15, 18, 0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: -1;
    }

    #${OVERLAY_ID} .lock-icon {
      width: 64px;
      height: 64px;
      color: #fb7185;
      opacity: 0.9;
      filter: drop-shadow(0 0 12px rgba(251, 113, 133, 0.5));
      transform: scale(0.9);
      transition: transform 0.3s ease-out;
      flex-shrink: 0;
    }

    #${OVERLAY_ID} .overlay-text {
      font-size: 14px;
      color: #a1a1aa;
      letter-spacing: 0.02em;
      text-align: center;
      max-width: 80%;
    }
  `;
  document.documentElement.appendChild(style);
}

function setProtection(enabled: boolean) {
  enabledState = enabled;

  // Cancel any pending removal, otherwise a quick off -> on would still delete the overlay.
  window.clearTimeout(removeTimer);

  injectOverlayStyles();

  let overlay = document.getElementById(OVERLAY_ID);

  if (enabled) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;

      const lockIcon = document.createElement("div");
      lockIcon.className = "lock-icon";
      lockIcon.innerHTML = LOCK_SVG;

      const text = document.createElement("span");
      text.className = "overlay-text";
      text.textContent = "Scroomin - Screen protected";

      overlay.appendChild(lockIcon);
      overlay.appendChild(text);
      document.documentElement.appendChild(overlay);

      // Force reflow so the fade-in animates
      void overlay.offsetHeight;
    }

    // Also reverses a fade-out that is already in progress.
    overlay.style.opacity = "1";
    const lockIcon = overlay.querySelector<HTMLElement>(".lock-icon");
    if (lockIcon) lockIcon.style.transform = "scale(1)";
  } else if (overlay) {
    overlay.style.opacity = "0";
    const lockIcon = overlay.querySelector<HTMLElement>(".lock-icon");
    if (lockIcon) lockIcon.style.transform = "scale(0.9)";

    // Remove after the fade-out completes
    removeTimer = window.setTimeout(() => {
      document.getElementById(OVERLAY_ID)?.remove();
    }, 300);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SCROOMIN_SET_PROTECTION") {
    receivedPush = true;
    setProtection(Boolean(message.enabled));
    sendResponse({ enabled: enabledState });
  } else if (message?.type === "SCROOMIN_GET_PROTECTION") {
    sendResponse({ enabled: enabledState });
  }

  // sendResponse is always called synchronously, so the channel must not be kept open.
  return false;
});

// A new page (or a reload) starts uncovered. Ask the background whether it should be covered.
try {
  chrome.runtime
    .sendMessage({ type: "SCROOMIN_QUERY_COVER" })
    .then((response: { covered?: boolean } | undefined) => {
      if (!receivedPush && response?.covered) setProtection(true);
    })
    .catch(() => {});
} catch {
  // Extension context invalidated (the extension was reloaded). Nothing to do.
}