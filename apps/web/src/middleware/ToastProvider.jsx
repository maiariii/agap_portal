import React, { createContext, useContext, useState, useEffect } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleToastTrigger = (e) => {
      if (e.detail) {
        setToast(e.detail);
      }
    };
    window.addEventListener('agap-toast-trigger', handleToastTrigger);
    return () => window.removeEventListener('agap-toast-trigger', handleToastTrigger);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, setToast }}>
      {children}
      {toast && (
        <div className="toast-container" style={{ zIndex: 99999 }}>
          <div className={`toast-card ${toast.type}`}>
            <span style={{ fontSize: '18px' }}>
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
