import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../config/api.js';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import { useTheme } from '../../../middleware/ThemeProvider.jsx';
import ThemeToggle from '../../../components/ThemeToggle.jsx';
import agadLogo from '../../../agadlogo.png';

export default function TeacherHiringModule({ onBack }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { setToast } = useToast();

  // Workflow steps: 1 = Upload, 2 = Review Table, 3 = Item Appointments
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Upload state
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 2: Review Table state
  const [batchData, setBatchData] = useState(null);
  const [reviewRows, setReviewRows] = useState([]);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [validationFilter, setValidationFilter] = useState('all');

  // Step 3: Plantilla Item Appointment state
  const [teacherItems, setTeacherItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedApplicantCode, setSelectedApplicantCode] = useState(null);
  const [isAppointing, setIsAppointing] = useState(false);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [isPipelineFinalized, setIsPipelineFinalized] = useState(false);

  // Fetch available teacher items
  const loadTeacherItems = async () => {
    setIsLoadingItems(true);
    try {
      const items = await apiFetch('/api/applications/teacher-hiring/items');
      if (Array.isArray(items)) {
        setTeacherItems(items);
      }
    } catch (err) {
      console.warn('[Teacher Hiring] Fallback items loading:', err);
      // Fallback local items if offline
      setTeacherItems([
        { id: 'item-1', item_code: 'T1-NCR-MNL-001', school_name: 'Manila High School', division: 'SDO Manila', position_title: 'Teacher I', is_filled: false },
        { id: 'item-2', item_code: 'T1-NCR-MNL-002', school_name: 'Araullo High School', division: 'SDO Manila', position_title: 'Teacher I', is_filled: false },
        { id: 'item-3', item_code: 'T1-NCR-QC-001', school_name: 'Quezon City High School', division: 'SDO Quezon City', position_title: 'Teacher I', is_filled: false }
      ]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    loadTeacherItems();
  }, []);

  // Poll background job status
  useEffect(() => {
    if (!jobId || !isUploading) return;

    const interval = setInterval(async () => {
      try {
        const job = await apiFetch(`/api/applications/teacher-hiring/jobs/${jobId}`);
        setUploadProgress(job.progress_pct || 65);

        if (job.status === 'parsed') {
          clearInterval(interval);
          setIsUploading(false);
          setBatchId(job.jobId);
          setToast({ message: `CAR CSV parsed successfully (${job.valid_rows} valid, ${job.invalid_rows} invalid)`, type: job.invalid_rows > 0 ? 'warning' : 'success' });
          fetchBatchReview(job.jobId);
          setCurrentStep(2);
        } else if (job.status === 'error') {
          clearInterval(interval);
          setIsUploading(false);
          setToast({ message: job.error_message || 'Error parsing CAR CSV', type: 'error' });
        }
      } catch (err) {
        console.error('[CAR Polling Error]', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, isUploading]);

  // Fetch batch rows for pre-commit review table
  const fetchBatchReview = async (bId) => {
    setIsLoadingReview(true);
    try {
      const data = await apiFetch(`/api/applications/teacher-hiring/batches/${bId}/review`);
      setBatchData(data.batch);
      setReviewRows(data.rows || []);
    } catch (err) {
      console.error('[CAR Review Error]', err);
      setToast({ message: 'Failed to fetch batch review rows', type: 'error' });
    } finally {
      setIsLoadingReview(false);
    }
  };

  // Handle Template Download
  const handleDownloadTemplate = () => {
    const token = localStorage.getItem('agap_token') || sessionStorage.getItem('agap_token');
    const url = `/api/applications/teacher-hiring/template${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    window.open(url, '_blank');
    setToast({ message: 'Downloading official CAR CSV template...', type: 'info' });
  };

  // Handle File Selection and Upload
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processSelectedFile(selected);
  };

  const processSelectedFile = (selectedFile) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setToast({ message: 'Please select a valid .csv file format', type: 'error' });
      return;
    }
    setFile(selectedFile);
    setFileName(selectedFile.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (!text) return;

      setIsUploading(true);
      setUploadProgress(20);

      try {
        const res = await apiFetch('/api/applications/teacher-hiring/upload-car', {
          method: 'POST',
          body: JSON.stringify({
            csvContent: text,
            fileName: selectedFile.name
          })
        });

        setJobId(res.jobId);
        setUploadProgress(45);
      } catch (err) {
        setIsUploading(false);
        setToast({ message: err.message || 'Failed to upload CAR file', type: 'error' });
      }
    };
    reader.readAsText(selectedFile);
  };

  // Helper to load demonstration CSV
  const handleLoadDemoCsv = (isErrorDemo = false) => {
    const content = isErrorDemo
      ? [
          'Applicant Code,Applicant Name,Item Reference,Education Score,Training Score,Experience Score,PBET/LET Score,Interview Score,Total Rating',
          'TCHR-2026-001,"Cruz, Maria Santos",T1-NCR-MNL-001,15,10,8,22.5,18,73.5',
          'TCHR-2026-002,"Reyes, Juan Dela",INVALID-ITEM-CODE-999,14,8.5,10,24,19,75.5',
          'TCHR-2026-003,"Bautista, Elena Joy",T1-NCR-QC-001,16,9,9.5,28,17.5,80.0',
          'TCHR-2026-001,"Duplicate Entry Santos",T1-NCR-MNL-002,12,8,7,20,15,62.0'
        ].join('\r\n')
      : [
          'Applicant Code,Applicant Name,Item Reference,Education Score,Training Score,Experience Score,PBET/LET Score,Interview Score,Total Rating',
          'TCHR-2026-001,"Cruz, Maria Santos",T1-NCR-MNL-001,15,10,8,22.5,18,73.5',
          'TCHR-2026-002,"Reyes, Juan Dela",T1-NCR-MNL-002,14,8.5,10,24,19,75.5',
          'TCHR-2026-003,"Bautista, Elena Joy",T1-NCR-QC-001,13.5,9,9.5,23,17.5,72.5',
          'TCHR-2026-004,"Villanueva, Paolo Marco",T1-NCR-QC-002,12.5,10,9,21,18,70.5'
        ].join('\r\n');

    const demoName = isErrorDemo ? 'CAR_Demo_With_Validation_Errors.csv' : 'CAR_Valid_Submission.csv';
    const blob = new Blob([content], { type: 'text/csv' });
    const demoFile = new File([blob], demoName, { type: 'text/csv' });
    processSelectedFile(demoFile);
  };

  // Handle Pre-Commit Confirmation
  const handleConfirmBatch = async () => {
    if (!batchId) return;
    if (batchData?.invalid_rows > 0) {
      setToast({
        message: `Cannot commit: ${batchData.invalid_rows} invalid row(s) detected. Fix errors and re-upload.`,
        type: 'error'
      });
      return;
    }

    setIsConfirming(true);
    try {
      await apiFetch(`/api/applications/teacher-hiring/batches/${batchId}/confirm`, {
        method: 'POST'
      });

      setBatchData(prev => ({ ...(prev || {}), status: 'committed' }));
      setToast({ message: 'CAR batch confirmed and committed! Proceed to Plantilla Item Appointment.', type: 'success' });
      setCurrentStep(3);
      loadTeacherItems();
    } catch (err) {
      setToast({ message: err.message || 'Failed to confirm batch', type: 'error' });
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle Strict 1-to-1 Plantilla Appointment
  const handleAppoint = async () => {
    if (!selectedItemId || !selectedApplicantCode) {
      setToast({ message: 'Please select both an unfilled plantilla item and an applicant', type: 'warning' });
      return;
    }

    const selectedItem = teacherItems.find(i => i.id === selectedItemId);
    const selectedApplicant = reviewRows.find(r => r.applicant_code === selectedApplicantCode);

    if (!selectedItem || !selectedApplicant) return;

    if (selectedItem.is_filled) {
      setToast({ message: `Item ${selectedItem.item_code} has already been filled.`, type: 'warning' });
      return;
    }

    if (selectedApplicant.is_appointed) {
      setToast({ message: `Applicant ${selectedApplicant.applicant_name} is already appointed.`, type: 'warning' });
      return;
    }

    setIsAppointing(true);
    try {
      const res = await apiFetch('/api/applications/teacher-hiring/appointments', {
        method: 'POST',
        body: JSON.stringify({
          batchId,
          carResultId: selectedApplicant.id,
          itemId: selectedItemId,
          applicantCode: selectedApplicant.applicant_code,
          applicantName: selectedApplicant.applicant_name
        })
      });

      setToast({
        message: `Successfully appointed ${selectedApplicant.applicant_name} to ${selectedItem.item_code}!`,
        type: 'success'
      });

      // Mark item as filled with applicant details
      setTeacherItems(prev => prev.map(i => i.id === selectedItemId ? {
        ...i,
        is_filled: true,
        appointed_to_name: selectedApplicant.applicant_name,
        appointed_to_code: selectedApplicant.applicant_code
      } : i));

      // Mark applicant as appointed with item details
      setReviewRows(prev => prev.map(r => r.applicant_code === selectedApplicantCode ? {
        ...r,
        is_appointed: true,
        appointed_item_code: selectedItem.item_code,
        appointed_school_name: selectedItem.school_name
      } : r));

      setRecentAppointments(prev => [
        {
          applicantCode: selectedApplicant.applicant_code,
          applicantName: selectedApplicant.applicant_name,
          itemCode: selectedItem.item_code,
          schoolName: selectedItem.school_name,
          appointedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ]);

      setSelectedItemId(null);
      setSelectedApplicantCode(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to appoint applicant to item', type: 'error' });
    } finally {
      setIsAppointing(false);
    }
  };

  // Filtered review rows
  const filteredReviewRows = useMemo(() => {
    return reviewRows.filter(r => {
      const matchSearch =
        !tableSearch ||
        r.applicant_name?.toLowerCase().includes(tableSearch.toLowerCase()) ||
        r.applicant_code?.toLowerCase().includes(tableSearch.toLowerCase()) ||
        r.item_reference?.toLowerCase().includes(tableSearch.toLowerCase());

      const matchStatus =
        validationFilter === 'all' ||
        (validationFilter === 'valid' && r.validation_status === 'valid') ||
        (validationFilter === 'invalid' && r.validation_status === 'invalid');

      return matchSearch && matchStatus;
    });
  }, [reviewRows, tableSearch, validationFilter]);

  const hasInvalidRows = (batchData?.invalid_rows || 0) > 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background-color 0.25s ease, color 0.25s ease'
    }}>
      {/* Top Bar */}
      <header style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--line)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '999px',
              background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              fontSize: '12.5px',
              fontWeight: 750,
              cursor: 'pointer',
              boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 1px 4px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.18s ease'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateX(-2px)';
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.borderColor = 'var(--line)';
            }}
          >
            <span>←</span> Switch Module
          </button>

          <div style={{ height: '22px', width: '1px', background: 'var(--line)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={agadLogo} alt="AGAP Logo" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                  color: isDark ? '#34d399' : '#059669',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase'
                }}>
                  DepEd Order No. 007, s. 2023
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Teacher Hiring Pipeline</span>
              </div>
              <h2 style={{ fontSize: '15.5px', fontWeight: 850, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Comparative Assessment Result (CAR) & Item Allocation
              </h2>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)' }}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
            <ThemeToggle variant="switch" />
          </div>

          <div style={{
            fontSize: '12px',
            color: 'var(--text)',
            background: 'var(--card-subtle)',
            border: '1px solid var(--line)',
            padding: '6px 14px',
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              flexShrink: 0
            }} />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span style={{ fontWeight: 750, color: 'var(--text)' }}>
              {(user?.firstName || user?.lastName)
                ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                : (user?.fullName || user?.username || 'HRMO Officer')}
            </span>
            {[user?.region, user?.division].filter(Boolean).length > 0 && (
              <>
                <span style={{ color: 'var(--line)' }}>•</span>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>
                  {[user?.region, user?.division].filter(Boolean).join(' • ')}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 28px 60px', width: '100%' }}>
        {/* Step Completion Calculation */}
        {(() => {
          const isStep1Done = Boolean(batchId);
          const isStep2Done = Boolean(currentStep >= 3 || batchData?.status === 'committed');
          const isStep3Done = Boolean(
            isPipelineFinalized ||
            (reviewRows.length > 0 && reviewRows.every(r => r.is_appointed)) ||
            (teacherItems.length > 0 && teacherItems.every(i => i.is_filled) && recentAppointments.length > 0)
          );
          const isAllChecked = isStep1Done && isStep2Done && isStep3Done;

          return (
            <>
              {/* Modern Connected Step Stepper */}
              <div style={{
                background: 'var(--card)',
                borderRadius: '16px',
                border: '1px solid var(--line)',
                padding: '12px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: isDark ? '0 8px 28px rgba(0, 0, 0, 0.35)' : '0 2px 12px rgba(0, 0, 0, 0.03)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)'
              }}>
                {/* Step 1: CAR CSV Ingestion */}
                <div
                  onClick={() => setCurrentStep(1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: currentStep === 1
                      ? (isDark ? 'rgba(5, 150, 105, 0.16)' : '#ecfdf5')
                      : (isStep1Done ? (isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-subtle)') : 'transparent'),
                    border: currentStep === 1
                      ? (isDark ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid #a7f3d0')
                      : (isStep1Done ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0') : '1px solid var(--line)'),
                    boxShadow: currentStep === 1
                      ? (isDark ? '0 0 16px rgba(16, 185, 129, 0.25)' : '0 2px 10px rgba(5, 150, 105, 0.15)')
                      : 'none',
                    transition: 'all 0.25s ease',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: isStep1Done
                      ? (currentStep === 1 ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : '#059669')
                      : (currentStep === 1 ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : (isDark ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0')),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    boxShadow: currentStep === 1 ? '0 0 0 3.5px rgba(16, 185, 129, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    {isStep1Done ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : '1'}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: currentStep === 1 ? (isDark ? '#34d399' : '#047857') : 'var(--text)',
                      lineHeight: 1.2
                    }}>
                      CAR CSV Ingestion
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: currentStep === 1 ? (isDark ? '#a7f3d0' : '#059669') : 'var(--muted)',
                      fontWeight: 500,
                      marginTop: '1px'
                    }}>
                      {isStep1Done ? 'Batch Ingested' : 'Template & Parser'}
                    </div>
                  </div>
                </div>

                {/* Connector Line 1 -> 2 */}
                <div style={{
                  flex: 1,
                  minWidth: '36px',
                  height: '4px',
                  borderRadius: '999px',
                  background: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: (currentStep >= 2 || isStep1Done) ? '100%' : '0%',
                    background: 'linear-gradient(90deg, #059669, #10b981)',
                    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                  }} />
                </div>

                {/* Step 2: Pre-Commit Audit */}
                <div
                  onClick={() => batchId && setCurrentStep(2)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: batchId ? 'pointer' : 'not-allowed',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: currentStep === 2
                      ? (isDark ? 'rgba(5, 150, 105, 0.16)' : '#ecfdf5')
                      : (isStep2Done ? (isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-subtle)') : 'transparent'),
                    border: currentStep === 2
                      ? (isDark ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid #a7f3d0')
                      : (isStep2Done ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0') : '1px solid var(--line)'),
                    boxShadow: currentStep === 2
                      ? (isDark ? '0 0 16px rgba(16, 185, 129, 0.25)' : '0 2px 10px rgba(5, 150, 105, 0.15)')
                      : 'none',
                    opacity: batchId ? 1 : 0.6,
                    transition: 'all 0.25s ease',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: isStep2Done
                      ? (currentStep === 2 ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : '#059669')
                      : (currentStep === 2 ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : (isDark ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0')),
                    color: (currentStep === 2 || isStep2Done) ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    boxShadow: currentStep === 2 ? '0 0 0 3.5px rgba(16, 185, 129, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    {isStep2Done ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : '2'}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: currentStep === 2 ? (isDark ? '#34d399' : '#047857') : 'var(--text)',
                      lineHeight: 1.2
                    }}>
                      Pre-Commit Audit
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: currentStep === 2 ? (isDark ? '#a7f3d0' : '#059669') : 'var(--muted)',
                      fontWeight: 500,
                      marginTop: '1px'
                    }}>
                      {isStep2Done ? 'Audit Verified' : 'Inline Rules & Scores'}
                    </div>
                  </div>
                </div>

                {/* Connector Line 2 -> 3 */}
                <div style={{
                  flex: 1,
                  minWidth: '36px',
                  height: '4px',
                  borderRadius: '999px',
                  background: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: (currentStep >= 3 || isStep2Done) ? '100%' : '0%',
                    background: 'linear-gradient(90deg, #059669, #10b981)',
                    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                  }} />
                </div>

                {/* Step 3: Plantilla Appointments */}
                <div
                  onClick={() => (isStep2Done || currentStep === 3) && setCurrentStep(3)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: (isStep2Done || currentStep === 3) ? 'pointer' : 'not-allowed',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: isStep3Done
                      ? (isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-subtle)')
                      : (currentStep === 3
                        ? (isDark ? 'rgba(5, 150, 105, 0.16)' : '#ecfdf5')
                        : 'transparent'),
                    border: isStep3Done
                      ? (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0')
                      : (currentStep === 3
                        ? (isDark ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid #a7f3d0')
                        : '1px solid var(--line)'),
                    boxShadow: currentStep === 3
                      ? (isDark ? '0 0 16px rgba(16, 185, 129, 0.25)' : '0 2px 10px rgba(5, 150, 105, 0.15)')
                      : 'none',
                    opacity: (isStep2Done || currentStep === 3) ? 1 : 0.6,
                    transition: 'all 0.25s ease',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: isStep3Done
                      ? '#059669'
                      : (currentStep === 3
                        ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                        : (isDark ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0')),
                    color: (currentStep === 3 || isStep3Done) ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    boxShadow: currentStep === 3 ? '0 0 0 3.5px rgba(16, 185, 129, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    {isStep3Done ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : '3'}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: currentStep === 3 ? (isDark ? '#34d399' : '#047857') : 'var(--text)',
                      lineHeight: 1.2
                    }}>
                      Plantilla Appointments
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: currentStep === 3 ? (isDark ? '#a7f3d0' : '#059669') : 'var(--muted)',
                      fontWeight: 500,
                      marginTop: '1px'
                    }}>
                      {isStep3Done ? 'All Appointed & Bound' : '1-to-1 Item Binding'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pipeline 100% Completed Banner */}
              {isAllChecked && (
                <div style={{
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.45) 0%, rgba(15, 23, 42, 0.9) 100%)'
                    : 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
                  border: isDark ? '1.5px solid #10b981' : '1.5px solid #86efac',
                  borderRadius: '16px',
                  padding: '16px 22px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                  boxShadow: isDark ? '0 8px 24px rgba(16, 185, 129, 0.15)' : '0 4px 16px rgba(5, 150, 105, 0.08)',
                  animation: 'fadeInUp 0.3s ease-out'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 850, color: isDark ? '#ffffff' : '#065f46', margin: 0 }}>
                        Teacher Hiring Process 100% Completed & Verified
                      </h4>
                      <p style={{ fontSize: '12px', color: isDark ? '#a7f3d0' : '#047857', margin: '2px 0 0' }}>
                        All 3 stages (CAR Ingestion, Pre-Commit Audit, and Plantilla Item Allocations) have been verified and sealed under DepEd Order No. 007, s. 2023.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => window.print()}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                        border: '1px solid var(--line)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Print Official Summary
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* STEP 1: TEMPLATE & ASYNC CSV UPLOAD */}
        {currentStep === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            {/* Left Box: Template Download & Guidance */}
            <div style={{
              background: 'var(--card)',
              borderRadius: '20px',
              border: '1px solid var(--line)',
              padding: '28px 26px',
              boxShadow: isDark ? '0 8px 30px rgba(0, 0, 0, 0.35)' : '0 4px 20px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '20px'
            }}>
              <div>
                {/* Header with Clean Icon Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: isDark ? 'rgba(5, 150, 105, 0.15)' : 'rgba(5, 150, 105, 0.1)',
                    border: '1px solid rgba(5, 150, 105, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDark ? '#34d399' : '#059669',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.1)'
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Comparative Assessment Result Template
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      DepEd Order No. 007, s. 2023 standardized criteria
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', lineHeight: 1.55, margin: '0 0 20px' }}>
                  Download the official Teacher I CAR CSV spreadsheet format. Criterion columns are validated against maximum score thresholds and active Plantilla items.
                </p>

                {/* Primary Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(5, 150, 105, 0.35)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(5, 150, 105, 0.25)';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Official CAR Template (.csv)
                  </span>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.22)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 750
                  }}>
                    CSV • UTF-8
                  </span>
                </button>
              </div>

              {/* Scoring Rubric Matrix */}
              <div style={{
                paddingTop: '18px',
                borderTop: '1px solid var(--line)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Criteria Validation Rules & Max Scores
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#34d399' : '#059669' }}>
                    100 Pts Total
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
                  <div style={{
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>Education</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', background: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', padding: '2px 6px', borderRadius: '6px' }}>Max 15 pts</span>
                  </div>

                  <div style={{
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>Training</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', background: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', padding: '2px 6px', borderRadius: '6px' }}>Max 10 pts</span>
                  </div>

                  <div style={{
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>Experience</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', background: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', padding: '2px 6px', borderRadius: '6px' }}>Max 10 pts</span>
                  </div>

                  <div style={{
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>PBET / LET Exam</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7', padding: '2px 6px', borderRadius: '6px' }}>Max 25 pts</span>
                  </div>

                  <div style={{
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>Interview & Skills</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', background: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', padding: '2px 6px', borderRadius: '6px' }}>Max 20 pts</span>
                  </div>

                  <div style={{
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>Passing Score</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', background: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7', padding: '2px 6px', borderRadius: '6px' }}>Min 50.00</span>
                  </div>
                </div>

                {/* Plantilla Binding Rule Alert */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff',
                  border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #bfdbfe',
                  fontSize: '11.5px',
                  color: isDark ? '#93c5fd' : '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  lineHeight: 1.45
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span><b>Strict 1-to-1 Item Binding:</b> Item reference must match an authorized, unfilled Teacher I position in the plantilla.</span>
                </div>
              </div>
            </div>

            {/* Right Box: Drag and Drop Upload Area */}
            <div style={{
              background: 'var(--card)',
              borderRadius: '20px',
              border: '1px solid var(--line)',
              padding: '28px 26px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '20px',
              boxShadow: isDark ? '0 8px 30px rgba(0, 0, 0, 0.35)' : '0 4px 20px rgba(0, 0, 0, 0.03)'
            }}>
              <div>
                {/* Header with Clean Icon Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDark ? '#38bdf8' : '#0284c7',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.1)'
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 16 12 12 8 16" />
                      <line x1="12" y1="12" x2="12" y2="21" />
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                      <polyline points="16 16 12 12 8 16" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Upload Assessment Dataset
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Asynchronous real-time validation & criteria check
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', margin: '0 0 18px', lineHeight: 1.5 }}>
                  Select or drag your completed CAR CSV assessment scores. The pipeline parses rows in the background and audits scores against maximum bounds.
                </p>

                {/* Dropzone with Drag and Drop Support */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const dropped = e.dataTransfer?.files?.[0];
                    if (dropped) processSelectedFile(dropped);
                  }}
                  style={{
                    border: isDragOver
                      ? '2px dashed #059669'
                      : (isDark ? '2px dashed rgba(56, 189, 248, 0.35)' : '2px dashed #cbd5e1'),
                    borderRadius: '18px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: isDragOver
                      ? (isDark ? 'rgba(5, 150, 105, 0.12)' : '#ecfdf5')
                      : 'var(--card-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '16px',
                    transform: isDragOver ? 'scale(1.01)' : 'scale(1)'
                  }}
                  onMouseOver={e => {
                    if (!isDragOver) {
                      e.currentTarget.style.borderColor = '#059669';
                      e.currentTarget.style.background = isDark ? 'rgba(5, 150, 105, 0.08)' : '#f0fdf4';
                    }
                  }}
                  onMouseOut={e => {
                    if (!isDragOver) {
                      e.currentTarget.style.borderColor = isDark ? 'rgba(56, 189, 248, 0.35)' : '#cbd5e1';
                      e.currentTarget.style.background = 'var(--card-subtle)';
                    }
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    background: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                    border: '1px solid rgba(5, 150, 105, 0.2)',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.08)'
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', marginBottom: '5px' }}>
                    {fileName ? fileName : (
                      <span>Drag & drop your CAR CSV here, or <span style={{ color: '#059669', textDecoration: 'underline' }}>Browse Computer</span></span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Standard DepEd CAR CSV • UTF-8 encoded • Up to 25MB
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {isUploading && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: '#059669', marginBottom: '6px' }}>
                      <span>Asynchronous Background Parser</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: isDark ? 'rgba(51, 65, 85, 0.6)' : '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${uploadProgress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #059669, #10b981)',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                )}
              </div>


            </div>
          </div>
        )}

        {/* STEP 2: PRE-COMMIT INLINE VALIDATION REVIEW TABLE */}
        {currentStep === 2 && (
          <div>
            {/* Header Statistics Card */}
            <div style={{
              background: 'var(--card)',
              borderRadius: '16px',
              border: '1px solid var(--line)',
              padding: '18px 24px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.02)'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>
                  Parsed CAR Batch: {batchData?.file_name || fileName}
                </h3>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                  Review parsed criteria scores before committing to permanent storage.
                </span>
              </div>

              {/* Status KPI Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                  border: '1px solid var(--line)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--text)'
                }}>
                  Total: <b style={{ color: 'var(--text)' }}>{batchData?.total_rows || reviewRows.length}</b>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(6, 95, 70, 0.25)' : '#ECFDF5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #A7F3D0',
                  color: isDark ? '#34d399' : '#065F46',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Valid: <b>{batchData?.valid_rows || 0}</b>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  background: (batchData?.invalid_rows || 0) > 0
                    ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2')
                    : (isDark ? 'rgba(30, 41, 59, 0.6)' : '#F1F5F9'),
                  border: (batchData?.invalid_rows || 0) > 0
                    ? (isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #FECACA')
                    : '1px solid var(--line)',
                  color: (batchData?.invalid_rows || 0) > 0
                    ? (isDark ? '#f87171' : '#B91C1C')
                    : 'var(--text-secondary, #94a3b8)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {(batchData?.invalid_rows || 0) > 0 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                  Invalid: <b>{batchData?.invalid_rows || 0}</b>
                </div>

                <button
                  onClick={() => setCurrentStep(1)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    background: 'var(--card-subtle)',
                    border: '1.5px solid var(--line)',
                    color: 'var(--text)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Re-upload Corrected CSV
                </button>

                <button
                  disabled={hasInvalidRows || isConfirming}
                  onClick={handleConfirmBatch}
                  title={hasInvalidRows ? 'Resolve all invalid rows by uploading a corrected CSV before committing.' : 'Confirm and commit CAR data'}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    background: hasInvalidRows ? (isDark ? 'rgba(100, 116, 139, 0.5)' : '#94a3b8') : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: hasInvalidRows ? 'not-allowed' : 'pointer',
                    boxShadow: hasInvalidRows ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isConfirming ? 'Committing Data...' : 'Confirm & Commit CAR Data →'}
                </button>
              </div>
            </div>

            {/* Invalid warning alert if errors exist */}
            {hasInvalidRows && (
              <div style={{
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                border: isDark ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1.5px solid #F87171',
                borderRadius: '12px',
                padding: '12px 18px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: isDark ? '#fca5a5' : '#991B1B',
                fontSize: '13px',
                fontWeight: 600
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                <div>
                  <b>Commit Blocked:</b> {batchData?.invalid_rows} row(s) contain validation errors (out of bounds scores, missing fields, duplicate codes, or unrecognized item references). You must re-upload a corrected CSV to proceed to item appointment.
                </div>
              </div>
            )}

            {/* Table Search & Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="Search applicant code, name, item reference..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--input-border, var(--line))',
                  fontSize: '13px',
                  width: '320px',
                  background: 'var(--input-bg)',
                  color: 'var(--input-text, var(--text))'
                }}
              />

              <select
                value={validationFilter}
                onChange={e => setValidationFilter(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--input-border, var(--line))',
                  fontSize: '13px',
                  background: 'var(--input-bg)',
                  color: 'var(--input-text, var(--text))'
                }}
              >
                <option value="all">All Rows ({reviewRows.length})</option>
                <option value="valid">Valid Rows Only</option>
                <option value="invalid">Invalid Rows Only</option>
              </select>
            </div>

            {/* Review Data Table */}
            <div style={{
              background: 'var(--card)',
              borderRadius: '16px',
              border: '1px solid var(--line)',
              overflow: 'hidden',
              boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 6px 18px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{
                      background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                      borderBottom: '1.5px solid var(--line)',
                      color: 'var(--text-secondary, #94a3b8)',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      <th style={{ padding: '12px 14px', width: '40px' }}>No.</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px' }}>Applicant Code</th>
                      <th style={{ padding: '12px 14px' }}>Applicant Name</th>
                      <th style={{ padding: '12px 14px' }}>Item Ref</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Edu (15)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Train (10)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Exp (10)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>PBET (25)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Interview (20)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total (100)</th>
                      <th style={{ padding: '12px 14px' }}>Validation Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingReview ? (
                      <tr>
                        <td colSpan="12" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary, #94a3b8)' }}>
                          Loading parsed rows...
                        </td>
                      </tr>
                    ) : filteredReviewRows.length === 0 ? (
                      <tr>
                        <td colSpan="12" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary, #94a3b8)' }}>
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      filteredReviewRows.map((row, idx) => {
                        const isInvalid = row.validation_status === 'invalid';
                        let errors = [];
                        try {
                          errors = Array.isArray(row.validation_errors)
                            ? row.validation_errors
                            : JSON.parse(row.validation_errors || '[]');
                        } catch {
                          errors = [];
                        }

                        return (
                          <tr
                            key={row.id || idx}
                            style={{
                              borderBottom: '1px solid var(--line)',
                              background: isInvalid
                                ? (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 242, 242, 0.65)')
                                : 'transparent'
                            }}
                          >
                            <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {isInvalid ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2',
                                  color: isDark ? '#fca5a5' : '#B91C1C',
                                  fontSize: '11px',
                                  fontWeight: 750
                                }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                  Invalid
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
                                  color: isDark ? '#34d399' : '#065F46',
                                  fontSize: '11px',
                                  fontWeight: 750
                                }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Valid
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text)' }}>
                              {row.applicant_code}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 750, color: 'var(--text)' }}>
                              {row.applicant_name}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace' }}>
                              {row.item_reference}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>
                              {row.education_score !== null ? row.education_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>
                              {row.training_score !== null ? row.training_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>
                              {row.experience_score !== null ? row.experience_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>
                              {row.pbet_score !== null ? row.pbet_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>
                              {row.interview_score !== null ? row.interview_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: isDark ? '#34d399' : '#059669' }}>
                              {row.total_rating}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {errors.length > 0 ? (
                                <div style={{ color: isDark ? '#f87171' : '#DC2626', fontSize: '11.5px', fontWeight: 600 }}>
                                  {errors.map((err, eIdx) => (
                                    <div key={eIdx}>• {err}</div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: isDark ? '#34d399' : '#059669', fontSize: '11.5px', fontWeight: 600 }}>
                                  Passed all score bounds & item checks
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: STRICT 1-TO-1 PLANTILLA ITEM APPOINTMENT */}
        {currentStep === 3 && (
          <div>
            {/* Appointment Action Banner */}
            <div style={{
              background: 'var(--card)',
              borderRadius: '16px',
              border: '1px solid var(--line)',
              padding: '18px 24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.02)'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>
                  Teacher I Plantilla Item Assignment (1-to-1 Binding)
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
                  Select an unfilled item on the left and a ranked CAR applicant on the right.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {teacherItems.length > 0 && teacherItems.every(i => Boolean(i.is_filled)) ? (
                  <div style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
                    border: isDark ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid #86efac',
                    color: isDark ? '#34d399' : '#047857',
                    fontSize: '13px',
                    fontWeight: 750,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px'
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    All Plantilla Items Filled (Complete)
                  </div>
                ) : (
                  <>
                    <button
                      disabled={!selectedItemId || !selectedApplicantCode || isAppointing}
                      onClick={handleAppoint}
                      style={{
                        padding: '10px 22px',
                        borderRadius: '10px',
                        background: (!selectedItemId || !selectedApplicantCode) ? (isDark ? 'rgba(100, 116, 139, 0.5)' : '#94a3b8') : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        cursor: (!selectedItemId || !selectedApplicantCode) ? 'not-allowed' : 'pointer',
                        boxShadow: (!selectedItemId || !selectedApplicantCode) ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)'
                      }}
                    >
                      {isAppointing ? 'Confirming Appointment...' : 'Appoint Selected Applicant to Item'}
                    </button>

                    <button
                      onClick={() => setIsPipelineFinalized(prev => !prev)}
                      title={isPipelineFinalized ? "Appointments finalized - click to reopen" : "Finalize all appointments and mark complete"}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        background: isPipelineFinalized
                          ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5')
                          : (isDark ? 'rgba(37, 99, 235, 0.25)' : '#eff6ff'),
                        border: isPipelineFinalized
                          ? '1.5px solid #10b981'
                          : (isDark ? '1.5px solid rgba(59, 130, 246, 0.5)' : '1.5px solid #93c5fd'),
                        color: isPipelineFinalized
                          ? (isDark ? '#34d399' : '#047857')
                          : (isDark ? '#60a5fa' : '#1d4ed8'),
                        fontSize: '13px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isPipelineFinalized ? (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Finalized (All Checked)
                        </>
                      ) : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Finalize & Complete
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Split Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 1.4fr)', gap: '24px', alignItems: 'start' }}>
              {/* Left Column: Unfilled Teacher I Plantilla Items */}
              <div style={{
                background: 'var(--card)',
                borderRadius: '16px',
                border: '1px solid var(--line)',
                overflow: 'hidden',
                boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--line)',
                  background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                    Teacher I Plantilla Items ({teacherItems.filter(i => !i.is_filled).length} Unfilled • {teacherItems.filter(i => i.is_filled).length} Filled)
                  </h4>
                  <span style={{ fontSize: '11px', color: isDark ? '#34d399' : '#059669', fontWeight: 700 }}>
                    Select 1 Unfilled Item
                  </span>
                </div>

                <div style={{ maxHeight: '520px', overflowY: 'auto', padding: '12px' }}>
                  {isLoadingItems ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary, #94a3b8)' }}>Loading items...</div>
                  ) : teacherItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary, #94a3b8)' }}>
                      No Teacher I items available for this division.
                    </div>
                  ) : (
                    teacherItems.map((item) => {
                      const isSelected = selectedItemId === item.id;
                      const isFilled = Boolean(item.is_filled);

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isFilled) {
                              setToast({ message: `Item ${item.item_code} has already been filled.`, type: 'warning' });
                              return;
                            }
                            setSelectedItemId(item.id);
                          }}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: isSelected
                              ? '2px solid #059669'
                              : isFilled
                                ? (isDark ? '1px dashed rgba(239, 68, 68, 0.35)' : '1px dashed #fca5a5')
                                : '1px solid var(--line)',
                            background: isSelected
                              ? (isDark ? 'rgba(5, 150, 105, 0.2)' : 'rgba(5, 150, 105, 0.08)')
                              : isFilled
                                ? (isDark ? 'rgba(239, 68, 68, 0.06)' : '#fef2f2')
                                : (isDark ? 'rgba(30, 41, 59, 0.4)' : 'var(--card-solid, #ffffff)'),
                            marginBottom: '8px',
                            cursor: isFilled ? 'not-allowed' : 'pointer',
                            opacity: isFilled ? 0.8 : 1,
                            boxShadow: isSelected ? '0 0 12px rgba(16, 185, 129, 0.2)' : 'none',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: isFilled ? (isDark ? '#cbd5e1' : '#475569') : 'var(--text)', fontSize: '13px' }}>
                              {item.item_code}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: isFilled
                                ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2')
                                : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5'),
                              color: isFilled
                                ? (isDark ? '#fca5a5' : '#dc2626')
                                : (isDark ? '#34d399' : '#059669'),
                              border: isFilled
                                ? (isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca')
                                : (isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0'),
                              letterSpacing: '0.04em'
                            }}>
                              {isFilled ? 'FILLED' : 'UNFILLED'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: isFilled ? (isDark ? '#94a3b8' : '#64748b') : 'var(--text)', fontWeight: 650 }}>
                            {item.school_name}
                          </div>
                          {isFilled ? (
                            <div style={{ fontSize: '11px', color: isDark ? '#f87171' : '#b91c1c', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                              <span>Appointed: {item.appointed_to_name || 'Appointed Candidate'}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                              {item.division}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: CAR Ranked Applicants List */}
              <div style={{
                background: 'var(--card)',
                borderRadius: '16px',
                border: '1px solid var(--line)',
                overflow: 'hidden',
                boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--line)',
                  background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                    Ranked CAR Applicants ({reviewRows.filter(r => !r.is_appointed).length} Eligible • {reviewRows.filter(r => r.is_appointed).length} Appointed)
                  </h4>
                  <span style={{ fontSize: '11px', color: isDark ? '#34d399' : '#059669', fontWeight: 700 }}>
                    Select 1 Applicant
                  </span>
                </div>

                <div style={{ maxHeight: '520px', overflowY: 'auto', padding: '12px' }}>
                  {reviewRows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary, #94a3b8)' }}>
                      No CAR applicant batch active. Ingest a CAR file in Step 1.
                    </div>
                  ) : (
                    reviewRows.map((app, idx) => {
                      const isSelected = selectedApplicantCode === app.applicant_code;
                      const isAppointed = Boolean(app.is_appointed);

                      return (
                        <div
                          key={app.id || idx}
                          onClick={() => {
                            if (isAppointed) {
                              setToast({ message: `Applicant ${app.applicant_name} has already been appointed.`, type: 'warning' });
                              return;
                            }
                            setSelectedApplicantCode(app.applicant_code);
                          }}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: isSelected
                              ? '2px solid #059669'
                              : isAppointed
                                ? (isDark ? '1px dashed rgba(16, 185, 129, 0.35)' : '1px dashed #86efac')
                                : '1px solid var(--line)',
                            background: isSelected
                              ? (isDark ? 'rgba(5, 150, 105, 0.2)' : 'rgba(5, 150, 105, 0.08)')
                              : isAppointed
                                ? (isDark ? 'rgba(6, 78, 59, 0.18)' : '#f0fdf4')
                                : (isDark ? 'rgba(30, 41, 59, 0.4)' : 'var(--card-solid, #ffffff)'),
                            marginBottom: '8px',
                            cursor: isAppointed ? 'not-allowed' : 'pointer',
                            opacity: isAppointed ? 0.85 : 1,
                            boxShadow: isSelected ? '0 0 12px rgba(16, 185, 129, 0.2)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                              <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: isAppointed ? '#059669' : (isDark ? 'rgba(51, 65, 85, 0.8)' : '#f1f5f9'),
                                color: isAppointed ? '#ffffff' : 'var(--text)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                {isAppointed ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                ) : (idx + 1)}
                              </span>
                              <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: '13.5px' }}>
                                {app.applicant_name}
                              </span>
                              {isAppointed && (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7',
                                  color: isDark ? '#34d399' : '#047857',
                                  border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #86efac',
                                  letterSpacing: '0.04em'
                                }}>
                                  APPOINTED
                                </span>
                              )}
                            </div>
                            <div style={{
                              fontSize: '11.5px',
                              color: isAppointed ? (isDark ? '#6ee7b7' : '#059669') : 'var(--text-secondary, #94a3b8)',
                              fontFamily: isAppointed ? 'inherit' : 'monospace',
                              paddingLeft: '30px',
                              fontWeight: isAppointed ? 600 : 400
                            }}>
                              {isAppointed
                                ? `Assigned to: ${app.appointed_item_code || app.item_reference} ${app.appointed_school_name ? `(${app.appointed_school_name})` : ''}`
                                : `${app.applicant_code} • Target Item: ${app.item_reference}`}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: 850, color: isDark ? '#34d399' : '#059669' }}>
                              {app.total_rating}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                              Total Rating
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Confirmed Appointments Log in Current Session */}
            {recentAppointments.length > 0 && (
              <div style={{
                marginTop: '32px',
                background: isDark
                  ? 'linear-gradient(180deg, #0d1a33 0%, #081124 100%)'
                  : 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
                borderRadius: '18px',
                border: isDark ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid #86efac',
                padding: '22px 26px',
                boxShadow: isDark
                  ? '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 24px rgba(16, 185, 129, 0.15)'
                  : '0 8px 30px rgba(5, 150, 105, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <h4 style={{
                        fontSize: '15px',
                        fontWeight: 850,
                        color: isDark ? '#f8fafc' : '#065f46',
                        margin: 0,
                        letterSpacing: '-0.01em'
                      }}>
                        Confirmed Plantilla Appointments in this Session
                      </h4>
                      <span style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        Officially bound candidates assigned to Teacher I plantilla items
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                    color: isDark ? '#34d399' : '#047857',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #86efac'
                  }}>
                    {recentAppointments.length} Appointed
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentAppointments.map((rec, i) => (
                    <div key={i} style={{
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: isDark ? 'rgba(30, 41, 59, 0.85)' : '#ffffff',
                      border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0',
                      borderLeft: '4px solid #10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.25)' : '0 2px 6px rgba(0, 0, 0, 0.03)',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                        {/* Status Check Circle */}
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
                          border: isDark ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isDark ? '#34d399' : '#059669',
                          flexShrink: 0
                        }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>

                        {/* Candidate & Item Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
                          <span style={{
                            fontSize: '14.5px',
                            fontWeight: 800,
                            color: isDark ? '#ffffff' : '#0f172a'
                          }}>
                            {rec.applicantName}
                          </span>

                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
                            color: isDark ? '#93c5fd' : '#2563eb',
                            border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                            fontWeight: 700
                          }}>
                            {rec.applicantCode}
                          </span>

                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#6ee7b7' : '#059669'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: isDark ? '#94a3b8' : '#64748b' }}>
                              Item:
                            </span>
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '12.5px',
                              fontWeight: 850,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: isDark ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
                              color: isDark ? '#fde047' : '#854d0e',
                              border: isDark ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid #fde047'
                            }}>
                              {rec.itemCode}
                            </span>
                          </div>

                          <span style={{ fontSize: '12.5px', color: isDark ? '#cbd5e1' : '#475569', fontWeight: 600 }}>
                            ({rec.schoolName})
                          </span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                        border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: isDark ? '#94a3b8' : '#64748b',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{rec.appointedAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
