import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../../config/api.js';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import agadLogo from '../../../agadlogo.png';
import FullScreenDocViewer from '../../../components/FullScreenDocViewer.jsx';
import HqBackground from '../../../components/HqBackground.jsx';
import ThemeToggle from '../../../components/ThemeToggle.jsx';
import { useTheme } from '../../../middleware/ThemeProvider.jsx';
import IncumbentDocumentVaultModal from '../components/IncumbentDocumentVaultModal.jsx';
import NoscaItemTrackingTab, {
  getPositionLevel,
  getItemPositionLevel,
  getCandidatePositionLevel,
  romanLevel
} from '../components/NoscaItemTrackingTab.jsx';

const ALL_RECLASS_STAGES = [
  'For Review',
  'Endorsed to RO',
  'Endorsed to DBM RO'
];
const HRMO_RECLASS_STAGES = ['For Review', 'Endorsed to RO'];
const RO_RECLASS_STAGES = ['Endorsed to DBM RO'];
const RECLASS_POSITIONS_OPTIONS = ['School Counselor I', 'School Counselor II', 'School Counselor III', 'School Counselor IV'];
const NOSCA_POSITION_OPTIONS = [
  'School Counselor I',
  'School Counselor II',
  'School Counselor III',
  'School Counselor IV'
];

const DEFAULT_REQUIRED_DOCUMENTS = [
  // Required requirements (5 items - unlock QS Evaluation)
  { id: 'loi', key: 'letter_of_intent', shortTitle: 'Letter of Intent', label: 'Letter of intent addressed to the Head of Office or highest human resource officer', required: true },
  { id: 'pds', key: 'pds', shortTitle: 'Personal Data Sheet (PDS)', label: 'Duly accomplished Personal Data Sheet (PDS, CS Form No. 212, Revised 2017) and Work Experience Sheet, if applicable', required: true },
  { id: 'eligibility', key: 'eligibility', shortTitle: 'Certificate of Eligibility', label: 'Photocopy of Certificate of Eligibility/Report of Rating, if applicable', required: true },
  { id: 'tor', key: 'tor', shortTitle: 'Transcript of Records (TOR)', label: 'Photocopy of scholastic/academic records such as Transcript of Records (TOR) and Diploma, including graduate and post-graduate units/degrees, if available', required: true },
  { id: 'cav', key: 'sworn_declaration', shortTitle: 'CAV & Omnibus Sworn Statement', label: 'Checklist of Requirements and Omnibus Sworn Statement on the CAV of documents submitted and Data Privacy Consent Form', required: true },

  // Other requirements (6 items - total 11 items)
  { id: 'prc', key: 'prc', shortTitle: 'Updated PRC License/ID', label: 'Photocopy of valid and updated PRC License/ID, if applicable', required: false },
  { id: 'training', key: 'training_certificates', shortTitle: 'Training Certificates', label: 'Photocopy of Certificate/s of Training, if applicable', required: false },
  { id: 'employment', key: 'work_experience', shortTitle: 'Work Experience / Service Record', label: 'Photocopy of Certificate of Employment, Contract of Service, or duly signed Service Record, whichever is/are applicable', required: false },
  { id: 'appointment', key: 'service_record', shortTitle: 'Latest Appointment', label: 'Photocopy of latest appointment, if applicable', required: false },
  { id: 'performance', key: 'performance_rating', shortTitle: 'Performance Rating (IPCRF)', label: 'Photocopy of the Performance Rating in the last rating period(s) covering one (1) year performance prior to the deadline of submission, if applicable', required: false },
  { id: 'other', key: 'diploma', shortTitle: 'Other MOVs / Credentials', label: 'Other documents as may be required for comparative assessment (e.g. MOVs, or Performance Rating from relevant work experience)', required: false }
];

const POSITION_QS_STANDARDS = {
  'School Counselor Associate I': {
    title: 'School Counselor Associate I',
    salaryGrade: 11,
    education: "Bachelor's degree in Guidance and Counseling or related Social Sciences (Psychology, Sociology)",
    experience: "None required (or 1 year of relevant guidance experience)",
    training: "None required (or 4 hours of relevant training)",
    eligibility: "Career Service (Professional) / RA 1080 / None required as per CSC MC"
  },
  'School Counselor I': {
    title: 'School Counselor I',
    salaryGrade: 16,
    education: "Master's degree in Guidance and Counseling; or Master's degree in Psychology",
    experience: "None required",
    training: "None required",
    eligibility: "RA 1080, as amended (Guidance Counselor or Psychologist)*"
  },
  'School Counselor II': {
    title: 'School Counselor II',
    salaryGrade: 18,
    education: "Master's degree in Guidance and Counseling; or Master's degree in Psychology",
    experience: "1 year of relevant experience involving the delivery of guidance and counseling services and career development programs, and/or implementation of mental health and well-being programs in schools or other related settings",
    training: "8 hours of relevant training on the delivery of counseling and guidance services, and career development programs, or implementation of mental health and well-being programs in schools or other settings",
    eligibility: "RA 1080, as amended (Guidance Counselor or Psychologist)*"
  },
  'School Counselor III': {
    title: 'School Counselor III',
    salaryGrade: 20,
    education: "Master's degree in Guidance and Counseling; or Master's degree in Psychology",
    experience: "2 years of relevant experience involving the delivery of guidance and counseling services and career development programs, and/or implementation of mental health and well-being programs in schools or other related settings",
    training: "16 hours of relevant training on the delivery of counseling and guidance services, and career development programs, or implementation of mental health and well-being programs in schools or other related settings",
    eligibility: "RA 1080, as amended (Guidance Counselor or Psychologist)*"
  },
  'School Counselor IV': {
    title: 'School Counselor IV',
    salaryGrade: 22,
    education: "Master's degree in Guidance and Counseling; or Master's degree in Psychology",
    experience: "3 years of relevant experience involving the delivery of guidance and counseling services and career development programs, and/or implementation of mental health and well-being programs in schools or other related settings",
    training: "24 hours of relevant training on the delivery of counseling and guidance services, and career development programs, or implementation of mental health and well-being programs in schools or other related settings",
    eligibility: "RA 1080, as amended (Guidance Counselor or Psychologist)*"
  },
  'Guidance Coordinator III': {
    title: 'Guidance Coordinator III',
    salaryGrade: 16,
    education: "Master's degree in Guidance and Counseling",
    experience: "3 years of relevant experience in coordinating guidance services",
    training: "16 hours of relevant training",
    eligibility: "RA 1080 (Registered Guidance Counselor) / PBET / LET"
  }
};

// Add uppercase aliases for robust matching
POSITION_QS_STANDARDS['SCHOOL COUNSELOR ASSOCIATE I'] = POSITION_QS_STANDARDS['School Counselor Associate I'];
POSITION_QS_STANDARDS['SCHOOL COUNSELOR I'] = POSITION_QS_STANDARDS['School Counselor I'];
POSITION_QS_STANDARDS['SCHOOL COUNSELOR II'] = POSITION_QS_STANDARDS['School Counselor II'];
POSITION_QS_STANDARDS['SCHOOL COUNSELOR III'] = POSITION_QS_STANDARDS['School Counselor III'];
POSITION_QS_STANDARDS['SCHOOL COUNSELOR IV'] = POSITION_QS_STANDARDS['School Counselor IV'];
POSITION_QS_STANDARDS['GUIDANCE COORDINATOR III'] = POSITION_QS_STANDARDS['Guidance Coordinator III'];

const getPositionQsStandards = (posName) => {
  if (!posName) return POSITION_QS_STANDARDS['School Counselor I'];
  if (POSITION_QS_STANDARDS[posName]) return POSITION_QS_STANDARDS[posName];

  const clean = String(posName).trim().toUpperCase();

  // Direct case-insensitive lookup
  for (const [key, val] of Object.entries(POSITION_QS_STANDARDS)) {
    if (key.toUpperCase() === clean) return val;
  }

  // Handle Roman numerals & abbreviations
  if (clean.includes('COUNSELOR IV') || clean.includes('COUNSELOR 4') || clean === 'SC IV' || clean === 'SC 4' || clean.includes('SCHOOL COUNSELOR IV')) {
    return POSITION_QS_STANDARDS['School Counselor IV'];
  }
  if (clean.includes('COUNSELOR III') || clean.includes('COUNSELOR 3') || clean === 'SC III' || clean === 'SC 3' || clean.includes('SCHOOL COUNSELOR III')) {
    return POSITION_QS_STANDARDS['School Counselor III'];
  }
  if (clean.includes('COUNSELOR II') || clean.includes('COUNSELOR 2') || clean === 'SC II' || clean === 'SC 2' || clean.includes('SCHOOL COUNSELOR II')) {
    return POSITION_QS_STANDARDS['School Counselor II'];
  }
  if (clean.includes('ASSOCIATE')) {
    return POSITION_QS_STANDARDS['School Counselor Associate I'];
  }
  if (clean.includes('COUNSELOR I') || clean.includes('COUNSELOR 1') || clean === 'SC I' || clean === 'SC 1' || clean.includes('SCHOOL COUNSELOR I') || clean === 'SCHOOL COUNSELOR') {
    return POSITION_QS_STANDARDS['School Counselor I'];
  }
  if (clean.includes('COORDINATOR')) {
    return POSITION_QS_STANDARDS['Guidance Coordinator III'];
  }

  return POSITION_QS_STANDARDS['School Counselor I'];
};

const extractIncumbentName = (row) => {
  if (!row) return '#N/A';
  // 1. Check if first_name and last_name exist (from standard CSV template)
  const f = (row['first_name'] || row['First Name'] || row['firstname'] || row['FIRST NAME'] || row['fname'] || row['FName'] || '').trim();
  const l = (row['last_name'] || row['Last Name'] || row['lastname'] || row['LAST NAME'] || row['lname'] || row['LName'] || '').trim();
  if (f && l) return `${f} ${l}`;
  if (f || l) return (f || l);

  // 2. Check direct incumbent or full name column (from DepEd legacy CSV)
  const direct = (row['INCUMBENT'] || row['Incumbent'] || row['incumbent'] || 
                  row['FULL NAME'] || row['Full Name'] || row['full_name'] || 
                  row['NAME'] || row['Name'] || row['name'] || '').trim();
  if (direct) return direct;

  // 3. Fallback
  return Object.values(row)[7] || '#N/A';
};

export default function ReclassificationPage({ onBack }) {
  const { user } = useAuth();
  const currentUser = user;
  const { setToast } = useToast();
  const { isDark } = useTheme();

  const isRegionalOffice = 
    user?.role === 'regional_office' || 
    user?.role === 'regional_director' || 
    (String(user?.role || '').toLowerCase().includes('regional') && user?.role !== 'admin') ||
    String(user?.position || '').toLowerCase().trim() === 'regional office';

  // Uploading and scanning NOSCA is restricted to Division HRMO (and Admins)
  const canUploadNosca = Boolean(
    !isRegionalOffice || 
    user?.role === 'admin' || 
    user?.role === 'superadmin'
  );

  // Assigning Plantilla Item Numbers & Appointments is restricted to Division HRMO (and Admins)
  const canAssignItemNo = Boolean(
    !isRegionalOffice || 
    user?.role === 'admin' || 
    user?.role === 'superadmin'
  );

  // Endorsing to DBM RO is restricted to Regional Office (and Admins)
  const canEndorseToDbm = Boolean(
    isRegionalOffice || 
    user?.role === 'admin' || 
    user?.role === 'superadmin'
  );

  const canManageNosca = canUploadNosca;

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
  const [noscaInputMode, setNoscaInputMode] = useState('upload'); // 'upload' | 'manual'
  const [manualNoscaItemInput, setManualNoscaItemInput] = useState('');
  const [manualNoscaCategory, setManualNoscaCategory] = useState('ELEMENTARY');
  const [manualNoscaSchoolId, setManualNoscaSchoolId] = useState('');
  const [manualNoscaSchoolName, setManualNoscaSchoolName] = useState('');
  const [manualNoscaSchoolSearch, setManualNoscaSchoolSearch] = useState('');
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const schoolSearchContainerRef = React.useRef(null);
  const [manualNoscaSerial, setManualNoscaSerial] = useState('');
  const [manualNoscaPosition, setManualNoscaPosition] = useState('School Counselor I');
  const [manualNoscaDivision, setManualNoscaDivision] = useState('');
  const [manuallyAddedNoscaItems, setManuallyAddedNoscaItems] = useState(new Set());
  const [showQuickAddInline, setShowQuickAddInline] = useState(false);
  const [quickAddInlineInput, setQuickAddInlineInput] = useState('');
  const [quickAddInlineCategory, setQuickAddInlineCategory] = useState('ELEMENTARY');
  const noscaFileInputRef = React.useRef(null);


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
  const [updatingPositionId, setUpdatingPositionId] = useState(null);
  const [noscaItems, setNoscaItems] = useState([]);
  const [loadingNoscaItems, setLoadingNoscaItems] = useState(false);
  const [noscaItemAssignModal, setNoscaItemAssignModal] = useState({ open: false, personnel: null });
  const [selectedNoscaItemNo, setSelectedNoscaItemNo] = useState('');
  const [customPlantillaNo, setCustomPlantillaNo] = useState('');
  const [isCustomItemNo, setIsCustomItemNo] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [assigningItemLoading, setAssigningItemLoading] = useState(false);
  const [currentPageIncumbents, setCurrentPageIncumbents] = useState(1);
  const [pageSizeIncumbents, setPageSizeIncumbents] = useState(10);

  // Step 4: NOSCA Upload & SDO Item Tracking state
  const [noscaDocuments, setNoscaDocuments] = useState([]);
  const [loadingNoscaDocs, setLoadingNoscaDocs] = useState(false);
  const [uploadingNoscaDoc, setUploadingNoscaDoc] = useState(false);
  const [showNoscaDocsArchiveModal, setShowNoscaDocsArchiveModal] = useState(false);
  const [sdoSearchTerm, setSdoSearchTerm] = useState('');
  const [sdoStatusFilter, setSdoStatusFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'PENDING'
  const [sdoDivisionFilter, setSdoDivisionFilter] = useState('ALL');
  const [sdoEditItemModal, setSdoEditItemModal] = useState({ open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' });
  const [savingSdoItem, setSavingSdoItem] = useState(false);
  const [isSdoDragOver, setIsSdoDragOver] = useState(false);
  const [currentPageSdo, setCurrentPageSdo] = useState(1);
  const [pageSizeSdo, setPageSizeSdo] = useState(10);
  const sdoNoscaFileInputRef = React.useRef(null);

  // Station Mismatch Error Popup Modal state
  const [stationMismatchModal, setStationMismatchModal] = useState({
    open: false,
    fileName: '',
    expectedRegion: '',
    expectedDivision: '',
    mismatches: [],
    totalRows: 0,
    mismatchCount: 0
  });

  // Ingested CSV Success Popup Modal state
  const [ingestionSuccessModal, setIngestionSuccessModal] = useState({
    open: false,
    fileName: '',
    insertedOrUpdated: 0,
    totalInDatabase: 0,
    metrics: null,
    addedItems: [],
    message: ''
  });

  // Modal assessment decisions state
  const [modalTargetPosition, setModalTargetPosition] = useState('');
  const [initialModalPosition, setInitialModalPosition] = useState('');
  const [positionWarningModal, setPositionWarningModal] = useState({
    open: false,
    isUnassigned: false,
    currentPosition: '',
    targetPosition: '',
    candidateName: ''
  });
  const [modalStage, setModalStage] = useState('For Review');
  const [savingModalChanges, setSavingModalChanges] = useState(false);
  const [showIncumbentDocsModal, setShowIncumbentDocsModal] = useState(false);
  const [selectedVaultDocKey, setSelectedVaultDocKey] = useState('pds');
  const docVaultRef = useRef(null);

  // Confirmation Modal state for Endorsed to DBM RO
  const [confirmEndorseModal, setConfirmEndorseModal] = useState({
    open: false,
    counselor: null,
    isBulk: false
  });
  const [endorsingToDbm, setEndorsingToDbm] = useState(false);

  // Confirmation Modal state for Revert Endorsement (RO side)
  const [confirmRevertModal, setConfirmRevertModal] = useState({
    open: false,
    counselor: null,
    targetStage: 'For Review'
  });
  const [revertingEndorsement, setRevertingEndorsement] = useState(false);

  // Document Checklist & QS Evaluation state
  const [docChecklist, setDocChecklist] = useState([]);
  const [qsEvaluation, setQsEvaluation] = useState({
    education: null,
    experience: null,
    training: null,
    eligibility: null
  });
  const [evaluatorRemarks, setEvaluatorRemarks] = useState('');
  const [evaluatorName, setEvaluatorName] = useState('');
  const [savingStep1, setSavingStep1] = useState(false);
  const [savingStep2, setSavingStep2] = useState(false);
  const [savingStep3, setSavingStep3] = useState(false);

  // Sync modal state when an incumbent is opened
  useEffect(() => {
    if (selectedIncumbent) {
      setSelectedVaultDocKey('pds');
      const rawPos = selectedIncumbent.actual_position || selectedIncumbent.reclass_position || selectedIncumbent.target_position || '';
      const initialPos = RECLASS_POSITIONS_OPTIONS.find(p => p.toLowerCase() === String(rawPos).trim().toLowerCase()) || rawPos;
      setModalTargetPosition(initialPos);
      setInitialModalPosition(initialPos);
      setModalStage(selectedIncumbent.stage_of_reclassification || 'For Review');

      // Initialize Document Checklist
      const savedDocs = Array.isArray(selectedIncumbent.document_checklist) && selectedIncumbent.document_checklist.length > 0
        ? selectedIncumbent.document_checklist
        : null;

      const attachedDocs = Array.isArray(selectedIncumbent.assessment?.documents)
        ? selectedIncumbent.assessment.documents
        : [];

      const initialChecklist = DEFAULT_REQUIRED_DOCUMENTS.map(def => {
        if (savedDocs) {
          const match = savedDocs.find(d => {
            const dTitle = String(d.document_title || d.shortTitle || d.label || d.name || '').toLowerCase().trim();
            const defTitle = String(def.shortTitle || def.label || '').toLowerCase().trim();
            const dId = String(d.id || d.key || '').toLowerCase().trim();
            const defId = String(def.id || def.key || '').toLowerCase().trim();
            return (
              (dId && (dId === defId || dId === String(def.key).toLowerCase())) ||
              (dTitle && defTitle && (dTitle === defTitle || dTitle.includes(defTitle) || defTitle.includes(dTitle))) ||
              (def.id === 'training' && (dTitle.includes('train') || dTitle.includes('cert') || dTitle.includes('seminar') || dId === 'training_cert' || dId === 'seminar_cert')) ||
              (def.id === 'employment' && (dTitle.includes('service') || dTitle.includes('employ') || dTitle.includes('work experience'))) ||
              (def.id === 'appointment' && dTitle.includes('appoint')) ||
              (def.id === 'performance' && (dTitle.includes('ipcrf') || dTitle.includes('perform'))) ||
              (def.id === 'loi' && (dTitle.includes('loi') || dTitle.includes('intent'))) ||
              (def.id === 'pds' && dTitle.includes('pds')) ||
              (def.id === 'tor' && (dTitle.includes('tor') || dTitle.includes('transcript'))) ||
              (def.id === 'cav' && (dTitle.includes('cav') || dTitle.includes('omnibus') || dTitle.includes('sworn'))) ||
              (def.id === 'prc' && dTitle.includes('prc'))
            );
          });
          if (match) {
            const isRevision = match.status === 'for_revision' || Boolean(match.for_revision);
            const isDone = !isRevision && Boolean(match.submitted ?? match.verified ?? match.checked ?? match.status === 'approved');
            return {
              ...def,
              status: isRevision ? 'for_revision' : (isDone ? 'approved' : null),
              submitted: isDone,
              verified: isDone,
              remarks: match.remarks || ''
            };
          }
        }
        // Auto-match if candidate has attached documents in assessment.documents
        const hasAttachment = attachedDocs.some(att => {
          const name = String(att.label || att.name || att.key || '').toLowerCase();
          if (def.id === 'loi' && (name.includes('loi') || name.includes('intent'))) return true;
          if (def.id === 'pds' && name.includes('pds')) return true;
          if (def.id === 'tor' && (name.includes('tor') || name.includes('transcript'))) return true;
          if (def.id === 'eligibility' && (name.includes('elig') || name.includes('board') || name.includes('1080'))) return true;
          if (def.id === 'cav' && (name.includes('cav') || name.includes('omnibus') || name.includes('sworn'))) return true;
          if (def.id === 'prc' && name.includes('prc')) return true;
          if (def.id === 'training' && (name.includes('train') || name.includes('cert') || name.includes('seminar'))) return true;
          if (def.id === 'employment' && (name.includes('service') || name.includes('employ'))) return true;
          if (def.id === 'appointment' && name.includes('appoint')) return true;
          if (def.id === 'performance' && (name.includes('ipcrf') || name.includes('perform'))) return true;
          return false;
        });

        return {
          ...def,
          status: hasAttachment ? 'approved' : null,
          submitted: hasAttachment,
          verified: hasAttachment,
          remarks: ''
        };
      });
      setDocChecklist(initialChecklist);

      // Initialize QS Evaluation (Preserve saved evaluation from database, otherwise default to unselected for manual evaluator assessment)
      if (
        selectedIncumbent.qs_evaluation &&
        typeof selectedIncumbent.qs_evaluation === 'object' &&
        (selectedIncumbent.qs_evaluation.education || selectedIncumbent.qs_evaluation.experience || selectedIncumbent.qs_evaluation.training || selectedIncumbent.qs_evaluation.eligibility)
      ) {
        setQsEvaluation({
          education: selectedIncumbent.qs_evaluation.education || null,
          experience: selectedIncumbent.qs_evaluation.experience || null,
          training: selectedIncumbent.qs_evaluation.training || null,
          eligibility: selectedIncumbent.qs_evaluation.eligibility || null
        });
      } else {
        setQsEvaluation({
          education: null,
          experience: null,
          training: null,
          eligibility: null
        });
      }

      setEvaluatorRemarks(selectedIncumbent.evaluator_remarks || '');
      const defaultEvalName = currentUser?.name || currentUser?.fullName || [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || 'Division HRMO';
      setEvaluatorName(selectedIncumbent.evaluated_by || defaultEvalName);
    }
  }, [selectedIncumbent, currentUser]);

  // Helper callbacks for Document Checklist & Document Vault
  const handleSetDocStatus = (docId, newStatus) => {
    if (isRegionalOffice) return;
    let nextStatus = null;
    let targetDoc = null;
    setDocChecklist(prev =>
      prev.map(item => {
        if (item.id === docId) {
          nextStatus = item.status === newStatus ? null : newStatus;
          const isApproved = nextStatus === 'approved';
          targetDoc = {
            ...item,
            status: nextStatus,
            submitted: isApproved,
            verified: isApproved
          };
          return targetDoc;
        }
        return item;
      })
    );

    // Persist to reclass_documents in real-time
    if (selectedIncumbent?.id) {
      apiFetch(`/api/reclassification/incumbents/${selectedIncumbent.id}/documents/status`, {
        method: 'PUT',
        body: JSON.stringify({
          document_title: targetDoc?.shortTitle || targetDoc?.label || targetDoc?.title || docId,
          status: nextStatus,
          remarks: targetDoc?.remarks || null
        })
      }).catch(err => console.warn('[Reclass] Error persisting document status to reclass_documents:', err));
    }
  };

  const handleSetDocRemarks = (docId, remarks) => {
    if (isRegionalOffice) return;
    let targetDoc = null;
    setDocChecklist(prev =>
      prev.map(item => {
        if (item.id === docId) {
          targetDoc = { ...item, remarks };
          return targetDoc;
        }
        return item;
      })
    );

    // Persist to reclass_documents in real-time
    if (selectedIncumbent?.id) {
      apiFetch(`/api/reclassification/incumbents/${selectedIncumbent.id}/documents/status`, {
        method: 'PUT',
        body: JSON.stringify({
          document_title: targetDoc?.shortTitle || targetDoc?.label || targetDoc?.title || docId,
          status: targetDoc?.status || null,
          remarks: remarks
        })
      }).catch(err => console.warn('[Reclass] Error persisting document remarks to reclass_documents:', err));
    }
  };

  const handleToggleDocCheck = (docId) => {
    if (isRegionalOffice) return;
    setDocChecklist(prev =>
      prev.map(item => {
        if (item.id === docId) {
          const isCurrentlyDone = Boolean(item.submitted && item.verified && item.status === 'approved');
          const nextVal = !isCurrentlyDone;
          return {
            ...item,
            status: nextVal ? 'approved' : null,
            submitted: nextVal,
            verified: nextVal
          };
        }
        return item;
      })
    );
  };

  const handleToggleDocSubmitted = handleToggleDocCheck;
  const handleToggleDocVerified = handleToggleDocCheck;

  const handleMarkAllDocsComplete = () => {
    if (isRegionalOffice) return;
    setDocChecklist(prev =>
      prev.map(item => ({
        ...item,
        status: 'approved',
        submitted: true,
        verified: true
      }))
    );
  };

  const handleResetAllDocs = () => {
    if (isRegionalOffice) return;
    setDocChecklist(prev =>
      prev.map(item => ({
        ...item,
        status: null,
        submitted: false,
        verified: false,
        remarks: ''
      }))
    );
  };

  const handleSetQsCriterion = (criterionKey, value) => {
    setQsEvaluation(prev => ({
      ...prev,
      [criterionKey]: prev[criterionKey] === value ? null : value
    }));
  };



  // Modals state

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

  const [currentStep, setCurrentStep] = useState(() => isRegionalOffice ? 3 : 1);

  const handleStepClick = (targetStep) => {
    setCurrentStep(targetStep);
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
      console.error('[Reclass] Error loading incumbents from API:', err);
      setIncumbents([]);
    } finally {
      setLoadingIncumbents(false);
    }
  };

  // Load Available and Assigned NOSCA Plantilla Items from dedicated table
  const fetchNoscaItems = async () => {
    setLoadingNoscaItems(true);
    try {
      const data = await apiFetch('/api/reclassification/nosca-items');
      if (Array.isArray(data)) {
        setNoscaItems(data);
      }
    } catch (err) {
      console.error('[Reclass] Error loading NOSCA items:', err);
    } finally {
      setLoadingNoscaItems(false);
    }
  };

  // Load Uploaded NOSCA Reference Documents
  const fetchNoscaDocuments = async () => {
    setLoadingNoscaDocs(true);
    try {
      const data = await apiFetch('/api/reclassification/nosca-documents');
      if (Array.isArray(data)) {
        setNoscaDocuments(data);
      }
    } catch (err) {
      console.warn('[Reclass] Error loading NOSCA documents:', err);
    } finally {
      setLoadingNoscaDocs(false);
    }
  };

  // Direct NOSCA upload and automatic matching for Step 4
  const handleDirectNoscaUpload = async (file) => {
    if (!canUploadNosca) {
      setToast({
        title: 'Access Restricted',
        message: 'Uploading NOSCA documents is restricted to Regional Office and Administrator accounts.',
        type: 'error'
      });
      return;
    }
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setToast({
        title: 'PDF File Required',
        message: 'Please upload an official DBM NOSCA document in PDF format.',
        type: 'error'
      });
      return;
    }

    setUploadingNoscaDoc(true);
    const reader = new FileReader();
    reader.onload = async (uploadEvt) => {
      try {
        const fileData = uploadEvt.target.result;
        const res = await apiFetch('/api/reclassification/upload-nosca-and-match', {
          method: 'POST',
          body: JSON.stringify({
            fileData,
            fileName: file.name
          })
        });

        if (res && res.success) {
          setToast({
            title: 'NOSCA Processed & Linked',
            message: res.message || 'NOSCA items extracted and linked to SDO endorsees!',
            type: 'success'
          });
          fetchIncumbents();
          fetchNoscaDocuments();
          fetchNoscaItems();
        } else {
          throw new Error(res?.error || 'Failed to process NOSCA document.');
        }
      } catch (err) {
        console.error('[Reclass] Upload NOSCA error:', err);
        setToast({
          title: 'NOSCA Upload Failed',
          message: err.message || 'Error occurred while processing NOSCA.',
          type: 'error'
        });
      } finally {
        setUploadingNoscaDoc(false);
        if (sdoNoscaFileInputRef.current) {
          sdoNoscaFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Manually link, edit, or remove NEW Item No. on an SDO endorsee (Division HRMO)
  const handleSaveSdoItem = async (explicitItemNumber = undefined) => {
    if (!canAssignItemNo) {
      setToast({
        title: 'Access Restricted',
        message: 'Assigning plantilla item numbers and appointments is restricted to Division HRMO accounts.',
        type: 'error'
      });
      return;
    }
    if (!sdoEditItemModal.personnel) return;
    setSavingSdoItem(true);

    const isRemoving = explicitItemNumber === '' || explicitItemNumber === null;
    const itemNumberToSave = explicitItemNumber !== undefined 
      ? (explicitItemNumber || '') 
      : (sdoEditItemModal.newItemNumber || '');
    const serialNoToSave = isRemoving ? '' : (sdoEditItemModal.serialNo || '');
    const fileNameToSave = isRemoving ? '' : (sdoEditItemModal.fileName || '');

    try {
      const res = await apiFetch(`/api/reclassification/incumbents/${sdoEditItemModal.personnel.id}/nosca-item`, {
        method: 'PUT',
        body: JSON.stringify({
          newItemNumber: itemNumberToSave,
          serialNo: serialNoToSave,
          fileName: fileNameToSave
        })
      });

      if (res && res.success) {
        const nextStage = 'Endorsed to DBM RO';
        const nextItemNo = isRemoving ? null : (itemNumberToSave || null);
        const targetId = sdoEditItemModal.personnel.id;

        setIncumbents(prev => prev.map(item => {
          if (item.id === targetId) {
            return {
              ...item,
              new_item_no: nextItemNo,
              new_item_number: nextItemNo,
              stage_of_reclassification: nextStage
            };
          }
          return item;
        }));

        if (selectedIncumbent && selectedIncumbent.id === targetId) {
          setSelectedIncumbent(prev => ({
            ...prev,
            new_item_no: nextItemNo,
            new_item_number: nextItemNo,
            stage_of_reclassification: nextStage
          }));
        }

        setToast({
          title: isRemoving ? 'Appointment Removed' : 'Item No. Updated',
          message: isRemoving 
            ? `Removed appointment and unlinked Item No. from ${sdoEditItemModal.personnel.full_name}`
            : `Assigned NEW Item No. ${itemNumberToSave} to ${sdoEditItemModal.personnel.full_name}`,
          type: 'success'
        });
        setSdoEditItemModal({ open: false, personnel: null, newItemNumber: '', serialNo: '', fileName: '' });
        fetchIncumbents();
        fetchNoscaItems();
        fetchNoscaDocuments();
      } else {
        throw new Error(res?.error || 'Failed to update Item No.');
      }
    } catch (err) {
      console.error('[Reclass] Error saving item no:', err);
      setToast({
        title: 'Update Error',
        message: err.message || 'Failed to update Item No.',
        type: 'error'
      });
    } finally {
      setSavingSdoItem(false);
    }
  };

  useEffect(() => {
    fetchIncumbents();
    fetchNoscaItems();
    fetchNoscaDocuments();
  }, []);

  // Autocomplete fetch schools from agap_schools
  useEffect(() => {
    if (!showSchoolDropdown) return;
    const timer = setTimeout(async () => {
      setLoadingSchools(true);
      try {
        const queryParam = manualNoscaSchoolSearch ? `?q=${encodeURIComponent(manualNoscaSchoolSearch.trim())}` : '';
        const res = await apiFetch(`/api/reclassification/schools/autocomplete${queryParam}`);
        if (Array.isArray(res)) {
          setSchoolSuggestions(res);
        }
      } catch (err) {
        console.error('[Reclass] Failed to autocomplete schools:', err);
      } finally {
        setLoadingSchools(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [manualNoscaSchoolSearch, showSchoolDropdown]);

  // Click outside to close school dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (schoolSearchContainerRef.current && !schoolSearchContainerRef.current.contains(e.target)) {
        setShowSchoolDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSchool = (school) => {
    setManualNoscaSchoolId(String(school.school_id || ''));
    setManualNoscaSchoolName(school.school_name || '');
    setManualNoscaSchoolSearch(`${school.school_id} - ${school.school_name}`);
    if (school.division && !manualNoscaDivision) {
      setManualNoscaDivision(school.division.replace(/^division\s*(?:of)?\s*/i, '').trim().toUpperCase());
    }
    setShowSchoolDropdown(false);
  };

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
        message: `Stage updated to "${newStage}" (synchronized with application record)!`
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

  // Available Item Nos from uploaded/scanned NOSCA and dedicated reclassification_nosca_items table
  const availableNoscaItemOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    const candidate = noscaItemAssignModal?.personnel;
    const candLevel = candidate ? getCandidatePositionLevel(candidate) : null;

    // 1. From active scanned / uploaded NOSCA batch in current session
    if (scannedNoscaResult?.items && Array.isArray(scannedNoscaResult.items)) {
      const scannedPos = scannedNoscaResult.position || '';
      scannedNoscaResult.items.forEach(item => {
        const str = String(item).trim();
        if (!str || seen.has(str.toLowerCase())) return;

        if (candLevel) {
          const itemLevel = getPositionLevel(scannedPos) || getPositionLevel(str);
          if (itemLevel !== candLevel) return;
        }

        seen.add(str.toLowerCase());
        list.push({
          itemNo: str,
          source: scannedNoscaResult.serial_no ? `NOSCA #${scannedNoscaResult.serial_no}` : (scannedNoscaResult.fileName || 'Scanned NOSCA'),
          division: scannedNoscaResult.division || '',
          category: 'NOSCA Allocation',
          isNA: str.toUpperCase() === '#N/A' || str.toUpperCase() === 'N/A'
        });
      });
    }

    // 2. From dedicated reclassification_nosca_items table (Available items)
    if (Array.isArray(noscaItems)) {
      noscaItems.forEach(item => {
        const itemNo = (item.plantilla_item_number || item.new_item_no || '').trim();
        if (!itemNo || seen.has(itemNo.toLowerCase())) return;

        if (candLevel) {
          const itemLevel = getItemPositionLevel(item);
          if (itemLevel !== candLevel) return;
        }

        seen.add(itemNo.toLowerCase());
        list.push({
          itemNo,
          source: item.serial_no ? `NOSCA #${item.serial_no}` : 'NOSCA Allocation',
          division: item.division || '',
          category: item.category || 'ELEMENTARY',
          isNA: itemNo.toUpperCase() === '#N/A' || itemNo.toUpperCase() === 'N/A'
        });
      });
    }

    return list;
  }, [scannedNoscaResult, noscaItems, noscaItemAssignModal?.personnel]);

  // Confirm NOSCA Item Assignment
  const handleConfirmNoscaItemAssignment = async () => {
    if (!canAssignItemNo) {
      setToast({
        type: 'error',
        message: 'Assigning plantilla item numbers and appointments is restricted to Division HRMO accounts.'
      });
      return;
    }
    if (!noscaItemAssignModal.personnel) return;
    const counselor = noscaItemAssignModal.personnel;
    const finalItem = isCustomItemNo ? customPlantillaNo.trim() : selectedNoscaItemNo.trim();

    if (!finalItem || finalItem.toUpperCase() === '#N/A' || finalItem.toUpperCase() === 'N/A') {
      setToast({
        type: 'warning',
        message: 'Please select an available Plantilla Item No. or enter a new authorized Item Number.'
      });
      return;
    }

    setAssigningItemLoading(true);
    try {
      const res = await apiFetch(`/api/reclassification/incumbents/${counselor.id}/nosca-item`, {
        method: 'PUT',
        body: JSON.stringify({
          newItemNumber: finalItem
        })
      });
      if (res && res.success) {
        setToast({
          type: 'success',
          message: `Assigned NOSCA Item No. ${finalItem} to ${counselor.full_name}!`
        });
        setNoscaItemAssignModal({ open: false, personnel: null });
        fetchIncumbents();
        fetchNoscaItems();
      } else {
        throw new Error(res?.error || 'Failed to assign NOSCA item');
      }
    } catch (err) {
      console.error('[Reclass] Error assigning NOSCA item:', err);
      setToast({
        type: 'error',
        message: err.message || 'Failed to assign NOSCA item'
      });
    } finally {
      setAssigningItemLoading(false);
    }
  };

  // Update incumbent counselor actual reclassification position
  const handleUpdateIncumbentPosition = async (incumbentIdOrPos, optionalPos, e) => {
    if (e && e.stopPropagation) e.stopPropagation();

    let incumbentId;
    let newPos;
    if (typeof incumbentIdOrPos === 'string' && optionalPos === undefined) {
      if (!selectedIncumbent) return;
      incumbentId = selectedIncumbent.id;
      newPos = incumbentIdOrPos;
    } else {
      incumbentId = incumbentIdOrPos;
      newPos = optionalPos;
    }

    const targetInc = incumbents.find(i => i.id === incumbentId) || selectedIncumbent;
    if (!targetInc) return;
    const previousPos = targetInc.actual_position || targetInc.target_position || targetInc.reclass_position;
    const formattedPos = (newPos === '' || newPos === undefined) ? null : newPos;

    // Optimistic update
    setIncumbents(prev =>
      prev.map(item => item.id === incumbentId ? { ...item, actual_position: formattedPos, target_position: formattedPos, reclass_position: formattedPos } : item)
    );
    if (selectedIncumbent && selectedIncumbent.id === incumbentId) {
      setSelectedIncumbent(prev => ({ ...prev, actual_position: formattedPos, target_position: formattedPos, reclass_position: formattedPos }));
      setModalTargetPosition(formattedPos || '');
    }

    setUpdatingPositionId(incumbentId);
    setUpdatingPosition(true);
    try {
      await apiFetch(`/api/reclassification/incumbents/${incumbentId}/position`, {
        method: 'PUT',
        body: JSON.stringify({ target_position: formattedPos, reclass_position: formattedPos, actual_position: formattedPos })
      });
      setToast({
        type: 'success',
        message: formattedPos ? `Actual reclassification position set to ${formattedPos}!` : 'Position unassigned.'
      });
    } catch (err) {
      console.error('[Reclass] Error updating position:', err);
      setIncumbents(prev =>
        prev.map(item => item.id === incumbentId ? { ...item, actual_position: previousPos, target_position: previousPos, reclass_position: previousPos } : item)
      );
      if (selectedIncumbent && selectedIncumbent.id === incumbentId) {
        setSelectedIncumbent(prev => ({ ...prev, actual_position: previousPos, target_position: previousPos, reclass_position: previousPos }));
      }
      setToast({
        type: 'error',
        message: err.message || 'Failed to update actual reclassification position'
      });
    } finally {
      setUpdatingPositionId(null);
      setUpdatingPosition(false);
    }
  };

  // Calculate QS Evaluation Status
  const getCalculatedQsStatus = (evalMap = qsEvaluation) => {
    const values = [evalMap.education, evalMap.experience, evalMap.training, evalMap.eligibility];
    if (values.some(v => v === 'Does Not Meet')) return 'NOT QUALIFIED';
    if (values.every(v => v === 'Meets')) return 'QUALIFIED';
    return 'PENDING';
  };

  // Helper memoized gating checks: Step 1 must be done before Step 2, Step 2 before Step 3
  const isAssessmentStep1Done = useMemo(() => {
    if (!docChecklist || docChecklist.length === 0) return false;
    // Gating rule: If ANY document in the checklist is marked for revision, Step 1 is NOT complete!
    const hasAnyRevision = docChecklist.some(d => d.status === 'for_revision');
    if (hasAnyRevision) return false;
    // All required mandatory documents must be approved
    const requiredReqs = docChecklist.filter(d => d.required);
    const missing = requiredReqs.filter(d => !d.submitted || !d.verified || d.status !== 'approved');
    return missing.length === 0;
  }, [docChecklist]);

  const isAssessmentStep2Done = useMemo(() => {
    if (!isAssessmentStep1Done) return false;
    const overall = getCalculatedQsStatus(qsEvaluation);
    return overall === 'QUALIFIED' || overall === 'NOT QUALIFIED';
  }, [isAssessmentStep1Done, qsEvaluation]);

  // Helper to return to modal and focus actual reclassification position select
  const handleGoBackToChangePosition = () => {
    setPositionWarningModal(prev => ({ ...prev, open: false }));
    setTimeout(() => {
      const el = document.getElementById('actual-reclass-position-select') || document.getElementById('top-actual-reclass-position-select');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.style.transition = 'box-shadow 0.25s ease, border-color 0.25s ease';
        el.style.borderColor = '#f59e0b';
        el.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.45)';
        setTimeout(() => {
          el.style.borderColor = '';
          el.style.boxShadow = '';
        }, 2200);
      }
    }, 100);
  };

  // Step 1: Save Document Screening
  const handleSaveStep1 = async () => {
    if (!selectedIncumbent) return;
    setSavingStep1(true);
    const incumbentId = selectedIncumbent.id;
    try {
      await apiFetch(`/api/reclassification/incumbents/${incumbentId}/qs-evaluation`, {
        method: 'PUT',
        body: JSON.stringify({
          document_checklist: docChecklist
        })
      });

      const updatedFields = {
        document_checklist: docChecklist
      };

      setIncumbents(prev =>
        prev.map(item => item.id === incumbentId ? { ...item, ...updatedFields } : item)
      );
      setSelectedIncumbent(prev => ({ ...prev, ...updatedFields }));

      setToast({
        type: 'success',
        title: 'Step 1 Saved',
        message: 'Document screening checklist saved successfully.'
      });
      fetchIncumbents();
    } catch (err) {
      console.error('[Reclass] Error saving Step 1:', err);
      setToast({
        type: 'error',
        title: 'Failed to Save Step 1',
        message: err.message || 'Error occurred while saving Step 1 documents.'
      });
    } finally {
      setSavingStep1(false);
    }
  };

  // Step 2: Save Position-Specific QS Evaluation (Requires Step 1 complete)
  const handleSaveStep2 = async () => {
    if (!selectedIncumbent) return;
    if (!isAssessmentStep1Done) {
      const hasAnyRev = docChecklist.some(d => d.status === 'for_revision');
      setToast({
        type: 'error',
        title: hasAnyRev ? 'Revision Items Pending' : 'Step 1 Incomplete',
        message: hasAnyRev
          ? 'Cannot save Step 2: One or more documents are marked For Revision. Please resolve all revision items first.'
          : 'Cannot save Step 2: Please complete and approve all mandatory requirements in Step 1 first.'
      });
      return;
    }

    setSavingStep2(true);
    const incumbentId = selectedIncumbent.id;
    const overallStatus = getCalculatedQsStatus(qsEvaluation);
    const nowIso = new Date().toISOString();
    try {
      await apiFetch(`/api/reclassification/incumbents/${incumbentId}/qs-evaluation`, {
        method: 'PUT',
        body: JSON.stringify({
          qs_evaluation: qsEvaluation,
          qs_eval_result: overallStatus,
          evaluator_by: evaluatorName,
          evaluator_remarks: evaluatorRemarks
        })
      });

      const updatedFields = {
        qs_evaluation: qsEvaluation,
        qs_eval_result: overallStatus,
        evaluated_by: evaluatorName,
        evaluated_at: nowIso,
        evaluator_remarks: evaluatorRemarks
      };

      setIncumbents(prev =>
        prev.map(item => item.id === incumbentId ? { ...item, ...updatedFields } : item)
      );
      setSelectedIncumbent(prev => ({ ...prev, ...updatedFields }));

      setToast({
        type: 'success',
        title: 'Step 2 Saved',
        message: `Qualification Standards evaluation (${overallStatus}) saved successfully.`
      });
      fetchIncumbents();
    } catch (err) {
      console.error('[Reclass] Error saving Step 2:', err);
      setToast({
        type: 'error',
        title: 'Failed to Save Step 2',
        message: err.message || 'Failed to save Step 2 evaluation.'
      });
    } finally {
      setSavingStep2(false);
    }
  };

  // Step 3: Save Actual Position & Workflow Stage (Requires Step 1 & Step 2 complete)
  const handleSaveStep3 = async () => {
    if (!selectedIncumbent) return;
    if (!isAssessmentStep1Done) {
      const hasAnyRev = docChecklist.some(d => d.status === 'for_revision');
      setToast({
        type: 'error',
        title: hasAnyRev ? 'Revision Items Pending' : 'Step 1 Incomplete',
        message: hasAnyRev
          ? 'Cannot save Step 3: One or more documents are marked For Revision. Please resolve all revision items first.'
          : 'Cannot save Step 3: Please complete and approve all mandatory requirements in Step 1 first.'
      });
      return;
    }
    if (!isAssessmentStep2Done) {
      setToast({
        type: 'error',
        title: 'Step 2 Incomplete',
        message: 'Please complete all criteria in Step 2 (QS Evaluation) first.'
      });
      return;
    }

    setSavingStep3(true);
    const incumbentId = selectedIncumbent.id;
    const formattedPos = modalTargetPosition === '' ? null : modalTargetPosition;
    const newStage = modalStage;
    try {
      const promises = [];
      promises.push(
        apiFetch(`/api/reclassification/incumbents/${incumbentId}/qs-evaluation`, {
          method: 'PUT',
          body: JSON.stringify({
            target_position: formattedPos,
            actual_position: formattedPos,
            reclass_position: formattedPos,
            stage_of_reclassification: newStage
          })
        })
      );
      if (formattedPos !== (selectedIncumbent.actual_position || selectedIncumbent.reclass_position || selectedIncumbent.target_position)) {
        promises.push(
          apiFetch(`/api/reclassification/incumbents/${incumbentId}/position`, {
            method: 'PUT',
            body: JSON.stringify({ target_position: formattedPos, actual_position: formattedPos, reclass_position: formattedPos })
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

      await Promise.all(promises);

      const updatedFields = {
        target_position: formattedPos,
        actual_position: formattedPos,
        reclass_position: formattedPos,
        stage_of_reclassification: newStage
      };

      setIncumbents(prev =>
        prev.map(item => item.id === incumbentId ? { ...item, ...updatedFields } : item)
      );
      setSelectedIncumbent(prev => ({ ...prev, ...updatedFields }));
      setInitialModalPosition(modalTargetPosition || '');

      setToast({
        type: 'success',
        title: 'Step 3 Saved',
        message: `Actual position & workflow stage updated to "${newStage}".`
      });
      fetchIncumbents();
    } catch (err) {
      console.error('[Reclass] Error saving Step 3:', err);
      setToast({
        type: 'error',
        title: 'Failed to Save Step 3',
        message: err.message || 'Error occurred while saving Step 3 position & stage.'
      });
    } finally {
      setSavingStep3(false);
    }
  };

  // Save all assessment changes from modal
  const handleSaveModalChanges = async (forceProceed = false) => {
    if (!selectedIncumbent) return;

    if (!isAssessmentStep1Done) {
      const hasAnyRev = docChecklist.some(d => d.status === 'for_revision');
      setToast({
        type: 'error',
        title: hasAnyRev ? 'Revision Items Pending' : 'Step 1 Incomplete',
        message: hasAnyRev
          ? 'Cannot complete assessment: One or more documents are marked For Revision. Please resolve all revision items first.'
          : 'Cannot complete assessment: Please approve all mandatory requirements in Step 1 first.'
      });
      return;
    }

    if (!isAssessmentStep2Done) {
      setToast({
        type: 'error',
        title: 'Step 2 Incomplete',
        message: 'Please complete all criteria in Step 2 (QS Evaluation) first.'
      });
      return;
    }

    // Check if the user is saving without designating an actual reclassification position
    const isForced = forceProceed === true;
    const isUnassigned = !modalTargetPosition || String(modalTargetPosition).trim() === '';

    if (!isForced && isUnassigned) {
      setPositionWarningModal({
        open: true,
        isUnassigned,
        currentPosition: modalTargetPosition || '',
        targetPosition: selectedIncumbent.target_position || selectedIncumbent.reclass_position || 'School Counselor I',
        candidateName: selectedIncumbent.full_name || 'Incumbent Counselor'
      });
      return;
    }

    setSavingModalChanges(true);
    const incumbentId = selectedIncumbent.id;
    const formattedPos = modalTargetPosition === '' ? null : modalTargetPosition;
    const newStage = modalStage;
    const overallStatus = getCalculatedQsStatus(qsEvaluation);
    const nowIso = new Date().toISOString();

    try {
      const promises = [];
      if (formattedPos !== (selectedIncumbent.actual_position || selectedIncumbent.reclass_position || selectedIncumbent.target_position)) {
        promises.push(
          apiFetch(`/api/reclassification/incumbents/${incumbentId}/position`, {
            method: 'PUT',
            body: JSON.stringify({ target_position: formattedPos, actual_position: formattedPos, reclass_position: formattedPos })
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

      // Save QS evaluation and document checklist
      promises.push(
        apiFetch(`/api/reclassification/incumbents/${incumbentId}/qs-evaluation`, {
          method: 'PUT',
          body: JSON.stringify({
            document_checklist: docChecklist,
            qs_evaluation: qsEvaluation,
            qs_eval_result: overallStatus,
            evaluated_by: evaluatorName,
            evaluator_remarks: evaluatorRemarks,
            target_position: formattedPos,
            actual_position: formattedPos,
            reclass_position: formattedPos,
            stage_of_reclassification: newStage
          })
        })
      );

      await Promise.all(promises);

      // Optimistic update in table list and active selection
      const updatedFields = {
        target_position: formattedPos,
        actual_position: formattedPos,
        reclass_position: formattedPos,
        stage_of_reclassification: newStage,
        document_checklist: docChecklist,
        qs_evaluation: qsEvaluation,
        qs_eval_result: overallStatus,
        evaluated_by: evaluatorName,
        evaluated_at: nowIso,
        evaluator_remarks: evaluatorRemarks
      };

      setIncumbents(prev =>
        prev.map(item =>
          item.id === incumbentId
            ? { ...item, ...updatedFields }
            : item
        )
      );
      setSelectedIncumbent(prev => ({
        ...prev,
        ...updatedFields
      }));

      setInitialModalPosition(modalTargetPosition || '');
      setPositionWarningModal({ open: false, isUnassigned: false, currentPosition: '', targetPosition: '', candidateName: '' });

      setToast({
        type: 'success',
        title: 'Assessment Complete',
        message: `Evaluation (${overallStatus}) and position successfully saved for ${selectedIncumbent.full_name}.`
      });
      setShowAssessmentModal(false);
      fetchIncumbents();
    } catch (err) {
      console.error('[Reclass] Error saving modal changes:', err);
      setToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Failed to save candidate assessment changes.'
      });
    } finally {
      setSavingModalChanges(false);
    }
  };

  // Confirm and persist Endorsed to DBM RO
  const handleConfirmEndorseToDbm = async () => {
    if (endorsingToDbm) return;
    if (!canEndorseToDbm) {
      setToast({
        type: 'error',
        message: 'Endorsing candidates to DBM Regional Office is restricted to Regional Office accounts.'
      });
      return;
    }
    setEndorsingToDbm(true);
    try {
      if (confirmEndorseModal.isBulk) {
        const candidatesToUpdate = incumbents.filter(i => {
          const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
          return s === 'endorsed to ro' || s === 'endorsed';
        });

        if (candidatesToUpdate.length === 0) {
          setToast({ type: 'warning', message: 'No candidates currently at "Endorsed to RO" stage to endorse.' });
          setConfirmEndorseModal({ open: false, counselor: null, isBulk: false });
          return;
        }

        await Promise.all(
          candidatesToUpdate.map(c =>
            apiFetch(`/api/reclassification/incumbents/${c.id}/stage`, {
              method: 'PUT',
              body: JSON.stringify({ stage_of_reclassification: 'Endorsed to DBM RO' })
            })
          )
        );

        setIncumbents(prev =>
          prev.map(item => {
            const s = String(item.stage_of_reclassification || '').trim().toLowerCase();
            if (s === 'endorsed to ro' || s === 'endorsed') {
              return { ...item, stage_of_reclassification: 'Endorsed to DBM RO' };
            }
            return item;
          })
        );

        setToast({
          type: 'success',
          message: `Successfully endorsed ${candidatesToUpdate.length} candidates to DBM RO! Stage updated.`
        });
      } else if (confirmEndorseModal.counselor) {
        const targetId = confirmEndorseModal.counselor.id;
        await apiFetch(`/api/reclassification/incumbents/${targetId}/stage`, {
          method: 'PUT',
          body: JSON.stringify({ stage_of_reclassification: 'Endorsed to DBM RO' })
        });

        setIncumbents(prev =>
          prev.map(item =>
            item.id === targetId ? { ...item, stage_of_reclassification: 'Endorsed to DBM RO' } : item
          )
        );

        if (selectedIncumbent?.id === targetId) {
          setSelectedIncumbent(prev => ({ ...prev, stage_of_reclassification: 'Endorsed to DBM RO' }));
          setModalStage('Endorsed to DBM RO');
        }

        setToast({
          type: 'success',
          message: `Successfully endorsed ${confirmEndorseModal.counselor.full_name} to DBM RO! Stage updated.`
        });
      }
      setConfirmEndorseModal({ open: false, counselor: null, isBulk: false });
    } catch (err) {
      console.error('[Reclass] Error endorsing to DBM RO:', err);
      setToast({ type: 'error', message: err.message || 'Failed to endorse candidate to DBM RO' });
    } finally {
      setEndorsingToDbm(false);
    }
  };

  // Revert endorsement handler for Regional Office
  const handleConfirmRevertEndorsement = async () => {
    if (!confirmRevertModal.counselor) return;
    setRevertingEndorsement(true);
    const targetId = confirmRevertModal.counselor.id;
    const targetStage = confirmRevertModal.targetStage || 'For Review';
    try {
      await apiFetch(`/api/reclassification/incumbents/${targetId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage_of_reclassification: targetStage })
      });

      setIncumbents(prev =>
        prev.map(item =>
          item.id === targetId ? { ...item, stage_of_reclassification: targetStage } : item
        )
      );

      if (selectedIncumbent?.id === targetId) {
        setSelectedIncumbent(prev => ({ ...prev, stage_of_reclassification: targetStage }));
        setModalStage(targetStage);
      }

      setToast({
        type: 'success',
        message: `Successfully reverted endorsement for ${confirmRevertModal.counselor.full_name || 'candidate'} to "${targetStage}"!`
      });
      setConfirmRevertModal({ open: false, counselor: null, targetStage: 'For Review' });
    } catch (err) {
      console.error('[Reclass] Error reverting endorsement:', err);
      setToast({ type: 'error', message: err.message || 'Failed to revert endorsement' });
    } finally {
      setRevertingEndorsement(false);
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
        inc.school_id?.toLowerCase().includes(q) ||
        inc.school_name?.toLowerCase().includes(q) ||
        inc.region?.toLowerCase().includes(q) ||
        inc.uacs_oper_dsc?.toLowerCase().includes(q) ||
        inc.remarks?.toLowerCase().includes(q) ||
        (inc.target_position || inc.reclass_position)?.toLowerCase().includes(q) ||
        (inc.salary_grade && `sg ${inc.salary_grade}`.includes(q));

      const matchStage = !incumbentStageFilter || 
        String(inc.stage_of_reclassification || '').trim().toLowerCase() === incumbentStageFilter.trim().toLowerCase();
      const matchRegion = !incumbentRegionFilter || inc.region === incumbentRegionFilter;
      const matchPosition = !incumbentPositionFilter || (
        incumbentPositionFilter === 'UNASSIGNED'
          ? !(inc.target_position || inc.reclass_position)
          : (inc.target_position || inc.reclass_position) === incumbentPositionFilter
      );

      return matchSearch && matchStage && matchRegion && matchPosition;
    });
  }, [incumbents, incumbentSearchTerm, incumbentStageFilter, incumbentRegionFilter, incumbentPositionFilter]);

  // KPI Metrics for Incumbents
  const incumbentMetrics = useMemo(() => {
    const norm = (s) => String(s || '').trim().toLowerCase();
    const total = incumbents.length;
    const forReview = incumbents.filter((i) => ['for review', 'for_review', 'pending', ''].includes(norm(i.stage_of_reclassification))).length;
    const endorsedToRO = incumbents.filter((i) => ['endorsed to ro', 'endorsed', 'endorsed_to_ro'].includes(norm(i.stage_of_reclassification))).length;
    const endorsedToDbm = incumbents.filter((i) => ['endorsed to dbm ro', 'endorsed to dbm'].includes(norm(i.stage_of_reclassification))).length;
    const approved = incumbents.filter((i) => norm(i.stage_of_reclassification) === 'approved').length;
    const denied = incumbents.filter((i) => ['denied', 'ineligible'].includes(norm(i.stage_of_reclassification))).length;
    const vacant = incumbents.filter((i) => norm(i.stage_of_reclassification) === 'unfilled / vacant' || norm(i.full_name) === '#n/a').length;
    return {
      total,
      forReview,
      endorsedToRO,
      endorsedToDbm,
      endorsed: endorsedToRO + endorsedToDbm,
      approved,
      denied,
      vacant
    };
  }, [incumbents]);

  // Paged incumbents
  const pagedIncumbents = useMemo(() => {
    const start = (currentPageIncumbents - 1) * pageSizeIncumbents;
    return filteredIncumbents.slice(start, start + pageSizeIncumbents);
  }, [filteredIncumbents, currentPageIncumbents, pageSizeIncumbents]);

  // Step completion flags
  const isStep1Done = incumbents.length > 0 || currentStep > 1;
  const isStep2Done = currentStep > 2 || incumbents.some(i => {
    const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
    return ['endorsed to ro', 'endorsed to dbm ro', 'endorsed'].includes(s) || 
      ((i.target_position || i.reclass_position) && (i.target_position || i.reclass_position) !== '#N/A');
  });
  const isStep3Done = currentStep > 3 || incumbents.some(i => {
    const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
    return s === 'endorsed to dbm ro';
  });
  const isStep4Done = incumbents.some(i => {
    const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
    return s === 'endorsed to dbm ro' && i.new_item_number;
  });

  // Personnel tracked in Tab 4 (Candidates at Endorsed to DBM RO with item)
  const sdoEndorsees = useMemo(() => {
    return incumbents.filter(i => {
      const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
      return ['endorsed to dbm ro', 'endorsed to dbm'].includes(s);
    });
  }, [incumbents]);

  const sdoMetrics = useMemo(() => {
    const total = sdoEndorsees.length;
    const assigned = sdoEndorsees.filter(i => i.new_item_number).length;
    const pending = total - assigned;
    return { total, assigned, pending };
  }, [sdoEndorsees]);

  const sdoDivisions = useMemo(() => {
    const set = new Set();
    sdoEndorsees.forEach(i => {
      const d = i.division || i.station_division;
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [sdoEndorsees]);

  const filteredSdoEndorsees = useMemo(() => {
    return sdoEndorsees.filter(i => {
      if (sdoStatusFilter === 'ASSIGNED' && !i.new_item_number) return false;
      if (sdoStatusFilter === 'PENDING' && i.new_item_number) return false;
      if (sdoDivisionFilter !== 'ALL') {
        const div = (i.division || i.station_division || '').toLowerCase();
        if (!div.includes(sdoDivisionFilter.toLowerCase())) return false;
      }
      if (sdoSearchTerm.trim()) {
        const q = sdoSearchTerm.toLowerCase().trim();
        const name = (i.full_name || '').toLowerCase();
        const oldItem = (i.plantilla_item_number || i.employee_id || '').toLowerCase();
        const newItem = (i.new_item_number || '').toLowerCase();
        const station = (i.station_division || i.division || '').toLowerCase();
        const schoolId = (i.school_id || '').toLowerCase();
        const schoolName = (i.school_name || '').toLowerCase();
        const pos = (i.actual_position || i.reclass_position || i.target_position || i.current_position || '').toLowerCase();
        const serial = (i.nosca_serial_no || '').toLowerCase();
        if (!name.includes(q) && !oldItem.includes(q) && !newItem.includes(q) && !station.includes(q) && !schoolId.includes(q) && !schoolName.includes(q) && !pos.includes(q) && !serial.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [sdoEndorsees, sdoStatusFilter, sdoDivisionFilter, sdoSearchTerm]);

  const pagedSdoEndorsees = useMemo(() => {
    const start = (currentPageSdo - 1) * pageSizeSdo;
    return filteredSdoEndorsees.slice(start, start + pageSizeSdo);
  }, [filteredSdoEndorsees, currentPageSdo, pageSizeSdo]);

  const totalPagesSdo = Math.ceil(filteredSdoEndorsees.length / pageSizeSdo) || 1;

  // Global Escape key listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showIncumbentDocsModal) {
          setShowIncumbentDocsModal(false);
          return;
        }
        if (stationMismatchModal.open) {
          setStationMismatchModal(prev => ({ ...prev, open: false }));
          return;
        }
        if (showAssessmentModal) setShowAssessmentModal(false);
        if (showCsvModal) setShowCsvModal(false);
        if (noscaItemAssignModal.open) setNoscaItemAssignModal({ open: false, personnel: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAssessmentModal, showCsvModal, noscaItemAssignModal, showIncumbentDocsModal, stationMismatchModal.open]);

  const getStageBadge = (rawStage) => {
    const stage = String(rawStage || '').trim().toLowerCase();
    switch (stage) {
      case 'approved':
        return {
          bg: isDark ? 'rgba(6, 95, 70, 0.25)' : '#ECFDF5',
          text: isDark ? '#34d399' : '#065F46',
          border: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
          icon: ''
        };
      case 'endorsed to ro':
      case 'endorsed':
        return {
          bg: isDark ? 'rgba(30, 58, 138, 0.35)' : '#EFF6FF',
          text: isDark ? '#93c5fd' : '#1E40AF',
          border: isDark ? 'rgba(59, 130, 246, 0.4)' : '#BFDBFE',
          icon: ''
        };
      case 'endorsed to dbm ro':
      case 'endorsed to dbm':
        return {
          bg: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF',
          text: isDark ? '#a5b4fc' : '#4338CA',
          border: isDark ? 'rgba(99, 102, 241, 0.4)' : '#C7D2FE',
          icon: ''
        };
      case 'denied':
      case 'ineligible':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2',
          text: isDark ? '#f87171' : '#991B1B',
          border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECACA',
          icon: ''
        };
      case 'unfilled / vacant':
      case 'vacant':
        return {
          bg: isDark ? 'rgba(71, 85, 105, 0.25)' : '#F1F5F9',
          text: isDark ? '#94a3b8' : '#475569',
          border: isDark ? 'rgba(100, 116, 139, 0.4)' : '#CBD5E1',
          icon: ''
        };
      case 'abolition':
        return {
          bg: isDark ? 'rgba(153, 27, 27, 0.25)' : '#FEF2F2',
          text: isDark ? '#fca5a5' : '#991B1B',
          border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#F87171',
          icon: ''
        };
      case 'for review':
      default:
        return {
          bg: isDark ? 'rgba(180, 83, 9, 0.25)' : '#FFFBEB',
          text: isDark ? '#fde68a' : '#92400E',
          border: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A',
          icon: ''
        };
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

  // Add a single Plantilla / Item No manually to active NOSCA batch
  const handleAddManualNoscaItems = (inputString, targetCat, customSerial, customDiv, customSchoolId, customSchoolName, customPosition) => {
    const rawString = inputString !== undefined ? inputString : manualNoscaItemInput;
    const cleanItem = String(rawString || '').trim();

    if (!cleanItem) {
      setToast({ title: 'Item No. Required', message: 'Please enter a Plantilla Item Number.', type: 'error' });
      return;
    }

    // Check if multiple items were entered (comma, newline, or semicolon)
    const tokens = cleanItem.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (tokens.length > 1) {
      setToast({ 
        title: 'Single Item Only', 
        message: 'Only one Plantilla Item Number is allowed per entry. Please enter one item at a time.', 
        type: 'warning' 
      });
      return;
    }

    const itemNo = tokens[0] || cleanItem;
    const cat = targetCat || manualNoscaCategory || 'ELEMENTARY';
    const isJhs = cat === 'JHS';
    const serial = (customSerial !== undefined ? customSerial : manualNoscaSerial).trim() || (scannedNoscaResult?.serial_no || 'MANUAL-NOSCA');
    const div = (customDiv !== undefined ? customDiv : manualNoscaDivision).trim() || (scannedNoscaResult?.division || (sdoDivisionFilter && sdoDivisionFilter !== 'ALL' ? sdoDivisionFilter : 'Regional Scope'));
    const schoolId = isJhs ? ((customSchoolId !== undefined ? customSchoolId : manualNoscaSchoolId) || scannedNoscaResult?.school_id || '') : '';
    const schoolName = isJhs ? ((customSchoolName !== undefined ? customSchoolName : manualNoscaSchoolName) || scannedNoscaResult?.school_name || scannedNoscaResult?.schoolName || '') : '';
    const pos = (customPosition !== undefined ? customPosition : manualNoscaPosition) || (scannedNoscaResult?.position || 'School Counselor I');

    // Track manually added items for visual badges
    setManuallyAddedNoscaItems(prev => {
      const next = new Set(prev);
      next.add(itemNo);
      return next;
    });

    if (!scannedNoscaResult) {
      const breakdown = {
        ELEMENTARY: cat === 'ELEMENTARY' ? [itemNo] : [],
        JHS: cat === 'JHS' ? [itemNo] : [],
        SHS: cat === 'SHS' ? [itemNo] : [],
        ALS: cat === 'ALS' ? [itemNo] : []
      };

      setScannedNoscaResult({
        serial_no: serial,
        fileName: 'Manual Entry',
        division: div,
        school_id: schoolId,
        school_name: schoolName || 'Division / Regional Inventory',
        schoolName: schoolName || 'Division / Regional Inventory',
        position: pos,
        items: [itemNo],
        count: 1,
        category_breakdown: breakdown
      });
      setSelectedNoscaItems([itemNo]);
    } else {
      const existing = scannedNoscaResult.items || [];
      if (existing.includes(itemNo)) {
        setToast({ title: 'Already Exists', message: `Item "${itemNo}" is already in the list.`, type: 'info' });
        return;
      }

      const merged = [...existing, itemNo];
      const newBreakdown = { ...(scannedNoscaResult.category_breakdown || {}) };
      newBreakdown[cat] = [...(newBreakdown[cat] || []), itemNo];

      setScannedNoscaResult(prev => ({
        ...prev,
        serial_no: prev.serial_no || serial,
        division: prev.division || div,
        school_id: isJhs ? (schoolId || prev.school_id) : prev.school_id,
        school_name: isJhs ? (schoolName || prev.school_name || prev.schoolName) : (prev.school_name || prev.schoolName),
        schoolName: isJhs ? (schoolName || prev.schoolName || prev.school_name) : (prev.schoolName || prev.school_name),
        position: pos || prev.position,
        items: merged,
        count: merged.length,
        category_breakdown: newBreakdown
      }));
      setSelectedNoscaItems(prev => [...prev, itemNo]);
    }

    setToast({
      title: 'Plantilla Item Added',
      message: `Successfully added ${itemNo} (${pos}) to the plantilla list.${schoolId ? ` [School ID: ${schoolId}]` : ''}`,
      type: 'success'
    });
    setManualNoscaItemInput('');
    setQuickAddInlineInput('');
    setShowQuickAddInline(false);
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
          schoolId: scannedNoscaResult.school_id || manualNoscaSchoolId || null,
          schoolName: scannedNoscaResult.school_name || scannedNoscaResult.schoolName || manualNoscaSchoolName || null,
          position: scannedNoscaResult.position || manualNoscaPosition || 'School Counselor I',
          items: selectedNoscaItems,
          categoryBreakdown: scannedNoscaResult.category_breakdown
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
                fetchNoscaItems();
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

  // Handle file selection from dropzone or input with Station Mismatch validation
  const handleSelectCsvFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setToast({ message: 'Please select a valid CSV file (.csv)', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content !== 'string') return;

      const storedUserRaw = localStorage.getItem('agap_user');
      let storedUser = null;
      try { storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null; } catch(err) {}

      const rawUserRegion = (user?.region || storedUser?.region || '').trim();
      const rawUserDivision = (user?.division || storedUser?.division || '').trim();

      // Parse CSV lines
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length <= 1) {
        setToast({ message: 'The provided CSV file has no data rows.', type: 'warning' });
        return;
      }

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
      const normHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      const regionIdx = normHeaders.findIndex(h => h.includes('region'));
      const divisionIdx = normHeaders.findIndex(h => h.includes('division'));
      const itemNoIdx = normHeaders.findIndex(h => h.includes('item'));
      const nameIdx = normHeaders.findIndex(h => h.includes('name') || h.includes('first') || h.includes('incumbent'));

      const normalizeStation = (str) => {
        if (!str) return '';
        return String(str)
          .toUpperCase()
          .replace(/DIVISION\s+OF\s+/gi, '')
          .replace(/CITY\s+OF\s+/gi, '')
          .replace(/SDO\s+/gi, '')
          .replace(/[^A-Z0-9]/g, '')
          .trim();
      };

      const normUserDiv = normalizeStation(rawUserDivision);
      const normUserReg = normalizeStation(rawUserRegion);

      const isMatch = (rowVal, normUser) => {
        if (!normUser) return true; // No restriction
        if (!rowVal || !rowVal.trim()) return false;
        const normRow = normalizeStation(rowVal);
        if (normRow === normUser) return true;
        if (normRow.includes(normUser) || normUser.includes(normRow)) return true;
        // Aliases for NCR
        if ((normUser === 'NCR' || normUser.includes('NCR')) && (normRow.includes('NCR') || normRow.includes('NATIONALCAPITAL'))) return true;
        if ((normUser.includes('IVA') || normUser.includes('CALABARZON')) && (normRow.includes('IVA') || normRow.includes('CALABARZON'))) return true;
        return false;
      };

      const mismatches = [];
      const dataRows = lines.slice(1);
      const seenItemNosMap = new Map();

      dataRows.forEach((line, idx) => {
        const cols = parseLine(line);
        // Skip completely empty lines
        if (!cols.some(c => c && c.trim().length > 0)) return;

        const rowReg = regionIdx !== -1 ? cols[regionIdx] : '';
        const rowDiv = divisionIdx !== -1 ? cols[divisionIdx] : '';
        const rawItem = (itemNoIdx !== -1 && cols[itemNoIdx]) ? cols[itemNoIdx].trim() : '';

        // 1. Check for Repeated Item No (item_no must not repeat)
        if (rawItem && rawItem !== '#N/A' && rawItem.toUpperCase() !== 'VACANT') {
          const upperItem = rawItem.toUpperCase();
          if (seenItemNosMap.has(upperItem)) {
            const firstLine = seenItemNosMap.get(upperItem);
            mismatches.push({
              rowNumber: idx + 2,
              itemNo: rawItem,
              name: (nameIdx !== -1 && cols[nameIdx]) ? cols[nameIdx] : '—',
              foundRegion: rowReg || '—',
              foundDivision: rowDiv || '—',
              mismatchType: `Repeated Item No (Duplicate of Line ${firstLine})`
            });
          } else {
            seenItemNosMap.set(upperItem, idx + 2);
          }
        }

        // 2. Check for Station Mismatch
        if (rawUserDivision || rawUserRegion) {
          const regMatches = isMatch(rowReg, normUserReg);
          const divMatches = isMatch(rowDiv, normUserDiv);

          if (!regMatches || !divMatches) {
            mismatches.push({
              rowNumber: idx + 2, // 1-based index (header is line 1)
              itemNo: rawItem || `Row #${idx + 2}`,
              name: (nameIdx !== -1 && cols[nameIdx]) ? cols[nameIdx] : '—',
              foundRegion: rowReg || 'MISSING',
              foundDivision: rowDiv || 'MISSING',
              mismatchType: !divMatches && !regMatches ? 'Region & Division' : (!divMatches ? 'Division' : 'Region')
            });
          }
        }
      });

      if (mismatches.length > 0) {
        const hasDups = mismatches.some(m => m.mismatchType?.includes('Repeated'));
        const hasStation = mismatches.some(m => !m.mismatchType?.includes('Repeated'));

        // Open Validation Error Popup Modal
        setStationMismatchModal({
          open: true,
          fileName: selectedFile.name,
          expectedRegion: rawUserRegion || 'Assigned Region',
          expectedDivision: rawUserDivision || 'Assigned Division',
          mismatches,
          totalRows: dataRows.length,
          mismatchCount: mismatches.length,
          hasDuplicateItems: hasDups,
          hasStationMismatch: hasStation
        });

        // Reset file state so dropzone is immediately ready for redrag/redrop
        setCsvFile(null);
        setCsvFileName('');
        setCsvContent('');
        setCsvPreviewRows([]);
        setCsvTotalRowsCount(0);
        const fileInput = document.getElementById('step1-reclass-csv-input');
        if (fileInput) fileInput.value = '';

        setToast({
          message: hasDups 
            ? `Validation failed: ${mismatches.length} issue(s) detected (duplicate item numbers or station mismatches).`
            : `Station mismatch: ${mismatches.length} record(s) do not match your assigned division.`,
          type: 'error'
        });
        return;
      }

      // If all rows match, load into preview
      setCsvFile(selectedFile);
      setCsvFileName(selectedFile.name);
      setUploadStats(null);
      setCsvContent(content);
      const { rows, totalCount } = parseCsvPreview(content);
      setCsvPreviewRows(rows);
      setCsvTotalRowsCount(totalCount);
      setToast({ message: `CSV validated: ${totalCount} records match your station.`, type: 'success' });
    };
    reader.readAsText(selectedFile);
  };

  // Handle Download CSV Template
  const handleDownloadCsvTemplate = () => {
    try {
      const token = localStorage.getItem('agap_token') || localStorage.getItem('deped_token') || sessionStorage.getItem('agap_token') || '';
      
      const storedUserRaw = localStorage.getItem('agap_user');
      let storedUser = null;
      try { storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null; } catch(e) {}

      const userRegion = (user?.region || storedUser?.region || '').trim();
      const userDivision = (user?.division || storedUser?.division || '').trim();

      const queryParams = new URLSearchParams();
      if (token) queryParams.append('token', token);
      if (userRegion) queryParams.append('region', userRegion);
      if (userDivision) queryParams.append('division', userDivision);

      const downloadUrl = `/api/reclassification/template-csv?${queryParams.toString()}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'DepEd GC Reclassification Template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToast({ message: 'Downloading DepEd GC Reclassification Template...', type: 'info' });
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

      // Extract all added items from the uploaded CSV rows
      const lines = (csvContent || '').split(/\r?\n/).filter(l => l.trim().length > 0);
      let itemsList = [];
      if (lines.length > 1) {
        const parseLine = (line) => {
          const result = [];
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
              result.push(cur.trim());
              cur = '';
            } else {
              cur += c;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const headers = parseLine(lines[0]);
        const normHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const itemIdx = normHeaders.findIndex(h => h.includes('item'));
        const fNameIdx = normHeaders.findIndex(h => h === 'firstname' || h === 'fname' || (h.includes('first') && !h.includes('school')));
        const lNameIdx = normHeaders.findIndex(h => h === 'lastname' || h === 'lname' || h.includes('surname') || (h.includes('last') && !h.includes('school')));
        const directNameIdx = normHeaders.findIndex(h => (h.includes('incumbent') || h.includes('fullname') || h === 'name') && !h.includes('school') && !h.includes('first') && !h.includes('last'));
        const posIdx = normHeaders.findIndex(h => h.includes('currentposition') || (h.includes('position') && !h.includes('target') && !h.includes('reclass')));
        const targetIdx = normHeaders.findIndex(h => h.includes('reclassposition') || h.includes('targetpos') || h.includes('reclass') || h.includes('target'));
        const schoolIdx = normHeaders.findIndex(h => h.includes('schoolname') || (h.includes('school') && !h.includes('id')));
        const divIdx = normHeaders.findIndex(h => h.includes('division'));

        itemsList = lines.slice(1).map((line, idx) => {
          const cols = parseLine(line);
          if (!cols.some(c => c && c.trim())) return null;

          let fullName = '';
          const f = fNameIdx !== -1 && cols[fNameIdx] ? cols[fNameIdx].trim() : '';
          const l = lNameIdx !== -1 && cols[lNameIdx] ? cols[lNameIdx].trim() : '';
          if (f && l) {
            fullName = `${f} ${l}`.trim();
          } else if (f || l) {
            fullName = (f || l).trim();
          } else if (directNameIdx !== -1 && cols[directNameIdx]) {
            fullName = cols[directNameIdx].trim();
          }

          if (!fullName) fullName = '—';

          return {
            rowNumber: idx + 1,
            itemNo: itemIdx !== -1 && cols[itemIdx] ? cols[itemIdx].trim() : `Item #${idx + 1}`,
            name: fullName,
            currentPosition: posIdx !== -1 && cols[posIdx] ? cols[posIdx].trim() : '—',
            targetPosition: targetIdx !== -1 && cols[targetIdx] ? cols[targetIdx].trim() : 'For Review',
            schoolName: schoolIdx !== -1 && cols[schoolIdx] ? cols[schoolIdx].trim() : '',
            division: divIdx !== -1 && cols[divIdx] ? cols[divIdx].trim() : ''
          };
        }).filter(Boolean);
      }

      // Open Ingestion Success Popup Modal with full added items list
      setIngestionSuccessModal({
        open: true,
        fileName: csvFileName || 'DepEd GC Reclassification Inventory.csv',
        insertedOrUpdated: res.insertedOrUpdated || csvTotalRowsCount || itemsList.length || 0,
        totalInDatabase: res.totalInDatabase || 0,
        metrics: res.metrics || null,
        addedItems: itemsList,
        message: res.message || 'All items have been added successfully!'
      });

      // Reset file and preview state so the file preview no longer persists after ingestion
      setCsvFile(null);
      setCsvFileName('');
      setCsvContent('');
      setCsvPreviewRows([]);
      setCsvTotalRowsCount(0);
      const fileInput = document.getElementById('step1-reclass-csv-input');
      if (fileInput) fileInput.value = '';

      setToast({
        title: 'Ingestion Completed',
        message: res.message || `All ${res.insertedOrUpdated || itemsList.length || 0} items added successfully!`,
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
            Pending CSC Re-eval
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
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
          borderRadius: '14px',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
          padding: '8px 12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: isDark ? '0 6px 20px rgba(0, 0, 0, 0.3)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          overflow: 'hidden',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Step 1: Inventory Ingestion */}
          <div
            className="reclass-stepper-btn"
            onClick={() => handleStepClick(1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: currentStep === 1
                ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                : (currentStep > 1 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc') : 'transparent'),
              border: currentStep === 1
                ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #93c5fd')
                : (currentStep > 1 ? (isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe') : (isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)')),
              boxShadow: currentStep === 1
                ? (isDark ? '0 0 14px rgba(59, 130, 246, 0.25)' : '0 2px 8px rgba(37, 99, 235, 0.15)')
                : 'none',
              transform: currentStep === 1 ? 'translateY(-1px)' : 'translateY(0)',
              opacity: 1,
              flex: '1 1 0',
              minWidth: 0,
              userSelect: 'none'
            }}
          >
            <div
              className="reclass-stepper-badge"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: currentStep === 1
                  ? '#2563eb'
                  : (currentStep > 1 ? '#2563eb' : (isDark ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0')),
                backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.08) 100%)',
                color: currentStep >= 1 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px',
                boxShadow: currentStep === 1
                  ? (isDark ? '0 0 12px rgba(59, 130, 246, 0.5), 0 0 0 2.5px rgba(59, 130, 246, 0.25)' : '0 3px 10px rgba(37, 99, 235, 0.35), 0 0 0 2.5px rgba(59, 130, 246, 0.25)')
                  : 'none',
                transform: currentStep === 1 ? 'scale(1.05)' : 'scale(1)',
                flexShrink: 0
              }}
            >
              1
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: currentStep === 1 ? (isDark ? '#60a5fa' : '#1d4ed8') : (currentStep > 1 ? (isDark ? '#f8fafc' : '#1e293b') : (isDark ? '#94a3b8' : '#64748b')),
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Inventory Ingestion</span>
                {isRegionalOffice && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                    color: isDark ? '#a5b4fc' : '#4338ca',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #c7d2fe',
                    flexShrink: 0
                  }}>
                    👁️ View Only
                  </span>
                )}
              </div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '10px',
                  color: currentStep === 1 ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--muted)',
                  fontWeight: 500,
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {isRegionalOffice ? 'Master Inventory' : (isStep1Done ? `${incumbents.length} Loaded` : 'Inventory Sync')}
              </div>
            </div>
          </div>

          {/* Connector Line 1 -> 2 */}
          <div style={{
            width: '20px',
            minWidth: '10px',
            height: '3px',
            borderRadius: '999px',
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 1,
            transition: 'background-color 0.38s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div
              className="reclass-stepper-line"
              style={{
                height: '100%',
                width: currentStep >= 2 ? '100%' : '0%',
                background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                boxShadow: currentStep >= 2 ? '0 0 6px rgba(59, 130, 246, 0.45)' : 'none',
                borderRadius: '999px'
              }}
            />
          </div>

          {/* Step 2: Assessment Workbench */}
          <div
            className="reclass-stepper-btn"
            onClick={() => handleStepClick(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: currentStep === 2
                ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                : (currentStep > 2 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc') : 'transparent'),
              border: currentStep === 2
                ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #93c5fd')
                : (currentStep > 2 ? (isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe') : (isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)')),
              boxShadow: currentStep === 2
                ? (isDark ? '0 0 14px rgba(59, 130, 246, 0.25)' : '0 2px 8px rgba(37, 99, 235, 0.15)')
                : 'none',
              transform: currentStep === 2 ? 'translateY(-1px)' : 'translateY(0)',
              opacity: 1,
              flex: '1 1 0',
              minWidth: 0,
              userSelect: 'none'
            }}
          >
            <div
              className="reclass-stepper-badge"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: currentStep === 2
                  ? '#2563eb'
                  : (currentStep > 2 ? '#2563eb' : (isDark ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0')),
                backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.08) 100%)',
                color: currentStep >= 2 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px',
                boxShadow: currentStep === 2
                  ? (isDark ? '0 0 12px rgba(59, 130, 246, 0.5), 0 0 0 2.5px rgba(59, 130, 246, 0.25)' : '0 3px 10px rgba(37, 99, 235, 0.35), 0 0 0 2.5px rgba(59, 130, 246, 0.25)')
                  : 'none',
                transform: currentStep === 2 ? 'scale(1.05)' : 'scale(1)',
                flexShrink: 0
              }}
            >
              2
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: currentStep === 2 ? (isDark ? '#60a5fa' : '#1d4ed8') : (currentStep > 2 ? (isDark ? '#f8fafc' : '#1e293b') : (isDark ? '#94a3b8' : '#64748b')),
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Assessment Workbench</span>
                {isRegionalOffice && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                    color: isDark ? '#a5b4fc' : '#4338ca',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #c7d2fe',
                    flexShrink: 0
                  }}>
                    👁️ View Only
                  </span>
                )}
              </div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '10px',
                  color: currentStep === 2 ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--muted)',
                  fontWeight: 500,
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {isRegionalOffice ? 'Assessments & Stages' : (isStep2Done ? 'Decisions Done' : 'Progression & Decisions')}
              </div>
            </div>
          </div>

          {/* Connector Line 2 -> 3 */}
          <div style={{
            width: '20px',
            minWidth: '10px',
            height: '3px',
            borderRadius: '999px',
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 1,
            transition: 'background-color 0.38s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div
              className="reclass-stepper-line"
              style={{
                height: '100%',
                width: currentStep >= 3 ? '100%' : '0%',
                background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                boxShadow: currentStep >= 3 ? '0 0 6px rgba(59, 130, 246, 0.45)' : 'none',
                borderRadius: '999px'
              }}
            />
          </div>

          {/* Step 3: DBM Endorsement */}
          <div
            className="reclass-stepper-btn"
            onClick={() => handleStepClick(3)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: currentStep === 3
                ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                : (currentStep > 3 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc') : 'transparent'),
              border: currentStep === 3
                ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #93c5fd')
                : (currentStep > 3 ? (isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe') : (isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)')),
              boxShadow: currentStep === 3
                ? (isDark ? '0 0 14px rgba(59, 130, 246, 0.25)' : '0 2px 8px rgba(37, 99, 235, 0.15)')
                : 'none',
              transform: currentStep === 3 ? 'translateY(-1px)' : 'translateY(0)',
              opacity: 1,
              flex: '1 1 0',
              minWidth: 0,
              userSelect: 'none'
            }}
          >
            <div
              className="reclass-stepper-badge"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: currentStep === 3
                  ? '#2563eb'
                  : (currentStep > 3 ? '#2563eb' : (isDark ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0')),
                backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.08) 100%)',
                color: currentStep >= 3 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px',
                boxShadow: currentStep === 3
                  ? (isDark ? '0 0 12px rgba(59, 130, 246, 0.5), 0 0 0 2.5px rgba(59, 130, 246, 0.25)' : '0 3px 10px rgba(37, 99, 235, 0.35), 0 0 0 2.5px rgba(59, 130, 246, 0.25)')
                  : 'none',
                transform: currentStep === 3 ? 'scale(1.05)' : 'scale(1)',
                flexShrink: 0
              }}
            >
              3
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: currentStep === 3 ? (isDark ? '#60a5fa' : '#1d4ed8') : (currentStep > 3 ? (isDark ? '#f8fafc' : '#1e293b') : (isDark ? '#94a3b8' : '#64748b')),
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>DBM Endorsement</span>
                {isRegionalOffice && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                    color: isDark ? '#6ee7b7' : '#059669',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #bbf7d0',
                    flexShrink: 0
                  }}>
                    RO Action
                  </span>
                )}
              </div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '10px',
                  color: currentStep === 3 ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--muted)',
                  fontWeight: 500,
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {isStep3Done ? 'Transmittal Ready' : (isRegionalOffice ? 'NOSCA & Endorsement' : 'DBM Spreadsheet')}
              </div>
            </div>
          </div>

          {/* Connector Line 3 -> 4 */}
          <div style={{
            width: '20px',
            minWidth: '10px',
            height: '3px',
            borderRadius: '999px',
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 1,
            transition: 'background-color 0.38s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div
              className="reclass-stepper-line"
              style={{
                height: '100%',
                width: currentStep >= 4 ? '100%' : '0%',
                background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                boxShadow: currentStep >= 4 ? '0 0 6px rgba(59, 130, 246, 0.45)' : 'none',
                borderRadius: '999px'
              }}
            />
          </div>

          {/* Step 4: NOSCA & Item Tracking */}
          <div
            className="reclass-stepper-btn"
            onClick={() => handleStepClick(4)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: currentStep === 4
                ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff')
                : (currentStep > 4 ? (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc') : 'transparent'),
              border: currentStep === 4
                ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #93c5fd')
                : (currentStep > 4 ? (isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #bfdbfe') : (isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)')),
              boxShadow: currentStep === 4
                ? (isDark ? '0 0 14px rgba(59, 130, 246, 0.25)' : '0 2px 8px rgba(37, 99, 235, 0.15)')
                : 'none',
              transform: currentStep === 4 ? 'translateY(-1px)' : 'translateY(0)',
              opacity: 1,
              flex: '1 1 0',
              minWidth: 0,
              userSelect: 'none'
            }}
          >
            <div
              className="reclass-stepper-badge"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: currentStep === 4
                  ? '#2563eb'
                  : (isDark ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0'),
                backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.08) 100%)',
                color: currentStep === 4 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px',
                boxShadow: currentStep === 4
                  ? (isDark ? '0 0 12px rgba(59, 130, 246, 0.5), 0 0 0 2.5px rgba(59, 130, 246, 0.25)' : '0 3px 10px rgba(37, 99, 235, 0.35), 0 0 0 2.5px rgba(59, 130, 246, 0.25)')
                  : 'none',
                transform: currentStep === 4 ? 'scale(1.05)' : 'scale(1)',
                flexShrink: 0
              }}
            >
              4
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: currentStep === 4 ? (isDark ? '#60a5fa' : '#1d4ed8') : (isDark ? '#94a3b8' : '#64748b'),
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>NOSCA & Item Tracking</span>
                {isRegionalOffice && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                    color: isDark ? '#a5b4fc' : '#4338ca',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #c7d2fe',
                    flexShrink: 0
                  }}>
                    👁️ View Only
                  </span>
                )}
              </div>
              <div
                className="reclass-stepper-text"
                style={{
                  fontSize: '10px',
                  color: currentStep === 4 ? (isDark ? '#93c5fd' : '#2563eb') : 'var(--muted)',
                  fontWeight: 500,
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {isRegionalOffice ? 'SDO Item Registry' : (isStep4Done ? `${sdoMetrics.assigned}/${sdoMetrics.total} Linked` : 'Endorsed Items')}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 1 VIEW: INVENTORY & CSV INGESTION */}
        {currentStep === 1 && (
          <div className="reclass-step-content-anim" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

              {/* Drag & Drop Area / View-Only Display */}
              {isRegionalOffice ? (
                <div style={{
                  border: isDark ? '1.5px dashed rgba(99, 102, 241, 0.4)' : '1.5px dashed #c7d2fe',
                  borderRadius: '14px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: isDark ? 'rgba(30, 41, 59, 0.35)' : '#f8fafc'
                }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                    color: isDark ? '#a5b4fc' : '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    fontSize: '24px'
                  }}>
                    📋
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 750, color: isDark ? '#f8fafc' : '#0f172a', marginBottom: '4px' }}>
                    CSV Ingestion & Uploads Managed by Division HRMO
                  </div>
                  <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b', maxWidth: '520px', margin: '0 auto' }}>
                    Regional Office accounts have view-only access to monitor loaded records and preview CSV structure. File uploads and master database mutations are restricted to Division HRMO officers.
                  </div>
                </div>
              ) : (
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
              )}

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
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>School</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Reclassification Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.map((row, idx) => {
                          const itemNo = row['PLANTILLA ITEM NUMBER'] || row['Plantilla Item Number'] || row['item_no'] || Object.values(row)[4] || '—';
                          const name = extractIncumbentName(row);
                          const pos = row['POSITION TITLE'] || row['Position Title'] || row['current_position'] || Object.values(row)[5] || '—';
                          const division = row['DIVISION'] || row['Division'] || row['division'] || Object.values(row)[1] || '—';
                          const schoolId = row['SCHOOL ID'] || row['School ID'] || row['school_id'] || row['schoolid'] || '—';
                          const schoolName = row['SCHOOL NAME'] || row['School Name'] || row['school_name'] || row['UACS_OPER_DSC'] || '—';
                          const target = row['RECLASS POSITION'] || row['Reclass Position'] || row['reclass_position'] || Object.values(row)[8] || 'For Review';

                          return (
                            <tr key={idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 650, color: isDark ? '#f8fafc' : '#0f172a' }}>{itemNo}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#cbd5e1' : '#334155' }}>
                                {name === '#N/A' ? <em style={{ color: '#94a3b8' }}>Unfilled / Vacant</em> : name}
                              </td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{pos}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{division}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155' }}>{schoolName}</div>
                                {schoolId !== '—' && (
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: 750,
                                    fontFamily: 'monospace',
                                    color: isDark ? '#38bdf8' : '#0369a1',
                                    background: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe',
                                    border: isDark ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid #bae6fd',
                                    padding: '1.5px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                    marginTop: '2px'
                                  }}>
                                    {schoolId}
                                  </span>
                                )}
                              </td>
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
                  padding: '20px 22px',
                  borderRadius: '16px',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                    : 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0',
                  boxShadow: isDark
                    ? '0 8px 32px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                    : '0 8px 30px -6px rgba(16, 185, 129, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  backdropFilter: 'blur(10px)'
                }}>
                  {/* Banner Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7',
                        color: isDark ? '#34d399' : '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: isDark ? '0 0 16px rgba(16, 185, 129, 0.2)' : 'none'
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                            color: isDark ? '#6ee7b7' : '#047857'
                          }}>
                            Ingestion Successful
                          </span>
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 650,
                          color: isDark ? '#f1f5f9' : '#0f172a',
                          lineHeight: 1.4
                        }}>
                          {uploadStats.message}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.35)';
                      }}
                    >
                      <span>Open Step 2: Assessment Workbench</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>

                  {/* Upgraded Modern KPI Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px'
                  }}>
                    {/* Card 1: Total Incumbents */}
                    <div style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                      border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #e2e8f0',
                      borderLeft: '4px solid #3b82f6',
                      boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '11px',
                          color: isDark ? '#94a3b8' : '#64748b',
                          textTransform: 'uppercase',
                          fontWeight: 750,
                          letterSpacing: '0.04em'
                        }}>
                          Total Incumbents
                        </span>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                          color: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        color: isDark ? '#f8fafc' : '#0f172a',
                        lineHeight: 1
                      }}>
                        {uploadStats.totalInDatabase || uploadStats.insertedOrUpdated}
                      </div>
                      <div style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: isDark ? '#60a5fa' : '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>Active in Database</span>
                      </div>
                    </div>

                    {/* Card 2: For Review */}
                    {uploadStats.metrics && (
                      <div style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                        border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #e2e8f0',
                        borderLeft: '4px solid #f59e0b',
                        boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '11px',
                            color: isDark ? '#94a3b8' : '#64748b',
                            textTransform: 'uppercase',
                            fontWeight: 750,
                            letterSpacing: '0.04em'
                          }}>
                            For Review
                          </span>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbeb',
                            color: '#f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 800,
                          color: '#f59e0b',
                          lineHeight: 1
                        }}>
                          {uploadStats.metrics.forReview}
                        </div>
                        <div style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: isDark ? '#fbbf24' : '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>Ready for QS Eval (Step 2)</span>
                        </div>
                      </div>
                    )}

                    {/* Card 3: Vacant / Unfilled */}
                    {uploadStats.metrics && (
                      <div style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                        border: isDark ? '1px solid rgba(100, 116, 139, 0.3)' : '1px solid #e2e8f0',
                        borderLeft: '4px solid #64748b',
                        boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '11px',
                            color: isDark ? '#94a3b8' : '#64748b',
                            textTransform: 'uppercase',
                            fontWeight: 750,
                            letterSpacing: '0.04em'
                          }}>
                            Vacant / Unfilled
                          </span>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: isDark ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="8.5" cy="7" r="4" />
                              <line x1="18" y1="8" x2="23" y2="13" />
                              <line x1="23" y1="8" x2="18" y2="13" />
                            </svg>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 800,
                          color: isDark ? '#94a3b8' : '#64748b',
                          lineHeight: 1
                        }}>
                          {uploadStats.metrics.vacant}
                        </div>
                        <div style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: isDark ? '#94a3b8' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>Unassigned Items</span>
                        </div>
                      </div>
                    )}

                    {/* Card 4: Abolition */}
                    {uploadStats.metrics && (
                      <div style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                        border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #e2e8f0',
                        borderLeft: '4px solid #ef4444',
                        boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '11px',
                            color: isDark ? '#94a3b8' : '#64748b',
                            textTransform: 'uppercase',
                            fontWeight: 750,
                            letterSpacing: '0.04em'
                          }}>
                            Abolition
                          </span>
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 800,
                          color: '#ef4444',
                          lineHeight: 1
                        }}>
                          {uploadStats.metrics.abolition}
                        </div>
                        <div style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: isDark ? '#f87171' : '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>Marked for Phaseout</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Execution Action Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                {!isRegionalOffice && (
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
                )}

                {(isStep1Done || isRegionalOffice) && (
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
              Endorsed to RO
            </div>
            <div style={{ fontSize: '30px', fontWeight: 850, color: isDark ? '#93c5fd' : '#1e40af', margin: '6px 0 2px' }}>
              {incumbentMetrics.endorsedToRO}
            </div>
            <div style={{ fontSize: '12px', color: isDark ? '#60a5fa' : '#2563eb' }}>
              Endorsed to Regional Office
            </div>
          </div>

          <div className="card" style={{
            background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
            padding: '18px 22px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.03)',
            borderLeft: isDark ? '4px solid #6366f1' : '4px solid #4f46e5'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#a5b4fc' : '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Endorsed to DBM RO
            </div>
            <div style={{ fontSize: '30px', fontWeight: 850, color: isDark ? '#c7d2fe' : '#312e81', margin: '6px 0 2px' }}>
              {incumbentMetrics.endorsedToDbm}
            </div>
            <div style={{ fontSize: '12px', color: isDark ? '#a5b4fc' : '#4f46e5' }}>Endorsed to DBM Regional Office</div>
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
                {ALL_RECLASS_STAGES.map(s => (
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
                <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>All Actual Reclassification Positions</option>
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
                  <th style={{ padding: '14px 18px', minWidth: '180px', whiteSpace: 'nowrap', textAlign: 'left' }}>Division & Region</th>
                  <th style={{ padding: '14px 18px', minWidth: '240px', whiteSpace: 'nowrap', textAlign: 'left' }}>School</th>
                  <th style={{ padding: '14px 18px', minWidth: '170px', whiteSpace: 'nowrap', textAlign: 'left' }}>Stage of Reclassification</th>
                  <th style={{ padding: '14px 18px', minWidth: '220px', whiteSpace: 'nowrap', textAlign: 'left' }}>Actual Reclassification Position</th>
                  <th style={{ padding: '14px 18px', minWidth: '210px', whiteSpace: 'nowrap', textAlign: 'left' }}>Credentials Overview</th>
                </tr>
              </thead>
              <tbody>
                {loadingIncumbents ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #94a3b8)' }}>
                      Loading incumbent guidance counselors...
                    </td>
                  </tr>
                ) : pagedIncumbents.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #94a3b8)' }}>
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
                          {inc.full_name === '#N/A' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
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
                            </div>
                          )}
                          <div style={{ fontWeight: 750, color: inc.full_name === '#N/A' ? 'var(--muted)' : 'var(--text)', fontSize: '13.5px' }}>
                            {inc.full_name === '#N/A' ? 'Unassigned Plantilla' : inc.full_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{inc.plantilla_item_number || inc.employee_id}</span>
                            {inc.new_item_number && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                                color: isDark ? '#6ee7b7' : '#166534',
                                border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #86efac',
                                letterSpacing: '0.02em',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <span style={{ opacity: 0.75, fontWeight: 700 }}>NEW:</span>
                                {inc.new_item_number}
                              </span>
                            )}
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
                        {/* Division & Region */}
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 650, color: 'var(--text)', fontSize: '12.5px' }}>
                            {inc.division || inc.station_division || '—'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                            {inc.region || '—'}
                          </div>
                        </td>
                        {/* Combined School (Name & ID) */}
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px', lineHeight: '1.35' }}>
                            {inc.school_name || inc.uacs_oper_dsc || inc.station_division || '—'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {inc.school_id ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 750,
                                fontFamily: 'monospace',
                                color: isDark ? '#38bdf8' : '#0369a1',
                                background: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe',
                                border: isDark ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid #bae6fd',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                display: 'inline-block'
                              }}>
                                {inc.school_id}
                              </span>
                            ) : null}
                            {inc.org_cd && (
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
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '5px 12px',
                              borderRadius: '8px',
                              border: `1.5px solid ${badgeStyle.border}`,
                              background: badgeStyle.bg,
                              color: badgeStyle.text,
                              fontSize: '12px',
                              fontWeight: 750,
                              letterSpacing: '0.01em',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                            }}
                          >
                            {inc.stage_of_reclassification || 'For Review'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {(() => {
                              const pos = inc.actual_position || inc.reclass_position || inc.target_position;
                              if (pos) {
                                return (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      width: 'fit-content',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                                      color: isDark ? '#6ee7b7' : '#047857',
                                      border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                                      fontSize: '11.5px',
                                      fontWeight: 750,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {pos}
                                  </span>
                                );
                              }
                              return (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    width: 'fit-content',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: isDark ? 'rgba(51, 65, 85, 0.3)' : '#f8fafc',
                                    color: 'var(--text-secondary, #94a3b8)',
                                    border: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid var(--line)',
                                    fontSize: '11.5px',
                                    fontWeight: 650,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  — Unassigned —
                                </span>
                              );
                            })()}
                            {inc.remarks && !['CTI', 'Reclassification'].includes(inc.remarks.trim()) && (
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic' }}>
                                {inc.remarks}
                              </span>
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
                                {inc.qs_eval_result && (
                                  <div style={{ marginBottom: '2px' }}>
                                    <span style={{
                                      fontSize: '10px',
                                      fontWeight: 850,
                                      padding: '2px 7px',
                                      borderRadius: '5px',
                                      letterSpacing: '0.03em',
                                      background: inc.qs_eval_result === 'QUALIFIED'
                                        ? (isDark ? 'rgba(6, 78, 59, 0.45)' : '#ecfdf5')
                                        : inc.qs_eval_result === 'NOT QUALIFIED'
                                          ? (isDark ? 'rgba(127, 29, 29, 0.45)' : '#fef2f2')
                                          : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9'),
                                      color: inc.qs_eval_result === 'QUALIFIED'
                                        ? (isDark ? '#6ee7b7' : '#047857')
                                        : inc.qs_eval_result === 'NOT QUALIFIED'
                                          ? (isDark ? '#fca5a5' : '#b91c1c')
                                          : 'var(--text-secondary, #94a3b8)',
                                      border: inc.qs_eval_result === 'QUALIFIED'
                                        ? (isDark ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid #a7f3d0')
                                        : inc.qs_eval_result === 'NOT QUALIFIED'
                                          ? (isDark ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #fca5a5')
                                          : '1px solid var(--line)'
                                    }}>
                                      {inc.qs_eval_result === 'QUALIFIED' ? '✓ QS Qualified' : inc.qs_eval_result === 'NOT QUALIFIED' ? '✗ QS Not Qualified' : 'QS Pending'}
                                    </span>
                                  </div>
                                )}
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
                background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
                border: isDark ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #c7d2fe'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#a5b4fc' : '#4338ca', textTransform: 'uppercase' }}>
                  Endorsed to DBM RO
                </div>
                <div style={{ fontSize: '28px', fontWeight: 850, color: isDark ? '#c7d2fe' : '#312e81', margin: '4px 0 2px' }}>
                  {incumbentMetrics.endorsedToDbm}
                </div>
                <div style={{ fontSize: '11.5px', color: isDark ? '#a5b4fc' : '#4f46e5' }}>Endorsed for DBM transmittal</div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Endorsed Counselors for DBM Transmittal
                </h3>
                <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                  {incumbents.filter(i => {
                    const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
                    return ['endorsed to ro', 'endorsed to dbm ro', 'endorsed'].includes(s);
                  }).length} candidates
                </span>
              </div>
              {canEndorseToDbm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmEndorseModal({ open: true, counselor: null, isBulk: true })}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <span>Endorse All to DBM RO ({incumbents.filter(i => {
                        const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
                        return s === 'endorsed to ro' || s === 'endorsed';
                      }).length})</span>
                    </button>

                    
                  </div>
                )}
            </div>

            <div style={{
              overflowX: 'auto',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
              borderRadius: '12px'
            }}>
              <table style={{ width: '100%', minWidth: '1350px', tableLayout: 'auto', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569', minWidth: '220px', whiteSpace: 'nowrap' }}>Plantilla Item & Current Position</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569', minWidth: '180px', whiteSpace: 'nowrap' }}>Incumbent Name</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569', minWidth: '240px', whiteSpace: 'nowrap' }}>Actual Reclassification Position</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569', minWidth: '150px', whiteSpace: 'nowrap' }}>Division</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569', minWidth: '200px', whiteSpace: 'nowrap' }}>School</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569', minWidth: '180px', whiteSpace: 'nowrap' }}>Stage</th>
                    {canEndorseToDbm && (
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569', minWidth: '180px', whiteSpace: 'nowrap' }}>Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {incumbents
                    .filter(i => {
                      const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
                      return ['endorsed to ro', 'endorsed to dbm ro', 'endorsed'].includes(s);
                    })
                    .slice(0, 15)
                    .map((counselor, idx) => {
                      const badge = getStageBadge(counselor.stage_of_reclassification);
                      return (
                        <tr key={counselor.id || idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 750, color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'monospace', fontSize: '12.5px' }}>
                                  {counselor.plantilla_item_number || counselor.employee_id}
                                </span>
                                {(counselor.nosca_serial_no || counselor.new_item_number) && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    width: 'fit-content',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                                    color: isDark ? '#6ee7b7' : '#059669',
                                    border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    ✓ NOSCA Assigned
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 650 }}>
                                {counselor.current_position || '—'}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: isDark ? '#cbd5e1' : '#334155', fontWeight: 700, whiteSpace: 'nowrap' }}>{counselor.full_name}</td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 750,
                              background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                              color: isDark ? '#93c5fd' : '#1d4ed8',
                              whiteSpace: 'nowrap'
                            }}>
                              {counselor.actual_position || counselor.target_position || counselor.reclass_position || 'School Counselor'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: isDark ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>{counselor.division || counselor.station_division || '—'}</td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155' }}>
                              {counselor.school_name || counselor.station_division || '—'}
                            </div>
                            {counselor.school_id && counselor.school_id !== '—' && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 750,
                                fontFamily: 'monospace',
                                color: isDark ? '#38bdf8' : '#0369a1',
                                background: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe',
                                border: isDark ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid #bae6fd',
                                padding: '1.5px 5px',
                                borderRadius: '4px',
                                display: 'inline-block',
                                marginTop: '2px',
                                whiteSpace: 'nowrap'
                              }}>
                                {counselor.school_id}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 750,
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              whiteSpace: 'nowrap',
                              letterSpacing: '0.01em'
                            }}>
                              {badge.icon ? `${badge.icon} ` : ''}{counselor.stage_of_reclassification}
                            </span>
                          </td>
                          {canEndorseToDbm && (
                            <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {['endorsed to ro', 'endorsed'].includes(String(counselor.stage_of_reclassification || '').trim().toLowerCase()) ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmEndorseModal({ open: true, counselor, isBulk: false });
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                                      border: 'none',
                                      color: '#ffffff',
                                      fontSize: '11px',
                                      fontWeight: 750,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Endorse this candidate to DBM Regional Office"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M22 2L11 13" />
                                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                    <span>Endorse to DBM RO</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmRevertModal({ open: true, counselor, targetStage: 'For Review' });
                                    }}
                                    style={{
                                      padding: '6px 11px',
                                      borderRadius: '8px',
                                      background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                                      border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
                                      color: isDark ? '#fca5a5' : '#b91c1c',
                                      fontSize: '11px',
                                      fontWeight: 750,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Revert endorsement back to SDO (For Review)"
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="1 4 1 10 7 10" />
                                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                    </svg>
                                    <span>Revert Endorsement</span>
                                  </button>
                                </div>
                              ) : ['endorsed to dbm ro', 'endorsed to dbm'].includes(String(counselor.stage_of_reclassification || '').trim().toLowerCase()) ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmRevertModal({ open: true, counselor, targetStage: 'Endorsed to RO' });
                                  }}
                                  style={{
                                    padding: '6px 11px',
                                    borderRadius: '8px',
                                    background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                                    border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
                                    color: isDark ? '#fca5a5' : '#b91c1c',
                                    fontSize: '11px',
                                    fontWeight: 750,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Revert DBM transmission back to Regional Review (Endorsed to RO)"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="1 4 1 10 7 10" />
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                  </svg>
                                  <span>Revert Endorsement</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  {incumbents.filter(i => {
                    const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
                    return ['endorsed to ro', 'endorsed to dbm ro', 'endorsed'].includes(s);
                  }).length === 0 && (
                    <tr>
                      <td colSpan={canEndorseToDbm ? 7 : 6} style={{ padding: '24px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
                        No counselors have been marked as Endorsed yet. Move candidates to Endorsed in Step 2.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Navigation Back & Next */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '10px' }}>
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
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Return to Step 2: Assessment Workbench
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                <span>Proceed to Step 4: NOSCA & Item Tracking</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 VIEW: NOSCA UPLOAD & SDO ITEM NUMBER TRACKING */}
      {currentStep === 4 && (
        <NoscaItemTrackingTab
          incumbents={incumbents}
          sdoEndorsees={sdoEndorsees}
          sdoMetrics={sdoMetrics}
          filteredSdoEndorsees={filteredSdoEndorsees}
          pagedSdoEndorsees={pagedSdoEndorsees}
          totalPagesSdo={totalPagesSdo}
          currentPageSdo={currentPageSdo}
          setCurrentPageSdo={setCurrentPageSdo}
          pageSizeSdo={pageSizeSdo}
          setPageSizeSdo={setPageSizeSdo}
          sdoSearchTerm={sdoSearchTerm}
          setSdoSearchTerm={setSdoSearchTerm}
          sdoStatusFilter={sdoStatusFilter}
          setSdoStatusFilter={setSdoStatusFilter}
          sdoDivisionFilter={sdoDivisionFilter}
          setSdoDivisionFilter={setSdoDivisionFilter}
          sdoDivisions={sdoDivisions}
          noscaDocuments={noscaDocuments}
          loadingNoscaDocs={loadingNoscaDocs}
          uploadingNoscaDoc={uploadingNoscaDoc}
          onDirectNoscaUpload={handleDirectNoscaUpload}
          onSaveSdoItem={handleSaveSdoItem}
          sdoEditItemModal={sdoEditItemModal}
          setSdoEditItemModal={setSdoEditItemModal}
          savingSdoItem={savingSdoItem}
          showNoscaDocsArchiveModal={showNoscaDocsArchiveModal}
          setShowNoscaDocsArchiveModal={setShowNoscaDocsArchiveModal}
          noscaItems={noscaItems}
          onSelectIncumbent={(inc) => {
            setSelectedIncumbent(inc);
            setShowAssessmentModal(true);
          }}
          onSetFullScreenDoc={setFullScreenDoc}
          onBackToStep3={() => setCurrentStep(3)}
          isRegionalOffice={isRegionalOffice}
          canManageNosca={canUploadNosca}
          canUploadNosca={canUploadNosca}
          canAssignItemNo={canAssignItemNo}
          onOpenNoscaScanModal={() => setShowNoscaModal(true)}
          scanningNosca={scanningNosca}
          scannedNoscaResult={scannedNoscaResult}
          selectedNoscaItemsCount={selectedNoscaItems.length}
          isDark={isDark}
        />
      )}
    </main>

      {/* MODAL: ASSIGN DBM NOSCA PLANTILLA ITEM */}
      {noscaItemAssignModal.open && noscaItemAssignModal.personnel && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !assigningItemLoading) {
              setNoscaItemAssignModal({ open: false, personnel: null });
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 110,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'var(--modal-bg, #ffffff)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            width: 'min(580px, 95vw)',
            padding: '26px 30px',
            boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.65)' : '0 20px 40px rgba(0,0,0,0.15)',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: isDark ? '#34d399' : '#059669',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #a7f3d0',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  marginBottom: '6px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  DBM NOSCA Plantilla Assignment
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: 'var(--text)' }}>
                  Assign Authorized Item No.
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                  Select or enter the specific Plantilla Item No. issued for this personnel under DBM NOSCA.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setNoscaItemAssignModal({ open: false, personnel: null })}
                disabled={assigningItemLoading}
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                  border: '1px solid var(--line)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: assigningItemLoading ? 'not-allowed' : 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Personnel Context Card */}
            <div style={{
              background: isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text)' }}>
                    {noscaItemAssignModal.personnel.full_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
                    {noscaItemAssignModal.personnel.current_position} • {noscaItemAssignModal.personnel.division || noscaItemAssignModal.personnel.station_division}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                    color: isDark ? '#93c5fd' : '#1d4ed8',
                    fontSize: '11px',
                    fontWeight: 750
                  }}>
                    Target: {noscaItemAssignModal.personnel.target_position || noscaItemAssignModal.personnel.reclass_position || 'School Counselor'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '11.5px', color: isDark ? '#cbd5e1' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Current Plantilla Item:</span>
                <code style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#e2e8f0',
                  color: isDark ? '#93c5fd' : '#1e293b',
                  fontSize: '11.5px',
                  fontWeight: 700
                }}>
                  {noscaItemAssignModal.personnel.plantilla_item_number || 'Unassigned / N/A'}
                </code>
              </div>
            </div>

            {/* NOSCA Available Items Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 750, color: 'var(--text)', marginBottom: '6px' }}>
                  Select Plantilla Item No. to Assign
                </label>

                {availableNoscaItemOptions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select
                      value={isCustomItemNo ? '__CUSTOM__' : selectedNoscaItemNo}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setIsCustomItemNo(true);
                        } else {
                          setSelectedNoscaItemNo(val);
                          const isNA = val.toUpperCase() === '#N/A' || val.toUpperCase() === 'N/A';
                          if (isNA) {
                            setIsCustomItemNo(true);
                            setCustomPlantillaNo('');
                          } else {
                            setIsCustomItemNo(false);
                            setCustomPlantillaNo(val);
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isDark ? '1.5px solid rgba(59, 130, 246, 0.5)' : '1.5px solid #3b82f6',
                        background: 'var(--input-bg)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        fontWeight: 700,
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Choose from available DBM NOSCA allocations --</option>
                      {availableNoscaItemOptions.map(opt => (
                        <option key={opt.itemNo} value={opt.itemNo}>
                          {opt.itemNo} {opt.isNA ? '(Marked N/A - requires new Item No)' : `• [${opt.source}${opt.division ? ` - ${opt.division}` : ''}]`}
                        </option>
                      ))}
                      <option value="__CUSTOM__">+ Assign New Plantilla No. / Manual Entry...</option>
                    </select>

                    <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                      {scannedNoscaResult
                        ? `✓ ${availableNoscaItemOptions.length} Item Numbers loaded from active scanned NOSCA (${scannedNoscaResult.fileName || 'NOSCA PDF'}) & database.`
                        : `Found ${availableNoscaItemOptions.length} available items from DBM NOSCA allocations.`}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                    border: '1px solid var(--line)',
                    fontSize: '12px',
                    color: isDark ? '#94a3b8' : '#64748b',
                    marginBottom: '4px'
                  }}>
                    No NOSCA items currently available in database. Enter the new authorized Plantilla Item No. directly below.
                  </div>
                )}
              </div>

              {/* Custom / New Plantilla Item Number Input Field */}
              {(isCustomItemNo || availableNoscaItemOptions.length === 0 || selectedNoscaItemNo.toUpperCase() === '#N/A' || selectedNoscaItemNo.toUpperCase() === 'N/A') && (
                <div style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(37, 99, 235, 0.1)' : '#eff6ff',
                  border: isDark ? '1.5px solid rgba(59, 130, 246, 0.4)' : '1.5px solid #bfdbfe',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                    New / Authorized Plantilla Item Number:
                  </label>
                  <input
                    type="text"
                    value={customPlantillaNo}
                    onChange={e => setCustomPlantillaNo(e.target.value)}
                    placeholder="e.g. OSEC-DECSB-GCOUI-30001-2026"
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: isDark ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #93c5fd',
                      background: 'var(--card)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: 700,
                      outline: 'none',
                      fontFamily: 'monospace'
                    }}
                  />
                  <div style={{ fontSize: '11px', color: isDark ? '#cbd5e1' : '#3b82f6' }}>
                    {selectedNoscaItemNo.toUpperCase() === '#N/A' || selectedNoscaItemNo.toUpperCase() === 'N/A'
                      ? 'Selected item is marked N/A. Please specify the new Plantilla Item Number to assign.'
                      : 'Assign a new Plantilla Item Number to be registered in the personnel record.'}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0'
            }}>
              <button
                type="button"
                onClick={() => setNoscaItemAssignModal({ open: false, personnel: null })}
                disabled={assigningItemLoading}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                  color: 'var(--text)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: assigningItemLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmNoscaItemAssignment}
                disabled={assigningItemLoading}
                style={{
                  padding: '9px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  background: assigningItemLoading
                    ? '#64748b'
                    : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: assigningItemLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                {assigningItemLoading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                    </svg>
                    Assigning Item...
                  </>
                ) : (
                  <>
                    <span>✓</span> Confirm & Assign Item No.
                  </>
                )}
              </button>
            </div>
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
            background: isDark ? 'rgba(15, 23, 42, 0.96)' : 'var(--modal-bg, var(--card))',
            backdropFilter: 'blur(24px)',
            borderRadius: '24px',
            width: 'min(1240px, 96vw)',
            maxHeight: '93vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isDark ? '0 25px 70px rgba(0, 0, 0, 0.7)' : '0 25px 50px rgba(0, 0, 0, 0.2)',
            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 28px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
              background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'var(--card-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isDark ? '#93c5fd' : '#1d4ed8',
                    background: isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff',
                    border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}>
                    Incumbent Guidance Counselor Assessment
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 750,
                    color: 'var(--text-secondary, #94a3b8)',
                    background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-solid, #ffffff)',
                    border: '1px solid var(--line)',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontFamily: 'monospace'
                  }}>
                    Plantilla: {selectedIncumbent.plantilla_item_number || selectedIncumbent.employee_id}
                  </span>
                  {selectedIncumbent.new_item_number && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: isDark ? '#6ee7b7' : '#047857',
                      background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                      border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ opacity: 0.75, fontWeight: 700 }}>NEW ITEM:</span>
                      {selectedIncumbent.new_item_number}
                    </span>
                  )}
                  {selectedIncumbent.full_name === '#N/A' && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: isDark ? 'rgba(234, 179, 8, 0.2)' : '#fef9c3',
                      color: isDark ? '#fde047' : '#854d0e',
                      border: isDark ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid #fef08a',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}>
                      Unfilled / Vacant Item
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 850, margin: '2px 0 0', color: 'var(--text)', letterSpacing: '-0.01em' }}>
                  {selectedIncumbent.full_name === '#N/A' ? 'Unfilled / Vacant Plantilla Item' : selectedIncumbent.full_name}
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span><b style={{ color: 'var(--text)' }}>Current:</b> {selectedIncumbent.current_position}</span>
                  <span>•</span>
                  <span><b style={{ color: 'var(--text)' }}>Station:</b> {selectedIncumbent.station_division || selectedIncumbent.uacs_oper_dsc}</span>
                  {selectedIncumbent.division && (
                    <>
                      <span>•</span>
                      <span><b style={{ color: 'var(--text)' }}>Division:</b> {selectedIncumbent.division} {selectedIncumbent.region ? `(${selectedIncumbent.region})` : ''}</span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowAssessmentModal(false)}
                  title="Close Assessment (Esc)"
                  aria-label="Close Assessment Modal"
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.6)' : 'var(--card-solid, #ffffff)',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
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
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{
              padding: '24px 28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* TOP DASHBOARD ROW: Official Plantilla Assignment Profile */}
              <div style={{
                background: isDark ? 'rgba(2, 6, 23, 0.6)' : 'var(--card-subtle)',
                borderRadius: '16px',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                padding: '18px 20px',
                boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: isDark ? '#38bdf8' : '#0284c7',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>Official Plantilla &amp; Station Profile</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'none', fontWeight: 650 }}>
                    {selectedIncumbent.region || 'DepEd Regional'}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                  fontSize: '12px'
                }}>
                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card-solid, #ffffff)', padding: '10px 12px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Plantilla Item No.</div>
                    <div style={{ fontWeight: 800, color: 'var(--text)', marginTop: '2px', fontFamily: 'monospace', fontSize: '11.5px', wordBreak: 'break-all' }}>
                      {selectedIncumbent.plantilla_item_number || selectedIncumbent.employee_id}
                    </div>
                    {selectedIncumbent.new_item_number && (
                      <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 800, color: isDark ? '#6ee7b7' : '#047857', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '3px', background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7', border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #86efac' }}>New Item</span>
                        <span>{selectedIncumbent.new_item_number}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card-solid, #ffffff)', padding: '10px 12px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Current Position &amp; SG</div>
                    <div style={{ fontWeight: 750, color: 'var(--text)', marginTop: '2px' }}>
                      {selectedIncumbent.current_position || '—'} • <span style={{ color: '#0284c7', fontWeight: 800 }}>SG {selectedIncumbent.salary_grade || '—'}</span>
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card-solid, #ffffff)', padding: '10px 12px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Station / School</div>
                    <div style={{ fontWeight: 750, color: 'var(--text)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedIncumbent.school_name || selectedIncumbent.uacs_oper_dsc || selectedIncumbent.station_division}>
                      {selectedIncumbent.school_name || selectedIncumbent.uacs_oper_dsc || selectedIncumbent.station_division || '—'}
                      {selectedIncumbent.school_id && (
                        <span style={{ fontSize: '11px', color: '#0284c7', marginLeft: '6px', fontWeight: 800, fontFamily: 'monospace' }}>
                          ({selectedIncumbent.school_id})
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card-solid, #ffffff)', padding: '10px 12px', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase' }}>Division &amp; Region</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedIncumbent.division || selectedIncumbent.station_division || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Embedded Document Vault & Documentary Screening Section */}
              {(() => {
                const requiredReqs = docChecklist.filter(d => d.required);
                const otherReqs = docChecklist.filter(d => !d.required);
                const hasRevisionDoc = docChecklist.some(d => d.status === 'for_revision');
                const missingRequiredDocs = requiredReqs.filter(d => !d.submitted || !d.verified || d.status !== 'approved');
                const isDocComplete = !hasRevisionDoc && missingRequiredDocs.length === 0;
                const approvedCount = docChecklist.filter(d => d.status === 'approved' || (d.submitted && d.verified && d.status !== 'for_revision')).length;
                const requiredApprovedCount = requiredReqs.filter(d => d.status === 'approved' || (d.submitted && d.verified && d.status !== 'for_revision')).length;
                const revisionCount = docChecklist.filter(d => d.status === 'for_revision').length;

                // Document review status: 'All Documents Reviewed' if every document is approved, else 'Pending Document Review' (especially if at least one is for revision)
                const isAllDocsApproved = docChecklist.length > 0 && docChecklist.every(d => d.status === 'approved' || (d.submitted && d.verified && d.status !== 'for_revision'));
                const docReviewStatus = isAllDocsApproved ? 'All Documents Reviewed' : 'Pending Document Review';
                const docStatusBadge = isAllDocsApproved ? {
                  bg: isDark ? 'rgba(6, 78, 59, 0.45)' : '#ecfdf5',
                  color: isDark ? '#6ee7b7' : '#047857',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                  icon: (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )
                } : {
                  bg: hasRevisionDoc ? (isDark ? 'rgba(153, 27, 27, 0.35)' : '#fef2f2') : (isDark ? 'rgba(180, 83, 9, 0.35)' : '#fffbeb'),
                  color: hasRevisionDoc ? (isDark ? '#f87171' : '#b91c1c') : (isDark ? '#fcd34d' : '#b45309'),
                  border: hasRevisionDoc ? (isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca') : (isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a'),
                  icon: hasRevisionDoc ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  )
                };

                const activeDoc = docChecklist.find(d => (d.key || d.id) === selectedVaultDocKey || d.id === selectedVaultDocKey) || docChecklist[0];

                const attachedList = Array.isArray(selectedIncumbent?.assessment?.documents) && selectedIncumbent.assessment.documents.length > 0
                  ? selectedIncumbent.assessment.documents
                  : Array.isArray(selectedIncumbent?.documents) && selectedIncumbent.documents.length > 0
                    ? selectedIncumbent.documents
                    : [];

                const directAttachment = attachedList.find(att => {
                  const name = String(att.label || att.name || att.key || '').toLowerCase();
                  const k = String(activeDoc?.key || activeDoc?.id || '').toLowerCase();
                  const id = String(activeDoc?.id || '').toLowerCase();
                  return name.includes(k) || name.includes(id);
                });

                const docUrl = directAttachment?.url ||
                  (selectedIncumbent?.application_id
                    ? `${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${selectedIncumbent.application_id}/documents/${activeDoc?.key || activeDoc?.id}/download?token=${localStorage.getItem('agap_token')}&dpi=98`
                    : null);

                const isActiveApproved = Boolean(activeDoc?.status === 'approved' || (activeDoc?.submitted && activeDoc?.verified && activeDoc?.status !== 'for_revision'));
                const isActiveRevision = Boolean(activeDoc?.status === 'for_revision');

                return (
                  <div
                    id="section-doc-vault"
                    ref={docVaultRef}
                    style={{
                      background: isDark ? 'rgba(15, 23, 42, 0.65)' : 'var(--card-subtle)',
                      borderRadius: '16px',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                      padding: '20px',
                      boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
                    }}
                  >
                    {/* Header Controls */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}>
                        {/* Title and Review Status Badge */}
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: isDark ? '#38bdf8' : '#0284c7',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                          </svg>
                          <span>1. Document Vault &amp; Requirements Screening</span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: 'normal',
                            textTransform: 'none',
                            background: docStatusBadge.bg,
                            color: docStatusBadge.color,
                            border: docStatusBadge.border,
                            boxShadow: isAllDocsApproved ? '0 2px 8px rgba(16, 185, 129, 0.2)' : '0 2px 8px rgba(245, 158, 11, 0.15)'
                          }}>
                            <span>{docStatusBadge.icon}</span>
                            <span>{docReviewStatus}</span>
                          </span>
                        </div>

                        {/* Top-Right Action Buttons: Approve All, Reset, Save Step 1 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {!isRegionalOffice && (
                            <>
                              <button
                                type="button"
                                onClick={handleMarkAllDocsComplete}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: isDark ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid #10b981',
                                  background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                                  color: isDark ? '#6ee7b7' : '#047857',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = isDark ? 'rgba(6, 78, 59, 0.55)' : '#d1fae5';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5';
                                  e.currentTarget.style.transform = 'none';
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Approve All</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleResetAllDocs}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                                  background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'var(--card-solid, #ffffff)',
                                  color: 'var(--text-secondary, #94a3b8)',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = isDark ? 'rgba(51, 65, 85, 0.8)' : 'var(--card-subtle)';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = isDark ? 'rgba(30, 41, 59, 0.5)' : 'var(--card-solid, #ffffff)';
                                  e.currentTarget.style.transform = 'none';
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                  <path d="M3 3v5h5" />
                                </svg>
                                <span>Reset</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveStep1}
                                disabled={savingStep1 || savingModalChanges}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: savingStep1
                                    ? '#64748b'
                                    : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                  color: '#ffffff',
                                  fontSize: '11.5px',
                                  fontWeight: 750,
                                  cursor: savingStep1 ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                                  transition: 'all 0.15s ease',
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={e => {
                                  if (!savingStep1 && !savingModalChanges) {
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.35)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (!savingStep1 && !savingModalChanges) {
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(2, 132, 199, 0.25)';
                                    e.currentTarget.style.transform = 'none';
                                  }
                                }}
                                title="Save Document Screening progress"
                              >
                                {savingStep1 ? (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                                    </svg>
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                      <polyline points="17 21 17 13 7 13 7 21" />
                                      <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                    <span>Save Step 1</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Subtitle & Document Counts Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginTop: '6px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', flex: 1, minWidth: '240px' }}>
                          Select any credential to preview it in the vault. Mark items as <b>Approved</b> or <b>For Revision</b>. All mandatory requirements must be approved to unlock QS Evaluation.
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: isDocComplete
                              ? (isDark ? 'rgba(6, 78, 59, 0.4)' : '#ecfdf5')
                              : (isDark ? 'rgba(180, 83, 9, 0.35)' : '#fffbeb'),
                            color: isDocComplete
                              ? (isDark ? '#6ee7b7' : '#047857')
                              : (isDark ? '#fcd34d' : '#b45309'),
                            border: isDocComplete
                              ? (isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0')
                              : (isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a')
                          }}>
                            {requiredApprovedCount} of {requiredReqs.length} Mandatory Approved ({approvedCount} of {docChecklist.length} Total)
                          </span>

                          {revisionCount > 0 && (
                            <span style={{
                              fontSize: '11.5px',
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: '8px',
                              background: isDark ? 'rgba(120, 53, 15, 0.4)' : '#fff7ed',
                              color: isDark ? '#fdba74' : '#c2410c',
                              border: isDark ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid #fed7aa',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              <span>{revisionCount} For Revision</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Completion Notice Banner */}
                    {isDocComplete ? (
                      <div style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                        border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                        color: isDark ? '#a7f3d0' : '#065f46',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        All mandatory requirements are approved. Qualification Standards (QS) Evaluation is unlocked.
                      </div>
                    ) : (
                      <div style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        background: isDark ? 'rgba(120, 53, 15, 0.35)' : '#fffbeb',
                        border: isDark ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid #fde68a',
                        color: isDark ? '#fef3c7' : '#92400e',
                        fontSize: '12.5px',
                        lineHeight: 1.45,
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <div>
                          {revisionCount > 0 ? (
                            <>
                              <b>{revisionCount} document(s) marked for revision.</b> ({requiredApprovedCount} of {requiredReqs.length} Mandatory Approved). Resolve revision items and approve all mandatory requirements to unlock Qualification Standards (QS) Evaluation.
                            </>
                          ) : (
                            <>
                              <b>{requiredApprovedCount} of {requiredReqs.length} Mandatory Requirements approved.</b> Review and approve each required document below to unlock Qualification Standards (QS) Evaluation.
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Integrated 2-Column Document Vault Workbench */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(330px, 390px) 1fr',
                      gap: '16px',
                      alignItems: 'stretch',
                      minHeight: '480px'
                    }}>
                      {/* Left: Document Checklist Selector */}
                      <div style={{
                        border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <div style={{
                          padding: '11px 14px',
                          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                          background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #64748b)' }}>
                            Requirements Checklist ({docChecklist.length})
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
                            Click to preview
                          </span>
                        </div>

                        <div style={{
                          overflowY: 'auto',
                          maxHeight: '520px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          {docChecklist.map((doc) => {
                            const isSelected = (doc.key || doc.id) === (activeDoc?.key || activeDoc?.id);
                            const isApproved = doc.status === 'approved' || (doc.submitted && doc.verified && doc.status !== 'for_revision');
                            const isRevision = doc.status === 'for_revision';
                            const hasAttachment = attachedList.some(att => {
                              const name = String(att.label || att.name || att.key || '').toLowerCase();
                              const k = String(doc.key || doc.id || '').toLowerCase();
                              const id = String(doc.id || '').toLowerCase();
                              return name.includes(k) || name.includes(id);
                            });

                            return (
                              <div
                                key={doc.id}
                                onClick={() => setSelectedVaultDocKey(doc.key || doc.id)}
                                style={{
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  background: isSelected
                                    ? (isDark ? 'rgba(2, 132, 199, 0.22)' : '#eff6ff')
                                    : (isDark ? 'transparent' : '#ffffff'),
                                  borderLeft: isSelected ? '4px solid #0284c7' : '4px solid transparent',
                                  borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9',
                                  transition: 'all 0.12s ease',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '7px'
                                }}
                              >
                                {/* Item Header: Badge & Title */}
                                <div>
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: isSelected ? 800 : (isApproved ? 750 : 650),
                                    color: isSelected
                                      ? (isDark ? '#38bdf8' : '#0284c7')
                                      : (isApproved ? (isDark ? '#86efac' : '#1e293b') : (isRevision ? (isDark ? '#fca5a5' : '#b91c1c') : 'var(--text)')),
                                    lineHeight: 1.35,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    flexWrap: 'wrap'
                                  }}>
                                    {doc.required && (
                                      <span
                                        title="Mandatory requirement"
                                        style={{
                                          color: '#ef4444',
                                          fontWeight: 800,
                                          fontSize: '14px',
                                          lineHeight: 1,
                                          display: 'inline-block'
                                        }}
                                      >
                                        *
                                      </span>
                                    )}
                                    <span>{doc.shortTitle || doc.label}</span>
                                  </div>

                                  <div style={{
                                    marginTop: '3px',
                                    fontSize: '10.5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    flexWrap: 'wrap'
                                  }}>
                                    {isApproved && (
                                      <span style={{ color: '#16a34a', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                        ✓ Approved
                                      </span>
                                    )}
                                    {isRevision && (
                                      <span style={{ color: '#d97706', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                        ⚠ For Revision
                                      </span>
                                    )}
                                    {hasAttachment ? (
                                      <span style={{ color: isDark ? '#7dd3fc' : '#0284c7', fontWeight: 650 }}>
                                        • File Attached
                                      </span>
                                    ) : (
                                      <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                                        {isApproved ? '• Physical copy verified' : '• No file attached'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Evaluation Action Buttons: Approved vs For Revision */}
                                {!isRegionalOffice && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedVaultDocKey(doc.key || doc.id);
                                        handleSetDocStatus(doc.id, 'approved');
                                      }}
                                      style={{
                                        flex: 1,
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 750,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        border: isApproved
                                          ? (isDark ? '1px solid #10b981' : '1px solid #059669')
                                          : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #cbd5e1'),
                                        background: isApproved
                                          ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#ecfdf5')
                                          : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc'),
                                        color: isApproved
                                          ? (isDark ? '#34d399' : '#047857')
                                          : 'var(--text-secondary, #64748b)'
                                      }}
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      <span>Approved</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedVaultDocKey(doc.key || doc.id);
                                        handleSetDocStatus(doc.id, 'for_revision');
                                      }}
                                      style={{
                                        flex: 1,
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 750,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        border: isRevision
                                          ? (isDark ? '1px solid #f59e0b' : '1px solid #d97706')
                                          : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #cbd5e1'),
                                        background: isRevision
                                          ? (isDark ? 'rgba(245, 158, 11, 0.25)' : '#fffbeb')
                                          : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc'),
                                        color: isRevision
                                          ? (isDark ? '#fbbf24' : '#b45309')
                                          : 'var(--text-secondary, #64748b)'
                                      }}
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                      </svg>
                                      <span>For Revision</span>
                                    </button>
                                  </div>
                                )}

                                {/* Remarks input when For Revision or if remarks exist */}
                                {(isRevision || Boolean(doc.remarks)) && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      marginTop: '2px',
                                      padding: '8px 10px',
                                      borderRadius: '8px',
                                      background: isDark ? 'rgba(120, 53, 15, 0.22)' : '#fffbeb',
                                      border: isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #fde68a',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: isDark ? '#fbbf24' : '#b45309', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                        Revision Remarks:
                                      </span>
                                      {doc.remarks && !isRegionalOffice && (
                                        <button
                                          type="button"
                                          onClick={() => handleSetDocRemarks(doc.id, '')}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary, #94a3b8)',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            padding: 0
                                          }}
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </div>

                                    <input
                                      type="text"
                                      placeholder="Add remarks (e.g. Missing signature, submit certified true copy)..."
                                      value={doc.remarks || ''}
                                      disabled={isRegionalOffice}
                                      onChange={(e) => handleSetDocRemarks(doc.id, e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '5px 8px',
                                        fontSize: '11px',
                                        borderRadius: '5px',
                                        border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #cbd5e1',
                                        background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
                                        color: 'var(--text)',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                      }}
                                    />

                                    {!isRegionalOffice && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {[
                                          'Missing signature',
                                          'Illegible scan',
                                          'Certified copy needed',
                                          'Incomplete pages',
                                          'Expired document'
                                        ].map((preset) => (
                                          <button
                                            key={preset}
                                            type="button"
                                            onClick={() => {
                                              const current = doc.remarks || '';
                                              const next = current ? `${current}; ${preset}` : preset;
                                              handleSetDocRemarks(doc.id, next);
                                            }}
                                            style={{
                                              fontSize: '9.5px',
                                              fontWeight: 650,
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #fde68a',
                                              background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#fef3c7',
                                              color: isDark ? '#fcd34d' : '#92400e',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            + {preset}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right: Document Viewer Pane */}
                      <div style={{
                        border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        background: isDark ? 'rgba(15, 23, 42, 0.9)' : '#ffffff'
                      }}>
                        {/* Viewer Subheader */}
                        <div style={{
                          padding: '10px 16px',
                          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.65)' : '#f8fafc',
                          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ color: isDark ? '#38bdf8' : '#0284c7', flexShrink: 0 }}
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span style={{
                              fontWeight: 800,
                              fontSize: '13px',
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              Preview: {activeDoc?.shortTitle || activeDoc?.label}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {!isRegionalOffice && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSetDocStatus(activeDoc?.id, 'approved')}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 750,
                                    borderRadius: '6px',
                                    border: isActiveApproved
                                      ? (isDark ? '1px solid #10b981' : '1px solid #059669')
                                      : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #cbd5e1'),
                                    background: isActiveApproved
                                      ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#ecfdf5')
                                      : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff'),
                                    color: isActiveApproved
                                      ? (isDark ? '#34d399' : '#047857')
                                      : 'var(--text-secondary, #64748b)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>Approved</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSetDocStatus(activeDoc?.id, 'for_revision')}
                                  style={{
                                    padding: '5px 11px',
                                    fontSize: '11px',
                                    fontWeight: 750,
                                    borderRadius: '6px',
                                    border: isActiveRevision
                                      ? (isDark ? '1px solid #f59e0b' : '1px solid #d97706')
                                      : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #cbd5e1'),
                                    background: isActiveRevision
                                      ? (isDark ? 'rgba(245, 158, 11, 0.25)' : '#fffbeb')
                                      : (isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff'),
                                    color: isActiveRevision
                                      ? (isDark ? '#fbbf24' : '#b45309')
                                      : 'var(--text-secondary, #64748b)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                  </svg>
                                  <span>For Revision</span>
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={!docUrl}
                              title={!docUrl ? "No digital file attached to view in full screen" : "Open document in full screen preview"}
                              onClick={() => {
                                if (docUrl && setFullScreenDoc) {
                                  setFullScreenDoc({
                                    open: true,
                                    url: docUrl,
                                    title: activeDoc?.shortTitle || activeDoc?.label
                                  });
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: !docUrl ? (isDark ? '#64748b' : '#94a3b8') : 'var(--text)',
                                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: !docUrl ? 'not-allowed' : 'pointer',
                                opacity: !docUrl ? 0.6 : 1,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                              </svg>
                              Full Screen
                            </button>
                          </div>
                        </div>

                        {/* Revision remarks input bar inside Viewer pane if activeDoc is for revision */}
                        {activeDoc && (activeDoc.status === 'for_revision' || Boolean(activeDoc.remarks)) && (
                          <div style={{
                            padding: '8px 16px',
                            backgroundColor: isDark ? 'rgba(120, 53, 15, 0.25)' : '#fffbeb',
                            borderBottom: isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #fde68a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? '#fbbf24' : '#b45309', whiteSpace: 'nowrap' }}>
                              ⚠ Revision Remarks:
                            </span>
                            <input
                              type="text"
                              placeholder="Add revision remarks for this document..."
                              value={activeDoc.remarks || ''}
                              onChange={(e) => handleSetDocRemarks(activeDoc.id, e.target.value)}
                              disabled={isRegionalOffice}
                              style={{
                                flex: 1,
                                minWidth: '220px',
                                padding: '5px 10px',
                                fontSize: '11.5px',
                                borderRadius: '6px',
                                border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #cbd5e1',
                                background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
                                color: 'var(--text)',
                                outline: 'none'
                              }}
                            />
                          </div>
                        )}

                        {/* Document Viewer Frame or Empty State */}
                        <div style={{
                          width: '100%',
                          minHeight: '430px',
                          flex: 1,
                          position: 'relative',
                          background: isDark ? '#0b1120' : '#f8fafc',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {docUrl ? (
                            <iframe
                              src={docUrl}
                              style={{
                                width: '100%',
                                height: '100%',
                                minHeight: '430px',
                                border: 'none',
                                display: 'block'
                              }}
                              title={activeDoc?.shortTitle || 'Document Viewer'}
                            />
                          ) : (
                            <div style={{
                              padding: '36px 20px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              textAlign: 'center',
                              maxWidth: '420px'
                            }}>
                              <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '14px',
                                background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#e2e8f0',
                                border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '14px',
                                fontSize: '26px'
                              }}>
                                📄
                              </div>
                              <h4 style={{
                                margin: '0 0 6px 0',
                                fontSize: '15px',
                                fontWeight: 800,
                                color: isDark ? '#f8fafc' : '#0f172a'
                              }}>
                                No Document Attached
                              </h4>
                              <p style={{
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '1.5',
                                color: isDark ? '#94a3b8' : '#64748b'
                              }}>
                                There is currently no electronic copy uploaded for <strong>{activeDoc?.shortTitle || activeDoc?.label}</strong> for this candidate.
                              </p>
                              <div style={{
                                marginTop: '14px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: isDark ? 'rgba(234, 179, 8, 0.12)' : '#fef9c3',
                                border: isDark ? '1px solid rgba(234, 179, 8, 0.28)' : '1px solid #fde047',
                                color: isDark ? '#facc15' : '#854d0e'
                              }}>
                                <span style={{ fontSize: '10px' }}>⏳</span> Pending Candidate Submission / Attachment
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Card 3: Position-Specific Qualification Standards (QS) Evaluation Section */}
              {(() => {
                const hasAnyRevision = docChecklist.some(d => d.status === 'for_revision');
                const missingRequiredDocs = docChecklist.filter(d => d.required && (!d.submitted || !d.verified || d.status !== 'approved'));
                const isDocComplete = !hasAnyRevision && missingRequiredDocs.length === 0;
                const effectiveTargetPos = modalTargetPosition || selectedIncumbent.target_position || selectedIncumbent.reclass_position || 'School Counselor I';
                const standards = getPositionQsStandards(effectiveTargetPos);
                const displayTargetPos = standards?.title || effectiveTargetPos;
                const overallResult = getCalculatedQsStatus(qsEvaluation);

                const criteriaRows = [
                  {
                    key: 'education',
                    title: 'Education',
                    standard: standards.education,
                    candidate: selectedIncumbent.education || selectedIncumbent.assessment?.education || '— No educational credential recorded yet'
                  },
                  {
                    key: 'experience',
                    title: 'Experience',
                    standard: standards.experience,
                    candidate: (selectedIncumbent.years_experience !== null && selectedIncumbent.years_experience !== undefined)
                      ? `${selectedIncumbent.years_experience} Years relevant guidance experience`
                      : (selectedIncumbent.assessment?.years_experience !== null && selectedIncumbent.assessment?.years_experience !== undefined)
                        ? `${selectedIncumbent.assessment.years_experience} Years relevant experience`
                        : '— 0 Years recorded'
                  },
                  {
                    key: 'training',
                    title: 'Training',
                    standard: standards.training,
                    candidate: (selectedIncumbent.hours_of_training !== null && selectedIncumbent.hours_of_training !== undefined)
                      ? `${selectedIncumbent.hours_of_training} Hours relevant training`
                      : (selectedIncumbent.assessment?.hours_of_training !== null && selectedIncumbent.assessment?.hours_of_training !== undefined)
                        ? `${selectedIncumbent.assessment.hours_of_training} Hours relevant training`
                        : '— 0 Hours recorded'
                  },
                  {
                    key: 'eligibility',
                    title: 'Eligibility',
                    standard: standards.eligibility,
                    candidate: selectedIncumbent.eligibility || selectedIncumbent.assessment?.eligibility || '— No eligibility certificate recorded yet'
                  }
                ];

                const unmetCriteria = criteriaRows.filter(r => qsEvaluation[r.key] === 'Does Not Meet');

                return (
                  <div style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'var(--card-subtle)',
                    borderRadius: '16px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                    padding: '20px',
                    position: 'relative',
                    boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
                  }}>
                    {/* Header with target position QS tag */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: isDark ? '#38bdf8' : '#0284c7',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          2. Position-Specific Qualification Standards (QS) Evaluation
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                          CSC &amp; DepEd QS benchmarks for: <b style={{ color: 'var(--text)' }}>{displayTargetPos}</b> {standards?.salaryGrade ? <span style={{ fontSize: '11px', fontWeight: 800, padding: '1px 7px', borderRadius: '4px', background: isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe', color: isDark ? '#38bdf8' : '#0284c7', marginLeft: '6px' }}>SG {standards.salaryGrade}</span> : null}
                        </div>
                      </div>

                      {!isRegionalOffice && (
                        <button
                          type="button"
                          onClick={handleSaveStep2}
                          disabled={!isAssessmentStep1Done || savingStep2 || savingModalChanges}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: (!isAssessmentStep1Done || savingStep2)
                              ? (isDark ? 'rgba(71, 85, 105, 0.4)' : '#94a3b8')
                              : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            color: '#ffffff',
                            fontSize: '11.5px',
                            fontWeight: 750,
                            cursor: (!isAssessmentStep1Done || savingStep2) ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: (!isAssessmentStep1Done || savingStep2) ? 'none' : '0 2px 6px rgba(2, 132, 199, 0.25)',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            opacity: !isAssessmentStep1Done ? 0.65 : 1
                          }}
                          onMouseEnter={e => {
                            if (isAssessmentStep1Done && !savingStep2 && !savingModalChanges) {
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.35)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (isAssessmentStep1Done && !savingStep2 && !savingModalChanges) {
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(2, 132, 199, 0.25)';
                              e.currentTarget.style.transform = 'none';
                            }
                          }}
                          title={!isAssessmentStep1Done ? (hasAnyRevision ? "Cannot save Step 2: One or more documents are marked For Revision" : "Step 1 must be completed and approved before Step 2 can be saved") : "Save QS Evaluation criteria and remarks"}
                        >
                          {savingStep2 ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                              </svg>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                              </svg>
                              <span>Save Step 2</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Completion Gating Lock Overlay */}
                    {!isDocComplete ? (
                      <div style={{
                        padding: '36px 24px',
                        textAlign: 'center',
                        background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(248, 250, 252, 0.9)',
                        borderRadius: '12px',
                        border: isDark ? '1px dashed rgba(245, 158, 11, 0.5)' : '1px dashed #f59e0b',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                          color: '#f59e0b',
                          display: 'grid',
                          placeItems: 'center'
                        }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                          QS Evaluation is Locked
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)', maxWidth: '460px', lineHeight: 1.45 }}>
                          {hasAnyRevision ? (
                            <>One or more documents are currently marked <b>For Revision</b>. Resolve all revision items and approve all mandatory requirements before performing QS evaluation.</>
                          ) : (
                            <>All mandatory documents in the checklist above must be marked as <b>Approved</b> before the Qualification Standards evaluation can be performed.</>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Interactive QS Standards Table */}
                        <div style={{
                          overflowX: 'auto',
                          borderRadius: '12px',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                          background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'var(--card-solid, #ffffff)',
                          marginBottom: '12px'
                        }}>
                          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                            <thead>
                              <tr style={{
                                borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                                background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'var(--card-subtle)',
                                color: 'var(--text-secondary, #94a3b8)',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}>
                                <th style={{ padding: '10px 14px', width: '150px', minWidth: '150px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid var(--line)' }}>Standard Criterion</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '240px', borderRight: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid var(--line)' }}>Target QS Requirement ({displayTargetPos})</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '220px', borderRight: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid var(--line)' }}>Personnel Record / Credential</th>
                                <th style={{ padding: '10px 14px', textAlign: 'center', width: '230px', minWidth: '230px', whiteSpace: 'nowrap' }}>Evaluation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {criteriaRows.map((crit) => {
                                const evalValue = qsEvaluation[crit.key];
                                const isMeets = evalValue === 'Meets';
                                const isDoesNotMeet = evalValue === 'Does Not Meet';

                                return (
                                  <tr
                                    key={crit.key}
                                    style={{
                                      borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid var(--line)',
                                      background: isDoesNotMeet
                                        ? (isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(254, 226, 226, 0.3)')
                                        : isMeets
                                          ? (isDark ? 'rgba(16, 185, 129, 0.06)' : 'rgba(236, 253, 245, 0.3)')
                                          : 'transparent'
                                    }}
                                  >
                                    <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap', borderRight: isDark ? '1px solid rgba(51, 65, 85, 0.25)' : '1px solid var(--line)' }}>
                                      <div style={{ fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                                        {crit.title}
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.4, borderRight: isDark ? '1px solid rgba(51, 65, 85, 0.25)' : '1px solid var(--line)' }}>
                                      {crit.standard}
                                    </td>
                                    <td style={{ padding: '12px 14px', verticalAlign: 'top', borderRight: isDark ? '1px solid rgba(51, 65, 85, 0.25)' : '1px solid var(--line)' }}>
                                      <div style={{ fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                                        {crit.candidate}
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', width: '230px', minWidth: '230px' }}>
                                      <div className="qs-eval-btn-group">
                                        <button
                                          type="button"
                                          onClick={() => handleSetQsCriterion(crit.key, 'Meets')}
                                          disabled={isRegionalOffice}
                                          className={`qs-btn qs-btn-meets ${isMeets ? 'active' : ''}`}
                                          title={isMeets ? "Click to deselect" : "Mark as Meets requirement"}
                                        >
                                          <svg className="qs-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isMeets ? "3" : "2.5"} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                          <span>Meets</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSetQsCriterion(crit.key, 'Does Not Meet')}
                                          disabled={isRegionalOffice}
                                          className={`qs-btn qs-btn-not-meets ${isDoesNotMeet ? 'active' : ''}`}
                                          title={isDoesNotMeet ? "Click to deselect" : "Mark as Does Not Meet requirement"}
                                        >
                                          <svg className="qs-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isDoesNotMeet ? "3" : "2.5"} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                          </svg>
                                          <span>Does Not Meet</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Grandfather Clause Note */}
                        <div style={{
                          fontSize: '11px',
                          color: isDark ? '#94a3b8' : '#64748b',
                          fontStyle: 'italic',
                          marginBottom: '16px',
                          lineHeight: 1.45,
                          padding: '0 4px'
                        }}>
                          * <b>Grandfather Clause:</b> Individuals who acquired PRC license according to Section 14 of RA No. 9258 (Guidance and Counseling Act of 2004) and Section 16 of RA No. 10029 (Philippine Psychology Act of 2009) shall be considered as having met the Master's degree education requirement for positions covered by the corresponding board laws.
                        </div>

                        {/* Overall QS Evaluation Result Summary Card */}
                        <div style={{
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: overallResult === 'QUALIFIED'
                            ? (isDark ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid #10b981')
                            : overallResult === 'NOT QUALIFIED'
                              ? (isDark ? '1.5px solid rgba(239, 68, 68, 0.5)' : '1.5px solid #ef4444')
                              : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)'),
                          background: overallResult === 'QUALIFIED'
                            ? (isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5')
                            : overallResult === 'NOT QUALIFIED'
                              ? (isDark ? 'rgba(127, 29, 29, 0.25)' : '#fef2f2')
                              : (isDark ? 'rgba(30, 41, 59, 0.4)' : 'var(--card-solid, #ffffff)'),
                          marginBottom: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary, #94a3b8)' }}>
                              Overall Qualification Standards Assessment Result
                            </div>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              padding: '4px 14px',
                              borderRadius: '8px',
                              letterSpacing: '0.04em',
                              background: overallResult === 'QUALIFIED'
                                ? '#10b981'
                                : overallResult === 'NOT QUALIFIED'
                                  ? '#ef4444'
                                  : (isDark ? 'rgba(100, 116, 139, 0.4)' : '#64748b'),
                              color: '#ffffff',
                              boxShadow: overallResult === 'QUALIFIED'
                                ? '0 2px 10px rgba(16, 185, 129, 0.35)'
                                : overallResult === 'NOT QUALIFIED'
                                  ? '0 2px 10px rgba(239, 68, 68, 0.35)'
                                  : 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {overallResult === 'QUALIFIED' ? (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>QUALIFIED</span>
                                </>
                              ) : overallResult === 'NOT QUALIFIED' ? (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                  <span>NOT QUALIFIED</span>
                                </>
                              ) : (
                                <span>PENDING EVALUATION</span>
                              )}
                            </span>
                          </div>

                          {overallResult === 'QUALIFIED' && (
                            <div style={{ fontSize: '13px', color: isDark ? '#a7f3d0' : '#047857', fontWeight: 700 }}>
                              Candidate satisfies all Civil Service Commission (CSC) and DepEd Qualification Standards (Education, Experience, Training, Eligibility) for <b>{displayTargetPos}</b>.
                            </div>
                          )}

                          {overallResult === 'NOT QUALIFIED' && (
                            <div style={{ fontSize: '12.5px', color: isDark ? '#fca5a5' : '#991b1b' }}>
                              <b style={{ fontWeight: 800 }}>Candidate does not satisfy the following qualification standards:</b>
                              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                                {unmetCriteria.map(u => (
                                  <li key={u.key} style={{ marginTop: '2px' }}>
                                    <b>{u.title}</b>: Required [{u.standard}] — Submitted [{u.candidate}]
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {overallResult === 'PENDING' && (
                            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #94a3b8)' }}>
                              Mark all 4 criteria above as "Meets" or "Does Not Meet" to establish final reclassification qualification.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Card 3: Final Recommendation - Actual Reclassification Position & Workflow Stage */}
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
                  marginBottom: '14px',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: isDark ? '#38bdf8' : '#0284c7',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      3. Actual Reclassification Position &amp; Workflow Stage
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                      Designate the final approved actual reclassification position and update candidate progression stage.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {isRegionalOffice ? (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 750,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff',
                        color: isDark ? '#93c5fd' : '#1d4ed8',
                        border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>View-Only</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveStep3}
                        disabled={!isAssessmentStep2Done || savingStep3 || savingModalChanges}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: (!isAssessmentStep2Done || savingStep3)
                            ? (isDark ? 'rgba(71, 85, 105, 0.4)' : '#94a3b8')
                            : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 750,
                          cursor: (!isAssessmentStep2Done || savingStep3) ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: (!isAssessmentStep2Done || savingStep3) ? 'none' : '0 2px 8px rgba(2, 132, 199, 0.25)',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          opacity: !isAssessmentStep2Done ? 0.65 : 1
                        }}
                        onMouseEnter={e => {
                          if (isAssessmentStep2Done && !savingStep3 && !savingModalChanges) {
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.35)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (isAssessmentStep2Done && !savingStep3 && !savingModalChanges) {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(2, 132, 199, 0.25)';
                            e.currentTarget.style.transform = 'none';
                          }
                        }}
                        title={!isAssessmentStep1Done ? "Step 1 must be completed first" : (!isAssessmentStep2Done ? "Complete Step 2 (QS Evaluation) before saving Step 3" : "Save Actual Position & Workflow Stage")}
                      >
                        {savingStep3 ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                            </svg>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                              <polyline points="17 21 17 13 7 13 7 21" />
                              <polyline points="7 3 7 8 15 8" />
                            </svg>
                            <span>Save Step 3</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 3 Gating Notice Banner */}
                {!isAssessmentStep2Done && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: isDark ? 'rgba(180, 83, 9, 0.18)' : '#fffbeb',
                    border: isDark ? '1px dashed rgba(245, 158, 11, 0.45)' : '1px dashed #fde68a',
                    color: isDark ? '#fbbf24' : '#b45309',
                    fontSize: '12px',
                    fontWeight: 650,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    marginBottom: '16px'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>
                      {!isAssessmentStep1Done
                        ? (docChecklist.some(d => d.status === 'for_revision')
                            ? 'Step 3 is locked. One or more documents are marked For Revision in Step 1.'
                            : 'Step 3 is locked. Please review and approve all mandatory documents in Step 1 first.')
                        : 'Step 3 is locked. Please complete all evaluation criteria in Step 2 (QS Evaluation) to unlock.'}
                    </span>
                  </div>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '14px',
                  opacity: !isAssessmentStep2Done ? 0.6 : 1
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 750, color: 'var(--text)', marginBottom: '5px' }}>
                      Actual Reclassification Position <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      id="actual-reclass-position-select"
                      value={RECLASS_POSITIONS_OPTIONS.find(p => p.toLowerCase() === String(modalTargetPosition).trim().toLowerCase()) || modalTargetPosition || ''}
                      onChange={e => {
                        setModalTargetPosition(e.target.value);
                      }}
                      disabled={!isAssessmentStep2Done || isRegionalOffice || savingModalChanges}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                        background: 'var(--input-bg)',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--input-text, var(--text))',
                        cursor: (!isAssessmentStep2Done || isRegionalOffice) ? 'not-allowed' : 'pointer',
                        outline: 'none',
                        opacity: (!isAssessmentStep2Done || isRegionalOffice) ? 0.75 : 1
                      }}
                    >
                      <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>-- Unassigned --</option>
                      {RECLASS_POSITIONS_OPTIONS.map(pos => (
                        <option key={pos} value={pos} style={{ background: 'var(--card)', color: 'var(--text)' }}>{pos}</option>
                      ))}
                      {modalTargetPosition && !RECLASS_POSITIONS_OPTIONS.some(p => p.toLowerCase() === String(modalTargetPosition).trim().toLowerCase()) && (
                        <option value={modalTargetPosition} style={{ background: 'var(--card)', color: 'var(--text)' }}>{modalTargetPosition}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 750, color: 'var(--text)', marginBottom: '5px' }}>
                      Stage of Reclassification
                    </label>
                    <select
                      value={modalStage}
                      onChange={e => setModalStage(e.target.value)}
                      disabled={!isAssessmentStep2Done || isRegionalOffice || savingModalChanges}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                        background: 'var(--input-bg)',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--input-text, var(--text))',
                        cursor: (!isAssessmentStep2Done || isRegionalOffice) ? 'not-allowed' : 'pointer',
                        outline: 'none',
                        opacity: (!isAssessmentStep2Done || isRegionalOffice) ? 0.75 : 1
                      }}
                    >
                      {isRegionalOffice ? (
                        <>
                          {!RO_RECLASS_STAGES.includes(modalStage) && (
                            <option value={modalStage} disabled style={{ background: 'var(--card)', color: 'var(--text)' }}>
                              {modalStage} (Current)
                            </option>
                          )}
                          {RO_RECLASS_STAGES.map(stage => (
                            <option key={stage} value={stage} style={{ background: 'var(--card)', color: 'var(--text)' }}>{stage}</option>
                          ))}
                        </>
                      ) : (
                        HRMO_RECLASS_STAGES.map(stage => (
                          <option key={stage} value={stage} style={{ background: 'var(--card)', color: 'var(--text)' }}>{stage}</option>
                        ))
                      )}
                    </select>

                    {canEndorseToDbm && ['endorsed to ro', 'endorsed'].includes(String(selectedIncumbent?.stage_of_reclassification || '').trim().toLowerCase()) && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setConfirmEndorseModal({ open: true, counselor: selectedIncumbent, isBulk: false })}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '11.5px',
                            fontWeight: 750,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                          title="Directly endorse this candidate to DBM Regional Office"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 2L11 13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                          <span>Endorse to DBM RO</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7', flexShrink: 0 }} />
                  <span>Actual reclassification position designated for: <b style={{ color: 'var(--text)' }}>{modalTargetPosition || selectedIncumbent.actual_position || selectedIncumbent.reclass_position || selectedIncumbent.target_position || 'School Counselor I'}</b></span>
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

              {!isRegionalOffice && (
                <button
                  type="button"
                  onClick={() => handleSaveModalChanges(false)}
                  disabled={savingModalChanges || !isAssessmentStep2Done}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: (!isAssessmentStep2Done || savingModalChanges)
                      ? (isDark ? 'rgba(71, 85, 105, 0.4)' : '#94a3b8')
                      : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: (!isAssessmentStep2Done || savingModalChanges) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: (!isAssessmentStep2Done || savingModalChanges)
                      ? 'none'
                      : '0 4px 12px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.15s ease',
                    opacity: !isAssessmentStep2Done ? 0.65 : 1
                  }}
                  onMouseOver={e => {
                    if (isAssessmentStep2Done && !savingModalChanges) {
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseOut={e => {
                    if (isAssessmentStep2Done && !savingModalChanges) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                  title={!isAssessmentStep1Done ? "Step 1 must be completed and approved first" : (!isAssessmentStep2Done ? "Complete Step 2 (QS Evaluation) before saving assessment" : "Save all changes and update incumbent record")}
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal: Actual Reclassification Position Not Changed or Left Unassigned */}
      {positionWarningModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100005,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingModalChanges) {
              setPositionWarningModal(prev => ({ ...prev, open: false }));
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reclass-warning-title"
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: isDark
                ? '0 25px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(245, 158, 11, 0.35)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(245, 158, 11, 0.35)',
              border: isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #fde68a',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              background: isDark
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(15, 23, 42, 0.85) 100%)'
                : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                  flexShrink: 0
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h3 id="reclass-warning-title" style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                    {positionWarningModal.isUnassigned
                      ? 'Actual Position Not Designated'
                      : 'Actual Position Unchanged'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: isDark ? '#fbbf24' : '#b45309', fontWeight: 650 }}>
                    {positionWarningModal.isUnassigned
                      ? 'Actual reclassification position is currently unassigned'
                      : 'No changes were made to actual reclassification position'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPositionWarningModal(prev => ({ ...prev, open: false }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary, #94a3b8)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Dismiss warning"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '22px 24px' }}>
              {/* Candidate Info Callout */}
              <div style={{
                background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                borderRadius: '12px',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                padding: '14px 16px',
                marginBottom: '16px',
                fontSize: '12.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 650 }}>Candidate:</span>
                  <span style={{ fontWeight: 800, color: 'var(--text)' }}>{positionWarningModal.candidateName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 650 }}>🎯 Target / Applied Position:</span>
                  <span style={{ fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7' }}>{positionWarningModal.targetPosition}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', paddingTop: '8px', borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid #e2e8f0' }}>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 650 }}>Actual Reclassification Position:</span>
                  <span style={{
                    fontWeight: 850,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: positionWarningModal.isUnassigned
                      ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2')
                      : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'),
                    color: positionWarningModal.isUnassigned
                      ? (isDark ? '#fca5a5' : '#dc2626')
                      : (isDark ? '#fbbf24' : '#b45309')
                  }}>
                    {positionWarningModal.currentPosition || '-- Unassigned --'}
                  </span>
                </div>
              </div>

              {/* Warning Text */}
              <div style={{
                fontSize: '13px',
                lineHeight: 1.55,
                color: 'var(--text)',
                marginBottom: '6px'
              }}>
                {positionWarningModal.isUnassigned ? (
                  <>
                    The <b>Actual Reclassification Position</b> for this incumbent is currently <b>unassigned</b>. Are you sure you want to save qualification assessments without designating their final reclassification position?
                  </>
                ) : (
                  <>
                    You are saving without modifying the <b>Actual Reclassification Position</b>. It will remain as <b>{positionWarningModal.currentPosition}</b>.
                  </>
                )}
              </div>

              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #94a3b8)',
                marginTop: '10px'
              }}>
                To assign or update the candidate's approved position, click <b>Go Back &amp; Change Position</b>.
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => handleSaveModalChanges(true)}
                disabled={savingModalChanges}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                  color: 'var(--text-secondary, #64748b)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: savingModalChanges ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary, #64748b)'}
              >
                Proceed &amp; Save Anyway
              </button>

              <button
                type="button"
                onClick={handleGoBackToChangePosition}
                disabled={savingModalChanges}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'none'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                {positionWarningModal.isUnassigned ? 'Go Back & Select Position' : 'Go Back & Change Position'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Endorsed to DBM RO */}
      {confirmEndorseModal.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !endorsingToDbm) {
              setConfirmEndorseModal({ open: false, counselor: null, isBulk: false });
            }
          }}
        >
          <div
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.65)' : '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #e0e7ff',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: isDark ? 'linear-gradient(135deg, rgba(67, 56, 202, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)' : '#f8faff'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
                  Confirm Endorsement to DBM RO
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>
                  Stage of Reclassification Transmittal Action
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px' }}>
              {confirmEndorseModal.isBulk ? (
                <div>
                  <p style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: 1.5, margin: '0 0 14px' }}>
                    You are about to endorse <b>{incumbents.filter(i => {
                      const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
                      return s === 'endorsed to ro' || s === 'endorsed';
                    }).length} candidate(s)</b> to the Department of Budget and Management (DBM) Regional Office.
                  </p>
                  <div style={{
                    maxHeight: '170px',
                    overflowY: 'auto',
                    borderRadius: '8px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                    background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                    padding: '8px 12px',
                    marginBottom: '14px'
                  }}>
                    {incumbents.filter(i => {
                      const s = String(i.stage_of_reclassification || '').trim().toLowerCase();
                      return s === 'endorsed to ro' || s === 'endorsed';
                    }).map((c, idx) => (
                      <div key={c.id || idx} style={{
                        padding: '6px 0',
                        borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #e2e8f0',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{c.full_name}</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary, #94a3b8)', fontSize: '11px' }}>
                          {c.plantilla_item_number || c.employee_id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : confirmEndorseModal.counselor ? (
                <div>
                  <p style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: 1.5, margin: '0 0 14px' }}>
                    Are you sure you want to advance this candidate to <b>Endorsed to DBM RO</b>?
                  </p>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '6px', fontSize: '12.5px' }}>
                      <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 650 }}>Candidate:</span>
                      <span style={{ color: 'var(--text)', fontWeight: 750 }}>{confirmEndorseModal.counselor.full_name}</span>

                      <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 650 }}>Plantilla Item:</span>
                      <span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: 'monospace' }}>
                        {confirmEndorseModal.counselor.plantilla_item_number || confirmEndorseModal.counselor.employee_id}
                      </span>

                      <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 650 }}>Actual Reclassification Position:</span>
                      <span style={{ color: '#4338ca', fontWeight: 750 }}>
                        {confirmEndorseModal.counselor.actual_position || confirmEndorseModal.counselor.target_position || confirmEndorseModal.counselor.reclass_position || 'School Counselor'}
                      </span>

                      <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 650 }}>Current Stage:</span>
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>
                        {confirmEndorseModal.counselor.stage_of_reclassification || 'Endorsed to RO'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
                border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <span style={{ fontSize: '14px' }}>ℹ️</span>
                <span style={{ fontSize: '11.5px', color: isDark ? '#c7d2fe' : '#3730a3', lineHeight: 1.4 }}>
                  This confirmation will officially persist <b>"Endorsed to DBM RO"</b> into the candidate's <b>Stage of Reclassification</b> in the database.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setConfirmEndorseModal({ open: false, counselor: null, isBulk: false })}
                disabled={endorsingToDbm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                  color: 'var(--text)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: endorsingToDbm ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmEndorseToDbm}
                disabled={endorsingToDbm}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  cursor: endorsingToDbm ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                  opacity: endorsingToDbm ? 0.7 : 1
                }}
              >
                {endorsingToDbm ? (
                  <>
                    <div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Saving Stage...</span>
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Confirm Endorsement to DBM RO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: REVERT ENDORSEMENT */}
      {confirmRevertModal.open && confirmRevertModal.counselor && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !revertingEndorsement) setConfirmRevertModal({ open: false, counselor: null, targetStage: 'For Review' }); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 120,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff',
            borderRadius: '20px',
            width: 'min(520px, 94vw)',
            boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.65)' : '0 20px 50px rgba(0,0,0,0.18)',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              background: isDark ? 'rgba(69, 10, 10, 0.45)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              borderBottom: isDark ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>↺</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 850, color: isDark ? '#fca5a5' : '#991b1b' }}>
                    Revert Candidate Endorsement
                  </h3>
                  <div style={{ fontSize: '12px', color: isDark ? '#f87171' : '#b91c1c', marginTop: '1px' }}>
                    Regional Office Candidate Status Rollback
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRevertModal({ open: false, counselor: null, targetStage: 'For Review' })}
                disabled={revertingEndorsement}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: revertingEndorsement ? 'not-allowed' : 'pointer',
                  color: isDark ? '#f87171' : '#b91c1c'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700, textTransform: 'uppercase' }}>Candidate</span>
                  <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: '13.5px' }}>{confirmRevertModal.counselor.full_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700, textTransform: 'uppercase' }}>Current Stage</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 750,
                    padding: '2px 8px',
                    borderRadius: '5px',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                    color: isDark ? '#a5b4fc' : '#4338ca'
                  }}>
                    {confirmRevertModal.counselor.stage_of_reclassification || 'Endorsed to RO'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 700, textTransform: 'uppercase' }}>Target Revert Stage</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '5px',
                    background: confirmRevertModal.targetStage === 'For Review'
                      ? (isDark ? 'rgba(234, 179, 8, 0.2)' : '#fef9c3')
                      : (isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'),
                    color: confirmRevertModal.targetStage === 'For Review'
                      ? (isDark ? '#fef08a' : '#854d0e')
                      : (isDark ? '#a5b4fc' : '#4338ca')
                  }}>
                    ↺ {confirmRevertModal.targetStage}
                  </span>
                </div>
              </div>

              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <span style={{ fontSize: '14px' }}>⚠️</span>
                <span style={{ fontSize: '12px', color: isDark ? '#fca5a5' : '#991b1b', lineHeight: 1.45 }}>
                  {confirmRevertModal.targetStage === 'For Review'
                    ? 'Reverting to "For Review" will send this candidate back to the Division (SDO HRMO) workbench for portfolio updates and re-assessment.'
                    : 'Reverting to "Endorsed to RO" will cancel the DBM transmission and return this candidate to the Regional review queue.'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setConfirmRevertModal({ open: false, counselor: null, targetStage: 'For Review' })}
                disabled={revertingEndorsement}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
                  color: 'var(--text)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: revertingEndorsement ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRevertEndorsement}
                disabled={revertingEndorsement}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  cursor: revertingEndorsement ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                  opacity: revertingEndorsement ? 0.7 : 1
                }}
              >
                {revertingEndorsement ? (
                  <>
                    <div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Reverting...</span>
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    <span>Confirm Revert to {confirmRevertModal.targetStage}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: DOCUMENT VAULT PREVIEW FOR INCUMBENT */}
      <IncumbentDocumentVaultModal
        isOpen={showIncumbentDocsModal && !!selectedIncumbent}
        onClose={() => setShowIncumbentDocsModal(false)}
        incumbent={selectedIncumbent}
        docChecklist={docChecklist}
        setFullScreenDoc={setFullScreenDoc}
        isDark={isDark}
      />

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
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Division</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>School</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>Reclassification Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.map((row, idx) => {
                          const itemNo = row['PLANTILLA ITEM NUMBER'] || row['Plantilla Item Number'] || row['item_no'] || Object.values(row)[4] || '—';
                          const name = extractIncumbentName(row);
                          const pos = row['POSITION TITLE'] || row['Position Title'] || row['current_position'] || Object.values(row)[5] || '—';
                          const division = row['DIVISION'] || row['Division'] || row['division'] || Object.values(row)[1] || '—';
                          const schoolId = row['SCHOOL ID'] || row['School ID'] || row['school_id'] || row['schoolid'] || '—';
                          const schoolName = row['SCHOOL NAME'] || row['School Name'] || row['school_name'] || row['UACS_OPER_DSC'] || '—';
                          const target = row['RECLASS POSITION'] || row['Reclass Position'] || row['reclass_position'] || Object.values(row)[8] || 'For Review';

                          return (
                            <tr key={idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 650, color: isDark ? '#f8fafc' : '#0f172a' }}>{itemNo}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#cbd5e1' : '#334155' }}>
                                {name === '#N/A' ? <em style={{ color: '#94a3b8' }}>Unfilled / Vacant</em> : name}
                              </td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{pos}</td>
                              <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>{division}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155' }}>{schoolName}</div>
                                {schoolId !== '—' && (
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: 750,
                                    fontFamily: 'monospace',
                                    color: isDark ? '#38bdf8' : '#0369a1',
                                    background: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe',
                                    border: isDark ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid #bae6fd',
                                    padding: '1.5px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                    marginTop: '2px'
                                  }}>
                                    {schoolId}
                                  </span>
                                )}
                              </td>
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
                  padding: '18px 20px',
                  borderRadius: '16px',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                    : 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0',
                  boxShadow: isDark
                    ? '0 8px 32px -8px rgba(0, 0, 0, 0.5)'
                    : '0 8px 30px -6px rgba(16, 185, 129, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7',
                      color: isDark ? '#34d399' : '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 650, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                      {uploadStats.message}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '10px'
                  }}>
                    {/* Card 1: Total Incumbents */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                      border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #e2e8f0',
                      borderLeft: '4px solid #3b82f6',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 750 }}>Total Incumbents</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                        {uploadStats.totalInDatabase || uploadStats.insertedOrUpdated}
                      </div>
                    </div>

                    {/* Card 2: For Review */}
                    {uploadStats.metrics && (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                        border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #e2e8f0',
                        borderLeft: '4px solid #f59e0b',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 750 }}>For Review</span>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>
                          {uploadStats.metrics.forReview}
                        </div>
                      </div>
                    )}

                    {/* Card 3: Vacant / Unfilled */}
                    {uploadStats.metrics && (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                        border: isDark ? '1px solid rgba(100, 116, 139, 0.3)' : '1px solid #e2e8f0',
                        borderLeft: '4px solid #64748b',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 750 }}>Vacant / Unfilled</span>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                          </svg>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: isDark ? '#94a3b8' : '#64748b' }}>
                          {uploadStats.metrics.vacant}
                        </div>
                      </div>
                    )}

                    {/* Card 4: Abolition */}
                    {uploadStats.metrics && (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                        border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #e2e8f0',
                        borderLeft: '4px solid #ef4444',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 750 }}>Abolition</span>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>
                          {uploadStats.metrics.abolition}
                        </div>
                      </div>
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

      {/* NOSCA SCANNER & PLANTILLA ITEM SELECTION MODAL */}
      <input
        ref={noscaFileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleNoscaFileChange}
      />
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
                  <h3 style={{ fontSize: '16.5px', fontWeight: 800, margin: 0, color: isDark ? '#f8fafc' : '#1e1b4b' }}>
                    DBM NOSCA Management
                  </h3>
                  <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                    Regional Office • Plantilla Item Allocations
                  </div>
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
              {/* LEFT COLUMN: UPLOAD / MANUAL ENTRY CONTROLS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Mode Switcher: Upload PDF vs Manual Entry */}
                <div style={{
                  display: 'flex',
                  background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#eef2ff',
                  padding: '4px',
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e0e7ff',
                  gap: '4px'
                }}>
                  <button
                    type="button"
                    onClick={() => setNoscaInputMode('upload')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: noscaInputMode === 'upload' ? (isDark ? '#4f46e5' : '#ffffff') : 'transparent',
                      color: noscaInputMode === 'upload' ? (isDark ? '#ffffff' : '#4338ca') : (isDark ? '#94a3b8' : '#64748b'),
                      boxShadow: noscaInputMode === 'upload' ? (isDark ? '0 2px 8px rgba(79, 70, 229, 0.4)' : '0 2px 6px rgba(0,0,0,0.08)') : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    Upload NOSCA PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoscaInputMode('manual')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: noscaInputMode === 'manual' ? (isDark ? '#4f46e5' : '#ffffff') : 'transparent',
                      color: noscaInputMode === 'manual' ? (isDark ? '#ffffff' : '#4338ca') : (isDark ? '#94a3b8' : '#64748b'),
                      boxShadow: noscaInputMode === 'manual' ? (isDark ? '0 2px 8px rgba(79, 70, 229, 0.4)' : '0 2px 6px rgba(0,0,0,0.08)') : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Add Manually
                  </button>
                </div>

                {noscaInputMode === 'upload' ? (
                  <>
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
                            <span style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', textAlign: 'right' }}>{scannedNoscaResult.division ? scannedNoscaResult.division.replace(/^division\s*(?:of)?\s*/i, '') : 'Regional Scope'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                            <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Station</span>
                            <span style={{ fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155', textAlign: 'right', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scannedNoscaResult.school_name || 'All Stations'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                            <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Actual Reclassification Position</span>
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

                    <div style={{ textAlign: 'center', padding: '2px 0' }}>
                      <button
                        type="button"
                        onClick={() => setNoscaInputMode('manual')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isDark ? '#a5b4fc' : '#4f46e5',
                          fontSize: '12px',
                          fontWeight: 750,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                      >
                        <span>Don't have a PDF? Add Plantilla / Item No. manually</span>
                        <span>→</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* MANUAL ENTRY FORM */
                  <div style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.55)' : '#ffffff',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid #c7d2fe',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(99, 102, 241, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        boxShadow: '0 3px 10px rgba(79, 70, 229, 0.35)',
                        flexShrink: 0
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                          Add Plantilla / Item No. Manually
                        </div>
                        <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                          Enter one Plantilla Item Number to add to NOSCA
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 750, color: isDark ? '#cbd5e1' : '#334155', marginBottom: '5px' }}>
                        Plantilla Item Number <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={manualNoscaItemInput}
                        onChange={(e) => setManualNoscaItemInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddManualNoscaItems();
                          }
                        }}
                        placeholder="e.g. OSEC-DECSB-SCA1-0001-2024"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '9px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                          background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                          color: isDark ? '#f8fafc' : '#0f172a',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '3px' }}>
                        Enter one authorized Plantilla Item Number at a time.
                      </div>
                    </div>

                    {/* Category & School ID Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: manualNoscaCategory === 'JHS' ? '1fr 1fr' : '1fr',
                      gap: '10px',
                      transition: 'all 0.2s ease'
                    }}>
                      {/* Category Field on the Left Side */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155', marginBottom: '4px' }}>
                          Category <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={manualNoscaCategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualNoscaCategory(val);
                            if (val !== 'JHS') {
                              setManualNoscaSchoolId('');
                              setManualNoscaSchoolName('');
                              setManualNoscaSchoolSearch('');
                              setShowSchoolDropdown(false);
                            }
                          }}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '7px 8px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 650,
                            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                            background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="ELEMENTARY">Elementary</option>
                          <option value="JHS">JHS</option>
                          <option value="SHS">SHS</option>
                          <option value="ALS">ALS</option>
                        </select>
                      </div>

                      {/* School ID Autocomplete Field (fetched from agap_schools) - Only rendered when Category is JHS */}
                      {manualNoscaCategory === 'JHS' && (
                        <div ref={schoolSearchContainerRef} style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                              School ID
                            </label>
                            {manualNoscaSchoolId && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 750,
                                color: '#10b981',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                ✓ ID: {manualNoscaSchoolId}
                              </span>
                            )}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              value={manualNoscaSchoolSearch}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualNoscaSchoolSearch(val);
                                setShowSchoolDropdown(true);
                                if (!val.trim()) {
                                  setManualNoscaSchoolId('');
                                  setManualNoscaSchoolName('');
                                } else if (/^\d+$/.test(val.trim())) {
                                  setManualNoscaSchoolId(val.trim());
                                }
                              }}
                              onFocus={() => setShowSchoolDropdown(true)}
                              placeholder="Type School ID or School Name..."
                              style={{
                                width: '100%',
                                padding: '7px 28px 7px 9px',
                                borderRadius: '8px',
                                fontSize: '11.5px',
                                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                                background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                                color: isDark ? '#f8fafc' : '#0f172a',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />

                            {/* Spinner or Clear / Search Icon */}
                            {loadingSchools ? (
                              <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                                </svg>
                              </div>
                            ) : manualNoscaSchoolSearch ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setManualNoscaSchoolSearch('');
                                  setManualNoscaSchoolId('');
                                  setManualNoscaSchoolName('');
                                  setSchoolSuggestions([]);
                                }}
                                style={{
                                  position: 'absolute',
                                  right: '7px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  background: 'transparent',
                                  border: 'none',
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '2px',
                                  lineHeight: 1
                                }}
                                title="Clear School"
                              >
                                ✕
                              </button>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#94a3b8' : '#64748b'} strokeWidth="2.2" style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              </svg>
                            )}
                          </div>

                          {/* Autocomplete Dropdown List */}
                          {showSchoolDropdown && (
                            <div style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              right: 0,
                              minWidth: '100%',
                              width: 'max(100%, 340px)',
                              maxWidth: 'min(460px, calc(100vw - 32px))',
                              background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                              backdropFilter: 'blur(16px)',
                              border: isDark ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid #c7d2fe',
                              borderRadius: '10px',
                              boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                              maxHeight: '260px',
                              overflowY: 'auto',
                              zIndex: 60,
                              padding: '5px',
                              boxSizing: 'border-box'
                            }}>
                              {loadingSchools && schoolSuggestions.length === 0 ? (
                                <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                  Searching schools...
                                </div>
                              ) : schoolSuggestions.length > 0 ? (
                                schoolSuggestions.map((school) => {
                                  const isSelected = String(manualNoscaSchoolId) === String(school.school_id);
                                  return (
                                    <div
                                      key={school.school_id}
                                      onClick={() => handleSelectSchool(school)}
                                      title={school.school_name}
                                      style={{
                                        padding: '8px 10px',
                                        borderRadius: '7px',
                                        cursor: 'pointer',
                                        background: isSelected
                                          ? (isDark ? 'rgba(79, 70, 229, 0.25)' : '#eef2ff')
                                          : 'transparent',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '3px',
                                        transition: 'background 0.12s ease'
                                      }}
                                      onMouseOver={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9';
                                      }}
                                      onMouseOut={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                        <span style={{
                                          fontFamily: 'monospace',
                                          fontWeight: 800,
                                          fontSize: '11px',
                                          color: isDark ? '#a5b4fc' : '#4338ca',
                                          background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          flexShrink: 0,
                                          marginTop: '1px'
                                        }}>
                                          {school.school_id}
                                        </span>
                                        <span style={{
                                          fontSize: '11.5px',
                                          fontWeight: 700,
                                          color: isDark ? '#f8fafc' : '#0f172a',
                                          lineHeight: 1.35,
                                          wordBreak: 'break-word',
                                          whiteSpace: 'normal'
                                        }}>
                                          {school.school_name}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', paddingLeft: '2px', lineHeight: 1.3 }}>
                                        {school.division ? school.division.replace(/^division\s*(?:of)?\s*/i, '') : ''}{school.region ? ` • ${school.region}` : ''}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                                  {manualNoscaSchoolSearch.trim() ? 'No matching schools found.' : 'Type to search schools...'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155', marginBottom: '4px' }}>
                          Position <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={manualNoscaPosition}
                          onChange={(e) => setManualNoscaPosition(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 650,
                            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                            background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        >
                          {NOSCA_POSITION_OPTIONS.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155', marginBottom: '4px' }}>
                          Division / Scope (Optional)
                        </label>
                        <input
                          type="text"
                          value={manualNoscaDivision}
                          onChange={(e) => setManualNoscaDivision(e.target.value)}
                          placeholder={sdoDivisionFilter && sdoDivisionFilter !== 'ALL' ? sdoDivisionFilter : 'Regional Scope'}
                          style={{
                            width: '100%',
                            padding: '7px 8px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                            background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleAddManualNoscaItems()}
                        style={{
                          flex: 1,
                          padding: '9px 14px',
                          borderRadius: '9px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 750,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 3px 12px rgba(79, 70, 229, 0.35)'
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add to Plantilla List
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoscaInputMode('upload')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '9px',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                          background: 'transparent',
                          color: isDark ? '#cbd5e1' : '#475569',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Switch to PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: SCANNED / MANUALLY ADDED NOSCA RESULTS */}
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
                          {scannedNoscaResult.division ? scannedNoscaResult.division.replace(/^division\s*(?:of)?\s*/i, '') : 'Regional Scope'}
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
                          Actual Reclassification Position
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

                    {/* Toolbar: Category Filters, Search, Select/Deselect All, + Add Manually, and Bulk Remove */}
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
                          { key: 'ALS', label: 'ALS', count: scannedNoscaResult.category_breakdown?.ALS?.length || 0 },
                          ...(scannedNoscaResult.category_breakdown?.MANUAL?.length ? [
                            { key: 'MANUAL', label: 'Manual', count: scannedNoscaResult.category_breakdown.MANUAL.length }
                          ] : [])
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

                      {/* Action controls: Select All, Add Manually, Search, and Bulk Remove */}
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

                        <button
                          type="button"
                          onClick={() => setShowQuickAddInline(prev => !prev)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '7px',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                            background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                            color: isDark ? '#6ee7b7' : '#047857',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Add a Plantilla Item Number directly to this list"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          + Add Manually
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

                    {/* Quick Inline Item Add Bar */}
                    {showQuickAddInline && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(30, 41, 59, 0.85)' : '#f0fdf4',
                        border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: isDark ? '#6ee7b7' : '#047857', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>Quick Item Entry:</span>
                        </div>
                        <input
                          type="text"
                          value={quickAddInlineInput}
                          onChange={(e) => setQuickAddInlineInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddManualNoscaItems(quickAddInlineInput, quickAddInlineCategory);
                            }
                          }}
                          placeholder="e.g. OSEC-DECSB-SCA1-0001-2024"
                          style={{
                            flex: 1,
                            minWidth: '220px',
                            padding: '6px 10px',
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                            background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            outline: 'none'
                          }}
                        />
                        <select
                          value={quickAddInlineCategory}
                          onChange={(e) => setQuickAddInlineCategory(e.target.value)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '7px',
                            fontSize: '11px',
                            border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                            background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            outline: 'none'
                          }}
                        >
                          <option value="ELEMENTARY">Elementary</option>
                          <option value="JHS">JHS</option>
                          <option value="SHS">SHS</option>
                          <option value="ALS">ALS</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAddManualNoscaItems(quickAddInlineInput, quickAddInlineCategory)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '7px',
                            border: 'none',
                            background: '#10b981',
                            color: '#ffffff',
                            fontSize: '11.5px',
                            fontWeight: 750,
                            cursor: 'pointer'
                          }}
                        >
                          Add Item
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddInline(false)}
                          style={{
                            padding: '6px 9px',
                            borderRadius: '7px',
                            border: 'none',
                            background: 'transparent',
                            color: isDark ? '#94a3b8' : '#64748b',
                            fontSize: '11.5px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Items Selection Table */}
                    <div style={{
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      maxHeight: '380px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '34px' }} />
                            <col style={{ width: '42%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '26%' }} />
                            <col style={{ width: '36px' }} />
                          </colgroup>
                          <thead style={{ position: 'sticky', top: 0, background: isDark ? 'rgba(30, 41, 59, 0.98)' : '#f8fafc', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0', zIndex: 2 }}>
                            <tr>
                              <th style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={filteredNoscaItems.length > 0 && filteredNoscaItems.every(i => selectedNoscaItems.includes(i))}
                                  onChange={toggleSelectAllNoscaItems}
                                  style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: '#4f46e5' }}
                                />
                              </th>
                              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Item Number
                              </th>
                              <th style={{ padding: '6px 6px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Category
                              </th>
                              <th style={{ padding: '6px 6px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Status
                              </th>
                              <th style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredNoscaItems.length > 0 ? (
                              filteredNoscaItems.map((item, idx) => {
                                const isSelected = selectedNoscaItems.includes(item);
                                const isMatched = incumbents?.some(inc => inc.plantilla_item_number && String(inc.plantilla_item_number).trim().toLowerCase() === String(item).trim().toLowerCase());
                                const isManuallyAdded = manuallyAddedNoscaItems.has(item);
                                
                                let itemCat = 'ELEMENTARY';
                                if (scannedNoscaResult.category_breakdown?.JHS?.includes(item)) itemCat = 'JHS';
                                else if (scannedNoscaResult.category_breakdown?.SHS?.includes(item)) itemCat = 'SHS';
                                else if (scannedNoscaResult.category_breakdown?.ALS?.includes(item)) itemCat = 'ALS';
                                else if (scannedNoscaResult.category_breakdown?.MANUAL?.includes(item)) itemCat = 'MANUAL';

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
                                    <td style={{ textAlign: 'center', padding: '5px 4px' }} onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectNoscaItem(item)}
                                        style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: '#4f46e5' }}
                                      />
                                    </td>
                                    <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' }}>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', maxWidth: '100%', overflow: 'hidden' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</span>
                                        {isManuallyAdded && itemCat !== 'MANUAL' && (
                                          <span style={{
                                            fontSize: '9px',
                                            fontWeight: 800,
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            background: isDark ? 'rgba(168, 85, 247, 0.25)' : '#f3e8ff',
                                            color: isDark ? '#d8b4fe' : '#7e22ce',
                                            border: isDark ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid #e9d5ff',
                                            flexShrink: 0
                                          }}>
                                            Manual
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                                      <span style={{
                                        fontSize: '9.5px',
                                        fontWeight: 750,
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                        background: itemCat === 'SHS' ? (isDark ? 'rgba(217, 119, 6, 0.2)' : '#fef3c7') : itemCat === 'JHS' ? (isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe') : itemCat === 'ALS' ? (isDark ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff') : itemCat === 'MANUAL' ? (isDark ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff') : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5'),
                                        color: itemCat === 'SHS' ? (isDark ? '#fde68a' : '#b45309') : itemCat === 'JHS' ? (isDark ? '#bfdbfe' : '#1d4ed8') : itemCat === 'ALS' ? (isDark ? '#e9d5ff' : '#7e22ce') : itemCat === 'MANUAL' ? (isDark ? '#d8b4fe' : '#7e22ce') : (isDark ? '#a7f3d0' : '#047857')
                                      }}>
                                        {itemCat}
                                      </span>
                                    </td>
                                    <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                                      {isMatched ? (
                                        <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1.5px 6px', borderRadius: '4px', background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7', color: isDark ? '#6ee7b7' : '#15803d' }}>
                                          ✓ In DB
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: '9.5px', fontWeight: 750, padding: '1.5px 6px', borderRadius: '4px', background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff', color: isDark ? '#a5b4fc' : '#4338ca' }}>
                                          + New
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '5px 4px' }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => handleRequestRemoveItem(item)}
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: 'pointer',
                                          color: isDark ? '#f87171' : '#ef4444',
                                          padding: '2px',
                                          borderRadius: '4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'background 0.15s ease'
                                        }}
                                        title={`Remove item ${item} from this batch`}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
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
                                <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' }}>
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

                    {/* Manual Entry Callout Option */}
                    <div style={{
                      marginTop: '20px',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: isDark ? 'rgba(99, 102, 241, 0.12)' : '#eef2ff',
                      border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid #c7d2fe',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      maxWidth: '400px',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(99, 102, 241, 0.25)' : '#e0e7ff',
                        color: isDark ? '#a5b4fc' : '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: isDark ? '#f8fafc' : '#1e1b4b' }}>
                          Need to add item numbers manually?
                        </div>
                        <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                          Enter or paste Plantilla / Item numbers directly without a PDF file.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNoscaInputMode('manual')}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 750,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Add Manually
                      </button>
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
                        setManuallyAddedNoscaItems(new Set());
                        setManualNoscaItemInput('');
                        setShowQuickAddInline(false);
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
                <span style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a' }}>{scannedNoscaResult?.division ? scannedNoscaResult.division.replace(/^division\s*(?:of)?\s*/i, '') : 'Regional Office'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>Actual Reclassification Position:</span>
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

      {/* STATION MISMATCH ERROR POPUP MODAL */}
      {stationMismatchModal.open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setStationMismatchModal(prev => ({ ...prev, open: false }));
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: '20px',
            width: 'min(620px, 94vw)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 26px 16px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: isDark ? '#f8fafc' : '#0f172a' }}>
                    {stationMismatchModal.hasDuplicateItems && stationMismatchModal.hasStationMismatch
                      ? 'Duplicate Item Numbers & Station Mismatch'
                      : (stationMismatchModal.hasDuplicateItems ? 'Duplicate Item Numbers Detected' : 'Station Mismatch Detected')}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setStationMismatchModal(prev => ({ ...prev, open: false }))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isDark ? '#94a3b8' : '#64748b',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: isDark ? '#cbd5e1' : '#64748b' }}>
                  {stationMismatchModal.hasDuplicateItems && stationMismatchModal.hasStationMismatch
                    ? <>The uploaded file <b>{stationMismatchModal.fileName}</b> contains repeated Plantilla Item Numbers and station mismatches. In <b>reclass_gc</b>, the item_no must not repeat.</>
                    : (stationMismatchModal.hasDuplicateItems
                        ? <>The uploaded file <b>{stationMismatchModal.fileName}</b> contains duplicate Plantilla Item Numbers. In <b>reclass_gc</b>, each item_no must be unique and must not repeat.</>
                        : <>The uploaded file <b>{stationMismatchModal.fileName}</b> contains records that do not belong to your assigned division.</>
                      )}
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Station Comparison Box */}
              <div style={{
                background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                fontSize: '12.5px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Rule & Station Requirement
                  </span>
                  <span style={{ fontWeight: 800, color: '#10b981', fontSize: '13px' }}>
                    Unique Item No • {stationMismatchModal.expectedDivision || 'Assigned Division'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Invalid / Duplicate Entries Found
                  </span>
                  <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '13px' }}>
                    {stationMismatchModal.mismatchCount} record(s) out of {stationMismatchModal.totalRows}
                  </span>
                </div>
              </div>

              {/* Mismatch Records Table */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569', marginBottom: '8px' }}>
                  Issues Identified in CSV:
                </div>
                <div style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ background: isDark ? 'rgba(30, 41, 59, 0.9)' : '#f1f5f9', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>Row</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>Item No / Name</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 750, color: '#ef4444' }}>Found in File</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 750, color: '#ef4444' }}>Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationMismatchModal.mismatches.map((m, i) => (
                        <tr key={i} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                            Line {m.rowNumber}
                          </td>
                          <td style={{ padding: '6px 10px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                            <div style={{ fontWeight: 650 }}>{m.itemNo}</div>
                            {m.name && m.name !== '—' && <div style={{ fontSize: '10.5px', color: isDark ? '#94a3b8' : '#64748b' }}>{m.name}</div>}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#ef4444', fontWeight: 650 }}>
                            {m.foundRegion} • {m.foundDivision}
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                              color: '#ef4444',
                              fontSize: '10.5px',
                              fontWeight: 750
                            }}>
                              {m.mismatchType}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Instructions banner */}
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
                fontSize: '12px',
                color: isDark ? '#fca5a5' : '#991b1b',
                lineHeight: 1.4
              }}>
                <b>Action Required:</b> Please open your CSV file, ensure every <b>item_no is unique and not repeating</b> and belongs to <b>{stationMismatchModal.expectedDivision || 'your assigned division'}</b>, then re-drag or re-drop the file.
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 26px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setStationMismatchModal(prev => ({ ...prev, open: false }));
                  const dropzoneEl = document.getElementById('step1-reclass-csv-input')?.parentElement;
                  if (dropzoneEl) dropzoneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>Check File & Re-drag / Re-drop</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INGESTION SUCCESS POPUP MODAL */}
      {ingestionSuccessModal.open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIngestionSuccessModal(prev => ({ ...prev, open: false }));
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div style={{
            background: isDark ? '#0f172a' : '#ffffff',
            borderRadius: '20px',
            width: 'min(680px, 95vw)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 26px 18px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                color: isDark ? '#34d399' : '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: isDark ? '#f8fafc' : '#0f172a' }}>
                    All Incumbents Added Successfully!
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIngestionSuccessModal(prev => ({ ...prev, open: false }))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isDark ? '#94a3b8' : '#64748b',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: isDark ? '#cbd5e1' : '#64748b' }}>
                  Successfully imported from <b>{ingestionSuccessModal.fileName}</b>.
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Summary Stats Grid - 2 KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#6ee7b7' : '#065f46', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Newly Added
                  </span>
                  <span style={{ fontWeight: 850, color: isDark ? '#34d399' : '#059669', fontSize: '22px' }}>
                    +{ingestionSuccessModal.insertedOrUpdated}
                  </span>
                </div>

                <div style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 750, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Total Incumbent
                  </span>
                  <span style={{ fontWeight: 850, color: isDark ? '#f8fafc' : '#0f172a', fontSize: '22px' }}>
                    {ingestionSuccessModal.totalInDatabase || ingestionSuccessModal.insertedOrUpdated}
                  </span>
                </div>
              </div>

              {/* Added Items List Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Incumbents Added to Inventory ({ingestionSuccessModal.addedItems?.length || ingestionSuccessModal.insertedOrUpdated})
                  </span>
                </div>

                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ background: isDark ? 'rgba(30, 41, 59, 0.9)' : '#f8fafc', borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>Item Number</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>Incumbent</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>Current Position</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>Reclassification Position</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 750, color: isDark ? '#94a3b8' : '#475569' }}>School / Division</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ingestionSuccessModal.addedItems && ingestionSuccessModal.addedItems.length > 0) ? (
                        ingestionSuccessModal.addedItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 750, color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'monospace' }}>
                              {item.itemNo}
                            </td>
                            <td style={{ padding: '8px 12px', color: isDark ? '#cbd5e1' : '#334155' }}>
                              {item.name === '#N/A' || item.name === 'VACANT' ? (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unfilled / Vacant</span>
                              ) : (
                                <span style={{ fontWeight: 650 }}>{item.name}</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                              {item.currentPosition}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '10.5px',
                                fontWeight: 750,
                                background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                                color: isDark ? '#a5b4fc' : '#4338ca'
                              }}>
                                {item.targetPosition || 'For Review'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                              <div>{item.schoolName || '—'}</div>
                              {item.division && <div style={{ fontSize: '10px', color: isDark ? '#64748b' : '#94a3b8' }}>{item.division}</div>}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
                            {ingestionSuccessModal.insertedOrUpdated} records committed to reclass_gc database table.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 26px',
              borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #f1f5f9',
              background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setIngestionSuccessModal(prev => ({ ...prev, open: false }))}
                style={{
                  background: isDark ? 'rgba(51, 65, 85, 0.6)' : '#f1f5f9',
                  border: isDark ? '1px solid rgba(71, 85, 105, 0.7)' : '1px solid #cbd5e1',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: isDark ? '#cbd5e1' : '#475569',
                  cursor: 'pointer'
                }}
              >
                Close / Stay on Step 1
              </button>

              <button
                type="button"
                onClick={() => {
                  setIngestionSuccessModal(prev => ({ ...prev, open: false }));
                  setCurrentStep(2);
                }}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)'
                }}
              >
                <span>Proceed to Step 2: Assessment Workbench</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
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
