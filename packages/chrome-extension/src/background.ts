chrome.runtime.onInstalled.addListener(() => {
  console.log("Feedback extension installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "captureVisibleTab" && typeof message.tabId === "number") {
    chrome.tabs.get(message.tabId).then((tab) =>
      chrome.tabs
        .captureVisibleTab(tab.windowId, { format: "png" })
        .then(sendResponse)
        .catch(() => sendResponse(null)),
    );
    return true;
  }
});
