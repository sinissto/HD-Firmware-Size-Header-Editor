/**
 * Shared types for batch firmware processing.
 * No Node.js imports — safe to use in both main process and preload.
 */

export interface FileResult {
  fileName: string
  status: 'success' | 'error'
  headerValue?: number
  size?: number
  error?: string
}

export interface BatchResult {
  status: 'success' | 'partial' | 'error'
  editedFolderPath: string
  files: FileResult[]
  fatalError?: string
}
