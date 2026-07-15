import React, { useState, useMemo } from 'react';
import { useAppData } from '../../../middleware/DataProvider.jsx';

export default function AppointmentPage() {
  const { vacancies, applications } = useAppData();

  const [apptSearch, setApptSearch] = useState('');
  const [apptColFilters, setApptColFilters] = useState({});
  const [apptSortKey, setApptSortKey] = useState('');
  const [apptSortDir, setApptSortDir] = useState('asc');
  const [apptPage, setApptPage] = useState(1);
  const [apptPageSize, setAppPageSize] = useState(10);

  const [unapptColFilters, setUnapptColFilters] = useState({});
  const [unapptSortKey, setUnapptSortKey] = useState('');
  const [unapptSortDir, setUnapptSortDir] = useState('asc');
  const [unapptPage, setUnapptPage] = useState(1);
  const [unapptPageSize, setUnapptPageSize] = useState(10);

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
        .filter(a => a.appointmentStatus === 'appointed')
        .map(a => a.itemNo)
        .filter(Boolean)
    );
  }, [applications]);

  const allAppointments = useMemo(() => {
    return applications.filter(app => app.appointmentStatus === 'appointed');
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

  const unappointedApps = useMemo(() => {
    let list = applications.filter(app => {
      if (app.appointmentStatus === 'appointed') return false;
      
      const statusLower = (app.applicationStatus || app.status || '').toLowerCase();
      const isQualified = ['qualified', 'for_comparative_assessment', 'not_appointed'].includes(statusLower);
      
      const isAssessmentCompleted = (app.assessmentStatus || '').toLowerCase() === 'assessment completed';
      
      return isQualified && isAssessmentCompleted;
    });

    if (unapptColFilters.applicant) {
      const q = unapptColFilters.applicant.toLowerCase();
      list = list.filter(r => r.applicant?.toLowerCase().includes(q));
    }
    if (unapptColFilters.vacancy) {
      list = list.filter(r => r.vacancy === unapptColFilters.vacancy);
    }
    if (unapptColFilters.itemNo) {
      const q = unapptColFilters.itemNo.toLowerCase();
      list = list.filter(r => r.itemNo?.toLowerCase().includes(q));
    }
    if (unapptColFilters.fit?.min) {
      list = list.filter(r => r.fit >= Number(unapptColFilters.fit.min));
    }
    if (unapptColFilters.fit?.max) {
      list = list.filter(r => r.fit <= Number(unapptColFilters.fit.max));
    }
    if (unapptColFilters.appointmentStatus) {
      const q = unapptColFilters.appointmentStatus.toLowerCase();
      list = list.filter(r => (r.appointmentStatus || '').toLowerCase().includes(q));
    }
    if (unapptColFilters.appointmentDate) {
      const q = unapptColFilters.appointmentDate.toLowerCase();
      list = list.filter(r => (r.appointmentDate ? r.appointmentDate.slice(0, 10) : '').toLowerCase().includes(q));
    }

    if (unapptSortKey) {
      const dir = unapptSortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        let av = a[unapptSortKey] ?? '';
        let bv = b[unapptSortKey] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    return list;
  }, [applications, occupiedItemNos, unapptColFilters, unapptSortKey, unapptSortDir]);

  const paginatedUnappointedApps = useMemo(() => {
    const start = (unapptPage - 1) * unapptPageSize;
    return unappointedApps.slice(start, start + unapptPageSize);
  }, [unappointedApps, unapptPage, unapptPageSize]);

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

  const appointmentKpiStats = useMemo(() => {
    const totalItems = vacancies.length;
    const filledItemNos = new Set(
      applications
        .filter(a => a.appointmentStatus === 'appointed')
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
      r.appointmentStatus === 'appointed' ? 'Appointed' : 'Rejected',
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

  const handleUnapptSort = (key) => {
    if (unapptSortKey === key) {
      setUnapptSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setUnapptSortKey(key);
      setUnapptSortDir('asc');
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
        <div className="table-wrap">
          <table className="appointments-table">
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAppointments.map((r, i) => {
                const isAppointed = r.appointmentStatus === 'appointed';
                const score = r.fit;
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
                      <span className={`badge ${isAppointed ? 'green' : 'red'}`}>
                        {isAppointed ? 'Appointed' : 'Rejected'}
                      </span>
                    </td>
                    <td><span className="small">{r.appointmentDate ? r.appointmentDate.slice(0, 10) : ''}</span></td>
                    <td>
                      {isAppointed ? (
                        <button
                          className="good"
                          onClick={() => handleDownloadNoticeOfAppointment(r)}
                          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}
                        >
                          Notice of Appointment
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              {paginatedAppointments.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center' }}>No records match the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager-controls" style={{ marginTop: '16px' }}>
          <div className="pager-group">
            <button className="secondary" onClick={() => setAppPage(p => Math.max(1, p - 1))} disabled={apptPage === 1}>Prev</button>
            <span className="small">Page {apptPage} of {Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize))} · {filteredAppointments.length} record(s)</span>
            <button className="secondary" onClick={() => setAppPage(p => Math.min(Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize)), p + 1))} disabled={apptPage === Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize))}>Next</button>
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

      <div className="card" style={{ marginTop: '20px' }}>
        <h2>Unappointed Qualified Applicants</h2>
        <p className="small" style={{ marginBottom: '14px' }}>Confirm appointments or view status of other qualified candidates.</p>
        <div className="table-wrap">
          <table className="unappointed-table">
            <thead>
              <tr>
                <th className="row-num">No.</th>
                <th>
                  <button className="th-btn" onClick={() => handleUnapptSort('applicant')}>
                    Applicant {unapptSortKey === 'applicant' ? (unapptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={unapptColFilters.applicant || ''}
                    onChange={e => { setUnapptColFilters({ ...unapptColFilters, applicant: e.target.value }); setUnapptPage(1); }}
                  />
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleUnapptSort('vacancy')}>
                    Position {unapptSortKey === 'vacancy' ? (unapptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <select
                    className="column-filter"
                    value={unapptColFilters.vacancy || ''}
                    onChange={e => { setUnapptColFilters({ ...unapptColFilters, vacancy: e.target.value }); setUnapptPage(1); }}
                  >
                    <option value="">All</option>
                    {Array.from(new Set(applications.filter(a => {
                      if (a.status !== 'not_appointed' && a.appointmentStatus !== 'not_appointed') return false;
                      const cs = a.appObj?.comparativeAssessmentScores || {};
                      return ['bei', 'wst', 'we'].every(k => cs[k] !== '' && cs[k] !== null && cs[k] !== undefined && Number.isFinite(Number(cs[k])));
                    }).map(a => a.vacancy))).map(vac => (
                      <option key={vac} value={vac}>{vac}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleUnapptSort('itemNo')}>
                    Item No. {unapptSortKey === 'itemNo' ? (unapptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={unapptColFilters.itemNo || ''}
                    onChange={e => { setUnapptColFilters({ ...unapptColFilters, itemNo: e.target.value }); setUnapptPage(1); }}
                  />
                </th>
                <th className="num-col">
                  <button className="th-btn" onClick={() => handleUnapptSort('fit')}>
                    Average Score {unapptSortKey === 'fit' ? (unapptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <div className="column-filter-range" style={{ display: 'flex', gap: '4px' }}>
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Min"
                      value={unapptColFilters.fit?.min || ''}
                      onChange={e => {
                        const curr = unapptColFilters.fit || {};
                        setUnapptColFilters({ ...unapptColFilters, fit: { ...curr, min: e.target.value } });
                        setUnapptPage(1);
                      }}
                      style={{ width: '50%' }}
                    />
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Max"
                      value={unapptColFilters.fit?.max || ''}
                      onChange={e => {
                        const curr = unapptColFilters.fit || {};
                        setUnapptColFilters({ ...unapptColFilters, fit: { ...curr, max: e.target.value } });
                        setUnapptPage(1);
                      }}
                      style={{ width: '50%' }}
                    />
                  </div>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleUnapptSort('appointmentStatus')}>
                    Appointment Status {unapptSortKey === 'appointmentStatus' ? (unapptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <select
                    className="column-filter"
                    value={unapptColFilters.appointmentStatus || ''}
                    onChange={e => { setUnapptColFilters({ ...unapptColFilters, appointmentStatus: e.target.value }); setUnapptPage(1); }}
                  >
                    <option value="">All</option>
                    <option value="not_appointed">Not Appointed</option>
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleUnapptSort('appointmentDate')}>
                    Date {unapptSortKey === 'appointmentDate' ? (unapptSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <input
                    className="column-filter"
                    placeholder="Filter..."
                    value={unapptColFilters.appointmentDate || ''}
                    onChange={e => { setUnapptColFilters({ ...unapptColFilters, appointmentDate: e.target.value }); setUnapptPage(1); }}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedUnappointedApps.map((r, i) => {
                return (
                  <tr key={r.id}>
                    <td className="row-num">{(unapptPage - 1) * unapptPageSize + i + 1}</td>
                    <td><b>{r.applicant}</b></td>
                    <td>{r.vacancy}</td>
                    <td>{r.itemNo || '—'}</td>
                    <td className="num-col">
                      <span className={`badge ${r.fit >= 85 ? 'green' : r.fit >= 70 ? 'blue' : r.fit >= 50 ? 'orange' : 'red'}`}>
                        {r.fit.toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <span className="badge orange">Not Appointed</span>
                    </td>
                    <td>
                      <span className="small">{r.appointmentDate ? r.appointmentDate.slice(0, 10) : '—'}</span>
                    </td>
                  </tr>
                );
              })}
              {paginatedUnappointedApps.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center' }}>No unappointed applicants match the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager-controls" style={{ marginTop: '14px' }}>
          <div className="pager-group">
            <button className="secondary" onClick={() => setUnapptPage(p => Math.max(1, p - 1))} disabled={unapptPage === 1}>Prev</button>
            <span className="small">Page {unapptPage} of {Math.max(1, Math.ceil(unappointedApps.length / unapptPageSize))} · {unappointedApps.length} records</span>
            <button className="secondary" onClick={() => setUnapptPage(p => Math.min(Math.max(1, Math.ceil(unappointedApps.length / unapptPageSize)), p + 1))} disabled={unapptPage >= Math.max(1, Math.ceil(unappointedApps.length / unapptPageSize))}>Next</button>
          </div>
          <div className="pager-group">
            <div className="pager-field">
              <label>Rows</label>
              <select value={unapptPageSize} onChange={e => { setUnapptPageSize(Number(e.target.value)); setUnapptPage(1); }}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="pager-field">
              <label>Go to page</label>
              <select value={unapptPage} onChange={e => setUnapptPage(Number(e.target.value))}>
                {Array.from({ length: Math.max(1, Math.ceil(unappointedApps.length / unapptPageSize)) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
