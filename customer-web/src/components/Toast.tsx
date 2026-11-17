/** Short confirmation messages ("Added to cart"), announced to screen readers. */
import { CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

const ToastContext = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback((text: string, tone: ToastItem['tone'] = 'success') => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-2), { id, text, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(item.id), 3000);
    return () => clearTimeout(timer);
  }, [item.id, onDone]);
  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${item.tone === 'error' ? 'bg-danger' : 'bg-ink'}`}
    >
      {item.tone === 'success' && <CheckCircle2 className="size-4 shrink-0 text-gold-400" aria-hidden />}
      <span>{item.text}</span>
      <button type="button" onClick={() => onDone(item.id)} className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  return useMemo(() => show, [show]);
}
