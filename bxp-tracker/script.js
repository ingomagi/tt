const SELECTED_JOBS_KEY = "bxp_selected_jobs";
const TRACKER_POSITION_KEY = "bxp_tracker_position";
const TRACKER_SIZE_KEY = "bxp_tracker_size";
const BXP_FONT_SIZE_KEY = "bxp-row-font-size";

const JOBS = [
  { key: "business", label: "Business" },
  { key: "cargopilot", label: "Cargo" },
  { key: "conductor", label: "Train" },
  { key: "emergency", label: "EMS" },
  { key: "farmer", label: "Farming" },
  { key: "fisher", label: "Fishing" },
  { key: "firefighter", label: "Firefighting" },
  { key: "garbage", label: "Garbage" },
  { key: "helicopterpilot", label: "Helicopter" },
  { key: "hunter", label: "Hunting" },
  { key: "mechanic", label: "Mechanic" },
  { key: "miner", label: "Mining" },
  { key: "pilot", label: "Airline" },
  { key: "player", label: "Player" },
  { key: "postop", label: "PostOP" },
  { key: "racer", label: "Racing" },
  { key: "strength", label: "Strength" },
  { key: "trucker", label: "Trucking" },
  { key: "busdriver", label: "Bus Driver" }
];

const JOB_BXP_KEYS = {
  trucker:       { bxpTokenKey: "exp_token_a|trucking|trucking", label: "Trucking BXP" },
  mechanic:      { bxpTokenKey: "exp_token_a|trucking|mechanic", label: "Mechanic BXP" },
  garbage:       { bxpTokenKey: "exp_token_a|trucking|garbage", label: "Garbage BXP" },
  postop:        { bxpTokenKey: "exp_token_a|trucking|postop", label: "PostOP BXP" },
  pilot:         { bxpTokenKey: "exp_token_a|piloting|piloting", label: "Airline BXP" },
  helicopterpilot:{ bxpTokenKey: "exp_token_a|piloting|heli", label: "Helicopter BXP" },
  cargopilot:    { bxpTokenKey: "exp_token_a|piloting|cargos", label: "Cargo BXP" },
  busdriver:     { bxpTokenKey: "exp_token_a|train|bus", label: "Bus Driver BXP" },
  conductor:     { bxpTokenKey: "exp_token_a|train|train", label: "Train BXP" },
  emergency:     { bxpTokenKey: "exp_token_a|ems|ems", label: "EMS BXP" },
  firefighter:   { bxpTokenKey: "exp_token_a|ems|fire", label: "Firefighting BXP" },
  racer:         { bxpTokenKey: "exp_token_a|player|racing", label: "Racing BXP" },
  farmer:        { bxpTokenKey: "exp_token_a|farming|farming", label: "Farming BXP" },
  fisher:        { bxpTokenKey: "exp_token_a|farming|fishing", label: "Fishing BXP" },
  miner:         { bxpTokenKey: "exp_token_a|farming|mining", label: "Mining BXP" },
  business:      { bxpTokenKey: "exp_token_a|business|business", label: "Business BXP" },
  hunter:        { bxpTokenKey: "exp_token_a|hunting|skill", label: "Hunting BXP" },
  player:        { bxpTokenKey: "exp_token_a|player|player", label: "Player BXP" },
  strength:      { bxpTokenKey: "exp_token_a|physical|strength", label: "Strength BXP" },
};


let selectedJobs = new Set();
let bxpLogs = {};
let lastBxp = {};
let hasFirstGain = {};

const jobListEl = document.getElementById('job-list');
const summaryTbody = document.getElementById('summary-tbody');
const settingsPanel = document.getElementById('settings-panel');
const settingsIcon = document.getElementById('settings-icon');
const toggleBxpHr = document.getElementById('toggle-bxp-hr');
const toggleBxpMin = document.getElementById('toggle-bxp-min');
const trackerApp = document.getElementById('tracker-app');
const resizeHandle = document.getElementById('resize-handle');

function loadBxpFontSize() {
  const size = localStorage.getItem(BXP_FONT_SIZE_KEY) || "13";
  document.getElementById("bxp-font-size").value = size;
  document.getElementById("bxp-font-size-value").textContent = size;
  document.getElementById("bxp-summary-table").style.setProperty("--bxp-row-font-size", size + "px");
}
function saveBxpFontSize(size) {
  localStorage.setItem(BXP_FONT_SIZE_KEY, size);
  document.getElementById("bxp-font-size-value").textContent = size;
  document.getElementById("bxp-summary-table").style.setProperty("--bxp-row-font-size", size + "px");
}
document.getElementById("bxp-font-size").addEventListener("input", function() {
  saveBxpFontSize(this.value);
});

(function enableResize() {
  let isResizing = false;
  let startX = 0, startY = 0, startW = 0, startH = 0;

  resizeHandle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = trackerApp.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (!isResizing) return;

    const newW = Math.max(300, Math.min(window.innerWidth, startW + (e.clientX - startX)));
    const newH = Math.max(120, Math.min(window.innerHeight, startH + (e.clientY - startY)));
    trackerApp.style.width = newW + "px";
    trackerApp.style.height = newH + "px";

    if (settingsPanel.style.display === 'block') {
      const trackerRect = trackerApp.getBoundingClientRect();
      settingsPanel.style.top = `${trackerRect.top}px`;
      settingsPanel.style.left = `${trackerRect.right + 10}px`;
    }
  });


  document.addEventListener('mouseup', function() {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
      localStorage.setItem(TRACKER_SIZE_KEY, JSON.stringify({
        width: trackerApp.style.width,
        height: trackerApp.style.height
      }));
      trackerApp.classList.add("user-resized");
    }
  });
})();

function restoreTrackerSize() {
  const size = localStorage.getItem(TRACKER_SIZE_KEY);
  if (size) {
    try {
      const { width, height } = JSON.parse(size);
      trackerApp.style.width = width;
      trackerApp.style.height = height;
      trackerApp.classList.add("user-resized");
    } catch {}
  } else {
    trackerApp.style.width = "auto";
    trackerApp.style.height = "auto";
    trackerApp.classList.remove("user-resized");
  }
}

function renderJobList() {
  jobListEl.innerHTML = '';
  const sortedJobs = [...JOBS].sort((a, b) => a.label.localeCompare(b.label));
  sortedJobs.forEach(job => {
    const label = document.createElement('label');
    label.className = 'job-checkbox-label';
    if (selectedJobs.has(job.key)) label.classList.add('selected');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = job.key;
    input.checked = selectedJobs.has(job.key);
    input.onchange = function() {
      if (this.checked) selectedJobs.add(job.key);
      else selectedJobs.delete(job.key);
      label.classList.toggle('selected', this.checked);
      saveSelectedJobs();
      renderSummary();
    };
    label.appendChild(input);
    label.appendChild(document.createTextNode(job.label));
    jobListEl.appendChild(label);
  });
}

function saveSelectedJobs() {
  localStorage.setItem(SELECTED_JOBS_KEY, JSON.stringify(Array.from(selectedJobs)));
}
function loadSelectedJobs() {
  try {
    const stored = JSON.parse(localStorage.getItem(SELECTED_JOBS_KEY));
    if (Array.isArray(stored)) {
      selectedJobs = new Set(stored);
    }
  } catch (e) {
    selectedJobs = new Set();
  }
}

function renderSummary() {
  summaryTbody.innerHTML = '';

  const showHr = toggleBxpHr.checked;
  const showMin = toggleBxpMin.checked;

  const table = document.getElementById('bxp-summary-table');
  const thead = table.querySelector('thead');
  thead.innerHTML = `
    <tr>
      <th>Job</th>
      <th>BXP</th>
      ${showHr ? '<th>BXP/hr</th>' : ''}
      ${showMin ? '<th>BXP/min</th>' : ''}
    </tr>
  `;

  selectedJobs.forEach(jobKey => {
    const jobObj = JOBS.find(j => j.key === jobKey);
    const bxp = typeof lastBxp[jobKey] === "number" ? lastBxp[jobKey] : 0;
    const bxpPerHour = getBxpPerHour(jobKey);
    const bxpPerMinute = getBxpPerMinute(jobKey);

    summaryTbody.innerHTML += `
      <tr>
        <td>${jobObj.label}</td>
        <td>${bxp.toLocaleString()}</td>
        ${showHr ? `<td>${bxpPerHour !== null ? bxpPerHour.toLocaleString() : '—'}</td>` : ''}
        ${showMin ? `<td>${bxpPerMinute !== null ? bxpPerMinute.toLocaleString() : '—'}</td>` : ''}
      </tr>
    `;
  });
}


function getBxpPerHour(jobKey) {
  const log = bxpLogs[jobKey] || [];
  if (!hasFirstGain[jobKey] || log.length < 2) return null;
  const now = Date.now();
  const [first, last] = [log[0], log[log.length-1]];
  const sessionDuration = last.time - first.time;
  const sessionBXP = last.bxp - first.bxp;
  const sessionHours = sessionDuration / 3600000;
  const sessionBXPH = sessionHours > 0 ? sessionBXP / sessionHours : 0;
  const RECENT_WINDOW_MS = 10 * 60 * 1000;
  const recentDrops = log.filter(entry => now - entry.time <= RECENT_WINDOW_MS);
  let recentBXPH = 0;
  if (recentDrops.length >= 2) {
    const recentFirst = recentDrops[0];
    const recentLast = recentDrops[recentDrops.length-1];
    const recentBXP = recentLast.bxp - recentFirst.bxp;
    const recentDuration = recentLast.time - recentFirst.time;
    const recentHours = recentDuration / 3600000;
    if (recentHours > 0) recentBXPH = recentBXP / recentHours;
  } else {
    return Math.round(sessionBXPH);
  }
  const sessionWeight = Math.min(sessionDuration / RECENT_WINDOW_MS, 1.0);
  const liveWeight = 1.0 - sessionWeight;
  const hybridBXPH = sessionBXPH * sessionWeight + recentBXPH * liveWeight;
  return Math.round(hybridBXPH);
}

function getBxpPerMinute(jobKey) {
  const perHour = getBxpPerHour(jobKey);
  return perHour !== null ? Math.round(perHour / 60) : null;
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "data" || !msg.data) return;

  const data = msg.data;

  let invObj;
  try {
    invObj = typeof data.inventory === "string" ? JSON.parse(data.inventory) : data.inventory;
  } catch (e) {
    console.warn("❌ Failed to parse inventory:", e);
    return;
  }

  if (!invObj || typeof invObj !== "object") {
    console.warn("⚠️ No valid inventory object.");
    return;
  }

  const now = Date.now();
  const allJobs = Object.keys(JOB_BXP_KEYS);

  allJobs.forEach(jobKey => {
    const jobInfo = JOB_BXP_KEYS[jobKey];
    if (!jobInfo) return;

    const expectedKey = jobInfo.bxpTokenKey;
    const altKey = expectedKey.replace("exp_token_a|", "exp_token|");

    const primaryAmount = invObj[expectedKey]?.amount ?? 0;
    const secondaryAmount = invObj[altKey]?.amount ?? 0;
    const combinedAmount = primaryAmount + secondaryAmount;

    if (primaryAmount === 0 && secondaryAmount === 0 && !(expectedKey in invObj) && !(altKey in invObj)) return;

    const amount = combinedAmount;

    if (!bxpLogs[jobKey]) bxpLogs[jobKey] = [];

    const previousAmount = lastBxp[jobKey];

    if (typeof previousAmount !== "number") {
      bxpLogs[jobKey].push({ time: now - 1000, bxp: amount });
      hasFirstGain[jobKey] = true;
    } else if (amount !== previousAmount) {
      // Check if BXP decreased (sold/given away)
      if (amount < previousAmount) {
        // BXP decreased - reset tracking to avoid negative rates
        console.log(`🔄 BXP decreased for ${jobKey}: ${previousAmount} → ${amount} (likely sold/given away)`);
        bxpLogs[jobKey] = [{ time: now, bxp: amount }];
        hasFirstGain[jobKey] = false; // Reset first gain flag
      } else {
        // BXP increased normally
        bxpLogs[jobKey].push({ time: now, bxp: amount });

        if (bxpLogs[jobKey].length > 120) {
          bxpLogs[jobKey] = bxpLogs[jobKey].slice(-120);
        }
      }
    }

    lastBxp[jobKey] = amount;
  });

  renderSummary();
});

function cleanJobKey(rawJob) {
  return rawJob.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function normalizeJobKey(rawJob) {
  const cleaned = cleanJobKey(rawJob);
  return JOB_BXP_KEYS[cleaned] ? cleaned : cleaned;
}

function updateSettingsPanelPosition() {
  const settings = document.getElementById("settings-panel");
  if (settings.style.display !== 'none') {
    const rect = trackerApp.getBoundingClientRect();
    settings.style.top = `${rect.top}px`;
    settings.style.left = `${rect.right + 10}px`;
  }
}

settingsIcon.onclick = () => {
  const settings = document.getElementById("settings-panel");
  const trackerRect = trackerApp.getBoundingClientRect();

  if (settings.style.display === 'none' || settings.style.display === '') {
    settings.style.position = 'absolute';
    settings.style.top = `${trackerRect.top}px`;
    settings.style.left = `${trackerRect.right + 10}px`;
    settings.style.display = 'block';
  } else {
    settings.style.display = 'none';
  }
};

document.getElementById('reset-bxp-log').onclick = () => {
  bxpLogs = {};
  hasFirstGain = {};
  lastBxp = {};
  renderSummary();
};
toggleBxpHr.onchange = toggleBxpMin.onchange = renderSummary;

(function enableDrag() {
  const dragHandle = document.getElementById('drag-handle');
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;

  dragHandle.addEventListener('mousedown', (e) => {
    if (e.target === settingsIcon) return;
    isDragging = true;
    const rect = trackerApp.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const newLeft = e.clientX - dragOffsetX;
      const newTop = e.clientY - dragOffsetY;

      trackerApp.style.left = `${newLeft}px`;
      trackerApp.style.top = `${newTop}px`;
      trackerApp.style.position = "absolute";

      localStorage.setItem(TRACKER_POSITION_KEY, JSON.stringify({
        left: trackerApp.style.left,
        top: trackerApp.style.top
      }));

      if (settingsPanel.style.display === 'block') {
        const trackerRect = trackerApp.getBoundingClientRect();
        settingsPanel.style.top = `${trackerRect.top}px`;
        settingsPanel.style.left = `${trackerRect.right + 10}px`;
      }
    }
  });


  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
})();

const escapeListener = (e) => {
  if (e.key === "Escape") {
    window.parent.postMessage({ type: "pin" }, "*");
  }
};
window.addEventListener('keydown', escapeListener);

document.getElementById('toggle-job-list').onclick = () => {
  const jobList = document.getElementById('job-list');
  const toggleBtn = document.getElementById('toggle-job-list');
  const currentlyVisible = jobList.style.display === 'flex';
  jobList.style.display = currentlyVisible ? 'none' : 'flex';
  toggleBtn.textContent = currentlyVisible ? '▶' : '▼';
};

document.getElementById("reloadButton").addEventListener("click", function () {
  window.location.reload();
});


function restoreTrackerPosition() {
  const pos = localStorage.getItem(TRACKER_POSITION_KEY);
  if (pos) {
    try {
      const { left, top } = JSON.parse(pos);
      trackerApp.style.left = left;
      trackerApp.style.top = top;
    } catch {}
  }
}

function init() {
  loadSelectedJobs();
  restoreTrackerPosition();
  restoreTrackerSize();
  loadBxpFontSize();

  try {
    const storedLogs = JSON.parse(localStorage.getItem("bxp_logs") || "{}");
    const storedLast = JSON.parse(localStorage.getItem("bxp_last") || "{}");
    const storedFirst = JSON.parse(localStorage.getItem("bxp_first") || "{}");

    bxpLogs = storedLogs;
    lastBxp = storedLast;
    hasFirstGain = storedFirst;
  } catch (e) {
    console.warn("⚠️ Failed to restore BXP data from localStorage");
  }

  renderJobList();
  renderSummary();

  window.parent.postMessage({ type: "getData" }, "*");
}


init();
