// This is the background script for MScroller.
// It sets up default extension settings and stats when installed.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    speed: 3,
    autoNext: true,
    nextDelay: 3
  });
  chrome.storage.local.set({
    history: [],
    totalTime: 0,
    chaptersRead: 0
  });
});
