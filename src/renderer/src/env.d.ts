/// <reference types="vite/client" />

interface FirmwareAPI {
  selectFile: () => Promise<string | null>
  writeHeader: (filePath: string) => Promise<{ size: number; headerValue: number }>
}

declare global {
  interface Window {
    firmwareAPI: FirmwareAPI
  }
}

export {}
