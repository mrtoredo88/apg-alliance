import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { SplashScreen } from './SplashScreen.jsx';

const AdminPanel = lazy(() => import('./AdminPanel.jsx').then(m => ({ default: m.AdminPanel })));
const AssistantMiniApp = lazy(() => import('./assistant/AssistantMiniApp.jsx').then(m => ({ default: m.AssistantMiniApp })));
const NetworkDiagnosticsPage = lazy(() => import('./NetworkDiagnosticsPage.jsx').then(m => ({ default: m.NetworkDiagnosticsPage })));
const UserApp = lazy(() => import('./UserApp.jsx').then(m => ({ default: m.UserApp })));

function AppFallback({ label = 'Загрузка...' }) {
  return <SplashScreen isReady={false} autoTimeout={false} status={label} />;
}

export function App() {
  useEffect(() => {
    window.__APG_BOOT_MARK?.('app_mounted');
    window.__APG_BOOT_OK = true;
  }, []);
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <Suspense fallback={<AppFallback label="Загрузка АПГ..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/admin" element={
            <Suspense fallback={<AppFallback label="Загрузка панели..." />}>
              <AdminPanel />
            </Suspense>
          } />
          <Route path="/admin-app" element={
            <Suspense fallback={<AppFallback label="Загрузка админки АПГ..." />}>
              <AdminPanel />
            </Suspense>
          } />
          <Route path="/news/:id" element={
            <Suspense fallback={<AppFallback label="Открываем новость..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/news" element={
            <Suspense fallback={<AppFallback label="Открываем новости..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/events" element={
            <Suspense fallback={<AppFallback label="Открываем афишу..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/event/:id" element={
            <Suspense fallback={<AppFallback label="Открываем событие..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/partner/:id" element={
            <Suspense fallback={<AppFallback label="Открываем партнёра..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/expert/:id" element={
            <Suspense fallback={<AppFallback label="Открываем эксперта..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/experts" element={
            <Suspense fallback={<AppFallback label="Открываем экспертов..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/submit/:type/:token" element={
            <Suspense fallback={<AppFallback label="Открываем форму..." />}>
              <UserApp />
            </Suspense>
          } />
          <Route path="/assistant" element={
            <Suspense fallback={<AppFallback label="Загрузка помощника..." />}>
              <AssistantMiniApp />
            </Suspense>
          } />
          <Route path="/telegram-helper" element={
            <Suspense fallback={<AppFallback label="Загрузка помощника..." />}>
              <AssistantMiniApp />
            </Suspense>
          } />
          <Route path="/network-diagnostics" element={
            <Suspense fallback={<AppFallback label="Проверяем сеть..." />}>
              <NetworkDiagnosticsPage />
            </Suspense>
          } />
          <Route path="/diag/network" element={
            <Suspense fallback={<AppFallback label="Проверяем сеть..." />}>
              <NetworkDiagnosticsPage />
            </Suspense>
          } />
          <Route path="/miniapp/help" element={
            <Suspense fallback={<AppFallback label="Загрузка помощника..." />}>
              <AssistantMiniApp />
            </Suspense>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
