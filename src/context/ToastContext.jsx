import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, CircleX, X } from 'lucide-react';

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 4000;

function Toast({ toast, onDismiss }) {
  const timer = useRef(null);

  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  const Icon = toast.type === 'error' ? CircleX : CircleCheck;

  return (
    <div
      className={`toast toast--${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      // Pause auto-dismiss while the user is reading / interacting.
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
      onFocus={() => clearTimeout(timer.current)}
      onBlur={start}
    >
      <span className="toast__icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="toast__content">
        <p className="toast__title">{toast.title}</p>
        {toast.message && <p className="toast__message">{toast.message}</p>}
      </div>
      <button type="button" className="toast__close" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type, title, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((list) => [...list.slice(-3), { id, type, title, message }]);
    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (title, message) => show('success', title, message),
      error: (title, message) => show('error', title, message),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
