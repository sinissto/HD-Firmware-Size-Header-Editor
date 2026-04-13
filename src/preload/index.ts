import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Expose electron utilities to renderer (sandboxed — no raw Node/fs access)
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // Firmware IPC channels will be added here in a later step
    contextBridge.exposeInMainWorld('firmwareAPI', {
      // placeholder — channels added when firmware logic is implemented
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (for non-context-isolated environments, dev fallback only)
  window.electron = electronAPI
  // @ts-expect-error (non-context-isolated fallback)
  window.firmwareAPI = {}
}
