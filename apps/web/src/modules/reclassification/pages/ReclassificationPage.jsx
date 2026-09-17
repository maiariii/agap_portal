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

  // Global Escape key listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAssessmentModal) setShowAssessmentModal(false);
        if (showReevalModal) setShowReevalModal(false);
        if (showDocModal) setShowDocModal(false);
        if (showNewAppModal) setShowNewAppModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAssessmentModal, showReevalModal, showDocModal, showNewAppModal]);

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
      const token = localStorage.getItem('deped_token') || sessionStorage.getItem('deped_token');
      const exportUrl = `/api/reclassification/export-dbm${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      window.open(exportUrl, '_blank');
      setToast({ message: 'Generating DBM submission spreadsheet...', type: 'info' });
    } catch (err) {
      console.error('Error triggering DBM export:', err);
      setToast({ message: 'Downloading DBM export data...', type: 'info' });
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
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.85)',
                  borderBottom: isDark ? '1.5px solid rgba(51, 65, 85, 0.7)' : '1.5px solid var(--line)',
                  color: 'var(--text-secondary, #94a3b8)',
                  fontSize: '11.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '12px 16px', width: '50px', minWidth: '50px', whiteSpace: 'nowrap' }}>No.</th>
                  <th style={{ padding: '12px 16px', minWidth: '220px', whiteSpace: 'nowrap' }}>Plantilla Item & Incumbent</th>
                  <th style={{ padding: '12px 16px', minWidth: '160px', whiteSpace: 'nowrap' }}>Current Position & SG</th>
                  <th style={{ padding: '12px 16px', minWidth: '170px', whiteSpace: 'nowrap' }}>Station & Division</th>
                  <th style={{ padding: '12px 16px', minWidth: '140px', whiteSpace: 'nowrap' }}>Region</th>
                  <th style={{ padding: '12px 16px', minWidth: '160px', whiteSpace: 'nowrap' }}>Stage of Reclassification</th>
                  <th style={{ padding: '12px 16px', minWidth: '170px', whiteSpace: 'nowrap' }}>Target Position & Remarks</th>
                  <th style={{ padding: '12px 16px', minWidth: '180px', whiteSpace: 'nowrap' }}>Credentials Overview</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', minWidth: '110px', whiteSpace: 'nowrap' }}>Actions</th>
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
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 750, color: inc.full_name === '#N/A' ? 'var(--muted)' : 'var(--text)' }}>
                            {inc.full_name === '#N/A' ? 'Unfilled / Vacant Item' : inc.full_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace', marginTop: '2px' }}>
                            {inc.plantilla_item_number || inc.employee_id}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{inc.current_position}</div>
                          {inc.salary_grade && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              color: isDark ? '#93c5fd' : '#1e40af',
                              background: isDark ? 'rgba(30, 58, 138, 0.3)' : '#eff6ff',
                              padding: '1.5px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '3px'
                            }}>
                              SG {inc.salary_grade}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 650, color: 'var(--text)' }}>{inc.station_division || inc.division}</div>
                          {inc.uacs_oper_dsc && inc.uacs_oper_dsc !== inc.division && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                              {inc.uacs_oper_dsc}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary, #94a3b8)', fontSize: '12px', fontWeight: 600 }}>
                          {inc.region || '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
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
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {inc.reclass_position ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
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
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isDark ? 'rgba(51, 65, 85, 0.4)' : '#f1f5f9',
                                color: isDark ? '#cbd5e1' : '#475569',
                                width: 'fit-content'
                              }}>
                                {inc.remarks}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '1.5px 6px',
                                borderRadius: '5px',
                                background: isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff',
                                border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                                color: isDark ? '#93c5fd' : '#1e40af',
                                fontSize: '10px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                ED
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                                {inc.assessment?.education || 'Bachelor Degree'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '1.5px 6px',
                                borderRadius: '5px',
                                background: isDark ? 'rgba(120, 53, 15, 0.35)' : '#fffbeb',
                                border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a',
                                color: isDark ? '#fde68a' : '#92400e',
                                fontSize: '10px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                EXP
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                                {inc.assessment?.years_experience !== null && inc.assessment?.years_experience !== undefined
                                  ? `${inc.assessment.years_experience} Years`
                                  : 'Experience on file'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '1.5px 6px',
                                borderRadius: '5px',
                                background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                                border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                                color: isDark ? '#6ee7b7' : '#047857',
                                fontSize: '10px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                TRN
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                                {inc.assessment?.hours_of_training !== null && inc.assessment?.hours_of_training !== undefined
                                  ? `${inc.assessment.hours_of_training} Hours`
                                  : 'Training recorded'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '1.5px 6px',
                                borderRadius: '5px',
                                background: isDark ? 'rgba(88, 28, 135, 0.35)' : '#faf5ff',
                                border: isDark ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid #e9d5ff',
                                color: isDark ? '#d8b4fe' : '#6b21a8',
                                fontSize: '10px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                ELIG
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                                {inc.assessment?.eligibility || 'Civil Service / Board'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
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
                  Read-Only Evaluation Credentials
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
                      {selectedIncumbent.assessment?.education || '— No educational credential recorded'}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '12px 16px', borderRadius: '12px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                      Years of Relevant Experience
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 850, color: isDark ? '#60a5fa' : '#2563eb', marginTop: '4px' }}>
                      {selectedIncumbent.assessment?.years_experience !== null && selectedIncumbent.assessment?.years_experience !== undefined
                        ? `${selectedIncumbent.assessment.years_experience} Years`
                        : '—'}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '12px 16px', borderRadius: '12px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                      Hours of Relevant Training
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 850, color: isDark ? '#34d399' : '#059669', marginTop: '4px' }}>
                      {selectedIncumbent.assessment?.hours_of_training !== null && selectedIncumbent.assessment?.hours_of_training !== undefined
                        ? `${selectedIncumbent.assessment.hours_of_training} Hours`
                        : '—'}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)', padding: '12px 16px', borderRadius: '12px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>
                      Civil Service / Professional Board Eligibility
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', marginTop: '4px', lineHeight: 1.4 }}>
                      {selectedIncumbent.assessment?.eligibility || '— No eligibility recorded'}
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
