import React, { useState } from 'react';
import { T } from './design.js';

const SPINNER = (
  <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />
);

export function EmailAuth({ onCancel }) {
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    const ref = localStorage.getItem('apg_pending_ref') ?? undefined;
    try {
      const res = await fetch('/api/email-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, ref }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || 'Ошибка входа. Попробуйте снова.');
      } else {
        if (ref) localStorage.removeItem('apg_pending_ref');
        localStorage.setItem('apg_email_user', JSON.stringify(data.user));
        window.location.reload();
      }
    } catch {
      setError('Ошибка сети. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase = {
    background: T.chipBg,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    color: T.textPri,
    outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={e => { setEmail(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        placeholder="Ваш email"
        style={{ ...inputBase, width: '100%', padding: '12px 14px', fontSize: 16, boxSizing: 'border-box' }}
      />
      {error && <div style={{ fontSize: 12, color: '#E64646', textAlign: 'center' }}>{error}</div>}
      <button
        onClick={handleLogin}
        disabled={loading || !isValid}
        style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: loading || !isValid ? 'default' : 'pointer', background: loading || !isValid ? 'rgba(74,144,217,0.3)' : 'linear-gradient(135deg, #4A90D9, #2D6FBC)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {loading ? SPINNER : '✉️ Войти'}
      </button>
      <button
        onClick={onCancel}
        style={{ width: '100%', padding: '10px 0', borderRadius: 12, background: 'none', border: `1px solid ${T.border}`, color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Отмена
      </button>
    </div>
  );
}
