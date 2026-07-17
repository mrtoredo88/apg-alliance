import React, { useState } from 'react';
import { API_BASE_URL } from './constants.js';
import { APG2_PROFILE, GlassButton, GlassInput } from './components/Apg2ProfileGlass.jsx';
import { logError } from './errorLogger.js';
import { readPendingReferral, refLog } from './referralDiagnostics.js';

const SPINNER = (
  <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />
);

export function EmailAuth({ onCancel, onSuccess }) {
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    const ref = readPendingReferral({ source: 'EmailAuth.login' }) || undefined;
    refLog('auth start', { provider: 'email', hasReferral: !!ref, value: ref || null });
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, ref }),
      });
      const data = await res.json();
      if (!data.ok) {
        refLog('auth error', { provider: 'email', reason: data.error || data.message || 'unknown', hasReferral: !!ref });
        setError(data.message || 'Ошибка входа. Попробуйте снова.');
      } else {
        refLog('auth success', { provider: 'email', userId: data.user?.id || data.canonicalUserId || null, hasReferral: !!ref });
        if (onSuccess) {
          onSuccess(data.user, { ...data, ref, referrerId: ref });
        } else {
          localStorage.setItem('apg_email_user', JSON.stringify(data.user));
          window.location.reload();
        }
      }
    } catch (e) {
      logError(e, 'EmailAuth.handleLogin');
      setError('Ошибка сети. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <GlassInput
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={e => { setEmail(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        placeholder="Ваш email"
        style={{ border: `1px solid ${isValid ? 'rgba(215,184,106,0.48)' : 'var(--apg2-glass-border, rgba(255,255,255,0.16))'}` }}
      />
      {error && <div style={{ fontSize: 12, color: '#E64646', textAlign: 'center' }}>{error}</div>}
      <GlassButton
        onClick={handleLogin}
        disabled={loading || !isValid}
        tone="gold"
        style={{ width: '100%', opacity: loading || !isValid ? 0.5 : 1, color: '#17120a' }}
      >
        {loading ? SPINNER : '✉️ Войти'}
      </GlassButton>
      <GlassButton
        onClick={onCancel}
        style={{ width: '100%', minHeight: 46, color: APG2_PROFILE.textSoft }}
      >
        Отмена
      </GlassButton>
    </div>
  );
}
