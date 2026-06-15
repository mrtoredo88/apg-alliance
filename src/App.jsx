import React, { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserApp } from './UserApp.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

async function checkForUpdate() {
  try {
    const res = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' });
    const { v } = await res.json();
    const stored = localStorage.getItem('apg_build');
    if (!stored) {
      localStorage.setItem('apg_build', v);
    } else if (stored !== v) {
      localStorage.setItem('apg_build', v);
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      window.location.reload();
    }
  } catch {}
}

const AdminPanel = lazy(() => import('./AdminPanel.jsx').then(m => ({ default: m.AdminPanel })));

const T = { bg: '#0F0F1A', gold: '#C9A84C' };

function AdminFallback() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 28 }}>⚙️</div>
      <div style={{ color: T.gold, fontSize: 14, fontWeight: 600 }}>Загрузка панели...</div>
    </div>
  );
}

export function App() {
  useEffect(() => { checkForUpdate(); }, []);
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<UserApp />} />
          <Route path="/admin" element={
            <Suspense fallback={<AdminFallback />}>
              <AdminPanel />
            </Suspense>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
