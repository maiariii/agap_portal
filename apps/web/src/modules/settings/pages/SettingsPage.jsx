import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../middleware/AuthProvider.jsx';
import { useToast } from '../../../middleware/ToastProvider.jsx';
import { apiFetch } from '../../../config/api.js';

export default function SettingsPage() {
  const { user } = useAuth();
  const { setToast } = useToast();

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

  // Handle invitation submit
  const handleInvite = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!firstName.trim() || !lastName.trim() || !position.trim() || !email.trim()) {
      setFormError('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/collaborators/invite', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          position: position.trim(),
          email: email.trim().toLowerCase()
        })
      });

      setToast({
        message: res.message || 'Collaborator invited successfully!',
        type: 'success'
      });

      // Clear form
      setFirstName('');
      setLastName('');
      setPosition('');
      setEmail('');
      setFormError('');

      // Refresh list
      fetchCollaborators();
    } catch (err) {
      console.error('[SettingsPage] Invite error:', err);
      setFormError(err.message || 'Failed to send invitation.');
      setToast({ message: err.message || 'Failed to send invitation.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete collaborator
  const handleDeleteCollaborator = async (collab) => {
    const fullName = `${collab.first_name} ${collab.last_name}`;
    if (!window.confirm(`Are you sure you want to remove ${fullName} from your active collaborators?`)) {
      return;
    }

    setDeletingId(collab.id);
    try {
      await apiFetch(`/api/collaborators/${collab.id}`, {
        method: 'DELETE'
      });

      setToast({
        message: `${fullName} has been removed.`,
        type: 'success'
      });

      // Optimistically update list
      setCollaborators(prev => prev.filter(c => c.id !== collab.id));
    } catch (err) {
      console.error('[SettingsPage] Delete error:', err);
      setToast({ message: err.message || 'Failed to remove collaborator.', type: 'error' });
      fetchCollaborators();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 850, color: 'var(--navy, #0f172a)', margin: '0 0 6px' }}>
          Settings & Collaborator Access
        </h2>
        <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
          Manage your HRMO account profile and authorize regional/division assistants to collaborate within your administrative scope.
        </p>
      </div>

      {/* Grid: Profile and Invite Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* HRMO Profile Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
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
                background: 'rgba(8, 49, 95, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: 'var(--navy, #08315f)'
              }}>
                👤
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  HRMO Account Profile
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                  Host Administrator
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</div>
                <div style={{ fontSize: '14px', fontWeight: 750, color: '#1e293b' }}>
                  {user?.firstName || user?.lastName
                    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                    : (user?.fullName || user?.username || 'HR Officer')}
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Official Email</div>
                <div style={{ fontSize: '14px', fontWeight: 650, color: '#1e293b' }}>
                  {user?.email || user?.username || '—'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Region</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#08315f' }}>
                    {user?.region || 'NCR'}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Division</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#08315f' }}>
                    {user?.division || 'BHROD'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 750, background: '#ECFDF5', padding: '4px 10px', borderRadius: '999px' }}>
              ✓ Verified HRMO Host
            </span>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              All helpers inherit your Region & Division
            </span>
          </div>
        </div>

        {/* Invite Form Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(5, 150, 105, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#059669'
            }}>
              ✉
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Invite helpers to collaborate within scope.
              </h3>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                Grant access to assist with candidate screening and ranking
              </span>
            </div>
          </div>

          {formError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#FEE2E2',
              color: '#B91C1C',
              fontSize: '12.5px',
              fontWeight: 650,
              marginBottom: '16px'
            }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
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
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
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
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
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
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
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
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
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
                background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #08315f 0%, #1e40af 100%)',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 750,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(8, 49, 95, 0.2)'
              }}
            >
              {isSubmitting ? 'Sending Invitation…' : 'Send Collaborator Invite ✓'}
            </button>
          </form>
        </div>
      </div>

      {/* Active Collaborators Section */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>
              Active Collaborators
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Authorized assistants currently attached to your office
            </span>
          </div>

          <span style={{
            fontSize: '12px',
            fontWeight: 800,
            color: '#08315f',
            background: 'rgba(8, 49, 95, 0.08)',
            padding: '4px 12px',
            borderRadius: '999px'
          }}>
            {collaborators.length} {collaborators.length === 1 ? 'Helper' : 'Helpers'}
          </span>
        </div>

        {/* List Content */}
        <div style={{ padding: '16px 24px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13.5px' }}>
              Loading active collaborators...
            </div>
          ) : collaborators.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>👥</div>
              <div style={{ fontSize: '14.5px', fontWeight: 750, color: '#334155', marginBottom: '4px' }}>
                No active collaborators yet.
              </div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
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
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
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
                        background: 'rgba(8, 49, 95, 0.08)',
                        color: 'var(--navy, #08315f)',
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
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                            {fullName}
                          </span>
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#ECFDF5',
                            color: '#065F46',
                            letterSpacing: '0.04em'
                          }}>
                            ACTIVE
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          <span style={{ fontWeight: 650, color: '#334155' }}>{collab.position}</span> • {collab.email}
                        </div>

                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          📍 Scope: {collab.region_id} • {collab.division_id}
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
                        background: '#FFF1F2',
                        border: '1px solid #FECDD3',
                        color: '#E11D48',
                        fontSize: '12.5px',
                        fontWeight: 750,
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#FFE4E6'}
                      onMouseOut={e => e.currentTarget.style.background = '#FFF1F2'}
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
    </div>
  );
}
