import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Non-blocking feedback, with undo where an action is reversible.
 *
 * Optimistic updates need a visible way back: marking an order packed shows
 * success immediately, and if the request fails the row must revert
 * noticeably rather than silently disagreeing with the server.
 */
export interface Toast {
  id: number;
  tone: 'success' | 'error';
  title: string;
  detail?: string;
  onUndo?: () => void;
}

const ToastContext = createContext<{
  notify: (t: Omit<Toast, 'id'>) => void;
}>({ notify: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    // Errors stay longer: they usually need reading, not just noticing.
    window.setTimeout(() => dismiss(id), t.tone === 'error' ? 8000 : 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed z-50 bottom-20 lg:bottom-6 right-4 left-4 lg:left-auto lg:w-96 space-y-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm',
              t.tone === 'error' ? 'border-[#A33A28]/30' : 'border-[#EBD9BC]',
            )}
          >
            {t.tone === 'error' ? (
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#A33A28]" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#647044]" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#483828]">{t.title}</p>
              {t.detail && <p className="text-xs text-[#483828]/70 mt-0.5">{t.detail}</p>}
              {t.onUndo && (
                <button
                  type="button"
                  onClick={() => { t.onUndo?.(); dismiss(t.id); }}
                  className="mt-1.5 text-xs font-semibold text-[#87380F] underline min-h-11 -my-2 py-2"
                >
                  Undo
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-[#483828]/40 hover:text-[#483828] min-h-11 min-w-11 -m-3 grid place-items-center"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
