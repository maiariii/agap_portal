import React, { useState, useMemo, useEffect, useRef } from 'react';
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

const CustomSelect = ({ value, onChange, options, label, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = options.find(o => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: label === 'Position' ? '260px' : '220px' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="control-select-wrap"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: '#F8FAFC', 
          borderRadius: '8px', 
          padding: '6px 12px',
          gap: '10px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '9px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '1' }}>{label}</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOpt ? selectedOpt.label : ''}
          </span>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '6px',
          zIndex: 100,
          maxHeight: '260px',
          overflowY: 'auto'
        }}>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={idx}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isSelected ? '600' : '500',
                  color: isSelected ? '#ffffff' : '#334155',
                  background: isSelected ? '#0B3C5D' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.target.style.background = '#F1F5F9';
                    e.target.style.color = '#0F172A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#334155';
                  }
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function DashboardPage() {
  const { positions, vacancies, applications } = useAppData();

  const [positionId, setPositionId] = useState('');
  const [homeDistributionBy, setHomeDistributionBy] = useState('item_status');
  const [homeSortBy, setHomeSortBy] = useState('total');
  const [homeDetailColFilters, setHomeDetailColFilters] = useState({});
  const [homeDetailPage, setHomeDetailPage] = useState(1);
  const [homeDetailPageSize, setHomeDetailPageSize] = useState(10);

  const [trendRange, setTrendRange] = useState('7');
  const [selectedTrendDate, setSelectedTrendDate] = useState(null);
  const [hoverTooltip, setHoverTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  // Modal states
  const [modalSearch, setModalSearch] = useState('');
  const [modalColFilters, setModalColFilters] = useState({});
  const [modalSort, setModalSort] = useState({ key: '', dir: 'asc' });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedTrendDate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      if (positionId && app.vacancyObj.positionId !== positionId) return false;
      return true;
    });
  }, [applications, positionId]);

  // Filtered vacancies for the dashboard
  const dashboardVacancies = useMemo(() => {
    return vacancies.filter(v => {
      if (positionId && v.positionId !== positionId) return false;
      return true;
    });
  }, [vacancies, positionId]);

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
          itemStatus: isFilledItem(v) ? 'filled' : 'unfilled',
          updatedAt: v.updatedAt || v.createdAt
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
        status: app.status,
        updatedAt: app.updatedAt || app.createdAt
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
        assessmentStatus: app.appObj?.assessmentStatus || 'marked_qualified',
        updatedAt: app.updatedAt || app.createdAt
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
          postingStatus: v.status,
          updatedAt: v.updatedAt || v.createdAt
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

  const getBezierPath = (points, height) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      let cp1y = p0.y;
      
      const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
      let cp2y = p1.y;
      
      // Clamp control points to bounds
      cp1y = Math.max(0, Math.min(height, cp1y));
      cp2y = Math.max(0, Math.min(height, cp2y));
      
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const latestDate = useMemo(() => {
    if (filteredHomeDetailRows.length === 0) return new Date();
    let maxTime = 0;
    filteredHomeDetailRows.forEach(r => {
      if (r.updatedAt) {
        const t = new Date(r.updatedAt).getTime();
        if (t > maxTime) maxTime = t;
      }
    });
    return maxTime > 0 ? new Date(maxTime) : new Date();
  }, [filteredHomeDetailRows]);

  const earliestDate = useMemo(() => {
    if (filteredHomeDetailRows.length === 0) {
      const d = new Date(latestDate);
      d.setDate(d.getDate() - 7);
      return d;
    }
    let minTime = latestDate.getTime();
    filteredHomeDetailRows.forEach(r => {
      if (r.updatedAt) {
        const t = new Date(r.updatedAt).getTime();
        if (t < minTime) minTime = t;
      }
    });
    return new Date(minTime);
  }, [filteredHomeDetailRows, latestDate]);

  const startDate = useMemo(() => {
    const d = new Date(latestDate);
    d.setHours(0, 0, 0, 0);
    if (trendRange === '7') {
      d.setDate(d.getDate() - 6);
    } else if (trendRange === '15') {
      d.setDate(d.getDate() - 14);
    } else if (trendRange === '30') {
      d.setDate(d.getDate() - 29);
    } else {
      const earliest = new Date(earliestDate);
      earliest.setHours(0, 0, 0, 0);
      return earliest;
    }
    return d;
  }, [latestDate, earliestDate, trendRange]);

  const trendData = useMemo(() => {
    const dayList = [];
    const curr = new Date(startDate);
    const end = new Date(latestDate);
    curr.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    while (curr <= end) {
      dayList.push({
        dateStr: curr.toISOString().slice(0, 10),
        label: curr.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: 0
      });
      curr.setDate(curr.getDate() + 1);
    }
    
    filteredHomeDetailRows.forEach(r => {
      if (!r.updatedAt) return;
      const rDateStr = new Date(r.updatedAt).toISOString().slice(0, 10);
      const dayObj = dayList.find(d => d.dateStr === rDateStr);
      if (dayObj) {
        dayObj.count += 1;
      }
    });
    
    return dayList;
  }, [startDate, latestDate, filteredHomeDetailRows]);

  const chartWidth = 800 - 40 - 30; // 730
  const chartHeight = 200 - 20 - 30; // 150
  const padding = { top: 20, right: 30, bottom: 30, left: 40 };

  const points = useMemo(() => {
    if (trendData.length === 0) return [];
    const maxVal = Math.max(...trendData.map(d => d.count), 1);
    
    return trendData.map((d, index) => {
      const x = padding.left + (trendData.length > 1 
        ? (index / (trendData.length - 1)) * chartWidth 
        : chartWidth / 2);
      const y = padding.top + chartHeight - (d.count / maxVal) * chartHeight;
      return {
        x,
        y,
        dateStr: d.dateStr,
        label: d.label,
        count: d.count
      };
    });
  }, [trendData, chartWidth, chartHeight]);

  const maxCount = useMemo(() => {
    return Math.max(...trendData.map(d => d.count), 0);
  }, [trendData]);

  const yGridlines = useMemo(() => {
    return [0, Math.ceil(maxCount / 2), maxCount];
  }, [maxCount]);

  const modalRows = useMemo(() => {
    if (!selectedTrendDate) return [];
    return filteredHomeDetailRows.filter(r => {
      if (!r.updatedAt) return false;
      const dateStr = new Date(r.updatedAt).toISOString().slice(0, 10);
      return dateStr === selectedTrendDate;
    });
  }, [filteredHomeDetailRows, selectedTrendDate]);

  const filteredModalRows = useMemo(() => {
    let rows = [...modalRows];
    
    if (modalSearch) {
      const q = modalSearch.toLowerCase();
      rows = rows.filter(r => {
        return Object.values(r).some(val => 
          String(val || '').toLowerCase().includes(q)
        );
      });
    }
    
    Object.entries(modalColFilters).forEach(([key, val]) => {
      if (!val) return;
      rows = rows.filter(r => {
        const colVal = String(r[key] || '').toLowerCase();
        return colVal.includes(val.toLowerCase());
      });
    });
    
    if (modalSort.key) {
      rows.sort((a, b) => {
        let valA = a[modalSort.key];
        let valB = b[modalSort.key];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return modalSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return modalSort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return rows;
  }, [modalRows, modalSearch, modalColFilters, modalSort]);

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
    }).filter(p => p.total > 0 || positionId);

    return homeSortBy === 'total' ? list.sort((a, b) => b.total - a.total) : list.sort((a, b) => a.title.localeCompare(b.title));
  }, [positions, activeDashboardData, positionId, homeSortBy]);

  const positionOptions = useMemo(() => [
    { value: '', label: 'All positions' },
    ...positions.map(p => ({ value: p.id, label: p.title }))
  ], [positions]);

  const distributionOptions = useMemo(() => [
    { value: 'item_status', label: 'Item Status' },
    { value: 'status', label: 'Application Status' },
    { value: 'assessment_status', label: 'Assessment Status' },
    { value: 'posting_status', label: 'Posting Status' }
  ], []);

  return (
    <section className="view active">
      <style>{`
        .control-select-wrap {
          transition: all 0.2s ease;
          border: 1.5px solid #E2E8F0 !important;
        }
        .control-select-wrap:hover {
          border-color: #94A3B8 !important;
          background: #ffffff !important;
          box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05) !important;
        }
        .control-select-wrap:focus-within {
          border-color: #0B3C5D !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(11, 60, 93, 0.15) !important;
        }
      `}</style>
      <div className="filterbar" style={{ 
        marginBottom: '14px', 
        padding: '8px 0', 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '16px',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        width: 'fit-content',
        overflow: 'visible'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B3C5D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <h2 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>Data Filters</h2>
          </div>
          
          <div style={{ width: '1px', height: '24px', background: '#E2E8F0', flexShrink: 0 }}></div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Position Select */}
            <CustomSelect
              value={positionId}
              onChange={setPositionId}
              options={positionOptions}
              label="Position"
            />

            {/* Distribution By Select */}
            <CustomSelect
              value={homeDistributionBy}
              onChange={setHomeDistributionBy}
              options={distributionOptions}
              label="Distribution"
            />
          </div>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: '14px' }}>
        {dashboardKPIs.map((k, i) => (
          <div className="card kpi" key={i}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-number">{k.value}</div>
            <div className="kpi-caption">{k.desc}</div>
          </div>
        ))}
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

      <div className="card full-width-card" style={{ gridColumn: '1 / -1', marginBottom: '14px', position: 'relative' }}>
        <style>{`
          .trend-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }
          .trend-header h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: #0F172A;
          }
          .trend-range-selector {
            display: flex;
            gap: 6px;
          }
          .trend-range-btn {
            background: #ffffff;
            border: 1px solid #CBD5E1;
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            color: #475569;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .trend-range-btn.active {
            background: #0284C7;
            border-color: #0284C7;
            color: #ffffff;
          }
          .trend-tooltip {
            position: absolute;
            background: rgba(15, 23, 42, 0.95);
            color: #ffffff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10;
            transition: opacity 0.15s ease;
          }
          .trend-point {
            cursor: pointer;
            transition: r 0.15s ease, fill 0.15s ease;
          }
          .trend-point:hover {
            r: 6;
            fill: #0284C7;
          }
        `}</style>
        <div className="trend-header">
          <div>
            <h2>Activity Trendline</h2>
            <p className="small">Daily change count over time for {activeDashboardData.tableLabel}</p>
          </div>
          <div className="trend-range-selector">
            {[
              { label: '1 Week', value: '7' },
              { label: '15 Days', value: '15' },
              { label: '30 Days', value: '30' },
              { label: 'All', value: 'all' }
            ].map(btn => (
              <button
                key={btn.value}
                className={`trend-range-btn ${trendRange === btn.value ? 'active' : ''}`}
                onClick={() => setTrendRange(btn.value)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
        
        {filteredHomeDetailRows.length === 0 ? (
          <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748B' }}>
            No records match the active filters.
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <svg viewBox="0 0 800 200" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              {/* Gridlines */}
              {yGridlines.map((val, idx) => {
                const yVal = padding.top + chartHeight - (maxCount > 0 ? (val / maxCount) * chartHeight : 0);
                return (
                  <g key={idx}>
                    <line x1={padding.left} y1={yVal} x2={800 - padding.right} y2={yVal} stroke="#F1F5F9" strokeWidth="1" />
                    <text x={padding.left - 10} y={yVal + 3} textAnchor="end" fontSize="10" fill="#94A3B8">{val}</text>
                  </g>
                );
              })}
              
              {/* Area Path */}
              {points.length > 0 && (
                <path
                  d={`${getBezierPath(points, padding.top + chartHeight)} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`}
                  fill="url(#trendGrad)"
                  opacity="0.15"
                />
              )}
              
              {/* Line Path */}
              {points.length > 0 && (
                <path
                  d={getBezierPath(points, padding.top + chartHeight)}
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}
              
              {/* Dots */}
              {points.map((pt, idx) => (
                <circle
                  key={idx}
                  className="trend-point"
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill="#38BDF8"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  onClick={() => {
                    setModalSearch('');
                    setModalColFilters({});
                    setSelectedTrendDate(pt.dateStr);
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.target.getBoundingClientRect();
                    const containerRect = e.currentTarget.ownerSVGElement.parentNode.getBoundingClientRect();
                    setHoverTooltip({
                      visible: true,
                      x: rect.left - containerRect.left + rect.width / 2,
                      y: rect.top - containerRect.top - 35,
                      content: `${pt.label}: ${pt.count} active`
                    });
                  }}
                  onMouseLeave={() => setHoverTooltip({ visible: false, x: 0, y: 0, content: '' })}
                />
              ))}
              
              {/* X Labels */}
              {points.length > 0 && (
                <>
                  <text x={points[0].x} y={200 - 10} textAnchor="middle" fontSize="10" fill="#94A3B8">{points[0].label}</text>
                  {points.length > 2 && (
                    <text x={points[Math.floor(points.length / 2)].x} y={200 - 10} textAnchor="middle" fontSize="10" fill="#94A3B8">{points[Math.floor(points.length / 2)].label}</text>
                  )}
                  {points.length > 1 && (
                    <text x={points[points.length - 1].x} y={200 - 10} textAnchor="middle" fontSize="10" fill="#94A3B8">{points[points.length - 1].label}</text>
                  )}
                </>
              )}
              
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284C7" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            {hoverTooltip.visible && (
              <div className="trend-tooltip" style={{ left: `${hoverTooltip.x}px`, top: `${hoverTooltip.y}px`, transform: 'translateX(-50%)' }}>
                {hoverTooltip.content}
              </div>
            )}
          </div>
        )}
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

      {selectedTrendDate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedTrendDate(null)}
        >
          <style>{`
            .trend-modal {
              background: #ffffff;
              border-radius: 12px;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
              width: 90%;
              max-width: 800px;
              max-height: 80vh;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              animation: modalFadeIn 0.2s ease-out;
            }
            @keyframes modalFadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            .trend-modal-head {
              padding: 16px 20px;
              border-bottom: 1px solid #E2E8F0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .trend-modal-head h3 {
              margin: 0;
              font-size: 16px;
              font-weight: 700;
              color: #0F172A;
            }
            .trend-modal-close {
              background: none;
              border: none;
              font-size: 20px;
              cursor: pointer;
              color: #94A3B8;
            }
            .trend-modal-close:hover {
              color: #475569;
            }
            .trend-modal-body {
              padding: 16px 20px;
              overflow-y: auto;
              flex: 1;
            }
            .trend-modal-search {
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #CBD5E1;
              border-radius: 6px;
              font-size: 13px;
              margin-bottom: 14px;
            }
            .trend-modal-search:focus {
              outline: none;
              border-color: #0284C7;
              box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
            }
            .trend-modal-table-wrap {
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              overflow: hidden;
            }
            .trend-modal-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              text-align: left;
            }
            .trend-modal-table th {
              background: #F8FAFC;
              padding: 10px 12px;
              font-weight: 600;
              color: #475569;
              border-bottom: 1px solid #E2E8F0;
            }
            .trend-modal-table td {
              padding: 10px 12px;
              border-bottom: 1px solid #E2E8F0;
              color: #334155;
            }
            .trend-modal-table tbody tr:last-child td {
              border-bottom: none;
            }
            .trend-modal-table tfoot td {
              background: #F8FAFC;
              font-weight: 700;
              border-top: 2px solid #E2E8F0;
            }
            .th-sortable {
              cursor: pointer;
              user-select: none;
            }
            .th-sortable:hover {
              background: #F1F5F9;
            }
            .col-filter-input {
              width: 100%;
              margin-top: 4px;
              padding: 2px 4px;
              font-size: 10px;
              border: 1px solid #CBD5E1;
              border-radius: 4px;
            }
          `}</style>
          <div className="trend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="trend-modal-head">
              <div>
                <h3>Activity Details — {new Date(selectedTrendDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</h3>
                <p className="small" style={{ margin: 0 }}>
                  Showing {filteredModalRows.length} of {modalRows.length} records.
                </p>
              </div>
              <button className="trend-modal-close" onClick={() => setSelectedTrendDate(null)}>×</button>
            </div>
            
            <div className="trend-modal-body">
              <input
                className="trend-modal-search"
                placeholder="Search records for this day..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
              />
              
              <div className="trend-modal-table-wrap">
                <table className="trend-modal-table">
                  <thead>
                    <tr>
                      {activeDashboardData.detailColumns.map((col, idx) => (
                        <th
                          key={idx}
                          className="th-sortable"
                          onClick={() => setModalSort({
                            key: col.key,
                            dir: modalSort.key === col.key && modalSort.dir === 'asc' ? 'desc' : 'asc'
                          })}
                        >
                          <div>
                            {col.label} {modalSort.key === col.key ? (modalSort.dir === 'asc' ? '▲' : '▼') : ''}
                          </div>
                          <input
                            className="col-filter-input"
                            placeholder="Filter..."
                            value={modalColFilters[col.key] || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setModalColFilters({
                              ...modalColFilters,
                              [col.key]: e.target.value
                            })}
                          />
                        </th>
                      ))}
                      <th
                        className="th-sortable"
                        onClick={() => setModalSort({
                          key: 'updatedAt',
                          dir: modalSort.key === 'updatedAt' && modalSort.dir === 'asc' ? 'desc' : 'asc'
                        })}
                      >
                        <div>
                          Time {modalSort.key === 'updatedAt' ? (modalSort.dir === 'asc' ? '▲' : '▼') : ''}
                        </div>
                        <input
                          className="col-filter-input"
                          placeholder="Filter..."
                          value={modalColFilters['updatedAt'] || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setModalColFilters({
                            ...modalColFilters,
                            ['updatedAt']: e.target.value
                          })}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModalRows.length > 0 ? (
                      filteredModalRows.map((row, idx) => (
                        <tr key={idx}>
                          {activeDashboardData.detailColumns.map((col, cIdx) => (
                            <td key={cIdx}>
                              {col.render ? col.render(row) : (row[col.key] || '—')}
                            </td>
                          ))}
                          <td>
                            {row.updatedAt ? new Date(row.updatedAt).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={activeDashboardData.detailColumns.length + 1} style={{ textAlign: 'center' }}>
                          No records match the active search/filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={activeDashboardData.detailColumns.length} style={{ fontWeight: 'bold' }}>
                        Total Records
                      </td>
                      <td style={{ fontWeight: 'bold' }}>
                        {filteredModalRows.length}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
