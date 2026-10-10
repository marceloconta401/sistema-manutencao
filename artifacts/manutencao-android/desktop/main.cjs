const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_ID = "com.sistemamanutencao.app";
const iconPath = path.join(app.getAppPath(), "desktop", "assets", "system-icon.ico");
const indexPath = path.join(app.getAppPath(), "dist", "public", "index.html");
let mainWindow;
let tray;
let quitting = false;

app.setName("Sistema de Manutenção");
if (process.platform === "win32") app.setAppUserModelId(APP_ID);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function showWindow(callId = "") {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (callId) {
    const url = new URL(pathToFileURL(indexPath).href);
    url.searchParams.set("call", callId);
    mainWindow.loadURL(url.href);
  }
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 360,
    minHeight: 620,
    title: "Sistema de Manutenção",
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), "desktop", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadFile(indexPath);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return;
  tray = new Tray(image);
  tray.setToolTip("Sistema de Manutenção");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir Sistema de Manutenção", click: () => showWindow() },
    { type: "separator" },
    { label: "Sair", click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => showWindow());
}

ipcMain.on("maintenance:notification", (_event, payload) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: payload?.title || "Sistema de Manutenção",
    body: payload?.body || "Há uma atualização em um chamado.",
    icon: iconPath,
  });
  notification.on("click", () => showWindow(payload?.callId || ""));
  notification.show();
});

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    app.on("activate", () => showWindow());
  });
}

app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && quitting) app.quit();
});
app.on("second-instance", () => showWindow());
