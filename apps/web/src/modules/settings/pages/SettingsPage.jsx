import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { useTheme } from '../../../middleware/ThemeProvider.jsx';
import { apiFetch } from '../../../config/api.js';
import ThemeToggle from '../../../components/ThemeToggle.jsx';
import PasscodePinInput from '../../../components/PasscodePinInput.jsx';

export default function SettingsPage() {
  const { user } = useAuth();
  const { setToast } = useToast();
  const { theme, isDark, setTheme } = useTheme();

  // Collaborators state
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Invite form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');

  // Second layer of authentication state
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    actionType: null, // 'invite' | 'remove'
    targetData: null,
    passcode: '',
    error: '',
    isVerifying: false
  });

  // Fetch collaborators list
  const fetchCollaborators = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/collaborators');
      if (data && Array.isArray(data.collaborators)) {
        setCollaborators(data.collaborators);
      } else if (Array.isArray(data)) {
        setCollaborators(data);
      }
    } catch (err) {
      console.error('[SettingsPage] Error fetching collaborators:', err);
      setToast({ message: 'Failed to load collaborators.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, []);

  // Handle initiate invite (triggers passcode layer)
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!firstName.trim() || !lastName.trim() || !position.trim() || !email.trim()) {
      setFormError('All fields are required.');
      return;
    }

    if (!email.trim().toLowerCase().includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    // Open second layer of authentication
    setAuthModal({
      isOpen: true,
      actionType: 'invite',
      targetData: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        position: position.trim(),
        email: email.trim().toLowerCase()
      },
      passcode: '',
      error: '',
      isVerifying: false
    });
  };

  const handleInvite = handleSubmit;

  // Handle initiate remove (triggers passcode layer)
  const handleDeleteCollaborator = (collab) => {
    setAuthModal({
      isOpen: true,
      actionType: 'remove',
      targetData: collab,
      passcode: '',
      error: '',
      isVerifying: false
    });
  };

  // Execute authenticated action upon passcode verification
  const handleConfirmAuth = async (e) => {
    if (e) e.preventDefault();
    if (!authModal.passcode || authModal.passcode.length !== 6) {
      setAuthModal(prev => ({ ...prev, error: 'Please enter a complete 6-digit passcode.' }));
      return;
    }

    setAuthModal(prev => ({ ...prev, isVerifying: true, error: '' }));

    // Layer 2: Verify HRMO Security Passcode
    try {
      await apiFetch('/api/auth/verify-passcode', {
        method: 'POST',
        body: JSON.stringify({ passcode: authModal.passcode })
      });
    } catch (err) {
      setAuthModal(prev => ({
        ...prev,
        isVerifying: false,
        error: err.message || 'Incorrect passcode. Action not authorized.'
      }));
      return;
    }

    // Authenticated action execution
    if (authModal.actionType === 'invite') {
      setIsSubmitting(true);
      try {
        const res = await apiFetch('/api/collaborators/invite', {
          method: 'POST',
          body: JSON.stringify(authModal.targetData)
        });

        setToast({
          message: res.message || 'Collaborator invited successfully!',
          type: 'success'
        });

        // Clear form and close modal
        setFirstName('');
        setLastName('');
        setPosition('');
        setEmail('');
        setFormError('');
        setAuthModal({ isOpen: false, actionType: null, targetData: null, passcode: '', error: '', isVerifying: false });

        fetchCollaborators();
      } catch (err) {
        console.error('[SettingsPage] Invite error:', err);
        setAuthModal(prev => ({
          ...prev,
          isVerifying: false,
          error: err.message || 'Failed to send invitation.'
        }));
        setToast({ message: err.message || 'Failed to send invitation.', type: 'error' });
      } finally {
        setIsSubmitting(false);
      }
    } else if (authModal.actionType === 'remove') {
      const collab = authModal.targetData;
      setDeletingId(collab.id);
      try {
        await apiFetch(`/api/collaborators/${collab.id}`, {
          method: 'DELETE'
        });

        setToast({
          message: `${collab.first_name} ${collab.last_name} has been removed.`,
          type: 'success'
        });

        setCollaborators(prev => prev.filter(c => c.id !== collab.id));
        setAuthModal({ isOpen: false, actionType: null, targetData: null, passcode: '', error: '', isVerifying: false });
      } catch (err) {
        console.error('[SettingsPage] Delete error:', err);
        setAuthModal(prev => ({
          ...prev,
          isVerifying: false,
          error: err.message || 'Failed to remove collaborator.'
        }));
        setToast({ message: err.message || 'Failed to remove collaborator.', type: 'error' });
        fetchCollaborators();
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 850, color: isDark ? '#F8FAFC' : '#08315f', margin: '0 0 6px' }}>
          Settings & Collaborator Access
        </h2>
        <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '13.5px', margin: 0 }}>
          Manage your HRMO account profile, interface theme preferences, and authorize regional/division assistants.
        </p>
      </div>

      {/* Theme Preference Banner */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
        padding: '9px 16px',
        boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.04)',
        marginBottom: '20px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        maxWidth: '440px',
        width: '100%'
      }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 750, color: isDark ? '#F8FAFC' : '#08315f', display: 'block', lineHeight: 1.25 }}>
            Dark Mode
          </span>
          <span style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
            Switch between light and dark themes
          </span>
        </div>

        <ThemeToggle variant="switch" />
      </div>

      {/* Grid: Profile and Invite Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* HRMO Profile Card */}
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: isDark ? 'rgba(30, 58, 138, 0.35)' : 'rgba(2, 132, 199, 0.1)',
                border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(2, 132, 199, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#93c5fd' : '#0284c7'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: isDark ? '#F8FAFC' : '#08315f' }}>
                  HRMO Account Profile
                </h3>
                <span style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                  Host Administrator
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '10px 14px', background: isDark ? 'rgba(2, 6, 23, 0.5)' : '#f8fafc', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</div>
                <div style={{ fontSize: '14px', fontWeight: 750, color: isDark ? '#F8FAFC' : '#0f172a' }}>
                  {user?.firstName || user?.lastName
                    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                    : (user?.fullName || user?.username || 'HR Officer')}
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: isDark ? 'rgba(2, 6, 23, 0.5)' : '#f8fafc', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Official Email</div>
                <div style={{ fontSize: '14px', fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155' }}>
                  {user?.email || user?.username || '—'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '10px 14px', background: isDark ? 'rgba(2, 6, 23, 0.5)' : '#f8fafc', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Region</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: isDark ? '#93c5fd' : '#0284c7' }}>
                    {user?.region || 'NCR'}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: isDark ? 'rgba(2, 6, 23, 0.5)' : '#f8fafc', borderRadius: '10px', border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Division</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: isDark ? '#93c5fd' : '#0284c7' }}>
                    {user?.division || 'BHROD'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: isDark ? '#6ee7b7' : '#047857', fontWeight: 750, background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5', border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '999px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Verified HRMO Host
            </span>
            <span style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b' }}>
              All helpers inherit your Region & Division
            </span>
          </div>
        </div>

        {/* Invite Form Card */}
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
              border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#34d399' : '#059669'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: isDark ? '#F8FAFC' : '#08315f' }}>
                Invite helpers to collaborate within scope.
              </h3>
              <span style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                Grant access to assist with candidate screening and ranking
              </span>
            </div>
          </div>

          {formError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '12.5px',
              fontWeight: 650,
              marginBottom: '16px'
            }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: isDark ? '#cbd5e1' : '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  First Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maria"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    fontSize: '13px',
                    color: 'var(--input-text)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: isDark ? '#cbd5e1' : '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Santos"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    fontSize: '13px',
                    color: 'var(--input-text)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: isDark ? '#cbd5e1' : '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Position / Title
              </label>
              <input
                type="text"
                placeholder="e.g. Administrative Assistant II / HR Support"
                value={position}
                onChange={e => setPosition(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  fontSize: '13px',
                  color: 'var(--input-text)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: isDark ? '#cbd5e1' : '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                DepEd Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. maria.santos@deped.gov.ph"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  fontSize: '13px',
                  color: 'var(--input-text)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: '6px',
                padding: '11px 18px',
                borderRadius: '10px',
                background: isSubmitting ? '#64748b' : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 750,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
            >
              {isSubmitting ? 'Sending Invitation…' : 'Send Collaborator Invite'}
            </button>
          </form>
        </div>
      </div>

      {/* Active Collaborators Section */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
        backdropFilter: 'blur(16px)',
        borderRadius: '16px',
        border: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{
          padding: '18px 24px',
          borderBottom: isDark ? '1px solid rgba(51, 65, 85, 0.7)' : '1px solid #e2e8f0',
          background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px', color: isDark ? '#F8FAFC' : '#08315f' }}>
              Active Collaborators
            </h3>
            <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
              Authorized assistants currently attached to your office
            </span>
          </div>

          <span style={{
            fontSize: '12px',
            fontWeight: 800,
            color: isDark ? '#93c5fd' : '#0284c7',
            background: isDark ? 'rgba(30, 58, 138, 0.35)' : '#e0f2fe',
            border: isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bae6fd',
            padding: '4px 12px',
            borderRadius: '999px'
          }}>
            {collaborators.length} {collaborators.length === 1 ? 'Helper' : 'Helpers'}
          </span>
        </div>

        {/* List Content */}
        <div style={{ padding: '16px 24px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13.5px' }}>
              Loading active collaborators...
            </div>
          ) : collaborators.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 750, color: isDark ? '#cbd5e1' : '#1e293b', marginBottom: '4px' }}>
                No active collaborators yet.
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Use the form above to invite assistants within your Region and Division scope.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {collaborators.map((collab) => {
                const fullName = `${collab.first_name} ${collab.last_name}`;
                const isDeleting = deletingId === collab.id;

                return (
                  <div
                    key={collab.id}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '12px',
                      border: isDark ? '1px solid rgba(51, 65, 85, 0.6)' : '1px solid #e2e8f0',
                      background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                      boxShadow: isDark ? 'none' : '0 1px 4px rgba(0, 0, 0, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: isDark ? 'rgba(30, 58, 138, 0.35)' : '#e0f2fe',
                        color: isDark ? '#93c5fd' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 800
                      }}>
                        {collab.first_name?.[0] || 'C'}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: isDark ? '#F8FAFC' : '#08315f' }}>
                            {fullName}
                          </span>
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                            color: isDark ? '#6ee7b7' : '#047857',
                            border: isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #a7f3d0',
                            letterSpacing: '0.04em'
                          }}>
                            ACTIVE
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                          <span style={{ fontWeight: 650, color: isDark ? '#cbd5e1' : '#334155' }}>{collab.position}</span> • {collab.email}
                        </div>

                        <div style={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
                          Scope: {collab.region_id} • {collab.division_id}
                          {collab.created_at && (
                            <span> • Added {new Date(collab.created_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteCollaborator(collab)}
                      disabled={isDeleting}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                        border: isDark ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #fecaca',
                        color: isDark ? '#fca5a5' : '#dc2626',
                        fontSize: '12.5px',
                        fontWeight: 750,
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2'}
                      onMouseOut={e => e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'}
                    >
                      {isDeleting ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Security Verification Modal (Layer 2 Passcode Authentication) */}
      {authModal.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="security-auth-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !authModal.isVerifying) {
              setAuthModal({ isOpen: false, actionType: null, targetData: null, passcode: '', error: '', isVerifying: false });
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: isDark ? '#0f172a' : '#ffffff',
              borderRadius: '16px',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              boxShadow: isDark
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                : '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              animation: 'agapModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: isDark
                  ? (authModal.actionType === 'remove' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.08)')
                  : (authModal.actionType === 'remove' ? '#fef2f2' : '#f0f7ff')
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: authModal.actionType === 'remove'
                    ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2')
                    : (isDark ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe'),
                  color: authModal.actionType === 'remove'
                    ? (isDark ? '#fca5a5' : '#dc2626')
                    : (isDark ? '#93c5fd' : '#1d4ed8'),
                  flexShrink: 0
                }}
              >
                {authModal.actionType === 'remove' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  id="security-auth-title"
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    margin: 0,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {authModal.actionType === 'remove'
                    ? 'Confirm Collaborator Revocation'
                    : 'Authorize Collaborator Invitation'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Second Layer HRMO Passcode Verification
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmAuth} style={{ padding: '24px' }}>
              {/* Action target details box */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: isDark ? '#1e293b' : '#f8fafc',
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? '#94a3b8' : '#64748b', marginBottom: '6px' }}>
                  Target Recipient / Account
                </div>
                <div style={{ fontSize: '14px', fontWeight: 750, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                  {authModal.targetData?.first_name} {authModal.targetData?.last_name}
                </div>
                <div style={{ fontSize: '12.5px', color: isDark ? '#cbd5e1' : '#475569', marginTop: '2px' }}>
                  <span style={{ fontWeight: 600 }}>{authModal.targetData?.position}</span> • {authModal.targetData?.email}
                </div>
                <div style={{ fontSize: '11.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '6px', paddingTop: '6px', borderTop: isDark ? '1px dashed #334155' : '1px dashed #e2e8f0' }}>
                  {authModal.actionType === 'remove'
                    ? 'Revoking this account immediately disables their portal evaluation permissions.'
                    : 'An invitation will be generated granting this staff member helper evaluation privileges.'}
                </div>
              </div>

              {/* Passcode input label */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 750, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: '4px' }}>
                  Enter HRMO Security Passcode
                </label>
                <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  Input your 6-digit numeric passcode to authorize this administrative action.
                </span>
              </div>

              {/* 6-box Passcode Component */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
                <PasscodePinInput
                  value={authModal.passcode}
                  onChange={(val) => setAuthModal(prev => ({ ...prev, passcode: val, error: '' }))}
                  length={6}
                  autoFocus={true}
                  disabled={authModal.isVerifying}
                />
              </div>

              {/* Error feedback */}
              {authModal.error && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #fecaca',
                    color: isDark ? '#fca5a5' : '#dc2626',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{authModal.error}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setAuthModal({ isOpen: false, actionType: null, targetData: null, passcode: '', error: '', isVerifying: false })}
                  disabled={authModal.isVerifying}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    background: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: authModal.isVerifying ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={authModal.isVerifying || authModal.passcode.length !== 6}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: authModal.actionType === 'remove'
                      ? (authModal.passcode.length === 6 ? '#dc2626' : (isDark ? '#450a0a' : '#fca5a5'))
                      : (authModal.passcode.length === 6 ? '#2563eb' : (isDark ? '#1e3a8a' : '#93c5fd')),
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: (authModal.isVerifying || authModal.passcode.length !== 6) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: authModal.passcode.length === 6
                      ? (authModal.actionType === 'remove' ? '0 4px 12px rgba(220, 38, 38, 0.25)' : '0 4px 12px rgba(37, 99, 235, 0.25)')
                      : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {authModal.isVerifying && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'agapSpin 1s linear infinite' }}>
                      <line x1="12" y1="2" x2="12" y2="6"/>
                      <line x1="12" y1="18" x2="12" y2="22"/>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                      <line x1="2" y1="12" x2="6" y2="12"/>
                      <line x1="18" y1="12" x2="22" y2="12"/>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                    </svg>
                  )}
                  {authModal.isVerifying
                    ? 'Verifying…'
                    : authModal.actionType === 'remove'
                      ? 'Verify & Revoke'
                      : 'Verify & Authorize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

