import { t } from '../i18n';

export interface ToastMessage {
  actionLabel?: string;
  id: string;
  message: string;
  onAction?: () => void;
  tone?: 'info' | 'success' | 'warning' | 'error';
}

export interface ToastRegionProps {
  messages: ToastMessage[];
  onDismiss?: (messageId: string) => void;
}

export function ToastRegion({ messages, onDismiss }: ToastRegionProps) {
  return <div aria-live="polite" aria-label={t('shared.notifications')} className="toast-region" role="status">
    {messages.map((message) => (
      <div key={message.id} data-tone={message.tone ?? 'info'}>
        <span>{message.message}</span>
        {message.actionLabel && message.onAction ? (
          <button type="button" onClick={message.onAction}>{message.actionLabel}</button>
        ) : null}
        {onDismiss ? (
          <button type="button" onClick={() => onDismiss(message.id)} aria-label={t('shared.dismissLabel', { message: message.message })}>
            {t('shared.dismiss')}
          </button>
        ) : null}
      </div>
    ))}
  </div>;
}
