/* ============================================================
   electron-main.js — desktop wrapper (Electron main process)
   Loads the existing browser game (index.html) inside a native
   window so it can be packaged as a Windows installer with
   electron-builder. The game itself is unchanged; this only hosts it.
   ============================================================ */

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 640,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: "#1b2a3a", // matches the game's letterbox background
    title: "Buzzy The Busy Busy Bee",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      // The game is pure browser JS and needs no Node access, so keep the
      // renderer sandboxed with the secure defaults.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Hide the default application menu for a clean, game-like window.
  Menu.setApplicationMenu(null);

  win.loadFile("index.html");
}

// Standard Electron lifecycle wiring.
app.whenReady().then(() => {
  createWindow();

  // On macOS re-create a window when the dock icon is clicked with none open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except on macOS, per platform convention).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
