import React, { createContext, useContext, useState, type ReactNode, useCallback, useMemo } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export interface ToastOptions {
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export interface ToastMethod {
  (message: string, options?: ToastOptions): void;
  show: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

interface ToastContextType {
  toast: ToastMethod;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastMethod => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const rawToast = useCallback((message: string, options?: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type: options?.type || 'info' }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.duration || 3000);
  }, []);

  const toastObj = useMemo(() => {
    const baseFn = (message: string, options?: ToastOptions) => {
      rawToast(message, options);
    };

    return Object.assign(baseFn, {
      show: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => {
        rawToast(message, { type: type || 'info' });
      },
      success: (message: string) => {
        rawToast(message, { type: 'success' });
      },
      error: (message: string) => {
        rawToast(message, { type: 'error' });
      },
      info: (message: string) => {
        rawToast(message, { type: 'info' });
      },
      warning: (message: string) => {
        rawToast(message, { type: 'warning' });
      }
    }) as ToastMethod;
  }, [rawToast]);

  return (
    <ToastContext.Provider value={{ toast: toastObj }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-message toast-${t.type}`}>
            {t.type === 'error' && <AlertCircle size={18} />}
            {t.type === 'warning' && <AlertCircle size={18} style={{ color: '#f59e0b' }} />}
            {t.type === 'success' && <CheckCircle size={18} />}
            {t.type === 'info' && <Info size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
