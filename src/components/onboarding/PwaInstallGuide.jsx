import React, { useEffect, useMemo, useState } from 'react';
import { APG2_PROFILE, GlassButton, GlassCard } from '../Apg2ProfileGlass.jsx';
import { isNativeApp } from '../../platform/runtime.js';
import { ANDROID_DOWNLOAD_URL } from '../../constants.js';

export const PWA_INSTALL_GUIDE_HIDDEN_KEY = 'apg_mobile_pwa_onboarding_hidden';
export const PWA_INSTALL_GUIDE_SESSION_KEY = 'apg_mobile_pwa_onboarding_session_closed';
export const PWA_EMAIL_HINT_HIDDEN_KEY = 'apg_pwa_email_hint_done';

function getPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

function isMobileViewport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.matchMedia?.('(pointer: coarse)')?.matches;
}

function safeGet(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {}
}

export function shouldShowPwaInstallGuide({ user, isVk = false } = {}) {
  if (typeof window === 'undefined') return false;
  if (isNativeApp() || isVk || !isMobileViewport() || isStandaloneMode()) return false;
  if (safeGet(localStorage, PWA_INSTALL_GUIDE_HIDDEN_KEY) === '1') return false;
  if (safeGet(sessionStorage, PWA_INSTALL_GUIDE_SESSION_KEY) === '1') return false;
  const userId = String(user?.id || '');
  return !userId || userId.startsWith('guest_');
}

export function shouldShowPwaEmailHint({ user, isVk = false } = {}) {
  if (typeof window === 'undefined') return false;
  if (isNativeApp() || isVk || !isMobileViewport() || !isStandaloneMode()) return false;
  if (safeGet(localStorage, PWA_EMAIL_HINT_HIDDEN_KEY) === '1') return false;
  const userId = String(user?.id || '');
  return !userId || userId.startsWith('guest_');
}

function PhoneIllustration({ mode = 'browser' }) {
  return (
    <div style={{ position: 'relative', width: 146, height: 188, margin: '0 auto' }} aria-hidden="true">
      <div style={{ position: 'absolute', inset: 8, borderRadius: 38, background: 'radial-gradient(circle at 30% 12%, rgba(255,240,184,0.34), transparent 34%), linear-gradient(160deg, rgba(28,28,34,0.94), rgba(15,15,18,0.98))', border: '1px solid rgba(255,255,255,0.22)', boxShadow: '0 26px 70px rgba(0,0,0,0.42), 0 0 0 8px rgba(255,255,255,0.035)' }} />
      <div style={{ position: 'absolute', left: 34, right: 34, top: 18, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.22)' }} />
      <div style={{ position: 'absolute', left: 25, right: 25, top: 40, bottom: 28, borderRadius: 24, background: 'linear-gradient(180deg, rgba(247,241,230,0.12), rgba(247,241,230,0.04))', border: '1px solid rgba(255,255,255,0.13)', padding: 12, boxSizing: 'border-box', display: 'grid', alignContent: 'center', gap: 8 }}>
        <span style={{ width: 54, height: 54, borderRadius: 20, margin: '0 auto', display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldGradient, color: '#17120a', fontSize: 25, fontWeight: 900, boxShadow: '0 12px 30px rgba(215,184,106,0.22)' }}>{mode === 'email' ? '✉️' : 'АПГ'}</span>
        <span style={{ height: 8, width: '82%', borderRadius: 999, background: 'rgba(255,255,255,0.18)', margin: '0 auto' }} />
        <span style={{ height: 8, width: '58%', borderRadius: 999, background: 'rgba(215,184,106,0.26)', margin: '0 auto' }} />
      </div>
      <div style={{ position: 'absolute', left: 61, right: 61, bottom: 17, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }} />
    </div>
  );
}

function Step({ icon, title, text }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '38px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
      <span style={{ width: 38, height: 38, borderRadius: 15, display: 'grid', placeItems: 'center', background: 'rgba(215,184,106,0.16)', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.24)', fontSize: 18 }}>{icon}</span>
      <span style={{ display: 'grid', gap: 3 }}>
        <strong style={{ color: APG2_PROFILE.text, fontSize: 13.5, lineHeight: '17px', fontWeight: 860 }}>{title}</strong>
        <span style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px', fontWeight: 620 }}>{text}</span>
      </span>
    </div>
  );
}

export function PwaInstallGuide({ open, onClose }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [iosInstructions, setIosInstructions] = useState(false);
  const [neverShow, setNeverShow] = useState(false);
  const platform = useMemo(getPlatform, []);
  const canUseInstallPrompt = platform === 'android' && installPrompt;

  useEffect(() => {
    if (isNativeApp()) return undefined;
    const handleBeforeInstallPrompt = event => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (!open) return null;

  const close = ({ remember = false } = {}) => {
    safeSet(sessionStorage, PWA_INSTALL_GUIDE_SESSION_KEY, '1');
    if (remember || neverShow) safeSet(localStorage, PWA_INSTALL_GUIDE_HIDDEN_KEY, '1');
    onClose?.();
  };

  const startInstall = async () => {
    if (canUseInstallPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      setInstallPrompt(null);
      close({ remember: neverShow });
      return;
    }
    setIosInstructions(true);
  };

  return (
    <div data-pwa-install-guide style={{ position: 'fixed', inset: 0, zIndex: 12500, background: 'rgba(10,10,14,0.78)', backdropFilter: 'blur(18px) saturate(1.4)', WebkitBackdropFilter: 'blur(18px) saturate(1.4)', color: APG2_PROFILE.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 14px calc(16px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', overflowY: 'auto', animation: 'fadeIn 180ms ease both' }}>
      <GlassCard interactiveAs="div" style={{ width: '100%', maxWidth: 430, borderRadius: 34, padding: 18, boxShadow: '0 32px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.28)', animation: 'fadeInUp 260ms cubic-bezier(0.22,1,0.36,1) both' }}>
        <div style={{ display: 'grid', gap: 15 }}>
          <PhoneIllustration />
          <div style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
            <h2 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 27, lineHeight: '31px', fontWeight: 920, letterSpacing: 0 }}>Добро пожаловать в АПГ! 👋</h2>
            <p style={{ margin: 0, color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', fontWeight: 640 }}>
              Для лучшей работы установите АПГ как приложение на свой телефон. Это займёт меньше минуты и позволит быстрее открывать сервис, получать обновления и пользоваться всеми возможностями.
            </p>
          </div>

          {iosInstructions ? (
            <div style={{ display: 'grid', gap: 10, borderRadius: 24, padding: 14, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)' }}>
              <Step icon="↗" title="Нажмите «Поделиться»" text="Кнопка находится в нижней панели Safari." />
              <Step icon="＋" title="Выберите «На экран Домой»" text="Safari добавит АПГ как обычное приложение." />
              <Step icon="✓" title="Нажмите «Добавить»" text="После этого откройте АПГ с иконки на рабочем столе." />
            </div>
          ) : (
            <div style={{ borderRadius: 24, padding: 14, background: 'linear-gradient(145deg, rgba(215,184,106,0.18), rgba(255,255,255,0.065))', border: '1px solid rgba(215,184,106,0.30)', display: 'grid', gap: 7 }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.6 }}>После установки</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontWeight: 860 }}>Войдите по электронной почте.</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', fontWeight: 620 }}>Именно через неё сохраняются ваши записи, бонусы, друзья, сообщения и история использования.</div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {platform === 'android' && (
              <GlassButton
                data-android-download-cta
                tone={ANDROID_DOWNLOAD_URL ? 'gold' : undefined}
                disabled={!ANDROID_DOWNLOAD_URL}
                onClick={() => { if (ANDROID_DOWNLOAD_URL) window.location.assign(ANDROID_DOWNLOAD_URL); }}
                style={{ minHeight: 54, borderRadius: 22, color: ANDROID_DOWNLOAD_URL ? '#17120a' : APG2_PROFILE.textMuted, fontSize: 15.5, fontWeight: 880 }}
              >
                🤖 {ANDROID_DOWNLOAD_URL ? 'Скачать АПГ для Android' : 'Android-приложение — скоро'}
              </GlassButton>
            )}
            <GlassButton tone="gold" onClick={startInstall} style={{ minHeight: 54, borderRadius: 22, color: '#17120a', fontSize: 15.5, fontWeight: 880 }}>
              📲 {canUseInstallPrompt ? 'Установить приложение' : platform === 'ios' ? 'Показать инструкцию установки' : 'Как установить приложение'}
            </GlassButton>
            <GlassButton onClick={() => close()} style={{ minHeight: 50, borderRadius: 20, color: APG2_PROFILE.textSoft }}>
              Продолжить в браузере
            </GlassButton>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '17px', fontWeight: 680 }}>
              <input type="checkbox" checked={neverShow} onChange={event => setNeverShow(event.target.checked)} style={{ width: 17, height: 17, accentColor: '#D7B86A' }} />
              Больше не показывать
            </label>
          </div>

          <button type="button" onClick={() => close({ remember: neverShow })} aria-label="Закрыть onboarding" style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: APG2_PROFILE.textSoft, fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>×</button>
        </div>
      </GlassCard>
    </div>
  );
}

export function PwaEmailLoginHint({ open, onClose, onEmailLogin }) {
  if (!open) return null;
  const close = () => {
    safeSet(localStorage, PWA_EMAIL_HINT_HIDDEN_KEY, '1');
    onClose?.();
  };
  return (
    <div data-pwa-email-hint style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(94px + env(safe-area-inset-bottom, 0px))', zIndex: 4300, pointerEvents: 'none' }}>
      <GlassCard interactiveAs="div" style={{ maxWidth: 520, margin: '0 auto', borderRadius: 26, padding: 14, pointerEvents: 'auto', border: '1px solid rgba(215,184,106,0.28)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) auto', gap: 11, alignItems: 'center' }}>
          <span style={{ width: 46, height: 46, borderRadius: 18, display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, fontSize: 21 }}>✉️</span>
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', color: APG2_PROFILE.text, fontSize: 14.5, lineHeight: '18px', fontWeight: 880 }}>Остался последний шаг</strong>
            <span style={{ display: 'block', color: APG2_PROFILE.textSoft, fontSize: 12.4, lineHeight: '17px', marginTop: 3 }}>Войдите по электронной почте, чтобы сохранить профиль, друзей, бонусы, сообщения и записи.</span>
          </span>
          <button type="button" onClick={close} aria-label="Скрыть подсказку" style={{ width: 28, height: 28, borderRadius: 14, border: 0, background: 'transparent', color: APG2_PROFILE.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <GlassButton tone="gold" onClick={onEmailLogin} style={{ width: '100%', minHeight: 42, borderRadius: 17, marginTop: 11, color: '#17120a' }}>Войти по электронной почте</GlassButton>
      </GlassCard>
    </div>
  );
}
