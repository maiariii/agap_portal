import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const hasHqSsoToken = new URLSearchParams(window.location.search).has('sso_token');
  const [token, setToken] = useState(() => (
    hasHqSsoToken ? '' : localStorage.getItem('agap_token') || ''
  ));
  const [user, setUser] = useState(() => {
    if (hasHqSsoToken) return null;
    const raw = localStorage.getItem('agap_user');
    try { return raw ? JSON.parse(raw) : null; } catch(e) { return null; }
  });

  const handleLogout = () => {
    localStorage.removeItem('agap_token');
    localStorage.removeItem('agap_user');
    localStorage.removeItem('deped_tour_seen');
    window.agap_tutorial_dismissed = false;
    setToken('');
    setUser(null);
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      handleLogout();
      window.dispatchEvent(new CustomEvent('agap-toast-trigger', {
        detail: { message: 'Your session has expired. Please log in again.', type: 'error' }
      }));
    };

    window.addEventListener('agap-session-expired', handleSessionExpired);
    return () => window.removeEventListener('agap-session-expired', handleSessionExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ token, setToken, user, setUser, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
