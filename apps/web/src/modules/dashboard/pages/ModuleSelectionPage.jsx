import React, { useState } from 'react';
import agadLogo from '../../../agadlogo.png';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import { useTheme } from '../../../middleware/ThemeProvider.jsx';
import ThemeToggle from '../../../components/ThemeToggle.jsx';

export default function ModuleSelectionPage({ onSelectModule }) {
  const { user, handleLogout } = useAuth();
  const { isDark } = useTheme();
  const [hoveredCard, setHoveredCard] = useState(null);

  const userDisplayName = user?.firstName || user?.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : (user?.fullName || user?.username || 'HR Officer');

  const userDivision = [user?.region, user?.division].filter(Boolean).join(' • ') || 'Central Office / Field Station';

  const modules = [
    {
      key: 'sca_1',
      title: 'SCA I',
      subtitle: 'System for Career Advancement & Assessment',
      badge: 'Active Pipeline',
      badgeBg: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
      badgeColor: isDark ? '#93c5fd' : '#2563eb',
      badgeBorder: isDark ? 'rgba(59, 130, 246, 0.4)' : '#bfdbfe',
      description: 'Streamlined position evaluation, comparative assessment, and appointment tracking.',
      features: ['Vacancy Postings & NOSCA', 'Qualification Standards Screening', 'Comparative Assessment (CAR)', 'Appointment List Tracking'],
      color: '#2563eb',
      lightBg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
      accentGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      )
    },
    {
      key: 'teacher_hiring',
      title: 'Teacher Hiring',
      subtitle: 'Applicant Evaluation & Ranking',
      badge: 'Under Development',
      badgeBg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
      badgeColor: isDark ? '#6ee7b7' : '#059669',
      badgeBorder: isDark ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0',
      description: 'Teacher applicant evaluation, ranking, and plantilla item assignment.',
      features: ['Teacher Applicant Intake', 'Registry of Qualified Applicants (RQA)', 'Comparative Merit Scoring', 'Plantilla Item Allocation'],
      color: '#059669',
      lightBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
      accentGradient: 'linear-gradient(135deg, #10b981, #059669)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      key: 'reclassification',
      title: 'Reclassification',
      subtitle: 'CSC QS & DBM Tracking',
      badge: 'CSC QS & DBM',
      badgeBg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
      badgeColor: isDark ? '#a5b4fc' : '#6366f1',
      badgeBorder: isDark ? 'rgba(99, 102, 241, 0.4)' : '#c7d2fe',
      description: 'Intake, CSC-approved QS re-evaluation, credential updates, and DBM submission tracking.',
      features: ['UWC Stakeholder Monitoring', 'CSC-Approved QS Matrix Re-evaluation', 'Applicant Document Updates', 'DBM Official Export Batching'],
      color: '#6366f1',
      lightBg: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
      accentGradient: 'linear-gradient(135deg, #818cf8, #6366f1)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      )
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#020617' : '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "var(--font-body, 'Plus Jakarta Sans', system-ui, sans-serif)",
      position: 'relative',
      overflow: 'hidden',
      color: isDark ? '#f8fafc' : '#0f172a',
      transition: 'background-color 0.25s ease, color 0.25s ease'
    }}>
      {/* Ambient background glow shapes */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          top: '-15%',
          right: '-8%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
          filter: 'blur(70px)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 70%)',
          filter: 'blur(80px)'
        }} />
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '40%',
          width: '500px',
          height: '400px',
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%)',
          filter: 'blur(100px)'
        }} />
        {/* Subtle dot grid pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)'
            : 'radial-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }} />
      </div>

      {/* Top Banner Navigation */}
      <header style={{
        padding: '14px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.65)' : '1px solid #e2e8f0',
        background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={agadLogo}
            alt="AGAP Logo"
            style={{
              width: '56px',
              height: '56px',
              objectFit: 'contain'
            }}
          />
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: isDark ? '#fbbf24' : '#d97706',
              marginBottom: '2px'
            }}>
              DEPARTMENT OF EDUCATION
            </div>
            <div style={{
              fontSize: '22px',
              fontWeight: 850,
              color: isDark ? '#f8fafc' : '#08315f',
              letterSpacing: '-0.4px',
              lineHeight: 1.1
            }}>
              AGAP <span style={{ color: isDark ? '#60a5fa' : '#2563eb', fontWeight: 600 }}>Portal</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle showLabel={false} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            borderRadius: '14px',
            background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
            boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              color: '#fff',
              fontWeight: 800
            }}>
              {(userDisplayName || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', lineHeight: 1.2 }}>
                {userDisplayName}
              </span>
              <span style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
                {userDivision}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#fff',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
              color: isDark ? '#cbd5e1' : '#64748b',
              borderRadius: '10px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2';
              e.currentTarget.style.borderColor = isDark ? 'rgba(239, 68, 68, 0.4)' : '#fecaca';
              e.currentTarget.style.color = isDark ? '#f87171' : '#dc2626';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.7)' : '#fff';
              e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0';
              e.currentTarget.style.color = isDark ? '#cbd5e1' : '#64748b';
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        maxWidth: '1140px',
        width: '100%',
        margin: '0 auto',
        padding: '52px 28px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Intro */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px',
          animation: 'fadeInUp 0.5s ease-out both'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 14px',
            borderRadius: '999px',
            background: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
            border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
            color: isDark ? '#93c5fd' : '#2563eb',
            fontSize: '11px',
            fontWeight: 750,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '18px'
          }}>
            <span style={{ fontSize: '12px' }}>✦</span> Post-Login Gateway
          </div>
          <h1 style={{
            color: isDark ? '#f8fafc' : '#08315f',
            fontSize: 'clamp(28px, 3.2vw, 40px)',
            fontWeight: 850,
            letterSpacing: '-0.04em',
            margin: '0 0 10px',
            lineHeight: 1.15
          }}>
            Select a Functional Module
          </h1>
          <p style={{
            color: isDark ? '#94a3b8' : '#64748b',
            fontSize: '15px',
            maxWidth: '520px',
            margin: '0 auto',
            lineHeight: 1.6,
            fontWeight: 450
          }}>
            Choose your destination workspace. Switch between active tracks at any time using the navigation bar.
          </p>
        </div>

        {/* Module Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          {modules.map((m, index) => {
            const isHovered = hoveredCard === m.key;
            return (
              <div
                key={m.key}
                onClick={() => onSelectModule(m.key)}
                onMouseEnter={() => setHoveredCard(m.key)}
                onMouseLeave={() => setHoveredCard(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectModule(m.key);
                  }
                }}
                style={{
                  background: isDark
                    ? (isHovered ? 'rgba(21, 32, 54, 0.92)' : 'rgba(15, 23, 42, 0.72)')
                    : (isHovered ? `linear-gradient(180deg, ${m.lightBg} 0%, #ffffff 28%, #ffffff 100%)` : '#ffffff'),
                  backdropFilter: isDark ? 'blur(16px)' : 'none',
                  WebkitBackdropFilter: isDark ? 'blur(16px)' : 'none',
                  borderRadius: '22px',
                  border: isDark
                    ? (isHovered ? `1.5px solid ${m.color}` : '1.5px solid rgba(51, 65, 85, 0.7)')
                    : (isHovered ? `1.5px solid ${m.color}` : '1.5px solid #e2e8f0'),
                  padding: '28px 24px 24px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
                  boxShadow: isDark
                    ? (isHovered
                        ? `0 24px 50px rgba(0, 0, 0, 0.65), 0 0 25px ${m.color}35, 0 0 0 1px ${m.color}50`
                        : '0 10px 25px -5px rgba(0, 0, 0, 0.5)')
                    : (isHovered
                        ? `0 22px 42px -10px ${m.color}35, 0 10px 20px -6px rgba(15, 23, 42, 0.08), 0 0 0 1px ${m.color}40`
                        : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 14px rgba(0, 0, 0, 0.03)'),
                  animation: `fadeInUp 0.5s ease-out ${0.08 + index * 0.08}s both`,
                  outline: 'none'
                }}
              >
                {/* Top accent gradient bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: isHovered ? '4px' : '3px',
                  background: isHovered ? m.accentGradient : `linear-gradient(90deg, ${m.color}50, ${m.color}15)`,
                  boxShadow: isHovered ? `0 2px 12px ${m.color}90` : 'none',
                  transition: 'all 0.3s ease'
                }} />

                {/* Animated light-sweep shimmer ray on hover */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: isHovered ? '135%' : '-65%',
                  width: '55%',
                  height: '100%',
                  background: isDark
                    ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
                  transform: 'skewX(-24deg)',
                  transition: isHovered ? 'left 0.75s ease-in-out' : 'none',
                  pointerEvents: 'none',
                  zIndex: 2
                }} />

                {/* Subtle radiant background glow when hovered */}
                <div style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${m.color}${isDark ? '25' : '15'} 0%, transparent 70%)`,
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'scale(1.2)' : 'scale(0.8)',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                  pointerEvents: 'none',
                  zIndex: 0
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Header: Icon + Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: isHovered ? m.accentGradient : m.lightBg,
                      border: isDark
                        ? (isHovered ? '1px solid transparent' : `1px solid ${m.color}35`)
                        : (isHovered ? '1px solid transparent' : `1px solid ${m.color}25`),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isHovered ? '#ffffff' : m.color,
                      transform: isHovered ? 'scale(1.08) translateY(-2px)' : 'scale(1) translateY(0)',
                      boxShadow: isHovered
                        ? `0 8px 20px -2px ${m.color}50`
                        : (isDark ? 'none' : '0 2px 6px rgba(0,0,0,0.02)'),
                      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                      {m.icon}
                    </div>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 750,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: m.badgeBg,
                      color: m.badgeColor,
                      border: `1px solid ${m.badgeBorder}`,
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                      transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                      boxShadow: isHovered ? `0 2px 8px ${m.color}25` : 'none',
                      transition: 'all 0.25s ease'
                    }}>
                      {m.badge}
                    </span>
                  </div>

                  {/* Module Title */}
                  <h2 style={{
                    fontSize: '21px',
                    fontWeight: 800,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    lineHeight: 1.2,
                    margin: '0 0 3px',
                    letterSpacing: '-0.02em',
                    transition: 'color 0.25s ease'
                  }}>
                    {m.title}
                  </h2>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 650,
                    color: isDark ? '#93c5fd' : m.color,
                    marginBottom: '10px',
                    letterSpacing: '0.01em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {m.subtitle}
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: '13px',
                    color: isDark ? '#94a3b8' : '#64748b',
                    lineHeight: 1.55,
                    margin: '0 0 18px',
                    fontWeight: 450
                  }}>
                    {m.description}
                  </p>

                  {/* Key Features List */}
                  <div style={{
                    paddingTop: '14px',
                    borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
                    marginBottom: '18px'
                  }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 750,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: isDark ? '#64748b' : '#94a3b8',
                      marginBottom: '10px'
                    }}>
                      Included Capabilities
                    </div>
                    <ul style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px'
                    }}>
                      {m.features.map((feat, idx) => (
                        <li key={idx} style={{
                          fontSize: '12.5px',
                          color: isHovered
                            ? (isDark ? '#f1f5f9' : '#1e293b')
                            : (isDark ? '#cbd5e1' : '#334155'),
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: isHovered ? 520 : 480,
                          transition: 'all 0.2s ease'
                        }}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transition: 'transform 0.25s ease', transform: isHovered ? 'scale(1.1)' : 'scale(1)' }}>
                            <circle
                              cx="8"
                              cy="8"
                              r="7"
                              stroke={m.color}
                              strokeWidth="1.5"
                              strokeOpacity={isHovered ? '1' : (isDark ? '0.5' : '0.35')}
                              fill={isHovered ? (isDark ? `${m.color}25` : `${m.color}15`) : 'none'}
                              style={{ transition: 'all 0.25s ease' }}
                            />
                            <path
                              d="M5 8l2 2 4-4"
                              stroke={m.color}
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '14px',
                  borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: isHovered ? 800 : 700,
                    color: isHovered ? (isDark ? '#f8fafc' : m.color) : (isDark ? '#64748b' : '#94a3b8'),
                    transition: 'all 0.25s ease',
                    letterSpacing: '-0.01em'
                  }}>
                    Enter Module
                  </span>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: isHovered
                      ? m.accentGradient
                      : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc'),
                    border: isHovered
                      ? '1px solid transparent'
                      : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isHovered ? 'translateX(5px) scale(1.05)' : 'translateX(0) scale(1)',
                    boxShadow: isHovered
                      ? `0 4px 14px ${m.color}50`
                      : 'none'
                  }}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke={isHovered ? '#ffffff' : (isDark ? '#64748b' : '#94a3b8')}
                        strokeWidth={isHovered ? '2' : '1.5'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transition: 'stroke 0.25s ease, stroke-width 0.25s ease' }}
                      />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 36px',
        color: isDark ? '#64748b' : '#94a3b8',
        fontSize: '11.5px',
        borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
        position: 'relative',
        zIndex: 1,
        fontWeight: 500,
        letterSpacing: '0.01em',
        background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.6)'
      }}>
        Department of Education · Human Resource and Organizational Development and Infrastructure · AGAP Portal v2.0
      </footer>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 960px) {
          main > div:last-child {
            grid-template-columns: 1fr !important;
            max-width: 440px;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}
