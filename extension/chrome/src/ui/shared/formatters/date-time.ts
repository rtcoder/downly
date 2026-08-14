import { t } from '../i18n';

export interface DateTimeFormatOptions {
  timeZone?: string;
}

export function formatDateTime(value: string | null | undefined, options: DateTimeFormatOptions = {}): string {
  if (!value) {
    return t('shared.formatters.unknownDate');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('shared.formatters.unknownDate');
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: options.timeZone,
  }).format(date).replace(',', ',');
}
