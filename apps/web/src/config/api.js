export const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('agap_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  try {
    const apiPath = (import.meta.env.VITE_API_URL || '') + path;
    const res = await fetch(apiPath, { ...options, headers });
    if (!res.ok) {
      if (
        (res.status === 401 || res.status === 403) &&
        path !== '/api/auth/login' &&
        path !== '/api/auth/hq-sso'
      ) {
        window.dispatchEvent(new Event('agap-session-expired'));
        throw new Error('Your session has expired. Please log in again.');
      }
      let errMsg = `Server returned status ${res.status}`;
      try {
        const err = await res.json();
        errMsg = err.error || errMsg;
      } catch(e) {}
      throw new Error(errMsg);
    }
    return await res.json();
  } catch (err) {
    if (err.message && (err.message.includes('Unexpected end of JSON') || err.message.includes('Failed to fetch') || err.message.includes('fetch'))) {
      throw new Error('Connection refused. Please make sure the backend API server is running (npm run dev:api) on port 5000.');
    }
    throw err;
  }
};
