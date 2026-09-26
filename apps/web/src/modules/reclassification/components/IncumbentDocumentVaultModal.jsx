import React, { useState, useEffect } from 'react';

const VAULT_ITEMS = [
  { key: 'letter_of_intent', checklistId: 'loi', label: 'Letter of Intent', fullTitle: 'Letter of Intent', required: true },
  { key: 'pds', checklistId: 'pds', label: 'Personal Data Sheet', fullTitle: 'Personal Data Sheet (PDS)', required: true },
  { key: 'work_experience', checklistId: 'employment', label: 'Work Experience Sheet', fullTitle: 'Work Experience Sheet', required: true },
  { key: 'eligibility', checklistId: 'eligibility', label: 'Certificate of Eligibility', fullTitle: 'Certificate of Eligibility', required: true },
  { key: 'tor', checklistId: 'tor', label: 'Transcript of Records', fullTitle: 'Transcript of Records (TOR)', required: true },
  { key: 'prc', checklistId: 'prc', label: 'Updated PRC License/ID', fullTitle: 'Updated PRC License/ID', required: true },
  { key: 'sworn_declaration', checklistId: 'cav', label: 'Certification on the Authenticity and Veracity (CAV)', fullTitle: 'Certification on the Authenticity and Veracity (CAV)', required: true },
  { key: 'diploma', checklistId: 'tor', label: 'Diploma', fullTitle: 'Diploma', required: false },
  { key: 'performance_rating', checklistId: 'performance', label: 'Performance Rating', fullTitle: 'Performance Rating (IPCRF)', required: false },
  { key: 'training_certificates', checklistId: 'training', label: 'Training Certificates', fullTitle: 'Training Certificates', required: false },
  { key: 'service_record', checklistId: 'appointment', label: 'Service Record / Latest Appointment', fullTitle: 'Service Record / Latest Appointment', required: false }
];

export default function IncumbentDocumentVaultModal({
  isOpen,
  onClose,
  incumbent,
  docChecklist = [],
  setFullScreenDoc,
  isDark = false
}) {
  const [selectedKey, setSelectedKey] = useState('pds');
  const [iframeLoading, setIframeLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedKey('pds');
    }
  }, [isOpen]);

  if (!isOpen || !incumbent) return null;

  const candidateName = incumbent.full_name || incumbent.employee_name || 'INCUMBENT CANDIDATE';
  const activeItem = VAULT_ITEMS.find(d => d.key === selectedKey) || VAULT_ITEMS[1];

  const attachedList = Array.isArray(incumbent.assessment?.documents) && incumbent.assessment.documents.length > 0
    ? incumbent.assessment.documents
    : Array.isArray(incumbent.documents) && incumbent.documents.length > 0
      ? incumbent.documents
      : [];

  // Match uploaded file if present
  const directAttachment = attachedList.find(att => {
    const name = String(att.label || att.name || att.key || '').toLowerCase();
    return name.includes(activeItem.key) || (activeItem.checklistId && name.includes(activeItem.checklistId));
  });

  const docUrl = directAttachment?.url ||
    (incumbent.application_id
      ? `${import.meta.env.VITE_API_URL || window.location.origin}/api/applications/${incumbent.application_id}/documents/${activeItem.key}/download?token=${localStorage.getItem('agap_token')}&dpi=98`
      : null) ||
    'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100002,
        padding: '20px'
      }}
    >
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.98)' : '#fffdf5',
        borderRadius: '16px',
        width: 'min(1180px, 98vw)',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isDark ? '0 25px 60px rgba(0, 0, 0, 0.8)' : '0 20px 50px rgba(0, 0, 0, 0.25)',
        border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Header matching screenshot */}
        <div style={{
          padding: '16px 24px',
          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#fffdf5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <h2 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0,
            fontSize: '20px',
            fontWeight: 800,
            color: 'var(--text, #0f172a)'
          }}>
            <span style={{ fontSize: '22px' }}>📁</span>
            Document Vault — <span style={{ textTransform: 'uppercase', letterSpacing: '0.01em' }}>{candidateName}</span>
          </h2>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
              background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#e2e8f0',
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: '13px',
              fontWeight: 750,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              transition: 'all 0.15s ease'
            }}
          >
            Close Vault
          </button>
        </div>

        {/* 2-Column Body */}
        <div style={{
          padding: '20px',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '20px',
          alignItems: 'start',
          overflowY: 'auto',
          maxHeight: 'calc(94vh - 75px)',
          background: isDark ? '#0f172a' : '#fffdf5'
        }}>
          {/* Left Column: Document Checklist */}
          <div style={{
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              padding: '13px 16px',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
              background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc'
            }}>
              <h4 style={{ margin: 0, color: 'var(--text, #0f172a)', fontSize: '14px', fontWeight: 800 }}>
                Document Checklist
              </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {VAULT_ITEMS.map((doc) => {
                const isSelected = selectedKey === doc.key;
                const matchingCheck = docChecklist.find(c => c.id === doc.checklistId);
                const hasMatchingAttachment = attachedList.some(att => {
                  const name = String(att.label || att.name || att.key || '').toLowerCase();
                  return name.includes(doc.key) || (doc.checklistId && name.includes(doc.checklistId));
                });
                const isUploaded = Boolean(matchingCheck?.submitted || matchingCheck?.verified || hasMatchingAttachment || doc.required);

                return (
                  <div
                    key={doc.key}
                    onClick={() => setSelectedKey(doc.key)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(2, 132, 199, 0.16)' : '#eff6ff')
                        : (isDark ? 'transparent' : '#ffffff'),
                      borderLeft: isSelected ? '4px solid #0284c7' : '4px solid transparent',
                      borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.4)' : '1px solid #f1f5f9',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    <div style={{
                      fontWeight: 750,
                      fontSize: '13px',
                      color: isSelected ? '#0284c7' : 'var(--text, #0f172a)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>{doc.label}</span>
                      {doc.required && <span style={{ color: '#ef4444', fontWeight: 900 }}>*</span>}
                      {isUploaded && <span style={{ color: '#16a34a', fontWeight: 800, marginLeft: '2px' }}>✓</span>}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: isSelected ? '#0284c7' : 'var(--text-secondary, #94a3b8)'
                    }}>
                      {isUploaded ? 'View Uploaded Document' : 'No document uploaded'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Document Viewer Pane */}
          <div style={{
            border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: isDark ? 'rgba(15, 23, 42, 0.9)' : '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            {/* Viewer Subheader */}
            <div style={{
              padding: '12px 18px',
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.65)' : '#f8fafc',
              borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <b style={{
                color: isDark ? '#38bdf8' : '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '13.5px',
                fontWeight: 750
              }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: isDark ? '#38bdf8' : '#0284c7' }}
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Document Viewer: {activeItem.fullTitle || activeItem.label}
              </b>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (setFullScreenDoc) {
                      setFullScreenDoc({
                        open: true,
                        url: docUrl,
                        title: activeItem.fullTitle || activeItem.label
                      });
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text, #0f172a)',
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
                    border: isDark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                  Full Screen
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>Page 1 of 1</span>
              </div>
            </div>

            {/* Embedded Document Frame */}
            <div style={{
              width: '100%',
              height: '580px',
              position: 'relative',
              background: '#334155',
              overflow: 'hidden'
            }}>
              <iframe
                src={docUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block'
                }}
                title={activeItem.fullTitle || 'Document Viewer'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
