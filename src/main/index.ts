import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import log from "electron-log";
import * as fs from "fs";
import { writeFirmwareHeader } from "./firmware";

log.initialize();

function createWindow(): void {
  const iconExt =
    process.platform === "win32"
      ? "ico"
      : process.platform === "darwin"
        ? "icns"
        : "png";
  const mainWindow = new BrowserWindow({
    icon: join(__dirname, `../../resources/icon.${iconExt}`),
    width: 720,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  log.info("Main window created");
}

ipcMain.handle("firmware:select-file", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win!, {
    title: "Select firmware .bin file",
    filters: [{ name: "Binary files", extensions: ["bin"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("firmware:write-header", (_event, filePath: string) => {
  const size = fs.statSync(filePath).size;
  writeFirmwareHeader(filePath);
  return { size, headerValue: size - 4 };
});

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.firmware.header-tool");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
