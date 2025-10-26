const REQUIRED_JOB = "fisher";
let isFisherJob = false;
let isMonitoring = false;
let lastWeight = null;
let lastMaxWeight = null;
let lastTrunkWeight = null;
let lastTrunkCap = null;
let lastInventoryObj = null;
let hasWarnedJob = false;
let lastPrintedWeight = null;
let lastFishMeat = 0;
let guttedCount = 0;
let lastRawFishTotal = 0;
let lastPotCrabCount = 0;
let hasWarnedKnife = false;

const KNIFE_COMMANDS = {
  "gut_knife_auto": "item gut_knife_auto gut",
  "gut_knife_st": "item gut_knife_st gut",
  "gut_knife_fade": "item gut_knife_fade gut",
  "gut_knife_tiger": "item gut_knife_tiger gut",
  "gut_knife_lore": "item gut_knife_lore gut",
  "gut_knife": "item gut_knife gut",
};

const FISH_KEYS = [
  "fish_angelfish", "fish_cod", "fish_frogfish", "fish_gobies", "fish_lobster",
  "fish_mackerel", "fish_monster_octopus", "fish_monster_shark", "fish_monster_whale",
  "fish_kingcrab", "fish_saithe", "fish_salmon", "fish_crab", "fish_trout"
];

window.state = { cache: {} };

function log(msg) {
  if (localStorage.getItem("enableLog") === "false") return;
  const logBox = document.getElementById("log");
  const time = new Date().toLocaleTimeString();
  logBox.textContent += `[${time}] ${msg}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function toggleUI(visible) {
  document.getElementById("draggableWindow").style.display = visible ? "block" : "none";
}

function sendNotification(msg) {
  window.parent.postMessage({
    type: "notification",
    text: `~g~[Inventory Monitor]~s~ ${msg}`
  }, "*");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sleepUntil(check, retries = 30, delay = 250) {
  return new Promise(async (resolve, reject) => {
    while (retries-- > 0) {
      if (check()) return resolve();
      await sleep(delay);
    }
    reject("Timeout waiting for condition");
  });
}

function updateHUD(weight, maxWeight, trunkWeight = null, trunkCapacity = null) {
  const status = document.getElementById("status-inv");
  const trunk = document.getElementById("status-trunk");
  const fish = document.getElementById("status-fish");

  const roundedWeight = weight !== null ? weight.toFixed(1) : "--";
  const roundedMax = maxWeight !== null ? maxWeight.toFixed(1) : "--";
  const invPercent = (weight && maxWeight) ? ((weight / maxWeight) * 100).toFixed(1) : "--";

  status.textContent = `📦 Inventory: ${roundedWeight} / ${roundedMax} (${invPercent}%)`;

  if (trunk && trunkWeight !== null && trunkCapacity !== null) {
    const roundedTrunkWeight = trunkWeight.toFixed(1);
    const roundedTrunkCap = trunkCapacity.toFixed(1);
    const trunkPercent = ((trunkWeight / trunkCapacity) * 100).toFixed(1);

    trunk.textContent = `🚚 Trunk: ${roundedTrunkWeight} / ${roundedTrunkCap} (${trunkPercent}%)`;
  }

  fish.textContent = `🐟 Fish Meat: ${guttedCount}`;
}


function startFlashing() {
  const el = document.getElementById("draggableWindow");
  let flashing = true;
  let isRed = true;

  el.classList.add("trunk-full");

  const interval = setInterval(() => {
    if (!flashing) return clearInterval(interval);
    el.style.borderColor = isRed ? "red" : "#4caf50";
    el.style.boxShadow = isRed ? "0 0 12px red" : "0 0 12px #4caf50";
    isRed = !isRed;
  }, 500);

  return () => {
    flashing = false;
    el.classList.remove("trunk-full");
    el.style.borderColor = "#4caf50";
    el.style.boxShadow = "0 0 12px #4caf50";
  };
}

async function monitorInventory() {
  isMonitoring = true;
  let stopFlash = null;

  while (isMonitoring) {
    const weight = lastWeight;
    const maxWeight = lastMaxWeight;
    const trunkWeight = lastTrunkWeight;
    const trunkCapacity = lastTrunkCap;

    if (!isFisherJob) {
  await sleep(1000);
  continue;
}

    if (weight === null || maxWeight === null) {
      await sleep(500);
      continue;
    }

    updateHUD(weight, maxWeight, trunkWeight, trunkCapacity);


    if (weight !== lastPrintedWeight) {
      log(`📦 Inventory: ${weight.toFixed(1)} / ${maxWeight} (${((weight / maxWeight) * 100).toFixed(1)}%)`);
      lastPrintedWeight = weight;
    }

    const crabMode = localStorage.getItem("crabMode") === "true";
    const hasCrab = lastInventoryObj?.["fish_crabpot"]?.amount > 0;

    const trunkFull = trunkWeight !== null && trunkCapacity !== null && (trunkWeight + weight > trunkCapacity);

    const enableTrunkWarn = localStorage.getItem("enableTrunkWarn") !== "false";

    if (trunkFull) {
      if (enableTrunkWarn) {
        if (!stopFlash) stopFlash = startFlashing();
      } else if (stopFlash) {
        stopFlash();
        stopFlash = null;
      }
      log("❌ Cannot dump: Trunk is full!");
    } else if (stopFlash) {
      stopFlash();
      stopFlash = null;
    }

    if ((weight / maxWeight) >= 0.85) {
      if (trunkFull) {
        log("🚫 Skipping Put All due to full trunk.");
        } else if (crabMode && (lastInventoryObj?.["fish_potcrab"]?.amount ?? 0) > 0) {
          log(`🦀 Crab mode: Still have ${lastInventoryObj["fish_potcrab"].amount} crab(s). Waiting...`);
        } else {
        log("⚠️ Inventory over 85%. Dumping to trunk...");
        window.parent.postMessage({ type: "sendCommand", command: "rm_trunk" }, "*");
        window.parent.postMessage({ type: "getData" }, "*");
        log("🚪 Opened trunk");

        let putAllSucceeded = false;
        let putAllAttempts = 0;

        while (!putAllSucceeded && putAllAttempts < 2) {
          putAllAttempts++;
          log(`🧪 Attempt ${putAllAttempts} to execute Put All...`);

          try {
            await sleepUntil(() => {
              const open = window.state?.cache?.menu_open;
              const choices = window.state?.cache?.menu_choices ?? [];
              return open && choices.some(choice =>
                choice[0]?.replace(/(<.+?>)|(&#.+?;)/g, '') === 'Put All'
              );
            }, 40, 250);

            const option = (window.state.cache.menu_choices ?? []).find(
              a => a[0]?.replace(/(<.+?>)|(&#.+?;)/g, '') === 'Put All'
            )?.[0];

            if (option) {
              window.parent.postMessage({ type: 'forceMenuChoice', choice: option, mod: 0 }, '*');
              log('✅ Executed Put All via userapp API.');
              await sleep(1000);
              window.parent.postMessage({ type: 'forceMenuBack' }, '*');
              log('🔙 Closed trunk menu via forceMenuBack.');
              putAllSucceeded = true;
            } else {
              log('❌ Could not find "Put All" option.');
            }
          } catch (e) {
            log(`❌ Attempt ${putAllAttempts} failed: ${e}`);
          }

          if (!putAllSucceeded && putAllAttempts < 2) {
            log("🔁 Retrying Put All...");
            await sleep(1000);
          }
        }

        if (!putAllSucceeded) {
          log("❌ Abandoning Put All after 2 failed attempts.");
        }

        await sleep(5000);
      }
    }

    await sleep(2000);
  }
}

window.addEventListener("message", (event) => {
  const data = event.data?.data;
  if (!data || typeof data !== 'object') return;

  for (const [key, value] of Object.entries(data)) {
    if (key === 'menu_choices') {
      try {
        window.state.cache[key] = JSON.parse(value ?? '[]');
      } catch {
        window.state.cache[key] = [];
      }
    } else {
      window.state.cache[key] = value;
    }
  }

  const job = data.job?.toLowerCase();
  if (job) {
    if (job !== REQUIRED_JOB) {
      isFisherJob = false;
      if (!hasWarnedJob) {
        hasWarnedJob = true;
        toggleUI(false);
        sendNotification("UI hidden due to job not being Fishing");
      }
      return;
    } else {
      isFisherJob = true;
      if (hasWarnedJob) {
        hasWarnedJob = false;
        sendNotification("✅ UI re-enabled. Job is Fishing.");
      }
      toggleUI(true);
    }
  }

  if (typeof data.weight === "number") lastWeight = data.weight;
  if (typeof data.max_weight === "number") lastMaxWeight = data.max_weight;
  if (typeof data.trunkWeight === "number") lastTrunkWeight = data.trunkWeight;
  if (typeof data.trunkCapacity === "number") lastTrunkCap = data.trunkCapacity;

  let invObj = null;
  if (data.inventory) {
    try {
      invObj = typeof data.inventory === "string" ? JSON.parse(data.inventory) : data.inventory;
      if (invObj) lastInventoryObj = invObj;
    } catch {}
  } else if (lastInventoryObj) {
    invObj = lastInventoryObj;
  }

  if (invObj) {
    const currentMeat = invObj["fish_meat"]?.amount ?? 0;
    const meatDiff = currentMeat - lastFishMeat;

    if (meatDiff > 0) {
      guttedCount += meatDiff;
      updateHUD(lastWeight, lastMaxWeight);
    }

    lastFishMeat = currentMeat;

    const currentRawFishTotal = FISH_KEYS.reduce((sum, key) => sum + (invObj[key]?.amount || 0), 0);
    const hasNewFish = currentRawFishTotal > lastRawFishTotal;
    lastRawFishTotal = currentRawFishTotal;

    const currentPotCrabs = invObj["fish_potcrab"]?.amount ?? 0;
    const hasNewPotCrabs = currentPotCrabs > lastPotCrabCount;
    const firstDetection = lastPotCrabCount === 0 && currentPotCrabs > 0;
    lastPotCrabCount = currentPotCrabs;

      if (hasNewFish) {
        const knifeId = localStorage.getItem("gutKnife");
        if (knifeId && KNIFE_COMMANDS[knifeId]) {
          const hasKnife = Object.keys(invObj).some(k => k.startsWith(knifeId));

          if (hasKnife) {
            window.parent.postMessage({
              type: "sendCommand",
              command: KNIFE_COMMANDS[knifeId]
            }, "*");
            log(`🔪 Gutting fish with ${knifeId}`);
            hasWarnedKnife = false;
          } else if (!hasWarnedKnife) {
            sendNotification(`❌ Missing gut knife: ${knifeId}`);
            log(`❌ Cannot gut: Missing ${knifeId} in inventory.`);
            hasWarnedKnife = true;
          }
        }
      }

      if (hasNewPotCrabs || firstDetection) {
        const knifeId = localStorage.getItem("gutKnife");
        if (knifeId && KNIFE_COMMANDS[knifeId]) {
          const hasKnife = Object.keys(invObj).some(k => k.startsWith(knifeId));

          if (hasKnife) {
            window.parent.postMessage({
              type: "sendCommand",
              command: KNIFE_COMMANDS[knifeId]
            }, "*");
            log(`🔪 Gutting pot crabs with ${knifeId}`);
            hasWarnedKnife = false;
          } else if (!hasWarnedKnife) {
            sendNotification(`❌ Missing gut knife: ${knifeId}`);
            log(`❌ Cannot gut: Missing ${knifeId} in inventory.`);
            hasWarnedKnife = true;
          }
        }
      }
  }
});


window.onload = () => {
  toggleUI(false);
  window.parent.postMessage({ type: "getData" }, "*");
  monitorInventory();
};
