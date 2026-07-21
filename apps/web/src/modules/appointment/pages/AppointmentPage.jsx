import React, { useState, useMemo, useEffect } from 'react';
import { useAppData } from '../../../middleware/DataProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { apiFetch } from '../../../config/api.js';
import VacancyClusterAccordion from '../../../components/VacancyClusterAccordion.jsx';

export default function AppointmentPage() {
  const { vacancies, applications, loadAllData } = useAppData();
  const { setToast } = useToast();

  const [apptSearch, setApptSearch] = useState('');
  const [apptColFilters, setApptColFilters] = useState({});
  const [apptSortKey, setApptSortKey] = useState('');
  const [apptSortDir, setApptSortDir] = useState('asc');
  const [apptPage, setApptPage] = useState(1);
  const [apptPageSize, setAppPageSize] = useState(10);

  const [rollbackApp, setRollbackApp] = useState(null);
  const [rollbackPasscode, setRollbackPasscode] = useState('');
  const [showRollbackConfirmModal, setShowRollbackConfirmModal] = useState(false);

  const [confirmApp, setConfirmApp] = useState(null);
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // View Documents state
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedDocApp, setSelectedDocApp] = useState(null);
  const [selectedDocKey, setSelectedDocKey] = useState('pds');
  const [availableDocs, setAvailableDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // CSV viewer state
  const [csvData, setCsvData] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);

  useEffect(() => {
    if (selectedDocApp?.id) {
      setAvailableDocs([]);
      setDocsLoading(true);
      apiFetch(`/api/applications/${selectedDocApp.id}/documents`)
        .then(data => {
          setAvailableDocs(data.documents || []);
        })
        .catch(err => {
          console.error('[Azure Storage Fetch ERROR] Failed to fetch documents:', err);
          setAvailableDocs([]);
        })
        .finally(() => setDocsLoading(false));
    }
  }, [selectedDocApp]);

  useEffect(() => {
    const selectedDocInfo = availableDocs.find(d => d.key === selectedDocKey);
    const existsInAzure = !!selectedDocInfo?.existsInAzure;
    const isPdf = !!selectedDocInfo?.filename?.toLowerCase().endsWith('.pdf');

    if (existsInAzure && !isPdf && selectedDocApp?.id) {
      setCsvLoading(true);
      setCsvError(null);
      setCsvData(null);

      const apiBaseUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const downloadUrl = `${apiBaseUrl}/api/applications/${selectedDocApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}`;
      
      fetch(downloadUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Status ${res.status}`);
          return res.text();
        })
        .then(text => {
          const rows = [];
          let currentRow = [];
          let currentField = '';
          let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
               currentRow.push(currentField);
               currentField = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
               if (char === '\r' && nextChar === '\n') i++;
               currentRow.push(currentField);
               rows.push(currentRow);
               currentRow = [];
               currentField = '';
            } else {
               currentField += char;
            }
          }
          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField);
            rows.push(currentRow);
          }
          setCsvData(rows);
        })
        .catch(err => {
          console.error('[CSV Fetch ERROR]', err);
          setCsvError(err.message);
        })
        .finally(() => setCsvLoading(false));
    }
  }, [selectedDocKey, availableDocs, selectedDocApp]);

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

  const getApptColumnValue = (row, key) => {
    if (key === 'rank') return row.rank || '';
    if (key === 'applicant') return row.applicant || '';
    if (key === 'vacancy') return row.vacancy || '';
    if (key === 'itemNo') return row.itemNo || '';
    if (key === 'fit') return row.fit || 0;
    if (key === 'appointmentStatus') return row.appointmentStatus || '';
    if (key === 'appointmentDate') return row.appointmentDate ? row.appointmentDate.slice(0, 10) : '';
    return '';
  };

  const occupiedItemNos = useMemo(() => {
    return new Set(
      applications
        .filter(a => a.appointmentStatus === 'FOR APPOINTMENT' || a.appointmentStatus === 'appointed')
        .map(a => a.itemNo)
        .filter(Boolean)
    );
  }, [applications]);

  const allAppointments = useMemo(() => {
    return applications.filter(app => app.appointmentStatus === 'FOR APPOINTMENT' || app.appointmentStatus === 'appointed');
  }, [applications]);

  const filteredAppointments = useMemo(() => {
    let list = allAppointments;

    Object.entries(apptColFilters).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') return;

      if (key === 'fit') {
        if (val.min !== undefined && val.min !== '') {
          list = list.filter(r => r.fit >= Number(val.min));
        }
        if (val.max !== undefined && val.max !== '') {
          list = list.filter(r => r.fit <= Number(val.max));
        }
      } else {
        list = list.filter(r => {
          const cellVal = getApptColumnValue(r, key);
          return String(cellVal).toLowerCase().includes(String(val).toLowerCase());
        });
      }
    });

    if (apptSortKey) {
      const dir = apptSortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = getApptColumnValue(a, apptSortKey);
        const bv = getApptColumnValue(b, apptSortKey);
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    return list;
  }, [allAppointments, apptColFilters, apptSortKey, apptSortDir]);

  const paginatedAppointments = useMemo(() => {
    const start = (apptPage - 1) * apptPageSize;
    return filteredAppointments.slice(start, start + apptPageSize);
  }, [filteredAppointments, apptPage, apptPageSize]);

  const handleDownloadNoticeOfAppointment = (app) => {
    const date = app.appointmentDate ? new Date(app.appointmentDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const content = `DEPARTMENT OF EDUCATION
SDO Manila, Region NCR
____________________________________________________

NOTICE OF APPOINTMENT

Date: ${date}

MR./MS. ${app.applicant.toUpperCase()}
Manila, Philippines

Dear Mr./Ms. ${app.applicant}:

You are hereby informed that the Schools Division Superintendent has approved your appointment as ${app.vacancy} under Item No. ${app.itemNo || 'N/A'}, with a Salary Grade of SG-${app.salaryGrade || app.appObj?.salaryGrade || 'N/A'}, effective on your date of assumption to duty.

This appointment is subject to the usual civil service rules and regulations.

Appointment Reference Code: ${app.appointmentReferenceCode || app.appObj?.appointmentReferenceCode || 'N/A'}

Very truly yours,

SCHOOLS DIVISION SUPERINTENDENT
SDO Manila, Department of Education
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Notice_of_Appointment_${app.applicant.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRollbackAppointment = async (app, passcode) => {
    if (!passcode) {
      return setToast({ message: 'HRMO passcode is required.', type: 'error' });
    }
    try {
      await apiFetch(`/api/applications/${app.id}/rollback-appointment`, {
        method: 'POST',
        body: JSON.stringify({ passcode })
      });
      setToast({ message: 'Appointment rolled back successfully!', type: 'success' });
      setShowRollbackConfirmModal(false);
      setRollbackApp(null);
      setRollbackPasscode('');
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleConfirmAppointmentFinal = async (app, passcode) => {
    if (!passcode) {
      return setToast({ message: 'HRMO passcode is required', type: 'error' });
    }
    try {
      await apiFetch(`/api/applications/${app.id}/appointment`, {
        method: 'POST',
        body: JSON.stringify({ passcode })
      });
      setToast({ message: 'Appointment officially confirmed!', type: 'success' });
      setShowConfirmModal(false);
      setConfirmApp(null);
      setConfirmPasscode('');
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const appointmentKpiStats = useMemo(() => {
    const totalItems = vacancies.length;
    const filledItemNos = new Set(
      applications
        .filter(a => a.appointmentStatus === 'FOR APPOINTMENT' || a.appointmentStatus === 'appointed')
        .map(a => a.itemNo)
        .filter(Boolean)
    );
    const totalFilled = filledItemNos.size;
    const totalVacancies = Math.max(0, totalItems - totalFilled);
    return { totalItems, totalFilled, totalVacancies };
  }, [vacancies, applications]);

  const handleExportAppointed = () => {
    const headers = ["No.", "Applicant", "Applicant Number", "Position", "Item No.", "Average Score", "Appointment Status", "Date"];
    const rows = filteredAppointments.map((r, i) => [
      i + 1,
      r.applicant,
      r.code,
      r.vacancy,
      r.itemNo,
      r.fit.toFixed(2),
      r.appointmentStatus === 'FOR APPOINTMENT' ? 'For Appointment' : r.appointmentStatus === 'appointed' ? 'Appointed' : 'Rejected',
      r.appointmentDate ? r.appointmentDate.slice(0, 10) : ''
    ]);
    downloadCSV(headers, rows, `appointed-applicants-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleApptSort = (key) => {
    if (apptSortKey === key) {
      setApptSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setApptSortKey(key);
      setApptSortDir('asc');
    }
  };

  return (
    <section className="view active">
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Total Items</div>
          <div className="kpi-number">{appointmentKpiStats.totalItems}</div>
          <div className="kpi-caption">All plantilla items</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Filled</div>
          <div className="kpi-number">{appointmentKpiStats.totalFilled}</div>
          <div className="kpi-caption">Items with appointed applicants</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Vacancies</div>
          <div className="kpi-number">{appointmentKpiStats.totalVacancies}</div>
          <div className="kpi-caption">Items still vacant</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Appointed Applicants</h2>
            <p className="small" style={{ margin: '4px 0 0' }}>Confirmed appointments for occupied items.</p>
          </div>
          <button className="primary" onClick={handleExportAppointed} style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>
            Download Appointed List
          </button>
        </div>
        <div className="table-wrap" style={{ width: '100%' }}>
          <table className="appointments-table" style={{ width: '100%', minWidth: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="row-num">No.</th>
                <th>
                  <button className="th-btn" onClick={() => handleApptSort('applicant')}>
                    Applicant {apptSortKey === 'applicant' ? (apptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={apptColFilters.applicant || ''}
                    onChange={e => { setApptColFilters({ ...apptColFilters, applicant: e.target.value }); setApptPage(1); }}
                  />
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleApptSort('vacancy')}>
                    Position {apptSortKey === 'vacancy' ? (apptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <select
                    className="column-filter"
                    value={apptColFilters.vacancy || ''}
                    onChange={e => { setApptColFilters({ ...apptColFilters, vacancy: e.target.value }); setApptPage(1); }}
                  >
                    <option value="">All</option>
                    {Array.from(new Set(allAppointments.map(a => a.vacancy))).map(vac => (
                      <option key={vac} value={vac}>{vac}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleApptSort('itemNo')}>
                    Item No. {apptSortKey === 'itemNo' ? (apptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={apptColFilters.itemNo || ''}
                    onChange={e => { setApptColFilters({ ...apptColFilters, itemNo: e.target.value }); setApptPage(1); }}
                  />
                </th>
                <th className="num-col">
                  <button className="th-btn" onClick={() => handleApptSort('fit')}>
                    Average Score {apptSortKey === 'fit' ? (apptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <div className="column-filter-range" style={{ display: 'flex', gap: '4px' }}>
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Min"
                      value={apptColFilters.fit?.min || ''}
                      onChange={e => {
                        const curr = apptColFilters.fit || {};
                        setApptColFilters({ ...apptColFilters, fit: { ...curr, min: e.target.value } });
                        setApptPage(1);
                      }}
                      style={{ width: '50%' }}
                    />
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Max"
                      value={apptColFilters.fit?.max || ''}
                      onChange={e => {
                        const curr = apptColFilters.fit || {};
                        setApptColFilters({ ...apptColFilters, fit: { ...curr, max: e.target.value } });
                        setApptPage(1);
                      }}
                      style={{ width: '50%' }}
                    />
                  </div>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleApptSort('appointmentStatus')}>
                    Appointment Status {apptSortKey === 'appointmentStatus' ? (apptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <select
                    className="column-filter"
                    value={apptColFilters.appointmentStatus || ''}
                    onChange={e => { setApptColFilters({ ...apptColFilters, appointmentStatus: e.target.value }); setApptPage(1); }}
                  >
                    <option value="">All</option>
                    <option value="FOR APPOINTMENT">For Appointment</option>
                    <option value="appointed">Appointed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleApptSort('appointmentDate')}>
                    Date {apptSortKey === 'appointmentDate' ? (apptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={apptColFilters.appointmentDate || ''}
                    onChange={e => { setApptColFilters({ ...apptColFilters, appointmentDate: e.target.value }); setApptPage(1); }}
                  />
                </th>
                <th style={{ width: '280px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const grouped = {};
                paginatedAppointments.forEach(r => {
                  const title = r.vacancy || 'Unassigned';
                  if (!grouped[title]) grouped[title] = [];
                  grouped[title].push(r);
                });
                if (paginatedAppointments.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center' }}>No records match the filters.</td>
                    </tr>
                  );
                }
                return Object.entries(grouped).map(([clusterName, items]) => (
                  <VacancyClusterAccordion key={clusterName} title={clusterName} colSpan={8}>
                    {items.map((r, i) => {
                      const isConfirmed = r.appointmentStatus === 'appointed';
                      const isFlagged = r.appointmentStatus === 'FOR APPOINTMENT';
                      const score = r.fit;
                      const hasDocs = r.documents && Object.keys(r.documents).length > 0;
                      return (
                        <tr key={r.id}>
                          <td className="row-num">{(apptPage - 1) * apptPageSize + i + 1}</td>
                          <td><b>{r.applicant}</b><br/><span className="small">{r.code}</span></td>
                          <td>{r.vacancy}</td>
                          <td>{r.itemNo}</td>
                          <td className="num-col">
                            {score && score > 0 ? (
                              <span className={`badge ${score >= 85 ? 'green' : score >= 70 ? 'blue' : score >= 50 ? 'orange' : 'red'}`}>
                                {score.toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            <span className={`badge ${isConfirmed ? 'green' : isFlagged ? 'orange' : 'red'}`}>
                              {isConfirmed ? 'Appointed' : isFlagged ? 'For Appointment' : 'Rejected'}
                            </span>
                          </td>
                          <td><span className="small">{r.appointmentDate ? r.appointmentDate.slice(0, 10) : ''}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                className="secondary"
                                onClick={() => {
                                  setSelectedDocApp(r);
                                  setSelectedDocKey('pds');
                                  setShowDocsModal(true);
                                }}
                                disabled={!hasDocs}
                                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: hasDocs ? 'pointer' : 'not-allowed', opacity: hasDocs ? 1 : 0.5 }}
                              >
                                View documents
                              </button>
                              {isFlagged && (
                                <button
                                  className="good"
                                  onClick={() => {
                                    setConfirmApp(r);
                                    setConfirmPasscode('');
                                    setShowConfirmModal(true);
                                  }}
                                  style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', fontWeight: 'bold' }}
                                >
                                  Confirm
                                </button>
                              )}
                              {isConfirmed && (
                                <button
                                  className="good"
                                  onClick={() => handleDownloadNoticeOfAppointment(r)}
                                  style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', fontWeight: 'bold' }}
                                >
                                  Notice of Appointment
                                </button>
                              )}
                              <button
                                className="danger"
                                onClick={() => {
                                  setRollbackApp(r);
                                  setRollbackPasscode('');
                                  setShowRollbackConfirmModal(true);
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: '0', fontSize: '18px', borderRadius: '8px', fontWeight: 'bold' }}
                                title="Withdraw Appointment"
                              >
                                ↺
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </VacancyClusterAccordion>
                ));
              })()}
            </tbody>
          </table>
        </div>

        <div className="pager-controls" style={{ marginTop: '16px' }}>
          <div className="pager-group">
            <button className="secondary" onClick={() => setApptPage(p => Math.max(1, p - 1))} disabled={apptPage === 1}>Prev</button>
            <span className="small">Page {apptPage} of {Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize))} · {filteredAppointments.length} record(s)</span>
            <button className="secondary" onClick={() => setApptPage(p => Math.min(Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize)), p + 1))} disabled={apptPage === Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize))}>Next</button>
          </div>
          <div className="pager-group">
            <div className="pager-field">
              <label>Rows</label>
              <select value={apptPageSize} onChange={e => { setAppPageSize(Number(e.target.value)); setApptPage(1); }}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="pager-field">
              <label>Go to page</label>
              <select value={apptPage} onChange={e => setApptPage(Number(e.target.value))}>
                {Array.from({ length: Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize)) }, (_, idx) => (
                  <option key={idx + 1} value={idx + 1}>Page {idx + 1}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ROLLBACK APPOINTMENT CONFIRMATION */}
      {showRollbackConfirmModal && rollbackApp && (
        <div className="modal open" style={{ zIndex: 1000 }}>
          <div className="modal-box" style={{ width: 'min(500px, 94vw)' }}>
            <div className="modal-head">
              <h3>Withdraw Appointment — {rollbackApp.applicant}</h3>
            </div>
            <div style={{ padding: '0 20px' }}>
              <p className="small" style={{ marginTop: '8px' }}>
                You are about to withdraw the appointment for <b>{rollbackApp.applicant}</b>. This will return the applicant and all other candidates for the item number (<b>{rollbackApp.itemNo || '—'}</b>) back to the comparative assessment pool, restoring their assessment states and scores.
              </p>
            </div>
            <div className="modal-body" style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Confirm with HRMO Passcode</label>
                  <input
                    type="password"
                    value={rollbackPasscode}
                    onChange={e => setRollbackPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit passcode"
                    style={{ width: '100%', height: '40px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--line)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
            <div className="decision-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="secondary" onClick={() => { setShowRollbackConfirmModal(false); setRollbackApp(null); setRollbackPasscode(''); }}>Cancel</button>
              <button 
                className="good" 
                onClick={() => handleRollbackAppointment(rollbackApp, rollbackPasscode)}
              >
                Withdraw Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM APPOINTMENT FINAL */}
      {showConfirmModal && confirmApp && (
        <div className="modal open" style={{ zIndex: 1000 }}>
          <div className="modal-box" style={{ width: 'min(500px, 94vw)' }}>
            <div className="modal-head">
              <h3>Confirm Appointment — {confirmApp.applicant}</h3>
            </div>
            <div style={{ padding: '0 20px' }}>
              <p className="small" style={{ marginTop: '8px' }}>
                Confirm the official appointment of <b>{confirmApp.applicant}</b> under item <b>{confirmApp.itemNo || '—'}</b>.
              </p>
            </div>
            <div className="modal-body" style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>HRMO Passcode</label>
                  <input
                    type="password"
                    value={confirmPasscode}
                    onChange={e => setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit passcode"
                    style={{ width: '100%', height: '40px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--line)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
            <div className="decision-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="secondary" onClick={() => { setShowConfirmModal(false); setConfirmApp(null); setConfirmPasscode(''); }}>Cancel</button>
              <button 
                className="good" 
                onClick={() => handleConfirmAppointmentFinal(confirmApp, confirmPasscode)}
              >
                Confirm Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DOCUMENTS */}
      {showDocsModal && selectedDocApp && (
        <div className="modal open" style={{ zIndex: 100002 }}>
          <div className="modal-box" style={{ padding: '0 24px 24px', maxHeight: '92vh', overflow: 'auto', width: 'min(1100px, 98vw)' }}>
            <div className="modal-head" style={{
              paddingTop: '24px',
              paddingBottom: '12px',
              background: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--line)'
            }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                📂 Document Vault — {selectedDocApp.applicant}
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
                            src={`${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${selectedDocApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}&dpi=98`}
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
                                href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${selectedDocApp.id}/documents/${selectedDocKey}/download?token=${localStorage.getItem('agap_token')}`}
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
                              ) : null}
                            </div>
                          </div>
                        )
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748B', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>No Preview Available</span>
                          <span style={{ fontSize: '12px' }}>Please select another document from the checklist</span>
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
