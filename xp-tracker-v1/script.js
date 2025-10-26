let hasWelcomed = false;
let lastBonusXP = null;
let lastInventoryObj = null;
let hasReceivedAnyData = false;
let hasRequestedOnce = false;

function getAllRequiredKeys() {
  const expKeys = Object.values(JOB_EXP_KEYS).map(job => job.key);
  
  // Get BXP token keys (convert from exp keys to token format)
  const bxpKeys = Object.values(JOB_EXP_KEYS).map(job => {
    const expKey = job.key;
    return `exp_token_a|${expKey.replace("exp_", "").replace(/_/g, "|")}`;
  });
  
  const otherKeys = ["inventory", "job_name", "job", "name"];
  
  return [...expKeys, ...bxpKeys, ...otherKeys];
}

function getOptimizedKeysForJob(jobKey) {
  // If we know the specific job, only request data for that job
  if (jobKey && JOB_EXP_KEYS[jobKey]) {
    const jobInfo = JOB_EXP_KEYS[jobKey];
    const expKey = jobInfo.key;
    const bxpKey = `exp_token_a|${expKey.replace("exp_", "").replace(/_/g, "|")}`;
    const otherKeys = ["inventory", "job_name", "job", "name"];
    
    return [expKey, bxpKey, ...otherKeys];
  }
  
  // Fallback to all keys if job unknown
  return getAllRequiredKeys();
}


function sendTrackerMessage(msg) {
  window.parent.postMessage({
    type: "notification",
    text: `~g~[XP Tracker]~s~ ${msg}`
  }, "*");
}

function requestDataOnce(force = false, specificJobKey = null) {
  if (hasRequestedOnce && !force) return;
  hasRequestedOnce = true;
  try {
    // Use optimized keys if we know the specific job, otherwise get all keys
    const keys = specificJobKey ? getOptimizedKeysForJob(specificJobKey) : getAllRequiredKeys();
    window.parent.postMessage({ 
      type: "getNamedData",
      keys: keys
    }, "*");
  } catch (e) {
    console.error("Failed to send message to parent:", e);
    // Fallback to old method
    window.parent.postMessage({ type: "getData" }, "*");
  }
}

function sendWelcomeMessages(userName) {
  sendTrackerMessage(`Welcome ${userName}`);
  setTimeout(() => {
    sendTrackerMessage(`If the XP/hr starts to get inaccurate, open the settings and click ~r~"Reset EXP Tracking"~s~`);
  }, 3000);
}

const jobEl = document.getElementById('job-header');
const expEl = document.getElementById('total-exp');
const levelEl = document.getElementById('level');
const levelExpEl = document.getElementById('level-exp');
const popup = document.getElementById('xp-gain-popup');
const bonusXPEl = document.getElementById("bonus-xp");

let lastJobKey = null;
let lastExp = null;
let expLog = [];
let hasFirstGain = false;
let initialExpValue = null;

function showXPGain(amount) {
  const showDrops = document.getElementById("toggle-xp-drops").checked;
  if (!popup || !showDrops) return;

  popup.classList.remove("show");
  void popup.offsetWidth;
  popup.textContent = `+${amount.toLocaleString()} XP`;
  popup.classList.add("show");

  setTimeout(() => popup.classList.remove("show"), 800);
}

function getLevelInfo(exp) {
  let level = 0;
  let xpCap = 5;
  while (exp >= xpCap) {
    exp -= xpCap;
    level++;
    xpCap = (level + 1) * 5;
  }
  return { level, expInLevel: exp, expForNext: xpCap };
}

function cleanJobKey(rawJob) {
  return rawJob.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeJobKey(rawJob) {
  const cleaned = rawJob.toLowerCase().replace(/[^a-z0-9]/g, '');
  return JOB_ALIASES[cleaned] || cleaned;
}

function updateStatToggles(currentExp, bonusXP = null) {
  const perkChanceEl = document.getElementById("perk-chance");
  const ephEl = document.getElementById("exp-per-hour");
  const epmEl = document.getElementById("exp-per-minute");
  const millionEl = document.getElementById("exp-to-million");
  const actionsUntil1MEl = document.getElementById("actions-until-1m");

  let perkText = "—";
  if (currentExp >= 1_000_000) {
    perkText = "Guaranteed";
  } else if (expLog.length >= 2) {
    const last = expLog[expLog.length - 1];
    const prev = expLog[expLog.length - 2];
    const earnedExp = last.exp - prev.exp;
    if (earnedExp > 0) {
      const chance = (1_000_000 - last.exp) / earnedExp;
      perkText = chance <= 1
        ? "Guaranteed"
        : `1 in ${Math.round(chance).toLocaleString()}`;
    }
  }

  perkChanceEl.textContent = perkText;

  // Calculate actions until 1M
  let actionsText = "—";
  if (currentExp >= 1_000_000) {
    actionsText = "Complete";
  } else if (expLog.length >= 2) {
    const last = expLog[expLog.length - 1];
    const prev = expLog[expLog.length - 2];
    const earnedExp = last.exp - prev.exp;
    if (earnedExp > 0) {
      const xpNeeded = 1_000_000 - currentExp;
      const actionsNeeded = Math.ceil(xpNeeded / earnedExp);
      actionsText = actionsNeeded.toLocaleString();
    }
  }

  actionsUntil1MEl.textContent = actionsText;

  const eph = getExpPerHour();
  const epm = getExpPerMinute();
  ephEl.textContent = eph ? eph.toLocaleString() : "—";
  epmEl.textContent = epm ? epm.toLocaleString() : "—";

  const pct = Math.min(100, Math.max(0, (currentExp / 1_000_000) * 100));
  
  let color = "white";
  if (pct < 30) color = "red";
  else if (pct < 70) color = "yellow";
  else color = "limegreen";

  millionEl.innerHTML = `<span style="color:${color}">${pct.toFixed(2)}%</span>`;

  const tenMillionEl = document.getElementById("exp-to-ten-million");
  const pct10M = Math.min(100, Math.max(0, (currentExp / 10_000_000) * 100));

  let color10M = "white";
  if (pct10M < 30) color10M = "red";
  else if (pct10M < 70) color10M = "yellow";
  else color10M = "limegreen";

  if (tenMillionEl) {
    tenMillionEl.innerHTML = `<span style="color:${color10M}">${pct10M.toFixed(2)}%</span>`;
  }

  const bonusToggleChecked = document.getElementById("toggle-bonus")?.checked;
  const bonusXPRow = bonusXPEl.closest('tr');

  if (bonusXP != null) {
    lastBonusXP = bonusXP;
  } else {
    bonusXPEl.innerHTML = "—";
    if (bonusXPRow) bonusXPRow.style.display = bonusToggleChecked ? "table-row" : "none";
  }

  if (bonusXP != null) {
    let bxpColor = "white";
    if (bonusXP <= 5000) bxpColor = "red";
    else if (bonusXP <= 10000) bxpColor = "yellow";
    else bxpColor = "limegreen";

    bonusXPEl.innerHTML = `<span style="color:${bxpColor}">${bonusXP.toLocaleString()}</span>`;
    if (bonusXPRow) bonusXPRow.style.display = bonusToggleChecked ? "table-row" : "none";
  } else {
    bonusXPEl.innerHTML = "—";
    if (bonusXPRow) bonusXPRow.style.display = bonusToggleChecked ? "table-row" : "none";
  }
}


const RECENT_WINDOW_MS = 10 * 60 * 1000;

function getExpPerHour() {
  if (!hasFirstGain || expLog.length < 2) return null;
  const now = Date.now();
  const [first, last] = [expLog[0], expLog[expLog.length - 1]];
  const sessionDuration = last.time - first.time;
  const sessionXP = last.exp - first.exp;
  const sessionHours = sessionDuration / 3600000;
  const sessionXPH = sessionHours > 0 ? sessionXP / sessionHours : 0;

  const recentDrops = expLog.filter(entry => now - entry.time <= RECENT_WINDOW_MS);
  let recentXPH = 0;
  if (recentDrops.length >= 2) {
    const recentFirst = recentDrops[0];
    const recentLast = recentDrops[recentDrops.length - 1];
    const recentXP = recentLast.exp - recentFirst.exp;
    const recentDuration = recentLast.time - recentFirst.time;
    const recentHours = recentDuration / 3600000;
    if (recentHours > 0) {
      recentXPH = recentXP / recentHours;
    }
  } else {
    return Math.round(sessionXPH);
  }

  const sessionWeight = Math.min(sessionDuration / RECENT_WINDOW_MS, 1.0);
  const liveWeight = 1.0 - sessionWeight;
  const hybridXPH = sessionXPH * sessionWeight + recentXPH * liveWeight;
  return Math.round(hybridXPH);
}

function getExpPerMinute() {
  const perHour = getExpPerHour();
  return perHour !== null ? Math.round(perHour / 60) : null;
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "data" || !msg.data) return;

  // Track that we've received data
  hasReceivedAnyData = true;

  const now = new Date();
  const data = msg.data;
  const rawJob = data.job_name || data.job || localStorage.getItem("last-valid-job") || "unknown";
  const jobDisplay = rawJob;
  const rawJobKey = cleanJobKey(rawJob);
  const jobKey = normalizeJobKey(rawJob);

  const jobInfo = JOB_EXP_KEYS[jobKey];
  if (!jobInfo) return;

  const expectedExpKey = jobInfo.key;
  const jobToken = `exp_token_a|${expectedExpKey.replace("exp_", "").replace(/_/g, "|")}`;

  let bonusXP = null;
  let invObj = null;

  if (data.inventory) {
    try {
      invObj = typeof data.inventory === "string" ? JSON.parse(data.inventory) : data.inventory;
      if (invObj) lastInventoryObj = invObj;
    } catch {}
  } else if (lastInventoryObj) {
    invObj = lastInventoryObj;
  }

  if (invObj && jobToken in invObj && typeof invObj[jobToken].amount === "number") {
    bonusXP = invObj[jobToken].amount;
  } else {
    bonusXP = null;
    lastBonusXP = null;
  }


  const playerName = data.name || "Player";
  if (!hasWelcomed && playerName) {
    sendWelcomeMessages(playerName);
    hasWelcomed = true;
  }

  if (rawJobKey !== lastJobKey) {
    jobEl.textContent = `Job: ${jobDisplay}`;
    localStorage.setItem("last-valid-job", rawJob);
    lastJobKey = rawJobKey;
    lastExp = null;

    ["perk-chance", "exp-per-hour", "exp-per-minute", "exp-to-million", "exp-to-ten-million", "actions-until-1m"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });

    expLog = [];
    hasFirstGain = false;
    initialExpValue = null;

    requestDataOnce(true, jobKey); // Force a new request for the specific new job
  }

  const jobExpRaw = data[expectedExpKey];
  if (typeof jobExpRaw !== "number") return;
  const exp = jobExpRaw;

  const { level, expInLevel, expForNext } = getLevelInfo(exp);
  expEl.textContent = Math.round(exp).toLocaleString();
  levelEl.textContent = level;
  const xpToNext = Math.round(expForNext - expInLevel);
  levelExpEl.textContent = `${xpToNext.toLocaleString()} XP`;

  if (initialExpValue === null) initialExpValue = exp;
  if (!hasFirstGain && exp !== initialExpValue) hasFirstGain = true;

  if (lastExp !== null && exp > lastExp) {
    const gain = exp - lastExp;
    showXPGain(gain);
    expLog.push({ time: now, exp });
    if (expLog.length === 1) {
      expLog.unshift({ time: new Date(now.getTime() - 5000), exp: initialExpValue ?? exp - gain });
    }
    updateStatToggles(exp, bonusXP);
  } else {
    updateStatToggles(exp, bonusXP);
  }

  lastExp = exp;
});


// Initial data request with optimization
requestDataOnce();

// Retry mechanism if no data received within 3 seconds
setTimeout(() => {
  if (!hasReceivedAnyData) {
    requestDataOnce(true);
  }
}, 3000);


const trackerWindow = document.getElementById("tracker-window");
let isDragging = false;
let offsetX = 0, offsetY = 0;

const savedPos = JSON.parse(localStorage.getItem("tracker-position"));
if (savedPos && typeof savedPos.x === "number" && typeof savedPos.y === "number") {
  trackerWindow.style.left = `${savedPos.x}px`;
  trackerWindow.style.top = `${savedPos.y}px`;
}

trackerWindow.addEventListener("mousedown", (e) => {
  isDragging = true;
  offsetX = e.clientX - trackerWindow.offsetLeft;
  offsetY = e.clientY - trackerWindow.offsetTop;
});
document.addEventListener("mouseup", () => isDragging = false);
document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    trackerWindow.style.left = `${newX}px`;
    trackerWindow.style.top = `${newY}px`;
    localStorage.setItem("tracker-position", JSON.stringify({ x: newX, y: newY }));
  }
});

document.getElementById("reset-exp-log").addEventListener("click", () => {
  expLog = [];
  hasFirstGain = false;
  initialExpValue = lastExp;
  ["perk-chance", "exp-per-hour", "exp-per-minute", "exp-to-million", "exp-to-ten-million", "actions-until-1m"].forEach(id => {
    document.getElementById(id).textContent = "—";
  });
});

document.getElementById("settings-icon").addEventListener("click", () => {
  const panel = document.getElementById("settings-panel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.parent.postMessage({ type: "pin" }, "*");
  }
});

const settingIds = ["million", "ten-million", "perk", "actions-1m", "eph", "epm", "xp-drops", "bonus"];
settingIds.forEach(id => {
  const checkbox = document.getElementById(`toggle-${id}`);
  const displayEl = document.getElementById(
    id === "bonus" ? "bonus-xp" :
    id === "million" ? "exp-to-million" :
    id === "ten-million" ? "exp-to-ten-million" :
    id === "eph" ? "exp-per-hour" :
    id === "epm" ? "exp-per-minute" :
    id === "perk" ? "perk-chance" :
    id === "actions-1m" ? "actions-until-1m" : "xp-gain-popup"
  );

  const savedState = localStorage.getItem(`toggle-${id}`);
  if (savedState !== null) {
    checkbox.checked = savedState === "true";
    if (id !== "xp-drops") {
      if (id === "bonus") {
        const bonusRow = displayEl.closest('tr');
        if (bonusRow) bonusRow.style.display = checkbox.checked ? "table-row" : "none";
      } else if (id === "million") {
        const statToggleRows = document.querySelectorAll('.stat-toggle');
        statToggleRows.forEach(row => {
          if (row.querySelector(`#${displayEl.id}`)) {
            row.style.display = checkbox.checked ? "table-row" : "none";
          }
        });
      } else if (id === "ten-million") {
        const statToggleRows = document.querySelectorAll('.stat-toggle');
        statToggleRows.forEach(row => {
          if (row.querySelector(`#${displayEl.id}`)) {
            row.style.display = checkbox.checked ? "table-row" : "none";
          }
        });
      } else {
        const statToggleRows = document.querySelectorAll('.stat-toggle');
        statToggleRows.forEach(row => {
          if (row.querySelector(`#${displayEl.id}`)) {
            row.style.display = checkbox.checked ? "table-row" : "none";
          }
        });
      }
    }
  }

  checkbox.addEventListener("change", () => {
    localStorage.setItem(`toggle-${id}`, checkbox.checked);
    if (id !== "xp-drops") {
      if (id === "bonus") {
        const bonusRow = displayEl.closest('tr');
        if (bonusRow) bonusRow.style.display = checkbox.checked ? "table-row" : "none";
      } else if (id === "million") {
        const statToggleRows = document.querySelectorAll('.stat-toggle');
        statToggleRows.forEach(row => {
          if (row.querySelector(`#${displayEl.id}`)) {
            row.style.display = checkbox.checked ? "table-row" : "none";
          }
        });
      } else if (id === "ten-million") {
        const statToggleRows = document.querySelectorAll('.stat-toggle');
        statToggleRows.forEach(row => {
          if (row.querySelector(`#${displayEl.id}`)) {
            row.style.display = checkbox.checked ? "table-row" : "none";
          }
        });
      } else {
        const statToggleRows = document.querySelectorAll('.stat-toggle');
        statToggleRows.forEach(row => {
          if (row.querySelector(`#${displayEl.id}`)) {
            row.style.display = checkbox.checked ? "table-row" : "none";
          }
        });
      }
    }
  });
});

const transparencySlider = document.getElementById("transparency-slider");
const savedOpacity = localStorage.getItem("ui-opacity");
const tableHud = document.querySelector('.table-hud');

if (savedOpacity) {
  transparencySlider.value = savedOpacity;
  const value = parseFloat(savedOpacity);
  if (tableHud) {
    if (value < 0.1) {
      tableHud.style.background = 'transparent';
      tableHud.style.border = 'none';
      tableHud.style.borderRadius = '0';
      
      const allCells = tableHud.querySelectorAll('th, td');
      allCells.forEach(cell => {
        cell.style.background = 'transparent';
        cell.style.border = 'none';
        cell.style.borderTop = 'none';
        cell.style.borderBottom = 'none';
        cell.style.borderLeft = 'none';
        cell.style.borderRight = 'none';
      });
      
      tableHud.style.boxShadow = 'none';
      if (tableHud.parentElement) {
        tableHud.parentElement.style.background = 'transparent';
        tableHud.parentElement.style.border = 'none';
        tableHud.parentElement.style.borderRadius = '0';
      }
    } else {
      tableHud.style.background = `rgba(20, 24, 28, ${value})`;
      tableHud.style.border = `1px solid rgba(255,255,255,${value * 0.06})`;
      const headerCell = tableHud.querySelector('thead th');
      if (headerCell) {
        headerCell.style.background = `rgba(255,255,255,${value * 0.03})`;
        headerCell.style.borderBottom = `1px solid rgba(255,255,255,${value * 0.08})`;
      }
    }
  }
}

transparencySlider.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  localStorage.setItem("ui-opacity", value);
  
  if (tableHud) {
    if (value < 0.1) {
      tableHud.style.background = 'transparent';
      tableHud.style.border = 'none';
      tableHud.style.borderRadius = '0';
      
      const allCells = tableHud.querySelectorAll('th, td');
      allCells.forEach(cell => {
        cell.style.background = 'transparent';
        cell.style.border = 'none';
        cell.style.borderTop = 'none';
        cell.style.borderBottom = 'none';
        cell.style.borderLeft = 'none';
        cell.style.borderRight = 'none';
      });
      
      tableHud.style.boxShadow = 'none';
      tableHud.parentElement.style.background = 'transparent';
      tableHud.parentElement.style.border = 'none';
      tableHud.parentElement.style.borderRadius = '0';
    } else {
      tableHud.style.background = `rgba(20, 24, 28, ${value})`;
      tableHud.style.border = `1px solid rgba(255,255,255,${value * 0.06})`;
      tableHud.style.borderRadius = '10px';
      
      const headerCells = tableHud.querySelectorAll('thead th');
      const bodyCells = tableHud.querySelectorAll('tbody td');
      
      headerCells.forEach(th => {
        th.style.background = `rgba(255,255,255,${value * 0.03})`;
        th.style.borderBottom = `1px solid rgba(255,255,255,${value * 0.08})`;
      });
      
      bodyCells.forEach(td => {
        td.style.borderTop = `1px solid rgba(255,255,255,${value * 0.06})`;
      });
      
      if (tableHud.parentElement) {
        tableHud.parentElement.style.borderRadius = '10px';
      }
    }
  }
});

const JOB_ALIASES = {
  trucker: "trucker", mechanic: "mechanic", garbagecollector: "garbage",
  postopdriver: "postop", airlinepilot: "pilot", helicopterpilot: "helicopterpilot",
  cargopilot: "cargopilot", busdriver: "busdriver", trainconductor: "conductor",
  emsparamedic: "emergency",  aerialfirefighter: "firefighter", firefighter: "firefighter", businesses: "citizen",
  streetracer: "racer", farmer: "farmer", fisherman: "fisher", miner: "miner",
  wildlifehunter: "hunter", postopemployee: "postop", rtsaviator: "business", rtsprofessional: "business", rtstransporter: "business", collinscocabbies: "business",
};

const JOB_EXP_KEYS = {
  trucker: { key: "exp_trucking_trucking", label: "Trucking EXP" },
  mechanic: { key: "exp_trucking_mechanic", label: "Mechanic EXP" },
  garbage: { key: "exp_trucking_garbage", label: "Garbage EXP" },
  postop: { key: "exp_trucking_postop", label: "PostOP EXP" },
  pilot: { key: "exp_piloting_piloting", label: "Airline EXP" },
  helicopterpilot: { key: "exp_piloting_heli", label: "Helicopter EXP" },
  cargopilot: { key: "exp_piloting_cargos", label: "Cargo EXP" },
  busdriver: { key: "exp_train_bus", label: "Bus EXP" },
  conductor: { key: "exp_train_train", label: "Train EXP" },
  emergency: { key: "exp_ems_ems", label: "EMS EXP" },
  firefighter: { key: "exp_ems_fire", label: "Firefighting EXP" },
  racer: { key: "exp_player_racing", label: "Racing EXP" },
  farmer: { key: "exp_farming_farming", label: "Farming EXP" },
  fisher: { key: "exp_farming_fishing", label: "Fishing EXP" },
  miner: { key: "exp_farming_mining", label: "Mining EXP" },
  business: { key: "exp_business_business", label: "Business EXP" },
  hunter: { key: "exp_hunting_skill", label: "Hunting EXP" }
};
