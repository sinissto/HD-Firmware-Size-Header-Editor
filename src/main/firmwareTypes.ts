/**
 * Shared types for firmware processing.
 * No Node.js imports — safe to use in both main process and preload.
 */

export type ActionKind = 'headerSize' | 'fillZeros' | 'calculateCrc'

export interface FirmwareActions {
  headerSize: boolean
  calculateCrc: boolean
  fillZeros: boolean
}

export interface ActionOutcome {
  action: ActionKind
  status: 'success' | 'error'
  /** Action-specific summary value (header value, CRC, byte count) for the UI. */
  value?: number
  error?: string
}

export interface FileResult {
  fileName: string
  /** Whole-file status: success = all selected actions succeeded, error = at least one failed. */
  status: 'success' | 'error'
  size?: number
  actions: ActionOutcome[]
}

export interface BatchResult {
  status: 'success' | 'partial' | 'error'
  editedFolderPath: string
  files: FileResult[]
  fatalError?: string
}

export interface IndividualResult {
  status: 'success' | 'error'
  editedFilePath: string
  size: number
  actions: ActionOutcome[]
}
