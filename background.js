// MScroller Background Script
// Handles extension initialization and programmatic content script injection

// Track which tabs have the content script injected
const injectedTabs = new Set();

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    speed: 3,
    autoNext: true,
    nextDelay: 3
  });
  chrome.storage.local.set({
    totalTime: 0,
    chaptersRead: 0
  });
});

// Clean up tracking when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Re-inject content script when an active tab navigates (for auto-continue between chapters)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && injectedTabs.has(tabId)) {
    // Tab was previously active, re-inject for auto-continue
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(() => {
      // Injection failed (restricted page), remove from tracking
      injectedTabs.delete(tabId);
    });
  }
});

// Inject the content script into a tab
async function injectContentScript(tabId) {
  if (injectedTabs.has(tabId)) {
    return { alreadyInjected: true };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    injectedTabs.add(tabId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Listen for messages from popup requesting content script injection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ensureContentScript') {
    injectContentScript(message.tabId).then(sendResponse);
    return true;
  }
});
