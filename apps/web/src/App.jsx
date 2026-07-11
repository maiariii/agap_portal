import React, { useState, useEffect, useMemo, useRef } from 'react';
import { titleCase, cls, computeOverallAreaScore, scoreTone } from '@agap/shared';

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

const DOC_REQUIREMENTS = [
  { key: "loi", label: "Letter of intent addressed to the Head of Office or highest human resource officer" },
  { key: "pds", label: "Duly accomplished Personal Data Sheet (PDS, CS Form No. 212, Revised 2017) and Work Experience Sheet, if applicable" },
  { key: "prc", label: "Photocopy of valid and updated PRC License/ID, if applicable" },
  { key: "eligibility", label: "Photocopy of Certificate of Eligibility/Report of Rating, if applicable" },
  { key: "tor", label: "Photocopy of scholastic/academic records such as Transcript of Records (TOR) and Diploma, including graduate and post-graduate units/degrees, if available" },
  { key: "training", label: "Photocopy of Certificate/s of Training, if applicable" },
  { key: "employment", label: "Photocopy of Certificate of Employment, Contract of Service, or duly signed Service Record, whichever is/are applicable" },
  { key: "appointment", label: "Photocopy of latest appointment, if applicable" },
  { key: "performance", label: "Photocopy of the Performance Rating in the last rating period(s) covering one (1) year performance prior to the deadline of submission, if applicable" },
  { key: "cav", label: "Checklist of Requirements and Omnibus Sworn Statement on the CAV of documents submitted and Data Privacy Consent Form" },
  { key: "other", label: "Other documents as may be required for comparative assessment (e.g. MOVs, or Performance Rating from relevant work experience)" }
];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('agap_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('agap_user') || 'null'));
  const [activeView, setActiveView] = useState('home');

  // Login Form State
  const [username, setUsername] = useState('hr_officer');
  const [password, setPassword] = useState('password');
  const [loginError, setLoginError] = useState('');

  // Core Data State
  const [positions, setPositions] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Home/Dashboard filter state
  const [homeFilters, setHomeFilters] = useState({
    positionId: '',
    status: '',
    itemStatus: '',
    assessmentStatus: '',
    postingStatus: ''
  });
  const [homeAdvanced, setHomeAdvanced] = useState(false);
  const [homeDistributionBy, setHomeDistributionBy] = useState('item_status'); // item_status, status, assessment_status, posting_status
  const [homeMeasure, setHomeMeasure] = useState('count'); // count or percent
  const [homeSortBy, setHomeSortBy] = useState('total'); // total or title
  const [homeDetailColFilters, setHomeDetailColFilters] = useState({});
  const [homeDetailPage, setHomeDetailPage] = useState(1);
  const [homeDetailPageSize, setHomeDetailPageSize] = useState(10);

  // Application View filter & sort state
  const [appSearch, setAppSearch] = useState('');
  const [appVacancyFilter, setAppVacancyFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appColFilters, setAppColFilters] = useState({});
  const [multiSort, setMultiSort] = useState(false);
  const [sortStack, setSortStack] = useState([{ key: 'dateApplied', dir: 'desc' }]);
  const [appPage, setAppPage] = useState(1);
  const [appPageSize, setAppPageSize] = useState(10);

  // Qualified View Filter state
  const [qualSearch, setQualSearch] = useState('');
  const [qualVacancyFilter, setQualVacancyFilter] = useState('');
  const [qualStageFilter, setQualStageFilter] = useState('');
  const [qualPage, setQualPage] = useState(1);
  const [qualPageSize, setQualPageSize] = useState(10);

  // Vacancy View filter state
  const [vacSearch, setVacSearch] = useState('');
  const [vacPosFilter, setVacPosFilter] = useState('');
  const [vacStatusFilter, setVacStatusFilter] = useState('');
  const [vSortKey, setVSortKey] = useState('itemNo');
  const [vSortDir, setVSortDir] = useState('asc');
  const [vColumnFilters, setVColumnFilters] = useState({});
  const [vacPage, setVacPage] = useState(1);
  const [vacPageSize, setVacPageSize] = useState(10);

  // Review Modal State
  const [reviewId, setReviewId] = useState(null);
  const [reviewApp, setReviewApp] = useState(null);
  const [reviewDocs, setReviewDocs] = useState({});
  const [reviewDecisions, setReviewDecisions] = useState({
    crit_degree: null,
    crit_experience: null,
    crit_training: null,
    crit_eligibility: null
  });
  const [remarks, setRemarks] = useState('');
  const [reviewDirty, setReviewDirty] = useState(false);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Schedule Calendar Modal State
  const [showCalendar, setShowCalendar] = useState(false);
  const [calVacancy, setCalVacancy] = useState(null);
  const [calStart, setCalStart] = useState('');
  const [calEnd, setCalEnd] = useState('');
  const [calField, setCalField] = useState('start');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // NOSCA Upload Modal State
  const [showNosca, setShowNosca] = useState(false);
  const [noscaFile, setNoscaFile] = useState('');
  const [detectedItems, setDetectedItems] = useState([]);
  const [noscaScanning, setNoscaScanning] = useState(false);
  const [selectedNoscaItemNos, setSelectedNoscaItemNos] = useState([]);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [closeWarningVac, setCloseWarningVac] = useState(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeReasonOther, setCloseReasonOther] = useState('');
  const [closePasscode, setClosePasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Appointment View state
  const [apPage, setApPage] = useState(1);
  const [apPageSize, setApPageSize] = useState(10);

  // Onboarding Guided Tutorial state
  const [showWelcome, setShowWelcome] = useState(() => {
    return !window.agap_tutorial_dismissed;
  });
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const tourStepRef = useRef(0);

  const highlightRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (showWelcome) {
      const t = setTimeout(() => setWelcomeOpen(true), 300);
      return () => clearTimeout(t);
    } else {
      setWelcomeOpen(false);
    }
  }, [showWelcome]);

  // API Call helper
  const apiFetch = async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    try {
      const res = await fetch(path, { ...options, headers });
      if (!res.ok) {
        let errMsg = `Server returned status ${res.status}`;
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch(e) {}
        throw new Error(errMsg);
      }
      return await res.json();
    } catch (err) {
      if (err.message.includes('Unexpected end of JSON input') || err.message.includes('Failed to fetch')) {
        throw new Error('Connection refused. Please make sure the backend API server is running (npm run dev:api) on port 5000.');
      }
      throw err;
    }
  };

  // Fetch initial data
  const loadAllData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [posList, vacList, appList] = await Promise.all([
        apiFetch('/api/positions'),
        apiFetch('/api/vacancies'),
        apiFetch('/api/applications')
      ]);
      setPositions(posList);
      setVacancies(vacList);
      setApplications(appList);


    } catch (e) {
      console.error(e);
      if (e.message.includes('token') || e.message.includes('Authorization')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [token]);

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
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('agap_token');
    localStorage.removeItem('agap_user');
    setToken('');
    setUser(null);
    setTourActive(false);
  };

  // ----------------- Guided Onboarding Tour Logic -----------------
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

    // Update text content and button states directly in the DOM (Zero React Re-renders!)
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

      // Check if target is already in viewport to bypass scroll delay
      const rect = el.getBoundingClientRect();
      const inViewport = rect.top >= 60 && rect.bottom <= window.innerHeight - 60;

      if (!inViewport) {
        try {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        } catch (e) {}
      }

      // Position instantly if in viewport, otherwise wait 220ms for scroll to move
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
    const viewChanged = step.view && step.view !== activeView;

    if (viewChanged) {
      if (hl) hl.classList.remove("active");
      if (tip) {
        tip.classList.remove("active");
        tip.style.visibility = "hidden";
      }
      setActiveView(step.view);
    }

    if (step.modal === 'nosca') {
      setShowNosca(true);
    } else if (step.modal === 'review') {
      if (applications.length > 0) {
        handleOpenReview(applications[0]);
      }
    } else {
      setShowNosca(false);
      setReviewId(null);
    }

    const delay = viewChanged ? 380 : 0;
    setTimeout(() => {
      repositionTour(false); // Enable smooth transitions
    }, delay);
  };

  useEffect(() => {
    if (tourActive) {
      showTourStep(tourStepRef.current);

      const handleScrollOrResize = () => {
        repositionTour(true); // Disable transition during scroll/resize
      };
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);

      const sidebar = document.querySelector('.sidebar');
      let rafId = null;

      const trackReposition = () => {
        // Run completely synchronously during sidebar transition (No timeouts, 60FPS!)
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
        repositionTour(false); // Restore transition and double check alignment
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
    }
  }, [tourActive, applications]);

  const startTour = () => {
    window.agap_tutorial_dismissed = true;
    setShowWelcome(false);
    tourStepRef.current = 0;
    setTourActive(true);
  };

  const endTour = () => {
    setTourActive(false);
    localStorage.setItem("deped_tour_seen", "1");
    setShowNosca(false);
    setReviewId(null);
  };

  // ----------------- Calculations & Filters -----------------

  // Filter application rows for the dashboard/charts
  const dashboardRows = useMemo(() => {
    return applications.filter(app => {
      if (homeFilters.positionId && app.vacancyObj.positionId !== homeFilters.positionId) return false;
      if (homeFilters.status && app.status !== homeFilters.status) return false;
      const isFilled = applications.some(a => a.vacancyId === app.vacancyId && a.appointmentStatus === 'appointed');
      const itemStatusVal = isFilled ? 'filled' : 'unfilled';
      if (homeFilters.itemStatus && itemStatusVal !== homeFilters.itemStatus) return false;
      if (homeFilters.assessmentStatus && app.appObj.assessmentStatus !== homeFilters.assessmentStatus) return false;
      if (homeFilters.postingStatus && app.vacancyObj.status !== homeFilters.postingStatus) return false;
      return true;
    });
  }, [applications, homeFilters]);

  // Filtered vacancies for the dashboard
  const dashboardVacancies = useMemo(() => {
    return vacancies.filter(v => {
      if (homeFilters.positionId && v.positionId !== homeFilters.positionId) return false;
      const isFilled = applications.some(a => a.vacancyId === v.id && a.appointmentStatus === 'appointed');
      const itemStatusVal = isFilled ? 'filled' : 'unfilled';
      if (homeFilters.itemStatus && itemStatusVal !== homeFilters.itemStatus) return false;
      if (homeFilters.postingStatus && v.status !== homeFilters.postingStatus) return false;
      if (homeFilters.status && !applications.some(a => a.vacancyId === v.id && a.status === homeFilters.status)) return false;
      return true;
    });
  }, [vacancies, applications, homeFilters]);

  // Active Dashboard Config selection
  const activeDashboardData = useMemo(() => {
    const isFilledItem = (v) => {
      return applications.some(a => a.vacancyId === v.id && a.appointmentStatus === 'appointed');
    };

    if (homeDistributionBy === 'item_status') {
      const rows = dashboardVacancies.map(v => {
        const pos = positions.find(p => p.id === v.positionId) || {};
        return {
          id: v.id,
          positionId: v.positionId,
          positionTitle: pos.title || '',
          itemNo: v.itemNo || '',
          region: v.region || '',
          division: v.location || '',
          school: v.school || '',
          itemStatus: isFilledItem(v) ? 'filled' : 'unfilled'
        };
      });
      return {
        rows,
        segments: [
          { key: 'filled', label: 'Filled', colorClass: 'seg-appointed', color: '#15803D' },
          { key: 'unfilled', label: 'Unfilled', colorClass: 'seg-excluded', color: '#64748B' }
        ],
        getKey: r => r.itemStatus,
        kpiTotalLabel: 'Total Items',
        kpiTotalCaption: 'All HRMO postings',
        overallTitle: 'Overall Item Status Distribution',
        overallSubtitle: 'Filled vs unfilled item count',
        tableTitle: 'Item Status — Individual Records',
        centerLabel: 'items',
        tableLabel: 'Item Status',
        detailColumns: [
          { label: 'Region', key: 'region', type: 'categorical' },
          { label: 'Division', key: 'division', type: 'categorical' },
          { label: 'Position', key: 'positionTitle', type: 'categorical' },
          { label: 'Item Number', key: 'itemNo', type: 'text' },
          { label: 'Place of Assignment', key: 'school', type: 'text' },
          { label: 'Item Status', key: 'itemStatus', type: 'categorical', render: row => <span className={`badge ${row.itemStatus === 'filled' ? 'green' : 'gray'}`}>{row.itemStatus === 'filled' ? 'Filled' : 'Unfilled'}</span> }
        ]
      };
    } else if (homeDistributionBy === 'status') {
      const rows = dashboardRows.map(app => ({
        id: app.id,
        positionId: app.vacancyObj.positionId,
        positionTitle: app.vacancy,
        applicant: app.applicant,
        code: app.code,
        vacancy: app.vacancy,
        dateApplied: app.dateApplied,
        status: app.status
      }));
      return {
        rows,
        segments: [
          { key: 'pending_qs_review', label: 'Pending QS Review', colorClass: 'seg-docs', color: '#D97706' },
          { key: 'qualified', label: 'Qualified', colorClass: 'seg-qualified', color: '#16A34A' },
          { key: 'disqualified', label: 'Disqualified', colorClass: 'seg-disqualified', color: '#B91C1C' },
          { key: 'excluded', label: 'Excluded', colorClass: 'seg-excluded', color: '#64748B' }
        ],
        getKey: r => r.status,
        kpiTotalLabel: 'Total Applications',
        kpiTotalCaption: 'All records',
        overallTitle: 'Overall Application Status Distribution',
        overallSubtitle: 'Pending QS Review, qualified, disqualified, and excluded applications',
        tableTitle: 'Application Status — Individual Records',
        centerLabel: 'applications',
        tableLabel: 'Application Status',
        detailColumns: [
          { label: 'Applicant', key: 'applicant', type: 'text', render: row => <span><b>{row.applicant}</b><br/><span className="small">{row.code}</span></span> },
          { label: 'Vacancy', key: 'vacancy', type: 'categorical' },
          { label: 'Date Applied', key: 'dateApplied', type: 'text' },
          { label: 'Application Status', key: 'status', type: 'categorical', render: row => <span className={`badge ${cls(row.status)}`}>{titleCase(row.status)}</span> }
        ]
      };
    } else if (homeDistributionBy === 'assessment_status') {
      const rows = dashboardRows.filter(r => r.status === 'qualified' || r.status === 'for_comparative_assessment').map(app => ({
        id: app.id,
        positionId: app.vacancyObj.positionId,
        positionTitle: app.vacancy,
        applicant: app.applicant,
        code: app.code,
        vacancy: app.vacancy,
        fit: app.appObj.overallFit || app.overallFit || 0,
        assessmentStatus: app.appObj.assessmentStatus || 'marked_qualified'
      }));
      return {
        rows,
        segments: [
          { key: 'marked_qualified', label: 'No Assessment', colorClass: 'seg-submitted', color: '#0284C7' },
          { key: 'assessment_started', label: 'Assessment Started', colorClass: 'seg-docs', color: '#D97706' },
          { key: 'assessment_completed', label: 'Assessment Completed', colorClass: 'seg-qualified', color: '#16A34A' }
        ],
        getKey: r => r.assessmentStatus,
        kpiTotalLabel: 'Total Qualified',
        kpiTotalCaption: 'Passed Initial Screening',
        overallTitle: 'Overall Assessment Status Distribution',
        overallSubtitle: 'No assessment, started, and completed assessments',
        tableTitle: 'Assessment Status — Individual Records',
        centerLabel: 'applications',
        tableLabel: 'Assessment Status',
        detailColumns: [
          { label: 'Applicant', key: 'applicant', type: 'text', render: row => <span><b>{row.applicant}</b><br/><span className="small">{row.code}</span></span> },
          { label: 'Vacancy', key: 'vacancy', type: 'categorical' },
          { label: 'Overall Fit', key: 'fit', type: 'numeric', render: row => `${row.fit}%` },
          { label: 'Assessment Status', key: 'assessmentStatus', type: 'categorical', render: row => {
            const map = {
              marked_qualified: ['No Assessment', 'blue'],
              assessment_started: ['Assessment Started', 'orange'],
              assessment_completed: ['Assessment Completed', 'green']
            };
            const info = map[row.assessmentStatus] || ['—', 'gray'];
            return <span className={`badge ${info[1]}`}>{info[0]}</span>;
          }}
        ]
      };
    } else { // posting_status
      const rows = dashboardVacancies.map(v => {
        const pos = positions.find(p => p.id === v.positionId) || {};
        return {
          id: v.id,
          positionId: v.positionId,
          positionTitle: pos.title || '',
          itemNo: v.itemNo || '',
          region: v.region || '',
          division: v.location || '',
          school: v.school || '',
          postingStatus: v.status
        };
      });
      return {
        rows,
        segments: [
          { key: 'open', label: 'Open for Application', colorClass: 'seg-appointed', color: '#15803D' },
          { key: 'closed', label: 'Closed', colorClass: 'seg-excluded', color: '#64748B' }
        ],
        getKey: r => r.postingStatus,
        kpiTotalLabel: 'Total Postings',
        kpiTotalCaption: 'Active vacancies',
        overallTitle: 'Overall Posting Status Distribution',
        overallSubtitle: 'Open for Application vs Closed postings',
        tableTitle: 'Posting Status — Individual Records',
        centerLabel: 'postings',
        tableLabel: 'Posting Status',
        detailColumns: [
          { label: 'Region', key: 'region', type: 'categorical' },
          { label: 'Division', key: 'division', type: 'categorical' },
          { label: 'Position', key: 'positionTitle', type: 'categorical' },
          { label: 'Item Number', key: 'itemNo', type: 'text' },
          { label: 'Place of Assignment', key: 'school', type: 'text' },
          { label: 'Posting Status', key: 'postingStatus', type: 'categorical', render: row => <span className={`badge ${row.postingStatus === 'open' ? 'green' : 'gray'}`}>{row.postingStatus === 'open' ? 'Open for Application' : 'Closed'}</span> }
        ]
      };
    }
  }, [dashboardRows, dashboardVacancies, positions, homeDistributionBy, applications]);

  // KPI Calculations
  const dashboardKPIs = useMemo(() => {
    const totalCount = activeDashboardData.rows.length;
    const segmentsList = activeDashboardData.segments.map(seg => {
      const count = activeDashboardData.rows.filter(r => activeDashboardData.getKey(r) === seg.key).length;
      const share = totalCount ? Math.round(count / totalCount * 100) : 0;
      return {
        label: seg.label,
        value: count,
        desc: `${share}% of total`
      };
    });
    return [
      { label: activeDashboardData.kpiTotalLabel, value: totalCount, desc: activeDashboardData.kpiTotalCaption },
      ...segmentsList
    ];
  }, [activeDashboardData]);

  // Filter drilldown detail rows for the table
  const filteredHomeDetailRows = useMemo(() => {
    let rows = activeDashboardData.rows || [];
    Object.entries(homeDetailColFilters).forEach(([key, val]) => {
      if (!val) return;
      rows = rows.filter(r => {
        const colVal = String(r[key] || '').toLowerCase();
        return colVal.includes(val.toLowerCase());
      });
    });
    return rows;
  }, [activeDashboardData.rows, homeDetailColFilters]);

  // Paginate drilldown detail rows
  const maxHomeDetailPage = useMemo(() => {
    return Math.max(1, Math.ceil(filteredHomeDetailRows.length / homeDetailPageSize));
  }, [filteredHomeDetailRows, homeDetailPageSize]);

  const paginatedHomeDetailRows = useMemo(() => {
    const start = (homeDetailPage - 1) * homeDetailPageSize;
    return filteredHomeDetailRows.slice(start, start + homeDetailPageSize);
  }, [filteredHomeDetailRows, homeDetailPage, homeDetailPageSize]);

  // Unique options for each categorical column in drilldown
  const getHomeColFilterOptions = (key) => {
    const vals = (activeDashboardData.rows || []).map(r => r[key]).filter(v => v !== undefined && v !== null && v !== '');
    return [...new Set(vals)].sort();
  };

  // SVG Donut Chart Calculation
  const donutChartHtml = useMemo(() => {
    const distCounts = activeDashboardData.segments.map(seg => {
      const count = activeDashboardData.rows.filter(r => activeDashboardData.getKey(r) === seg.key).length;
      return { ...seg, count };
    });
    const distTotal = distCounts.reduce((sum, d) => sum + d.count, 0);

    if (distTotal === 0) return { total: 0, circles: null, tableRows: <tr><td colSpan="3">No matching records</td></tr> };

    let offset = 0;
    const circumference = 2 * Math.PI * 46;

    const circles = distCounts.map((d, i) => {
      const dash = (d.count / distTotal) * circumference;
      const strokeDasharray = `${dash} ${circumference - dash}`;
      const strokeDashoffset = -offset;
      offset += dash;

      if (d.count === 0) return null;

      return (
        <circle
          key={i}
          cx="60"
          cy="60"
          r="46"
          stroke={d.color}
          strokeWidth="18"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 60 60)"
          style={{ fill: 'none', transition: 'stroke-width 0.15s ease, opacity 0.15s ease' }}
        />
      );
    });

    const tableRows = distCounts.map((d, i) => {
      const pct = Math.round((d.count / distTotal) * 100);
      return (
        <tr key={i}>
          <td><span className="dot" style={{ backgroundColor: d.color, marginRight: '8px', display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%' }}></span>{d.label}</td>
          <td className="num-col">{d.count}</td>
          <td className="num-col">{pct}%</td>
        </tr>
      );
    });

    return {
      total: distTotal,
      circles,
      tableRows
    };
  }, [activeDashboardData]);

  // Histogram Column Calculation
  const histogramHtml = useMemo(() => {
    const distCounts = activeDashboardData.segments.map(seg => {
      const count = activeDashboardData.rows.filter(r => activeDashboardData.getKey(r) === seg.key).length;
      return { ...seg, count };
    });
    const distTotal = distCounts.reduce((sum, d) => sum + d.count, 0);
    const maxCount = Math.max(1, ...distCounts.map(d => d.count));

    if (distTotal === 0) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '230px', color: 'var(--muted)' }}>No records match the selected filters.</div>;
    }

    return (
      <div className="histogram" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '230px', padding: '14px 6px 0', borderBottom: '2px solid var(--line)', width: '100%' }}>
        {distCounts.map((d, i) => {
          const pct = distTotal ? Math.round((d.count / distTotal) * 100) : 0;
          const barHeight = `${(d.count / maxCount) * 100}%`;
          return (
            <div className="histo-col" key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', height: '100%' }}>
              <div className="histo-count" style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: '900', color: 'var(--navy)' }}>{d.count}</div>
              <div className="histo-bar" style={{ height: barHeight, width: '100%', borderRadius: '10px 10px 0 0', minHeight: '3px', backgroundColor: d.color, cursor: 'pointer' }} title={`${d.label}: ${d.count} (${pct}%)`}></div>
              <div className="histo-label" style={{ fontSize: '9px', fontWeight: '900', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.1 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
    );
  }, [activeDashboardData]);

  // Position chart aggregation
  const positionDistribution = useMemo(() => {
    const list = positions.map(pos => {
      const posRows = activeDashboardData.rows.filter(r => r.positionId === pos.id);
      const counts = {};
      activeDashboardData.segments.forEach(seg => {
        counts[seg.key] = posRows.filter(r => activeDashboardData.getKey(r) === seg.key).length;
      });

      return {
        id: pos.id,
        title: pos.title,
        total: posRows.length,
        counts
      };
    }).filter(p => p.total > 0 || homeFilters.positionId);

    return homeSortBy === 'total' ? list.sort((a, b) => b.total - a.total) : list.sort((a, b) => a.title.localeCompare(b.title));
  }, [positions, activeDashboardData, homeFilters.positionId, homeSortBy]);

  // General CSV Exporters
  const downloadCSV = (headers, rows, filename) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.map(val => {
          const str = String(val ?? "");
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter application rows
  const filteredApps = useMemo(() => {
    let rows = [...applications];
    if (appSearch) {
      const q = appSearch.toLowerCase();
      rows = rows.filter(r => 
        r.applicant.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.bachelorDegree.toLowerCase().includes(q) ||
        r.vacancy.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    }
    if (appVacancyFilter) rows = rows.filter(r => r.vacancyId === appVacancyFilter);
    if (appStatusFilter) rows = rows.filter(r => r.status === appStatusFilter);
    
    const statusOrder = {
      'pending': 1,
      'pending_qs_review': 2,
      'qualified': 3,
      'for_comparative_assessment': 4,
      'disqualified': 5,
      'excluded': 6
    };

    return rows.sort((a, b) => {
      const activeStack = sortStack.length > 0 ? sortStack : [{ key: 'dateApplied', dir: 'desc' }];
      for (const rule of activeStack) {
        const av = a[rule.key];
        const bv = b[rule.key];
        const dir = rule.dir === 'asc' ? 1 : -1;

        if (rule.key === 'status') {
          const orderA = statusOrder[String(av).toLowerCase()] ?? 99;
          const orderB = statusOrder[String(bv).toLowerCase()] ?? 99;
          if (orderA !== orderB) {
            return (orderA - orderB) * dir;
          }
        } else if (typeof av === 'number' && typeof bv === 'number') {
          if (av !== bv) return (av - bv) * dir;
        } else {
          const comp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: 'base' });
          if (comp !== 0) return comp * dir;
        }
      }
      return 0;
    });
  }, [applications, appSearch, appVacancyFilter, appStatusFilter, sortStack]);

  const handleSortClick = (key) => {
    setSortStack(prev => {
      const existing = prev.find(s => s.key === key);
      if (multiSort) {
        if (existing) {
          if (existing.dir === 'asc') {
            return prev.map(s => s.key === key ? { key, dir: 'desc' } : s);
          } else {
            return prev.filter(s => s.key !== key);
          }
        } else {
          return [...prev, { key, dir: 'asc' }];
        }
      } else {
        if (existing) {
          if (existing.dir === 'asc') {
            return [{ key, dir: 'desc' }];
          } else {
            return [];
          }
        } else {
          return [{ key, dir: 'asc' }];
        }
      }
    });
  };

  const getSortIndicator = (key) => {
    if (multiSort) {
      const idx = sortStack.findIndex(s => s.key === key);
      if (idx === -1) return '';
      return ` ${sortStack[idx].dir === 'asc' ? '▲' : '▼'}${idx + 1}`;
    } else {
      const active = sortStack[0];
      if (active && active.key === key) {
        return ` ${active.dir === 'asc' ? '▲' : '▼'}`;
      }
      return '';
    }
  };

  const handleVSortClick = (key) => {
    if (vSortKey === key) {
      setVSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setVSortKey(key);
      setVSortDir('asc');
    }
  };

  const paginatedApps = useMemo(() => {
    const start = (appPage - 1) * appPageSize;
    return filteredApps.slice(start, start + appPageSize);
  }, [filteredApps, appPage, appPageSize]);

  const handleExportIER = () => {
    const qualRows = filteredApps.filter(app => app.status === 'qualified');
    const headers = ["No.", "Applicant", "Applicant Code", "Date of Application", "Deadline", "Bachelor's Degree", "Years Experience", "Hours Training", "Vacancy", "Status"];
    const rows = qualRows.map((r, i) => [
      i + 1, r.applicant, r.code, r.dateApplied, r.deadline, r.bachelorDegree, r.yearsExperience, r.trainingHours, r.vacancy, titleCase(r.status)
    ]);
    downloadCSV(headers, rows, `IER-qualified-applicants-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePostIER = async (vacancyId) => {
    if (!vacancyId) return alert('Select a vacancy to post IER');
    if (!window.confirm('Posting the IER moves all qualified applicants for the selected vacancy to comparative assessment. Proceed?')) return;
    try {
      await apiFetch('/api/applications/post-ier', {
        method: 'POST',
        body: JSON.stringify({ vacancyId })
      });
      alert('IER posted successfully');
      loadAllData();
    } catch (e) {
      alert(e.message);
    }
  };

  // Qualified assessments
  const qualifiedApps = useMemo(() => {
    let rows = applications.filter(app => ['qualified', 'for_comparative_assessment'].includes(app.status));
    if (qualSearch) {
      const q = qualSearch.toLowerCase();
      rows = rows.filter(r => r.applicant.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.vacancy.toLowerCase().includes(q));
    }
    if (qualVacancyFilter) rows = rows.filter(r => r.vacancyId === qualVacancyFilter);
    if (qualStageFilter) rows = rows.filter(r => r.appObj.assessmentStatus === qualStageFilter);
    return rows.sort((a, b) => b.fit - a.fit);
  }, [applications, qualSearch, qualVacancyFilter, qualStageFilter]);

  const paginatedQualified = useMemo(() => {
    const start = (qualPage - 1) * qualPageSize;
    return qualifiedApps.slice(start, start + qualPageSize);
  }, [qualifiedApps, qualPage, qualPageSize]);

  const handleExportCAR = () => {
    const headers = ["Rank", "Applicant", "Code", "Vacancy", "Item No", "Average Score", "Stage"];
    const rows = qualifiedApps.map((r, i) => [
      i + 1, r.applicant, r.code, r.vacancy, r.itemNo, r.fit.toFixed(2), r.appObj.assessmentStatus || 'Not Started'
    ]);
    downloadCSV(headers, rows, `CAR-qualified-pool-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleUpdatePipeline = async (appId, stage, scoreData = null) => {
    try {
      await apiFetch(`/api/applications/${appId}/pipeline`, {
        method: 'PUT',
        body: JSON.stringify({
          assessmentStatus: stage,
          comparativeAssessmentScores: scoreData,
          status: stage === 'assessment_completed' ? 'for_comparative_assessment' : undefined
        })
      });
      loadAllData();
    } catch (e) {
      alert(e.message);
    }
  };

  const getVacancyCellValue = (v, key) => {
    if (key === 'itemNo') return v.itemNo || '';
    if (key === 'position') return positions.find(p => p.id === v.positionId)?.title || 'Unmapped position';
    if (key === 'schoolOffice') return v.school || v.location || '';
    if (key === 'applications') return applications.filter(a => a.vacancyId === v.id).length;
    if (key === 'deadline') return v.postingEnd || '';
    if (key === 'daysRemaining') {
      if (!v.postingStart || !v.postingEnd) return -999999;
      const start = new Date(v.postingStart.slice(0, 10) + "T00:00:00");
      const end = new Date(v.postingEnd.slice(0, 10) + "T00:00:00");
      return Math.max(0, Math.round((end - start) / 86400000) + 1);
    }
    if (key === 'postingStatus') return v.status === 'closed' ? 'Closed' : 'Open for Application';
    return '';
  };

  // Vacancy view
  const filteredVacancies = useMemo(() => {
    let list = vacancies;
    if (vacSearch) {
      const q = vacSearch.toLowerCase();
      list = list.filter(v => 
        (v.itemNo || '').toLowerCase().includes(q) || 
        (positions.find(p => p.id === v.positionId)?.title || '').toLowerCase().includes(q) ||
        (v.school || v.location || '').toLowerCase().includes(q)
      );
    }
    if (vacPosFilter) list = list.filter(v => v.positionId === vacPosFilter);
    if (vacStatusFilter) list = list.filter(v => (v.status === 'closed' ? 'closed' : 'open') === vacStatusFilter);

    Object.entries(vColumnFilters).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') return;
      const type = ['applications', 'daysRemaining'].includes(key) ? 'numeric' : ['position', 'postingStatus'].includes(key) ? 'categorical' : 'text';
      if (type === 'numeric') {
        if (val.min !== undefined && val.min !== '') {
          list = list.filter(v => getVacancyCellValue(v, key) >= Number(val.min));
        }
        if (val.max !== undefined && val.max !== '') {
          list = list.filter(v => {
            const cellVal = getVacancyCellValue(v, key);
            return cellVal !== -999999 && cellVal <= Number(val.max);
          });
        }
      } else if (type === 'categorical') {
        list = list.filter(v => getVacancyCellValue(v, key) === val);
      } else {
        list = list.filter(v => String(getVacancyCellValue(v, key)).toLowerCase().includes(val.toLowerCase()));
      }
    });

    if (vSortKey) {
      const dir = vSortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = getVacancyCellValue(a, vSortKey);
        const bv = getVacancyCellValue(b, vSortKey);
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
    return list;
  }, [vacancies, vacSearch, vacPosFilter, vacStatusFilter, vColumnFilters, vSortKey, vSortDir, positions, applications]);

  const paginatedVacancies = useMemo(() => {
    const start = (vacPage - 1) * vacPageSize;
    return filteredVacancies.slice(start, start + vacPageSize);
  }, [filteredVacancies, vacPage, vacPageSize]);

  const handleToggleVacancy = (vac) => {
    if (vac.status === 'closed') {
      setCalVacancy(vac);
      const initStart = vac.postingStart ? vac.postingStart.slice(0, 10) : new Date().toISOString().slice(0, 10);
      setCalStart(initStart);
      setCalEnd(vac.postingEnd ? vac.postingEnd.slice(0, 10) : '');
      setCalField('start');
      const initDate = new Date(initStart + "T00:00:00");
      setCalYear(initDate.getFullYear());
      setCalMonth(initDate.getMonth());
      setShowCalendar(true);
    } else {
      const end = vac.postingEnd ? new Date(vac.postingEnd.slice(0, 10) + "T00:00:00") : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dr = end ? Math.round((end - today) / 86400000) : null;
      if (dr !== null && !isNaN(dr) && dr <= 0) {
        doCloseVacancy(vac.id, false);
      } else {
        setCloseWarningVac(vac);
        setShowCloseWarning(true);
        setCloseReason('');
        setCloseReasonOther('');
        setClosePasscode('');
        setPasscodeError('');
      }
    }
  };

  const doCloseVacancy = async (vacId, overridden, reason = '') => {
    try {
      await apiFetch(`/api/vacancies/${vacId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'closed' })
      });
      setShowCloseWarning(false);
      loadAllData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleConfirmOverrideClose = () => {
    let finalReason = closeReason;
    if (closeReason === '__other__') {
      finalReason = closeReasonOther.trim();
      if (!finalReason) {
        setPasscodeError("Please specify the reason for closing this posting abruptly.");
        return;
      }
    }
    if (!finalReason) {
      setPasscodeError("Please select a justification for closing this posting abruptly.");
      return;
    }
    if (closePasscode !== '123456') {
      setPasscodeError("Incorrect passcode. Closing is still not allowed.");
      return;
    }
    doCloseVacancy(closeWarningVac.id, true, finalReason);
  };

  const selectCalDate = (iso) => {
    if (calField === 'start') {
      setCalStart(iso);
      if (calEnd && iso > calEnd) {
        setCalEnd('');
      }
    } else {
      if (calStart && iso < calStart) {
        alert("Deadline cannot be earlier than the start date.");
        return;
      }
      setCalEnd(iso);
    }
  };

  const countCalendarDays = (startIso, endIso) => {
    if (!startIso || !endIso) return 0;
    const start = new Date(startIso + "T00:00:00");
    const end = new Date(endIso + "T00:00:00");
    return Math.max(0, Math.round((end - start) / 86400000) + 1);
  };

  const getCalSummaryText = () => {
    if (!calStart && !calEnd) return <span className="small">No dates selected yet.</span>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fmt = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : 'Not set';
    const rel = (iso) => {
      const d = Math.round((new Date(iso + "T00:00:00") - today) / 86400000);
      return d > 0 ? `in ${d} day(s)` : d === 0 ? "today" : `${Math.abs(d)} day(s) ago`;
    };
    const parts = [];
    if (calStart) parts.push(`Opens <b>${fmt(calStart)}</b> (${rel(calStart)})`);
    if (calEnd) parts.push(`Deadline <b>${fmt(calEnd)}</b> (${rel(calEnd)})`);
    return parts.join(" · ");
  };

  const handleConfirmSchedule = async () => {
    if (!calVacancy || !calStart || !calEnd) return alert('Please input all values');
    try {
      await apiFetch(`/api/vacancies/${calVacancy.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'open', postingStart: calStart, postingEnd: calEnd })
      });
      setShowCalendar(false);
      loadAllData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleScanNOSCA = () => {
    setNoscaScanning(true);
    setTimeout(() => {
      setNoscaScanning(false);
      const items = [
        { itemNo: "OSEC-DECSB-TCH1-2026-101", title: "Teacher I", positionId: positions.find(p => p.title === "Teacher I")?.id },
        { itemNo: "OSEC-DECSB-MT1-2026-055", title: "Master Teacher I", positionId: positions.find(p => p.title === "Master Teacher I")?.id }
      ].filter(x => x.positionId);
      setDetectedItems(items);
      setSelectedNoscaItemNos(items.map(it => it.itemNo));
    }, 1200);
  };

  const handleAddNoscaVacancies = async () => {
    const toAdd = detectedItems.filter(it => selectedNoscaItemNos.includes(it.itemNo));
    if (!toAdd.length) return alert('Please tick at least one item to add');
    try {
      await apiFetch('/api/vacancies/import-nosca', { method: 'POST', body: JSON.stringify({ items: toAdd }) });
      alert('Vacancies added successfully!');
      setShowNosca(false);
      setDetectedItems([]);
      setSelectedNoscaItemNos([]);
      loadAllData();
    } catch (e) {
      alert(e.message);
    }
  };

  // Appointments
  const appointedApplicants = useMemo(() => applications.filter(app => app.appointmentStatus === 'appointed'), [applications]);

  const handleConfirmAppointment = async (appId, date, refCode) => {
    if (!date || !refCode) return alert('Please enter appointment details');
    try {
      await apiFetch(`/api/applications/${appId}/appointment`, {
        method: 'POST',
        body: JSON.stringify({ appointmentDate: date, appointmentReferenceCode: refCode })
      });
      alert('Appointment confirmed!');
      loadAllData();
    } catch (e) {
      alert(e.message);
    }
  };

  // Reviews
  const handleOpenReview = (appRow) => {
    setReviewId(appRow.id);
    setReviewApp(appRow);
    setRemarks(appRow.appObj.reason || '');

    const docChecklist = appRow.appObj.docChecklist || {};
    const checklistState = {};
    const defaultVal = appRow.appObj.documentaryComplete ?? false;

    ['loi', 'pds', 'prc', 'eligibility', 'tor', 'training', 'employment', 'appointment', 'performance', 'cav', 'other'].forEach(k => {
      checklistState[k] = docChecklist[k] ?? defaultVal;
    });
    setReviewDocs(checklistState);

    const isPending = appRow.status === 'pending';
    const latest = isPending ? {} : (appRow.latestEval || {});
    setReviewDecisions({
      crit_degree: latest.degreeDecision || null,
      crit_experience: latest.experienceDecision || null,
      crit_training: latest.trainingDecision || null,
      crit_eligibility: latest.eligibilityDecision || null
    });
    setReviewDirty(false);
  };

  const handleToggleDocCheck = (key) => {
    setReviewDocs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      setReviewDirty(true);
      return next;
    });
  };

  const docsComplete = Object.values(reviewDocs).every(Boolean);

  const calculatedResult = useMemo(() => {
    if (!docsComplete) return 'excluded';
    const decisions = Object.values(reviewDecisions);
    if (decisions.some(d => d === 'fail')) return 'disqualified';
    if (decisions.every(d => d === 'pass')) return 'qualified';
    return 'pending_qs_review';
  }, [docsComplete, reviewDecisions]);

  const handleSaveReview = async () => {
    if (!reviewId) return;
    try {
      await apiFetch(`/api/applications/${reviewId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          result: calculatedResult,
          docsComplete,
          docChecklist: reviewDocs,
          remarks,
          overallFit: reviewApp.fitObj.overall,
          degreeScore: reviewApp.fitObj.degreeScore,
          experienceScore: reviewApp.fitObj.experienceScore,
          trainingScore: reviewApp.fitObj.trainingScore,
          eligibilityScore: reviewApp.fitObj.eligibilityScore,
          degreeDecision: reviewDecisions.crit_degree,
          experienceDecision: reviewDecisions.crit_experience,
          trainingDecision: reviewDecisions.crit_training,
          eligibilityDecision: reviewDecisions.crit_eligibility
        })
      });
      setToast({ message: 'Evaluation saved!', type: 'success' });
      setReviewId(null);
      setReviewApp(null);
      setShowUnsavedPrompt(false);
      loadAllData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleCloseReviewModal = () => {
    if (reviewDirty) {
      setShowUnsavedPrompt(true);
    } else {
      setReviewId(null);
      setReviewApp(null);
      setShowUnsavedPrompt(false);
    }
  };

  const handleDiscardChanges = () => {
    setReviewId(null);
    setReviewApp(null);
    setReviewDirty(false);
    setShowUnsavedPrompt(false);
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--blue-50)' }}>
        <div className="card" style={{ width: '400px', padding: '30px', borderRadius: '24px' }}>
          <h2 style={{ textAlign: 'center', color: 'var(--navy)', marginBottom: '8px' }}>InsightED HRMO Portal</h2>
          <p className="small" style={{ textAlign: 'center', marginBottom: '24px' }}>Please log in to manage qualifications & appointments.</p>
          {loginError && <div style={{ color: 'var(--red)', background: '#FEE2E2', padding: '10px', borderRadius: '12px', marginBottom: '14px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <label>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ marginBottom: '14px' }} />
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ marginBottom: '20px' }} />
            <button type="submit" style={{ width: '100%', minHeight: '48px', fontSize: '15px' }}>Log In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Tour highlight overlay */}
      <div className="tour-highlight" ref={highlightRef}></div>

      {/* Tour Dialog Popover */}
      {tourActive && (
        <div className="tour-tooltip" ref={tooltipRef}>
          <button className="tour-skip" onClick={endTour}>Skip tour ✕</button>
          <div className="tour-step-label">Guided Tour</div>
          <h4 id="tourTitleText"></h4>
          <p id="tourBodyText"></p>
          <div className="tour-nav">
            <button className="secondary" id="tourPrevBtn" onClick={() => showTourStep(tourStepRef.current - 1)}>Back</button>
            <span className="tour-progress" id="tourProgressText"></span>
            <button className="gold" id="tourNextBtn" onClick={() => showTourStep(tourStepRef.current + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Welcome Onboarding Modal */}
      <div className={`welcome-overlay ${welcomeOpen ? 'open' : ''}`}>
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
        <div className="brand" aria-label="InsightED">
          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>AGAP</span>
        </div>
        <nav className="nav">
          <button className={activeView === 'home' ? 'active' : ''} onClick={() => setActiveView('home')} title="Home">
            <span className="nav-icon">⌂</span>
            <span className="nav-label">Home</span>
          </button>
          <div className="nav-divider"></div>
          <button className={activeView === 'vacancies' ? 'active' : ''} onClick={() => setActiveView('vacancies')} title="Vacancies">
            <span className="nav-icon">▤</span>
            <span className="nav-label">Vacancies</span>
          </button>
          <div className="nav-divider"></div>
          <button className={activeView === 'applications' ? 'active' : ''} onClick={() => setActiveView('applications')} title="Applications">
            <span className="nav-icon">▦</span>
            <span className="nav-label">Applications</span>
          </button>
          <button className={activeView === 'qualified' ? 'active' : ''} onClick={() => setActiveView('qualified')} title="Assessment">
            <span className="nav-icon">✔</span>
            <span className="nav-label">Assessment</span>
          </button>
          <button className={activeView === 'appointment' ? 'active' : ''} onClick={() => setActiveView('appointment')} title="Appointment">
            <span className="nav-icon">★</span>
            <span className="nav-label">Appointment</span>
          </button>
          <div className="nav-divider"></div>
          <button onClick={handleLogout} title="Log Out" style={{ background: 'rgba(185, 28, 28, 0.2)', color: '#FCA5A5' }}>
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
            <p>Monitor openings, screening stages, and qualification-fit decisions across DepEd hiring positions.</p>
          </div>
        </section>

        <main>
          {loading && <div style={{ textAlign: 'center', padding: '20px', fontWeight: 'bold', color: 'var(--blue)' }}>Updating data from server...</div>}

          {/* VIEW 1: DASHBOARD HOME */}
          {activeView === 'home' && (
            <section className="view active">
              <div className="kpis">
                {dashboardKPIs.map((k, i) => (
                  <div className="card kpi" key={i}>
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-number">{k.value}</div>
                    <div className="kpi-caption">{k.desc}</div>
                  </div>
                ))}
              </div>

              <div className="filterbar data-control-card">
                <div className="data-control-head">
                  <div>
                    <h2>Data Controls</h2>
                    <p className="small">Filter the selected data module and configure advanced chart behavior.</p>
                  </div>
                  <div className="data-control-actions">
                    <button className="secondary" onClick={() => setHomeFilters({ positionId: '', status: '', itemStatus: '', assessmentStatus: '', postingStatus: '' })}>Reset</button>
                    <button onClick={() => setHomeAdvanced(!homeAdvanced)}>{homeAdvanced ? 'Toggle Basic Mode' : 'Toggle Advanced Mode'}</button>
                  </div>
                </div>
                <div className="data-control-body">
                  <div className="dashboard-controls">
                    <div>
                      <label>Position</label>
                      <select value={homeFilters.positionId} onChange={e => setHomeFilters({ ...homeFilters, positionId: e.target.value })}>
                        <option value="">All positions</option>
                        {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Application Status</label>
                      <select value={homeFilters.status} onChange={e => setHomeFilters({ ...homeFilters, status: e.target.value })}>
                        <option value="">All application statuses</option>
                        <option value="pending_qs_review">Pending QS Review</option>
                        <option value="qualified">Qualified</option>
                        <option value="disqualified">Disqualified</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </div>
                    <div>
                      <label>Item Status</label>
                      <select value={homeFilters.itemStatus} onChange={e => setHomeFilters({ ...homeFilters, itemStatus: e.target.value })}>
                        <option value="">All item statuses</option>
                        <option value="filled">Filled</option>
                        <option value="unfilled">Unfilled</option>
                      </select>
                    </div>
                    <div>
                      <label>Assessment Status</label>
                      <select value={homeFilters.assessmentStatus} onChange={e => setHomeFilters({ ...homeFilters, assessmentStatus: e.target.value })}>
                        <option value="">All assessment statuses</option>
                        <option value="marked_qualified">No Assessment</option>
                        <option value="assessment_started">Assessment Started</option>
                        <option value="assessment_completed">Assessment Completed</option>
                      </select>
                    </div>
                    <div>
                      <label>Posting Status</label>
                      <select value={homeFilters.postingStatus} onChange={e => setHomeFilters({ ...homeFilters, postingStatus: e.target.value })}>
                        <option value="">All posting statuses</option>
                        <option value="open">Open for Application</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
 
                  {homeAdvanced && (
                    <div className="advanced-controls">
                      <div className="advanced-title">Advanced Controls</div>
                      <div className="advanced-grid">
                        <div>
                          <label>Distribution by</label>
                          <select value={homeDistributionBy} onChange={e => setHomeDistributionBy(e.target.value)}>
                            <option value="item_status">Item Status</option>
                            <option value="status">Application Status</option>
                            <option value="assessment_status">Assessment Status</option>
                            <option value="posting_status">Posting Status</option>
                          </select>
                        </div>
                        <div>
                          <label>Measure</label>
                          <select value={homeMeasure} onChange={e => setHomeMeasure(e.target.value)}>
                            <option value="count">Count</option>
                            <option value="percent">Share (%)</option>
                          </select>
                        </div>
                        <div>
                          <label>Sort positions by</label>
                          <select value={homeSortBy} onChange={e => setHomeSortBy(e.target.value)}>
                            <option value="total">Total applications</option>
                            <option value="title">Position name</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="chart-card-head">
                  <div>
                    <h2>Item Status & Pipeline Distribution</h2>
                    <p className="small">Visual breakdown across positions</p>
                  </div>
                  <div className="legend">
                    {activeDashboardData.segments.map((seg, idx) => (
                      <span key={idx}><span className={`dot ${seg.colorClass}`}></span>{seg.label}</span>
                    ))}
                  </div>
                </div>

                <div className="chart-list">
                  {positionDistribution.map(pos => {
                    const getPct = (val) => pos.total > 0 ? (val / pos.total) * 100 : 0;
                    return (
                      <div className="chart-row" key={pos.id}>
                        <div className="chart-label">{pos.title}</div>
                        <div className="bar-track">
                          {pos.total > 0 ? (
                            activeDashboardData.segments.map((seg, idx) => {
                              const count = pos.counts[seg.key] || 0;
                              if (!count) return null;
                              return (
                                <div key={idx} className={`stack-seg ${seg.colorClass}`} style={{ width: `${getPct(count)}%` }} title={`${seg.label}: ${count}`}>
                                  {count || ''}
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ paddingLeft: '12px', alignSelf: 'center', fontSize: '11px', color: 'var(--muted)' }}>No records match</div>
                          )}
                        </div>
                        <div className="num-col" style={{ fontWeight: 'bold' }}>{pos.total}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Donut and Histogram Grid */}
              <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'stretch', marginBottom: '14px' }}>
                {/* Donut Chart Card */}
                <div className="card eq-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="chart-card-head">
                    <div>
                      <h2>{activeDashboardData.overallTitle}</h2>
                      <p className="small">{activeDashboardData.overallSubtitle}</p>
                    </div>
                  </div>
                  <div className="donut-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {donutChartHtml.total > 0 ? (
                        <svg className="donut-svg" viewBox="0 0 120 120" style={{ width: 'min(380px, 100%)', height: 'auto', overflow: 'visible' }}>
                          <circle cx="60" cy="60" r="46" stroke="#E2E8F0" strokeWidth="18" fill="none"></circle>
                          {donutChartHtml.circles}
                          <text x="60" y="56" textAnchor="middle" fontFamily="Plus Jakarta Sans" fontSize="16" fontWeight="900" fill="#075985">{donutChartHtml.total}</text>
                          <text x="60" y="70" textAnchor="middle" fontFamily="DM Sans" fontSize="6" fontWeight="800" fill="#64748B">{activeDashboardData.centerLabel}</text>
                        </svg>
                      ) : (
                        <p className="small" style={{ color: 'var(--muted)' }}>No records match the selected filters.</p>
                      )}
                    </div>
                    <div>
                      {donutChartHtml.total > 0 ? (
                        <table className="legend-table">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th className="num-col">Count</th>
                              <th className="num-col">Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {donutChartHtml.tableRows}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td>Total</td>
                              <td className="num-col">{donutChartHtml.total}</td>
                              <td className="num-col">100%</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <p className="small" style={{ color: 'var(--muted)' }}>No records match the selected filters.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Histogram Card */}
                <div className="card eq-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="chart-card-head">
                    <div>
                      <h2>{activeDashboardData.tableLabel} Breakdown</h2>
                      <p className="small">{activeDashboardData.overallSubtitle}</p>
                    </div>
                  </div>
                  {histogramHtml}
                </div>
              </div>

              {/* Individual Drilldown Detail Records Table */}
              <div className="card">
                <div className="table-card-head" style={{ marginBottom: '10px' }}>
                  <div>
                    <h2>{activeDashboardData.tableTitle}</h2>
                    <p className="small" style={{ margin: '0 0 10px' }}>Showing {filteredHomeDetailRows.length} record(s) for {activeDashboardData.tableLabel}.</p>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {activeDashboardData.detailColumns.map((col, idx) => {
                          if (col.type === 'categorical') {
                            const options = getHomeColFilterOptions(col.key);
                            return (
                              <th key={idx}>
                                {col.label}
                                <select
                                  className="column-filter"
                                  value={homeDetailColFilters[col.key] || ''}
                                  onChange={e => {
                                    setHomeDetailColFilters({ ...homeDetailColFilters, [col.key]: e.target.value });
                                    setHomeDetailPage(1);
                                  }}
                                >
                                  <option value="">All</option>
                                  {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </th>
                            );
                          }
                          return (
                            <th key={idx}>
                              {col.label}
                              <input
                                className="column-filter"
                                placeholder="Filter..."
                                value={homeDetailColFilters[col.key] || ''}
                                onChange={e => {
                                  setHomeDetailColFilters({ ...homeDetailColFilters, [col.key]: e.target.value });
                                  setHomeDetailPage(1);
                                }}
                              />
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHomeDetailRows.length > 0 ? (
                        paginatedHomeDetailRows.map((row, idx) => (
                          <tr key={idx}>
                            {activeDashboardData.detailColumns.map((col, cIdx) => (
                              <td key={cIdx}>
                                {col.render ? col.render(row) : (row[col.key] || '—')}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={activeDashboardData.detailColumns.length} style={{ textAlign: 'center' }}>No records match the filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for Drilldown Table */}
                <div className="pager-controls">
                  <div className="pager-group">
                    <button className="secondary" onClick={() => setHomeDetailPage(p => Math.max(1, p - 1))} disabled={homeDetailPage === 1}>Prev</button>
                    <span className="small">Page {homeDetailPage} of {maxHomeDetailPage} · {filteredHomeDetailRows.length} records</span>
                    <button className="secondary" onClick={() => setHomeDetailPage(p => Math.min(maxHomeDetailPage, p + 1))} disabled={homeDetailPage === maxHomeDetailPage}>Next</button>
                  </div>
                  <div className="pager-group">
                    <div className="pager-field">
                      <label>Rows</label>
                      <select value={homeDetailPageSize} onChange={e => { setHomeDetailPageSize(Number(e.target.value)); setHomeDetailPage(1); }}>
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                    <div className="pager-field">
                      <label>Go to page</label>
                      <select value={homeDetailPage} onChange={e => setHomeDetailPage(Number(e.target.value))}>
                        {Array.from({ length: maxHomeDetailPage }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 2: VACANCY POSTINGS */}
          {activeView === 'vacancies' && (
            <section className="view active">
              <div className="controls-row">
                <div className="filterbar">
                  <div className="toolbar">
                    <div>
                      <label>Global search</label>
                      <input type="text" placeholder="Search item no., title, school..." value={vacSearch} onChange={e => setVacSearch(e.target.value)} />
                    </div>
                    <div>
                      <label>Position</label>
                      <select value={vacPosFilter} onChange={e => setVacPosFilter(e.target.value)}>
                        <option value="">All positions</option>
                        {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Posting Status</label>
                      <select value={vacStatusFilter} onChange={e => setVacStatusFilter(e.target.value)}>
                        <option value="">All statuses</option>
                        <option value="open">Open for Application</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="card action-card">
                  <div className="action-title">Quick Actions</div>
                  <button className="secondary" onClick={() => setShowNosca(true)}>Add Vacancy from NOSCA</button>
                </div>
              </div>

              <div className="card">
                <h2>Vacancy Postings</h2>
                <div className="table-wrap">
                  <table style={{ minWidth: '1000px' }}>
                    <thead>
                      <tr>
                        <th className="row-num">No.</th>
                        <th>
                          <button className="th-btn" onClick={() => handleVSortClick('itemNo')}>Item No. {vSortKey === 'itemNo' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                          <input
                            className="column-filter"
                            placeholder="Filter.."
                            value={vColumnFilters.itemNo || ''}
                            onChange={e => {
                              setVColumnFilters({ ...vColumnFilters, itemNo: e.target.value });
                              setVacPage(1);
                            }}
                          />
                        </th>
                        <th>
                          <button className="th-btn" onClick={() => handleVSortClick('position')}>Position {vSortKey === 'position' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                          <select
                            className="column-filter"
                            value={vColumnFilters.position || ''}
                            onChange={e => {
                              setVColumnFilters({ ...vColumnFilters, position: e.target.value });
                              setVacPage(1);
                            }}
                          >
                            <option value="">All</option>
                            {[...new Set(positions.map(p => p.title))].sort().map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </th>
                        <th>
                          <button className="th-btn" onClick={() => handleVSortClick('schoolOffice')}>School / Office {vSortKey === 'schoolOffice' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                          <input
                            className="column-filter"
                            placeholder="Filter.."
                            value={vColumnFilters.schoolOffice || ''}
                            onChange={e => {
                              setVColumnFilters({ ...vColumnFilters, schoolOffice: e.target.value });
                              setVacPage(1);
                            }}
                          />
                        </th>
                        <th className="num-col">
                          <button className="th-btn" onClick={() => handleVSortClick('applications')}>Applications {vSortKey === 'applications' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                          <div className="column-filter-range" style={{ display: 'flex', gap: '4px' }}>
                            <input
                              className="column-filter"
                              type="number"
                              placeholder="Min"
                              value={vColumnFilters.applications?.min || ''}
                              onChange={e => {
                                const current = vColumnFilters.applications || {};
                                setVColumnFilters({ ...vColumnFilters, applications: { ...current, min: e.target.value } });
                                setVacPage(1);
                              }}
                            />
                            <input
                              className="column-filter"
                              type="number"
                              placeholder="Max"
                              value={vColumnFilters.applications?.max || ''}
                              onChange={e => {
                                const current = vColumnFilters.applications || {};
                                setVColumnFilters({ ...vColumnFilters, applications: { ...current, max: e.target.value } });
                                setVacPage(1);
                              }}
                            />
                          </div>
                        </th>
                        <th>
                          <button className="th-btn" onClick={() => handleVSortClick('deadline')}>Deadline {vSortKey === 'deadline' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                          <input
                            className="column-filter"
                            placeholder="Filter.."
                            value={vColumnFilters.deadline || ''}
                            onChange={e => {
                              setVColumnFilters({ ...vColumnFilters, deadline: e.target.value });
                              setVacPage(1);
                            }}
                          />
                        </th>
                        <th className="num-col">
                          <button className="th-btn" onClick={() => handleVSortClick('daysRemaining')}>Days Remaining {vSortKey === 'daysRemaining' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                          <div className="column-filter-range" style={{ display: 'flex', gap: '4px' }}>
                            <input
                              className="column-filter"
                              type="number"
                              placeholder="Min"
                              value={vColumnFilters.daysRemaining?.min || ''}
                              onChange={e => {
                                const current = vColumnFilters.daysRemaining || {};
                                setVColumnFilters({ ...vColumnFilters, daysRemaining: { ...current, min: e.target.value } });
                                setVacPage(1);
                              }}
                            />
                            <input
                              className="column-filter"
                              type="number"
                              placeholder="Max"
                              value={vColumnFilters.daysRemaining?.max || ''}
                              onChange={e => {
                                const current = vColumnFilters.daysRemaining || {};
                                setVColumnFilters({ ...vColumnFilters, daysRemaining: { ...current, max: e.target.value } });
                                setVacPage(1);
                              }}
                            />
                          </div>
                        </th>
                        <th>
                          <button className="th-btn" onClick={() => handleVSortClick('postingStatus')}>Posting Status {vSortKey === 'postingStatus' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                          <select
                            className="column-filter"
                            value={vColumnFilters.postingStatus || ''}
                            onChange={e => {
                              setVColumnFilters({ ...vColumnFilters, postingStatus: e.target.value });
                              setVacPage(1);
                            }}
                          >
                            <option value="">All</option>
                            <option value="Open for Application">Open for Application</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVacancies.map((vac, idx) => {
                        const appCount = applications.filter(a => a.vacancyId === vac.id).length;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const deadlineDate = vac.postingEnd ? new Date(vac.postingEnd.slice(0, 10) + "T00:00:00") : null;
                        const deadlinePast = deadlineDate ? deadlineDate < today : false;
                        
                        let drText = 'N/A';
                        let drColor = 'var(--muted)';
                        if (vac.postingStart && vac.postingEnd) {
                          const start = new Date(vac.postingStart.slice(0, 10) + "T00:00:00");
                          const end = new Date(vac.postingEnd.slice(0, 10) + "T00:00:00");
                          const dr = Math.max(0, Math.round((end - start) / 86400000) + 1);
                          drText = String(dr);
                          
                          const rem = Math.round((end - today) / 86400000);
                          drColor = vac.status === 'closed' ? 'var(--muted)' : rem < 0 ? 'var(--red)' : rem <= 7 ? 'var(--amber)' : 'var(--green)';
                        }

                        const appCountColor = appCount === 0 ? 'var(--red)' : 'var(--navy)';
                        const deadlineColor = deadlinePast ? 'var(--red)' : 'var(--text)';
                        const isClosed = vac.status === 'closed';

                        return (
                          <tr key={vac.id}>
                            <td className="row-num">{(vacPage - 1) * vacPageSize + idx + 1}</td>
                            <td><b>{vac.itemNo}</b></td>
                            <td>{positions.find(p => p.id === vac.positionId)?.title || vac.title}</td>
                            <td>{vac.school || vac.location || 'SDO Manila'}</td>
                            <td className="num-col"><span className="qs-number" style={{ color: appCountColor }}>{appCount}</span></td>
                            <td><span className="qs-number" style={{ color: deadlineColor }}>{vac.postingEnd ? vac.postingEnd.slice(0, 10) : '—'}</span></td>
                            <td className="num-col"><span className="qs-number" style={{ color: drColor }}>{drText}</span></td>
                            <td><span className={`badge ${isClosed ? 'gray' : 'green'}`}>{isClosed ? 'Closed' : 'Open for Application'}</span></td>
                            <td>
                              <button className={`vac-action ${isClosed ? 'good' : 'danger'}`} onClick={() => handleToggleVacancy(vac)}>
                                {isClosed ? 'Open' : 'Close'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for Vacancy Postings */}
                <div className="pager-controls">
                  <div className="pager-group">
                    <button className="secondary" onClick={() => setVacPage(p => Math.max(1, p - 1))} disabled={vacPage === 1}>Prev</button>
                    <span className="small">Page {vacPage} of {Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize))} · {filteredVacancies.length} vacancies</span>
                    <button className="secondary" onClick={() => setVacPage(p => Math.min(Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize)), p + 1))} disabled={vacPage === Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize))}>Next</button>
                  </div>
                  <div className="pager-group">
                    <div className="pager-field">
                      <label>Rows</label>
                      <select value={vacPageSize} onChange={e => { setVacPageSize(Number(e.target.value)); setVacPage(1); }}>
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                    <div className="pager-field">
                      <label>Go to page</label>
                      <select value={vacPage} onChange={e => setVacPage(Number(e.target.value))}>
                        {Array.from({ length: Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize)) }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 3: APPLICATIONS TABLE */}
          {activeView === 'applications' && (
            <section className="view active">
              <div className="controls-row">
                <div className="filterbar">
                  <div className="toolbar" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div>
                      <label>Global search</label>
                      <input type="text" placeholder="Search applicant, vacancy..." value={appSearch} onChange={e => setAppSearch(e.target.value)} />
                    </div>
                    <div>
                      <label>Vacancy Item</label>
                      <select value={appVacancyFilter} onChange={e => setAppVacancyFilter(e.target.value)}>
                        <option value="">All vacancies</option>
                        {vacancies.map(v => <option key={v.id} value={v.id}>{v.title} — {v.itemNo}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Status</label>
                      <select value={appStatusFilter} onChange={e => setAppStatusFilter(e.target.value)}>
                        <option value="">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="pending_qs_review">Pending QS Review</option>
                        <option value="qualified">Qualified</option>
                        <option value="disqualified">Disqualified</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="card action-card">
                  <div className="action-title">Quick actions</div>
                  <div className="action-buttons" style={{ gridTemplateColumns: '1fr' }}>
                    <button onClick={handleExportIER}>Download IER</button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="table-card-head">
                  <h2>Application Table</h2>
                  <button className={`multi-sort-toggle ${multiSort ? 'active' : ''}`} onClick={() => {
                    setMultiSort(prev => {
                      setSortStack([]);
                      return !prev;
                    });
                  }}>Multi-sort: {multiSort ? 'On' : 'Off'}</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="row-num">No.</th>
                        <th onClick={() => handleSortClick('applicant')} style={{ cursor: 'pointer' }}>Applicant{getSortIndicator('applicant')}</th>
                        <th onClick={() => handleSortClick('dateApplied')} style={{ cursor: 'pointer' }}>Date of Application{getSortIndicator('dateApplied')}</th>
                        <th onClick={() => handleSortClick('deadline')} style={{ cursor: 'pointer' }}>Deadline of Application{getSortIndicator('deadline')}</th>
                        <th onClick={() => handleSortClick('bachelorDegree')} style={{ cursor: 'pointer' }}>Bachelor’s Degree{getSortIndicator('bachelorDegree')}</th>
                        <th onClick={() => handleSortClick('yearsExperience')} style={{ cursor: 'pointer' }}>Years Experience{getSortIndicator('yearsExperience')}</th>
                        <th onClick={() => handleSortClick('trainingHours')} style={{ cursor: 'pointer' }}>Hours Training{getSortIndicator('trainingHours')}</th>
                        <th onClick={() => handleSortClick('vacancy')} style={{ cursor: 'pointer' }}>Vacancy{getSortIndicator('vacancy')}</th>
                        <th onClick={() => handleSortClick('itemNo')} style={{ cursor: 'pointer' }}>Item No.{getSortIndicator('itemNo')}</th>
                        <th onClick={() => handleSortClick('status')} style={{ cursor: 'pointer' }}>Application Status{getSortIndicator('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedApps.map((r, i) => (
                        <tr key={r.id} className="clickable-row" onClick={() => handleOpenReview(r)}>
                          <td className="row-num">{((appPage - 1) * appPageSize) + i + 1}</td>
                          <td><b>{r.applicant}</b><br/><span className="small">{r.code}</span></td>
                          <td>{r.dateApplied}</td>
                          <td>{r.deadline}</td>
                          <td>{r.bachelorDegree}</td>
                          <td className="num-col">{r.yearsExperience}</td>
                          <td className="num-col">{r.trainingHours}</td>
                          <td>{r.vacancy}</td>
                          <td>{r.itemNo || '—'}</td>
                          <td><span className={`badge ${cls(r.status)}`}>{titleCase(r.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pager-controls">
                  <button className="secondary" onClick={() => setAppPage(p => Math.max(1, p - 1))}>Prev</button>
                  <span className="small">Page {appPage} of {Math.ceil(filteredApps.length / appPageSize)} ({filteredApps.length} records)</span>
                  <button className="secondary" onClick={() => setAppPage(p => p + 1)}>Next</button>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 4: QUALIFIED POOL / ASSESSMENT */}
          {activeView === 'qualified' && (
            <section className="view active">
              <div className="controls-row">
                <div className="filterbar">
                  <div className="toolbar" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div>
                      <label>Search Applicant</label>
                      <input type="text" placeholder="Search applicant, code..." value={qualSearch} onChange={e => setQualSearch(e.target.value)} />
                    </div>
                    <div>
                      <label>Vacancy</label>
                      <select value={qualVacancyFilter} onChange={e => setQualVacancyFilter(e.target.value)}>
                        <option value="">All vacancies</option>
                        {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Pipeline Stage</label>
                      <select value={qualStageFilter} onChange={e => setQualStageFilter(e.target.value)}>
                        <option value="">All stages</option>
                        <option value="marked_qualified">No Assessment</option>
                        <option value="assessment_started">Assessment Started</option>
                        <option value="assessment_completed">Assessment Completed</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="card action-card">
                  <div className="action-title">Quick Actions</div>
                  <button onClick={handleExportCAR}>Download CAR</button>
                </div>
              </div>

              <div className="card">
                <h2>Qualified Pool - Comparative Assessments</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Applicant</th>
                        <th>Vacancy Item</th>
                        <th>QS Fit Score</th>
                        <th>Assessment Stage</th>
                        <th style={{ textAlign: 'center' }}>Update Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedQualified.map((r, i) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--blue)' }}>#{((qualPage - 1) * qualPageSize) + i + 1}</td>
                          <td><b>{r.applicant}</b><br/><span className="small">{r.code}</span></td>
                          <td>{r.vacancy} ({r.itemNo})</td>
                          <td style={{ fontWeight: 'bold' }}>{r.fit.toFixed(2)}%</td>
                          <td>
                            <span className={`badge ${r.appObj.assessmentStatus === 'assessment_completed' ? 'green' : 'blue'}`}>
                              {titleCase(r.appObj.assessmentStatus || 'marked_qualified')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="secondary" style={{ marginRight: '6px' }} onClick={() => handleUpdatePipeline(r.id, 'assessment_started')}>Start</button>
                            <button className="good" onClick={() => handleUpdatePipeline(r.id, 'assessment_completed')}>Complete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 5: APPOINTMENTS */}
          {activeView === 'appointment' && (
            <section className="view active">
              <div className="card">
                <h2>Appointed Applicants</h2>
                <p className="small" style={{ marginBottom: '14px' }}>Confirmed appointments for occupied items.</p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Applicant</th>
                        <th>Position Item</th>
                        <th>Reference Code</th>
                        <th>Appointment Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointedApplicants.map(r => (
                        <tr key={r.id}>
                          <td><b>{r.applicant}</b></td>
                          <td>{r.vacancy} ({r.itemNo})</td>
                          <td><code>{r.appObj.appointmentReferenceCode}</code></td>
                          <td>{r.appObj.appointmentDate ? r.appObj.appointmentDate.slice(0, 10) : ''}</td>
                          <td><span className="badge green">Appointed</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ marginTop: '20px' }}>
                <h2>Unappointed Qualified Applicants</h2>
                <p className="small" style={{ marginBottom: '14px' }}>Confirm appointments or view status of other qualified candidates.</p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Applicant</th>
                        <th>Vacancy Item</th>
                        <th>Fit Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualifiedApps.filter(app => !app.appObj.appointmentStatus).map(r => (
                        <tr key={r.id}>
                          <td><b>{r.applicant}</b></td>
                          <td>{r.vacancy} ({r.itemNo})</td>
                          <td>{r.fit.toFixed(2)}%</td>
                          <td>
                            <button className="good" onClick={() => {
                              const refCode = prompt('Enter Appointment Reference Code:');
                              const date = new Date().toISOString().slice(0,10);
                              if (refCode) {
                                handleConfirmAppointment(r.id, date, refCode);
                              }
                            }}>Appoint</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* MODAL: INITIAL EVALUATION REVIEW */}
      {reviewId && reviewApp && (
        <div className="modal open">
          <div className="modal-box" style={{ padding: '0 24px 24px', maxHeight: '92vh', overflow: 'auto' }}>
            <div className="modal-head" style={{
              paddingTop: '24px',
              paddingBottom: '12px',
              background: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              margin: '0 -24px 16px',
              paddingLeft: '24px',
              paddingRight: '24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0 }}>Initial Evaluation Review — {reviewApp.applicant}</h2>
              <button className="secondary" onClick={handleCloseReviewModal}>Close</button>
            </div>

            {/* Qualification Standards Matrix (First Section) */}
            <div className="qs-matrix-wrap">
              <div className="qs-matrix-head">
                <div>
                  <div className="position-detail-eyebrow">Qualification Standards</div>
                  <h3>Qualification Standards Matrix</h3>
                  <p className="small">Matrix view of the applicant against the position's qualification standards.</p>
                </div>
              </div>
              <div className="qs-matrix-meta">
                <div className="meta-tile"><b>Applicant</b>{reviewApp.applicant}</div>
                <div className="meta-tile"><b>Applicant code</b>{reviewApp.code}</div>
                <div className="meta-tile"><b>Vacancy</b>{reviewApp.vacancy}</div>
                <div className="meta-tile"><b>Deadline</b>{reviewApp.deadline || '—'}</div>
              </div>
              <div className="qs-matrix-table-wrap">
                <table className="qs-matrix-table">
                  <thead>
                    <tr>
                      <th>Criterion</th>
                      <th>Applicant</th>
                      <th>Qualification Standard</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Bachelor's Degree</td>
                      <td>
                        {reviewApp.applicantObj.bachelorDegree || '—'}
                        {reviewApp.applicantObj.major && (
                          <>
                            <br />
                            <span className="small">{reviewApp.applicantObj.major}</span>
                          </>
                        )}
                      </td>
                      <td>{reviewApp.qsDegree || 'No minimum specified'}</td>
                    </tr>
                    <tr>
                      <td>Years of Experience</td>
                      <td>{reviewApp.yearsExperience} year(s)</td>
                      <td>{reviewApp.qsExperience || '0 minimum year(s)'}</td>
                    </tr>
                    <tr>
                      <td>Hours of Training</td>
                      <td>{reviewApp.trainingHours} hour(s)</td>
                      <td>{reviewApp.qsTraining || '0 minimum hour(s)'}</td>
                    </tr>
                    <tr>
                      <td>Eligibility</td>
                      <td>{reviewApp.applicantObj.eligibility || '—'}</td>
                      <td>{reviewApp.qsEligibility || 'Not specified'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Documentary Screening (Second Section) */}
            <div className="qs-matrix-wrap">
              <div className="qs-matrix-head">
                <div>
                  <div className="position-detail-eyebrow">Documentary Screening</div>
                  <h3>Documentary Requirements</h3>
                  <p className="small">Tick each documentary requirement the applicant has submitted. The QS Evaluation is unlocked automatically once every requirement is complete.</p>
                </div>
              </div>
              <div className="doc-checklist">
                {DOC_REQUIREMENTS.map((req) => (
                  <label className="doc-check-item" key={req.key}>
                    <input type="checkbox" checked={!!reviewDocs[req.key]} onChange={() => handleToggleDocCheck(req.key)} />
                    <span className="doc-req-text">{req.label}</span>
                  </label>
                ))}
              </div>
              <p className="small" style={{ margin: '8px 0 0', fontWeight: '700', fontSize: '13px' }}>
                {docsComplete ? (
                  <>
                    <b style={{ color: 'var(--green)' }}>All {DOC_REQUIREMENTS.length} requirements complete.</b> The QS Evaluation is unlocked below.
                  </>
                ) : (
                  <>
                    <b>{Object.values(reviewDocs).filter(Boolean).length} of {DOC_REQUIREMENTS.length}</b> requirement(s) ticked. Complete all requirements to unlock the QS Evaluation — incomplete requirements mark the applicant as <b style={{ color: 'var(--red)' }}>Excluded</b>.
                  </>
                )}
              </p>
            </div>

            {/* Qualification Standards Evaluation (Third Section - only unlocked when docsComplete) */}
            {docsComplete ? (
              <div className="qs-matrix-wrap">
                <div className="qs-matrix-head">
                  <div>
                    <div className="position-detail-eyebrow">QS Evaluation</div>
                    <h3>QS Evaluation</h3>
                    <p className="small">Review the applicant's details against each qualification standard, then mark whether each was Met or Did Not Meet the Requirements.</p>
                  </div>
                </div>
                <div className="qs-grid">
                  {[
                    { key: 'crit_degree', label: 'Bachelor\'s Degree', appVal: <>{reviewApp.bachelorDegree}{reviewApp.applicantObj.major && <><br /><span className="small">{reviewApp.applicantObj.major}</span></>}</>, reqVal: reviewApp.qsDegree || 'No minimum specified' },
                    { key: 'crit_experience', label: 'Years of Experience', appVal: `${reviewApp.yearsExperience} year(s)`, reqVal: reviewApp.qsExperience || '0 minimum year(s)' },
                    { key: 'crit_training', label: 'Hours of Training', appVal: `${reviewApp.trainingHours} hour(s)`, reqVal: reviewApp.qsTraining || '0 minimum hour(s)' },
                    { key: 'crit_eligibility', label: 'Eligibility', appVal: reviewApp.applicantObj.eligibility || '—', reqVal: reviewApp.qsEligibility || 'Not specified' }
                  ].map(c => (
                    <div className="qs-card" key={c.key}>
                      <h3>{c.label}</h3>
                      <div className="compare">
                        <div className="compare-box"><b>Applicant</b><br/>{c.appVal}</div>
                        <div className="compare-box"><b>Qualification Standard</b><br/>{c.reqVal}</div>
                      </div>
                      <div className="toggle-group">
                        <button className={`secondary ${reviewDecisions[c.key] === 'pass' ? 'good' : ''}`} onClick={() => { setReviewDecisions({ ...reviewDecisions, [c.key]: reviewDecisions[c.key] === 'pass' ? null : 'pass' }); setReviewDirty(true); }}>Met the Requirements</button>
                        <button className={`secondary ${reviewDecisions[c.key] === 'fail' ? 'danger' : ''}`} onClick={() => { setReviewDecisions({ ...reviewDecisions, [c.key]: reviewDecisions[c.key] === 'fail' ? null : 'fail' }); setReviewDirty(true); }}>Did Not Meet the Requirements</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Evaluation Result & Save Actions */}
            <div className="status-command">
              <h3>Evaluation Result</h3>
              <p className="small" style={{ marginBottom: '12px', lineHeight: 1.4 }}>
                The status is set automatically: incomplete documentary requirements result in Excluded; otherwise any criterion marked "Did Not Meet the Requirements" results in Disqualified and all criteria marked "Met the Requirements" result in Qualified.
              </p>
              
              <div className={`result-banner ${calculatedResult}`}>
                <span className={`badge ${cls(calculatedResult)}`}>
                  {calculatedResult === 'excluded' ? 'Excluded' :
                   calculatedResult === 'pending_qs_review' ? 'Pending QS Review' :
                   calculatedResult === 'disqualified' ? 'Disqualified' : 'Qualified'}
                </span>
                <span className="small">
                  {calculatedResult === 'excluded' && (
                    <>
                      <b>Excluded:</b> Documentary requirements are incomplete.
                    </>
                  )}
                  {calculatedResult === 'pending_qs_review' && (
                    <>
                      <b>Pending QS Review:</b> Select Met the Requirements or Did Not Meet the Requirements for every qualification standard.
                    </>
                  )}
                  {calculatedResult === 'disqualified' && (
                    <>
                      <b>Disqualified:</b> Documents are complete, but at least one qualification standard is marked Did Not Meet the Requirements.
                    </>
                  )}
                  {calculatedResult === 'qualified' && (
                    <>
                      <b>Qualified:</b> Documents are complete and all qualification standards are marked Met the Requirements.
                    </>
                  )}
                </span>
              </div>
              
              <div style={{ marginTop: '12px' }}>
                <label>Remarks / Notes</label>
                <textarea value={remarks} onChange={e => { setRemarks(e.target.value); setReviewDirty(true); }} placeholder="Enter evaluation remarks..."></textarea>
              </div>
              
              <div className="decision-row" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
                {(() => {
                  const canSaveExcluded = calculatedResult === 'excluded' && reviewApp.status !== 'excluded';
                  const canSavePendingQs = calculatedResult === 'pending_qs_review' && reviewApp.status !== 'pending_qs_review';
                  const isSaveDisabled = !reviewDirty && !canSaveExcluded && !canSavePendingQs;
                  
                  let saveBtnText = 'Saved';
                  if (canSavePendingQs) {
                    saveBtnText = 'Save Pending QS Review';
                  } else if (canSaveExcluded) {
                    saveBtnText = 'Save Excluded';
                  } else if (reviewDirty) {
                    saveBtnText = 'Save Changes';
                  }
                  
                  return (
                    <button
                      className={isSaveDisabled ? "good" : "gold"}
                      onClick={handleSaveReview}
                      disabled={isSaveDisabled}
                    >
                      {saveBtnText}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UNSAVED CHANGES WARNING */}
      {showUnsavedPrompt && (
        <div className="modal open" style={{ zIndex: 1000 }}>
          <div className="modal-box" style={{ width: 'min(460px, 94vw)' }}>
            <div className="modal-head">
              <h2>Unsaved changes</h2>
              <button className="secondary" onClick={() => setShowUnsavedPrompt(false)}>Keep Editing</button>
            </div>
            <p className="small" style={{ fontInter: 'var(--font-heading)', fontSize: '14px', fontWeight: '800', color: 'var(--navy)', lineHeight: '1.5', margin: '0 0 16px' }}>
              You have unsaved evaluation changes. Save first, or discard the changes and close this review.
            </p>
            <div className="decision-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button className="secondary" onClick={handleDiscardChanges}>Discard Changes</button>
              <button className="good" onClick={async () => {
                await handleSaveReview();
                handleDiscardChanges();
              }}>Save & Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POSTING SCHEDULE CALENDAR */}
      {showCalendar && calVacancy && (() => {
        const position = positions.find(p => p.id === calVacancy.positionId) || {};
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const nowY = new Date().getFullYear();
        const yearOpts = [];
        for (let y = nowY - 1; y <= nowY + 6; y++) yearOpts.push(y);

        const startDow = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const todayIso = new Date().toISOString().slice(0, 10);

        const cells = [];
        for (let i = 0; i < startDow; i++) {
          cells.push(<div key={`empty-${i}`} className="cal-day muted" style={{ opacity: 0.15 }}></div>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isToday = iso === todayIso;
          const isStart = iso === calStart;
          const isEnd = iso === calEnd;
          const inRange = calStart && calEnd && iso > calStart && iso < calEnd;

          cells.push(
            <div
              key={`day-${d}`}
              className={`cal-day ${isToday ? 'today' : ''} ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${inRange ? 'range' : ''}`}
              onClick={() => selectCalDate(iso)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '40px',
                width: '40px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '900',
                fontSize: '13px',
                color: isStart || isEnd ? 'white' : inRange ? 'var(--blue)' : 'var(--navy)',
                backgroundColor: isStart || isEnd ? 'var(--green)' : inRange ? 'var(--blue-100)' : 'transparent',
                border: isToday ? '2px solid var(--blue)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {d}
            </div>
          );
        }

        const durationDays = countCalendarDays(calStart, calEnd);
        const formatBtnDate = (iso) => {
          if (!iso) return 'Not set';
          return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        };

        const calShift = (delta) => {
          let nextMonth = calMonth + delta;
          let nextYear = calYear;
          if (nextMonth < 0) {
            nextMonth = 11;
            nextYear -= 1;
          } else if (nextMonth > 11) {
            nextMonth = 0;
            nextYear += 1;
          }
          setCalMonth(nextMonth);
          setCalYear(nextYear);
        };

        return (
          <div className="modal open">
            <div className="modal-box" style={{ width: 'min(980px, 98vw)', maxHeight: '92vh', padding: '0 24px 24px' }}>
              <div className="modal-head" style={{
                paddingTop: '24px',
                paddingBottom: '12px',
                background: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                margin: '0 -24px 16px',
                paddingLeft: '24px',
                paddingRight: '24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0 }}>Set Posting Schedule</h2>
                <button className="secondary" onClick={() => setShowCalendar(false)}>Close</button>
              </div>
              <div className="posting-schedule-layout">
                {/* Left Stack Column */}
                <aside className="posting-left-stack">
                  <section className="position-detail-panel">
                    <div className="posting-card-head">
                      <div className="position-detail-eyebrow">Position Details</div>
                      <h4>{position.title || calVacancy.title}</h4>
                      <p>Review the item details before opening the posting.</p>
                    </div>
                    <div className="position-info-grid">
                      <div className="position-info-tile">
                        <b>Item No.</b>
                        <span>{calVacancy.itemNo}</span>
                      </div>
                      <div className="position-info-tile">
                        <b>Salary Grade</b>
                        <span>{calVacancy.salaryGrade || position.salaryGrade || '11'}</span>
                      </div>
                      <div className="position-info-tile">
                        <b>School / Office</b>
                        <span>{calVacancy.school || calVacancy.location || 'SDO Manila'}</span>
                      </div>
                      <div className="position-info-tile">
                        <b>Posting Status</b>
                        <span>{calVacancy.status === 'closed' ? 'Closed' : 'Open for Application'}</span>
                      </div>
                    </div>
                  </section>

                  <section className="position-qs-card">
                    <div className="position-qs-card-head">
                      <div className="position-detail-eyebrow">Qualification Standards</div>
                      <h4>Minimum Requirements</h4>
                    </div>
                    <div className="position-qs-list">
                      <div className="position-qs-item">
                        <b>Bachelor's Degree</b>
                        <span>{position.requiredBachelorDegree || 'No minimum specified'}</span>
                      </div>
                      <div className="position-qs-item">
                        <b>Years of Experience</b>
                        <span>{position.minYearsExperience !== undefined ? `${position.minYearsExperience} minimum year(s)` : '0 minimum year(s)'}</span>
                      </div>
                      <div className="position-qs-item">
                        <b>Hours of Training</b>
                        <span>{position.minTrainingHours !== undefined ? `${position.minTrainingHours} minimum hour(s)` : '0 minimum hour(s)'}</span>
                      </div>
                      <div className="position-qs-item">
                        <b>Eligibility</b>
                        <span>{position.eligibilityRequired || 'Not specified'}</span>
                      </div>
                    </div>
                  </section>
                </aside>

                {/* Right Calendar Column */}
                <section className="posting-calendar-panel">
                  <div className="posting-card-head">
                    <div className="position-detail-eyebrow">Posting Calendar</div>
                    <h4>Set Posting Schedule</h4>
                    <p>Choose the posting start date and deadline for <b>{calVacancy.itemNo}</b>.</p>
                  </div>

                  <div className="cal-fields" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F8FCFF', border: '2.5px solid var(--line)', borderRadius: '18px', padding: '10px' }}>
                    <button
                      type="button"
                      className={`cal-field ${calField === 'start' ? 'active' : ''}`}
                      onClick={() => setCalField('start')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '12px',
                        border: calField === 'start' ? '2.5px solid var(--blue)' : '1.5px solid var(--line)',
                        background: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span className="cf-label" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '800' }}>Start date</span>
                      <span className="cf-value" style={{ fontSize: '14px', fontWeight: '900', color: 'var(--navy)' }}>{formatBtnDate(calStart)}</span>
                    </button>
                    <span className="cal-arrow" style={{ fontSize: '20px', color: 'var(--muted)' }}>→</span>
                    <button
                      type="button"
                      className={`cal-field ${calField === 'end' ? 'active' : ''}`}
                      onClick={() => setCalField('end')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '12px',
                        border: calField === 'end' ? '2.5px solid var(--blue)' : '1.5px solid var(--line)',
                        background: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span className="cf-label" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '800' }}>Deadline</span>
                      <span className="cf-value" style={{ fontSize: '14px', fontWeight: '900', color: 'var(--navy)' }}>{formatBtnDate(calEnd)}</span>
                    </button>
                  </div>

                  {/* Calendar Widget */}
                  <div style={{ border: '2px solid var(--line)', borderRadius: '18px', padding: '16px', background: 'white' }}>
                    <div className="cal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <button className="cal-nav" onClick={() => calShift(-1)} style={{ padding: '4px 10px', fontSize: '18px', fontWeight: 'bold', background: 'var(--blue-100)', color: 'var(--blue)', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>‹</button>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={calMonth}
                          onChange={e => setCalMonth(Number(e.target.value))}
                          style={{ padding: '6px 12px', borderRadius: '10px', border: '1.5px solid var(--line)', fontWeight: '800', background: '#F8FCFF', color: 'var(--navy)' }}
                        >
                          {monthNames.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                        </select>
                        <select
                          value={calYear}
                          onChange={e => setCalYear(Number(e.target.value))}
                          style={{ padding: '6px 12px', borderRadius: '10px', border: '1.5px solid var(--line)', fontWeight: '800', background: '#F8FCFF', color: 'var(--navy)' }}
                        >
                          {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <button className="cal-nav" onClick={() => calShift(1)} style={{ padding: '4px 10px', fontSize: '18px', fontWeight: 'bold', background: 'var(--blue-100)', color: 'var(--blue)', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>›</button>
                    </div>
                    
                    <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', justifyItems: 'center' }}>
                      {dows.map(d => (
                        <div key={d} className="cal-dow" style={{ fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', color: 'var(--muted)', paddingBottom: '6px' }}>{d}</div>
                      ))}
                      {cells}
                    </div>
                  </div>

                  {/* Duration days card */}
                  <div className="cal-duration" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2.5px solid var(--blue)', borderRadius: '18px', background: 'var(--blue-50)', padding: '12px 10px', textAlign: 'center' }}>
                    <span className="cd-num" style={{ fontSize: '32px', fontWeight: '950', color: 'var(--blue-800)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>{durationDays}</span>
                    <span className="cd-unit" style={{ fontSize: '9px', fontWeight: '950', color: 'var(--blue-800)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' }}>Calendar Day(s) Open for Posting</span>
                    <span className="cd-hint" style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '700', marginTop: '2px' }}>Weekends are included.</span>
                  </div>

                  <div className="cal-summary" style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--navy)' }}>
                    <span dangerouslySetInnerHTML={{ __html: getCalSummaryText() }}></span>
                  </div>

                  <div className="decision-row" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                    <button className="secondary" onClick={() => setShowCalendar(false)}>Cancel</button>
                    <button className="good cal-confirm" onClick={handleConfirmSchedule}>Open Posting</button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: NOSCA UPLOAD */}
      {showNosca && (
        <div className="modal open">
          <div className="modal-box" style={{ width: 'min(920px, 96vw)', maxHeight: '90vh' }}>
            <div className="modal-head">
              <h2>Add Vacancy from NOSCA</h2>
              <button className="secondary" onClick={() => { setShowNosca(false); setDetectedItems([]); setSelectedNoscaItemNos([]); }}>Close</button>
            </div>
            <div>
              <p className="small" style={{ marginBottom: '16px', lineHeight: 1.4, fontSize: '13px', fontWeight: '700', color: 'var(--muted)' }}>
                Upload a NOSCA (Notice of Organization, Staffing and Compensation Action) to auto-detect authorized item numbers and position titles, then tick the items to add. Added items default to <b>Closed</b>.
              </p>
              
              <div className="nosca-modal" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '18px' }}>
                {/* Left Column: Upload panel */}
                <div className="nosca-upload" style={{ border: '2px dashed var(--line)', borderRadius: '18px', background: '#F8FCFF', padding: '24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', minHeight: '300px' }}>
                  <svg className="doc-icon" viewBox="0 0 24 24" style={{ width: '66px', height: '66px', color: '#EF4444' }}>
                    <path fill="currentColor" d="M19 2H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 16H8v-2h6v2zm3-4H8v-2h9v2zm0-4H8V8h9v2z" />
                  </svg>
                  <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--navy)', margin: 0, fontSize: '16px' }}>NOSCA Document</h3>
                  <p className="small" style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)', fontWeight: '700' }}>Accepted format: PDF scan of the approved NOSCA.</p>
                  <button className="gold" onClick={handleScanNOSCA} disabled={noscaScanning} style={{ marginTop: '8px' }}>
                    {noscaScanning ? 'Scanning...' : '↑ Upload NOSCA'}
                  </button>
                </div>

                {/* Right Column: Scan results checklist */}
                <div className="nosca-scan" style={{ minHeight: '300px', border: '2px solid var(--line)', borderRadius: '18px', padding: '16px', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {noscaScanning ? (
                    <div className="nosca-empty" style={{ height: '100%', minHeight: '230px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontWeight: '700', fontSize: '13px', gap: '4px' }}>
                      <p>Scanning document metadata...</p>
                    </div>
                  ) : detectedItems.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', flex: 1 }}>
                      <div>
                        <div className="scan-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
                          <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--navy)', margin: 0, fontSize: '15px' }}>Detected Items</h3>
                          <span className="scan-badge" style={{ fontSize: '11px', fontWeight: '900', color: 'var(--green)' }}>{detectedItems.length} items detected</span>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
                          {detectedItems.map((it, idx) => {
                            const isChecked = selectedNoscaItemNos.includes(it.itemNo);
                            return (
                              <label key={idx} className="scan-item" style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: '10px', alignItems: 'start', padding: '10px 12px', borderBottom: idx < detectedItems.length - 1 ? '1px solid #E2E8F0' : 'none', cursor: 'pointer', userSelect: 'none' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedNoscaItemNos(prev => 
                                      isChecked ? prev.filter(x => x !== it.itemNo) : [...prev, it.itemNo]
                                    );
                                  }}
                                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                                />
                                <div>
                                  <span className="si-item" style={{ fontFamily: 'var(--font-heading)', fontWeight: '900', color: 'var(--navy)', fontSize: '12px' }}>{it.itemNo}</span>
                                  <span className="si-title" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '700' }}> — {it.title}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="nosca-actions" style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                        <button className="secondary" onClick={() => { setDetectedItems([]); setSelectedNoscaItemNos([]); }}>Clear</button>
                        <button className="good" onClick={handleAddNoscaVacancies}>Add Selected Items</button>
                      </div>
                    </div>
                  ) : (
                    <div className="nosca-empty" style={{ height: '100%', minHeight: '230px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontWeight: '700', fontSize: '13px', gap: '4px' }}>
                      <span>No document scanned yet.</span>
                      <span>Upload a NOSCA to extract item numbers and position titles.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: CLOSE OVERRIDE WARNING */}
      {showCloseWarning && closeWarningVac && (
        <div className="modal open">
          <div className="modal-box" style={{
            width: 'min(1180px, 96vw)',
            maxHeight: '90vh',
            borderLeft: '6px solid var(--blue)',
            borderRadius: '18px',
            padding: '24px 28px'
          }}>
            <div className="modal-head" style={{ borderBottom: 'none', paddingBottom: '4px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '950', color: 'var(--navy)', margin: 0 }}>Closing Not Allowed Yet</h2>
              <button className="secondary" onClick={() => setShowCloseWarning(false)} style={{ fontSize: '13px', padding: '6px 16px', borderRadius: '10px' }}>Close</button>
            </div>

            <div style={{
              border: '1.5px solid #FCA5A5',
              borderRadius: '14px',
              padding: '20px 20px 22px',
              background: '#FEF2F2'
            }}>
              <p style={{
                margin: '0 0 6px',
                fontWeight: '900',
                color: '#991B1B',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '16px' }}>⚠</span> This posting still has {(() => {
                  const end = closeWarningVac.postingEnd ? new Date(closeWarningVac.postingEnd.slice(0, 10) + "T00:00:00") : null;
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  return end ? Math.round((end - today) / 86400000) : 0;
                })()} day(s) remaining.
              </p>
              <p style={{
                margin: '0 0 18px',
                color: '#64748B',
                fontSize: '13px',
                lineHeight: 1.5
              }}>
                Closing is not allowed within 10 days of an active posting. If this is due to accidental opening of the item, type your passcode below to override and allow closing.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label style={{
                  color: '#991B1B',
                  fontWeight: '900',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 6px'
                }}>Reason for closing abruptly</label>
                <select
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  style={{
                    background: 'white',
                    border: '1.5px solid #D7EEF8',
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: closeReason ? 'var(--text)' : '#94A3B8'
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="Accidental opening of the item">Accidental opening of the item</option>
                  <option value="Item withdrawn or deauthorized">Item withdrawn or deauthorized</option>
                  <option value="Duplicate or erroneous posting">Duplicate or erroneous posting</option>
                  <option value="Position reallocated to another office">Position reallocated to another office</option>
                  <option value="Item abolished or reclassified">Item abolished or reclassified</option>
                  <option value="Plantilla funding withdrawn or unfunded">Plantilla funding withdrawn or unfunded</option>
                  <option value="Filled through another HR action">Filled through another HR action</option>
                  <option value="Incorrect posting details (needs reposting)">Incorrect posting details (needs reposting)</option>
                  <option value="Hold order or administrative directive">Hold order or administrative directive</option>
                  <option value="Legal or compliance issue">Legal or compliance issue</option>
                  <option value="Requested by requesting office or school head">Requested by requesting office or school head</option>
                  <option value="__other__">Other (specify)</option>
                </select>

                {closeReason === '__other__' && (
                  <textarea
                    value={closeReasonOther}
                    onChange={e => setCloseReasonOther(e.target.value)}
                    placeholder="Specify the reason (max 150 characters)."
                    maxLength="150"
                    style={{ marginTop: '8px', border: '1.5px solid #D7EEF8', borderRadius: '10px', minHeight: '60px' }}
                  />
                )}
              </div>

              <div>
                <label style={{
                  color: '#991B1B',
                  fontWeight: '900',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 6px'
                }}>Override passcode</label>
                <input
                  type="password"
                  placeholder="Enter passcode"
                  value={closePasscode}
                  onChange={e => setClosePasscode(e.target.value)}
                  style={{
                    background: 'white',
                    border: '1.5px solid #D7EEF8',
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '13px'
                  }}
                />
                {passcodeError && (
                  <div style={{ color: 'var(--red)', fontSize: '12px', fontWeight: '900', marginTop: '6px' }}>
                    {passcodeError}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button className="secondary" onClick={() => setShowCloseWarning(false)} style={{ padding: '10px 20px', borderRadius: '12px' }}>Cancel</button>
              <button className="danger" onClick={handleConfirmOverrideClose} style={{ padding: '10px 20px', borderRadius: '12px' }}>Override & Close</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast-container">
          <div className={`toast-card ${toast.type}`}>
            <span style={{ fontSize: '18px' }}>
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
