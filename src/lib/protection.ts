const CONTENT_SCRIPT_PATH = "src/content.ts";

async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_PATH],
    });
    return true;
  } catch (error) {
    console.error("Scroomin: failed to inject content script:", error);
    return false;
  }
}

interface ProtectionResponse {
  enabled?: boolean;
}

async function sendMessageWithRetry(
  tabId: number,
  message: object,
  retries = 2
): Promise<ProtectionResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const isMissingContentScript =
        error instanceof Error &&
        (error.message.includes("Receiving end does not exist") ||
          error.message.includes("Could not establish connection"));

      if (isMissingContentScript && !isLastAttempt) {
        console.log(
          `Scroomin: content script not ready, injecting (attempt ${attempt + 1})...`
        );
        const injected = await ensureContentScriptInjected(tabId);
        if (!injected) continue;
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }
      throw error;
    }
  }
  return {};
}

export async function setActiveTabProtection(
  enabled: boolean
): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (tab?.id == null) {
      console.warn("Scroomin: no active tab found.");
      return false;
    }

    if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
      console.warn("Scroomin: cannot protect restricted page:", tab.url);
      return false;
    }

    await sendMessageWithRetry(tab.id, {
      type: "SCROOMIN_SET_PROTECTION",
      enabled,
    });

    return true;
  } catch (error) {
    console.error(
      "Scroomin: unable to update page protection:",
      error
    );

    return false;
  }
}

export async function getActiveTabProtection(): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (tab?.id == null) {
      console.warn("Scroomin: no active tab found.");
      return false;
    }

    const response = await sendMessageWithRetry(tab.id, {
      type: "SCROOMIN_GET_PROTECTION",
    });

    return response?.enabled ?? false;
  } catch (error) {
    console.error(
      "Scroomin: unable to get page protection state:",
      error
    );

    return false;
  }
}