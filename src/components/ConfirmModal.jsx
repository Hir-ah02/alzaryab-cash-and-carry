import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import cx from '../utils/cx';
import Alert from './Alert';
import Button from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible confirmation dialog.
 * - role="dialog" + aria-modal, labelled by its title
 * - Cancel receives initial focus; focus is trapped inside
 * - Esc and backdrop click close it (unless an action is in progress)
 * - Focus returns to the element that opened it
 */
export default function ConfirmModal({
  open,
  title,
  message,
  warning,
  confirmLabel,
  loadingLabel,
  cancelLabel = 'Cancel',
  loading = false,
  tone = 'danger',
  icon: Icon = Trash2,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      // Return focus to the trigger; if it no longer exists (e.g. the row was
      // removed) fall back to the main content region.
      const target =
        previouslyFocused && document.body.contains(previouslyFocused)
          ? previouslyFocused
          : document.getElementById('main-content');
      target?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const requestClose = () => {
    if (!loadingRef.current) onCancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!dialogRef.current.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={handleKeyDown}
      >
        <span className={cx('modal__icon', tone === 'warning' && 'modal__icon--warning')} aria-hidden="true">
          <Icon size={22} />
        </span>
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        <p id={messageId} className="modal__message">
          {message}
        </p>
        {warning && (
          <Alert variant="warning" className="modal__alert">
            {warning}
          </Alert>
        )}
        <div className="modal__actions">
          <Button ref={cancelRef} variant="secondary" onClick={requestClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} loadingText={loadingLabel}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
