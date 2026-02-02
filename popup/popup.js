// Get references to all the popup UI elements
const startBtn = document.getElementById('toggle');
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speed-val');
const chaptersReadEl = document.getElementById('chaptersRead');
const autoNextCheck = document.getElementById('autoNext');
const delaySlider = document.getElementById('nextDelay');
const delayValue = document.getElementById('nextDelay-val');
const sessionTime = document.getElementById('session');
const totalTime = document.getElementById('total');
const currentTitle = document.getElementById('currentTitle');
const currentChapter = document.getElementById('currentChapter');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');

let updateInterval;

// Handle switching between Settings and History tabs
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

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
  sendToContent({ type: 'toggle' });
});

// Update the stats section in the popup (session, total, chapters)
async function updateStats() {
  const data = await chrome.storage.local.get(['totalTime', 'currentSession', 'chaptersRead']);
  
  totalTime.textContent = formatTime(data.totalTime || 0);
  chaptersReadEl.textContent = data.chaptersRead || 0;
  
  // Session time from content script
  if (data.currentSession) {
    sessionTime.textContent = formatTime(data.currentSession);
  }
}

// Load and display reading history
async function loadHistory() {
  const data = await chrome.storage.local.get(['history']);
  const history = data.history || [];
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No reading history yet</div>';
    return;
  }
  
  historyList.innerHTML = history
    .slice(0, 30)
    .map((item, index) => `
      <div class="history-item" data-url="${escapeHtml(item.url)}" data-index="${index}">
        <div class="history-item-content">
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-meta">
            <span class="history-chapter">Ch. ${escapeHtml(item.chapter)}</span>
            <span>${formatDate(item.time || item.timestamp)}</span>
          </div>
        </div>
        <button class="history-delete" data-index="${index}" title="Remove">×</button>
      </div>
    `).join('');
  
  // Click to open
  historyList.querySelectorAll('.history-item-content').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.parentElement.dataset.url;
      chrome.tabs.create({ url });
    });
  });
  
  // Delete individual items
  historyList.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      const data = await chrome.storage.local.get(['history']);
      const history = data.history || [];
      history.splice(index, 1);
      await chrome.storage.local.set({ history });
      loadHistory();
    });
  });
}

// Clear all reading history when button is clicked
clearHistoryBtn.addEventListener('click', async () => {
  if (confirm('Clear all reading history?')) {
    await chrome.storage.local.set({ history: [] });
    loadHistory();
  }
});

// Get info about the current tab (title, chapter, scrolling state)
async function getCurrentInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'getInfo' });
      if (response) {
        currentTitle.textContent = response.title || 'Unknown';
        currentChapter.textContent = 'Ch. ' + (response.chapter || '?');
        startBtn.textContent = response.scrolling ? '⏹ Stop' : '▶ Start';
        startBtn.classList.toggle('active', response.scrolling);
        if (response.sessionTime !== undefined) {
          sessionTime.textContent = formatTime(response.sessionTime);
        }
      }
    } catch (e) {
      currentTitle.textContent = 'Not available';
      currentChapter.textContent = '-';
    }
  }
}

// Send a message to the content script in the active tab
async function sendToContent(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, message);
      if (response && message.type === 'toggle') {
        startBtn.textContent = response.scrolling ? '⏹ Stop' : '▶ Start';
        startBtn.classList.toggle('active', response.scrolling);
      }
    } catch (e) {
      console.log('Could not connect to content script');
    }
  }
}

// Helper functions for formatting time, dates, and escaping HTML
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

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize popup: load settings, stats, history, and current info
loadSettings();
updateStats();
loadHistory();
getCurrentInfo();

// Periodically update stats and current info every second
updateInterval = setInterval(() => {
  getCurrentInfo();
  updateStats();
}, 1000);

// Clean up interval when popup is closed
window.addEventListener('unload', () => {
  clearInterval(updateInterval);
});
