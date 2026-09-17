import React from 'react';
import { useTheme } from '../middleware/ThemeProvider.jsx';

/**
 * ThemeSwitch
 * A pure, standard toggle switch (track + clean sliding knob) without embedded emoji.
 */
export function ThemeSwitch({ className = '', style = {} }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`theme-switch-toggle ${className}`}
      style={{
        position: 'relative',
        width: '36px',
        height: '20px',
        borderRadius: '999px',
        padding: 0,
        background: isDark
          ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'
          : '#cbd5e1',
        border: isDark ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid #94a3b8',
        cursor: 'pointer',
        boxShadow: isDark
          ? '0 0 8px rgba(2, 132, 199, 0.35), inset 0 1px 2px rgba(0, 0, 0, 0.25)'
          : 'inset 0 1px 2px rgba(0, 0, 0, 0.12)',
        transition: 'all 0.18s ease',
        display: 'inline-flex',
        alignItems: 'center',
        outline: 'none',
        userSelect: 'none',
        flexShrink: 0,
        ...style
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: isDark ? '18px' : '2px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      />
    </button>
  );
}

/**
 * ThemeToggle
 * Compact button or switch to toggle between Light Mode (default) and Dark Mode.
 */
export function ThemeToggle({ variant = 'button', showLabel = true, className = '', style = {}, label }) {
  const { isDark, toggleTheme } = useTheme();

  if (variant === 'switch') {
    return <ThemeSwitch className={className} style={style} />;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: showLabel ? '7px 14px' : '7px 10px',
        borderRadius: '999px',
        border: '1.5px solid var(--line)',
        background: 'var(--card)',
        color: 'var(--text)',
        fontSize: '12.5px',
        fontWeight: 750,
        cursor: 'pointer',
        boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 1px 4px rgba(0, 0, 0, 0.06)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'all 0.18s ease',
        userSelect: 'none',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.borderColor = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--line)';
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
      {showLabel && <span>{label || (isDark ? 'Light Mode' : 'Dark Mode')}</span>}
    </button>
  );
}

export default ThemeToggle;
