export function StatusBanner({ result }: { result: BatchResult }): JSX.Element {
  const successCount = result.files.filter(
    (f) => f.status === "success",
  ).length;
  const total = result.files.length;

  if (result.status === "error" && result.fatalError) {
    return (
      <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-700 dark:bg-red-950">
        <p className="mb-1 font-semibold text-red-700 dark:text-red-400">
          Error
        </p>
        <p className="font-mono text-xs text-red-600 dark:text-red-300">
          {result.fatalError}
        </p>
      </div>
    );
  }

  if (result.status === "success") {
    return (
      <div className="mt-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm dark:border-green-700 dark:bg-green-950">
        <p className="mb-1 font-semibold text-green-700 dark:text-green-400">
          All {total} file{total !== 1 ? "s" : ""} processed successfully
        </p>
        <p className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">
          {result.editedFolderPath}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm dark:border-yellow-700 dark:bg-yellow-950">
      <p className="mb-1 font-semibold text-yellow-700 dark:text-yellow-400">
        {successCount} of {total} files succeeded
      </p>
      <p className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">
        {result.editedFolderPath}
      </p>
    </div>
  );
}
