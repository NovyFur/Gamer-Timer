const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");

// Dynamically import electron-store
let Store;
let store;

async function initializeStore() {
  try {
    const { default: ElectronStore } = await import("electron-store");
    Store = ElectronStore;
    store = new Store();
    console.log("Electron-store initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize electron-store:", error);
    // Handle error appropriately, maybe show an error dialog to the user
    app.quit();
  }
}

let mainWindow;
let overlayWindows = {}; // Store overlay windows by their associated timerId: { window, timerId }
let mainTimerIntervals = {}; // Store intervals from the main renderer: { timerId: intervalId }
let mainActiveTimers = {}; // Store remaining times from the main renderer: { timerId: remainingTime }

async function createWindow() {
  // Ensure store is initialized before creating the window
  if (!store) {
    await initializeStore();
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, "assets/icon.png"),
    backgroundColor: "#121212"
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, "src/index.html"));

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed
  mainWindow.on("closed", () => {
    mainWindow = null;
    // Close all overlay windows when main window is closed
    Object.values(overlayWindows).forEach(overlay => {
      if (overlay.window && !overlay.window.isDestroyed()) overlay.window.close();
    });
    overlayWindows = {};
    // Clear main timer intervals managed here (if any)
    Object.values(mainTimerIntervals).forEach(clearInterval);
    mainTimerIntervals = {};
  });
}

// Create overlay window
async function createOverlayWindow(timerData) {
  // Check if an overlay for this timer already exists
  if (overlayWindows[timerData.id]) {
    overlayWindows[timerData.id].window.focus();
    return;
  }

  const overlayWindow = new BrowserWindow({
    width: 300,
    height: 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile(path.join(__dirname, "src/overlay.html"));

  // Store reference to the window and its associated timerId
  overlayWindows[timerData.id] = { window: overlayWindow, timerId: timerData.id };

  overlayWindow.once("ready-to-show", () => {
    // Send initial data including the timer ID
    const initialData = {
      timerId: timerData.id,
      name: timerData.name,
      remainingTime: timerData.duration, // Send initial duration
      isRunning: false, // Assume initially paused
      flash: timerData.flash
    };
    overlayWindow.webContents.send("overlay-update", initialData);
    overlayWindow.setOpacity(0.8); // Default opacity
  });

  overlayWindow.on("closed", () => {
    delete overlayWindows[timerData.id]; // Remove reference on close
  });
}

// --- IPC Handlers for Storage ---
ipcMain.handle("get-timers", async (event) => {
  if (!store) await initializeStore();
  return store.get("timers", {});
});

ipcMain.on("save-timers", async (event, timers) => {
  if (!store) await initializeStore();
  store.set("timers", timers);
});

// --- IPC Handlers for Overlay Creation/Management ---
ipcMain.on("create-overlay", (event, timerData) => {
  createOverlayWindow(timerData);
});

ipcMain.on("set-overlay-opacity", (event, { windowId, opacity }) => {
  // Find the overlay window by its ID (less direct than using timerId)
  // This might need adjustment if windowId isn't reliably passed/used
  for (const timerId in overlayWindows) {
      const overlay = overlayWindows[timerId];
      if (overlay.window && overlay.window.id === windowId && !overlay.window.isDestroyed()) {
          overlay.window.setOpacity(opacity);
          break;
      }
  }
});

// --- IPC Handlers for Timer Synchronization & Overlay Control ---

// Receive updates from the main renderer about timer states
ipcMain.on("timer-update-main", (event, { timerId, remainingTime, isRunning }) => {
  // Store the state received from the main renderer
  mainActiveTimers[timerId] = remainingTime;
  if (isRunning && !mainTimerIntervals[timerId]) {
      // This logic might be redundant if main renderer handles intervals
      // For now, just track state
  } else if (!isRunning && mainTimerIntervals[timerId]) {
      // clearInterval(mainTimerIntervals[timerId]);
      // delete mainTimerIntervals[timerId];
  }

  // If an overlay exists for this timer, send it the update
  if (overlayWindows[timerId]) {
    const overlay = overlayWindows[timerId];
    if (overlay.window && !overlay.window.isDestroyed()) {
      overlay.window.webContents.send("overlay-update", {
        timerId: timerId,
        remainingTime: remainingTime,
        isRunning: isRunning,
        // Include name/flash settings if they can change, otherwise they are set initially
        // name: store.get(`timers.${timerId}.name`), // Example if needed
        // flash: store.get(`timers.${timerId}.flash`) // Example if needed
      });
    }
  }
});

// Handle toggle command from an overlay window
ipcMain.on("overlay-toggle-timer", (event, timerId) => {
  // Forward the toggle command to the main window's renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("main-toggle-timer", timerId);
  }
});

// Handle reset command from an overlay window
ipcMain.on("overlay-reset-timer", (event, timerId) => {
  // Forward the reset command to the main window's renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("main-reset-timer", timerId);
  }
});

// --- App Lifecycle ---
app.whenReady().then(async () => {
  await initializeStore();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
