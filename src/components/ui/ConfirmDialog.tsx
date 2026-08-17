import React, { createContext, useContext, useState, type ReactNode, useCallback } from 'react';

interface ConfirmContextType {
  confirm: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string; isDanger?: boolean }) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};

interface ConfirmState {
  isOpen: boolean;
  message: string;
  title: string;
  confirmText: string;
  cancelText: string;
  isDanger: boolean;
  resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string, options?: { title?: string; confirmText?: string; cancelText?: string; isDanger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title: options?.title || 'Confirm Action',
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        isDanger: options?.isDanger ?? true,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmState) {
      confirmState.resolve(true);
      setConfirmState(null);
    }
  };

  const handleCancel = () => {
    if (confirmState) {
      confirmState.resolve(false);
      setConfirmState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {confirmState?.isOpen && (
        <div 
          className="modal-overlay" 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-content card" 
            style={{ 
              maxWidth: '400px',
              width: '100%',
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div className="modal-header" style={{ margin: 0 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                {confirmState.title}
              </h2>
            </div>
            <div className="modal-body" style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>{confirmState.message}</p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={handleCancel}>
                {confirmState.cancelText}
              </button>
              <button 
                className={confirmState.isDanger ? 'btn-danger' : 'btn-primary'} 
                onClick={handleConfirm}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
