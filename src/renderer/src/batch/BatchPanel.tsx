import { useState } from "react";
import { folderBasename } from "./folderBasename";
import { BatchResults } from "./BatchResults";

type BatchState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; result: BatchResult };

export function BatchPanel(): JSX.Element {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [state, setState] = useState<BatchState>({ kind: "idle" });
  const busy = state.kind === "busy";

  async function handleSelectFolder(): Promise<void> {
    const folderPath = await window.firmwareAPI.selectFolder();
    if (!folderPath) return;
    setSelectedFolder(folderPath);
    setState({ kind: "idle" });
  }

  async function handleProcessBatch(): Promise<void> {
    if (!selectedFolder) return;
    setState({ kind: "busy" });
    try {
      const result = await window.firmwareAPI.processBatch(selectedFolder);
      setState({ kind: "done", result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState({
        kind: "done",
        result: {
          status: "error",
          editedFolderPath: "",
          files: [],
          fatalError: `Unexpected error: ${message}`,
        },
      });
    }
  }

  return (
    <>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">
        Firmware Batch Processor
      </h1>
      <div className="flex-1 min-h-[150px]">
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Select a folder containing{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            .bin
          </code>{" "}
          files. A copy named{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            &lt;folderName&gt;_EDITED
          </code>{" "}
          will be created alongside the original and all{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            .bin
          </code>{" "}
          files inside will have their headers written. Your original files are
          never modified.
        </p>
      </div>

      {/* Step 1 — select folder */}
      <button
        onClick={handleSelectFolder}
        disabled={busy}
        className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
      >
        Select folder…
      </button>

      {/* Step 2 — show selected folder name */}
      {selectedFolder && (
        <div className="mt-4 rounded-lg border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-800">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Selected folder
          </p>
          <p className="break-all font-mono text-xs text-gray-700 dark:text-gray-200">
            {folderBasename(selectedFolder)}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-gray-400 dark:text-gray-500">
            {selectedFolder}
          </p>
        </div>
      )}

      {/* Step 3 — process */}
      <button
        onClick={handleProcessBatch}
        disabled={!selectedFolder || busy}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Processing…" : "Process Folder"}
      </button>

      {/* Results */}
      {state.kind === "done" && <BatchResults result={state.result} />}
    </>
  );
}
