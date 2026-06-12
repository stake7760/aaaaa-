// Haxball Tools
// - PageUp: leave room instantly
// - Camera shortcuts: configurable keys via in-game Settings > Camera tab
// - Remove rightbar ad

// ─── Remove ad ───────────────────────────────────────────────
(function removeAd() {
  const rightbar = document.querySelector('.rightbar');
  if (rightbar) rightbar.remove();
  else setTimeout(removeAd, 200);
})();

// ─── Camera zoom values ───────────────────────────────────────
const ZOOMS = [
  'Full 1x Zoom',
  'Full 1.25x Zoom',
  'Full 1.5x Zoom',
  'Full 1.75x Zoom',
  'Full 2x Zoom',
  'Full 2.25x Zoom',
  'Full 2.5x Zoom',
];

function setViewMode(value) {
  const select = document.querySelector('[data-hook="viewmode"]');
  if (!select) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function loadBindings(cb) {
  chrome.storage.local.get('cameraBindings', d => cb(d.cameraBindings || {}));
}

function saveBindings(bindings) {
  chrome.storage.local.set({ cameraBindings: bindings });
}

// ─── Inject Camera tab into Settings panel ───────────────────
function injectCameraTab(tabs, tabcontents) {
  if (tabs.querySelector('[data-hook="camerabtn"]')) return;

  // Tab button
  const btn = document.createElement('button');
  btn.dataset.hook = 'camerabtn';
  btn.textContent = 'Camera';
  tabs.appendChild(btn);

  // Tab section
  const section = document.createElement('div');
  section.className = 'section';
  section.dataset.hook = 'camerasec';

  const hint = document.createElement('div');
  hint.style.cssText = 'margin-bottom:12px; font-size:12px; color:#aaa;';
  hint.textContent = 'Click a field and press a key. Click again to clear.';
  section.appendChild(hint);

  ZOOMS.forEach(zoom => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; margin-bottom:8px; gap:10px;';

    const label = document.createElement('div');
    label.style.cssText = 'flex:1; font-size:14px;';
    label.textContent = zoom;

    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.zoom = zoom;
    input.readOnly = true;
    input.placeholder = '—';
    input.style.cssText = `
      width:80px; text-align:center;
      background:#0f3460; border:1px solid #1a5276;
      border-radius:4px; color:#fff; font-size:14px;
      padding:5px 8px; cursor:pointer; outline:none;
    `;

    let listening = false;

    input.addEventListener('click', () => {
      if (listening) {
        // Second click = clear
        input.value = '';
        input.style.borderColor = '#1a5276';
        input.style.background = '#0f3460';
        input.placeholder = '—';
        listening = false;
        persistAll();
        return;
      }
      listening = true;
      input.value = '';
      input.style.borderColor = '#f39c12';
      input.style.background = '#3d2b00';
      input.placeholder = 'Press key...';
      input.focus();
    });

    input.addEventListener('keydown', e => {
      if (!listening) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        input.value = '';
      } else {
        input.value = e.key;
      }
      input.style.borderColor = '#1a5276';
      input.style.background = '#0f3460';
      input.placeholder = '—';
      listening = false;
      input.blur();
      persistAll();
    });

    input.addEventListener('blur', () => {
      if (listening) {
        listening = false;
        input.style.borderColor = '#1a5276';
        input.style.background = '#0f3460';
        input.placeholder = input.value || '—';
      }
    });

    row.appendChild(label);
    row.appendChild(input);
    section.appendChild(row);
  });

  tabcontents.appendChild(section);

  // Load saved bindings
  loadBindings(bindings => {
    section.querySelectorAll('input[data-zoom]').forEach(inp => {
      if (bindings[inp.dataset.zoom]) inp.value = bindings[inp.dataset.zoom];
    });
  });

  function persistAll() {
    const bindings = {};
    section.querySelectorAll('input[data-zoom]').forEach(inp => {
      if (inp.value) bindings[inp.dataset.zoom] = inp.value;
    });
    saveBindings(bindings);
  }

  // Tab switching — rewire all buttons including Camera
  const btnMap = { soundbtn: 'soundsec', videobtn: 'videosec', inputbtn: 'inputsec', miscbtn: 'miscsec' };
  Object.entries(btnMap).forEach(([bHook, sHook]) => {
    const b = tabs.querySelector(`[data-hook="${bHook}"]`);
    const s = tabcontents.querySelector(`[data-hook="${sHook}"]`);
    if (!b || !s) return;
    // Clone to remove existing listeners, then re-add
    const clone = b.cloneNode(true);
    b.parentNode.replaceChild(clone, b);
    clone.addEventListener('click', () => activate(clone, s));
  });

  btn.addEventListener('click', () => activate(btn, section));

  function activate(activeBtn, activeSection) {
    tabs.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    tabcontents.querySelectorAll('.section').forEach(s => s.classList.remove('selected'));
    activeBtn.classList.add('selected');
    activeSection.classList.add('selected');
  }
}

// Observe the whole document for Settings panel appearing
const observer = new MutationObserver(() => {
  const tabs = document.querySelector('.dialog.settings-view .tabs');
  const tabcontents = document.querySelector('.dialog.settings-view .tabcontents');
  if (tabs && tabcontents) injectCameraTab(tabs, tabcontents);
});
observer.observe(document.body, { childList: true, subtree: true });

// Also try immediately in case it's already open
const tabs = document.querySelector('.dialog.settings-view .tabs');
const tabcontents = document.querySelector('.dialog.settings-view .tabcontents');
if (tabs && tabcontents) injectCameraTab(tabs, tabcontents);

// ─── Key listener ─────────────────────────────────────────────
document.addEventListener('keydown', function (e) {
  const tag = (document.activeElement || {}).tagName || '';
  if (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea') return;
  if (document.activeElement && document.activeElement.isContentEditable) return;

  // PageUp: leave room
  if (e.code === 'PageUp') {
    const menuBtn = document.querySelector('[data-hook="menu"]');
    if (!menuBtn) return;
    menuBtn.click();
    requestAnimationFrame(() => {
      const leaveBtn = document.querySelector('[data-hook="leave-btn"]');
      if (!leaveBtn) return;
      leaveBtn.click();
      requestAnimationFrame(() => {
        const confirmBtn = document.querySelector('[data-hook="leave"]');
        if (confirmBtn) confirmBtn.click();
      });
    });
    return;
  }

  // Camera shortcuts
  loadBindings(bindings => {
    for (const [zoom, key] of Object.entries(bindings)) {
      if (key && e.key === key) {
        setViewMode(zoom);
        break;
      }
    }
  });
});
