import React from 'react';
import agadLogo from '../../../agadlogo.png';
import { useAuth } from '../../../middleware/AuthProvider.jsx';

export default function ModuleSelectionPage({ onSelectModule }) {
  const { user, handleLogout } = useAuth();

  const userDisplayName = user?.firstName || user?.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : (user?.fullName || user?.username || 'HR Officer');

  const userDivision = user?.division
    ? `${user.region || 'Region'} • ${user.division}`
    : (user?.region || 'Central Office / Field Station');

  const modules = [
    {
      key: 'sca_1',
      title: 'SCA I (System for Career Advancement & Assessment)',
      shortTitle: 'SCA I',
      badge: 'Active Pipeline',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Streamlined position evaluation, comparative assessment, and appointment tracking.',
      features: ['Vacancy Postings & NOSCA', 'Qualification Standards Screening', 'Comparative Assessment (CAR)', 'Appointment List Tracking'],
      colorTheme: '#0284c7',
      accentBg: 'rgba(2, 132, 199, 0.06)',
      borderColor: 'hover:border-blue-500',
      tagText: 'PRIMARY MODULE',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      shortTitle: 'Teacher Hiring',
      badge: 'Under Development',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Teacher applicant evaluation, ranking, and plantilla item assignment.',
      features: ['Teacher Applicant Intake', 'Registry of Qualified Applicants (RQA)', 'Comparative Merit Scoring', 'Plantilla Item Allocation'],
      colorTheme: '#059669',
      accentBg: 'rgba(5, 150, 105, 0.06)',
      borderColor: 'hover:border-emerald-500',
      tagText: 'TEACHING TRACK',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      shortTitle: 'Reclassification',
      badge: 'CSC QS & DBM Tracking',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description: 'Intake, CSC-approved QS re-evaluation, credential updates, and DBM submission tracking.',
      features: ['UWC Stakeholder Monitoring', 'CSC-Approved QS Matrix Re-evaluation', 'Applicant Document Updates', 'DBM Official Export Batching'],
      colorTheme: '#6366f1',
      accentBg: 'rgba(99, 102, 241, 0.06)',
      borderColor: 'hover:border-indigo-500',
      tagText: 'PROMOTION & RECLASS',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      background: 'linear-gradient(135deg, #071e3d 0%, #0c2b5e 40%, #08315f 100%)',
      display: 'flex',
      flexDirection: 'column',
      color: '#334155',
      fontFamily: 'var(--font-body, system-ui, sans-serif)'
    }}>
      {/* Top Banner Navigation */}
      <header style={{
        padding: '20px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'rgba(7, 30, 61, 0.65)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src={agadLogo}
            alt="AGAP Logo"
            style={{
              width: '46px',
              height: '46px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))'
            }}
          />
          <div>
            <div style={{
              fontSize: '10.5px',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#FBBF24'
            }}>
              DEPARTMENT OF EDUCATION
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: 850,
              color: '#ffffff',
              letterSpacing: '-0.3px',
              lineHeight: 1.1
            }}>
              AGAP <span style={{ color: '#60A5FA', fontWeight: 600 }}>Portal</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: '#fff'
          }}>
            <span style={{ fontSize: '15px' }}>👤</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 750, color: '#F1F5F9', lineHeight: 1.1 }}>
                {userDisplayName}
              </span>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                📍 {userDivision}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#FCA5A5',
              borderRadius: '10px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = '#FCA5A5';
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        padding: '48px 24px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        {/* Intro / Prompt Title */}
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            borderRadius: '999px',
            background: 'rgba(96, 165, 250, 0.15)',
            border: '1px solid rgba(96, 165, 250, 0.3)',
            color: '#93C5FD',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '14px'
          }}>
            <span>✨</span> Post-Login Gateway
          </div>
          <h1 style={{
            color: '#FFFFFF',
            fontSize: 'clamp(28px, 3.2vw, 42px)',
            fontWeight: 850,
            letterSpacing: '-0.03em',
            margin: '0 0 10px',
            lineHeight: 1.15
          }}>
            Select a Functional Module
          </h1>
          <p style={{
            color: '#CBD5E1',
            fontSize: '15.5px',
            maxWidth: '680px',
            margin: '0 auto',
            lineHeight: 1.5
          }}>
            Choose your destination workspace. You can switch between active tracks at any time using the navigation bar switcher.
          </p>
        </div>

        {/* 3 Module Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          {modules.map((m) => (
            <div
              key={m.key}
              onClick={() => onSelectModule(m.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectModule(m.key);
                }
              }}
              className="module-card-interactive"
              style={{
                background: '#ffffff',
                borderRadius: '20px',
                border: '1.5px solid rgba(226, 232, 240, 0.9)',
                padding: '30px 26px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = m.colorTheme;
                e.currentTarget.style.boxShadow = `0 20px 40px rgba(0, 0, 0, 0.18), 0 0 0 2px ${m.colorTheme}`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.9)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.12)';
              }}
            >
              {/* Top Accent bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '5px',
                background: m.colorTheme
              }} />

              <div>
                {/* Header Icon + Tag */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '16px',
                    background: m.accentBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${m.colorTheme}30`
                  }}>
                    {m.icon}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 750,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid',
                    letterSpacing: '0.04em'
                  }} className={m.badgeClass}>
                    {m.badge}
                  </span>
                </div>

                {/* Module Title */}
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.25,
                  margin: '0 0 10px'
                }}>
                  {m.title}
                </h2>

                {/* Description */}
                <p style={{
                  fontSize: '13.5px',
                  color: '#64748b',
                  lineHeight: 1.5,
                  margin: '0 0 20px'
                }}>
                  {m.description}
                </p>

                {/* Key Features List */}
                <div style={{
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
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
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: m.colorTheme, fontWeight: 'bold' }}>✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: m.colorTheme
                }}>
                  Enter Module →
                </span>
                <span style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: m.accentBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: m.colorTheme,
                  fontSize: '14px',
                  fontWeight: 700
                }}>
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 36px',
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        Department of Education · Human Resource and Organizational Development and Infrastructure · AGAP Portal v2.0
      </footer>
    </div>
  );
}
