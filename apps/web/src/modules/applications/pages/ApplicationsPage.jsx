import React, { useState, useMemo } from 'react';
import { useAppData } from '../../../middleware/DataProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { apiFetch } from '../../../config/api.js';

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

export default function ApplicationsPage() {
  const { vacancies, applications, loadAllData } = useAppData();
  const { setToast } = useToast();

  const [appSearch, setAppSearch] = useState('');
  const [appVacancyFilter, setAppVacancyFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appColFilters, setAppColFilters] = useState({});
  const [multiSort, setMultiSort] = useState(false);
  const [sortStack, setSortStack] = useState([{ key: 'dateApplied', dir: 'desc' }]);
  const [appPage, setAppPage] = useState(1);
  const [appPageSize, setAppPageSize] = useState(10);

  // Review modal state
  const [reviewId, setReviewId] = useState(null);
  const [reviewApp, setReviewApp] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [reviewDocs, setReviewDocs] = useState({});
  const [reviewDecisions, setReviewDecisions] = useState({});
  const [reviewDirty, setReviewDirty] = useState(false);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  // Document Vault modal states in evaluation modal
  const [showReviewDocsVault, setShowReviewDocsVault] = useState(false);
  const [availableDocs, setAvailableDocs] = useState([]);
  const [selectedDocKey, setSelectedDocKey] = useState('pds');

  React.useEffect(() => {
    const handleTourUpdate = () => {
      if (window.agap_tour_open_review) {
        if (applications && applications.length > 0) {
          const app = applications[0];
          setReviewId(app.id);
          setReviewApp(app);
          
          const isAlreadyQualifiedStatus = app.status?.toLowerCase() === 'qualified' || app.status?.toLowerCase() === 'disqualified';
          const docChecklist = app.docChecklist || app.appObj?.docChecklist || app.documents || {};
          const checklistState = {};
          DOC_REQUIREMENTS.forEach((req) => {
            const k = req.key;
            checklistState[k] = docChecklist[k] ?? isAlreadyQualifiedStatus;
          });
          setReviewDocs(checklistState);
        }
      } else if (window.agap_tour_open_review === false) {
        setReviewId(null);
        setReviewApp(null);
      }
    };
    window.addEventListener('agap-tour-update', handleTourUpdate);
    if (window.agap_tour_open_review && applications && applications.length > 0) {
      handleTourUpdate();
    }
    return () => window.removeEventListener('agap-tour-update', handleTourUpdate);
  }, [applications]);

  const cls = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
  };

  const titleCase = (str) => {
    if (!str) return '';
    return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getApplicationDisplayStatus = (row) => {
    if (!row) return '';
    const appStatus = row.applicationStatus;
    if (appStatus) {
      if (['pending', 'application submitted'].includes(appStatus.toLowerCase())) {
        return 'Application Submitted';
      }
      if (appStatus.toLowerCase() === 'pending_qs_review') {
        return 'Pending QS Review';
      }
      return titleCase(appStatus);
    }
    
    // Fallback mapping if database has not set it
    const s = (row.status || '').toLowerCase();
    if (['qualified', 'for_comparative_assessment', 'appointed', 'not_appointed', 'rejected'].includes(s)) {
      return 'Qualified';
    }
    if (['pending', 'application submitted'].includes(s)) {
      return 'Application Submitted';
    }
    if (s === 'pending_qs_review' || s === 'pending qs review') {
      return 'Pending QS Review';
    }
    return titleCase(row.status);
  };

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

  const applicationsKpiStats = useMemo(() => {
    const total = applications.length;
    const qualified = applications.filter(a => ['qualified', 'for_comparative_assessment', 'not_appointed', 'appointed'].includes(a.status.toLowerCase())).length;
    const disqualified = applications.filter(a => a.status.toLowerCase() === 'disqualified').length;
    return { total, qualified, disqualified };
  }, [applications]);

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
        getApplicationDisplayStatus(r).toLowerCase().includes(q)
      );
    }
    if (appVacancyFilter) rows = rows.filter(r => r.vacancyId === appVacancyFilter);
    
    if (appStatusFilter) {
      rows = rows.filter(r => {
        const disp = getApplicationDisplayStatus(r).toLowerCase();
        const filt = appStatusFilter.toLowerCase();
        if (filt === 'pending_qs_review' || filt === 'pending qs review') {
          return disp === 'pending qs review';
        }
        if (filt === 'pending') {
          return disp === 'application submitted';
        }
        return disp === filt;
      });
    }
    
    // Apply column-wise filters
    Object.entries(appColFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      const isNumeric = ['yearsExperience', 'trainingHours'].includes(key);
      const isCategorical = ['vacancy', 'status'].includes(key);

      if (isNumeric) {
        if (value.min !== undefined && value.min !== '') {
          rows = rows.filter(r => r[key] !== undefined && r[key] !== null && Number(r[key]) >= Number(value.min));
        }
        if (value.max !== undefined && value.max !== '') {
          rows = rows.filter(r => r[key] !== undefined && r[key] !== null && Number(r[key]) <= Number(value.max));
        }
      } else if (isCategorical) {
        if (key === 'status') {
          const filt = String(value).toLowerCase();
          rows = rows.filter(r => {
            const disp = getApplicationDisplayStatus(r).toLowerCase();
            if (filt === 'pending_qs_review' || filt === 'pending qs review') {
              return disp === 'pending qs review';
            }
            if (filt === 'pending') {
              return disp === 'application submitted';
            }
            return disp === filt;
          });
        } else {
          rows = rows.filter(r => String(r[key] ?? '') === String(value));
        }
      } else {
        rows = rows.filter(r => String(r[key] ?? '').toLowerCase().includes(String(value).toLowerCase()));
      }
    });

    const statusOrder = {
      'Application Submitted': 1,
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
  }, [applications, appSearch, appVacancyFilter, appStatusFilter, appColFilters, sortStack]);

  const paginatedApps = useMemo(() => {
    const start = (appPage - 1) * appPageSize;
    return filteredApps.slice(start, start + appPageSize);
  }, [filteredApps, appPage, appPageSize]);

  const handleAppColFilterChange = (key, val) => {
    setAppColFilters(prev => ({ ...prev, [key]: val }));
    setAppPage(1);
  };

  const handleAppColRangeChange = (key, bound, val) => {
    setAppColFilters(prev => {
      const current = prev[key] && typeof prev[key] === 'object' ? prev[key] : {};
      return {
        ...prev,
        [key]: { ...current, [bound]: val }
      };
    });
    setAppPage(1);
  };

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

  const handleExportIER = () => {
    const qualRows = filteredApps.filter(app => getApplicationDisplayStatus(app).toLowerCase() === 'qualified');
    const headers = ["No.", "Applicant", "Applicant Number", "Date of Application", "Deadline", "Bachelor's Degree", "Years Experience", "Hours Training", "Vacancy", "Status"];
    const rows = qualRows.map((r, i) => [
      i + 1, r.applicant, r.code, r.dateApplied, r.deadline, r.bachelorDegree, r.yearsExperience, r.trainingHours, r.vacancy, getApplicationDisplayStatus(r)
    ]);
    downloadCSV(headers, rows, `IER-qualified-applicants-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleOpenReview = (appRow) => {
    setReviewId(appRow.id);
    setReviewApp(appRow);
    setRemarks(appRow.reason || appRow.appObj?.reason || '');
    
    setAvailableDocs([]);
    setSelectedDocKey('pds');
    setShowReviewDocsVault(false);
    if (appRow.id) {
      apiFetch(`/api/applications/${appRow.id}/documents`)
        .then(data => {
          setAvailableDocs(data.documents || []);
        })
        .catch(err => console.error('Error fetching documents:', err));
    }

    const docChecklist = appRow.docChecklist || appRow.appObj?.docChecklist || appRow.documents || {};
    const statusLower = appRow.status ? appRow.status.toLowerCase() : '';
    const isAlreadyQualifiedStatus = ['qualified', 'for_comparative_assessment', 'not_appointed', 'appointed'].includes(statusLower);
    const defaultVal = appRow.documentaryComplete ?? appRow.appObj?.documentaryComplete ?? isAlreadyQualifiedStatus;

    const checklistState = {};
    ['loi', 'pds', 'prc', 'eligibility', 'tor', 'training', 'employment', 'appointment', 'performance', 'cav', 'other'].forEach(k => {
      checklistState[k] = docChecklist[k] ?? defaultVal;
    });
    setReviewDocs(checklistState);

    const isPending = statusLower === 'application submitted' || statusLower === 'pending';
    const latest = isPending ? {} : (appRow.latestEval || {});
    setReviewDecisions({
      crit_degree: latest.degreeDecision || (isAlreadyQualifiedStatus ? 'pass' : null),
      crit_experience: latest.experienceDecision || (isAlreadyQualifiedStatus ? 'pass' : null),
      crit_training: latest.trainingDecision || (isAlreadyQualifiedStatus ? 'pass' : null),
      crit_eligibility: latest.eligibilityDecision || (isAlreadyQualifiedStatus ? 'pass' : null)
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

  const isAlreadyQualified = useMemo(() => {
    if (!reviewApp) return false;
    const statusLower = reviewApp.status ? reviewApp.status.toLowerCase() : '';
    const apptLower = (reviewApp.appointmentStatus || reviewApp.appObj?.appointmentStatus || '').toLowerCase();
    const assessStatus = reviewApp.assessmentStatus || reviewApp.appObj?.assessmentStatus || '';
    
    if (apptLower === 'appointed' || apptLower === 'rejected' || apptLower === 'not appointed' || apptLower === 'not_appointed') {
      return true;
    }
    if (assessStatus === 'Assessment Started' || assessStatus === 'Assessment Completed') {
      return true;
    }
    if (statusLower === 'appointed') {
      return true;
    }
    return false;
  }, [reviewApp]);

  const calculatedResult = useMemo(() => {
    const decisions = Object.values(reviewDecisions);
    const allPass = decisions.every(d => d === 'pass');
    const someFail = decisions.some(d => d === 'fail');

    if (!docsComplete) {
      const hasAnyDocChecked = Object.values(reviewDocs).some(Boolean);
      return hasAnyDocChecked ? 'Excluded' : 'Application Submitted';
    }

    if (someFail) return 'Disqualified';
    if (allPass) return 'Qualified';
    return 'Pending QS Review';
  }, [docsComplete, reviewDocs, reviewDecisions]);

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

  return (
    <section className="view active">
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Total Applications</div>
          <div className="kpi-number">{applicationsKpiStats.total}</div>
          <div className="kpi-caption">All records</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Qualified</div>
          <div className="kpi-number">{applicationsKpiStats.qualified}</div>
          <div className="kpi-caption">Passed QS</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Disqualified</div>
          <div className="kpi-number">{applicationsKpiStats.disqualified}</div>
          <div className="kpi-caption">Failed QS</div>
        </div>
      </div>

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
                <option value="Application Submitted">Application Submitted</option>
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
                <th>
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('applicant')}>
                      Applicant{getSortIndicator('applicant')}
                    </button>
                    <input
                      className="column-filter"
                      placeholder="Filter..."
                      value={appColFilters.applicant || ''}
                      onChange={e => handleAppColFilterChange('applicant', e.target.value)}
                    />
                  </div>
                </th>
                <th>
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('dateApplied')}>
                      Date of Application{getSortIndicator('dateApplied')}
                    </button>
                    <input
                      className="column-filter"
                      placeholder="Filter..."
                      value={appColFilters.dateApplied || ''}
                      onChange={e => handleAppColFilterChange('dateApplied', e.target.value)}
                    />
                  </div>
                </th>
                <th>
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('deadline')}>
                      Deadline of Application{getSortIndicator('deadline')}
                    </button>
                    <input
                      className="column-filter"
                      placeholder="Filter..."
                      value={appColFilters.deadline || ''}
                      onChange={e => handleAppColFilterChange('deadline', e.target.value)}
                    />
                  </div>
                </th>
                <th>
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('bachelorDegree')}>
                      Bachelor's Degree{getSortIndicator('bachelorDegree')}
                    </button>
                    <input
                      className="column-filter"
                      placeholder="Filter..."
                      value={appColFilters.bachelorDegree || ''}
                      onChange={e => handleAppColFilterChange('bachelorDegree', e.target.value)}
                    />
                  </div>
                </th>
                <th className="num-col">
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('yearsExperience')}>
                      Years Experience{getSortIndicator('yearsExperience')}
                    </button>
                    <div className="column-filter-range">
                      <input
                        className="column-filter half"
                        placeholder="Min"
                        type="number"
                        value={appColFilters.yearsExperience?.min || ''}
                        onChange={e => handleAppColRangeChange('yearsExperience', 'min', e.target.value)}
                      />
                      <input
                        className="column-filter half"
                        placeholder="Max"
                        type="number"
                        value={appColFilters.yearsExperience?.max || ''}
                        onChange={e => handleAppColRangeChange('yearsExperience', 'max', e.target.value)}
                      />
                    </div>
                  </div>
                </th>
                <th className="num-col">
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('trainingHours')}>
                      Hours Training{getSortIndicator('trainingHours')}
                    </button>
                    <div className="column-filter-range">
                      <input
                        className="column-filter half"
                        placeholder="Min"
                        type="number"
                        value={appColFilters.trainingHours?.min || ''}
                        onChange={e => handleAppColRangeChange('trainingHours', 'min', e.target.value)}
                      />
                      <input
                        className="column-filter half"
                        placeholder="Max"
                        type="number"
                        value={appColFilters.trainingHours?.max || ''}
                        onChange={e => handleAppColRangeChange('trainingHours', 'max', e.target.value)}
                      />
                    </div>
                  </div>
                </th>
                <th>
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('vacancy')}>
                      Vacancy{getSortIndicator('vacancy')}
                    </button>
                    <select
                      className="column-filter-select"
                      value={appColFilters.vacancy || ''}
                      onChange={e => handleAppColFilterChange('vacancy', e.target.value)}
                    >
                      <option value="">All</option>
                      {Array.from(new Set(vacancies.map(v => v.title))).sort().map(title => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                  </div>
                </th>
                <th>
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('itemNo')}>
                      Item No.{getSortIndicator('itemNo')}
                    </button>
                    <input
                      className="column-filter"
                      placeholder="Filter..."
                      value={appColFilters.itemNo || ''}
                      onChange={e => handleAppColFilterChange('itemNo', e.target.value)}
                    />
                  </div>
                </th>
                <th>
                  <div className="th-content">
                    <button className="th-btn" onClick={() => handleSortClick('status')}>
                      Application Status{getSortIndicator('status')}
                    </button>
                    <select
                      className="column-filter-select"
                      value={appColFilters.status || ''}
                      onChange={e => handleAppColFilterChange('status', e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="pending">Application Submitted</option>
                      <option value="pending_qs_review">Pending QS Review</option>
                      <option value="qualified">Qualified</option>
                      <option value="disqualified">Disqualified</option>
                      <option value="excluded">Excluded</option>
                    </select>
                  </div>
                </th>
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
                  <td className="num-col">
                    <span className={`qs-number ${r.fitObj?.experienceScore >= 60 ? 'qs-pass' : 'qs-fail'}`}>
                      {r.yearsExperience}
                    </span>
                  </td>
                  <td className="num-col">
                    <span className={`qs-number ${r.fitObj?.trainingScore >= 60 ? 'qs-pass' : 'qs-fail'}`}>
                      {r.trainingHours}
                    </span>
                  </td>
                  <td>{r.vacancy}</td>
                  <td>{r.itemNo || '—'}</td>
                  <td><span className={`badge ${cls(getApplicationDisplayStatus(r))}`}>{getApplicationDisplayStatus(r)}</span></td>
                </tr>
              ))}
              {paginatedApps.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center' }}>No applications match the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager-controls">
          <div className="pager-group">
            <button className="secondary" onClick={() => setAppPage(p => Math.max(1, p - 1))} disabled={appPage === 1}>Prev</button>
            <span className="small">Page {appPage} of {Math.max(1, Math.ceil(filteredApps.length / appPageSize))} · {filteredApps.length} records</span>
            <button className="secondary" onClick={() => setAppPage(p => Math.min(Math.max(1, Math.ceil(filteredApps.length / appPageSize)), p + 1))} disabled={appPage >= Math.max(1, Math.ceil(filteredApps.length / appPageSize))}>Next</button>
          </div>
          <div className="pager-group">
            <div className="pager-field">
              <label>Rows</label>
              <select value={appPageSize} onChange={e => { setAppPageSize(Number(e.target.value)); setAppPage(1); }}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="pager-field">
              <label>Go to page</label>
              <select value={appPage} onChange={e => setAppPage(Number(e.target.value))}>
                {Array.from({ length: Math.max(1, Math.ceil(filteredApps.length / appPageSize)) }, (_, idx) => (
                  <option key={idx + 1} value={idx + 1}>Page {idx + 1}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: INITIAL EVALUATION REVIEW */}
      {reviewId && reviewApp && (
        <div className="modal open">
          <div className="modal-box" style={{ width: 'min(960px, 96vw)', padding: '0 24px 24px', maxHeight: '92vh', overflow: 'auto' }}>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="secondary" onClick={() => setShowReviewDocsVault(!showReviewDocsVault)}>
                  {showReviewDocsVault ? 'Hide Documents' : '📂 View Documents'}
                </button>
                <button className="secondary" onClick={handleCloseReviewModal}>Close</button>
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: showReviewDocsVault ? '1fr 500px' : '1fr', 
              gap: '24px', 
              alignItems: 'start' 
            }}>
              <div>
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
                <div className="meta-tile"><b>Applicant number</b>{reviewApp.code}</div>
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
                          <div className="small" style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '11px', fontWeight: 'normal' }}>
                            {reviewApp.applicantObj.major}
                          </div>
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
                    <input type="checkbox" checked={!!reviewDocs[req.key]} onChange={() => handleToggleDocCheck(req.key)} disabled={isAlreadyQualified} />
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

            {docsComplete ? (
              <div className="qs-matrix-wrap">
                <div className="qs-matrix-head">
                  <div>
                    <div className="position-detail-eyebrow">QS Evaluation</div>
                    <h3>QS Evaluation</h3>
                    <p className="small">Review the applicant's details against each qualification standard, then mark whether each was Meet the QS or Did not Meet the QS.</p>
                  </div>
                </div>
                <div className="qs-grid">
                  {[
                    { key: 'crit_degree', label: 'Bachelor\'s Degree', appVal: <>{reviewApp.bachelorDegree}{reviewApp.applicantObj.major && <div className="small" style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '11px', fontWeight: 'normal' }}>{reviewApp.applicantObj.major}</div>}</>, reqVal: reviewApp.qsDegree || 'No minimum specified' },
                    { key: 'crit_experience', label: 'Years of Experience', appVal: `${reviewApp.yearsExperience} year(s)`, reqVal: reviewApp.qsExperience || '0 minimum year(s)' },
                    { key: 'crit_training', label: 'Hours of Training', appVal: `${reviewApp.trainingHours} hour(s)`, reqVal: reviewApp.qsTraining || '0 minimum hour(s)' },
                    { key: 'crit_eligibility', label: 'Eligibility', appVal: reviewApp.applicantObj.eligibility || '—', reqVal: reviewApp.qsEligibility || 'Not specified' }
                  ].map(c => (
                    <div className="qs-card" key={c.key}>
                      <h3>{c.label}</h3>
                      <div className="compare" style={{ marginBottom: '12px' }}>
                        <div className="compare-box"><b>Applicant</b><br/>{c.appVal}</div>
                        <div className="compare-box"><b>Qualification Standard</b><br/>{c.reqVal}</div>
                      </div>
                       <div className="toggle-group" style={{ marginTop: 'auto' }}>
                        <button className={`secondary ${reviewDecisions[c.key] === 'pass' ? 'good' : ''}`} onClick={() => { if (isAlreadyQualified) return; setReviewDecisions({ ...reviewDecisions, [c.key]: reviewDecisions[c.key] === 'pass' ? null : 'pass' }); setReviewDirty(true); }} style={isAlreadyQualified ? { cursor: 'not-allowed', opacity: 0.8 } : {}}>Meet the QS</button>
                        <button className={`secondary ${reviewDecisions[c.key] === 'fail' ? 'danger' : ''}`} onClick={() => { if (isAlreadyQualified) return; setReviewDecisions({ ...reviewDecisions, [c.key]: reviewDecisions[c.key] === 'fail' ? null : 'fail' }); setReviewDirty(true); }} style={isAlreadyQualified ? { cursor: 'not-allowed', opacity: 0.8 } : {}}>Did not Meet the QS</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="status-command">
              <h3>Evaluation Result</h3>
              <p className="small" style={{ marginBottom: '12px', lineHeight: 1.4 }}>
                The status is set automatically: incomplete documentary requirements result in Excluded; otherwise any criterion marked "Did not Meet the QS" results in Disqualified and all criteria marked "Meet the QS" result in Qualified.
              </p>
              
              <div className={`result-banner ${calculatedResult.toLowerCase().replace(/\s+/g, '_')}`}>
                <span className={`badge ${cls(calculatedResult.toLowerCase().replace(/\s+/g, '_'))}`}>
                  {calculatedResult}
                </span>
                <span className="small">
                  {calculatedResult.toLowerCase() === 'excluded' && (
                    <>
                      <b>Excluded:</b> Documentary requirements are incomplete.
                    </>
                  )}
                  {calculatedResult.toLowerCase() === 'pending qs review' && (
                    <>
                      <b>Pending QS Review:</b> Select Meet the QS or Did not Meet the QS for every qualification standard.
                    </>
                  )}
                  {calculatedResult.toLowerCase() === 'disqualified' && (
                    <>
                      <b>Disqualified:</b> Documents are complete, but at least one qualification standard is marked Did not Meet the QS.
                    </>
                  )}
                  {calculatedResult.toLowerCase() === 'qualified' && (
                    <>
                      <b>Qualified:</b> Documents are complete and all qualification standards are marked Meet the QS.
                    </>
                  )}
                </span>
              </div>
              
              <div style={{ marginTop: '12px' }}>
                <label>Remarks / Notes</label>
                <textarea value={remarks} onChange={e => { setRemarks(e.target.value); setReviewDirty(true); }} placeholder="Enter evaluation remarks..." disabled={isAlreadyQualified}></textarea>
              </div>
              
              <div className="decision-row" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
                {(() => {
                  const canSaveExcluded = calculatedResult.toLowerCase() === 'excluded' && reviewApp.status.toLowerCase() !== 'excluded';
                  const canSavePendingQs = calculatedResult.toLowerCase() === 'pending qs review' && reviewApp.status.toLowerCase() !== 'pending qs review';
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
                      className={isSaveDisabled || isAlreadyQualified ? "good" : "gold"}
                      onClick={handleSaveReview}
                      disabled={isSaveDisabled || isAlreadyQualified}
                    >
                      {isAlreadyQualified ? 'Evaluation Locked' : saveBtnText}
                    </button>
                  );
                })()}
              </div>
              </div>
              
              {showReviewDocsVault && (
                <div style={{ position: 'sticky', top: '72px' }}>
                  <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginBottom: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>
                    {[
                      { key: 'pds', label: 'PDS' },
                      { key: 'work_experience', label: 'Work Experience' },
                      { key: 'eligibility', label: 'Eligibility' },
                      { key: 'tor', label: 'TOR' },
                      { key: 'prc', label: 'PRC License' },
                      { key: 'diploma', label: 'Diploma' },
                      { key: 'resume', label: 'Resume' },
                    ].map((doc) => {
                      const isSelected = selectedDocKey === doc.key;
                      const isUploaded = availableDocs.find(d => d.key === doc.key)?.existsInAzure;
                      return (
                        <button
                          key={doc.key}
                          type="button"
                          onClick={() => setSelectedDocKey(doc.key)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: isSelected ? '1px solid var(--blue)' : '1px solid var(--line)',
                            background: isSelected ? 'var(--blue)' : 'white',
                            color: isSelected ? 'white' : 'var(--navy)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {doc.label} {isUploaded ? '✓' : ''}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: 'var(--blue-50)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ color: 'var(--blue-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          style={{ color: 'var(--blue-800)' }}
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Document Viewer: {
                          selectedDocKey === 'pds' ? 'Personal Data Sheet (PDS)' :
                          selectedDocKey === 'work_experience' ? 'Work Experience Sheet' :
                          selectedDocKey === 'eligibility' ? 'Certificate of Eligibility' :
                          selectedDocKey === 'tor' ? 'Transcript of Records (TOR)' :
                          selectedDocKey === 'prc' ? 'Updated PRC License/ID' :
                          selectedDocKey === 'diploma' ? 'Diploma' : 'Resume'
                        }
                      </b>
                    </div>
                    {(() => {
                      const selectedDocInfo = availableDocs.find(d => d.key === selectedDocKey);
                      const existsInAzure = !!selectedDocInfo?.existsInAzure;
                      const isPdf = !!selectedDocInfo?.filename?.toLowerCase().endsWith('.pdf');
                      return (
                        <div style={{
                          padding: (existsInAzure && isPdf) ? '0' : '24px',
                          backgroundColor: '#f8fafc',
                          minHeight: '400px',
                          maxHeight: '650px',
                          overflowY: (existsInAzure && isPdf) ? 'hidden' : 'auto',
                          display: 'flex',
                          justifyContent: 'center',
                          width: '100%',
                          alignItems: 'stretch'
                        }}>
                          {existsInAzure ? (
                            isPdf ? (
                              <iframe
                                src={`${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${reviewApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}&dpi=98`}
                                style={{ width: '100%', height: '650px', border: 'none', borderRadius: '0 0 12px 12px' }}
                                title="Azure Document Viewer"
                              />
                            ) : (
                              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'white', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 'bold' }}>
                                    Previewing Spreadsheet: {selectedDocInfo?.filename}
                                  </span>
                                  <a
                                    href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${reviewApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '12px', color: 'var(--blue-600)', textDecoration: 'underline', fontWeight: 'bold' }}
                                  >
                                    Download Original
                                  </a>
                                </div>
                              </div>
                            )
                          ) : (
                            <div style={{ textAlign: 'center', color: '#64748B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#94A3B8' }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="9" y1="15" x2="15" y2="15" />
                                <line x1="12" y1="12" x2="12" y2="18" />
                              </svg>
                              <b style={{ fontSize: '14px' }}>No Document Uploaded</b>
                              <span style={{ fontSize: '12px', maxWidth: '240px' }}>
                                The applicant has not uploaded a file for this requirement type.
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UNSAVED CHANGES WARNING */}
      {showUnsavedPrompt && (
        <div className="modal open" style={{ zIndex: 100001 }}>
          <div className="modal-box" style={{ width: 'min(460px, 94vw)' }}>
            <div className="modal-head">
              <h2>Unsaved changes</h2>
              <button className="secondary" onClick={() => setShowUnsavedPrompt(false)}>Keep Editing</button>
            </div>
            <p className="small" style={{ fontSize: '14px', fontWeight: '800', color: 'var(--navy)', lineHeight: '1.5', margin: '0 0 16px' }}>
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
    </section>
  );
}
