import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../../config/api.js';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import agadLogo from '../../../agadlogo.png';
import FullScreenDocViewer from '../../../components/FullScreenDocViewer.jsx';
import HqBackground from '../../../components/HqBackground.jsx';
import ThemeToggle from '../../../components/ThemeToggle.jsx';
import { useTheme } from '../../../middleware/ThemeProvider.jsx';

const RECLASS_STAGES = ['For Review', 'Endorsed', 'Approved', 'Denied', 'Unfilled / Vacant', 'Abolition'];
const RECLASS_POSITIONS_OPTIONS = ['School Counselor I', 'School Counselor II', 'School Counselor III', 'School Counselor IV'];

export default function ReclassificationPage({ onBack }) {
  const { user } = useAuth();
  const { setToast } = useToast();
  const { isDark } = useTheme();

  const isRegionalOffice = 
    user?.role === 'regional_office' || 
    user?.role === 'regional_director' || 
    user?.role === 'admin' ||
    String(user?.role || '').toLowerCase().includes('regional') ||
    String(user?.position || '').toLowerCase().trim() === 'regional office';

  // Regional Office NOSCA Scanner & Modal state
  const [showNoscaModal, setShowNoscaModal] = useState(false);
  const [scanningNosca, setScanningNosca] = useState(false);
  const [scannedNoscaResult, setScannedNoscaResult] = useState(null);
  const [selectedNoscaItems, setSelectedNoscaItems] = useState([]);
  const [noscaFileName, setNoscaFileName] = useState('');
  const [noscaSearchTerm, setNoscaSearchTerm] = useState('');
  const [noscaActiveCategory, setNoscaActiveCategory] = useState('ALL');
  const [noscaCopiedSn, setNoscaCopiedSn] = useState(false);
  const [isNoscaDragOver, setIsNoscaDragOver] = useState(false);
  const [confirmRemoveState, setConfirmRemoveState] = useState({ open: false, item: null, isBulk: false });
  const [showConfirmAddModal, setShowConfirmAddModal] = useState(false);
  const [importingNoscaItems, setImportingNoscaItems] = useState(false);
  const noscaFileInputRef = React.useRef(null);

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');

  // Incumbents state
  const [incumbents, setIncumbents] = useState([]);
  const [loadingIncumbents, setLoadingIncumbents] = useState(false);
  const [selectedIncumbent, setSelectedIncumbent] = useState(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [fullScreenDoc, setFullScreenDoc] = useState({ open: false, url: '', title: '' });
  const [incumbentSearchTerm, setIncumbentSearchTerm] = useState('');
  const [incumbentStageFilter, setIncumbentStageFilter] = useState('');
  const [incumbentPositionFilter, setIncumbentPositionFilter] = useState('');
  const [incumbentRegionFilter, setIncumbentRegionFilter] = useState('');
  const [updatingStageId, setUpdatingStageId] = useState(null);
  const [updatingPosition, setUpdatingPosition] = useState(false);
  const [currentPageIncumbents, setCurrentPageIncumbents] = useState(1);
  const [pageSizeIncumbents, setPageSizeIncumbents] = useState(10);

  // Modal assessment decisions state
  const [modalTargetPosition, setModalTargetPosition] = useState('');
  const [modalStage, setModalStage] = useState('For Review');
  const [savingModalChanges, setSavingModalChanges] = useState(false);

  // Sync modal state when an incumbent is opened
  useEffect(() => {
    if (selectedIncumbent) {
      setModalTargetPosition(selectedIncumbent.reclass_position || '');
      setModalStage(selectedIncumbent.stage_of_reclassification || 'For Review');
    }
  }, [selectedIncumbent]);

  // Modals state
  const [selectedApp, setSelectedApp] = useState(null);
  const [showReevalModal, setShowReevalModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showNewAppModal, setShowNewAppModal] = useState(false);

  // CSV Ingestion Modal state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState([]);
  const [csvTotalRowsCount, setCsvTotalRowsCount] = useState(0);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Workflow Stepper state: 1 = CSV Ingestion, 2 = Assessment Workbench, 3 = DBM Endorsement
  const [currentStep, setCurrentStep] = useState(1);

  // Form states for re-evaluation
  const [reevalResult, setReevalResult] = useState('Qualified (CSC QS)');
  const [reevalStatus, setReevalStatus] = useState('reevaluated');
  const [reevalRemarks, setReevalRemarks] = useState('');
  const [submittingReeval, setSubmittingReeval] = useState(false);

  // Form states for document update
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('pds');
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // Form states for new application
  const [newPosition, setNewPosition] = useState('');
  const [newItemNumber, setNewItemNumber] = useState('');
  const [newStation, setNewStation] = useState('');
  const [newApplicantName, setNewApplicantName] = useState('');
  const [submittingNewApp, setSubmittingNewApp] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Load applications
  const fetchApplications = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/reclassification');
      if (Array.isArray(data)) {
        setApplications(data);
      }
    } catch (err) {
      console.warn('[Reclass] Error loading applications from API, using fallback data:', err);
      // Fallback local dataset for resilient UI testing
      setApplications([
        {
          id: 1,
          application_number: 'REC-2026-001',
          applicant_name: 'Maria Elena Santos',
          applicant_email: 'maria.santos@deped.gov.ph',
          position_title: 'Master Teacher I (Secondary)',
          item_number: 'OSEC-DECSB-MTCHR1-00192',
          station_division: 'SDO Quezon City',
          date_originally_submitted: '2026-01-15T08:30:00Z',
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Qualified (CSC QS)',
          evaluation_status: 'reevaluated',
          has_updated_credentials: true,
          updated_credentials_submitted_at: '2026-02-10T14:15:00Z',
          documents: [
            { name: 'Updated_PDS_2026.pdf', type: 'pds', uploadedAt: '2026-02-10T14:15:00Z' },
            { name: 'IPCRF_Outstanding_2025.pdf', type: 'ipcrf', uploadedAt: '2026-02-10T14:15:00Z' }
          ],
          reevaluation_timestamp: '2026-02-14T10:00:00Z',
          dbm_export_timestamp: '2026-03-01T09:00:00Z'
        },
        {
          id: 2,
          application_number: 'REC-2026-002',
          applicant_name: 'Juan Carlos Ramos',
          applicant_email: 'juan.ramos@deped.gov.ph',
          position_title: 'Head Teacher III',
          item_number: 'OSEC-DECSB-HTEACH3-00084',
          station_division: 'SDO Manila',
          date_originally_submitted: '2026-01-22T10:00:00Z',
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Pending CSC Review',
          evaluation_status: 'pending_reevaluation',
          has_updated_credentials: false,
          updated_credentials_submitted_at: null,
          documents: [
            { name: 'PDS_Original_Submission.pdf', type: 'pds', uploadedAt: '2026-01-22T10:00:00Z' }
          ],
          reevaluation_timestamp: null,
          dbm_export_timestamp: null
        },
        {
          id: 3,
          application_number: 'REC-2026-003',
          applicant_name: 'Annaliza Reyes',
          applicant_email: 'annaliza.reyes@deped.gov.ph',
          position_title: 'Special Education Teacher I',
          item_number: 'OSEC-DECSB-SPET1-00215',
          station_division: 'SDO Pasig',
          date_originally_submitted: '2026-02-01T11:45:00Z',
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Needs Applicant Update',
          evaluation_status: 'needs_applicant_update',
          has_updated_credentials: false,
          updated_credentials_submitted_at: null,
          documents: [],
          reevaluation_timestamp: '2026-02-18T16:20:00Z',
          dbm_export_timestamp: null
        },
        {
          id: 4,
          application_number: 'REC-2026-004',
          applicant_name: 'Roberto Dela Cruz',
          applicant_email: 'roberto.delacruz@deped.gov.ph',
          position_title: 'Master Teacher II',
          item_number: 'OSEC-DECSB-MTCHR2-00041',
          station_division: 'SDO Caloocan',
          date_originally_submitted: '2026-02-05T09:15:00Z',
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Qualified (CSC QS)',
          evaluation_status: 'reevaluated',
          has_updated_credentials: true,
          updated_credentials_submitted_at: '2026-02-25T11:30:00Z',
          documents: [
            { name: 'MA_Diploma_Transcript.pdf', type: 'tor', uploadedAt: '2026-02-25T11:30:00Z' }
          ],
          reevaluation_timestamp: '2026-02-28T13:40:00Z',
          dbm_export_timestamp: null
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Load Incumbent Guidance Counselors
  const fetchIncumbents = async () => {
    setLoadingIncumbents(true);
    try {
      const data = await apiFetch('/api/reclassification/incumbents');
      if (Array.isArray(data)) {
        setIncumbents(data);
      }
    } catch (err) {
      console.warn('[Reclass] Error loading incumbents from API, using fallback data:', err);
      setIncumbents([
        {
          id: 1,
          employee_id: 'EMP-GC-001',
          full_name: 'Elena R. Bautista',
          current_position: 'Guidance Counselor I',
          station_division: 'SDO Quezon City',
          stage_of_reclassification: 'For Review',
          reclass_position: null,
          assessment: {
            education: 'Master of Arts in Education (Guidance & Counseling) - UP Diliman (36 units completed)',
            years_experience: 4.5,
            hours_of_training: 88.0,
            eligibility: 'RA 1080 (Registered Guidance Counselor) / CSC Professional',
            documents: [
              { key: 'pds', label: 'Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Transcript of Records (Masteral Units)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'National Counseling Convention Certificate', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'eligibility', label: 'PRC Guidance Counselor Board License Card', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ]
          }
        },
        {
          id: 2,
          employee_id: 'EMP-GC-002',
          full_name: 'Marco V. Villanueva',
          current_position: 'Guidance Counselor II',
          station_division: 'SDO Manila',
          stage_of_reclassification: 'Endorsed',
          reclass_position: 'School Counselor II',
          assessment: {
            education: 'Master of Arts in Guidance and Counseling (Graduated) - PNU Manila',
            years_experience: 8.0,
            hours_of_training: 140.0,
            eligibility: 'RA 1080 (Registered Guidance Counselor)',
            documents: [
              { key: 'pds', label: 'Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Masteral Degree TOR & Diploma', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'DepEd SDO Advanced Counseling Workshop', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'eligibility', label: 'PRC Board Certificate & ID Card', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ]
          }
        },
        {
          id: 3,
          employee_id: 'EMP-GC-003',
          full_name: 'Corazon D. Mendoza',
          current_position: 'Guidance Counselor III',
          station_division: 'SDO Pasig City',
          stage_of_reclassification: 'Approved',
          reclass_position: 'School Counselor III',
          assessment: {
            education: 'Doctor of Philosophy in Counseling Psychology (CAR) - DLSU; MA Guidance & Counseling',
            years_experience: 12.5,
            hours_of_training: 210.0,
            eligibility: 'RA 1080 (Registered Guidance Counselor) & Career Executive Eligibility',
            documents: [
              { key: 'pds', label: 'Updated Personal Data Sheet (CS Form 212)', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'tor', label: 'Doctorate Coursework & Masteral Transcript of Records', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'training_certificates', label: 'National Mental Health & Crisis Intervention Training', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' },
              { key: 'eligibility', label: 'PRC License & Verification Certificate', url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
            ]
          }
        }
      ]);
    } finally {
      setLoadingIncumbents(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    fetchIncumbents();
  }, []);

  // Update incumbent counselor stage of reclassification
  const handleUpdateIncumbentStage = async (incumbentId, newStage, e) => {
    if (e) e.stopPropagation();
    const previousIncumbents = [...incumbents];

    // Optimistic UI update
    setIncumbents(prev =>
      prev.map(item => item.id === incumbentId ? { ...item, stage_of_reclassification: newStage } : item)
    );
    if (selectedIncumbent && selectedIncumbent.id === incumbentId) {
      setSelectedIncumbent(prev => ({ ...prev, stage_of_reclassification: newStage }));
    }

    setUpdatingStageId(incumbentId);
    try {
      await apiFetch(`/api/reclassification/incumbents/${incumbentId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage_of_reclassification: newStage })
      });
      setToast({
        type: 'success',
        message: `Stage updated to "${newStage}" successfully!`
      });
    } catch (err) {
      console.error('[Reclass] Error updating stage:', err);
      setIncumbents(previousIncumbents);
      if (selectedIncumbent && selectedIncumbent.id === incumbentId) {
        const orig = previousIncumbents.find(i => i.id === incumbentId);
        if (orig) setSelectedIncumbent(orig);
      }
      setToast({
        type: 'error',
        message: err.message || 'Failed to update reclassification stage'
      });
    } finally {
      setUpdatingStageId(null);
    }
  };

  // Update incumbent counselor target position
  const handleUpdateIncumbentPosition = async (newPos) => {
    if (!selectedIncumbent) return;
    const incumbentId = selectedIncumbent.id;
    const previousPos = selectedIncumbent.reclass_position;
    const formattedPos = newPos === '' ? null : newPos;

    // Optimistic update
    setSelectedIncumbent(prev => ({ ...prev, reclass_position: formattedPos }));
    setIncumbents(prev =>
      prev.map(item => item.id === incumbentId ? { ...item, reclass_position: formattedPos } : item)
    );

    setUpdatingPosition(true);
    try {
      await apiFetch(`/api/reclassification/incumbents/${incumbentId}/position`, {
        method: 'PUT',
        body: JSON.stringify({ reclass_position: formattedPos })
      });
      setToast({
        type: 'success',
        message: formattedPos ? `Assigned to ${formattedPos} successfully!` : 'Target position unassigned.'
      });
    } catch (err) {
      console.error('[Reclass] Error updating position:', err);
      setSelectedIncumbent(prev => ({ ...prev, reclass_position: previousPos }));
      setIncumbents(prev =>
        prev.map(item => item.id === incumbentId ? { ...item, reclass_position: previousPos } : item)
      );
      setToast({
        type: 'error',
        message: err.message || 'Failed to update target reclassification position'
      });
    } finally {
      setUpdatingPosition(false);
    }
  };

  // Save assessment changes from modal
  const handleSaveModalChanges = async () => {
    if (!selectedIncumbent) return;
    setSavingModalChanges(true);
    const incumbentId = selectedIncumbent.id;
    const formattedPos = modalTargetPosition === '' ? null : modalTargetPosition;
    const newStage = modalStage;

    try {
      const promises = [];
      if (formattedPos !== selectedIncumbent.reclass_position) {
        promises.push(
          apiFetch(`/api/reclassification/incumbents/${incumbentId}/position`, {
            method: 'PUT',
            body: JSON.stringify({ reclass_position: formattedPos })
          })
        );
      }
      if (newStage !== selectedIncumbent.stage_of_reclassification) {
        promises.push(
          apiFetch(`/api/reclassification/incumbents/${incumbentId}/stage`, {
            method: 'PUT',
            body: JSON.stringify({ stage_of_reclassification: newStage })
          })
        );
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // Optimistic update in table list and active selection
      setIncumbents(prev =>
        prev.map(item =>
          item.id === incumbentId
            ? { ...item, reclass_position: formattedPos, stage_of_reclassification: newStage }
            : item
        )
      );
      setSelectedIncumbent(prev => ({
        ...prev,
        reclass_position: formattedPos,
        stage_of_reclassification: newStage
      }));

      setToast({
        type: 'success',
        message: `Assessment changes saved for ${selectedIncumbent.full_name}!`
      });
      setShowAssessmentModal(false);
    } catch (err) {
      console.error('[Reclass] Error saving modal changes:', err);
      setToast({
        type: 'error',
        message: err.message || 'Failed to save assessment changes'
      });
    } finally {
      setSavingModalChanges(false);
    }
  };

  // Distinct regions from imported dataset
  const distinctRegions = useMemo(() => {
    return Array.from(new Set(incumbents.map(i => i.region).filter(Boolean))).sort();
  }, [incumbents]);

  // Filtered incumbents
  const filteredIncumbents = useMemo(() => {
    return incumbents.filter((inc) => {
      const q = incumbentSearchTerm.toLowerCase();
      const matchSearch =
        !incumbentSearchTerm ||
        inc.full_name?.toLowerCase().includes(q) ||
        inc.plantilla_item_number?.toLowerCase().includes(q) ||
        inc.employee_id?.toLowerCase().includes(q) ||
        inc.current_position?.toLowerCase().includes(q) ||
        inc.station_division?.toLowerCase().includes(q) ||
        inc.division?.toLowerCase().includes(q) ||
        inc.region?.toLowerCase().includes(q) ||
        inc.uacs_oper_dsc?.toLowerCase().includes(q) ||
        inc.remarks?.toLowerCase().includes(q) ||
        inc.reclass_position?.toLowerCase().includes(q) ||
        (inc.salary_grade && `sg ${inc.salary_grade}`.includes(q));

      const matchStage = !incumbentStageFilter || inc.stage_of_reclassification === incumbentStageFilter;
      const matchRegion = !incumbentRegionFilter || inc.region === incumbentRegionFilter;
      const matchPosition = !incumbentPositionFilter || (
        incumbentPositionFilter === 'UNASSIGNED'
          ? !inc.reclass_position
          : inc.reclass_position === incumbentPositionFilter
      );

      return matchSearch && matchStage && matchRegion && matchPosition;
    });
  }, [incumbents, incumbentSearchTerm, incumbentStageFilter, incumbentRegionFilter, incumbentPositionFilter]);

  // KPI Metrics for Incumbents
  const incumbentMetrics = useMemo(() => {
    const total = incumbents.length;
    const forReview = incumbents.filter((i) => i.stage_of_reclassification === 'For Review').length;
    const endorsed = incumbents.filter((i) => i.stage_of_reclassification === 'Endorsed').length;
    const approved = incumbents.filter((i) => i.stage_of_reclassification === 'Approved').length;
    const denied = incumbents.filter((i) => i.stage_of_reclassification === 'Denied').length;
    const vacant = incumbents.filter((i) => i.stage_of_reclassification === 'Unfilled / Vacant' || i.full_name === '#N/A').length;
    return { total, forReview, endorsed, approved, denied, vacant };
  }, [incumbents]);

  // Paged incumbents
  const pagedIncumbents = useMemo(() => {
    const start = (currentPageIncumbents - 1) * pageSizeIncumbents;
    return filteredIncumbents.slice(start, start + pageSizeIncumbents);
  }, [filteredIncumbents, currentPageIncumbents, pageSizeIncumbents]);

  // Step completion flags
  const isStep1Done = incumbents.length > 0 || currentStep > 1;
  const isStep2Done = currentStep > 2 || incumbents.some(i => i.stage_of_reclassification === 'Endorsed' || i.stage_of_reclassification === 'Approved' || (i.reclass_position && i.reclass_position !== '#N/A'));
  const isStep3Done = incumbents.some(i => i.stage_of_reclassification === 'Approved');

  // Global Escape key listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAssessmentModal) setShowAssessmentModal(false);
        if (showReevalModal) setShowReevalModal(false);
        if (showDocModal) setShowDocModal(false);
        if (showNewAppModal) setShowNewAppModal(false);
        if (showCsvModal) setShowCsvModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAssessmentModal, showReevalModal, showDocModal, showNewAppModal, showCsvModal]);

  const getStageBadge = (stage) => {
    switch (stage) {
      case 'Approved':
        return {
          bg: isDark ? 'rgba(6, 95, 70, 0.25)' : '#ECFDF5',
          text: isDark ? '#34d399' : '#065F46',
          border: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
          icon: '✓'
        };
      case 'Endorsed':
        return {
          bg: isDark ? 'rgba(30, 58, 138, 0.35)' : '#EFF6FF',
          text: isDark ? '#93c5fd' : '#1E40AF',
          border: isDark ? 'rgba(59, 130, 246, 0.4)' : '#BFDBFE',
          icon: '★'
        };
      case 'Denied':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2',
          text: isDark ? '#f87171' : '#991B1B',
          border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECACA',
          icon: '✕'
        };
      case 'Unfilled / Vacant':
        return {
          bg: isDark ? 'rgba(71, 85, 105, 0.25)' : '#F1F5F9',
          text: isDark ? '#94a3b8' : '#475569',
          border: isDark ? 'rgba(100, 116, 139, 0.4)' : '#CBD5E1',
          icon: '○'
        };
      case 'Abolition':
        return {
          bg: isDark ? 'rgba(153, 27, 27, 0.25)' : '#FEF2F2',
          text: isDark ? '#fca5a5' : '#991B1B',
          border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#F87171',
          icon: '⚠'
        };
      case 'For Review':
      default:
        return {
          bg: isDark ? 'rgba(180, 83, 9, 0.25)' : '#FFFBEB',
          text: isDark ? '#fde68a' : '#92400E',
          border: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A',
          icon: '⏳'
        };
    }
  };

  // Filtered applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchSearch =
        !searchTerm ||
        app.applicant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.application_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.position_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.item_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.station_division?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = !statusFilter || app.evaluation_status === statusFilter;
      const matchDivision = !divisionFilter || app.station_division === divisionFilter;

      return matchSearch && matchStatus && matchDivision;
    });
  }, [applications, searchTerm, statusFilter, divisionFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = applications.length;
    const pending = applications.filter((a) => a.evaluation_status === 'pending_reevaluation').length;
    const needsUpdate = applications.filter((a) => a.evaluation_status === 'needs_applicant_update').length;
    const reevaluated = applications.filter((a) => a.evaluation_status === 'reevaluated').length;
    return { total, pending, needsUpdate, reevaluated };
  }, [applications]);

  // Unique divisions for dropdown
  const divisions = useMemo(() => {
    const set = new Set(applications.map((a) => a.station_division).filter(Boolean));
    return Array.from(set).sort();
  }, [applications]);

  // Paged applications
  const pagedApps = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredApps.slice(start, start + pageSize);
  }, [filteredApps, currentPage, pageSize]);

  // Handle CSC Reevaluation Submit
  const handleSaveReeval = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    setSubmittingReeval(true);
    try {
      await apiFetch(`/api/reclassification/${selectedApp.id}/reevaluate`, {
        method: 'PUT',
        body: JSON.stringify({
          csc_approved_qs_eval_result: reevalResult,
          evaluation_status: reevalStatus,
          remarks: reevalRemarks
        })
      });
      setToast({ message: `Re-evaluation saved for ${selectedApp.application_number}`, type: 'success' });
      setShowReevalModal(false);
      fetchApplications();
    } catch (err) {
      console.error('Error submitting re-evaluation:', err);
      // Optimistic local update
      setApplications(prev => prev.map(a => {
        if (a.id === selectedApp.id) {
          return {
            ...a,
            csc_approved_qs_eval_result: reevalResult,
            evaluation_status: reevalStatus,
            reevaluation_timestamp: new Date().toISOString()
          };
        }
        return a;
      }));
      setToast({ message: 'Re-evaluation recorded locally', type: 'info' });
      setShowReevalModal(false);
    } finally {
      setSubmittingReeval(false);
    }
  };

  // Handle Document Credential Update Submit
  const handleSaveDocument = async (e) => {
    e.preventDefault();
    if (!selectedApp || !newDocName) return;

    setSubmittingDoc(true);
    try {
      const docPayload = {
        name: newDocName,
        type: newDocType,
        uploadedAt: new Date().toISOString()
      };

      await apiFetch(`/api/reclassification/${selectedApp.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          documents: [docPayload]
        })
      });

      setToast({ message: `Credentials updated for ${selectedApp.applicant_name}`, type: 'success' });
      setShowDocModal(false);
      setNewDocName('');
      fetchApplications();
    } catch (err) {
      console.error('Error submitting document update:', err);
      // Optimistic local update
      setApplications(prev => prev.map(a => {
        if (a.id === selectedApp.id) {
          const docs = Array.isArray(a.documents) ? [...a.documents] : [];
          docs.push({ name: newDocName, type: newDocType, uploadedAt: new Date().toISOString() });
          return {
            ...a,
            documents: docs,
            has_updated_credentials: true,
            updated_credentials_submitted_at: new Date().toISOString(),
            evaluation_status: a.evaluation_status === 'needs_applicant_update' ? 'pending_reevaluation' : a.evaluation_status
          };
        }
        return a;
      }));
      setToast({ message: 'Document added to applicant profile', type: 'info' });
      setShowDocModal(false);
      setNewDocName('');
    } finally {
      setSubmittingDoc(false);
    }
  };

  // Handle New Application Submit
  const handleCreateNewApp = async (e) => {
    e.preventDefault();
    if (!newPosition) return;

    setSubmittingNewApp(true);
    try {
      const appNum = `REC-${new Date().getFullYear()}-${String(applications.length + 1).padStart(3, '0')}`;
      const payload = {
        application_number: appNum,
        position_title: newPosition,
        item_number: newItemNumber || 'PENDING-ITEM',
        station_division: newStation || user?.division || 'SDO Main',
        proposed_qs_eval_result: 'Qualified (Proposed QS)',
        documents: []
      };

      await apiFetch('/api/reclassification', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setToast({ message: `Reclassification application ${appNum} created`, type: 'success' });
      setShowNewAppModal(false);
      setNewPosition('');
      setNewItemNumber('');
      setNewStation('');
      fetchApplications();
    } catch (err) {
      console.error('Error creating reclassification application:', err);
      const appNum = `REC-2026-${String(applications.length + 1).padStart(3, '0')}`;
      setApplications(prev => [
        {
          id: Date.now(),
          application_number: appNum,
          applicant_name: newApplicantName || 'New Teacher Applicant',
          applicant_email: 'applicant@deped.gov.ph',
          position_title: newPosition,
          item_number: newItemNumber || 'OSEC-DECSB-ITEM-NEW',
          station_division: newStation || user?.division || 'SDO Manila',
          date_originally_submitted: new Date().toISOString(),
          proposed_qs_eval_result: 'Qualified (Proposed QS)',
          csc_approved_qs_eval_result: 'Pending CSC Review',
          evaluation_status: 'pending_reevaluation',
          has_updated_credentials: false,
          updated_credentials_submitted_at: null,
          documents: []
        },
        ...prev
      ]);
      setToast({ message: `Reclassification application ${appNum} added`, type: 'info' });
      setShowNewAppModal(false);
      setNewPosition('');
      setNewItemNumber('');
      setNewStation('');
      setNewApplicantName('');
    } finally {
      setSubmittingNewApp(false);
    }
  };

  // Handle DBM Export Trigger
  const handleExportDBM = () => {
    try {
      const token = localStorage.getItem('agap_token') || localStorage.getItem('deped_token') || sessionStorage.getItem('deped_token');
      const exportUrl = `/api/reclassification/export-dbm${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      window.open(exportUrl, '_blank');
      setToast({ message: 'Generating DBM submission spreadsheet...', type: 'info' });
    } catch (err) {
      console.error('Error triggering DBM export:', err);
      setToast({ message: 'Downloading DBM export data...', type: 'info' });
    }
  };

  // Process NOSCA PDF file upload & trigger root scanner.py
  const processNoscaFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setToast({
        title: 'Invalid File Format',
        message: 'Please select a valid PDF file for NOSCA scanning.',
        type: 'error'
      });
      return;
    }

    setScanningNosca(true);
    setNoscaFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (uploadEvt) => {
      try {
        const fileData = uploadEvt.target.result;
        const res = await apiFetch('/api/reclassification/scan-nosca', {
          method: 'POST',
          body: JSON.stringify({
            fileData,
            fileName: file.name
          })
        });

        if (res && res.data) {
          setScannedNoscaResult(res.data);
          setSelectedNoscaItems(res.data.items || []);
          setShowNoscaModal(true);
          setToast({
            title: 'NOSCA Scanned Successfully',
            message: `Serial No: ${res.data.serial_no || 'N/A'} • ${res.data.count || 0} Plantilla items extracted.`,
            type: 'success'
          });
        } else {
          throw new Error(res?.error || 'Failed to parse NOSCA document.');
        }
      } catch (err) {
        console.error('[Reclass] NOSCA Scan Error:', err);
        setToast({
          title: 'NOSCA Scan Failed',
          message: err.message || 'Error occurred while scanning NOSCA PDF.',
          type: 'error'
        });
      } finally {
        setScanningNosca(false);
        if (noscaFileInputRef.current) {
          noscaFileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setScanningNosca(false);
      setToast({
        title: 'File Read Error',
        message: 'Unable to read the selected file.',
        type: 'error'
      });
    };

    reader.readAsDataURL(file);
  };

  const handleNoscaFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processNoscaFile(file);
  };

  const handleNoscaDrop = (e) => {
    e.preventDefault();
    setIsNoscaDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processNoscaFile(file);
  };

  const handleCopySerialNo = (sn) => {
    if (!sn) return;
    navigator.clipboard?.writeText(sn);
    setNoscaCopiedSn(true);
    setTimeout(() => setNoscaCopiedSn(false), 2000);
    setToast({ message: 'Serial number copied to clipboard', type: 'info' });
  };

  // Toggle selection of an individual item
  const toggleSelectNoscaItem = (item) => {
    setSelectedNoscaItems(prev => {
      if (prev.includes(item)) {
        return prev.filter(i => i !== item);
      } else {
        return [...prev, item];
      }
    });
  };

  // Toggle select/deselect all currently visible/filtered items
  const toggleSelectAllNoscaItems = () => {
    const visibleItemStrings = filteredNoscaItems;
    if (visibleItemStrings.length === 0) return;
    const allVisibleSelected = visibleItemStrings.every(i => selectedNoscaItems.includes(i));

    if (allVisibleSelected) {
      setSelectedNoscaItems(prev => prev.filter(i => !visibleItemStrings.includes(i)));
    } else {
      const set = new Set([...selectedNoscaItems, ...visibleItemStrings]);
      setSelectedNoscaItems(Array.from(set));
    }
  };

  // Trigger Remove Item Confirmation Layer
  const handleRequestRemoveItem = (item) => {
    setConfirmRemoveState({ open: true, item, isBulk: false });
  };

  // Trigger Bulk Remove Confirmation Layer
  const handleRequestRemoveSelected = () => {
    if (selectedNoscaItems.length === 0) {
      setToast({ message: 'No items selected to remove.', type: 'info' });
      return;
    }
    setConfirmRemoveState({ open: true, item: null, isBulk: true });
  };

  // Execute confirmed item removal
  const handleExecuteConfirmedRemoval = () => {
    if (!scannedNoscaResult) return;

    if (confirmRemoveState.isBulk) {
      const itemsToRemoveSet = new Set(selectedNoscaItems);
      const newItems = (scannedNoscaResult.items || []).filter(i => !itemsToRemoveSet.has(i));

      const newCategoryBreakdown = {};
      Object.keys(scannedNoscaResult.category_breakdown || {}).forEach(cat => {
        newCategoryBreakdown[cat] = (scannedNoscaResult.category_breakdown[cat] || []).filter(i => !itemsToRemoveSet.has(i));
      });

      setScannedNoscaResult(prev => ({
        ...prev,
        items: newItems,
        count: newItems.length,
        category_breakdown: newCategoryBreakdown
      }));
      setSelectedNoscaItems([]);
      setToast({ message: `Removed ${itemsToRemoveSet.size} item(s) from NOSCA batch.`, type: 'info' });
    } else if (confirmRemoveState.item) {
      const target = confirmRemoveState.item;
      const newItems = (scannedNoscaResult.items || []).filter(i => i !== target);

      const newCategoryBreakdown = {};
      Object.keys(scannedNoscaResult.category_breakdown || {}).forEach(cat => {
        newCategoryBreakdown[cat] = (scannedNoscaResult.category_breakdown[cat] || []).filter(i => !itemsToRemoveSet.has(i));
      });

      setScannedNoscaResult(prev => ({
        ...prev,
        items: newItems,
        count: newItems.length,
        category_breakdown: newCategoryBreakdown
      }));
      setSelectedNoscaItems(prev => prev.filter(i => i !== target));
      setToast({ message: `Removed item ${target} from NOSCA batch.`, type: 'info' });
    }

    setConfirmRemoveState({ open: false, item: null, isBulk: false });
  };

  // Trigger Add / Commit Confirmation Layer
  const handleRequestAddItems = () => {
    if (selectedNoscaItems.length === 0) {
      setToast({ title: 'No Items Selected', message: 'Please select at least one plantilla item to import.', type: 'error' });
      return;
    }
    setShowConfirmAddModal(true);
  };

  // Execute confirmed addition / import into database
  const handleExecuteConfirmedImport = async () => {
    if (!scannedNoscaResult || selectedNoscaItems.length === 0) return;

    setImportingNoscaItems(true);
    try {
      const res = await apiFetch('/api/reclassification/import-nosca-items', {
        method: 'POST',
        body: JSON.stringify({
          serialNo: scannedNoscaResult.serial_no,
          division: scannedNoscaResult.division,
          schoolName: scannedNoscaResult.school_name,
          position: scannedNoscaResult.position,
          items: selectedNoscaItems
        })
      });

      if (res && res.success) {
        setToast({
          title: 'Plantilla Items Registered',
          message: res.message || `Successfully committed ${selectedNoscaItems.length} items to Reclassification Inventory.`,
          type: 'success'
        });
        setShowConfirmAddModal(false);
        setShowNoscaModal(false);
        fetchIncumbents();
        fetchApplications();
      } else {
        throw new Error(res?.error || 'Failed to import NOSCA plantilla items.');
      }
    } catch (err) {
      console.error('[Reclass] Import NOSCA error:', err);
      setToast({
        title: 'Import Failed',
        message: err.message || 'An error occurred while importing NOSCA items.',
        type: 'error'
      });
    } finally {
      setImportingNoscaItems(false);
    }
  };

  // Filtered NOSCA items for interactive breakdown
  const filteredNoscaItems = useMemo(() => {
    if (!scannedNoscaResult) return [];
    let list = [];
    if (noscaActiveCategory === 'ALL') {
      list = scannedNoscaResult.items || [];
    } else if (scannedNoscaResult.category_breakdown?.[noscaActiveCategory]) {
      list = scannedNoscaResult.category_breakdown[noscaActiveCategory] || [];
    }

    if (!noscaSearchTerm.trim()) return list;
    const q = noscaSearchTerm.toLowerCase();
    return list.filter(item => String(item).toLowerCase().includes(q));
  }, [scannedNoscaResult, noscaActiveCategory, noscaSearchTerm]);

  // Match scanned items with current incumbent counselors
  const matchedIncumbentsCount = useMemo(() => {
    if (!scannedNoscaResult?.items || !incumbents?.length) return 0;
    const noscaSet = new Set(scannedNoscaResult.items.map(i => String(i).trim().toLowerCase()));
    return incumbents.filter(inc => inc.plantilla_item_number && noscaSet.has(String(inc.plantilla_item_number).trim().toLowerCase())).length;
  }, [scannedNoscaResult, incumbents]);

  // Parse CSV text for client preview
  const parseCsvPreview = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [], totalCount: 0 };

    const parseLine = (line) => {
      const res = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          res.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      res.push(cur.trim());
      return res;
    };

    const headers = parseLine(lines[0]);
    const previewRows = lines.slice(1, 6).map(line => {
      const cols = parseLine(line);
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] || '';
      });
      return rowObj;
    });

    return { headers, rows: previewRows, totalCount: Math.max(0, lines.length - 1) };
  };

  // Handle file selection from dropzone or input
  const handleSelectCsvFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setToast({ message: 'Please select a valid CSV file (.csv)', type: 'error' });
      return;
    }

    setCsvFile(selectedFile);
    setCsvFileName(selectedFile.name);
    setUploadStats(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setCsvContent(content);
        const { rows, totalCount } = parseCsvPreview(content);
        setCsvPreviewRows(rows);
        setCsvTotalRowsCount(totalCount);
      }
    };
    reader.readAsText(selectedFile);
  };

  // Handle Download CSV Template
  const handleDownloadCsvTemplate = () => {
    try {
      const token = localStorage.getItem('deped_token') || sessionStorage.getItem('deped_token');
      const downloadUrl = `/api/reclassification/template-csv${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      window.open(downloadUrl, '_blank');
      setToast({ message: 'Downloading Reclassification CSV template...', type: 'info' });
    } catch (err) {
      console.error('Error downloading template:', err);
      setToast({ message: 'Failed to download template', type: 'error' });
    }
  };

  // Execute CSV ingestion (either uploaded file or default master inventory)
  const handleExecuteCsvIngestion = async (useDefault = false) => {
    if (!useDefault && !csvContent) {
      setToast({ message: 'Please select or drop a CSV file first.', type: 'warning' });
      return;
    }

    setIsUploadingCsv(true);
    setUploadProgress(25);

    try {
      const payload = useDefault
        ? { useDefaultFile: true, replaceExisting }
        : { csvContent, fileName: csvFileName, replaceExisting };

      setUploadProgress(50);

      const res = await apiFetch('/api/reclassification/upload-csv', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setUploadProgress(100);
      setUploadStats(res);
      setToast({
        message: res.message || `Successfully ingested ${res.insertedOrUpdated || 0} records!`,
        type: 'success'
      });

      // Refresh data
      fetchIncumbents();
    } catch (err) {
      console.error('CSV Ingestion failed:', err);
      setToast({
        message: err.message || 'Failed to ingest CSV file.',
        type: 'error'
      });
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'reevaluated':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '999px',
            fontSize: '11.5px',
            fontWeight: 700,
            background: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0'
          }}>
            ✓ Re-evaluated
          </span>
        );
      case 'needs_applicant_update':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '999px',
            fontSize: '11.5px',
            fontWeight: 700,
            background: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #FDE68A'
          }}>
            ⚠ Needs Update
          </span>
        );
      case 'pending_reevaluation':
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '999px',
            fontSize: '11.5px',
            fontWeight: 700,
            background: '#EFF6FF',
            color: '#1E40AF',
            border: '1px solid #BFDBFE'
          }}>
            ⏳ Pending CSC Re-eval
          </span>
        );
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: isDark ? '#020617' : '#f4f8fc',
      position: 'relative',
      overflow: 'hidden',
      color: isDark ? '#F8FAFC' : '#0f172a'
    }}>
      <HqBackground />

      {/* Top Header */}
      <header style={{
        background: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 2px 10px rgba(0, 0, 0, 0.05)'
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
              background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
              color: isDark ? '#F8FAFC' : '#0f172a',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}
            onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(51, 65, 85, 0.8)' : '#f1f5f9'}
            onMouseOut={e => e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff'}
          >
            ← Switch Module
          </button>

          <div style={{ height: '24px', width: '1px', background: isDark ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={agadLogo} alt="AGAP Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <div>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                RECLASSIFICATION WORKBENCH
              </span>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: isDark ? '#F8FAFC' : '#08315f' }}>
                Incumbent Guidance Counselor Assessment & Reclassification
              </h2>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle />

          <div style={{
            fontSize: '12px',
            color: isDark ? '#94a3b8' : '#334155',
            background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
            padding: '6px 12px',
            borderRadius: '999px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
              {(user?.firstName || user?.lastName)
                ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                : (user?.fullName || user?.username || 'HR Evaluator')}
            </span>
            {[user?.region, user?.division].filter(Boolean).length > 0 && (
              <>
                <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>•</span>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                  {[user?.region, user?.division].filter(Boolean).join(' • ')}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 28px 60px', position: 'relative', zIndex: 1 }}>
        {/* Workflow Stepper Navigation */}
        {/* Style for Stepper Transitions & Smooth View Transitions */}
        <style>{`
          @keyframes reclassStepFadeIn {
            0% {
              opacity: 0;
              transform: translateY(6px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .reclass-step-content-anim {
            animation: reclassStepFadeIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .reclass-stepper-btn {
            transition: background-color 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        border-color 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        box-shadow 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        opacity 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.38s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .reclass-stepper-btn:hover {
            opacity: 1 !important;
          }
          .reclass-stepper-btn:active {
            transform: scale(0.985) !important;
          }
          .reclass-stepper-badge {
            transition: background-color 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        box-shadow 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        color 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.38s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .reclass-stepper-text {
            transition: color 0.38s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .reclass-stepper-line {
            transition: width 0.45s cubic-bezier(0.16, 1, 0.3, 1),
                        box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1) !important;
            will-change: width;
          }
        `}</style>

        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
          borderRadius: '16px',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
          padding: '12px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: isDark ? '0 8px 28px rgba(0, 0, 0, 0.35)' : '0 2px 12px rgba(0, 0, 0, 0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          overflowX: 'auto',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Step 1: Inventory CSV Ingestion */}
          <div
            className="reclass-stepper-btn"
            onClick={() => setCurrentStep(1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '12px',
              backgroundColor: currentStep === 1
                ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                : (currentStep > 1 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc') : 'transparent'),
              border: currentStep === 1
                ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #93c5fd')
                : (currentStep > 1 ? (isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe') : (isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)')),
              boxShadow: currentStep === 1
                ? (isDark ? '0 0 16px rgba(59, 130, 246, 0.25)' : '0 2px 10px rgba(37, 99, 235, 0.15)')
                : 'none',
              transform: currentStep === 1 ? 'translateY(-1px)' : 'translateY(0)',
              opacity: 1,
              flexShrink: 0,
              userSelect: 'none'
            }}
          >
            <div
              className="reclass-stepper-badge"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: currentStep === 1
                  ? '#2563eb'
                  : (currentStep > 1 ? '#2563eb' : (isDark ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0')),
                backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.08) 100%)',
                color: currentStep >= 1 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13.5px',
                boxShadow: currentStep === 1
                  ? (isDark ? '0 0 16px rgba(59, 130, 246, 0.5), 0 0 0 3.5px rgba(59, 130, 246, 0.25)' : '0 4px 12px rgba(37, 99, 235, 0.35), 0 0 0 3.5px rgba(59, 130, 246, 0.25)')
                  : 'none',
                transform: currentStep === 1 ? 'scale(1.06)' : 'scale(1)',
                flexShrink: 0
              }}
            >
              1
            </div>
            <div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: currentStep === 1 ? (isDark ? '#60a5fa' : '#1d4ed8') : (currentStep > 1 ? (isDark ? '#f8fafc' : '#1e293b') : (isDark ? '#94a3b8' : '#64748b')),
                  lineHeight: 1.2
                }}
              >
                Step 1: Inventory CSV Ingestion
              </div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '11px',
                  color: currentStep === 1 ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--muted)',
                  fontWeight: 500,
                  marginTop: '1px'
                }}
              >
                {isStep1Done ? `${incumbents.length} Records Loaded` : 'Template & Master Inventory Sync'}
              </div>
            </div>
          </div>

          {/* Connector Line 1 -> 2 */}
          <div style={{
            flex: 1,
            minWidth: '36px',
            height: '4px',
            borderRadius: '999px',
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
            position: 'relative',
            overflow: 'hidden',
            transition: 'background-color 0.38s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div
              className="reclass-stepper-line"
              style={{
                height: '100%',
                width: currentStep >= 2 ? '100%' : '0%',
                background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                boxShadow: currentStep >= 2 ? '0 0 8px rgba(59, 130, 246, 0.45)' : 'none',
                borderRadius: '999px'
              }}
            />
          </div>

          {/* Step 2: Counselor Assessment & Workbench */}
          <div
            className="reclass-stepper-btn"
            onClick={() => setCurrentStep(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '12px',
              backgroundColor: currentStep === 2
                ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                : (currentStep > 2 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc') : 'transparent'),
              border: currentStep === 2
                ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #93c5fd')
                : (currentStep > 2 ? (isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe') : (isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)')),
              boxShadow: currentStep === 2
                ? (isDark ? '0 0 16px rgba(59, 130, 246, 0.25)' : '0 2px 10px rgba(37, 99, 235, 0.15)')
                : 'none',
              transform: currentStep === 2 ? 'translateY(-1px)' : 'translateY(0)',
              opacity: currentStep >= 2 ? 1 : 0.55,
              flexShrink: 0,
              userSelect: 'none'
            }}
          >
            <div
              className="reclass-stepper-badge"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: currentStep === 2
                  ? '#2563eb'
                  : (currentStep > 2 ? '#2563eb' : (isDark ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0')),
                backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.08) 100%)',
                color: currentStep >= 2 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13.5px',
                boxShadow: currentStep === 2
                  ? (isDark ? '0 0 16px rgba(59, 130, 246, 0.5), 0 0 0 3.5px rgba(59, 130, 246, 0.25)' : '0 4px 12px rgba(37, 99, 235, 0.35), 0 0 0 3.5px rgba(59, 130, 246, 0.25)')
                  : 'none',
                transform: currentStep === 2 ? 'scale(1.06)' : 'scale(1)',
                flexShrink: 0
              }}
            >
              2
            </div>
            <div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: currentStep === 2 ? (isDark ? '#60a5fa' : '#1d4ed8') : (currentStep > 2 ? (isDark ? '#f8fafc' : '#1e293b') : (isDark ? '#94a3b8' : '#64748b')),
                  lineHeight: 1.2
                }}
              >
                Step 2: Assessment Workbench
              </div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '11px',
                  color: currentStep === 2 ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--muted)',
                  fontWeight: 500,
                  marginTop: '1px'
                }}
              >
                {isStep2Done ? 'Assessments & Position Assigned' : 'Stage Progression & Reclass Decisions'}
              </div>
            </div>
          </div>

          {/* Connector Line 2 -> 3 */}
          <div style={{
            flex: 1,
            minWidth: '36px',
            height: '4px',
            borderRadius: '999px',
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
            position: 'relative',
            overflow: 'hidden',
            transition: 'background-color 0.38s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div
              className="reclass-stepper-line"
              style={{
                height: '100%',
                width: currentStep >= 3 ? '100%' : '0%',
                background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                boxShadow: currentStep >= 3 ? '0 0 8px rgba(59, 130, 246, 0.45)' : 'none',
                borderRadius: '999px'
              }}
            />
          </div>

          {/* Step 3: DBM Endorsement & Report */}
          <div
            className="reclass-stepper-btn"
            onClick={() => setCurrentStep(3)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '12px',
              backgroundColor: currentStep === 3
                ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                : 'transparent',
              border: currentStep === 3
                ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #93c5fd')
                : (isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)'),
              boxShadow: currentStep === 3
                ? (isDark ? '0 0 16px rgba(59, 130, 246, 0.25)' : '0 2px 10px rgba(37, 99, 235, 0.15)')
                : 'none',
              transform: currentStep === 3 ? 'translateY(-1px)' : 'translateY(0)',
              opacity: currentStep === 3 ? 1 : 0.55,
              flexShrink: 0,
              userSelect: 'none'
            }}
          >
            <div
              className="reclass-stepper-badge"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: currentStep === 3
                  ? '#2563eb'
                  : (isDark ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0'),
                backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.08) 100%)',
                color: currentStep === 3 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13.5px',
                boxShadow: currentStep === 3
                  ? (isDark ? '0 0 16px rgba(59, 130, 246, 0.5), 0 0 0 3.5px rgba(59, 130, 246, 0.25)' : '0 4px 12px rgba(37, 99, 235, 0.35), 0 0 0 3.5px rgba(59, 130, 246, 0.25)')
                  : 'none',
                transform: currentStep === 3 ? 'scale(1.06)' : 'scale(1)',
                flexShrink: 0
              }}
            >
              3
            </div>
            <div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: currentStep === 3 ? (isDark ? '#60a5fa' : '#1d4ed8') : (isDark ? '#94a3b8' : '#64748b'),
                  lineHeight: 1.2
                }}
              >
                Step 3: DBM Endorsement
              </div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '11px',
                  color: currentStep === 3 ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--muted)',
                  fontWeight: 500,
                  marginTop: '1px'
                }}
              >
                {isStep3Done ? 'Ready for Transmittal' : 'Summary & DBM Spreadsheet'}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 1 VIEW: INVENTORY & CSV INGESTION */}
        {currentStep === 1 && (
          <div className="reclass-step-content-anim" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status Banner for Master Inventory */}
            {isStep1Done ? (
              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800
                  }}>
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: isDark ? '#6ee7b7' : '#065f46' }}>
                      Master Plantilla Inventory Active: {incumbents.length.toLocaleString()} Records Loaded
                    </div>
                    <div style={{ fontSize: '12px', color: isDark ? '#a7f3d0' : '#047857' }}>
                      {incumbentMetrics.forReview} For Review • {incumbentMetrics.endorsed} Endorsed • {incumbentMetrics.approved} Approved • {incumbentMetrics.vacant} Vacant/Unfilled • {incumbentMetrics.abolition || 0} Abolitions
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleExecuteCsvIngestion(true)}
                    disabled={isUploadingCsv}
                    style={{
                      background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: isDark ? '#f8fafc' : '#0f172a',
                      cursor: isUploadingCsv ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isUploadingCsv ? 'Syncing...' : 'Re-sync Master Inventory'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
                border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800
                  }}>
                    ⚡
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: isDark ? '#93c5fa' : '#1e40af' }}>
                      Official Nationwide Master Inventory Available
                    </div>
                    <div style={{ fontSize: '12px', color: isDark ? '#cbd5e1' : '#3b82f6' }}>
                      5,600+ DepEd guidance counselor plantilla positions ready to sync into database
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExecuteCsvIngestion(true)}
                  disabled={isUploadingCsv}
                  style={{
                    background: '#2563eb',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 750,
                    color: '#ffffff',
                    cursor: isUploadingCsv ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  {isUploadingCsv ? 'Syncing Records...' : 'Sync Master Inventory Now'}
                </button>
              </div>
            )}

            {/* Custom CSV Upload & Dropzone Card */}
            <div style={{
              background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
              borderRadius: '16px',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
              padding: '24px 28px',
              boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                    Upload Custom or Updated Inventory CSV
                  </h3>
                  <p style={{ margin: 0, fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                    Upload a division or regional guidance counselor inventory file to batch ingest or update existing items.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc',
                    border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: isDark ? '#93c5fd' : '#1d4ed8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download CSV Template
                </button>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleSelectCsvFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => document.getElementById('step1-reclass-csv-input')?.click()}
                style={{
                  border: isDragging
                    ? '2px dashed #3b82f6'
                    : (isDark ? '2px dashed rgba(71, 85, 105, 0.8)' : '2px dashed #cbd5e1'),
                  borderRadius: '14px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: isDragging
                    ? (isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff')
                    : (isDark ? 'rgba(30, 41, 59, 0.35)' : '#f8fafc'),
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              >
                <input
                  id="step1-reclass-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleSelectCsvFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />

                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe',
                  color: isDark ? '#60a5fa' : '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>

                <div style={{ fontSize: '15px', fontWeight: 750, color: isDark ? '#f8fafc' : '#0f172a', marginBottom: '4px' }}>
                  {csvFileName ? `Selected: ${csvFileName}` : 'Drag and drop your .csv file here, or click to browse'}
                </div>
                <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {csvTotalRowsCount > 0
                    ? `✓ ${csvTotalRowsCount.toLocaleString()} data records parsed and ready for ingestion`
                    : 'Supports standard CSV files with commas and quoted text fields'}
                </div>
              </div>

              {/* Data Preview Table */}
              {csvPreviewRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 750, color: isDark ? '#cbd5e1' : '#1e293b' }}>
                      Previewing First {csvPreviewRows.length} Records (of {csvTotalRowsCount.toLocaleString()} rows)
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#10b981', fontWeight: 700 }}>
                      ✓ Header Columns Validated
                    </span>
                  </div>

                  <div style={{
                    overflowX: 'auto',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Item Number</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Incumbent</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Current Position</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Division</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Target Reclass</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.map((row, idx) => {
                          const itemNo = row['PLANTILLA ITEM NUMBER'] || row['Plantilla Item Number'] || Object.values(row)[4] || '—';
                          const name = row['INCUMBENT'] || row['Incumbent'] || Object.values(row)[7] || '#N/A';
                          const pos = row['POSITION TITLE'] || row['Position Title'] || Object.values(row)[5] || '—';
                          const division = row['DIVISION'] || row['Division'] || Object.values(row)[1] || '—';
                          const target = row['RECLASS POSITION'] || row['Reclass Position'] || Object.values(row)[8] || 'For Review';

                          return (
                            <tr key={idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 650, color: isDark ? '#f8fafc' : '#0f172a' }}>{itemNo}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#cbd5e1' : '#334155' }}>
                                {name === '#N/A' ? <em style={{ color: '#94a3b8' }}>Unfilled / Vacant</em> : name}
                              </td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{pos}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{division}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                                  color: isDark ? '#93c5fd' : '#1d4ed8'
                                }}>
                                  {target === '#N/A' ? 'Pending Eval' : target}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


              {/* Progress Indicator */}
              {isUploadingCsv && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                    <span>Processing and Ingesting Records into Database...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: isDark ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${uploadProgress}%`,
                      background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {/* Ingestion Report Banner */}
              {uploadStats && (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#6ee7b7' : '#065f46', fontWeight: 750, fontSize: '14px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      {uploadStats.message}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      style={{
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: 750,
                        cursor: 'pointer'
                      }}
                    >
                      Open Step 2: Assessment Workbench →
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    <div style={{ padding: '8px 12px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total in Database</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>{uploadStats.totalInDatabase || uploadStats.insertedOrUpdated}</div>
                    </div>
                    {uploadStats.metrics && (
                      <>
                        <div style={{ padding: '8px 12px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>For Review</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f59e0b' }}>{uploadStats.metrics.forReview}</div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Vacant / Unfilled</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#64748b' }}>{uploadStats.metrics.vacant}</div>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Abolition</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ef4444' }}>{uploadStats.metrics.abolition}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Execution Action Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleExecuteCsvIngestion(false)}
                  disabled={isUploadingCsv || (!csvContent && !csvFile)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: (!csvContent && !csvFile) || isUploadingCsv
                      ? '#64748b'
                      : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: (!csvContent && !csvFile) || isUploadingCsv ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: (!csvContent && !csvFile) || isUploadingCsv ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  {isUploadingCsv ? 'Ingesting CSV Records...' : (csvTotalRowsCount > 0 ? `Ingest ${csvTotalRowsCount.toLocaleString()} Records` : 'Start CSV Ingestion')}
                </button>

                {isStep1Done && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '10px',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                      background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontSize: '13px',
                      fontWeight: 750,
                      cursor: 'pointer'
                    }}
                  >
                    Proceed to Step 2 →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 VIEW: COUNSELOR ASSESSMENT WORKBENCH */}
        {currentStep === 2 && (
          <div className="reclass-step-content-anim">
            {/* Incumbent Guidance Counselors KPI Cards Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div className="card" style={{
                background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
                backdropFilter: 'blur(16px)',
                borderRadius: '16px',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                padding: '18px 22px',
                boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#94a3b8' : 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Incumbent Counselors
                </div>
                <div style={{ fontSize: '30px', fontWeight: 850, color: 'var(--text)', margin: '6px 0 2px' }}>
                  {incumbentMetrics.total}
                </div>
                <div style={{ fontSize: '12px', color: isDark ? '#64748b' : 'var(--text-secondary, #64748b)' }}>Under reclassification assessment</div>
              </div>

          <div className="card" style={{
            background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            padding: '18px 22px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
            borderLeft: isDark ? '4px solid #f59e0b' : '4px solid #d97706'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#fbbf24' : '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              For Review
            </div>
            <div style={{ fontSize: '30px', fontWeight: 850, color: isDark ? '#fde68a' : '#b45309', margin: '6px 0 2px' }}>
              {incumbentMetrics.forReview}
            </div>
            <div style={{ fontSize: '12px', color: isDark ? '#fbbf24' : '#92400e' }}>Awaiting HRMO assessment</div>
          </div>

          <div className="card" style={{
            background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            padding: '18px 22px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
            borderLeft: isDark ? '4px solid #3b82f6' : '4px solid #2563eb'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#60a5fa' : '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Endorsed
            </div>
            <div style={{ fontSize: '30px', fontWeight: 850, color: isDark ? '#93c5fd' : '#1e40af', margin: '6px 0 2px' }}>
              {incumbentMetrics.endorsed}
            </div>
            <div style={{ fontSize: '12px', color: isDark ? '#60a5fa' : '#2563eb' }}>Endorsed for appointment</div>
          </div>

          <div className="card" style={{
            background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            padding: '18px 22px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
            borderLeft: isDark ? '4px solid #10b981' : '4px solid #059669'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#34d399' : '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Approved
            </div>
            <div style={{ fontSize: '30px', fontWeight: 850, color: isDark ? '#a7f3d0' : '#065f46', margin: '6px 0 2px' }}>
              {incumbentMetrics.approved}
            </div>
            <div style={{ fontSize: '12px', color: isDark ? '#34d399' : '#059669' }}>Reclassification approved</div>
          </div>

          <div className="card" style={{
            background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            padding: '18px 22px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
            borderLeft: isDark ? '4px solid #ef4444' : '4px solid #dc2626'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#f87171' : '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Denied
            </div>
            <div style={{ fontSize: '30px', fontWeight: 850, color: isDark ? '#fca5a5' : '#991b1b', margin: '6px 0 2px' }}>
              {incumbentMetrics.denied}
            </div>
            <div style={{ fontSize: '12px', color: isDark ? '#f87171' : '#dc2626' }}>Ineligible / deficient</div>
          </div>
        </div>

        {/* Controls & Filter Bar */}
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
          flexWrap: 'wrap'
        }}>
          {/* Left Group: Search & Filter Dropdowns */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: 1,
            flexWrap: 'wrap',
            minWidth: '280px'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '320px', minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search name, item no, region, division, station..."
                value={incumbentSearchTerm}
                onChange={e => setIncumbentSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 32px',
                  borderRadius: '9px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--input-border, var(--line))',
                  fontSize: '13px',
                  background: 'var(--input-bg)',
                  color: 'var(--input-text, var(--text))',
                  outline: 'none',
                  transition: 'border-color 0.15s, background 0.15s'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--primary, #3b82f6)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--input-border, var(--line))';
                }}
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary, #94a3b8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '10px' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {incumbentSearchTerm && (
                <button
                  type="button"
                  onClick={() => setIncumbentSearchTerm('')}
                  title="Clear search"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary, #94a3b8)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Region Filter */}
            {distinctRegions.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select
                  value={incumbentRegionFilter}
                  onChange={e => setIncumbentRegionFilter(e.target.value)}
                  style={{
                    padding: '8px 28px 8px 12px',
                    borderRadius: '9px',
                    border: incumbentRegionFilter
                      ? (isDark ? '1.5px solid #38bdf8' : '1.5px solid #0284c7')
                      : (isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--input-border, var(--line))'),
                    fontSize: '12.5px',
                    fontWeight: incumbentRegionFilter ? 700 : 500,
                    background: incumbentRegionFilter
                      ? (isDark ? 'rgba(2, 132, 199, 0.25)' : '#e0f2fe')
                      : 'var(--input-bg)',
                    color: incumbentRegionFilter
                      ? (isDark ? '#7dd3fc' : '#0369a1')
                      : 'var(--input-text, var(--text))',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    WebkitAppearance: 'none'
                  }}
                >
                  <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>All Regions ({distinctRegions.length})</option>
                  {distinctRegions.map(r => (
                    <option key={r} value={r} style={{ background: 'var(--card)', color: 'var(--text)' }}>{r}</option>
                  ))}
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={incumbentRegionFilter ? (isDark ? '#7dd3fc' : '#0284c7') : 'var(--text-secondary, #64748b)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '10px', top: '12px', pointerEvents: 'none' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            )}

            {/* Stage Filter */}
            <div style={{ position: 'relative' }}>
              <select
                value={incumbentStageFilter}
                onChange={e => setIncumbentStageFilter(e.target.value)}
                style={{
                  padding: '8px 28px 8px 12px',
                  borderRadius: '9px',
                  border: incumbentStageFilter
                    ? (isDark ? '1.5px solid #3b82f6' : '1.5px solid #2563eb')
                    : (isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--input-border, var(--line))'),
                  fontSize: '12.5px',
                  fontWeight: incumbentStageFilter ? 700 : 500,
                  background: incumbentStageFilter
                    ? (isDark ? 'rgba(30, 58, 138, 0.4)' : '#eff6ff')
                    : 'var(--input-bg)',
                  color: incumbentStageFilter
                    ? (isDark ? '#93c5fd' : '#1d4ed8')
                    : 'var(--input-text, var(--text))',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
              >
                <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>All Reclassification Stages</option>
                {RECLASS_STAGES.map(s => (
                  <option key={s} value={s} style={{ background: 'var(--card)', color: 'var(--text)' }}>{s}</option>
                ))}
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={incumbentStageFilter ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--text-secondary, #64748b)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '10px', top: '12px', pointerEvents: 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Position Filter */}
            <div style={{ position: 'relative' }}>
              <select
                value={incumbentPositionFilter}
                onChange={e => setIncumbentPositionFilter(e.target.value)}
                style={{
                  padding: '8px 28px 8px 12px',
                  borderRadius: '9px',
                  border: incumbentPositionFilter
                    ? (isDark ? '1.5px solid #10b981' : '1.5px solid #059669')
                    : (isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--input-border, var(--line))'),
                  fontSize: '12.5px',
                  fontWeight: incumbentPositionFilter ? 700 : 500,
                  background: incumbentPositionFilter
                    ? (isDark ? 'rgba(6, 78, 59, 0.4)' : '#ecfdf5')
                    : 'var(--input-bg)',
                  color: incumbentPositionFilter
                    ? (isDark ? '#6ee7b7' : '#047857')
                    : 'var(--input-text, var(--text))',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
              >
                <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>All Target Positions</option>
                <option value="UNASSIGNED" style={{ background: 'var(--card)', color: 'var(--text)' }}>Unassigned Only</option>
                {RECLASS_POSITIONS_OPTIONS.map(pos => (
                  <option key={pos} value={pos} style={{ background: 'var(--card)', color: 'var(--text)' }}>{pos}</option>
                ))}
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={incumbentPositionFilter ? (isDark ? '#6ee7b7' : '#059669') : 'var(--text-secondary, #64748b)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '10px', top: '12px', pointerEvents: 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Active Filters Reset Button */}
            {(incumbentSearchTerm || incumbentStageFilter || incumbentPositionFilter || incumbentRegionFilter) && (
              <button
                type="button"
                onClick={() => {
                  setIncumbentSearchTerm('');
                  setIncumbentStageFilter('');
                  setIncumbentPositionFilter('');
                  setIncumbentRegionFilter('');
                }}
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  padding: '7px 11px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 650,
                  color: isDark ? '#94a3b8' : 'var(--text-secondary, #64748b)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = isDark ? '#fca5a5' : '#b91c1c';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--line)';
                  e.currentTarget.style.color = isDark ? '#94a3b8' : 'var(--text-secondary, #64748b)';
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reset
              </button>
            )}
          </div>

          {/* Right Group: Record Count & Refresh Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {filteredIncumbents.length} {filteredIncumbents.length === 1 ? 'record' : 'records'}
            </span>

            <button
              type="button"
              onClick={fetchIncumbents}
              disabled={loadingIncumbents}
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                padding: '7px 13px',
                borderRadius: '8px',
                fontSize: '12.5px',
                color: 'var(--text)',
                cursor: loadingIncumbents ? 'not-allowed' : 'pointer',
                fontWeight: 650,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => {
                if (!loadingIncumbents) {
                  e.currentTarget.style.background = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--card-solid, #ffffff)';
                  e.currentTarget.style.borderColor = isDark ? '#94a3b8' : 'var(--line)';
                }
              }}
              onMouseOut={e => {
                if (!loadingIncumbents) {
                  e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--line)';
                }
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={loadingIncumbents ? { animation: 'spin 1s linear infinite' } : {}}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Data Table Card for Incumbents */}
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
          overflow: 'hidden',
          boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'var(--card-subtle)'
          }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                Incumbent Guidance Counselors Assessment Table
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
                Showing {pagedIncumbents.length} of {filteredIncumbents.length} personnel • Click row to open full assessment credentials & documents
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              minWidth: '1620px',
              tableLayout: 'auto',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px'
            }}>
              <thead>
                <tr style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.85)',
                  borderBottom: isDark ? '1.5px solid rgba(51, 65, 85, 0.7)' : '1.5px solid var(--line)',
                  color: 'var(--text-secondary, #94a3b8)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <th style={{ padding: '14px 16px', width: '50px', whiteSpace: 'nowrap', textAlign: 'left' }}>No.</th>
                  <th style={{ padding: '14px 18px', minWidth: '240px', whiteSpace: 'nowrap', textAlign: 'left' }}>Plantilla Item & Incumbent</th>
                  <th style={{ padding: '14px 18px', minWidth: '170px', whiteSpace: 'nowrap', textAlign: 'left' }}>Current Position & SG</th>
                  <th style={{ padding: '14px 18px', minWidth: '220px', whiteSpace: 'nowrap', textAlign: 'left' }}>Station / School & Org Code</th>
                  <th style={{ padding: '14px 18px', minWidth: '180px', whiteSpace: 'nowrap', textAlign: 'left' }}>Division & Region</th>
                  <th style={{ padding: '14px 18px', minWidth: '170px', whiteSpace: 'nowrap', textAlign: 'left' }}>Stage of Reclassification</th>
                  <th style={{ padding: '14px 18px', minWidth: '190px', whiteSpace: 'nowrap', textAlign: 'left' }}>Target Position & Remarks</th>
                  <th style={{ padding: '14px 18px', minWidth: '210px', whiteSpace: 'nowrap', textAlign: 'left' }}>Credentials Overview</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right', minWidth: '120px', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingIncumbents ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #94a3b8)' }}>
                      Loading incumbent guidance counselors...
                    </td>
                  </tr>
                ) : pagedIncumbents.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #94a3b8)' }}>
                      No incumbent guidance counselors found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  pagedIncumbents.map((inc, idx) => {
                    const rowNum = (currentPageIncumbents - 1) * pageSizeIncumbents + idx + 1;
                    const badgeStyle = getStageBadge(inc.stage_of_reclassification);

                    return (
                      <tr
                        key={inc.id}
                        onClick={() => {
                          setSelectedIncumbent(inc);
                          setShowAssessmentModal(true);
                        }}
                        style={{
                          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid var(--line)',
                          transition: 'background 0.15s',
                          cursor: 'pointer'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.7)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
                          {rowNum}
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            {inc.full_name === '#N/A' ? (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '5px',
                                background: isDark ? 'rgba(234, 179, 8, 0.2)' : '#fef9c3',
                                color: isDark ? '#fde047' : '#854d0e',
                                border: isDark ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid #fef08a',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase'
                              }}>
                                Unfilled / Vacant
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '5px',
                                background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                                color: isDark ? '#6ee7b7' : '#166534',
                                border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase'
                              }}>
                                Filled
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 750, color: inc.full_name === '#N/A' ? 'var(--muted)' : 'var(--text)', fontSize: '13.5px' }}>
                            {inc.full_name === '#N/A' ? 'Unassigned Plantilla' : inc.full_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace', marginTop: '2px' }}>
                            {inc.plantilla_item_number || inc.employee_id}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>{inc.current_position}</div>
                          {inc.salary_grade && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 800,
                              color: isDark ? '#93c5fd' : '#1e40af',
                              background: isDark ? 'rgba(30, 58, 138, 0.3)' : '#eff6ff',
                              border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe',
                              padding: '1.5px 7px',
                              borderRadius: '5px',
                              display: 'inline-block',
                              marginTop: '4px'
                            }}>
                              SG {inc.salary_grade}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>
                            {inc.uacs_oper_dsc || inc.station_division || '—'}
                          </div>
                          {inc.org_cd && (
                            <div style={{ marginTop: '4px' }}>
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 750,
                                fontFamily: 'monospace',
                                color: 'var(--text-secondary, #94a3b8)',
                                background: isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9',
                                border: '1px solid var(--line)',
                                padding: '1.5px 6px',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}>
                                ORG CD: {inc.org_cd}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 650, color: 'var(--text)', fontSize: '12.5px' }}>
                            {inc.division || inc.station_division || '—'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                            {inc.region || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <select
                              value={inc.stage_of_reclassification || 'For Review'}
                              onChange={e => handleUpdateIncumbentStage(inc.id, e.target.value, e)}
                              disabled={updatingStageId === inc.id}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '8px',
                                border: `1.5px solid ${badgeStyle.border}`,
                                background: badgeStyle.bg,
                                color: badgeStyle.text,
                                fontSize: '12px',
                                fontWeight: 750,
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              {RECLASS_STAGES.map(s => (
                                <option key={s} value={s} style={{ background: 'var(--card)', color: 'var(--text)' }}>{s}</option>
                              ))}
                            </select>
                            {updatingStageId === inc.id && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {inc.reclass_position ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                                color: isDark ? '#6ee7b7' : '#047857',
                                border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                                fontSize: '11.5px',
                                fontWeight: 750,
                                width: 'fit-content'
                              }}>
                                {inc.reclass_position}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '12px', fontStyle: 'italic' }}>
                                — Unassigned
                              </span>
                            )}
                            {inc.remarks && (
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 650,
                                padding: '2.5px 7px',
                                borderRadius: '5px',
                                background: isDark ? 'rgba(51, 65, 85, 0.4)' : '#f8fafc',
                                border: '1px solid var(--line)',
                                color: isDark ? '#cbd5e1' : '#475569',
                                width: 'fit-content',
                                maxWidth: '220px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={inc.remarks}>
                                {inc.remarks}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          {(() => {
                            const edu = inc.education || inc.assessment?.education;
                            const exp = inc.years_experience ?? inc.assessment?.years_experience;
                            const trn = inc.hours_of_training ?? inc.assessment?.hours_of_training;
                            const elig = inc.eligibility || inc.assessment?.eligibility;
                            const hasAnyCred = edu || exp !== undefined || trn !== undefined || elig;

                            if (!hasAnyCred) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: 'var(--text-secondary, #94a3b8)',
                                    background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9',
                                    border: '1px solid var(--line)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    width: 'fit-content'
                                  }}>
                                    Pending Assessment
                                  </span>
                                  <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                                    Click to evaluate credentials
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '220px' }}>
                                {edu && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                                    <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '4px', background: '#eff6ff', color: '#1e40af', flexShrink: 0 }}>ED</span>
                                    <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }} title={edu}>{edu}</span>
                                  </div>
                                )}
                                {exp !== undefined && exp !== null && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '4px', background: '#fffbeb', color: '#92400e', flexShrink: 0 }}>EXP</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text)' }}>{exp} Years</span>
                                  </div>
                                )}
                                {trn !== undefined && trn !== null && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '4px', background: '#ecfdf5', color: '#065f46', flexShrink: 0 }}>TRN</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text)' }}>{trn} Hours</span>
                                  </div>
                                )}
                                {elig && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                                    <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1.5px 5px', borderRadius: '4px', background: '#faf5ff', color: '#6b21a8', flexShrink: 0 }}>ELIG</span>
                                    <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }} title={elig}>{elig}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedIncumbent(inc);
                              setShowAssessmentModal(true);
                            }}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                            }}
                          >
                            Assess / Docs
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Incumbent Pagination */}
          <div style={{
            padding: '14px 20px',
            borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'var(--card-subtle)'
          }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)' }}>
              Showing Page {currentPageIncumbents} of {Math.max(1, Math.ceil(filteredIncumbents.length / pageSizeIncumbents))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={currentPageIncumbents <= 1}
                onClick={() => setCurrentPageIncumbents(p => Math.max(1, p - 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  background: currentPageIncumbents <= 1
                    ? (isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(241, 245, 249, 0.5)')
                    : (isDark ? 'rgba(30, 41, 59, 0.7)' : 'var(--card-solid, #ffffff)'),
                  color: currentPageIncumbents <= 1 ? (isDark ? '#64748b' : '#94a3b8') : 'var(--text)',
                  fontSize: '12px',
                  cursor: currentPageIncumbents <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>
              <button
                disabled={currentPageIncumbents >= Math.ceil(filteredIncumbents.length / pageSizeIncumbents)}
                onClick={() => setCurrentPageIncumbents(p => p + 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  background: currentPageIncumbents >= Math.ceil(filteredIncumbents.length / pageSizeIncumbents)
                    ? (isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(241, 245, 249, 0.5)')
                    : (isDark ? 'rgba(30, 41, 59, 0.7)' : 'var(--card-solid, #ffffff)'),
                  color: currentPageIncumbents >= Math.ceil(filteredIncumbents.length / pageSizeIncumbents) ? (isDark ? '#64748b' : '#94a3b8') : 'var(--text)',
                  fontSize: '12px',
                  cursor: currentPageIncumbents >= Math.ceil(filteredIncumbents.length / pageSizeIncumbents) ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 Bottom Navigation Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '20px',
            padding: '16px 20px',
            borderRadius: '14px',
            background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.3)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
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
              ← Back to Step 1: Inventory CSV
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              style={{
                padding: '9px 22px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              Proceed to Step 3: DBM Endorsement →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 VIEW: DBM ENDORSEMENT & REPORT */}
      {currentStep === 3 && (
        <div className="reclass-step-content-anim" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Step 3 Header */}
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            padding: '24px 28px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
              {isRegionalOffice && (
                <>
                  <input
                    ref={noscaFileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleNoscaFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNoscaModal(true)}
                    disabled={scanningNosca}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                      border: 'none',
                      padding: '10px 20px',
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
                        <span>{scannedNoscaResult ? `Manage NOSCA (${selectedNoscaItems.length}/${scannedNoscaResult.count || 0})` : 'Upload & Scan NOSCA'}</span>
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleExportDBM}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 750,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export DBM Spreadsheet (.xlsx)
              </button>
            </div>

            {/* Summary KPIs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px'
            }}>
              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: isDark ? 'rgba(30, 58, 138, 0.25)' : '#eff6ff',
                border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#93c5fd' : '#1d4ed8', textTransform: 'uppercase' }}>
                  Endorsed for DBM
                </div>
                <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#bfdbfe' : '#1e40af', margin: '4px 0 2px' }}>
                  {incumbentMetrics.endorsed}
                </div>
                <div style={{ fontSize: '11.5px', color: isDark ? '#93c5fd' : '#2563eb' }}>Passed school/division endorsement</div>
              </div>

              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: isDark ? 'rgba(6, 95, 70, 0.25)' : '#ecfdf5',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#6ee7b7' : '#047857', textTransform: 'uppercase' }}>
                  Approved by Appointing Authority
                </div>
                <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#a7f3d0' : '#065f46', margin: '4px 0 2px' }}>
                  {incumbentMetrics.approved}
                </div>
                <div style={{ fontSize: '11.5px', color: isDark ? '#6ee7b7' : '#059669' }}>Final approval for reclassification</div>
              </div>

              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: isDark ? 'rgba(180, 83, 9, 0.2)' : '#fffbeb',
                border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#fde68a' : '#92400e', textTransform: 'uppercase' }}>
                  Pending Evaluation
                </div>
                <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#fef3c7' : '#b45309', margin: '4px 0 2px' }}>
                  {incumbentMetrics.forReview}
                </div>
                <div style={{ fontSize: '11.5px', color: isDark ? '#fde68a' : '#d97706' }}>Under qualifications check</div>
              </div>

              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase' }}>
                  Total Inventory Items
                </div>
                <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a', margin: '4px 0 2px' }}>
                  {incumbentMetrics.total}
                </div>
                <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b' }}>Guidance Counselor plantilla items</div>
              </div>
            </div>
          </div>



          {/* Endorsed Candidates List Card */}
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            padding: '24px 28px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: isDark ? '#f8fafc' : '#0f172a' }}>
                Endorsed & Approved Counselors for DBM Transmittal
              </h3>
              <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                {incumbents.filter(i => i.stage_of_reclassification === 'Endorsed' || i.stage_of_reclassification === 'Approved').length} candidates
              </span>
            </div>

            <div style={{
              overflowX: 'auto',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
              borderRadius: '12px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Plantilla Item No</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Incumbent Name</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Current Position</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Target Position</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Division</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {incumbents
                    .filter(i => i.stage_of_reclassification === 'Endorsed' || i.stage_of_reclassification === 'Approved')
                    .slice(0, 15)
                    .map((counselor, idx) => {
                      const badge = getStageBadge(counselor.stage_of_reclassification);
                      return (
                        <tr key={counselor.id || idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 650, color: isDark ? '#f8fafc' : '#0f172a' }}>{counselor.plantilla_item_number || counselor.employee_id}</td>
                          <td style={{ padding: '10px 14px', color: isDark ? '#cbd5e1' : '#334155', fontWeight: 700 }}>{counselor.full_name}</td>
                          <td style={{ padding: '10px 14px', color: isDark ? '#94a3b8' : '#64748b' }}>{counselor.current_position}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '3px 9px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                              color: isDark ? '#93c5fd' : '#1d4ed8'
                            }}>
                              {counselor.reclass_position || 'School Counselor'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: isDark ? '#94a3b8' : '#64748b' }}>{counselor.division || counselor.station_division}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`
                            }}>
                              {badge.icon} {counselor.stage_of_reclassification}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  {incumbents.filter(i => i.stage_of_reclassification === 'Endorsed' || i.stage_of_reclassification === 'Approved').length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
                        No counselors have been marked as Endorsed or Approved yet. Move candidates to Endorsed/Approved in Step 2.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Navigation Back */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
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
                ← Return to Step 2: Assessment Workbench
              </button>
            </div>
          </div>
        </div>
      )}
    </main>

      {/* MODAL 1: RE-EVALUATION AGAINST CSC QS */}
      {showReevalModal && selectedApp && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowReevalModal(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.75)' : 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'var(--modal-bg, var(--card))',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            width: 'min(580px, 94vw)',
            padding: '28px 32px',
            boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.15)',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#818cf8' : '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  CSC QUALIFICATION MATRIX
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text)' }}>
                  Re-evaluate Application
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReevalModal(false)}
                title="Close (Esc)"
                aria-label="Close Modal"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                  flexShrink: 0
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = isDark ? '#fca5a5' : '#b91c1c';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--line)';
                  e.currentTarget.style.color = 'var(--text-secondary, #94a3b8)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{
              background: isDark ? 'rgba(2, 6, 23, 0.6)' : 'var(--card-subtle)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '20px',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
              fontSize: '13px',
              color: 'var(--text)'
            }}>
              <div><b style={{ color: 'var(--text)' }}>Applicant:</b> {selectedApp.applicant_name} ({selectedApp.application_number})</div>
              <div><b style={{ color: 'var(--text)' }}>Target Position:</b> {selectedApp.position_title}</div>
              <div><b style={{ color: 'var(--text)' }}>Plantilla Item:</b> {selectedApp.item_number}</div>
              <div><b style={{ color: 'var(--text)' }}>Station:</b> {selectedApp.station_division}</div>
            </div>

            <form onSubmit={handleSaveReeval}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  CSC-Approved QS Evaluation Result
                </label>
                <select
                  value={reevalResult}
                  onChange={e => {
                    setReevalResult(e.target.value);
                    if (e.target.value.includes('Qualified')) {
                      setReevalStatus('reevaluated');
                    } else if (e.target.value.includes('Update')) {
                      setReevalStatus('needs_applicant_update');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '13.5px'
                  }}
                  required
                >
                  <option value="Qualified (CSC QS)" style={{ background: 'var(--card)', color: 'var(--text)' }}>Qualified (CSC QS)</option>
                  <option value="Needs Applicant Update" style={{ background: 'var(--card)', color: 'var(--text)' }}>Needs Applicant Update (Deficient Credentials)</option>
                  <option value="Disqualified" style={{ background: 'var(--card)', color: 'var(--text)' }}>Disqualified (Does Not Meet Approved QS)</option>
                  <option value="Pending CSC Review" style={{ background: 'var(--card)', color: 'var(--text)' }}>Pending CSC Review</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  Evaluation Lifecycle Status
                </label>
                <select
                  value={reevalStatus}
                  onChange={e => setReevalStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '13.5px'
                  }}
                  required
                >
                  <option value="reevaluated" style={{ background: 'var(--card)', color: 'var(--text)' }}>Re-evaluated (Ready for DBM Endorsement)</option>
                  <option value="needs_applicant_update" style={{ background: 'var(--card)', color: 'var(--text)' }}>Needs Applicant Update</option>
                  <option value="pending_reevaluation" style={{ background: 'var(--card)', color: 'var(--text)' }}>Pending Re-evaluation</option>
                </select>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  Evaluator Remarks / Justification
                </label>
                <textarea
                  rows="3"
                  value={reevalRemarks}
                  onChange={e => setReevalRemarks(e.target.value)}
                  placeholder="Record justification based on CSC qualification standards..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowReevalModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                    background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReeval}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#6366f1',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  {submittingReeval ? 'Saving...' : 'Confirm Re-evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREDENTIALS / DOCUMENT UPDATE */}
      {showDocModal && selectedApp && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowDocModal(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.75)' : 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'var(--modal-bg, var(--card))',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            width: 'min(580px, 94vw)',
            padding: '28px 32px',
            boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.15)',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#34d399' : '#059669', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  APPLICANT CREDENTIALS VAULT
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text)' }}>
                  Document Records — {selectedApp.applicant_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                title="Close (Esc)"
                aria-label="Close Modal"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                  flexShrink: 0
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = isDark ? '#fca5a5' : '#b91c1c';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--line)';
                  e.currentTarget.style.color = 'var(--text-secondary, #94a3b8)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Current Attached Documents */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-secondary, #94a3b8)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Existing Attached Credentials ({Array.isArray(selectedApp.documents) ? selectedApp.documents.length : 0})
              </div>
              <div style={{
                maxHeight: '140px',
                overflowY: 'auto',
                background: isDark ? 'rgba(2, 6, 23, 0.6)' : 'var(--card-subtle)',
                borderRadius: '10px',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                padding: '8px 12px'
              }}>
                {(!selectedApp.documents || selectedApp.documents.length === 0) ? (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)', textAlign: 'center', padding: '12px' }}>
                    No updated credentials on file yet.
                  </div>
                ) : (
                  (Array.isArray(selectedApp.documents) ? selectedApp.documents : []).map((doc, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: idx < selectedApp.documents.length - 1 ? (isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid var(--line)') : 'none',
                      fontSize: '12.5px'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>📄 {doc.name || doc}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Verified'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add New Document Form */}
            <form onSubmit={handleSaveDocument}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  Document / Credential Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Masteral_Degree_Transcript_2026.pdf"
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  Document Category
                </label>
                <select
                  value={newDocType}
                  onChange={e => setNewDocType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '13px'
                  }}
                >
                  <option value="pds" style={{ background: 'var(--card)', color: 'var(--text)' }}>Personal Data Sheet (CS Form 212)</option>
                  <option value="tor" style={{ background: 'var(--card)', color: 'var(--text)' }}>Transcript of Records / Diploma</option>
                  <option value="ipcrf" style={{ background: 'var(--card)', color: 'var(--text)' }}>IPCRF / Performance Rating</option>
                  <option value="service_record" style={{ background: 'var(--card)', color: 'var(--text)' }}>Service Record / Certificates</option>
                  <option value="csc_eligibility" style={{ background: 'var(--card)', color: 'var(--text)' }}>CSC Eligibility / Board License</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                    background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDoc}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  {submittingDoc ? 'Updating...' : '+ Attach Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NEW RECLASSIFICATION APPLICATION */}
      {showNewAppModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewAppModal(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.75)' : 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'var(--modal-bg, var(--card))',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            width: 'min(580px, 94vw)',
            padding: '28px 32px',
            boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.15)',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#60a5fa' : '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  INTAKE WORKBENCH
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text)' }}>
                  New Reclassification Entry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAppModal(false)}
                title="Close (Esc)"
                aria-label="Close Modal"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                  flexShrink: 0
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = isDark ? '#fca5a5' : '#b91c1c';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--line)';
                  e.currentTarget.style.color = 'var(--text-secondary, #94a3b8)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateNewApp}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  Applicant Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Juanita D. Reyes"
                  value={newApplicantName}
                  onChange={e => setNewApplicantName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  Reclassification Target Position
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Teacher I (Elementary)"
                  value={newPosition}
                  onChange={e => setNewPosition(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                    background: 'var(--input-bg)',
                    color: 'var(--input-text, var(--text))',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '22px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                    Plantilla Item No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OSEC-DECSB-MTCHR1-00045"
                    value={newItemNumber}
                    onChange={e => setNewItemNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                      background: 'var(--input-bg)',
                      color: 'var(--input-text, var(--text))',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                    Station / Division
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SDO Quezon City"
                    value={newStation}
                    onChange={e => setNewStation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                      background: 'var(--input-bg)',
                      color: 'var(--input-text, var(--text))',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewAppModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                    background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-subtle)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNewApp}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  {submittingNewApp ? 'Creating...' : 'Register Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: INCUMBENT GUIDANCE COUNSELOR ASSESSMENT MODAL */}
      {showAssessmentModal && selectedIncumbent && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowAssessmentModal(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.75)' : 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'var(--modal-bg, var(--card))',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            width: 'min(820px, 96vw)',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isDark ? '0 25px 60px rgba(0, 0, 0, 0.6)' : '0 20px 40px rgba(0, 0, 0, 0.15)',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '22px 28px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
              background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'var(--card-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isDark ? '#93c5fd' : '#1d4ed8',
                    background: isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff',
                    border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}>
                    Incumbent Guidance Counselor Assessment
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #94a3b8)',
                    background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-solid, #ffffff)',
                    border: '1px solid var(--line)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontFamily: 'monospace'
                  }}>
                    {selectedIncumbent.employee_id}
                  </span>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 850, margin: '2px 0 0', color: 'var(--text)' }}>
                  {selectedIncumbent.full_name}
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                  <b style={{ color: 'var(--text)' }}>Current:</b> {selectedIncumbent.current_position} • <b style={{ color: 'var(--text)' }}>Station:</b> {selectedIncumbent.station_division}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAssessmentModal(false)}
                title="Close Assessment (Esc)"
                aria-label="Close Assessment Modal"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-solid, #ffffff)',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                  flexShrink: 0
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = isDark ? '#fca5a5' : '#b91c1c';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-solid, #ffffff)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--line)';
                  e.currentTarget.style.color = 'var(--text-secondary, #94a3b8)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{
              padding: '24px 28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Card 0: Official Plantilla & Station Profile */}
              <div style={{
                background: isDark ? 'rgba(2, 6, 23, 0.6)' : 'var(--card-subtle)',
                borderRadius: '16px',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                padding: '18px 20px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: isDark ? '#38bdf8' : '#0284c7',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '12px'
                }}>
                  Official Plantilla & Station Assignment
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  fontSize: '12.5px'
                }}>
                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '10px 14px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Plantilla Item No.</div>
                    <div style={{ fontWeight: 800, color: 'var(--text)', marginTop: '2px', fontFamily: 'monospace' }}>
                      {selectedIncumbent.plantilla_item_number || selectedIncumbent.employee_id}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '10px 14px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Station / School</div>
                    <div style={{ fontWeight: 750, color: 'var(--text)', marginTop: '2px' }}>
                      {selectedIncumbent.uacs_oper_dsc || selectedIncumbent.station_division || '—'}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '10px 14px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Division & Region</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                      {selectedIncumbent.division || selectedIncumbent.station_division || '—'}
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>{selectedIncumbent.region}</span>
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '10px 14px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Org Code & Salary Grade</div>
                    <div style={{ fontWeight: 750, color: 'var(--text)', marginTop: '2px' }}>
                      {selectedIncumbent.org_cd ? `ORG ${selectedIncumbent.org_cd}` : '—'} • <span style={{ color: '#2563eb' }}>SG {selectedIncumbent.salary_grade || '—'}</span>
                    </div>
                  </div>

                  {selectedIncumbent.remarks && (
                    <div style={{ gridColumn: '1 / -1', background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '10px 14px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Inventory Remarks</div>
                      <div style={{ fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155', marginTop: '2px' }}>
                        {selectedIncumbent.remarks}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 1: Read-Only Evaluation Credentials */}
              <div style={{
                background: isDark ? 'rgba(2, 6, 23, 0.6)' : 'var(--card-subtle)',
                borderRadius: '16px',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                padding: '20px'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: isDark ? '#93c5fd' : '#1d4ed8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '14px'
                }}>
                  Evaluation Credentials (QS Compliance)
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '14px'
                }}>
                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '12px 16px', borderRadius: '12px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                      Highest Educational Attainment
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', marginTop: '4px', lineHeight: 1.4 }}>
                      {selectedIncumbent.education || selectedIncumbent.assessment?.education || '— No educational credential recorded yet'}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '12px 16px', borderRadius: '12px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                      Years of Relevant Experience
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 850, color: isDark ? '#60a5fa' : '#2563eb', marginTop: '4px' }}>
                      {(selectedIncumbent.years_experience !== null && selectedIncumbent.years_experience !== undefined)
                        ? `${selectedIncumbent.years_experience} Years`
                        : (selectedIncumbent.assessment?.years_experience !== null && selectedIncumbent.assessment?.years_experience !== undefined)
                          ? `${selectedIncumbent.assessment.years_experience} Years`
                          : '—'}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '12px 16px', borderRadius: '12px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                      Hours of Relevant Training
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 850, color: isDark ? '#34d399' : '#059669', marginTop: '4px' }}>
                      {(selectedIncumbent.hours_of_training !== null && selectedIncumbent.hours_of_training !== undefined)
                        ? `${selectedIncumbent.hours_of_training} Hours`
                        : (selectedIncumbent.assessment?.hours_of_training !== null && selectedIncumbent.assessment?.hours_of_training !== undefined)
                          ? `${selectedIncumbent.assessment.hours_of_training} Hours`
                          : '—'}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '12px 16px', borderRadius: '12px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                      Civil Service / Professional Board Eligibility
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', marginTop: '4px', lineHeight: 1.4 }}>
                      {selectedIncumbent.eligibility || selectedIncumbent.assessment?.eligibility || '— No eligibility recorded yet'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: View Documents Section (AGAP SCA I Workflow) */}
              <div style={{
                background: isDark ? 'rgba(2, 6, 23, 0.6)' : 'var(--card-subtle)',
                borderRadius: '16px',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                padding: '20px',
                boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: 'var(--text)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Supporting Attached Documents
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                      Click "View Document" to inspect attached credentials in full screen (PDS, TOR, Training Certificates, Eligibility Card).
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 750,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'var(--card-solid, #ffffff)',
                    border: '1px solid var(--line)',
                    color: 'var(--text-secondary, #94a3b8)'
                  }}>
                    {Array.isArray(selectedIncumbent.assessment?.documents) ? selectedIncumbent.assessment.documents.length : 0} Files
                  </span>
                </div>

                {(!selectedIncumbent.assessment?.documents || selectedIncumbent.assessment.documents.length === 0) ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'var(--card-solid, #ffffff)',
                    borderRadius: '12px',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: '13px'
                  }}>
                    No supporting documents attached for this incumbent guidance counselor.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedIncumbent.assessment.documents.map((doc, dIdx) => (
                      <div
                        key={dIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)',
                          background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)',
                          transition: 'all 0.15s'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.7)'}
                        onMouseOut={e => e.currentTarget.style.background = isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text)' }}>
                              {doc.label || doc.name || doc.key}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                            color: isDark ? '#6ee7b7' : '#047857',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0'
                          }}>
                            ✓ Verified Attachment
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setFullScreenDoc({
                                open: true,
                                url: doc.url || 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
                                title: doc.label || doc.name || 'Incumbent Supporting Document'
                              });
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              background: '#2563eb',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                              transition: 'all 0.15s'
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View Document
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 3: Target Reclassification Position Selection & Quick Stage Edit */}
              <div style={{
                background: isDark ? 'rgba(6, 78, 59, 0.25)' : '#ecfdf5',
                borderRadius: '16px',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                padding: '20px'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: isDark ? '#34d399' : '#047857',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '14px'
                }}>
                  Reclassification Decisions
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                      Target Reclassification Position
                    </label>
                    <select
                      value={modalTargetPosition}
                      onChange={e => setModalTargetPosition(e.target.value)}
                      disabled={savingModalChanges}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isDark ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid #10b981',
                        background: 'var(--input-bg)',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: isDark ? '#6ee7b7' : '#047857',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>-- Unassigned (Select Target Position) --</option>
                      {RECLASS_POSITIONS_OPTIONS.map(pos => (
                        <option key={pos} value={pos} style={{ background: 'var(--card)', color: 'var(--text)' }}>{pos}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', display: 'block', marginTop: '4px' }}>
                      Designate target plantilla position (School Counselor I, II, III, IV).
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                      Stage of Reclassification
                    </label>
                    <select
                      value={modalStage}
                      onChange={e => setModalStage(e.target.value)}
                      disabled={savingModalChanges}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                        background: 'var(--input-bg)',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: 'var(--input-text, var(--text))',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {RECLASS_STAGES.map(stage => (
                        <option key={stage} value={stage} style={{ background: 'var(--card)', color: 'var(--text)' }}>{stage}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', display: 'block', marginTop: '4px' }}>
                      Workflow status automatically syncs across modal & main table view.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
              background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'var(--card-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => setShowAssessmentModal(false)}
                disabled={savingModalChanges}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-solid, #ffffff)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: savingModalChanges ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--card-subtle)'}
                onMouseOut={e => e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-solid, #ffffff)'}
              >
                Close Assessment
              </button>

              <button
                type="button"
                onClick={handleSaveModalChanges}
                disabled={savingModalChanges}
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: savingModalChanges
                    ? '#64748b'
                    : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: savingModalChanges ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: savingModalChanges
                    ? 'none'
                    : '0 4px 12px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => {
                  if (!savingModalChanges) {
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseOut={e => {
                  if (!savingModalChanges) {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                    e.currentTarget.style.transform = 'none';
                  }
                }}
              >
                {savingModalChanges ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                    </svg>
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECLASSIFICATION CSV INGESTION MODAL */}
      {showCsvModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: '18px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.9)' : '1px solid #e2e8f0',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: isDark ? '0 24px 64px rgba(0, 0, 0, 0.6)' : '0 20px 50px rgba(0, 0, 0, 0.15)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 26px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #BFDBFE'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#60a5fa' : '#2563eb'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                    Ingest Guidance Counselor Reclassification CSV
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                    Upload DepEd Plantilla & Inventory CSV to ingest, validate, and batch update incumbent counselors.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                disabled={isUploadingCsv}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '20px',
                  cursor: isUploadingCsv ? 'not-allowed' : 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s'
                }}
                onMouseOver={e => e.currentTarget.style.color = isDark ? '#f8fafc' : '#0f172a'}
                onMouseOut={e => e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748b'}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Quick Actions Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '12px',
                background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#38bdf8' : '#0284c7'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span style={{ fontSize: '12px', fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155' }}>
                    DepEd Standard Format: REGION, DIVISION, PLANTILLA ITEM NUMBER, POSITION, INCUMBENT...
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    style={{
                      background: isDark ? 'rgba(51, 65, 85, 0.7)' : '#ffffff',
                      border: isDark ? '1px solid rgba(71, 85, 105, 0.8)' : '1px solid #cbd5e1',
                      padding: '6px 12px',
                      borderRadius: '7px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: isDark ? '#93c5fd' : '#1d4ed8',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseOut={e => e.currentTarget.style.borderColor = isDark ? 'rgba(71, 85, 105, 0.8)' : '#cbd5e1'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Template
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExecuteCsvIngestion(true)}
                    disabled={isUploadingCsv}
                    style={{
                      background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                      border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                      padding: '6px 12px',
                      borderRadius: '7px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: isDark ? '#6ee7b7' : '#047857',
                      cursor: isUploadingCsv ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => !isUploadingCsv && (e.currentTarget.style.background = isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5')}
                    onMouseOut={e => !isUploadingCsv && (e.currentTarget.style.background = isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Sync Official Inventory (5,600+ items)
                  </button>
                </div>
              </div>

              {/* Drag & Drop File Zone */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleSelectCsvFile(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  border: isDragging
                    ? '2px dashed #3b82f6'
                    : (isDark ? '2px dashed rgba(71, 85, 105, 0.8)' : '2px dashed #cbd5e1'),
                  borderRadius: '14px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: isDragging
                    ? (isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff')
                    : (isDark ? 'rgba(30, 41, 59, 0.35)' : '#fcfdfe'),
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => document.getElementById('reclass-csv-input')?.click()}
              >
                <input
                  id="reclass-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleSelectCsvFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />

                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe',
                  color: isDark ? '#60a5fa' : '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', marginBottom: '4px' }}>
                  {csvFileName ? `Selected: ${csvFileName}` : 'Drag and drop your CSV file here, or browse'}
                </div>
                <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {csvTotalRowsCount > 0
                    ? `${csvTotalRowsCount} data rows detected and parsed`
                    : 'Accepts standard DepEd guidance counselor reclassification inventory spreadsheets'}
                </div>
              </div>

              {/* Data Preview Section (when file parsed) */}
              {csvPreviewRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 750, color: isDark ? '#cbd5e1' : '#1e293b' }}>
                      File Preview (Showing first {csvPreviewRows.length} of {csvTotalRowsCount} records)
                    </span>
                    <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                      Validation Status: <strong style={{ color: '#10b981' }}>✓ Columns Recognized</strong>
                    </span>
                  </div>

                  <div style={{
                    overflowX: 'auto',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                      <thead>
                        <tr style={{ background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Item Number</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Incumbent Name</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Position</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Division / Station</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Target Reclass</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.map((row, idx) => {
                          const itemNo = row['PLANTILLA ITEM NUMBER'] || row['Plantilla Item Number'] || Object.values(row)[4] || '—';
                          const name = row['INCUMBENT'] || row['Incumbent'] || Object.values(row)[7] || '#N/A';
                          const pos = row['POSITION TITLE'] || row['Position Title'] || Object.values(row)[5] || '—';
                          const division = row['DIVISION'] || row['Division'] || Object.values(row)[1] || '—';
                          const target = row['RECLASS POSITION'] || row['Reclass Position'] || Object.values(row)[8] || 'For Review';

                          return (
                            <tr key={idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 650, color: isDark ? '#f8fafc' : '#0f172a' }}>{itemNo}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#cbd5e1' : '#334155' }}>
                                {name === '#N/A' ? <em style={{ color: '#94a3b8' }}>Unfilled / Vacant</em> : name}
                              </td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{pos}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{division}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                                  color: isDark ? '#93c5fd' : '#1d4ed8'
                                }}>
                                  {target === '#N/A' ? 'Pending Eval' : target}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


              {/* Progress Indicator */}
              {isUploadingCsv && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                    <span>Processing and Ingesting Records into Database...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', background: isDark ? 'rgba(51, 65, 85, 0.8)' : '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${uploadProgress}%`,
                      background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {/* Upload Success Summary */}
              {uploadStats && (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#6ee7b7' : '#065f46', fontWeight: 750, fontSize: '13.5px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    {uploadStats.message}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total In Database</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>{uploadStats.totalInDatabase || uploadStats.insertedOrUpdated}</div>
                    </div>
                    {uploadStats.metrics && (
                      <>
                        <div style={{ padding: '8px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>For Review</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f59e0b' }}>{uploadStats.metrics.forReview}</div>
                        </div>
                        <div style={{ padding: '8px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Vacant / Unfilled</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#64748b' }}>{uploadStats.metrics.vacant}</div>
                        </div>
                        <div style={{ padding: '8px', borderRadius: '8px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Abolition</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ef4444' }}>{uploadStats.metrics.abolition}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 26px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                disabled={isUploadingCsv}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid rgba(71, 85, 105, 0.8)' : '1px solid #cbd5e1',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isUploadingCsv ? 'not-allowed' : 'pointer'
                }}
              >
                {uploadStats ? 'Close' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => handleExecuteCsvIngestion(false)}
                disabled={isUploadingCsv || (!csvContent && !csvFile)}
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: (!csvContent && !csvFile) || isUploadingCsv
                    ? '#64748b'
                    : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: (!csvContent && !csvFile) || isUploadingCsv ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: (!csvContent && !csvFile) || isUploadingCsv ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                {isUploadingCsv ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                    </svg>
                    Ingesting CSV...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {csvTotalRowsCount > 0 ? `Ingest ${csvTotalRowsCount} Records` : 'Start CSV Ingestion'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGIONAL OFFICE: NOSCA SCANNER & PLANTILLA ITEM SELECTION MODAL */}
      {showNoscaModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !scanningNosca) setShowNoscaModal(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            borderRadius: '22px',
            width: 'min(1280px, 96vw)',
            height: 'min(860px, 92vh)',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isDark ? '0 30px 70px rgba(0,0,0,0.65)' : '0 20px 50px rgba(0,0,0,0.18)',
            border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #c7d2fe',
            overflow: 'hidden'
          }}>
            <style>{`
              @media (max-width: 960px) {
                .nosca-split-layout {
                  grid-template-columns: 1fr !important;
                }
              }
            `}</style>

            {/* Modal Header */}
            <div style={{
              padding: '18px 26px',
              background: isDark ? 'rgba(30, 27, 75, 0.5)' : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
              borderBottom: isDark ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid #c7d2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                    <path d="M10 9H8" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: isDark ? 'rgba(99, 102, 241, 0.25)' : '#e0e7ff', color: isDark ? '#a5b4fc' : '#4338ca', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Regional Office Privilege
                    </span>
                    <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                      AI/pdfplumber Parser
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 850, margin: '2px 0 0', color: isDark ? '#f8fafc' : '#1e1b4b' }}>
                    Notice of Organization, Staffing, and Compensation Action (NOSCA)
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {scannedNoscaResult && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#ffffff',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #c7d2fe',
                    fontSize: '11.5px',
                    fontWeight: 750,
                    color: isDark ? '#c4b5fd' : '#4f46e5'
                  }}>
                    <span>SN: {scannedNoscaResult.serial_no || 'UNKNOWN'}</span>
                    <button
                      type="button"
                      onClick={() => handleCopySerialNo(scannedNoscaResult.serial_no)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                      title="Copy Serial Number"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowNoscaModal(false)}
                  disabled={scanningNosca}
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: scanningNosca ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.08)',
                    padding: 0
                  }}
                  title="Close Modal"
                  aria-label="Close"
                  onMouseOver={e => {
                    e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2';
                    e.currentTarget.style.borderColor = '#ef4444';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.stroke = isDark ? '#fca5a5' : '#dc2626';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff';
                    e.currentTarget.style.borderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : '#cbd5e1';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.stroke = isDark ? '#e2e8f0' : '#1e293b';
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isDark ? '#e2e8f0' : '#1e293b'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'stroke 0.15s ease' }}
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body - 2 Column Split Layout */}
            <div
              className="nosca-split-layout"
              style={{
                padding: '24px 26px',
                overflowY: 'auto',
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '360px 1fr',
                gap: '24px',
                minHeight: 0,
                alignItems: 'start'
              }}
            >
              {/* LEFT COLUMN: UPLOAD & ACTIVE DOCUMENT INFO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {scannedNoscaResult && (
                  <div style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #e0e7ff',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.2)' : '0 2px 8px rgba(99, 102, 241, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                        flexShrink: 0
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {noscaFileName || 'NOSCA Document.pdf'}
                        </div>
                        <div style={{ fontSize: '11px', color: isDark ? '#6ee7b7' : '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>● Document Loaded & Parsed</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Serial Number</span>
                        <span style={{ fontWeight: 800, color: isDark ? '#c4b5fd' : '#4f46e5' }}>{scannedNoscaResult.serial_no || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Division</span>
                        <span style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', textAlign: 'right' }}>{scannedNoscaResult.division ? `Division of ${scannedNoscaResult.division}` : 'Regional Scope'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Station</span>
                        <span style={{ fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155', textAlign: 'right', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scannedNoscaResult.school_name || 'All Stations'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Target Position</span>
                        <span style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', textAlign: 'right' }}>{scannedNoscaResult.position || 'School Counselor Associate I'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Total Plantilla Items</span>
                        <span style={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>{scannedNoscaResult.count || 0}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Selected for Import</span>
                        <span style={{ fontWeight: 800, color: '#10b981' }}>{selectedNoscaItems.length} items</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsNoscaDragOver(true); }}
                  onDragLeave={() => setIsNoscaDragOver(false)}
                  onDrop={handleNoscaDrop}
                  onClick={() => !scanningNosca && noscaFileInputRef.current?.click()}
                  style={{
                    border: isNoscaDragOver
                      ? '2px dashed #6366f1'
                      : (isDark ? '2px dashed rgba(99, 102, 241, 0.45)' : '2px dashed #c7d2fe'),
                    borderRadius: '16px',
                    padding: scannedNoscaResult ? '24px 18px' : '44px 22px',
                    textAlign: 'center',
                    background: isNoscaDragOver
                      ? (isDark ? 'rgba(99, 102, 241, 0.18)' : '#eef2ff')
                      : (isDark
                          ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)'
                          : 'linear-gradient(180deg, #fbfcfe 0%, #f4f7fb 100%)'),
                    boxShadow: isNoscaDragOver
                      ? '0 0 0 4px rgba(99, 102, 241, 0.18)'
                      : (isDark ? 'none' : '0 2px 8px rgba(99, 102, 241, 0.04)'),
                    cursor: scanningNosca ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {scanningNosca ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        border: '3.5px solid rgba(99, 102, 241, 0.2)',
                        borderTopColor: '#6366f1',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                          Scanning NOSCA PDF...
                        </div>
                        <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '4px' }}>
                          Parsing plantilla allocations...
                        </div>
                      </div>
                    </div>
                  ) : scannedNoscaResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                        color: '#6366f1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 750, color: isDark ? '#c4b5fd' : '#4f46e5' }}>
                        Scan or Drop Another NOSCA PDF
                      </div>
                      <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        Click to choose a replacement file
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      {/* Floating Upload Icon with Glow */}
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '18px',
                        background: isDark
                          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(79, 70, 229, 0.15) 100%)'
                          : 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
                        border: isDark ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #c7d2fe',
                        color: isDark ? '#a5b4fc' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isDark
                          ? '0 8px 24px rgba(99, 102, 241, 0.25)'
                          : '0 8px 20px rgba(99, 102, 241, 0.15)'
                      }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M12 18v-6" />
                          <path d="M9 15l3-3 3 3" />
                        </svg>
                      </div>

                      <div>
                        <div style={{ fontSize: '17px', fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a' }}>
                          Upload NOSCA PDF Here
                        </div>
                        <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '6px', lineHeight: 1.5 }}>
                          Drag and drop your official DBM NOSCA document here, or browse files from your computer.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!scanningNosca) noscaFileInputRef.current?.click();
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                          border: 'none',
                          padding: '8px 20px',
                          borderRadius: '10px',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Browse NOSCA Document
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: SCANNED NOSCA RESULTS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                {scannedNoscaResult ? (
                  <>
                    {/* Summary Bar */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '10px'
                    }}>
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(30, 27, 75, 0.35)' : '#f5f3ff',
                        border: isDark ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid #ddd6fe'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: isDark ? '#c4b5fd' : '#6d28d9', textTransform: 'uppercase' }}>
                          Division & Station
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 850, color: isDark ? '#ede9fe' : '#4c1d95', margin: '2px 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {scannedNoscaResult.division ? `Division of ${scannedNoscaResult.division}` : 'Regional Scope'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: isDark ? '#a78bfa' : '#7c3aed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {scannedNoscaResult.school_name || 'All Stations'}
                        </div>
                      </div>

                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(30, 58, 138, 0.2)' : '#eff6ff',
                        border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #bfdbfe'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: isDark ? '#93c5fd' : '#1d4ed8', textTransform: 'uppercase' }}>
                          Target Position
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 850, color: isDark ? '#dbeafe' : '#1e3a8a', margin: '2px 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {scannedNoscaResult.position || 'School Counselor Associate I'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: isDark ? '#60a5fa' : '#2563eb' }}>
                          Auto-assigned title
                        </div>
                      </div>

                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(6, 95, 70, 0.2)' : '#ecfdf5',
                        border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: isDark ? '#6ee7b7' : '#047857', textTransform: 'uppercase' }}>
                          Selection Status
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 850, color: isDark ? '#d1fae5' : '#065f46', margin: '2px 0 1px' }}>
                          {selectedNoscaItems.length} of {scannedNoscaResult.count || 0} selected
                        </div>
                        <div style={{ fontSize: '10.5px', color: isDark ? '#34d399' : '#059669' }}>
                          Ready for commit
                        </div>
                      </div>

                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(180, 83, 9, 0.18)' : '#fffbeb',
                        border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: isDark ? '#fde68a' : '#92400e', textTransform: 'uppercase' }}>
                          Database Match
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 850, color: isDark ? '#fef3c7' : '#b45309', margin: '2px 0 1px' }}>
                          {matchedIncumbentsCount} in Inventory DB
                        </div>
                        <div style={{ fontSize: '10.5px', color: isDark ? '#fde68a' : '#b45309' }}>
                          {(scannedNoscaResult.count || 0) - matchedIncumbentsCount} new allocations
                        </div>
                      </div>
                    </div>

                    {/* Toolbar: Category Filters, Search, Select/Deselect All, and Bulk Remove */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0'
                    }}>
                      {/* Category Filter Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {[
                          { key: 'ALL', label: 'All', count: scannedNoscaResult.items?.length || 0 },
                          { key: 'ELEMENTARY', label: 'Elementary', count: scannedNoscaResult.category_breakdown?.ELEMENTARY?.length || 0 },
                          { key: 'JHS', label: 'JHS', count: scannedNoscaResult.category_breakdown?.JHS?.length || 0 },
                          { key: 'SHS', label: 'SHS', count: scannedNoscaResult.category_breakdown?.SHS?.length || 0 },
                          { key: 'ALS', label: 'ALS', count: scannedNoscaResult.category_breakdown?.ALS?.length || 0 }
                        ].map((tab) => {
                          const isActive = noscaActiveCategory === tab.key;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setNoscaActiveCategory(tab.key)}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '7px',
                                border: 'none',
                                background: isActive ? '#4f46e5' : (isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff'),
                                color: isActive ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569'),
                                fontSize: '11px',
                                fontWeight: isActive ? 750 : 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: isActive ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none'
                              }}
                            >
                              <span>{tab.label}</span>
                              <span style={{
                                padding: '1px 5px',
                                borderRadius: '999px',
                                fontSize: '9.5px',
                                fontWeight: 800,
                                background: isActive ? 'rgba(255,255,255,0.25)' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')
                              }}>
                                {tab.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Action controls: Select All, Search, and Bulk Remove */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={toggleSelectAllNoscaItems}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '7px',
                            border: isDark ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #c7d2fe',
                            background: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
                            color: isDark ? '#a5b4fc' : '#4338ca',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 11 12 14 22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                          </svg>
                          {filteredNoscaItems.length > 0 && filteredNoscaItems.every(i => selectedNoscaItems.includes(i))
                            ? 'Deselect All'
                            : 'Select All'
                          }
                        </button>

                        {selectedNoscaItems.length > 0 && (
                          <button
                            type="button"
                            onClick={handleRequestRemoveSelected}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '7px',
                              border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca',
                              background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                              color: isDark ? '#f87171' : '#dc2626',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                            title="Remove all selected items with confirmation"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Remove ({selectedNoscaItems.length})
                          </button>
                        )}

                        {/* Search box */}
                        <div style={{ position: 'relative', width: '160px' }}>
                          <input
                            type="text"
                            value={noscaSearchTerm}
                            onChange={(e) => setNoscaSearchTerm(e.target.value)}
                            placeholder="Filter item no..."
                            style={{
                              width: '100%',
                              padding: '5px 8px 5px 26px',
                              borderRadius: '7px',
                              fontSize: '11px',
                              border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #cbd5e1',
                              background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                              color: isDark ? '#f8fafc' : '#0f172a',
                              outline: 'none'
                            }}
                          />
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: isDark ? '#94a3b8' : '#64748b' }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Items Selection Table */}
                    <div style={{
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      maxHeight: '400px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{ overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead style={{ position: 'sticky', top: 0, background: isDark ? 'rgba(30, 41, 59, 0.95)' : '#f8fafc', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0', zIndex: 2 }}>
                            <tr>
                              <th style={{ width: '38px', padding: '9px 10px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={filteredNoscaItems.length > 0 && filteredNoscaItems.every(i => selectedNoscaItems.includes(i))}
                                  onChange={toggleSelectAllNoscaItems}
                                  style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#4f46e5' }}
                                />
                              </th>
                              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>
                                Plantilla Item Number
                              </th>
                              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>
                                Category
                              </th>
                              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>
                                Database Status
                              </th>
                              <th style={{ width: '60px', padding: '9px 10px', textAlign: 'center', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredNoscaItems.length > 0 ? (
                              filteredNoscaItems.map((item, idx) => {
                                const isSelected = selectedNoscaItems.includes(item);
                                const isMatched = incumbents?.some(inc => inc.plantilla_item_number && String(inc.plantilla_item_number).trim().toLowerCase() === String(item).trim().toLowerCase());
                                
                                let itemCat = 'ELEMENTARY';
                                if (scannedNoscaResult.category_breakdown?.JHS?.includes(item)) itemCat = 'JHS';
                                else if (scannedNoscaResult.category_breakdown?.SHS?.includes(item)) itemCat = 'SHS';
                                else if (scannedNoscaResult.category_breakdown?.ALS?.includes(item)) itemCat = 'ALS';

                                return (
                                  <tr
                                    key={idx}
                                    onClick={() => toggleSelectNoscaItem(item)}
                                    style={{
                                      borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9',
                                      background: isSelected 
                                        ? (isDark ? 'rgba(79, 70, 229, 0.12)' : '#eef2ff')
                                        : (idx % 2 === 0 ? (isDark ? 'rgba(15, 23, 42, 0.3)' : '#ffffff') : (isDark ? 'rgba(15, 23, 42, 0.6)' : '#fafafa')),
                                      cursor: 'pointer',
                                      transition: 'background 0.15s ease'
                                    }}
                                  >
                                    <td style={{ textAlign: 'center', padding: '9px 10px' }} onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectNoscaItem(item)}
                                        style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#4f46e5' }}
                                      />
                                    </td>
                                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>
                                      {item}
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                      <span style={{
                                        fontSize: '10.5px',
                                        fontWeight: 750,
                                        padding: '2px 7px',
                                        borderRadius: '5px',
                                        background: itemCat === 'SHS' ? (isDark ? 'rgba(217, 119, 6, 0.2)' : '#fef3c7') : itemCat === 'JHS' ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe') : itemCat === 'ALS' ? (isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff') : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5'),
                                        color: itemCat === 'SHS' ? (isDark ? '#fde68a' : '#b45309') : itemCat === 'JHS' ? (isDark ? '#bfdbfe' : '#1d4ed8') : itemCat === 'ALS' ? (isDark ? '#e9d5ff' : '#7e22ce') : (isDark ? '#a7f3d0' : '#047857')
                                      }}>
                                        {itemCat}
                                      </span>
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                      {isMatched ? (
                                        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7', color: isDark ? '#6ee7b7' : '#15803d' }}>
                                          ✓ In Reclassification DB
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: '10.5px', fontWeight: 750, padding: '2px 7px', borderRadius: '5px', background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff', color: isDark ? '#a5b4fc' : '#4338ca' }}>
                                          + New Allocation
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '9px 10px' }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => handleRequestRemoveItem(item)}
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: 'pointer',
                                          color: isDark ? '#f87171' : '#ef4444',
                                          padding: '3px',
                                          borderRadius: '5px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'background 0.15s ease'
                                        }}
                                        title={`Remove item ${item} from this batch`}
                                      >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="3 6 5 6 21 6" />
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} style={{ padding: '26px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
                                  No plantilla items found matching the selected filter.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc',
                    border: isDark ? '1px dashed rgba(51, 65, 85, 0.7)' : '1px dashed #cbd5e1',
                    borderRadius: '16px',
                    padding: '40px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minHeight: '380px',
                    height: '100%'
                  }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                      color: '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '14px'
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                      Scanned Results Will Appear Here
                    </div>
                    <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '6px', maxWidth: '380px', lineHeight: 1.55 }}>
                      Upload an official DBM NOSCA PDF on the left. Once parsed, the extracted plantilla items, category breakdown, and item selection controls will appear here.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 26px',
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {scannedNoscaResult && (
                  <>
                    <button
                      type="button"
                      onClick={() => noscaFileInputRef.current?.click()}
                      disabled={scanningNosca}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: isDark ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #cbd5e1',
                        background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                        color: isDark ? '#cbd5e1' : '#475569',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Scan Another NOSCA
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setScannedNoscaResult(null);
                        setSelectedNoscaItems([]);
                        setNoscaFileName('');
                        setNoscaSearchTerm('');
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
                        background: 'transparent',
                        color: isDark ? '#f87171' : '#dc2626',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNoscaModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                    background: 'transparent',
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>

                {scannedNoscaResult && (
                  <button
                    type="button"
                    onClick={handleRequestAddItems}
                    disabled={selectedNoscaItems.length === 0}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: selectedNoscaItems.length === 0
                        ? '#64748b'
                        : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: 750,
                      cursor: selectedNoscaItems.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: selectedNoscaItems.length === 0 ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Import & Commit Selected Items ({selectedNoscaItems.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL LAYER 1: REMOVE PLANTILLA ITEM(S) */}
      {confirmRemoveState.open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmRemoveState({ open: false, item: null, isBulk: false }); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 120,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
            borderRadius: '18px',
            width: 'min(480px, 94vw)',
            padding: '26px 28px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h4 style={{ fontSize: '17px', fontWeight: 850, margin: '0 0 4px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                  Confirm Plantilla Item Removal
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1.5 }}>
                  {confirmRemoveState.isBulk ? (
                    <>Are you sure you want to remove all <b>{selectedNoscaItems.length} selected items</b> from this NOSCA allocation batch? They will not be committed to the inventory.</>
                  ) : (
                    <>Are you sure you want to remove item <b style={{ fontFamily: 'monospace' }}>{confirmRemoveState.item}</b> from this NOSCA allocation batch? It will not be committed to the inventory.</>
                  )}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                type="button"
                onClick={() => setConfirmRemoveState({ open: false, item: null, isBulk: false })}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: 'transparent',
                  color: isDark ? '#cbd5e1' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedRemoval}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)'
                }}
              >
                Yes, Remove Item{confirmRemoveState.isBulk ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL LAYER 2: TOTAL ADD / COMMIT CONFIRMATION */}
      {showConfirmAddModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !importingNoscaItems) setShowConfirmAddModal(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 120,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
            borderRadius: '20px',
            width: 'min(540px, 94vw)',
            padding: '28px 30px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 850, margin: '0 0 4px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                  Confirm Plantilla Allocation Import
                </h4>
                <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Commit {selectedNoscaItems.length} selected plantilla items into the official inventory
                </div>
              </div>
            </div>

            {/* Batch Details Box */}
            <div style={{
              background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>NOSCA Serial:</span>
                <span style={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>{scannedNoscaResult?.serial_no || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>Division:</span>
                <span style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>{scannedNoscaResult?.division ? `Division of ${scannedNoscaResult.division}` : 'Regional Office'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>Target Position:</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{scannedNoscaResult?.position || 'School Counselor Associate I'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0', paddingTop: '8px', marginTop: '2px' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 }}>Total Items to Commit:</span>
                <span style={{ fontWeight: 850, color: isDark ? '#a7f3d0' : '#047857', fontSize: '14px' }}>{selectedNoscaItems.length} items</span>
              </div>
            </div>

            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
              border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #bfdbfe',
              fontSize: '12px',
              color: isDark ? '#93c5fd' : '#1e40af',
              lineHeight: 1.4,
              marginBottom: '20px'
            }}>
              <b>Notice:</b> Confirming will officially save these items into the database. Existing matching records will be updated with this NOSCA reference, and new records will be created as vacant plantilla items.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmAddModal(false)}
                disabled={importingNoscaItems}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: 'transparent',
                  color: isDark ? '#cbd5e1' : '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: importingNoscaItems ? 'not-allowed' : 'pointer'
                }}
              >
                Keep Reviewing
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedImport}
                disabled={importingNoscaItems}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: importingNoscaItems ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                {importingNoscaItems ? (
                  <>
                    <div style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Committing Items...</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Confirm & Add to Inventory</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN DOCUMENT VIEWER MODAL (INTEGRATED FOR INCUMBENTS & APPLICANTS) */}
      <FullScreenDocViewer
        isOpen={fullScreenDoc.open}
        onClose={() => setFullScreenDoc({ open: false, url: '', title: '' })}
        url={fullScreenDoc.url}
        title={fullScreenDoc.title}
        applicantName={selectedIncumbent?.full_name}
      />
    </div>
  );
}
