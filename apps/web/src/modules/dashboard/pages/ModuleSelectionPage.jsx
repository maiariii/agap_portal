import React, { useState } from 'react';
import agadLogo from '../../../agadlogo.png';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import { useTheme } from '../../../middleware/ThemeProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import ThemeToggle from '../../../components/ThemeToggle.jsx';

export default function ModuleSelectionPage({ onSelectModule }) {
  const { user, handleLogout } = useAuth();
  const { setToast } = useToast();
  const { isDark } = useTheme();
  const [hoveredCard, setHoveredCard] = useState(null);

  const isRegionalOffice = user?.role === 'regional_office' || String(user?.position || '').toLowerCase().trim() === 'regional office';

  const userDisplayName = user?.firstName || user?.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : (user?.fullName || user?.username || 'HR Officer');

  const userDivision = [user?.region, user?.division].filter(Boolean).join(' • ') || 'Central Office / Field Station';

  const modules = [
    {
      key: 'sca_1',
      title: 'SCA I',
      subtitle: 'Career Advancement & Merit Assessment',
      isLocked: isRegionalOffice,
      badge: isRegionalOffice ? 'HRMO Only' : 'Active Pipeline',
      badgeBg: isRegionalOffice
        ? (isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9')
        : (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff'),
      badgeColor: isRegionalOffice
        ? (isDark ? '#94a3b8' : '#64748b')
        : (isDark ? '#93c5fd' : '#2563eb'),
      badgeBorder: isRegionalOffice
        ? (isDark ? 'rgba(100, 116, 139, 0.4)' : '#cbd5e1')
        : (isDark ? 'rgba(59, 130, 246, 0.4)' : '#bfdbfe'),
      description: 'Streamlined position evaluation, comparative assessment (CAR), and official appointment lifecycle tracking.',
      features: ['Vacancy Postings & NOSCA Verification', 'Qualification Standards (QS) Screening', 'Comparative Assessment Results (CAR)', 'Appointment & Plantilla Item Tracking'],
      color: isRegionalOffice ? '#64748b' : '#2563eb',
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
      subtitle: 'Applicant Evaluation & Plantilla Ranking',
      isLocked: isRegionalOffice,
      badge: isRegionalOffice ? 'HRMO Only' : 'Under Development',
      badgeBg: isRegionalOffice
        ? (isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9')
        : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5'),
      badgeColor: isRegionalOffice
        ? (isDark ? '#94a3b8' : '#64748b')
        : (isDark ? '#6ee7b7' : '#059669'),
      badgeBorder: isRegionalOffice
        ? (isDark ? 'rgba(100, 116, 139, 0.4)' : '#cbd5e1')
        : (isDark ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0'),
      description: 'Comprehensive intake, comparative merit scoring, and plantilla item allocation under DO 007, s. 2023.',
      features: ['Teacher Applicant Intake & Roster', 'Registry of Qualified Applicants (RQA)', 'Comparative Merit & CAR-RQA Scoring', 'Plantilla Item Allocation & Assignment'],
      color: isRegionalOffice ? '#64748b' : '#059669',
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
      subtitle: 'CSC QS Matrix & DBM Submission',
      isLocked: false,
      badge: isRegionalOffice ? 'Authorized Module' : 'CSC QS & DBM',
      badgeBg: isRegionalOffice
        ? (isDark ? 'rgba(99, 102, 241, 0.25)' : '#ede9fe')
        : (isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff'),
      badgeColor: isRegionalOffice
        ? (isDark ? '#c7d2fe' : '#4f46e5')
        : (isDark ? '#a5b4fc' : '#6366f1'),
      badgeBorder: isRegionalOffice
        ? (isDark ? 'rgba(99, 102, 241, 0.6)' : '#a5b4fc')
        : (isDark ? 'rgba(99, 102, 241, 0.4)' : '#c7d2fe'),
      description: 'Intake validation, CSC-approved QS matrix re-evaluation, credential updates, and DBM export batching.',
      features: ['UWC Stakeholder & Counselor Monitoring', 'CSC-Approved QS Matrix Re-evaluation', 'Applicant Credential & Service Updates', 'DBM Official Endorsement Batching'],
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
                {(user?.role === 'regional_office' ? 'Regional Office' : (user?.position || 'HRMO'))} • {userDivision}
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
        {/* Intro / Administrative Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '36px',
          animation: 'fadeInUp 0.5s ease-out both',
          position: 'relative'
        }}>
          {/* Institutional Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            borderRadius: '6px',
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
            color: isDark ? '#94a3b8' : '#475569',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '16px'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: isDark ? '#60a5fa' : '#1e40af' }}>
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
            </svg>
            <span>Republic of the Philippines &bull; Department of Education</span>
          </div>

          {/* Clean Executive Headline */}
          <h1 style={{
            color: isDark ? '#f8fafc' : '#0f2444',
            fontSize: 'clamp(28px, 3.2vw, 38px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1.2
          }}>
            Select an Operational Module
          </h1>
        </div>

        {/* Regional Office Access Banner */}
        {isRegionalOffice && (
          <div style={{
            margin: '0 auto 28px',
            maxWidth: '860px',
            width: '100%',
            padding: '12px 20px',
            borderRadius: '14px',
            background: isDark ? 'rgba(99, 102, 241, 0.12)' : '#eef2ff',
            border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #c7d2fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            fontSize: '13px',
            color: isDark ? '#c7d2fe' : '#4338ca',
            fontWeight: 600,
            animation: 'fadeInUp 0.4s ease-out both'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: isDark ? 'rgba(99, 102, 241, 0.25)' : '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                🏛️
              </div>
              <div>
                <span style={{ fontWeight: 800 }}>Regional Office Access:</span> Your account is provisioned for the <strong>Reclassification</strong> module (CSC QS Matrix &amp; DBM Submission).
              </div>
            </div>
            <button
              onClick={() => onSelectModule('reclassification')}
              style={{
                background: '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9px',
                padding: '7px 16px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#4f46e5'}
              onMouseOut={e => e.currentTarget.style.background = '#6366f1'}
            >
              Enter Module →
            </button>
          </div>
        )}

        {/* Module Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          {modules.map((m, index) => {
            const isLocked = Boolean(m.isLocked);
            const isHovered = hoveredCard === m.key && !isLocked;
            return (
              <div
                key={m.key}
                onClick={() => {
                  if (isLocked) {
                    if (setToast) {
                      setToast({
                        message: 'Access Restricted: Regional Office accounts can only access the Reclassification module.',
                        type: 'warning'
                      });
                    }
                    return;
                  }
                  onSelectModule(m.key);
                }}
                onMouseEnter={() => !isLocked && setHoveredCard(m.key)}
                onMouseLeave={() => setHoveredCard(null)}
                role="button"
                tabIndex={isLocked ? -1 : 0}
                aria-disabled={isLocked}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isLocked) {
                      if (setToast) {
                        setToast({
                          message: 'Access Restricted: Regional Office accounts can only access the Reclassification module.',
                          type: 'warning'
                        });
                      }
                      return;
                    }
                    onSelectModule(m.key);
                  }
                }}
                style={{
                  background: isLocked
                    ? (isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(241, 245, 249, 0.55)')
                    : isDark
                      ? (isHovered
                          ? 'rgba(21, 32, 54, 0.88)'
                          : 'rgba(15, 23, 42, 0.68)')
                      : (isHovered
                          ? `linear-gradient(155deg, rgba(255, 255, 255, 0.96) 0%, ${m.lightBg} 100%)`
                          : 'linear-gradient(155deg, rgba(255, 255, 255, 0.84) 0%, rgba(241, 245, 249, 0.72) 100%)'),
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  borderRadius: '24px',
                  border: isLocked
                    ? (isDark ? '1.5px dashed rgba(71, 85, 105, 0.5)' : '1.5px dashed rgba(203, 213, 225, 0.8)')
                    : (!isLocked && isRegionalOffice)
                      ? (isHovered ? `2px solid ${m.color}` : '2px solid rgba(99, 102, 241, 0.6)')
                      : isDark
                        ? (isHovered ? `1.5px solid ${m.color}` : '1.5px solid rgba(51, 65, 85, 0.75)')
                        : (isHovered ? `1.5px solid ${m.color}` : '1.5px solid rgba(255, 255, 255, 0.85)'),
                  padding: '28px 24px 24px',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? (isDark ? 0.45 : 0.55) : 1,
                  filter: isLocked ? 'grayscale(45%)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
                  boxShadow: isLocked
                    ? 'none'
                    : (!isLocked && isRegionalOffice)
                      ? (isHovered
                          ? `0 24px 50px rgba(0, 0, 0, 0.65), 0 0 30px ${m.color}50, inset 0 1px 1px rgba(255, 255, 255, 0.2)`
                          : (isDark ? '0 12px 28px -5px rgba(0, 0, 0, 0.5), 0 0 18px rgba(99, 102, 241, 0.25)' : '0 14px 34px -6px rgba(99, 102, 241, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.95)'))
                      : isDark
                        ? (isHovered
                            ? `0 24px 50px rgba(0, 0, 0, 0.65), 0 0 30px ${m.color}40, inset 0 1px 1px rgba(255, 255, 255, 0.2)`
                            : '0 12px 28px -5px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)')
                        : (isHovered
                            ? `0 24px 44px -10px ${m.color}35, 0 12px 24px -8px rgba(15, 23, 42, 0.08), inset 0 1px 2px rgba(255, 255, 255, 1), 0 0 0 1px ${m.color}35`
                            : '0 14px 34px -6px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04), inset 0 1px 2px rgba(255, 255, 255, 0.95), 0 0 0 1px rgba(226, 232, 240, 0.65)'),
                  animation: `fadeInUp 0.5s ease-out ${0.08 + index * 0.08}s both`,
                  outline: 'none'
                }}
              >
                {/* Top accent glass gradient bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: isHovered ? '4px' : '3px',
                  background: isHovered ? m.accentGradient : `linear-gradient(90deg, ${m.color}60, ${m.color}20)`,
                  boxShadow: isHovered ? `0 2px 14px ${m.color}90` : 'none',
                  transition: 'all 0.3s ease'
                }} />

                {/* Ambient glass top edge highlight reflection */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: isDark
                    ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent)',
                  pointerEvents: 'none',
                  zIndex: 3
                }} />

                {/* Looping glass light-sweep shimmer ray (only triggers and loops when module is in hover) */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '60%',
                    background: isDark
                      ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05), transparent)'
                      : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.4), transparent)',
                    transform: 'skewX(-25deg)',
                    pointerEvents: 'none',
                    zIndex: 3,
                    animation: 'glassShimmerLoop 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                  }} />
                )}

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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                      boxShadow: isHovered ? `0 2px 8px ${m.color}25` : 'none',
                      transition: 'all 0.25s ease'
                    }}>
                      {isLocked && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      )}
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: isDark ? '#93c5fd' : m.color,
                    marginBottom: '10px',
                    letterSpacing: '0.01em',
                    lineHeight: 1.3
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: m.color,
                      boxShadow: `0 0 8px ${m.color}`,
                      flexShrink: 0
                    }} />
                    <span>{m.subtitle}</span>
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: '13px',
                    color: isDark ? '#cbd5e1' : '#475569',
                    lineHeight: 1.6,
                    margin: '0 0 20px',
                    fontWeight: 480,
                    minHeight: '42px'
                  }}>
                    {m.description}
                  </p>

                  {/* Key Features List */}
                  <div style={{
                    paddingTop: '16px',
                    borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
                    marginBottom: '18px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '12px'
                    }}>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: isDark ? '#94a3b8' : '#64748b'
                      }}>
                        Included Capabilities
                      </span>
                      <div style={{
                        flex: 1,
                        height: '1px',
                        background: isDark
                          ? 'linear-gradient(90deg, rgba(51, 65, 85, 0.7), transparent)'
                          : 'linear-gradient(90deg, #e2e8f0, transparent)'
                      }} />
                    </div>
                    <ul style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      {m.features.map((feat, idx) => (
                        <li key={idx} style={{
                          fontSize: '12.5px',
                          color: isHovered
                            ? (isDark ? '#f8fafc' : '#0f172a')
                            : (isDark ? '#cbd5e1' : '#334155'),
                          display: 'flex',
                          alignItems: 'center',
                          gap: '9px',
                          fontWeight: isHovered ? 600 : 500,
                          padding: '5px 8px',
                          borderRadius: '8px',
                          background: isHovered
                            ? (isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.75)')
                            : 'transparent',
                          transition: 'all 0.2s ease',
                          transform: isHovered ? 'translateX(3px)' : 'translateX(0)'
                        }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '6px',
                            background: isHovered
                              ? (isDark ? `${m.color}35` : `${m.color}18`)
                              : (isDark ? 'rgba(51, 65, 85, 0.4)' : `${m.color}12`),
                            border: `1.2px solid ${isHovered ? m.color : (isDark ? `${m.color}50` : `${m.color}35`)}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.2s ease'
                          }}>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2.5 6.2L4.8 8.5L9.5 3.5"
                                stroke={m.color}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <span style={{ lineHeight: 1.35 }}>{feat}</span>
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
                  {isLocked ? (
                    <>
                      <span style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: isDark ? '#64748b' : '#94a3b8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Restricted to HRMO
                      </span>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f1f5f9',
                        border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDark ? '#64748b' : '#94a3b8'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.85);
          }
        }
        @keyframes glassShimmerLoop {
          0% {
            left: -85%;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          65% {
            left: 145%;
            opacity: 1;
          }
          70%, 100% {
            left: 145%;
            opacity: 0;
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
