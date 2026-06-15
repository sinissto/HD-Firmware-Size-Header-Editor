import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import log from "electron-log";
import * as fs from "fs";
import { copyFileToEdited, processBatchFolder } from "./firmware";
import { runActionsOnFile, hasAnyAction } from "./actions";
import type { FirmwareActions, IndividualResult } from "./firmwareTypes";

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
    height: 1000,
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
    title: "Select firmware file",
    filters: [{ name: "Firmware files", extensions: ["bin", "rpm", "bad"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle(
  "firmware:run-actions",
  (_event, filePath: string, actions: FirmwareActions): IndividualResult => {
    if (!hasAnyAction(actions)) {
      throw new Error("No action selected");
    }
    const editedFilePath = copyFileToEdited(filePath);
    const size = fs.statSync(editedFilePath).size;
    const outcomes = runActionsOnFile(editedFilePath, actions);
    const status: IndividualResult["status"] = outcomes.every(
      (o) => o.status === "success",
    )
      ? "success"
      : "error";
    return { status, editedFilePath, size, actions: outcomes };
  },
);

ipcMain.handle("firmware:select-folder", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win!, {
    title: "Select folder containing .bin files",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle(
  "firmware:process-batch",
  (_event, folderPath: string, actions: FirmwareActions) => {
    return processBatchFolder(folderPath, actions);
  },
);

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.firmware.header-tool");

  app.setAboutPanelOptions({
    applicationName: "Firmware Header Editor",
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: `© ${new Date().getFullYear()}`,
    iconPath: join(__dirname, "../../resources/icon.png"),
  });

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
