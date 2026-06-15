import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { BatchResult, FirmwareActions, IndividualResult } from '../main/firmwareTypes'

const firmwareAPI = {
  selectFile: (): Promise<string | null> => ipcRenderer.invoke('firmware:select-file'),
  runActions: (filePath: string, actions: FirmwareActions): Promise<IndividualResult> =>
    ipcRenderer.invoke('firmware:run-actions', filePath, actions),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('firmware:select-folder'),
  processBatch: (folderPath: string, actions: FirmwareActions): Promise<BatchResult> =>
    ipcRenderer.invoke('firmware:process-batch', folderPath, actions),
}

// Expose electron utilities to renderer (sandboxed — no raw Node/fs access)
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('firmwareAPI', firmwareAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (for non-context-isolated environments, dev fallback only)
  window.electron = electronAPI
  // @ts-expect-error (non-context-isolated fallback)
  window.firmwareAPI = firmwareAPI
}
