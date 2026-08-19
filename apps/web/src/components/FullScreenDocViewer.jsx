import React, { useEffect, useState } from 'react';

const DOC_LABELS = {
  letter_of_intent: 'Letter of Intent',
  pds: 'Personal Data Sheet (PDS)',
  work_experience: 'Work Experience Sheet',
  eligibility: 'Certificate of Eligibility',
  tor: 'Transcript of Records (TOR)',
  prc: 'Updated PRC License/ID',
  sworn_declaration: 'Certification on the Authenticity and Veracity (CAV)',
  diploma: 'Diploma',
  resume: 'Resume',
  coe: 'Certificate of Employment',
  outstanding_accomplishments: 'Outstanding Accomplishments',
  performance_rating: 'Performance Rating',
  training_certificates: 'Training Certificates',
  application_education: 'Application of Education',
  application_learning: 'Application of Learning and Development'
};

export default function FullScreenDocViewer({
  isOpen,
  onClose,
  applicantName,
  applicationId,
  selectedDocKey,
  setSelectedDocKey,
  availableDocs = [],
  DOC_REQUIREMENTS = []
}) {
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    setIframeLoading(true);
  }, [selectedDocKey]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDocInfo = availableDocs.find(d => d.key === selectedDocKey);
  const existsInAzure = !!currentDocInfo?.existsInAzure;
  const filename = currentDocInfo?.filename || '';
  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const token = localStorage.getItem('agap_token');
  const apiHost = import.meta.env.VITE_API_URL || window.location.origin;
  const documentUrl = `${apiHost}/api/applications/${applicationId}/documents/${selectedDocKey}/download?token=${token}&dpi=98`;

  const docList = DOC_REQUIREMENTS.length > 0 
    ? DOC_REQUIREMENTS 
    : Object.keys(DOC_LABELS).map(k => ({ key: k, label: DOC_LABELS[k] }));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0F172A',
        zIndex: 200000,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      {/* Fullscreen Header */}
      <div
        style={{
          height: '60px',
          backgroundColor: '#1E293B',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          color: 'white',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        {/* Left: Applicant Name & Current Document */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {DOC_LABELS[selectedDocKey] || selectedDocKey}
              {existsInAzure && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80', fontWeight: '600' }}>
                  ✓ Uploaded
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>
              {applicantName ? `Applicant: ${applicantName}` : 'Document Viewer'}
            </div>
          </div>
        </div>

        {/* Center: Document Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Switch Document:</span>
          <select
            value={selectedDocKey}
            onChange={(e) => setSelectedDocKey(e.target.value)}
            style={{
              backgroundColor: '#0F172A',
              color: '#F8FAFC',
              border: '1px solid #475569',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {docList.map((doc) => {
              const info = availableDocs.find(d => d.key === doc.key);
              return (
                <option key={doc.key} value={doc.key}>
                  {info?.existsInAzure ? '✓ ' : '  '}{doc.label || DOC_LABELS[doc.key] || doc.key}
                </option>
              );
            })}
          </select>
        </div>

        {/* Right: Download & Exit Full Screen buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {existsInAzure && (
            <a
              href={`${apiHost}/api/applications/${applicationId}/documents/${selectedDocKey}/download?token=${token}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Original
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#F8FAFC',
              backgroundColor: '#EF4444',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Exit Full Screen
            <span style={{ fontSize: '10px', opacity: 0.7, padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)' }}>ESC</span>
          </button>
        </div>
      </div>

      {/* Main Fullscreen Document Frame */}
      <div style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#0F172A' }}>
        {existsInAzure ? (
          isPdf ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {iframeLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#0F172A',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '16px',
                  color: '#94A3B8',
                  zIndex: 10
                }}>
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <div style={{
                    border: '4px solid #334155',
                    borderTop: '4px solid #38BDF8',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <b style={{ fontSize: '15px', color: '#F8FAFC' }}>Loading Document in Full Screen...</b>
                </div>
              )}
              <iframe
                src={documentUrl}
                onLoad={() => setIframeLoading(false)}
                style={{ width: '100%', height: '100%', border: 'none', display: iframeLoading ? 'none' : 'block' }}
                title="Full Screen Document Viewer"
              />
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', padding: '32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#F8FAFC' }}>
              <div style={{ backgroundColor: '#1E293B', borderRadius: '16px', padding: '32px', border: '1px solid #334155', textAlign: 'center', maxWidth: '500px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#F8FAFC' }}>Non-PDF Document Attachment</h3>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94A3B8', lineHeight: '1.5' }}>
                  This file (<b>{filename}</b>) is a spreadsheet or document format. Click below to download and view in full fidelity.
                </p>
                <a
                  href={`${apiHost}/api/applications/${applicationId}/documents/${selectedDocKey}/download?token=${token}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#0F172A',
                    backgroundColor: '#38BDF8',
                    borderRadius: '10px',
                    textDecoration: 'none'
                  }}
                >
                  Download File
                </a>
              </div>
            </div>
          )
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: '12px' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <b style={{ fontSize: '16px', color: '#F8FAFC' }}>No Document Uploaded</b>
            <span style={{ fontSize: '13px' }}>The applicant has not uploaded a file for {DOC_LABELS[selectedDocKey] || selectedDocKey}.</span>
          </div>
        )}
      </div>
    </div>
  );
}
