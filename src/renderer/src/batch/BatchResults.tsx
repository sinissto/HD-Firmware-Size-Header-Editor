import { useState } from "react";
import { FileRow } from "./FileRow";
import { StatusBanner } from "./StatusBanner";

export function BatchResults({ result }: { result: BatchResult }): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <StatusBanner result={result} />
      {result.files.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <span>Files ({result.files.length})</span>
            <span className="text-base leading-none">{open ? "▲" : "▼"}</span>
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mt-2">
                <ul className="space-y-2">
                  {result.files.map((file) => (
                    <FileRow key={file.fileName} file={file} />
                  ))}
                </ul>
                {result.editedFolderPath && (
                  <p className="mt-4 break-all text-xs text-gray-400 dark:text-gray-500">
                    Edited files saved to:{" "}
                    <span className="font-mono text-gray-500 dark:text-gray-400">
                      {result.editedFolderPath}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
