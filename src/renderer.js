// Use exposed API from preload.js

// DOM Elements
const tabs = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");
const addTimerButtons = document.querySelectorAll(".add-timer-btn");
const timerModal = document.getElementById("timer-modal");
const closeModalButton = document.querySelector(".close-modal");
const timerForm = document.getElementById("timer-form");
const timerNameInput = document.getElementById("timer-name");
const timerDaysInput = document.getElementById("timer-days");
const timerHoursInput = document.getElementById("timer-hours");
const timerMinutesInput = document.getElementById("timer-minutes");
const timerSecondsInput = document.getElementById("timer-seconds");
const timerAutoResetInput = document.getElementById("timer-auto-reset");
const timerFlashInput = document.getElementById("timer-flash");
const timerSoundInput = document.getElementById("timer-sound");
const timerTypeInput = document.getElementById("timer-type");

let timers = {}; // { "timerId": { ...timerData } } - Will be loaded from main process
let timerIntervals = {}; // { "timerId": intervalId }
let activeTimers = {}; // { "timerId": remainingTime }

// --- Tab Functionality ---
tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tabPanes.forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        const targetPaneId = tab.getAttribute("data-tab") + "-tab";
        document.getElementById(targetPaneId).classList.add("active");
    });
});

// --- Modal Functionality ---
addTimerButtons.forEach(button => {
    button.addEventListener("click", () => {
        const type = button.getAttribute("data-type");
        timerTypeInput.value = type;
        timerForm.reset();
        timerNameInput.value = `${type.charAt(0).toUpperCase() + type.slice(1)} Timer`;
        timerModal.style.display = "flex";
    });
});

closeModalButton.addEventListener("click", () => {
    timerModal.style.display = "none";
});

window.addEventListener("click", (event) => {
    if (event.target === timerModal) {
        timerModal.style.display = "none";
    }
});

// --- Timer Creation ---
timerForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const days = parseInt(timerDaysInput.value) || 0;
    const hours = parseInt(timerHoursInput.value) || 0;
    const minutes = parseInt(timerMinutesInput.value) || 0;
    const seconds = parseInt(timerSecondsInput.value) || 0;
    const totalMilliseconds = (days * 86400 + hours * 3600 + minutes * 60 + seconds) * 1000;

    if (totalMilliseconds <= 0) {
        alert("Please enter a valid duration for the timer.");
        return;
    }

    const newTimer = {
        id: `timer-${Date.now()}`,
        name: timerNameInput.value.trim() || "Unnamed Timer",
        type: timerTypeInput.value,
        duration: totalMilliseconds,
        autoReset: timerAutoResetInput.checked,
        flash: timerFlashInput.checked,
        sound: timerSoundInput.checked,
        createdAt: Date.now()
    };

    addTimer(newTimer);
    saveTimers(); // Use IPC to save
    timerModal.style.display = "none";
});

// --- Timer Management (using IPC for storage) ---
function addTimer(timerData) {
    timers[timerData.id] = timerData;
    activeTimers[timerData.id] = timerData.duration;
    renderTimer(timerData);
}

function deleteTimer(timerId) {
    if (timerIntervals[timerId]) {
        clearInterval(timerIntervals[timerId]);
        delete timerIntervals[timerId];
    }
    delete activeTimers[timerId];
    delete timers[timerId];
    document.getElementById(timerId)?.remove();
    saveTimers(); // Use IPC to save changes
}

async function saveTimers() {
    // Send timers object to main process for saving
    window.api.saveTimers(timers);
}

async function loadTimers() {
    // Request timers from main process
    timers = await window.api.getTimers();
    console.log("Loaded timers from main process:", timers);
    // Clear existing intervals and timers before rendering loaded ones
    Object.keys(timerIntervals).forEach(id => clearInterval(timerIntervals[id]));
    timerIntervals = {};
    activeTimers = {};
    document.querySelectorAll(".timer-item").forEach(el => el.remove());

    for (const timerId in timers) {
        activeTimers[timerId] = timers[timerId].duration;
        renderTimer(timers[timerId]);
    }
}

// --- Timer Rendering ---
function renderTimer(timerData) {
    const timerList = document.getElementById(`${timerData.type}-timers`);
    if (!timerList) return;

    const timerElement = document.createElement("div");
    timerElement.classList.add("timer-item");
    timerElement.id = timerData.id;

    timerElement.innerHTML = `
        <div class="timer-info">
            <div class="timer-name">${timerData.name}</div>
            <div class="timer-time" id="time-${timerData.id}">${formatTime(timerData.duration)}</div>
        </div>
        <div class="timer-controls">
            <button class="timer-btn start" data-id="${timerData.id}">Start</button>
            <button class="timer-btn pause" data-id="${timerData.id}" style="display: none;">Pause</button>
            <button class="timer-btn reset" data-id="${timerData.id}">Reset</button>
            <button class="timer-btn overlay" data-id="${timerData.id}">Overlay</button>
            <button class="timer-btn delete" data-id="${timerData.id}">Delete</button>
        </div>
    `;

    timerList.appendChild(timerElement);
    updateTimerDisplay(timerData.id);

    const startButton = timerElement.querySelector(".start");
    const pauseButton = timerElement.querySelector(".pause");
    const resetButton = timerElement.querySelector(".reset");
    const overlayButton = timerElement.querySelector(".overlay");
    const deleteButton = timerElement.querySelector(".delete");

    startButton.addEventListener("click", () => startTimer(timerData.id));
    pauseButton.addEventListener("click", () => pauseTimer(timerData.id));
    resetButton.addEventListener("click", () => resetTimer(timerData.id));
    overlayButton.addEventListener("click", () => createOverlay(timerData.id));
    deleteButton.addEventListener("click", () => deleteTimer(timerData.id));
}

// --- Timer Logic ---
function startTimer(timerId) {
    if (timerIntervals[timerId]) return;

    const timerData = timers[timerId];
    if (!timerData) return;

    const timerElement = document.getElementById(timerId);
    timerElement.querySelector(".start").style.display = "none";
    timerElement.querySelector(".pause").style.display = "inline-block";
    timerElement.classList.remove("flashing");

    if (activeTimers[timerId] <= 0) {
        activeTimers[timerId] = timerData.duration;
    }

    timerIntervals[timerId] = setInterval(() => {
        activeTimers[timerId] -= 1000;
        updateTimerDisplay(timerId);

        // Send update to main process for overlay synchronization
        window.api.timerUpdateMain && window.api.timerUpdateMain({
            timerId: timerId,
            remainingTime: activeTimers[timerId],
            isRunning: true
        });

        if (activeTimers[timerId] <= 0) {
            timerComplete(timerId);
        }
    }, 1000);

    // Immediately send update to main process that timer has started
    window.api.timerUpdateMain && window.api.timerUpdateMain({
        timerId: timerId,
        remainingTime: activeTimers[timerId],
        isRunning: true
    });
}

function pauseTimer(timerId) {
    if (!timerIntervals[timerId]) return;

    clearInterval(timerIntervals[timerId]);
    delete timerIntervals[timerId];

    const timerElement = document.getElementById(timerId);
    timerElement.querySelector(".start").style.display = "inline-block";
    timerElement.querySelector(".pause").style.display = "none";

    // Send update to main process that timer has paused
    window.api.timerUpdateMain && window.api.timerUpdateMain({
        timerId: timerId,
        remainingTime: activeTimers[timerId],
        isRunning: false
    });
}

function resetTimer(timerId) {
    pauseTimer(timerId);
    const timerData = timers[timerId];
    if (!timerData) return;

    activeTimers[timerId] = timerData.duration;
    updateTimerDisplay(timerId);
    document.getElementById(timerId)?.classList.remove("flashing");

    // Send update to main process that timer has been reset
    window.api.timerUpdateMain && window.api.timerUpdateMain({
        timerId: timerId,
        remainingTime: timerData.duration,
        isRunning: false
    });
}

function timerComplete(timerId) {
    pauseTimer(timerId);
    const timerData = timers[timerId];
    if (!timerData) return;

    if (timerData.flash) {
        document.getElementById(timerId)?.classList.add("flashing");
    }

    if (timerData.sound) {
        const audio = new Audio("../assets/sounds/alarm.wav");
        audio.play().catch(err => {
            console.error("Error playing sound:", err);
            // Potentially notify user that sound couldn't play
        });
    }

    // Send update to main process that timer has completed
    window.api.timerUpdateMain && window.api.timerUpdateMain({
        timerId: timerId,
        remainingTime: 0,
        isRunning: false
    });

    if (timerData.autoReset) {
        setTimeout(() => {
            if (timers[timerId]) {
                resetTimer(timerId);
                startTimer(timerId);
            }
        }, 3000);
    }
}

// --- Display Update ---
function updateTimerDisplay(timerId) {
    const timeElement = document.getElementById(`time-${timerId}`);
    if (timeElement) {
        const remaining = activeTimers[timerId] > 0 ? activeTimers[timerId] : 0;
        timeElement.textContent = formatTime(remaining);
    }
}

function formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let timeString = "";
    if (days > 0) {
        timeString += `${days}d `;
    }
    timeString += `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    return timeString;
}

// --- Overlay Functionality ---
function createOverlay(timerId) {
    const timerData = timers[timerId];
    if (!timerData) return;

    window.api.createOverlay({
        id: timerData.id,
        name: timerData.name,
        duration: activeTimers[timerId] > 0 ? activeTimers[timerId] : timerData.duration,
        autoReset: timerData.autoReset,
        flash: timerData.flash,
        sound: timerData.sound
    });

    // Immediately send current timer state to main process for the overlay
    window.api.timerUpdateMain && window.api.timerUpdateMain({
        timerId: timerId,
        remainingTime: activeTimers[timerId],
        isRunning: !!timerIntervals[timerId]
    });
}

// --- Listen for commands from overlay windows via main process ---
window.api.onMainToggleTimer && window.api.onMainToggleTimer((timerId) => {
    if (timerIntervals[timerId]) {
        pauseTimer(timerId);
    } else {
        startTimer(timerId);
    }
});

window.api.onMainResetTimer && window.api.onMainResetTimer((timerId) => {
    resetTimer(timerId);
});

// --- Initialization ---
async function initialize() {
    await loadTimers(); // Load timers using IPC
    tabs[0].click();
}

document.addEventListener("DOMContentLoaded", initialize);
