import React, { useState } from 'react';
import { useTheme } from '../middleware/ThemeProvider.jsx';

/**
 * GlassCard
 * Card container that smoothly adapts between Light Mode and Dark Mode (HQ Glassmorphic).
 * In Light Mode: crisp white card with subtle borders and gentle elevation.
 * In Dark Mode: frosted dark slate with backdrop-blur, subtle borders, and glowing shadows.
 */
export function GlassCard({
  children,
  className = '',
  hover = false,
  style = {},
  onClick,
  ...props
}) {
  const { isDark } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const lightStyle = {
    backgroundColor: '#ffffff',
    border: hover && isHovered ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    color: '#0f172a',
    boxShadow: hover && isHovered
      ? '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
    transition: 'all 0.2s ease',
    ...style
  };

  const darkStyle = {
    backgroundColor: hover && isHovered ? 'rgba(15, 23, 42, 0.75)' : 'rgba(15, 23, 42, 0.60)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: hover && isHovered ? '1px solid rgba(51, 65, 85, 0.90)' : '1px solid rgba(30, 41, 59, 0.80)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    color: '#f8fafc',
    boxShadow: hover && isHovered
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      : '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.2s ease',
    ...style
  };

  const baseStyle = isDark ? darkStyle : lightStyle;

  return (
    <div
      className={`glass-card rounded-xl p-5 transition-all duration-200 ${
        isDark ? 'bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-xl' : 'bg-white border border-slate-200'
      } ${className}`}
      style={baseStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

export default GlassCard;
