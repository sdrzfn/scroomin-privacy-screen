const OVERLAY_ID = "__scroomin_privacy_overlay__";

const LOCK_SVG = `
<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
</svg>
`;

function setProtection(enabled: boolean) {
  let overlay = document.getElementById(OVERLAY_ID);

  if (enabled) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;

      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        background: "#101014",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        font: "500 16px system-ui",
        pointerEvents: "auto",
        opacity: "0",
        transition: "opacity 0.3s ease-in-out",
        gap: "16px",
      });

      const lockIcon = document.createElement("div");
      lockIcon.innerHTML = LOCK_SVG;
      Object.assign(lockIcon.style, {
        width: "64px",
        height: "64px",
        color: "#22d3ee",
        opacity: "0.9",
        filter: "drop-shadow(0 0 12px rgba(34, 211, 238, 0.5))",
        transition: "transform 0.3s ease-out",
      });

      const text = document.createElement("span");
      text.textContent = "Scroomin - Screen protected";
      Object.assign(text.style, {
        fontSize: "14px",
        color: "#a1a1aa",
        letterSpacing: "0.02em",
      });

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
    const lockIcon = overlay.querySelector("div");
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