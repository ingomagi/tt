const itemMap = {
  prefix_pack_1: 'count-s1',
  prefix_pack_2: 'count-s2',
  prefix_pack_3: 'count-s3',
  prefix_pack_1_reset: 'count-cursed'
};

let inventory = {};
let running = false;

function updateUI() {
  for (const [id, elId] of Object.entries(itemMap)) {
    const element = document.getElementById(elId);
    const oldValue = element.textContent;
    const newValue = inventory[id] || 0;
    
    element.textContent = newValue;
    
    // Add pulse animation if value changed
    if (oldValue !== newValue.toString()) {
      const countElement = element.closest('.count');
      countElement.classList.add('updated');
      setTimeout(() => countElement.classList.remove('updated'), 300);
    }
  }
}

function requestInventory() {
  window.parent.postMessage({ type: 'getData' }, '*');
}

function sendTrackerMessage(msg) {
  window.parent.postMessage({
    type: "notification",
    text: msg
  }, "*");
}

window.addEventListener("message", (event) => {
  const msg = event.data;

  if (!window._initialDumped && typeof msg === "object") {
    console.log("📦 Full getData payload:\n" + JSON.stringify(msg, null, 2));
    window._initialDumped = true;
  }

  const invString = msg.inventory || msg?.data?.inventory || msg?.payload?.inventory;
  if (typeof invString === "string") {
    try {
      const inv = JSON.parse(invString);
      inventory = {};
      for (const id in itemMap) {
        inventory[id] = inv[id]?.amount || 0;
      }
      for (const id in inv) {
        if (id.startsWith("blessing_card|")) {
          inventory[id] = inv[id]?.amount || 0;
        }
      }
      updateUI();
    } catch (err) {
      console.error("Failed to parse inventory:", err);
    }
  }
});

async function useItem(id) {
  window.parent.postMessage({
    type: "sendCommand",
    command: `item ${id} use`
  }, "*");

  if (id === 'prefix_pack_1_reset') {
    await new Promise(res => setTimeout(res, 800));
  } else if (id === 'prefix_pack_1') {
    await new Promise(res => setTimeout(res, 600));
  } else {
    await new Promise(res => setTimeout(res, 150));
  }

  requestInventory();
  await new Promise(res => setTimeout(res, 150));
}

async function redeemBlessings() {
  requestInventory();
  await new Promise(r => setTimeout(r, 500));

  const fullKeys = Object.keys(inventory).filter(id => id.startsWith("blessing_card|"));
  const coreKeys = [...new Set(fullKeys.map(id => id.split("|").slice(0, 2).join("|")))];

  for (const core of coreKeys) {
    const matchingFullKey = fullKeys.find(k => k.startsWith(core + "|"));
    const blessingName = matchingFullKey?.split("|")[2] || "Unknown";

    let attempts = 0;
    let lastTotal = Infinity;

    while (true) {
      const total = fullKeys
        .filter(k => k.startsWith(core + "|"))
        .reduce((sum, k) => sum + (inventory[k] || 0), 0);

      if (total <= 0) break;

      if (total === lastTotal) {
        if (document.getElementById("auto-delete").checked) {
          window.parent.postMessage({
            type: "sendCommand",
            command: `item ${core} trash`
          }, "*");

          window.parent.postMessage({
            type: "forceSubmitValue",
            value: String(total)
          }, "*");

          sendTrackerMessage(`Blessing ~r~\"${blessingName}\"~s~ auto-deleted (failed to receive)`);

          await new Promise(r => setTimeout(r, 300));
          window.parent.postMessage({ type: "pin" }, "*");

          requestInventory();
          await new Promise(r => setTimeout(r, 300));
        } else {
          sendTrackerMessage(`Blessing ~r~\"${blessingName}\"~s~ could not be received`);
        }
        break;
      }

      lastTotal = total;

      window.parent.postMessage({
        type: "sendCommand",
        command: `item ${core} receive`
      }, "*");

      await new Promise(r => setTimeout(r, 1000));
      requestInventory();
      await new Promise(r => setTimeout(r, 500));

      attempts++;
    }

    console.log(`✅ Redeemed ${core} (${attempts} times)`);
  }
}


async function startOpening() {
  running = true;
  document.getElementById("start-btn").style.display = "none";
  document.getElementById("stop-btn").style.display = "block";

  const packs = ['prefix_pack_1', 'prefix_pack_2', 'prefix_pack_3'];

  requestInventory();
  await new Promise(r => setTimeout(r, 300));

  while (running) {
    let found = false;

    for (const packId of packs) {
        if ((inventory[packId] || 0) > 0) {
        if ((inventory['prefix_pack_1_reset'] || 0) > 0) {
            await useItem('prefix_pack_1_reset');

            await new Promise(r => setTimeout(r, 600));
            requestInventory();
            await new Promise(r => setTimeout(r, 600));
        } else {
            console.log("No cursed dice left. Stopping.");
            running = false;
            break;
        }

        if ((inventory[packId] || 0) > 0) {
            await useItem(packId);
            found = true;
            break;
        } else {
            console.log(`⚠️ No ${packId} left after dice, skipping`);
        }
        }

    }

    if (!found) break;
  }

  if (document.getElementById("auto-redeem").checked) {
    await redeemBlessings();
  }

  running = false;
  document.getElementById("start-btn").style.display = "block";
  document.getElementById("stop-btn").style.display = "none";
}

function stopOpening() {
  running = false;
  document.getElementById("start-btn").style.display = "block";
  document.getElementById("stop-btn").style.display = "none";
}

document.getElementById("start-btn").addEventListener("click", startOpening);
document.getElementById("stop-btn").addEventListener("click", stopOpening);
document.getElementById("redeem-btn").addEventListener("click", redeemBlessings);

const tracker = document.getElementById("tracker");
let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

tracker.addEventListener("mousedown", (e) => {
  isDragging = true;
  dragOffsetX = e.clientX - tracker.offsetLeft;
  dragOffsetY = e.clientY - tracker.offsetTop;
  
  // Prevent text selection while dragging
  e.preventDefault();
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
});

document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    e.preventDefault();
    tracker.style.left = `${e.clientX - dragOffsetX}px`;
    tracker.style.top = `${e.clientY - dragOffsetY}px`;
  }
});

document.addEventListener("mouseup", (e) => {
  if (isDragging) {
    localStorage.setItem("trackerPosX", tracker.style.left);
    localStorage.setItem("trackerPosY", tracker.style.top);
    
    // Re-enable text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
  }
  isDragging = false;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.parent.postMessage({ type: "pin" }, "*");
  }
});

const savedX = localStorage.getItem("trackerPosX");
const savedY = localStorage.getItem("trackerPosY");
if (savedX && savedY) {
  tracker.style.left = savedX;
  tracker.style.top = savedY;
}

requestInventory();