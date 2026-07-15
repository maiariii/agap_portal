import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider.jsx';
import { apiFetch } from '../config/api.js';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { token, handleLogout } = useAuth();
  const [positions, setPositions] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAllData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [posList, vacList, appList] = await Promise.all([
        apiFetch('/api/positions'),
        apiFetch('/api/vacancies'),
        apiFetch('/api/applications')
      ]);
      setPositions(posList);
      setVacancies(vacList);
      setApplications(appList);
    } catch (e) {
      console.error(e);
      if (e.message.includes('token') || e.message.includes('Authorization')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAllData();
    } else {
      setPositions([]);
      setVacancies([]);
      setApplications([]);
    }
  }, [token]);

  return (
    <DataContext.Provider value={{
      positions, setPositions,
      vacancies, setVacancies,
      applications, setApplications,
      loading, setLoading,
      loadAllData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useAppData() {
  return useContext(DataContext);
}
