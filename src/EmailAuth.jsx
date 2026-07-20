import React, { useState } from 'react';
import { API_BASE_URL } from './constants.js';
import { APG2_PROFILE, GlassButton, GlassInput } from './components/Apg2ProfileGlass.jsx';
import { logError } from './errorLogger.js';
import { drainReferralEventQueue, ensureServerReferralSession, getReferralContext, readPendingReferral, refLog } from './referralDiagnostics.js';
import { recordEmailLoginStage } from './auth/emailLoginDiagnostics.js';

const SPINNER = (
  <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />
);

const EMAIL_AUDIT_ENDPOINT = `${API_BASE_URL}/api/email-auth-audit`;
const EMAIL_AUTH_AUDIT_ALLOWED_FIELDS = new Set([
  'requestId',
  'loginSessionId',
  'authAttemptId',
  'stage',
  'status',
  'durationMs',
  'publicErrorCode',
  'internalErrorCode',
  'frontendVersion',
  'identityPath',
  'identityResolved',
  'customTokenIssued',
  'expectedUidHash',
  'actualUidHash',
  'apgUserIdHash',
  'emailHash',
  'deviceIdHash',
  'platform',
  'appMode',
  'backendRevision',
  'finalResult',
  'failureCategory',
  'failedStage',
]);

function sanitizeEmailAuthAuditPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => EMAIL_AUTH_AUDIT_ALLOWED_FIELDS.has(key))
      .map(([key, value]) => [
        key,
        key === 'durationMs'
          ? (Number.isFinite(Number(value)) ? Number(value) : null)
          : safeString(value, 260),
      ]),
  );
}

function safeString(value, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

function buildFrontendEmailVersion() {
  try {
    return window?.__APG_BUILD_VERSION__ || window?.__APG_BUILD_DIAGNOSTICS__?.buildVersion || 'unknown';
  } catch {
    return 'unknown';
  }
}

function buildEmailAttemptPayload(attempt) {
  return {
    requestId: safeString(attempt?.requestId, 120),
    loginSessionId: safeString(attempt?.loginSessionId, 120),
    authAttemptId: safeString(attempt?.authAttemptId, 120),
  };
}

function buildEmailAttemptId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildEmailAttemptContext() {
  return {
    requestId: buildEmailAttemptId('email'),
    loginSessionId: buildEmailAttemptId('ls'),
    authAttemptId: buildEmailAttemptId('attempt'),
  };
}

function buildAppMode() {
  if (typeof window === 'undefined') return 'browser';
  if (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true) return 'pwa';
  if (window.Telegram?.WebApp) return 'telegram';
  if (/VKAndroidApp|VKiOSApp/.test(navigator.userAgent || '')) return 'vk';
  return 'browser';
}

function mapEmailFailureCategory(code) {
  if (code === 'EMAIL_CODE_INVALID') return 'OTP_INVALID';
  if (code === 'EMAIL_CODE_EXPIRED') return 'OTP_EXPIRED';
  if (code === 'EMAIL_SEND_FAILED') return 'NETWORK_INTERRUPTED';
  if (code === 'EMAIL_HTTP_FAILED') return 'NETWORK_INTERRUPTED';
  if (code === 'EMAIL_BAD_JSON') return 'NETWORK_INTERRUPTED';
  if (code === 'NETWORK_ERROR') return 'NETWORK_INTERRUPTED';
  return 'UNKNOWN_INCOMPLETE';
}

function sendEmailAuthAudit(event) {
  if (!event?.authAttemptId || !event?.stage) return;
  const payloadObj = event.payload || {};
  const durationMs = payloadObj.durationMs != null ? Number(payloadObj.durationMs) : null;
  const payload = {
    ...buildEmailAttemptPayload(event),
    provider: 'email',
    stage: safeString(event.stage, 120),
    status: safeString(event.status, 40) || 'OK',
    frontendVersion: buildFrontendEmailVersion(),
    appMode: buildAppMode(),
    platform: navigator?.userAgent || '',
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    publicErrorCode: safeString(payloadObj.publicErrorCode, 80),
    internalErrorCode: safeString(payloadObj.internalErrorCode, 80),
  };
  const safePayload = {
    ...sanitizeEmailAuthAuditPayload(payloadObj),
  };
  void fetch(EMAIL_AUDIT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      ...safePayload,
    }),
  }).catch(() => {});
}

export function EmailAuth({ onCancel, onSuccess }) {
  const [email, setEmail]   = useState('');
  const [code, setCode]     = useState('');
  const [step, setStep]     = useState('email');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptContext, setAttemptContext] = useState(buildEmailAttemptContext());

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
    const newAttempt = buildEmailAttemptContext();
    setAttemptContext(newAttempt);
    const activeAttempt = newAttempt;
    const startedAt = Date.now();
    setLoading(true);
    setError('');
    sendEmailAuthAudit({
      ...buildEmailAttemptPayload(activeAttempt),
      stage: 'email_auth_started',
      status: 'START',
      payload: { action: 'send' },
    });
    sendEmailAuthAudit({
      ...buildEmailAttemptPayload(activeAttempt),
      stage: 'otp_send_started',
      status: 'START',
      payload: { action: 'send' },
    });
    recordEmailLoginStage('ui_start', {
      ...buildEmailAttemptPayload(activeAttempt),
      emailDomain: normalizedEmail.split('@')[1] || '',
      valid: isValid,
      action: 'send',
    });
    try {
      const url = `${API_BASE_URL}/api/email-auth`;
      recordEmailLoginStage('http_start', {
        ...buildEmailAttemptPayload(activeAttempt),
        url,
        method: 'POST',
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: normalizedEmail, ...newAttempt }),
      });
      const data = await parseEmailResponse(res);
      const responseRequestId = data?.diagnostics?.requestId || newAttempt.requestId;
      const responseLoginSessionId = data?.diagnostics?.loginSessionId || newAttempt.loginSessionId;
      const responseAttempt = {
        requestId: responseRequestId,
        authAttemptId: newAttempt.authAttemptId,
        loginSessionId: responseLoginSessionId,
      };
      recordEmailLoginStage('http_end', {
        ...responseAttempt,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startedAt,
        error: data.error || null,
        failedStage: data.diagnostics?.failedStage || null,
        requestIdBackend: responseRequestId || null,
      });
      if (!res.ok || !data.ok) {
        sendEmailAuthAudit({
          ...responseAttempt,
          stage: 'otp_send_failed',
          status: 'FAILED',
          payload: {
            publicErrorCode: data?.error || 'EMAIL_SEND_FAILED',
            internalErrorCode: data?.diagnostics?.error || data?.error || 'EMAIL_SEND_FAILED',
            durationMs: Date.now() - startedAt,
            failedStage: data?.diagnostics?.failedStage || null,
          },
        });
        sendEmailAuthAudit({
          ...responseAttempt,
          stage: 'attempt_completed',
          status: 'FAILED',
          payload: {
            durationMs: Date.now() - startedAt,
            publicErrorCode: data?.error || 'EMAIL_SEND_FAILED',
            internalErrorCode: data?.diagnostics?.error || data?.error || 'EMAIL_SEND_FAILED',
            finalResult: 'BACKEND_AUTH_FAILED',
            failureCategory: mapEmailFailureCategory(data?.error),
            failedStage: 'otp_send',
            requestIdBackend: data?.diagnostics?.requestId || null,
          },
        });
        recordEmailLoginStage('failed', {
          ...responseAttempt,
          code: data.error || 'EMAIL_SEND_FAILED',
          failedStage: data.diagnostics?.failedStage || 'send_code',
          status: res.status,
          durationMs: Date.now() - startedAt,
        });
        setError(data.message || 'Не удалось отправить код. Попробуйте снова.');
        return;
      }
      recordEmailLoginStage('email_code_sent', { ...responseAttempt, durationMs: Date.now() - startedAt });
      sendEmailAuthAudit({
        ...responseAttempt,
        stage: 'otp_send_succeeded',
        status: 'OK',
        payload: {
          durationMs: Date.now() - startedAt,
          requestIdBackend: data?.diagnostics?.requestId || null,
          identityResolved: data?.diagnostics?.identityResolved || false,
          customTokenIssued: data?.diagnostics?.customTokenIssued || false,
          identityPath: data?.diagnostics?.identityPath || 'identity_v2',
          backendRevision: data?.diagnostics?.backendRevision || null,
        },
      });
      setStep('code');
    } catch (e) {
      logError(e, 'EmailAuth.handleSendCode');
      recordEmailLoginStage('network_error', {
        ...buildEmailAttemptPayload(attemptContext),
        code: e?.code || 'NETWORK_ERROR',
        message: e?.message || String(e),
        durationMs: Date.now() - startedAt,
      });
      setError('Ошибка сети. Попробуйте снова.');
      sendEmailAuthAudit({
        ...buildEmailAttemptPayload(attemptContext),
        stage: 'attempt_completed',
        status: 'FAILED',
        payload: {
          durationMs: Date.now() - startedAt,
          publicErrorCode: e?.code || 'NETWORK_ERROR',
          internalErrorCode: e?.code || 'NETWORK_ERROR',
          finalResult: 'CLIENT_AUTH_FAILED',
          failureCategory: mapEmailFailureCategory(e?.code || 'NETWORK_ERROR'),
          failedStage: 'otp_send',
        },
      });
    } finally {
      recordEmailLoginStage('ui_end', {
        ...buildEmailAttemptPayload(newAttempt),
        durationMs: Date.now() - startedAt,
      });
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isValid || !codeValid || loading) return;
    const activeAttempt = attemptContext?.authAttemptId ? attemptContext : buildEmailAttemptContext();
    if (!attemptContext?.authAttemptId) {
      setAttemptContext(activeAttempt);
    }
    const startedAt = Date.now();
    setLoading(true);
    setError('');
    sendEmailAuthAudit({
      ...buildEmailAttemptPayload(activeAttempt),
      stage: 'email_auth_started',
      status: 'START',
      payload: { action: 'verify' },
    });
    sendEmailAuthAudit({
      ...buildEmailAttemptPayload(activeAttempt),
      stage: 'otp_verify_started',
      status: 'START',
      payload: { action: 'verify' },
    });
    recordEmailLoginStage('ui_start', { requestId: activeAttempt.requestId, authAttemptId: activeAttempt.authAttemptId, loginSessionId: activeAttempt.loginSessionId, emailDomain: normalizedEmail.split('@')[1] || '', valid: isValid, action: 'verify' });
    const referralPayload = await buildReferralPayload(activeAttempt.requestId);
    try {
      const url = `${API_BASE_URL}/api/email-auth`;
      recordEmailLoginStage('http_start', {
        ...buildEmailAttemptPayload(activeAttempt),
        url,
        method: 'POST',
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: normalizedEmail,
          code: code.trim(),
          ...activeAttempt,
          ...referralPayload,
        }),
      });
      const data = await parseEmailResponse(res);
      const responseRequestId = data?.diagnostics?.requestId || activeAttempt.requestId;
      const responseLoginSessionId = data?.diagnostics?.loginSessionId || activeAttempt.loginSessionId;
      const responseAttempt = {
        requestId: responseRequestId,
        authAttemptId: activeAttempt.authAttemptId,
        loginSessionId: responseLoginSessionId,
      };
      recordEmailLoginStage('http_end', {
        ...responseAttempt,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startedAt,
        error: data.error || null,
        failedStage: data.diagnostics?.failedStage || null,
        requestIdBackend: responseRequestId || null,
      });
      if (!res.ok || !data.ok) {
        sendEmailAuthAudit({
          ...responseAttempt,
          stage: 'otp_verify_failed',
          status: 'FAILED',
          payload: {
            publicErrorCode: data?.error || 'EMAIL_HTTP_FAILED',
            internalErrorCode: data?.diagnostics?.error || data?.error || 'EMAIL_HTTP_FAILED',
            durationMs: Date.now() - startedAt,
            failedStage: data?.diagnostics?.failedStage || 'verify_response',
            requestIdBackend: data?.diagnostics?.requestId || null,
          },
        });
        sendEmailAuthAudit({
          ...responseAttempt,
          stage: 'attempt_completed',
          status: 'FAILED',
          payload: {
            publicErrorCode: data?.error || 'EMAIL_HTTP_FAILED',
            internalErrorCode: data?.diagnostics?.error || data?.error || 'EMAIL_HTTP_FAILED',
            durationMs: Date.now() - startedAt,
            finalResult: 'BACKEND_AUTH_FAILED',
            failureCategory: mapEmailFailureCategory(data?.error),
            failedStage: data?.diagnostics?.failedStage || 'verify_response',
            requestIdBackend: data?.diagnostics?.requestId || null,
          },
        });
        sendEmailAuthAudit({
          ...responseAttempt,
          stage: 'frontend_token_received',
          status: 'FAILED',
          payload: {
            publicErrorCode: data?.error || 'EMAIL_HTTP_FAILED',
            durationMs: Date.now() - startedAt,
            failedStage: data?.diagnostics?.failedStage || 'verify_response',
          },
        });
        refLog('auth error', { provider: 'email', reason: data.error || data.message || 'unknown', hasReferral: !!referralPayload.ref });
        recordEmailLoginStage('failed', {
          ...responseAttempt,
          code: data.error || 'EMAIL_HTTP_FAILED',
          failedStage: data.diagnostics?.failedStage || 'http_response',
          status: res.status,
          durationMs: Date.now() - startedAt,
        });
        setError(data.message || 'Ошибка входа. Попробуйте снова.');
      } else {
        sendEmailAuthAudit({
          ...responseAttempt,
          stage: 'otp_verify_succeeded',
          status: 'OK',
          payload: {
            durationMs: Date.now() - startedAt,
            requestIdBackend: data?.diagnostics?.requestId || null,
            identityPath: data?.diagnostics?.identityPath || 'identity_v2',
            identityResolved: data?.diagnostics?.identityResolved,
            customTokenIssued: data?.diagnostics?.customTokenIssued,
          },
        });
        sendEmailAuthAudit({
          ...responseAttempt,
          stage: 'frontend_token_received',
          status: 'OK',
          payload: {
            durationMs: Date.now() - startedAt,
            publicErrorCode: null,
            requestIdBackend: data?.diagnostics?.requestId || null,
            identityPath: data?.diagnostics?.identityPath || 'identity_v2',
            identityResolved: data?.diagnostics?.identityResolved,
            customTokenIssued: data?.diagnostics?.customTokenIssued,
          },
        });
        refLog('auth success', { provider: 'email', userId: data.user?.id || data.canonicalUserId || null, hasReferral: !!referralPayload.ref });
        recordEmailLoginStage('backend_success', {
          ...responseAttempt,
          userId: data.user?.id || data.canonicalUserId || null,
          durationMs: Date.now() - startedAt,
        });
        if (onSuccess) {
          onSuccess(data.user, {
            ...data,
            ...responseAttempt,
            ref: referralPayload.ref,
            referrerId: referralPayload.ref,
            referralSessionId: referralPayload.referralSessionId,
            referralFlowId: referralPayload.referralFlowId,
            referralSessionIdLocal: referralPayload.referralSessionIdLocal,
            referralDeviceId: referralPayload.referralDeviceId,
            referralPlatform: referralPayload.referralPlatform,
            identityPath: data?.diagnostics?.identityPath || 'identity_v2',
            identityResolved: data?.diagnostics?.identityResolved === true,
            customTokenIssued: data?.diagnostics?.customTokenIssued === true,
            backendRevision: data?.diagnostics?.backendRevision || null,
            loginSessionId: responseAttempt.loginSessionId,
            requestId: responseAttempt.requestId,
          });
        } else {
          localStorage.setItem('apg_email_user', JSON.stringify(data.user));
          window.location.reload();
        }
      }
    } catch (e) {
      logError(e, 'EmailAuth.handleLogin');
      recordEmailLoginStage('network_error', {
        ...buildEmailAttemptPayload(activeAttempt),
        code: e?.code || 'NETWORK_ERROR',
        message: e?.message || String(e),
        durationMs: Date.now() - startedAt,
      });
      setError('Ошибка сети. Попробуйте снова.');
      sendEmailAuthAudit({
        ...buildEmailAttemptPayload(activeAttempt),
        stage: 'attempt_completed',
        status: 'FAILED',
        payload: {
          publicErrorCode: e?.code || 'NETWORK_ERROR',
          internalErrorCode: e?.code || 'NETWORK_ERROR',
          durationMs: Date.now() - startedAt,
          finalResult: 'CLIENT_AUTH_FAILED',
          failureCategory: mapEmailFailureCategory(e?.code || 'NETWORK_ERROR'),
          failedStage: 'verify_request',
        },
      });
    } finally {
      recordEmailLoginStage('ui_end', {
        ...buildEmailAttemptPayload(activeAttempt),
        durationMs: Date.now() - startedAt,
      });
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
