# CLAUDE.md — Firmware Header Tool

## Project Overview

A cross-platform desktop application (Windows, macOS, Linux) that:

1. Accepts a firmware `.bin` file via a file picker dialog
2. Reads the file size in bytes
3. Subtracts 4 from that value
4. Writes the result as a 4-byte little-endian value at byte offset 0 (in-place, overwriting the first 4 bytes)

> vThe first 4 bytes of the file are treated as a length header. Stored value = `file_size - 4`.

## Tech Stack

- **Framework:** Electron (main process) + React + TypeScript (renderer) + Tailwind v4
- **Build tool:** Vite + `electron-vite`
- **Packager:** `electron-builder` (produces installers for Win/Mac/Linux)
- **Package manager:** npm

## Directory Structure

firmware-header-tool/
├── src/
│ ├── main/ # Electron main process (Node.js)
│ │ └── index.ts
│ ├── preload/ # Preload scripts (contextBridge)
│ │ └── index.ts
│ └── renderer/ # React frontend
│ └── src/
│ └── App.tsx
├── electron.vite.config.ts
├── electron-builder.yml
├── CLAUDE.md
└── package.json

## Key Commands

```bash
npm run dev          # Start Electron app in dev mode (hot reload)
npm run build        # Compile TypeScript for all processes
npm run package      # Build distributable for current platform
npm test             # Run unit tests (Vitest)
npm run typecheck    # TypeScript type-check across all processes (no emit)
npm run lint         # ESLint across src/
```

## Architecture Rules

- **File I/O happens ONLY in the main process** — never in the renderer
- Renderer communicates with main via `ipcRenderer.invoke` / `ipcMain.handle`
- All Node.js APIs (`fs`, `path`, `Buffer`) are used in main process only
- `contextBridge` must expose only the specific IPC channels needed — no `require` or raw Node access exposed to renderer

## Core Logic (main process — single source of truth)

Lives in `src/main/firmware.ts`:

- Read file size with `fs.statSync(filePath).size`
- Compute header value: `size - 4` as a `uint32` (validate file is > 4 bytes)
- Create a 4-byte `Buffer`, write with `buf.writeUInt32LE(value, 0)` (little-endian)
- Open file with `fs.openSync`, seek to offset 0, write buffer, close — do NOT rewrite the whole file
- Throw a typed error if file is too small or write fails

## Code Style

- TypeScript strict mode enabled for all three processes (main, preload, renderer)
- React: functional components with hooks only, no class components
- ES modules throughout — no `require()` in renderer or preload
- Use `electron-log` for logging in main, never `console.log` in production paths

## Workflow Rules

- Always branch off `main` before making changes; never commit directly to `main`
- Write a unit test for the core header logic (`firmware.ts`) before implementing (TDD)
- Run `npm run typecheck` and `npm run lint` before marking any task done
- Prefer running a single targeted test over the full suite during iteration
- When compacting context, preserve: current branch name, modified files, test pass/fail status

## What Claude Gets Wrong Here (known pitfalls)

- Do NOT use `fs.writeFile` on the whole file — use `fs.openSync` + `fs.writeSync` at offset 0 to avoid data loss
- Do NOT use big-endian — header is little-endian (`writeUInt32LE`)
- Do NOT expose `fs` or `require` through `contextBridge` — security violation
- IPC channel names must be declared in the preload `contextBridge` before the renderer can call them
- `electron-builder` config goes in `electron-builder.yml`, not `package.json` build field
- `electron-vite` has a different config structure than plain Vite — check `electron.vite.config.ts`

## App Heading Implementation

- for creating app heading start by reading `/feature_plan/app_heading.md` in full before writing any code
