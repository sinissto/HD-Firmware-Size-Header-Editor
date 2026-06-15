/// <reference types="vite/client" />

declare global {
  type ActionKind = 'headerSize' | 'fillZeros' | 'calculateCrc'

  interface FirmwareActions {
    headerSize: boolean
    calculateCrc: boolean
    fillZeros: boolean
  }

  interface ActionOutcome {
    action: ActionKind
    status: 'success' | 'error'
    value?: number
    error?: string
  }

  interface FileResult {
    fileName: string
    status: 'success' | 'error'
    size?: number
    actions: ActionOutcome[]
  }

  interface BatchResult {
    status: 'success' | 'partial' | 'error'
    editedFolderPath: string
    files: FileResult[]
    fatalError?: string
  }

  interface IndividualResult {
    status: 'success' | 'error'
    editedFilePath: string
    size: number
    actions: ActionOutcome[]
  }

  interface FirmwareAPI {
    selectFile: () => Promise<string | null>
    runActions: (filePath: string, actions: FirmwareActions) => Promise<IndividualResult>
    selectFolder: () => Promise<string | null>
    processBatch: (folderPath: string, actions: FirmwareActions) => Promise<BatchResult>
  }

  interface Window {
    firmwareAPI: FirmwareAPI
  }
}

export {}
