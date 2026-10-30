/**
 * Tab-side helpers, used by the background service worker.
 * They talk to the content script (src/content.ts) that draws the overlay.
 */

interface ProtectionResponse {
  enabled?: boolean;
}

const RESTRICTED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "chrome-untrusted://",
  "devtools://",
  "edge://",
  "brave://",
  "about:",
  "view-source:",
  "https://chromewebstore.google.com/",
  "https://chrome.google.com/webstore/",
];

export function isRestrictedUrl(url?: string): boolean {
  return !!url && RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function isMissingReceiver(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Receiving end does not exist") ||
      error.message.includes("Could not establish connection"))
  );
}

/**
 * The content script's real path after the build. Reading it from the built manifest
 * works with CRXJS (it rewrites the entry to a loader file), unlike a hardcoded "src/content.ts".
 */
function getContentScriptFile(): string | undefined {
  return chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
}

async function injectContentScript(tabId: number): Promise<boolean> {
  const file = getContentScriptFile();
  if (!file) return false;

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
    return true;
  } catch (error) {
    console.warn("Scroomin: failed to inject content script:", error);
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a message to the content script in a tab.
 * If the script is missing (tab opened before install/update) and `injectIfMissing` is set,
 * it is injected and the message is retried while the script finishes loading.
 */
async function sendToTab(
  tabId: number,
  message: object,
  injectIfMissing: boolean
): Promise<ProtectionResponse | undefined> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!isMissingReceiver(error)) throw error;

    // Nothing to uncover on a page that has no content script.
    if (!injectIfMissing) return undefined;
    if (!(await injectContentScript(tabId))) throw error;

    let lastError: unknown = error;
    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(100);
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (retryError) {
        if (!isMissingReceiver(retryError)) throw retryError;
        lastError = retryError;
      }
    }
    throw lastError;
  }
}

export async function applyCoverToTab(tabId: number, covered: boolean): Promise<boolean> {
  try {
    await sendToTab(tabId, { type: "SCROOMIN_SET_PROTECTION", enabled: covered }, covered);
    return true;
  } catch (error) {
    console.warn(`Scroomin: could not update tab ${tabId}:`, error);
    return false;
  }
}

/** Covers or uncovers the active tab of every window, since all of them can be seen on screen. */
export async function applyCoverToVisibleTabs(
  covered: boolean
): Promise<{ applied: number; failed: number }> {
  const tabs = await chrome.tabs.query({ active: true });
  const targets = tabs.filter((tab) => tab.id != null && !isRestrictedUrl(tab.url));

  const results = await Promise.all(
    targets.map((tab) => applyCoverToTab(tab.id as number, covered))
  );

  return {
    applied: results.filter(Boolean).length,
    failed: results.filter((ok) => !ok).length,
  };
}

/* ---------- Backward compatibility ---------- */

/**
 * @deprecated Protection state is owned by the background service worker now.
 * Kept so older callers (for example the side panel) still compile.
 */
export async function setActiveTabProtection(enabled: boolean): Promise<boolean> {
  const { failed } = await applyCoverToVisibleTabs(enabled);
  return failed === 0;
}

/** @deprecated See setActiveTabProtection. */
export async function getActiveTabProtection(): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id == null || isRestrictedUrl(tab.url)) return false;

    const response = await sendToTab(tab.id, { type: "SCROOMIN_GET_PROTECTION" }, false);
    return response?.enabled ?? false;
  } catch (error) {
    console.error("Scroomin: unable to get page protection state:", error);
    return false;
  }
}