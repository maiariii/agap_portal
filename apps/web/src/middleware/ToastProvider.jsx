import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useTheme } from './ThemeProvider.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!toast || isPaused) return;
    const duration = toast.duration || 4500;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast, isPaused]);

  useEffect(() => {
    const handleToastTrigger = (e) => {
      if (e.detail) {
        setToast(e.detail);
      }
    };
    window.addEventListener('agap-toast-trigger', handleToastTrigger);
    return () => window.removeEventListener('agap-toast-trigger', handleToastTrigger);
  }, []);

  const toastData = useMemo(() => {
    if (!toast) return null;
    const raw = String(toast.message || '');
    let title = toast.title || '';
    let body = raw;

    if (!title && raw.includes(':')) {
      const idx = raw.indexOf(':');
      title = raw.slice(0, idx).trim();
      body = raw.slice(idx + 1).trim();
    }

    const type = toast.type || 'info';

    if (!title) {
      if (type === 'warning') title = 'Access Restricted';
      else if (type === 'success') title = 'Action Successful';
      else if (type === 'error') title = 'Action Required';
      else title = 'Notice';
    }

    return { title, body, type };
  }, [toast]);

  const themeConfig = useMemo(() => {
    const type = toastData?.type || 'info';
    switch (type) {
      case 'warning':
        return {
          accent: isDark ? '#fbbf24' : '#d97706',
          badgeBg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#fef3c7',
          badgeBorder: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
          cardBorder: isDark ? 'rgba(245, 158, 11, 0.38)' : 'rgba(245, 158, 11, 0.35)',
          glow: 'rgba(245, 158, 11, 0.18)',
          gradient: 'linear-gradient(90deg, #f59e0b, #d97706)',
          icon: (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )
        };
      case 'success':
        return {
          accent: isDark ? '#34d399' : '#059669',
          badgeBg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ecfdf5',
          badgeBorder: isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
          cardBorder: isDark ? 'rgba(16, 185, 129, 0.38)' : 'rgba(16, 185, 129, 0.35)',
          glow: 'rgba(16, 185, 129, 0.18)',
          gradient: 'linear-gradient(90deg, #10b981, #059669)',
          icon: (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )
        };
      case 'error':
        return {
          accent: isDark ? '#f87171' : '#dc2626',
          badgeBg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fef2f2',
          badgeBorder: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca',
          cardBorder: isDark ? 'rgba(239, 68, 68, 0.38)' : 'rgba(239, 68, 68, 0.35)',
          glow: 'rgba(239, 68, 68, 0.18)',
          gradient: 'linear-gradient(90deg, #ef4444, #dc2626)',
          icon: (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )
        };
      default:
        return {
          accent: isDark ? '#60a5fa' : '#2563eb',
          badgeBg: isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
          badgeBorder: isDark ? 'rgba(37, 99, 235, 0.35)' : '#bfdbfe',
          cardBorder: isDark ? 'rgba(37, 99, 235, 0.38)' : 'rgba(37, 99, 235, 0.35)',
          glow: 'rgba(37, 99, 235, 0.18)',
          gradient: 'linear-gradient(90deg, #3b82f6, #2563eb)',
          icon: (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )
        };
    }
  }, [toastData?.type, isDark]);

  return (
    <ToastContext.Provider value={{ toast, setToast }}>
      {children}
      {toast && toastData && (
        <div
          className="agap-toast-portal"
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999999,
            pointerEvents: 'auto',
            animation: 'agapToastSpringIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '13px 18px',
              borderRadius: '16px',
              background: isDark
                ? 'rgba(15, 23, 42, 0.88)'
                : 'rgba(255, 255, 255, 0.92)',
              border: `1.5px solid ${themeConfig.cardBorder}`,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: isDark
                ? `0 20px 48px -8px rgba(0, 0, 0, 0.75), 0 0 30px ${themeConfig.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.15)`
                : `0 18px 40px -8px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.05), inset 0 1px 2px rgba(255, 255, 255, 1)`,
              maxWidth: '560px',
              minWidth: '360px',
              position: 'relative',
              overflow: 'hidden',
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', system-ui, sans-serif)"
            }}
          >
            {/* Top ambient glowing highlight strip */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: themeConfig.gradient,
                boxShadow: `0 1px 10px ${themeConfig.accent}`
              }}
            />

            {/* Icon Badge */}
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: themeConfig.badgeBg,
                border: `1.2px solid ${themeConfig.badgeBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: themeConfig.accent,
                flexShrink: 0,
                boxShadow: `0 2px 10px ${themeConfig.glow}`
              }}
            >
              {themeConfig.icon}
            </div>

            {/* Text Hierarchy */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: themeConfig.accent,
                  lineHeight: 1.2
                }}
              >
                {toastData.title}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 550,
                  color: isDark ? '#f8fafc' : '#1e293b',
                  lineHeight: 1.4,
                  wordBreak: 'break-word'
                }}
              >
                {toastData.body}
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss notice"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px',
                marginLeft: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: isDark ? '#94a3b8' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = isDark ? '#f8fafc' : '#0f172a';
                e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
