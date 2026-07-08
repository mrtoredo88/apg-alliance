import React, { useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard } from './components/Apg2ProfileGlass.jsx';

export const CONSENT_DOCS_VERSION = '2026-07-06';
export const LEGAL_VERSION = 1;
export const CONSENT_DOCS = {
  userAgreementUrl: '/user-agreement.html',
  privacyPolicyUrl: '/privacy-policy.html',
};

function ConsentCheckbox({ checked, onChange, required = false, children }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '28px 1fr',
        gap: 12,
        alignItems: 'flex-start',
        padding: 13,
        borderRadius: 22,
        border: checked ? '1px solid rgba(215,184,106,0.46)' : APG2_PROFILE.glass.border,
        background: checked
          ? 'linear-gradient(145deg,rgba(215,184,106,0.15),rgba(var(--apg2-glass-a,255,255,255),0.07))'
          : 'rgba(var(--apg2-glass-a,255,255,255),0.075)',
        color: APG2_PROFILE.textSoft,
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        boxSizing: 'border-box',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 180ms ease, background 180ms ease, transform 180ms ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: 10,
          boxSizing: 'border-box',
          border: checked ? '1px solid rgba(255,240,184,0.58)' : '1px solid var(--apg2-glass-border, rgba(255,255,255,0.18))',
          background: checked ? APG2_PROFILE.goldGlass.background : 'rgba(var(--apg2-glass-a,255,255,255),0.06)',
          boxShadow: checked ? '0 10px 24px rgba(215,184,106,0.18), inset 0 1px 0 rgba(255,255,255,0.34)' : 'inset 0 1px 0 rgba(255,255,255,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked && <span style={{ color: '#17120a', fontSize: 16, fontWeight: 950, lineHeight: 1 }}>✓</span>}
      </span>
      <span style={{ minWidth: 0, fontSize: 13.5, lineHeight: '20px', fontWeight: 600 }}>
        {children}
        {required && <span style={{ color: APG2_PROFILE.gold }}> *</span>}
      </span>
    </div>
  );
}

function DocLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{
        color: APG2_PROFILE.gold,
        textDecoration: 'none',
        borderBottom: '1px solid rgba(215,184,106,0.34)',
        fontWeight: 820,
      }}
    >
      {children}
    </a>
  );
}

export function ConsentScreen({
  user,
  onAccept,
  onCancel,
  loading = false,
  title = 'Добро пожаловать в обновлённый АПГ!',
  subtitle = 'Перед продолжением использования приложения подтвердите необходимые согласия.',
  badge = 'Обновление документов',
  notificationsDefault = true,
  error = '',
}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [notificationsAccepted, setNotificationsAccepted] = useState(notificationsDefault);
  const canContinue = termsAccepted && privacyAccepted && !loading;
  const firstName = user?.first_name || user?.firstName || user?.name?.split(' ')?.[0] || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Согласия АПГ"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 13000,
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(18px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        overflowY: 'auto',
        background: APG2_PROFILE.bg,
        color: APG2_PROFILE.text,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 50% -8%,rgba(215,184,106,0.19),transparent 34%), radial-gradient(circle at 92% 22%,rgba(73,61,118,0.13),transparent 32%)' }} />
      <GlassCard style={{ width: '100%', maxWidth: 430, borderRadius: 38, padding: 20, position: 'relative', zIndex: 1, animation: 'fadeInUp 240ms ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 58, height: 58, borderRadius: 24, background: APG2_PROFILE.goldGlass.background, border: '1px solid rgba(255,232,165,0.46)', boxShadow: '0 18px 42px rgba(215,184,106,0.16), inset 0 1px 0 rgba(255,255,255,0.36)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#17120a', fontSize: 25, fontWeight: 950, flexShrink: 0 }}>
            А
          </div>
          <div style={{ minWidth: 0 }}>
            <GlassBadge tone="gold" style={{ marginBottom: 8 }}>{badge}</GlassBadge>
            <div style={{ color: APG2_PROFILE.text, fontSize: 25, lineHeight: '30px', fontWeight: 900 }}>
              {title}
            </div>
          </div>
        </div>

        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', marginBottom: 18 }}>
          {firstName ? `${firstName}, ${subtitle.charAt(0).toLowerCase()}${subtitle.slice(1)}` : subtitle}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ConsentCheckbox checked={termsAccepted} onChange={setTermsAccepted} required>
            Я принимаю <DocLink href={CONSENT_DOCS.userAgreementUrl}>Пользовательское соглашение</DocLink>.
          </ConsentCheckbox>

          <ConsentCheckbox checked={privacyAccepted} onChange={setPrivacyAccepted} required>
            Я ознакомился(ась) с <DocLink href={CONSENT_DOCS.privacyPolicyUrl}>Политикой обработки персональных данных</DocLink> и даю согласие на обработку моих персональных данных.
          </ConsentCheckbox>

          <ConsentCheckbox checked={notificationsAccepted} onChange={setNotificationsAccepted}>
            Хочу получать уведомления о:
            <span style={{ display: 'block', marginTop: 7, color: APG2_PROFILE.textMuted, fontWeight: 560 }}>
              новых мероприятиях; городских новостях; розыгрышах; специальных предложениях партнёров.
            </span>
          </ConsentCheckbox>
        </div>

        <div style={{ marginTop: 14, color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '18px' }}>
          Обязательные согласия отмечены звёздочкой. Уведомления можно включить сейчас или позже в профиле.
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '11px 12px',
              borderRadius: 18,
              border: '1px solid rgba(230,70,70,0.28)',
              background: 'rgba(230,70,70,0.10)',
              color: APG2_PROFILE.text,
              fontSize: 13,
              lineHeight: '19px',
              fontWeight: 650,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          <GlassButton
            onClick={() => canContinue && onAccept?.({ termsAccepted, privacyAccepted, notificationsAccepted })}
            disabled={!canContinue}
            tone="gold"
            style={{ width: '100%', minHeight: 54, color: '#17120a', fontSize: 15, fontWeight: 880 }}
          >
            {loading ? 'Сохраняем...' : 'Продолжить'}
          </GlassButton>
          {onCancel && (
            <GlassButton onClick={onCancel} disabled={loading} style={{ width: '100%', minHeight: 46, color: APG2_PROFILE.textSoft }}>
              {error ? 'Выйти и войти заново' : 'Вернуться назад'}
            </GlassButton>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
