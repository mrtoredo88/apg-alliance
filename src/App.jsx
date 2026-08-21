import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { SplashScreen } from './SplashScreen.jsx';
import { markPerformanceStage } from './performance/index.js';

const AdminPanel = lazy(() => import('./AdminPanel.jsx').then(m => ({ default: m.AdminPanel })));
const SalesAiAdminPage = lazy(() => import('./salesAi/SalesAiAdminPage.jsx').then(m => ({ default: m.SalesAiAdminPage })));
const AssistantMiniApp = lazy(() => import('./assistant/AssistantMiniApp.jsx').then(m => ({ default: m.AssistantMiniApp })));
const NetworkDiagnosticsPage = lazy(() => import('./NetworkDiagnosticsPage.jsx').then(m => ({ default: m.NetworkDiagnosticsPage })));
const UserApp = lazy(() => import('./UserApp.jsx').then(m => ({ default: m.UserApp })));

function AppFallback({ label = 'Загрузка...' }) {
  return <SplashScreen isReady={false} autoTimeout={false} status={label} />;
}

function AdminPanelWithSalesAiShortcut() {
  return (
    <>
      <AdminPanel />
      <a
        href="/admin/sales-ai"
        aria-label="Открыть AI-отдел продаж"
        title="AI-отдел продаж"
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 10020,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 14px', borderRadius: 14,
          background: '#171922', color: '#f7f4ea', textDecoration: 'none',
          border: '1px solid rgba(216,183,93,.7)', boxShadow: '0 10px 30px rgba(0,0,0,.32)',
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 800,
        }}
      >
        <span aria-hidden="true">🤖</span>
        <span>AI-отдел продаж</span>
      </a>
    </>
  );
}

export function App() {
  useEffect(() => {
    window.__APG_BOOT_MARK?.('app_mounted');
    markPerformanceStage('react_render_complete', {}, 'react');
    markPerformanceStage('router_ready', { path: window.location.pathname }, 'routing');
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
              <AdminPanelWithSalesAiShortcut />
            </Suspense>
          } />
          <Route path="/admin-app" element={
            <Suspense fallback={<AppFallback label="Загрузка админки АПГ..." />}>
              <AdminPanelWithSalesAiShortcut />
            </Suspense>
          } />
          <Route path="/admin/sales-ai" element={
            <Suspense fallback={<AppFallback label="Загрузка AI-отдела продаж..." />}>
              <SalesAiAdminPage />
            </Suspense>
          } />
          <Route path="/admin/sales-ai/agents" element={
            <Suspense fallback={<AppFallback label="Загрузка AI-агентов продаж..." />}>
              <SalesAiAdminPage />
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
