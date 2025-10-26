// Farm Discord Notifier - Main App Logic
let settings = {
    apiKey: '',
    discordEnabled: false,
    feedNotifications: true,
    collectNotifications: true,
    checkInterval: 5, // minutes
    discordConnected: false,
    lastNotificationTimes: {} // Track when we last sent notifications for each animal
};

let animals = [];
let checkTimer = null;
let nextCheckTime = null;
let discordWebhook = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    updateUI();
    setupDragAndDrop();
    
    // Load saved API key and start if available
    if (settings.apiKey) {
        startMonitoring();
    }
});

function loadSettings() {
    const saved = localStorage.getItem('farm-discord-notifier-settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
    
    // Load form values
    document.getElementById('api-key').value = settings.apiKey || '';
    document.getElementById('discord-enabled').checked = settings.discordEnabled;
    document.getElementById('feed-notifications').checked = settings.feedNotifications;
    document.getElementById('collect-notifications').checked = settings.collectNotifications;
    document.getElementById('check-interval').value = settings.checkInterval;
}

function saveSettings() {
    // Get values from form
    settings.apiKey = document.getElementById('api-key').value.trim();
    settings.discordEnabled = document.getElementById('discord-enabled').checked;
    settings.feedNotifications = document.getElementById('feed-notifications').checked;
    settings.collectNotifications = document.getElementById('collect-notifications').checked;
    settings.checkInterval = parseInt(document.getElementById('check-interval').value) || 5;
    
    // Save to localStorage
    localStorage.setItem('farm-discord-notifier-settings', JSON.stringify(settings));
    
    // Restart monitoring with new settings
    if (settings.apiKey) {
        startMonitoring();
        updateStatus('Settings saved! Monitoring started.', 'enabled');
    } else {
        updateStatus('API key required to start monitoring.', 'warning');
    }
    
    updateUI();
}

function updateUI() {
    // Update Discord status
    const indicator = document.getElementById('discord-indicator');
    const statusText = document.getElementById('discord-status-text');
    
    if (settings.discordConnected) {
        indicator.classList.add('connected');
        statusText.textContent = 'Discord connected';
    } else {
        indicator.classList.remove('connected');
        statusText.textContent = 'Discord not connected';
    }
    
    // Update connect button
    const connectBtn = document.getElementById('connect-discord-btn');
    if (settings.discordConnected) {
        connectBtn.textContent = 'Disconnect Discord';
        connectBtn.className = 'btn btn-danger';
    } else {
        connectBtn.textContent = 'Connect Discord';
        connectBtn.className = 'btn btn-discord';
    }
}

function updateStatus(message, type = 'disabled') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
}

async function connectDiscord() {
    if (settings.discordConnected) {
        // Disconnect
        settings.discordConnected = false;
        discordWebhook = null;
        updateStatus('Discord disconnected.', 'warning');
    } else {
        // Connect via Discord OAuth
        try {
            // This would typically involve Discord OAuth flow
            // For now, we'll simulate a connection
            await initiateDiscordConnection();
        } catch (error) {
            console.error('Discord connection failed:', error);
            updateStatus('Discord connection failed.', 'error');
        }
    }
    
    updateUI();
    saveSettings();
}

async function initiateDiscordConnection() {
    // In a real implementation, this would:
    // 1. Open Discord OAuth window
    // 2. Get user authorization
    // 3. Receive webhook URL or DM permissions
    
    // For demonstration, we'll simulate this
    const confirmed = confirm(
        'Discord Connection:\n\n' +
        'This will redirect you to Discord to authorize the application. ' +
        'The app will need permission to send you direct messages.\n\n' +
        'Click OK to continue to Discord (simulated).'
    );
    
    if (confirmed) {
        // Simulate successful connection
        setTimeout(() => {
            settings.discordConnected = true;
            updateStatus('Discord connected successfully!', 'enabled');
            updateUI();
            saveSettings();
        }, 1000);
        
        updateStatus('Connecting to Discord...', 'warning');
    }
}

async function fetchAnimals() {
    if (!settings.apiKey) {
        throw new Error('API key not configured');
    }
    
    try {
        const response = await fetch('https://tycoon-njyvop.users.cfx.re/status/farming/animals.json', {
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data.animals || [];
    } catch (error) {
        console.error('Failed to fetch animals:', error);
        throw error;
    }
}

function formatAnimalName(intName) {
    const names = {
        'farm_chickens': 'Chickens',
        'farm_pigs': 'Pigs',
        'farm_cows_small': 'Small Cows',
        'farm_cows_medium': 'Medium Cows',
        'farm_cows_large': 'Large Cows'
    };
    return names[intName] || intName;
}

function getTimeUntil(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Ready now';
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function getAnimalStatus(animal) {
    const now = Math.floor(Date.now() / 1000);
    const feedTime = animal.feed_time;
    const collectionTime = animal.collection_time;
    
    if (!animal.isOwned) return 'not-owned';
    
    // Check if needs feeding (feed_level is 0 and feed_time has passed)
    if (animal.feed_level === 0 && feedTime > 0 && now >= feedTime) {
        return 'needs-feeding';
    }
    
    // Check if ready to collect
    if (collectionTime > 0 && now >= collectionTime) {
        return 'ready-collect';
    }
    
    // Check if feeding/collection is soon (within 30 minutes)
    const nextEvent = Math.min(
        feedTime > now ? feedTime : Infinity,
        collectionTime > now ? collectionTime : Infinity
    );
    
    if (nextEvent !== Infinity && nextEvent - now <= 1800) { // 30 minutes
        return 'soon';
    }
    
    return 'waiting';
}

function updateAnimalDisplay() {
    const animalList = document.getElementById('animal-list');
    
    if (animals.length === 0) {
        animalList.innerHTML = '<div class="info-text">No animal data available. Check your API key.</div>';
        return;
    }
    
    animalList.innerHTML = animals.map(animal => {
        if (!animal.isOwned) return '';
        
        const name = formatAnimalName(animal.int_name);
        const status = getAnimalStatus(animal);
        const now = Math.floor(Date.now() / 1000);
        
        let statusText = '';
        let statusClass = '';
        
        switch (status) {
            case 'needs-feeding':
                statusText = 'FEED NOW';
                statusClass = 'ready';
                break;
            case 'ready-collect':
                statusText = 'COLLECT';
                statusClass = 'ready';
                break;
            case 'soon':
                const nextFeed = animal.feed_time > now ? animal.feed_time : null;
                const nextCollect = animal.collection_time > now ? animal.collection_time : null;
                const nextEvent = Math.min(nextFeed || Infinity, nextCollect || Infinity);
                statusText = nextEvent !== Infinity ? getTimeUntil(nextEvent) : 'Soon';
                statusClass = 'soon';
                break;
            default:
                statusText = 'Waiting';
                statusClass = 'waiting';
        }
        
        return `
            <div class="animal-item">
                <span class="animal-name">${name}</span>
                <span class="animal-status ${statusClass}">${statusText}</span>
            </div>
        `;
    }).filter(Boolean).join('');
}

async function checkAnimalsAndNotify() {
    try {
        animals = await fetchAnimals();
        updateAnimalDisplay();
        
        if (settings.discordEnabled && settings.discordConnected) {
            await sendNotificationsIfNeeded();
        }
        
        updateStatus(`Last checked: ${new Date().toLocaleTimeString()}`, 'enabled');
    } catch (error) {
        console.error('Error checking animals:', error);
        updateStatus(`Error: ${error.message}`, 'error');
        animals = [];
        updateAnimalDisplay();
    }
}

async function sendNotificationsIfNeeded() {
    const now = Math.floor(Date.now() / 1000);
    const notifications = [];
    
    for (const animal of animals) {
        if (!animal.isOwned) continue;
        
        const animalId = animal.int_name;
        const lastNotified = settings.lastNotificationTimes[animalId] || 0;
        
        // Don't spam - only notify once every 30 minutes for the same condition
        if (now - lastNotified < 1800) continue;
        
        const status = getAnimalStatus(animal);
        const name = formatAnimalName(animal.int_name);
        
        if (status === 'needs-feeding' && settings.feedNotifications) {
            notifications.push(`🍽️ **${name}** need feeding!`);
            settings.lastNotificationTimes[animalId] = now;
        } else if (status === 'ready-collect' && settings.collectNotifications) {
            notifications.push(`💰 **${name}** are ready to collect!`);
            settings.lastNotificationTimes[animalId] = now;
        }
    }
    
    if (notifications.length > 0) {
        await sendDiscordNotification(notifications.join('\n'));
        // Save updated notification times
        localStorage.setItem('farm-discord-notifier-settings', JSON.stringify(settings));
    }
}

async function sendDiscordNotification(message) {
    // In a real implementation, this would send a DM via Discord API
    // For demonstration, we'll log it and show a browser notification
    
    console.log('Discord notification:', message);
    
    // Show browser notification as fallback/demonstration
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('Farm Alert', {
                body: message.replace(/\*\*/g, '').replace(/🍽️|💰/g, ''),
                icon: 'https://tidalfaction.com/tidal.png'
            });
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification('Farm Alert', {
                    body: message.replace(/\*\*/g, '').replace(/🍽️|💰/g, ''),
                    icon: 'https://tidalfaction.com/tidal.png'
                });
            }
        }
    }
}

function startMonitoring() {
    stopMonitoring();
    
    if (!settings.apiKey) {
        updateStatus('API key required to start monitoring.', 'warning');
        return;
    }
    
    // Initial check
    checkAnimalsAndNotify();
    
    // Schedule regular checks
    checkTimer = setInterval(checkAnimalsAndNotify, settings.checkInterval * 60 * 1000);
    
    // Update next check time
    updateNextCheckTime();
    
    updateStatus('Monitoring active', 'enabled');
}

function stopMonitoring() {
    if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
    }
    nextCheckTime = null;
    updateNextCheckDisplay();
}

function updateNextCheckTime() {
    if (checkTimer) {
        nextCheckTime = new Date(Date.now() + settings.checkInterval * 60 * 1000);
        updateNextCheckDisplay();
        
        // Update the display every second
        setTimeout(() => {
            if (checkTimer) {
                updateNextCheckDisplay();
                updateNextCheckTime();
            }
        }, 1000);
    }
}

function updateNextCheckDisplay() {
    const nextNotificationEl = document.getElementById('next-notification');
    
    if (!nextCheckTime) {
        nextNotificationEl.textContent = 'Next check: Not scheduled';
        return;
    }
    
    const now = new Date();
    const diff = nextCheckTime - now;
    
    if (diff <= 0) {
        nextNotificationEl.textContent = 'Next check: Now';
        return;
    }
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    nextNotificationEl.textContent = `Next check: ${minutes}m ${seconds}s`;
}

function testNotification() {
    if (!settings.discordConnected) {
        updateStatus('Connect Discord first to test notifications.', 'warning');
        return;
    }
    
    sendDiscordNotification('🧪 Test notification from Farm Discord Notifier!');
    updateStatus('Test notification sent!', 'enabled');
}

// Drag and drop functionality
function setupDragAndDrop() {
    const tracker = document.getElementById('tracker');
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    tracker.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.closest('.minimize-btn') || e.target.closest('.btn') || e.target.closest('.form-input') || e.target.closest('.checkbox')) {
            return;
        }
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === tracker || e.target.closest('.header')) {
            isDragging = true;
            tracker.style.cursor = 'grabbing';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            
            tracker.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }

    function dragEnd() {
        if (isDragging) {
            isDragging = false;
            tracker.style.cursor = 'move';
        }
    }
}

function toggleMinimize() {
    const tracker = document.getElementById('tracker');
    const btn = document.querySelector('.minimize-btn');
    
    tracker.classList.toggle('minimized');
    btn.textContent = tracker.classList.contains('minimized') ? '+' : '−';
}
