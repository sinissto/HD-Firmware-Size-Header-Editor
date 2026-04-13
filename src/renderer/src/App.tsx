import { useState } from "react";
import "./assets/main.css";

type Status =
  | { kind: "idle" }
  | { kind: "success"; filePath: string; size: number; headerValue: number }
  | { kind: "error"; message: string };

function App(): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  async function handleSelectAndWrite(): Promise<void> {
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const filePath = await window.firmwareAPI.selectFile();
      if (!filePath) {
        setBusy(false);
        return;
      }
      const { size, headerValue } =
        await window.firmwareAPI.writeHeader(filePath);
      setStatus({ kind: "success", filePath, size, headerValue });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
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
          Select a folder with group of
          <code className="rounded bg-gray-800 px-1">.bin</code> files or
          indivirual firmware{" "}
          <code className="rounded bg-gray-800 px-1">.bin</code> file to change
          file size value in the header.
        </p>

        <p className="mb-6 text-sm text-gray-400">
          The tool will write
          <code className="rounded bg-gray-800 px-1">
            fileSize&nbsp;-&nbsp;4
          </code>{" "}
          as a 4-byte little-endian value at offset 0.
        </p>

        <button
          onClick={handleSelectAndWrite}
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working…" : "Select .bin file"}
        </button>

        {status.kind === "success" && (
          <div className="mt-6 rounded-lg border border-green-700 bg-green-950 p-4 text-sm">
            <p className="mb-3 font-semibold text-green-400">
              Header written successfully
            </p>
            <dl className="space-y-1 text-gray-300">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">File</dt>
                <dd className="truncate text-right font-mono text-xs">
                  {status.filePath}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">File size</dt>
                <dd className="font-mono">
                  {status.size.toLocaleString()} bytes
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Header value</dt>
                <dd className="font-mono">
                  {status.headerValue.toLocaleString()} (0x
                  {status.headerValue
                    .toString(16)
                    .toUpperCase()
                    .padStart(8, "0")}
                  )
                </dd>
              </div>
            </dl>
          </div>
        )}

        {status.kind === "error" && (
          <div className="mt-6 rounded-lg border border-red-700 bg-red-950 p-4 text-sm">
            <p className="mb-1 font-semibold text-red-400">Error</p>
            <p className="font-mono text-xs text-red-300">{status.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
