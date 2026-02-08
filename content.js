/*
 * MScroller - Content Script
 * Auto-scrolling extension for manga/manhwa reading.
 * Only runs when activated via popup - no intrusive behavior.
 */
(function() {
  if (window._mscroller) return;
  window._mscroller = true;

  // --- Helper to safely access chrome.storage ---
  function isExtensionValid() {
    try {
      return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.sync;
    } catch (e) {
      return false;
    }
  }

  // --- State variables ---
  let scrolling = false;
  let speed = 5;
  let autoNext = true;
  let nextDelay = 3;
  let animationId = null;
  let lastTime = 0;
  let sessionStart = Date.now();
  let ui = null;
  let keyboardEnabled = false;

  // Load user settings from Chrome storage
  if (isExtensionValid()) {
    chrome.storage.sync.get({ speed: 5, autoNext: true, nextDelay: 3 }, s => {
      speed = s.speed;
      autoNext = s.autoNext;
      nextDelay = s.nextDelay;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        if (changes.speed) speed = changes.speed.newValue;
        if (changes.autoNext) autoNext = changes.autoNext.newValue;
        if (changes.nextDelay) nextDelay = changes.nextDelay.newValue;
        updateUI();
      }
    });
  }

  // --- SCROLLING LOGIC ---

  function start() {
    if (scrolling) return;
    scrolling = true;
    lastTime = performance.now();
    updateUI();
    animationId = requestAnimationFrame(smoothScroll);
  }

  function stop() {
    scrolling = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    updateUI();
  }

  function toggle() {
    scrolling ? stop() : start();
  }

  // Speed 1 ≈ 72 px/s, Speed 25 ≈ 708 px/s, Speed 50 ≈ 1756 px/s
  function smoothScroll(currentTime) {
    if (!scrolling) return;
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    const pixelsPerSecond = 50 + (speed * 20) + (Math.pow(speed, 1.5) * 2);
    window.scrollBy(0, pixelsPerSecond * delta);

    const atBottom = (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50;
    if (atBottom && autoNext) {
      stop();
      goNext();
      return;
    }

    animationId = requestAnimationFrame(smoothScroll);
  }

  // --- CHAPTER NAVIGATION ---

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
        text = text.replace(/chapter.*/i, '').replace(/episode.*/i, '').trim();
        if (text.length > 2 && text.length < 150) return text;
      }
    }
    return document.title.split(/[-|]/)[0].trim();
  }

  function findNextLink() {
    const current = window.location.href;

    const nextSelectors = [
      'a[class*="next"]:not([class*="prev"])',
      'a[rel="next"]',
      '.next a', '.next-chap', '.btn-next',
      'a[href*="next"]'
    ];
    for (const sel of nextSelectors) {
      const el = document.querySelector(sel);
      if (el && el.href && el.href !== current && !el.href.includes('#')) {
        return el.href;
      }
    }

    const links = document.querySelectorAll('a[href]');
    for (const a of links) {
      const text = a.textContent.toLowerCase().trim();
      if ((text === 'next' || text.includes('next chapter') || text === '>' || text === '>>')
          && a.href !== current && !a.href.includes('#')) {
        return a.href;
      }
    }

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

  function findPrevLink() {
    const current = window.location.href;
    const selectors = [
      'a[class*="prev"]', 'a[rel="prev"]', '.prev a', '.prev-chap', '.btn-prev'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.href && el.href !== current && !el.href.includes('#')) {
        return el.href;
      }
    }
    return null;
  }

  function goNext() {
    const url = findNextLink();
    if (url) {
      incrementChaptersRead();
      sessionStorage.setItem('mscroller_continue', '1');
      let remaining = nextDelay;
      showToast('Next chapter in ' + remaining + '...');
      const countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          showToast('Next chapter in ' + remaining + '...');
        } else {
          clearInterval(countdownInterval);
          window.location.href = url;
        }
      }, 1000);
    } else {
      showToast('No next chapter found');
    }
  }

  function goPrev() {
    const url = findPrevLink();
    if (url) {
      window.location.href = url;
    } else {
      showToast('No previous chapter found');
    }
  }

  function incrementChaptersRead() {
    if (!isExtensionValid()) return;
    try {
      chrome.storage.local.get({ chaptersRead: 0 }, data => {
        if (isExtensionValid()) {
          chrome.storage.local.set({ chaptersRead: data.chaptersRead + 1 });
        }
      });
    } catch (e) {}
  }

  // --- FLOATING UI ---

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function createUI() {
    if (ui) return;

    const isXml = document.contentType && document.contentType.includes('xml');
    if (isXml) return;

    ui = document.createElement('div');
    ui.id = 'mscroller-ui';

    ui.innerHTML =
      '<div class="ms-header">' +
        '<span class="ms-brand">MS</span>' +
        '<span class="ms-close">x</span>' +
      '</div>' +
      '<div class="ms-content">' +
        '<div class="ms-controls">' +
          '<button class="ms-btn ms-play">Start</button>' +
        '</div>' +
        '<div class="ms-speed">' +
          '<button class="ms-spd-btn" data-d="-1">-</button>' +
          '<span class="ms-spd-val">' + speed + '</span>' +
          '<button class="ms-spd-btn" data-d="1">+</button>' +
        '</div>' +
        '<div class="ms-nav">' +
          '<button class="ms-nav-btn ms-prev">Prev</button>' +
          '<button class="ms-nav-btn ms-next">Next</button>' +
        '</div>' +
        '<div class="ms-time">0:00</div>' +
      '</div>';

    const style = document.createElement('style');
    style.textContent =
      '#mscroller-ui {' +
        'position: fixed;' +
        'bottom: 20px;' +
        'right: 20px;' +
        'width: 160px;' +
        'background: #181820;' +
        'border: 1px solid #2a2a35;' +
        'border-radius: 12px;' +
        'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;' +
        'font-size: 12px;' +
        'color: #d0d0d0;' +
        'z-index: 999999;' +
        'box-shadow: 0 8px 32px rgba(0,0,0,0.5);' +
        'overflow: hidden;' +
        'user-select: none;' +
      '}' +
      '#mscroller-ui.hidden { display: none; }' +
      '.ms-header {' +
        'display: flex;' +
        'justify-content: space-between;' +
        'align-items: center;' +
        'padding: 8px 12px;' +
        'background: #1f1f28;' +
        'cursor: move;' +
      '}' +
      '.ms-brand { font-weight: 700; font-size: 14px; color: #4ecdc4; }' +
      '.ms-close { cursor: pointer; font-size: 18px; color: #666; line-height: 1; }' +
      '.ms-close:hover { color: #fff; }' +
      '.ms-content { padding: 12px; }' +
      '.ms-controls { margin-bottom: 8px; }' +
      '.ms-btn { width: 100%; padding: 8px; border: none; border-radius: 6px; background: #252530; color: #d0d0d0; font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.2s; }' +
      '.ms-btn:hover { background: #32323f; }' +
      '.ms-btn.active { background: #4ecdc4; color: #181820; }' +
      '.ms-speed { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }' +
      '.ms-spd-btn { width: 28px; height: 28px; border: none; border-radius: 6px; background: #252530; color: #d0d0d0; font-size: 16px; cursor: pointer; }' +
      '.ms-spd-btn:hover { background: #32323f; }' +
      '.ms-spd-val { font-size: 14px; font-weight: 600; min-width: 24px; text-align: center; color: #4ecdc4; }' +
      '.ms-nav { display: flex; gap: 6px; margin-bottom: 8px; }' +
      '.ms-nav-btn { flex: 1; padding: 6px; border: none; border-radius: 6px; background: #252530; color: #d0d0d0; font-size: 11px; cursor: pointer; }' +
      '.ms-nav-btn:hover { background: #32323f; }' +
      '.ms-time { text-align: center; font-size: 11px; color: #555; font-family: monospace; }' +
      '#mscroller-toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: #181820; color: #d0d0d0; padding: 10px 20px; border-radius: 8px; font-family: -apple-system, sans-serif; font-size: 13px; z-index: 999999; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid #2a2a35; }';

    document.head.appendChild(style);
    document.body.appendChild(ui);

    // Event handlers
    ui.querySelector('.ms-close').onclick = () => {
      ui.classList.add('hidden');
      disableKeyboardShortcuts();
    };
    ui.querySelector('.ms-play').onclick = toggle;
    ui.querySelector('.ms-prev').onclick = goPrev;
    ui.querySelector('.ms-next').onclick = goNext;

    ui.querySelectorAll('.ms-spd-btn').forEach(btn => {
      btn.onclick = () => {
        const d = parseInt(btn.dataset.d);
        speed = Math.max(1, Math.min(50, speed + d));
        ui.querySelector('.ms-spd-val').textContent = speed;
        if (isExtensionValid()) {
          chrome.storage.sync.set({ speed });
        }
      };
    });

    // Drag functionality
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

    // Timer update
    setInterval(() => {
      const secs = Math.floor((Date.now() - sessionStart) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      const timeEl = ui.querySelector('.ms-time');
      if (timeEl) timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);

    // Enable keyboard shortcuts when UI is created
    enableKeyboardShortcuts();
  }

  function updateUI() {
    if (!ui) return;
    const btn = ui.querySelector('.ms-play');
    btn.textContent = scrolling ? 'Stop' : 'Start';
    btn.classList.toggle('active', scrolling);
    ui.querySelector('.ms-spd-val').textContent = speed;
  }

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

  function handleKeydown(e) {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
    if (document.activeElement && document.activeElement.isContentEditable) return;

    if (e.key === ' ' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowUp' && e.shiftKey) {
      e.preventDefault();
      speed = Math.min(50, speed + 1);
      if (ui) ui.querySelector('.ms-spd-val').textContent = speed;
      if (isExtensionValid()) chrome.storage.sync.set({ speed });
      showToast('Speed: ' + speed);
    } else if (e.key === 'ArrowDown' && e.shiftKey) {
      e.preventDefault();
      speed = Math.max(1, speed - 1);
      if (ui) ui.querySelector('.ms-spd-val').textContent = speed;
      if (isExtensionValid()) chrome.storage.sync.set({ speed });
      showToast('Speed: ' + speed);
    } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey) {
      e.preventDefault();
      goNext();
    } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey) {
      e.preventDefault();
      goPrev();
    } else if (e.key.toLowerCase() === 'h' && !e.ctrlKey) {
      e.preventDefault();
      if (ui) ui.classList.toggle('hidden');
    }
  }

  function enableKeyboardShortcuts() {
    if (keyboardEnabled) return;
    keyboardEnabled = true;
    document.addEventListener('keydown', handleKeydown, true);
  }

  function disableKeyboardShortcuts() {
    if (!keyboardEnabled) return;
    keyboardEnabled = false;
    document.removeEventListener('keydown', handleKeydown, true);
  }

  // --- EXTENSION MESSAGES ---

  if (isExtensionValid()) {
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
        createUI();
        if (ui) ui.classList.remove('hidden');
        respond({ ok: true });
      }
      return true;
    });
  }

  // --- INITIALIZATION ---

  // Handle auto-continue from previous chapter navigation
  if (sessionStorage.getItem('mscroller_continue') === '1') {
    sessionStorage.removeItem('mscroller_continue');
    createUI();
    let countdown = 2;
    showToast('Continuing in ' + countdown + '...');
    const continueInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        showToast('Continuing in ' + countdown + '...');
      } else {
        clearInterval(continueInterval);
        start();
      }
    }, 1000);
  }

  // Save session time on page unload
  window.addEventListener('beforeunload', () => {
    if (!isExtensionValid()) return;
    try {
      const sessionSecs = Math.floor((Date.now() - sessionStart) / 1000);
      chrome.storage.local.get({ totalTime: 0 }, data => {
        if (isExtensionValid()) {
          chrome.storage.local.set({ totalTime: data.totalTime + sessionSecs });
        }
      });
    } catch (e) {}
  });

  // Expose function to show UI (for re-activation)
  window._mscrollerShowUI = function() {
    createUI();
    if (ui) ui.classList.remove('hidden');
  };

})();
