// Gamer Timer Web Application Logic

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

// Overlay Elements
const overlayContainer = document.getElementById("overlay-container");
const overlayName = document.getElementById("overlay-name");
const overlayTime = document.getElementById("overlay-time");
const overlayToggleBtn = document.getElementById("overlay-toggle");
const overlayResetBtn = document.getElementById("overlay-reset");
const overlayCloseBtn = document.getElementById("overlay-close");
const overlayOpacitySlider = document.getElementById("opacity-slider");
const overlayDragHandle = document.querySelector(".overlay-drag-handle");

let timers = {}; // { "timerId": { ...timerData } } - Will use localStorage
let timerIntervals = {}; // { "timerId": intervalId }
let activeTimers = {}; // { "timerId": remainingTime }

let overlayTimerId = null; // ID of the timer currently shown in the overlay
let overlayInterval = null;
let overlayRemainingTime = 0;
let overlayIsRunning = false;

// --- Initialization ---
document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    await loadTimers(); // Load timers using localStorage
    setupTabs();
    setupModal();
    setupOverlay();
    tabs[0].click(); // Activate the first tab
}

// --- Tab Functionality ---
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            const targetPaneId = tab.getAttribute("data-tab") + "-tab";
            document.getElementById(targetPaneId).classList.add("active");
        });
    });
}

// --- Modal Functionality ---
function setupModal() {
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

    timerForm.addEventListener("submit", handleTimerFormSubmit);
}

// --- Timer Creation ---
function handleTimerFormSubmit(event) {
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
    saveTimers(); // Use localStorage
    timerModal.style.display = "none";
}

// --- Timer Management (using localStorage) ---
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
    saveTimers(); // Use localStorage

    // If the deleted timer was in the overlay, close the overlay
    if (overlayTimerId === timerId) {
        closeOverlay();
    }
}

function saveTimers() {
    try {
        localStorage.setItem("gamerTimers", JSON.stringify(timers));
    } catch (e) {
        console.error("Error saving timers to localStorage:", e);
        alert("Could not save timers. LocalStorage might be full or disabled.");
    }
}

async function loadTimers() {
    try {
        const storedTimers = localStorage.getItem("gamerTimers");
        timers = storedTimers ? JSON.parse(storedTimers) : {};
    } catch (e) {
        console.error("Error loading timers from localStorage:", e);
        timers = {};
        alert("Could not load previous timers.");
    }
    
    console.log("Loaded timers:", timers);
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
    overlayButton.addEventListener("click", () => openOverlay(timerData.id));
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

        if (activeTimers[timerId] <= 0) {
            timerComplete(timerId);
        }
    }, 1000);
}

function pauseTimer(timerId) {
    if (!timerIntervals[timerId]) return;

    clearInterval(timerIntervals[timerId]);
    delete timerIntervals[timerId];

    const timerElement = document.getElementById(timerId);
    timerElement.querySelector(".start").style.display = "inline-block";
    timerElement.querySelector(".pause").style.display = "none";
}

function resetTimer(timerId) {
    pauseTimer(timerId);
    const timerData = timers[timerId];
    if (!timerData) return;

    activeTimers[timerId] = timerData.duration;
    updateTimerDisplay(timerId);
    document.getElementById(timerId)?.classList.remove("flashing");
}

function timerComplete(timerId) {
    pauseTimer(timerId);
    const timerData = timers[timerId];
    if (!timerData) return;

    if (timerData.flash) {
        document.getElementById(timerId)?.classList.add("flashing");
    }

    if (timerData.sound) {
        playSound();
    }

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
    // Update overlay if this timer is displayed there
    if (overlayTimerId === timerId) {
        updateOverlayDisplay(activeTimers[timerId]);
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

// --- Sound Notification ---
let audioContext;
let alarmBuffer;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Load the sound file
        fetch("assets/sounds/alarm.wav") // Assuming alarm.wav exists
            .then(response => response.arrayBuffer())
            .then(data => audioContext.decodeAudioData(data))
            .then(buffer => {
                alarmBuffer = buffer;
                console.log("Alarm sound loaded.");
            })
            .catch(e => console.error("Error loading sound file:", e));
    } catch (e) {
        console.error("Web Audio API is not supported in this browser.", e);
    }
}

function playSound() {
    if (!audioContext || !alarmBuffer) {
        console.log("Audio not ready or not supported.");
        return;
    }
    // Resume context if suspended (required by browser autoplay policies)
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
    const source = audioContext.createBufferSource();
    source.buffer = alarmBuffer;
    source.connect(audioContext.destination);
    source.start(0);
}

// Call initAudio once, maybe after first user interaction or on load
document.addEventListener("click", initAudio, { once: true });
document.addEventListener("touchstart", initAudio, { once: true });

// --- Simulated Overlay Functionality ---
function setupOverlay() {
    overlayCloseBtn.addEventListener("click", closeOverlay);
    overlayToggleBtn.addEventListener("click", toggleOverlayTimer);
    overlayResetBtn.addEventListener("click", resetOverlayTimer);
    overlayOpacitySlider.addEventListener("input", handleOpacityChange);
    makeDraggable(overlayContainer, overlayDragHandle);
}

function openOverlay(timerId) {
    const timerData = timers[timerId];
    if (!timerData) return;

    overlayTimerId = timerId;
    overlayName.textContent = timerData.name;
    overlayRemainingTime = activeTimers[timerId] > 0 ? activeTimers[timerId] : timerData.duration;
    updateOverlayDisplay(overlayRemainingTime);

    // Sync overlay state with main timer state
    if (timerIntervals[timerId]) {
        startOverlayTimerVisuals(); // Timer is running
    } else {
        pauseOverlayTimerVisuals(); // Timer is paused or stopped
    }

    overlayContainer.style.display = "flex";
    handleOpacityChange(); // Apply initial opacity
}

function closeOverlay() {
    overlayContainer.style.display = "none";
    if (overlayInterval) {
        clearInterval(overlayInterval);
        overlayInterval = null;
    }
    overlayTimerId = null;
    overlayIsRunning = false;
}

function updateOverlayDisplay(milliseconds) {
    const displayTime = milliseconds > 0 ? milliseconds : 0;
    overlayTime.textContent = formatTime(displayTime);
    // Handle flashing in overlay
    if (displayTime <= 0 && timers[overlayTimerId]?.flash) {
        overlayContainer.classList.add("flashing");
    } else {
        overlayContainer.classList.remove("flashing");
    }
}

function toggleOverlayTimer() {
    if (!overlayTimerId) return;
    // This button now directly controls the *main* timer
    if (timerIntervals[overlayTimerId]) {
        pauseTimer(overlayTimerId); // Pause main timer
        pauseOverlayTimerVisuals();
    } else {
        startTimer(overlayTimerId); // Start main timer
        startOverlayTimerVisuals();
    }
}

function resetOverlayTimer() {
    if (!overlayTimerId) return;
    resetTimer(overlayTimerId); // Reset main timer
    pauseOverlayTimerVisuals();
    updateOverlayDisplay(timers[overlayTimerId].duration);
}

function startOverlayTimerVisuals() {
    overlayIsRunning = true;
    overlayToggleBtn.textContent = "Pause";
    overlayToggleBtn.classList.remove("start");
    overlayToggleBtn.classList.add("pause");
    overlayContainer.classList.remove("flashing");
}

function pauseOverlayTimerVisuals() {
    overlayIsRunning = false;
    overlayToggleBtn.textContent = "Start";
    overlayToggleBtn.classList.remove("pause");
    overlayToggleBtn.classList.add("start");
}

function handleOpacityChange() {
    const opacity = overlayOpacitySlider.value;
    overlayContainer.style.opacity = opacity;
}

// --- Draggable Overlay ---
function makeDraggable(element, handle) {
    let isDragging = false;
    let offsetX, offsetY;

    handle.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        handle.style.cursor = "grabbing";
        element.style.userSelect = "none"; // Prevent text selection while dragging
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        // Keep within viewport bounds
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement.getBoundingClientRect(); // Assuming body is parent

        newX = Math.max(0, Math.min(newX, parentRect.width - rect.width));
        newY = Math.max(0, Math.min(newY, parentRect.height - rect.height));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
        // Override fixed position if needed
        element.style.right = "auto";
        element.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            handle.style.cursor = "grab";
            element.style.removeProperty("user-select");
        }
    });
}

console.log("Gamer Timer Web Initialized");

