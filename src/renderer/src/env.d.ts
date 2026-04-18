/// <reference types="vite/client" />

declare global {
  interface FileResult {
    fileName: string
    status: 'success' | 'error'
    headerValue?: number
    size?: number
    error?: string
  }

  interface BatchResult {
    status: 'success' | 'partial' | 'error'
    editedFolderPath: string
    files: FileResult[]
    fatalError?: string
  }

  interface FirmwareAPI {
    selectFile: () => Promise<string | null>
    writeHeader: (filePath: string) => Promise<{ size: number; headerValue: number; editedFilePath: string }>
    selectFolder: () => Promise<string | null>
    processBatch: (folderPath: string) => Promise<BatchResult>
  }

  interface Window {
    firmwareAPI: FirmwareAPI
  }
}

export {}
