import React, { useState, useMemo } from 'react';
import { useAppData } from '../../../middleware/DataProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { apiFetch } from '../../../config/api.js';
import VacancyClusterAccordion from '../../../components/VacancyClusterAccordion.jsx';

function isValidItemNo(itemNo) {
  if (!itemNo) return false;
  if (itemNo.toUpperCase().includes('UNKNOWN')) return false;
  if (/\s/.test(itemNo)) return false;
  if (/[a-z]/.test(itemNo)) return false;
  return /^(?:OSEC-)?[A-Z0-9\-]+-[0-9]+-20\d\d$/.test(itemNo);
}

function isCharInvalidAtIndex(char, index, fullString) {
  if (!char || char === ' ') return true;
  if (/[a-z]/.test(char)) return true;
  if (!/[A-Z0-9\-]/.test(char)) return true;

  const upperStr = fullString.toUpperCase();
  const unknownIndex = upperStr.indexOf('UNKNOWN');
  if (unknownIndex !== -1) {
    if (index >= unknownIndex && index < unknownIndex + 7) {
      return true;
    }
  }
  return false;
}

function NOSCAItemEditor({
  itemIndex,
  value,
  onChange,
  schoolLevel,
  onSchoolLevelChange,
  schoolSearchQuery,
  onSchoolSearchQueryChange,
  onSchoolSelect
}) {
  const [searchResults, setSearchResults] = React.useState([]);
  const [showDropdown, setShowDropdown] = React.useState(false);

  React.useEffect(() => {
    if (!schoolSearchQuery || !schoolSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/vacancies/schools/autocomplete?q=${encodeURIComponent(schoolSearchQuery)}`);
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error fetching schools:', err);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [schoolSearchQuery]);

  const isInvalid = !isValidItemNo(value);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s+/g, ''))}
        placeholder="Enter Item Number"
        style={{
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: '800',
          fontFamily: 'monospace',
          border: isInvalid ? '1.5px solid #EF4444' : '1.5px solid var(--line)',
          borderRadius: '8px',
          background: isInvalid ? '#FEF2F2' : '#F8FAFC',
          color: isInvalid ? '#EF4444' : 'var(--navy)',
          outline: 'none',
          height: '28px',
          width: '240px',
          boxSizing: 'border-box'
        }}
      />
      
      <div style={{ display: 'flex', gap: '2px', marginLeft: '4px', alignItems: 'center' }}>
        <select
          value={schoolLevel || ''}
          onChange={(e) => onSchoolLevelChange(e.target.value)}
          style={{
            padding: '0 8px',
            fontSize: '11px',
            height: '28px',
            borderRadius: '8px',
            border: '1.5px solid var(--blue)',
            background: 'var(--blue-50)',
            color: 'var(--blue-600)',
            fontWeight: 'bold',
            marginLeft: '4px',
            cursor: 'pointer',
            outline: 'none',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          <option value="">Select School Level</option>
          <option value="ES">ES</option>
          <option value="JHS">JHS</option>
          <option value="SHS">SHS</option>
        </select>
      </div>

      {schoolLevel === 'JHS' && (
        <div style={{ width: '100%', marginTop: '6px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 'bold', color: 'var(--navy)' }}>School ID:</span>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={schoolSearchQuery || ''}
                onChange={(e) => {
                  onSchoolSearchQueryChange(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type School ID or Name..."
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  fontSize: '11.5px',
                  height: '24px'
                }}
              />
              {showDropdown && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  zIndex: 999,
                  maxHeight: '120px',
                  overflowY: 'auto',
                  marginTop: '2px'
                }}>
                  {searchResults.map((sch) => (
                    <div
                      key={sch.schoolId}
                      onClick={() => {
                        onSchoolSelect(sch);
                        setShowDropdown(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom: '1px solid #F1F5F9'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ pointerEvents: 'none' }}>
                        <b>{sch.schoolId}</b> - {sch.schoolName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VacanciesPage() {
  const { positions, vacancies, applications, loadAllData } = useAppData();
  const { setToast } = useToast();

  const [vacSearch, setVacSearch] = useState('');
  const [vacPosFilter, setVacPosFilter] = useState('');
  const [vacStatusFilter, setVacStatusFilter] = useState('');
  const [vColumnFilters, setVColumnFilters] = useState({});
  const [vSortKey, setVSortKey] = useState('');
  const [vSortDir, setVSortDir] = useState('asc');
  const [vacPage, setVacPage] = useState(1);
  const [vacPageSize, setVacPageSize] = useState(10);

  // Calendar Schedule Modal states
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDocPolicyModal, setShowDocPolicyModal] = useState(false);
  const [calVacancy, setCalVacancy] = useState(null);
  const [calStart, setCalStart] = useState('');
  const [calEnd, setCalEnd] = useState('');
  const [calField, setCalField] = useState('start');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calDocPolicy, setCalDocPolicy] = useState('RETAIN_OLD');

  // Invite Modal states (for Closed vacancies)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteVacancy, setInviteVacancy] = useState(null);
  const [inviteAllowedEmails, setInviteAllowedEmails] = useState([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [inviteSuggestions, setInviteSuggestions] = useState([]);
  const [showInviteSuggestionsDropdown, setShowInviteSuggestionsDropdown] = useState(false);
  const [inviteModalTab, setInviteModalTab] = useState('config'); // 'config' | 'invitations'
  const [showRevokeConfirmModal, setShowRevokeConfirmModal] = useState(false);
  const [revokeConfirmEmail, setRevokeConfirmEmail] = useState(null);
  const [showResendConfirmModal, setShowResendConfirmModal] = useState(false);
  const [resendConfirmEmail, setResendConfirmEmail] = useState(null);

  const isValidEmailFormat = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());
  };

  const getApplicantNameForEmail = (email) => {
    if (!email) return 'Applicant';
    const match = (applications || []).find(a => {
      const aEmail = a.applicant?.email_address || a.applicant_email_address || a.email_address || a.email || a.applicantObj?.email_address || '';
      return aEmail.toLowerCase() === email.toLowerCase();
    });
    if (match) {
      return match.applicantName || match.applicant_name || match.applicant?.fullName || match.applicant?.name || match.applicantObj?.name || email.split('@')[0];
    }
    const prefix = email.split('@')[0].replace(/[._-]/g, ' ');
    return prefix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getSubmittedEmailsForVacancy = (vac) => {
    if (!vac || !applications) return new Set();
    const emails = new Set();
    const vacTitle = (positions.find(p => p.id === vac.positionId)?.title || vac.title || '').trim().toLowerCase();
    const cleanVacTitle = vacTitle.replace(/\s*\([^)]*\)/g, '').trim();

    (applications || []).forEach(a => {
      const matchCluster = vac.jobClusterId && a.jobClusterId && String(a.jobClusterId) === String(vac.jobClusterId);
      const matchVacId = vac.id && a.vacancyId && String(a.vacancyId) === String(vac.id);
      const matchItem = vac.itemNo && (a.itemNo === vac.itemNo || a.vacancyItemNo === vac.itemNo);
      const matchPosId = vac.positionId && (a.positionId === vac.positionId || a.positionObj?.id === vac.positionId);
      
      const appTitle = (a.positionTitle || a.vacancyTitle || a.vacancy || a.positionObj?.title || '').trim().toLowerCase();
      const cleanAppTitle = appTitle.replace(/\s*\([^)]*\)/g, '').trim();
      const matchTitle = Boolean(cleanVacTitle && cleanAppTitle && (cleanVacTitle === cleanAppTitle || cleanVacTitle.startsWith(cleanAppTitle) || cleanAppTitle.startsWith(cleanVacTitle)));

      if (matchCluster || matchVacId || matchItem || matchPosId || matchTitle) {
        const e = a.applicant?.email_address || a.applicant_email_address || a.email_address || a.email || a.applicantObj?.email_address || '';
        if (e && e.trim()) {
          emails.add(e.trim().toLowerCase());
        }
      }
    });
    return emails;
  };

  // Autocomplete search for Invite modal
  React.useEffect(() => {
    if (!inviteEmailInput || !inviteEmailInput.trim() || !showInviteModal) {
      setInviteSuggestions([]);
      setShowInviteSuggestionsDropdown(false);
      return;
    }
    const term = inviteEmailInput.trim().toLowerCase();
    const delayDebounce = setTimeout(async () => {
      try {
        const vacParam = inviteVacancy?.id ? `&vacancyId=${encodeURIComponent(inviteVacancy.id)}` : '';
        const data = await apiFetch(`/api/vacancies/applicants/autocomplete?q=${encodeURIComponent(term)}${vacParam}`);
        let list = Array.isArray(data) ? data : [];

        const submittedEmails = inviteVacancy ? getSubmittedEmailsForVacancy(inviteVacancy) : new Set();

        // Combine with local applications for instant matching, excluding already applied
        const localMatches = (applications || [])
          .map(a => ({
            email: a.applicant?.email_address || a.applicant_email_address || a.email_address || a.email || a.applicantObj?.email_address || '',
            name: a.applicantName || a.applicant_name || a.applicant?.fullName || a.applicant?.name || a.applicantObj?.name || ''
          }))
          .filter(it => it.email && !submittedEmails.has(it.email.toLowerCase()) && (it.email.toLowerCase().includes(term) || (it.name && it.name.toLowerCase().includes(term))));

        const merged = new Map();
        [...list, ...localMatches].forEach(item => {
          const itemEmail = (item.email || '').toLowerCase().trim();
          if (itemEmail && !inviteAllowedEmails.includes(itemEmail) && !submittedEmails.has(itemEmail)) {
            merged.set(itemEmail, {
              email: itemEmail,
              name: item.name || ''
            });
          }
        });

        const finalList = Array.from(merged.values()).slice(0, 10);
        setInviteSuggestions(finalList);
        setShowInviteSuggestionsDropdown(finalList.length > 0);
      } catch (err) {
        console.error('Error fetching applicant suggestions for invite:', err);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [inviteEmailInput, showInviteModal, inviteAllowedEmails, applications, inviteVacancy]);

  const handleOpenInviteModal = (vac) => {
    setInviteVacancy(vac);
    const submittedEmails = getSubmittedEmailsForVacancy(vac);
    const rawAllowed = Array.isArray(vac.allowedEmails) ? [...vac.allowedEmails] : [];
    const existing = rawAllowed
      .map(e => String(e).trim().toLowerCase())
      .filter(e => !submittedEmails.has(e));

    // Auto-sync removal of submitted applicants back to backend if any were present
    if (rawAllowed.length !== existing.length && vac.id) {
      apiFetch(`/api/vacancies/${vac.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'open',
          docFetchPreference: 'RETAIN_OLD',
          allowedEmails: existing
        })
      }).then(() => loadAllData()).catch(console.error);
    }

    setInviteAllowedEmails(existing);
    setInviteEmailInput('');
    setInviteEmailError('');
    setInviteSuggestions([]);
    setShowInviteSuggestionsDropdown(false);
    setInviteModalTab(existing.length > 0 ? 'invitations' : 'config');
    setShowInviteModal(true);
  };

  const handleAddInviteEmail = () => {
    const raw = inviteEmailInput.trim();
    if (!raw) return;

    const parts = raw.split(/[\s,]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    let addedCount = 0;
    let nextEmails = [...inviteAllowedEmails];
    let errorMsg = '';
    const submittedEmails = inviteVacancy ? getSubmittedEmailsForVacancy(inviteVacancy) : new Set();

    for (const p of parts) {
      if (!isValidEmailFormat(p)) {
        errorMsg = `Invalid email format: "${p}". Please enter a valid email address.`;
        break;
      }
      if (submittedEmails.has(p)) {
        errorMsg = `Applicant "${p}" has already submitted an application for this vacancy and cannot be re-invited.`;
        continue;
      }
      if (nextEmails.includes(p)) {
        errorMsg = `Email "${p}" is already in the invitation list.`;
        continue;
      }
      nextEmails.push(p);
      addedCount++;
    }

    if (errorMsg && addedCount === 0) {
      setInviteEmailError(errorMsg);
      setToast({ message: errorMsg, type: 'warning' });
      return;
    }

    setInviteAllowedEmails(nextEmails);
    setInviteEmailInput('');
    setInviteEmailError('');
    setShowInviteSuggestionsDropdown(false);
  };

  const handleSelectInviteSuggestion = (email) => {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();
    const submittedEmails = inviteVacancy ? getSubmittedEmailsForVacancy(inviteVacancy) : new Set();

    if (submittedEmails.has(cleanEmail)) {
      setToast({ message: `Applicant "${cleanEmail}" has already submitted an application for this vacancy.`, type: 'warning' });
      return;
    }

    if (isValidEmailFormat(cleanEmail) && !inviteAllowedEmails.includes(cleanEmail)) {
      setInviteAllowedEmails(prev => [...prev, cleanEmail]);
    }
    setInviteEmailInput('');
    setInviteEmailError('');
    setShowInviteSuggestionsDropdown(false);
    setInviteSuggestions([]);
  };

  const handleRemoveInviteEmail = (emailToRemove) => {
    setInviteAllowedEmails(prev => prev.filter(e => e !== emailToRemove));
    setInviteEmailError('');
  };

  const handleConfirmRevokeInvite = async () => {
    if (!inviteVacancy || !revokeConfirmEmail) return;
    const nextEmails = inviteAllowedEmails.filter(e => e.toLowerCase() !== revokeConfirmEmail.toLowerCase());
    try {
      await apiFetch(`/api/vacancies/${inviteVacancy.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'open',
          docFetchPreference: 'RETAIN_OLD',
          allowedEmails: nextEmails
        })
      });
      setInviteAllowedEmails(nextEmails);
      setInviteVacancy(prev => prev ? { ...prev, allowedEmails: nextEmails } : null);
      setShowRevokeConfirmModal(false);
      setRevokeConfirmEmail(null);
      setToast({ message: 'Invitation revoked successfully.', type: 'success' });
      loadAllData();
    } catch (e) {
      setToast({ message: e.message || 'Failed to revoke invitation', type: 'error' });
    }
  };

  const handleConfirmResendInvite = () => {
    if (!resendConfirmEmail) return;
    setToast({ message: `Invitation resent successfully to ${resendConfirmEmail}.`, type: 'success' });
    setShowResendConfirmModal(false);
    setResendConfirmEmail(null);
  };

  const handleSaveInviteModal = async () => {
    if (!inviteVacancy) return;

    const submittedEmails = getSubmittedEmailsForVacancy(inviteVacancy);
    let currentEmails = [...inviteAllowedEmails].filter(e => !submittedEmails.has(e.toLowerCase()));

    if (inviteEmailInput.trim()) {
      const raw = inviteEmailInput.trim().toLowerCase();
      if (submittedEmails.has(raw)) {
        setToast({ message: `Applicant "${raw}" has already submitted an application for this vacancy.`, type: 'warning' });
      } else if (isValidEmailFormat(raw) && !currentEmails.includes(raw)) {
        currentEmails.push(raw);
        setInviteAllowedEmails(currentEmails);
        setInviteEmailInput('');
      }
    }

    if (currentEmails.length === 0) {
      setInviteEmailError('Please add at least one valid email address to invite.');
      setToast({ message: 'Please add at least one valid email address to invite.', type: 'error' });
      return;
    }

    try {
      await apiFetch(`/api/vacancies/${inviteVacancy.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'open',
          docFetchPreference: 'RETAIN_OLD',
          allowedEmails: currentEmails
        })
      });

      setToast({
        message: `Invitations saved! Access granted to ${currentEmails.length} applicant email(s).`,
        type: 'success'
      });
      setInviteVacancy(prev => prev ? { ...prev, allowedEmails: currentEmails } : null);
      setInviteModalTab('invitations');
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // NOSCA Scanning states
  const [showNosca, setShowNosca] = useState(false);
  const [showNoscaConfirm, setShowNoscaConfirm] = useState(false);
  const [noscaScanning, setNoscaScanning] = useState(false);
  const [detectedItems, setDetectedItems] = useState([]);
  const [selectedNoscaItemNos, setSelectedNoscaItemNos] = useState([]);

  // Manual Add Form states
  const [showManualFields, setShowManualFields] = useState(false);
  const [manualPositionId, setManualPositionId] = useState('');
  const [manualItemNo, setManualItemNo] = useState('SCA1-00000-2026');
  const [manualSchoolLevel, setManualSchoolLevel] = useState('');
  const [manualSchoolId, setManualSchoolId] = useState(null);
  const [manualSchoolName, setManualSchoolName] = useState('');
  const [manualSchoolSearchQuery, setManualSchoolSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState([]);
  const [showManualDropdown, setShowManualDropdown] = useState(false);

  React.useEffect(() => {
    if (!manualSchoolSearchQuery || !manualSchoolSearchQuery.trim()) {
      setManualSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/vacancies/schools/autocomplete?q=${encodeURIComponent(manualSchoolSearchQuery)}`);
        setManualSearchResults(data || []);
      } catch (err) {
        console.error('Error fetching schools:', err);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [manualSchoolSearchQuery]);


  React.useEffect(() => {
    const handleTourUpdate = () => {
      if (window.agap_tour_open_nosca) {
        setShowNosca(true);
      } else if (window.agap_tour_open_nosca === false) {
        setShowNosca(false);
      }
    };
    window.addEventListener('agap-tour-update', handleTourUpdate);
    if (window.agap_tour_open_nosca) {
      setShowNosca(true);
    }
    return () => window.removeEventListener('agap-tour-update', handleTourUpdate);
  }, []);

  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [closeWarningVac, setCloseWarningVac] = useState(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeReasonOther, setCloseReasonOther] = useState('');
  const [closePasscode, setClosePasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Delete Confirmation States
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmVac, setDeleteConfirmVac] = useState(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [deletePasscodeError, setDeletePasscodeError] = useState('');

  const getVacancyPostingStatus = (v) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = v.postingStart ? new Date(v.postingStart.slice(0, 10) + "T00:00:00") : null;
    const end = v.postingEnd ? new Date(v.postingEnd.slice(0, 10) + "T23:59:59.999") : null;
    const deadlinePassed = end ? end < today : false;
    const isFilled = v.fillingUpStatus === 'FILLED' || v.filling_up_status === 'FILLED';
    const rawStatus = (v.status || '').toLowerCase();

    // 1. Filled item is always Closed
    if (isFilled) {
      return 'Closed';
    }

    // 2. Past deadline is Closed
    if (deadlinePassed) {
      return 'Closed';
    }

    // 3. For Publication: New added item_no (no posting dates set), starting date in advance (future), or explicitly for_publication
    if (!start || start > today || rawStatus === 'for_publication') {
      if (rawStatus === 'closed' && start && end) {
        return 'Closed';
      }
      return 'For Publication';
    }

    // 4. Closed: Item was explicitly closed
    if (rawStatus === 'closed') {
      return 'Closed';
    }

    // 5. Open for Application: Active posting window
    return 'Open for Application';
  };

  const vacanciesKpiStats = useMemo(() => {
    const total = vacancies.length;
    const forPublication = vacancies.filter(v => getVacancyPostingStatus(v) === 'For Publication').length;
    const open = vacancies.filter(v => getVacancyPostingStatus(v) === 'Open for Application').length;
    const closed = vacancies.filter(v => getVacancyPostingStatus(v) === 'Closed').length;
    return { total, forPublication, open, closed };
  }, [vacancies]);

  const getVacancyCellValue = (v, key) => {
    if (key === 'itemNo') return v.itemNo || '';
    if (key === 'position') return positions.find(p => p.id === v.positionId)?.title || 'Unmapped position';
    if (key === 'schoolOffice') return v.school || v.division || '';
    if (key === 'applications') return applications.filter(a => a.vacancyId === v.jobClusterId).length;
    if (key === 'deadline') return v.postingEnd || '';
    if (key === 'daysRemaining') {
      const status = getVacancyPostingStatus(v);
      if (status !== 'Open for Application' || !v.postingEnd) return -999999;
      const end = new Date(v.postingEnd.slice(0, 10) + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.round((end - today) / 86400000);
    }
    if (key === 'postingStatus') {
      return getVacancyPostingStatus(v);
    }
    if (key === 'fillingUpStatus') {
      return v.fillingUpStatus || 'UNFILLED';
    }
    return '';
  };

  const filteredVacancies = useMemo(() => {
    let list = vacancies;
    if (vacSearch) {
      const q = vacSearch.toLowerCase();
      list = list.filter(v => 
        (v.itemNo || '').toLowerCase().includes(q) || 
        (positions.find(p => p.id === v.positionId)?.title || '').toLowerCase().includes(q) ||
        (v.school || v.division || '').toLowerCase().includes(q)
      );
    }
    if (vacPosFilter) list = list.filter(v => v.positionId === vacPosFilter);
    if (vacStatusFilter) {
      list = list.filter(v => getVacancyPostingStatus(v) === vacStatusFilter);
    }

    Object.entries(vColumnFilters).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') return;
      const type = ['applications', 'daysRemaining'].includes(key) ? 'numeric' : ['position', 'postingStatus', 'fillingUpStatus'].includes(key) ? 'categorical' : 'text';
      if (type === 'numeric') {
        if (val.min !== undefined && val.min !== '') {
          list = list.filter(v => getVacancyCellValue(v, key) >= Number(val.min));
        }
        if (val.max !== undefined && val.max !== '') {
          list = list.filter(v => {
            const cellVal = getVacancyCellValue(v, key);
            return cellVal !== -999999 && cellVal <= Number(val.max);
          });
        }
      } else if (type === 'categorical') {
        list = list.filter(v => getVacancyCellValue(v, key) === val);
      } else {
        list = list.filter(v => String(getVacancyCellValue(v, key)).toLowerCase().includes(val.toLowerCase()));
      }
    });

    if (vSortKey) {
      const dir = vSortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = getVacancyCellValue(a, vSortKey);
        const bv = getVacancyCellValue(b, vSortKey);
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
    return list;
  }, [vacancies, vacSearch, vacPosFilter, vacStatusFilter, vColumnFilters, vSortKey, vSortDir, positions, applications]);

  const paginatedVacancies = useMemo(() => {
    const start = (vacPage - 1) * vacPageSize;
    return filteredVacancies.slice(start, start + vacPageSize);
  }, [filteredVacancies, vacPage, vacPageSize]);

  const handleVSortClick = (key) => {
    if (vSortKey === key) {
      setVSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setVSortKey(key);
      setVSortDir('asc');
    }
  };

  const handleToggleVacancy = (vac) => {
    const postingStatus = getVacancyPostingStatus(vac);
    const statusLower = (vac.status || '').toLowerCase();

    if (postingStatus !== 'Open for Application') {
      setCalVacancy(vac);
      const initStart = vac.postingStart ? vac.postingStart.slice(0, 10) : new Date().toISOString().slice(0, 10);
      setCalStart(initStart);
      setCalEnd(vac.postingEnd ? vac.postingEnd.slice(0, 10) : '');
      setCalField('start');
      const initDate = new Date(initStart + "T00:00:00");
      setCalYear(initDate.getFullYear());
      setCalMonth(initDate.getMonth());

      // Reopening / Posting Decision Modal (Option A: Fetch Latest vs Option B: Retain Current)
      setCalDocPolicy(vac.docFetchPreference || 'RETAIN_OLD');

      // Check if all vacancies in the same division are closed
      const targetDiv = (vac.division || 'SDO').toLowerCase();
      const divVacancies = vacancies.filter(v => (v.division || 'SDO').toLowerCase() === targetDiv);
      const isAnyOpenInDivision = divVacancies.some(v => getVacancyPostingStatus(v) === 'Open for Application' || (v.status || '').toLowerCase() === 'open');

      if (isAnyOpenInDivision) {
        setShowDocPolicyModal(false);
        setShowCalendar(true);
      } else {
        setShowDocPolicyModal(true);
      }
    } else {
      setCloseWarningVac(vac);
      setShowCloseWarning(true);
      setCloseReason('');
      setCloseReasonOther('');
      setClosePasscode('');
      setPasscodeError('');
    }
  };

  const handleProceedToCalendar = () => {
    setShowDocPolicyModal(false);
    setShowCalendar(true);
  };

  const doCloseVacancy = async (vacId, overridden, reason = '') => {
    try {
      await apiFetch(`/api/vacancies/${vacId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'closed' })
      });
      setShowCloseWarning(false);
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleInitiateDeleteVacancy = (vac) => {
    setDeleteConfirmVac(vac);
    setDeletePasscode('');
    setDeletePasscodeError('');
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDeleteVacancy = async () => {
    if (!deletePasscode) {
      setDeletePasscodeError("Please enter your passcode.");
      return;
    }
    try {
      await apiFetch('/api/auth/verify-passcode', {
        method: 'POST',
        body: JSON.stringify({ passcode: deletePasscode })
      });
      await apiFetch(`/api/vacancies/${deleteConfirmVac.id}`, {
        method: 'DELETE'
      });
      setToast({ message: 'Vacancy deleted successfully.', type: 'success' });
      setShowDeleteConfirmModal(false);
      setDeleteConfirmVac(null);
      loadAllData();
    } catch (e) {
      setDeletePasscodeError(e.message || "Incorrect passcode. Deletion is not allowed.");
    }
  };

  const handleConfirmOverrideClose = async () => {
    let finalReason = closeReason;
    if (closeReason === '__other__') {
      finalReason = closeReasonOther.trim();
      if (!finalReason) {
        setPasscodeError("Please specify the reason for closing this posting abruptly.");
        return;
      }
    }
    if (!finalReason) {
      setPasscodeError("Please select a justification for closing this posting abruptly.");
      return;
    }
    try {
      await apiFetch('/api/auth/verify-passcode', {
        method: 'POST',
        body: JSON.stringify({ passcode: closePasscode })
      });
      doCloseVacancy(closeWarningVac.id, true, finalReason);
    } catch (e) {
      setPasscodeError(e.message || "Incorrect passcode. Closing is still not allowed.");
    }
  };

  const handleConfirmSchedule = async () => {
    if (!calVacancy || !calStart || !calEnd) return setToast({ message: 'Please input all values', type: 'error' });
    const startD = new Date(calStart + "T00:00:00");
    const endD = new Date(calEnd + "T00:00:00");
    if (endD < startD) {
      return setToast({ message: "Deadline cannot be earlier than the start date.", type: 'error' });
    }
    try {
      const isClosedStatus = (calVacancy.status || '').toLowerCase() === 'closed';

      await apiFetch(`/api/vacancies/${calVacancy.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'open',
          postingStart: calStart,
          postingEnd: calEnd,
          docFetchPreference: calDocPolicy || 'RETAIN_OLD',
          allowedEmails: []
        })
      });

      // Once Confirm & Open Vacancy succeeds, call the document fetching endpoint to retrieve updated records if Option A
      if (calDocPolicy === 'FETCH_NEW') {
        try {
          await apiFetch(`/api/vacancies/${calVacancy.id}/fetch-documents`, {
            method: 'POST'
          });
          console.log(`[Vacancies FE] 🟢 Successfully triggered document fetching for vacancy ${calVacancy.id}`);
        } catch (fetchErr) {
          console.warn('[Vacancies FE] Document fetching notice:', fetchErr.message);
        }
      }

      setShowCalendar(false);
      setToast({ 
        message: calDocPolicy === 'FETCH_NEW' 
          ? 'Vacancy posting opened successfully and latest documents retrieved!' 
          : 'Vacancy posting opened successfully!', 
        type: 'success' 
      });
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };


  const handleScanNOSCA = () => {
    document.getElementById('nosca-file-input')?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setNoscaScanning(true);
    setToast({ message: 'Uploading and scanning NOSCA PDF...', type: 'info' });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result.split(',')[1];
          const response = await apiFetch('/api/vacancies/scan-nosca', {
            method: 'POST',
            body: JSON.stringify({ fileData: base64Data, fileName: file.name })
          });

          const positionName = response.position || "School Counselor Associate I";
          const positionId = positions.find(p => p.title.toLowerCase() === positionName.toLowerCase())?.id;

          const items = response.items.map(itemNo => ({
            itemNo,
            title: positionName,
            positionId: positionId || '',
            schoolLevel: '',
            schoolId: null,
            schoolName: '',
            schoolSearchQuery: ''
          }));

          setDetectedItems(items);
          setSelectedNoscaItemNos(items.map(it => it.itemNo));
          setToast({ message: `Successfully scanned ${items.length} items from NOSCA!`, type: 'success' });
        } catch (err) {
          setToast({ message: err.message || 'Failed to scan file', type: 'error' });
        } finally {
          setNoscaScanning(false);
        }
      };
      reader.onerror = () => {
        setToast({ message: 'Failed to read file', type: 'error' });
        setNoscaScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      setNoscaScanning(false);
    }
  };

  const handleAddNoscaVacancies = async () => {
    const toAdd = detectedItems.filter(it => selectedNoscaItemNos.includes(it.itemNo));
    if (!toAdd.length) return setToast({ message: 'Please tick at least one item to add', type: 'error' });
    
    // Check validation per item
    for (const it of toAdd) {
      if (!it.schoolLevel) {
        return setToast({ message: `Please select a School Level for item ${it.itemNo}.`, type: 'error' });
      }
      if (it.schoolLevel === 'JHS' && !it.schoolId) {
        return setToast({ message: `Please select a valid JHS school ID for item ${it.itemNo}.`, type: 'error' });
      }
    }

    const payloadItems = toAdd.map(item => ({
      itemNo: item.itemNo,
      title: item.title,
      positionId: item.positionId,
      schoolLevel: item.schoolLevel,
      schoolId: item.schoolLevel === 'JHS' ? item.schoolId : null,
      schoolName: item.schoolLevel === 'JHS' ? item.schoolName : ''
    }));

    try {
      await apiFetch('/api/vacancies/import-nosca', { 
        method: 'POST', 
        body: JSON.stringify({ items: payloadItems }) 
      });
      setToast({ message: 'Vacancies added successfully!', type: 'success' });
      setShowNosca(false);
      setDetectedItems([]);
      setSelectedNoscaItemNos([]);
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleConfirmAddManual = async () => {
    if (!manualPositionId) {
      setToast({ message: 'Please select a position.', type: 'error' });
      return;
    }
    if (!isValidItemNo(manualItemNo)) {
      setToast({ message: 'Item number format must be like OSEC-DEPEDB-ADO2-540033-2026 or SCA1-00000-2026.', type: 'error' });
      return;
    }
    if (!manualSchoolLevel) {
      setToast({ message: 'Please select a school level.', type: 'error' });
      return;
    }
    if (manualSchoolLevel === 'JHS' && !manualSchoolId) {
      setToast({ message: 'Please select a school ID for JHS.', type: 'error' });
      return;
    }

    const pos = positions.find(p => p.id === manualPositionId);
    const newItem = {
      itemNo: manualItemNo,
      title: pos.title,
      positionId: manualPositionId,
      schoolLevel: manualSchoolLevel,
      schoolId: manualSchoolLevel === 'JHS' ? manualSchoolId : null,
      schoolName: manualSchoolLevel === 'JHS' ? manualSchoolName : ''
    };

    try {
      await apiFetch('/api/vacancies/import-nosca', {
        method: 'POST',
        body: JSON.stringify({ items: [newItem] })
      });
      setToast({ message: 'Vacancy created successfully!', type: 'success' });
      setShowNosca(false);
      setShowManualFields(false);
      setManualPositionId('');
      setManualItemNo('SCA1-00000-2026');
      setManualSchoolLevel('');
      setManualSchoolId(null);
      setManualSchoolName('');
      setManualSchoolSearchQuery('');
      loadAllData();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleAddManually = () => {
    const positionName = "School Counselor Associate I";
    const positionId = positions.find(p => p.title.toLowerCase() === positionName.toLowerCase())?.id || '';
    setManualPositionId(positionId);
    setManualItemNo('SCA1-00000-2026');
    setManualSchoolLevel('');
    setManualSchoolId(null);
    setManualSchoolName('');
    setManualSchoolSearchQuery('');
    setShowManualFields(true);
  };

  const selectCalDate = (iso) => {
    if (calField === 'start') {
      setCalStart(iso);
      if (calEnd && iso > calEnd) {
        setCalEnd('');
      }
    } else {
      if (calStart && iso < calStart) {
        setToast({ message: "Deadline cannot be earlier than the start date.", type: 'error' });
        return;
      }
      setCalEnd(iso);
    }
  };

  const countCalendarDays = (startIso, endIso) => {
    if (!startIso || !endIso) return 0;
    const start = new Date(startIso + "T00:00:00");
    const end = new Date(endIso + "T00:00:00");
    return Math.max(0, Math.round((end - start) / 86400000));
  };

  const getCalSummaryText = () => {
    if (!calStart && !calEnd) return 'No dates selected yet.';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fmt = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" }) : 'Not set';
    const rel = (iso) => {
      const d = Math.round((new Date(iso + "T00:00:00") - today) / 86400000);
      return d > 0 ? `in ${d} day(s)` : d === 0 ? "today" : `${Math.abs(d)} day(s) ago`;
    };
    const parts = [];
    if (calStart) parts.push(`Opens <b>${fmt(calStart)}</b> (${rel(calStart)})`);
    if (calEnd) parts.push(`Deadline <b>${fmt(calEnd)}</b> (${rel(calEnd)})`);
    return parts.join(' and ');
  };

  return (
    <section className="view active">
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Total Items</div>
          <div className="kpi-number">{vacanciesKpiStats.total}</div>
          <div className="kpi-caption">All HRMO postings</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">For Publication</div>
          <div className="kpi-number">{vacanciesKpiStats.forPublication}</div>
          <div className="kpi-caption">Unopened or unposted items</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Open for Application</div>
          <div className="kpi-number">{vacanciesKpiStats.open}</div>
          <div className="kpi-caption">Accepting applicants</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Closed</div>
          <div className="kpi-number">{vacanciesKpiStats.closed}</div>
          <div className="kpi-caption">Filled or closed items</div>
        </div>
      </div>

      <div className="controls-row">
        <div className="filterbar">
          <div className="toolbar">
            <div>
              <label>Global search</label>
              <input type="text" placeholder="Search item no., title, school..." value={vacSearch} onChange={e => setVacSearch(e.target.value)} />
            </div>
            <div>
              <label>Position</label>
              <select value={vacPosFilter} onChange={e => setVacPosFilter(e.target.value)}>
                <option value="">All positions</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label>Posting Status</label>
              <select value={vacStatusFilter} onChange={e => setVacStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="For Publication">For Publication</option>
                <option value="Open for Application">Open for Application</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card action-card">
          <div className="action-title">Quick Actions</div>
          <button className="secondary" onClick={() => setShowNosca(true)}>Add Vacancy from NOSCA</button>
        </div>
      </div>

      <div className="card">
        <h2>Vacancy Postings</h2>
        <div className="table-wrap">
          <table style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="row-num">No.</th>
                <th>
                  <button className="th-btn" onClick={() => handleVSortClick('itemNo')}>Item No. {vSortKey === 'itemNo' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <input
                    className="column-filter"
                    placeholder="Filter.."
                    value={vColumnFilters.itemNo || ''}
                    onChange={e => {
                      setVColumnFilters({ ...vColumnFilters, itemNo: e.target.value });
                      setVacPage(1);
                    }}
                  />
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleVSortClick('position')}>Position {vSortKey === 'position' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <select
                    className="column-filter"
                    value={vColumnFilters.position || ''}
                    onChange={e => {
                      setVColumnFilters({ ...vColumnFilters, position: e.target.value });
                      setVacPage(1);
                    }}
                  >
                    <option value="">All</option>
                    {[...new Set(positions.map(p => p.title))].sort().map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleVSortClick('schoolOffice')}>School {vSortKey === 'schoolOffice' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <input
                    className="column-filter"
                    placeholder="Filter.."
                    value={vColumnFilters.schoolOffice || ''}
                    onChange={e => {
                      setVColumnFilters({ ...vColumnFilters, schoolOffice: e.target.value });
                      setVacPage(1);
                    }}
                  />
                </th>

                <th>
                  <button className="th-btn" onClick={() => handleVSortClick('deadline')}>Deadline {vSortKey === 'deadline' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <input
                    className="column-filter"
                    placeholder="Filter.."
                    value={vColumnFilters.deadline || ''}
                    onChange={e => {
                      setVColumnFilters({ ...vColumnFilters, deadline: e.target.value });
                      setVacPage(1);
                    }}
                  />
                </th>
                <th className="num-col">
                  <button className="th-btn" onClick={() => handleVSortClick('daysRemaining')}>Days Remaining {vSortKey === 'daysRemaining' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <div className="column-filter-range" style={{ display: 'flex', gap: '4px' }}>
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Min"
                      value={vColumnFilters.daysRemaining?.min || ''}
                      onChange={e => {
                        const current = vColumnFilters.daysRemaining || {};
                        setVColumnFilters({ ...vColumnFilters, daysRemaining: { ...current, min: e.target.value } });
                        setVacPage(1);
                      }}
                    />
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Max"
                      value={vColumnFilters.daysRemaining?.max || ''}
                      onChange={e => {
                        const current = vColumnFilters.daysRemaining || {};
                        setVColumnFilters({ ...vColumnFilters, daysRemaining: { ...current, max: e.target.value } });
                        setVacPage(1);
                      }}
                    />
                  </div>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleVSortClick('postingStatus')}>Posting Status {vSortKey === 'postingStatus' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <select
                    className="column-filter"
                    value={vColumnFilters.postingStatus || ''}
                    onChange={e => {
                      setVColumnFilters({ ...vColumnFilters, postingStatus: e.target.value });
                      setVacPage(1);
                    }}
                  >
                    <option value="">All</option>
                    <option value="For Publication">For Publication</option>
                    <option value="Open for Application">Open for Application</option>
                    <option value="Closed">Closed</option>
                  </select>
                </th>
                <th>
                  <button className="th-btn" onClick={() => handleVSortClick('fillingUpStatus')}>Filling Status {vSortKey === 'fillingUpStatus' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <select
                    className="column-filter"
                    value={vColumnFilters.fillingUpStatus || ''}
                    onChange={e => {
                      setVColumnFilters({ ...vColumnFilters, fillingUpStatus: e.target.value });
                      setVacPage(1);
                    }}
                  >
                    <option value="">All</option>
                    <option value="UNFILLED">UNFILLED</option>
                    <option value="FILLED">FILLED</option>
                  </select>
                </th>
                <th style={{ width: '190px', minWidth: '190px', textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const grouped = {};
                paginatedVacancies.forEach(vac => {
                  const title = positions.find(p => p.id === vac.positionId)?.title || vac.title || 'Unassigned';
                  if (!grouped[title]) grouped[title] = [];
                  grouped[title].push(vac);
                });
                if (paginatedVacancies.length === 0) {
                  return (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center' }}>No vacancies match the filters.</td>
                    </tr>
                  );
                }
                return Object.entries(grouped).map(([clusterName, items]) => (
                  <VacancyClusterAccordion key={clusterName} title={clusterName} colSpan={9}>
                    {items.map((vac, idx) => {
                      const appCount = applications.filter(a => a.vacancyId === vac.jobClusterId).length;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const end = vac.postingEnd ? new Date(vac.postingEnd.slice(0, 10) + "T23:59:59.999") : null;
                      const postingStatus = getVacancyPostingStatus(vac);
                      const deadlinePast = end ? end < today : false;
                      
                      let drText = 'N/A';
                      let drColor = 'var(--muted)';
                      if (postingStatus === 'Open for Application' && end) {
                        const rem = Math.round((end - today) / 86400000);
                        drText = String(rem);
                        drColor = rem <= 1 ? 'var(--red)' : rem <= 3 ? 'var(--amber)' : 'var(--green)';
                      }

                      const deadlineColor = deadlinePast ? 'var(--red)' : 'var(--text)';

                      return (
                        <tr key={vac.id}>
                          <td className="row-num">{(vacPage - 1) * vacPageSize + idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <b>{vac.itemNo}</b>
                              {Array.isArray(vac.allowedEmails) && vac.allowedEmails.length > 0 && (() => {
                                const submittedEmails = getSubmittedEmailsForVacancy(vac);
                                const pendingCount = vac.allowedEmails.filter(e => !submittedEmails.has(String(e).trim().toLowerCase())).length;
                                if (pendingCount === 0) return null;
                                return (
                                  <span style={{ fontSize: '10px', color: '#4F46E5', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '4px', padding: '1px 5px', width: 'fit-content', fontWeight: '700' }}>
                                    👥 Restricted ({pendingCount})
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td>{positions.find(p => p.id === vac.positionId)?.title || vac.title}</td>
                          <td>{vac.school || 'Division Pool'}</td>

                          <td><span className="qs-number" style={{ color: deadlineColor }}>{vac.postingEnd ? vac.postingEnd.slice(0, 10) : '—'}</span></td>
                          <td className="num-col"><span className="qs-number" style={{ color: drColor }}>{drText}</span></td>
                          <td>
                            {postingStatus === 'Open for Application' && <span className="badge green">Open for Application</span>}
                            {postingStatus === 'For Publication' && <span className="badge blue" style={{ background: '#E0F2FE', color: '#0369A1' }}>For Publication</span>}
                            {postingStatus === 'Closed' && <span className="badge gray">Closed</span>}
                          </td>
                          <td>
                            <span className={`badge ${vac.fillingUpStatus === 'FILLED' ? 'filled-status' : 'unfilled-status'}`}>
                              {vac.fillingUpStatus === 'FILLED' ? 'FILLED' : 'UNFILLED'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '190px', minWidth: '190px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexWrap: 'nowrap' }}>
                              <button 
                                className={`vac-action ${postingStatus === 'Open for Application' ? 'danger' : 'good'}`} 
                                onClick={() => handleToggleVacancy(vac)}
                                style={{
                                  whiteSpace: 'nowrap',
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  borderRadius: '8px',
                                  minWidth: '56px',
                                  height: '30px'
                                }}
                              >
                                {postingStatus === 'Open for Application' ? 'Close' : 'Open'}
                              </button>
                              {(postingStatus === 'Closed' || postingStatus === 'For Publication') && (
                                <button
                                  type="button"
                                  className="vac-action"
                                  onClick={() => handleOpenInviteModal(vac)}
                                  title="Invite specific emails to access this vacancy item"
                                  style={{
                                    whiteSpace: 'nowrap',
                                    background: '#EEF2FF',
                                    color: '#4338CA',
                                    border: '1.5px solid #C7D2FE',
                                    fontWeight: '700',
                                    fontSize: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    height: '30px',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(79, 70, 229, 0.08)',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseOver={e => {
                                    e.currentTarget.style.background = '#4F46E5';
                                    e.currentTarget.style.color = '#FFFFFF';
                                    e.currentTarget.style.borderColor = '#4338CA';
                                  }}
                                  onMouseOut={e => {
                                    e.currentTarget.style.background = '#EEF2FF';
                                    e.currentTarget.style.color = '#4338CA';
                                    e.currentTarget.style.borderColor = '#C7D2FE';
                                  }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                  </svg>
                                  <span>Invite</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleInitiateDeleteVacancy(vac)}
                                title="Delete vacancy"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#EF4444',
                                  padding: '5px',
                                  height: '30px',
                                  width: '30px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '8px',
                                  transition: 'background-color 0.15s ease',
                                  flexShrink: 0
                                }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </VacancyClusterAccordion>
                ));
              })()}
            </tbody>
          </table>
        </div>

        <div className="pager-controls">
          <div className="pager-group">
            <button className="secondary" onClick={() => setVacPage(p => Math.max(1, p - 1))} disabled={vacPage === 1}>Prev</button>
            <span className="small">Page {vacPage} of {Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize))} · {filteredVacancies.length} vacancies</span>
            <button className="secondary" onClick={() => setVacPage(p => Math.min(Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize)), p + 1))} disabled={vacPage === Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize))}>Next</button>
          </div>
          <div className="pager-group">
            <div className="pager-field">
              <label>Rows</label>
              <select value={vacPageSize} onChange={e => { setVacPageSize(Number(e.target.value)); setVacPage(1); }}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="pager-field">
              <label>Go to page</label>
              <select value={vacPage} onChange={e => setVacPage(Number(e.target.value))}>
                {Array.from({ length: Math.max(1, Math.ceil(filteredVacancies.length / vacPageSize)) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: STEP 1 - REOPEN DOCUMENT POLICY SELECTION */}
      {showDocPolicyModal && calVacancy && (
        <div className="modal open" style={{ backdropFilter: 'blur(6px)', background: 'rgba(15, 23, 42, 0.55)', zIndex: 100000 }}>
          <div className="modal-box" style={{ width: 'min(640px, 94vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(226, 232, 240, 0.8)', overflow: 'hidden', padding: 0 }}>
            {/* Modal Header */}
            <div className="modal-head" style={{ padding: '18px 24px', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📂</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', fontFamily: 'var(--font-heading)' }}>Reopen Vacancy — Document Policy</h3>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Step 1 of 2: Configure applicant document rules</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDocPolicyModal(false)}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', fontWeight: '800', fontSize: '14px', transition: 'all 0.15s' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content - Scrollable Body */}
            <div style={{ padding: '20px 24px', background: '#FFFFFF', overflowY: 'auto', flex: 1 }}>
              {/* Position Context Card */}
              <div style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 18px', marginBottom: '18px', textAlign: 'left' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#64748B', marginBottom: '4px' }}>Target Vacancy Item</div>
                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#0F172A', lineHeight: 1.3 }}>{calVacancy.title || 'Vacancy Item'}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <span style={{ background: '#E2E8F0', color: '#334155', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                    {calVacancy.itemNo}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                    Division: <strong style={{ color: '#1E293B' }}>{calVacancy.division || 'SDO'}</strong>
                  </span>
                </div>
              </div>

              {/* Selection Section */}
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', display: 'block' }}>
                  Select Applicant Document Fetching Policy
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Option 1: FETCH_NEW */}
                  <div
                    onClick={() => setCalDocPolicy('FETCH_NEW')}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px 38px 1fr',
                      alignItems: 'center',
                      gap: '14px',
                      cursor: 'pointer',
                      padding: '14px 16px',
                      borderRadius: '16px',
                      background: calDocPolicy === 'FETCH_NEW' ? 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)' : '#FFFFFF',
                      border: calDocPolicy === 'FETCH_NEW' ? '2px solid #10B981' : '1.5px solid #E2E8F0',
                      boxShadow: calDocPolicy === 'FETCH_NEW' ? '0 4px 14px -2px rgba(16, 185, 129, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="step1DocPolicy" 
                      value="FETCH_NEW" 
                      checked={calDocPolicy === 'FETCH_NEW'} 
                      onChange={() => setCalDocPolicy('FETCH_NEW')} 
                      style={{ width: '18px', height: '18px', accentColor: '#10B981', cursor: 'pointer', margin: 0 }} 
                    />
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: calDocPolicy === 'FETCH_NEW' ? '#D1FAE5' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      🟢
                    </div>
                    <div>
                      <b style={{ display: 'block', fontSize: '13.5px', color: '#0F172A', fontWeight: '800', lineHeight: 1.2 }}>Option A — Fetch New Documents</b>
                      <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '500', lineHeight: 1.4, display: 'block', marginTop: '3px' }}>
                        Fetch the applicant's latest documents from new uploads. These newly fetched documents will become the current documents and remain retained even if the item is closed again.
                      </span>
                    </div>
                  </div>

                  {/* Option 2: RETAIN_OLD */}
                  <div
                    onClick={() => setCalDocPolicy('RETAIN_OLD')}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px 38px 1fr',
                      alignItems: 'center',
                      gap: '14px',
                      cursor: 'pointer',
                      padding: '14px 16px',
                      borderRadius: '16px',
                      background: calDocPolicy === 'RETAIN_OLD' ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' : '#FFFFFF',
                      border: calDocPolicy === 'RETAIN_OLD' ? '2px solid #D97706' : '1.5px solid #E2E8F0',
                      boxShadow: calDocPolicy === 'RETAIN_OLD' ? '0 4px 14px -2px rgba(217, 119, 6, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="step1DocPolicy" 
                      value="RETAIN_OLD" 
                      checked={calDocPolicy === 'RETAIN_OLD'} 
                      onChange={() => setCalDocPolicy('RETAIN_OLD')} 
                      style={{ width: '18px', height: '18px', accentColor: '#D97706', cursor: 'pointer', margin: 0 }} 
                    />
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: calDocPolicy === 'RETAIN_OLD' ? '#FDE68A' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      🔒
                    </div>
                    <div>
                      <b style={{ display: 'block', fontSize: '13.5px', color: '#0F172A', fontWeight: '800', lineHeight: 1.2 }}>Option B — Retain Current Files</b>
                      <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '500', lineHeight: 1.4, display: 'block', marginTop: '3px' }}>
                        Do not fetch from new uploads. Keep the currently stored documents unchanged without importing newer versions.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions - Pinned at bottom */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0 }}>
              <button 
                type="button" 
                onClick={() => setShowDocPolicyModal(false)}
                style={{ padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleProceedToCalendar} 
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
              >
                <span>Next: Set Posting Schedule</span>
                <span style={{ fontSize: '14px' }}>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INVITE SPECIFIC EMAILS TO CLOSED VACANCY */}
      {showInviteModal && inviteVacancy && (
        <div className="modal open" style={{ backdropFilter: 'blur(6px)', background: 'rgba(15, 23, 42, 0.55)', zIndex: 100000 }}>
          <div className="modal-box" style={{ width: 'min(860px, 96vw)', minHeight: 'min(500px, 85vh)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(226, 232, 240, 0.8)', overflow: 'hidden', padding: 0 }}>
            {/* Modal Header */}
            <div className="modal-head" style={{ padding: '18px 28px', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>✉️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', fontFamily: 'var(--font-heading)' }}>Invite Applicants to Vacancy</h3>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Restrict access & application submissions exclusively to authorized emails</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowInviteModal(false)}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569', fontWeight: '800', fontSize: '14px', transition: 'all 0.15s' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content - Scrollable Body */}
            <div style={{ padding: '20px 28px', background: '#FFFFFF', overflowY: 'auto', flex: 1 }}>
              {/* Target Item Context Card */}
              <div style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 18px', marginBottom: '16px', textAlign: 'left' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#64748B', marginBottom: '4px' }}>Target Vacancy Item</div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A', lineHeight: 1.3 }}>{inviteVacancy.title || 'Vacancy Item'}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <span style={{ background: '#E2E8F0', color: '#334155', fontSize: '11.5px', fontWeight: '700', padding: '3px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                    {inviteVacancy.itemNo}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                    Division: <strong style={{ color: '#1E293B' }}>{inviteVacancy.division || 'SDO'}</strong>
                  </span>
                </div>
              </div>

              {/* Navigation Tab Bar */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1.5px solid #E2E8F0', marginBottom: '18px', paddingBottom: '2px' }}>
                <button
                  type="button"
                  onClick={() => setInviteModalTab('config')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: inviteModalTab === 'config' ? '3px solid #4F46E5' : '3px solid transparent',
                    background: inviteModalTab === 'config' ? '#EEF2FF' : 'transparent',
                    color: inviteModalTab === 'config' ? '#4338CA' : '#64748B',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>✉️</span>
                  <span>Invite Applicants</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInviteModalTab('invitations')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: inviteModalTab === 'invitations' ? '3px solid #4F46E5' : '3px solid transparent',
                    background: inviteModalTab === 'invitations' ? '#EEF2FF' : 'transparent',
                    color: inviteModalTab === 'invitations' ? '#4338CA' : '#64748B',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>👥</span>
                  <span>Invited Applicants</span>
                  <span style={{
                    fontSize: '10.5px',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    background: inviteModalTab === 'invitations' ? '#4F46E5' : '#E2E8F0',
                    color: inviteModalTab === 'invitations' ? '#FFFFFF' : '#475569',
                    fontWeight: '900'
                  }}>
                    {inviteAllowedEmails.length}
                  </span>
                </button>
              </div>

              {/* TAB 1: INVITE APPLICANTS */}
              {inviteModalTab === 'config' && (
                <div
                  style={{
                    padding: '18px 20px',
                    background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                    borderRadius: '16px',
                    border: '1.5px solid #C7D2FE',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      Authorized Email Allowlist
                    </label>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: inviteAllowedEmails.length > 0 ? '#4F46E5' : '#94A3B8' }}>
                      {inviteAllowedEmails.length} email{inviteAllowedEmails.length === 1 ? '' : 's'} authorized
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                    Enter the email address of applicants you wish to grant access to. Only invited applicants will be able to view and submit applications for this item.
                  </p>

                  {/* Input bar with floating suggestions dropdown */}
                  <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="email"
                        value={inviteEmailInput}
                        onChange={(e) => {
                          setInviteEmailInput(e.target.value);
                          if (inviteEmailError) setInviteEmailError('');
                          setShowInviteSuggestionsDropdown(true);
                        }}
                        onFocus={() => {
                          if (inviteSuggestions.length > 0) {
                            setShowInviteSuggestionsDropdown(true);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddInviteEmail();
                            setShowInviteSuggestionsDropdown(false);
                          } else if (e.key === 'Escape') {
                            setShowInviteSuggestionsDropdown(false);
                          }
                        }}
                        placeholder="Type applicant email or name (e.g. user@deped.gov.ph)..."
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 12px',
                          borderRadius: '10px',
                          border: inviteEmailError ? '1.5px solid #EF4444' : '1.5px solid #CBD5E1',
                          fontSize: '12.5px',
                          background: '#FFFFFF',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />

                      {/* Floating Suggestions Dropdown */}
                      {showInviteSuggestionsDropdown && inviteSuggestions.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#FFFFFF',
                            border: '1.5px solid #C7D2FE',
                            borderRadius: '10px',
                            boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            zIndex: 999999,
                            maxHeight: '160px',
                            overflowY: 'auto',
                            marginTop: '4px'
                          }}
                        >
                          <div style={{ padding: '6px 12px 4px', fontSize: '10px', fontWeight: '800', color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                            Matching Applicants ({inviteSuggestions.length})
                          </div>
                          {inviteSuggestions.map((sug) => (
                            <div
                              key={sug.email}
                              onClick={() => handleSelectInviteSuggestion(sug.email)}
                              style={{
                                padding: '8px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                borderBottom: '1px solid #F8FAFC',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                transition: 'background 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#EEF2FF'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '14px', flexShrink: 0 }}>👤</span>
                                <div style={{ overflow: 'hidden' }}>
                                  <b style={{ color: '#1E293B', fontSize: '12px', fontFamily: 'monospace', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sug.email}</b>
                                  {sug.name && (
                                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748B', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                      {sug.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span style={{ fontSize: '10.5px', color: '#4F46E5', fontWeight: '800', background: '#E0E7FF', padding: '2px 8px', borderRadius: '6px', flexShrink: 0 }}>
                                + Select
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddInviteEmail();
                        setShowInviteSuggestionsDropdown(false);
                      }}
                      style={{
                        padding: '0 16px',
                        height: '38px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#4F46E5',
                        color: '#FFFFFF',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                        flexShrink: 0
                      }}
                    >
                      + Add Email
                    </button>
                  </div>

                  {/* Validation Error */}
                  {inviteEmailError && (
                    <div style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⚠</span> {inviteEmailError}
                    </div>
                  )}

                  {/* Chip List */}
                  {inviteAllowedEmails.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '140px', overflowY: 'auto', padding: '8px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #C7D2FE' }}>
                      {inviteAllowedEmails.map((email) => (
                        <span
                          key={email}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            background: '#EEF2FF',
                            border: '1px solid #C7D2FE',
                            color: '#3730A3',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '700',
                            fontFamily: 'monospace'
                          }}
                        >
                          <span>✉</span>
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveInviteEmail(email)}
                            title="Remove email"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#6366F1',
                              cursor: 'pointer',
                              fontWeight: '900',
                              fontSize: '14px',
                              lineHeight: 1,
                              padding: '0 2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic', padding: '8px', background: '#FFFFFF', borderRadius: '10px', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
                      No emails invited yet. Enter applicant emails above and click "Add Email".
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: INVITATIONS MANAGEMENT */}
              {inviteModalTab === 'invitations' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Invited Applicants</h4>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>Applicants authorized to submit applications for this vacancy item</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInviteModalTab('config')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#4F46E5',
                        color: '#FFFFFF',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                      }}
                    >
                      <span>+</span>
                      <span>Invite / Add Applicant</span>
                    </button>
                  </div>

                  {inviteAllowedEmails.length > 0 ? (
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', overflowX: 'auto', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            <th style={{ padding: '10px 14px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '22%' }}>Applicant</th>
                            <th style={{ padding: '10px 14px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '28%' }}>Email Address</th>
                            <th style={{ padding: '10px 14px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '12%' }}>Status</th>
                            <th style={{ padding: '10px 14px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '16%' }}>Date Invited</th>
                            <th style={{ padding: '10px 14px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '22%', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inviteAllowedEmails.map((email) => {
                            const applicantName = getApplicantNameForEmail(email);
                            const dateStr = inviteVacancy.updatedAt
                              ? new Date(inviteVacancy.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'Today';
                            return (
                              <tr key={email} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0F172A' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0 }}>
                                      {applicantName.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ whiteSpace: 'nowrap' }}>{applicantName}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#334155', fontSize: '12px' }}>
                                  {email}
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800', color: '#059669', background: '#D1FAE5', padding: '3px 8px', borderRadius: '12px' }}>
                                    ● Active
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                  {dateStr}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center', flexWrap: 'nowrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResendConfirmEmail(email);
                                        setShowResendConfirmModal(true);
                                      }}
                                      title="Resend invitation notification"
                                      style={{
                                        padding: '5px 10px',
                                        borderRadius: '7px',
                                        border: '1px solid #C7D2FE',
                                        background: '#EEF2FF',
                                        color: '#4338CA',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <span>🔄</span>
                                      <span>Resend</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRevokeConfirmEmail(email);
                                        setShowRevokeConfirmModal(true);
                                      }}
                                      title="Revoke applicant invitation"
                                      style={{
                                        padding: '5px 10px',
                                        borderRadius: '7px',
                                        border: '1px solid #FECACA',
                                        background: '#FEF2F2',
                                        color: '#DC2626',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <span>✕</span>
                                      <span>Revoke</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '32px 20px', textAlign: 'center', background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '28px' }}>📬</span>
                      <b style={{ color: '#0F172A', fontSize: '14px' }}>No Invitations Configured</b>
                      <p style={{ margin: 0, color: '#64748B', fontSize: '12.5px', maxWidth: '380px' }}>
                        There are currently no applicants invited to access this vacancy item. Switch to the Invite Applicants tab to add applicant email addresses.
                      </p>
                      <button
                        type="button"
                        onClick={() => setInviteModalTab('config')}
                        style={{
                          marginTop: '6px',
                          padding: '8px 18px',
                          borderRadius: '10px',
                          border: 'none',
                          background: '#4F46E5',
                          color: '#FFFFFF',
                          fontWeight: '800',
                          fontSize: '12.5px',
                          cursor: 'pointer'
                        }}
                      >
                        + Add Applicant to Invite
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', padding: '16px 28px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0 }}>
              <button 
                type="button" 
                onClick={() => setShowInviteModal(false)}
                style={{ padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                Close
              </button>
              {inviteModalTab === 'config' ? (
                <button 
                  type="button" 
                  onClick={handleSaveInviteModal} 
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)', color: '#FFFFFF', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                >
                  <span>Save & Grant Access</span>
                  <span style={{ fontSize: '14px' }}>✓</span>
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setInviteModalTab('config')}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)', color: '#FFFFFF', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                >
                  <span>+ Add More Applicants</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVOKE INVITATION CONFIRMATION */}
      {showRevokeConfirmModal && revokeConfirmEmail && (
        <div className="modal open" style={{ zIndex: 100003, left: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)' }}>
          <div className="modal-box" style={{ width: 'min(480px, 94vw)', padding: '24px 30px', borderRadius: '24px', background: 'white', borderTop: '6px solid #EF4444', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', fontFamily: 'var(--font-heading)' }}>Revoke invitation?</h3>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Confirm removal of access permissions</span>
              </div>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#334155', lineHeight: '1.5' }}>
              You are about to remove this applicant’s invitation to access this item. They will no longer be able to access it using this invitation.
            </p>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748B', marginBottom: '2px' }}>Target Applicant</div>
              <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '13.5px' }}>{getApplicantNameForEmail(revokeConfirmEmail)}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6366F1' }}>{revokeConfirmEmail}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => {
                  setShowRevokeConfirmModal(false);
                  setRevokeConfirmEmail(null);
                }}
                style={{ padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmRevokeInvite}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: 'white',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Revoke Invitation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESEND INVITATION CONFIRMATION */}
      {showResendConfirmModal && resendConfirmEmail && (
        <div className="modal open" style={{ zIndex: 100003, left: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)' }}>
          <div className="modal-box" style={{ width: 'min(480px, 94vw)', padding: '24px 30px', borderRadius: '24px', background: 'white', borderTop: '6px solid #4F46E5', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                ✉️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', fontFamily: 'var(--font-heading)' }}>Resend invitation?</h3>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Re-send invitation notification & access instructions</span>
              </div>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#334155', lineHeight: '1.5' }}>
              You are about to resend the invitation email to this applicant, allowing them to access and apply for this closed vacancy item.
            </p>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748B', marginBottom: '2px' }}>Target Applicant</div>
              <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '13.5px' }}>{getApplicantNameForEmail(resendConfirmEmail)}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4F46E5' }}>{resendConfirmEmail}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => {
                  setShowResendConfirmModal(false);
                  setResendConfirmEmail(null);
                }}
                style={{ padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmResendInvite}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                  color: 'white',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🔄 Resend Invitation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POSTING SCHEDULE CALENDAR */}
      {showCalendar && calVacancy && (() => {
        const position = positions.find(p => p.id === calVacancy.positionId) || {};
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const nowY = new Date().getFullYear();
        const yearOpts = [];
        for (let y = nowY - 1; y <= nowY + 6; y++) yearOpts.push(y);

        const startDow = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const todayIso = new Date().toISOString().slice(0, 10);

        const cells = [];
        for (let i = 0; i < startDow; i++) {
          cells.push(<div key={`empty-${i}`} className="cal-day muted" style={{ opacity: 0.15 }}></div>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isToday = iso === todayIso;
          const isStart = iso === calStart;
          const isEnd = iso === calEnd;
          const inRange = calStart && calEnd && iso > calStart && iso < calEnd;

          cells.push(
            <div
              key={`day-${d}`}
              className={`cal-day ${isToday ? 'today' : ''} ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${inRange ? 'range' : ''}`}
              onClick={() => selectCalDate(iso)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '40px',
                width: '40px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '900',
                fontSize: '13px',
                color: isStart || isEnd ? 'white' : inRange ? 'var(--blue)' : 'var(--navy)',
                backgroundColor: isStart || isEnd ? 'var(--green)' : inRange ? 'var(--blue-100)' : 'transparent',
                border: isToday ? '2px solid var(--blue)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {d}
            </div>
          );
        }

        const durationDays = countCalendarDays(calStart, calEnd);
        const formatBtnDate = (iso) => {
          if (!iso) return 'Not set';
          return new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
        };

        const calShift = (delta) => {
          let nextMonth = calMonth + delta;
          let nextYear = calYear;
          if (nextMonth < 0) {
            nextMonth = 11;
            nextYear -= 1;
          } else if (nextMonth > 11) {
            nextMonth = 0;
            nextYear += 1;
          }
          setCalMonth(nextMonth);
          setCalYear(nextYear);
        };

        return (
          <div className="modal open">
            <div className="modal-box" style={{ width: 'min(980px, 98vw)', maxHeight: '92vh' }}>
              <div className="modal-head" style={{
                paddingTop: '24px',
                paddingBottom: '12px',
                paddingLeft: '24px',
                paddingRight: '24px',
                background: 'white',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0 }}>Set Posting Schedule</h2>
                <button className="secondary" onClick={() => setShowCalendar(false)}>Close</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>
                <div className="posting-schedule-layout" style={{ marginTop: '16px' }}>
                  <aside className="posting-left-stack">
                    <section className="position-detail-panel">
                      <div className="posting-card-head">
                        <div className="position-detail-eyebrow">Position Details</div>
                        <h4>{position.title || calVacancy.title}</h4>
                        <p>Review the item details before opening the posting.</p>
                      </div>
                      <div className="position-info-grid">
                        <div className="position-info-tile">
                          <b>Item No.</b>
                          <span>{calVacancy.itemNo}</span>
                        </div>
                        <div className="position-info-tile">
                          <b>Salary Grade</b>
                          <span>{calVacancy.salaryGrade || position.salaryGrade || '11'}</span>
                        </div>
                        <div className="position-info-tile">
                          <b>School</b>
                          <span>{calVacancy.school || 'Not Specified'}</span>
                        </div>
                        <div className="position-info-tile">
                          <b>Division</b>
                          <span>{calVacancy.division || 'SDO Manila'}</span>
                        </div>
                      </div>
                    </section>

                    <section className="position-qs-card">
                      <div className="position-qs-card-head">
                        <div className="position-detail-eyebrow">Qualification Standards</div>
                        <h4>Minimum Requirements</h4>
                      </div>
                      <div className="position-qs-list">
                        <div className="position-qs-item">
                          <b>Bachelor's Degree</b>
                          <span>{position.requiredBachelorDegree || 'No minimum specified'}</span>
                        </div>
                        <div className="position-qs-item">
                          <b>Years of Experience</b>
                          <span>{position.minYearsExperience !== undefined ? `${position.minYearsExperience} minimum year(s)` : '0 minimum year(s)'}</span>
                        </div>
                        <div className="position-qs-item">
                          <b>Hours of Training</b>
                          <span>{position.minTrainingHours !== undefined ? `${position.minTrainingHours} minimum hour(s)` : '0 minimum hour(s)'}</span>
                        </div>
                        <div className="position-qs-item">
                          <b>Eligibility</b>
                          <span>{position.eligibilityRequired || 'Not specified'}</span>
                        </div>
                      </div>
                    </section>
                  </aside>

                  <section className="posting-calendar-panel">
                    <div className="posting-card-head">
                      <div className="position-detail-eyebrow">Posting Calendar</div>
                      <h4>Set Posting Schedule</h4>
                      <p>Choose the posting start date and deadline for <b>{calVacancy.itemNo}</b>.</p>
                    </div>

                    <div className="cal-fields" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F8FCFF', border: '2.5px solid var(--line)', borderRadius: '18px', padding: '10px' }}>
                      <button
                        type="button"
                        className={`cal-field ${calField === 'start' ? 'active' : ''}`}
                        onClick={() => setCalField('start')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '12px',
                          border: calField === 'start' ? '2.5px solid var(--blue)' : '1.5px solid var(--line)',
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span className="cf-label" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '800' }}>Start date</span>
                        <span className="cf-value" style={{ fontSize: '14px', fontWeight: '900', color: 'var(--navy)' }}>{formatBtnDate(calStart)}</span>
                      </button>
                      <span className="cal-arrow" style={{ fontSize: '20px', color: 'var(--muted)' }}>→</span>
                      <button
                        type="button"
                        className={`cal-field ${calField === 'end' ? 'active' : ''}`}
                        onClick={() => setCalField('end')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '12px',
                          border: calField === 'end' ? '2.5px solid var(--blue)' : '1.5px solid var(--line)',
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span className="cf-label" style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '800' }}>Deadline</span>
                        <span className="cf-value" style={{ fontSize: '14px', fontWeight: '900', color: 'var(--navy)' }}>{formatBtnDate(calEnd)}</span>
                      </button>
                    </div>

                    <div style={{ border: '2px solid var(--line)', borderRadius: '18px', padding: '16px', background: 'white' }}>
                      <div className="cal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <button className="cal-nav" onClick={() => calShift(-1)} style={{ padding: '4px 10px', fontSize: '18px', fontWeight: 'bold', background: 'var(--blue-100)', color: 'var(--blue)', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>‹</button>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <select
                            value={calMonth}
                            onChange={e => setCalMonth(Number(e.target.value))}
                            style={{ padding: '6px 12px', borderRadius: '10px', border: '1.5px solid var(--line)', fontWeight: '800', background: '#F8FCFF', color: 'var(--navy)' }}
                          >
                            {monthNames.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                          </select>
                          <select
                            value={calYear}
                            onChange={e => setCalYear(Number(e.target.value))}
                            style={{ padding: '6px 12px', borderRadius: '10px', border: '1.5px solid var(--line)', fontWeight: '800', background: '#F8FCFF', color: 'var(--navy)' }}
                          >
                            {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <button className="cal-nav" onClick={() => calShift(1)} style={{ padding: '4px 10px', fontSize: '18px', fontWeight: 'bold', background: 'var(--blue-100)', color: 'var(--blue)', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>›</button>
                      </div>
                      
                      <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', justifyItems: 'center' }}>
                        {dows.map(d => (
                          <div key={d} className="cal-dow" style={{ fontSize: '9px', fontWeight: '950', textTransform: 'uppercase', color: 'var(--muted)', paddingBottom: '6px' }}>{d}</div>
                        ))}
                        {cells}
                      </div>
                    </div>

                    <div className="cal-duration" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2.5px solid var(--blue)', borderRadius: '18px', background: 'var(--blue-50)', padding: '12px 10px', textAlign: 'center' }}>
                      <span className="cd-num" style={{ fontSize: '32px', fontWeight: '950', color: 'var(--blue-800)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>{durationDays}</span>
                      <span className="cd-unit" style={{ fontSize: '9px', fontWeight: '950', color: 'var(--blue-800)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' }}>Calendar Day(s) Open for Posting</span>
                      <span className="cd-hint" style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '700', marginTop: '2px' }}>Weekends are included.</span>
                    </div>

                    <div className="cal-summary" style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--navy)' }}>
                      <span dangerouslySetInnerHTML={{ __html: getCalSummaryText() }}></span>
                    </div>

                    <div className="decision-row" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                      <button className="secondary" onClick={() => setShowCalendar(false)}>Cancel</button>
                      <button className="good cal-confirm" onClick={handleConfirmSchedule}>Confirm & Open Vacancy</button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: NOSCA UPLOAD */}
      {showNosca && (
        <div className="modal open">
          <div className="modal-box" style={{ width: 'min(920px, 96vw)', maxHeight: '90vh' }}>
            <div className="modal-head">
              <h2>Add Vacancy from NOSCA</h2>
              <button className="secondary" onClick={() => { setShowNosca(false); setDetectedItems([]); setSelectedNoscaItemNos([]); }}>Close</button>
            </div>
            <div style={{ padding: '0 24px 24px', overflowY: 'auto', flex: 1 }}>
              <p className="small" style={{ marginBottom: '16px', lineHeight: 1.4, fontSize: '13px', fontWeight: '700', color: 'var(--muted)' }}>
                Upload a NOSCA (Notice of Organization, Staffing and Compensation Action) to auto-detect authorized item numbers and position titles, then tick the items to add. Added items default to <b>Closed</b>.
              </p>
              
              <div className="nosca-modal" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '18px' }}>
                <div className="nosca-upload" style={{ border: '2px dashed var(--line)', borderRadius: '18px', background: '#F8FCFF', padding: '24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', minHeight: '300px' }}>
                  <svg className="doc-icon" viewBox="0 0 24 24" style={{ width: '66px', height: '66px', color: '#EF4444' }}>
                    <path fill="currentColor" d="M19 2H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 16H8v-2h6v2zm3-4H8v-2h9v2zm0-4H8V8h9v2z" />
                  </svg>
                  <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--navy)', margin: 0, fontSize: '16px' }}>NOSCA Document</h3>
                  <p className="small" style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)', fontWeight: '700' }}>Accepted format: PDF scan of the approved NOSCA.</p>
                  <button className="gold" onClick={handleScanNOSCA} disabled={noscaScanning} style={{ marginTop: '8px' }}>
                    {noscaScanning ? 'Scanning...' : '↑ Upload NOSCA'}
                  </button>
                  <button className="secondary" onClick={handleAddManually} disabled={noscaScanning} style={{ marginTop: '4px', width: '100%', maxWidth: '170px' }}>
                    ✎ Add Manually
                  </button>
                  <input
                    id="nosca-file-input"
                    type="file"
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>

                {showManualFields ? (
                  <div className="nosca-scan manual-form" style={{ minHeight: '300px', border: '2px solid var(--line)', borderRadius: '18px', padding: '24px 20px', background: 'white', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--navy)', margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Add Vacancy Manually</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--navy)', marginBottom: '4px' }}>Position Title</label>
                        <select
                          value={manualPositionId}
                          onChange={e => setManualPositionId(e.target.value)}
                          style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '8px', border: '1.5px solid var(--blue)', background: 'white', color: 'var(--navy)', fontSize: '12px', boxSizing: 'border-box' }}
                        >
                          <option value="">Select Position...</option>
                          {positions.map(p => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--navy)', marginBottom: '4px' }}>Item Number</label>
                        <input
                          type="text"
                          placeholder="e.g. SCA1-00000-2026"
                          value={manualItemNo}
                          onChange={e => setManualItemNo(e.target.value.toUpperCase())}
                          style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1.5px solid var(--line)', background: 'white', color: 'var(--navy)', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--navy)', marginBottom: '4px' }}>School Level</label>
                        <select
                          value={manualSchoolLevel || ''}
                          onChange={(e) => {
                            setManualSchoolLevel(e.target.value);
                            setManualSchoolId(null);
                            setManualSchoolName('');
                            setManualSchoolSearchQuery('');
                          }}
                          style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '8px', border: '1.5px solid var(--line)', background: 'white', color: 'var(--navy)', fontSize: '12px', boxSizing: 'border-box' }}
                        >
                          <option value="">Select School Level</option>
                          <option value="ES">ES</option>
                          <option value="JHS">JHS</option>
                          <option value="SHS">SHS</option>
                        </select>
                      </div>

                      {manualSchoolLevel === 'JHS' && (
                        <div style={{ position: 'relative' }}>
                          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--navy)', marginBottom: '4px' }}>School ID & Name</label>
                          <input
                            type="text"
                            value={manualSchoolSearchQuery || ''}
                            onChange={(e) => {
                              setManualSchoolSearchQuery(e.target.value);
                              setShowManualDropdown(true);
                            }}
                            onFocus={() => setShowManualDropdown(true)}
                            placeholder="Type School ID or Name..."
                            style={{
                              width: '100%',
                              padding: '0 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--line)',
                              fontSize: '12px',
                              height: '38px',
                              boxSizing: 'border-box'
                            }}
                          />
                          {showManualDropdown && manualSearchResults.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: 'white',
                              border: '1px solid var(--line)',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                              zIndex: 9999,
                              maxHeight: '150px',
                              overflowY: 'auto',
                              marginTop: '4px'
                            }}>
                              {manualSearchResults.map((sch) => (
                                <div
                                  key={sch.schoolId}
                                  onClick={() => {
                                    setManualSchoolId(sch.schoolId);
                                    setManualSchoolName(sch.schoolName);
                                    setManualSchoolSearchQuery(`${sch.schoolId} - ${sch.schoolName}`);
                                    setShowManualDropdown(false);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '11.5px',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    borderBottom: '1px solid #F1F5F9'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <span style={{ pointerEvents: 'none' }}>
                                    <b>{sch.schoolId}</b> - {sch.schoolName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                      <button 
                        type="button" 
                        className="secondary" 
                        onClick={() => {
                          setShowManualFields(false);
                          setShowNosca(false);
                          setManualPositionId('');
                          setManualItemNo('SCA1-00000-2026');
                          setManualSchoolLevel('');
                          setManualSchoolId(null);
                          setManualSchoolName('');
                          setManualSchoolSearchQuery('');
                        }} 
                        style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px' }}
                      >
                        Cancel
                      </button>
                      <button type="button" className="good" onClick={handleConfirmAddManual} style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px' }}>Add Vacancy</button>
                    </div>
                  </div>
                ) : (
                  <div className="nosca-scan" style={{ minHeight: '300px', border: '2px solid var(--line)', borderRadius: '18px', padding: '16px', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {noscaScanning ? (
                    <div className="nosca-empty" style={{ height: '100%', minHeight: '230px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontWeight: '700', fontSize: '13px', gap: '4px' }}>
                      <p>Scanning document metadata...</p>
                    </div>
                  ) : detectedItems.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                      <div>
                        <div className="scan-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--navy)', margin: 0, fontSize: '15px' }}>Detected Items</h3>
                            <span className="scan-badge" style={{ fontSize: '11px', fontWeight: '900', color: 'var(--blue-600)' }}>
                              {selectedNoscaItemNos.length} of {detectedItems.length} selected
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="secondary" style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto', borderRadius: '8px' }} onClick={() => setSelectedNoscaItemNos(detectedItems.map(it => it.itemNo))}>Select All</button>
                            <button className="secondary" style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto', borderRadius: '8px' }} onClick={() => setSelectedNoscaItemNos([])}>Deselect All</button>
                          </div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '12px', maxHeight: '220px', overflowY: 'auto' }}>
                          {detectedItems.map((it, idx) => {
                            const isChecked = selectedNoscaItemNos.includes(it.itemNo);
                            const isInvalid = !isValidItemNo(it.itemNo);
                            return (
                              <div key={idx} className="scan-item" style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: '10px', alignItems: 'start', padding: '10px 12px', borderBottom: idx < detectedItems.length - 1 ? '1px solid #E2E8F0' : 'none', background: isInvalid ? '#FFFDFD' : 'white' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedNoscaItemNos(prev => 
                                      isChecked ? prev.filter(x => x !== it.itemNo) : [...prev, it.itemNo]
                                    );
                                  }}
                                  style={{ width: '18px', height: '18px', marginTop: '6px', cursor: 'pointer' }}
                                  id={`nosca-checkbox-${idx}`}
                                />
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span className="si-title" style={{ fontSize: '12px', color: 'var(--navy)', fontWeight: '900' }}>{it.title}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>(Edit below)</span>
                                      {isInvalid && (
                                        <span style={{
                                          fontSize: '10px',
                                          background: '#FEF2F2',
                                          color: '#EF4444',
                                          border: '1px solid #FCA5A5',
                                          padding: '1px 6px',
                                          borderRadius: '6px',
                                          fontWeight: 'bold',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px'
                                        }}>
                                          ⚠️ Scan Check Needed
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDetectedItems(prev => prev.filter((_, i) => i !== idx));
                                        setSelectedNoscaItemNos(prev => prev.filter(x => x !== it.itemNo));
                                      }}
                                      style={{
                                        padding: '2px 8px',
                                        fontSize: '11px',
                                        minHeight: 'auto',
                                        borderRadius: '6px',
                                        background: '#FEF2F2',
                                        color: '#EF4444',
                                        border: '1px solid #FCA5A5',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <NOSCAItemEditor
                                    itemIndex={idx}
                                    value={it.itemNo}
                                    onChange={(newVal) => {
                                      const oldVal = it.itemNo;
                                      setDetectedItems(prev => prev.map((item, i) => i === idx ? { ...item, itemNo: newVal } : item));
                                      setSelectedNoscaItemNos(prev => {
                                        if (prev.includes(oldVal)) {
                                          return prev.map(x => x === oldVal ? newVal : x);
                                        }
                                        return prev;
                                      });
                                    }}
                                    schoolLevel={it.schoolLevel || ''}
                                    onSchoolLevelChange={(level) => {
                                      setDetectedItems(prev => prev.map((item, i) => i === idx ? { ...item, schoolLevel: level, schoolId: null, schoolName: '', schoolSearchQuery: '' } : item));
                                    }}
                                    schoolSearchQuery={it.schoolSearchQuery || ''}
                                    onSchoolSearchQueryChange={(query) => {
                                      setDetectedItems(prev => prev.map((item, i) => i === idx ? { ...item, schoolSearchQuery: query } : item));
                                    }}
                                    onSchoolSelect={(school) => {
                                      setDetectedItems(prev => prev.map((item, i) => i === idx ? {
                                        ...item,
                                        schoolId: school.schoolId,
                                        schoolName: school.schoolName,
                                        schoolSearchQuery: `${school.schoolId} - ${school.schoolName}`
                                      } : item));
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="nosca-actions" style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          className="secondary"
                          style={{ marginRight: 'auto' }}
                          onClick={() => {
                            const positionName = "School Counselor Associate I";
                            const positionId = positions.find(p => p.title.toLowerCase() === positionName.toLowerCase())?.id || '';
                            const newItem = {
                              itemNo: `SCA1-0000${detectedItems.length + 1}-2026`,
                              title: positionName,
                              positionId: positionId,
                              schoolLevel: '',
                              schoolId: null,
                              schoolName: '',
                              schoolSearchQuery: ''
                            };
                            setDetectedItems(prev => [...prev, newItem]);
                            setSelectedNoscaItemNos(prev => [...prev, newItem.itemNo]);
                          }}
                        >
                          + Add Item
                        </button>
                        <button className="secondary" onClick={() => { setDetectedItems([]); setSelectedNoscaItemNos([]); }}>Clear</button>
                        <button 
                          type="button"
                          className="secondary" 
                          onClick={() => {
                            setShowNosca(false);
                            setDetectedItems([]);
                            setSelectedNoscaItemNos([]);
                            setShowManualFields(false);
                          }}
                        >
                          Cancel
                        </button>
                        <button className="good" onClick={() => {
                          if (!selectedNoscaItemNos.length) return setToast({ message: 'Please tick at least one item to add', type: 'error' });
                          
                          const toAdd = detectedItems.filter(it => selectedNoscaItemNos.includes(it.itemNo));
                          for (const it of toAdd) {
                            if (!it.schoolLevel) {
                              return setToast({ message: `Please select a School Level for item ${it.itemNo}.`, type: 'error' });
                            }
                            if (it.schoolLevel === 'JHS' && !it.schoolId) {
                              return setToast({ message: `Please select a valid JHS school ID for item ${it.itemNo}.`, type: 'error' });
                            }
                          }
                          
                          setShowNoscaConfirm(true);
                        }}>Add Selected Items</button>
                      </div>
                    </div>
                  ) : (
                    <div className="nosca-empty" style={{ height: '100%', minHeight: '230px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontWeight: '700', fontSize: '13px', gap: '4px' }}>
                      <span>No document scanned yet.</span>
                      <span>Upload a NOSCA to extract item numbers and position titles.</span>
                      <div style={{ marginTop: '16px' }}>
                        <button 
                          type="button" 
                          className="secondary" 
                          onClick={() => {
                            setShowNosca(false);
                            setShowManualFields(false);
                            setDetectedItems([]);
                            setSelectedNoscaItemNos([]);
                          }} 
                          style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM NOSCA ITEMS REFLECTED */}
      {showNoscaConfirm && (
        <div className="modal open" style={{ zIndex: 100001 }}>
          <div className="modal-box" style={{ width: 'min(500px, 92vw)' }}>
            <div className="modal-head">
              <h2>Confirm NOSCA Items</h2>
              <button className="secondary" onClick={() => setShowNoscaConfirm(false)}>Cancel</button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p className="small" style={{ fontSize: '14px', fontWeight: '800', color: 'var(--navy)', lineHeight: '1.5', margin: '0 0 20px' }}>
                Do you confirm that all the items in the NOSCA reflected correctly?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="secondary" onClick={() => setShowNoscaConfirm(false)}>Cancel</button>
                <button className="good" onClick={() => {
                  setShowNoscaConfirm(false);
                  handleAddNoscaVacancies();
                }}>Yes, Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE OVERRIDE WARNING */}
      {showCloseWarning && closeWarningVac && (
        <div className="modal open">
          <div className="modal-box" style={{
            width: 'min(1180px, 96vw)',
            maxHeight: '90vh',
            borderLeft: '6px solid var(--blue)',
            borderRadius: '18px',
            padding: '24px 28px'
          }}>
            <div className="modal-head" style={{ borderBottom: 'none', paddingBottom: '4px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '950', color: 'var(--navy)', margin: 0 }}>Closing Not Allowed Yet</h2>
              <button className="secondary" onClick={() => setShowCloseWarning(false)} style={{ fontSize: '13px', padding: '6px 16px', borderRadius: '10px' }}>Close</button>
            </div>

            <div style={{
              border: '1.5px solid #FCA5A5',
              borderRadius: '14px',
              padding: '20px 20px 22px',
              background: '#FEF2F2'
            }}>
              <p style={{
                margin: '0 0 6px',
                fontWeight: '900',
                color: '#991B1B',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '16px' }}>⚠</span> This posting still has {(() => {
                  const end = closeWarningVac.postingEnd ? new Date(closeWarningVac.postingEnd.slice(0, 10) + "T00:00:00") : null;
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  return end ? Math.round((end - today) / 86400000) : 0;
                })()} day(s) remaining.
              </p>
              <p style={{
                margin: '0 0 18px',
                color: '#64748B',
                fontSize: '13px',
                lineHeight: 1.5
              }}>
                Closing is not allowed within 10 days of an active posting. If this is due to accidental opening of the item, type your passcode below to override and allow closing.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label style={{
                  color: '#991B1B',
                  fontWeight: '900',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 6px'
                }}>Reason for closing abruptly</label>
                <select
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  style={{
                    background: 'white',
                    border: '1.5px solid #D7EEF8',
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: closeReason ? 'var(--text)' : '#94A3B8'
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="Accidental opening of the item">Accidental opening of the item</option>
                  <option value="Item withdrawn or deauthorized">Item withdrawn or deauthorized</option>
                  <option value="Duplicate or erroneous posting">Duplicate or erroneous posting</option>
                  <option value="Position reallocated to another office">Position reallocated to another office</option>
                  <option value="Item abolished or reclassified">Item abolished or reclassified</option>
                  <option value="Plantilla funding withdrawn or unfunded">Plantilla funding withdrawn or unfunded</option>
                  <option value="Filled through another HR action">Filled through another HR action</option>
                  <option value="Incorrect posting details (needs reposting)">Incorrect posting details (needs reposting)</option>
                  <option value="Hold order or administrative directive">Hold order or administrative directive</option>
                  <option value="Legal or compliance issue">Legal or compliance issue</option>
                  <option value="Requested by requesting office or school head">Requested by requesting office or school head</option>
                  <option value="__other__">Other (specify)</option>
                </select>

                {closeReason === '__other__' && (
                  <textarea
                    value={closeReasonOther}
                    onChange={e => setCloseReasonOther(e.target.value)}
                    placeholder="Specify the reason (max 150 characters)."
                    maxLength="150"
                    style={{ marginTop: '8px', border: '1.5px solid #D7EEF8', borderRadius: '10px', minHeight: '60px' }}
                  />
                )}
              </div>

              <div>
                <label style={{
                  color: '#991B1B',
                  fontWeight: '900',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 6px'
                }}>Override passcode</label>
                <input
                  type="password"
                  placeholder="Enter passcode"
                  value={closePasscode}
                  onChange={e => setClosePasscode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleConfirmOverrideClose();
                    }
                  }}
                  style={{
                    background: 'white',
                    border: '1.5px solid #D7EEF8',
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '13px'
                  }}
                />
                {passcodeError && (
                  <div style={{ color: 'var(--red)', fontSize: '12px', fontWeight: '900', marginTop: '6px' }}>
                    {passcodeError}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button className="secondary" onClick={() => setShowCloseWarning(false)} style={{ padding: '10px 20px', borderRadius: '12px' }}>Cancel</button>
              <button className="danger" onClick={handleConfirmOverrideClose} style={{ padding: '10px 20px', borderRadius: '12px' }}>Override & Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE VACANCY CONFIRMATION */}
      {showDeleteConfirmModal && deleteConfirmVac && (
        <div className="modal open" style={{ zIndex: 100003, left: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(16px)' }}>
          <div className="modal-box" style={{ width: 'min(480px, 94vw)', padding: '24px 32px', borderRadius: '24px', background: 'white', borderTop: '6px solid #EF4444', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '32px' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, fontFamily: 'var(--font-heading)', color: '#EF4444' }}>Delete Vacancy Posting</h3>
            </div>
            
            <p style={{ margin: '0 0 20px', lineHeight: '1.6', fontSize: '14px', color: 'var(--text)' }}>
              Are you sure you want to delete the vacancy posting for Item No. <b>{deleteConfirmVac.itemNo}</b>? This action will permanently remove the item from the database. This cannot be undone.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{
                  color: '#991B1B',
                  fontWeight: '900',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 6px',
                  display: 'block'
                }}>Enter Passcode to Confirm</label>
                <input
                  type="password"
                  placeholder="Enter 6-digit passcode"
                  value={deletePasscode}
                  onChange={e => setDeletePasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleConfirmDeleteVacancy();
                    }
                  }}
                  style={{
                    background: 'white',
                    border: '1.5px solid #D7EEF8',
                    height: '42px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0 12px'
                  }}
                />
                {deletePasscodeError && (
                  <div style={{ color: 'var(--red)', fontSize: '12px', fontWeight: '900', marginTop: '6px' }}>
                    {deletePasscodeError}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="secondary" onClick={() => { setShowDeleteConfirmModal(false); setDeleteConfirmVac(null); }} style={{ padding: '10px 20px', borderRadius: '12px', cursor: 'pointer' }}>Cancel</button>
              <button className="danger" onClick={handleConfirmDeleteVacancy} style={{ padding: '10px 20px', borderRadius: '12px', cursor: 'pointer' }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
