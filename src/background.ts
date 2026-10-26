chrome.runtime.onInstalled.addListener(() => {
  console.log("Scroomin Browser installed");
});

chrome.sidePanel.setPanelBehavior({
  openPanelOnActionClick: true,
});
