import React, { useState } from 'react';
import { API_BASE_URL } from './constants.js';
import { APG2_PROFILE, GlassButton, GlassInput } from './components/Apg2ProfileGlass.jsx';
import { logError } from './errorLogger.js';
import { drainReferralEventQueue, ensureServerReferralSession, getReferralContext, readPendingReferral, refLog } from './referralDiagnostics.js';
import { recordEmailLoginStage } from './auth/emailLoginDiagnostics.js';

const SPINNER = (
  <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />
);

export function EmailAuth({ onCancel, onSuccess }) {
  const [email, setEmail]   = useState('');
  const [code, setCode]     = useState('');
  const [step, setStep]     = useState('email');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const codeValid = /^\d{6}$/.test(code.trim());

  const buildReferralPayload = async (requestId) => {
    const ref = readPendingReferral({ source: 'EmailAuth.login' }) || undefined;
    refLog('auth start', { provider: 'email', hasReferral: !!ref, value: ref || null });
    recordEmailLoginStage('referral_start', { requestId, hasReferral: !!ref });
    const serverSession = await (globalThis.__APG_REFERRAL_SESSION_PROMISE__ || ensureServerReferralSession({ apiBaseUrl: API_BASE_URL, ref, source: 'EmailAuth.login' })).catch(() => null);
    const referralContext = getReferralContext({ ref, source: 'EmailAuth.login' });
    return {
      ref,
      referralContext,
      referralClientEvents: drainReferralEventQueue(),
      referralSessionId: serverSession?.referralSessionId || referralContext.referralSessionId || referralContext.sessionId,
      referralFlowId: referralContext.referralFlowId,
      referralSessionIdLocal: referralContext.sessionId,
      referralDeviceId: referralContext.deviceId,
      referralPlatform: referralContext.platform,
    };
  };

  const parseEmailResponse = async (res) => {
    const responseText = await res.text();
    try {
      return responseText ? JSON.parse(responseText) : {};
    } catch {
      return { ok: false, error: 'EMAIL_BAD_JSON', message: 'Ошибка входа. Попробуйте снова.' };
    }
  };

  const handleSendCode = async () => {
    if (!isValid || loading) return;
    const requestId = `email_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    setLoading(true);
    setError('');
    recordEmailLoginStage('ui_start', { requestId, emailDomain: normalizedEmail.split('@')[1] || '', valid: isValid, action: 'send' });
    try {
      const url = `${API_BASE_URL}/api/email-auth`;
      recordEmailLoginStage('http_start', { requestId, url, method: 'POST' });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: normalizedEmail }),
      });
      const data = await parseEmailResponse(res);
      recordEmailLoginStage('http_end', {
        requestId,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startedAt,
        error: data.error || null,
        failedStage: data.diagnostics?.failedStage || null,
        requestIdBackend: data.diagnostics?.requestId || null,
      });
      if (!res.ok || !data.ok) {
        recordEmailLoginStage('failed', { requestId, code: data.error || 'EMAIL_SEND_FAILED', failedStage: data.diagnostics?.failedStage || 'send_code', status: res.status, durationMs: Date.now() - startedAt });
        setError(data.message || 'Не удалось отправить код. Попробуйте снова.');
        return;
      }
      recordEmailLoginStage('email_code_sent', { requestId, durationMs: Date.now() - startedAt });
      setStep('code');
    } catch (e) {
      logError(e, 'EmailAuth.handleSendCode');
      recordEmailLoginStage('network_error', { requestId, code: e?.code || 'NETWORK_ERROR', message: e?.message || String(e), durationMs: Date.now() - startedAt });
      setError('Ошибка сети. Попробуйте снова.');
    } finally {
      recordEmailLoginStage('ui_end', { requestId, durationMs: Date.now() - startedAt });
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isValid || !codeValid || loading) return;
    const requestId = `email_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    setLoading(true);
    setError('');
    recordEmailLoginStage('ui_start', { requestId, emailDomain: normalizedEmail.split('@')[1] || '', valid: isValid, action: 'verify' });
    const referralPayload = await buildReferralPayload(requestId);
    try {
      const url = `${API_BASE_URL}/api/email-auth`;
      recordEmailLoginStage('http_start', { requestId, url, method: 'POST' });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: normalizedEmail,
          code: code.trim(),
          ...referralPayload,
        }),
      });
      const data = await parseEmailResponse(res);
      recordEmailLoginStage('http_end', {
        requestId,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startedAt,
        error: data.error || null,
        failedStage: data.diagnostics?.failedStage || null,
        requestIdBackend: data.diagnostics?.requestId || null,
      });
      if (!res.ok || !data.ok) {
        refLog('auth error', { provider: 'email', reason: data.error || data.message || 'unknown', hasReferral: !!referralPayload.ref });
        recordEmailLoginStage('failed', {
          requestId,
          code: data.error || 'EMAIL_HTTP_FAILED',
          failedStage: data.diagnostics?.failedStage || 'http_response',
          status: res.status,
          durationMs: Date.now() - startedAt,
        });
        setError(data.message || 'Ошибка входа. Попробуйте снова.');
      } else {
        refLog('auth success', { provider: 'email', userId: data.user?.id || data.canonicalUserId || null, hasReferral: !!referralPayload.ref });
        recordEmailLoginStage('backend_success', { requestId, userId: data.user?.id || data.canonicalUserId || null, durationMs: Date.now() - startedAt });
        if (onSuccess) {
          onSuccess(data.user, { ...data, ref: referralPayload.ref, referrerId: referralPayload.ref, referralSessionId: referralPayload.referralSessionId, referralFlowId: referralPayload.referralFlowId, referralSessionIdLocal: referralPayload.referralSessionIdLocal, referralDeviceId: referralPayload.referralDeviceId, referralPlatform: referralPayload.referralPlatform });
        } else {
          localStorage.setItem('apg_email_user', JSON.stringify(data.user));
          window.location.reload();
        }
      }
    } catch (e) {
      logError(e, 'EmailAuth.handleLogin');
      recordEmailLoginStage('network_error', { requestId, code: e?.code || 'NETWORK_ERROR', message: e?.message || String(e), durationMs: Date.now() - startedAt });
      setError('Ошибка сети. Попробуйте снова.');
    } finally {
      recordEmailLoginStage('ui_end', { requestId, durationMs: Date.now() - startedAt });
      setLoading(false);
    }
  };

  const handlePrimary = step === 'code' ? handleVerifyCode : handleSendCode;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <GlassInput
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={e => { setEmail(e.target.value); setError(''); if (step !== 'email') setStep('email'); }}
        onKeyDown={e => e.key === 'Enter' && handlePrimary()}
        placeholder="Ваш email"
        style={{ border: `1px solid ${isValid ? 'rgba(215,184,106,0.48)' : 'var(--apg2-glass-border, rgba(255,255,255,0.16))'}` }}
      />
      {step === 'code' && (
        <GlassInput
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
          placeholder="Код из письма"
          style={{ textAlign: 'center', letterSpacing: 4, border: `1px solid ${codeValid ? 'rgba(215,184,106,0.48)' : 'var(--apg2-glass-border, rgba(255,255,255,0.16))'}` }}
        />
      )}
      {error && <div style={{ fontSize: 12, color: '#E64646', textAlign: 'center' }}>{error}</div>}
      <GlassButton
        onClick={handlePrimary}
        disabled={loading || !isValid || (step === 'code' && !codeValid)}
        tone="gold"
        style={{ width: '100%', opacity: loading || !isValid || (step === 'code' && !codeValid) ? 0.5 : 1, color: '#17120a' }}
      >
        {loading ? SPINNER : step === 'code' ? 'Подтвердить код' : '✉️ Получить код'}
      </GlassButton>
      {step === 'code' && (
        <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }} style={{ border: 'none', background: 'transparent', color: APG2_PROFILE.textSoft, fontSize: 12, cursor: 'pointer' }}>
          Изменить email
        </button>
      )}
      <GlassButton
        onClick={onCancel}
        style={{ width: '100%', minHeight: 46, color: APG2_PROFILE.textSoft }}
      >
        Отмена
      </GlassButton>
    </div>
  );
}
