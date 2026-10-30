/**
 * Runs in a full extension tab (permission.html), the only place where Chrome shows the
 * camera prompt for an extension. Permission is stored for the extension origin
 * (chrome-extension://<id>), so the popup can use the camera afterwards without a prompt.
 */

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const retryBtn = document.getElementById("retry") as HTMLButtonElement;

function closeThisTab() {
  chrome.tabs.getCurrent((tab) => {
    if (tab?.id !== undefined) chrome.tabs.remove(tab.id);
  });
}

async function requestCamera() {
  retryBtn.hidden = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());

    statusEl.textContent = "Camera access granted. This tab will close. Reopen Scroomin and turn Protection on.";
    setTimeout(closeThisTab, 1500);
  } catch (error) {
    const err = error as DOMException;
    console.error("Scroomin permission error:", err);

    statusEl.textContent =
      err.name === "NotAllowedError"
        ? "Camera access was blocked. Click the camera icon in the address bar to allow it, then request access again."
        : err.name === "NotFoundError"
          ? "No camera was found on this device."
          : err.name === "NotReadableError"
            ? "The camera is in use by another application. Close it and request access again."
            : `Could not access the camera (${err.name}).`;

    retryBtn.hidden = false;
  }
}

retryBtn.addEventListener("click", () => void requestCamera());
void requestCamera();