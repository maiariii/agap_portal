import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './middleware/AuthProvider.jsx';
import { useToast } from './middleware/ToastProvider.jsx';
import { useAppData } from './middleware/DataProvider.jsx';
import { apiFetch } from './config/api.js';
import { routes } from './config/routes.jsx';
import agadLogo from './agadlogo.png';

const TOUR_STEPS = [
  { view: "home", sel: ".kpis", title: "Headline metrics", body: "These KPI cards give you an at-a-glance summary of the data module you're currently viewing." },
  { view: "home", sel: ".filterbar", title: "Data controls", body: "Filter the dashboard by position and status. Open Advanced Controls to change how the charts are grouped and measured." },
  { view: "home", sel: ".chart-list", title: "Visualizations", body: "Explore stacked bars, a donut, a histogram, and a breakdown table. Use the chart header to switch the bars to a heat map." },
  { view: "vacancies", sel: "table", title: "Vacancy postings", body: "Review each authorized item and toggle it between Open for Application and Closed." },
  { view: "vacancies", sel: ".action-card", title: "Quick action · Add Vacancy", body: "Opens the NOSCA uploader, which auto-detects authorized item numbers and position titles so you can add them in a few clicks." },
  { view: "vacancies", modal: "nosca", title: "Modal · Add Vacancy from NOSCA", body: "This uploader scans an approved NOSCA, auto-detects the authorized item numbers and position titles, and lets you tick which items to add. Newly added items start as Closed." },
  { view: "applications", sel: ".toolbar", title: "Search & filter applicants", body: "Search across applicants, then narrow the list by vacancy and application status. Each table column also has its own filter." },
  { view: "applications", sel: "table", title: "Application table", body: "Rows are fully sortable and filterable. Click any applicant row to open the Initial Evaluation Review." },
  { view: "applications", modal: "review", title: "Modal · Initial Evaluation Review", body: "Opened when you click an applicant row. Confirm documentary completeness, compare the applicant against each qualification standard and mark Pass or Fail — the result (Qualified, Disqualified, or Excluded) is then set automatically." },
  { view: "applications", sel: ".action-buttons", title: "Quick action · Download IER", body: "Exports the Initial Evaluation Result — a CSV of every qualified applicant that matches your current search and filters." },
  { view: "applications", sel: ".pager-controls", title: "Pagination", body: "Choose how many rows show per page and jump to any page. Every table in the portal shares this same control." },
  { view: "qualified", sel: "table", title: "Assessment", body: "This is where you input the comparative assessment scores for the qualified applicants. Click a row to open the scoring screen." },
  { view: "qualified", sel: ".action-card", title: "Quick action · Download CAR", body: "Exports the Comparative Assessment Result as a CSV for the applicants currently shown." },
  { view: "appointment", sel: "table", title: "Appointment list", body: "Tracks appointed applicants and those rejected once an item is filled. Use Download Appointed List to export the confirmed appointees." }
];

const viewPaths = {
  home: '/dashboard',
  vacancies: '/vacancies',
  applications: '/applications',
  qualified: '/assessment',
  appointment: '/appointment'
};

export default function App() {
  const { token, setToken, user, setUser, handleLogout } = useAuth();
  const { setToast } = useToast();
  const { loading } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();

  // Login Form State
  const [username, setUsername] = useState('hr_officer');
  const [password, setPassword] = useState('password');
  const [loginError, setLoginError] = useState('');

  // Register Modal State
  const [showRegister, setShowRegister] = useState(false);
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regRegion, setRegRegion] = useState('');
  const [regDivision, setRegDivision] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Region and Division data from agap_schools
  const [regions, setRegions] = useState([]);
  const [divisionsByRegion, setDivisionsByRegion] = useState({});
  const [allDivisions, setAllDivisions] = useState([]);

  useEffect(() => {
    async function fetchRegionsDivisions() {
      try {
        const data = await apiFetch('/api/auth/regions-divisions');
        setRegions(data.regions || []);
        setDivisionsByRegion(data.divisionsByRegion || {});
        setAllDivisions(data.allDivisions || []);
      } catch (e) {
        console.error('Failed to load regions and divisions:', e);
      }
    }
    fetchRegionsDivisions();
  }, []);

  // Guided Onboarding Tour State
  const [tourActive, setTourActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem("deped_tour_seen");
  });

  useEffect(() => {
    if (token) {
      setShowWelcome(!localStorage.getItem("deped_tour_seen"));
    }
  }, [token]);

  useEffect(() => {
    if (location.pathname === '/register') {
      setShowRegister(true);
      setRegError('');
      setRegSuccess('');
    } else {
      setShowRegister(false);
    }
  }, [location.pathname]);

  const tourStepRef = useRef(0);
  const highlightRef = useRef(null);
  const tooltipRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem('agap_token', data.token);
      localStorage.setItem('agap_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setToast({ message: `Welcome back, ${data.user.first_name || data.user.username || 'HR Officer'}!`, type: 'success' });
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err.message);
      setToast({ message: err.message || 'Login failed.', type: 'error' });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    if (regPassword !== regConfirm) {
      setToast({ message: 'Passwords do not match.', type: 'error' });
      return setRegError('Passwords do not match.');
    }
    setRegLoading(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: regFirstName,
          lastName: regLastName,
          region: regRegion,
          division: regDivision,
          email: regEmail,
          password: regPassword,
          passcode: regPasscode
        })
      });
      setRegSuccess('Account created! You can now sign in.');
      setToast({ message: 'Account created successfully!', type: 'success' });
      setRegFirstName(''); setRegLastName(''); setRegRegion('');
      setRegDivision(''); setRegEmail(''); setRegPassword('');
      setRegConfirm(''); setRegPasscode('');
    } catch (err) {
      setRegError(err.message);
      setToast({ message: err.message || 'Registration failed.', type: 'error' });
    } finally {
      setRegLoading(false);
    }
  };

  // Onboarding Guided Tour Engine
  const updateHighlightCoords = (el, disableTransition = false) => {
    const hl = highlightRef.current;
    const tip = tooltipRef.current;
    if (!el || !hl || !tip) return;

    const r = el.getBoundingClientRect();
    const pad = 6;
    
    if (hl) {
      if (disableTransition) hl.classList.add("no-transition");
      else hl.classList.remove("no-transition");

      hl.style.top = Math.max(4, r.top - pad) + "px";
      hl.style.left = Math.max(4, r.left - pad) + "px";
      hl.style.width = Math.min(window.innerWidth - 8, r.width + pad * 2) + "px";
      hl.style.height = (r.height + pad * 2) + "px";
      hl.classList.add("active");
    }

    const gap = 16;
    if (tip) {
      if (disableTransition) tip.classList.add("no-transition");
      else tip.classList.remove("no-transition");
      
      tip.classList.add("active");
      tip.style.visibility = "hidden";
      
      const tw = tip.offsetWidth, th = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      let top, left;
      
      if (r.bottom + gap + th <= vh) top = r.bottom + gap;
      else if (r.top - gap - th >= 0) top = r.top - gap - th;
      else top = Math.max(gap, (vh - th) / 2);
      
      left = r.left + r.width / 2 - tw / 2;
      left = Math.min(Math.max(gap, left), vw - tw - gap);
      
      tip.style.top = top + "px";
      tip.style.left = left + "px";
      tip.style.visibility = "visible";
    }
  };

  const repositionTour = (disableTransition = false) => {
    if (!tourActive) return;
    const step = TOUR_STEPS[tourStepRef.current];
    const hl = highlightRef.current;
    const tip = tooltipRef.current;

    const titleEl = document.getElementById("tourTitleText");
    const bodyEl = document.getElementById("tourBodyText");
    const progEl = document.getElementById("tourProgressText");
    const prevBtn = document.getElementById("tourPrevBtn");
    const nextBtn = document.getElementById("tourNextBtn");

    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.textContent = step.body;
    if (progEl) progEl.textContent = `${tourStepRef.current + 1} / ${TOUR_STEPS.length}`;
    if (prevBtn) prevBtn.disabled = tourStepRef.current === 0;
    if (nextBtn) nextBtn.textContent = tourStepRef.current === TOUR_STEPS.length - 1 ? "Done" : "Next";

    if (step.modal) {
      if (hl) hl.classList.remove("active");
      if (tip) {
        if (disableTransition) tip.classList.add("no-transition");
        else tip.classList.remove("no-transition");
        tip.classList.add("active");
        tip.style.visibility = "hidden";
        
        const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 20, vw = window.innerWidth, vh = window.innerHeight;
        tip.style.top = Math.max(gap, vh - th - gap) + "px";
        tip.style.left = Math.min(Math.max(gap, (vw - tw) / 2), vw - tw - gap) + "px";
        tip.style.visibility = "visible";
      }
      return;
    }

    let attempts = 0;
    const findAndPosition = () => {
      const el = document.querySelector(step.sel);
      if (!el || el.getBoundingClientRect().width === 0) {
        if (attempts < 15) {
          attempts++;
          setTimeout(findAndPosition, 80);
        }
        return;
      }

      const rect = el.getBoundingClientRect();
      const inViewport = rect.top >= 60 && rect.bottom <= window.innerHeight - 60;

      if (!inViewport) {
        try {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        } catch (e) {}
      }

      const delay = inViewport ? 0 : 220;

      setTimeout(() => {
        if (!tourActive) return;
        const currentEl = document.querySelector(step.sel);
        updateHighlightCoords(currentEl, disableTransition);
      }, delay);
    };

    findAndPosition();
  };

  const showTourStep = (i) => {
    tourStepRef.current = i;
    const step = TOUR_STEPS[i];
    if (!step) {
      endTour();
      return;
    }

    const hl = highlightRef.current;
    const tip = tooltipRef.current;

    const targetPath = viewPaths[step.view];
    const viewChanged = targetPath && location.pathname !== targetPath;

    if (viewChanged) {
      if (hl) hl.classList.remove("active");
      if (tip) {
        tip.classList.remove("active");
        tip.style.visibility = "hidden";
      }
      navigate(targetPath);
    }

    // Set active states on window for modals
    window.agap_tour_open_nosca = step.modal === "nosca";
    window.agap_tour_open_review = step.modal === "review";
    window.dispatchEvent(new Event('agap-tour-update'));

    const delay = viewChanged ? 380 : 0;
    setTimeout(() => {
      repositionTour(viewChanged);
    }, delay);
  };

  useEffect(() => {
    if (tourActive) {
      showTourStep(tourStepRef.current);

      const handleScrollOrResize = () => {
        repositionTour(true);
      };
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);

      const sidebar = document.querySelector('.sidebar');
      let rafId = null;

      const trackReposition = () => {
        const step = TOUR_STEPS[tourStepRef.current];
        if (step && !step.modal) {
          const el = document.querySelector(step.sel);
          if (el) {
            updateHighlightCoords(el, true);
          }
        }
        rafId = requestAnimationFrame(trackReposition);
      };

      const handleTransitionStart = () => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(trackReposition);
      };

      const handleTransitionEnd = () => {
        cancelAnimationFrame(rafId);
        repositionTour(false);
      };

      if (sidebar) {
        sidebar.addEventListener('transitionstart', handleTransitionStart);
        sidebar.addEventListener('transitionend', handleTransitionEnd);
      }

      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
        cancelAnimationFrame(rafId);
        if (sidebar) {
          sidebar.removeEventListener('transitionstart', handleTransitionStart);
          sidebar.removeEventListener('transitionend', handleTransitionEnd);
        }
      };
    } else {
      if (highlightRef.current) highlightRef.current.classList.remove("active");
      if (tooltipRef.current) tooltipRef.current.classList.remove("active");
      window.agap_tour_open_nosca = false;
      window.agap_tour_open_review = false;
      window.dispatchEvent(new Event('agap-tour-update'));
    }
  }, [tourActive]);

  const startTour = () => {
    window.agap_tutorial_dismissed = true;
    setShowWelcome(false);
    tourStepRef.current = 0;
    setTourActive(true);
    window.agap_tour_open_nosca = false;
    window.agap_tour_open_review = false;
    window.dispatchEvent(new Event('agap-tour-update'));
  };

  const endTour = () => {
    setTourActive(false);
    localStorage.setItem("deped_tour_seen", "1");
    window.agap_tour_open_nosca = false;
    window.agap_tour_open_review = false;
    window.dispatchEvent(new Event('agap-tour-update'));
  };

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-split">
          {/* Left branding banner */}
          <div className="login-brand-panel">
            <div className="brand-glow-orb-1"></div>
            <div className="brand-glow-orb-2"></div>
            <div className="brand-panel-content">
              <div className="deped-seal-container" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img src={agadLogo} alt="AGAP Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                <div className="deped-eyebrow">DEPARTMENT OF EDUCATION</div>
              </div>
              <h1><span style={{ color: 'var(--blue-600)' }}>AGAP</span> Portal</h1>
              <p className="subtitle">Agile Gateway for Appointments and Placements</p>
              <div className="brand-stats-grid">
                <div className="brand-stat-card">
                  <span className="stat-icon">📈</span>
                  <div>
                    <h3>Fast Placement</h3>
                    <p>Streamlined evaluation & comparative assessments</p>
                  </div>
                </div>
                <div className="brand-stat-card">
                  <span className="stat-icon">🛡️</span>
                  <div>
                    <h3>Secure Validation</h3>
                    <p>Passcode-protected actions & secure auditing</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="login-form-panel">
            <div className="login-card">
              <div className="login-header">
                <h2>Welcome Back</h2>
                <p>Please enter your credentials to access the portal</p>
              </div>
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="username">Username / Email</label>
                  <div className="form-group-input-wrapper">
                    <span className="input-icon">👤</span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="your.email@deped.gov.ph"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="form-group-input-wrapper">
                    <span className="input-icon">🔒</span>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                {loginError && <div className="login-error">{loginError}</div>}
                <button type="submit" className="login-btn">Sign In</button>
              </form>
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button
                  type="button"
                  className="register-trigger-btn"
                  onClick={() => navigate('/register')}
                >
                  Create an account
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* REGISTER MODAL */}
        {showRegister && (
          <div className="modal open" style={{ zIndex: 100001, left: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)' }}>
            <div className="modal-box" style={{ width: 'min(520px, 96vw)', padding: '0 40px 40px 40px', borderRadius: '28px', background: 'white', border: '1px solid rgba(15, 23, 42, 0.08)', borderTop: '6px solid #0284c7', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15)', backdropFilter: 'none' }}>
              <div className="modal-head" style={{ paddingTop: '40px', marginBottom: '28px', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '850', color: 'var(--navy)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>Create Account</h2>
                <button 
                  className="secondary" 
                  onClick={() => navigate('/')} 
                  style={{ 
                    borderRadius: '12px', 
                    padding: '8px 16px', 
                    background: '#f1f5f9', 
                    border: '1px solid #e2e8f0', 
                    color: '#475569',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => e.target.style.background = '#e2e8f0'}
                  onMouseOut={e => e.target.style.background = '#f1f5f9'}
                >
                  Cancel
                </button>
              </div>

              {regSuccess ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
                  <p style={{ fontWeight: '800', color: 'var(--navy)', fontSize: '18px', margin: '0 0 12px', fontFamily: 'var(--font-heading)' }}>{regSuccess}</p>
                  <button className="login-btn" style={{ marginTop: '16px', maxWidth: '240px' }} onClick={() => navigate('/')}>Go to Sign In</button>
                </div>
              ) : (
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>First Name</label>
                      <div className="form-group-input-wrapper">
                        <span className="input-icon">👤</span>
                        <input
                          type="text"
                          value={regFirstName}
                          onChange={e => setRegFirstName(e.target.value)}
                          placeholder="Juan"
                          required
                          style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: '#fff', color: 'var(--text)', fontSize: '13.5px' }}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Last Name</label>
                      <div className="form-group-input-wrapper">
                        <span className="input-icon">👤</span>
                        <input
                          type="text"
                          value={regLastName}
                          onChange={e => setRegLastName(e.target.value)}
                          placeholder="Dela Cruz"
                          required
                          style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: '#fff', color: 'var(--text)', fontSize: '13.5px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Region</label>
                      <div className="form-group-input-wrapper">
                        <span className="input-icon">📍</span>
                        <select
                          value={regRegion}
                          onChange={e => {
                            setRegRegion(e.target.value);
                            setRegDivision('');
                          }}
                          required
                          style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: '#fff', color: 'var(--text)', fontSize: '13.5px', width: '100%', height: '47px' }}
                        >
                          <option value="">Select Region</option>
                          {regions.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Division</label>
                      <div className="form-group-input-wrapper">
                        <span className="input-icon">📍</span>
                        <select
                          value={regDivision}
                          onChange={e => setRegDivision(e.target.value)}
                          required
                          disabled={!regRegion}
                          style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: regRegion ? '#fff' : '#f1f5f9', color: 'var(--text)', fontSize: '13.5px', width: '100%', height: '47px' }}
                        >
                          <option value="">{regRegion ? 'Select Division' : 'Select region first'}</option>
                          {(divisionsByRegion[regRegion] || []).map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Position</label>
                    <div className="form-group-input-wrapper">
                      <span className="input-icon">💼</span>
                      <input
                        type="text"
                        value="HRMO"
                        disabled
                        style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(15, 23, 42, 0.08)', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', fontSize: '13.5px', width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>DepEd Email</label>
                    <div className="form-group-input-wrapper">
                      <span className="input-icon">📧</span>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="your.email@deped.gov.ph"
                        required
                        style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: '#fff', color: 'var(--text)', fontSize: '13.5px', width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Password</label>
                      <div className="form-group-input-wrapper">
                        <span className="input-icon">🔒</span>
                        <input
                          type="password"
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Min 6 chars"
                          required
                          style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: '#fff', color: 'var(--text)', fontSize: '13.5px' }}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Repeat Password</label>
                      <div className="form-group-input-wrapper">
                        <span className="input-icon">🔒</span>
                        <input
                          type="password"
                          value={regConfirm}
                          onChange={e => setRegConfirm(e.target.value)}
                          placeholder="Repeat password"
                          required
                          style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: '#fff', color: 'var(--text)', fontSize: '13.5px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--navy)', fontWeight: 750, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Passcode (for confirming decisions)</label>
                    <div className="form-group-input-wrapper">
                      <span className="input-icon">🔑</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={regPasscode}
                        onChange={e => setRegPasscode(e.target.value.replace(/\D/g, ''))}
                        placeholder="6-digit passcode"
                        required
                        style={{ padding: '12px 14px 12px 42px', borderRadius: '12px', border: '1.5px solid rgba(8, 49, 95, 0.15)', background: '#fff', color: 'var(--text)', fontSize: '13.5px', width: '100%' }}
                      />
                    </div>
                  </div>

                  {regError && (
                    <div className="login-error" style={{ margin: '8px 0 0', padding: '10px 14px', borderRadius: '10px' }}>{regError}</div>
                  )}
                  <button
                    type="submit"
                    className="login-btn"
                    disabled={regLoading}
                    style={{ marginTop: '12px', padding: '13px', borderRadius: '12px' }}
                  >
                    {regLoading ? 'Creating account…' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {/* GUIDED ONBOARDING TOUR DOM HIGHLIGHTS */}
      <div ref={highlightRef} className="tour-highlight"></div>
      <div ref={tooltipRef} className="tour-tooltip">
        <h4 id="tourTitleText">Tutorial Step</h4>
        <p id="tourBodyText">Description</p>
        <div className="tour-footer">
          <span id="tourProgressText" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--muted)' }}>1 / 14</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button id="tourPrevBtn" className="secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => showTourStep(tourStepRef.current - 1)}>Back</button>
            <button id="tourNextBtn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => showTourStep(tourStepRef.current + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* Welcome Onboarding Modal */}
      <div className={`welcome-overlay ${showWelcome ? 'open' : ''}`}>
        {showWelcome && (
          <div className="welcome-box">
            <div className="welcome-badge">Welcome</div>
            <h2>Welcome to the AGAP Portal</h2>
            <p>Monitor openings, screen applicants against qualification standards, and track hiring from application through to appointment — all in one place.</p>
            <div className="welcome-highlights">
              <div className="welcome-hi"><b>Screen</b><span>Review applicants vs. QS and mark whether requirements are met.</span></div>
              <div className="welcome-hi"><b>Analyze</b><span>KPIs, charts, and filters across every module.</span></div>
              <div className="welcome-hi"><b>Decide</b><span>Advance the pipeline through to appointment.</span></div>
            </div>
            <div className="welcome-actions">
              <button className="secondary" onClick={() => { window.agap_tutorial_dismissed = true; setShowWelcome(false); localStorage.setItem("deped_tour_seen", "1"); }}>Skip</button>
              <button className="gold" onClick={startTour}>Show Tutorial</button>
            </div>
          </div>
        )}
      </div>

      <aside className="sidebar">
        <div className="brand" aria-label="AGAP Portal" style={{ display: 'flex', justifyContent: 'center', padding: '15px 0', height: 'auto' }}>
          <img src={agadLogo} alt="AGAP Logo" style={{ width: '180px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.75)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.9))' }} />
        </div>
        <nav className="nav">
          <button className={location.pathname === '/dashboard' ? 'active' : ''} onClick={() => navigate('/dashboard')} title="Home">
            <span className="nav-icon">⌂</span>
            <span className="nav-label">Home</span>
          </button>
          <div className="nav-divider"></div>
          <button className={location.pathname === '/vacancies' ? 'active' : ''} onClick={() => navigate('/vacancies')} title="Vacancies">
            <span className="nav-icon">▤</span>
            <span className="nav-label">Vacancies</span>
          </button>
          <div className="nav-divider"></div>
          <button className={location.pathname === '/applications' ? 'active' : ''} onClick={() => navigate('/applications')} title="Applications">
            <span className="nav-icon">▦</span>
            <span className="nav-label">Applications</span>
          </button>
          <button className={location.pathname === '/assessment' ? 'active' : ''} onClick={() => navigate('/assessment')} title="Comparative Assessment">
            <span className="nav-icon">✔</span>
            <span className="nav-label">Comparative Assessment</span>
          </button>
          <button className={location.pathname === '/appointment' ? 'active' : ''} onClick={() => navigate('/appointment')} title="Appointment">
            <span className="nav-icon">★</span>
            <span className="nav-label">Appointment</span>
          </button>
          <div className="nav-divider"></div>
          <button onClick={() => { handleLogout(); setToast({ message: 'Logged out successfully.', type: 'info' }); navigate('/'); }} title="Log Out" style={{ background: 'rgba(185, 28, 28, 0.2)', color: '#FCA5A5' }}>
            <span className="nav-icon">✕</span>
            <span className="nav-label">Log Out</span>
          </button>
        </nav>
      </aside>

      <div className="shell">
        <section className="topbar">
          <div className="page-title">
            <div className="eyebrow">DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE</div>
            <h1>AGAP Portal</h1>
            <p>Agile Gateway for Appointments and Placements</p>
          </div>
        </section>

        <main>
          {loading && <div style={{ textAlign: 'center', padding: '20px', fontWeight: 'bold', color: 'var(--blue)' }}>Updating data from server...</div>}
          <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px', fontWeight: 'bold', color: 'var(--blue)' }}>Loading page...</div>}>
            <Routes>
              {routes.map((r, i) => (
                <Route key={i} path={r.path} element={r.element} />
              ))}
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
