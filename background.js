const injectedTabs = new Set();

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

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Re-inject content script when an active tab navigates (for auto-continue between chapters)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && injectedTabs.has(tabId)) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(() => {
      // Injection failed (restricted page), remove from tracking
      injectedTabs.delete(tabId);
    });
  }
});

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ensureContentScript') {
    injectContentScript(message.tabId).then(sendResponse);
    return true;
  }
});
