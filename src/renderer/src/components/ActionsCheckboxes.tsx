type Props = {
  actions: FirmwareActions;
  onChange: (next: FirmwareActions) => void;
  disabled?: boolean;
};

const LABELS: Array<{ key: keyof FirmwareActions; label: string; hint: string }> = [
  {
    key: "headerSize",
    label: "File size header edit",
    hint: "Write (file_size − 4) as a 4-byte LE value at offset 0.",
  },
  {
    key: "calculateCrc",
    label: "Calculate CRC",
    hint:
      "Write a 4-byte checksum at offset 0x0C so the sum of all u32 LE words equals 0xAA55AA55.",
  },
  {
    key: "fillZeros",
    label: "Fill with Zeros",
    hint: "Read size from header and zero-fill from that offset to end of file.",
  },
];

export function ActionsCheckboxes({ actions, onChange, disabled }: Props): JSX.Element {
  return (
    <fieldset className="mt-6 space-y-2 rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Select actions
      </legend>
      {LABELS.map(({ key, label, hint }) => (
        <label
          key={key}
          className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-sm transition hover:bg-gray-100 dark:hover:bg-gray-700 ${
            disabled ? "cursor-not-allowed opacity-60" : ""
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            checked={actions[key]}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...actions, [key]: e.target.checked })
            }
          />
          <span className="flex flex-col">
            <span className="font-medium text-gray-800 dark:text-gray-100">
              {label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {hint}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export const DEFAULT_ACTIONS: FirmwareActions = {
  headerSize: true,
  calculateCrc: false,
  fillZeros: false,
};

export function hasAnyAction(a: FirmwareActions): boolean {
  return a.headerSize || a.fillZeros || a.calculateCrc;
}
