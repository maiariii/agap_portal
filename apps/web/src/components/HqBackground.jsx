import React from 'react';
import { useTheme } from '../middleware/ThemeProvider.jsx';

/**
 * HqBackground
 * Ambient glow lighting layer ported from InsightED HQ v2.
 * Renders fixed-position radial blur spots behind page content only when Dark Mode is active.
 */
export default function HqBackground() {
  const { isDark } = useTheme();

  if (!isDark) {
    return null;
  }

  return (
    <div
      className="hq-background fixed inset-0 pointer-events-none z-0 bg-slate-950 overflow-hidden"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundColor: '#020617',
        overflow: 'hidden'
      }}
    >
      {/* Ambient Glow Spot 1 - Blue Top Left */}
      <div
        className="ambient-glow-spot glow-1 absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"
        style={{
          position: 'absolute',
          top: '-10rem',
          left: '-10rem',
          width: '24rem',
          height: '24rem',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          borderRadius: '9999px',
          filter: 'blur(64px)',
          pointerEvents: 'none'
        }}
      />

      {/* Ambient Glow Spot 2 - Indigo Middle Right */}
      <div
        className="ambient-glow-spot glow-2 absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"
        style={{
          position: 'absolute',
          top: '33.333%',
          right: '-10rem',
          width: '24rem',
          height: '24rem',
          backgroundColor: 'rgba(79, 70, 229, 0.15)',
          borderRadius: '9999px',
          filter: 'blur(64px)',
          pointerEvents: 'none'
        }}
      />

      {/* Ambient Glow Spot 3 - Teal Bottom Center */}
      <div
        className="ambient-glow-spot glow-3 absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl"
        style={{
          position: 'absolute',
          bottom: '-10rem',
          left: '33.333%',
          width: '24rem',
          height: '24rem',
          backgroundColor: 'rgba(13, 148, 136, 0.10)',
          borderRadius: '9999px',
          filter: 'blur(64px)',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}
