import { ActionOutcomesList } from "../components/ActionOutcomesList";

export function FileRow({ file }: { file: FileResult }): JSX.Element {
  const isSuccess = file.status === "success";
  return (
    <li
      className={`rounded-lg border p-3 text-xs ${
        isSuccess
          ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className={`font-semibold ${
            isSuccess
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {isSuccess ? "✓" : "✗"}
        </span>
        <span className="flex-1 break-all font-mono text-gray-700 dark:text-gray-200">
          {file.fileName}
        </span>
        {file.size !== undefined && (
          <span className="font-mono text-gray-500 dark:text-gray-400">
            {file.size.toLocaleString()} B
          </span>
        )}
      </div>
      {file.actions.length > 0 && (
        <div className="mt-2 border-t border-gray-300/50 pt-2 dark:border-gray-700/50">
          <ActionOutcomesList outcomes={file.actions} />
        </div>
      )}
    </li>
  );
}
