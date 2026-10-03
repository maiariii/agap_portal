import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTheme } from './ThemeProvider.jsx';

const ToastContext = createContext(null);

function ToastItem({ toast, onDismiss, isDark }) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(toast.duration || 4500);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);

  const duration = toast.duration || 4500;

  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, remainingTimeRef.current);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, onDismiss]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(800, remainingTimeRef.current - elapsed);
    }
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, remainingTimeRef.current);
  };

  const { title, body, type } = useMemo(() => {
    const raw = typeof toast === 'string' ? toast : String(toast.message || '');
    let t = toast.title || '';
    let b = raw;

    // Only split on colon if NO explicit title was provided AND colon is NOT inside parentheses
    if (!t && raw.includes(':') && !raw.includes('(')) {
      const idx = raw.indexOf(':');
      if (idx > 0 && idx < 28) {
        t = raw.slice(0, idx).trim();
        b = raw.slice(idx + 1).trim();
      }
    }

    const toastType = toast.type || 'info';

    if (!t) {
      if (toastType === 'warning') t = 'Attention';
      else if (toastType === 'success') t = 'Success';
      else if (toastType === 'error') t = 'Action Failed';
      else t = 'Notice';
    }

    return { title: t, body: b, type: toastType };
  }, [toast]);

  const themeConfig = useMemo(() => {
    switch (type) {
      case 'warning':
        return {
          label: 'Warning',
          accent: isDark ? '#fbbf24' : '#d97706',
          badgeBg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#fef3c7',
          badgeBorder: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
          cardBorder: isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a',
          glow: 'rgba(245, 158, 11, 0.16)',
          gradient: 'linear-gradient(90deg, #f59e0b, #d97706)',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )
        };
      case 'success':
        return {
          label: 'Success',
          accent: isDark ? '#34d399' : '#059669',
          badgeBg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ecfdf5',
          badgeBorder: isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
          cardBorder: isDark ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0',
          glow: 'rgba(16, 185, 129, 0.16)',
          gradient: 'linear-gradient(90deg, #10b981, #059669)',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )
        };
      case 'error':
        return {
          label: 'Error',
          accent: isDark ? '#f87171' : '#dc2626',
          badgeBg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fef2f2',
          badgeBorder: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca',
          cardBorder: isDark ? 'rgba(239, 68, 68, 0.4)' : '#fecaca',
          glow: 'rgba(239, 68, 68, 0.16)',
          gradient: 'linear-gradient(90deg, #ef4444, #dc2626)',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )
        };
      default:
        return {
          label: 'Notice',
          accent: isDark ? '#60a5fa' : '#2563eb',
          badgeBg: isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
          badgeBorder: isDark ? 'rgba(37, 99, 235, 0.35)' : '#bfdbfe',
          cardBorder: isDark ? 'rgba(37, 99, 235, 0.4)' : '#bfdbfe',
          glow: 'rgba(37, 99, 235, 0.16)',
          gradient: 'linear-gradient(90deg, #3b82f6, #2563eb)',
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )
        };
    }
  }, [type, isDark]);

  return (
    <div
      style={{
        pointerEvents: 'auto',
        animation: 'agapToastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        width: '100%',
        maxWidth: '420px',
        minWidth: '320px'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '13px',
          background: isDark
            ? 'rgba(15, 23, 42, 0.94)'
            : 'rgba(255, 255, 255, 0.97)',
          border: `1.5px solid ${themeConfig.cardBorder}`,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: isDark
            ? `0 16px 36px -6px rgba(0, 0, 0, 0.75), 0 0 20px ${themeConfig.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.1)`
            : `0 14px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.04), 0 0 14px ${themeConfig.glow}, inset 0 1px 2px rgba(255, 255, 255, 1)`,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', system-ui, sans-serif)",
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        {/* Left ambient highlight indicator */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '4px',
            background: themeConfig.gradient,
            boxShadow: `0 0 8px ${themeConfig.accent}`
          }}
        />

        {/* Icon Badge */}
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: themeConfig.badgeBg,
            border: `1.2px solid ${themeConfig.badgeBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: themeConfig.accent,
            flexShrink: 0,
            marginTop: '1px',
            boxShadow: `0 2px 6px ${themeConfig.glow}`
          }}
        >
          {themeConfig.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 750,
                color: isDark ? '#f8fafc' : '#0f172a',
                lineHeight: 1.2
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                padding: '1.5px 6px',
                borderRadius: '4px',
                background: themeConfig.badgeBg,
                color: themeConfig.accent,
                border: `1px solid ${themeConfig.badgeBorder}`,
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              {themeConfig.label}
            </span>
          </div>

          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: isDark ? '#cbd5e1' : '#475569',
              lineHeight: 1.45,
              wordBreak: 'break-word'
            }}
          >
            {body}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notice"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '5px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: isDark ? '#94a3b8' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            marginTop: '1px'
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Bottom Progress Countdown Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '2px',
            width: '100%',
            background: themeConfig.accent,
            opacity: 0.65,
            transformOrigin: 'left',
            animation: `agapToastProgress ${duration}ms linear forwards`,
            animationPlayState: isPaused ? 'paused' : 'running'
          }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { isDark } = useTheme();

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setToast = useCallback((payload) => {
    if (!payload) {
      setToasts([]);
      return;
    }
    const newToast = {
      ...(typeof payload === 'string' ? { message: payload } : payload),
      id: Date.now() + Math.random().toString(36).substring(2, 7)
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 2)]);
  }, []);

  useEffect(() => {
    const handleToastTrigger = (e) => {
      if (e.detail) {
        setToast(e.detail);
      }
    };
    window.addEventListener('agap-toast-trigger', handleToastTrigger);
    return () => window.removeEventListener('agap-toast-trigger', handleToastTrigger);
  }, [setToast]);

  return (
    <ToastContext.Provider value={{ toast: toasts[0] || null, toasts, setToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="agap-toast-portal"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 99999999,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-end',
            maxWidth: '440px',
            width: 'calc(100% - 48px)'
          }}
        >
          {toasts.map((item) => (
            <ToastItem
              key={item.id}
              toast={item}
              onDismiss={dismissToast}
              isDark={isDark}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

