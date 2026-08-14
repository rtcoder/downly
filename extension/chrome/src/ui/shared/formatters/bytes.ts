const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(value: number | null | undefined, fallback = 'Unknown size'): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  if (value < 1_024) {
    return `${Math.round(value)} B`;
  }

  let unitIndex = 0;
  let scaledValue = value;

  while (scaledValue >= 1_024 && unitIndex < BYTE_UNITS.length - 1) {
    scaledValue /= 1_024;
    unitIndex += 1;
  }

  return `${scaledValue.toFixed(1)} ${BYTE_UNITS[unitIndex]}`;
}
