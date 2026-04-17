import { useState } from "react";

type WriteResult =
  | { kind: "idle" }
  | { kind: "success"; size: number; headerValue: number }
  | { kind: "error"; message: string };

export function IndividualFileHeaderEdit(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [result, setResult] = useState<WriteResult>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  async function handleSelectFile(): Promise<void> {
    const filePath = await window.firmwareAPI.selectFile();
    if (!filePath) return;
    setSelectedFile(filePath);
    setResult({ kind: "idle" });
  }

  async function handleWriteHeader(): Promise<void> {
    if (!selectedFile) return;
    setBusy(true);
    setResult({ kind: "idle" });
    try {
      const { size, headerValue } =
        await window.firmwareAPI.writeHeader(selectedFile);
      setResult({ kind: "success", size, headerValue });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ kind: "error", message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">
        Individual File Header Editor
      </h1>
      <div className="flex-1 min-h-[150px]">
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Select an individual firmware{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            .bin
          </code>{" "}
          file, verify the path, then write the header.
        </p>

        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          The tool will write{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            fileSize&nbsp;-&nbsp;4
          </code>{" "}
          as a 4-byte little-endian value at offset 0.
        </p>
      </div>

      {/* Step 1 — pick file */}
      <button
        onClick={handleSelectFile}
        disabled={busy}
        className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
      >
        Select .bin file…
      </button>

      {/* Step 2 — show selected path for verification */}
      {selectedFile && (
        <div className="mt-4 rounded-lg border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-800">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Selected file
          </p>
          <p className="break-all font-mono text-xs text-gray-700 dark:text-gray-200">
            {selectedFile}
          </p>
        </div>
      )}

      {/* Step 3 — write header */}
      <button
        onClick={handleWriteHeader}
        disabled={!selectedFile || busy}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Writing…" : "Write Header"}
      </button>

      {result.kind === "success" && (
        <div className="w-full mt-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm dark:border-green-700 dark:bg-green-950">
          <p className="mb-3 font-semibold text-green-700 dark:text-green-400">
            Header written successfully
          </p>
          <dl className="space-y-1 text-gray-700 dark:text-gray-300">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">File</dt>
              <dd className="truncate text-right font-mono text-xs">
                {selectedFile}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">File size</dt>
              <dd className="font-mono">
                {result.size.toLocaleString()} bytes
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Header value</dt>
              <dd className="font-mono">
                {result.headerValue.toLocaleString()} (0x
                {result.headerValue.toString(16).toUpperCase().padStart(8, "0")}
                )
              </dd>
            </div>
          </dl>
        </div>
      )}

      {result.kind === "error" && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-700 dark:bg-red-950">
          <p className="mb-1 font-semibold text-red-700 dark:text-red-400">
            Error
          </p>
          <p className="font-mono text-xs text-red-600 dark:text-red-300">
            {result.message}
          </p>
        </div>
      )}
    </>
  );
}
