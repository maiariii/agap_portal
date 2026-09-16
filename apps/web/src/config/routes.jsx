import React, { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import TeacherHiringModule from '../modules/assessment/pages/TeacherHiringModule.jsx';

const DashboardPage = lazy(() => import('../modules/dashboard/pages/DashboardPage.jsx'));
const VacanciesPage = lazy(() => import('../modules/vacancies/pages/VacanciesPage.jsx'));
const ApplicationsPage = lazy(() => import('../modules/applications/pages/ApplicationsPage.jsx'));
const AssessmentPage = lazy(() => import('../modules/assessment/pages/AssessmentPage.jsx'));
const AppointmentPage = lazy(() => import('../modules/appointment/pages/AppointmentPage.jsx'));
const SettingsPage = lazy(() => import('../modules/settings/pages/SettingsPage.jsx'));

export {
  DashboardPage,
  VacanciesPage,
  ApplicationsPage,
  AssessmentPage,
  AppointmentPage,
  TeacherHiringModule,
  SettingsPage
};

export const routes = [
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/vacancies', element: <VacanciesPage /> },
  { path: '/applications', element: <ApplicationsPage /> },
  { path: '/assessment', element: <AssessmentPage /> },
  { path: '/appointment', element: <AppointmentPage /> },
  { path: '/teacher-hiring', element: <TeacherHiringModule /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> }
];
