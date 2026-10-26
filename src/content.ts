const OVERLAY_ID = "__scroomin_privacy_overlay__";

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
        alignItems: "center",
        justifyContent: "center",
        font: "500 16px system-ui",
        pointerEvents: "auto",
      });

      overlay.textContent = "Scroomin - Screen protected";
      document.documentElement.appendChild(overlay);
    }
  } else {
    overlay?.remove();
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "SCROOMIN_SET_PROTECTION") {
    setProtection(Boolean(message.enabled));
  }
});
