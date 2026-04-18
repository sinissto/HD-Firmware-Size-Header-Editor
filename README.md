# Firmware Header Tool

A cross-platform desktop app (Windows, macOS, Linux) that writes a 4-byte little-endian length header at the start of firmware `.bin` files. The stored value is `fileSize - 4`.

Originals are never modified — every edit is performed on a copy.

## What it does

The first 4 bytes of a firmware `.bin` file are treated as a length header. This tool computes `fileSize - 4`, writes it as a `uint32` little-endian value at offset `0`, and touches only those 4 bytes (the rest of the file is left untouched).

Two workflows are supported:

- **Individual File** — pick a single `.bin` file. The tool creates `<name>_EDITED.bin` next to it and writes the header into the copy.
- **Batch Folder** — pick a folder. The tool copies it to `<folderName>_EDITED` next to the original, then writes the header into every top-level `.bin` file inside the copy. Results are reported per-file (success / error / partial).

## Tech stack

- Electron + React + TypeScript + Tailwind v4
- Build: Vite via `electron-vite`
- Packaging: `electron-builder`
- Tests: Vitest

## Architecture

- All file I/O lives in the main process (`src/main/firmware.ts`).
- The renderer has no direct access to `fs`, `path`, or `require` — it talks to the main process through a minimal `firmwareAPI` exposed via `contextBridge` in `src/preload/index.ts`.
- IPC channels: `firmware:select-file`, `firmware:write-header`, `firmware:select-folder`, `firmware:process-batch`.

## Project layout

```
src/
  main/        Electron main process — file I/O, IPC handlers
    firmware.ts        core header logic + batch processing
    firmwareTypes.ts   BatchResult / FileResult types
    index.ts           app bootstrap + IPC handlers
  preload/     contextBridge — exposes firmwareAPI to renderer
  renderer/    React UI
    src/
      App.tsx
      IndividualFileHeaderEdit.tsx
      BatchHeaderEdit.tsx
      batch/           BatchPanel, BatchResults, FileRow, StatusBanner
      components/      AppHeader, ThemeToggle
      contexts/        ThemeContext (light/dark)
electron.vite.config.ts
electron-builder.yml
```

## Commands

```bash
npm install          # install dependencies
npm run dev          # launch app in dev mode with hot reload
npm run build        # compile TypeScript for all processes
npm run package      # build a distributable for the current platform
npm test             # run Vitest unit tests
npm run typecheck    # type-check main, preload, renderer (no emit)
npm run lint         # ESLint across src/
```

## Packaging

`electron-builder.yml` produces:

- Windows — NSIS installer (x64)
- macOS — DMG (x64 + arm64)
- Linux — AppImage (x64)

## License

MIT
