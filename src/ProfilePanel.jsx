import React, { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { EmailAuth } from './EmailAuth.jsx';
import { Avatar } from '@vkontakte/vkui';
import vkBridge, { isVK, vkWebLogin, openUrl } from './vk.js';
import { QRCodeSVG } from 'qrcode.react';
import { onAuthStateChanged } from 'firebase/auth';
import { LEVELS, getLevel, getNextLevel, getLevelProgress, getKeysToNext } from './levels.js';
import { collection, onSnapshot } from 'firebase/firestore';

import { APP_URL, API_BASE_URL } from './constants.js';
import { auth, db } from './firebase.js';
import { apgIdentity } from './apg/index.js';
import { logError } from './errorLogger.js';
import { userAction } from './userApi.js';
import { APG2_PROFILE as APG2, ApgModal, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel, GlassSection } from './components/Apg2ProfileGlass.jsx';
import { DesktopTopOverview } from './components/DesktopUI.jsx';
import { formatNewsDate, getNewsLegacyIds, getNewsTitle } from './newsUtils.js';
import { buildCabinetDiagnostics } from './utils/profileOwnership.js';
import { CAPABILITIES, hasCapability } from './roleEngine.js';
import { buildPersonalQrLink, buildReferralInviteText, buildReferralLink } from './referralInvite.js';
import { ensureServerReferralSession, getReferralContext, readPendingReferral } from './referralDiagnostics.js';
import { groupBookingsForProfile, normalizeBooking } from '../server-shared/booking.js';
import { SOCIAL_PRIVACY, normalizeSocialPrivacy } from './messaging/ConversationEligibility.js';
import { buildSocialMessagingDevPanel } from './messaging/SocialMessagingSnapshot.js';
import { PEOPLE_RELATION_STATUS, PEOPLE_TABS, buildPeoplePulse, buildPeopleRows, peopleKind, peoplePresenceLabel, peopleStatusLabel, peopleSuggestionReason, personInterestTags, searchPeopleGroups } from './social/PeopleCore.js';
import { isNativeApp } from './platform/runtime.js';

const AUTH_TRACE_KEY = 'apg_auth_trace';

function traceAuthStage(stage, details = {}) {
  try {
    const entry = {
      at: new Date().toISOString(),
      stage,
      ...Object.fromEntries(
        Object.entries(details).map(([key, value]) => [
          key,
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null
            ? value
            : JSON.stringify(value).slice(0, 240),
        ]),
      ),
    };
    const current = JSON.parse(localStorage.getItem(AUTH_TRACE_KEY) || '[]');
    localStorage.setItem(AUTH_TRACE_KEY, JSON.stringify([...current.slice(-29), entry]));
  } catch {}
}

function safeTraceString(value, max = 220) {
  return String(value ?? '').trim().slice(0, max);
}

function profilePersonId(value = '') {
  if (value && typeof value === 'object') {
    return String(value.id || value.userId || value.contactUserId || value.targetUserId || value.recipientId || value.senderId || '').trim();
  }
  return String(value || '').trim();
}

function createTraceId(prefix = 'tg') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

function EmailVerifyBanner({ userId }) {
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    if (loading || sent) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/email-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend-verification', userId }),
      });
      setSent(true);
    } catch {}
    setLoading(false);
  };

  return (
    <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>📬</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: APG2.gold, fontWeight: 600, lineHeight: '16px' }}>Подтвердите адрес почты</div>
        <div style={{ fontSize: 11, color: APG2.textSoft, lineHeight: '15px' }}>Письмо уже отправлено при входе</div>
      </div>
      <button
        onClick={resend}
        disabled={loading || sent}
        style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 8, border: `1px solid rgba(201,168,76,0.35)`, background: 'none', color: sent ? APG2.textSoft : APG2.gold, fontSize: 11, fontWeight: 700, cursor: sent ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
      >
        {sent ? '✓ Отправлено' : loading ? '...' : 'Отправить ещё раз'}
      </button>
    </div>
  );
}

async function getAuthHeaders() {
  const token = await apgIdentity.getSessionToken?.();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Firebase-Auth': token } : {}),
  };
}

function peopleInitial(name = '') {
  return String(name || 'А').trim().slice(0, 1).toUpperCase() || 'А';
}

function peopleSharedSummary(person = {}) {
  const contacts = person.shared?.contacts?.length || 0;
  const events = person.shared?.events?.length || 0;
  const partners = person.shared?.partners?.length || 0;
  const parts = [];
  if (contacts) parts.push(`${contacts} общих друзей`);
  if (events) parts.push(`${events} мероприятий`);
  if (partners) parts.push(`${partners} партнёров`);
  return parts.join(' · ');
}

function peopleContextLine(person = {}) {
  return [person.company, person.role, person.expert, peoplePresenceLabel(person), person.city].filter(Boolean).slice(0, 2).join(' · ') || 'Участник АПГ';
}

function resolveProfileAvatar(user = {}) {
  const candidates = [
    user.photo_200,
    user.photo,
    user.avatarUrl,
    user.avatar,
    user.photoUrl,
    user.linkedTelegram?.photo,
    user.linkedTelegram?.photoUrl,
    user.linkedTelegram?.photo_200,
  ];
  return candidates
    .map(value => String(value || '').trim())
    .find(value => value && !value.includes('api.telegram.org/file/bot')) || '';
}

function peopleEmptyTitle(tab = 'all', hasSearch = false) {
  if (hasSearch) return 'Никого не нашли';
  if (tab === 'friends') return 'Друзей пока нет';
  if (tab === 'requests') return 'Заявок пока нет';
  if (tab === 'dialogs') return 'Переписок пока нет';
  if (tab === 'recent') return 'Недавних контактов пока нет';
  if (tab === 'online') return 'Сейчас никого онлайн';
  if (tab === 'partners') return 'Партнёров среди людей пока нет';
  if (tab === 'experts') return 'Экспертов среди людей пока нет';
  return 'Люди появятся здесь';
}

function peopleEmptyText(tab = 'all', hasSearch = false) {
  if (hasSearch) return 'Попробуйте имя, компанию, роль, город, email или Telegram. Если человека ещё нет в АПГ — пригласите его через QR.';
  if (tab === 'friends') return 'Откройте рекомендации, познакомьтесь после события или покажите свой QR на встрече.';
  if (tab === 'requests') return 'Когда кто-то захочет познакомиться или вы отправите запрос — заявки появятся здесь.';
  if (tab === 'dialogs') return 'Начните чат из карточки человека, партнёра, эксперта, события или записи.';
  if (tab === 'recent') return 'После диалогов, встреч и новых знакомств здесь появится быстрая история контактов.';
  if (tab === 'online') return 'Онлайн-статусы появятся, когда участники будут активны в АПГ.';
  return 'Используйте поиск, рекомендации и цифровую карточку, чтобы собрать свою сеть АПГ.';
}

function peopleStatusChipStyle(status = '') {
  const gold = status === PEOPLE_RELATION_STATUS.FRIEND;
  const blue = status === PEOPLE_RELATION_STATUS.INCOMING || status === PEOPLE_RELATION_STATUS.OUTGOING;
  return {
    color: gold ? APG2.gold : blue ? '#6AABEC' : APG2.textMuted,
    background: gold ? APG2.goldSoft : blue ? 'rgba(74,144,217,0.12)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
    border: `1px solid ${gold ? 'rgba(201,168,76,0.30)' : blue ? 'rgba(74,144,217,0.28)' : 'rgba(var(--apg2-glass-a,255,255,255),0.10)'}`,
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 10.5,
    lineHeight: '13px',
    fontWeight: 850,
    whiteSpace: 'nowrap',
  };
}

function PeopleAvatar({ person, size = 42, radius = 16, style }) {
  return person?.photo
    ? <img src={person.photo} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, boxShadow: '0 10px 24px rgba(0,0,0,0.18)', ...style }} />
    : <div style={{ width: size, height: size, borderRadius: radius, background: 'radial-gradient(circle at 30% 18%, rgba(255,255,255,0.34), transparent 34%), linear-gradient(145deg, rgba(201,168,76,0.28), rgba(201,168,76,0.10))', color: APG2.gold, display: 'grid', placeItems: 'center', fontWeight: 950, flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 10px 24px rgba(201,168,76,0.12)', ...style }}>{peopleInitial(person?.displayName)}</div>;
}

const ACHIEVEMENTS = [
  { id: 'first_scan',   title: 'Первый шаг',    emoji: '🎯', color: '#4A90D9', cond: (k)       => k >= 1 },
  { id: 'five_keys',    title: 'Коллекционер',  emoji: '🗝️', color: '#C9A84C', cond: (k)       => k >= 5 },
  { id: 'ten_keys',     title: 'Исследователь', emoji: '🔍', color: '#4BB34B', cond: (k)       => k >= 10 },
  { id: 'first_fav',    title: 'Знаток',         emoji: '⭐', color: '#FF8C00', cond: (k, f)    => f.length >= 1 },
  { id: 'five_favs',    title: 'Свой человек',   emoji: '❤️', color: '#E64646', cond: (k, f)    => f.length >= 5 },
  { id: 'referral_bdg', title: 'Магнит',         emoji: '🤝', color: '#4A90D9', cond: (k, f, r) => r >= 1 },
  { id: 'vip',          title: 'VIP',            emoji: '👑', color: '#C9A84C', cond: (k)       => k >= 30 },
  { id: 'fifty_keys',   title: 'Ветеран',        emoji: '🏅', color: '#9B59B6', cond: (k)       => k >= 50 },
  { id: 'legend',       title: 'Легенда',        emoji: '🏆', color: '#FFD700', cond: (k)       => k >= 100 },
];

const AchievementBadge = memo(function AchievementBadge({ a, unlocked }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 76, gap: 6, opacity: unlocked ? 1 : 0.3, filter: unlocked ? 'none' : 'grayscale(1)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: unlocked ? a.color + '20' : 'rgba(255,255,255,0.08)', border: `2px solid ${unlocked ? a.color + '60' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, position: 'relative' }}>
        {a.emoji}
        {unlocked && <div style={{ position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>✓</div>}
      </div>
      <span style={{ fontSize: 10, color: unlocked ? APG2.text : APG2.textSoft, fontWeight: unlocked ? 700 : 400, textAlign: 'center', lineHeight: '13px' }}>{a.title}</span>
    </div>
  );
});

function ThemeToggle({ isDark, onToggle }) {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontSize: 15, color: 'var(--c-text, #F0F0F0)', fontWeight: 600 }}>
          {isDark ? '🌙 Тёмная тема' : '☀️ Светлая тема'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-sec, rgba(240,240,240,0.5))', marginTop: 2 }}>
          {isDark ? 'Звёздное небо · ночной режим' : 'Дневной свет · светлый фон'}
        </div>
      </div>

      {/* Pill toggle */}
      <button
        onClick={onToggle}
        aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
        style={{
          position: 'relative',
          width: 76, height: 36,
          borderRadius: 18,
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          overflow: 'hidden',
          background: isDark
            ? 'linear-gradient(135deg, #0D0D2A 0%, #1C1C50 100%)'
            : 'linear-gradient(135deg, #87CEEB 0%, #FFF5A0 100%)',
          boxShadow: isDark
            ? '0 0 0 1.5px rgba(201,168,76,0.35), 0 4px 18px rgba(0,0,30,0.55)'
            : '0 0 0 1.5px rgba(135,206,235,0.6), 0 4px 18px rgba(255,165,0,0.2)',
          transition: 'background 0.45s ease, box-shadow 0.4s ease',
        }}
      >
        {/* Stars — only visible in dark */}
        {[{ x: 12, y: 9, s: 2.5 }, { x: 22, y: 20, s: 1.5 }, { x: 9, y: 22, s: 1.5 }, { x: 18, y: 10, s: 1 }].map((star, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: star.x, top: star.y,
            width: star.s, height: star.s,
            borderRadius: '50%',
            background: '#E8C97A',
            opacity: isDark ? 0.85 : 0,
            transition: 'opacity 0.35s ease',
          }} />
        ))}

        {/* Sliding thumb */}
        <div style={{
          position: 'absolute',
          top: 4,
          left: isDark ? 4 : 40,
          width: 28, height: 28,
          borderRadius: '50%',
          background: isDark
            ? 'linear-gradient(135deg, #C9A84C, #E8C97A)'
            : 'linear-gradient(145deg, #FFD700, #FF8C00)',
          boxShadow: isDark
            ? '0 2px 10px rgba(201,168,76,0.7), 0 0 0 1px rgba(255,255,255,0.12)'
            : '0 2px 10px rgba(255,140,0,0.55), 0 0 18px rgba(255,215,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, lineHeight: 1,
          transition: 'left 0.4s cubic-bezier(0.34,1.56,0.64,1), background 0.4s ease, box-shadow 0.4s ease',
        }}>
          {isDark ? '🌙' : '☀️'}
        </div>
      </button>
    </div>
  );
}

function TelegramIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#26A8EA" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
    </svg>
  );
}

function AccountMethodRow({ icon, title, subtitle, status, accent = APG2.gold }) {
  return (
    <div style={{ ...APG2.glass, borderRadius: 24, padding: 13, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <div style={{ width: 42, height: 42, borderRadius: 17, background: `${accent}1f`, border: `1px solid ${accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accent, fontSize: 18 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: APG2.text, fontSize: 15, lineHeight: '19px', fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
      </div>
      {status && <GlassBadge style={{ padding: '5px 9px', color: accent, flexShrink: 0 }}>{status}</GlassBadge>}
    </div>
  );
}

const DP = {
  bg: 'var(--apg2-bg, linear-gradient(180deg,#f8f4ec 0%,#f4eee4 100%))',
  card: 'var(--apg2-panel-soft, rgba(255,255,255,0.78))',
  strong: 'var(--apg2-panel-strong, rgba(255,255,255,0.94))',
  control: 'var(--apg2-control, rgba(255,255,255,0.62))',
  controlSoft: 'var(--apg2-control-soft, rgba(255,255,255,0.46))',
  controlStrong: 'var(--apg2-control-strong, rgba(255,255,255,0.82))',
  track: 'var(--apg2-track, rgba(31,26,20,0.08))',
  border: 'var(--apg2-glass-border, rgba(112,84,42,0.13))',
  text: 'var(--apg2-text, #1F1A14)',
  soft: 'var(--apg2-text-soft, rgba(31,26,20,0.64))',
  muted: 'var(--apg2-text-muted, rgba(31,26,20,0.44))',
  gold: 'var(--apg2-gold, #C89B3C)',
  goldSoft: 'rgba(200,155,60,0.13)',
  red: '#D95D54',
  green: '#2EB36B',
  blue: '#4A90D9',
  shadow: '0 22px 62px var(--apg2-elev-shadow, rgba(86,62,30,0.09))',
};

function dpCard(extra = {}) {
  return {
    background: DP.card,
    border: `1px solid ${DP.border}`,
    borderRadius: 8,
    boxShadow: DP.shadow,
    backdropFilter: 'blur(22px) saturate(1.25)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.25)',
    ...extra,
  };
}

function dpButton(tone = 'light', extra = {}) {
  const primary = tone === 'primary';
  const danger = tone === 'danger';
  return {
    minHeight: 38,
    borderRadius: 8,
    border: `1px solid ${primary ? 'rgba(200,155,60,0.48)' : danger ? 'rgba(217,93,84,0.32)' : DP.border}`,
    background: primary ? 'linear-gradient(135deg,#F2D58A,#C89B3C)' : danger ? 'rgba(217,93,84,0.09)' : DP.control,
    color: primary ? '#241807' : danger ? DP.red : DP.text,
    padding: '8px 12px',
    fontSize: 13,
    lineHeight: '17px',
    fontWeight: 820,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    textDecoration: 'none',
    ...extra,
  };
}

function dpText(value, fallback = '') {
  return String(value ?? '').trim() || fallback;
}

function profileDateText(value) {
  if (!value) return '';
  const ms = typeof value.toMillis === 'function'
    ? value.toMillis()
    : typeof value.toDate === 'function'
      ? value.toDate().getTime()
      : new Date(value).getTime();
  if (!ms || Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function DesktopSection({ title, icon, action, children, style }) {
  return (
    <section style={dpCard({ padding: 18, display: 'grid', gap: 14, ...style })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ color: DP.gold, fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
          <h2 style={{ margin: 0, color: DP.text, fontSize: 17, lineHeight: '22px', fontWeight: 930 }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function DesktopEmpty({ title, text }) {
  return (
    <div style={{ borderRadius: 8, border: `1px dashed ${DP.border}`, background: DP.controlSoft, padding: 16, textAlign: 'center' }}>
      <div style={{ color: DP.text, fontSize: 14, fontWeight: 860 }}>{title}</div>
      {text && <div style={{ color: DP.soft, fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>{text}</div>}
    </div>
  );
}

function DesktopProgress({ value, color = DP.gold }) {
  return (
    <div style={{ height: 8, borderRadius: 999, background: DP.track, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`, borderRadius: 999, background: `linear-gradient(90deg, ${color}, #E8C97A)`, transition: 'width 0.4s ease' }} />
    </div>
  );
}

const DesktopBookingRow = memo(function DesktopBookingRow({ item, onDialog, onReschedule, onCancel, onReview }) {
  const active = item?.isActive;
  const completed = item?.status === 'completed';
  return (
    <div style={{ borderRadius: 8, border: `1px solid ${DP.border}`, background: DP.controlSoft, padding: 11, display: 'grid', gap: 9 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: DP.text, fontSize: 14, lineHeight: '18px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item?.providerName || 'Запись АПГ'}</div>
          <div style={{ color: DP.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 2 }}>{item?.serviceTitle || 'Услуга'} · {[item?.dateLabel, item?.time].filter(Boolean).join(' ') || 'время уточняется'}</div>
          {bookingJourneySummary(item) && <div style={{ color: DP.gold, fontSize: 11.5, lineHeight: '16px', marginTop: 4, fontWeight: 780 }}>{bookingJourneySummary(item)}</div>}
        </div>
        <span style={{ borderRadius: 999, background: active ? 'rgba(46,179,107,0.12)' : completed ? 'rgba(200,155,60,0.13)' : 'rgba(31,26,20,0.06)', color: active ? DP.green : completed ? DP.gold : DP.soft, border: `1px solid ${active ? 'rgba(46,179,107,0.28)' : completed ? 'rgba(200,155,60,0.24)' : DP.border}`, padding: '4px 8px', fontSize: 11, lineHeight: '14px', fontWeight: 850, whiteSpace: 'nowrap' }}>{item?.statusLabel || 'Запись'}</span>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <button onClick={() => onDialog?.(item)} style={dpButton('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Написать</button>
        {active && <button onClick={() => onReschedule?.(item)} style={dpButton('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Перенести</button>}
        {active && <button onClick={() => onCancel?.(item)} style={dpButton('light', { minHeight: 30, padding: '5px 8px', fontSize: 12, color: DP.red })}>Отменить</button>}
        {completed && (item?.journey?.reviewPromptAvailable || item?.reviewPromptAvailable) && !item?.journey?.reviewPublishedAt && <button onClick={() => onReview?.(item)} style={dpButton('primary', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Отзыв</button>}
      </div>
    </div>
  );
});

const DesktopFavoriteRow = memo(function DesktopFavoriteRow({ item, onOpen }) {
  return (
    <button onClick={() => onOpen?.(item)} style={{ border: 0, background: 'transparent', padding: 0, display: 'grid', gridTemplateColumns: '42px minmax(0,1fr) auto', gap: 10, alignItems: 'center', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
      {item?.logoUrl ? <img src={item.logoUrl} alt="" loading="lazy" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 42, height: 42, borderRadius: 8, background: DP.goldSoft, color: DP.gold, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{item?.emoji || '◆'}</div>}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: DP.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item?.name || 'Партнёр АПГ'}</span>
        <span style={{ display: 'block', color: DP.soft, fontSize: 12, lineHeight: '16px', marginTop: 1 }}>{item?.categoryLabel || item?.category || 'Избранное'}</span>
      </span>
      <span style={{ color: DP.gold, fontSize: 18 }}>›</span>
    </button>
  );
});

const DesktopNewsRow = memo(function DesktopNewsRow({ item, onOpen }) {
  return (
    <button onClick={() => onOpen?.(item)} style={{ border: `1px solid ${DP.border}`, background: DP.controlSoft, borderRadius: 8, padding: '9px 10px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
      <span style={{ display: 'block', color: DP.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getNewsTitle(item)}</span>
      <span style={{ display: 'block', color: DP.soft, fontSize: 11.5, lineHeight: '15px', marginTop: 3 }}>{formatNewsDate(item)}</span>
    </button>
  );
});

function DesktopProfileEditor({ user, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    displayName: dpText(user?.displayName || [user?.first_name, user?.last_name].filter(Boolean).join(' ')),
    about: dpText(user?.about || user?.bio || user?.description),
    phone: dpText(user?.phone),
    telegram: dpText(user?.telegram || user?.telegramUsername),
    vk: dpText(user?.vk || user?.vkUrl),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const save = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    setError('');
    const patch = {
      displayName: form.displayName.trim(),
      about: form.about.trim(),
      phone: form.phone.trim(),
      telegram: form.telegram.trim(),
      vk: form.vk.trim(),
    };
    try {
      await userAction('profile:update', { userId: String(user.id), patch });
      onSaved?.(patch);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить профиль.');
    } finally {
      setSaving(false);
    }
  };
  const inputStyle = { width: '100%', minHeight: 42, borderRadius: 8, border: `1px solid ${DP.border}`, background: DP.control, color: DP.text, outline: 'none', padding: '0 11px', fontFamily: 'inherit', fontSize: 13.5, boxSizing: 'border-box' };
  return (
    <ApgModal title="Редактировать профиль" subtitle="Личные данные обычного профиля АПГ." onClose={onClose} maxWidth={520}>
      <div style={{ display: 'grid', gap: 11 }}>
        <input value={form.displayName} onChange={event => update('displayName', event.target.value)} placeholder="Имя" style={inputStyle} />
        <textarea value={form.about} onChange={event => update('about', event.target.value)} placeholder="Кратко о себе" style={{ ...inputStyle, minHeight: 96, resize: 'vertical', padding: 11, lineHeight: '19px' }} />
        <input value={form.phone} onChange={event => update('phone', event.target.value)} placeholder="Телефон" style={inputStyle} />
        <input value={form.telegram} onChange={event => update('telegram', event.target.value)} placeholder="Telegram" style={inputStyle} />
        <input value={form.vk} onChange={event => update('vk', event.target.value)} placeholder="VK" style={inputStyle} />
        {error && <div style={{ color: DP.red, fontSize: 12.5, lineHeight: '18px' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 9 }}>
          <button onClick={onClose} style={dpButton('light', { width: '100%' })}>Отмена</button>
          <button onClick={save} disabled={saving || !form.displayName.trim()} style={dpButton('primary', { width: '100%', opacity: saving || !form.displayName.trim() ? 0.58 : 1 })}>{saving ? 'Сохраняем...' : 'Сохранить'}</button>
        </div>
      </div>
    </ApgModal>
  );
}

function bookingJourneySummary(item = {}) {
  const journey = item.journey || {};
  const parts = [];
  const keysAwarded = Number(journey.keysAwarded || item.keysAwarded || 0);
  const stamp = journey.stampProgress || {};
  if (keysAwarded > 0) parts.push(`+${keysAwarded} ключа`);
  if (journey.stampAwarded || item.stampAwarded) {
    parts.push(stamp.target > 0 ? `штамп ${stamp.current || 0}/${stamp.target}` : 'визит отмечен');
  }
  if ((journey.reviewPromptAvailable || item.reviewPromptAvailable) && !journey.reviewPublishedAt) {
    parts.push('можно оставить отзыв');
  }
  return parts.join(' · ');
}

const FAQ_ITEMS = [
  {
    q: 'Что такое АПГ?',
    a: 'Альянс Партнёров Города — программа лояльности, объединяющая лучшие заведения Зеленограда. Участники получают эксклюзивные скидки и предложения от партнёров.',
  },
  {
    q: 'Как собирать ключи?',
    a: 'Нажми кнопку ◎ в центре нижней панели — откроется сканер QR-кода. Наведи его на QR-код партнёра на стойке — и ключ твой. Партнёр дня даёт +2 ключа вместо одного.',
  },
  {
    q: 'Зачем нужны ключи?',
    a: 'Ключи — это твоя валюта в АПГ. Чем больше партнёров посещаешь и заданий выполняешь — тем больше ключей и тем выше твой уровень.\n\nУровни:\n🌱 Новичок (0 ключей)\n⭐️ Участник (10+)\n🔥 Активный (25+)\n💎 Профи (50+)\n👑 Амбассадор АПГ (100+)\n\nЧто даёт высокий уровень:\n· Доступ на закрытые мероприятия АПГ — раз в квартал, только для участников с нужным количеством ключей\n· Место в общем рейтинге города среди всех участников\n· Эксклюзивные призы в магазине — часть товаров доступна только с определённого уровня\n· Статус Амбассадора — особый значок в профиле и приоритетное участие в городских квестах АПГ\n\nКлючи не сгорают — каждый визит и каждое задание работают на твой уровень.',
  },
  {
    q: 'Как воспользоваться предложением партнёра?',
    a: 'Открой карточку партнёра — там его спецпредложение для участников АПГ. Покажи экран на кассе или при записи.',
  },
  {
    q: 'Можно ли сканировать одно место несколько раз?',
    a: 'У каждого партнёра можно получать ключ раз в день — это стимулирует посещать новые места. Возвращайся к любимым партнёрам хоть каждый день!',
  },
  {
    q: 'Как добавить партнёра в избранное?',
    a: 'Нажми на сердечко на карточке партнёра. Все избранные заведения появятся в этом разделе профиля.',
  },
];

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Частые вопросы</div>
      <div style={{ ...APG2.glass, borderRadius: 24, overflow: 'hidden' }}>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, color: APG2.text, fontWeight: 600, lineHeight: '20px' }}>{item.q}</span>
                <span style={{
                  fontSize: 16, color: APG2.gold, flexShrink: 0,
                  transform: isOpen ? 'rotate(45deg)' : 'none',
                  transition: 'transform 0.25s ease',
                }}>✦</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 14px' }}>
                  <p style={{ margin: 0, fontSize: 13, color: APG2.textSoft, lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{item.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FavoriteCard({ partner, onOpen, onRemove }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      {partner.logoUrl
        ? <Avatar size={44} src={partner.logoUrl} />
        : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(201,168,76,0.09)', border: '2px solid rgba(201,168,76,0.27)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{partner.emoji ?? '🏪'}</div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: APG2.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</div>
        {partner.categoryLabel && <div style={{ fontSize: 11, color: APG2.gold, marginTop: 2 }}>{partner.categoryLabel}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onOpen(partner)} style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', color: '#0F0F1A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Открыть</button>
        <button onClick={() => onRemove(partner.id)} style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)', color: APG2.textSoft, fontSize: 12, cursor: 'pointer' }}>✕</button>
      </div>
    </div>
  );
}

function ShareModal({ user, userKeys, streak, scannedCount, completedTasks, unlockedAchievements, level, onClose, onShareVK }) {
  const name = user
    ? (user.displayName || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Участник АПГ')
    : 'Участник АПГ';
  return (
    <ApgModal title="Поделиться АПГ" subtitle="Покажите свой прогресс друзьям." onClose={onClose} maxWidth={440}>
      <div style={{ borderRadius: 28, padding: '24px 20px', marginBottom: 12, background: 'linear-gradient(145deg, rgba(255,255,255,0.16), rgba(201,168,76,0.10)), var(--apg2-bg, linear-gradient(145deg, #120c32, #16123e))', border: '1px solid rgba(201,168,76,0.35)', boxShadow: '0 24px 60px var(--apg2-elev-shadow, rgba(0,0,0,0.34))', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.04) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}18, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ fontSize: 10, color: APG2.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, opacity: 0.8 }}>✦ АПГ — Альянс Партнёров Зеленограда</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          {user?.photo_200
            ? <img src={user.photo_200} alt="" loading="lazy" style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.53)', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(201,168,76,0.12)', border: '2px solid rgba(201,168,76,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
          }
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: APG2.text, lineHeight: 1.2 }}>{name}</div>
            <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 600, marginTop: 3 }}>{level.emoji} {level.label}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { emoji: '🗝️', value: userKeys,         label: 'ключей' },
            { emoji: '🔥', value: streak,            label: 'дней стрик' },
            { emoji: '🏪', value: scannedCount,      label: 'партнёров' },
            { emoji: '🏆', value: unlockedAchievements, label: 'наград' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 18 }}>{s.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: APG2.gold, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: APG2.textSoft, lineHeight: '12px', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <GlassButton onClick={onShareVK} tone="gold" style={{ flex: 1 }}>
          Поделиться
        </GlassButton>
        <GlassButton onClick={onClose} style={{ flex: '0 0 auto', minWidth: 112 }}>
          Закрыть
        </GlassButton>
      </div>
    </ApgModal>
  );
}

function StreakCalendar({ scanDates = [], streak = 0 }) {
  const days = 30;
  const today = new Date();
  const dateSet = new Set(scanDates);

  const cells = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const key = d.toLocaleDateString('sv');
    const isToday = i === days - 1;
    return { key, active: dateSet.has(key), isToday, dayNum: d.getDate() };
  });

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>🔥 Активность — 30 дней</div>
        {streak > 0 && <div style={{ fontSize: 11, color: '#FF8C42', fontWeight: 700, background: 'rgba(255,100,0,0.1)', border: '1px solid rgba(255,100,0,0.25)', padding: '3px 10px', borderRadius: 20 }}>{streak} дн. подряд</div>}
      </div>
      <div style={{ ...APG2.glass, borderRadius: 20, padding: '14px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
          {cells.map(c => (
            <div key={c.key} title={c.key} style={{
              aspectRatio: '1', borderRadius: 6,
              background: c.active
                ? 'linear-gradient(135deg, #C9A84C, #E8C97A)'
                : c.isToday
                  ? 'rgba(201,168,76,0.15)'
                  : 'rgba(255,255,255,0.08)',
              border: c.isToday ? '1px solid rgba(201,168,76,0.38)' : '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: c.active ? '#0F0F1A' : APG2.textSoft,
              fontWeight: c.active ? 800 : 400,
            }}>
              {c.active ? '✓' : c.dayNum}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(135deg, #C9A84C, #E8C97A)' }} />
            <span style={{ fontSize: 10, color: APG2.textSoft }}>Посещение</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(201,168,76,0.38)' }} />
            <span style={{ fontSize: 10, color: APG2.textSoft }}>Сегодня</span>
          </div>
        </div>
      </div>
    </div>
  );
}


export function ProfilePanel({ user, variant = 'v2', userKeys = 0, favorites = [], partners = [], events = [], registeredEventIds = [], bookings = [], news = [], savedNews = [], readLaterNews = [], onOpenNews, onToggleFavorite, onOpenPartner, onOpenActivity, onEnableNotifications, notificationsEnabled = false, onLogout, onDeleteProfile, referralCount = 0, streak = 0, scannedCount = 0, completedTasks = [], scanDates = [], onShare, onOpenReferral, ownedPartner = null, onOpenPartnerCabinet, ownedExpert = null, onOpenExpertCabinet, appearance = 'light', onToggleTheme = () => {}, lastBonusDate = null, onUserUpdate = () => {}, onEmailAuthSuccess, onOpenReference, onOpenLoki, workspaceDiagnostics = null, onResetWorkspaceMode, onOpenPartnership, onRestartLearning, onOpenHealth, onOpenDialog, onOpenBookingDialog, onOpenBookingReview, initialConnectionTargetId = '', initialPeopleAction = null, desktopOverview = null, desktopMode = false, onBack }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showWorkspaceDiagnostics, setShowWorkspaceDiagnostics] = useState(false);
  const [showIdentityDiagnostics, setShowIdentityDiagnostics] = useState(false);
  const [identityDiagnostics, setIdentityDiagnostics] = useState(null);
  const [identityDiagnosticsLoading, setIdentityDiagnosticsLoading] = useState(false);
  const [identityDiagnosticsError, setIdentityDiagnosticsError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [vkLoginLoading, setVkLoginLoading] = useState(false);
  const [vkLoginError, setVkLoginError] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgStep, setTgStep] = useState('idle');
  const [tgBotUrl, setTgBotUrl] = useState('');
  const [refreshedTelegramAvatar, setRefreshedTelegramAvatar] = useState('');
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [showLinkEmail, setShowLinkEmail] = useState(false);
  const [linkEmailValue, setLinkEmailValue] = useState('');
  const [linkEmailLoading, setLinkEmailLoading] = useState(false);
  const [linkEmailError, setLinkEmailError] = useState('');
  const [linkEmailDone, setLinkEmailDone] = useState(false);
  const tgPollRef = useRef(null);
  const tgStateRef = useRef(null);
  const tgLinkingRef = useRef(false);
  const tgActionRef = useRef(0);
  const telegramAvatarRefreshRef = useRef('');
  const onUserUpdateRef = useRef(onUserUpdate);
  const linkedTelegramRef = useRef(user?.linkedTelegram || {});
  onUserUpdateRef.current = onUserUpdate;
  linkedTelegramRef.current = user?.linkedTelegram || {};
  const tgAuthTraceRef = useRef({
    requestId: '',
    loginSessionId: '',
    telegramSessionId: '',
  });
  const isGuest = !isVK() && (!user || String(user.id).startsWith('guest_'));
  const roleValue = String(user?.role || user?.userRole || user?.status || '').toLowerCase();
  const socialStorageKey = `apg_social_messaging_${String(user?.id || 'guest')}`;
  const [socialPrivacy, setSocialPrivacy] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`apg_social_messaging_${String(user?.id || 'guest')}`) || '{}');
      return normalizeSocialPrivacy(stored.privacy || user?.socialMessagingPrivacy);
    } catch {
      return normalizeSocialPrivacy(user?.socialMessagingPrivacy);
    }
  });
  const [socialRequests, setSocialRequests] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`apg_social_messaging_${String(user?.id || 'guest')}`) || '{}');
      return Array.isArray(stored.requests) ? stored.requests : [];
    } catch {
      return [];
    }
  });
  const [socialBlockedIds, setSocialBlockedIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`apg_social_messaging_${String(user?.id || 'guest')}`) || '{}');
      return Array.isArray(stored.blocked) ? stored.blocked : [];
    } catch {
      return [];
    }
  });
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState('');
  const [connections, setConnections] = useState([]);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [showBusinessCard, setShowBusinessCard] = useState(false);
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [connectionSearch, setConnectionSearch] = useState('');
  const [connectionTarget, setConnectionTarget] = useState(null);
  const [peopleTab, setPeopleTab] = useState('all');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleSearchResults, setPeopleSearchResults] = useState([]);
  const [peopleSearchLoading, setPeopleSearchLoading] = useState(false);
  const [peopleDialogs, setPeopleDialogs] = useState([]);
  const [peopleSheet, setPeopleSheet] = useState(null);
  const [pinnedPeopleIds, setPinnedPeopleIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`apg_people_pins_${String(user?.id || 'guest')}`) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(socialStorageKey) || '{}');
      setSocialPrivacy(normalizeSocialPrivacy(stored.privacy || user?.socialMessagingPrivacy));
      setSocialRequests(Array.isArray(stored.requests) ? stored.requests : []);
      setSocialBlockedIds(Array.isArray(stored.blocked) ? stored.blocked : []);
      setPinnedPeopleIds(JSON.parse(localStorage.getItem(`apg_people_pins_${String(user?.id || 'guest')}`) || '[]'));
    } catch {
      setSocialPrivacy(normalizeSocialPrivacy(user?.socialMessagingPrivacy));
      setSocialRequests([]);
      setSocialBlockedIds([]);
      setPinnedPeopleIds([]);
    }
  }, [socialStorageKey, user?.socialMessagingPrivacy]);

  const saveSocialMessagingState = useCallback((patch = {}) => {
    let previous = {};
    try {
      previous = JSON.parse(localStorage.getItem(socialStorageKey) || '{}');
    } catch {}
    const next = {
      privacy: patch.privacy ?? previous.privacy ?? SOCIAL_PRIVACY.ALLOWED_RELATIONS,
      requests: patch.requests ?? previous.requests ?? [],
      blocked: patch.blocked ?? previous.blocked ?? [],
    };
    try {
      localStorage.setItem(socialStorageKey, JSON.stringify(next));
    } catch {}
    if (patch.privacy !== undefined) setSocialPrivacy(normalizeSocialPrivacy(patch.privacy));
    if (patch.requests !== undefined) setSocialRequests(patch.requests);
    if (patch.blocked !== undefined) setSocialBlockedIds(patch.blocked);
  }, [socialStorageKey]);

  useEffect(() => {
    if (!user?.id || isGuest) return;
    let cancelled = false;
    setSocialLoading(true);
    setSocialError('');
    userAction('socialMessaging:listRequests')
      .then(data => {
        if (cancelled) return;
        const requests = Array.isArray(data.requests) ? data.requests : [];
        const blocked = Array.isArray(data.blocked) ? data.blocked.map(item => String(item.blockedUserId || item.id || '')).filter(Boolean) : [];
        saveSocialMessagingState({ requests, blocked, privacy: normalizeSocialPrivacy(data.privacy || user?.messagingPrivacy || user?.socialMessagingPrivacy) });
      })
      .catch(e => {
        if (!cancelled) setSocialError(e?.message || 'Не удалось загрузить социальные сообщения.');
      })
      .finally(() => {
        if (!cancelled) setSocialLoading(false);
      });
    return () => { cancelled = true; };
  }, [isGuest, saveSocialMessagingState, user?.id, user?.messagingPrivacy, user?.socialMessagingPrivacy]);

  useEffect(() => {
    if (!user?.id || isGuest) return undefined;
    const unsubRequests = onSnapshot(collection(db, 'users', String(user.id), 'socialMessagingRequests'), snap => {
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      saveSocialMessagingState({ requests: rows });
    }, () => {});
    const unsubBlocks = onSnapshot(collection(db, 'users', String(user.id), 'blockedUsers'), snap => {
      const rows = snap.docs.map(doc => String(doc.id || doc.data()?.blockedUserId || '')).filter(Boolean);
      saveSocialMessagingState({ blocked: rows });
    }, () => {});
    return () => {
      unsubRequests();
      unsubBlocks();
    };
  }, [isGuest, saveSocialMessagingState, user?.id]);

  useEffect(() => {
    if (!user?.id || isGuest) return;
    let cancelled = false;
    setConnectionLoading(true);
    setConnectionError('');
    userAction('connections:list')
      .then(data => {
        if (cancelled) return;
        setConnections(Array.isArray(data.contacts) ? data.contacts : []);
        setConnectionRequests(Array.isArray(data.requests) ? data.requests : []);
      })
      .catch(e => {
        if (!cancelled) setConnectionError(e?.message || 'Не удалось загрузить контакты.');
      })
      .finally(() => {
        if (!cancelled) setConnectionLoading(false);
      });
    return () => { cancelled = true; };
  }, [isGuest, user?.id]);

  useEffect(() => {
    if (!user?.id || isGuest) return undefined;
    return onSnapshot(collection(db, 'users', String(user.id), 'connections'), snap => {
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConnections(rows.filter(item => item.status === 'connected').sort((a, b) => new Date(b.connectedAt || b.updatedAt || 0).getTime() - new Date(a.connectedAt || a.updatedAt || 0).getTime()));
    }, () => {});
  }, [isGuest, user?.id]);

  useEffect(() => {
    if (!user?.id || isGuest) return undefined;
    return onSnapshot(collection(db, 'users', String(user.id), 'contextDialogs'), snap => {
      setPeopleDialogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => {});
  }, [isGuest, user?.id]);

  useEffect(() => {
    const query = peopleSearch.trim();
    if (!user?.id || isGuest || query.length < 2) {
      setPeopleSearchResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setPeopleSearchLoading(true);
      userAction('connections:search', { query })
        .then(data => {
          if (!cancelled) setPeopleSearchResults(Array.isArray(data.people) ? data.people : []);
        })
        .catch(e => {
          if (!cancelled) setConnectionError(e?.message || 'Не удалось найти участников АПГ.');
        })
        .finally(() => {
          if (!cancelled) setPeopleSearchLoading(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isGuest, peopleSearch, user?.id]);

  useEffect(() => {
    if (!initialPeopleAction?.nonce) return;
    if (initialPeopleAction.tab) setPeopleTab(initialPeopleAction.tab);
    if (initialPeopleAction.query) {
      setPeopleSearch(initialPeopleAction.query);
      setShowConnectionsModal(true);
    }
    if (initialPeopleAction.open === true) setShowConnectionsModal(true);
  }, [initialPeopleAction?.nonce]);

  useEffect(() => {
    const targetId = String(initialConnectionTargetId || '').trim();
    if (!targetId || !user?.id || targetId === String(user.id) || isGuest) {
      setConnectionTarget(null);
      return;
    }
    let cancelled = false;
    setConnectionLoading(true);
    userAction('connections:check', { targetUserId: targetId })
      .then(data => { if (!cancelled) setConnectionTarget(data); })
      .catch(e => { if (!cancelled) setConnectionError(e?.message || 'Не удалось открыть профиль для знакомства.'); })
      .finally(() => { if (!cancelled) setConnectionLoading(false); });
    return () => { cancelled = true; };
  }, [initialConnectionTargetId, isGuest, user?.id]);

  const updateSocialPrivacyServer = useCallback(async (privacy) => {
    const next = normalizeSocialPrivacy(privacy);
    saveSocialMessagingState({ privacy: next });
    setSocialError('');
    try {
      const data = await userAction('socialMessaging:updatePrivacy', { privacy: next });
      saveSocialMessagingState({ privacy: normalizeSocialPrivacy(data.privacy || next) });
      onUserUpdate?.({ messagingPrivacy: normalizeSocialPrivacy(data.privacy || next) });
    } catch (e) {
      setSocialError(e?.message || 'Не удалось сохранить приватность.');
    }
  }, [onUserUpdate, saveSocialMessagingState]);

  const stopPolling = useCallback(() => {
    if (tgPollRef.current) clearTimeout(tgPollRef.current);
    tgStateRef.current = null;
    tgPollRef.current = null;
  }, []);

  const waitForAuthStateChanged = useCallback(async (expectedUid, timeoutMs = 5000) => {
    const expected = String(expectedUid || '').trim();
    if (!expected) {
      const current = auth.currentUser;
      if (current) return current;
      return new Promise((resolve) => {
        let done = false;
        let timer = null;
        const fallbackUnsub = onAuthStateChanged(
          auth,
          (user) => {
            if (done) return;
            if (!user) return;
            done = true;
            if (timer) clearTimeout(timer);
            fallbackUnsub();
            resolve(user || auth.currentUser || null);
          },
          () => {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            fallbackUnsub();
            resolve(auth.currentUser || null);
          },
        );
        timer = setTimeout(() => {
          if (done) return;
          done = true;
          fallbackUnsub();
          resolve(auth.currentUser || null);
        }, timeoutMs);
      });
    }

    const current = auth.currentUser;
    if (current?.uid === expected) return current;
    traceAuthStage('auth_state_wait_start', {
      stateUid: expected,
      currentUid: current?.uid ?? null,
    });
    return apgIdentity.waitForIdentity(expected, timeoutMs);
  }, []);

  // Long-poll: одним fetch ждём до 25 с на сервере, при timeout — сразу повторяем
  const startWaiting = useCallback((state, diagnostics = {}) => {
    stopPolling();
    tgStateRef.current = state;
    tgAuthTraceRef.current = {
      requestId: safeTraceString(diagnostics.requestId || createTraceId('tg_req'), 180),
      loginSessionId: safeTraceString(diagnostics.loginSessionId || createTraceId('tg_sess'), 220),
      telegramSessionId: safeTraceString(diagnostics.telegramSessionId || state, 220),
      state,
    };

    const poll = async () => {
      if (tgStateRef.current !== state) return;
      try {
        traceAuthStage('telegram_poll_start', { state, ...tgAuthTraceRef.current });
        const checkUrl = new URL(`${API_BASE_URL}/api/telegram-auth-check`);
        checkUrl.searchParams.set('state', state);
        if (tgAuthTraceRef.current.requestId) checkUrl.searchParams.set('requestId', tgAuthTraceRef.current.requestId);
        if (tgAuthTraceRef.current.loginSessionId) checkUrl.searchParams.set('loginSessionId', tgAuthTraceRef.current.loginSessionId);
        if (tgAuthTraceRef.current.telegramSessionId) checkUrl.searchParams.set('telegramSessionId', tgAuthTraceRef.current.telegramSessionId);
        const r    = await fetch(checkUrl.toString(), {
          headers: { 'X-APG-Version': 'telegram-auth-diagnose' },
        });
        const data = await r.json();
        if (tgStateRef.current !== state) return;
        if (data.status === 'done') {
          const responseIsLinking = data.linking === true || tgLinkingRef.current;
          const hasLinkState = responseIsLinking || data.linked === true;
          const responseHasLinkOwner = safeTraceString(data.ownerUserId || data.linkedOwnerId || data.user?.id || '', 220);
          const checkDiagnostics = data.diagnostics || {};
          traceAuthStage('telegram_done', {
            state,
            userId: data.user?.id ?? null,
            linking: hasLinkState,
            linkError: data.linkError || null,
            ...tgAuthTraceRef.current,
            ...checkDiagnostics,
          });
          traceAuthStage('telegram_auth_done', {
            state,
            userId: data.user?.id ?? null,
            linking: hasLinkState,
            linkError: data.linkError || null,
            ...tgAuthTraceRef.current,
            ...checkDiagnostics,
          });
          tgStateRef.current = null;
          localStorage.removeItem('apg_tg_pending');
          if (hasLinkState && (user?.id || responseHasLinkOwner)) {
            tgLinkingRef.current = false;
            if (data.linkError) {
              const errorText = {
                owner_not_found: 'Не удалось подтвердить владельца аккаунта.',
                already_linked: 'Этот Telegram уже связан с другим аккаунтом.',
                session_stale: 'Ссылка устарела, создайте новую.',
                link_failed: 'Не удалось привязать Telegram. Попробуйте ещё раз.',
              }[data.linkError] || 'Не удалось привязать Telegram. Попробуйте ещё раз.';
              throw new Error(errorText);
            }
            const linkedTelegramFromServer = data.linkedTelegram;
            const tgPayload = linkedTelegramFromServer ? {
              tgId: linkedTelegramFromServer.tgId || data.tgId || null,
              firstName: linkedTelegramFromServer.firstName ?? '',
              lastName: linkedTelegramFromServer.lastName ?? null,
              username: linkedTelegramFromServer.username ?? null,
              photo: linkedTelegramFromServer.photo ?? null,
            } : {
              tgId: data.tgId,
              firstName: data.user?.first_name ?? '',
              lastName: data.user?.last_name ?? null,
              username: data.user?.username ?? null,
              photo: data.user?.photo_200 ?? null,
            };
            const userPatch = {
              linkedTelegram: tgPayload,
              ...(tgPayload.photo ? { photo_200: tgPayload.photo, photo: tgPayload.photo } : {}),
            };
            onUserUpdate(userPatch);
            try {
              const stored = localStorage.getItem('apg_email_user');
              if (stored) {
                const parsed = JSON.parse(stored);
                localStorage.setItem('apg_email_user', JSON.stringify({ ...parsed, ...userPatch }));
              }
            } catch {}
            setTgStep('linked');
          } else {
            if (data.token) {
              const identityResolved = checkDiagnostics.identityResolved === true || Boolean(checkDiagnostics.identitySource);
              const customTokenIssued = checkDiagnostics.customTokenIssued === true;
              const identityPath = safeTraceString(checkDiagnostics.identityPath || null, 220);
              const identitySource = safeTraceString(checkDiagnostics.identitySource || null, 220);
              traceAuthStage('telegram_start', {
                state,
                userId: data.user?.id ?? null,
                ...tgAuthTraceRef.current,
                identitySource,
              });
              traceAuthStage('identity_resolved', {
                state,
                userId: data.user?.id ?? null,
                identityResolved,
                identitySource,
                identityPath,
                ...tgAuthTraceRef.current,
              });
              traceAuthStage('custom_token_created', {
                state,
                userId: data.user?.id ?? null,
                customTokenIssued,
                identitySource,
                identityPath,
                ...tgAuthTraceRef.current,
              });
              traceAuthStage('firebase_signin_start', { state, ...tgAuthTraceRef.current, identityResolved });
              await apgIdentity.authenticate({ provider: 'firebaseCustomToken', token: data.token });
              const expectedUid = safeTraceString(data.user?.id || data.tgId || '', 220);
              const authUser = await waitForAuthStateChanged(expectedUid, 8000);
              if (expectedUid && authUser?.uid !== expectedUid) {
                throw new Error(`telegram_auth_signin_mismatch: expected ${expectedUid} got ${authUser?.uid || 'null'}`);
              }
              traceAuthStage('auth_state_changed', {
                state,
                userId: data.user?.id ?? null,
                uid: authUser?.uid ?? auth.currentUser?.uid ?? null,
                isAnonymous: authUser?.isAnonymous ?? null,
                ...tgAuthTraceRef.current,
              });
              traceAuthStage('user_loaded', {
                userId: data.user?.id ?? null,
                hasToken: !!data.token,
                source: 'after_auth_state_changed',
                uid: authUser?.uid ?? auth.currentUser?.uid ?? null,
                ...tgAuthTraceRef.current,
              });
              traceAuthStage('firebase_signin_done', {
                state,
                userId: data.user?.id ?? null,
                uid: authUser?.uid ?? auth.currentUser?.uid ?? null,
                isAnonymous: authUser?.isAnonymous ?? null,
                ...tgAuthTraceRef.current,
              });
            }
            localStorage.setItem('apg_tg_user', JSON.stringify(data.user));
            traceAuthStage('user_loaded', {
              userId: data.user?.id ?? null,
              hasToken: !!data.token,
              ...tgAuthTraceRef.current,
            });
            traceAuthStage('telegram_user_saved', { userId: data.user?.id ?? null, ...tgAuthTraceRef.current });
            try {
              traceAuthStage('telegram_restore', { state, uid: auth.currentUser?.uid ?? null, ...tgAuthTraceRef.current });
            } catch {}
            traceAuthStage('home_render', {
              state,
              userId: data.user?.id ?? null,
              source: 'telegram_session_ready_dispatched',
            });
            window.dispatchEvent(new CustomEvent('apg:auth_session_ready', {
              detail: {
                source: 'telegram',
                userId: data.user?.id ?? null,
                state,
                loginSessionId: tgAuthTraceRef.current.loginSessionId,
                requestId: tgAuthTraceRef.current.requestId,
              },
            }));
            setTgStep('idle');
          }
        } else if (data.status === 'failed') {
          traceAuthStage('telegram_auth_unavailable', {
            state,
            status: data.status,
            note: data?.diagnostics?.note || null,
            ...tgAuthTraceRef.current,
          });
          tgStateRef.current = null;
          localStorage.removeItem('apg_tg_pending');
          setTgError('Не удалось завершить Telegram-авторизацию. Проверьте логи и попробуйте позже.');
          setTgStep('idle');
        } else if (data.status === 'expired' || data.status === 'not_found' || data.status === 'cancelled') {
          traceAuthStage('telegram_auth_unavailable', { state, status: data.status, ...tgAuthTraceRef.current });
          tgStateRef.current = null;
          localStorage.removeItem('apg_tg_pending');
          setTgError(data.status === 'cancelled' ? 'Сессия отменена. Создайте новую ссылку.' : 'Ссылка устарела, создайте новую.');
          setTgStep('idle');
        } else {
          traceAuthStage('telegram_poll_status', { state, status: data.status, ...tgAuthTraceRef.current, serverDiagnostics: data.diagnostics || null });
          tgPollRef.current = setTimeout(poll, 900);
        }
      } catch (e) {
        logError(e, 'ProfilePanel.telegram.poll');
        traceAuthStage('telegram_poll_error', { state, error: e?.message ?? String(e), ...tgAuthTraceRef.current });
        if (tgStateRef.current !== state) return;
        if (tgLinkingRef.current) {
          tgStateRef.current = null;
          tgLinkingRef.current = false;
          setTgError(e?.message && e.message !== 'telegram_link_failed' ? e.message : 'Не удалось привязать Telegram. Попробуйте ещё раз.');
          setTgStep('idle');
          return;
        }
        traceAuthStage('telegram_poll_retry', { state, ...tgAuthTraceRef.current });
        await new Promise(r => setTimeout(r, 2000));
        poll();
      }
    };

    poll();
  }, [stopPolling, user]);

  const handleTelegramAuth = useCallback(async (isLinking = false) => {
    const linking = isLinking === true;
    tgLinkingRef.current = linking;
    setTgLoading(true);
    setTgError('');
    stopPolling();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const requestId = createTraceId('tg_req');
    const loginSessionId = createTraceId('tg_sess');
    try {
      traceAuthStage('telegram_auth_click', { linking });
      traceAuthStage('telegram_auth_start', { linking, api: API_BASE_URL, requestId, loginSessionId });
      traceAuthStage('telegram_start', { linking, api: API_BASE_URL, requestId, loginSessionId });
      const pendingRef = readPendingReferral({ source: 'ProfilePanel.telegramAuth' }) || '';
      const serverSession = await (globalThis.__APG_REFERRAL_SESSION_PROMISE__ || ensureServerReferralSession({ apiBaseUrl: API_BASE_URL, ref: pendingRef, source: 'telegram_auth_start' })).catch(() => null);
      const referralContext = getReferralContext({ ref: pendingRef, source: 'telegram_auth_start' });
      const res = await fetch(`${API_BASE_URL}/api/telegram-auth-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APG-Version': 'hotfix-telegram-auth' },
        body: JSON.stringify({
          source: 'profile_panel',
          linking,
          ownerUserId: linking ? String(user?.id || '') : '',
          ownerEmail: linking ? String(user?.email || user?.linkedEmail || '') : '',
          requestId,
          loginSessionId,
          ref: pendingRef || undefined,
          referralSessionId: serverSession?.referralSessionId || referralContext.referralSessionId || referralContext.sessionId,
          referralFlowId: referralContext.referralFlowId,
          referralDeviceId: referralContext.deviceId,
          referralPlatform: referralContext.platform,
        }),
        signal: controller.signal,
      });
      const { state, url, message, requestId: responseRequestId, loginSessionId: responseLoginSessionId, telegramSessionId } = await res.json().catch(() => ({}));
      if (!res.ok || !state || !url) throw new Error(message || 'telegram_start_failed');
      const telegramSessionIdResolved = telegramSessionId || state;
      const trace = {
        requestId: safeTraceString(responseRequestId || requestId),
        loginSessionId: safeTraceString(responseLoginSessionId || loginSessionId),
        telegramSessionId: safeTraceString(telegramSessionIdResolved || state),
      };
      localStorage.setItem('apg_tg_pending', JSON.stringify({
        state,
        url,
        linking,
        at: Date.now(),
        ...trace,
      }));
      tgAuthTraceRef.current = {
        ...tgAuthTraceRef.current,
        ...trace,
        state,
      };
      traceAuthStage('telegram_session_created', { state, linking, ...trace });
      setTgBotUrl(url);
      setTgLoading(false);
      setTgStep('waiting');
      startWaiting(state, trace);
      setTimeout(() => {
        traceAuthStage('telegram_open_bot', { state, ...trace });
        openUrl(url);
      }, 80);
    } catch (e) {
      logError(e, 'ProfilePanel.telegram.start');
      traceAuthStage('telegram_start_error', { error: e?.message ?? String(e), requestId, loginSessionId });
      const aborted = e?.name === 'AbortError';
      setTgError(aborted ? 'Telegram не ответил вовремя. Проверьте интернет и попробуйте снова.' : 'Ошибка сети. Попробуйте снова.');
      setTgLoading(false);
      setTgStep('idle');
    } finally {
      clearTimeout(timeoutId);
    }
  }, [stopPolling, startWaiting, user]);

  const runTelegramAuth = useCallback((isLinking = false) => {
    const now = Date.now();
    if (now - tgActionRef.current < 700) return;
    tgActionRef.current = now;
    handleTelegramAuth(isLinking);
  }, [handleTelegramAuth]);

  const handleVkLogin = async () => {
    setVkLoginLoading(true);
    setVkLoginError('');
    try {
      await vkWebLogin();
      window.location.reload();
    } catch (e) {
      if (e.message !== 'popup_closed') setVkLoginError('Не удалось войти. Попробуйте ещё раз.');
      setVkLoginLoading(false);
    }
  };

  // Восстанавливаем сессию после перезагрузки страницы (мобильный редирект)
  useEffect(() => {
    const saved = localStorage.getItem('apg_tg_pending');
    if (!saved) return;
    try {
      const { state, url, linking, at, requestId, loginSessionId, telegramSessionId } = JSON.parse(saved);
      if (Date.now() - at > 5 * 60 * 1000) { localStorage.removeItem('apg_tg_pending'); return; }
      tgLinkingRef.current = linking === true;
      setTgBotUrl(url);
      setTgStep('waiting');
      tgAuthTraceRef.current = {
        requestId: safeTraceString(requestId, 180),
        loginSessionId: safeTraceString(loginSessionId, 220),
        telegramSessionId: safeTraceString(telegramSessionId || state, 220),
        state,
      };
      startWaiting(state, tgAuthTraceRef.current);
    } catch { localStorage.removeItem('apg_tg_pending'); }
  }, []);

  const handleLinkEmail = useCallback(async () => {
    if (linkEmailLoading || !linkEmailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmailValue)) return;
    setLinkEmailLoading(true);
    setLinkEmailError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-auth`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ action: 'link-email', email: linkEmailValue, userId: String(user.id) }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === 'identity_conflict' || data.code === 'IDENTITY_CONFLICT') {
          setLinkEmailError('Email уже привязан к другому аккаунту.');
          return;
        }
        if (data.error === 'already_used' || data.error === 'owner_mismatch') {
          setLinkEmailError(data.message || 'Нельзя привязать email к этому аккаунту.');
          return;
        }
        setLinkEmailError(data.message || 'Ошибка привязки. Попробуйте снова.');
      } else {
        setLinkEmailDone(true);
        setShowLinkEmail(false);
        try {
          const stored = localStorage.getItem('apg_tg_user');
          if (stored) localStorage.setItem('apg_tg_user', JSON.stringify({ ...JSON.parse(stored), linkedEmail: linkEmailValue }));
        } catch {}
      }
    } catch {
      setLinkEmailError('Ошибка сети. Попробуйте снова.');
    } finally {
      setLinkEmailLoading(false);
    }
  }, [linkEmailLoading, linkEmailValue, user]);

  // При возврате в браузер из Telegram — перезапускаем polling (браузер мог throttle-ить setInterval в фоне)
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      const state = tgStateRef.current;
      if (!state) return;
      startWaiting(state);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [startWaiting]);



  useEffect(() => () => stopPolling(), [stopPolling]);
  const [achievementToast, setAchievementToast] = useState(null);
  const [toastExiting, setToastExiting] = useState(false);
  const dismissTimerRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const showInstallBtn = !isNativeApp() && !isStandalone && (installPrompt || isIos);

  useEffect(() => {
    if (isNativeApp()) return undefined;
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIos) { setShowIosHint(h => !h); return; }
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const handleDeleteConfirmed = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDeleteProfile?.();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [onDeleteProfile]);

  const handleEmailAuthSuccess = useCallback((emailUser, authPayload) => {
    setShowEmailAuth(false);
    onEmailAuthSuccess?.(emailUser, authPayload);
  }, [onEmailAuthSuccess]);

  const dismissToast = useCallback(() => {
    setToastExiting(true);
    clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => { setAchievementToast(null); setToastExiting(false); }, 300);
  }, []);

  const isDark = appearance === 'dark';
  const safeUser = user || { first_name: 'Участник', last_name: 'АПГ', photo_200: null };
  const storedProfileAvatarUrl = resolveProfileAvatar(safeUser);
  const profileAvatarUrl = refreshedTelegramAvatar || storedProfileAvatarUrl;
  const linkedTelegramId = String(
    user?.linkedTelegram?.tgId
      || user?.linkedTelegram?.telegramId
      || user?.telegramId
      || (String(user?.id || '').startsWith('tg_') ? user.id : ''),
  ).replace(/^tg_/, '');

  useEffect(() => {
    const userId = String(user?.id || '');
    if (!userId || userId.startsWith('guest_') || !linkedTelegramId || storedProfileAvatarUrl) return;
    const refreshKey = `${userId}:${linkedTelegramId}`;
    if (telegramAvatarRefreshRef.current === refreshKey) return;
    telegramAvatarRefreshRef.current = refreshKey;
    let cancelled = false;
    userAction('telegramAvatar:refresh', { userId })
      .then(result => {
        const photo = String(result?.photo || '').trim();
        if (cancelled || !photo) return;
        setRefreshedTelegramAvatar(photo);
        onUserUpdateRef.current?.({
          photo,
          photo_200: photo,
          linkedTelegram: {
            ...linkedTelegramRef.current,
            tgId: linkedTelegramId,
            telegramId: linkedTelegramId,
            photo,
            photoUrl: photo,
            photo_200: photo,
          },
        });
      })
      .catch(error => {
        telegramAvatarRefreshRef.current = '';
        if (/telegram не привязан к профилю/i.test(String(error?.message || error))) {
          onUserUpdateRef.current?.({ linkedTelegram: null });
          return;
        }
        logError(error, 'ProfilePanel.telegramAvatar.refresh');
      });
    return () => { cancelled = true; };
  }, [linkedTelegramId, storedProfileAvatarUrl, user?.id]);
  const level = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const isPrivilegedProfile = String(user?.id || '') === '988504' || hasCapability(user || {}, CAPABILITIES.canOpenAdminPanel);
  const showWorkspaceDiagnosticButton = Boolean(workspaceDiagnostics) && hasCapability(user || {}, CAPABILITIES.canViewDiagnostics);
  const showIdentityDiagnosticButton = !!user && !String(user.id || '').startsWith('guest_');
  const showPartnershipCard = Boolean(onOpenPartnership) && !ownedPartner && !ownedExpert && !isPrivilegedProfile;
  const partnershipCardTrackedRef = useRef(false);

  const openIdentityDiagnostics = useCallback(async () => {
    setShowIdentityDiagnostics(true);
    setIdentityDiagnosticsLoading(true);
    setIdentityDiagnosticsError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/user-actions`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ action: 'identity:diagnostics', userId: String(user?.id || ''), email: user?.email || user?.linkedEmail || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Не удалось получить диагностику Identity.');
      setIdentityDiagnostics(data);
    } catch (error) {
      setIdentityDiagnosticsError(error?.message || 'Не удалось получить диагностику Identity.');
    } finally {
      setIdentityDiagnosticsLoading(false);
    }
  }, [user]);

  const trackPartnershipProfileEvent = useCallback((event, payload = {}) => {
    fetch(`${API_BASE_URL}/api/public-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-APG-Version': 'partnership-profile-card-v2' },
      body: JSON.stringify({
        action: 'track-partnership',
        event,
        payload,
        user: user ? { id: user.id, name: user.displayName || [user.first_name, user.last_name].filter(Boolean).join(' '), email: user.email || user.linkedEmail || '' } : null,
      }),
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!showPartnershipCard || partnershipCardTrackedRef.current) return;
    partnershipCardTrackedRef.current = true;
    trackPartnershipProfileEvent('partnership_card_opened', { surface: 'profile', placement: 'after_user_info' });
  }, [showPartnershipCard, trackPartnershipProfileEvent]);

  const openPartnershipFlow = useCallback((type) => {
    trackPartnershipProfileEvent(type === 'expert' ? 'partnership_expert_selected' : 'partnership_partner_selected', { surface: 'profile_card' });
    onOpenPartnership?.(type);
  }, [onOpenPartnership, trackPartnershipProfileEvent]);

  const achievements = useMemo(() =>
    ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.cond(userKeys, favorites, referralCount) })),
    [userKeys, favorites, referralCount]
  );

  useEffect(() => {
    const SEEN_KEY = 'apg_seen_achievements';
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    const newOnes = achievements.filter(a => a.unlocked && !seen.has(a.id));
    if (newOnes.length === 0) return;
    const toShow = newOnes[newOnes.length - 1];
    newOnes.forEach(a => seen.add(a.id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    clearTimeout(dismissTimerRef.current); // сбрасываем предыдущий dismiss если был
    setAchievementToast(toShow);
    setToastExiting(false);
    const timer = setTimeout(() => dismissToast(), 4000);
    return () => clearTimeout(timer);
  }, [achievements, dismissToast]);
  useEffect(() => () => clearTimeout(dismissTimerRef.current), []);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const favoritePartnerIds = useMemo(() => new Set((favorites || []).map((id) => String(id))), [favorites]);
  const favoritePartners = useMemo(
    () => (Array.isArray(partners) ? partners.filter((p) => favoritePartnerIds.has(String(p?.id))) : []),
    [partners, favoritePartnerIds]
  );
  const sourceBookings = useMemo(() => Array.isArray(bookings) ? bookings.map(normalizeBooking) : [], [bookings]);
  const [localBookings, setLocalBookings] = useState(sourceBookings);
  useEffect(() => {
    setLocalBookings((prev) => {
      if (prev.length === sourceBookings.length && prev.every((item, index) => {
        const next = sourceBookings[index];
        const itemId = String(item?.id || item?.bookingId || '');
        const nextId = String(next?.id || next?.bookingId || '');
        return itemId === nextId && String(item?.status || '') === String(next?.status || '') && String(item?.updatedAt || '') === String(next?.updatedAt || '');
      })) {
        return prev;
      }
      return sourceBookings;
    });
  }, [sourceBookings]);
  const savedNewsItems = useMemo(() => {
    const saved = new Set((savedNews || []).map(String));
    const later = new Set((readLaterNews || []).map(String));
    return (news || [])
      .filter(item => item && getNewsLegacyIds(item).some(id => saved.has(id) || later.has(id)))
      .slice(0, 5);
  }, [news, readLaterNews, savedNews]);
  const bookingGroups = useMemo(() => {
    const groups = groupBookingsForProfile(localBookings);
    return {
      pending: groups.pending.slice(0, 4),
      actionRequired: groups.actionRequired.slice(0, 4),
      upcoming: groups.upcoming.slice(0, 4),
      past: groups.past.slice(-4).reverse(),
      cancelled: groups.cancelled.slice(0, 4),
      completed: groups.completed.slice(-4).reverse(),
    };
  }, [localBookings]);

  const runBookingAction = useCallback(async (action, item, payload = {}) => {
    if (!item?.id && !item?.bookingId) return;
    try {
      const result = await userAction(action, { bookingId: item.id || item.bookingId, ...payload });
      if (result?.booking) {
        setLocalBookings((prev) => {
          const next = normalizeBooking(result.booking);
          const key = String(next.id || next.bookingId);
          const exists = prev.some((row) => String(row.id || row.bookingId) === key);
          return (exists ? prev.map((row) => String(row.id || row.bookingId) === key ? next : row) : [next, ...prev]);
        });
      }
    } catch (error) {
      logError(error, `ProfilePanel.${action}`);
      alert(error?.message || 'Не удалось обновить встречу.');
    }
  }, [userAction]);

  const stats = useMemo(() => [
    { label: 'Ключей', value: userKeys, emoji: '🗝️' },
    { label: 'Избранное', value: favorites.length, emoji: '⭐' },
    { label: 'Достижения', value: `${unlockedCount}/${achievements.length}`, emoji: '🏆' },
  ], [userKeys, favorites.length, unlockedCount, achievements.length]);

  const handleSupport = async () => {
    try {
      await vkBridge.send('VKWebAppOpenApp', { app_id: 54601851 });
    } catch {
      // fallback — ничего
    }
  };

  const handleWriteAdmin = async () => {
    openUrl('https://vk.me/id988504');
  };

  const isEmailUser = !!user && String(user.id).startsWith('email:');
  const isTelegramUser = !!user && String(user.id).startsWith('tg_');
  const userEmail = user?.email || user?.linkedEmail || (isEmailUser ? String(user.id).replace('email:', '') : '');
  const linkedTelegram = user?.linkedTelegram;
  const linkedTelegramName = linkedTelegram
    ? [linkedTelegram.firstName, linkedTelegram.lastName].filter(Boolean).join(' ') || 'Telegram привязан'
    : '';
  const telegramDisplayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.displayName || 'Telegram';
  const contactRows = useMemo(() => [
    userEmail && { id: 'email', label: 'Email', value: userEmail, href: `mailto:${userEmail}`, icon: '✉' },
    (user?.phone) && { id: 'phone', label: 'Телефон', value: user.phone, href: `tel:${String(user.phone).replace(/[^\d+]/g, '')}`, icon: '☎' },
    (user?.telegram || user?.telegramUsername || user?.linkedTelegram?.username) && { id: 'telegram', label: 'Telegram', value: user.telegram || user.telegramUsername || `@${user.linkedTelegram.username}`, href: `https://telegram.me/${String(user.telegram || user.telegramUsername || user.linkedTelegram.username).replace(/^@+/, '')}`, icon: '↗' },
    (user?.vk || user?.vkUrl) && { id: 'vk', label: 'VK', value: user.vk || user.vkUrl, href: String(user.vk || user.vkUrl).startsWith('http') ? user.vk || user.vkUrl : `https://vk.com/${user.vk || user.vkUrl}`, icon: '↗' },
  ].filter(Boolean), [userEmail, user?.phone, user?.telegram, user?.telegramUsername, user?.vk, user?.vkUrl, user?.linkedTelegram]);
  const quickActions = useMemo(() => [
    { id: 'activity', label: 'Активность', icon: '◷', onClick: onOpenActivity },
    { id: 'referral', label: 'Рефералы', icon: '↗', onClick: onOpenReferral },
    { id: 'notifications', label: notificationsEnabled ? 'Уведомления вкл' : 'Уведомления', icon: notificationsEnabled ? '✓' : '🔔', onClick: onEnableNotifications },
    { id: 'theme', label: isDark ? 'Светлая тема' : 'Тёмная тема', icon: isDark ? '☀' : '☾', onClick: onToggleTheme },
    ownedPartner && { id: 'partner', label: 'Кабинет партнёра', icon: '◆', onClick: onOpenPartnerCabinet },
    ownedExpert && { id: 'expert', label: 'Кабинет эксперта', icon: '✦', onClick: onOpenExpertCabinet },
  ].filter(Boolean), [isDark, notificationsEnabled, onEnableNotifications, onOpenActivity, onOpenReferral, onOpenPartnerCabinet, onOpenExpertCabinet, ownedPartner, ownedExpert]);
  const socialIncomingRequests = useMemo(() => socialRequests.filter(item => String(item.toUserId || '') === String(user?.id || '')), [socialRequests, user?.id]);
  const socialOutgoingRequests = useMemo(() => socialRequests.filter(item => String(item.fromUserId || '') === String(user?.id || '')), [socialRequests, user?.id]);
  const incomingConnectionRequests = useMemo(() => connectionRequests.filter(item => item.connection === true && item.direction === 'incoming' && item.status === 'pending'), [connectionRequests]);
  const outgoingConnectionRequests = useMemo(() => connectionRequests.filter(item => item.connection === true && item.direction === 'outgoing' && item.status === 'pending'), [connectionRequests]);
  const businessCardUrl = useMemo(() => `${APP_URL.replace(/\/+$/, '')}/profile/${encodeURIComponent(String(user?.id || ''))}`, [user?.id]);
  const businessCardDisplayName = safeUser.displayName || [safeUser.first_name, safeUser.last_name].filter(Boolean).join(' ') || 'Участник АПГ';
  const filteredConnections = useMemo(() => {
    const q = connectionSearch.trim().toLowerCase();
    return connections.filter(item => {
      const contact = item.contact || {};
      const role = String(contact.role || '').toLowerCase();
      const haystack = [contact.displayName, contact.company, contact.role, contact.city].join(' ').toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (connectionFilter === 'new') return new Date(item.connectedAt || item.updatedAt || 0).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (connectionFilter === 'partners') return role.includes('partner') || role.includes('парт');
      if (connectionFilter === 'experts') return role.includes('expert') || role.includes('эксп');
      if (connectionFilter === 'users') return !role.includes('partner') && !role.includes('парт') && !role.includes('expert') && !role.includes('эксп');
      return true;
    });
  }, [connectionFilter, connectionSearch, connections]);
  const peopleRows = useMemo(() => buildPeopleRows({
    users: peopleSearchResults,
    connections,
    requests: connectionRequests,
    dialogs: peopleDialogs,
    blocked: socialBlockedIds,
    actor: user,
  }), [connectionRequests, connections, peopleDialogs, peopleSearchResults, socialBlockedIds, user]);
  const peopleGroups = useMemo(() => searchPeopleGroups({
    query: peopleSearch,
    people: peopleRows,
    partners,
    experts: ownedExpert ? [ownedExpert] : [],
    events,
  }), [events, ownedExpert, partners, peopleRows, peopleSearch]);
  const visiblePeopleRows = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase().replace(/ё/g, 'е');
    const rows = q ? (peopleGroups.find(group => group.id === 'people')?.rows || []) : peopleRows;
    if (peopleTab === 'friends') return rows.filter(item => item.relationStatus === PEOPLE_RELATION_STATUS.FRIEND);
    if (peopleTab === 'requests') return rows.filter(item => item.relationStatus === PEOPLE_RELATION_STATUS.INCOMING || item.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING);
    if (peopleTab === 'dialogs') return rows.filter(item => item.dialogId);
    if (peopleTab === 'recent') return rows.filter(item => item.lastActivityAt || item.dialogId);
    if (peopleTab === 'online') return rows.filter(item => peoplePresenceLabel(item) === 'онлайн');
    if (peopleTab === 'partners') return rows.filter(item => peopleKind(item) === 'partner');
    if (peopleTab === 'experts') return rows.filter(item => peopleKind(item) === 'expert');
    return rows;
  }, [peopleGroups, peopleRows, peopleSearch, peopleTab]);
  const peopleCounts = useMemo(() => ({
    all: peopleRows.length,
    friends: peopleRows.filter(item => item.relationStatus === PEOPLE_RELATION_STATUS.FRIEND).length,
    requests: incomingConnectionRequests.length + outgoingConnectionRequests.length,
    dialogs: peopleRows.filter(item => item.dialogId).length,
    recent: peopleRows.filter(item => item.lastActivityAt || item.dialogId).length,
    online: peopleRows.filter(item => peoplePresenceLabel(item) === 'онлайн').length,
    partners: peopleRows.filter(item => peopleKind(item) === 'partner').length,
    experts: peopleRows.filter(item => peopleKind(item) === 'expert').length,
  }), [incomingConnectionRequests.length, outgoingConnectionRequests.length, peopleRows]);
  const peopleSections = useMemo(() => buildPeoplePulse({ people: peopleRows, pinnedIds: pinnedPeopleIds }), [peopleRows, pinnedPeopleIds]);
  const openPeopleNavigation = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setPeopleSheet(null);
    setShowBusinessCard(false);
    setShowConnectionsModal(true);
  }, []);
  const openBusinessCardNavigation = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setPeopleSheet(null);
    setShowConnectionsModal(false);
    setShowBusinessCard(true);
  }, []);
  const connectionDevPanel = useMemo(() => {
    const latest = connections[0] || null;
    const target = connectionTarget || {};
    return {
      ConnectionStatus: target.status || latest?.status || 'none',
      Source: target.connectionContext?.sourceLabel || latest?.sourceLabel || 'none',
      SharedEvents: String(target.shared?.events?.length ?? latest?.shared?.events?.length ?? 0),
      SharedPartners: String(target.shared?.partners?.length ?? latest?.shared?.partners?.length ?? 0),
      Dialog: target.dialogId || latest?.dialogId || 'none',
      SocialGraph: `${connections.length} contacts`,
    };
  }, [connectionTarget, connections]);
  const socialDevPanel = useMemo(() => buildSocialMessagingDevPanel({
    actor: { ...user, socialMessagingPrivacy: socialPrivacy },
    requests: socialRequests,
    blocked: socialBlockedIds,
    privacy: socialPrivacy,
  }), [socialBlockedIds, socialPrivacy, socialRequests, user]);
  const patchPeoplePerson = useCallback((targetId, patch = {}) => {
    const id = profilePersonId(targetId);
    if (!id) return;
    const merge = (person) => {
      if (profilePersonId(person) !== id) return person;
      const next = { ...person, ...patch };
      if (!patch.request && person?.request) next.request = person.request;
      if (!patch.shared && person?.shared) next.shared = person.shared;
      if (!patch.dialogId && person?.dialogId) next.dialogId = person.dialogId;
      return next;
    };
    setPeopleSearchResults(prev => prev.map(merge));
    setPeopleSheet(prev => prev ? merge(prev) : prev);
    setConnectionTarget(prev => {
      if (profilePersonId(prev?.target) !== id) return prev;
      return { ...(prev || {}), ...patch, target: merge(prev.target || {}) };
    });
  }, []);
  const updateSocialRequest = useCallback((requestId, status) => {
    setSocialError('');
    const action = status === 'accepted' ? 'socialMessaging:accept' : status === 'declined' ? 'socialMessaging:decline' : status === 'cancelled' ? 'socialMessaging:cancel' : '';
    if (!action) return;
    userAction(action, { requestId })
      .then(data => {
        if (data.request) {
          const next = socialRequests.map(item => String(item.id) === String(requestId) ? data.request : item);
          saveSocialMessagingState({ requests: next });
        }
        if (data.dialogId) onOpenDialog?.(data.dialogId);
      })
      .catch(e => setSocialError(e?.message || 'Не удалось обновить запрос.'));
  }, [onOpenDialog, saveSocialMessagingState, socialRequests]);
  const toggleSocialBlock = useCallback((targetId) => {
    const id = String(targetId || '').trim();
    if (!id) return;
    const blocked = socialBlockedIds.includes(id);
    userAction(blocked ? 'socialMessaging:unblock' : 'socialMessaging:block', { targetUserId: id })
      .then(() => {
        const next = blocked ? socialBlockedIds.filter(item => item !== id) : [id, ...socialBlockedIds].slice(0, 100);
        saveSocialMessagingState({ blocked: next });
      })
      .catch(e => setSocialError(e?.message || 'Не удалось обновить блокировку.'));
  }, [saveSocialMessagingState, socialBlockedIds]);
  const requestConnection = useCallback((targetId, source = 'manual') => {
    const id = String(targetId || '').trim();
    if (!id) return;
    setConnectionError('');
    userAction('connections:request', { targetUserId: id, source })
      .then(data => {
        const request = data.request || null;
        const relationStatus = data.dialogId || data.status === 'connected'
          ? PEOPLE_RELATION_STATUS.FRIEND
          : PEOPLE_RELATION_STATUS.OUTGOING;
        const patch = {
          relationStatus,
          status: relationStatus === PEOPLE_RELATION_STATUS.FRIEND ? 'connected' : 'pending',
          direction: request?.direction || (relationStatus === PEOPLE_RELATION_STATUS.OUTGOING ? 'outgoing' : ''),
          dialogId: data.dialogId || request?.dialogId || '',
        };
        if (request) patch.request = request;
        if (request?.shared || data.connection?.shared || data.target?.shared) patch.shared = request?.shared || data.connection?.shared || data.target?.shared;
        if (request) setConnectionRequests(prev => [request, ...prev.filter(item => String(item.id) !== String(request.id))]);
        patchPeoplePerson(id, patch);
        if (data.dialogId) onOpenDialog?.(data.dialogId);
        if (connectionTarget?.target?.id === id) setConnectionTarget(prev => ({ ...(prev || {}), ...data, ...patch, action: data.dialogId ? 'message' : 'pending' }));
      })
      .catch(e => setConnectionError(e?.message || 'Не удалось отправить запрос на знакомство.'));
  }, [connectionTarget?.target?.id, onOpenDialog, patchPeoplePerson]);
  const updateConnectionRequest = useCallback((requestId, status) => {
    const action = status === 'accepted' ? 'connections:accept' : 'connections:decline';
    const currentRequest = connectionRequests.find(item => String(item.id) === String(requestId));
    const targetId = String(currentRequest?.senderId || '') === String(user?.id || '') ? currentRequest?.recipientId : currentRequest?.senderId;
    setConnectionError('');
    userAction(action, { requestId })
      .then(data => {
        if (data.request) setConnectionRequests(prev => prev.map(item => String(item.id) === String(requestId) ? data.request : item));
        if (status === 'accepted' && data.connection) {
          setConnections(prev => [data.connection, ...prev.filter(item => profilePersonId(item) !== profilePersonId(data.connection))]);
        }
        if (targetId) {
          const nextStatus = status === 'accepted' ? PEOPLE_RELATION_STATUS.FRIEND : PEOPLE_RELATION_STATUS.STRANGER;
          patchPeoplePerson(targetId, {
            relationStatus: nextStatus,
            status: nextStatus === PEOPLE_RELATION_STATUS.FRIEND ? 'connected' : 'stranger',
            direction: '',
            request: data.request || currentRequest || null,
            dialogId: data.dialogId || data.connection?.dialogId || data.request?.dialogId || '',
            shared: data.connection?.shared || data.request?.shared || currentRequest?.shared || null,
          });
        }
        if (data.dialogId) onOpenDialog?.(data.dialogId);
      })
      .catch(e => setConnectionError(e?.message || 'Не удалось обновить знакомство.'));
  }, [connectionRequests, onOpenDialog, patchPeoplePerson, user?.id]);
  const openConnectionDialog = useCallback((item) => {
    const dialogId = item?.dialogId || '';
    if (dialogId) onOpenDialog?.(dialogId);
  }, [onOpenDialog]);
  const openPersonDialog = useCallback((person) => {
    const id = profilePersonId(person);
    if (!id) return;
    userAction('dialog:open', {
      type: 'direct',
      objectId: id,
      targetUserId: id,
      context: { type: 'direct', objectId: id, targetUserId: id, title: person?.displayName || '' },
    })
      .then(data => {
        if (!data.dialogId) throw new Error('Не удалось открыть диалог.');
        patchPeoplePerson(id, {
          relationStatus: PEOPLE_RELATION_STATUS.FRIEND,
          status: 'connected',
          direction: '',
          dialogId: data.dialogId,
        });
        onOpenDialog?.(data.dialogId);
      })
      .catch(e => setConnectionError(e?.message || 'Не удалось открыть диалог.'));
  }, [onOpenDialog, patchPeoplePerson]);
  const openPersonProfile = useCallback((person) => {
    if (!person?.id) return;
    setPeopleSheet(person);
    setConnectionTarget({
      target: person,
      status: person.relationStatus,
      action: person.relationStatus === PEOPLE_RELATION_STATUS.FRIEND ? 'message' : 'request',
      dialogId: person.dialogId || '',
      shared: person.shared || { contacts: [], events: [], partners: [] },
    });
  }, []);
  const togglePinnedPerson = useCallback((personId) => {
    const id = String(personId || '').trim();
    if (!id) return;
    setPinnedPeopleIds(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [id, ...prev].slice(0, 24);
      try {
        localStorage.setItem(`apg_people_pins_${String(user?.id || 'guest')}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [user?.id]);
  const runPersonPrimaryAction = useCallback((person) => {
    if (!person?.id) return;
    if (person.relationStatus === PEOPLE_RELATION_STATUS.FRIEND) {
      if (person.dialogId) onOpenDialog?.(person.dialogId);
      else openPersonDialog(person);
      return;
    }
    if (person.relationStatus === PEOPLE_RELATION_STATUS.INCOMING && person.request?.id) {
      updateConnectionRequest(person.request.id, 'accepted');
      return;
    }
    if (person.relationStatus === PEOPLE_RELATION_STATUS.STRANGER) {
      requestConnection(person.id, 'people');
    }
  }, [onOpenDialog, openPersonDialog, requestConnection, updateConnectionRequest]);
  const handleDesktopReschedule = useCallback((item) => {
    const startAt = prompt('Новая дата и время в формате YYYY-MM-DD HH:mm');
    if (!startAt) return;
    const start = new Date(String(startAt).trim().replace(' ', 'T'));
    if (Number.isNaN(start.getTime())) return alert('Не удалось распознать дату.');
    const duration = Number(item.durationMinutes || 60);
    runBookingAction('booking:requestReschedule', item, { slot: { startAt: start.toISOString(), endAt: new Date(start.getTime() + duration * 60000).toISOString() }, reason: 'Запрос пользователя' });
  }, [runBookingAction]);
  const handleDesktopCancel = useCallback((item) => {
    if (!confirm('Отменить запись?')) return;
    const reason = prompt('Причина отмены, если хотите указать') || '';
    runBookingAction('booking:cancel', item, { reason });
  }, [runBookingAction]);

  if (variant === 'v2') {
    const displayName = safeUser.displayName || [safeUser.first_name, safeUser.last_name].filter(Boolean).join(' ') || 'Участник АПГ';
    const toNext = getKeysToNext(userKeys);
    const pct = getLevelProgress(userKeys);
    const nextLabel = nextLevel ? `До ${nextLevel.label}: ${toNext} ключей` : 'Максимальный уровень';
    const primaryActions = [
      { label: 'Активность', icon: '◷', onClick: onOpenActivity },
      { label: 'Рефералы', icon: '↗', onClick: onOpenReferral },
      ownedPartner && { label: 'Кабинет партнера', icon: '◆', onClick: onOpenPartnerCabinet },
      ownedExpert && { label: 'Кабинет эксперта', icon: '✦', onClick: onOpenExpertCabinet },
    ].filter(Boolean);

    if (desktopMode) {
      const roleLabels = [
        ownedPartner ? 'Партнёр' : '',
        ownedExpert ? 'Эксперт' : '',
      ].filter(Boolean);
      const roleLabel = roleLabels.length ? roleLabels.join(' · ') : 'Участник';
      const profileAbout = dpText(user?.about || user?.bio || user?.description);
      const joinedText = profileDateText(user?.createdAt || user?.joinedAt || user?.registeredAt || user?.firstSeenAt);
      const activeBookings = [
        ...bookingGroups.pending,
        ...bookingGroups.actionRequired,
        ...bookingGroups.upcoming,
      ].slice(0, 4);
      const nextAchievement = achievements.find(item => !item.unlocked);
      const unlockedPreview = achievements.filter(item => item.unlocked).slice(0, 4);
      const desktopModals = (
        <>
          {showProfileEditor && createPortal(
            <DesktopProfileEditor
              user={user}
              onClose={() => setShowProfileEditor(false)}
              onSaved={(patch) => onUserUpdate?.(patch)}
            />,
            document.body
          )}
          {showEmailAuth && createPortal(
            <ApgModal
              title="Войти по почте"
              subtitle="Введите email, чтобы сохранить ключи, избранное и прогресс."
              onClose={() => setShowEmailAuth(false)}
            >
              <EmailAuth onCancel={() => setShowEmailAuth(false)} onSuccess={handleEmailAuthSuccess} />
            </ApgModal>,
            document.body
          )}
          {showShareModal && createPortal(
            <ShareModal
              user={user}
              userKeys={userKeys}
              streak={streak}
              scannedCount={scannedCount}
              completedTasks={completedTasks}
              unlockedAchievements={achievements.filter(a => a.unlocked).length}
              level={level}
              onClose={() => setShowShareModal(false)}
              onShareVK={async () => {
                const link = buildReferralLink(user);
                const msg = buildReferralInviteText(link);
                setShowShareModal(false);
                if (navigator.share) {
                  try { await navigator.share({ title: 'АПГ — Альянс Партнёров Города', text: msg }); return; } catch (err) { if (err.name === 'AbortError') return; }
                }
                vkBridge.send('VKWebAppShare', { link, text: msg }).catch(() => {});
              }}
            />,
            document.body
          )}
        </>
      );

      return (
        <div data-desktop-user-profile style={{ minHeight: '100svh', background: DP.bg, color: DP.text, padding: '18px clamp(20px, 3vw, 44px) 44px', boxSizing: 'border-box', overflowX: 'clip' }}>
          {achievementToast && (
            <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 700, ...dpCard({ width: 'min(520px, calc(100vw - 32px))', padding: 14, display: 'flex', gap: 12, alignItems: 'center', animation: toastExiting ? 'achievementOut 0.3s ease both' : 'achievementPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }) }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: achievementToast.color + '24', display: 'grid', placeItems: 'center', fontSize: 22 }}>{achievementToast.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: DP.gold, fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0 }}>Новое достижение</div>
                <div style={{ color: DP.text, fontSize: 15, fontWeight: 880 }}>{achievementToast.title}</div>
              </div>
              <button type="button" onClick={dismissToast} style={dpButton('light', { width: 36, height: 36, minHeight: 36, padding: 0 })}>×</button>
            </div>
          )}

          <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 16 }}>
            {desktopOverview ? <DesktopTopOverview {...desktopOverview} activeSection="profile" /> : null}
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2px' }}>
              <button type="button" onClick={() => onBack?.()} style={{ ...dpButton('light', { minHeight: 36, background: 'transparent', borderColor: 'transparent', padding: '6px 8px' }) }}>← В приложение</button>
              <div style={{ width: 1, height: 18, background: DP.border }} />
              <div style={{ color: DP.muted, fontSize: 12.5, fontWeight: 760 }}>Личный кабинет</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button type="button" onClick={onOpenReference} aria-label="Справка о профиле" style={dpButton('light', { width: 38, height: 38, minHeight: 38, padding: 0 })}>?</button>
                <button type="button" onClick={() => setShowProfileEditor(true)} style={dpButton('primary', { minHeight: 38, padding: '8px 14px' })}>Редактировать профиль</button>
              </div>
            </header>

            <section style={dpCard({ padding: 0, overflow: 'hidden', position: 'relative', background: 'radial-gradient(circle at 92% 5%, rgba(201,168,76,0.18), transparent 36%), radial-gradient(circle at 5% 100%, rgba(74,144,217,0.10), transparent 34%), linear-gradient(145deg, var(--apg2-control-strong, rgba(255,255,255,0.90)), var(--apg2-control, rgba(255,255,255,0.68)))' })}>
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(430px,0.85fr)', gap: 30, alignItems: 'stretch', padding: '30px 32px 26px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '152px minmax(0,1fr)', gap: 26, alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: 152, height: 152 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 44, background: 'linear-gradient(145deg,rgba(200,155,60,0.22),rgba(255,255,255,0.46))', border: '1px solid rgba(200,155,60,0.28)', display: 'grid', placeItems: 'center', color: DP.gold, fontSize: 48, fontWeight: 950, boxShadow: '0 24px 58px rgba(31,26,20,0.14), inset 0 1px 0 rgba(255,255,255,0.62)' }}>{displayName[0] || 'А'}</div>
                    {profileAvatarUrl && <img src={profileAvatarUrl} alt="" loading="eager" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 44, objectFit: 'cover', border: '3px solid rgba(200,155,60,0.32)', boxSizing: 'border-box', boxShadow: '0 24px 58px rgba(31,26,20,0.16)' }} />}
                    <button type="button" onClick={() => setShowProfileEditor(true)} aria-label="Изменить фотографию" style={{ position: 'absolute', right: -5, bottom: 8, width: 42, height: 42, borderRadius: 16, border: `1px solid ${DP.border}`, background: DP.controlStrong, color: DP.text, boxShadow: '0 12px 28px var(--apg2-elev-shadow, rgba(31,26,20,0.15))', cursor: 'pointer', fontSize: 15 }}>✎</button>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#4BB34B', fontSize: 10.5, lineHeight: '13px', fontWeight: 850, letterSpacing: 0.7, textTransform: 'uppercase' }}><span aria-hidden="true">●</span> Активный участник</div>
                    <h1 style={{ margin: '7px 0 0', color: DP.text, fontSize: 36, lineHeight: '41px', fontWeight: 950, letterSpacing: -0.8, overflowWrap: 'anywhere' }}>{displayName}</h1>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 9 }}>
                      <span style={{ borderRadius: 999, background: DP.goldSoft, color: DP.gold, padding: '6px 10px', fontSize: 11.5, lineHeight: '14px', fontWeight: 850 }}>{roleLabel}</span>
                      <span style={{ color: DP.soft, fontSize: 12, lineHeight: '16px', fontWeight: 760 }}>{level.label} · {userKeys} ключей</span>
                    </div>
                    <div style={{ color: DP.soft, fontSize: 14, lineHeight: '21px', marginTop: 13, maxWidth: 520 }}>{profileAbout || 'Расскажите немного о себе, чтобы участникам АПГ было проще познакомиться с вами.'}</div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14, color: DP.muted, fontSize: 11.5, lineHeight: '15px', fontWeight: 680 }}>
                      {ownedPartner?.name && <span>Партнёр · {ownedPartner.name}</span>}
                      {ownedExpert?.name && <span>Эксперт · {ownedExpert.name}</span>}
                      {joinedText && <span>В АПГ с {joinedText}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, paddingLeft: 28, borderLeft: `1px solid ${DP.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'end', padding: '2px 2px 12px' }}>
                    <div>
                      <div style={{ color: DP.muted, fontSize: 10.5, fontWeight: 820, letterSpacing: 0.8, textTransform: 'uppercase' }}>Городской баланс</div>
                      <div style={{ color: DP.text, fontSize: 42, lineHeight: '46px', fontWeight: 950, marginTop: 4 }}>{userKeys}</div>
                      <div style={{ color: DP.gold, fontSize: 11.5, fontWeight: 820 }}>ключей АПГ</div>
                    </div>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: DP.soft, fontSize: 11, lineHeight: '14px', fontWeight: 760, marginBottom: 7 }}><span>{nextLevel ? `До ${nextLevel.label}` : 'Максимальный уровень'}</span><b style={{ color: DP.gold }}>{pct}%</b></div>
                      <DesktopProgress value={pct} color={level.color || DP.gold} />
                      <div style={{ color: DP.muted, fontSize: 10.5, lineHeight: '14px', marginTop: 6 }}>{nextLevel ? `Осталось ${toNext} ключей` : 'Все уровни открыты'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', borderRadius: 18, border: `1px solid ${DP.border}`, background: DP.controlSoft, overflow: 'hidden' }}>
                    {[
                      ['Уровень', level.label],
                      ['Достижения', `${unlockedCount}/${achievements.length}`],
                      ['Избранное', favorites.length],
                      ['Записи', activeBookings.length],
                    ].map(([label, value], index) => (
                      <div key={label} style={{ minWidth: 0, padding: '13px 10px', textAlign: 'center', borderLeft: index ? `1px solid ${DP.border}` : 0 }}>
                        <div style={{ color: DP.text, fontSize: typeof value === 'number' ? 21 : 15, lineHeight: '24px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                        <div style={{ color: DP.muted, fontSize: 10.2, lineHeight: '13px', fontWeight: 730, marginTop: 4 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(360px, 0.75fr)', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <DesktopSection
                  title="Мои записи"
                  icon="📅"
                  action={<button type="button" onClick={onOpenActivity} style={dpButton('light', { minHeight: 32, padding: '6px 10px', fontSize: 12 })}>Все записи →</button>}
                >
                  {!activeBookings.length ? (
                    <DesktopEmpty title="Записей пока нет" text="Когда вы запишетесь к партнёру или эксперту, ближайшие встречи появятся здесь." />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
                      {activeBookings.map(item => <DesktopBookingRow key={item.id || item.bookingId} item={item} onDialog={onOpenBookingDialog || onOpenDialog} onReschedule={handleDesktopReschedule} onCancel={handleDesktopCancel} onReview={onOpenBookingReview} />)}
                    </div>
                  )}
                </DesktopSection>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,0.88fr)', gap: 16 }}>
                  <DesktopSection
                    title="Избранное"
                    icon="★"
                    action={favoritePartners.length > 0 ? <span style={{ color: DP.muted, fontSize: 12 }}>{favoritePartners.length}</span> : null}
                  >
                    {!favoritePartners.length ? (
                      <DesktopEmpty title="Пока пусто" text="Добавляйте места сердцем, чтобы быстро возвращаться к ним." />
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {favoritePartners.slice(0, 4).map(item => <DesktopFavoriteRow key={item.id} item={item} onOpen={onOpenPartner} />)}
                      </div>
                    )}
                  </DesktopSection>

                  <DesktopSection
                    title="Сохранённые материалы"
                    icon="📰"
                    action={<button type="button" onClick={() => onOpenNews?.()} style={dpButton('light', { minHeight: 32, padding: '6px 10px', fontSize: 12 })}>Открыть →</button>}
                  >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: DP.soft, fontSize: 12 }}>
                      <span>{savedNews.length} сохранено</span>
                      <span>·</span>
                      <span>{readLaterNews.length} на потом</span>
                    </div>
                    {!savedNewsItems.length ? (
                      <DesktopEmpty title="Материалов нет" text="Сохраняйте новости, чтобы вернуться к ним позже." />
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {savedNewsItems.slice(0, 2).map(item => <DesktopNewsRow key={item.id} item={item} onOpen={onOpenNews} />)}
                      </div>
                    )}
                  </DesktopSection>
                </div>

                <DesktopSection title="Контакты" icon="☎">
                  {!contactRows.length ? (
                    <DesktopEmpty title="Контакты не заполнены" text="Добавьте контакты через редактирование профиля." />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                      {contactRows.map(row => (
                        <a key={row.id} href={row.href} target={row.id === 'email' || row.id === 'phone' ? undefined : '_blank'} rel="noreferrer" style={{ ...dpButton('light', { justifyContent: 'space-between', minHeight: 48, padding: '8px 10px' }) }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', color: DP.text, fontSize: 12.5, fontWeight: 850 }}>{row.label}</span>
                            <span style={{ display: 'block', color: DP.soft, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                          </span>
                          <span>{row.icon}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </DesktopSection>
              </div>

              <aside style={{ display: 'grid', gap: 16 }}>
                <DesktopSection title="Ключи и достижения" icon="🗝">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ borderRadius: 8, border: `1px solid ${DP.border}`, background: DP.controlSoft, padding: 12 }}>
                      <div style={{ color: DP.soft, fontSize: 12, fontWeight: 820 }}>Ключи</div>
                      <div style={{ color: DP.text, fontSize: 27, lineHeight: '32px', fontWeight: 950, marginTop: 6 }}>{userKeys}</div>
                      <DesktopProgress value={pct} color={level.color || DP.gold} />
                      <div style={{ color: DP.muted, fontSize: 11.5, lineHeight: '16px', marginTop: 6 }}>{nextLevel ? `До следующего уровня: ${toNext} ключей` : 'Максимальный уровень'}</div>
                    </div>
                    <div style={{ borderRadius: 8, border: `1px solid ${DP.border}`, background: DP.controlSoft, padding: 12 }}>
                      <div style={{ color: DP.soft, fontSize: 12, fontWeight: 820 }}>Достижения</div>
                      <div style={{ color: DP.text, fontSize: 27, lineHeight: '32px', fontWeight: 950, marginTop: 6 }}>{unlockedCount}/{achievements.length}</div>
                      <DesktopProgress value={achievements.length ? unlockedCount / achievements.length * 100 : 0} />
                      <div style={{ color: DP.muted, fontSize: 11.5, lineHeight: '16px', marginTop: 6 }}>{nextAchievement ? `Ближайшее: ${nextAchievement.title}` : 'Все открыты'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {(unlockedPreview.length ? unlockedPreview : achievements.slice(0, 3)).map(item => (
                      <div key={item.id} style={{ width: 70, display: 'grid', gap: 6, justifyItems: 'center', opacity: item.unlocked ? 1 : 0.42, filter: item.unlocked ? 'none' : 'grayscale(1)' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: item.unlocked ? `${item.color}22` : DP.controlSoft, border: `1px solid ${item.unlocked ? `${item.color}55` : DP.border}`, display: 'grid', placeItems: 'center', fontSize: 21 }}>{item.emoji}</div>
                        <div style={{ color: item.unlocked ? DP.text : DP.muted, fontSize: 11, lineHeight: '14px', textAlign: 'center', fontWeight: 760 }}>{item.title}</div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={onOpenReference} style={dpButton('light', { width: 'fit-content', minHeight: 34, padding: '7px 11px', fontSize: 12 })}>Подробнее о ключах →</button>
                </DesktopSection>

                <DesktopSection title="Быстрые действия" icon="⚡">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 9 }}>
                    {quickActions.map(action => (
                      <button key={action.id} type="button" onClick={action.onClick} style={dpButton('light', { minHeight: 58, flexDirection: 'column', gap: 5, padding: 8, fontSize: 12 })}>
                        <span style={{ color: DP.gold, fontSize: 18 }}>{action.icon}</span>
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                </DesktopSection>

                <DesktopSection title="Аккаунт" icon="☰">
                  <div style={{ display: 'grid', gap: 9 }}>
                    <button type="button" onClick={() => setShowShareModal(true)} style={dpButton('light', { justifyContent: 'space-between' })}>Поделиться АПГ <span>↗</span></button>
                    <button type="button" onClick={handleWriteAdmin} style={dpButton('light', { justifyContent: 'space-between' })}>Написать в поддержку <span>↗</span></button>
                    {!isGuest && <button type="button" onClick={onLogout} style={dpButton('danger', { justifyContent: 'space-between' })}>Выйти <span>→</span></button>}
                    {isGuest && <button type="button" onClick={() => setShowEmailAuth(true)} style={dpButton('primary')}>Войти по email</button>}
                  </div>
                </DesktopSection>
              </aside>
            </div>
          </div>
          {desktopModals}
        </div>
      );
    }

    return (
      <GlassPanel>
        {achievementToast && (
          <div style={{ position: 'fixed', top: 60, left: 16, right: 16, zIndex: 700, ...APG2.glass, borderRadius: 24, padding: 15, display: 'flex', gap: 13, alignItems: 'center', animation: toastExiting ? 'achievementOut 0.3s ease both' : 'achievementPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div style={{ width: 50, height: 50, borderRadius: 18, background: achievementToast.color + '24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{achievementToast.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: APG2.gold, fontSize: 11, fontWeight: 820, textTransform: 'uppercase', letterSpacing: 1 }}>Новое достижение</div>
              <div style={{ color: APG2.text, fontSize: 16, fontWeight: 840 }}>{achievementToast.title}</div>
            </div>
            <button type="button" onClick={dismissToast} style={{ ...APG2.glass, width: 38, height: 38, borderRadius: 16, color: APG2.text }}>✕</button>
          </div>
        )}

        <section style={{ position: 'relative', minHeight: 216, borderRadius: 32, overflow: 'hidden', ...APG2.glass, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 72% 12%, ${level.color}33, transparent 34%), radial-gradient(circle at 20% 0%, rgba(215,184,106,0.2), transparent 28%)` }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
            <GlassBadge tone="gold">{level.emoji} {level.label}</GlassBadge>
            <GlassButton onClick={() => setShowShareModal(true)} style={{ minHeight: 38, borderRadius: 17, padding: '8px 12px' }}>↗</GlassButton>
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {profileAvatarUrl
                ? <img src={profileAvatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: 56, height: 56, borderRadius: 21, objectFit: 'cover', border: '2px solid rgba(215,184,106,0.48)', boxShadow: '0 14px 34px rgba(0,0,0,0.30)' }} />
                : <div style={{ width: 56, height: 56, borderRadius: 21, background: 'linear-gradient(145deg,rgba(215,184,106,0.3),rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: APG2.text, fontSize: 23, fontWeight: 850 }}>{displayName[0]}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: APG2.text, fontSize: 21, lineHeight: '25px', fontWeight: 850, overflowWrap: 'anywhere' }}>{displayName}</div>
                <div style={{ color: APG2.textSoft, fontSize: 13, marginTop: 5 }}>Ваш прогресс в городе</div>
              </div>
            </div>
            <div style={{ ...APG2.glass, borderRadius: 22, padding: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: APG2.textSoft, fontSize: 12, marginBottom: 8 }}>
                <span>{userKeys} ключей</span>
                <span>{nextLabel}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'linear-gradient(135deg,#FFF0B8,#D9B965,#9F7932,#F4D98C)', boxShadow: '0 0 26px rgba(215,184,106,0.34)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        </section>

        {showPartnershipCard && (
          <section style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 30,
            padding: 18,
            ...APG2.glass,
            border: '1px solid rgba(201,168,76,0.30)',
            background: 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(74,144,217,0.10), rgba(255,255,255,0.08))',
            boxShadow: '0 18px 44px rgba(15,15,26,0.18), inset 0 1px 0 rgba(255,255,255,0.26)',
            animation: 'fadeInUp 0.42s ease both',
          }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 8% 0%, rgba(201,168,76,0.24), transparent 34%), radial-gradient(circle at 96% 18%, rgba(74,144,217,0.20), transparent 30%)' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 14 }}>
              <div>
                <div style={{ color: APG2.gold, fontSize: 11, lineHeight: '15px', fontWeight: 900, letterSpacing: 1.1, textTransform: 'uppercase' }}>Подключение к АПГ</div>
                <h2 style={{ margin: '7px 0 0', color: APG2.text, fontSize: 22, lineHeight: '27px', fontWeight: 950 }}>🤝 Развивайте своё дело вместе с АПГ</h2>
                <p style={{ margin: '8px 0 0', color: APG2.textSoft, fontSize: 13.5, lineHeight: '21px' }}>Получайте новых клиентов, участвуйте в мероприятиях, публикуйте новости, проводите акции и станьте частью крупнейшего городского сообщества предпринимателей и экспертов.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => openPartnershipFlow('partner')}
                  style={{
                    minHeight: 58,
                    borderRadius: 20,
                    border: '1px solid rgba(74,144,217,0.42)',
                    background: 'linear-gradient(135deg, rgba(74,144,217,0.22), rgba(74,144,217,0.10))',
                    color: APG2.text,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 12px 26px rgba(74,144,217,0.13)',
                  }}
                >
                  🟦 Стать партнёром
                </button>
                <button
                  type="button"
                  onClick={() => openPartnershipFlow('expert')}
                  style={{
                    minHeight: 58,
                    borderRadius: 20,
                    border: '1px solid rgba(201,168,76,0.46)',
                    background: 'linear-gradient(135deg, rgba(201,168,76,0.28), rgba(201,168,76,0.12))',
                    color: APG2.text,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 12px 28px rgba(201,168,76,0.16)',
                  }}
                >
                  🟨 Стать экспертом
                </button>
              </div>
            </div>
          </section>
        )}

        <GlassSection title="Люди">
          <GlassCard data-people-panel data-people-compact-card data-connections-panel data-connections-dev-panel style={{ display: 'grid', gap: 12, borderRadius: 28, padding: 14, background: 'radial-gradient(circle at 8% 0%, rgba(74,144,217,0.15), transparent 38%), radial-gradient(circle at 96% 8%, rgba(201,168,76,0.13), transparent 36%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.16), rgba(var(--apg2-glass-a,255,255,255),0.065))' }}>
            <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 17, background: 'linear-gradient(145deg, rgba(74,144,217,0.24), rgba(201,168,76,0.14))', color: '#6AABEC', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 12px 26px rgba(74,144,217,0.12)' }}>👥</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: APG2.text, fontSize: 17, lineHeight: '21px', fontWeight: 930 }}>Люди рядом</div>
                <div style={{ color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 2 }}>Друзья, заявки и диалоги</div>
              </div>
              <GlassButton onClick={openPeopleNavigation} aria-label="Открыть всех людей" style={{ width: 38, minWidth: 38, minHeight: 38, borderRadius: 15, padding: 0, fontSize: 17 }}>→</GlassButton>
            </div>
            {connectionTarget?.target && (
              <div data-connection-target-card style={{ borderRadius: 18, border: '1px solid rgba(74,144,217,0.24)', background: 'rgba(74,144,217,0.08)', padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {connectionTarget.target.photo
                    ? <img src={connectionTarget.target.photo} alt="" style={{ width: 44, height: 44, borderRadius: 16, objectFit: 'cover' }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 16, background: APG2.goldSoft, color: APG2.gold, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{(connectionTarget.target.displayName || 'А')[0]}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: APG2.text, fontSize: 14, fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connectionTarget.target.displayName}</div>
                    <div style={{ color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px' }}>{connectionTarget.reason === 'manual_request_available' ? 'Можно отправить запрос на знакомство' : connectionTarget.reason || 'Профиль АПГ'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(connectionTarget.action === 'message' || connectionTarget.status === 'connected') && connectionTarget.dialogId
                    ? <GlassButton tone="gold" onClick={() => onOpenDialog?.(connectionTarget.dialogId)} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px', fontSize: 12 }}>💬 Написать</GlassButton>
                    : connectionTarget.action === 'pending' || connectionTarget.status === 'pending'
                      ? <GlassButton disabled style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px', fontSize: 12 }}>Запрос отправлен</GlassButton>
                      : <GlassButton tone="gold" onClick={() => requestConnection(connectionTarget.target.id, 'qr')} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px', fontSize: 12 }}>🤝 Познакомиться</GlassButton>
                  }
                </div>
              </div>
            )}
            <div data-people-compact-summary style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
              {[
                ['Друзья', peopleCounts.friends],
                ['Диалоги', peopleCounts.dialogs],
                ['Заявки', incomingConnectionRequests.length + outgoingConnectionRequests.length],
              ].map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setPeopleTab(label === 'Друзья' ? 'friends' : label === 'Диалоги' ? 'dialogs' : 'requests');
                    openPeopleNavigation();
                  }}
                  style={{ minWidth: 0, minHeight: 52, borderRadius: 17, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.055)', color: APG2.text, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 5px', textAlign: 'center' }}
                >
                  <span style={{ display: 'block', color: value ? APG2.gold : APG2.textSoft, fontSize: 17, lineHeight: '19px', fontWeight: 930 }}>{value}</span>
                  <span style={{ display: 'block', color: APG2.textMuted, fontSize: 10, lineHeight: '13px', fontWeight: 760, marginTop: 2 }}>{label}</span>
                </button>
              ))}
            </div>
            {peopleSections.priority.length > 0 && (
              <div data-people-compact-recent style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center' }}>
                  {peopleSections.priority.slice(0, 4).map((person, index) => (
                    <button
                      key={`compact:${person.id}`}
                      type="button"
                      aria-label={`Открыть профиль: ${person.displayName}`}
                      onClick={() => person.dialogId ? onOpenDialog?.(person.dialogId) : openPersonProfile(person)}
                      style={{ width: 38, height: 38, padding: 0, marginLeft: index ? -8 : 0, borderRadius: 15, border: '2px solid rgba(18,18,20,0.82)', background: 'transparent', overflow: 'hidden', cursor: 'pointer', position: 'relative', zIndex: 5 - index }}
                    >
                      <PeopleAvatar person={person} size={34} radius={12} />
                    </button>
                  ))}
                  <div style={{ minWidth: 0, marginLeft: 9 }}>
                    <div style={{ color: APG2.text, fontSize: 12.5, lineHeight: '16px', fontWeight: 840 }}>Важные контакты</div>
                    <div style={{ color: APG2.textMuted, fontSize: 10.5, lineHeight: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peopleSections.nextBestAction}</div>
                  </div>
                </div>
                <GlassButton onClick={openPeopleNavigation} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 11.5 }}>Открыть</GlassButton>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <GlassButton data-my-contacts-button onClick={openPeopleNavigation} style={{ flex: 1, minHeight: 38, borderRadius: 15, padding: '8px 11px', fontSize: 12 }}>Все люди</GlassButton>
            </div>
            <div aria-hidden="true" style={{ display: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                ['Друзья', peopleCounts.friends],
                ['Диалоги', peopleCounts.dialogs],
                ['Запросы', incomingConnectionRequests.length + outgoingConnectionRequests.length],
              ].map(([label, value]) => (
                <div key={label} style={{ borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)', background: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.10), rgba(var(--apg2-glass-a,255,255,255),0.045))', padding: 11, textAlign: 'center', boxShadow: '0 10px 24px rgba(0,0,0,0.08)' }}>
                  <div style={{ color: value ? APG2.gold : APG2.text, fontSize: 20, lineHeight: '23px', fontWeight: 940 }}>{value}</div>
                  <div style={{ color: APG2.textMuted, fontSize: 10.5, lineHeight: '14px', marginTop: 3, fontWeight: 760 }}>{label}</div>
                </div>
              ))}
            </div>
            <div data-people-pulse style={{ borderRadius: 24, padding: 13, border: '1px solid rgba(74,144,217,0.22)', background: 'radial-gradient(circle at 12% 0%, rgba(74,144,217,0.16), transparent 36%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.10), rgba(var(--apg2-glass-a,255,255,255),0.045))', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ color: '#6AABEC', fontSize: 11, lineHeight: '14px', fontWeight: 920, textTransform: 'uppercase', letterSpacing: 0.7 }}>Пульс сети</div>
                  <div style={{ color: APG2.text, fontSize: 15, lineHeight: '20px', fontWeight: 910, marginTop: 2 }}>{peopleSections.nextBestAction}</div>
                  <div style={{ color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 2 }}>{peopleSections.healthLabel}</div>
                </div>
                <GlassButton onClick={openPeopleNavigation} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Все люди</GlassButton>
              </div>
              {peopleSections.priority.length > 0 && (
                <div data-people-priority-strip style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {peopleSections.priority.slice(0, 6).map(person => (
                    <div key={`pulse:${person.id}`} role="button" tabIndex={0} onClick={() => person.dialogId ? onOpenDialog?.(person.dialogId) : openPersonProfile(person)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPersonProfile(person); }} style={{ width: 152, flex: '0 0 152px', border: `1px solid ${person.pulseTone === 'gold' ? 'rgba(201,168,76,0.28)' : 'rgba(74,144,217,0.22)'}`, background: person.pulseTone === 'gold' ? 'linear-gradient(145deg, rgba(201,168,76,0.13), rgba(var(--apg2-glass-a,255,255,255),0.055))' : 'linear-gradient(145deg, rgba(74,144,217,0.12), rgba(var(--apg2-glass-a,255,255,255),0.05))', borderRadius: 18, padding: 10, display: 'grid', gap: 8, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <PeopleAvatar person={person} size={34} radius={13} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: APG2.text, fontSize: 12.5, lineHeight: '16px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</div>
                          <div style={{ color: person.pulseTone === 'gold' ? APG2.gold : '#6AABEC', fontSize: 10.5, lineHeight: '14px', marginTop: 1, fontWeight: 780, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.pulseReason}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {connectionLoading && <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '17px' }}>Синхронизируем знакомства...</div>}
            {connectionError && <div style={{ color: '#E64646', fontSize: 12, lineHeight: '17px' }}>{connectionError}</div>}
            <GlassInput
              data-people-search
              value={peopleSearch}
              onChange={e => setPeopleSearch(e.target.value)}
              placeholder="Найти человека, компанию, роль или город"
              style={{ minHeight: 48, borderRadius: 20, fontSize: 14 }}
            />
            <div data-people-tabs style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {PEOPLE_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeopleTab(tab.id)}
                  style={{ minHeight: 38, borderRadius: 999, border: `1px solid ${peopleTab === tab.id ? 'rgba(201,168,76,0.48)' : 'rgba(var(--apg2-glass-a,255,255,255),0.13)'}`, background: peopleTab === tab.id ? 'linear-gradient(135deg, rgba(201,168,76,0.24), rgba(201,168,76,0.10))' : 'rgba(var(--apg2-glass-a,255,255,255),0.065)', color: peopleTab === tab.id ? APG2.gold : APG2.textSoft, padding: '8px 12px', fontSize: 12, fontWeight: 850, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: peopleTab === tab.id ? '0 10px 24px rgba(201,168,76,0.12)' : 'none' }}
                >
                  {tab.label} {peopleCounts[tab.id] ? peopleCounts[tab.id] : ''}
                </button>
              ))}
            </div>
            {!peopleSearch.trim() && (
              <div data-people-smart-sections style={{ display: 'grid', gap: 13 }}>
                {peopleSections.favorites.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 900 }}>⭐ Избранные</div>
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                      {peopleSections.favorites.slice(0, 8).map(person => (
                        <button key={person.id} type="button" onClick={() => person.relationStatus === PEOPLE_RELATION_STATUS.FRIEND && person.dialogId ? onOpenDialog?.(person.dialogId) : openPersonProfile(person)} style={{ width: 92, flex: '0 0 92px', border: '1px solid rgba(201,168,76,0.24)', background: 'linear-gradient(145deg, rgba(201,168,76,0.12), rgba(var(--apg2-glass-a,255,255,255),0.055))', borderRadius: 20, padding: 9, display: 'grid', justifyItems: 'center', gap: 7, fontFamily: 'inherit', cursor: 'pointer', animation: 'fadeInUp 0.28s ease both', boxShadow: '0 10px 24px rgba(0,0,0,0.08)' }}>
                          <PeopleAvatar person={person} size={44} radius={17} />
                          <div style={{ color: APG2.text, fontSize: 11.5, lineHeight: '14px', fontWeight: 820, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {peopleSections.recentGroups.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 900 }}>🟢 Недавние</div>
                    {peopleSections.recentGroups.slice(0, 3).map(group => (
                      <div key={group.id} style={{ display: 'grid', gap: 6 }}>
                        <div style={{ color: APG2.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 760 }}>{group.label}</div>
                        {group.rows.slice(0, 2).map(person => (
                          <button key={`${group.id}:${person.id}`} type="button" onClick={() => person.dialogId ? onOpenDialog?.(person.dialogId) : openPersonProfile(person)} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)', background: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.085), rgba(var(--apg2-glass-a,255,255,255),0.042))', borderRadius: 18, padding: 10, display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', animation: 'fadeInUp 0.3s ease both' }}>
                            <PeopleAvatar person={person} size={36} radius={14} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: APG2.text, fontSize: 12.5, lineHeight: '16px', fontWeight: 830, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</div>
                              <div style={{ color: APG2.textMuted, fontSize: 10.8, lineHeight: '14px', marginTop: 1 }}>{peopleContextLine(person) || 'Недавний диалог'}</div>
                            </div>
                            <span style={{ color: APG2.gold, fontSize: 14 }}>💬</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {peopleSections.friends.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 900 }}>👥 Друзья</div>
                    {peopleSections.friends.slice(0, 3).map(person => (
                      <button key={person.id} type="button" onClick={() => person.dialogId ? onOpenDialog?.(person.dialogId) : openPersonProfile(person)} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)', background: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.085), rgba(var(--apg2-glass-a,255,255,255),0.042))', borderRadius: 18, padding: 10, display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', animation: 'fadeInUp 0.32s ease both' }}>
                        <PeopleAvatar person={person} size={38} radius={15} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: APG2.text, fontSize: 12.8, lineHeight: '17px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</div>
                          <div style={{ color: APG2.textMuted, fontSize: 10.8, lineHeight: '15px' }}>{peopleContextLine(person) || 'Друг АПГ'}</div>
                        </div>
                        <span style={{ color: APG2.gold, fontSize: 14 }}>💬</span>
                      </button>
                    ))}
                  </div>
                )}
                {peopleSections.suggestions.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 900 }}>✨ Возможно, вы знакомы</div>
                    {peopleSections.suggestions.slice(0, 3).map(person => (
                      <div key={person.id} role="button" tabIndex={0} onClick={() => openPersonProfile(person)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPersonProfile(person); }} style={{ border: '1px solid rgba(74,144,217,0.22)', background: 'linear-gradient(145deg, rgba(74,144,217,0.12), rgba(var(--apg2-glass-a,255,255,255),0.05))', borderRadius: 18, padding: 11, display: 'flex', gap: 11, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', animation: 'fadeInUp 0.34s ease both', boxShadow: '0 10px 24px rgba(74,144,217,0.08)' }}>
                        <PeopleAvatar person={person} size={40} radius={15} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</div>
                          <div style={{ color: '#4A90D9', fontSize: 11, lineHeight: '15px', marginTop: 1, fontWeight: 780 }}>{peopleSuggestionReason(person)}</div>
                        </div>
                        <GlassButton onClick={(e) => { e.stopPropagation(); requestConnection(person.id, 'suggestion'); }} tone="gold" style={{ minHeight: 30, borderRadius: 13, padding: '5px 9px', fontSize: 11 }}>Добавить</GlassButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {incomingConnectionRequests.slice(0, 3).map(item => (
              <div key={item.id} style={{ borderRadius: 16, padding: 10, border: '1px solid rgba(201,168,76,0.22)', background: 'rgba(201,168,76,0.08)', display: 'grid', gap: 8 }}>
                <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 820 }}>{item.sender?.displayName || item.senderId || 'Участник АПГ'} хочет познакомиться</div>
                <div style={{ color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px' }}>{item.connectionSourceTitle || item.connectionSourceLabel || 'Ручной запрос'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <GlassButton onClick={() => updateConnectionRequest(item.id, 'accepted')} tone="gold" style={{ minHeight: 32, borderRadius: 14, padding: '6px 10px', fontSize: 12 }}>Принять</GlassButton>
                  <GlassButton onClick={() => updateConnectionRequest(item.id, 'declined')} style={{ minHeight: 32, borderRadius: 14, padding: '6px 10px', fontSize: 12 }}>Отклонить</GlassButton>
                </div>
              </div>
            ))}
            <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 900 }}>{peopleSearch.trim() ? 'Smart Search' : 'Все пользователи'}</div>
            {peopleSearchLoading && <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '17px' }}>Ищем участников...</div>}
            {visiblePeopleRows.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {visiblePeopleRows.slice(0, 4).map(person => {
                  const primaryLabel = person.relationStatus === PEOPLE_RELATION_STATUS.FRIEND ? 'Написать' : person.relationStatus === PEOPLE_RELATION_STATUS.INCOMING ? 'Принять' : person.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING ? 'Отправлено' : person.relationStatus === PEOPLE_RELATION_STATUS.BLOCKED ? 'Недоступно' : 'Добавить';
                  const primaryDisabled = person.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING || person.relationStatus === PEOPLE_RELATION_STATUS.BLOCKED;
                  const sharedSummary = peopleSharedSummary(person);
                  const suggestionReason = peopleSuggestionReason(person);
                  return (
                  <div key={person.id} data-people-card style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)', background: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.105), rgba(var(--apg2-glass-a,255,255,255),0.048))', borderRadius: 22, padding: 12, display: 'grid', gap: 10, boxShadow: '0 12px 28px rgba(0,0,0,0.10)' }}>
                    <button type="button" onClick={() => person.relationStatus === PEOPLE_RELATION_STATUS.FRIEND && person.dialogId ? onOpenDialog?.(person.dialogId) : openPersonProfile(person)} style={{ border: 0, background: 'transparent', padding: 0, display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <PeopleAvatar person={person} size={44} radius={17} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: APG2.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</div>
                      <div style={{ color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 1 }}>{peopleContextLine(person)}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                        <span style={peopleStatusChipStyle(person.relationStatus)}>{peopleStatusLabel(person.relationStatus)}</span>
                        {sharedSummary && <span style={{ color: '#6AABEC', background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.22)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, lineHeight: '13px', fontWeight: 820 }}>{sharedSummary}</span>}
                        {!sharedSummary && suggestionReason && <span style={{ color: '#6AABEC', background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.22)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, lineHeight: '13px', fontWeight: 820 }}>{suggestionReason}</span>}
                      </div>
                      {personInterestTags(person).length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                          {personInterestTags(person).slice(0, 3).map(tag => <span key={tag} style={{ color: APG2.textMuted, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', borderRadius: 999, padding: '3px 7px', fontSize: 10, lineHeight: '12px' }}>{tag}</span>)}
                        </div>
                      )}
                    </div>
                    </button>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <GlassButton onClick={() => runPersonPrimaryAction(person)} disabled={primaryDisabled} tone="gold" style={{ minHeight: 34, borderRadius: 15, padding: '7px 11px', fontSize: 12 }}>{primaryLabel}</GlassButton>
                      <GlassButton onClick={() => togglePinnedPerson(person.id)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 11px', fontSize: 12 }}>{pinnedPeopleIds.includes(String(person.id)) ? 'Открепить' : '⭐'}</GlassButton>
                      {person.phone && <GlassButton onClick={() => openUrl(`tel:${String(person.phone).replace(/[^\d+]/g, '')}`)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 11px', fontSize: 12 }}>Позвонить</GlassButton>}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div data-people-empty-state style={{ borderRadius: 20, border: '1px dashed rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.045)', padding: 13, display: 'grid', gap: 9 }}>
                <div style={{ color: APG2.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 880 }}>{peopleEmptyTitle(peopleTab, Boolean(peopleSearch.trim()))}</div>
                <div style={{ color: APG2.textMuted, fontSize: 12.5, lineHeight: '18px' }}>{peopleEmptyText(peopleTab, Boolean(peopleSearch.trim()))}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <GlassButton onClick={openPeopleNavigation} style={{ minHeight: 32, borderRadius: 14, padding: '6px 10px', fontSize: 12 }}>Открыть People Center</GlassButton>
                </div>
              </div>
            )}
            {peopleSearch.trim() && peopleGroups.filter(group => group.id !== 'people').slice(0, 3).map(group => (
              <div key={group.id} style={{ display: 'grid', gap: 6 }}>
                <div style={{ color: APG2.gold, fontSize: 11, lineHeight: '15px', fontWeight: 900, textTransform: 'uppercase' }}>{group.label}</div>
                {group.rows.slice(0, 2).map(row => (
                  <button key={row.id || row.name || row.title} type="button" onClick={() => row.address || row.category ? onOpenPartner?.(row) : undefined} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.05)', color: APG2.text, borderRadius: 14, padding: '9px 10px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
                    <div style={{ fontSize: 12.5, lineHeight: '17px', fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name || row.title || 'АПГ'}</div>
                    <div style={{ color: APG2.textMuted, fontSize: 11, lineHeight: '15px', marginTop: 2 }}>{row.category || row.city || row.description || 'Найдено в АПГ'}</div>
                  </button>
                ))}
              </div>
            ))}
            {visiblePeopleRows.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GlassButton data-my-contacts-button onClick={openPeopleNavigation} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px', fontSize: 12 }}>Открыть Люди</GlassButton>
            </div>
            )}
            </div>
          </GlassCard>
        </GlassSection>

        {isGuest && !isVK() && (
          <GlassSection title="Вход">
            <GlassCard style={{ display: 'grid', gap: 12 }}>
              <div style={{ color: APG2.text, fontSize: 17, fontWeight: 820, marginBottom: 6 }}>Войдите в АПГ</div>
              <div style={{ color: APG2.textMuted, fontSize: 14, lineHeight: '20px', marginBottom: 14 }}>Сохраните ключи, избранное и прогресс.</div>
              {!showEmailAuth && tgStep === 'idle' && !tgLoading && <GlassButton onClick={() => setShowEmailAuth(true)} tone="gold">Войти по email</GlassButton>}
              {!showEmailAuth && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--apg2-glass-border, rgba(255,255,255,0.14))' }} />
                    <span style={{ color: APG2.textMuted, fontSize: 12, fontWeight: 720 }}>или</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--apg2-glass-border, rgba(255,255,255,0.14))' }} />
                  </div>
                  <div style={{ borderRadius: 16, padding: '10px 12px', background: 'rgba(74,144,217,0.09)', border: '1px solid rgba(74,144,217,0.18)', color: APG2.textMuted, fontSize: 12.5, lineHeight: '17px', textAlign: 'center' }}>
                    Для первого входа рекомендуем использовать электронную почту. После этого Telegram можно привязать к аккаунту.
                  </div>
                  {tgLoading ? (
                    <GlassButton disabled><span style={{ color: '#26A8EA' }}>●</span>Создаём сессию...</GlassButton>
                  ) : tgStep === 'waiting' ? (
                    <div style={{ display: 'grid', gap: 9 }}>
                      <div style={{ color: '#26A8EA', fontSize: 13, lineHeight: '18px', fontWeight: 760, textAlign: 'center' }}>Ждём подтверждения в Telegram...</div>
                      <button type="button" onClick={() => openUrl(tgBotUrl)} style={{ ...APG2.glass, minHeight: 46, borderRadius: APG2.radius.button, padding: '11px 14px', color: '#26A8EA', border: APG2.glass.border, fontSize: 13.5, lineHeight: '18px', fontWeight: 760, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', cursor: 'pointer' }}>
                        <TelegramIcon />Открыть Telegram
                      </button>
                    </div>
                  ) : (
                    <GlassButton onClick={() => runTelegramAuth(false)} style={{ color: '#26A8EA' }}><TelegramIcon />Войти через Telegram</GlassButton>
                  )}
                  {tgError && <div style={{ color: '#E64646', fontSize: 12, lineHeight: '17px', textAlign: 'center' }}>{tgError}</div>}
                </>
              )}
            </GlassCard>
          </GlassSection>
        )}

        {!isGuest && !isVK() && (isEmailUser || isTelegramUser) && (
          <GlassSection title="Способы входа">
            <GlassCard style={{ display: 'grid', gap: 11 }}>
              {isEmailUser && (
                <>
                  <AccountMethodRow icon="✉️" title="Email" subtitle={userEmail} status="подключён" accent={APG2.gold} />
                  {user?.emailVerified === false && <EmailVerifyBanner userId={String(user.id)} />}
                  {linkedTelegram ? (
                    <AccountMethodRow icon={<TelegramIcon />} title="Telegram" subtitle={linkedTelegramName} status="привязан" accent="#26A8EA" />
                  ) : tgStep === 'linked' ? (
                    <AccountMethodRow icon={<TelegramIcon />} title="Telegram привязан" subtitle="Используется для быстрого входа" status="готово" accent="#26A8EA" />
                  ) : (
                    <div style={{ display: 'grid', gap: 9 }}>
                      <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px' }}>Telegram можно использовать для быстрого входа в АПГ без потери ключей и избранного.</div>
                      {tgLoading ? (
                        <GlassButton disabled><span style={{ color: '#26A8EA' }}>●</span>Создаём сессию...</GlassButton>
                      ) : tgStep === 'waiting' ? (
                        <>
                          <div style={{ color: '#26A8EA', fontSize: 13, lineHeight: '18px', fontWeight: 760, textAlign: 'center' }}>Ждём подтверждения в Telegram...</div>
                          <button type="button" onClick={() => openUrl(tgBotUrl)} style={{ ...APG2.glass, minHeight: 46, borderRadius: APG2.radius.button, padding: '11px 14px', color: '#26A8EA', border: APG2.glass.border, fontSize: 13.5, lineHeight: '18px', fontWeight: 760, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box', cursor: 'pointer' }}>
                            <TelegramIcon />Открыть Telegram
                          </button>
                        </>
                      ) : (
                        <GlassButton onClick={() => runTelegramAuth(true)} style={{ color: '#26A8EA' }}><TelegramIcon />Привязать Telegram</GlassButton>
                      )}
                      {tgError && <div style={{ color: '#E64646', fontSize: 12, lineHeight: '17px', textAlign: 'center' }}>{tgError}</div>}
                    </div>
                  )}
                </>
              )}

              {isTelegramUser && (
                <>
                  <AccountMethodRow icon={<TelegramIcon />} title="Telegram" subtitle={telegramDisplayName} status="основной" accent="#26A8EA" />
                  {(user?.linkedEmail || linkEmailDone) ? (
                    <AccountMethodRow icon="✉️" title="Email" subtitle={user?.linkedEmail ?? linkEmailValue} status="дополнительно" accent={APG2.gold} />
                  ) : showLinkEmail ? (
                    <div style={{ display: 'grid', gap: 9 }}>
                      <GlassInput
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={linkEmailValue}
                        onChange={e => { setLinkEmailValue(e.target.value); setLinkEmailError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleLinkEmail()}
                        placeholder="Ваш email"
                        invalid={!!linkEmailError}
                        style={{ minHeight: 46, borderRadius: 20 }}
                      />
                      {linkEmailError && <div style={{ color: '#E64646', fontSize: 12, lineHeight: '17px' }}>{linkEmailError}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 9 }}>
                        <GlassButton onClick={() => { setShowLinkEmail(false); setLinkEmailError(''); }}>Отмена</GlassButton>
                        <GlassButton onClick={handleLinkEmail} disabled={linkEmailLoading || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmailValue)} tone="gold">{linkEmailLoading ? 'Привязка...' : 'Привязать'}</GlassButton>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 9 }}>
                      <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px' }}>Email можно добавить как дополнительный способ входа.</div>
                      <GlassButton onClick={() => setShowLinkEmail(true)}>✉️ Привязать почту</GlassButton>
                    </div>
                  )}
                </>
              )}
            </GlassCard>
          </GlassSection>
        )}

        <GlassSection title="Быстрые действия">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <GlassButton onClick={onToggleTheme}><span>{isDark ? '☀️' : '🌙'}</span>{isDark ? 'Светлая тема' : 'Темная тема'}</GlassButton>
            <GlassButton onClick={onEnableNotifications} tone={notificationsEnabled ? 'gold' : 'glass'}><span>{notificationsEnabled ? '✓' : '🔔'}</span>{notificationsEnabled ? 'Уведомления включены' : 'Уведомления'}</GlassButton>
            {primaryActions.map(a => <GlassButton key={a.label} onClick={a.onClick}><span>{a.icon}</span>{a.label}</GlassButton>)}
          </div>
        </GlassSection>

        {!notificationsEnabled && (
          <GlassSection title="Уведомления">
            <GlassCard style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>🔔</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: APG2.text, fontSize: 15, fontWeight: 820, marginBottom: 6 }}>
                  {('Notification' in window && Notification.permission === 'denied')
                    ? 'Уведомления заблокированы'
                    : 'Уведомления отключены'}
                </div>
                <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px', marginBottom: 12 }}>
                  {('Notification' in window && Notification.permission === 'denied')
                    ? 'Разрешение заблокировано в настройках браузера. Откройте настройки сайта и разрешите уведомления.'
                    : 'Включите уведомления, чтобы получать новости, события, призы и важные сообщения.'}
                </div>
                <GlassButton onClick={onEnableNotifications} tone="gold" style={{ width: '100%', minHeight: 44 }}>
                  {('Notification' in window && Notification.permission === 'denied')
                    ? '⚙️ Открыть настройки'
                    : '🔔 Включить уведомления'}
                </GlassButton>
              </div>
            </GlassCard>
          </GlassSection>
        )}

        <GlassSection title="Показатели">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {stats.map(s => (
              <GlassCard key={s.label} style={{ minHeight: 72, padding: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 5 }}>{s.emoji}</div>
                <div style={{ color: APG2.text, fontSize: 19, lineHeight: '22px', fontWeight: 860 }}>{s.value}</div>
                <div style={{ color: APG2.textMuted, fontSize: 11, marginTop: 4 }}>{s.label}</div>
              </GlassCard>
            ))}
          </div>
        </GlassSection>

        <GlassSection title="Мои записи">
          {bookingGroups.pending.length === 0 && bookingGroups.actionRequired.length === 0 && bookingGroups.upcoming.length === 0 && bookingGroups.past.length === 0 && bookingGroups.cancelled.length === 0 && bookingGroups.completed.length === 0 ? (
            <GlassCard style={{ padding: 22, textAlign: 'center' }}>
              <div style={{ color: APG2.text, fontSize: 17, fontWeight: 830, marginBottom: 6 }}>Записей пока нет</div>
              <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px' }}>Когда вы запишетесь к партнёру или эксперту, карточка появится здесь.</div>
            </GlassCard>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['Ожидают подтверждения', bookingGroups.pending],
                ['Требуют действия', bookingGroups.actionRequired],
                ['Предстоящие', bookingGroups.upcoming],
                ['Прошедшие', bookingGroups.past],
                ['Отмененные', bookingGroups.cancelled],
                ['История', bookingGroups.completed],
              ].filter(([, list]) => list.length).map(([title, list]) => (
                <GlassCard key={title} style={{ borderRadius: 28, display: 'grid', gap: 8 }}>
                  <div style={{ color: APG2.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</div>
                  {list.map(item => (
                    <div
                      key={item.id || item.bookingId}
                      style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', borderRadius: 20, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', padding: '10px 11px', color: APG2.text, display: 'grid', gap: 9 }}
                    >
                      <button
                        type="button"
                        onClick={() => (onOpenBookingDialog || onOpenDialog)?.(item)}
                        style={{ border: 0, background: 'transparent', padding: 0, color: APG2.text, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}
                      >
                        <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', color: APG2.text, fontSize: 14, lineHeight: '18px', fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.providerName || 'Запись АПГ'}</span>
                        <span style={{ display: 'block', color: APG2.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 3 }}>{item.serviceTitle || 'Услуга'} · {item.dateLabel || ''} {item.time || ''}</span>
                        {bookingJourneySummary(item) && <span style={{ display: 'block', color: APG2.gold, fontSize: 11.5, lineHeight: '16px', marginTop: 4, fontWeight: 760 }}>{bookingJourneySummary(item)}</span>}
                      </span>
                        <span style={{ color: APG2.gold, fontSize: 12, fontWeight: 820 }}>{item.statusLabel || 'Запись'}</span>
                      </button>
                      {item.isActive && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <GlassButton onClick={() => (onOpenBookingDialog || onOpenDialog)?.(item)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Написать</GlassButton>
                          <GlassButton onClick={() => {
                            const startAt = prompt('Новая дата и время в формате YYYY-MM-DD HH:mm');
                            if (!startAt) return;
                            const start = new Date(String(startAt).trim().replace(' ', 'T'));
                            if (Number.isNaN(start.getTime())) return alert('Не удалось распознать дату.');
                            const duration = Number(item.durationMinutes || 60);
                            runBookingAction('booking:requestReschedule', item, { slot: { startAt: start.toISOString(), endAt: new Date(start.getTime() + duration * 60000).toISOString() }, reason: 'Запрос пользователя' });
                          }} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Перенести</GlassButton>
                          <GlassButton onClick={() => {
                            if (!confirm('Отменить запись?')) return;
                            const reason = prompt('Причина отмены, если хотите указать') || '';
                            runBookingAction('booking:cancel', item, { reason });
                          }} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Отменить</GlassButton>
                        </div>
                      )}
                      {item.status === 'completed' && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(item.journey?.reviewPromptAvailable || item.reviewPromptAvailable) && !item.journey?.reviewPublishedAt && <GlassButton tone="gold" onClick={() => onOpenBookingReview?.(item)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12, color: '#17120a' }}>Оставить отзыв</GlassButton>}
                          <GlassButton onClick={() => (onOpenBookingDialog || onOpenDialog)?.(item)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Написать</GlassButton>
                        </div>
                      )}
                    </div>
                  ))}
                </GlassCard>
              ))}
            </div>
          )}
        </GlassSection>

        <GlassSection title="Избранное">
          {favoritePartners.length === 0 ? (
            <GlassCard style={{ padding: 26, textAlign: 'center' }}>
              <div style={{ color: APG2.text, fontSize: 18, fontWeight: 820, marginBottom: 7 }}>Пока пусто</div>
              <div style={{ color: APG2.textMuted, fontSize: 14, lineHeight: '20px' }}>Добавляйте места сердцем, чтобы быстро возвращаться к ним.</div>
            </GlassCard>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {favoritePartners.slice(0, 6).map(p => (
                <GlassCard key={p.id} onClick={() => onOpenPartner(p)} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {p.logoUrl ? <img src={p.logoUrl} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: 18, objectFit: 'cover' }} /> : <div style={{ width: 48, height: 48, borderRadius: 18, background: APG2.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>◆</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: APG2.text, fontSize: 15, fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ color: APG2.textMuted, fontSize: 12, marginTop: 3 }}>{p.categoryLabel || 'Партнер АПГ'}</div>
                  </div>
                  <span style={{ color: APG2.gold }}>›</span>
                </GlassCard>
              ))}
            </div>
          )}
        </GlassSection>

        <GlassSection title="Новости">
          <GlassCard style={{ display: 'grid', gap: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
                <div style={{ color: APG2.text, fontSize: 17, fontWeight: 860 }}>Сохранённые материалы</div>
                <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 3 }}>{savedNews.length} сохранено · {readLaterNews.length} на потом</div>
              </div>
              <GlassButton
                onClick={() => onOpenNews?.()}
                style={{ minHeight: 38, borderRadius: 17, padding: '8px 12px' }}
              >
                Открыть
              </GlassButton>
            </div>
            {savedNewsItems.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {savedNewsItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenNews?.(item)}
                    style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', borderRadius: 18, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2.text, padding: '10px 12px', textAlign: 'left', fontFamily: 'inherit' }}
                  >
                    <span style={{ display: 'block', color: APG2.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 820, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getNewsTitle(item)}</span>
                    <span style={{ display: 'block', color: APG2.textMuted, fontSize: 11, lineHeight: '15px', marginTop: 3 }}>{formatNewsDate(item)}</span>
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        </GlassSection>

        <GlassSection title="Достижения">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {achievements.slice(0, 9).map(a => (
              <GlassCard key={a.id} style={{ padding: 11, minHeight: 84, opacity: a.unlocked ? 1 : 0.58, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8, filter: a.unlocked ? 'none' : 'grayscale(1)' }}>{a.emoji}</div>
                <div style={{ color: APG2.text, fontSize: 12, lineHeight: '15px', fontWeight: 760 }}>{a.title}</div>
              </GlassCard>
            ))}
          </div>
        </GlassSection>

        <GlassSection title="Аккаунт">
          <div style={{ display: 'grid', gap: 10 }}>
            <GlassButton onClick={onShare}>Поделиться АПГ</GlassButton>
            <GlassButton onClick={handleWriteAdmin}>Написать в поддержку</GlassButton>
            <GlassButton onClick={onLogout}>Выйти</GlassButton>
          </div>
        </GlassSection>

        {showConnectionsModal && createPortal(
          <ApgModal
            title="Люди"
            subtitle="Друзья, заявки и диалоги"
            onClose={() => setShowConnectionsModal(false)}
            maxWidth={540}
          >
            <div data-people-list data-connections-list style={{ display: 'grid', gap: 12 }}>
              <GlassInput
                data-people-search-modal
                value={peopleSearch}
                onChange={e => setPeopleSearch(e.target.value)}
                placeholder="Найти человека, компанию, роль или город"
                style={{ minHeight: 48, borderRadius: 20, fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {PEOPLE_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPeopleTab(tab.id)}
                    style={{ minHeight: 38, borderRadius: 999, border: `1px solid ${peopleTab === tab.id ? 'rgba(201,168,76,0.48)' : 'rgba(var(--apg2-glass-a,255,255,255),0.13)'}`, background: peopleTab === tab.id ? 'linear-gradient(135deg, rgba(201,168,76,0.24), rgba(201,168,76,0.10))' : 'rgba(var(--apg2-glass-a,255,255,255),0.065)', color: peopleTab === tab.id ? APG2.gold : APG2.textSoft, padding: '8px 12px', fontSize: 12, fontWeight: 850, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {tab.label} {peopleCounts[tab.id] || ''}
                  </button>
                ))}
              </div>
              {peopleSearchLoading && <div style={{ color: APG2.textMuted, fontSize: 13, textAlign: 'center', padding: 8 }}>Ищем участников...</div>}
              {visiblePeopleRows.length ? visiblePeopleRows.map(person => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => { setPeopleSheet(person); setShowConnectionsModal(false); }}
                  style={{ width: '100%', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 20, padding: 11, display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto', gap: 11, alignItems: 'center', color: APG2.text, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  <PeopleAvatar person={person} size={48} radius={18} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, lineHeight: '18px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</span>
                    <span style={{ display: 'block', color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peopleContextLine(person) || peopleStatusLabel(person.relationStatus)}</span>
                  </span>
                  <span style={{ color: APG2.gold, fontSize: 18 }}>›</span>
                </button>
              )) : (
                <div data-people-empty-state style={{ borderRadius: 20, border: '1px dashed rgba(var(--apg2-glass-a,255,255,255),0.16)', padding: 16 }}>
                  <div style={{ color: APG2.text, fontSize: 14, fontWeight: 880 }}>{peopleEmptyTitle(peopleTab, Boolean(peopleSearch.trim()))}</div>
                  <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '18px', marginTop: 5 }}>{peopleEmptyText(peopleTab, Boolean(peopleSearch.trim()))}</div>
                </div>
              )}
            </div>
          </ApgModal>,
          document.body
        )}

        {peopleSheet && createPortal(
          <ApgModal
            title={peopleSheet.displayName || 'Участник АПГ'}
            subtitle={peopleContextLine(peopleSheet) || peopleStatusLabel(peopleSheet.relationStatus)}
            onClose={() => setPeopleSheet(null)}
            maxWidth={480}
          >
            <div data-people-bottom-sheet style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: 9, textAlign: 'center' }}>
                <PeopleAvatar person={peopleSheet} size={76} radius={27} />
                <span style={peopleStatusChipStyle(peopleSheet.relationStatus)}>{peopleStatusLabel(peopleSheet.relationStatus)}</span>
                {(peopleSheet.about || peopleSheet.city || peopleSuggestionReason(peopleSheet)) && <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px' }}>{peopleSheet.about || peopleSuggestionReason(peopleSheet) || peopleSheet.city}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <GlassButton
                  tone="gold"
                  disabled={peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING || peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.BLOCKED}
                  onClick={() => {
                    runPersonPrimaryAction(peopleSheet);
                    if (peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.FRIEND) setPeopleSheet(null);
                  }}
                  style={{ flex: 1 }}
                >
                  {peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.FRIEND ? 'Написать' : peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.INCOMING ? 'Принять' : peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING ? 'Заявка отправлена' : 'Добавить'}
                </GlassButton>
                <GlassButton onClick={() => { setPeopleSheet(null); setShowConnectionsModal(true); }} style={{ flex: 1 }}>К списку</GlassButton>
              </div>
            </div>
          </ApgModal>,
          document.body
        )}

        {showEmailAuth && createPortal(
          <ApgModal
            title="Войти по почте"
            subtitle="Введите email, чтобы сохранить ключи, избранное и прогресс."
            onClose={() => setShowEmailAuth(false)}
          >
            <EmailAuth onCancel={() => setShowEmailAuth(false)} onSuccess={handleEmailAuthSuccess} />
          </ApgModal>,
          document.body
        )}

        {showShareModal && (
          <ShareModal
            user={user}
            userKeys={userKeys}
            streak={streak}
            scannedCount={scannedCount}
            completedTasks={completedTasks}
            unlockedAchievements={achievements.filter(a => a.unlocked).length}
            level={level}
            onClose={() => setShowShareModal(false)}
            onShareVK={() => {
              setShowShareModal(false);
              onShare?.();
            }}
          />
        )}
      </GlassPanel>
    );
  }

  return (
    <div style={{ background: 'transparent', minHeight: '100%' }}>

      {/* ── Toast достижения ── */}
      {achievementToast && (
        <div style={{
          position: 'fixed', top: 60, left: 16, right: 16, zIndex: 700,
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(48px) saturate(2)',
          WebkitBackdropFilter: 'blur(48px) saturate(2)',
          border: `1px solid ${achievementToast.color}60`,
          borderRadius: 20, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: `0 8px 40px var(--apg2-elev-shadow, rgba(0,0,0,0.34)), 0 0 0 1px ${achievementToast.color}25`,
          animation: toastExiting ? 'achievementOut 0.3s ease both' : 'achievementPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: achievementToast.color + '20',
            border: `2px solid ${achievementToast.color}70`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>
            {achievementToast.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>✦ Новое достижение!</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: APG2.text }}>{achievementToast.title}</div>
          </div>
          <button onClick={dismissToast} style={{ background: 'none', border: 'none', color: APG2.textSoft, fontSize: 20, cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Кастомный хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)',
        borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))',
        boxShadow: 'inset 0 -1px 0 var(--c-border, rgba(0,0,0,0.12))',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', height: 52,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: APG2.text }}>✦ Профиль</div>
      </div>

      {/* ── Вход (гостевой режим) ── */}
      {isGuest && !isVK() && (
        <div style={{ margin: '14px 16px 0', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(74,144,217,0.3)', background: isDark ? 'rgba(74,144,217,0.08)' : 'rgba(74,144,217,0.06)' }}>
          <div style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: APG2.text, marginBottom: 3 }}>Войдите в АПГ</div>
              <div style={{ fontSize: 12, color: APG2.textSoft }}>чтобы сохранить прогресс и ключи</div>
            </div>

            {/* Email — первичный способ входа */}
            {!showEmailAuth && tgStep === 'idle' && !tgLoading && (
              <button
                onClick={() => setShowEmailAuth(true)}
                style={{ width: '100%', padding: '13px 0', borderRadius: 13, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #4A90D9, #2D6FBC)', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(74,144,217,0.4)' }}
              >
                ✉️ Войти по email
              </button>
            )}
            {/* Telegram — дополнительный способ */}
            {!showEmailAuth && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  <span style={{ fontSize: 11, color: APG2.textSoft, fontWeight: 600 }}>или</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                </div>
                <div style={{ borderRadius: 14, padding: '9px 11px', background: 'rgba(74,144,217,0.09)', border: '1px solid rgba(74,144,217,0.18)', color: APG2.textSoft, fontSize: 12, lineHeight: '16px', textAlign: 'center' }}>
                  Для первого входа рекомендуем email. После этого Telegram можно привязать к аккаунту.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {tgLoading
                    ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: APG2.textSoft, fontSize: 14, padding: '12px 0' }}>
                        <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#26A8EA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Создаём сессию...
                      </div>
                    : tgStep === 'waiting'
                      ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: '4px 0', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#26A8EA', fontSize: 13, fontWeight: 600 }}>
                            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(38,168,234,0.3)', borderTopColor: '#26A8EA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Ждём подтверждения в Telegram...
                          </div>
                          <button type="button" onClick={() => openUrl(tgBotUrl)} style={{ display: 'block', width: '100%', padding: '11px 0', borderRadius: 12, border: '1px solid rgba(38,168,234,0.35)', background: 'rgba(38,168,234,0.1)', color: '#26A8EA', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                            Открыть Telegram
                          </button>
                        </div>
                      : <button type="button" onClick={() => runTelegramAuth(false)} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: `1px solid rgba(38,168,234,0.3)`, cursor: 'pointer', background: 'rgba(38,168,234,0.1)', color: '#26A8EA', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#26A8EA"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
                          Войти через Telegram
                        </button>
                  }
                  {tgError && <div style={{ fontSize: 12, color: '#E64646', textAlign: 'center' }}>{tgError}</div>}
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── Привязка Telegram для email-пользователей ── */}
      {!isVK() && user && String(user.id).startsWith('email:') && (
        <div style={{ margin: '14px 16px 0', borderRadius: 18, border: '1px solid rgba(38,168,234,0.25)', background: 'rgba(38,168,234,0.06)', padding: '14px 16px', overflow: 'hidden' }}>
          <div style={{ fontSize: 12, color: APG2.textSoft, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Способы входа</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: user.emailVerified === false ? 8 : 10, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: APG2.text, flexShrink: 0 }}>✉️ Email</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: APG2.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email ?? String(user.id).replace('email:', '')}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4BB34B', fontWeight: 700, background: 'rgba(75,179,75,0.12)', borderRadius: 8, padding: '2px 8px', flexShrink: 0 }}>✓ подключён</span>
          </div>
          {user.emailVerified === false && <EmailVerifyBanner userId={String(user.id)} />}
          {user.linkedTelegram
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: APG2.text }}>✈️ Telegram</span>
                <span style={{ fontSize: 11, color: APG2.textSoft }}>{user.linkedTelegram.firstName}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4BB34B', fontWeight: 700, background: 'rgba(75,179,75,0.12)', borderRadius: 8, padding: '2px 8px' }}>✓ привязан</span>
              </div>
            : tgStep === 'linked'
              ? <div style={{ fontSize: 13, color: '#4BB34B', fontWeight: 600, textAlign: 'center', padding: '6px 0' }}>✓ Telegram привязан!</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tgLoading
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: APG2.textSoft, fontSize: 13, padding: '6px 0' }}>
                        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#26A8EA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Создаём сессию...
                      </div>
                    : tgStep === 'waiting'
                      ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#26A8EA', fontSize: 12, fontWeight: 600 }}>
                            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(38,168,234,0.3)', borderTopColor: '#26A8EA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Ждём подтверждения...
                          </div>
                          <button type="button" onClick={() => openUrl(tgBotUrl)} style={{ display: 'block', padding: '10px 0', borderRadius: 11, border: '1px solid rgba(38,168,234,0.35)', background: 'rgba(38,168,234,0.1)', color: '#26A8EA', fontSize: 13, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}>Открыть Telegram</button>
                        </div>
                      : <button type="button" onClick={() => runTelegramAuth(true)} style={{ padding: '10px 0', borderRadius: 11, border: '1px solid rgba(38,168,234,0.3)', background: 'rgba(38,168,234,0.08)', color: '#26A8EA', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="#26A8EA"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
                          Привязать Telegram
                        </button>
                  }
                  {tgError && <div style={{ fontSize: 12, color: '#E64646' }}>{tgError}</div>}
                </div>
          }
        </div>
      )}

      {/* ── Привязка Email для Telegram-пользователей ── */}
      {!isVK() && user && String(user.id).startsWith('tg_') && (
        <div style={{ margin: '14px 16px 0', borderRadius: 18, border: '1px solid rgba(38,168,234,0.25)', background: 'rgba(38,168,234,0.06)', padding: '14px 16px', overflow: 'hidden' }}>
          <div style={{ fontSize: 12, color: APG2.textSoft, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Способы входа</div>

          {/* Telegram — основной */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: APG2.text, flexShrink: 0 }}>✈️ Telegram</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: APG2.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.first_name}{user.last_name ? ' ' + user.last_name : ''}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4BB34B', fontWeight: 700, background: 'rgba(75,179,75,0.12)', borderRadius: 8, padding: '2px 8px', flexShrink: 0 }}>✓ подключён</span>
          </div>

          {/* Email */}
          {(user.linkedEmail || linkEmailDone)
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: APG2.text, flexShrink: 0 }}>✉️ Email</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: APG2.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.linkedEmail ?? linkEmailValue}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4BB34B', fontWeight: 700, background: 'rgba(75,179,75,0.12)', borderRadius: 8, padding: '2px 8px', flexShrink: 0 }}>✓ привязан</span>
              </div>
            : showLinkEmail
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={linkEmailValue}
                    onChange={e => { setLinkEmailValue(e.target.value); setLinkEmailError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLinkEmail()}
                    placeholder="Ваш email"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)', color: APG2.text, fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  {linkEmailError && <div style={{ fontSize: 12, color: '#E64646' }}>{linkEmailError}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowLinkEmail(false); setLinkEmailError(''); }} style={{ flex: 1, padding: '9px 0', borderRadius: 11, background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: APG2.textSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
                    <button
                      onClick={handleLinkEmail}
                      disabled={linkEmailLoading || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmailValue)}
                      style={{ flex: 2, padding: '9px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#4A90D9,#2D6FBC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: linkEmailLoading ? 0.7 : 1 }}
                    >
                      {linkEmailLoading ? '⏳ Привязка...' : '✉️ Привязать'}
                    </button>
                  </div>
                </div>
              : <button onClick={() => setShowLinkEmail(true)} style={{ width: '100%', padding: '9px 0', borderRadius: 11, border: '1px solid rgba(74,144,217,0.3)', background: 'rgba(74,144,217,0.08)', color: '#4A90D9', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✉️ Привязать почту
                </button>
          }
        </div>
      )}

      {/* ── Единая карточка профиля ── */}
      {(() => {
        const toNext = getKeysToNext(userKeys);
        const pct    = getLevelProgress(userKeys);
        return (
          <div style={{
            margin: '14px 16px',
            borderRadius: 28,
            background: isDark
              ? 'linear-gradient(145deg, rgba(18,12,50,0.97), rgba(22,18,62,0.95))'
              : 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(240,242,255,0.88))',
            backdropFilter: 'blur(40px) saturate(2)',
            WebkitBackdropFilter: 'blur(40px) saturate(2)',
            border: `1px solid rgba(201,168,76,0.28)`,
            boxShadow: isDark
              ? `0 16px 48px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.14), 0 0 0 1px rgba(201,168,76,0.06)`
              : `0 8px 32px rgba(0,0,0,0.1), inset 0 2px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(201,168,76,0.08)`,
            padding: '20px 20px 18px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Фоновые элементы */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}20, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,60,220,0.1), transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
              {/* Строка: аватар + имя/город/уровень + ключи */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
                {/* Аватар */}
                <div style={{ width: 72, height: 72, borderRadius: '50%', padding: 2.5, background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', flexShrink: 0 }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#101012' }}>
                    {profileAvatarUrl
                      ? <img src={profileAvatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#C9A84C', background: 'rgba(201,168,76,0.12)' }}>
                          {(safeUser.displayName || safeUser.first_name || '?')[0].toUpperCase()}
                        </div>
                    }
                  </div>
                </div>

                {/* Имя + город + уровень */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: APG2.text, lineHeight: 1.2, marginBottom: 2 }}>
                    {safeUser.displayName || [safeUser.first_name, safeUser.last_name].filter(Boolean).join(' ') || 'Участник АПГ'}
                  </div>
                  <div style={{ fontSize: 11, color: APG2.textSoft, marginBottom: 8 }}>Участник АПГ · Зеленоград</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: level.color + '22', border: `1px solid ${level.color}55`, borderRadius: 16, padding: '4px 10px' }}>
                    <span style={{ fontSize: 13 }}>{level.emoji}</span>
                    <span style={{ fontSize: 11, color: level.color, fontWeight: 700 }}>{level.label}</span>
                  </div>
                </div>

                {/* Счётчик ключей */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: isDark ? '#fff' : APG2.text, lineHeight: 1, letterSpacing: -1 }}>{userKeys}</div>
                  <div style={{ fontSize: 10, color: '#E8C97A', fontWeight: 700, marginTop: 3 }}>🗝️ ключей</div>
                </div>
              </div>

              {/* Прогресс */}
              <div style={{ height: 7, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${level.color}, #E8C97A)`, borderRadius: 7, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 12px ${level.color}` }} />
              </div>
              <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : APG2.textSoft, textAlign: 'center', fontWeight: 600 }}>
                {nextLevel
                  ? `До «${nextLevel.label}» ${nextLevel.emoji}: ещё ${toNext} ключей`
                  : '👑 Максимальный уровень — вы Амбассадор АПГ!'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Статистика ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Статистика</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{ ...APG2.glass, borderRadius: 20, padding: '14px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: APG2.text }}>{s.value}</div>
              <div style={{ fontSize: 10, color: APG2.textSoft, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ежедневный бонус ── */}
      {(() => {
        const todayKey = new Date().toISOString().slice(0, 10);
        const received = lastBonusDate === todayKey;
        return (
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ ...APG2.glass, borderRadius: 16, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🗝️</span>
              <span style={{ fontSize: 13, color: received ? '#4BB34B' : APG2.textSoft, fontWeight: received ? 600 : 400 }}>
                {received ? '+1 ключ за вход · Сегодня получен ✓' : '+1 ключ за вход · Зайди завтра'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── Путь участника ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Путь участника</div>
        <div style={{ ...APG2.glass, borderRadius: 24, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {LEVELS.map((lvl, i) => {
            const isReached  = userKeys >= lvl.min;
            const isCurrent  = level.id === lvl.id;
            const isLast     = i === LEVELS.length - 1;
            return (
              <div key={lvl.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                {/* Вертикальная линия */}
                {!isLast && (
                  <div style={{
                    position: 'absolute', left: 19, top: 40, width: 2, height: 'calc(100% - 12px)',
                    background: isReached ? lvl.color + '60' : 'rgba(255,255,255,0.12)',
                    transition: 'background 0.4s ease',
                  }} />
                )}
                {/* Иконка уровня */}
                <div style={{
                  width: 40, height: 40, borderRadius: 14, flexShrink: 0,
                  background: isReached ? lvl.color + '22' : 'rgba(255,255,255,0.08)',
                  border: `2px solid ${isReached ? lvl.color + '80' : 'rgba(255,255,255,0.12)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isReached ? 18 : 16,
                  filter: isReached ? 'none' : 'grayscale(1)',
                  opacity: isReached ? 1 : 0.45,
                  boxShadow: isCurrent ? `0 0 0 3px ${lvl.color}40` : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  {lvl.emoji}
                </div>
                {/* Текст */}
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isReached ? APG2.text : APG2.textSoft }}>{lvl.label}</span>
                    {isCurrent && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: lvl.color, background: lvl.color + '20', border: `1px solid ${lvl.color}50`, borderRadius: 8, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: 0.5 }}>сейчас</span>
                    )}
                    {isReached && !isCurrent && (
                      <span style={{ fontSize: 12, color: '#4BB34B' }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 2 }}>
                    {lvl.min === 0 ? 'Стартовый уровень' : `от ${lvl.min} ключей`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Streak Calendar ── */}
      <StreakCalendar scanDates={scanDates} streak={streak} />

      {/* ── Достижения ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>✦ Достижения</div>
          <div style={{ fontSize: 11, color: APG2.textSoft, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)' }}>{unlockedCount}/{achievements.length}</div>
        </div>

        {unlockedCount === 0
          ? <div style={{ ...APG2.glass, borderRadius: 24, padding: '28px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ animation: 'float 3.5s ease-in-out infinite' }}>
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  <path d="M28 17 H62 V46 C62 62 45 72 45 72 C45 72 28 62 28 46 Z" fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.26)" strokeWidth="1.5"/>
                  <path d="M14 24 H28 V46 C28 46 19 42 14 33 Z" fill="rgba(201,168,76,0.05)" stroke="rgba(201,168,76,0.16)" strokeWidth="1"/>
                  <path d="M76 24 H62 V46 C62 46 71 42 76 33 Z" fill="rgba(201,168,76,0.05)" stroke="rgba(201,168,76,0.16)" strokeWidth="1"/>
                  <line x1="37" y1="72" x2="37" y2="80" stroke="rgba(201,168,76,0.4)" strokeWidth="2.5"/>
                  <line x1="53" y1="72" x2="53" y2="80" stroke="rgba(201,168,76,0.4)" strokeWidth="2.5"/>
                  <rect x="29" y="78" width="32" height="7" rx="3.5" fill="rgba(201,168,76,0.12)" stroke="rgba(201,168,76,0.28)" strokeWidth="1"/>
                  <rect x="36" y="38" width="18" height="15" rx="4" fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.45)" strokeWidth="1.5"/>
                  <path d="M39 38 V32 C39 27 51 27 51 32 V38" stroke="rgba(201,168,76,0.45)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  <circle cx="45" cy="45" r="2.5" fill="rgba(201,168,76,0.7)"/>
                  <rect x="77" y="13" width="5" height="5" rx="0.5" transform="rotate(45 79 15)" fill="rgba(201,168,76,0.65)"/>
                  <rect x="4" y="16" width="4" height="4" rx="0.5" transform="rotate(45 6 18)" fill="rgba(201,168,76,0.35)"/>
                </svg>
              </div>
              <div>
                <div style={{ color: APG2.text, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Достижения заперты</div>
                <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px' }}>Сканируй QR-коды партнёров — так появятся первые достижения</div>
              </div>
            </div>
          : <div style={{ ...APG2.glass, borderRadius: 24, padding: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {achievements.map(a => <AchievementBadge key={a.id} a={a} unlocked={a.unlocked} />)}
              </div>
            </div>
        }
      </div>

      {/* ── Избранное ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>✦ Избранное</div>
          {favoritePartners.length > 0 && <div style={{ fontSize: 11, color: APG2.textSoft, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)' }}>{favoritePartners.length}</div>}
        </div>

        {favoritePartners.length === 0
          ? <div style={{ ...APG2.glass, borderRadius: 24, padding: '28px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ animation: 'float 4s ease-in-out infinite' }}>
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  <path d="M45 72 C45 72 14 51 14 31 C14 21 22 14 32 14 C37 14 42 17 45 23 C48 17 53 14 58 14 C68 14 76 21 76 31 C76 51 45 72 45 72 Z" fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.26)" strokeWidth="1.5"/>
                  <path d="M45 72 C45 72 14 51 14 31 C14 21 22 14 32 14 C37 14 42 17 45 23" stroke="rgba(201,168,76,0.12)" strokeWidth="1" fill="none"/>
                  <circle cx="28" cy="26" r="3" fill="rgba(201,168,76,0.28)"/>
                  <circle cx="64" cy="24" r="2.5" fill="rgba(201,168,76,0.22)"/>
                  <circle cx="20" cy="44" r="2" fill="rgba(201,168,76,0.18)"/>
                  <circle cx="70" cy="42" r="2" fill="rgba(201,168,76,0.18)"/>
                  <rect x="40" y="38" width="10" height="10" rx="1" transform="rotate(45 45 43)" fill="rgba(201,168,76,0.4)" stroke="rgba(201,168,76,0.5)" strokeWidth="1"/>
                  <rect x="4" y="78" width="5" height="5" rx="0.5" transform="rotate(45 6 80)" fill="rgba(201,168,76,0.28)"/>
                  <rect x="78" y="74" width="4" height="4" rx="0.5" transform="rotate(45 80 76)" fill="rgba(201,168,76,0.22)"/>
                </svg>
              </div>
              <div>
                <div style={{ color: APG2.text, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Список пуст</div>
                <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px' }}>Добавляй партнёров в избранное — они появятся здесь</div>
              </div>
            </div>
          : <div>{favoritePartners.map(p => <FavoriteCard key={p.id} partner={p} onOpen={onOpenPartner} onRemove={onToggleFavorite} />)}</div>
        }
      </div>

      {/* ── Мои мероприятия ── */}
      {(() => {
        const myEvents = registeredEventIds.map(eid => events.find(e => e.id === eid)).filter(Boolean);
        if (!myEvents.length) return null;
        return (
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Мои мероприятия</div>
            <div style={{ ...APG2.glass, borderRadius: 24, overflow: 'hidden' }}>
              {myEvents.map((event, i) => {
                const isPast = event.eventDate ? new Date(event.eventDate).getTime() < Date.now() : false;
                return (
                  <div key={event.id} style={{ padding: '14px 16px', borderBottom: i < myEvents.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: isPast ? 'rgba(255,255,255,0.08)' : 'rgba(201,168,76,0.12)',
                      border: `1px solid ${isPast ? 'rgba(255,255,255,0.12)' : 'rgba(201,168,76,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>
                      {event.emoji ?? '🎉'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: APG2.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                      {event.date && <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 2 }}>📅 {event.date}</div>}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 10, flexShrink: 0,
                      background: isPast ? 'rgba(255,255,255,0.08)' : 'rgba(75,179,75,0.07)',
                      color: isPast ? APG2.textSoft : '#4BB34B',
                      border: `1px solid ${isPast ? 'rgba(255,255,255,0.12)' : 'rgba(75,179,75,0.25)'}`,
                    }}>
                      {isPast ? 'Прошло' : 'Иду ✓'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Реферальная программа ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Пригласить друга</div>
        <div style={{ ...APG2.glass, borderRadius: 24, overflow: 'hidden' }}>

          {/* Статистика */}
          {referralCount > 0 && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: APG2.text }}>{referralCount}</div>
                <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 2 }}>
                  {referralCount === 1 ? 'друг' : referralCount < 5 ? 'друга' : 'друзей'} пришло
                </div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.12)' }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: APG2.gold }}>{referralCount * 2} 🗝️</div>
                <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 2 }}>заработано</div>
              </div>
            </div>
          )}

          {/* QR-код */}
          {user?.id && (
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, color: APG2.textSoft, textAlign: 'center', lineHeight: '18px' }}>
                Покажи QR другу — он сканирует и вы оба получаете <span style={{ color: APG2.gold, fontWeight: 700 }}>+2 🗝️</span>
              </div>
              <div style={{ background: '#fff', borderRadius: 16, padding: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <QRCodeSVG
                  value={buildPersonalQrLink(user)}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#0F0F1A"
                  level="M"
                />
              </div>
              <div style={{ fontSize: 11, color: APG2.textSoft, textAlign: 'center' }}>
                Личный QR · открывается обычной камерой телефона
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}>
            <button onClick={() => setShowShareModal(true)} style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #4A90D9, #2D6FBC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              📤 Поделиться
            </button>
            <button onClick={onOpenReferral} style={{ flex: 1, padding: '12px 0', borderRadius: 14, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', color: APG2.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              Подробнее ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Кабинет партнёра ── */}
      {ownedPartner && onOpenPartnerCabinet && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={onOpenPartnerCabinet}
            style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: 0, background: 'none',
              display: 'block', animation: 'fadeInUp 0.35s ease both',
            }}
          >
            <div style={{
              background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))',
              border: '1px solid rgba(201,168,76,0.35)', borderRadius: 20, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
                {ownedPartner.logoUrl
                  ? <img src={ownedPartner.logoUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} onError={e => e.target.style.display='none'} />
                  : ownedPartner.emoji ?? '🏪'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: APG2.gold, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>Мой кабинет</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: APG2.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownedPartner.name}</div>
                <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 1 }}>Статистика · Редактирование карточки</div>
              </div>
              <div style={{ color: APG2.gold, fontSize: 20, flexShrink: 0 }}>›</div>
            </div>
          </button>
        </div>
      )}

      {/* ── Кабинет эксперта ── */}
      {ownedExpert && onOpenExpertCabinet && (
        <div style={{ padding: ownedPartner ? '12px 16px 0' : '16px 16px 0' }}>
          <button
            onClick={onOpenExpertCabinet}
            style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: 0, background: 'none', display: 'block', animation: 'fadeInUp 0.35s ease both' }}
          >
            <div style={{
              background: 'linear-gradient(135deg, rgba(74,144,217,0.15), rgba(74,144,217,0.05))',
              border: '1px solid rgba(74,144,217,0.35)', borderRadius: 20, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
                {ownedExpert.photo
                  ? <img src={ownedExpert.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => e.target.style.display='none'} />
                  : '🧑‍💼'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#4A90D9', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>Кабинет эксперта</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: APG2.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownedExpert.name}</div>
                <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 1 }}>Статистика · QR-коды · Редактирование</div>
              </div>
              <div style={{ color: '#4A90D9', fontSize: 20, flexShrink: 0 }}>›</div>
            </div>
          </button>
        </div>
      )}

      {/* ── Настройки ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Настройки</div>
        <div style={{ ...APG2.glass, borderRadius: 24, overflow: 'hidden' }}>
          {[
            { icon: '◌', label: 'Локи АПГ',          action: onOpenLoki,             right: 'помощник' },
            { icon: '⌕', label: 'Справочник',        action: onOpenReference,        right: null },
            { icon: '🎓', label: 'Повторить обучение', action: onRestartLearning,      right: '1 мин' },
            { icon: '📋', label: 'История активности', action: onOpenActivity,         right: null },
            { icon: '🔔', label: 'Уведомления',        action: onEnableNotifications,  right: notificationsEnabled ? 'вкл' : null },
            { icon: '🧭', label: 'Диагностика профиля', action: () => setShowDiagnostics(true), right: null },
            showIdentityDiagnosticButton && { icon: '🪪', label: 'Диагностика Identity', action: openIdentityDiagnostics, right: user?.canonicalUserId ? 'core' : null },
            showWorkspaceDiagnosticButton && { icon: '🖥', label: 'Диагностика Workspace', action: () => setShowWorkspaceDiagnostics(true), right: workspaceDiagnostics?.currentMode },
            { icon: '⚙️', label: 'Настройки профиля',  action: () => {},               right: null },
          ].filter(item => typeof item.action === 'function').map((item, i, arr) => (
            <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 15, color: APG2.text, fontWeight: 500 }}>{item.label}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.right && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#4BB34B', background: 'rgba(75,179,75,0.09)', padding: '3px 8px', borderRadius: 10 }}>{item.right}</span>
                )}
                <span style={{ color: APG2.textSoft, fontSize: 16 }}>›</span>
              </div>
            </button>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <FaqSection />

      {/* ── Поддержка ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Поддержка</div>
        <div style={{ ...APG2.glass, borderRadius: 24, overflow: 'hidden' }}>
          {[
            {
              icon: '⌕',
              label: 'Открыть справочник',
              sub: 'Ключи, QR, призы и роли АПГ',
              action: onOpenReference,
              color: APG2.gold,
            },
            {
              icon: '💬',
              label: 'Написать нам',
              sub: 'Ответим в течение дня',
              action: handleWriteAdmin,
              color: '#4A90D9',
            },
            {
              icon: '🏪',
              label: 'Предложить партнёра',
              sub: 'Знаете крутое место в Зеленограде?',
              action: handleWriteAdmin,
              color: '#4BB34B',
            },
            {
              icon: '🐞',
              label: 'Сообщить об ошибке',
              sub: 'Поможем разобраться',
              action: handleWriteAdmin,
              color: '#E64646',
            },
          ].filter(item => typeof item.action === 'function').map((item, i, arr) => (
            <button key={item.label} onClick={item.action}
              style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: item.color + '18', border: `1px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: APG2.text, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 2 }}>{item.sub}</div>
              </div>
              <span style={{ color: APG2.textSoft, fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── О приложении ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: APG2.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ О приложении</div>
        <div style={{ ...APG2.glass, borderRadius: 24, overflow: 'hidden' }}>
          {/* Лого + название */}
          <div style={{ padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(201,168,76,0.19), rgba(232,201,122,0.09))', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🗝️</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: APG2.text }}>АПГ — Альянс Партнёров</div>
              <div style={{ fontSize: 11, color: APG2.textSoft, marginTop: 2 }}>Программа лояльности Зеленограда</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: APG2.gold, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.19)', borderRadius: 8, padding: '4px 8px', flexShrink: 0 }}>v1.0</div>
          </div>
          {/* Строки */}
          {[
            { label: 'Версия',       value: '1.0.0' },
            { label: 'Город',        value: 'Зеленоград' },
            { label: 'Разработчик',  value: 'АПГ Team' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: APG2.textSoft }}>{row.label}</span>
              <span style={{ fontSize: 13, color: APG2.text, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Администрирование (только для админа) ── */}
      {(user?.id === 988504 || ['admin', 'owner', 'super_admin'].includes(String(user?.role || user?.userRole || '').toLowerCase())) && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={() => { window.location.assign('/admin-app'); }}
            style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: '1px solid rgba(201,168,76,0.27)', background: 'rgba(201,168,76,0.08)', color: APG2.gold, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            ⚙️ Администрирование
          </button>
          <button
            onClick={onOpenHealth}
            style={{ width: '100%', marginTop: 8, padding: '14px 0', borderRadius: 16, border: `1px solid rgba(201,168,76,0.30)`, background: 'rgba(201,168,76,0.07)', color: APG2.gold, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            🩺 APG Health
          </button>
        </div>
      )}

      {/* ── Установить как приложение ── */}
      {showInstallBtn && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={handleInstall}
            style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: '1px solid rgba(75,179,75,0.27)', background: 'rgba(75,179,75,0.08)', color: '#4BB34B', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            📲 Добавить на экран телефона
          </button>
          {showIosHint && (
            <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 13, color: APG2.textSoft, lineHeight: '20px' }}>
                <div style={{ marginBottom: 8 }}>Чтобы установить приложение на iPhone / iPad:</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>1️⃣</span>
                  <span>Нажмите кнопку <strong style={{ color: APG2.text }}>Поделиться</strong> <span style={{ fontSize: 16 }}>⬆️</span> внизу Safari</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>2️⃣</span>
                  <span>Выберите <strong style={{ color: APG2.text }}>«На экран "Домой"»</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>3️⃣</span>
                  <span>Нажмите <strong style={{ color: APG2.text }}>«Добавить»</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Выход ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <button onClick={onLogout} style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: '1px solid rgba(230,70,70,0.27)', background: 'rgba(230,70,70,0.08)', color: '#E64646', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Выйти из аккаунта
        </button>
      </div>

      {/* ── Удаление профиля ── */}
      <div style={{ padding: '8px 16px 0' }}>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{ width: '100%', padding: '12px 0', borderRadius: 16, border: 'none', background: 'none', color: APG2.textSoft, opacity: 0.45, fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: 0.2 }}
        >
          Удалить профиль
        </button>
      </div>

      <div style={{ height: 90 }} />

      {showEmailAuth && createPortal(
        <ApgModal
          title="Войти по почте"
          subtitle="Введите email, чтобы сохранить ключи, избранное и прогресс."
          onClose={() => setShowEmailAuth(false)}
        >
          <EmailAuth onCancel={() => setShowEmailAuth(false)} onSuccess={handleEmailAuthSuccess} />
        </ApgModal>,
        document.body
      )}

      {/* ── Диагностика Workspace ── */}
      {showWorkspaceDiagnostics && createPortal(
        <ApgModal
          title="Диагностика Workspace"
          subtitle="Временная диагностика доступна только владельцу / super_admin."
          onClose={() => setShowWorkspaceDiagnostics(false)}
          maxWidth={460}
        >
          {(() => {
            const rows = [
              ['Workspace Feature Flag', workspaceDiagnostics?.featureFlag || '—'],
              ['Роль пользователя', workspaceDiagnostics?.userRole || '—'],
              ['Все роли Workspace', workspaceDiagnostics?.roles?.join(', ') || '—'],
              ['Desktop detected', workspaceDiagnostics?.desktopDetected ? 'да' : 'нет'],
              ['Workspace allowed', workspaceDiagnostics?.workspaceAllowed ? 'да' : 'нет'],
              ['Allowed by role/flag', workspaceDiagnostics?.workspaceAllowedByRole ? 'да' : 'нет'],
              ['Текущий режим', workspaceDiagnostics?.currentMode || '—'],
              ['Запрошенный режим', workspaceDiagnostics?.requestedMode || '—'],
              ['Значение сохранённого режима', workspaceDiagnostics?.savedMode || '—'],
              ['Ширина', workspaceDiagnostics?.width ? `${workspaceDiagnostics.width}px` : '—'],
              ['Breakpoint', workspaceDiagnostics?.workspaceMode || '—'],
            ];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ ...APG2.glass, borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {rows.map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12, color: APG2.textSoft, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 12, color: APG2.text, fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere', userSelect: 'text' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ ...APG2.glass, borderRadius: 18, padding: '12px 14px', border: workspaceDiagnostics?.currentMode === 'workspace' ? '1px solid rgba(75,179,75,0.28)' : '1px solid rgba(230,70,70,0.24)' }}>
                  <div style={{ fontSize: 12, color: APG2.textSoft, marginBottom: 5 }}>Причина</div>
                  <div style={{ fontSize: 13, lineHeight: '19px', color: APG2.text, fontWeight: 750, userSelect: 'text' }}>{workspaceDiagnostics?.reason || 'Нет данных диагностики.'}</div>
                </div>
                <GlassButton
                  tone="gold"
                  onClick={() => {
                    onResetWorkspaceMode?.();
                    setShowWorkspaceDiagnostics(false);
                  }}
                  style={{ width: '100%', color: '#17120a' }}
                >
                  Сбросить режим Workspace
                </GlassButton>
              </div>
            );
          })()}
        </ApgModal>,
        document.body
      )}

      {/* ── Диагностика Identity ── */}
      {showIdentityDiagnostics && createPortal(
        <ApgModal
          title="Диагностика Identity"
          subtitle="Canonical User, роли и связанные документы."
          onClose={() => setShowIdentityDiagnostics(false)}
          maxWidth={520}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {identityDiagnosticsLoading && (
              <div style={{ ...APG2.glass, borderRadius: 18, padding: '14px', color: APG2.textSoft, fontSize: 13 }}>Загружаем Identity Core...</div>
            )}
            {identityDiagnosticsError && (
              <div style={{ ...APG2.glass, borderRadius: 18, padding: '14px', color: '#E64646', fontSize: 13, border: '1px solid rgba(230,70,70,0.24)' }}>{identityDiagnosticsError}</div>
            )}
            {!identityDiagnosticsLoading && !identityDiagnosticsError && (
              <>
                <div style={{ ...APG2.glass, borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    ['Canonical User', identityDiagnostics?.canonicalUserId || '—'],
                    ['Открытый профиль', identityDiagnostics?.openedUserId || String(user?.id || '—')],
                    ['Роли', identityDiagnostics?.roles?.join(', ') || roleValue || '—'],
                    ['Partner cabinets', identityDiagnostics?.cabinets?.partnerCabinetIds?.join(', ') || '—'],
                    ['Expert cabinets', identityDiagnostics?.cabinets?.expertCabinetIds?.join(', ') || '—'],
                    ['Причина', identityDiagnostics?.reason || '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12, color: APG2.textSoft, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 12, color: APG2.text, fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere', userSelect: 'text' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(identityDiagnostics?.documents || []).map(doc => (
                    <div key={doc.id} style={{ ...APG2.glass, borderRadius: 18, padding: '12px 14px', border: doc.id === identityDiagnostics?.canonicalUserId ? '1px solid rgba(75,179,75,0.28)' : '1px solid rgba(255,255,255,0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: APG2.text, fontWeight: 800, overflowWrap: 'anywhere', userSelect: 'text' }}>{doc.id}</span>
                        <span style={{ fontSize: 11, color: doc.id === identityDiagnostics?.canonicalUserId ? '#4BB34B' : APG2.textSoft, fontWeight: 800 }}>{doc.identityStatus || 'legacy'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: APG2.textSoft, lineHeight: '18px', userSelect: 'text' }}>
                        role: {doc.role || '—'} · userRole: {doc.userRole || '—'} · canonical: {doc.canonicalUserId || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </ApgModal>,
        document.body
      )}

      {/* ── Диагностика профиля ── */}
      {showDiagnostics && createPortal(
        <ApgModal
          title="Диагностика профиля"
          subtitle="Идентификаторы, роли и доступ к кабинетам этого профиля."
          onClose={() => setShowDiagnostics(false)}
          maxWidth={460}
        >
          {(() => {
            const diag = buildCabinetDiagnostics({ userData: user || {}, ownedPartner, ownedExpert, partners, role: roleValue });
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ ...APG2.glass, borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    ['UID', diag.userId || '—'],
                    ['Firebase UID', diag.firebaseUid || '—'],
                    ['Email', diag.emails.join(', ') || '—'],
                    ['Роли', diag.roles.join(', ')],
                    ['Partner ID', diag.partnerId || diag.partnerCabinetIds.join(', ') || '—'],
                    ['Expert ID', diag.expertId || diag.expertCabinetIds.join(', ') || '—'],
                    ['Все ID профиля', diag.identityIds.join(', ') || '—'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12, color: APG2.textSoft, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 12, color: APG2.text, fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere', userSelect: 'text' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {diag.cabinets.map(cabinet => (
                    <div key={cabinet.key} style={{ ...APG2.glass, borderRadius: 18, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, color: APG2.text, fontWeight: 700 }}>{cabinet.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 10, color: cabinet.available ? '#4BB34B' : '#E64646', background: cabinet.available ? 'rgba(75,179,75,0.10)' : 'rgba(230,70,70,0.09)' }}>
                          {cabinet.available ? 'доступен' : 'скрыт'}
                        </span>
                      </div>
                      {cabinet.available && cabinet.source && (
                        <div style={{ fontSize: 12, color: APG2.textSoft, marginTop: 5 }}>{cabinet.source}</div>
                      )}
                      {!cabinet.available && cabinet.reasons.map(reason => (
                        <div key={reason} style={{ fontSize: 12, color: APG2.textSoft, lineHeight: '17px', marginTop: 5 }}>• {reason}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </ApgModal>,
        document.body
      )}

      {/* ── Модалка подтверждения удаления ── */}
      {showDeleteConfirm && (
        <ApgModal
          title="Удалить профиль?"
          subtitle="Все ваши ключи, достижения и история активности будут безвозвратно удалены."
          onClose={() => { if (!isDeleting) setShowDeleteConfirm(false); }}
          maxWidth={420}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 22,
              background: 'rgba(230,70,70,0.09)', border: '1px solid rgba(230,70,70,0.27)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>🗑️</div>
          </div>

          <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px', textAlign: 'center', marginBottom: 18 }}>
            Это действие нельзя отменить.
          </div>

          <div style={{ background: 'rgba(230,70,70,0.07)', border: '1px solid rgba(230,70,70,0.19)', borderRadius: 18, padding: '12px 14px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { emoji: '🗝️', text: `${userKeys} ключей` },
              { emoji: '⭐', text: `${favorites.length} избранных заведений` },
              { emoji: '📋', text: 'История активности' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>{item.emoji}</span>
                <span style={{ fontSize: 13, color: APG2.textSoft }}>{item.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              style={{ flex: 1 }}
            >
              Отмена
            </GlassButton>
            <button
              onClick={handleDeleteConfirmed}
              disabled={isDeleting}
              style={{
                flex: 1, minHeight: 46, padding: '11px 14px', borderRadius: APG2.radius.button,
                border: '1px solid rgba(230,70,70,0.33)', background: '#E64646',
                color: '#fff', fontSize: 13.5, lineHeight: '18px', fontWeight: 760,
                fontFamily: 'inherit', cursor: isDeleting ? 'default' : 'pointer',
                opacity: isDeleting ? 0.58 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isDeleting ? 'Удаляем...' : 'Удалить'}
            </button>
          </div>
        </ApgModal>
      )}

      {showConnectionsModal && createPortal(
        <ApgModal
          title="Люди"
          subtitle="Друзья, заявки, поиск и диалоги в одном месте."
          onClose={() => setShowConnectionsModal(false)}
          maxWidth={540}
        >
          <div data-people-list data-connections-list style={{ display: 'grid', gap: 12 }}>
            <div style={{ borderRadius: 24, padding: 14, background: 'radial-gradient(circle at 16% 0%, rgba(74,144,217,0.16), transparent 35%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.12), rgba(var(--apg2-glass-a,255,255,255),0.05))', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', display: 'grid', gap: 8 }}>
              <div style={{ color: APG2.gold, fontSize: 11, lineHeight: '14px', fontWeight: 920, textTransform: 'uppercase', letterSpacing: 0.8 }}>People Center</div>
              <div style={{ color: APG2.text, fontSize: 19, lineHeight: '24px', fontWeight: 940 }}>Знакомства, друзья и диалоги</div>
              <div style={{ color: APG2.textSoft, fontSize: 12.5, lineHeight: '18px' }}>Управляйте своей городской сетью: поиск, заявки, приватность и быстрые сообщения.</div>
            </div>
            <GlassInput
              data-people-search-modal
              value={peopleSearch}
              onChange={e => setPeopleSearch(e.target.value)}
              placeholder="Поиск людей, компаний, ролей и города"
              style={{ minHeight: 48, borderRadius: 20, fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {PEOPLE_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeopleTab(tab.id)}
                  style={{ minHeight: 38, borderRadius: 999, border: `1px solid ${peopleTab === tab.id ? 'rgba(201,168,76,0.48)' : 'rgba(var(--apg2-glass-a,255,255,255),0.13)'}`, background: peopleTab === tab.id ? 'linear-gradient(135deg, rgba(201,168,76,0.24), rgba(201,168,76,0.10))' : 'rgba(var(--apg2-glass-a,255,255,255),0.065)', color: peopleTab === tab.id ? APG2.gold : APG2.textSoft, padding: '8px 12px', fontSize: 12, fontWeight: 850, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {tab.label} {peopleCounts[tab.id] ? peopleCounts[tab.id] : ''}
                </button>
              ))}
            </div>
            <div data-social-privacy style={{ borderRadius: 18, border: '1px solid rgba(201,168,76,0.20)', background: 'rgba(201,168,76,0.07)', padding: 12, display: 'grid', gap: 9 }}>
              <div style={{ color: APG2.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 840 }}>Кто может писать и отправлять заявки</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  [SOCIAL_PRIVACY.ALLOWED_RELATIONS, 'Участники АПГ'],
                  [SOCIAL_PRIVACY.FRIENDS_ONLY, 'Только друзья'],
                  [SOCIAL_PRIVACY.NOBODY, 'Никто'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => updateSocialPrivacyServer(value)} style={{ minHeight: 32, borderRadius: 13, border: `1px solid ${socialPrivacy === value ? 'rgba(201,168,76,0.45)' : 'rgba(var(--apg2-glass-a,255,255,255),0.14)'}`, background: socialPrivacy === value ? APG2.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: socialPrivacy === value ? APG2.gold : APG2.textMuted, padding: '6px 9px', fontSize: 11.5, fontWeight: 780, fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            </div>
            {peopleSearchLoading && <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px', textAlign: 'center', padding: 8 }}>Ищем участников...</div>}
            {visiblePeopleRows.length ? visiblePeopleRows.map(person => {
              const primaryLabel = person.relationStatus === PEOPLE_RELATION_STATUS.FRIEND ? 'Написать' : person.relationStatus === PEOPLE_RELATION_STATUS.INCOMING ? 'Принять' : person.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING ? 'Отправлено' : person.relationStatus === PEOPLE_RELATION_STATUS.BLOCKED ? 'Недоступно' : 'Добавить в друзья';
              const primaryDisabled = person.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING || person.relationStatus === PEOPLE_RELATION_STATUS.BLOCKED;
              const sharedSummary = peopleSharedSummary(person);
              const suggestionReason = peopleSuggestionReason(person);
              return (
                <div key={person.id} data-people-card-modal style={{ ...APG2.glass, borderRadius: 22, padding: 13, display: 'grid', gap: 11, background: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.12), rgba(var(--apg2-glass-a,255,255,255),0.055))' }}>
                  <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                    <PeopleAvatar person={person} size={46} radius={18} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: APG2.text, fontSize: 14, lineHeight: '18px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</div>
                      <div style={{ color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 2 }}>{peopleContextLine(person)}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                        <span style={peopleStatusChipStyle(person.relationStatus)}>{peopleStatusLabel(person.relationStatus)}</span>
                        {sharedSummary && <span style={{ color: '#6AABEC', background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.22)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, lineHeight: '13px', fontWeight: 820 }}>{sharedSummary}</span>}
                        {!sharedSummary && suggestionReason && <span style={{ color: '#6AABEC', background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.22)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, lineHeight: '13px', fontWeight: 820 }}>{suggestionReason}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <GlassButton onClick={() => runPersonPrimaryAction(person)} disabled={primaryDisabled} tone="gold" style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 12 }}>{primaryLabel}</GlassButton>
                    {person.phone && <GlassButton onClick={() => openUrl(`tel:${String(person.phone).replace(/[^\d+]/g, '')}`)} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 12 }}>Позвонить</GlassButton>}
                  </div>
                </div>
              );
            }) : (
              <div data-people-empty-state style={{ borderRadius: 22, border: '1px dashed rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.045)', padding: 16, display: 'grid', gap: 9, textAlign: 'left' }}>
                <div style={{ color: APG2.text, fontSize: 15, lineHeight: '20px', fontWeight: 900 }}>{peopleEmptyTitle(peopleTab, Boolean(peopleSearch.trim()))}</div>
                <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px' }}>{peopleEmptyText(peopleTab, Boolean(peopleSearch.trim()))}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <GlassButton onClick={() => setPeopleTab('all')} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 12 }}>Все люди</GlassButton>
                </div>
              </div>
            )}
            {peopleSearch.trim() && peopleGroups.filter(group => group.id !== 'people').map(group => (
              <div key={group.id} style={{ display: 'grid', gap: 7 }}>
                <div style={{ color: APG2.gold, fontSize: 11, lineHeight: '15px', fontWeight: 900, textTransform: 'uppercase' }}>{group.label}</div>
                {group.rows.slice(0, 4).map(row => (
                  <div key={row.id || row.name || row.title} style={{ borderRadius: 15, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.05)', padding: 10 }}>
                    <div style={{ color: APG2.text, fontSize: 13, lineHeight: '17px', fontWeight: 830 }}>{row.name || row.title || 'АПГ'}</div>
                    <div style={{ color: APG2.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 2 }}>{row.category || row.city || row.description || 'Найдено в АПГ'}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ApgModal>,
        document.body
      )}

      {peopleSheet && createPortal(
        <div
          data-people-bottom-sheet
          onClick={e => { if (e.target === e.currentTarget) setPeopleSheet(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 12px calc(var(--safe-bottom, 0px) + 12px)', animation: 'fadeInUp 0.18s ease both' }}
        >
          <div style={{ width: '100%', maxWidth: 520, borderRadius: '30px 30px 24px 24px', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'radial-gradient(circle at 18% 0%, rgba(74,144,217,0.20), transparent 36%), radial-gradient(circle at 92% 4%, rgba(201,168,76,0.18), transparent 34%), linear-gradient(180deg, rgba(var(--apg2-panel-rgb,22,22,26),0.985), rgba(var(--apg2-panel-rgb,22,22,26),0.945))', boxShadow: '0 -24px 58px rgba(0,0,0,0.38)', padding: 16, display: 'grid', gap: 13, boxSizing: 'border-box', animation: 'fadeInUp 0.26s ease both' }}>
            <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.20)', justifySelf: 'center' }} />
            <div style={{ color: APG2.gold, fontSize: 10.5, lineHeight: '14px', fontWeight: 930, textTransform: 'uppercase', letterSpacing: 0.9 }}>Карточка участника</div>
            <div style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) auto', gap: 13, alignItems: 'center' }}>
              <PeopleAvatar person={peopleSheet} size={70} radius={25} />
              <div style={{ minWidth: 0, display: 'grid', gap: 6 }}>
                <div style={{ color: APG2.text, fontSize: 20, lineHeight: '25px', fontWeight: 940, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peopleSheet.displayName}</div>
                <div style={{ color: APG2.textMuted, fontSize: 12.5, lineHeight: '18px' }}>{peopleContextLine(peopleSheet) || 'Участник АПГ'}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={peopleStatusChipStyle(peopleSheet.relationStatus)}>{peopleStatusLabel(peopleSheet.relationStatus)}</span>
                  {peopleSharedSummary(peopleSheet) && <span style={{ color: '#6AABEC', background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.22)', borderRadius: 999, padding: '4px 8px', fontSize: 10.5, lineHeight: '13px', fontWeight: 820 }}>{peopleSharedSummary(peopleSheet)}</span>}
                </div>
              </div>
              <button type="button" onClick={() => togglePinnedPerson(peopleSheet.id)} aria-label="Закрепить человека" style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.30)', background: pinnedPeopleIds.includes(String(peopleSheet.id)) ? 'linear-gradient(145deg, rgba(201,168,76,0.30), rgba(201,168,76,0.12))' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: APG2.gold, fontSize: 17, cursor: 'pointer', boxShadow: pinnedPeopleIds.includes(String(peopleSheet.id)) ? '0 10px 24px rgba(201,168,76,0.14)' : 'none' }}>⭐</button>
            </div>
            {(peopleSheet.about || peopleSheet.city || peopleSuggestionReason(peopleSheet)) && (
              <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px', borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.055)', padding: 11 }}>
                {peopleSheet.about || peopleSuggestionReason(peopleSheet) || peopleSheet.city}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                ['Друзья', peopleSheet.shared?.contacts?.length || 0],
                ['Мероприятия', peopleSheet.shared?.events?.length || 0],
                ['Партнёры', peopleSheet.shared?.partners?.length || 0],
              ].map(([label, value]) => (
                <div key={label} style={{ borderRadius: 17, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)', background: value ? 'linear-gradient(145deg, rgba(201,168,76,0.13), rgba(var(--apg2-glass-a,255,255,255),0.055))' : 'rgba(var(--apg2-glass-a,255,255,255),0.055)', padding: 9, textAlign: 'center' }}>
                  <div style={{ color: value ? APG2.gold : APG2.text, fontSize: 18, lineHeight: '21px', fontWeight: 930 }}>{value}</div>
                  <div style={{ color: APG2.textMuted, fontSize: 10, lineHeight: '13px', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            {personInterestTags(peopleSheet).length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {personInterestTags(peopleSheet).map(tag => <span key={tag} style={{ color: APG2.textSoft, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.065)', borderRadius: 999, padding: '5px 9px', fontSize: 11.5, lineHeight: '14px', fontWeight: 720 }}>{tag}</span>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GlassButton
                onClick={() => { runPersonPrimaryAction(peopleSheet); if (peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.FRIEND && peopleSheet.dialogId) setPeopleSheet(null); }}
                disabled={peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING || peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.BLOCKED}
                tone="gold"
                style={{ flex: 1, minHeight: 44, borderRadius: 16, fontSize: 13 }}
              >
                {peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.FRIEND ? 'Написать' : peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.INCOMING ? 'Принять' : peopleSheet.relationStatus === PEOPLE_RELATION_STATUS.OUTGOING ? 'Заявка отправлена' : 'Добавить'}
              </GlassButton>
              <GlassButton onClick={() => { setPeopleSheet(null); setShowConnectionsModal(true); }} style={{ flex: 1, minHeight: 44, borderRadius: 16, fontSize: 13 }}>К списку людей</GlassButton>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GlassButton onClick={() => { setPeopleSearch(peopleSheet.displayName || ''); setShowConnectionsModal(true); }} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 12 }}>Поиск</GlassButton>
              {peopleSheet.phone && <GlassButton onClick={() => openUrl(`tel:${String(peopleSheet.phone).replace(/[^\d+]/g, '')}`)} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 12 }}>Позвонить</GlassButton>}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showBusinessCard && createPortal(
        <ApgModal
          title="Цифровая карточка"
          subtitle="Покажите QR на мероприятии, чтобы другой участник открыл ваш профиль."
          onClose={() => setShowBusinessCard(false)}
          maxWidth={430}
        >
          <div data-business-card-modal style={{ display: 'grid', gap: 14 }}>
            <div style={{ ...APG2.glass, borderRadius: 24, padding: 16, textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' }}>
              {profileAvatarUrl
                ? <img src={profileAvatarUrl} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: 74, height: 74, borderRadius: 26, objectFit: 'cover', border: '2px solid rgba(201,168,76,0.36)' }} />
                : <div style={{ width: 74, height: 74, borderRadius: 26, background: APG2.goldSoft, color: APG2.gold, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 900 }}>{businessCardDisplayName[0] || 'А'}</div>
              }
              <div>
                <div style={{ color: APG2.text, fontSize: 20, lineHeight: '25px', fontWeight: 920 }}>{businessCardDisplayName}</div>
                <div style={{ color: APG2.textMuted, fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>{user?.role || user?.city || 'Участник АПГ'}</div>
              </div>
              {(user?.about || user?.bio || user?.company || ownedPartner?.name || ownedExpert?.name) && (
                <div style={{ color: APG2.textSoft, fontSize: 12.5, lineHeight: '18px', maxWidth: 310 }}>
                  {user?.about || user?.bio || user?.company || ownedPartner?.name || ownedExpert?.name}
                </div>
              )}
              <div style={{ background: '#fff', borderRadius: 18, padding: 12 }}>
                <QRCodeSVG value={businessCardUrl} size={178} level="M" includeMargin />
              </div>
              <div style={{ color: APG2.textMuted, fontSize: 11, lineHeight: '15px', overflowWrap: 'anywhere', userSelect: 'text' }}>{businessCardUrl}</div>
            </div>
            <GlassButton
              tone="gold"
              onClick={async () => {
                const text = `${businessCardDisplayName} в АПГ: ${businessCardUrl}`;
                if (navigator.share) {
                  try { await navigator.share({ title: 'Цифровая карточка АПГ', text, url: businessCardUrl }); return; } catch (err) { if (err.name === 'AbortError') return; }
                }
                try { await navigator.clipboard.writeText(text); } catch {}
              }}
            >
              Поделиться карточкой
            </GlassButton>
          </div>
        </ApgModal>,
        document.body
      )}

      {showShareModal && createPortal(
        <ShareModal
          user={user}
          userKeys={userKeys}
          streak={streak}
          scannedCount={scannedCount}
          completedTasks={completedTasks}
          unlockedAchievements={achievements.filter(a => a.unlocked).length}
          level={level}
          onClose={() => setShowShareModal(false)}
          onShareVK={async () => {
            const link = buildReferralLink(user);
            const msg = buildReferralInviteText(link);
            setShowShareModal(false);
            if (navigator.share) {
              try { await navigator.share({ title: 'АПГ — Альянс Партнёров Города', text: msg }); return; } catch (err) { if (err.name === 'AbortError') return; }
            }
            vkBridge.send('VKWebAppShare', { link, text: msg }).catch(() => {});
          }}
        />,
        document.body
      )}
    </div>
  );
}
