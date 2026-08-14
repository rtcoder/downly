import { formatBytes } from './bytes';

export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return 'Idle';
  }

  return `${formatBytes(bytesPerSecond)}/s`;
}
