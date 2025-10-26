const UI = {
  app: document.getElementById('app'),
  toggleBtn: document.getElementById('toggleBtn'),
  greeting: document.getElementById('greeting'),
  closeBtn: document.getElementById('closeBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  coordStatus: document.getElementById('coordStatus'),
  x: document.getElementById('x'),
  y: document.getElementById('y'),
  labelInput: document.getElementById('labelInput'),
  saveBtn: document.getElementById('saveBtn'),
  sortSelect: document.getElementById('sortSelect'),
  wpSelect: document.getElementById('wpSelect'),
  loadBtn: document.getElementById('loadBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  lastAction: document.getElementById('lastAction'),
};

const STORAGE_KEY = 'tf_waypoints_v1';
const POSITION_KEY = 'tf_waypoint_position_v1';
let user = { user_id: null, name: null };
let lastCoords = null;

const nowStr = () => new Date().toLocaleString();
const toNum = (v) => v === '' ? null : Number(v);

function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function initDragFunctionality() {
  const panel = UI.app;
  const header = document.querySelector('.panel-header');
  
  loadSavedPosition();
  
  header.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
  
  header.style.cursor = 'move';
}

function startDrag(e) {
  isDragging = true;
  const rect = UI.app.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  e.preventDefault();
}

function drag(e) {
  if (!isDragging) return;
  
  const newX = e.clientX - dragOffset.x;
  const newY = e.clientY - dragOffset.y;
  
  const maxX = window.innerWidth - UI.app.offsetWidth;
  const maxY = window.innerHeight - UI.app.offsetHeight;
  
  const clampedX = Math.max(0, Math.min(newX, maxX));
  const clampedY = Math.max(0, Math.min(newY, maxY));
  
  UI.app.style.left = `${clampedX}px`;
  UI.app.style.top = `${clampedY}px`;
  UI.app.style.right = 'auto';
}

function stopDrag() {
  if (isDragging) {
    isDragging = false;
    savePanelPosition();
  }
}

function savePanelPosition() {
  const rect = UI.app.getBoundingClientRect();
  const position = {
    x: rect.left,
    y: rect.top
  };
  localStorage.setItem(POSITION_KEY, JSON.stringify(position));
}

function loadSavedPosition() {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      const position = JSON.parse(saved);
      UI.app.style.left = `${position.x}px`;
      UI.app.style.top = `${position.y}px`;
      UI.app.style.right = 'auto';
    }
  } catch (e) {
    console.warn('Failed to load saved position:', e);
  }
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function loadAllWaypoints() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveAllWaypoints(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function refreshDropdown() {
  const list = loadAllWaypoints();
  const sortType = UI.sortSelect.value;
  
  let sortedList = [...list];
  if (sortType === 'alphabetical') {
    sortedList.sort((a, b) => {
      const nameA = (a.label || 'Waypoint').toLowerCase();
      const nameB = (b.label || 'Waypoint').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } else if (sortType === 'distance' && lastCoords) {
    sortedList.sort((a, b) => {
      const distA = calculateDistance(lastCoords.x, lastCoords.y, a.x, a.y);
      const distB = calculateDistance(lastCoords.x, lastCoords.y, b.x, b.y);
      return distA - distB;
    });
  }
  
  UI.wpSelect.innerHTML = '<option value="">— Select waypoint —</option>';
  sortedList.forEach((wp, idx) => {
    const opt = document.createElement('option');
    const originalIdx = list.findIndex(original => 
      original.x === wp.x && original.y === wp.y && original.savedAt === wp.savedAt
    );
    opt.value = String(originalIdx);
    
    let displayText = `${wp.label || 'Waypoint'} (${wp.savedAt})`;
    
    if (sortType === 'distance' && lastCoords) {
      const distance = calculateDistance(lastCoords.x, lastCoords.y, wp.x, wp.y);
      displayText = `${wp.label || 'Waypoint'} - ${distance.toFixed(0)}m (${wp.savedAt})`;
    }
    
    opt.textContent = displayText;
    UI.wpSelect.appendChild(opt);
  });
}

function setGreeting() {
  const name = user?.name ?? 'Friend';
  const id = user?.user_id ?? '—';
  UI.greeting.textContent = `Heya ${name} (${id})`;
}

function setCoordInputs(coords) {
  if (!coords) return;
  lastCoords = coords;
  UI.x.value = typeof coords.x === 'number' ? coords.x.toFixed(3) : '';
  UI.y.value = typeof coords.y === 'number' ? coords.y.toFixed(3) : '';
  
  if (UI.sortSelect.value === 'distance') {
    refreshDropdown();
  }
}

function requestCoords() {
  UI.coordStatus.textContent = 'Requesting coords…';
  window.parent.postMessage({ type: 'getData' }, '*');
}

function sendSetWaypoint(x, y) {
  window.parent.postMessage({ type: 'setWaypoint', x: x, y: y }, '*');
}

function requestUserData() {
  window.parent.postMessage({ type: 'getData' }, '*');
}

function showUI(forceVisible = true) {
  UI.app.classList.toggle('hidden', !forceVisible);
  UI.app.setAttribute('aria-hidden', String(!forceVisible));
  
  UI.toggleBtn.classList.toggle('hidden', forceVisible);
  
  if (forceVisible) {
    requestUserData();
    requestCoords();
  }
}
function toggleUI() {
  const hidden = UI.app.classList.contains('hidden');
  showUI(hidden);
}

UI.toggleBtn.addEventListener('click', () => showUI(true));
UI.closeBtn.addEventListener('click', () => showUI(false));
UI.refreshBtn.addEventListener('click', requestCoords);

UI.sortSelect.addEventListener('change', () => {
  refreshDropdown();
});

UI.saveBtn.addEventListener('click', () => {
  const x = toNum(UI.x.value), y = toNum(UI.y.value);
  if ([x, y].some(v => typeof v !== 'number' || Number.isNaN(v))) {
    UI.lastAction.textContent = '⚠️ Invalid or missing coordinates.';
    return;
  }
  const label = UI.labelInput.value.trim();
  const list = loadAllWaypoints();
  list.push({
    label,
    x, y,
    savedAt: nowStr(),
    by: user?.user_id ?? null,
  });
  saveAllWaypoints(list);
  refreshDropdown();
  UI.labelInput.value = '';
  UI.lastAction.textContent = `✅ Saved waypoint${label ? ` "${label}"` : ''}.`;
});

UI.loadBtn.addEventListener('click', () => {
  const idx = UI.wpSelect.value === '' ? -1 : Number(UI.wpSelect.value);
  const list = loadAllWaypoints();
  if (idx < 0 || idx >= list.length) {
    UI.lastAction.textContent = '⚠️ No waypoint selected.';
    return;
  }
  const wp = list[idx];
  sendSetWaypoint(wp.x, wp.y);
  UI.lastAction.textContent = `📍 Loaded waypoint${wp.label ? ` "${wp.label}"` : ''}.`;
});

UI.deleteBtn.addEventListener('click', () => {
  const idx = UI.wpSelect.value === '' ? -1 : Number(UI.wpSelect.value);
  const list = loadAllWaypoints();
  if (idx < 0 || idx >= list.length) {
    UI.lastAction.textContent = '⚠️ Nothing to delete.';
    return;
  }
  const [removed] = list.splice(idx, 1);
  saveAllWaypoints(list);
  refreshDropdown();
  UI.lastAction.textContent = `🗑 Deleted ${removed?.label ? `"${removed.label}"` : 'waypoint'}.`;
});

window.addEventListener('keydown', (e) => {
  if (e.key === '`') toggleUI();
  if (e.key === 'Escape') {
    window.parent.postMessage({type: "pin"}, "*");
  }
});

window.addEventListener('message', (event) => {
  let data = event.data;

  if (data && typeof data === 'object' && data.type === 'data' && data.data && typeof data.data === 'object') {
    data = data.data;
  }

  if (data && typeof data === 'object' && ('user_id' in data || 'name' in data || 'pos_x' in data)) {
    const userId = data.user_id ?? data.id;
    const name = data.name;
    
    if (userId) user.user_id = userId;
    if (name) user.name = name;
    setGreeting();

    const x = data.pos_x;
    const y = data.pos_y;
    const z = data.pos_z;
    const h = data.pos_h;

    if (typeof x === 'number' && typeof y === 'number') {
      setCoordInputs({ x, y, z: typeof z === 'number' ? z : 0, h: typeof h === 'number' ? h : null });
      UI.coordStatus.textContent = `Coords loaded @ ${new Date().toLocaleTimeString()}`;
    } else {
      UI.coordStatus.textContent = `⚠️ No coordinates received.`;
    }
  }
});

(function init() {
  refreshDropdown();
  requestUserData();

  initDragFunctionality();

  showUI(true);
})();
