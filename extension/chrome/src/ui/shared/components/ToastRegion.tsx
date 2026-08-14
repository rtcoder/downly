import { t } from '../i18n';

export interface ToastMessage {
  id: string;
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
}

export interface ToastRegionProps {
  messages: ToastMessage[];
  onDismiss?: (messageId: string) => void;
}

export function ToastRegion({ messages, onDismiss }: ToastRegionProps) {
  return <div aria-live="polite" aria-label={t('shared.notifications')} role="status">
    {messages.map((message) => (
      <div key={message.id} data-tone={message.tone ?? 'info'}>
        <span>{message.message}</span>
        {onDismiss ? (
          <button type="button" onClick={() => onDismiss(message.id)} aria-label={t('shared.dismissLabel', { message: message.message })}>
            {t('shared.dismiss')}
          </button>
        ) : null}
      </div>
    ))}
  </div>;
}
