import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './constants.js';
import { apgIdentity } from './apg/index.js';
import { ensureServerReferralSession, getReferralContext, readPendingReferral } from './referralDiagnostics.js';
import { openUrl } from './vk.js';

const makeId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;

export function TelegramAuth({ onSuccess }) {
  const [step, setStep] = useState('idle');
  const [error, setError] = useState('');
  const [botUrl, setBotUrl] = useState('');
  const timerRef = useRef(null);
  const controllerRef = useRef(null);
  const activeStateRef = useRef('');

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    controllerRef.current?.abort?.();
    timerRef.current = null;
    controllerRef.current = null;
    activeStateRef.current = '';
  }, []);

  useEffect(() => stop, [stop]);

  const poll = useCallback(async (state, trace) => {
    if (!state || activeStateRef.current !== state) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const checkUrl = new URL(`${API_BASE_URL}/api/telegram-auth-check`);
      checkUrl.searchParams.set('state', state);
      checkUrl.searchParams.set('requestId', trace.requestId);
      checkUrl.searchParams.set('loginSessionId', trace.loginSessionId);
      checkUrl.searchParams.set('telegramSessionId', trace.telegramSessionId);
      const response = await fetch(checkUrl.toString(), {
        headers: { 'X-APG-Version': 'telegram-auth-login-screen' },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (activeStateRef.current !== state) return;
      if (data.status === 'done') {
        if (!data.token || !data.user?.id) throw new Error('telegram_auth_incomplete');
        await apgIdentity.authenticate({
          provider: 'native-apg',
          token: data.token,
          uid: data.user.id,
          email: data.user.email || '',
        });
        await apgIdentity.waitForIdentity(data.user.id, 8000);
        localStorage.setItem('apg_tg_user', JSON.stringify(data.user));
        localStorage.removeItem('apg_tg_pending');
        stop();
        setStep('done');
        onSuccess?.(data.user);
        return;
      }
      if (['failed', 'expired', 'not_found', 'cancelled'].includes(data.status)) {
        localStorage.removeItem('apg_tg_pending');
        stop();
        setStep('idle');
        setError(data.status === 'cancelled' ? 'Вход отменён. Попробуйте ещё раз.' : 'Ссылка устарела. Создайте новую.');
        return;
      }
      timerRef.current = setTimeout(() => poll(state, trace), 900);
    } catch (pollError) {
      if (pollError?.name === 'AbortError' || activeStateRef.current !== state) return;
      timerRef.current = setTimeout(() => poll(state, trace), 1800);
    }
  }, [onSuccess, stop]);

  const start = useCallback(async () => {
    if (step === 'starting') return;
    stop();
    setError('');
    setStep('starting');
    const requestId = makeId('tg_req');
    const loginSessionId = makeId('tg_sess');
    try {
      const ref = readPendingReferral({ source: 'TelegramAuth.login' }) || '';
      const serverSession = await (globalThis.__APG_REFERRAL_SESSION_PROMISE__
        || ensureServerReferralSession({ apiBaseUrl: API_BASE_URL, ref, source: 'telegram_login_screen' })).catch(() => null);
      const referral = getReferralContext({ ref, source: 'TelegramAuth.login' });
      const response = await fetch(`${API_BASE_URL}/api/telegram-auth-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APG-Version': 'telegram-auth-login-screen' },
        body: JSON.stringify({
          source: 'login_screen',
          linking: false,
          requestId,
          loginSessionId,
          ref: ref || undefined,
          referralSessionId: serverSession?.referralSessionId || referral.referralSessionId || referral.sessionId,
          referralFlowId: referral.referralFlowId,
          referralDeviceId: referral.deviceId,
          referralPlatform: referral.platform,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.state || !data.url) throw new Error(data.message || 'telegram_start_failed');
      const trace = {
        requestId: data.requestId || requestId,
        loginSessionId: data.loginSessionId || loginSessionId,
        telegramSessionId: data.telegramSessionId || data.state,
      };
      activeStateRef.current = data.state;
      setBotUrl(data.url);
      setStep('waiting');
      localStorage.setItem('apg_tg_pending', JSON.stringify({ state: data.state, url: data.url, linking: false, at: Date.now(), ...trace }));
      poll(data.state, trace);
      openUrl(data.url);
    } catch (startError) {
      setStep('idle');
      setError('Не удалось открыть Telegram. Проверьте интернет и попробуйте снова.');
    }
  }, [poll, step, stop]);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <button
        type="button"
        onClick={step === 'waiting' && botUrl ? () => openUrl(botUrl) : start}
        disabled={step === 'starting' || step === 'done'}
        style={{
          width: '100%', minHeight: 48, borderRadius: 16, border: '1px solid rgba(38,168,234,0.42)',
          background: 'rgba(38,168,234,0.12)', color: '#229ED9', fontSize: 15, fontWeight: 800,
          cursor: step === 'starting' ? 'wait' : 'pointer',
        }}
      >
        {step === 'starting' ? 'Создаём ссылку…' : step === 'waiting' ? 'Открыть Telegram ещё раз' : step === 'done' ? 'Вход выполнен' : 'Войти через Telegram'}
      </button>
      {step === 'waiting' && <div role="status" style={{ fontSize: 13, lineHeight: '18px', color: 'rgba(255,255,255,0.66)' }}>Подтвердите вход в боте — после этого приложение откроется автоматически.</div>}
      {error && <div role="alert" style={{ fontSize: 13, lineHeight: '18px', color: '#ff8d8d' }}>{error}</div>}
    </div>
  );
}
