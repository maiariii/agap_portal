import React, { useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  canUploadNosca = false,
  canAssignItemNo = true,
  onOpenNoscaScanModal = () => {},
  scanningNosca = false,
  scannedNoscaResult = null,
  selectedNoscaItemsCount = 0,
  isDark = false
}) {
  const isAuthorizedToUpload = Boolean(canUploadNosca && !isRegionalOffice);
  const isAuthorizedToAssign = canAssignItemNo !== undefined ? Boolean(canAssignItemNo) : !isRegionalOffice;
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

  // Available Items Modal state & filtering
  const [showAvailableModal, setShowAvailableModal] = useState(false);
  const [availSearchTerm, setAvailSearchTerm] = useState('');
  const [availCategoryFilter, setAvailCategoryFilter] = useState('ALL');
  const [copiedAvailItemNo, setCopiedAvailItemNo] = useState(null);

  const handleCopyAvailItemNo = (itemNo) => {
    if (!itemNo) return;
    try {
      navigator.clipboard?.writeText(itemNo);
      setCopiedAvailItemNo(itemNo);
      setTimeout(() => setCopiedAvailItemNo(null), 2000);
    } catch (e) {
      console.warn('Copy error:', e);
    }
  };

  const roAvailableCount = useMemo(() => {
    return noscaItems.filter(item => {
      const status = String(item.assignment_status || item.new_item_no_status || 'AVAILABLE').toUpperCase();
      return status === 'AVAILABLE' && !item.reclass_gc_id && !item.assigned_to_incumbent_id;
    }).length;
  }, [noscaItems]);

  const availCategoryCounts = useMemo(() => {
    const counts = { ALL: 0, ELEMENTARY: 0, JHS: 0, SHS: 0 };
    noscaItems.forEach(item => {
      const status = String(item.assignment_status || item.new_item_no_status || 'AVAILABLE').toUpperCase();
      const isAvail = status === 'AVAILABLE' && !item.reclass_gc_id && !item.assigned_to_incumbent_id;
      if (isAvail) {
        counts.ALL++;
        const cat = String(item.category || '').toUpperCase();
        if (cat.includes('ELEM')) counts.ELEMENTARY++;
        else if (cat.includes('JHS')) counts.JHS++;
        else if (cat.includes('SHS')) counts.SHS++;
      }
    });
    return counts;
  }, [noscaItems]);

  const availableItemsList = useMemo(() => {
    return noscaItems.filter(item => {
      const status = String(item.assignment_status || item.new_item_no_status || 'AVAILABLE').toUpperCase();
      const isAvailable = status === 'AVAILABLE' && !item.reclass_gc_id && !item.assigned_to_incumbent_id;
      if (!isAvailable) return false;

      if (availCategoryFilter !== 'ALL') {
        const cat = String(item.category || '').toUpperCase();
        if (!cat.includes(availCategoryFilter)) return false;
      }

      if (availSearchTerm.trim()) {
        const q = availSearchTerm.toLowerCase();
        const itemNo = String(item.plantilla_item_number || item.new_item_no || '').toLowerCase();
        const pos = String(item.position_title || item.position || '').toLowerCase();
        const div = String(item.division || item.station_division || '').toLowerCase();
        const school = String(item.school_name || item.school_id || '').toLowerCase();
        if (!itemNo.includes(q) && !pos.includes(q) && !div.includes(q) && !school.includes(q)) return false;
      }

      return true;
    });
  }, [noscaItems, availCategoryFilter, availSearchTerm]);

  useEffect(() => {
    const isAnyModalOpen = showAvailableModal || showNoscaDocsArchiveModal || sdoEditItemModal.open;
    if (isAnyModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          if (showAvailableModal) setShowAvailableModal(false);
          else if (showNoscaDocsArchiveModal) setShowNoscaDocsArchiveModal(false);
          else if (sdoEditItemModal.open && !savingSdoItem) {
            setSdoEditItemModal({ open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' });
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showAvailableModal, showNoscaDocsArchiveModal, sdoEditItemModal.open, savingSdoItem]);

  const roAssignedCount = useMemo(() => {
    return noscaItems.filter(item => {
      const status = String(item.assignment_status || item.new_item_no_status || '').toUpperCase();
      return status === 'ASSIGNED' || Boolean(item.reclass_gc_id) || Boolean(item.assigned_to_incumbent_id);
    }).length;
  }, [noscaItems]);

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
    if (!isAuthorizedToUpload) return;
    const file = e.target.files?.[0];
    if (file) {
      onDirectNoscaUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isAuthorizedToUpload) return;
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
      {isAuthorizedToUpload && (
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
        background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
        borderRadius: '16px',
        border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line, #e2e8f0)',
        padding: '24px 28px',
        boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 2px 12px rgba(0, 0, 0, 0.04)',
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
              {isAuthorizedToUpload ? 'NOSCA Upload & Item Number Tracking' : 'NOSCA & Plantilla Item Tracking'}
            </h2>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isAuthorizedToUpload && (
              <button
                type="button"
                onClick={onOpenNoscaScanModal}
                disabled={scanningNosca}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#ffffff',
                  cursor: scanningNosca ? 'not-allowed' : 'pointer',
                  fontWeight: 750,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                  transition: 'all 0.15s ease',
                  opacity: scanningNosca ? 0.75 : 1
                }}
                title="Upload official DBM NOSCA PDF and review allocations"
              >
                {scanningNosca ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Scanning NOSCA...</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    <span>{scannedNoscaResult ? `Manage NOSCA (${selectedNoscaItemsCount || 0}/${scannedNoscaResult.count || 0})` : 'Upload & Scan NOSCA'}</span>
                  </>
                )}
              </button>
            )}

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

          </div>
        </div>

        {/* 4 KPI Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px'
        }}>
          {/* Metric 1: Total Candidates for Reclassification */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: isDark ? 'rgba(30, 58, 138, 0.25)' : '#eff6ff',
            border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#93c5fd' : '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Candidates for Reclassification
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#bfdbfe' : '#1e40af', margin: '4px 0 2px' }}>
              {sdoMetrics.total}
            </div>
            <div style={{ fontSize: '11.5px', color: isDark ? '#93c5fd' : '#2563eb' }}>
              Transmitted to DBM RO
            </div>
          </div>

          {/* Metric 2: Total Reclassification Item */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: isDark ? 'rgba(6, 95, 70, 0.25)' : '#ecfdf5',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid #a7f3d0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#6ee7b7' : '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Reclassification Item
              </span>
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

          {/* Metric 3: Pending Reclassification */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: isDark ? 'rgba(180, 83, 9, 0.2)' : '#fffbeb',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#fde68a' : '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pending Reclassification
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#fef3c7' : '#b45309', margin: '4px 0 2px' }}>
              {sdoMetrics.pending}
            </div>
            <div style={{ fontSize: '11.5px', color: isDark ? '#fde68a' : '#d97706' }}>
              {isAuthorizedToUpload ? 'Awaiting NOSCA upload or item link' : 'Awaiting plantilla item assignment'}
            </div>
          </div>

          {/* Metric 4: RO Plantilla Items Registered */}
          <div
            onClick={() => setShowAvailableModal(true)}
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: isDark ? 'rgba(79, 70, 229, 0.2)' : '#f5f3ff',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #ddd6fe',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            title="Click to view list of Available Item Numbers"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#c7d2fe' : '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                RO Plantilla Items
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAvailableModal(true);
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 750,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(99, 102, 241, 0.35)' : '#e0e7ff',
                  color: isDark ? '#c7d2fe' : '#4338ca',
                  border: isDark ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid #c7d2fe',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  transition: 'all 0.15s ease'
                }}
                title="Click to view list of available item numbers"
              >
                <span>{roAvailableCount} Available</span>
                <span style={{ fontSize: '11px' }}>↗</span>
              </button>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#e0e7ff' : '#3730a3', margin: '4px 0 2px' }}>
              {noscaItems.length}
            </div>
            <div style={{ fontSize: '11.5px', color: isDark ? '#c7d2fe' : '#4f46e5', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>Added by Regional Office</span>
              <span>•</span>
              <span style={{ fontWeight: 750 }}>{noscaDocuments.length} PDF archives</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone Banner (Interactive for Regional Office only) */}
      {isAuthorizedToUpload && (
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
                The system scans the PDF, extracts each <b>NEW Item No.</b>, matches them to candidates transmitted to DBM RO, and archives the document as a transaction record.
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
              Personnel Registry — DBM Transmitted Candidates
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
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '11.5px',
            tableLayout: 'auto'
          }}>
            <thead>
              <tr style={{
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
                borderBottom: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--line)',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '10px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                lineHeight: 1.25
              }}>
                <th style={{ padding: '9px 6px', width: '32px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '9px 8px', textAlign: 'left' }}>Personnel &amp; Email</th>
                <th style={{ padding: '9px 8px', textAlign: 'left' }}>Current Position &amp; Item</th>
                <th style={{ padding: '9px 8px', textAlign: 'left' }}>Actual Reclass Position</th>
                <th style={{ padding: '9px 8px', textAlign: 'left' }}>NEW Item No. (NOSCA)</th>
                <th style={{ padding: '9px 8px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedSdoEndorsees.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary, #94a3b8)' }}>
                    <div style={{ fontSize: '30px', marginBottom: '8px' }}>📋</div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text)' }}>
                      No personnel currently matching criteria.
                    </div>
                    <div style={{ fontSize: '11.5px', marginTop: '4px', maxWidth: '440px', marginInline: 'auto' }}>
                      Personnel whose Stage of Reclassification is set to "Endorsed to DBM RO" or "Approved" in the Assessment Workbench will appear here for NOSCA linking.
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
                      <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', fontWeight: 650, fontSize: '11px' }}>
                        {rowNum}
                      </td>

                      {/* 2. Personnel (Name & Email) */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 750, color: 'var(--text)', fontSize: '12.5px' }}>
                          {inc.full_name === '#N/A' ? 'Unassigned Plantilla' : (inc.full_name || '—')}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary, #64748b)',
                          marginTop: '2px',
                          wordBreak: 'break-all'
                        }}>
                          {inc.email || '—'}
                        </div>
                      </td>

                      {/* 3. Current Position & Item / SG */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '11.5px', lineHeight: 1.25 }}>
                          {inc.current_position || '—'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {inc.plantilla_item_number && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '1.5px 6px',
                              borderRadius: '4px',
                              background: isDark ? 'rgba(51, 65, 85, 0.4)' : '#f1f5f9',
                              border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                              fontFamily: 'monospace',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: isDark ? '#cbd5e1' : '#334155'
                            }} title="Current / Previous Plantilla Item No.">
                              {inc.plantilla_item_number}
                            </span>
                          )}
                          {inc.salary_grade && (
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              color: isDark ? '#93c5fd' : '#1e40af',
                              background: isDark ? 'rgba(30, 58, 138, 0.3)' : '#eff6ff',
                              border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              display: 'inline-block'
                            }}>
                              SG {inc.salary_grade}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Actual Reclassification Position */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                          color: isDark ? '#6ee7b7' : '#047857',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                          fontSize: '10.5px',
                          fontWeight: 750,
                          lineHeight: 1.25,
                          maxWidth: '100%',
                          wordBreak: 'break-word'
                        }}>
                          {inc.actual_position || inc.reclass_position || inc.target_position || 'School Counselor Associate I'}
                        </span>
                      </td>

                      {/* 6. NEW Item No. (from NOSCA) */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                        {hasNewItem ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              background: isDark ? 'rgba(16, 185, 129, 0.22)' : '#dcfce7',
                              border: isDark ? '1.5px solid rgba(16, 185, 129, 0.55)' : '1.5px solid #86efac',
                              color: isDark ? '#6ee7b7' : '#15803d',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '11px',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.12)'
                            }}>
                              <span>✨</span>
                              <span>{inc.new_item_number}</span>
                            </span>
                            {inc.nosca_serial_no && (
                              inc.nosca_file_url ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetFullScreenDoc({
                                      open: true,
                                      title: inc.nosca_file_name || `DBM NOSCA (${inc.nosca_serial_no})`,
                                      url: inc.nosca_file_url
                                    });
                                  }}
                                  style={{
                                    fontSize: '9.5px',
                                    color: isDark ? '#93c5fd' : '#2563eb',
                                    fontFamily: 'monospace',
                                    padding: '1px 3px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    textAlign: 'left'
                                  }}
                                  title="View official retained NOSCA document"
                                >
                                  Ref: {inc.nosca_serial_no} ↗
                                </button>
                              ) : (
                                <span style={{ fontSize: '9.5px', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace', paddingLeft: '4px' }}>
                                  Ref: {inc.nosca_serial_no}
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '5px',
                            background: isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
                            border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a',
                            color: isDark ? '#fde047' : '#b45309',
                            fontSize: '10px',
                            fontWeight: 750,
                            whiteSpace: 'nowrap'
                          }}>
                            <span>⏳</span> Pending NOSCA
                          </span>
                        )}
                      </td>

                      {/* 7. Tracking Status */}
                      <td style={{ padding: '8px 8px', verticalAlign: 'middle' }}>
                        {hasNewItem ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(6, 95, 70, 0.3)' : '#ecfdf5',
                            color: isDark ? '#34d399' : '#047857',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                            fontSize: '10px',
                            fontWeight: 800,
                            whiteSpace: 'nowrap'
                          }}>
                            ✓ NOSCA Assigned
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(234, 179, 8, 0.2)' : '#fffbeb',
                            color: isDark ? '#facc15' : '#b45309',
                            border: isDark ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid #fde68a',
                            fontSize: '10px',
                            fontWeight: 800,
                            whiteSpace: 'nowrap'
                          }}>
                            ⏳ Pending Upload
                          </span>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td style={{ padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {isAuthorizedToAssign && (
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
                              padding: '4.5px 10px',
                              borderRadius: '6px',
                              background: inc.new_item_number
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                                : (isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff'),
                              border: inc.new_item_number
                                ? (isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0')
                                : (isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe'),
                              color: inc.new_item_number
                                ? (isDark ? '#6ee7b7' : '#059669')
                                : (isDark ? '#93c5fd' : '#1d4ed8'),
                              fontSize: '11px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4.5px',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease'
                            }}
                            title={inc.new_item_number ? "Update candidate appointment details" : "Appoint candidate to plantilla item"}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <polyline points="16 11 18 13 22 9" />
                            </svg>
                            <span>Appoint</span>
                          </button>
                        )}
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

      {/* SUB-MODAL 1: LINK / EDIT NEW ITEM NUMBER (Division HRMO only) */}
      {isAuthorizedToAssign && sdoEditItemModal.open && sdoEditItemModal.personnel && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingSdoItem) {
              setSdoEditItemModal({ open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' });
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: isDark ? 'rgba(2, 6, 23, 0.82)' : 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 999999,
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
                  Appoint & Assign Plantilla Item
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                  Candidate: <b>{sdoEditItemModal.personnel?.full_name || 'Select candidate below'}</b> {sdoEditItemModal.personnel?.employee_id ? `(${sdoEditItemModal.personnel.employee_id})` : ''}
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
              {sdoEndorsees.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                    Select Candidate for Plantilla Assignment <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={sdoEditItemModal.personnel?.id || ''}
                    onChange={(e) => {
                      const chosen = sdoEndorsees.find(c => String(c.id) === String(e.target.value));
                      if (chosen) {
                        setSdoEditItemModal(prev => ({ ...prev, personnel: chosen }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                      background: isDark ? '#1e293b' : '#ffffff',
                      color: 'var(--text)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {sdoEndorsees.map(cand => (
                      <option key={cand.id} value={cand.id}>
                        {cand.full_name} ({cand.employee_id}) — {cand.station_division || cand.division || 'SDO'} {cand.new_item_number ? `[Assigned: ${cand.new_item_number}]` : '[⏳ Pending Item]'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  Remove Appointment
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
                  {savingSdoItem ? 'Saving...' : 'Save Appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SUB-MODAL 2: NOSCA DOCUMENTS ARCHIVE */}
      {showNoscaDocsArchiveModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNoscaDocsArchiveModal(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 999999,
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
                                  url: doc.file_url || null
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
        </div>,
        document.body
      )}

      {/* POPUP MODAL: AVAILABLE PLANTILLA ITEM NUMBERS */}
      {showAvailableModal && typeof document !== 'undefined' && createPortal(
        <>
          <style>{`
            @keyframes modalBackdropFadeIn {
              from { opacity: 0; backdrop-filter: blur(0px); }
              to { opacity: 1; backdrop-filter: blur(16px); }
            }
            @keyframes modalCardPopIn {
              0% {
                opacity: 0;
                transform: scale(0.94) translateY(14px);
              }
              100% {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
            .agap-modal-scrollbar::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            .agap-modal-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .agap-modal-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.35);
              border-radius: 999px;
            }
            .agap-modal-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.65);
            }
          `}</style>
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAvailableModal(false);
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              background: isDark ? 'rgba(3, 7, 18, 0.82)' : 'rgba(15, 23, 42, 0.68)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              padding: '24px 16px',
              animation: 'modalBackdropFadeIn 0.22s ease-out'
            }}
          >
            <div
              style={{
                background: isDark ? '#0f172a' : '#ffffff',
                borderRadius: '24px',
                width: 'min(1140px, 96vw)',
                maxHeight: '88vh',
                boxShadow: isDark
                  ? '0 30px 90px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.12)'
                  : '0 30px 80px -15px rgba(15, 23, 42, 0.38), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'modalCardPopIn 0.26s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Top Accent Gradient Line */}
              <div style={{
                height: '4px',
                width: '100%',
                background: 'linear-gradient(90deg, #059669 0%, #10b981 30%, #3b82f6 70%, #6366f1 100%)'
              }} />

              {/* Modal Header */}
              <div style={{
                padding: '20px 28px',
                borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '13px',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)',
                    flexShrink: 0
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <path d="M9 12h6" />
                      <path d="M9 16h6" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2.5px 8px',
                        borderRadius: '999px',
                        background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                        color: isDark ? '#6ee7b7' : '#15803d',
                        border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #86efac',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#10b981',
                          display: 'inline-block',
                          boxShadow: '0 0 6px #10b981'
                        }} />
                        Unassigned Inventory
                      </span>
                      <h3 style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.02em' }}>
                        Available Plantilla Item Numbers
                      </h3>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748b)', marginTop: '3px' }}>
                      Showing <b>{availableItemsList.length}</b> of <b>{roAvailableCount}</b> unassigned items ready for candidate assignment.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAvailableModal(false)}
                  style={{
                    background: isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9',
                    border: isDark ? '1px solid rgba(71, 85, 105, 0.7)' : '1px solid #cbd5e1',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'grid',
                    placeItems: 'center',
                    color: isDark ? '#94a3b8' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.16s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = isDark ? '#ef4444' : '#fee2e2';
                    e.currentTarget.style.color = isDark ? '#ffffff' : '#dc2626';
                    e.currentTarget.style.borderColor = '#ef4444';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9';
                    e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b';
                    e.currentTarget.style.borderColor = isDark ? 'rgba(71, 85, 105, 0.7)' : '#cbd5e1';
                  }}
                  title="Close (Esc)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Search & Filter Toolbar */}
              <div style={{
                padding: '12px 28px',
                borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #f1f5f9',
                background: isDark ? 'rgba(30, 41, 59, 0.45)' : '#fbfcfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                flexWrap: 'wrap'
              }}>
                <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
                  <input
                    type="text"
                    placeholder="Search by item no., position, station, division..."
                    value={availSearchTerm}
                    onChange={(e) => setAvailSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 32px 0 38px',
                      borderRadius: '10px',
                      fontSize: '12.5px',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                      background: isDark ? '#1e293b' : '#ffffff',
                      color: 'var(--text)',
                      outline: 'none',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : '#cbd5e1';
                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                    }}
                  />
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{
                    position: 'absolute',
                    left: '13px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary, #94a3b8)',
                    pointerEvents: 'none'
                  }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  {availSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setAvailSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '11px',
                        padding: 0
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filter Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Category:
                  </span>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#e2e8f0',
                    padding: '3px',
                    borderRadius: '10px',
                    gap: '2px'
                  }}>
                    {[
                      { key: 'ALL', label: 'All', count: availCategoryCounts.ALL },
                      { key: 'ELEMENTARY', label: 'Elementary', count: availCategoryCounts.ELEMENTARY },
                      { key: 'JHS', label: 'JHS', count: availCategoryCounts.JHS },
                      { key: 'SHS', label: 'SHS', count: availCategoryCounts.SHS }
                    ].map(({ key, label, count }) => {
                      const isActive = availCategoryFilter === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAvailCategoryFilter(key)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 750,
                            cursor: 'pointer',
                            border: 'none',
                            background: isActive
                              ? (isDark ? '#2563eb' : '#2563eb')
                              : 'transparent',
                            color: isActive ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569'),
                            boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                            transition: 'all 0.16s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span>{label}</span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '999px',
                            background: isActive
                              ? 'rgba(255, 255, 255, 0.25)'
                              : (isDark ? 'rgba(51, 65, 85, 0.8)' : '#cbd5e1'),
                            color: isActive ? '#ffffff' : 'var(--text-secondary, #64748b)'
                          }}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Body: Available Items Table */}
              <div className="agap-modal-scrollbar" style={{ padding: '0', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: '200px', maxHeight: '500px' }}>
                {availableItemsList.length === 0 ? (
                  <div style={{ padding: '52px 24px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                      display: 'grid',
                      placeItems: 'center',
                      margin: '0 auto 14px',
                      color: 'var(--text-secondary, #64748b)'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>
                      {roAvailableCount === 0
                        ? 'No available plantilla item numbers found.'
                        : 'No available items match your search filter.'}
                    </div>
                    <div style={{ fontSize: '12.5px', marginTop: '6px', maxWidth: '440px', marginInline: 'auto', color: 'var(--text-secondary, #64748b)' }}>
                      {roAvailableCount === 0
                        ? 'Upload a DBM NOSCA document or add item numbers to populate available plantilla items.'
                        : 'Try adjusting your search keyword or selecting "All" categories.'}
                    </div>
                    {(availSearchTerm || availCategoryFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvailSearchTerm('');
                          setAvailCategoryFilter('ALL');
                        }}
                        style={{
                          marginTop: '16px',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          background: isDark ? '#1e293b' : '#f1f5f9',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                          color: 'var(--text)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', tableLayout: 'auto' }}>
                    <thead>
                      <tr style={{
                        background: isDark ? 'rgba(30, 41, 59, 0.95)' : '#f8fafc',
                        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        color: 'var(--text-secondary, #64748b)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        <th style={{ padding: '13px 14px', textAlign: 'center', width: '48px', whiteSpace: 'nowrap' }}>#</th>
                        <th style={{ padding: '13px 18px', textAlign: 'left', minWidth: '240px', whiteSpace: 'nowrap' }}>Plantilla Item Number</th>
                        <th style={{ padding: '13px 14px', textAlign: 'left', minWidth: '120px', whiteSpace: 'nowrap' }}>Category</th>
                        <th style={{ padding: '13px 16px', textAlign: 'left', minWidth: '200px', whiteSpace: 'nowrap' }}>Position Title</th>
                        <th style={{ padding: '13px 16px', textAlign: 'left', minWidth: '180px', whiteSpace: 'nowrap' }}>Station / Division</th>
                        <th style={{ padding: '13px 14px', textAlign: 'center', width: '120px', whiteSpace: 'nowrap' }}>Status</th>
                        {isAuthorizedToAssign && (
                          <th style={{ padding: '13px 20px', textAlign: 'right', minWidth: '170px', whiteSpace: 'nowrap' }}>Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {availableItemsList.map((item, idx) => {
                        const itemNoStr = item.plantilla_item_number || item.new_item_no || '—';
                        const isCopied = copiedAvailItemNo === itemNoStr;
                        const isSecondary = item.category === 'JHS' || item.category === 'SHS';
                        return (
                          <tr
                            key={item.id || idx}
                            style={{
                              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.35)' : '1px solid #f1f5f9',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '13px 14px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700, fontSize: '11.5px' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '13px 18px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  fontSize: '12px',
                                  color: isDark ? '#38bdf8' : '#0369a1',
                                  background: isDark ? 'rgba(14, 165, 233, 0.15)' : '#f0f9ff',
                                  border: isDark ? '1px solid rgba(14, 165, 233, 0.35)' : '1px solid #bae6fd',
                                  padding: '4px 10px',
                                  borderRadius: '7px',
                                  letterSpacing: '0.02em',
                                  boxShadow: isDark ? 'none' : '0 1px 2px rgba(3, 105, 161, 0.05)'
                                }}>
                                  {itemNoStr}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyAvailItemNo(itemNoStr)}
                                  style={{
                                    background: isCopied
                                      ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7')
                                      : (isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9'),
                                    border: isCopied
                                      ? (isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #86efac')
                                      : (isDark ? '1px solid rgba(71, 85, 105, 0.6)' : '1px solid #cbd5e1'),
                                    cursor: 'pointer',
                                    padding: '4px 9px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: isCopied ? (isDark ? '#6ee7b7' : '#15803d') : 'var(--text-secondary, #64748b)',
                                    borderRadius: '7px',
                                    transition: 'all 0.15s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Copy item number to clipboard"
                                >
                                  {isCopied ? (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                      </svg>
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '13px 14px' }}>
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: isSecondary
                                  ? (isDark ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff')
                                  : (isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff'),
                                color: isSecondary
                                  ? (isDark ? '#c084fc' : '#7e22ce')
                                  : (isDark ? '#93c5fd' : '#1d4ed8'),
                                border: isSecondary
                                  ? (isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid #d8b4fe')
                                  : (isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe')
                              }}>
                                {item.category || 'ELEMENTARY'}
                              </span>
                            </td>
                            <td style={{ padding: '13px 16px' }}>
                              <div style={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 750, fontSize: '12.5px' }}>
                                {item.position_title || item.position || 'School Counselor Associate I'}
                              </div>
                              {item.salary_grade && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  marginTop: '2px',
                                  display: 'inline-block'
                                }}>
                                  Salary Grade {item.salary_grade}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '13px 16px' }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: 'var(--text-secondary, #64748b)',
                                fontSize: '12px',
                                fontWeight: 600
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.65 }}>
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>{item.division || item.station_division || item.school_name || 'Regional Office Pool'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '13px 14px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3.5px 10px',
                                borderRadius: '999px',
                                background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                                color: isDark ? '#6ee7b7' : '#059669',
                                border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0',
                                fontSize: '10.5px',
                                fontWeight: 800,
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                Available
                              </span>
                            </td>
                            {isAuthorizedToAssign && (
                              <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAvailableModal(false);
                                    const pendingCandidate = sdoEndorsees.find(c => !c.new_item_number) || sdoEndorsees[0] || null;
                                    setSdoEditItemModal({
                                      open: true,
                                      personnel: pendingCandidate,
                                      newItemNumber: itemNoStr,
                                      serialNo: item.serial_no || '',
                                      fileName: item.nosca_file_name || ''
                                    });
                                  }}
                                  style={{
                                    padding: '6.5px 14px',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontSize: '11.5px',
                                    fontWeight: 750,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.32)',
                                    whiteSpace: 'nowrap',
                                    transition: 'transform 0.12s ease, box-shadow 0.15s ease'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.45)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.32)';
                                  }}
                                  title="Assign this item number to an SDO candidate"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                  <span>Assign to Candidate</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 28px',
                borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', fontWeight: 650 }}>
                    Total Available Plantilla Items:
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '2.5px 9px',
                    borderRadius: '6px',
                    background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                    color: isDark ? '#6ee7b7' : '#15803d',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #86efac'
                  }}>
                    {roAvailableCount} Items
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAvailableModal(false)}
                  style={{
                    padding: '8px 24px',
                    borderRadius: '10px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                    background: isDark ? '#1e293b' : '#ffffff',
                    color: 'var(--text)',
                    fontSize: '12.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = isDark ? '#334155' : '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.background = isDark ? '#1e293b' : '#ffffff'}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
