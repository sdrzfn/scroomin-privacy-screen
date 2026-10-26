chrome.runtime.onInstalled.addListener(() => {
  console.log("Scroomin Browser installed");
})

// --- INI DIGUNAKAN UNTUK SIDEPANEL ---
// chrome.sidePanel.setPanelBehavior({
//   openPanelOnActionClick: true,
// });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SCROOMIN_GET_PROTECTION") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "SCROOMIN_GET_PROTECTION" }, (response) => {
          sendResponse({ enabled: response?.enabled ?? false });
        });
        return true;
      }
      sendResponse({ enabled: false });
    });
    return true;
  }
});
