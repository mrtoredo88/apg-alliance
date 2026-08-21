import React, { useEffect, useState } from 'react';
import { apgIdentity } from '../apg/index.js';
import { SalesAiDashboard } from './SalesAiDashboard.jsx';

function roleFromClaims(result) {
  const claims = result?.claims || result || {};
  return String(claims.role || claims.userRole || (claims.owner ? 'owner' : claims.admin ? 'admin' : '') || '').toLowerCase();
}

export function SalesAiAdminPage() {
  const [state, setState] = useState({ loading: true, allowed: false, role: '', error: '' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const identity = apgIdentity.getCurrentIdentity?.();
        if (!identity) {
          if (active) setState({ loading: false, allowed: false, role: '', error: 'Требуется вход администратора.' });
          return;
        }
        const result = await apgIdentity.getSessionClaims?.();
        const role = roleFromClaims(result);
        const allowed = role === 'owner' || role === 'admin';
        if (active) setState({ loading: false, allowed, role, error: allowed ? '' : 'Недостаточно прав для AI-отдела продаж.' });
      } catch (error) {
        if (active) setState({ loading: false, allowed: false, role: '', error: error?.message || 'Не удалось проверить права.' });
      }
    })();
    return () => { active = false; };
  }, []);

  if (state.loading) return <Gate title="Проверяем доступ…" />;
  if (!state.allowed) return <Gate title="Доступ закрыт" text={state.error} />;
  return <SalesAiDashboard />;
}

function Gate({ title, text = '' }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0d0e16', color: '#f7f4ea', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: 'min(100%, 520px)', padding: 24, borderRadius: 20, border: '1px solid #2d3040', background: '#151722', textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🤖</div>
        <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
        {text && <p style={{ color: '#aeb1bf', lineHeight: 1.5 }}>{text}</p>}
        <a href="/admin" style={{ display: 'inline-block', marginTop: 10, color: '#d8b75d', fontWeight: 800 }}>Вернуться в админку</a>
      </div>
    </main>
  );
}
