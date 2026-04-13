import { useState } from "react";
import "./assets/main.css";

type WriteResult =
  | { kind: "idle" }
  | { kind: "success"; size: number; headerValue: number }
  | { kind: "error"; message: string };

function App(): JSX.Element {
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
    <div className="flex min-h-screen flex-col lg:flex-row gap-12 items-center justify-center bg-gray-950 text-gray-100">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-10 shadow-xl">
        <h1 className="mb-8 text-2xl font-bold tracking-tight">
          HD Firmware Header Editor
        </h1>
        <p className="mb-6 text-sm text-gray-400">
          Select an individual firmware{" "}
          <code className="rounded bg-gray-800 px-1">.bin</code> file, verify
          the path, then write the header.
        </p>

        <p className="mb-6 text-sm text-gray-400">
          The tool will write{" "}
          <code className="rounded bg-gray-800 px-1">
            fileSize&nbsp;-&nbsp;4
          </code>{" "}
          as a 4-byte little-endian value at offset 0.
        </p>

        {/* Step 1 — pick file */}
        <button
          onClick={handleSelectFile}
          disabled={busy}
          className="w-full rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Select .bin file…
        </button>

        {/* Step 2 — show selected path for verification */}
        {selectedFile && (
          <div className="mt-4 rounded-lg border border-gray-600 bg-gray-800 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Selected file
            </p>
            <p className="break-all font-mono text-xs text-gray-200">
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
          <div className="mt-6 rounded-lg border border-green-700 bg-green-950 p-4 text-sm">
            <p className="mb-3 font-semibold text-green-400">
              Header written successfully
            </p>
            <dl className="space-y-1 text-gray-300">
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
                  {result.headerValue
                    .toString(16)
                    .toUpperCase()
                    .padStart(8, "0")}
                  )
                </dd>
              </div>
            </dl>
          </div>
        )}

        {result.kind === "error" && (
          <div className="mt-6 rounded-lg border border-red-700 bg-red-950 p-4 text-sm">
            <p className="mb-1 font-semibold text-red-400">Error</p>
            <p className="font-mono text-xs text-red-300">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
