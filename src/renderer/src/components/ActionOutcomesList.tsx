const ACTION_LABEL: Record<ActionKind, string> = {
  headerSize: "File size header edit",
  fillZeros: "Fill with Zeros",
  calculateCrc: "Calculate CRC",
};

function formatValue(o: ActionOutcome): string | null {
  if (o.value === undefined) return null;
  switch (o.action) {
    case "calculateCrc":
      return `0x${o.value.toString(16).toUpperCase().padStart(8, "0")}`;
    case "fillZeros":
      return `${o.value.toLocaleString()} bytes zeroed`;
    default:
      return o.value.toLocaleString();
  }
}

export function ActionOutcomesList({
  outcomes,
}: {
  outcomes: ActionOutcome[];
}): JSX.Element {
  return (
    <ul className="space-y-1">
      {outcomes.map((o) => {
        const ok = o.status === "success";
        const value = formatValue(o);
        return (
          <li
            key={o.action}
            className={`flex items-start justify-between gap-3 rounded-md px-2 py-1 text-xs ${
              ok
                ? "text-green-700 dark:text-green-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            <span className="font-semibold">
              {ok ? "✓" : "✗"} {ACTION_LABEL[o.action]}
            </span>
            <span className="text-right font-mono break-all">
              {ok ? value ?? "done" : o.error ?? "error"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
