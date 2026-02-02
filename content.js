/*
 * MScroller - Content Script
 * This is the main logic for the auto-scrolling extension.
 * Handles smooth scrolling, chapter navigation, UI, and stats.
 */
(function() {
  if (window._mscroller) return;
  window._mscroller = true;

  // --- State variables ---
  let scrolling = false;
  let speed = 3;
  let autoNext = true;
  let nextDelay = 3;
  let animationId = null;
  let lastTime = 0;
  let sessionStart = Date.now();
  let ui = null;

  // Load user settings from Chrome storage
  chrome.storage.sync.get({ speed: 3, autoNext: true, nextDelay: 3 }, s => {
    speed = s.speed;
    autoNext = s.autoNext;
    nextDelay = s.nextDelay;
  });

  // Listen for changes to settings and update state/UI
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.speed) speed = changes.speed.newValue;
      if (changes.autoNext) autoNext = changes.autoNext.newValue;
      if (changes.nextDelay) nextDelay = changes.nextDelay.newValue;
      updateUI();
    }
  });

  // --- SCROLLING LOGIC ---

  // Start auto-scrolling
  function start() {
    if (scrolling) return;
    scrolling = true;
    lastTime = performance.now();
    updateUI();
    animationId = requestAnimationFrame(smoothScroll);
  }

  // Stop auto-scrolling
  function stop() {
    scrolling = false;
    if (animationId) { 
      cancelAnimationFrame(animationId); 
      animationId = null; 
    }
    updateUI();
  }

  // Toggle scrolling on/off
  function toggle() {
    scrolling ? stop() : start();
  }

  // The main smooth scrolling loop (runs at 60fps)
  function smoothScroll(currentTime) {
    if (!scrolling) return;
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Calculate scroll speed (exponential scaling for better feel)
    const pixelsPerSecond = 50 * Math.pow(1.15, speed - 1);
    window.scrollBy(0, pixelsPerSecond * delta);

    // If we're at the bottom, go to next chapter if enabled
    const atBottom = (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50;
    if (atBottom && autoNext) {
      stop();
      goNext();
      return;
    }

    animationId = requestAnimationFrame(smoothScroll);
  }

  // --- CHAPTER NAVIGATION ---

  // Try to extract the current chapter number from the URL
  function getChapter() {
    const url = window.location.href;
    const patterns = [
      /chapter[_-]?(\d+(?:\.\d+)?)/i,
      /ch[_-]?(\d+(?:\.\d+)?)/i,
      /episode[_-]?(\d+)/i,
      /ep[_-]?(\d+)/i,
      /[\/-](\d+)(?:\/|$|\?)/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  // Try to extract the manga/manhwa title from the page
  function getTitle() {
    const selectors = [
      '.manga-title', '.series-title', '.comic-title',
      'h1', '.entry-title', '.chapter-title',
      '.breadcrumb a', 'a[href*="manga"]', 'a[href*="series"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        let text = el.textContent.trim();
        // Clean up
        text = text.replace(/chapter.*/i, '').replace(/episode.*/i, '').trim();
        if (text.length > 2 && text.length < 150) return text;
      }
    }
    // Fallback to page title
    return document.title.split(/[-|]/)[0].trim();
  }

  // Find the link to the next chapter (using several strategies)
  function findNextLink() {
    const current = window.location.href;
    
    // Strategy 1: Common next button patterns
    const nextSelectors = [
      'a[class*="next"]:not([class*="prev"])',
      'a[rel="next"]',
      '.next a', '.next-chap', '.btn-next',
      'a[href*="next"]'
    ];
    for (const sel of nextSelectors) {
      const el = document.querySelector(sel);
      if (el?.href && el.href !== current && !el.href.includes('#')) {
        return el.href;
      }
    }

    // Strategy 2: Text content
    const links = document.querySelectorAll('a[href]');
    for (const a of links) {
      const text = a.textContent.toLowerCase().trim();
      if ((text === 'next' || text.includes('next chapter') || text === '>' || text === '>>') 
          && a.href !== current && !a.href.includes('#')) {
        return a.href;
      }
    }

    // Strategy 3: Chapter number increment
    const currentCh = parseFloat(getChapter());
    if (currentCh) {
      for (const a of links) {
        const href = a.href;
        for (const p of [/chapter[_-]?(\d+(?:\.\d+)?)/i, /ch[_-]?(\d+(?:\.\d+)?)/i]) {
          const m = href.match(p);
          if (m && Math.abs(parseFloat(m[1]) - (currentCh + 1)) < 0.1) {
            return href;
          }
        }
      }
    }

    return null;
  }

  // Find the link to the previous chapter
  function findPrevLink() {
    const current = window.location.href;
    const selectors = [
      'a[class*="prev"]', 'a[rel="prev"]', '.prev a', '.prev-chap', '.btn-prev'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.href && el.href !== current && !el.href.includes('#')) {
        return el.href;
      }
    }
    return null;
  }

  // Go to the next chapter, with countdown and history update
  function goNext() {
    const url = findNextLink();
    if (url) {
      saveHistory();
      incrementChaptersRead();
      // Remember to auto-start on next page
      sessionStorage.setItem('mscroller_continue', '1');
      // Countdown timer
      let remaining = nextDelay;
      showToast(`Next chapter in ${remaining}...`);
      const countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          showToast(`Next chapter in ${remaining}...`);
        } else {
          clearInterval(countdownInterval);
          window.location.href = url;
        }
      }, 1000);
    } else {
      showToast('No next chapter found');
    }
  }

  // Go to the previous chapter and update history
  function goPrev() {
    const url = findPrevLink();
    if (url) {
      saveHistory();
      window.location.href = url;
    } else {
      showToast('No previous chapter found');
    }
  }

  // Increment the chapters read counter in local storage
  function incrementChaptersRead() {
    try {
      chrome.storage.local.get({ chaptersRead: 0 }, data => {
        chrome.storage.local.set({ chaptersRead: data.chaptersRead + 1 });
      });
    } catch (e) {}
  }

  // --- HISTORY TRACKING ---

  // Save the current chapter to reading history
  function saveHistory() {
    const entry = {
      title: getTitle(),
      chapter: getChapter() || '?',
      url: window.location.href,
      site: window.location.hostname,
      time: Date.now()
    };
    
    try {
      chrome.storage.local.get({ history: [] }, data => {
        let history = data.history;
        // Remove duplicate
        history = history.filter(h => !(h.site === entry.site && h.title === entry.title));
        // Add to front
        history.unshift(entry);
        // Keep last 100
        history = history.slice(0, 100);
        chrome.storage.local.set({ history });
      });
    } catch (e) {
      // Extension context invalidated, ignore
    }
  }

  // --- FLOATING UI ---

  // Create the floating UI for controls and stats
  function createUI() {
    if (ui) return;
    
    ui = document.createElement('div');
    ui.id = 'mscroller-ui';
    ui.innerHTML = `
      <div class="ms-header">
        <span class="ms-brand">MS</span>
        <span class="ms-close">&times;</span>
      </div>
      <div class="ms-content">
        <div class="ms-title">${getTitle().substring(0, 30)}</div>
        <div class="ms-chapter">Ch. ${getChapter() || '?'}</div>
        <div class="ms-controls">
          <button class="ms-btn ms-play">▶ Start</button>
        </div>
        <div class="ms-speed">
          <button class="ms-spd-btn" data-d="-1">−</button>
          <span class="ms-spd-val">${speed}</span>
          <button class="ms-spd-btn" data-d="1">+</button>
        </div>
        <div class="ms-nav">
          <button class="ms-nav-btn ms-prev">← Prev</button>
          <button class="ms-nav-btn ms-next">Next →</button>
        </div>
        <div class="ms-time">0:00</div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #mscroller-ui {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 160px;
        background: #181820;
        border: 1px solid #2a2a35;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        color: #d0d0d0;
        z-index: 999999;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        overflow: hidden;
        user-select: none;
      }
      #mscroller-ui.hidden { display: none; }
      .ms-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #1f1f28;
        cursor: move;
      }
      .ms-brand {
        font-weight: 700;
        font-size: 14px;
        color: #4ecdc4;
      }
      .ms-close {
        cursor: pointer;
        font-size: 18px;
        color: #666;
        line-height: 1;
      }
      .ms-close:hover { color: #fff; }
      .ms-content { padding: 12px; }
      .ms-title {
        font-size: 11px;
        color: #999;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
      }
      .ms-chapter {
        font-size: 13px;
        font-weight: 600;
        color: #4ecdc4;
        margin-bottom: 10px;
      }
      .ms-controls { margin-bottom: 8px; }
      .ms-btn {
        width: 100%;
        padding: 8px;
        border: none;
        border-radius: 6px;
        background: #252530;
        color: #d0d0d0;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      .ms-btn:hover { background: #32323f; }
      .ms-btn.active {
        background: #4ecdc4;
        color: #181820;
      }
      .ms-speed {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .ms-spd-btn {
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 6px;
        background: #252530;
        color: #d0d0d0;
        font-size: 16px;
        cursor: pointer;
      }
      .ms-spd-btn:hover { background: #32323f; }
      .ms-spd-val {
        font-size: 14px;
        font-weight: 600;
        min-width: 24px;
        text-align: center;
        color: #4ecdc4;
      }
      .ms-nav {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }
      .ms-nav-btn {
        flex: 1;
        padding: 6px;
        border: none;
        border-radius: 6px;
        background: #252530;
        color: #d0d0d0;
        font-size: 11px;
        cursor: pointer;
      }
      .ms-nav-btn:hover { background: #32323f; }
      .ms-time {
        text-align: center;
        font-size: 11px;
        color: #555;
        font-family: monospace;
      }
      #mscroller-toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #181820;
        color: #d0d0d0;
        padding: 10px 20px;
        border-radius: 8px;
        font-family: -apple-system, sans-serif;
        font-size: 13px;
        z-index: 999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 1px solid #2a2a35;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(ui);

    // Events
    ui.querySelector('.ms-close').onclick = () => ui.classList.add('hidden');
    ui.querySelector('.ms-play').onclick = toggle;
    ui.querySelector('.ms-prev').onclick = goPrev;
    ui.querySelector('.ms-next').onclick = goNext;
    
    ui.querySelectorAll('.ms-spd-btn').forEach(btn => {
      btn.onclick = () => {
        const d = parseInt(btn.dataset.d);
        speed = Math.max(1, Math.min(20, speed + d));
        chrome.storage.sync.set({ speed });
        updateUI();
      };
    });

    // Drag
    let dragging = false, startX, startY, startLeft, startTop;
    ui.querySelector('.ms-header').onmousedown = e => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = ui.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
    };
    document.onmousemove = e => {
      if (!dragging) return;
      ui.style.left = (startLeft + e.clientX - startX) + 'px';
      ui.style.top = (startTop + e.clientY - startY) + 'px';
      ui.style.right = 'auto';
      ui.style.bottom = 'auto';
    };
    document.onmouseup = () => dragging = false;

    // Timer
    setInterval(() => {
      const secs = Math.floor((Date.now() - sessionStart) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      const timeEl = ui.querySelector('.ms-time');
      if (timeEl) timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
  }

  // Update the UI to reflect current state (scrolling, speed)
  function updateUI() {
    if (!ui) return;
    const btn = ui.querySelector('.ms-play');
    btn.textContent = scrolling ? '⏹ Stop' : '▶ Start';
    btn.classList.toggle('active', scrolling);
    ui.querySelector('.ms-spd-val').textContent = speed;
  }

  // Show a temporary toast message on the screen
  function showToast(msg) {
    let toast = document.getElementById('mscroller-toast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'mscroller-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // --- KEYBOARD SHORTCUTS ---

  // Listen for keyboard shortcuts (space, arrows, n/p/h)
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (document.activeElement?.isContentEditable) return;

    if (e.key === ' ' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowUp' && e.shiftKey) {
      e.preventDefault();
      speed = Math.min(20, speed + 1);
      chrome.storage.sync.set({ speed });
      updateUI();
      showToast(`Speed: ${speed}`);
    } else if (e.key === 'ArrowDown' && e.shiftKey) {
      e.preventDefault();
      speed = Math.max(1, speed - 1);
      chrome.storage.sync.set({ speed });
      updateUI();
      showToast(`Speed: ${speed}`);
    } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey) {
      e.preventDefault();
      goNext();
    } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey) {
      e.preventDefault();
      goPrev();
    } else if (e.key.toLowerCase() === 'h' && !e.ctrlKey) {
      e.preventDefault();
      ui?.classList.toggle('hidden');
    }
  }, true);

  // --- EXTENSION MESSAGES ---

  // Listen for messages from the popup (toggle, getInfo, updateSpeed, showUI)
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg.type === 'toggle') { 
      toggle(); 
      respond({ scrolling }); 
    }
    else if (msg.type === 'getInfo') { 
      respond({ 
        scrolling, 
        speed,
        title: getTitle(),
        chapter: getChapter() || 'Unknown',
        sessionTime: Math.floor((Date.now() - sessionStart) / 1000)
      }); 
    }
    else if (msg.type === 'updateSpeed') {
      speed = msg.speed;
      updateUI();
      respond({ ok: true });
    }
    else if (msg.type === 'showUI') { 
      if (ui) ui.classList.remove('hidden');
      respond({ ok: true }); 
    }
    return true;
  });

  // --- INITIALIZATION ---

  // Create the UI after a short delay, and handle auto-continue
  setTimeout(() => {
    createUI();
    // Auto-continue if coming from previous chapter
    if (sessionStorage.getItem('mscroller_continue') === '1') {
      sessionStorage.removeItem('mscroller_continue');
      let countdown = 2;
      showToast(`Continuing in ${countdown}...`);
      const continueInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          showToast(`Continuing in ${countdown}...`);
        } else {
          clearInterval(continueInterval);
          start();
        }
      }, 1000);
    }
  }, 500);

  // Save the current chapter to history when the page loads
  setTimeout(saveHistory, 1000);

  // When leaving the page, save the session time to local storage
  window.addEventListener('beforeunload', () => {
    try {
      const sessionSecs = Math.floor((Date.now() - sessionStart) / 1000);
      chrome.storage.local.get({ totalTime: 0 }, data => {
        chrome.storage.local.set({ totalTime: data.totalTime + sessionSecs });
      });
    } catch (e) {
      // Extension context invalidated, ignore
    }
  });

})();
