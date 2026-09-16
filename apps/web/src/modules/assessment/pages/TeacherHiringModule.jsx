import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../config/api.js';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import agadLogo from '../../../agadlogo.png';

export default function TeacherHiringModule({ onBack }) {
  const { user } = useAuth();
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

      // Strict 1-to-1 rule: permanently remove both from selectable pools immediately
      setTeacherItems(prev => prev.filter(i => i.id !== selectedItemId));
      setReviewRows(prev => prev.filter(r => r.applicant_code !== selectedApplicantCode));

      setRecentAppointments(prev => [
        {
          applicantCode: selectedApplicant.applicant_code,
          applicantName: selectedApplicant.applicant_name,
          itemCode: selectedItem.item_code,
          schoolName: selectedItem.school_name,
          appointedAt: new Date().toLocaleTimeString()
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
      background: '#f8fafc',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
      color: '#0f172a',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Bar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
            onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}
          >
            ← Switch Module
          </button>

          <div style={{ height: '24px', width: '1px', background: '#e2e8f0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={agadLogo} alt="AGAP Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                TEACHER HIRING & PLANTILLA MODULE
              </span>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Comparative Assessment Result (CAR) & Item Allocation
              </h2>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '6px 12px',
            borderRadius: '999px',
            fontWeight: 600
          }}>
            👤 {user?.firstName || user?.fullName || 'HRMO Officer'} {user?.division ? `• ${user.division}` : ''}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 28px 60px', width: '100%' }}>
        {/* Step Navigation Bar */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '12px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div
              onClick={() => setCurrentStep(1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                opacity: currentStep === 1 ? 1 : 0.7
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: currentStep === 1 ? '#059669' : '#e2e8f0',
                color: currentStep === 1 ? '#fff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px'
              }}>
                1
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: currentStep === 1 ? '#059669' : '#334155' }}>
                  CAR CSV Upload
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Template & Background Job</div>
              </div>
            </div>

            <div style={{ color: '#cbd5e1' }}>→</div>

            <div
              onClick={() => batchId && setCurrentStep(2)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: batchId ? 'pointer' : 'not-allowed',
                opacity: currentStep === 2 ? 1 : (batchId ? 0.7 : 0.4)
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: currentStep === 2 ? '#059669' : '#e2e8f0',
                color: currentStep === 2 ? '#fff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px'
              }}>
                2
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: currentStep === 2 ? '#059669' : '#334155' }}>
                  Pre-Commit Review
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Inline Validation & Errors</div>
              </div>
            </div>

            <div style={{ color: '#cbd5e1' }}>→</div>

            <div
              onClick={() => batchData?.status === 'committed' && setCurrentStep(3)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: batchData?.status === 'committed' ? 'pointer' : 'not-allowed',
                opacity: currentStep === 3 ? 1 : (batchData?.status === 'committed' ? 0.7 : 0.4)
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: currentStep === 3 ? '#059669' : '#e2e8f0',
                color: currentStep === 3 ? '#fff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px'
              }}>
                3
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: currentStep === 3 ? '#059669' : '#334155' }}>
                  Plantilla Appointments
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Strict 1-to-1 Item Binding</div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 1: TEMPLATE & ASYNC CSV UPLOAD */}
        {currentStep === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Left Box: Template Download & Guidance */}
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1.5px solid #e2e8f0',
              padding: '28px 24px',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(5, 150, 105, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
                fontSize: '24px',
                marginBottom: '16px'
              }}>
                📑
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
                Comparative Assessment Result Template
              </h3>

              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
                Download the standardized DepEd CAR CSV format. The file includes criterion columns for Education, Training, Experience, PBET/LET, Interview, and Total Rating.
              </p>

              <button
                onClick={handleDownloadTemplate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: '1.5px solid #cbd5e1',
                  color: '#1e293b',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  marginBottom: '20px'
                }}
              >
                <span>📥</span> Download CAR Template (.csv)
              </button>

              <div style={{
                paddingTop: '18px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '12.5px',
                color: '#475569'
              }}>
                <div style={{ fontWeight: 800, marginBottom: '6px', color: '#1e293b' }}>
                  Validation Rules & Max Scores:
                </div>
                <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><b>Education:</b> Max 15 points</li>
                  <li><b>Training:</b> Max 10 points</li>
                  <li><b>Experience:</b> Max 10 points</li>
                  <li><b>PBET / LET:</b> Max 25 points</li>
                  <li><b>Interview:</b> Max 20 points</li>
                  <li><b>Total Rating:</b> 0 to 100 points</li>
                  <li><b>Item Reference:</b> Must match an unfilled Teacher I item in plantilla</li>
                </ul>
              </div>
            </div>

            {/* Right Box: Drag and Drop Upload Area */}
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1.5px solid #e2e8f0',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
                  Upload CAR Assessment CSV
                </h3>
                <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 20px' }}>
                  Upload your completed assessment file. Large files are parsed asynchronously with real-time validation checks.
                </p>

                {/* Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '16px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '16px'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = '#059669'}
                  onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>📂</div>
                  <div style={{ fontSize: '14px', fontWeight: 750, color: '#1e293b', marginBottom: '4px' }}>
                    {fileName ? fileName : 'Click to Browse or Drag CSV Here'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Accepts standard DepEd CAR CSV format
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {isUploading && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 750, color: '#059669', marginBottom: '6px' }}>
                      <span>Asynchronous Background Parser</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
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

              {/* Quick Demo Trigger Helpers */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 750, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Quick Demo Testing Shortcuts:
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleLoadDemoCsv(false)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      color: '#065F46',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Load Valid Demo File
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadDemoCsv(true)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#991B1B',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Load Error Demo File
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PRE-COMMIT INLINE VALIDATION REVIEW TABLE */}
        {currentStep === 2 && (
          <div>
            {/* Header Statistics Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '18px 24px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
                  Parsed CAR Batch: {batchData?.file_name || fileName}
                </h3>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Review parsed criteria scores before committing to permanent storage.
                </span>
              </div>

              {/* Status KPI Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '6px 14px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 700 }}>
                  Total: <b style={{ color: '#0f172a' }}>{batchData?.total_rows || reviewRows.length}</b>
                </div>
                <div style={{ padding: '6px 14px', borderRadius: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: '12.5px', fontWeight: 700 }}>
                  ✓ Valid: <b>{batchData?.valid_rows || 0}</b>
                </div>
                <div style={{ padding: '6px 14px', borderRadius: '10px', background: (batchData?.invalid_rows || 0) > 0 ? '#FEF2F2' : '#F1F5F9', border: (batchData?.invalid_rows || 0) > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0', color: (batchData?.invalid_rows || 0) > 0 ? '#B91C1C' : '#64748b', fontSize: '12.5px', fontWeight: 700 }}>
                  ⚠ Invalid: <b>{batchData?.invalid_rows || 0}</b>
                </div>

                <button
                  onClick={() => setCurrentStep(1)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    color: '#334155',
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
                    background: hasInvalidRows ? '#94a3b8' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
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
                background: '#FEF2F2',
                border: '1.5px solid #F87171',
                borderRadius: '12px',
                padding: '12px 18px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#991B1B',
                fontSize: '13px',
                fontWeight: 600
              }}>
                <span style={{ fontSize: '18px' }}>🚫</span>
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
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  width: '320px',
                  background: '#ffffff'
                }}
              />

              <select
                value={validationFilter}
                onChange={e => setValidationFilter(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff'
                }}
              >
                <option value="all">All Rows ({reviewRows.length})</option>
                <option value="valid">Valid Rows Only</option>
                <option value="invalid">Invalid Rows Only</option>
              </select>
            </div>

            {/* Review Data Table */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                        <td colSpan="12" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          Loading parsed rows...
                        </td>
                      </tr>
                    ) : filteredReviewRows.length === 0 ? (
                      <tr>
                        <td colSpan="12" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
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
                              borderBottom: '1px solid #f1f5f9',
                              background: isInvalid ? 'rgba(254, 242, 242, 0.65)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '12px 14px', color: '#94a3b8', fontWeight: 600 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {isInvalid ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: '#FEE2E2',
                                  color: '#B91C1C',
                                  fontSize: '11px',
                                  fontWeight: 800
                                }}>
                                  ✕ Invalid
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: '#ECFDF5',
                                  color: '#065F46',
                                  fontSize: '11px',
                                  fontWeight: 800
                                }}>
                                  ✓ Valid
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>
                              {row.applicant_code}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 750, color: '#0f172a' }}>
                              {row.applicant_name}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#475569', fontFamily: 'monospace' }}>
                              {row.item_reference}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155' }}>
                              {row.education_score !== null ? row.education_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155' }}>
                              {row.training_score !== null ? row.training_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155' }}>
                              {row.experience_score !== null ? row.experience_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155' }}>
                              {row.pbet_score !== null ? row.pbet_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155' }}>
                              {row.interview_score !== null ? row.interview_score : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                              {row.total_rating}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {errors.length > 0 ? (
                                <div style={{ color: '#DC2626', fontSize: '11.5px', fontWeight: 600 }}>
                                  {errors.map((err, eIdx) => (
                                    <div key={eIdx}>• {err}</div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#059669', fontSize: '11.5px', fontWeight: 600 }}>
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
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '18px 24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
                  Teacher I Plantilla Item Assignment (1-to-1 Binding)
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                  Select an unfilled item on the left and a ranked CAR applicant on the right. Once appointed, both are permanently removed from the selectable pool.
                </p>
              </div>

              <button
                disabled={!selectedItemId || !selectedApplicantCode || isAppointing}
                onClick={handleAppoint}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  background: (!selectedItemId || !selectedApplicantCode) ? '#94a3b8' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: (!selectedItemId || !selectedApplicantCode) ? 'not-allowed' : 'pointer',
                  boxShadow: (!selectedItemId || !selectedApplicantCode) ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)'
                }}
              >
                {isAppointing ? 'Confirming Appointment...' : 'Appoint Selected Applicant to Item ✓'}
              </button>
            </div>

            {/* Split Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 1.4fr)', gap: '24px', alignItems: 'start' }}>
              {/* Left Column: Unfilled Teacher I Plantilla Items */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Available Teacher I Items ({teacherItems.length})
                  </h4>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                    Select 1 Item
                  </span>
                </div>

                <div style={{ maxHeight: '520px', overflowY: 'auto', padding: '12px' }}>
                  {isLoadingItems ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading items...</div>
                  ) : teacherItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No unfilled Teacher I items available.
                    </div>
                  ) : (
                    teacherItems.map((item) => {
                      const isSelected = selectedItemId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid #059669' : '1px solid #e2e8f0',
                            background: isSelected ? 'rgba(5, 150, 105, 0.06)' : '#ffffff',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', fontSize: '13px' }}>
                              {item.item_code}
                            </span>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 750,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#ECFDF5',
                              color: '#065F46'
                            }}>
                              Unfilled
                            </span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 650 }}>
                            {item.school_name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {item.division}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: CAR Ranked Applicants List */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Ranked CAR Applicants ({reviewRows.length})
                  </h4>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                    Select 1 Applicant
                  </span>
                </div>

                <div style={{ maxHeight: '520px', overflowY: 'auto', padding: '12px' }}>
                  {reviewRows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      All applicants have been appointed or no CAR batch active.
                    </div>
                  ) : (
                    reviewRows.map((app, idx) => {
                      const isSelected = selectedApplicantCode === app.applicant_code;
                      return (
                        <div
                          key={app.id || idx}
                          onClick={() => setSelectedApplicantCode(app.applicant_code)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid #059669' : '1px solid #e2e8f0',
                            background: isSelected ? 'rgba(5, 150, 105, 0.06)' : '#ffffff',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: '#f1f5f9',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 800
                              }}>
                                {idx + 1}
                              </span>
                              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                                {app.applicant_name}
                              </span>
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b', fontFamily: 'monospace', paddingLeft: '30px' }}>
                              {app.applicant_code} • Target Item: {app.item_reference}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '15px', fontWeight: 850, color: '#059669' }}>
                              {app.total_rating}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
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
                marginTop: '28px',
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '18px 24px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
              }}>
                <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>
                  Confirmed Plantilla Appointments in this Session ({recentAppointments.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentAppointments.map((rec, i) => (
                    <div key={i} style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12.5px'
                    }}>
                      <div>
                        <b style={{ color: '#065F46' }}>✓ {rec.applicantName}</b> ({rec.applicantCode})
                        <span style={{ color: '#047857', margin: '0 8px' }}>→</span>
                        <span>Item: <b>{rec.itemCode}</b> ({rec.schoolName})</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#059669' }}>
                        {rec.appointedAt}
                      </span>
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
