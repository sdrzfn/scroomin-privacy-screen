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

    await chrome.tabs.sendMessage(tab.id, {
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
