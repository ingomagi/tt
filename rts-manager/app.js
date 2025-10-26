let inventory = {};
let autoDeleteEnabled = false;
let autoBackpackEnabled = false;
let deleteInterval = null;
let pendingDeletes = new Map(); 
let pendingBackpackOpen = false;
let init_load = false; 


function loadSettings() {
  // Remove localStorage loading - always start with both modes disabled
  autoDeleteEnabled = false;
  autoBackpackEnabled = false;
  updateUI();
}


function saveSettings() {
  // Remove localStorage saving - settings are session-only now
}

function updateUI() {
  const deleteCheckbox = document.getElementById("auto-delete-checkbox");
  const backpackCheckbox = document.getElementById("auto-backpack-checkbox");
  const status = document.getElementById("status");
  const rtsCount = document.getElementById("rts-count");
  
  
  deleteCheckbox.checked = autoDeleteEnabled;
  backpackCheckbox.checked = autoBackpackEnabled;
  
  
  if (autoDeleteEnabled) {
    status.textContent = `Mode: AUTO DELETE`;
    status.className = `status enabled`;
  } else if (autoBackpackEnabled) {
    status.textContent = `Mode: AUTO BACKPACK`;
    status.className = `status enabled`;
  } else {
    status.textContent = `Mode: DISABLED`;
    status.className = `status disabled`;
  }
  
  
  const rtsCards = Object.keys(inventory).filter(id => id.startsWith("rts_card|"));
  const totalRTS = rtsCards.reduce((sum, id) => sum + (inventory[id] || 0), 0);
  rtsCount.textContent = `RTS Cards: ${totalRTS}`;
  
  
  const manualDeleteBtn = document.getElementById("manual-delete");
  const manualBackpackBtn = document.getElementById("manual-backpack");
  manualDeleteBtn.disabled = totalRTS === 0;
  manualBackpackBtn.disabled = totalRTS === 0;
}

function requestInventory() {
  window.parent.postMessage({ type: 'getData' }, '*');
}

function sendTrackerMessage(msg) {
  window.parent.postMessage({
    type: "notification",
    text: `~r~[RTS Manager]~s~ ${msg}`
  }, "*");
}

window.addEventListener("message", (event) => {
  const msg = event.data;

  const invString = msg.inventory || msg?.data?.inventory || msg?.payload?.inventory;
  if (typeof invString === "string") {
    try {
      const inv = JSON.parse(invString);
      const previousInventory = { ...inventory };
      inventory = {};
      
      
      for (const id in inv) {
        if (id.startsWith("rts_card|")) {
          const currentAmount = inv[id]?.amount || 0;
          const previousAmount = previousInventory[id] || 0;
          
          inventory[id] = currentAmount;
          
          
          if (currentAmount > previousAmount && (autoDeleteEnabled || autoBackpackEnabled)) {
            const addedAmount = currentAmount - previousAmount;

            
            const delay = 3000 + Math.random() * 2000; 
            
            
            if (pendingDeletes.has(id)) {
              clearTimeout(pendingDeletes.get(id));
            }
            
            
            const timeoutId = setTimeout(() => {
              if ((autoDeleteEnabled || autoBackpackEnabled) && inventory[id] > 0) {

                if (autoDeleteEnabled) {
                  deleteRTSCard(id, inventory[id]);
                } else if (autoBackpackEnabled) {
                  backpackRTSCard(id, inventory[id]);
                }
              }
              pendingDeletes.delete(id);
            }, delay);
            
            pendingDeletes.set(id, timeoutId);
          }
        }
      }
      
      updateUI();
      
    } catch (err) {
      console.error("Failed to parse inventory:", err);
    }
  }
});

async function deleteRTSCard(cardId, amount) {
  try {
    
    if (pendingDeletes.has(cardId)) {
      clearTimeout(pendingDeletes.get(cardId));
      pendingDeletes.delete(cardId);
    }
    
    
    const baseId = cardId.split('|').slice(0, 2).join('|');
    
    
    window.parent.postMessage({
      type: "sendCommand",
      command: `item ${baseId} trash`
    }, "*");

    
    await new Promise(r => setTimeout(r, 200));
    window.parent.postMessage({
      type: "forceSubmitValue", 
      value: amount.toString()
    }, "*");

    return true;
  } catch (err) {
    console.error(`Failed to delete ${cardId}:`, err);
    return false;
  }
}

async function backpackRTSCard(cardId, amount) {
  return new Promise((resolve) => {
    try {
      if (pendingDeletes.has(cardId)) {
        clearTimeout(pendingDeletes.get(cardId));
        pendingDeletes.delete(cardId);
      }

      const baseId = cardId.split('|').slice(0, 2).join('|');
      let step = 0;
      let timeoutId = null;
      
      // Get all RTS cards to process in sequence
      const allRTSCards = Object.keys(inventory).filter(id => 
        id.startsWith("rts_card|") && (inventory[id] || 0) > 0
      );
      let currentCardIndex = allRTSCards.indexOf(cardId);

      const cleanup = () => {
        window.removeEventListener("message", messageHandler);
        if (timeoutId) clearTimeout(timeoutId);
      };

      const messageHandler = async (event) => {
        const evt = event.data;
        const menuName = evt?.data?.menu;


        // Step 1: Wait for Main menu to open
        if (step === 1 && /main\s*menu/i.test(menuName || "")) {
          step = 2;

          // Click "Open Backpack" (try a couple variants quickly)
          ["Open Backpack", "Backpack", "Open backpack"].forEach((lbl, i) => {
            setTimeout(() => {
              window.parent.postMessage({
                type: "forceMenuChoice",
                choice: lbl,
                mod: 0
              }, "*");
            }, i * 200);
          });
          return;
        }

        // Step 2: Wait for backpack menu to open (initial or return)
        if (step === 2 && /backpack/i.test(menuName || "")) {
          step = 3;

          // Select "Put" from the backpack menu choices
          window.parent.postMessage({
            type: "forceMenuChoice",
            choice: "<span sort='A'></span>Put",
            mod: 0
          }, "*");
          return;
        }

        // Handle return to backpack menu after putting an item
        if (step === 5 && /backpack/i.test(menuName || "")) {
          
          // Mark the current card as processed now that we're back at backpack menu
          inventory[cardId] = 0;
          
          // Check if there are more RTS cards to process
          const remainingRTS = Object.keys(inventory).filter(id => 
            id.startsWith("rts_card|") && (inventory[id] || 0) > 0
          );
          
          if (remainingRTS.length > 0) {
            const nextCard = remainingRTS[0];
            const nextAmount = inventory[nextCard] || 0;
            
            // Reset to step 3 to select "Put" again
            step = 3;
            window.parent.postMessage({
              type: "forceMenuChoice",
              choice: "<span sort='A'></span>Put",
              mod: 0
            }, "*");
            
            // Update current card being processed
            cardId = nextCard;
            amount = nextAmount;
            currentCardIndex++;
            return;
          } else {
            // No more RTS cards, finish
            cleanup();
            resolve(true);
            return;
          }
        }

        // Step 3: Wait for Put menu to open, then select RTS card
        if (step === 3 && /put/i.test(menuName || "")) {
          step = 4;
          
          // Use the full R.T.S. Card format with HTML styling
          const vehicleName = cardId.split('|')[2];
          const rtsChoice = `R.T.S. Card: <span style="color:orange">${vehicleName}</span>`;
          window.parent.postMessage({
            type: "forceMenuChoice",
            choice: rtsChoice,
            mod: -1
          }, "*");

          // Set step to wait for backpack return (don't update inventory yet)
          step = 5;

          return;
        }
      };

      // Start listening (like your original working version)
      window.addEventListener("message", messageHandler);

      // Kick it off
      step = 1;
      window.parent.postMessage({ type: "openMainMenu" }, "*");

      // Safety timeout
      timeoutId = setTimeout(() => {
        cleanup();
        console.error(`⏳ Timeout backpacking ${cardId} (stuck at step ${step})`);
        resolve(false);
      }, 12000);

    } catch (err) {
      console.error(`Failed to backpack ${cardId}:`, err);
      resolve(false);
    }
  });
}


async function autoDeleteRTSCards() {
  if (!autoDeleteEnabled) return;
  
  const rtsCards = Object.keys(inventory).filter(id => 
    id.startsWith("rts_card|") && (inventory[id] || 0) > 0
  );
  
  if (rtsCards.length === 0) return;
  
  let deletedCount = 0;
  
  for (const cardId of rtsCards) {
    const amount = inventory[cardId] || 0;
    if (amount > 0) {
      const success = await deleteRTSCard(cardId, amount);
      if (success) {
        deletedCount += amount;
        
        inventory[cardId] = 0;
      }
      
      // 1 second delay between each card to prevent kicks
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  if (deletedCount > 0) {
    sendTrackerMessage(`Auto-deleted ${deletedCount} RTS cards`);
    
  }
}

async function autoBackpackRTSCards() {
  if (!autoBackpackEnabled) return;
  
  const rtsCards = Object.keys(inventory).filter(id => 
    id.startsWith("rts_card|") && (inventory[id] || 0) > 0
  );
  
  if (rtsCards.length === 0) return;
  
  // Calculate total before processing (since backpackRTSCard handles all cards in one session)
  const totalRTS = rtsCards.reduce((sum, id) => sum + (inventory[id] || 0), 0);
  
  // Just process the first card - it will handle all cards in sequence
  const firstCard = rtsCards[0];
  const success = await backpackRTSCard(firstCard, inventory[firstCard]);
  
  // Wait a bit longer before sending notification to ensure menu has closed
  setTimeout(() => {
    if (success) {
      sendTrackerMessage(`Auto-backpacked ${totalRTS} RTS cards`);
    }
  }, 2000);
}

async function manualDeleteAllRTS() {
  const rtsCards = Object.keys(inventory).filter(id => 
    id.startsWith("rts_card|") && (inventory[id] || 0) > 0
  );
  
  if (rtsCards.length === 0) {
    sendTrackerMessage("No RTS cards to delete");
    return;
  }
  
  let deletedCount = 0;
  
  for (const cardId of rtsCards) {
    const amount = inventory[cardId] || 0;
    if (amount > 0) {
      const success = await deleteRTSCard(cardId, amount);
      if (success) {
        deletedCount += amount;
        inventory[cardId] = 0;
      }
      
      // 1 second delay between each card to prevent kicks
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  sendTrackerMessage(`Manually deleted ${deletedCount} RTS cards`);
  
  
}

async function manualBackpackAllRTS() {
  const rtsCards = Object.keys(inventory).filter(id => 
    id.startsWith("rts_card|") && (inventory[id] || 0) > 0
  );
  
  if (rtsCards.length === 0) {
    sendTrackerMessage("No RTS cards to backpack");
    return;
  }
  
  // Calculate total before processing
  const totalRTS = rtsCards.reduce((sum, id) => sum + (inventory[id] || 0), 0);
  
  // Just process the first card - it will handle all cards in sequence
  const firstCard = rtsCards[0];
  const success = await backpackRTSCard(firstCard, inventory[firstCard]);
  
  // Wait a bit longer before sending notification to ensure menu has closed
  setTimeout(() => {
    if (success) {
      sendTrackerMessage(`Manually backpacked ${totalRTS} RTS cards`);
    }
  }, 2000);
}


document.getElementById("auto-delete-checkbox").addEventListener("change", (e) => {
  autoDeleteEnabled = e.target.checked;
  
  // If auto-delete is enabled, disable auto-backpack
  if (autoDeleteEnabled && autoBackpackEnabled) {
    const backpackCheckbox = document.getElementById("auto-backpack-checkbox");
    backpackCheckbox.checked = false;
    autoBackpackEnabled = false;
  }
  
  // Remove saveSettings() call - settings are session-only now
  updateUI();
  
  if (autoDeleteEnabled) {
    sendTrackerMessage("Auto-delete mode ~g~ENABLED~s~");
  } else {
    sendTrackerMessage("Auto-delete mode ~r~DISABLED~s~");
    
    // Clear pending actions only if both modes are disabled
    if (!autoBackpackEnabled) {
      for (const [cardId, timeoutId] of pendingDeletes) {
        clearTimeout(timeoutId);
      }
      pendingDeletes.clear();
    }
  }
});

document.getElementById("auto-backpack-checkbox").addEventListener("change", (e) => {
  autoBackpackEnabled = e.target.checked;
  
  // If auto-backpack is enabled, disable auto-delete
  if (autoBackpackEnabled && autoDeleteEnabled) {
    const deleteCheckbox = document.getElementById("auto-delete-checkbox");
    deleteCheckbox.checked = false;
    autoDeleteEnabled = false;
  }
  
  // Remove saveSettings() call - settings are session-only now
  updateUI();
  
  if (autoBackpackEnabled) {
    sendTrackerMessage("Auto-backpack mode ~g~ENABLED~s~");
  } else {
    sendTrackerMessage("Auto-backpack mode ~r~DISABLED~s~");
    
    // Clear pending actions only if both modes are disabled
    if (!autoDeleteEnabled) {
      for (const [cardId, timeoutId] of pendingDeletes) {
        clearTimeout(timeoutId);
      }
      pendingDeletes.clear();
    }
  }
});

document.getElementById("manual-delete").addEventListener("click", manualDeleteAllRTS);
document.getElementById("manual-backpack").addEventListener("click", manualBackpackAllRTS);


const tracker = document.getElementById("tracker");
const minimizeBtn = document.getElementById("minimize-btn");
let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

tracker.addEventListener("mousedown", (e) => {
  
  if (e.target.closest(".checkbox-wrapper") || 
      e.target.closest(".manual-delete") || 
      e.target.closest(".manual-backpack") || 
      e.target.closest(".minimize-btn")) return;
  
  isDragging = true;
  const rect = tracker.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  
  e.preventDefault();
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
});

document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    e.preventDefault();
    
    
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;
    
    
    const trackerRect = tracker.getBoundingClientRect();
    const trackerWidth = trackerRect.width;
    const trackerHeight = trackerRect.height;
    
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    
    newX = Math.max(0, Math.min(newX, viewportWidth - trackerWidth));
    newY = Math.max(0, Math.min(newY, viewportHeight - trackerHeight));
    
    tracker.style.left = `${newX}px`;
    tracker.style.top = `${newY}px`;
  }
});

document.addEventListener("mouseup", (e) => {
  if (isDragging) {
    localStorage.setItem("trackerPosX", tracker.style.left);
    localStorage.setItem("trackerPosY", tracker.style.top);
    
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
  }
  isDragging = false;
});


function toggleMinimize() {
  const isMinimized = tracker.classList.contains('minimized');
  tracker.classList.toggle('minimized');
  minimizeBtn.textContent = isMinimized ? '−' : '+';
  minimizeBtn.setAttribute('aria-label', isMinimized ? 'Minimize panel' : 'Expand panel');
  
  
  localStorage.setItem('rts-deleter-minimized', (!isMinimized).toString());
}


function restoreMinimizedState() {
  const savedMinimized = localStorage.getItem('rts-deleter-minimized');
  if (savedMinimized === 'true') {
    tracker.classList.add('minimized');
    minimizeBtn.textContent = '+';
    minimizeBtn.setAttribute('aria-label', 'Expand panel');
  }
}


minimizeBtn.addEventListener('click', (e) => {
  e.stopPropagation(); 
  toggleMinimize();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.parent.postMessage({ type: "pin" }, "*");
  }
});


const savedX = localStorage.getItem("trackerPosX");
const savedY = localStorage.getItem("trackerPosY");
if (savedX && savedY) {
  
  let x = parseInt(savedX);
  let y = parseInt(savedY);
  
  
  setTimeout(() => {
    const trackerRect = tracker.getBoundingClientRect();
    const trackerWidth = trackerRect.width;
    const trackerHeight = trackerRect.height;
    
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    
    x = Math.max(0, Math.min(x, viewportWidth - trackerWidth));
    y = Math.max(0, Math.min(y, viewportHeight - trackerHeight));
    
    tracker.style.left = `${x}px`;
    tracker.style.top = `${y}px`;
  }, 50);
}


loadSettings();
restoreMinimizedState();
requestInventory(); 


