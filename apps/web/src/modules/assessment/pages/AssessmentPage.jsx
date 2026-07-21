import React, { useState, useMemo, useEffect } from 'react';
import { useAppData } from '../../../middleware/DataProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { apiFetch } from '../../../config/api.js';
import { computeOverallAreaScore, scoreTone, SCORE_AREAS } from '@agap/shared';
import VacancyClusterAccordion from '../../../components/VacancyClusterAccordion.jsx';

const QUAL_NOT_SELECTED = { key: "not_selected", phase: 2, label: "Not Selected", badge: "red", next: "Did not advance past HRMPSB deliberation" };

const QUAL_PIPELINE = [
  { key: "qualified", phase: 1, label: "Qualified — IER pending", badge: "blue", next: "Post the Initial Evaluation Result (IER)" },
  { key: "ier_posted", phase: 1, label: "IER Posted", badge: "blue", next: "Begin comparative assessment" },
  { key: "comparative_assessment", phase: 1, label: "For Comparative Assessment", badge: "orange", next: "Start scoring the applicant" },
  { key: "assessment_ongoing", phase: 1, label: "Assessment Ongoing", badge: "orange", next: "Encode all evaluator scores" },
  { key: "assessment_completed", phase: 1, label: "Assessment Completed", badge: "orange", next: "HRMPSB deliberation decides if the applicant advances" },
  { key: "in_registry", phase: 2, label: "Included in CAR / RQA", badge: "orange", next: "Rank and apply the Rule of Five" },
  { key: "shortlisted", phase: 2, label: "Shortlisted — Rule of Five", badge: "green", next: "Endorse to the Appointing Authority" },
  { key: "selected_for_appointment", phase: 2, label: "Selected for Appointment", badge: "green", next: "Post the appointment for the protest window" },
  { key: "appointment_posted", phase: 2, label: "Appointment Posted", badge: "green", next: "Observe the 15-day protest period" },
  { key: "protest_period", phase: 2, label: "Protest Period", badge: "orange", next: "Resolve any protest, then finalize" },
  { key: "finalized", phase: 2, label: "Finalized", badge: "green", next: "Appointment finalized — item filled" }
];

export default function AssessmentPage() {
  const { vacancies, applications, loadAllData } = useAppData();
  const { setToast } = useToast();

  const [qualSearch, setQualSearch] = useState('');
  const [qualVacancyFilter, setQualVacancyFilter] = useState('');
  const [qualStageFilter, setQualStageFilter] = useState('');
  const [qualColFilters, setQualColFilters] = useState({});
  const [qualSortKey, setQualSortKey] = useState('fit');
  const [qualSortDir, setQualSortDir] = useState('desc');
  const [qualPage, setQualPage] = useState(1);
  const [qualPageSize, setQualPageSize] = useState(10);

  // Scoring Modal state
  const [showQualModal, setShowQualModal] = useState(false);
  const [selectedQualApp, setSelectedQualApp] = useState(null);
  const [modalAreaScores, setModalAreaScores] = useState({});
  const [modalCompScores, setModalCompScores] = useState({ bei: '', wst: '', we: '' });
  const [modalRemarks, setModalRemarks] = useState('');
  const [qualModalDirty, setQualModalDirty] = useState(false);
  const [showQualDiscardWarning, setShowQualDiscardWarning] = useState(false);
  const [pipeSelectedKey, setPipeSelectedKey] = useState(null);
  const [pipeOriginalKey, setPipeOriginalKey] = useState(null);

  // View Documents state
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedDocKey, setSelectedDocKey] = useState('pds');
  const [availableDocs, setAvailableDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (selectedQualApp?.id) {
      setAvailableDocs([]);
      setDocsLoading(true);
      console.log(`[Azure Storage] Requesting documents for applicant ID "${selectedQualApp.applicantId || 'AGAP-0001'}" in folder "staging-agap"...`);
      apiFetch(`/api/applications/${selectedQualApp.id}/documents`)
        .then(data => {
          console.log(`%c[Azure Storage Fetch SUCCESS]`, 'color: green; font-weight: bold; font-size: 14px;');
          console.log('Azure Folder Name:', data.azureFolder);
          console.log('Sample Hash Reference:', data.sampleHash);
          console.log('Retrieved Documents Checklist:', data.documents);
          setAvailableDocs(data.documents || []);
        })
        .catch(err => {
          console.error('[Azure Storage Fetch ERROR] Failed to fetch documents:', err);
          setAvailableDocs([]);
        })
        .finally(() => setDocsLoading(false));
    }
  }, [selectedQualApp]);

  // CSV viewer state & auto-fetcher
  const [csvData, setCsvData] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  useEffect(() => {
    const selectedDocInfo = availableDocs.find(d => d.key === selectedDocKey);
    const existsInAzure = !!selectedDocInfo?.existsInAzure;
    const isPdf = !!selectedDocInfo?.filename?.toLowerCase().endsWith('.pdf');

    if (existsInAzure && !isPdf && selectedQualApp?.id) {
      setCsvLoading(true);
      setCsvError(null);
      setCsvData(null);

      const apiBaseUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const downloadUrl = `${apiBaseUrl}/api/applications/${selectedQualApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}`;
      
      fetch(downloadUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Status ${res.status}`);
          return res.text();
        })
        .then(text => {
          const rows = [];
          let currentRow = [];
          let currentField = '';
          let insideQuotes = false;

          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];

            if (char === '"') {
              if (insideQuotes && nextChar === '"') {
                currentField += '"';
                i++;
              } else {
                insideQuotes = !insideQuotes;
              }
            } else if (char === ',' && !insideQuotes) {
              currentRow.push(currentField.trim());
              currentField = '';
            } else if ((char === '\r' || char === '\n') && !insideQuotes) {
              if (char === '\r' && nextChar === '\n') {
                i++;
              }
              currentRow.push(currentField.trim());
              if (currentRow.some(cell => cell !== '')) {
                rows.push(currentRow);
              }
              currentRow = [];
              currentField = '';
            } else {
              currentField += char;
            }
          }
          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            rows.push(currentRow);
          }

          setCsvData(rows);
          setCsvLoading(false);
        })
        .catch(err => {
          console.error('[CSV Load Error]', err);
          setCsvError(err.message);
          setCsvLoading(false);
        });
    } else {
      setCsvData(null);
      setCsvLoading(false);
      setCsvError(null);
    }
  }, [selectedDocKey, availableDocs, selectedQualApp, showDocsModal]);

  // Appointment confirmation state
  const [showAppointConfirmModal, setShowAppointConfirmModal] = useState(false);
  const [showSdsReminderModal, setShowSdsReminderModal] = useState(false);
  const [appointConfirmApp, setAppointConfirmApp] = useState(null);
  const [appointDate, setAppointDate] = useState('');
  const [appointRefCode, setAppointRefCode] = useState('');
  const [appointPasscode, setAppointPasscode] = useState('');
  const [appointItemNo, setAppointItemNo] = useState('');
  const [showIncompleteAppointModal, setShowIncompleteAppointModal] = useState(false);

  const titleCase = (str) => {
    if (!str) return '';
    return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const parseDateNoTime = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
      const d = new Date(val.getTime());
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(val);
    const dateStr = str.includes('T') ? str.slice(0, 10) : (str.length >= 10 ? str.slice(0, 10) : str);
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  };

  const isItemSelectableForAppointment = (v) => {
    if (!v) return false;
    if (v.fillingUpStatus === 'FILLED' || v.filling_up_status === 'FILLED') return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = parseDateNoTime(v.postingStart || v.posting_start);
    const end = parseDateNoTime(v.postingEnd || v.posting_end);

    // Strict rule: Must have valid posting start AND end dates.
    if (!start || !end) return false;

    const hasOpened = today >= start;
    const isDeadlinePassed = today > end;
    const isClosedStatus = v.status === 'closed' && hasOpened;

    if (hasOpened && (isDeadlinePassed || isClosedStatus)) {
      return true;
    }

    return false;
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

  const occupiedItemNos = useMemo(() => {
    return new Set(
      applications
        .filter(a => a.appointmentStatus === 'appointed')
        .map(a => a.itemNo)
        .filter(v => v && v !== '—')
    );
  }, [applications]);

  const qualifiedPoolRanked = useMemo(() => {
    const pool = applications.filter(app => ['qualified', 'for_comparative_assessment', 'not_appointed'].includes(app.status.toLowerCase()));
    const byVac = {};
    pool.forEach(r => {
      if (!byVac[r.vacancyId]) byVac[r.vacancyId] = [];
      byVac[r.vacancyId].push(r);
    });

    Object.values(byVac).forEach(list => {
      list.sort((a, b) => b.fit - a.fit);
      list.forEach((r, i) => {
        r.rank = i + 1;
        r.ruleOfFive = i < 5;
      });
    });

    return pool;
  }, [applications]);

  const qualifiedKpiStats = useMemo(() => {
    const total = qualifiedPoolRanked.length;
    const counts = { "No Assessment": 0, "Assessment Started": 0, "Assessment Completed": 0 };
    
    qualifiedPoolRanked.forEach(row => {
      const cs = row.comparativeAssessmentScores || row.appObj?.comparativeAssessmentScores || {};
      const areaScores = row.latestEval?.areaScores || {};
      const hasValue = v => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
      
      const compChecks = [cs.bei, cs.wst, cs.we].map(hasValue);
      const compCount = compChecks.filter(Boolean).length;
      
      const areaChecks = Object.values(areaScores).map(hasValue);
      const areaCount = areaChecks.filter(Boolean).length;
      
      let label = "No Assessment";
      if (areaCount === 10 && compCount === 3) {
        label = "Assessment Completed";
      } else if (areaCount > 0 || compCount > 0) {
        label = "Assessment Started";
      }
      
      if (counts.hasOwnProperty(label)) counts[label]++;
    });

    return {
      total,
      noAssessment: counts["No Assessment"],
      assessmentStarted: counts["Assessment Started"],
      assessmentCompleted: counts["Assessment Completed"]
    };
  }, [qualifiedPoolRanked]);

  const getQualifiedColumnValue = (row, key) => {
    if (key === 'rank') return row.rank || '';
    if (key === 'applicant') return row.applicant || '';
    if (key === 'bachelorDegree') return row.bachelorDegree || '';
    if (key === 'vacancy') return row.vacancy || '';
    if (key === 'itemNo') return row.itemNo || '';
    if (['bei', 'wst', 'we'].includes(key)) {
      const scores = row.comparativeAssessmentScores || row.appObj?.comparativeAssessmentScores || {};
      return scores[key] !== '' && scores[key] !== null && scores[key] !== undefined ? Number(scores[key]) : '';
    }
    if (key === 'fit') {
      const areaScores = row.latestEval?.areaScores || {};
      const hasValue = v => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
      const areaCount = Object.values(areaScores).map(hasValue).filter(Boolean).length;
      if (areaCount === 10) {
        return row.fit !== null && row.fit !== undefined ? Number(row.fit) : '';
      }
      return '';
    }
    if (key === 'assessmentStatus') {
      const csObj = row.comparativeAssessmentScores || row.appObj?.comparativeAssessmentScores || {};
      const areaScores = row.latestEval?.areaScores || {};
      const hasValue = v => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
      const compChecks = [csObj.bei, csObj.wst, csObj.we].map(hasValue);
      const compCount = compChecks.filter(Boolean).length;
      const areaChecks = Object.values(areaScores).map(hasValue);
      const areaCount = areaChecks.filter(Boolean).length;
      
      if (areaCount === 10 && compCount === 3) return 'Assessment Completed';
      if (areaCount > 0 || compCount > 0) return 'Assessment Started';
      return 'Assessment Not Started';
    }
    if (key === 'appointmentStatus') {
      return row.appointmentStatus || row.appObj?.appointmentStatus || 'Appoint';
    }
    return '';
  };

  const qualifiedApps = useMemo(() => {
    let rows = qualifiedPoolRanked.filter(r => {
      const appt = r.appointmentStatus || r.appObj?.appointmentStatus;
      if (appt === 'FOR APPOINTMENT') return false;
      return !r.itemNo || !occupiedItemNos.has(r.itemNo);
    });

    if (qualSearch) {
      const q = qualSearch.toLowerCase();
      rows = rows.filter(r => 
        [r.applicant, r.code, r.bachelorDegree, r.vacancy, r.itemNo].join(' ').toLowerCase().includes(q)
      );
    }

    if (qualVacancyFilter) {
      rows = rows.filter(r => r.vacancyId === qualVacancyFilter);
    }

    if (qualStageFilter) {
      rows = rows.filter(r => {
        const stageKey = r.assessmentStatus || r.appObj?.pipeline || (r.status.toLowerCase() === 'for_comparative_assessment' ? 'comparative_assessment' : 'qualified');
        return stageKey === qualStageFilter;
      });
    }

    // Column filters
    Object.entries(qualColFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      const isNumeric = ['fit', 'bei', 'wst', 'we'].includes(key);
      const isCategorical = ['vacancy', 'assessmentStatus', 'appointmentStatus'].includes(key);

      if (isNumeric) {
        if (value.min !== undefined && value.min !== '') {
          rows = rows.filter(r => {
            const cellVal = getQualifiedColumnValue(r, key);
            return cellVal !== '' && cellVal >= Number(value.min);
          });
        }
        if (value.max !== undefined && value.max !== '') {
          rows = rows.filter(r => {
            const cellVal = getQualifiedColumnValue(r, key);
            return cellVal !== '' && cellVal <= Number(value.max);
          });
        }
      } else if (isCategorical) {
        rows = rows.filter(r => {
          const cellVal = getQualifiedColumnValue(r, key);
          return String(cellVal) === String(value);
        });
      } else {
        rows = rows.filter(r => {
          const cellVal = getQualifiedColumnValue(r, key);
          return String(cellVal).toLowerCase().includes(String(value).toLowerCase());
        });
      }
    });

    // Sorting
    if (qualSortKey) {
      const dir = qualSortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = getQualifiedColumnValue(a, qualSortKey);
        const bv = getQualifiedColumnValue(b, qualSortKey);

        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    return rows;
  }, [qualifiedPoolRanked, occupiedItemNos, qualSearch, qualVacancyFilter, qualStageFilter, qualColFilters, qualSortKey, qualSortDir]);

  const paginatedQualified = useMemo(() => {
    const start = (qualPage - 1) * qualPageSize;
    return qualifiedApps.slice(start, start + qualPageSize);
  }, [qualifiedApps, qualPage, qualPageSize]);

  const getAssessmentStatus = (row) => {
    const csObj = row.comparativeAssessmentScores || row.appObj?.comparativeAssessmentScores || {};
    const areaScores = row.latestEval?.areaScores || {};
    const hasValue = v => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
    
    const compChecks = [csObj.bei, csObj.wst, csObj.we].map(hasValue);
    const compCount = compChecks.filter(Boolean).length;
    
    const areaCount = SCORE_AREAS.filter(sa => hasValue(areaScores[sa.key])).length;
    
    if (areaCount === SCORE_AREAS.length && compCount === 3) return { label: 'Assessment Completed', badge: 'green' };
    if (areaCount > 0 || compCount > 0) return { label: 'Assessment Started', badge: 'orange' };
    return { label: 'Assessment Not Started', badge: 'blue' };
  };

  const handleExportCAR = async () => {
    try {
      const token = localStorage.getItem('agap_token');
      const queryParams = new URLSearchParams();
      if (qualVacancyFilter) {
        queryParams.append('vacancyId', qualVacancyFilter);
      }
      const url = `${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/export-car?${queryParams.toString()}`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to export CAR Excel file');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      a.download = `CAR_Annex_I_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error downloading CAR:', err);
      alert('Failed to download CAR Excel file: ' + err.message);
    }
  };

  const handleQualSort = (key) => {
    if (qualSortKey === key) {
      setQualSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setQualSortKey(key);
      setQualSortDir('desc');
    }
  };

  const getQualSortIndicator = (key) => {
    if (qualSortKey === key) {
      return ` ${qualSortDir === 'asc' ? '▲' : '▼'}`;
    }
    return '';
  };

  const handleQualColFilterChange = (key, val) => {
    setQualColFilters(prev => ({ ...prev, [key]: val }));
    setQualPage(1);
  };

  const handleQualColRangeChange = (key, bound, val) => {
    setQualColFilters(prev => {
      const current = prev[key] && typeof prev[key] === 'object' ? prev[key] : {};
      return {
        ...prev,
        [key]: { ...current, [bound]: val }
      };
    });
    setQualPage(1);
  };

  const openQualifiedScoringModal = (appRow) => {
    setSelectedQualApp(appRow);
    setModalRemarks(appRow.reason || appRow.appObj?.reason || '');

    const savedArea = appRow.latestEval?.areaScores || {};
    const defaultArea = {
      education: savedArea.education ?? '',
      experience: savedArea.experience ?? '',
      training: savedArea.training ?? '',
      eligibility: savedArea.eligibility ?? '',
      outstandingAccomplishment: savedArea.outstandingAccomplishment ?? '',
      documentCompleteness: savedArea.documentCompleteness ?? '',
      applicationEducation: savedArea.applicationEducation ?? '',
      applicationLearning: savedArea.applicationLearning ?? '',
      performanceRating: savedArea.performanceRating ?? '',
      potential: savedArea.potential ?? ''
    };
    setModalAreaScores(defaultArea);

    const compScores = appRow.comparativeAssessmentScores || appRow.appObj?.comparativeAssessmentScores || {};
    const defaultComp = {
      bei: compScores.bei ?? '',
      wst: compScores.wst ?? '',
      we: compScores.we ?? ''
    };
    setModalCompScores(defaultComp);

    const currentKey = appRow.assessmentStatus || appRow.appObj?.pipeline || (appRow.status === 'for_comparative_assessment' ? 'comparative_assessment' : 'qualified');
    setPipeSelectedKey(currentKey);
    setPipeOriginalKey(currentKey);

    setQualModalDirty(false);
    setShowQualModal(true);
  };

  const handleSaveQualifiedScoring = async (appId) => {
    const overall = allAreasScored ? computeOverallAreaScore(modalAreaScores) : null;
    const nextStatus = ['qualified', 'Qualified', 'ier_posted'].includes(pipeSelectedKey) ? 'Qualified' : 'for_comparative_assessment';

    const hasValue = v => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
    const areaCount = SCORE_AREAS.filter(sa => hasValue(modalAreaScores[sa.key])).length;
    const compChecks = [modalCompScores.bei, modalCompScores.wst, modalCompScores.we].map(hasValue);
    const compCount = compChecks.filter(Boolean).length;

    let computedAssessmentStatus = 'Assessment Not Started';
    if (areaCount === SCORE_AREAS.length && compCount === 3) {
      computedAssessmentStatus = 'Assessment Completed';
    } else if (areaCount > 0 || compCount > 0) {
      computedAssessmentStatus = 'Assessment Started';
    }

    try {
      await apiFetch(`/api/applications/${appId}/pipeline`, {
        method: 'PUT',
        body: JSON.stringify({
          assessmentStatus: computedAssessmentStatus,
          comparativeAssessmentScores: modalCompScores,
          status: nextStatus,
          areaScores: modalAreaScores,
          overallFit: overall
        })
      });
      setQualModalDirty(false);
      setPipeOriginalKey(pipeSelectedKey);
      setShowQualModal(false);
      setToast({ message: 'Changes saved successfully!', type: 'success' });
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleCloseQualModal = () => {
    if (qualModalDirty) {
      setShowQualDiscardWarning(true);
    } else {
      setShowQualModal(false);
      setSelectedQualApp(null);
    }
  };

  const handleAreaScoreChange = (key, val) => {
    setModalAreaScores(prev => {
      const area = SCORE_AREAS.find(a => a.key === key);
      const maxVal = area && area.max !== undefined ? area.max : 100;
      let finalVal = val;
      if (val !== '') {
        const num = Number(val);
        if (!isNaN(num)) {
          if (num > maxVal) {
            finalVal = maxVal.toString();
          } else if (num < 0) {
            finalVal = '0';
          }
        }
      }
      const updated = { ...prev, [key]: finalVal };
      setQualModalDirty(true);
      return updated;
    });
  };

  const handleCompScoreChange = (key, val) => {
    setModalCompScores(prev => {
      const updated = { ...prev, [key]: val === '' ? '' : Math.max(0, Math.min(100, Number(val))) };
      setQualModalDirty(true);
      return updated;
    });
  };

  const handleConfirmAppointment = async (appId, date, passcode, itemNo) => {
    if (!date) return setToast({ message: 'Please select appointment date', type: 'error' });
    if (!itemNo) return setToast({ message: 'Please select an item number', type: 'error' });
    if (!passcode) return setToast({ message: 'Please enter your passcode', type: 'error' });
    try {
      const res = await apiFetch(`/api/applications/${appId}/flag-appointment`, {
        method: 'POST',
        body: JSON.stringify({ appointmentDate: date, passcode, itemNo })
      });
      setToast({ message: 'Applicant flagged for appointment!', type: 'success' });
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const scoredAreaCount = SCORE_AREAS.filter(sa => modalAreaScores[sa.key] !== '' && modalAreaScores[sa.key] !== null && modalAreaScores[sa.key] !== undefined).length;
  const allAreasScored = scoredAreaCount === SCORE_AREAS.length;
  const overallScorefit = allAreasScored ? computeOverallAreaScore(modalAreaScores) : 0;
  const overallTone = scoreTone(overallScorefit);

  const compValues = Object.values(modalCompScores).filter(v => v !== '' && v !== null && v !== undefined);
  const compAllScored = compValues.length === 3;
  const compAverage = compAllScored ? (compValues.reduce((sum, v) => sum + Number(v), 0) / 3) : 0;
  const compTone = scoreTone(compAverage);

  return (
    <section className="view active">
      <div className="kpis" style={{ '--qualified-cols': 4 }}>
        <div className="kpi">
          <div className="kpi-label">Total Qualified</div>
          <div className="kpi-number">{qualifiedKpiStats.total}</div>
          <div className="kpi-caption">Applicants who passed initial screening</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">No Assessment</div>
          <div className="kpi-number">{qualifiedKpiStats.noAssessment}</div>
          <div className="kpi-caption">Awaiting comparative assessment scores</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Assessment Started</div>
          <div className="kpi-number">{qualifiedKpiStats.assessmentStarted}</div>
          <div className="kpi-caption">Some assessment scores recorded</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Assessment Completed</div>
          <div className="kpi-number">{qualifiedKpiStats.assessmentCompleted}</div>
          <div className="kpi-caption">All assessment scores recorded</div>
        </div>
      </div>

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
                {vacancies.map(v => <option key={v.id} value={v.jobClusterId}>{v.title}</option>)}
              </select>
            </div>
            <div>
              <label>Pipeline Stage</label>
              <select value={qualStageFilter} onChange={e => setQualStageFilter(e.target.value)}>
                <option value="">All stages</option>
                <optgroup label="Phase 1 — Evaluation &amp; Assessment">
                  {QUAL_PIPELINE.filter(s => s.phase === 1).map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Phase 2 — Registry &amp; Appointment">
                  {QUAL_PIPELINE.filter(s => s.phase === 2).map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </optgroup>
                <option value="not_selected">Not Selected</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card action-card export-quick-action-card">
          <div className="action-card-header">
            <div className="action-card-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h8" />
                <path d="M8 17h8" />
                <path d="M10 9h1" />
              </svg>
            </div>
            <div className="action-title-group">
              <span className="action-kicker">EXPORT REPORT</span>
              <span className="action-title">DepEd Order 7 · Annex I (CAR)</span>
            </div>
          </div>
          <button className="export-report-btn" onClick={handleExportCAR}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download CAR Excel</span>
            </div>
            <span className="export-btn-badge">.XLSX</span>
          </button>
          <div className="action-card-footer">
            <span className="footer-check">✓</span>
            <span>Auto-formatted official template</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Qualified Pool - Comparative Assessments</h2>
        <div className="table-wrap" style={{ width: '100%', overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="row-num" style={{ width: '100%' }}>No.</th>
                <th>
                  <button className="th-btn" onClick={() => handleQualSort('applicant')}>
                    Applicant{getQualSortIndicator('applicant')}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={qualColFilters.applicant || ''}
                    onChange={e => handleQualColFilterChange('applicant', e.target.value)}
                  />
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleQualSort('bachelorDegree')}>
                    Bachelor's Degree{getQualSortIndicator('bachelorDegree')}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={qualColFilters.bachelorDegree || ''}
                    onChange={e => handleQualColFilterChange('bachelorDegree', e.target.value)}
                  />
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleQualSort('vacancy')}>
                    Vacancy{getQualSortIndicator('vacancy')}
                  </button>
                  <select
                    className="column-filter-select"
                    value={qualColFilters.vacancy || ''}
                    onChange={e => handleQualColFilterChange('vacancy', e.target.value)}
                  >
                    <option value="">All</option>
                    {Array.from(new Set(vacancies.map(v => v.title))).sort().map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleQualSort('fit')}>
                    Overall Score{getQualSortIndicator('fit')}
                  </button>
                  <div className="column-filter-range">
                    <input
                      className="column-filter half"
                      placeholder="Min"
                      type="number"
                      value={qualColFilters.fit?.min || ''}
                      onChange={e => handleQualColRangeChange('fit', 'min', e.target.value)}
                    />
                    <input
                      className="column-filter half"
                      placeholder="Max"
                      type="number"
                      value={qualColFilters.fit?.max || ''}
                      onChange={e => handleQualColRangeChange('fit', 'max', e.target.value)}
                    />
                  </div>
                </th>
                <th className="num-col">
                  <button className="th-btn" onClick={() => handleQualSort('bei')}>
                    BEI{getQualSortIndicator('bei')}
                  </button>
                  <div className="column-filter-range">
                    <input
                      className="column-filter half"
                      placeholder="Min"
                      type="number"
                      value={qualColFilters.bei?.min || ''}
                      onChange={e => handleQualColRangeChange('bei', 'min', e.target.value)}
                    />
                    <input
                      className="column-filter half"
                      placeholder="Max"
                      type="number"
                      value={qualColFilters.bei?.max || ''}
                      onChange={e => handleQualColRangeChange('bei', 'max', e.target.value)}
                    />
                  </div>
                </th>
                <th className="num-col">
                  <button className="th-btn" onClick={() => handleQualSort('wst')}>
                    WST{getQualSortIndicator('wst')}
                  </button>
                  <div className="column-filter-range">
                    <input
                      className="column-filter half"
                      placeholder="Min"
                      type="number"
                      value={qualColFilters.wst?.min || ''}
                      onChange={e => handleQualColRangeChange('wst', 'min', e.target.value)}
                    />
                    <input
                      className="column-filter half"
                      placeholder="Max"
                      type="number"
                      value={qualColFilters.wst?.max || ''}
                      onChange={e => handleQualColRangeChange('wst', 'max', e.target.value)}
                    />
                  </div>
                </th>
                <th className="num-col">
                  <button className="th-btn" onClick={() => handleQualSort('we')}>
                    WE{getQualSortIndicator('we')}
                  </button>
                  <div className="column-filter-range">
                    <input
                      className="column-filter half"
                      placeholder="Min"
                      type="number"
                      value={qualColFilters.we?.min || ''}
                      onChange={e => handleQualColRangeChange('we', 'min', e.target.value)}
                    />
                    <input
                      className="column-filter half"
                      placeholder="Max"
                      type="number"
                      value={qualColFilters.we?.max || ''}
                      onChange={e => handleQualColRangeChange('we', 'max', e.target.value)}
                    />
                  </div>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleQualSort('assessmentStatus')}>
                    Assessment Status{getQualSortIndicator('assessmentStatus')}
                  </button>
                  <select
                    className="column-filter-select"
                    value={qualColFilters.assessmentStatus || ''}
                    onChange={e => handleQualColFilterChange('assessmentStatus', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="Assessment Not Started">Assessment Not Started</option>
                    <option value="Assessment Started">Assessment Started</option>
                    <option value="Assessment Completed">Assessment Completed</option>
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleQualSort('appointmentStatus')}>
                    Action{getQualSortIndicator('appointmentStatus')}
                  </button>
                  <select
                    className="column-filter-select"
                    value={qualColFilters.appointmentStatus || ''}
                    onChange={e => handleQualColFilterChange('appointmentStatus', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="Appoint">Appoint</option>
                    <option value="appointed">Appointed</option>
                    <option value="rejected">Rejected</option>
                    <option value="not_appointed">Not Appointed</option>
                  </select>
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const grouped = {};
                paginatedQualified.forEach(item => {
                  const groupKey = item.vacancy || 'Unspecified Cluster';
                  if (!grouped[groupKey]) {
                    grouped[groupKey] = [];
                  }
                  grouped[groupKey].push(item);
                });

                if (paginatedQualified.length === 0) {
                  return (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center' }}>No qualified personnel match the filters.</td>
                    </tr>
                  );
                }

                return Object.entries(grouped).map(([clusterName, items]) => (
                  <VacancyClusterAccordion key={clusterName} title={clusterName} colSpan={11}>
                    {items.map((r, i) => {
                      const cs = r.comparativeAssessmentScores || r.appObj?.comparativeAssessmentScores || {};
                      const hasCompScores = ['bei', 'wst', 'we'].every(k => cs[k] !== '' && cs[k] !== null && cs[k] !== undefined && Number.isFinite(Number(cs[k])));
                      const appt = r.appointmentStatus || r.appObj?.appointmentStatus;
                      
                      const areaScores = r.latestEval?.areaScores || {};
                      const hasValue = v => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
                      const areaCount = Object.keys(areaScores).filter(k => SCORE_AREAS.some(sa => sa.key === k)).map(k => hasValue(areaScores[k])).filter(Boolean).length;
                      const allAreasScored = areaCount === SCORE_AREAS.length;

                      const fmtScore = (v) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))) ? (
                        <span className={`badge ${Number(v) >= 85 ? 'green' : Number(v) >= 70 ? 'blue' : Number(v) >= 50 ? 'orange' : 'red'}`}>
                          {Number(v).toFixed(2)}%
                        </span>
                      ) : '—';

                      const assessment = getAssessmentStatus(r);
                      
                      const actionCell = appt === 'FOR APPOINTMENT' ? (
                        <span className="badge green">For Appointment</span>
                      ) : (appt === 'rejected' || appt === 'not_appointed') ? (
                        <span className="badge red">Not Appointed</span>
                      ) : (assessment.label === 'Assessment Completed' || assessment.label === 'ASSESSMENT COMPLETE') ? (
                        <button
                          className="good vac-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppointConfirmApp(r);
                            setAppointDate(new Date().toISOString().slice(0, 10));
                            const appJobClusterId = r.jobClusterId || r.job_cluster_id;
                            const clusterItems = vacancies.filter(v => 
                              (appJobClusterId && v.jobClusterId === appJobClusterId) ||
                              (r.positionId && v.positionId === r.positionId) ||
                              (r.vacancy && v.title === r.vacancy)
                            );
                            const initialItem = clusterItems.find(v => (v.itemNo === r.itemNo || v.itemNo === r.item_no) && isItemSelectableForAppointment(v))
                              || clusterItems.find(v => isItemSelectableForAppointment(v));
                            setAppointItemNo(initialItem?.itemNo || '');
                            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                            const rand = Math.floor(1000 + Math.random() * 9000);
                            setAppointRefCode(`APPT-${today}-${rand}`);
                            setAppointPasscode('');
                            setShowSdsReminderModal(true);
                          }}
                        >
                          Appoint
                        </button>
                      ) : (
                        <button
                          className="secondary vac-action incomplete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowIncompleteAppointModal(true);
                          }}
                        >
                          Appoint
                        </button>
                      );

                      return (
                        <tr key={r.id} className="clickable-row" onClick={() => openQualifiedScoringModal(r)}>
                          <td className="row-num">{((qualPage - 1) * qualPageSize) + i + 1}</td>
                          <td><b>{r.applicant}</b><br/><span className="small">{r.code}</span></td>
                          <td>{r.bachelorDegree || '—'}</td>
                          <td>{r.vacancy}</td>
                          <td className="num-col">
                            {allAreasScored && r.fit !== null && r.fit !== undefined ? (
                              <span className={`badge ${r.fit >= 85 ? 'green' : r.fit >= 70 ? 'blue' : r.fit >= 50 ? 'orange' : 'red'}`}>
                                {Number(r.fit).toFixed(2)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="num-col">{fmtScore(cs.bei)}</td>
                          <td className="num-col">{fmtScore(cs.wst)}</td>
                          <td className="num-col">{fmtScore(cs.we)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${assessment.badge}`}>{assessment.label}</span>
                          </td>
                          <td>{actionCell}</td>
                        </tr>
                      );
                    })}
                  </VacancyClusterAccordion>
                ));
              })()}
            </tbody>
          </table>
        </div>

        <div className="pager-controls">
          <div className="pager-group">
            <button className="secondary" onClick={() => setQualPage(p => Math.max(1, p - 1))} disabled={qualPage === 1}>Prev</button>
            <span className="small">Page {qualPage} of {Math.max(1, Math.ceil(qualifiedApps.length / qualPageSize))} · {qualifiedApps.length} in qualified pool</span>
            <button className="secondary" onClick={() => setQualPage(p => Math.min(Math.max(1, Math.ceil(qualifiedApps.length / qualPageSize)), p + 1))} disabled={qualPage === Math.max(1, Math.ceil(qualifiedApps.length / qualPageSize))}>Next</button>
          </div>
          <div className="pager-group">
            <div className="pager-field">
              <label>Rows</label>
              <select value={qualPageSize} onChange={e => { setQualPageSize(Number(e.target.value)); setQualPage(1); }}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="pager-field">
              <label>Go to page</label>
              <select value={qualPage} onChange={e => setQualPage(Number(e.target.value))}>
                {Array.from({ length: Math.max(1, Math.ceil(qualifiedApps.length / qualPageSize)) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: QS SCORING MATRIX */}
      {showQualModal && selectedQualApp && (
        <div className="modal open" style={{ zIndex: 1000 }}>
          <div className="modal-box" style={{ width: 'min(1100px, 98vw)' }}>
            <div className="modal-head">
              <h2>Qualification Standards Matrix — {selectedQualApp.applicant}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    setSelectedDocKey('pds');
                    setShowDocsModal(true);
                  }}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ display: 'inline-block' }}
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View Documents
                </button>
                <button className="secondary" onClick={handleCloseQualModal}>Close</button>
              </div>
            </div>

            <div className="modal-body">
              <div className="qs-matrix-wrap qualified-tab-card">
                <div className="qualified-card-head" style={{ padding: '24px' }}>
                  <div className="position-detail-eyebrow">Qualification Standards</div>
                  <h4>Qualification Standards Matrix</h4>
                  <p className="small">Matrix view of the applicant against the position's qualification standards.</p>
                </div>
                <div className="qualified-card-body" style={{ padding: '0 24px 24px' }}>
                  <div className="qs-matrix-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px', padding: '16px', backgroundColor: 'var(--blue-50)', borderRadius: '12px' }}>
                    <div className="meta-tile"><b>Applicant</b><br/>{selectedQualApp.applicant}</div>
                    <div className="meta-tile"><b>Applicant number</b><br/>{selectedQualApp.code}</div>
                    <div className="meta-tile"><b>Vacancy</b><br/>{selectedQualApp.vacancy}</div>
                    <div className="meta-tile"><b>Deadline</b><br/>{selectedQualApp.deadline || '—'}</div>
                  </div>
                  <div className="qs-matrix-table-wrap">
                    <table className="qs-matrix-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2.5px solid var(--line)' }}>
                          <th style={{ padding: '12px 8px' }}>Criterion</th>
                          <th style={{ padding: '12px 8px' }}>Applicant</th>
                          <th style={{ padding: '12px 8px' }}>Qualification Standard</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 8px' }}>Bachelor's Degree</td>
                          <td style={{ padding: '12px 8px' }}>
                            {selectedQualApp.applicantObj?.bachelorDegree || '—'}
                            {selectedQualApp.applicantObj?.major && (
                              <div className="small" style={{ color: 'var(--muted)', marginTop: '4px' }}>
                                {selectedQualApp.applicantObj.major}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px' }}>{selectedQualApp.positionObj?.requiredBachelorDegree || 'No minimum specified'}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 8px' }}>Years of Experience</td>
                          <td style={{ padding: '12px 8px' }}>{selectedQualApp.yearsExperience} year(s)</td>
                          <td style={{ padding: '12px 8px' }}>{selectedQualApp.positionObj?.minYearsExperience || 0} minimum year(s)</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 8px' }}>Hours of Training</td>
                          <td style={{ padding: '12px 8px' }}>{selectedQualApp.trainingHours} hour(s)</td>
                          <td style={{ padding: '12px 8px' }}>{selectedQualApp.positionObj?.minTrainingHours || 0} minimum hour(s)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="qs-matrix-wrap qualified-tab-card">
                <div className="qualified-card-head" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <div className="position-detail-eyebrow">Scoring Mechanism</div>
                    <h4>Scoring Metrics</h4>
                    <p className="small">Enter category scores based on the prescribed criteria and submitted MOVs.</p>
                  </div>
                  <div className="qs-matrix-summary" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className={`qs-score-card ${allAreasScored ? overallTone.color : ''}`} style={{ padding: '12px 20px', border: '2px solid var(--line)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="qs-score-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800 }}>Overall Score</span>
                      <span className="qs-score-value" style={{ fontSize: '24px', fontWeight: 900, color: 'var(--navy)' }}>{allAreasScored ? `${overallScorefit.toFixed(2)}` : '—'}</span>
                      <span className="qs-score-caption" style={{ fontSize: '11px', color: 'var(--muted)' }}>{allAreasScored ? 'All areas scored' : `${scoredAreaCount} of ${SCORE_AREAS.length} area(s) scored`}</span>
                    </div>
                    <button
                      className={`good qualified-save-top qualified-score-save-btn ${qualModalDirty ? '' : 'up-to-date'}`}
                      disabled={!qualModalDirty}
                      onClick={() => handleSaveQualifiedScoring(selectedQualApp.id)}
                    >
                      {qualModalDirty ? 'Save Changes' : 'Up-to-date'}
                    </button>
                  </div>
                </div>
                <div className="qualified-card-body" style={{ padding: '24px' }}>
                  <div className="qs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    {SCORE_AREAS.map(area => {
                      const DOC_KEY_MAPPING = {
                        education: 'tor',
                        experience: 'work_experience',
                        training: 'training_certificates'
                      };
                      const docKey = DOC_KEY_MAPPING[area.key];
                      const docInfo = availableDocs.find(d => d.key === docKey);
                      const exists = !!docInfo?.existsInAzure;
                      
                      return (
                        <div className="qs-card" key={area.key} style={{ border: '1px solid var(--line)', borderRadius: '16px', padding: '16px', position: 'relative' }}>
                          <h3 style={{ marginBottom: '6px' }}>{area.label}</h3>
                          <p className="small" style={{ margin: '0 0 12px', minHeight: '36px' }}>{area.description}</p>
                          <div style={{ marginTop: 'auto', padding: '14px', border: '2px solid var(--line)', borderRadius: '18px', background: 'linear-gradient(135deg,#FFFFFF,#F8FCFF)' }}>
                            <label style={{ margin: '0 0 8px', display: 'block', fontWeight: 'bold' }}>Score</label>
                            <input
                              type="number"
                              min="0"
                              max={area.max !== undefined ? area.max : 100}
                              step="0.01"
                              value={modalAreaScores[area.key] ?? ''}
                              onChange={e => handleAreaScoreChange(area.key, e.target.value)}
                              placeholder={area.max !== undefined ? `0.00 - ${area.max.toFixed(2)}` : "0.00 - 100.00"}
                              style={{ height: '50px', textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 950, border: '2.5px solid var(--blue-600)', background: 'white', boxShadow: '0 8px 18px rgba(2,132,199,.08)', width: '100%', boxSizing: 'border-box', borderRadius: '8px' }}
                            />
                            <div className="small" style={{ marginTop: '8px', fontWeight: 800 }}>Enter a score from 0.00 to {area.max !== undefined ? area.max.toFixed(2) : "100.00"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="qs-matrix-wrap qualified-tab-card">
                <div className="qualified-card-head" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <div className="position-detail-eyebrow">Comparative Assessment</div>
                    <h4>Comparative Assessment Average</h4>
                    <p className="small">Encode BEI, WST, and WE scores. The system computes the average score automatically.</p>
                  </div>
                  <div className="qs-matrix-summary" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className={`qs-score-card ${compAllScored ? compTone.color : ''}`} style={{ padding: '12px 20px', border: '2px solid var(--line)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="qs-score-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800 }}>Average Score</span>
                      <span className="qs-score-value" style={{ fontSize: '24px', fontWeight: 900, color: 'var(--navy)' }}>{compAllScored ? `${compAverage.toFixed(2)}%` : '—'}</span>
                      <span className="qs-score-caption" style={{ fontSize: '11px', color: 'var(--muted)' }}>{compAllScored ? `${compValues.length} assessment score(s)` : `${compValues.length} of 3 score(s) entered`}</span>
                    </div>
                    <button
                      className={`good qualified-save-top qualified-score-save-btn ${qualModalDirty ? '' : 'up-to-date'}`}
                      disabled={!qualModalDirty}
                      onClick={() => handleSaveQualifiedScoring(selectedQualApp.id)}
                    >
                      {qualModalDirty ? 'Save Changes' : 'Up-to-date'}
                    </button>
                  </div>
                </div>
                <div className="qualified-card-body" style={{ padding: '24px' }}>
                  <div className="qs-grid comparative-assessment-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div className="qs-card" style={{ border: '1px solid var(--line)', borderRadius: '16px', padding: '16px' }}>
                      <h3 style={{ marginBottom: '6px' }}>Behavioral Events Interview (BEI)</h3>
                      <p className="small" style={{ margin: '0 0 12px', minHeight: '36px' }}>Average BEI score based on panel interview ratings and competency indicators.</p>
                      <div style={{ marginTop: 'auto', padding: '14px', border: '2px solid var(--line)', borderRadius: '18px', background: 'linear-gradient(135deg,#FFFFFF,#F8FCFF)' }}>
                        <label style={{ margin: '0 0 8px', display: 'block', fontWeight: 'bold' }}>Score</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={modalCompScores.bei ?? ''}
                          onChange={e => handleCompScoreChange('bei', e.target.value)}
                          placeholder="0.00 - 100.00"
                          style={{ height: '50px', textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 950, border: '2.5px solid var(--blue-600)', background: 'white', boxShadow: '0 8px 18px rgba(2,132,199,.08)', width: '100%', boxSizing: 'border-box', borderRadius: '8px' }}
                        />
                        <div className="small" style={{ marginTop: '8px', fontWeight: 800 }}>Enter a score from 0.00 to 100.00</div>
                      </div>
                    </div>
                    <div className="qs-card" style={{ border: '1px solid var(--line)', borderRadius: '16px', padding: '16px' }}>
                      <h3 style={{ marginBottom: '6px' }}>Work Sample Test (WST)</h3>
                      <p className="small" style={{ margin: '0 0 12px', minHeight: '36px' }}>Score for the work sample or technical performance test.</p>
                      <div style={{ marginTop: 'auto', padding: '14px', border: '2px solid var(--line)', borderRadius: '18px', background: 'linear-gradient(135deg,#FFFFFF,#F8FCFF)' }}>
                        <label style={{ margin: '0 0 8px', display: 'block', fontWeight: 'bold' }}>Score</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={modalCompScores.wst ?? ''}
                          onChange={e => handleCompScoreChange('wst', e.target.value)}
                          placeholder="0.00 - 100.00"
                          style={{ height: '50px', textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 950, border: '2.5px solid var(--blue-600)', background: 'white', boxShadow: '0 8px 18px rgba(2,132,199,.08)', width: '100%', boxSizing: 'border-box', borderRadius: '8px' }}
                        />
                        <div className="small" style={{ marginTop: '8px', fontWeight: 800 }}>Enter a score from 0.00 to 100.00</div>
                      </div>
                    </div>
                    <div className="qs-card" style={{ border: '1px solid var(--line)', borderRadius: '16px', padding: '16px' }}>
                      <h3 style={{ marginBottom: '6px' }}>Written Examination (WE)</h3>
                      <p className="small" style={{ margin: '0 0 12px', minHeight: '36px' }}>Score for the written examination component.</p>
                      <div style={{ marginTop: 'auto', padding: '14px', border: '2px solid var(--line)', borderRadius: '18px', background: 'linear-gradient(135deg,#FFFFFF,#F8FCFF)' }}>
                        <label style={{ margin: '0 0 8px', display: 'block', fontWeight: 'bold' }}>Score</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={modalCompScores.we ?? ''}
                          onChange={e => handleCompScoreChange('we', e.target.value)}
                          placeholder="0.00 - 100.00"
                          style={{ height: '50px', textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 950, border: '2.5px solid var(--blue-600)', background: 'white', boxShadow: '0 8px 18px rgba(2,132,199,.08)', width: '100%', boxSizing: 'border-box', borderRadius: '8px' }}
                        />
                        <div className="small" style={{ marginTop: '8px', fontWeight: 800 }}>Enter a score from 0.00 to 100.00</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="decision-row">
              <button className="secondary" onClick={handleCloseQualModal}>Close</button>
              <button
                className="good"
                disabled={!qualModalDirty}
                onClick={() => handleSaveQualifiedScoring(selectedQualApp.id)}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UNSAVED SCORING CHANGES WARNING */}
      {showQualDiscardWarning && (
        <div className="modal open" style={{ zIndex: 100001 }}>
          <div className="modal-box" style={{ width: 'min(500px, 94vw)' }}>
            <div className="modal-head">
              <h3>Unsaved Changes</h3>
              <p className="small">You changed one or more scores but have not saved them yet.</p>
            </div>
            <div className="modal-body" style={{ margin: '14px 0' }}>
              <p className="small">Choose what to do before closing the assessment window.</p>
            </div>
            <div className="decision-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="secondary" onClick={() => setShowQualDiscardWarning(false)}>Keep Editing</button>
              <button className="danger" onClick={() => {
                setShowQualDiscardWarning(false);
                setShowQualModal(false);
                setSelectedQualApp(null);
              }}>Discard Changes</button>
              <button className="good" onClick={() => {
                setShowQualDiscardWarning(false);
                handleSaveQualifiedScoring(selectedQualApp.id);
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SDS SUPERINTENDENT REMINDER */}
      {showSdsReminderModal && appointConfirmApp && (
        <div className="modal open" style={{ zIndex: 1001 }}>
          <div className="modal-box" style={{ width: 'min(520px, 94vw)', borderRadius: '20px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '32px' }}>📢</span>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, fontFamily: 'var(--font-heading)' }}>Superintendent Confirmation Required</h3>
            </div>
            <p style={{ margin: '0 0 20px', lineHeight: '1.6', fontSize: '14px', color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
              Please ensure that the appointment of <b>{appointConfirmApp.applicant}</b> has been officially approved and confirmed first by the <b>Schools Division Superintendent (SDS)</b> before encoding the appointment in the portal.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="secondary" 
                onClick={() => {
                  setShowSdsReminderModal(false);
                  setAppointConfirmApp(null);
                }}
                style={{ padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}
              >
                Not yet confirmed
              </button>
              <button 
                className="good" 
                onClick={() => {
                  setShowSdsReminderModal(false);
                  setShowAppointConfirmModal(true);
                }}
                style={{ padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}
              >
                Yes, Confirmed with SDS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM APPOINTMENT */}
      {showAppointConfirmModal && appointConfirmApp && (
        <div className="modal open" style={{ zIndex: 1000 }}>
          <div className="modal-box" style={{ width: 'min(620px, 94vw)' }}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Confirm Appointment — {appointConfirmApp.applicant}</h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p className="small" style={{ margin: 0 }}>
                You are about to appoint the following applicant. On confirmation, this applicant's status will become <b>FOR APPOINTMENT</b>, and the selected plantilla item will be filled.
              </p>
              <div className="qs-matrix-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '12px', backgroundColor: 'var(--blue-50)', borderRadius: '12px' }}>
                <div className="meta-tile"><b>Applicant</b><br/>{appointConfirmApp.applicant}</div>
                <div className="meta-tile"><b>Applicant number</b><br/>{appointConfirmApp.code}</div>
                <div className="meta-tile"><b>Position</b><br/>{appointConfirmApp.vacancy}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Plantilla Item Number</label>
                  {(() => {
                    const targetClusterId = appointConfirmApp.jobClusterId || appointConfirmApp.job_cluster_id;
                    const clusterVacancies = vacancies.filter(v => 
                      (targetClusterId && v.jobClusterId === targetClusterId) ||
                      (appointConfirmApp.positionId && v.positionId === appointConfirmApp.positionId) ||
                      (appointConfirmApp.vacancy && v.title === appointConfirmApp.vacancy)
                    );
                    const selectableList = clusterVacancies.filter(v => isItemSelectableForAppointment(v));
                    const disabledList = clusterVacancies.filter(v => !isItemSelectableForAppointment(v));

                    return (
                      <select
                        value={appointItemNo}
                        onChange={e => setAppointItemNo(e.target.value)}
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1.5px solid var(--line)',
                          boxSizing: 'border-box',
                          fontSize: '13px',
                          fontWeight: '600',
                          backgroundColor: '#F8FAFC',
                          color: 'var(--navy)'
                        }}
                      >
                        <option value="">-- Select Plantilla Item No. --</option>
                        {selectableList.length > 0 && (
                          <optgroup label="✅ Available for Appointment (Posting Closed)">
                            {selectableList.map(v => (
                              <option key={v.id} value={v.itemNo}>
                                {v.itemNo} — {v.school || v.division}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {disabledList.length > 0 && (
                          <optgroup label="🔒 Unavailable Item Numbers (Active Posting / Filled)">
                            {disabledList.map(v => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const start = parseDateNoTime(v.postingStart || v.posting_start);
                              const end = parseDateNoTime(v.postingEnd || v.posting_end);

                              let statusTag = 'Open Posting';
                              if (v.fillingUpStatus === 'FILLED' || v.filling_up_status === 'FILLED') {
                                statusTag = 'Filled';
                              } else if (!start || !end || today < start) {
                                statusTag = 'Not Yet Open';
                              }
                              return (
                                <option key={v.id} value={v.itemNo} disabled>
                                  {v.itemNo} — {v.school || v.division} ({statusTag})
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </select>
                    );
                  })()}
                  <p className="small" style={{ color: '#64748B', margin: '6px 0 0', fontSize: '11px' }}>
                    Note: Only closed item numbers with passed application deadlines are eligible for appointment. Active, unposted, and filled items are shown for reference.
                  </p>
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Appointment Date</label>
                  <input
                    type="date"
                    value={appointDate}
                    onChange={e => setAppointDate(e.target.value)}
                    style={{ width: '100%', height: '40px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--line)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Appointment Reference Code (Autogenerated)</label>
                  <input
                    type="text"
                    value={appointRefCode}
                    disabled
                    style={{ width: '100%', height: '40px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--line)', boxSizing: 'border-box', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Confirm with HRMO Passcode</label>
                  <input
                    type="password"
                    value={appointPasscode}
                    onChange={e => setAppointPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit passcode"
                    style={{ width: '100%', height: '40px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--line)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
            <div className="decision-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--line)', background: '#F8FAFC' }}>
              <button className="secondary" onClick={() => { setShowAppointConfirmModal(false); setAppointConfirmApp(null); }}>Cancel</button>
              <button className="good" onClick={() => {
                handleConfirmAppointment(appointConfirmApp.id, appointDate, appointPasscode, appointItemNo);
                setShowAppointConfirmModal(false);
                setAppointConfirmApp(null);
              }}>Confirm Appointment</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANNOT APPOINT YET */}
      {showIncompleteAppointModal && (
        <div className="modal open" style={{ zIndex: 1000 }}>
          <div className="modal-box" style={{ width: 'min(500px, 94vw)' }}>
            <div className="modal-head">
              <h3>Cannot Appoint Yet</h3>
              <p className="small">Complete scoring before appointment</p>
            </div>
            <div className="modal-body" style={{ margin: '14px 0' }}>
              <p className="small" style={{ marginBottom: '12px' }}>The applicant cannot be appointed until all required scores are available.</p>
              <p className="small" style={{ marginBottom: '12px' }}>Please complete and save the following scores first:</p>
              <ul className="small" style={{ fontWeight: 900, lineHeight: 1.8, marginTop: 0, paddingLeft: '20px' }}>
                <li>Average Score</li>
                <li>Behavioral Events Interview (BEI)</li>
                <li>Work Sample Test (WST)</li>
                <li>Written Examination (WE)</li>
              </ul>
              <div className="decision-row" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="secondary" onClick={() => setShowIncompleteAppointModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DOCUMENTS */}
      {showDocsModal && selectedQualApp && (
        <div className="modal open" style={{ zIndex: 100002 }}>
          <div className="modal-box" style={{ width: 'min(1100px, 98vw)' }}>
            <div className="modal-head">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                📂 Document Vault — {selectedQualApp.applicant}
              </h2>
              <button className="secondary" onClick={() => setShowDocsModal(false)}>Close Vault</button>
            </div>

            <div className="modal-body" style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
              {/* Document Checklist Sidebar */}
              <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', background: '#F8FAFC' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'white' }}>
                  <h4 style={{ margin: 0, color: 'var(--navy)', fontSize: '14px' }}>Document Checklist</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', background: 'white' }}>
                  {[
                    { key: 'pds', label: 'Personal Data Sheet', required: true },
                    { key: 'work_experience', label: 'Work Experience Sheet', required: true },
                    { key: 'eligibility', label: 'Certificate of Eligibility', required: true },
                    { key: 'tor', label: 'Transcript of Records', required: true },
                    { key: 'prc', label: 'Updated PRC License/ID', required: true },
                    { key: 'diploma', label: 'Diploma (optional)', required: false },
                    { key: 'resume', label: 'Resume', required: true },
                    { key: 'performance_rating', label: 'Performance Rating', required: false },
                    { key: 'training_certificates', label: 'Training Certificates', required: false },
                    { key: 'application_education', label: 'Application of Education', required: false },
                    { key: 'application_learning', label: 'Application of Learning and Development', required: false }
                  ].map((doc) => {
                    const isSelected = selectedDocKey === doc.key;
                    const isUploaded = availableDocs.find(d => d.key === doc.key)?.existsInAzure;
                    return (
                      <div
                        key={doc.key}
                        onClick={() => setSelectedDocKey(doc.key)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--blue-50)' : 'white',
                          borderLeft: isSelected ? '4px solid var(--blue-600)' : '4px solid transparent',
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: isSelected ? 'var(--blue-800)' : 'var(--navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {doc.label} {doc.required && <span style={{ color: '#EF4444' }}>*</span>} {isUploaded ? '✓' : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: isSelected ? 'var(--blue-600)' : '#64748B' }}>
                          {isUploaded ? 'View Uploaded Document' : 'No document uploaded'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Document Preview Pane */}
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
                      selectedDocKey === 'diploma' ? 'Diploma' :
                      selectedDocKey === 'resume' ? 'Resume' :
                      selectedDocKey === 'performance_rating' ? 'Performance Rating' :
                      selectedDocKey === 'training_certificates' ? 'Training Certificates' :
                      selectedDocKey === 'application_education' ? 'Application of Education' :
                      selectedDocKey === 'application_learning' ? 'Application of Learning and Development' : ''
                    }
                  </b>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Page 1 of 1</span>
                </div>
                {(() => {
                  if (docsLoading) {
                    return (
                      <div style={{
                        backgroundColor: '#f8fafc',
                        minHeight: '400px',
                        maxHeight: '550px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        color: '#64748B',
                        padding: '40px',
                        boxSizing: 'border-box'
                      }}>
                        <style>{`
                          @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                          }
                        `}</style>
                        <div style={{
                          border: '4px solid #e2e8f0',
                          borderTop: '4px solid var(--blue)',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <b style={{ fontSize: '14px' }}>Loading Documents...</b>
                        <span style={{ fontSize: '12px' }}>Checking file attachments</span>
                      </div>
                    );
                  }
                  const selectedDocInfo = availableDocs.find(d => d.key === selectedDocKey);
                  const existsInAzure = !!selectedDocInfo?.existsInAzure;
                  const isPdf = !!selectedDocInfo?.filename?.toLowerCase().endsWith('.pdf');
                  return (
                    <div style={{
                      padding: (existsInAzure && isPdf) ? '0' : '24px',
                      backgroundColor: '#f8fafc',
                      minHeight: '400px',
                      maxHeight: '550px',
                      overflowY: (existsInAzure && isPdf) ? 'hidden' : 'auto',
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%',
                      alignItems: 'stretch'
                    }}>
                      {existsInAzure ? (
                        isPdf ? (
                          <iframe
                            src={`${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${selectedQualApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}&dpi=98`}
                            style={{ width: '100%', height: '550px', border: 'none', borderRadius: '0 0 12px 12px' }}
                            title="Azure Document Viewer"
                          />
                        ) : (
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'white', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 'bold' }}>
                                Previewing Spreadsheet: {selectedDocInfo?.filename}
                              </span>
                              <a
                                href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${selectedQualApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '12px', color: 'var(--blue-600)', textDecoration: 'underline', fontWeight: 'bold' }}
                              >
                                Download Original
                              </a>
                            </div>
                            <div style={{ overflow: 'auto', padding: '16px', boxSizing: 'border-box', maxHeight: '480px' }}>
                              {csvLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '8px', color: '#64748B' }}>
                                  <span style={{ fontSize: '13px' }}>Loading sheet data...</span>
                                </div>
                              ) : csvError ? (
                                <div style={{ color: '#EF4444', padding: '16px', textAlign: 'center', fontSize: '13px' }}>
                                  Failed to load data: {csvError}
                                </div>
                              ) : csvData ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', fontFamily: 'sans-serif' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                      {csvData[0]?.map((cell, idx) => (
                                        <th key={idx} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                          {cell}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {csvData.slice(1).map((row, rowIdx) => (
                                      <tr key={rowIdx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: rowIdx % 2 === 0 ? 'white' : '#f8fafc' }}>
                                        {row.map((cell, cellIdx) => (
                                          <td key={cellIdx} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', color: '#334155', whiteSpace: 'nowrap' }}>
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ color: '#64748B', textAlign: 'center', padding: '20px' }}>No data to display.</div>
                              )}
                            </div>
                          </div>
                        )
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '40px', backgroundColor: '#f8fafc', width: '100%', boxSizing: 'border-box' }}>
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
          </div>
        </div>
      )}
    </section>
  );
}
