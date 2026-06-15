import log from 'electron-log'
import type { ActionKind, ActionOutcome, FirmwareActions } from './firmwareTypes'
import { writeFirmwareHeader } from './firmware'
import { writeWdChecksum, fillTailWithZeros } from './checksum'

/**
 * Execution order matters:
 *   1. headerSize  — writes file_size−4 into bytes [0..4]
 *   2. fillZeros   — uses the new header value to zero the tail
 *   3. calculateCrc — last, because it sums every byte in the file
 *
 * Order is documented in the implementation plan and confirmed with the user.
 */
const ORDER: ActionKind[] = ['headerSize', 'fillZeros', 'calculateCrc']

export function hasAnyAction(actions: FirmwareActions): boolean {
  return actions.headerSize || actions.fillZeros || actions.calculateCrc
}

function runOne(action: ActionKind, filePath: string): ActionOutcome {
  try {
    switch (action) {
      case 'headerSize': {
        writeFirmwareHeader(filePath)
        return { action, status: 'success' }
      }
      case 'fillZeros': {
        const { zeroedBytes } = fillTailWithZeros(filePath)
        return { action, status: 'success', value: zeroedBytes }
      }
      case 'calculateCrc': {
        const crc = writeWdChecksum(filePath)
        return { action, status: 'success', value: crc }
      }
    }
  } catch (e) {
    const message = (e as Error).message
    log.warn(`Action ${action} failed on ${filePath}: ${message}`)
    return { action, status: 'error', error: message }
  }
}

/**
 * Runs every selected action against the file in canonical order. Each action
 * is attempted independently — a failure does not abort the next action — so
 * the UI can show per-action outcomes.
 */
export function runActionsOnFile(filePath: string, actions: FirmwareActions): ActionOutcome[] {
  return ORDER.filter((a) => actions[a]).map((a) => runOne(a, filePath))
}
