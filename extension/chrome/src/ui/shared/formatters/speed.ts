import { formatBytes } from './bytes';
import { t } from '../i18n';

export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return t('shared.formatters.idle');
  }

  return `${formatBytes(bytesPerSecond)}/s`;
}
