import { useState } from "react";
import {
  ActionsCheckboxes,
  DEFAULT_ACTIONS,
  hasAnyAction,
} from "./components/ActionsCheckboxes";
import { ActionOutcomesList } from "./components/ActionOutcomesList";

type RunState =
  | { kind: "idle" }
  | { kind: "done"; result: IndividualResult }
  | { kind: "error"; message: string };

export function IndividualFileHeaderEdit(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [actions, setActions] = useState<FirmwareActions>(DEFAULT_ACTIONS);
  const [state, setState] = useState<RunState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const noActionSelected = !hasAnyAction(actions);

  async function handleSelectFile(): Promise<void> {
    const filePath = await window.firmwareAPI.selectFile();
    if (!filePath) return;
    setSelectedFile(filePath);
    setState({ kind: "idle" });
  }

  async function handleRun(): Promise<void> {
    if (!selectedFile || noActionSelected) return;
    setBusy(true);
    setState({ kind: "idle" });
    try {
      const result = await window.firmwareAPI.runActions(selectedFile, actions);
      setState({ kind: "done", result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">
        Individual Firmware File Editor
      </h1>
      <div className="flex-1 min-h-[150px]">
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Select an individual firmware{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            .bin
          </code>
          {", "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            .rpm
          </code>
          {", or "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            .bad
          </code>{" "}
          file, choose which actions to run, then click{" "}
          <strong>RUN SELECTED ACTION(s)</strong>. The original file is never
          modified — actions run on a sibling{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            _EDITED
          </code>{" "}
          copy.
        </p>
      </div>

      {/* Step 1 — pick file */}
      <button
        onClick={handleSelectFile}
        disabled={busy}
        className="w-full rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
      >
        Select firmware file…
      </button>

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

      {/* Step 2 — choose actions */}
      <ActionsCheckboxes
        actions={actions}
        onChange={setActions}
        disabled={busy}
      />

      {/* Step 3 — run */}
      <button
        onClick={handleRun}
        disabled={!selectedFile || busy || noActionSelected}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Running…" : "RUN SELECTED ACTION(s)"}
      </button>
      {noActionSelected && (
        <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
          Select at least one action to enable the button.
        </p>
      )}

      {state.kind === "done" && (
        <div
          className={`w-full mt-6 rounded-lg border p-4 text-sm ${
            state.result.status === "success"
              ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950"
              : "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950"
          }`}
        >
          <p
            className={`mb-3 font-semibold ${
              state.result.status === "success"
                ? "text-green-700 dark:text-green-400"
                : "text-yellow-700 dark:text-yellow-400"
            }`}
          >
            {state.result.status === "success"
              ? "All selected actions succeeded"
              : "Some actions failed"}
          </p>
          <dl className="mb-3 space-y-1 text-gray-700 dark:text-gray-300">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Original file</dt>
              <dd className="break-all text-right font-mono text-xs">
                {selectedFile}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Edited file</dt>
              <dd className="break-all text-right font-mono text-xs">
                {state.result.editedFilePath}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">File size</dt>
              <dd className="font-mono">
                {state.result.size.toLocaleString()} bytes
              </dd>
            </div>
          </dl>
          <ActionOutcomesList outcomes={state.result.actions} />
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-700 dark:bg-red-950">
          <p className="mb-1 font-semibold text-red-700 dark:text-red-400">
            Error
          </p>
          <p className="font-mono text-xs text-red-600 dark:text-red-300">
            {state.message}
          </p>
        </div>
      )}
    </>
  );
}
