import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../../config/api.js';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import agadLogo from '../../../agadlogo.png';
import FullScreenDocViewer from '../../../components/FullScreenDocViewer.jsx';
import HqBackground from '../../../components/HqBackground.jsx';
import ThemeToggle from '../../../components/ThemeToggle.jsx';
import { useTheme } from '../../../middleware/ThemeProvider.jsx';
import IncumbentDocumentVaultModal from '../components/IncumbentDocumentVaultModal.jsx';

const ALL_RECLASS_STAGES = [
  'For Review',
  'Endorsed to RO',
  'Endorsed to DBM RO',
  'Endorsed to SDO'
];
const HRMO_RECLASS_STAGES = ['For Review', 'Endorsed to RO'];
const RO_RECLASS_STAGES = ['Endorsed to DBM RO', 'Endorsed to SDO'];
const APPROVED_POST_ACTION_STAGES = ['Approved'];
const RECLASS_POSITIONS_OPTIONS = ['School Counselor I', 'School Counselor II', 'School Counselor III', 'School Counselor IV'];
const NOSCA_POSITION_OPTIONS = [
  'School Counselor Associate I',
  'School Counselor I',
  'School Counselor II',
  'School Counselor III',
  'School Counselor IV',
  'Guidance Counselor I',
  'Guidance Coordinator III'
];

const DEFAULT_REQUIRED_DOCUMENTS = [
  // Required requirements (5 items - unlock QS Evaluation)
  { id: 'loi', label: 'Letter of intent addressed to the Head of Office or highest human resource officer', required: true },
  { id: 'pds', label: 'Duly accomplished Personal Data Sheet (PDS, CS Form No. 212, Revised 2017) and Work Experience Sheet, if applicable', required: true },
  { id: 'eligibility', label: 'Photocopy of Certificate of Eligibility/Report of Rating, if applicable', required: true },
  { id: 'tor', label: 'Photocopy of scholastic/academic records such as Transcript of Records (TOR) and Diploma, including graduate and post-graduate units/degrees, if available', required: true },
  { id: 'cav', label: 'Checklist of Requirements and Omnibus Sworn Statement on the CAV of documents submitted and Data Privacy Consent Form', required: true },

  // Other requirements (6 items - total 11 items)
  { id: 'prc', label: 'Photocopy of valid and updated PRC License/ID, if applicable', required: false },
  { id: 'training', label: 'Photocopy of Certificate/s of Training, if applicable', required: false },
  { id: 'employment', label: 'Photocopy of Certificate of Employment, Contract of Service, or duly signed Service Record, whichever is/are applicable', required: false },
  { id: 'appointment', label: 'Photocopy of latest appointment, if applicable', required: false },
  { id: 'performance', label: 'Photocopy of the Performance Rating in the last rating period(s) covering one (1) year performance prior to the deadline of submission, if applicable', required: false },
  { id: 'other', label: 'Other documents as may be required for comparative assessment (e.g. MOVs, or Performance Rating from relevant work experience)', required: false }
];

const POSITION_QS_STANDARDS = {
  'School Counselor Associate I': {
    education: "Bachelor's degree in Guidance and Counseling or related Social Sciences (Psychology, Sociology)",
    experience: "None required (or 1 year of relevant guidance experience)",
    training: "None required (or 4 hours of relevant training)",
    eligibility: "Career Service (Professional) / RA 1080 / None required as per CSC MC"
  },
  'School Counselor I': {
    education: "Bachelor's degree in Counseling or Master's units in Guidance and Counseling",
    experience: "1 year of relevant experience in counseling / guidance services",
    training: "4 hours of relevant training in counseling, psychological first aid, or guidance",
    eligibility: "RA 1080 (Registered Guidance Counselor) or PBET / LET with Guidance specialization"
  },
  'School Counselor II': {
    education: "Master's degree in Guidance and Counseling or allied field",
    experience: "2 years of relevant professional guidance and counseling experience",
    training: "8 hours of relevant training in counseling or mental health facilitation",
    eligibility: "RA 1080 (Registered Guidance Counselor - RGC)"
  },
  'School Counselor III': {
    education: "Master's degree in Guidance and Counseling",
    experience: "3 years of relevant professional guidance and counseling experience",
    training: "16 hours of relevant training in clinical supervision or counseling management",
    eligibility: "RA 1080 (Registered Guidance Counselor - RGC)"
  },
  'School Counselor IV': {
    education: "Master's degree in Guidance and Counseling with doctoral units",
    experience: "4 years of relevant professional guidance and counseling experience",
    training: "24 hours of relevant advanced training in guidance and administrative leadership",
    eligibility: "RA 1080 (Registered Guidance Counselor - RGC)"
  },
  'Guidance Coordinator III': {
    education: "Master's degree in Guidance and Counseling",
    experience: "3 years of relevant experience in coordinating guidance services",
    training: "16 hours of relevant training",
    eligibility: "RA 1080 (Registered Guidance Counselor) / PBET / LET"
  }
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
  const [manualNoscaPosition, setManualNoscaPosition] = useState('School Counselor Associate I');
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
  const [updatingDbmStatusId, setUpdatingDbmStatusId] = useState(null);
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

  // Modal assessment decisions state
  const [modalTargetPosition, setModalTargetPosition] = useState('');
  const [modalStage, setModalStage] = useState('For Review');
  const [savingModalChanges, setSavingModalChanges] = useState(false);
  const [showIncumbentDocsModal, setShowIncumbentDocsModal] = useState(false);
  const [selectedVaultDocKey, setSelectedVaultDocKey] = useState('pds');

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

  // Automated Profile-to-QS Evaluation (Runs automatically in background from candidate profile)
  const computeAutoQs = (candidate, targetPositionName) => {
    if (!candidate) return { education: null, experience: null, training: null, eligibility: null };
    const targetPos = targetPositionName || candidate.target_position || candidate.reclass_position || 'School Counselor I';
    const eduStr = String(candidate.education || candidate.assessment?.education || '').toLowerCase();
    const expVal = Number(candidate.years_experience ?? candidate.assessment?.years_experience ?? 0);
    const trnVal = Number(candidate.hours_of_training ?? candidate.assessment?.hours_of_training ?? 0);
    const eligStr = String(candidate.eligibility || candidate.assessment?.eligibility || '').toLowerCase();

    // Education evaluation
    let eduMeets = false;
    if (targetPos.includes('Associate') || targetPos === 'School Counselor I') {
      eduMeets = eduStr.length > 3;
    } else {
      eduMeets = eduStr.includes('master') || eduStr.includes('ms') || eduStr.includes('ma') || eduStr.includes('phd') || eduStr.includes('doctor') || eduStr.includes('post');
    }

    // Experience evaluation
    let reqYears = 0;
    if (targetPos.includes('Associate I') || targetPos === 'School Counselor I') reqYears = 0;
    else if (targetPos.includes('Associate II') || targetPos === 'School Counselor II') reqYears = 1;
    else if (targetPos.includes('Associate III') || targetPos === 'School Counselor III') reqYears = 2;
    else if (targetPos.includes('Associate IV') || targetPos === 'School Counselor IV') reqYears = 3;
    else if (targetPos.includes('Coordinator')) reqYears = 3;
    else reqYears = 1;
    const expMeets = expVal >= reqYears;

    // Training evaluation
    let reqHours = 0;
    if (targetPos.includes('Associate I') || targetPos === 'School Counselor I') reqHours = 0;
    else if (targetPos.includes('Associate II') || targetPos === 'School Counselor II') reqHours = 4;
    else if (targetPos.includes('Associate III') || targetPos === 'School Counselor III') reqHours = 8;
    else if (targetPos.includes('Associate IV') || targetPos === 'School Counselor IV') reqHours = 16;
    else if (targetPos.includes('Coordinator')) reqHours = 16;
    else reqHours = 4;
    const trnMeets = trnVal >= reqHours;

    // Eligibility evaluation
    let eligMeets = false;
    if (targetPos.includes('Associate')) {
      eligMeets = eligStr.includes('prof') || eligStr.includes('2nd') || eligStr.includes('csc') || eligStr.includes('career') || eligStr.includes('let') || eligStr.includes('pbet') || eligStr.includes('1080') || eligStr.includes('rgc') || eligStr.length > 0;
    } else {
      eligMeets = eligStr.includes('1080') || eligStr.includes('rgc') || eligStr.includes('guidance counselor') || eligStr.includes('licensed');
    }

    return {
      education: eduMeets ? 'Meets' : 'Does Not Meet',
      experience: expMeets ? 'Meets' : 'Does Not Meet',
      training: trnMeets ? 'Meets' : 'Does Not Meet',
      eligibility: eligMeets ? 'Meets' : 'Does Not Meet'
    };
  };

  // Determine Indicative Position based on candidate qualifications
  const determineIndicativePosition = (candidate) => {
    if (!candidate) return 'School Counselor I';
    const eduStr = String(candidate.education || candidate.assessment?.education || '').toLowerCase();
    const expVal = Number(candidate.years_experience ?? candidate.assessment?.years_experience ?? 0);
    const trnVal = Number(candidate.hours_of_training ?? candidate.assessment?.hours_of_training ?? 0);
    const eligStr = String(candidate.eligibility || candidate.assessment?.eligibility || '').toLowerCase();
    const targetPos = String(candidate.target_position || candidate.reclass_position || '');

    const isRGC = eligStr.includes('1080') || eligStr.includes('rgc') || eligStr.includes('guidance counselor') || eligStr.includes('licensed');
    const hasMasters = eduStr.includes('master') || eduStr.includes('ms') || eduStr.includes('ma') || eduStr.includes('phd') || eduStr.includes('doctor') || eduStr.includes('post');

    if (isRGC) {
      if (targetPos.includes('Coordinator') && hasMasters && expVal >= 3 && trnVal >= 16) {
        return 'Guidance Coordinator III';
      }
      if (hasMasters) {
        if (expVal >= 3 && trnVal >= 16) return 'School Counselor IV';
        if (expVal >= 2 && trnVal >= 8) return 'School Counselor III';
        if (expVal >= 1 && trnVal >= 4) return 'School Counselor II';
      }
      return 'School Counselor I';
    } else {
      // School Counselor Associate Pathway
      if (expVal >= 3 && trnVal >= 16) return 'School Counselor Associate IV';
      if (expVal >= 2 && trnVal >= 8) return 'School Counselor Associate III';
      if (expVal >= 1 && trnVal >= 4) return 'School Counselor Associate II';
      return 'School Counselor Associate I';
    }
  };

  // Sync modal state when an incumbent is opened
  useEffect(() => {
    if (selectedIncumbent) {
      const initialPos = selectedIncumbent.actual_position || selectedIncumbent.reclass_position || selectedIncumbent.target_position || determineIndicativePosition(selectedIncumbent) || '';
      setModalTargetPosition(initialPos);
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
          const match = savedDocs.find(d => (d.id || d.key) === def.id || (def.id === 'training' && (d.id === 'training_cert' || d.id === 'seminar_cert')));
          if (match) {
            const isDone = Boolean(match.submitted ?? match.verified ?? match.checked);
            return {
              ...def,
              submitted: isDone,
              verified: isDone
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
          submitted: hasAttachment,
          verified: hasAttachment
        };
      });
      setDocChecklist(initialChecklist);

      // Initialize QS Evaluation (Preserve saved evaluation or evaluate automatically in background from profile)
      const autoComputed = computeAutoQs(selectedIncumbent, initialPos);
      if (
        selectedIncumbent.qs_evaluation &&
        typeof selectedIncumbent.qs_evaluation === 'object' &&
        (selectedIncumbent.qs_evaluation.education || selectedIncumbent.qs_evaluation.experience || selectedIncumbent.qs_evaluation.training || selectedIncumbent.qs_evaluation.eligibility)
      ) {
        setQsEvaluation({
          education: selectedIncumbent.qs_evaluation.education || autoComputed.education,
          experience: selectedIncumbent.qs_evaluation.experience || autoComputed.experience,
          training: selectedIncumbent.qs_evaluation.training || autoComputed.training,
          eligibility: selectedIncumbent.qs_evaluation.eligibility || autoComputed.eligibility
        });
      } else {
        setQsEvaluation(autoComputed);
      }

      setEvaluatorRemarks(selectedIncumbent.evaluator_remarks || '');
      const defaultEvalName = currentUser?.name || currentUser?.fullName || [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || 'Division HRMO';
      setEvaluatorName(selectedIncumbent.evaluated_by || defaultEvalName);
    }
  }, [selectedIncumbent, currentUser]);

  // Helper callbacks for Document Checklist
  const handleToggleDocCheck = (docId) => {
    if (isRegionalOffice) return;
    setDocChecklist(prev =>
      prev.map(item => {
        if (item.id === docId) {
          const isCurrentlyDone = Boolean(item.submitted && item.verified);
          const nextVal = !isCurrentlyDone;
          return {
            ...item,
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
    setDocChecklist(prev =>
      prev.map(item => ({ ...item, submitted: true, verified: true }))
    );
  };

  const handleResetAllDocs = () => {
    setDocChecklist(prev =>
      prev.map(item => ({ ...item, submitted: false, verified: false }))
    );
  };

  const handleSetQsCriterion = (criterionKey, value) => {
    setQsEvaluation(prev => ({
      ...prev,
      [criterionKey]: prev[criterionKey] === value ? null : value
    }));
  };

  // Automated Profile-to-QS Evaluation Helper
  const handleAutoEvaluateQs = (posOverride) => {
    if (!selectedIncumbent) return;
    const targetPos = posOverride || modalTargetPosition || selectedIncumbent.target_position || selectedIncumbent.reclass_position || 'School Counselor I';
    const computed = computeAutoQs(selectedIncumbent, targetPos);
    setQsEvaluation(computed);
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

  // Workflow Stepper state: 1 = CSV Ingestion, 2 = Assessment Workbench, 3 = DBM Endorsement
  // Regional Office defaults to Step 3, with View-Only permissions for Steps 1 & 2
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

  // Load Available NOSCA Plantilla Items from dedicated table
  const fetchNoscaItems = async () => {
    setLoadingNoscaItems(true);
    try {
      const data = await apiFetch('/api/reclassification/nosca-items?status=AVAILABLE');
      if (Array.isArray(data)) {
        setNoscaItems(data);
      }
    } catch (err) {
      console.error('[Reclass] Error loading NOSCA items:', err);
    } finally {
      setLoadingNoscaItems(false);
    }
  };

  useEffect(() => {
        fetchIncumbents();
    fetchNoscaItems();
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
      setManualNoscaDivision(school.division.toLowerCase().startsWith('division') ? school.division : `Division of ${school.division}`);
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

    // 1. From active scanned / uploaded NOSCA batch in current session
    if (scannedNoscaResult?.items && Array.isArray(scannedNoscaResult.items)) {
      scannedNoscaResult.items.forEach(item => {
        const str = String(item).trim();
        if (str && !seen.has(str.toLowerCase())) {
          seen.add(str.toLowerCase());
          list.push({
            itemNo: str,
            source: scannedNoscaResult.serial_no ? `NOSCA #${scannedNoscaResult.serial_no}` : (scannedNoscaResult.fileName || 'Scanned NOSCA'),
            division: scannedNoscaResult.division || '',
            category: 'NOSCA Allocation',
            isNA: str.toUpperCase() === '#N/A' || str.toUpperCase() === 'N/A'
          });
        }
      });
    }

    // 2. From dedicated reclassification_nosca_items table (Available items)
    if (Array.isArray(noscaItems)) {
      noscaItems.forEach(item => {
        const itemNo = (item.plantilla_item_number || '').trim();
        if (itemNo && !seen.has(itemNo.toLowerCase())) {
          seen.add(itemNo.toLowerCase());
          list.push({
            itemNo,
            source: item.serial_no ? `NOSCA #${item.serial_no}` : 'NOSCA Allocation',
            division: item.division || '',
            category: item.category || 'ELEMENTARY',
            isNA: itemNo.toUpperCase() === '#N/A' || itemNo.toUpperCase() === 'N/A'
          });
        }
      });
    }

    return list;
  }, [scannedNoscaResult, noscaItems]);

  // Update incumbent counselor DBM status ('With DBM Request' or 'With DBM NOSCA')
  const handleUpdateIncumbentDbmStatus = async (incumbentId, newStatus, assignedItemNo = null, e = null) => {
    if (e) e.stopPropagation();
    const previousIncumbents = [...incumbents];
    const formattedStatus = (newStatus === '' || newStatus === 'None') ? null : newStatus;
    const isNosca = formattedStatus === 'With DBM NOSCA';
    const cleanItem = (typeof assignedItemNo === 'string' && assignedItemNo.trim()) ? assignedItemNo.trim() : null;

    // Optimistic UI update
    setIncumbents(prev =>
      prev.map(item => {
        if (item.id === incumbentId) {
          return {
            ...item,
            dbm_status: formattedStatus,
            ...(isNosca ? { stage_of_reclassification: 'Approved' } : {}),
            ...(cleanItem ? { plantilla_item_number: cleanItem } : {})
          };
        }
        return item;
      })
    );
    if (selectedIncumbent && selectedIncumbent.id === incumbentId) {
      setSelectedIncumbent(prev => ({
        ...prev,
        dbm_status: formattedStatus,
        ...(isNosca ? { stage_of_reclassification: 'Approved' } : {}),
        ...(cleanItem ? { plantilla_item_number: cleanItem } : {})
      }));
    }

    setUpdatingDbmStatusId(incumbentId);
    try {
      const payload = { dbm_status: formattedStatus };
      if (cleanItem) {
        payload.plantilla_item_number = cleanItem;
      }
      const updated = await apiFetch(`/api/reclassification/incumbents/${incumbentId}/dbm-status`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (updated && updated.stage_of_reclassification) {
        setIncumbents(prev =>
          prev.map(item => item.id === incumbentId ? { ...item, ...updated } : item)
        );
      }
      fetchNoscaItems();
      setToast({
        type: 'success',
        message: isNosca
          ? `DBM status set to "With DBM NOSCA"${cleanItem ? ` (Item: ${cleanItem})` : ''} and stage updated to "Approved"!`
          : (formattedStatus ? `DBM status set to "${formattedStatus}"` : 'DBM status reset')
      });
    } catch (err) {
      console.error('[Reclass] Error updating DBM status:', err);
      setIncumbents(previousIncumbents);
      if (selectedIncumbent && selectedIncumbent.id === incumbentId) {
        const orig = previousIncumbents.find(i => i.id === incumbentId);
        if (orig) setSelectedIncumbent(orig);
      }
      setToast({
        type: 'error',
        message: err.message || 'Failed to update DBM status'
      });
    } finally {
      setUpdatingDbmStatusId(null);
    }
  };

  // Open item assignment modal if With DBM NOSCA is selected
  const handleDbmStatusSelectChange = (counselor, newStatus, e) => {
    if (e) e.stopPropagation();
    if (newStatus === 'With DBM NOSCA') {
      const currentItem = (counselor.plantilla_item_number || '').trim();
      const isItemNA = !currentItem || currentItem.toUpperCase() === '#N/A' || currentItem.toUpperCase() === 'N/A';
      setNoscaItemAssignModal({ open: true, personnel: counselor });
      setSelectedNoscaItemNo(isItemNA ? '' : currentItem);
      setCustomPlantillaNo(isItemNA ? '' : currentItem);
      setIsCustomItemNo(isItemNA || availableNoscaItemOptions.length === 0);
      setItemSearchTerm('');
    } else {
      handleUpdateIncumbentDbmStatus(counselor.id, newStatus, null, e);
    }
  };

  // Confirm NOSCA Item Assignment
  const handleConfirmNoscaItemAssignment = async () => {
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
      await handleUpdateIncumbentDbmStatus(counselor.id, 'With DBM NOSCA', finalItem);
      setNoscaItemAssignModal({ open: false, personnel: null });
      fetchNoscaItems();
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

  // Save assessment changes from modal
  const handleSaveModalChanges = async () => {
    if (!selectedIncumbent) return;
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

      setToast({
        type: 'success',
        message: `Assessment & QS Evaluation saved for ${selectedIncumbent.full_name}! (${overallStatus})`
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
        (inc.target_position || inc.reclass_position)?.toLowerCase().includes(q) ||
        (inc.salary_grade && `sg ${inc.salary_grade}`.includes(q));

      const matchStage = !incumbentStageFilter || inc.stage_of_reclassification === incumbentStageFilter;
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
    const total = incumbents.length;
    const forReview = incumbents.filter((i) => i.stage_of_reclassification === 'For Review').length;
    const endorsedToRO = incumbents.filter((i) => i.stage_of_reclassification === 'Endorsed to RO' || i.stage_of_reclassification === 'Endorsed').length;
    const endorsedToDbm = incumbents.filter((i) => i.stage_of_reclassification === 'Endorsed to DBM RO').length;
    const endorsedToSdo = incumbents.filter((i) => i.stage_of_reclassification === 'Endorsed to SDO').length;
    const approved = incumbents.filter((i) => i.stage_of_reclassification === 'Approved').length;
    const denied = incumbents.filter((i) => i.stage_of_reclassification === 'Denied').length;
    const vacant = incumbents.filter((i) => i.stage_of_reclassification === 'Unfilled / Vacant' || i.full_name === '#N/A').length;
    return {
      total,
      forReview,
      endorsedToRO,
      endorsedToDbm,
      endorsedToSdo,
      endorsed: endorsedToRO + endorsedToDbm + endorsedToSdo,
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
  const isStep2Done = currentStep > 2 || incumbents.some(i => 
    i.stage_of_reclassification === 'Endorsed to RO' || 
    i.stage_of_reclassification === 'Endorsed to DBM RO' ||
    i.stage_of_reclassification === 'Endorsed to SDO' ||
    i.stage_of_reclassification === 'Endorsed' || 
    i.stage_of_reclassification === 'Approved' || 
    ((i.target_position || i.reclass_position) && (i.target_position || i.reclass_position) !== '#N/A')
  );
  const isStep3Done = incumbents.some(i => i.stage_of_reclassification === 'Approved');

  // Global Escape key listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showIncumbentDocsModal) {
          setShowIncumbentDocsModal(false);
          return;
        }
        if (showAssessmentModal) setShowAssessmentModal(false);
        if (showCsvModal) setShowCsvModal(false);
        if (noscaItemAssignModal.open) setNoscaItemAssignModal({ open: false, personnel: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAssessmentModal, showCsvModal, noscaItemAssignModal, showIncumbentDocsModal]);

  const getStageBadge = (stage) => {
    switch (stage) {
      case 'Approved':
        return {
          bg: isDark ? 'rgba(6, 95, 70, 0.25)' : '#ECFDF5',
          text: isDark ? '#34d399' : '#065F46',
          border: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
          icon: ''
        };
      case 'Endorsed to RO':
      case 'Endorsed':
        return {
          bg: isDark ? 'rgba(30, 58, 138, 0.35)' : '#EFF6FF',
          text: isDark ? '#93c5fd' : '#1E40AF',
          border: isDark ? 'rgba(59, 130, 246, 0.4)' : '#BFDBFE',
          icon: ''
        };
      case 'Endorsed to DBM RO':
        return {
          bg: isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF',
          text: isDark ? '#a5b4fc' : '#4338CA',
          border: isDark ? 'rgba(99, 102, 241, 0.4)' : '#C7D2FE',
          icon: ''
        };
      case 'Endorsed to SDO':
        return {
          bg: isDark ? 'rgba(14, 165, 233, 0.25)' : '#F0F9FF',
          text: isDark ? '#7dd3fc' : '#0369A1',
          border: isDark ? 'rgba(14, 165, 233, 0.4)' : '#BAE6FD',
          icon: ''
        };
      case 'Denied':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2',
          text: isDark ? '#f87171' : '#991B1B',
          border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECACA',
          icon: ''
        };
      case 'Unfilled / Vacant':
        return {
          bg: isDark ? 'rgba(71, 85, 105, 0.25)' : '#F1F5F9',
          text: isDark ? '#94a3b8' : '#475569',
          border: isDark ? 'rgba(100, 116, 139, 0.4)' : '#CBD5E1',
          icon: ''
        };
      case 'Abolition':
        return {
          bg: isDark ? 'rgba(153, 27, 27, 0.25)' : '#FEF2F2',
          text: isDark ? '#fca5a5' : '#991B1B',
          border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#F87171',
          icon: ''
        };
      case 'For Review':
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
    const serial = (customSerial !== undefined ? customSerial : manualNoscaSerial).trim() || (scannedNoscaResult?.serial_no || 'MANUAL-NOSCA');
    const div = (customDiv !== undefined ? customDiv : manualNoscaDivision).trim() || (scannedNoscaResult?.division || (divisionFilter && divisionFilter !== 'ALL' ? divisionFilter : 'Regional Scope'));
    const schoolId = (customSchoolId !== undefined ? customSchoolId : manualNoscaSchoolId) || scannedNoscaResult?.school_id || '';
    const schoolName = (customSchoolName !== undefined ? customSchoolName : manualNoscaSchoolName) || scannedNoscaResult?.school_name || scannedNoscaResult?.schoolName || '';
    const pos = (customPosition !== undefined ? customPosition : manualNoscaPosition) || (scannedNoscaResult?.position || 'School Counselor Associate I');

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
        school_id: schoolId || prev.school_id,
        school_name: schoolName || prev.school_name || prev.schoolName,
        schoolName: schoolName || prev.schoolName || prev.school_name,
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
          position: scannedNoscaResult.position || manualNoscaPosition || 'School Counselor Associate I',
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
            onClick={() => handleStepClick(1)}
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
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Step 1: Inventory CSV Ingestion</span>
                {isRegionalOffice && (
                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                    color: isDark ? '#a5b4fc' : '#4338ca',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #c7d2fe'
                  }}>
                    👁️ View Only
                  </span>
                )}
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
                {isRegionalOffice ? 'Review Loaded Master Inventory' : (isStep1Done ? `${incumbents.length} Records Loaded` : 'Template & Master Inventory Sync')}
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
            onClick={() => handleStepClick(2)}
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
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Step 2: Assessment Workbench</span>
                {isRegionalOffice && (
                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                    color: isDark ? '#a5b4fc' : '#4338ca',
                    border: isDark ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid #c7d2fe'
                  }}>
                    👁️ View Only
                  </span>
                )}
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
                {isRegionalOffice ? 'Review Counselor Assessments & Stages' : (isStep2Done ? 'Assessments & Position Assigned' : 'Stage Progression & Reclass Decisions')}
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
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Step 3: DBM Endorsement</span>
                {isRegionalOffice && (
                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                    color: isDark ? '#6ee7b7' : '#059669',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #bbf7d0'
                  }}>
                    RO Action
                  </span>
                )}
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
                {isStep3Done ? 'Ready for Transmittal' : (isRegionalOffice ? 'NOSCA Allocation & DBM Endorsement' : 'Summary & DBM Spreadsheet')}
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

                {!isRegionalOffice && (
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
                )}
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

                {!isRegionalOffice && (
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
                )}
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
              {isRegionalOffice ? 'Endorsed (RO / DBM / SDO)' : 'Endorsed to RO'}
            </div>
            <div style={{ fontSize: '30px', fontWeight: 850, color: isDark ? '#93c5fd' : '#1e40af', margin: '6px 0 2px' }}>
              {isRegionalOffice ? incumbentMetrics.endorsed : incumbentMetrics.endorsedToRO}
            </div>
            <div style={{ fontSize: '12px', color: isDark ? '#60a5fa' : '#2563eb' }}>
              {isRegionalOffice 
                ? `RO: ${incumbentMetrics.endorsedToRO} • DBM: ${incumbentMetrics.endorsedToDbm} • SDO: ${incumbentMetrics.endorsedToSdo}` 
                : 'Endorsed to Regional Office'}
            </div>
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
                  <th style={{ padding: '14px 18px', minWidth: '220px', whiteSpace: 'nowrap', textAlign: 'left' }}>Actual Reclassification Position</th>
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
                          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                            <select
                              value={inc.stage_of_reclassification || 'For Review'}
                              disabled={updatingStageId === inc.id}
                              onChange={(e) => handleUpdateIncumbentStage(inc.id, e.target.value, e)}
                              title="Click to update Stage of Reclassification (connected to reclassification_application)"
                              style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                padding: '6px 26px 6px 12px',
                                borderRadius: '8px',
                                border: `1.5px solid ${badgeStyle.border}`,
                                background: badgeStyle.bg,
                                color: badgeStyle.text,
                                fontSize: '12px',
                                fontWeight: 750,
                                cursor: updatingStageId === inc.id ? 'wait' : 'pointer',
                                outline: 'none',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.15s ease',
                                textAlign: 'left'
                              }}
                            >
                              {(() => {
                                const currentStage = inc.stage_of_reclassification || 'For Review';
                                let stageOptions = [];

                                if (currentUser?.role === 'admin') {
                                  stageOptions = ['For Review', 'Endorsed to RO', 'Endorsed', 'Endorsed to DBM RO', 'Endorsed to SDO', 'Approved', 'Denied'];
                                } else if (isRegionalOffice) {
                                  stageOptions = [...RO_RECLASS_STAGES];
                                  if (currentStage === 'Approved' || inc.dbm_status === 'With DBM NOSCA') {
                                    stageOptions.push('Approved');
                                  }
                                } else {
                                  stageOptions = [...HRMO_RECLASS_STAGES];
                                  if (currentStage === 'Approved') {
                                    stageOptions.push('Approved');
                                  }
                                }

                                if (!stageOptions.includes(currentStage)) {
                                  stageOptions.unshift(currentStage);
                                }

                                return stageOptions.map(stage => (
                                  <option 
                                    key={stage} 
                                    value={stage}
                                    style={{ 
                                      background: isDark ? '#1e293b' : '#ffffff', 
                                      color: isDark ? '#f8fafc' : '#0f172a',
                                      fontWeight: 600,
                                      padding: '6px'
                                    }}
                                  >
                                    {stage === 'Approved' ? '✓ Approved' : stage}
                                  </option>
                                ));
                              })()}
                            </select>
                            <div style={{
                              position: 'absolute',
                              right: '9px',
                              pointerEvents: 'none',
                              fontSize: '9px',
                              color: badgeStyle.text,
                              opacity: 0.8,
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {updatingStageId === inc.id ? '⏳' : '▼'}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                              <select
                                value={inc.reclass_position || inc.actual_position || inc.target_position || ''}
                                disabled={isRegionalOffice || updatingPositionId === inc.id}
                                onChange={(e) => handleUpdateIncumbentPosition(inc.id, e.target.value, e)}
                                title={isRegionalOffice ? 'View-only for Regional Office' : 'Click to update Actual Reclassification Position'}
                                style={{
                                  appearance: 'none',
                                  WebkitAppearance: 'none',
                                  MozAppearance: 'none',
                                  padding: isRegionalOffice ? '5px 10px' : '5px 24px 5px 10px',
                                  borderRadius: '6px',
                                  background: (inc.reclass_position || inc.actual_position || inc.target_position)
                                    ? (isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5')
                                    : (isDark ? 'rgba(51, 65, 85, 0.4)' : '#f8fafc'),
                                  color: (inc.reclass_position || inc.actual_position || inc.target_position)
                                    ? (isDark ? '#6ee7b7' : '#047857')
                                    : 'var(--text-secondary, #94a3b8)',
                                  border: (inc.reclass_position || inc.actual_position || inc.target_position)
                                    ? (isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0')
                                    : '1px solid var(--line)',
                                  fontSize: '11.5px',
                                  fontWeight: 750,
                                  cursor: isRegionalOffice ? 'default' : (updatingPositionId === inc.id ? 'wait' : 'pointer'),
                                  outline: 'none',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                  transition: 'all 0.15s ease',
                                  textAlign: 'left',
                                  width: 'fit-content'
                                }}
                              >
                                <option value="" style={{ background: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                  — Unassigned —
                                </option>
                                {RECLASS_POSITIONS_OPTIONS.map(pos => (
                                  <option 
                                    key={pos} 
                                    value={pos}
                                    style={{ 
                                      background: isDark ? '#1e293b' : '#ffffff', 
                                      color: isDark ? '#f8fafc' : '#0f172a',
                                      fontWeight: 600,
                                      padding: '4px'
                                    }}
                                  >
                                    {pos}
                                  </option>
                                ))}
                              </select>
                              {!isRegionalOffice && (
                                <div style={{
                                  position: 'absolute',
                                  right: '8px',
                                  pointerEvents: 'none',
                                  fontSize: '8px',
                                  color: (inc.actual_position || inc.target_position || inc.reclass_position) ? (isDark ? '#6ee7b7' : '#047857') : 'var(--text-secondary, #94a3b8)',
                                  opacity: 0.8,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  {updatingPositionId === inc.id ? '⏳' : '▼'}
                                </div>
                              )}
                            </div>
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
                            Assess / QS
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
                {incumbents.filter(i => ['Endorsed to RO', 'Endorsed to DBM RO', 'Endorsed to SDO', 'Endorsed', 'Approved'].includes(i.stage_of_reclassification)).length} candidates
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
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>DBM Status</th>
                  </tr>
                </thead>
                <tbody>
                  {incumbents
                    .filter(i => ['Endorsed to RO', 'Endorsed to DBM RO', 'Endorsed to SDO', 'Endorsed', 'Approved'].includes(i.stage_of_reclassification))
                    .slice(0, 15)
                    .map((counselor, idx) => {
                      const badge = getStageBadge(counselor.stage_of_reclassification);
                      return (
                        <tr key={counselor.id || idx} style={{ borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ fontWeight: 750, color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'monospace', fontSize: '12.5px' }}>
                                {counselor.plantilla_item_number || counselor.employee_id}
                              </span>
                              {counselor.dbm_status === 'With DBM NOSCA' && (
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
                                  border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #bbf7d0'
                                }}>
                                  ✓ NOSCA Assigned
                                </span>
                              )}
                            </div>
                          </td>
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
                              {counselor.target_position || counselor.reclass_position || 'School Counselor'}
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
                              {badge.icon ? `${badge.icon} ` : ''}{counselor.stage_of_reclassification}
                            </span>
                          </td>
                          <td style={{ padding: '8px 14px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {isRegionalOffice ? (
                                <>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <select
                                      value={counselor.dbm_status || ''}
                                      onChange={e => handleDbmStatusSelectChange(counselor, e.target.value, e)}
                                      disabled={updatingDbmStatusId === counselor.id}
                                      style={{
                                        padding: '5px 10px',
                                        borderRadius: '8px',
                                        border: counselor.dbm_status === 'With DBM NOSCA'
                                          ? (isDark ? '1.5px solid rgba(16, 185, 129, 0.6)' : '1.5px solid #10b981')
                                          : counselor.dbm_status === 'With DBM Request'
                                            ? (isDark ? '1.5px solid rgba(59, 130, 246, 0.6)' : '1.5px solid #3b82f6')
                                            : (isDark ? '1px solid rgba(71, 85, 105, 0.6)' : '1px solid #cbd5e1'),
                                        background: counselor.dbm_status === 'With DBM NOSCA'
                                          ? (isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5')
                                          : counselor.dbm_status === 'With DBM Request'
                                            ? (isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff')
                                            : (isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff'),
                                        color: counselor.dbm_status === 'With DBM NOSCA'
                                          ? (isDark ? '#6ee7b7' : '#047857')
                                          : counselor.dbm_status === 'With DBM Request'
                                            ? (isDark ? '#93c5fd' : '#1d4ed8')
                                            : (isDark ? '#94a3b8' : '#64748b'),
                                        fontSize: '12px',
                                        fontWeight: 750,
                                        cursor: updatingDbmStatusId === counselor.id ? 'not-allowed' : 'pointer',
                                        outline: 'none'
                                      }}
                                    >
                                      <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>-- Select Status --</option>
                                      <option value="With DBM Request" style={{ background: 'var(--card)', color: 'var(--text)' }}>With DBM Request</option>
                                      <option value="With DBM NOSCA" style={{ background: 'var(--card)', color: 'var(--text)' }}>With DBM NOSCA</option>
                                    </select>
                                    {updatingDbmStatusId === counselor.id && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                                      </svg>
                                    )}
                                  </div>

                                  {counselor.dbm_status === 'With DBM NOSCA' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentItem = (counselor.plantilla_item_number || '').trim();
                                        const isItemNA = !currentItem || currentItem.toUpperCase() === '#N/A' || currentItem.toUpperCase() === 'N/A';
                                        setNoscaItemAssignModal({ open: true, personnel: counselor });
                                        setSelectedNoscaItemNo(isItemNA ? '' : currentItem);
                                        setCustomPlantillaNo(isItemNA ? '' : currentItem);
                                        setIsCustomItemNo(isItemNA || availableNoscaItemOptions.length === 0);
                                        setItemSearchTerm('');
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: '0',
                                        color: isDark ? '#93c5fd' : '#2563eb',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        textDecoration: 'underline'
                                      }}
                                      title="Click to select or assign specific DBM NOSCA Item No."
                                    >
                                      ✏️ {counselor.plantilla_item_number ? `Assigned: ${counselor.plantilla_item_number}` : 'Assign Item No.'}
                                    </button>
                                  )}
                                </>
                              ) : (
                                /* Read-only for HRMO: Display only the resulting DBM status badge */
                                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                  {counselor.dbm_status === 'With DBM NOSCA' ? (
                                    <span style={{
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      fontWeight: 800,
                                      background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
                                      color: isDark ? '#6ee7b7' : '#047857',
                                      border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      With DBM NOSCA
                                    </span>
                                  ) : counselor.dbm_status === 'With DBM Request' ? (
                                    <span style={{
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      fontWeight: 800,
                                      background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                                      color: isDark ? '#93c5fd' : '#1d4ed8',
                                      border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      With DBM Request
                                    </span>
                                  ) : (
                                    <span style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 650,
                                      background: isDark ? 'rgba(71, 85, 105, 0.2)' : '#f1f5f9',
                                      color: isDark ? '#94a3b8' : '#64748b',
                                      border: isDark ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid #e2e8f0',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      Pending DBM Action
                                    </span>
                                  )}

                                  {counselor.dbm_status === 'With DBM NOSCA' && counselor.plantilla_item_number && counselor.plantilla_item_number !== '#N/A' && counselor.plantilla_item_number !== 'N/A' && (
                                    <span style={{
                                      fontSize: '10.5px',
                                      color: isDark ? '#94a3b8' : '#64748b',
                                      fontWeight: 700,
                                      fontFamily: 'monospace',
                                      marginLeft: '2px'
                                    }}>
                                      Item: {counselor.plantilla_item_number}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {incumbents.filter(i => ['Endorsed to RO', 'Endorsed to DBM RO', 'Endorsed to SDO', 'Endorsed', 'Approved'].includes(i.stage_of_reclassification)).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b' }}>
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
                  onClick={() => setShowIncumbentDocsModal(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid #0284c7',
                    background: isDark ? 'rgba(2, 132, 199, 0.2)' : '#eff6ff',
                    color: isDark ? '#38bdf8' : '#0284c7',
                    fontSize: '12.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    boxShadow: '0 1px 3px rgba(2, 132, 199, 0.12)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(2, 132, 199, 0.35)' : '#dbeafe'}
                  onMouseOut={e => e.currentTarget.style.background = isDark ? 'rgba(2, 132, 199, 0.2)' : '#eff6ff'}
                >
                  <span style={{ fontSize: '15px' }}>📁</span>
                  View Submitted Documents
                </button>

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
                    <div style={{ fontWeight: 750, color: 'var(--text)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedIncumbent.uacs_oper_dsc || selectedIncumbent.station_division}>
                      {selectedIncumbent.uacs_oper_dsc || selectedIncumbent.station_division || '—'}
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

              {/* Card 2: Documentary Screening & Requirements Checklist Section */}
              {(() => {
                const requiredReqs = docChecklist.filter(d => d.required);
                const otherReqs = docChecklist.filter(d => !d.required);
                const missingRequiredDocs = requiredReqs.filter(d => !d.submitted || !d.verified);
                const isDocComplete = missingRequiredDocs.length === 0;
                const verifiedCount = docChecklist.filter(d => d.submitted && d.verified).length;
                const requiredVerifiedCount = requiredReqs.filter(d => d.submitted && d.verified).length;
                const otherVerifiedCount = otherReqs.filter(d => d.submitted && d.verified).length;

                return (
                  <div style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-subtle)',
                    borderRadius: '16px',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                    padding: '20px',
                    boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.03)'
                  }}>
                    {/* Header Controls */}
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
                          1. Documentary Screening &amp; Requirements Checklist
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                          Tick submitted requirements. The mandatory requirements unlock the QS Evaluation automatically once completed.
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                          {requiredVerifiedCount} of {requiredReqs.length} Mandatory ({verifiedCount} of {docChecklist.length} Total)
                        </span>

                        {!isRegionalOffice && (
                          <>
                            <button
                              type="button"
                              onClick={handleMarkAllDocsComplete}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: isDark ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid #10b981',
                                background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                                color: isDark ? '#6ee7b7' : '#047857',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              ✓ Verify All
                            </button>
                            <button
                              type="button"
                              onClick={handleResetAllDocs}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)',
                                background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'var(--card-solid, #ffffff)',
                                color: 'var(--text-secondary, #94a3b8)',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              ↺ Reset
                            </button>
                          </>
                        )}
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
                        All required documents are submitted and verified. Qualification Standards (QS) Evaluation is unlocked.
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
                          <b>{requiredVerifiedCount} of {requiredReqs.length} Mandatory Requirements complete.</b> Tick all 5 mandatory requirements below to unlock Qualification Standards (QS) Evaluation.
                        </div>
                      </div>
                    )}

                    {/* Section A: Mandatory Requirements (Card Grid) */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                        gap: '8px'
                      }}>
                        {requiredReqs.map(doc => {
                          const isChecked = Boolean(doc.submitted && doc.verified);
                          return (
                            <label
                              key={doc.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '20px 1fr',
                                gap: '10px',
                                alignItems: 'start',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: isChecked
                                  ? (isDark ? '1.5px solid #22c55e' : '1.5px solid #86efac')
                                  : (isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid #e2e8f0'),
                                background: isChecked
                                  ? (isDark ? 'rgba(22, 101, 52, 0.22)' : '#f0fdf4')
                                  : (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fcff'),
                                cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: isChecked
                                  ? (isDark ? '0 2px 8px rgba(34, 197, 94, 0.15)' : '0 1px 3px rgba(22, 163, 74, 0.08)')
                                  : 'none'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDocSubmitted(doc.id)}
                                disabled={isRegionalOffice}
                                style={{
                                  width: '17px',
                                  height: '17px',
                                  marginTop: '2px',
                                  accentColor: '#2563eb',
                                  cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                                  flexShrink: 0
                                }}
                              />
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color: isChecked ? (isDark ? '#86efac' : '#1e293b') : (isDark ? '#94a3b8' : '#334155'),
                                lineHeight: 1.35,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase'
                              }}>
                                <span style={{ color: isChecked ? '#16a34a' : '#ef4444', marginRight: '5px' }}>[REQUIRED]</span>
                                {doc.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section B: Other Requirements (Card Grid) */}
                    <div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: isDark ? '#94a3b8' : '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                        OTHER REQUIREMENTS ({otherVerifiedCount} OF {otherReqs.length})
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                        gap: '8px'
                      }}>
                        {otherReqs.map(doc => {
                          const isChecked = Boolean(doc.submitted && doc.verified);
                          return (
                            <label
                              key={doc.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '20px 1fr',
                                gap: '10px',
                                alignItems: 'start',
                                padding: '11px 14px',
                                borderRadius: '12px',
                                border: isChecked
                                  ? (isDark ? '1.5px solid #22c55e' : '1.5px solid #86efac')
                                  : (isDark ? '1.5px solid rgba(51, 65, 85, 0.7)' : '1.5px solid #e2e8f0'),
                                background: isChecked
                                  ? (isDark ? 'rgba(22, 101, 52, 0.18)' : '#f0fdf4')
                                  : (isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fcff'),
                                cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDocSubmitted(doc.id)}
                                disabled={isRegionalOffice}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  marginTop: '2px',
                                  accentColor: '#2563eb',
                                  cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                                  flexShrink: 0
                                }}
                              />
                              <span style={{
                                fontSize: '11px',
                                fontWeight: isChecked ? 800 : 700,
                                color: isChecked ? (isDark ? '#86efac' : '#1e293b') : (isDark ? '#94a3b8' : '#475569'),
                                lineHeight: 1.35,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase'
                              }}>
                                {doc.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Card 3: Position-Specific Qualification Standards (QS) Evaluation Section */}
              {(() => {
                const missingRequiredDocs = docChecklist.filter(d => d.required && (!d.submitted || !d.verified));
                const isDocComplete = missingRequiredDocs.length === 0;
                const effectiveTargetPos = modalTargetPosition || selectedIncumbent.target_position || selectedIncumbent.reclass_position || 'School Counselor I';
                const standards = POSITION_QS_STANDARDS[effectiveTargetPos] || POSITION_QS_STANDARDS['School Counselor I'];
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
                          CSC &amp; DepEd QS benchmarks for: <b style={{ color: 'var(--text)' }}>{effectiveTargetPos}</b>
                        </div>
                      </div>

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
                          All mandatory documents in the checklist above must be marked as <b>Submitted &amp; Verified</b> before the Qualification Standards evaluation can be performed.
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
                          marginBottom: '16px'
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
                                <th style={{ padding: '10px 14px', width: '130px', minWidth: '130px', textAlign: 'left', whiteSpace: 'nowrap' }}>Standard Criterion</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '220px' }}>Target QS Requirement ({effectiveTargetPos})</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '220px' }}>Personnel Record / Credential</th>
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
                                    <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                      <div style={{ fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                                        {crit.title}
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.4 }}>
                                      {crit.standard}
                                    </td>
                                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                                      <div style={{ fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                                        {crit.candidate}
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', width: '230px', minWidth: '230px' }}>
                                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                        <button
                                          type="button"
                                          onClick={() => handleSetQsCriterion(crit.key, 'Meets')}
                                          disabled={isRegionalOffice}
                                          style={{
                                            padding: '5px 12px',
                                            borderRadius: '6px',
                                            border: isMeets
                                              ? (isDark ? '1.5px solid #10b981' : '1.5px solid #059669')
                                              : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)'),
                                            background: isMeets
                                              ? (isDark ? 'rgba(6, 78, 59, 0.6)' : '#ecfdf5')
                                              : (isDark ? 'rgba(30, 41, 59, 0.4)' : 'var(--card-solid, #ffffff)'),
                                            color: isMeets
                                              ? (isDark ? '#6ee7b7' : '#047857')
                                              : 'var(--text-secondary, #94a3b8)',
                                            fontWeight: isMeets ? 800 : 650,
                                            fontSize: '11.5px',
                                            cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s ease',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          ✓ Meets
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSetQsCriterion(crit.key, 'Does Not Meet')}
                                          disabled={isRegionalOffice}
                                          style={{
                                            padding: '5px 12px',
                                            borderRadius: '6px',
                                            border: isDoesNotMeet
                                              ? (isDark ? '1.5px solid #ef4444' : '1.5px solid #dc2626')
                                              : (isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid var(--line)'),
                                            background: isDoesNotMeet
                                              ? (isDark ? 'rgba(127, 29, 29, 0.5)' : '#fee2e2')
                                              : (isDark ? 'rgba(30, 41, 59, 0.4)' : 'var(--card-solid, #ffffff)'),
                                            color: isDoesNotMeet
                                              ? (isDark ? '#fca5a5' : '#b91c1c')
                                              : 'var(--text-secondary, #94a3b8)',
                                            fontWeight: isDoesNotMeet ? 800 : 650,
                                            fontSize: '11.5px',
                                            cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s ease',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          ✗ Does Not Meet
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
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
                              fontSize: '13px',
                              fontWeight: 900,
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
                                  : 'none'
                            }}>
                              {overallResult === 'QUALIFIED' ? '✓ QUALIFIED' : overallResult === 'NOT QUALIFIED' ? '✗ NOT QUALIFIED' : 'PENDING EVALUATION'}
                            </span>
                          </div>

                          {overallResult === 'QUALIFIED' && (
                            <div style={{ fontSize: '13px', color: isDark ? '#a7f3d0' : '#047857', fontWeight: 700 }}>
                              Candidate satisfies all Civil Service Commission (CSC) and DepEd Qualification Standards (Education, Experience, Training, Eligibility) for <b>{effectiveTargetPos}</b>.
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

                        {/* Audit Trail & Remarks Section */}
                        <div style={{
                          background: isDark ? 'rgba(2, 6, 23, 0.4)' : 'var(--card-subtle)',
                          borderRadius: '12px',
                          border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)',
                          padding: '16px'
                        }}>
                          {/* Position Classification Comparison & Determination */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                            gap: '12px',
                            marginBottom: '16px',
                            paddingBottom: '16px',
                            borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)'
                          }}>
                            {/* 1. Target Position */}
                            <div style={{
                              background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid var(--line)'
                            }}>
                              <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>🎯</span> Target Position
                              </div>
                              <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '13.5px', marginTop: '6px' }}>
                                {selectedIncumbent.actual_position || selectedIncumbent.reclass_position || selectedIncumbent.target_position || 'School Counselor I'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '3px' }}>
                                Stated / Applied position
                              </div>
                            </div>

                            {/* 2. Indicative Position */}
                            <div style={{
                              background: isDark ? 'rgba(2, 132, 199, 0.1)' : 'rgba(2, 132, 199, 0.05)',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(2, 132, 199, 0.25)'
                            }}>
                              <div style={{ fontSize: '10.5px', fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span>⚡</span> Indicative Position</span>
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 800 }}>QS Match</span>
                              </div>
                              <div style={{ fontWeight: 850, color: isDark ? '#7dd3fc' : '#0369a1', fontSize: '13.5px', marginTop: '6px' }}>
                                {determineIndicativePosition(selectedIncumbent)}
                              </div>
                              <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '3px' }}>
                                Determined from qualifications
                              </div>
                            </div>

                            {/* 3. Actual Reclassification Position */}
                            <div style={{
                              background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--card-solid, #ffffff)',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              border: isDark ? '1.5px solid #0284c7' : '1.5px solid #0284c7',
                              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)'
                            }}>
                              <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                                Actual Reclassification Position <span style={{ color: '#ef4444' }}>*</span>
                              </label>
                              <select
                                value={modalTargetPosition}
                                onChange={e => {
                                  const newPos = e.target.value;
                                  setModalTargetPosition(newPos);
                                  if (selectedIncumbent) {
                                    const updatedQs = computeAutoQs(selectedIncumbent, newPos);
                                    setQsEvaluation(updatedQs);
                                  }
                                }}
                                disabled={isRegionalOffice || savingModalChanges}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid var(--input-border, var(--line))',
                                  background: 'var(--input-bg)',
                                  fontSize: '12.5px',
                                  fontWeight: 750,
                                  color: 'var(--input-text, var(--text))',
                                  cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                                  outline: 'none'
                                }}
                              >
                                <option value="">-- Unassigned --</option>
                                {RECLASS_POSITIONS_OPTIONS.map(pos => (
                                  <option key={pos} value={pos}>{pos}</option>
                                ))}
                              </select>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                                Final endorsed position
                              </div>
                            </div>
                          </div>

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
                  {isRegionalOffice && (
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 750,
                      padding: '2px 7px',
                      borderRadius: '6px',
                      background: isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff',
                      color: isDark ? '#93c5fd' : '#1d4ed8',
                      border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bfdbfe'
                    }}>
                      👁️ View-Only
                    </span>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '14px'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 750, color: 'var(--text)', marginBottom: '5px' }}>
                      Actual Reclassification Position <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={modalTargetPosition}
                      onChange={e => {
                        const newPos = e.target.value;
                        setModalTargetPosition(newPos);
                        if (selectedIncumbent) {
                          const updatedQs = computeAutoQs(selectedIncumbent, newPos);
                          setQsEvaluation(updatedQs);
                        }
                      }}
                      disabled={isRegionalOffice || savingModalChanges}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                        background: 'var(--input-bg)',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--input-text, var(--text))',
                        cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                        outline: 'none',
                        opacity: isRegionalOffice ? 0.85 : 1
                      }}
                    >
                      <option value="" style={{ background: 'var(--card)', color: 'var(--text)' }}>-- Unassigned --</option>
                      {RECLASS_POSITIONS_OPTIONS.map(pos => (
                        <option key={pos} value={pos} style={{ background: 'var(--card)', color: 'var(--text)' }}>{pos}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 750, color: 'var(--text)', marginBottom: '5px' }}>
                      Stage of Reclassification
                    </label>
                    <select
                      value={modalStage}
                      onChange={e => setModalStage(e.target.value)}
                      disabled={isRegionalOffice || savingModalChanges}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: isDark ? '1.5px solid rgba(51, 65, 85, 0.8)' : '1.5px solid var(--input-border, var(--line))',
                        background: 'var(--input-bg)',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--input-text, var(--text))',
                        cursor: isRegionalOffice ? 'not-allowed' : 'pointer',
                        outline: 'none',
                        opacity: isRegionalOffice ? 0.85 : 1
                      }}
                    >
                      {(selectedIncumbent?.stage_of_reclassification === 'Approved' || modalStage === 'Approved') ? (
                        APPROVED_POST_ACTION_STAGES.map(stage => (
                          <option key={stage} value={stage} style={{ background: 'var(--card)', color: 'var(--text)' }}>
                            {stage === 'Approved' ? '✓ Approved (via DBM NOSCA)' : stage}
                          </option>
                        ))
                      ) : isRegionalOffice ? (
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
              )}
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

                    {/* School ID Autocomplete Field (fetched from agap_schools) */}
                    <div ref={schoolSearchContainerRef} style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                          School ID <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 400 }}>(agap_schools)</span>
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
                          left: 0,
                          right: 0,
                          background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                          backdropFilter: 'blur(16px)',
                          border: isDark ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid #c7d2fe',
                          borderRadius: '10px',
                          boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          zIndex: 60,
                          padding: '4px'
                        }}>
                          {loadingSchools && schoolSuggestions.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                              Searching agap_schools...
                            </div>
                          ) : schoolSuggestions.length > 0 ? (
                            schoolSuggestions.map((school) => {
                              const isSelected = String(manualNoscaSchoolId) === String(school.school_id);
                              return (
                                <div
                                  key={school.school_id}
                                  onClick={() => handleSelectSchool(school)}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '7px',
                                    cursor: 'pointer',
                                    background: isSelected
                                      ? (isDark ? 'rgba(79, 70, 229, 0.25)' : '#eef2ff')
                                      : 'transparent',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    transition: 'background 0.12s ease'
                                  }}
                                  onMouseOver={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9';
                                  }}
                                  onMouseOut={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                      fontFamily: 'monospace',
                                      fontWeight: 800,
                                      fontSize: '11px',
                                      color: isDark ? '#a5b4fc' : '#4338ca',
                                      background: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
                                      padding: '1px 6px',
                                      borderRadius: '4px'
                                    }}>
                                      {school.school_id}
                                    </span>
                                    <span style={{
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      color: isDark ? '#f8fafc' : '#0f172a',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {school.school_name}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', paddingLeft: '2px' }}>
                                    {school.division ? `Division of ${school.division}` : ''}{school.region ? ` • ${school.region}` : ''}
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
                          placeholder={divisionFilter && divisionFilter !== 'ALL' ? divisionFilter : 'Regional Scope'}
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
