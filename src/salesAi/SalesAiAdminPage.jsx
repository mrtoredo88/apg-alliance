import React, { useEffect, useState } from 'react';
import { apgIdentity } from '../apg/index.js';
import { SalesAiDashboard } from './SalesAiDashboard.jsx';
import { SalesAiAgentOps } from './SalesAiAgentOps.jsx';

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

  const agentsView = window.location.pathname.endsWith('/agents');
  return (
    <div style={{ minHeight: '100vh', background: '#0d0e16' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', gap: 8, alignItems: 'center', padding: '10px 18px', background: 'rgba(13,14,22,.96)', borderBottom: '1px solid #292c3a', backdropFilter: 'blur(12px)', fontFamily: 'Inter,system-ui,sans-serif' }}>
        <a href="/admin" style={navLink(false)}>← Админка</a>
        <a href="/admin/sales-ai" style={navLink(!agentsView)}>🔎 Разведчик · Аналитик · Продажник</a>
        <a href="/admin/sales-ai/agents" style={navLink(agentsView)}>📬 Коммуникатор · 📊 Руководитель</a>
      </nav>
      {agentsView ? <SalesAiAgentOps /> : <SalesAiDashboard />}
    </div>
  );
}

function navLink(active) {
  return {
    display: 'inline-block', padding: '8px 11px', borderRadius: 10,
    border: active ? '1px solid #8b753a' : '1px solid #343747',
    background: active ? '#211d12' : '#151722', color: active ? '#e5c667' : '#d9dbe5',
    textDecoration: 'none', fontSize: 12, fontWeight: 800,
  };
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
