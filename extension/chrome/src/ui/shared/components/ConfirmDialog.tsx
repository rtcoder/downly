import { useId } from 'react';

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
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  return <div
    aria-describedby={description ? descriptionId : undefined}
    aria-labelledby={titleId}
    aria-modal="true"
    role="dialog"
  >
    <h2 id={titleId}>{title}</h2>
    {description ? <p id={descriptionId}>{description}</p> : null}
    <button type="button" onClick={onCancel}>{cancelLabel}</button>
    <button type="button" onClick={onConfirm}>{confirmLabel}</button>
  </div>;
}
