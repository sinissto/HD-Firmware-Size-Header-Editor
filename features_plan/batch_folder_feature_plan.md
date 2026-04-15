# Plan: Batch Folder Firmware Header Processor

## Context
The app currently edits the header of a single `.bin` firmware file selected by the user. This plan adds a **batch folder** feature: the user selects a folder of `.bin` files, the app copies the folder to `<folderName>_EDITED`, then writes the firmware header to each file in the copy. The feature lives in a **separate Electron `BrowserWindow`** that opens via a menu item alongside the existing single-file window.

---

## Implementation Sequence

### 1. Create `src/main/firmwareTypes.ts` (new file)
Shared TypeScript interfaces with no Node imports (safe to import from both main and preload):

```typescript
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
  fatalError?: string  // present only when status === 'error'
}
```

---

### 2. Update `src/main/firmware.ts`
Add `import { basename, dirname, join } from 'path'` and three new exports below the existing `writeFirmwareHeader`:

**`copyFolderToEdited(sourcePath: string): string`**
- Derive `destPath = join(dirname(sourcePath), basename(sourcePath) + '_EDITED')`
- If `destPath` exists: `fs.rmSync(destPath, { recursive: true, force: true })` + log.warn
- `fs.cpSync(sourcePath, destPath, { recursive: true })`
- Returns `destPath`. Throws on any fs error.

**`scanBinFiles(folderPath: string): string[]`**
- `fs.readdirSync(folderPath, { withFileTypes: true })`
- Filter `entry.isFile() && entry.name.toLowerCase().endsWith('.bin')`
- Map to `join(folderPath, entry.name)`, sort alphabetically
- Returns empty array if none found (caller checks)

**`processBatchFolder(sourceFolderPath: string): BatchResult`**
- **Phase 1**: `fs.statSync` the source — return `{ status: 'error', fatalError: '...' }` if missing or not a directory
- **Phase 2**: Call `copyFolderToEdited` — return `{ status: 'error', fatalError: 'Failed to copy folder: ...' }` on throw
- **Phase 3**: Call `scanBinFiles(editedFolderPath)` — return `{ status: 'error', fatalError: 'No .bin files found...' }` if empty
- **Phase 4**: Map over bin files, call `writeFirmwareHeader` per file in try/catch — build `FileResult[]`
- Derive overall `status`: `'success'` (no errors) | `'partial'` (some errors) | `'error'` (all failed)
- Returns `BatchResult` — **never throws**

Error logging: `log.info` for success, `log.warn` per-file failure, `log.error` for fatal.

---

### 3. Update `src/main/index.ts`
Add imports: `{ processBatchFolder }` from `'./firmware'`; add `Menu` to the electron import.

**New IPC handler `firmware:select-folder`**:
```typescript
ipcMain.handle('firmware:select-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win!, {
    title: 'Select folder containing .bin files',
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})
```

**New IPC handler `firmware:process-batch`**:
```typescript
ipcMain.handle('firmware:process-batch', (_event, folderPath: string) => {
  return processBatchFolder(folderPath)  // never throws
})
```

**New `createBatchWindow()` function** (mirror of `createWindow` but 800×680 and loads `#/batch`):
- Dev: `batchWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/batch')`
- Prod: `batchWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/batch' })`
  - Note: `{ hash: '/batch' }` — no `#` prefix; Electron adds it automatically

**Add application menu** inside `app.whenReady()` after `createWindow()`:
```typescript
const menu = Menu.buildFromTemplate([{
  label: 'Tools',
  submenu: [{
    label: 'Open Batch Processor',
    accelerator: 'CmdOrCtrl+Shift+B',
    click: () => {
      // Deduplicate: focus existing batch window if already open
      const existing = BrowserWindow.getAllWindows()
        .find(w => w.webContents.getURL().includes('/batch'))
      if (existing) { existing.focus(); return }
      createBatchWindow()
    },
  }],
}])
Menu.setApplicationMenu(menu)
```

---

### 4. Update `src/preload/index.ts`
Extend `firmwareAPI` with two new methods:
```typescript
selectFolder: (): Promise<string | null> =>
  ipcRenderer.invoke('firmware:select-folder'),
processBatch: (folderPath: string): Promise<BatchResult> =>
  ipcRenderer.invoke('firmware:process-batch', folderPath),
```
Import `BatchResult` from `'../main/firmwareTypes'`.

---

### 5. Update `src/renderer/src/env.d.ts`
Add `FileResult` and `BatchResult` interfaces (duplicated from `firmwareTypes.ts` — renderer tsconfig cannot import from main source). Extend `FirmwareAPI`:
```typescript
selectFolder: () => Promise<string | null>
processBatch: (folderPath: string) => Promise<BatchResult>
```

---

### 6. Create `src/renderer/src/BatchApp.tsx` (new file)
State:
```typescript
type BatchState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; result: BatchResult }
const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
const [state, setState] = useState<BatchState>({ kind: 'idle' })
const busy = state.kind === 'busy'
```

Folder basename (no Node path available in renderer):
```typescript
const folderName = selectedFolder?.split(/[\\/]/).pop() ?? selectedFolder
```

Handlers:
- `handleSelectFolder` → `firmwareAPI.selectFolder()`, update `selectedFolder`, reset state to idle
- `handleProcessBatch` → set busy, `firmwareAPI.processBatch(selectedFolder)`, set done; defensive catch for unexpected rejections

UI structure (Tailwind classes matching existing app style):
1. **Title**: "HD Firmware Batch Processor"
2. **Description** paragraph
3. **Select folder button** → opens OS folder dialog
4. **Selected folder display**: shows `folderName` in monospace box
5. **Process Folder button** (disabled until folder selected or busy)
6. **Results section** (`BatchResults` sub-component, only shown when `state.kind === 'done'`):
   - **Fatal error banner** (red): shown when `result.status === 'error'` with `result.fatalError`
   - **Success banner** (green): "All N files processed" + edited folder path
   - **Partial banner** (yellow): "X of N files succeeded" + edited folder path
   - **Per-file list**: each row shows filename, file size, header value (hex + decimal), or error message
   - **Summary**: "Edited files saved to: `<editedFolderPath>`"

---

### 7. Update `src/renderer/src/main.tsx`
Replace static `<App />` render with hash-based routing:
```typescript
import BatchApp from './BatchApp'

function Root(): JSX.Element {
  return window.location.hash === '#/batch' ? <BatchApp /> : <App />
}

ReactDOM.createRoot(...).render(<React.StrictMode><Root /></React.StrictMode>)
```
No router library needed — hash is set once by main process at window creation and never changes.

---

## Error Handling Coverage

| Scenario | Caught In | User Sees |
|---|---|---|
| Folder not found / no access | `processBatchFolder` phase 1 | Fatal error banner |
| Path is a file, not a directory | `processBatchFolder` phase 1 | Fatal error banner |
| `_EDITED` copy fails (disk full, permissions) | `copyFolderToEdited` → phase 2 | Fatal error banner |
| No `.bin` files in folder | `processBatchFolder` phase 3 | Fatal error banner |
| Individual file too small (≤ 4 bytes) | Per-file catch in phase 4 | File row marked error |
| Individual file locked / read-only | Per-file catch in phase 4 | File row marked error |
| Dialog cancelled | IPC handler `select-folder` | Returns null, UI unchanged |

---

## Critical Files

| File | Action |
|---|---|
| `src/main/firmwareTypes.ts` | **Create** |
| `src/main/firmware.ts` | **Modify** — add 3 functions |
| `src/main/index.ts` | **Modify** — 2 IPC handlers + batch window + menu |
| `src/preload/index.ts` | **Modify** — 2 new API methods |
| `src/renderer/src/env.d.ts` | **Modify** — types + FirmwareAPI extension |
| `src/renderer/src/BatchApp.tsx` | **Create** |
| `src/renderer/src/main.tsx` | **Modify** — hash routing |

Files NOT changed: `App.tsx`, `index.html`, `electron.vite.config.ts`, `electron-builder.yml`

---

## Verification

1. `npm run typecheck` — must pass with zero errors across all three processes
2. `npm run lint` — must pass
3. `npm run dev` — launch app, verify:
   - Single-file window opens normally (existing behavior unchanged)
   - Tools → Open Batch Processor (or `Cmd+Shift+B`) opens a second window
   - Select a folder → folder name appears above button
   - Process Folder → `_EDITED` folder created at same parent directory
   - All `.bin` files in `_EDITED` have correct headers written
   - Re-running overwrites the `_EDITED` folder cleanly
   - Error cases: empty folder, folder with non-bin files, read-only file
4. `npm test` — existing unit tests for `writeFirmwareHeader` still pass
