import React, { useState, useMemo } from 'react';
import { useAppData } from '../../../middleware/DataProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { apiFetch } from '../../../config/api.js';

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
  const chars = value.split('');
  
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

  const handleCharChange = (charIdx, newVal) => {
    const char = newVal.slice(-1).toUpperCase();
    const newChars = [...chars];
    newChars[charIdx] = char || ' ';
    const newValue = newChars.join('');
    onChange(newValue);

    if (char && charIdx < chars.length - 1) {
      let nextIdx = charIdx + 1;
      while (nextIdx < chars.length && chars[nextIdx] === '-') {
        nextIdx++;
      }
      if (nextIdx < chars.length) {
        document.getElementById(`char-input-${itemIndex}-${nextIdx}`)?.focus();
      }
    }
  };

  const handleKeyDown = (charIdx, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newChars = [...chars];
      newChars[charIdx] = ' ';
      onChange(newChars.join(''));

      let prevIdx = charIdx - 1;
      while (prevIdx >= 0 && chars[prevIdx] === '-') {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        document.getElementById(`char-input-${itemIndex}-${prevIdx}`)?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      let prevIdx = charIdx - 1;
      while (prevIdx >= 0 && chars[prevIdx] === '-') {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        document.getElementById(`char-input-${itemIndex}-${prevIdx}`)?.focus();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      let nextIdx = charIdx + 1;
      while (nextIdx < chars.length && chars[nextIdx] === '-') {
        nextIdx++;
      }
      if (nextIdx < chars.length) {
        document.getElementById(`char-input-${itemIndex}-${nextIdx}`)?.focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').toUpperCase().replace(/\s+/g, '');
    if (pastedText) {
      onChange(pastedText);
    }
  };

  const handleAddChar = () => {
    onChange(value + ' ');
  };

  const handleRemoveChar = () => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleChangePrefixToSca = () => {
    if (value.includes('-')) {
      const parts = value.split('-');
      parts[0] = 'SCAI';
      onChange(parts.join('-'));
    } else {
      onChange('SCAI-' + value);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center', marginTop: '6px' }}>
       {chars.map((char, charIdx) => {
        const isSeparator = char === '-';
        const isCharInvalid = isCharInvalidAtIndex(char, charIdx, value);
        return (
          <input
            key={charIdx}
            id={`char-input-${itemIndex}-${charIdx}`}
            type="text"
            value={char === ' ' ? '' : char}
            onChange={(e) => handleCharChange(charIdx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(charIdx, e)}
            onPaste={handlePaste}
            maxLength={1}
            style={{
              width: '20px',
              height: '26px',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: '900',
              fontFamily: 'monospace',
              border: isSeparator ? 'none' : (isCharInvalid ? '1px solid #EF4444' : '1px solid var(--line)'),
              borderRadius: '4px',
              background: isSeparator ? 'transparent' : (isCharInvalid ? '#FEF2F2' : '#F8FAFC'),
              color: isSeparator ? 'var(--muted)' : (isCharInvalid ? '#EF4444' : 'var(--navy)'),
              outline: 'none',
              padding: 0,
              boxShadow: isSeparator ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.05)'
            }}
            disabled={isSeparator}
          />
        );
      })}
      
      <div style={{ display: 'flex', gap: '2px', marginLeft: '4px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleAddChar}
          title="Add character box"
          style={{
            padding: '2px 6px',
            fontSize: '11px',
            minHeight: '22px',
            borderRadius: '4px',
            border: '1px solid var(--line)',
            background: '#F1F5F9',
            color: '#475569',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          +
        </button>
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleRemoveChar}
            title="Remove last box"
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              minHeight: '22px',
              borderRadius: '4px',
              border: '1px solid var(--line)',
              background: '#F1F5F9',
              color: '#475569',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            -
          </button>
        )}
        <button
          type="button"
          onClick={handleChangePrefixToSca}
          title="Convert prefix to SCAI"
          style={{
            padding: '0 8px',
            fontSize: '11px',
            height: '26px',
            borderRadius: '4px',
            border: '1px solid var(--blue)',
            background: 'var(--blue-50)',
            color: 'var(--blue-600)',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginLeft: '4px',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          Use SCAI Prefix
        </button>

        <select
          value={schoolLevel || ''}
          onChange={(e) => onSchoolLevelChange(e.target.value)}
          style={{
            padding: '0 8px',
            fontSize: '11px',
            height: '26px',
            borderRadius: '4px',
            border: '1.5px solid var(--blue)',
            background: 'var(--blue-50)',
            color: 'var(--blue-600)',
            fontWeight: 'bold',
            marginLeft: '8px',
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
                        borderBottom: '1px solid #F1F5F9'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#F8FAFC'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <b>{sch.schoolId}</b> - {sch.schoolName}
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
  const [calVacancy, setCalVacancy] = useState(null);
  const [calStart, setCalStart] = useState('');
  const [calEnd, setCalEnd] = useState('');
  const [calField, setCalField] = useState('start');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // NOSCA Scanning states
  const [showNosca, setShowNosca] = useState(false);
  const [showNoscaConfirm, setShowNoscaConfirm] = useState(false);
  const [noscaScanning, setNoscaScanning] = useState(false);
  const [detectedItems, setDetectedItems] = useState([]);
  const [selectedNoscaItemNos, setSelectedNoscaItemNos] = useState([]);


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

  // Close Warning Override states
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [closeWarningVac, setCloseWarningVac] = useState(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeReasonOther, setCloseReasonOther] = useState('');
  const [closePasscode, setClosePasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  const vacanciesKpiStats = useMemo(() => {
    const total = vacancies.length;
    const open = vacancies.filter(v => v.status === 'open').length;
    const closed = total - open;
    return { total, open, closed };
  }, [vacancies]);

  const getVacancyCellValue = (v, key) => {
    if (key === 'itemNo') return v.itemNo || '';
    if (key === 'position') return positions.find(p => p.id === v.positionId)?.title || 'Unmapped position';
    if (key === 'schoolOffice') return v.school || v.division || '';
    if (key === 'applications') return applications.filter(a => a.vacancyId === v.id).length;
    if (key === 'deadline') return v.postingEnd || '';
    if (key === 'daysRemaining') {
      if (!v.postingStart || !v.postingEnd) return -999999;
      const start = new Date(v.postingStart.slice(0, 10) + "T00:00:00");
      const end = new Date(v.postingEnd.slice(0, 10) + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (v.status === 'closed' || today < start || today > end) return -999999;
      return Math.round((end - today) / 86400000);
    }
    if (key === 'postingStatus') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = v.postingStart ? new Date(v.postingStart.slice(0, 10) + "T00:00:00") : null;
      const end = v.postingEnd ? new Date(v.postingEnd.slice(0, 10) + "T00:00:00") : null;
      const isClosed = v.status === 'closed' || (start && today < start) || (end && today > end);
      return isClosed ? 'Closed' : 'Open for Application';
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
      list = list.filter(v => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = v.postingStart ? new Date(v.postingStart.slice(0, 10) + "T00:00:00") : null;
        const end = v.postingEnd ? new Date(v.postingEnd.slice(0, 10) + "T00:00:00") : null;
        const isClosed = v.status === 'closed' || (start && today < start) || (end && today > end);
        const displayStatus = isClosed ? 'closed' : 'open';
        return displayStatus === vacStatusFilter;
      });
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = vac.postingStart ? new Date(vac.postingStart.slice(0, 10) + "T00:00:00") : null;
    const end = vac.postingEnd ? new Date(vac.postingEnd.slice(0, 10) + "T00:00:00") : null;
    const isClosed = vac.status === 'closed' || (start && today < start) || (end && today > end);

    if (isClosed) {
      setCalVacancy(vac);
      const initStart = vac.postingStart ? vac.postingStart.slice(0, 10) : new Date().toISOString().slice(0, 10);
      setCalStart(initStart);
      setCalEnd(vac.postingEnd ? vac.postingEnd.slice(0, 10) : '');
      setCalField('start');
      const initDate = new Date(initStart + "T00:00:00");
      setCalYear(initDate.getFullYear());
      setCalMonth(initDate.getMonth());
      setShowCalendar(true);
    } else {
      setCloseWarningVac(vac);
      setShowCloseWarning(true);
      setCloseReason('');
      setCloseReasonOther('');
      setClosePasscode('');
      setPasscodeError('');
    }
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
    const diffDays = Math.round((endD - startD) / 86400000);
    if (diffDays > 10) {
      return setToast({ message: "Deadline cannot be more than 10 days after the start date.", type: 'error' });
    }
    try {
      await apiFetch(`/api/vacancies/${calVacancy.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'open', postingStart: calStart, postingEnd: calEnd })
      });
      setShowCalendar(false);
      setToast({ message: 'Vacancy posting opened successfully!', type: 'success' });
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

  const handleAddManually = () => {
    const positionName = "School Counselor Associate I";
    const positionId = positions.find(p => p.title.toLowerCase() === positionName.toLowerCase())?.id || '';
    const defaultItem = {
      itemNo: 'SCA1-00000-2026',
      title: positionName,
      positionId: positionId,
      schoolLevel: 'ES',
      schoolId: null,
      schoolName: '',
      schoolSearchQuery: ''
    };
    setDetectedItems([defaultItem]);
    setSelectedNoscaItemNos([defaultItem.itemNo]);
  };

  const selectCalDate = (iso) => {
    if (calField === 'start') {
      setCalStart(iso);
      if (calEnd) {
        const startD = new Date(iso + "T00:00:00");
        const endD = new Date(calEnd + "T00:00:00");
        const diffDays = Math.round((endD - startD) / 86400000);
        if (diffDays > 10) {
          setCalEnd('');
        } else if (iso > calEnd) {
          setCalEnd('');
        }
      }
    } else {
      if (calStart && iso < calStart) {
        setToast({ message: "Deadline cannot be earlier than the start date.", type: 'error' });
        return;
      }
      if (calStart) {
        const startD = new Date(calStart + "T00:00:00");
        const endD = new Date(iso + "T00:00:00");
        const diffDays = Math.round((endD - startD) / 86400000);
        if (diffDays > 10) {
          setToast({ message: "Deadline cannot be more than 10 days after the start date.", type: 'error' });
          return;
        }
      }
      setCalEnd(iso);
    }
  };

  const countCalendarDays = (startIso, endIso) => {
    if (!startIso || !endIso) return 0;
    const start = new Date(startIso + "T00:00:00");
    const end = new Date(endIso + "T00:00:00");
    return Math.max(0, Math.round((end - start) / 86400000) + 1);
  };

  const getCalSummaryText = () => {
    if (!calStart && !calEnd) return 'No dates selected yet.';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fmt = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : 'Not set';
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
          <div className="kpi-label">Open for Application</div>
          <div className="kpi-number">{vacanciesKpiStats.open}</div>
          <div className="kpi-caption">Accepting applicants</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Closed</div>
          <div className="kpi-number">{vacanciesKpiStats.closed}</div>
          <div className="kpi-caption">No longer posted</div>
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
                <option value="open">Open for Application</option>
                <option value="closed">Closed</option>
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
          <table style={{ minWidth: '1000px' }}>
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
                <th className="num-col">
                  <button className="th-btn" onClick={() => handleVSortClick('applications')}>Applications {vSortKey === 'applications' ? (vSortDir === 'asc' ? '▲' : '▼') : ''}</button>
                  <div className="column-filter-range" style={{ display: 'flex', gap: '4px' }}>
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Min"
                      value={vColumnFilters.applications?.min || ''}
                      onChange={e => {
                        const current = vColumnFilters.applications || {};
                        setVColumnFilters({ ...vColumnFilters, applications: { ...current, min: e.target.value } });
                        setVacPage(1);
                      }}
                    />
                    <input
                      className="column-filter"
                      type="number"
                      placeholder="Max"
                      value={vColumnFilters.applications?.max || ''}
                      onChange={e => {
                        const current = vColumnFilters.applications || {};
                        setVColumnFilters({ ...vColumnFilters, applications: { ...current, max: e.target.value } });
                        setVacPage(1);
                      }}
                    />
                  </div>
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
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVacancies.map((vac, idx) => {
                const appCount = applications.filter(a => a.vacancyId === vac.id).length;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const start = vac.postingStart ? new Date(vac.postingStart.slice(0, 10) + "T00:00:00") : null;
                const end = vac.postingEnd ? new Date(vac.postingEnd.slice(0, 10) + "T00:00:00") : null;
                const isClosed = vac.status === 'closed' || (start && today < start) || (end && today > end);
                const deadlinePast = end ? end < today : false;
                
                let drText = 'N/A';
                let drColor = 'var(--muted)';
                if (!isClosed && end) {
                  const rem = Math.round((end - today) / 86400000);
                  drText = String(rem);
                  drColor = rem < 0 ? 'var(--red)' : rem <= 3 ? 'var(--amber)' : 'var(--green)';
                }

                const appCountColor = appCount === 0 ? 'var(--red)' : 'var(--navy)';
                const deadlineColor = deadlinePast ? 'var(--red)' : 'var(--text)';

                return (
                  <tr key={vac.id}>
                    <td className="row-num">{(vacPage - 1) * vacPageSize + idx + 1}</td>
                    <td><b>{vac.itemNo}</b></td>
                    <td>{positions.find(p => p.id === vac.positionId)?.title || vac.title}</td>
                    <td>{vac.school || 'Division Pool'}</td>
                    <td className="num-col"><span className="qs-number" style={{ color: appCountColor }}>{appCount}</span></td>
                    <td><span className="qs-number" style={{ color: deadlineColor }}>{vac.postingEnd ? vac.postingEnd.slice(0, 10) : '—'}</span></td>
                    <td className="num-col"><span className="qs-number" style={{ color: drColor }}>{drText}</span></td>
                    <td><span className={`badge ${isClosed ? 'gray' : 'green'}`}>{isClosed ? 'Closed' : 'Open for Application'}</span></td>
                    <td>
                      <span className={`badge ${vac.fillingUpStatus === 'FILLED' ? 'filled-status' : 'unfilled-status'}`}>
                        {vac.fillingUpStatus || 'UNFILLED'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={`vac-action ${vac.fillingUpStatus === 'FILLED' ? 'incomplete' : (isClosed ? 'good' : 'danger')}`} 
                        onClick={() => handleToggleVacancy(vac)}
                        disabled={vac.fillingUpStatus === 'FILLED'}
                        style={vac.fillingUpStatus === 'FILLED' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        {isClosed ? 'Open' : 'Close'}
                      </button>
                    </td>
                  </tr>
                );
              })}
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
          return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
            <div className="modal-box" style={{ width: 'min(980px, 98vw)', maxHeight: '92vh', padding: '0 24px 24px' }}>
              <div className="modal-head" style={{
                paddingTop: '24px',
                paddingBottom: '12px',
                background: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                margin: '0 -24px 16px',
                paddingLeft: '24px',
                paddingRight: '24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0 }}>Set Posting Schedule</h2>
                <button className="secondary" onClick={() => setShowCalendar(false)}>Close</button>
              </div>
              <div className="posting-schedule-layout">
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

                  <div className="decision-row" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                    <button className="secondary" onClick={() => setShowCalendar(false)}>Cancel</button>
                    <button className="good cal-confirm" onClick={handleConfirmSchedule}>Open Posting</button>
                  </div>
                </section>
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
            <div>
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
                                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>(Edit per character below)</span>
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
                                    schoolLevel={it.schoolLevel || 'ES'}
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
                              schoolLevel: 'ES',
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
                    </div>
                  )}
                </div>
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
            <p className="small" style={{ fontSize: '14px', fontWeight: '800', color: 'var(--navy)', lineHeight: '1.5', margin: '10px 0 20px' }}>
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
    </section>
  );
}
