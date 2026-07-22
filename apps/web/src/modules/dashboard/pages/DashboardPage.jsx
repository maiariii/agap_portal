import React, { useState, useMemo } from 'react';
import { useAppData } from '../../../middleware/DataProvider.jsx';

const matchStatus = (appStatus, filterStatus) => {
  if (!filterStatus) return true;
  const appStatusLower = (appStatus || '').toLowerCase();
  const filterStatusLower = filterStatus.toLowerCase();
  
  if (filterStatusLower === 'qualified') {
    return appStatusLower === 'qualified' || appStatusLower === 'for_comparative_assessment';
  }
  return appStatusLower === filterStatusLower;
};

export default function DashboardPage() {
  const { positions, vacancies, applications } = useAppData();

  const [homeFilters, setHomeFilters] = useState({
    positionId: '',
    status: '',
    itemStatus: '',
    assessmentStatus: '',
    postingStatus: ''
  });
  const [homeAdvanced, setHomeAdvanced] = useState(false);
  const [homeDistributionBy, setHomeDistributionBy] = useState('item_status');
  const [homeMeasure, setHomeMeasure] = useState('count');
  const [homeSortBy, setHomeSortBy] = useState('total');
  const [homeDetailColFilters, setHomeDetailColFilters] = useState({});
  const [homeDetailPage, setHomeDetailPage] = useState(1);
  const [homeDetailPageSize, setHomeDetailPageSize] = useState(10);

  const cls = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
  };

  const titleCase = (str) => {
    if (!str) return '';
    return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Filter application rows for the dashboard/charts
  const dashboardRows = useMemo(() => {
    return applications.filter(app => {
      if (homeFilters.positionId && app.vacancyObj.positionId !== homeFilters.positionId) return false;
      if (homeFilters.status && !matchStatus(app.status, homeFilters.status)) return false;
      const isFilled = app.appointmentStatus?.toLowerCase() === 'appointed' || app.appointmentStatus?.toUpperCase() === 'FOR APPOINTMENT' || app.vacancyObj?.fillingUpStatus?.toUpperCase() === 'FILLED';
      const itemStatusVal = isFilled ? 'filled' : 'unfilled';
      if (homeFilters.itemStatus && itemStatusVal !== homeFilters.itemStatus) return false;
      if (homeFilters.assessmentStatus) {
        const statusVal = app.assessmentStatus || 'marked_qualified';
        if (statusVal.toLowerCase() !== homeFilters.assessmentStatus.toLowerCase()) return false;
      }
      if (homeFilters.postingStatus && app.vacancyObj?.status?.toLowerCase() !== homeFilters.postingStatus.toLowerCase()) return false;
      return true;
    });
  }, [applications, homeFilters]);

  // Filtered vacancies for the dashboard
  const dashboardVacancies = useMemo(() => {
    return vacancies.filter(v => {
      if (homeFilters.positionId && v.positionId !== homeFilters.positionId) return false;
      const isFilled = v.fillingUpStatus?.toUpperCase() === 'FILLED';
      const itemStatusVal = isFilled ? 'filled' : 'unfilled';
      if (homeFilters.itemStatus && itemStatusVal !== homeFilters.itemStatus) return false;
      if (homeFilters.postingStatus && v.status?.toLowerCase() !== homeFilters.postingStatus.toLowerCase()) return false;
      if (homeFilters.status && !applications.some(a => a.vacancyId === v.jobClusterId && matchStatus(a.status, homeFilters.status))) return false;
      if (homeFilters.assessmentStatus && !applications.some(a => {
        if (a.vacancyId !== v.jobClusterId) return false;
        const statusVal = a.assessmentStatus || 'marked_qualified';
        return statusVal.toLowerCase() === homeFilters.assessmentStatus.toLowerCase();
      })) return false;
      return true;
    });
  }, [vacancies, applications, homeFilters]);

  // Active Dashboard Config selection
  const activeDashboardData = useMemo(() => {
    const isFilledItem = (v) => {
      return v.fillingUpStatus?.toUpperCase() === 'FILLED';
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
          division: v.division || '',
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
          { label: 'Application Status', key: 'status', type: 'categorical', render: row => <span className={`badge ${cls(row.status)}`}>{row.status === 'Application Submitted' ? 'Application Submitted' : titleCase(row.status)}</span> }
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
        fit: app.appObj?.overallFit || app.overallFit || 0,
        assessmentStatus: app.appObj?.assessmentStatus || 'marked_qualified'
      }));
      return {
        rows,
        segments: [
          { key: 'marked_qualified', label: 'Assessment Not Started', colorClass: 'seg-submitted', color: '#0284C7' },
          { key: 'assessment_started', label: 'Assessment Started', colorClass: 'seg-docs', color: '#D97706' },
          { key: 'assessment_completed', label: 'Assessment Completed', colorClass: 'seg-qualified', color: '#16A34A' }
        ],
        getKey: r => r.assessmentStatus,
        kpiTotalLabel: 'Total Qualified',
        kpiTotalCaption: 'Passed Initial Screening',
        overallTitle: 'Overall Assessment Status Distribution',
        overallSubtitle: 'Assessment not started, ongoing, and completed assessments',
        tableTitle: 'Assessment Status — Individual Records',
        centerLabel: 'applications',
        tableLabel: 'Assessment Status',
        detailColumns: [
          { label: 'Applicant', key: 'applicant', type: 'text', render: row => <span><b>{row.applicant}</b><br/><span className="small">{row.code}</span></span> },
          { label: 'Vacancy', key: 'vacancy', type: 'categorical' },
          { label: 'Overall Fit', key: 'fit', type: 'numeric', render: row => `${row.fit}%` },
          { label: 'Assessment Status', key: 'assessmentStatus', type: 'categorical', render: row => {
            const map = {
              marked_qualified: ['Assessment Not Started', 'blue'],
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
          division: v.division || '',
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

  return (
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
                <option value="marked_qualified">Assessment Not Started</option>
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

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'stretch', marginBottom: '14px' }}>
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
  );
}
