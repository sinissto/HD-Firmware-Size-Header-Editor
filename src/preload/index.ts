import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { BatchResult } from '../main/firmwareTypes'

const firmwareAPI = {
  selectFile: (): Promise<string | null> => ipcRenderer.invoke('firmware:select-file'),
  writeHeader: (filePath: string): Promise<{ size: number; headerValue: number; editedFilePath: string }> =>
    ipcRenderer.invoke('firmware:write-header', filePath),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('firmware:select-folder'),
  processBatch: (folderPath: string): Promise<BatchResult> =>
    ipcRenderer.invoke('firmware:process-batch', folderPath),
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
