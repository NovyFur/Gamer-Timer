const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  "api", {
    // --- Main Window APIs ---
    getTimers: () => ipcRenderer.invoke("get-timers"),
    saveTimers: (timers) => ipcRenderer.send("save-timers", timers),
    createOverlay: (timerData) => ipcRenderer.send("create-overlay", timerData),
    timerUpdateMain: (data) => ipcRenderer.send("timer-update-main", data),

    // --- Overlay Window APIs ---
    // Receive initial data and subsequent updates for the overlay
    onOverlayUpdate: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on("overlay-update", listener);
      // Return a cleanup function to remove the listener
      return () => {
        ipcRenderer.removeListener("overlay-update", listener);
      };
    },
    // Send control actions from overlay to main process
    overlayToggleTimer: (timerId) => ipcRenderer.send("overlay-toggle-timer", timerId),
    overlayResetTimer: (timerId) => ipcRenderer.send("overlay-reset-timer", timerId),
    // Send opacity changes from overlay to main process
    setOverlayOpacity: (data) => ipcRenderer.send("set-overlay-opacity", data),

    // --- Main Window Listeners for Overlay Commands ---
    onMainToggleTimer: (callback) => {
      const listener = (event, timerId) => callback(timerId);
      ipcRenderer.on("main-toggle-timer", listener);
      return () => {
        ipcRenderer.removeListener("main-toggle-timer", listener);
      };
    },
    onMainResetTimer: (callback) => {
      const listener = (event, timerId) => callback(timerId);
      ipcRenderer.on("main-reset-timer", listener);
      return () => {
        ipcRenderer.removeListener("main-reset-timer", listener);
      };
    }
  }
);
