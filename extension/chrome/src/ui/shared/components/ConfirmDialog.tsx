import {useEffect, useId, useRef} from 'react';

import {t} from '../i18n';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
                                open,
                                title,
                                description,
                                confirmLabel,
                                cancelLabel = t('shared.confirm.cancel'),
                                onConfirm,
                                onCancel,
                              }: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelButtonRef.current?.focus();
  }, [open]);

  if (!open) {
    return null;
  }

  return <div className="dialog-overlay">
    <div
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }

        if (event.key === 'Tab') {
          keepFocusInDialog(event);
        }
      }}
      role="dialog"
    >
      <h2 id={titleId}>{title}</h2>
      {description ? <p id={descriptionId}>{description}</p> : null}
      <button ref={cancelButtonRef} type="button" onClick={onCancel}>{cancelLabel}</button>
      <button type="button" onClick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>;
}

function keepFocusInDialog(event: React.KeyboardEvent<HTMLDivElement>): void {
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );
  const first = focusable[0];
  const last = focusable.at(-1);

  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
