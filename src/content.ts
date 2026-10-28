const OVERLAY_ID = "__scroomin_privacy_overlay__";

const LOCK_SVG = `
<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
</svg>
`;

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

      // Force reflow then animate in
      overlay.offsetHeight;
      overlay.style.opacity = "1";
      lockIcon.style.transform = "scale(1)";
    }
  } else if (overlay) {
    // Fade out animation
    overlay.style.opacity = "0";
    const lockIcon = overlay.querySelector(".lock-icon");
    if (lockIcon) {
      (lockIcon as HTMLElement).style.transform = "scale(0.9)";
    }

    // Remove after animation completes
    setTimeout(() => {
      overlay?.remove();
    }, 300);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SCROOMIN_SET_PROTECTION") {
    setProtection(Boolean(message.enabled));
    sendResponse({ enabled: Boolean(message.enabled) });
  } else if (message?.type === "SCROOMIN_GET_PROTECTION") {
    const overlay = document.getElementById(OVERLAY_ID);
    sendResponse({ enabled: !!overlay });
  }
  return true;
});