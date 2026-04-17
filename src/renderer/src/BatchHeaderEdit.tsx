import { useState } from "react";

type BatchState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; result: BatchResult };

function folderBasename(folderPath: string): string {
  return folderPath.split(/[\\/]/).pop() ?? folderPath;
}

function StatusBanner({ result }: { result: BatchResult }): JSX.Element {
  const successCount = result.files.filter(
    (f) => f.status === "success",
  ).length;
  const total = result.files.length;

  if (result.status === "error" && result.fatalError) {
    return (
      <div className="mt-6 rounded-lg border border-red-700 bg-red-950 p-4 text-sm">
        <p className="mb-1 font-semibold text-red-400">Error</p>
        <p className="font-mono text-xs text-red-300">{result.fatalError}</p>
      </div>
    );
  }

  if (result.status === "success") {
    return (
      <div className="mt-6 rounded-lg border border-green-700 bg-green-950 p-4 text-sm">
        <p className="mb-1 font-semibold text-green-400">
          All {total} file{total !== 1 ? "s" : ""} processed successfully
        </p>
        <p className="break-all font-mono text-xs text-gray-400">
          {result.editedFolderPath}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-yellow-700 bg-yellow-950 p-4 text-sm">
      <p className="mb-1 font-semibold text-yellow-400">
        {successCount} of {total} files succeeded
      </p>
      <p className="break-all font-mono text-xs text-gray-400">
        {result.editedFolderPath}
      </p>
    </div>
  );
}

function FileRow({ file }: { file: FileResult }): JSX.Element {
  const isSuccess = file.status === "success";
  return (
    <li
      className={`rounded-lg border p-3 text-xs ${
        isSuccess
          ? "border-green-800 bg-green-950"
          : "border-red-800 bg-red-950"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className={`font-semibold ${isSuccess ? "text-green-400" : "text-red-400"}`}
        >
          {isSuccess ? "✓" : "✗"}
        </span>
        <span className="flex-1 break-all font-mono text-gray-200">
          {file.fileName}
        </span>
      </div>
      {isSuccess &&
        file.size !== undefined &&
        file.headerValue !== undefined && (
          <dl className="mt-2 space-y-1 text-gray-400">
            <div className="flex justify-between gap-4">
              <dt>File size</dt>
              <dd className="font-mono text-gray-300">
                {file.size.toLocaleString()} bytes
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Header value</dt>
              <dd className="font-mono text-gray-300">
                {file.headerValue.toLocaleString()} (0x
                {file.headerValue.toString(16).toUpperCase().padStart(8, "0")})
              </dd>
            </div>
          </dl>
        )}
      {!isSuccess && file.error && (
        <p className="mt-2 font-mono text-red-300">{file.error}</p>
      )}
    </li>
  );
}

function BatchResults({ result }: { result: BatchResult }): JSX.Element {
  return (
    <div>
      <StatusBanner result={result} />
      {result.files.length > 0 && (
        <>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Files ({result.files.length})
          </p>
          <ul className="space-y-2">
            {result.files.map((file) => (
              <FileRow key={file.fileName} file={file} />
            ))}
          </ul>
          {result.editedFolderPath && (
            <p className="mt-4 break-all text-xs text-gray-500">
              Edited files saved to:{" "}
              <span className="font-mono text-gray-400">
                {result.editedFolderPath}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

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
        HD Firmware Batch Processor
      </h1>
      <div className="flex-1 min-h-[150px]">
        <p className="mb-6 text-sm text-gray-400 ">
          Select a folder containing{" "}
          <code className="rounded bg-gray-800 px-1">.bin</code> files. A copy
          named{" "}
          <code className="rounded bg-gray-800 px-1">
            &lt;folderName&gt;_EDITED
          </code>{" "}
          will be created alongside the original and all{" "}
          <code className="rounded bg-gray-800 px-1">.bin</code> files inside
          will have their headers written. Your original files are never
          modified.
        </p>
      </div>

      {/* Step 1 — select folder */}
      <button
        onClick={handleSelectFolder}
        disabled={busy}
        className="w-full rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Select folder…
      </button>

      {/* Step 2 — show selected folder name */}
      {selectedFolder && (
        <div className="mt-4 rounded-lg border border-gray-600 bg-gray-800 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Selected folder
          </p>
          <p className="break-all font-mono text-xs text-gray-200">
            {folderBasename(selectedFolder)}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-gray-500">
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
