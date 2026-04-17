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
          className={`font-semibold ${isSuccess ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {isSuccess ? "✓" : "✗"}
        </span>
        <span className="flex-1 break-all font-mono text-gray-700 dark:text-gray-200">
          {file.fileName}
        </span>
      </div>
      {isSuccess &&
        file.size !== undefined &&
        file.headerValue !== undefined && (
          <dl className="mt-2 space-y-1 text-gray-500 dark:text-gray-400">
            <div className="flex justify-between gap-4">
              <dt>File size</dt>
              <dd className="font-mono text-gray-700 dark:text-gray-300">
                {file.size.toLocaleString()} bytes
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Header value</dt>
              <dd className="font-mono text-gray-700 dark:text-gray-300">
                {file.headerValue.toLocaleString()} (0x
                {file.headerValue.toString(16).toUpperCase().padStart(8, "0")})
              </dd>
            </div>
          </dl>
        )}
      {!isSuccess && file.error && (
        <p className="mt-2 font-mono text-red-600 dark:text-red-300">
          {file.error}
        </p>
      )}
    </li>
  );
}
