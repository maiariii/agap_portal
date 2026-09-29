import React, { useRef, useState } from 'react';

export default function NoscaItemTrackingTab({
  incumbents = [],
  sdoEndorsees = [],
  sdoMetrics = { total: 0, assigned: 0, pending: 0 },
  filteredSdoEndorsees = [],
  pagedSdoEndorsees = [],
  totalPagesSdo = 1,
  currentPageSdo = 1,
  setCurrentPageSdo = () => {},
  pageSizeSdo = 10,
  setPageSizeSdo = () => {},
  sdoSearchTerm = '',
  setSdoSearchTerm = () => {},
  sdoStatusFilter = 'ALL',
  setSdoStatusFilter = () => {},
  sdoDivisionFilter = 'ALL',
  setSdoDivisionFilter = () => {},
  sdoDivisions = [],
  noscaDocuments = [],
  loadingNoscaDocs = false,
  uploadingNoscaDoc = false,
  onDirectNoscaUpload = () => {},
  onSaveSdoItem = () => {},
  sdoEditItemModal = { open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' },
  setSdoEditItemModal = () => {},
  savingSdoItem = false,
  showNoscaDocsArchiveModal = false,
  setShowNoscaDocsArchiveModal = () => {},
  noscaItems = [],
  onSelectIncumbent = () => {},
  onSetFullScreenDoc = () => {},
  onBackToStep3 = () => {},
  isRegionalOffice = false,
  canManageNosca = false,
  isDark = false
}) {
  const isAuthorizedToManage = Boolean(canManageNosca);
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [copiedSerial, setCopiedSerial] = useState(null);

  const handleCopySerial = (serialNo) => {
    if (!serialNo) return;
    try {
      navigator.clipboard?.writeText(serialNo);
      setCopiedSerial(serialNo);
      setTimeout(() => setCopiedSerial(null), 2000);
    } catch (e) {
      console.warn('Copy error:', e);
    }
  };

  const totalNoscaItems = noscaDocuments.reduce((sum, d) => sum + (Number(d.total_items) || 0), 0);
  const totalNoscaLinked = noscaDocuments.reduce((sum, d) => sum + (Number(d.assigned_count || d.actual_linked_count) || 0), 0);
  const overallLinkPercentage = totalNoscaItems > 0 ? Math.round((totalNoscaLinked / totalNoscaItems) * 100) : 0;

  const filteredNoscaDocuments = noscaDocuments.filter(doc => {
    if (!archiveSearchTerm.trim()) return true;
    const term = archiveSearchTerm.toLowerCase();
    return (
      (doc.file_name && doc.file_name.toLowerCase().includes(term)) ||
      (doc.serial_no && doc.serial_no.toLowerCase().includes(term)) ||
      (doc.division && doc.division.toLowerCase().includes(term))
    );
  });

  const handleFileChange = (e) => {
    if (!isAuthorizedToManage) return;
    const file = e.target.files?.[0];
    if (file) {
      onDirectNoscaUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isAuthorizedToManage) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      onDirectNoscaUpload(file);
    }
  };

  // Export SDO list to CSV
  const handleExportCsv = () => {
    if (sdoEndorsees.length === 0) return;
    const headers = [
      'No',
      'Employee ID',
      'Personnel Full Name',
      'Current Position',
      'Salary Grade',
      'Actual Reclass Position',
      'Station / School',
      'Division',
      'Region',
      'Previous / Current Item No.',
      'NEW Item No. (from NOSCA)',
      'NOSCA Serial Ref',
      'NOSCA Tracking Status',
      'Retained NOSCA File'
    ];

    const rows = sdoEndorsees.map((inc, idx) => [
      idx + 1,
      `"${inc.employee_id || ''}"`,
      `"${inc.full_name || ''}"`,
      `"${inc.current_position || ''}"`,
      `"${inc.salary_grade ? `SG ${inc.salary_grade}` : ''}"`,
      `"${inc.actual_position || inc.reclass_position || inc.target_position || ''}"`,
      `"${inc.station_division || inc.uacs_oper_dsc || ''}"`,
      `"${inc.division || ''}"`,
      `"${inc.region || ''}"`,
      `"${inc.plantilla_item_number || ''}"`,
      `"${inc.new_item_number || 'PENDING'}"`,
      `"${inc.nosca_serial_no || ''}"`,
      `"${inc.new_item_number ? 'NOSCA ASSIGNED' : 'PENDING NOSCA UPLOAD'}"`,
      `"${inc.nosca_file_name || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SDO_Endorsed_NOSCA_Item_Tracking_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="reclass-step-content-anim" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hidden file input (RO only) */}
      {isAuthorizedToManage && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      {/* Hero Banner & Actions Card */}
      <div style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
        borderRadius: '16px',
        border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0',
        padding: '24px 28px',
        boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(16, 185, 129, 0.08)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 850,
              color: isDark ? '#f8fafc' : '#0f172a',
              margin: 0,
              letterSpacing: '-0.01em'
            }}>
              NOSCA Upload & Item Number Tracking
            </h2>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowNoscaDocsArchiveModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>NOSCA Archive ({noscaDocuments.length})</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export Tracking CSV</span>
            </button>

            {isAuthorizedToManage ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingNoscaDoc}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: uploadingNoscaDoc ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease',
                  opacity: uploadingNoscaDoc ? 0.8 : 1
                }}
                title="Upload official DBM NOSCA PDF to automatically extract and link NEW Item Numbers"
              >
                {uploadingNoscaDoc ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Processing NOSCA...</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    <span>Upload DBM NOSCA (PDF)</span>
                  </>
                )}
              </button>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(51, 65, 85, 0.45)' : '#f1f5f9',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #cbd5e1',
                  color: isDark ? '#94a3b8' : '#475569',
                  fontSize: '12px',
                  fontWeight: 750
                }}
                title="Regional Office accounts are in tracking & view-only mode. Official NOSCA upload is performed by the HR Officer."
              >
                <span>🔒</span>
                <span>RO View-Only Tracking</span>
              </div>
            )}
          </div>
        </div>

        {/* 4 KPI Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px'
        }}>
          {/* Metric 1: Total Endorsed to SDO */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: isDark ? 'rgba(30, 58, 138, 0.25)' : '#eff6ff',
            border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#93c5fd' : '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Endorsed to SDO
              </span>
              <span style={{ fontSize: '16px' }}>📋</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#bfdbfe' : '#1e40af', margin: '4px 0 2px' }}>
              {sdoMetrics.total}
            </div>
            <div style={{ fontSize: '11.5px', color: isDark ? '#93c5fd' : '#2563eb' }}>
              Candidates at SDO stage
            </div>
          </div>

          {/* Metric 2: NOSCA Uploaded & Assigned */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: isDark ? 'rgba(6, 95, 70, 0.25)' : '#ecfdf5',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid #a7f3d0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#6ee7b7' : '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                NOSCA Assigned (NEW Item No.)
              </span>
              <span style={{ fontSize: '16px' }}>✨</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#a7f3d0' : '#065f46', margin: '4px 0 2px' }}>
              {sdoMetrics.assigned}
            </div>
            <div style={{ fontSize: '11.5px', color: isDark ? '#6ee7b7' : '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>✓ NEW Item No. reflected</span>
              {sdoMetrics.total > 0 && (
                <span style={{ fontWeight: 800 }}>({Math.round((sdoMetrics.assigned / sdoMetrics.total) * 100)}%)</span>
              )}
            </div>
          </div>

          {/* Metric 3: Pending NOSCA Upload */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: isDark ? 'rgba(180, 83, 9, 0.2)' : '#fffbeb',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#fde68a' : '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending NOSCA Upload
              </span>
              <span style={{ fontSize: '16px' }}>⏳</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#fef3c7' : '#b45309', margin: '4px 0 2px' }}>
              {sdoMetrics.pending}
            </div>
            <div style={{ fontSize: '11.5px', color: isDark ? '#fde68a' : '#d97706' }}>
              Awaiting DBM NOSCA upload
            </div>
          </div>

          {/* Metric 4: Retained NOSCA Reference Documents */}
          <div
            onClick={() => setShowNoscaDocsArchiveModal(true)}
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: isDark ? 'rgba(79, 70, 229, 0.2)' : '#f5f3ff',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #ddd6fe',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            title="Click to view Retained NOSCA Reference Documents"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#c7d2fe' : '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Retained NOSCA Batches
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 750,
                padding: '2px 8px',
                borderRadius: '6px',
                background: isDark ? 'rgba(99, 102, 241, 0.3)' : '#e0e7ff',
                color: isDark ? '#c7d2fe' : '#4338ca',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                <span>View Archive</span>
                <span style={{ fontSize: '12px' }}>↗</span>
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#e0e7ff' : '#3730a3', margin: '4px 0 2px' }}>
              {noscaDocuments.length}
            </div>
            <div style={{ fontSize: '11.5px', color: isDark ? '#c7d2fe' : '#4f46e5' }}>
              Official files stored on record
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone Banner (Interactive for HR Officer only) */}
      {isAuthorizedToManage && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragOver
              ? '2px dashed #10b981'
              : (isDark ? '1.5px dashed rgba(59, 130, 246, 0.45)' : '1.5px dashed #93c5fd'),
            borderRadius: '14px',
            padding: '20px 24px',
            background: isDragOver
              ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
              : (isDark ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            cursor: uploadingNoscaDoc ? 'wait' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7',
              color: isDark ? '#6ee7b7' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}>
              {uploadingNoscaDoc ? '⏳' : '📤'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                {uploadingNoscaDoc ? 'Scanning NOSCA & Automatically Linking NEW Item Numbers...' : 'Drop official DBM NOSCA (PDF) here or click to upload'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                The system scans the PDF, extracts each <b>NEW Item No.</b>, matches them to candidates Endorsed to SDO, and archives the document as a transaction record.
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={uploadingNoscaDoc}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              background: isDark ? '#1e293b' : '#ffffff',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
              color: isDark ? '#93c5fd' : '#2563eb',
              fontSize: '12px',
              fontWeight: 750,
              cursor: 'pointer',
              pointerEvents: 'none'
            }}
          >
            Select File (.pdf)
          </button>
        </div>
      )}

      {/* Filter and Search Controls Toolbar */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
        borderRadius: '14px',
        border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.02)'
      }}>
        {/* Left: Search input */}
        <div style={{ flex: '1 1 260px', position: 'relative', minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search by name, previous item no., NEW item no., school, or division..."
            value={sdoSearchTerm}
            onChange={(e) => {
              setSdoSearchTerm(e.target.value);
              setCurrentPageSdo(1);
            }}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 36px 0 36px',
              borderRadius: '10px',
              border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--line)',
              background: 'var(--input-bg)',
              color: 'var(--input-text, var(--text))',
              fontSize: '12.5px',
              fontWeight: 600,
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
          />
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none', fontSize: '13px' }}>
            🔍
          </div>
          {sdoSearchTerm && (
            <button
              type="button"
              onClick={() => setSdoSearchTerm('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px 4px'
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right Controls Group: Status Segmented Control + Division Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Segmented Status Filter */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px',
            borderRadius: '10px',
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={() => { setSdoStatusFilter('ALL'); setCurrentPageSdo(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: sdoStatusFilter === 'ALL' ? 800 : 650,
                cursor: 'pointer',
                border: 'none',
                background: sdoStatusFilter === 'ALL'
                  ? (isDark ? '#2563eb' : '#ffffff')
                  : 'transparent',
                color: sdoStatusFilter === 'ALL'
                  ? (isDark ? '#ffffff' : '#1e293b')
                  : (isDark ? '#94a3b8' : '#64748b'),
                boxShadow: sdoStatusFilter === 'ALL'
                  ? (isDark ? '0 2px 8px rgba(37, 99, 235, 0.4)' : '0 1px 4px rgba(0, 0, 0, 0.08)')
                  : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              All ({sdoMetrics.total})
            </button>

            <button
              type="button"
              onClick={() => { setSdoStatusFilter('ASSIGNED'); setCurrentPageSdo(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: sdoStatusFilter === 'ASSIGNED' ? 800 : 650,
                cursor: 'pointer',
                border: 'none',
                background: sdoStatusFilter === 'ASSIGNED'
                  ? (isDark ? 'rgba(16, 185, 129, 0.3)' : '#ffffff')
                  : 'transparent',
                color: sdoStatusFilter === 'ASSIGNED'
                  ? (isDark ? '#6ee7b7' : '#047857')
                  : (isDark ? '#94a3b8' : '#64748b'),
                boxShadow: sdoStatusFilter === 'ASSIGNED'
                  ? (isDark ? '0 2px 8px rgba(16, 185, 129, 0.3)' : '0 1px 4px rgba(0, 0, 0, 0.08)')
                  : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              ✓ Assigned ({sdoMetrics.assigned})
            </button>

            <button
              type="button"
              onClick={() => { setSdoStatusFilter('PENDING'); setCurrentPageSdo(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: sdoStatusFilter === 'PENDING' ? 800 : 650,
                cursor: 'pointer',
                border: 'none',
                background: sdoStatusFilter === 'PENDING'
                  ? (isDark ? 'rgba(245, 158, 11, 0.25)' : '#ffffff')
                  : 'transparent',
                color: sdoStatusFilter === 'PENDING'
                  ? (isDark ? '#fde68a' : '#b45309')
                  : (isDark ? '#94a3b8' : '#64748b'),
                boxShadow: sdoStatusFilter === 'PENDING'
                  ? (isDark ? '0 2px 8px rgba(245, 158, 11, 0.3)' : '0 1px 4px rgba(0, 0, 0, 0.08)')
                  : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              ⏳ Pending ({sdoMetrics.pending})
            </button>
          </div>

          {/* Division Filter Dropdown */}
          {sdoDivisions.length > 0 && (
            <div style={{ position: 'relative', minWidth: '150px' }}>
              <select
                value={sdoDivisionFilter}
                onChange={(e) => { setSdoDivisionFilter(e.target.value); setCurrentPageSdo(1); }}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 32px 0 12px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--line)',
                  background: isDark ? '#1e293b' : '#ffffff',
                  color: 'var(--text)',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  boxShadow: isDark ? '0 1px 4px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}
              >
                <option value="ALL">All Divisions ({sdoDivisions.length})</option>
                {sdoDivisions.map(div => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                fontSize: '10px',
                color: 'var(--text-secondary, #94a3b8)'
              }}>
                ▼
              </span>
            </div>
          )}

          {/* Reset Filters Shortcut (Visible when filtering is active) */}
          {(sdoSearchTerm || sdoStatusFilter !== 'ALL' || sdoDivisionFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSdoSearchTerm('');
                setSdoStatusFilter('ALL');
                setSdoDivisionFilter('ALL');
                setCurrentPageSdo(1);
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                border: isDark ? '1px dashed rgba(239, 68, 68, 0.5)' : '1px dashed #fca5a5',
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                color: isDark ? '#fca5a5' : '#ef4444',
                fontSize: '11.5px',
                fontWeight: 750,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              <span>✕</span>
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main SDO Endorsees & Item Number Tracking Table Card */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
        borderRadius: '16px',
        border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
        boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden'
      }}>
        {/* Card Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 850, margin: 0, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.01em' }}>
              Personnel Registry — Stage: Endorsed to SDO
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
              Showing {filteredSdoEndorsees.length} of {sdoMetrics.total} candidates matching current filters
            </div>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            padding: '4px 10px',
            borderRadius: '9px',
            background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-secondary, #64748b)',
              whiteSpace: 'nowrap'
            }}>
              Rows per page:
            </span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select
                value={pageSizeSdo}
                onChange={(e) => { setPageSizeSdo(Number(e.target.value)); setCurrentPageSdo(1); }}
                style={{
                  height: '26px',
                  padding: '0 22px 0 8px',
                  borderRadius: '6px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: isDark ? '#1e293b' : '#ffffff',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span style={{
                position: 'absolute',
                right: '7px',
                pointerEvents: 'none',
                fontSize: '9px',
                color: 'var(--text-secondary, #94a3b8)'
              }}>
                ▼
              </span>
            </div>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            minWidth: '1300px',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '12.5px'
          }}>
            <thead>
              <tr style={{
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
                borderBottom: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--line)',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '10.5px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap'
              }}>
                <th style={{ padding: '10px 8px', width: '45px', textAlign: 'center' }}>No.</th>
                <th style={{ padding: '10px 12px', minWidth: '190px' }}>Personnel &amp; Station</th>
                <th style={{ padding: '10px 12px', minWidth: '150px' }}>Current Position &amp; SG</th>
                <th style={{ padding: '10px 12px', minWidth: '170px' }}>Actual Reclass Position</th>
                <th style={{ padding: '10px 12px', minWidth: '170px' }}>Previous Item No.</th>
                <th style={{ padding: '10px 12px', minWidth: '220px' }}>NEW Item No. (NOSCA)</th>
                <th style={{ padding: '10px 12px', minWidth: '130px' }}>Status</th>
                <th style={{ padding: '10px 12px', minWidth: '140px' }}>NOSCA Reference</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', minWidth: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedSdoEndorsees.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary, #94a3b8)' }}>
                    <div style={{ fontSize: '30px', marginBottom: '8px' }}>📋</div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text)' }}>
                      No personnel currently matching "Endorsed to SDO" criteria.
                    </div>
                    <div style={{ fontSize: '11.5px', marginTop: '4px', maxWidth: '440px', marginInline: 'auto' }}>
                      Personnel whose Stage of Reclassification is set to "Endorsed to SDO" in the Assessment Workbench will appear here for NOSCA linking.
                    </div>
                  </td>
                </tr>
              ) : (
                pagedSdoEndorsees.map((inc, idx) => {
                  const rowNum = (currentPageSdo - 1) * pageSizeSdo + idx + 1;
                  const hasNewItem = Boolean(inc.new_item_number && String(inc.new_item_number).trim());

                  return (
                    <tr
                      key={inc.id}
                      style={{
                        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid var(--line)',
                        transition: 'background 0.15s'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* 1. No */}
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', fontWeight: 650, fontSize: '11.5px' }}>
                        {rowNum}
                      </td>

                      {/* 2. Personnel & Station */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 750, color: 'var(--text)', fontSize: '13px' }}>
                          {inc.full_name === '#N/A' ? 'Unassigned Plantilla' : inc.full_name}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace' }}>ID: {inc.employee_id}</span>
                          {inc.division && <span>• {inc.division}</span>}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '1px' }}>
                          {inc.station_division || inc.uacs_oper_dsc || '—'}
                          {inc.org_cd && <span style={{ marginLeft: '4px', opacity: 0.8 }}>(ORG CD: {inc.org_cd})</span>}
                        </div>
                      </td>

                      {/* 3. Current Position & SG */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '12px' }}>
                          {inc.current_position || '—'}
                        </div>
                        {inc.salary_grade && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: isDark ? '#93c5fd' : '#1e40af',
                            background: isDark ? 'rgba(30, 58, 138, 0.3)' : '#eff6ff',
                            border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '3px'
                          }}>
                            SG {inc.salary_grade}
                          </span>
                        )}
                      </td>

                      {/* 4. Actual Reclassification Position */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                          color: isDark ? '#6ee7b7' : '#047857',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                          fontSize: '11px',
                          fontWeight: 750,
                          lineHeight: 1.3
                        }}>
                          {inc.actual_position || inc.reclass_position || inc.target_position || 'School Counselor Associate I'}
                        </span>
                      </td>

                      {/* 5. Previous / Current Item No. */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(51, 65, 85, 0.3)' : '#f1f5f9',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: isDark ? '#cbd5e1' : '#334155',
                          whiteSpace: 'nowrap'
                        }}>
                          {inc.plantilla_item_number || '—'}
                        </span>
                      </td>

                      {/* 6. NEW Item No. (from NOSCA) */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        {hasNewItem ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: isDark ? 'rgba(16, 185, 129, 0.22)' : '#dcfce7',
                              border: isDark ? '1.5px solid rgba(16, 185, 129, 0.55)' : '1.5px solid #86efac',
                              color: isDark ? '#6ee7b7' : '#15803d',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '11.5px',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.12)'
                            }}>
                              <span>✨</span>
                              <span>{inc.new_item_number}</span>
                            </span>
                            {inc.nosca_serial_no && (
                              <span style={{ fontSize: '9.5px', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace', paddingLeft: '4px' }}>
                                Ref: {inc.nosca_serial_no}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
                            border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a',
                            color: isDark ? '#fde047' : '#b45309',
                            fontSize: '10.5px',
                            fontWeight: 750,
                            whiteSpace: 'nowrap'
                          }}>
                            <span>⏳</span> Pending NOSCA
                          </span>
                        )}
                      </td>

                      {/* 7. Tracking Status */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        {hasNewItem ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(6, 95, 70, 0.3)' : '#ecfdf5',
                            color: isDark ? '#34d399' : '#047857',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            whiteSpace: 'nowrap'
                          }}>
                            ✓ NOSCA Assigned
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(234, 179, 8, 0.2)' : '#fffbeb',
                            color: isDark ? '#facc15' : '#b45309',
                            border: isDark ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid #fde68a',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            whiteSpace: 'nowrap'
                          }}>
                            ⏳ Pending Upload
                          </span>
                        )}
                      </td>

                      {/* 8. Retained NOSCA Reference */}
                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        {inc.nosca_serial_no || inc.nosca_file_name ? (
                          <button
                            type="button"
                            onClick={() => onSetFullScreenDoc({
                              open: true,
                              title: inc.nosca_file_name || `DBM NOSCA (${inc.nosca_serial_no})`,
                              url: inc.nosca_file_url || 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf'
                            })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: isDark ? 'rgba(30, 58, 138, 0.3)' : '#eff6ff',
                              border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                              color: isDark ? '#93c5fd' : '#1d4ed8',
                              fontSize: '10.5px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease'
                            }}
                            title="Inspect official retained NOSCA document in full screen"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                            </svg>
                            <span>{inc.nosca_serial_no || 'View NOSCA'}</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                            — No File —
                          </span>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                          {isAuthorizedToManage && (
                            <button
                              type="button"
                              onClick={() => setSdoEditItemModal({
                                open: true,
                                personnel: inc,
                                newItemNumber: inc.new_item_number || '',
                                serialNo: inc.nosca_serial_no || '',
                                fileName: inc.nosca_file_name || ''
                              })}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
                                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                                color: 'var(--text)',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap'
                              }}
                              title="Assign or edit NEW Item No. manually"
                            >
                              ✏️ Link
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onSelectIncumbent(inc)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: '1px solid var(--line)',
                              color: 'var(--text-secondary, #94a3b8)',
                              fontSize: '11px',
                              fontWeight: 650,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Open candidate assessment modal"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPagesSdo > 1 && (
          <div style={{
            padding: '14px 20px',
            borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
              Page {currentPageSdo} of {totalPagesSdo} ({filteredSdoEndorsees.length} total personnel)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                disabled={currentPageSdo <= 1}
                onClick={() => setCurrentPageSdo(prev => Math.max(1, prev - 1))}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: isDark ? '#1e293b' : '#ffffff',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 650,
                  cursor: currentPageSdo <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPageSdo <= 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>

              {Array.from({ length: Math.min(5, totalPagesSdo) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPagesSdo > 5 && currentPageSdo > 3) {
                  pageNum = currentPageSdo - 3 + i;
                  if (pageNum > totalPagesSdo) pageNum = totalPagesSdo - (4 - i);
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPageSdo(pageNum)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: currentPageSdo === pageNum ? '1.5px solid #10b981' : '1px solid var(--line)',
                      background: currentPageSdo === pageNum ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#ecfdf5') : (isDark ? '#1e293b' : '#ffffff'),
                      color: currentPageSdo === pageNum ? (isDark ? '#6ee7b7' : '#047857') : 'var(--text)',
                      fontSize: '12px',
                      fontWeight: currentPageSdo === pageNum ? 800 : 600,
                      cursor: 'pointer'
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPageSdo >= totalPagesSdo}
                onClick={() => setCurrentPageSdo(prev => Math.min(totalPagesSdo, prev + 1))}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  background: isDark ? '#1e293b' : '#ffffff',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 650,
                  cursor: currentPageSdo >= totalPagesSdo ? 'not-allowed' : 'pointer',
                  opacity: currentPageSdo >= totalPagesSdo ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Stepper Back Navigation */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px' }}>
        <button
          type="button"
          onClick={onBackToStep3}
          style={{
            padding: '9px 18px',
            borderRadius: '10px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ← Return to Step 3: DBM Endorsement
        </button>
      </div>

      {/* SUB-MODAL 1: LINK / EDIT NEW ITEM NUMBER (RO / Admin only) */}
      {isAuthorizedToManage && sdoEditItemModal.open && sdoEditItemModal.personnel && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingSdoItem) {
              setSdoEditItemModal({ open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' });
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 110,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.5)' : '0 12px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Link NEW Item No. from NOSCA
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                  Candidate: <b>{sdoEditItemModal.personnel.full_name}</b> ({sdoEditItemModal.personnel.employee_id})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSdoEditItemModal({ open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' })}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
              marginBottom: '16px',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Current / Previous Item:</span>
                <span style={{ fontWeight: 750, fontFamily: 'monospace', color: 'var(--text)' }}>
                  {sdoEditItemModal.personnel.plantilla_item_number || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Target / Reclass Position:</span>
                <span style={{ fontWeight: 750, color: isDark ? '#6ee7b7' : '#047857' }}>
                  {sdoEditItemModal.personnel.actual_position || sdoEditItemModal.personnel.target_position || 'School Counselor Associate I'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  NEW Item Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. OSEC-DECSB-SCA1-300010-2024"
                  value={sdoEditItemModal.newItemNumber}
                  onChange={(e) => setSdoEditItemModal(prev => ({ ...prev, newItemNumber: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--line)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 750,
                    outline: 'none'
                  }}
                />

                {/* Quick picker from unassigned NOSCA items */}
                {noscaItems.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginBottom: '4px' }}>
                      Or choose an available scanned item:
                    </div>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setSdoEditItemModal(prev => ({ ...prev, newItemNumber: e.target.value }));
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        background: isDark ? '#1e293b' : '#ffffff',
                        color: 'var(--text)',
                        fontSize: '12px'
                      }}
                    >
                      <option value="">— Select an unassigned NOSCA item —</option>
                      {noscaItems.slice(0, 30).map(item => (
                        <option key={item.id} value={item.plantilla_item_number}>
                          {item.plantilla_item_number} ({item.serial_no || 'NOSCA'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  NOSCA Serial Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. RO-NCR-2024-089"
                  value={sdoEditItemModal.serialNo}
                  onChange={(e) => setSdoEditItemModal(prev => ({ ...prev, serialNo: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '9px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '12.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  NOSCA File Name / Transaction Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. NOSCA_NCR_2024_089.pdf"
                  value={sdoEditItemModal.fileName}
                  onChange={(e) => setSdoEditItemModal(prev => ({ ...prev, fileName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '9px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '12.5px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
              {sdoEditItemModal.personnel.new_item_number ? (
                <button
                  type="button"
                  onClick={() => {
                    setSdoEditItemModal(prev => ({ ...prev, newItemNumber: '', serialNo: '', fileName: '' }));
                    onSaveSdoItem();
                  }}
                  disabled={savingSdoItem}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'none',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Unlink Item
                </button>
              ) : <div />}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSdoEditItemModal({ open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' })}
                  disabled={savingSdoItem}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'none',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    fontSize: '12.5px',
                    fontWeight: 650,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveSdoItem}
                  disabled={savingSdoItem}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: savingSdoItem ? 'wait' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {savingSdoItem ? 'Saving...' : 'Save & Link Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: NOSCA DOCUMENTS ARCHIVE */}
      {showNoscaDocsArchiveModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNoscaDocsArchiveModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 110,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: '20px',
            border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(226, 232, 240, 0.9)',
            width: '100%',
            maxWidth: '740px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isDark
              ? '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.15)'
              : '0 25px 50px -12px rgba(15, 23, 42, 0.2), 0 0 30px rgba(37, 99, 235, 0.08)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 26px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #f1f5f9',
              background: isDark
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)'
                : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                  flexShrink: 0
                }}>
                  📜
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.01em' }}>
                      Retained NOSCA Reference Documents
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: isDark ? 'rgba(99, 102, 241, 0.25)' : '#e0e7ff',
                      color: isDark ? '#c7d2fe' : '#4338ca',
                      border: isDark ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #c7d2fe'
                    }}>
                      {noscaDocuments.length} {noscaDocuments.length === 1 ? 'Batch' : 'Batches'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '3px' }}>
                    Archived official DBM/NOSCA records retained as legal basis for reclassification
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNoscaDocsArchiveModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)',
                  border: 'none',
                  fontSize: '15px',
                  color: isDark ? '#cbd5e1' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 26px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Executive Summary Mini-Dashboard */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px'
              }}>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 750, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                    Official Files
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 850, color: isDark ? '#93c5fd' : '#2563eb', marginTop: '2px' }}>
                    {noscaDocuments.length}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                    Retained DBM Batches
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 750, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                    Plantilla Items
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a', marginTop: '2px' }}>
                    {totalNoscaItems}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                    Total Authorized
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0'
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 750, color: isDark ? '#6ee7b7' : '#047857', textTransform: 'uppercase' }}>
                    Linked to SDO
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 850, color: isDark ? '#34d399' : '#059669', marginTop: '2px' }}>
                    {totalNoscaLinked}
                  </div>
                  <div style={{ fontSize: '10.5px', color: isDark ? '#a7f3d0' : '#059669' }}>
                    {overallLinkPercentage}% Coverage
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                  border: isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #fde68a'
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 750, color: isDark ? '#fde68a' : '#b45309', textTransform: 'uppercase' }}>
                    Available Items
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 850, color: isDark ? '#fbbf24' : '#d97706', marginTop: '2px' }}>
                    {Math.max(0, totalNoscaItems - totalNoscaLinked)}
                  </div>
                  <div style={{ fontSize: '10.5px', color: isDark ? '#fde68a' : '#b45309' }}>
                    Ready for Linking
                  </div>
                </div>
              </div>

              {/* Search Bar for Documents (when records exist) */}
              {noscaDocuments.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search by serial number, filename, or division..."
                    value={archiveSearchTerm}
                    onChange={(e) => setArchiveSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 14px 9px 36px',
                      borderRadius: '10px',
                      border: isDark ? '1.5px solid rgba(51, 65, 85, 0.7)' : '1.5px solid #cbd5e1',
                      background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
                      color: 'var(--text)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                    🔍
                  </span>
                  {archiveSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setArchiveSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary, #94a3b8)',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Document Cards List */}
              {loadingNoscaDocs ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #94a3b8)' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                  <div style={{ fontWeight: 700 }}>Loading archived NOSCA documents...</div>
                </div>
              ) : noscaDocuments.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '44px 20px',
                  borderRadius: '14px',
                  border: isDark ? '1.5px dashed rgba(51, 65, 85, 0.6)' : '1.5px dashed #cbd5e1',
                  background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc'
                }}>
                  <div style={{ fontSize: '38px', marginBottom: '10px' }}>📂</div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>
                    No NOSCA Reference Documents on Record Yet
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px', maxWidth: '440px', margin: '6px auto 0' }}>
                    Official DBM NOSCA documents uploaded by the HR Officer will be automatically extracted, matched, and permanently archived here for audit trail and transmittal verification.
                  </div>
                </div>
              ) : filteredNoscaDocuments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary, #94a3b8)' }}>
                  No NOSCA records match "<b>{archiveSearchTerm}</b>".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredNoscaDocuments.map((doc) => {
                    const linkedCount = Number(doc.assigned_count || doc.actual_linked_count || 0);
                    const totalItems = Number(doc.total_items || 0);
                    const pct = totalItems > 0 ? Math.round((linkedCount / totalItems) * 100) : 0;
                    const isCopied = copiedSerial === doc.serial_no;

                    return (
                      <div
                        key={doc.id}
                        style={{
                          padding: '18px 20px',
                          borderRadius: '14px',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                          background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
                          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Top Row: File Identity & Badges */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '42px',
                              height: '46px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                              color: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                              flexShrink: 0
                            }}>
                              <span style={{ fontSize: '16px', lineHeight: 1 }}>📄</span>
                              <span style={{ fontSize: '8.5px', fontWeight: 900, letterSpacing: '0.05em', marginTop: '2px' }}>PDF</span>
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 850, fontSize: '14.5px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                  {doc.file_name}
                                </span>
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7',
                                  color: isDark ? '#6ee7b7' : '#15803d',
                                  border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #86efac'
                                }}>
                                  ✓ Official DBM Document
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '3px' }}>
                                Archived Reference • Position Series: <b>{doc.position_title || 'Guidance Counselor'}</b>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNoscaDocsArchiveModal(false);
                                onSetFullScreenDoc({
                                  open: true,
                                  title: doc.file_name,
                                  url: doc.file_url || 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf'
                                });
                              }}
                              style={{
                                padding: '7px 15px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                                border: 'none',
                                color: '#ffffff',
                                fontSize: '12px',
                                fontWeight: 750,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span>👁️ Preview Document</span>
                              <span>↗</span>
                            </button>

                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                                  color: 'var(--text)',
                                  fontSize: '12px',
                                  fontWeight: 650,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>External</span>
                                <span style={{ fontSize: '11px' }}>↗</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Metadata Pills Row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#f8fafc',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '11.5px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Serial No:</span>
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: isDark ? '#93c5fd' : '#1d4ed8',
                              background: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {doc.serial_no || 'N/A'}
                            </span>
                            {doc.serial_no && (
                              <button
                                type="button"
                                onClick={() => handleCopySerial(doc.serial_no)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  color: isCopied ? '#10b981' : 'var(--text-secondary, #94a3b8)',
                                  fontWeight: 700,
                                  padding: '2px 4px'
                                }}
                                title="Copy Serial No."
                              >
                                {isCopied ? '✓ Copied' : '📋 Copy'}
                              </button>
                            )}
                          </div>

                          <span style={{ color: 'var(--line)' }}>•</span>

                          <div>
                            <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Jurisdiction: </span>
                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                              {doc.division || 'Regional Scope'}
                            </span>
                          </div>

                          <span style={{ color: 'var(--line)' }}>•</span>

                          <div>
                            <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Authorized: </span>
                            <span style={{ fontWeight: 800, color: 'var(--text)' }}>
                              {totalItems} Items
                            </span>
                          </div>

                          <span style={{ color: 'var(--line)' }}>•</span>

                          <div>
                            <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Allocated: </span>
                            <span style={{ fontWeight: 800, color: isDark ? '#6ee7b7' : '#047857' }}>
                              {linkedCount} linked
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar of Item Allocation */}
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            marginBottom: '4px'
                          }}>
                            <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                              Candidate Matching Progress:
                            </span>
                            <span style={{ fontWeight: 800, color: isDark ? '#6ee7b7' : '#047857' }}>
                              {linkedCount} of {totalItems} items assigned ({pct}%)
                            </span>
                          </div>

                          <div style={{
                            width: '100%',
                            height: '6px',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(pct, 100)}%`,
                              height: '100%',
                              borderRadius: '999px',
                              background: pct === 100
                                ? 'linear-gradient(90deg, #059669, #10b981)'
                                : 'linear-gradient(90deg, #2563eb, #10b981)',
                              transition: 'width 0.4s ease'
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Informational Compliance Footer Banner */}
              <div style={{
                borderRadius: '12px',
                padding: '12px 16px',
                background: isDark ? 'rgba(99, 102, 241, 0.12)' : '#eef2ff',
                border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>🛡️</span>
                <span style={{ fontSize: '11.5px', color: isDark ? '#c7d2fe' : '#3730a3', lineHeight: 1.45 }}>
                  <b>Official Legal &amp; Audit Reference:</b> In accordance with DBM &amp; DepEd circulars, retained NOSCA documents serve as the permanent, authoritative reference for item conversion, plantilla updating, and SDO transmittals.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 26px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #f1f5f9',
              background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                Showing {filteredNoscaDocuments.length} of {noscaDocuments.length} archived document{noscaDocuments.length !== 1 ? 's' : ''}
              </span>

              <button
                type="button"
                onClick={() => setShowNoscaDocsArchiveModal(false)}
                style={{
                  padding: '8px 22px',
                  borderRadius: '9px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: isDark ? '#1e293b' : '#ffffff',
                  color: 'var(--text)',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
