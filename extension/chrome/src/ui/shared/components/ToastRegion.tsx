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
  return <div aria-live="polite" aria-label="Notifications" role="status">
    {messages.map((message) => (
      <div key={message.id} data-tone={message.tone ?? 'info'}>
        <span>{message.message}</span>
        {onDismiss ? (
          <button type="button" onClick={() => onDismiss(message.id)} aria-label={`Dismiss ${message.message}`}>
            Dismiss
          </button>
        ) : null}
      </div>
    ))}
  </div>;
}
