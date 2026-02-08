// Get references to all the popup UI elements
const startBtn = document.getElementById('toggle');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speed-val');
const chaptersReadEl = document.getElementById('chaptersRead');
const autoNextCheck = document.getElementById('autoNext');
const delaySlider = document.getElementById('nextDelay');
const delayValue = document.getElementById('nextDelay-val');
const sessionTime = document.getElementById('session');
const totalTime = document.getElementById('total');

let updateInterval;

// Ensure content script is injected before sending messages
async function ensureContentScript() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;

  // Ask background to inject if needed
  await chrome.runtime.sendMessage({ type: 'ensureContentScript', tabId: tab.id });

  // Small delay to let script initialize
  await new Promise(resolve => setTimeout(resolve, 100));

  return tab;
}

// Load user settings from Chrome storage and update UI
async function loadSettings() {
  const data = await chrome.storage.sync.get(['speed', 'autoNext', 'nextDelay']);

  speedSlider.value = data.speed || 3;
  speedValue.textContent = speedSlider.value;

  autoNextCheck.checked = data.autoNext !== false;

  delaySlider.value = data.nextDelay || 3;
  delayValue.textContent = delaySlider.value + 's';
}

// Save settings when user changes them
speedSlider.addEventListener('input', () => {
  speedValue.textContent = speedSlider.value;
  chrome.storage.sync.set({ speed: parseInt(speedSlider.value) });
  sendToContent({ type: 'updateSpeed', speed: parseInt(speedSlider.value) });
});

autoNextCheck.addEventListener('change', () => {
  chrome.storage.sync.set({ autoNext: autoNextCheck.checked });
});

delaySlider.addEventListener('input', () => {
  delayValue.textContent = delaySlider.value + 's';
  chrome.storage.sync.set({ nextDelay: parseInt(delaySlider.value) });
});

// Handle start/stop button click
startBtn.addEventListener('click', async () => {
  const tab = await ensureContentScript();
  if (!tab) return;

  // Show UI first, then toggle
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'showUI' });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
    if (response) {
      startBtn.textContent = response.scrolling ? '⏹ Stop' : '▶ Start';
      startBtn.classList.toggle('active', response.scrolling);
    }
  } catch (e) {
    // Could not activate on this page
  }
});

// Update the stats section in the popup
async function updateStats() {
  const data = await chrome.storage.local.get(['totalTime', 'currentSession', 'chaptersRead']);

  totalTime.textContent = formatTime(data.totalTime || 0);
  chaptersReadEl.textContent = data.chaptersRead || 0;

  if (data.currentSession) {
    sessionTime.textContent = formatTime(data.currentSession);
  }
}

// Get info about the current tab
async function getCurrentInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'getInfo' });
      if (response) {
        startBtn.textContent = response.scrolling ? '⏹ Stop' : '▶ Start';
        startBtn.classList.toggle('active', response.scrolling);
        if (response.sessionTime !== undefined) {
          sessionTime.textContent = formatTime(response.sessionTime);
        }
      }
    } catch (e) {
      // Content script not injected yet - that's fine
    }
  }
}

// Send a message to the content script
async function sendToContent(message) {
  const tab = await ensureContentScript();
  if (!tab) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    if (response && message.type === 'toggle') {
      startBtn.textContent = response.scrolling ? '⏹ Stop' : '▶ Start';
      startBtn.classList.toggle('active', response.scrolling);
    }
  } catch (e) {
    // Could not connect
  }
}

// Helper function for formatting time
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Initialize popup
loadSettings();
updateStats();
getCurrentInfo();

// Periodically update stats and current info
updateInterval = setInterval(() => {
  getCurrentInfo();
  updateStats();
}, 1000);

// Clean up interval when popup is closed
window.addEventListener('unload', () => {
  clearInterval(updateInterval);
});
