import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RichText } from './components/RichText.jsx';
import { TASKS } from './tasks.js';
import { getLevel, getNextLevel, getLevelProgress, getKeysToNext } from './levels.js';
import { Panel, Avatar, Button, HorizontalScroll } from '@vkontakte/vkui';
import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';
import vkBridge, { openUrl } from './vk.js';
import { APP_URL } from './constants.js';
import { MOTION, motionDelay, motionTransition } from './motion.js';
import { formatNewsDate, getNewsCategory, getNewsCategoryLabel, getNewsImage, getNewsText, getNewsTitle, getNewsViews, getReadingMinutes, hasNewsVideo, isFreshNews } from './newsUtils.js';

const CATEGORIES = [
  { id: 'all',           label: 'Все',          emoji: '✦' },
  { id: 'food',          label: 'Еда',          emoji: '🍕' },
  { id: 'beauty',        label: 'Красота',       emoji: '💄' },
  { id: 'sport',         label: 'Спорт',         emoji: '💪' },
  { id: 'education',     label: 'Обучение',      emoji: '📚' },
  { id: 'entertainment', label: 'Развлечения',   emoji: '🎉' },
  { id: 'health',        label: 'Здоровье',      emoji: '🏥' },
  { id: 'home',          label: 'Дом и ремонт',  emoji: '🏠' },
  { id: 'pets',          label: 'Животные',      emoji: '🐾' },
  { id: 'fashion',       label: 'Одежда',        emoji: '👗' },
  { id: 'auto',          label: 'Авто',          emoji: '🚗' },
  { id: 'services',      label: 'Услуги',        emoji: '💼' },
  { id: 'shopping',      label: 'Шоппинг',       emoji: '🛍️' },
  { id: 'other',         label: 'Другое',        emoji: '📦' },
];

const contentImageOf = (item) =>
  item?.coverPhoto || item?.imageUrl || item?.thumbnail || item?.banner || item?.image || '';

const profileImageOf = (item) =>
  item?.coverPhoto || item?.imageUrl || item?.logoUrl || item?.photoUrl || item?.photo || item?.image || '';

const V2 = {
  pageBg: 'var(--apg2-bg, #101012)',
  text: 'var(--apg2-text, #F7F4EA)',
  textSoft: 'var(--apg2-text-soft, rgba(247,244,234,0.7))',
  textMuted: 'var(--apg2-text-muted, rgba(247,244,234,0.46))',
  gold: 'var(--apg2-gold, #D6B766)',
  goldMetal: 'linear-gradient(135deg, #FFF0B8 0%, #D9B965 34%, #9F7932 67%, #F4D98C 100%)',
  glass: {
    background: 'radial-gradient(circle at 18% 0%, rgba(255,240,184,0.09), transparent 36%), linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.032))',
    backdropFilter: 'blur(62px) saturate(1.72)',
    WebkitBackdropFilter: 'blur(62px) saturate(1.72)',
    border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.16))',
    boxShadow: '0 20px 58px var(--apg2-elev-shadow, rgba(0,0,0,0.27)), inset 0 1.5px 0 rgba(255,255,255,0.24), inset 0 -18px 42px rgba(255,255,255,0.035)',
  },
  glowGlass: {
    background: 'radial-gradient(circle at 18% 0%, rgba(255,240,184,0.18), transparent 38%), radial-gradient(circle at 84% 12%, rgba(255,255,255,0.13), transparent 30%), linear-gradient(145deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04))',
    backdropFilter: 'blur(76px) saturate(1.82)',
    WebkitBackdropFilter: 'blur(76px) saturate(1.82)',
    border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.24))',
    boxShadow: '0 42px 104px var(--apg2-elev-shadow, rgba(0,0,0,0.38)), 0 0 74px rgba(216,184,103,0.13), inset 0 2px 0 rgba(255,255,255,0.32), inset 0 -42px 86px rgba(255,255,255,0.055)',
  },
  goldGlass: {
    background: 'radial-gradient(circle at 32% 0%, rgba(255,240,184,0.36), transparent 44%), linear-gradient(135deg, rgba(244,217,140,0.32), rgba(159,121,50,0.11))',
    backdropFilter: 'blur(46px) saturate(1.8)',
    WebkitBackdropFilter: 'blur(46px) saturate(1.8)',
    border: '1px solid rgba(244,217,140,0.36)',
    boxShadow: '0 18px 52px rgba(216,184,103,0.13), inset 0 1.5px 0 rgba(255,255,255,0.28), inset 0 -12px 30px rgba(159,121,50,0.12)',
  },
  sectionGap: 20,
};

const GlassCard = {
  ...V2.glass,
  borderRadius: 32,
  transition: `${motionTransition(['transform', 'box-shadow', 'border-color'], 'base')}, background var(--motion-base, 240ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1))`,
  touchAction: 'manipulation',
};

const pressMotion = {
  onPointerDown: e => { e.currentTarget.style.transform = `scale(${MOTION.press.card})`; },
  onPointerUp: e => { e.currentTarget.style.transform = ''; },
  onPointerCancel: e => { e.currentTarget.style.transform = ''; },
  onPointerLeave: e => { e.currentTarget.style.transform = ''; },
  onMouseEnter: e => {
    if (window.matchMedia?.('(hover: hover)').matches) e.currentTarget.style.transform = 'translateY(-2px)';
  },
  onMouseLeave: e => { e.currentTarget.style.transform = ''; },
};

const GlassButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  padding: '0 23px',
  borderRadius: 999,
  background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.25), transparent 56%), linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.055))',
  border: '1px solid rgba(255,255,255,0.23)',
  color: V2.text,
  fontSize: 14,
  fontWeight: 760,
  backdropFilter: V2.glass.backdropFilter,
  WebkitBackdropFilter: V2.glass.WebkitBackdropFilter,
  boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.26), inset 0 -14px 28px rgba(255,255,255,0.035), 0 14px 34px var(--apg2-elev-shadow, rgba(0,0,0,0.18))',
  transition: motionTransition(['transform', 'box-shadow'], 'base'),
};

const revealMotion = (index = 0, duration = 'panel') => ({
  animation: `fadeInUp var(--motion-${duration}, ${MOTION.duration[duration] ?? MOTION.duration.panel}ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both`,
  animationDelay: motionDelay(index),
});

const GlassIsland = {
  ...V2.glass,
  borderRadius: 42,
  boxShadow: '0 28px 76px var(--apg2-elev-shadow, rgba(0,0,0,0.34)), 0 0 58px rgba(216,184,103,0.10), inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -26px 52px rgba(255,255,255,0.045)',
};

const GlassBadge = {
  padding: '7px 12px',
  borderRadius: 999,
  color: V2.text,
  fontSize: 11,
  fontWeight: 720,
  background: 'radial-gradient(circle at 35% 0%, rgba(255,255,255,0.22), transparent 58%), rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.20)',
  backdropFilter: V2.glass.backdropFilter,
  WebkitBackdropFilter: V2.glass.WebkitBackdropFilter,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.23), 0 10px 24px var(--apg2-elev-shadow, rgba(0,0,0,0.14))',
};

const GlassSection = {
  ...V2.glass,
  borderRadius: 38,
};

const GlassPanel = {
  ...GlassSection,
};

const GlassHero = {
  ...V2.glowGlass,
  borderRadius: 42,
};

function getUserFirstName(user) {
  const raw = user?.first_name || user?.firstName || user?.displayName || user?.name || '';
  const first = String(raw).trim().split(/\s+/)[0] || '';
  return /^(участник|гость|привет)$/i.test(first) ? '' : first;
}

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour >= 18) return 'Добрый вечер';
  if (hour >= 12) return 'Добрый день';
  return 'Доброе утро';
}

function V2FirstScreen({
  user,
  userKeys,
  events,
  featuredPartner,
  partnerOfMonth,
  unreadCount,
  onOpenNotifications,
  onOpenPartner,
  onOpenNearby,
  onOpenEvents,
  onOpenRewards,
  onOpenTasks,
  onOpenReference,
  onOpenLoki,
}) {
  const heroPartner = partnerOfMonth ?? featuredPartner ?? null;
  const heroEvent = events.find(e => contentImageOf(e)) ?? events[0] ?? null;
  const heroImage = heroEvent ? contentImageOf(heroEvent) : profileImageOf(heroPartner);
  const heroTitle = heroEvent?.title ?? heroPartner?.name ?? 'Пульс города рядом';
  const heroMeta = heroEvent?.date ?? heroPartner?.offer ?? 'Главный повод выйти в город сегодня';
  const heroAction = heroEvent ? onOpenEvents : heroPartner ? () => onOpenPartner?.(heroPartner) : onOpenEvents;
  const firstName = getUserFirstName(user);
  const greeting = firstName ? `${getDayGreeting()}, ${firstName}!` : `${getDayGreeting()}!`;
  const heroMediaRef = useRef(null);
  const fullName = [user?.first_name || user?.firstName, user?.last_name || user?.lastName].filter(Boolean).join(' ') || user?.displayName || user?.name || 'Участник';
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'У';
  const avatarUrl = user?.photo_200 || user?.photo || user?.avatarUrl || '';

  useEffect(() => {
    const el = heroMediaRef.current;
    if (!el) return;

    let rafId = 0;
    let lastTransform = '';
    let lastOpacity = '';
    const update = () => {
      rafId = 0;
      const p = Math.min(Math.max(window.scrollY / 420, 0), 1);
      const nextTransform = `translate3d(0, ${Math.round(p * 16)}px, 0) scale(${1 + p * 0.045})`;
      const nextOpacity = String(1 - p * 0.12);
      if (nextTransform !== lastTransform) {
        lastTransform = nextTransform;
        el.style.transform = nextTransform;
      }
      if (nextOpacity !== lastOpacity) {
        lastOpacity = nextOpacity;
        el.style.opacity = nextOpacity;
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const todayCards = [
    { icon: '◌', value: 'Локи', title: 'Помощник', sub: 'спросить', onClick: onOpenLoki },
    { icon: '⌕', value: 'FAQ', title: 'Справочник', sub: 'ответы', onClick: onOpenReference },
    { icon: '✦', value: userKeys, title: 'Ключи', sub: 'баланс', onClick: onOpenTasks },
    { icon: '◆', value: 'Подарки', title: 'Призы', sub: 'розыгрыши', onClick: onOpenRewards },
    { icon: '⌖', value: 'Рядом', title: 'Места', sub: 'поблизости', onClick: onOpenNearby },
    { icon: '✺', value: events.length || 'Афиша', title: 'Мероприятия', sub: 'городские', onClick: onOpenEvents },
  ];

  return (
    <section style={{
      position: 'relative',
      minHeight: 'auto',
      boxSizing: 'border-box',
      padding: 'calc(14px + var(--safe-top, 0px)) 18px 24px',
      overflow: 'hidden',
      background: V2.pageBg,
    }}>
      <div style={{ position: 'absolute', left: -80, right: -80, top: 128, height: 230, background: 'linear-gradient(110deg, transparent 8%, rgba(244,217,140,0.055) 35%, rgba(255,255,255,0.04) 48%, transparent 74%)', transform: 'rotate(-8deg)', filter: 'blur(1px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, ...revealMotion(0, 'splash') }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 'clamp(16px, 2.4svh, 22px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="АПГ" style={{ width: 44, height: 44, borderRadius: 18, objectFit: 'cover', boxShadow: '0 14px 34px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.18)' }} />
            </picture>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: V2.text, fontSize: 17, lineHeight: '20px', fontWeight: 880, letterSpacing: 0 }}>АПГ</div>
              <div style={{ color: V2.textMuted, fontSize: 11, lineHeight: '14px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Альянс партнёров города</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <button
              onClick={onOpenNotifications}
              aria-label="Уведомления"
              style={{
                width: 44, height: 44, flexShrink: 0, borderRadius: 18, cursor: 'pointer',
                ...V2.glass,
                color: V2.text, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 7, right: 7, width: 10, height: 10, borderRadius: '50%', background: '#E64646', border: '2px solid #101012' }} />
              )}
            </button>
            <div aria-label="Профиль" style={{ width: 44, height: 44, borderRadius: 18, overflow: 'hidden', ...V2.glass, color: V2.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 850 }}>
              {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} /> : initials}
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 'clamp(9px, 1.7svh, 14px)' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, color: V2.text, fontSize: 'clamp(28px, 4.1svh, 34px)', lineHeight: 'clamp(31px, 4.6svh, 38px)', fontWeight: 780, letterSpacing: 0 }}>
              {greeting}
            </h1>
            <p style={{ margin: 'clamp(6px, 1.2svh, 10px) 0 0', color: V2.textSoft, fontSize: 'clamp(13px, 1.8svh, 14px)', lineHeight: 'clamp(19px, 2.7svh, 22px)', fontWeight: 400, maxWidth: 310 }}>
              Сегодня в Зеленограде происходит много интересного.
            </p>
          </div>

        </div>

        <button
          onClick={heroAction}
          {...pressMotion}
          style={{
            width: '100%', minHeight: 'clamp(176px, 26svh, 236px)', border: 'none', borderRadius: 34, padding: 0,
            cursor: 'pointer', textAlign: 'left', overflow: 'hidden', position: 'relative',
            ...GlassHero,
            ...revealMotion(1, 'splash'),
          }}
        >
          <div ref={heroMediaRef} style={{ position: 'absolute', inset: '-18px 0 0', willChange: 'transform, opacity', transformOrigin: 'center top' }}>
            {heroImage ? (
              <img
                src={heroImage}
                alt=""
                loading="lazy"
                onError={e => { e.currentTarget.style.display = 'none'; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, filter: 'saturate(1.12) contrast(1.04)', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at 28% 18%, rgba(244,217,140,0.28), transparent 42%), linear-gradient(135deg, rgba(24,29,48,0.70), rgba(255,255,255,0.08) 46%, rgba(14,12,18,0.32))' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'var(--apg2-hero-overlay, radial-gradient(circle at 18% 12%, rgba(255,240,184,0.20), transparent 34%), linear-gradient(180deg, rgba(14,15,18,0.03), rgba(14,15,18,0.24) 42%, rgba(12,12,14,0.74)))' }} />
            <div style={{ position: 'absolute', left: -42, right: -24, top: 62, height: 96, background: 'linear-gradient(105deg, transparent 0%, rgba(244,217,140,0.18) 36%, rgba(255,255,255,0.10) 48%, transparent 72%)', transform: 'rotate(-9deg)', filter: 'blur(10px)', opacity: 0.8, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: '1px', borderRadius: 47, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 0 0 2px rgba(244,217,140,0.08), inset 0 38px 96px rgba(255,255,255,0.07), inset 0 -46px 94px rgba(216,184,103,0.055)', pointerEvents: 'none' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 1, minHeight: 'clamp(176px, 26svh, 236px)', padding: 'clamp(14px, 2.5svh, 18px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ alignSelf: 'flex-start', ...GlassBadge, padding: 'clamp(5px, 0.9svh, 7px) 11px', fontSize: 'clamp(10px, 1.5svh, 11px)' }}>
                Сегодня нельзя пропустить
              </div>
              <div aria-hidden="true" style={{ width: 'clamp(34px, 5.8svh, 42px)', height: 'clamp(34px, 5.8svh, 42px)', borderRadius: 17, background: V2.goldMetal, boxShadow: '0 12px 32px rgba(216,184,103,0.18), inset 0 1px 0 rgba(255,255,255,0.42), inset 0 -10px 20px rgba(83,58,18,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#18130A', fontSize: 12, fontWeight: 900, letterSpacing: 0 }}>
                АПГ
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--apg2-hero-text, var(--apg2-text, #F7F1E6))', fontSize: 'clamp(21px, 3.4svh, 25px)', lineHeight: 'clamp(25px, 4.1svh, 30px)', fontWeight: 800, letterSpacing: 0, marginBottom: 'clamp(6px, 1.2svh, 10px)', textShadow: '0 2px 8px rgba(0,0,0,0.18), 0 18px 42px rgba(0,0,0,0.16)' }}>
                {heroTitle}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--apg2-hero-muted, rgba(247,244,234,0.78))', fontSize: 'clamp(12px, 1.75svh, 13px)', lineHeight: 'clamp(16px, 2.45svh, 19px)', fontWeight: 400, maxWidth: 300, marginBottom: 'clamp(8px, 1.8svh, 15px)', textShadow: '0 2px 8px rgba(0,0,0,0.14)' }}>
                <span aria-hidden="true" style={{ width: 28, height: 1, flexShrink: 0, background: V2.goldMetal, opacity: 0.78, boxShadow: '0 0 18px rgba(244,217,140,0.22)' }} />
                <span>{heroMeta}</span>
              </div>
              <span style={{ ...GlassButton, minHeight: 'clamp(36px, 5.6svh, 42px)', padding: '0 20px' }}>
                Подробнее
              </span>
            </div>
          </div>
        </button>

        <div style={{ marginTop: 'clamp(10px, 1.9svh, 16px)', ...revealMotion(2, 'splash') }}>
          <div style={{ color: V2.text, fontSize: 'clamp(15px, 2.5svh, 17px)', lineHeight: 'clamp(18px, 3svh, 21px)', fontWeight: 850, marginBottom: 'clamp(7px, 1.4svh, 10px)', opacity: 0.92 }}>
            Сегодня можно
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            padding: 'clamp(6px, 1.2svh, 9px)', borderRadius: 34,
            ...GlassIsland,
          }}>
            {todayCards.map(card => (
              <button
                key={card.title}
                onClick={card.onClick}
                {...pressMotion}
                style={{
                  minHeight: 'clamp(48px, 8.4svh, 64px)', borderRadius: 24, padding: 'clamp(8px, 1.6svh, 12px) 12px clamp(8px, 1.5svh, 11px)', cursor: 'pointer', textAlign: 'left',
                  display: 'grid', gridTemplateColumns: 'clamp(30px, 5.1svh, 36px) 1fr', alignItems: 'center', gap: 'clamp(7px, 1.5svh, 10px)',
                  color: V2.text,
                  touchAction: 'manipulation',
                  background: 'radial-gradient(circle at 28% 0%, rgba(244,217,140,0.06), transparent 42%), linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.026))',
                  border: '1px solid rgba(255,255,255,0.115)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -12px 28px rgba(255,255,255,0.02)',
                  transition: motionTransition(['transform', 'border-color', 'box-shadow'], 'base'),
                }}
              >
                <span style={{ width: 'clamp(30px, 5.1svh, 34px)', height: 'clamp(30px, 5.1svh, 34px)', borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(15px, 2.5svh, 17px)', lineHeight: '22px', color: '#221807', background: V2.goldMetal, border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 10px 24px rgba(216,184,103,0.12), inset 0 1px 0 rgba(255,255,255,0.28)' }}>{card.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'clamp(15px, 2.55svh, 17px)', lineHeight: 'clamp(17px, 2.9svh, 20px)', fontWeight: 850, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.value}</span>
                  <span style={{ display: 'block', fontSize: 10, lineHeight: '13px', fontWeight: 700, color: V2.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.title} · {card.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function V2SecondScreen({
  user,
  partners,
  experts = [],
  events,
  news,
  featuredPartner,
  partnerOfMonth,
  onOpenPartner,
  onOpenEvents,
  onOpenExperts,
  onOpenRewards,
  onOpenNews,
}) {
  const titleOf = (item, fallback) => String(item?.title || item?.name || item?.offer || item?.specialization || fallback).trim();
  const eventDayParts = (event) => {
    const parts = String(event?.date || 'Скоро').split(/[,\s]+/).filter(Boolean);
    return {
      day: parts[0] || 'Скоро',
      month: parts.slice(1, 2).join(' ') || '',
    };
  };
  const eventDay = (event) => {
    const { day, month } = eventDayParts(event);
    return [day, month].filter(Boolean).join(' ');
  };
  const eventDayShort = (event) => eventDay(event)
    .replace('января', 'янв')
    .replace('февраля', 'фев')
    .replace('марта', 'мар')
    .replace('апреля', 'апр')
    .replace('июня', 'июн')
    .replace('июля', 'июл')
    .replace('августа', 'авг')
    .replace('сентября', 'сен')
    .replace('октября', 'окт')
    .replace('ноября', 'ноя')
    .replace('декабря', 'дек');
  const eventTime = (event) => String(event?.time || event?.date || 'Время уточняется').replace(/^.*?(\d{1,2}[:.]\d{2}).*$/, '$1');
  const primaryPartner = partnerOfMonth ?? featuredPartner ?? partners[0] ?? null;
  const promoPartner = partners.find(p => p.offer && p.id !== primaryPartner?.id) ?? partners[1] ?? primaryPartner;
  const eventItem = events[0] ?? null;
  const secondEvent = events.find(e => e.id !== eventItem?.id) ?? null;
  const expertItem = experts[0] ?? null;
  const raffleImage = profileImageOf(partners[2]) || profileImageOf(primaryPartner);

  const forYouCards = [
    {
      label: 'Новое место',
      title: primaryPartner?.name ?? 'Откройте место дня',
      image: profileImageOf(primaryPartner),
      onClick: primaryPartner ? () => onOpenPartner?.(primaryPartner) : undefined,
    },
    {
      label: 'Событие',
      title: eventItem?.title ?? 'Городская встреча',
      image: contentImageOf(eventItem),
      onClick: onOpenEvents,
    },
    {
      label: 'Эксперт',
      title: expertItem?.name ?? expertItem?.specialization ?? 'Эксперт недели',
      image: profileImageOf(expertItem) || profileImageOf(primaryPartner),
      onClick: onOpenExperts,
    },
    {
      label: 'Акция',
      title: promoPartner?.offer ?? promoPartner?.name ?? 'Предложение партнёра',
      image: profileImageOf(promoPartner),
      onClick: promoPartner ? () => onOpenPartner?.(promoPartner) : undefined,
    },
    {
      label: 'Подарок',
      title: 'Подарки этой недели',
      image: raffleImage,
      onClick: onOpenRewards,
    },
  ];

  const visibleEvents = [eventItem, secondEvent, events[2]].filter(Boolean).slice(0, 3);
  const apgNews = news.filter(item => getNewsCategory(item) === 'apg');
  const newsItems = ((apgNews.length ? apgNews : news).length ? (apgNews.length ? apgNews : news) : [{ title: 'Город становится ближе' }, { title: 'Новые предложения' }, { title: 'Планы на неделю' }]).slice(0, 3);
  while (newsItems.length < 3) newsItems.push({ title: newsItems.length === 1 ? 'Новые предложения' : 'Планы на неделю' });

  const fallbackCardBg = 'radial-gradient(circle at 24% 14%, rgba(244,217,140,0.28), transparent 38%), radial-gradient(circle at 86% 76%, rgba(82,54,102,0.16), transparent 40%), linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025))';
  const renderImageLayer = (image, intensity = 0.54) => image ? (
    <img src={image} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: intensity, filter: 'saturate(1.08) contrast(1.04)' }} />
  ) : (
    <div style={{ position: 'absolute', inset: 0, background: fallbackCardBg }}>
      <div style={{ position: 'absolute', left: '18%', top: '18%', width: 88, height: 88, borderRadius: 34, background: V2.goldMetal, opacity: 0.18, filter: 'blur(6px)' }} />
      <div style={{ position: 'absolute', right: '12%', bottom: '16%', width: 126, height: 126, borderRadius: 48, border: '1px solid rgba(244,217,140,0.18)', transform: 'rotate(-14deg)' }} />
    </div>
  );
  const layerShade = 'var(--apg2-image-shade, radial-gradient(circle at 22% 8%, rgba(244,217,140,0.14), transparent 34%), linear-gradient(180deg, rgba(14,14,16,0.04), rgba(14,14,16,0.28) 42%, rgba(14,14,16,0.88)))';

  return (
    <section style={{
      ...GlassPanel,
      padding: '24px 0 calc(96px + env(safe-area-inset-bottom, 0px))',
      background: V2.pageBg,
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '0 22px 18px' }}>
        <div style={{ color: V2.text, fontSize: 30, lineHeight: '35px', fontWeight: 780, letterSpacing: 0, marginBottom: 9 }}>
          Что интересного сегодня
        </div>
        <div style={{ color: V2.textMuted, fontSize: 14, lineHeight: '22px', fontWeight: 420 }}>
          Подборка поводов выйти в город и открыть новые места
        </div>
      </div>

      <div onTouchStart={e => e.stopPropagation()}>
        <HorizontalScroll>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '0 18px 26px', scrollSnapType: 'x mandatory', scrollPaddingLeft: 18 }}>
            {forYouCards.map((card, index) => (
              <button
                key={`${card.label}-${index}`}
                onClick={card.onClick}
                {...pressMotion}
                style={{
                  width: index === 0 ? 246 : index === 1 ? 204 : 184,
                  height: index === 0 ? 278 : index === 1 ? 244 : 214,
                  flexShrink: 0, border: 'none', borderRadius: index === 0 ? 34 : 30,
                  overflow: 'hidden', padding: 0, position: 'relative', textAlign: 'left', cursor: 'pointer',
                  ...GlassCard,
                  background: fallbackCardBg,
                  boxShadow: '0 26px 68px var(--apg2-elev-shadow, rgba(0,0,0,0.30)), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -24px 48px rgba(255,255,255,0.035)',
                  animation: 'fadeInUp 0.54s ease both',
                  animationDelay: `${index * 0.05}s`,
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                }}
              >
                {renderImageLayer(card.image, index === 0 ? 0.6 : 0.52)}
                <div style={{ position: 'absolute', inset: 0, background: layerShade }} />
                <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: index === 0 ? 22 : 18, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ alignSelf: 'flex-start', ...GlassBadge, padding: '7px 11px' }}>
                    {card.label}
                  </span>
                  <span style={{ marginTop: 'auto', marginBottom: index === 0 ? 16 : 10, alignSelf: 'stretch', padding: index === 0 ? '13px 15px' : '11px 13px', borderRadius: index === 0 ? 24 : 22, color: V2.text, fontSize: index === 0 ? 18 : 16, lineHeight: index === 0 ? '22px' : '20px', fontWeight: 780, textShadow: '0 10px 28px rgba(0,0,0,0.18)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', background: 'rgba(var(--apg2-glass-a,255,255,255),0.24)', border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.15))', backdropFilter: 'blur(36px) saturate(1.55)', WebkitBackdropFilter: 'blur(36px) saturate(1.55)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}>
                    {card.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </HorizontalScroll>
      </div>

      <div style={{ padding: '0 0 0' }}>
        <NewsFeed news={newsItems} onOpenNews={onOpenNews} />

        <div style={{ color: V2.text, fontSize: 26, lineHeight: '31px', fontWeight: 780, marginBottom: 16 }}>
          Ближайшие мероприятия
        </div>

        {visibleEvents.length === 0 ? (
          <div style={{ ...GlassCard, borderRadius: 36, padding: 22, minHeight: 146, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: fallbackCardBg, animation: 'fadeInUp 0.5s ease both' }}>
            <span style={{ ...GlassBadge, alignSelf: 'flex-start' }}>Скоро</span>
            <span>
              <span style={{ display: 'block', color: V2.text, fontSize: 22, lineHeight: '27px', fontWeight: 790, marginBottom: 7 }}>Афиша обновляется</span>
              <span style={{ display: 'block', color: V2.textMuted, fontSize: 13, lineHeight: '19px', fontWeight: 440 }}>Мы добавим новые события, как только партнёры подтвердят расписание.</span>
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={onOpenEvents}
              {...pressMotion}
              style={{
                minHeight: 184, border: 'none', borderRadius: 32, padding: 0, cursor: 'pointer', textAlign: 'left',
                ...GlassCard,
                overflow: 'hidden',
                position: 'relative',
                background: fallbackCardBg,
                animation: 'fadeInUp 0.5s ease both',
              }}
            >
              {renderImageLayer(contentImageOf(visibleEvents[0]), 0.42)}
              <div style={{ position: 'absolute', inset: 0, background: 'var(--apg2-ticket-shade, radial-gradient(circle at 16% 8%, rgba(244,217,140,0.18), transparent 34%), linear-gradient(90deg, rgba(14,14,16,0.90), rgba(14,14,16,0.52) 58%, rgba(14,14,16,0.26)))' }} />
              <div style={{ position: 'absolute', left: 126, top: 0, bottom: 0, width: 1, background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.22), transparent)' }} />
              <div style={{ position: 'absolute', left: 114, top: -13, width: 26, height: 26, borderRadius: '50%', background: 'var(--apg2-ticket-cut, #0F1011)' }} />
              <div style={{ position: 'absolute', left: 114, bottom: -13, width: 26, height: 26, borderRadius: '50%', background: 'var(--apg2-ticket-cut, #0F1011)' }} />
              <div style={{ position: 'relative', zIndex: 1, minHeight: 184, padding: 16, display: 'grid', gridTemplateColumns: '88px 1fr', gap: 18, alignItems: 'center' }}>
                <div style={{ width: 86, minHeight: 116, borderRadius: 28, ...V2.goldGlass, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1C1609', padding: '14px 8px 12px', boxSizing: 'border-box', textAlign: 'center' }}>
                  <span style={{ fontSize: 31, lineHeight: '31px', fontWeight: 920, letterSpacing: 0 }}>{eventDayParts(visibleEvents[0]).day}</span>
                  {eventDayParts(visibleEvents[0]).month && (
                    <span style={{ marginTop: 5, fontSize: 12, lineHeight: '15px', fontWeight: 860, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.78 }}>{eventDayParts(visibleEvents[0]).month}</span>
                  )}
                  <span style={{ width: 38, height: 1, margin: '10px 0 8px', background: 'rgba(28,22,9,0.22)' }} />
                  <span style={{ fontSize: 11, lineHeight: '14px', fontWeight: 850, opacity: 0.72 }}>{eventTime(visibleEvents[0])}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ ...GlassBadge, display: 'inline-flex', marginBottom: 12 }}>Афиша мероприятий</span>
                  <span style={{ color: V2.text, fontSize: 23, lineHeight: '28px', fontWeight: 800, marginBottom: 9, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
                    {titleOf(visibleEvents[0], 'Событие АПГ')}
                  </span>
                  <span style={{ display: 'block', color: V2.textSoft, fontSize: 13, lineHeight: '18px', fontWeight: 440, marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {visibleEvents[0].partner || visibleEvents[0].address || 'Зеленоград'}
                  </span>
                  <span style={{ ...GlassButton, minHeight: 38, padding: '0 17px', fontSize: 13 }}>Подробнее</span>
                </div>
              </div>
            </button>

            {visibleEvents.slice(1, 3).map((event, index) => (
            <button
              key={`${event.id ?? event.title}-${index}`}
              onClick={onOpenEvents}
              {...pressMotion}
              style={{
                border: 'none', borderRadius: 32, padding: '18px 18px 17px', cursor: 'pointer', textAlign: 'left',
                ...GlassCard,
                display: 'grid', gridTemplateColumns: '82px 1fr auto', alignItems: 'center', gap: 14,
                animation: 'fadeInUp 0.5s ease both',
                animationDelay: `${index * 0.05}s`,
              }}
            >
              <span style={{ color: 'transparent', background: V2.goldMetal, WebkitBackgroundClip: 'text', backgroundClip: 'text', fontSize: 22, lineHeight: '26px', fontWeight: 840, whiteSpace: 'nowrap' }}>
                {eventDayShort(event)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: V2.text, fontSize: 16, lineHeight: '20px', fontWeight: 800, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {titleOf(event, 'Событие АПГ')}
                </span>
                <span style={{ display: 'block', color: V2.textMuted, fontSize: 12, lineHeight: '16px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {eventTime(event)} · {event.partner || event.address || 'Зеленоград'}
                </span>
              </span>
              <span style={{ width: 38, height: 38, borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V2.text, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 18, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)' }}>
                →
              </span>
            </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Модальное окно события ───────────────────────────────────────────────────

function EventModal({ event, onClose }) {
  if (!event) return null;
  const eventImage = contentImageOf(event);

  const modal = (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-end',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: T.surface,
        backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        borderRadius: '24px 24px 0 0',
        width: '100%', padding: '24px 20px 48px',
        maxHeight: '85vh', overflowY: 'auto',
        border: '1px solid var(--c-header-border, rgba(255,255,255,0.1))',
        borderBottom: 'none',
      }} onClick={e => e.stopPropagation()}>

        {/* Ручка */}
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Обложка события */}
        {eventImage && (
          <div style={{ margin: '-24px -20px 20px', overflow: 'hidden', borderRadius: '0' }}>
            <img src={eventImage} alt="" loading="lazy" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display='none'} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 52 }}>{event.emoji ?? '🎉'}</div>
          <button onClick={onClose} style={{
            background: T.chipBg, border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: T.textSec,
          }}>✕</button>
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: T.textPri, marginBottom: 12, lineHeight: '26px' }}>
          {(event.priority ?? 0) >= 8 && <span style={{ fontSize: 10, fontWeight: 800, color: T.gold, background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 5, padding: '2px 6px', marginRight: 7, verticalAlign: 'middle' }}>📌 Важно</span>}
          {event.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {event.date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: T.blue + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
              <span style={{ color: T.textPri, fontSize: 14 }}>{event.date}</span>
            </div>
          )}
          {event.partner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: T.gold + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
              <span style={{ color: T.textPri, fontSize: 14 }}>{event.partner}</span>
            </div>
          )}
          {event.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: T.green + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</div>
              <span style={{ color: T.textPri, fontSize: 14 }}>{event.address}</span>
            </div>
          )}
        </div>

        {event.description && (
          <div style={{
            background: T.chipBg, borderRadius: 14,
            padding: 14, marginBottom: 20,
            border: `1px solid ${T.border}`,
          }}>
            <RichText color={T.textSec} fontSize={14}>{event.description}</RichText>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.address && (
            <button onClick={() => openUrl(`https://yandex.ru/maps/?text=${encodeURIComponent(event.address)}`)} style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #FF6600, #FF8C00)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              🗺️ Проложить маршрут
            </button>
          )}
          {event.socialUrl && (
            <button onClick={() => openUrl(event.socialUrl)} style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${T.blue}, #2D6FBC)`,
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              📲 Перейти к событию
            </button>
          )}
          {event.linkUrl && event.linkLabel && (
            <button onClick={() => openUrl(event.linkUrl)} style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: `1px solid ${T.border}`,
              background: T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              color: T.textPri, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              {event.linkLabel} →
            </button>
          )}
          <button onClick={onClose} style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            border: `1px solid ${T.border}`,
            background: T.chipBg, color: T.textSec,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

// ─── Карточка события ─────────────────────────────────────────────────────────

function EventCard({ event, onClick, index = 0, isDark = true }) {
  const gradientsDark = [
    'linear-gradient(135deg, #1a1a4e, #2d4a8a)',
    'linear-gradient(135deg, #1a3a1a, #2d6a3a)',
    'linear-gradient(135deg, #3a1a1a, #7a3030)',
    'linear-gradient(135deg, #2a1a3a, #5a2d7a)',
    'linear-gradient(135deg, #1a3a3a, #2d7a6a)',
  ];
  const gradientsLight = [
    'linear-gradient(135deg, rgba(74,144,217,0.12), rgba(74,144,217,0.06))',
    'linear-gradient(135deg, rgba(75,179,75,0.12), rgba(75,179,75,0.06))',
    'linear-gradient(135deg, rgba(230,70,70,0.12), rgba(230,70,70,0.06))',
    'linear-gradient(135deg, rgba(142,68,173,0.12), rgba(142,68,173,0.06))',
    'linear-gradient(135deg, rgba(26,188,156,0.12), rgba(26,188,156,0.06))',
  ];
  const gradients = isDark ? gradientsDark : gradientsLight;
  const grad = gradients[(event.id?.charCodeAt(0) ?? 0) % gradients.length];

  return (
    <div onClick={() => onClick(event)} style={{
      width: 220, flexShrink: 0, borderRadius: 20, overflow: 'hidden',
      background: grad, cursor: 'pointer',
      border: `1px solid ${T.border}`,
      position: 'relative',
      animation: 'fadeInUp 0.4s ease both',
      animationDelay: `${index * 0.08}s`,
    }}>
      {/* Золотая полоска сверху */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${T.gold}, transparent)` }} />

      <div style={{ padding: '16px 14px 14px' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>{event.emoji ?? '🎉'}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 6, lineHeight: '18px' }}>
          {event.title}
        </div>
        {event.date && (
          <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, marginBottom: 2 }}>
            📅 {event.date}
          </div>
        )}
        {event.partner && (
          <div style={{ fontSize: 11, color: T.textSec }}>📍 {event.partner}</div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: T.gold, fontWeight: 700 }}>
          Подробнее →
        </div>
      </div>
    </div>
  );
}

// ─── Логотип партнёра с fallback на инициалы ────────────────────────────────

function PartnerLogo({ partner, size = 56 }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const initial = name[0].toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (!partner.logoUrl || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue},50%,52%), hsl(${hue},42%,44%))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 800,
        color: '#fff',
        border: `1.5px solid ${T.border}`,
      }}>
        {initial}
      </div>
    );
  }
  return (
    <img
      src={partner.logoUrl} alt={name} loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${T.border}`, display: 'block', flexShrink: 0 }}
    />
  );
}

// ─── Карточка партнёра ────────────────────────────────────────────────────────

function PartnerCard({ partner, isFavorite, onOpen, onToggleFavorite, index = 0 }) {
  const isNew = (() => {
    if (!partner.createdAt) return false;
    const ts = partner.createdAt.toDate ? partner.createdAt.toDate() : new Date(partner.createdAt);
    return Date.now() - ts.getTime() < 14 * 24 * 60 * 60 * 1000;
  })();

  return (
    <div style={{
      ...GLASS,
      borderRadius: 20, padding: 16, textAlign: 'center',
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
      animation: 'fadeInUp 0.45s ease both',
      animationDelay: `${index * 0.07}s`,
      height: '100%', boxSizing: 'border-box',
    }}>
      {/* Золотая точка если в избранном */}
      {isFavorite && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: T.gold, boxShadow: `0 0 6px ${T.gold}`,
        }} />
      )}
      {/* NEW бейдж */}
      {isNew && !partner.offer && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(74,144,217,0.85)', border: '1px solid rgba(74,144,217,0.9)',
          borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 800, color: '#ffffff',
        }}>✦ NEW</div>
      )}
      {/* Бейдж акции */}
      {partner.offer && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: T.green + '22', border: `1px solid ${T.green}55`,
          borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: T.green,
        }}>🎁 акция</div>
      )}

      <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }}>
        <PartnerLogo partner={partner} size={56} />
        <button onClick={() => onToggleFavorite(partner.id)} style={{
          position: 'absolute', top: -4, right: -4,
          background: isFavorite ? T.red : T.chipBg,
          border: `1px solid ${isFavorite ? T.red : T.border}`,
          borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 10, padding: 0, color: isFavorite ? '#fff' : T.textPri,
        }}>
          {isFavorite ? '♥' : '♡'}
        </button>
        {partner.visitCount > 0 && (
          <div style={{
            position: 'absolute', bottom: -4, left: -4,
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: '1px 5px',
            fontSize: 9, fontWeight: 700, color: T.textSec, lineHeight: '14px',
          }}>×{partner.visitCount}</div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, lineHeight: '16px', marginBottom: 3 }}>
          {partner.name ?? 'Партнёр'}
        </div>
        {partner.avgRating > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#FFD700', letterSpacing: 0.5 }}>
              {'★'.repeat(Math.round(partner.avgRating))}{'☆'.repeat(5 - Math.round(partner.avgRating))}
            </span>
            <span style={{ fontSize: 10, color: T.textSec }}>{partner.avgRating.toFixed(1)}</span>
          </div>
        ) : partner.categoryLabel ? (
          <div style={{ fontSize: 10, color: T.gold }}>
            {CATEGORIES.find(c => c.id === partner.category)?.emoji} {partner.categoryLabel}
          </div>
        ) : null}
      </div>

      {partner.stampTarget > 0 && (() => {
        const filled = Math.min(partner.visitCount ?? 0, partner.stampTarget);
        const pct = (filled / partner.stampTarget) * 100;
        const done = filled >= partner.stampTarget;
        return (
          <div style={{ width: '100%', marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: done ? T.gold : T.textSec, fontWeight: 700 }}>🎟️ Штамп</span>
              <span style={{ fontSize: 9, color: done ? T.gold : T.textSec, fontWeight: 700 }}>{filled}/{partner.stampTarget}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: done ? T.gold : 'rgba(201,168,76,0.5)', transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })()}

      <button onClick={() => onOpen(partner)} style={{
        width: '100%', padding: '9px 0', borderRadius: 12, border: 'none',
        background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
        color: '#0F0F1A', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        marginTop: 'auto',
      }}>
        Подробнее
      </button>
    </div>
  );
}

// ─── Партнёр дня ─────────────────────────────────────────────────────────────

function FeaturedPartnerCard({ partner, onOpen }) {
  return (
    <div style={{ margin: '0 16px 4px', animation: 'fadeInUp 0.4s ease both' }}>
      <button onClick={() => onOpen(partner)} style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: 0, background: 'none',
      }}>
        <div style={{
          borderRadius: 24,
          ...GLASS_GOLD,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* Метка */}
          <div style={{ flexShrink: 0 }}>
            <PartnerLogo partner={partner} size={52} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#FFD700', letterSpacing: 1.2, textTransform: 'uppercase' }}>⭐ Партнёр дня</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FFD700', background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, padding: '1px 6px' }}>+2 🗝️</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>{partner.name}</div>
            {partner.offer && (
              <div style={{ fontSize: 12, color: T.textSec, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🎁 {partner.offer}
              </div>
            )}
          </div>

          <div style={{ fontSize: 18, color: T.textSec, flexShrink: 0 }}>›</div>
        </div>
      </button>
    </div>
  );
}

// ─── Партнёр месяца ──────────────────────────────────────────────────────────

function PartnerOfMonthCard({ partner, onOpen }) {
  const stats = partner.activityStats;
  const parts = [];
  if (stats?.newClients > 0) parts.push(`${stats.newClients} новых клиентов`);
  if (stats?.avgRating > 0) parts.push(`рейтинг ${stats.avgRating.toFixed(1)} ⭐`);
  const reason = parts.join(', ');

  return (
    <div style={{ margin: '8px 16px 4px', animation: 'fadeInUp 0.4s ease both' }}>
      <button onClick={() => onOpen(partner)} style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: 0, background: 'none',
      }}>
        <div style={{
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(201,168,76,0.14) 0%, rgba(201,168,76,0.05) 100%)',
          border: '1px solid rgba(201,168,76,0.35)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 4px 20px rgba(201,168,76,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ flexShrink: 0, position: 'relative' }}>
            <PartnerLogo partner={partner} size={52} />
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 20, height: 20, borderRadius: '50%',
              background: 'linear-gradient(135deg, #C9A84C, #E8C76D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, border: '2px solid rgba(15,15,26,0.9)',
            }}>🏆</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>
              🏆 Партнёр месяца
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>{partner.name}</div>
            {reason && (
              <div style={{ fontSize: 12, color: T.textSec, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {reason}
              </div>
            )}
          </div>
          <div style={{ fontSize: 18, color: T.textSec, flexShrink: 0 }}>›</div>
        </div>
      </button>
    </div>
  );
}

// ─── Новостной виджет ────────────────────────────────────────────────────────

function NewsModal({ item, onClose }) {
  const [dragY, setDragY]           = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchY      = useRef(null);
  const sheetRef    = useRef(null);
  const scrollRef   = useRef(null);
  const closeTimer  = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const THRESHOLD = 110;

  // Non-passive touchmove: intercept downward drag only when inner scroll is at top
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (touchY.current === null) return;
      const dy = e.touches[0].clientY - touchY.current;
      if (dy <= 0) return;
      if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
      e.preventDefault();
      setDragY(Math.min(dy, 420));
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  const onTouchStart = (e) => {
    e.stopPropagation();
    touchY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchEnd = (e) => {
    if (touchY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    setIsDragging(false);
    if (dy >= THRESHOLD) {
      setDragY(700);
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(onClose, 300);
    } else {
      setDragY(0);
    }
  };

  const dateStr = item.createdAt?.toDate
    ? item.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const newsImage = contentImageOf(item);

  const pct = Math.max(0, 1 - dragY / 280);

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: `rgba(0,0,0,${(0.72 * pct).toFixed(2)})`,
        display: 'flex', alignItems: 'flex-end',
        backdropFilter: `blur(${(6 * pct).toFixed(1)}px)`,
        WebkitBackdropFilter: `blur(${(6 * pct).toFixed(1)}px)`,
      }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface,
          backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
          borderRadius: '24px 24px 0 0',
          width: '100%', maxHeight: '88vh',
          border: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', borderBottom: 'none',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : motionTransition(['transform'], 'modal', 'soft'),
          willChange: 'transform',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Ручка — всегда активна для свайпа */}
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: '14px auto 6px', flexShrink: 0 }} />

        {/* Скроллируемый контент */}
        <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1 }}>
          {newsImage && (
            <img src={newsImage} alt="" loading="lazy" onError={e => { e.target.style.display = 'none'; }}
              style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block', marginTop: 8 }} />
          )}
          <div style={{ padding: '20px 20px 48px' }}>
            {!newsImage && item.emoji && <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>{item.emoji}</div>}
            <div style={{ fontSize: 22, fontWeight: 900, color: T.textPri, lineHeight: 1.3, marginBottom: 12, letterSpacing: -0.4 }}>{item.title}</div>
            {dateStr && <div style={{ fontSize: 11, color: T.textSec, marginBottom: 14 }}>{dateStr}</div>}
            <div style={{ fontSize: 15, color: T.textSec, lineHeight: '24px', whiteSpace: 'pre-wrap' }}>{item.text}</div>
            {item.linkUrl && item.linkLabel && (
              <button
                type="button"
                onClick={() => openUrl(item.linkUrl)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 24,
                  padding: '16px 18px',
                  background: T.chipBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  color: T.textPri,
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {item.linkLabel} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

function NewsWidget({ news = [], onOpenNews }) {
  const [modal, setModal] = useState(null);
  const items = useMemo(() => (Array.isArray(news) ? news.filter(Boolean).slice(0, 8) : []), [news]);

  if (!items.length) return null;

  return (
    <>
      <div style={{ margin: '0 0 28px', ...GLASS_STRONG, borderRadius: 32, overflow: 'hidden', position: 'relative', ...revealMotion(0, 'panel') }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 16% 0%, rgba(244,217,140,0.13), transparent 34%)' }} />
        <div style={{ position: 'relative', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 880, color: T.gold, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 6 }}>✦ Новости АПГ</div>
              <div style={{ color: T.textPri, fontSize: 22, lineHeight: '27px', fontWeight: 900 }}>Что нового в городе</div>
            </div>
            <button
              type="button"
              onClick={onOpenNews}
              style={{ border: '1px solid rgba(201,168,76,0.28)', background: 'rgba(201,168,76,0.12)', color: T.gold, borderRadius: 999, minHeight: 36, padding: '0 13px', fontSize: 12, fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Все →
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory', paddingBottom: 2, margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}>
            {items.map((item, index) => {
              const image = getNewsImage(item);
              return (
                <button
                  key={item.id || `${getNewsTitle(item)}-${index}`}
                  type="button"
                  onClick={() => setModal(item)}
                  {...pressMotion}
                  style={{ flex: '0 0 248px', minHeight: 282, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', borderRadius: 28, padding: 0, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: T.textPri, textAlign: 'left', overflow: 'hidden', cursor: 'pointer', scrollSnapAlign: 'start', fontFamily: 'inherit' }}
                >
                  <span style={{ display: 'block', position: 'relative', height: 136, background: 'radial-gradient(circle at 20% 16%, rgba(244,217,140,0.26), transparent 42%), rgba(255,255,255,0.06)' }}>
                    {image && <img src={image} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(8,8,10,0.72))' }} />
                    <span style={{ position: 'absolute', left: 12, top: 12, padding: '7px 10px', borderRadius: 999, background: 'rgba(8,8,10,0.48)', border: '1px solid rgba(244,217,140,0.24)', color: T.gold, fontSize: 10.5, lineHeight: '13px', fontWeight: 850, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>{getNewsCategoryLabel(item)}</span>
                    {hasNewsVideo(item) && <span style={{ position: 'absolute', right: 12, top: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(8,8,10,0.52)', border: '1px solid rgba(255,255,255,0.20)', color: '#fff' }}>▶</span>}
                  </span>
                  <span style={{ display: 'grid', gap: 9, padding: 14 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: T.textSec, fontSize: 10.5, fontWeight: 720 }}>
                      <span>{formatNewsDate(item)}</span>
                      <span>{getReadingMinutes(item)} мин</span>
                      {isFreshNews(item) && <span style={{ color: T.gold }}>Новое</span>}
                    </span>
                    <span style={{ color: T.textPri, fontSize: 17, lineHeight: '21px', fontWeight: 900, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsTitle(item)}</span>
                    <span style={{ color: T.textSec, fontSize: 12.5, lineHeight: '18px', fontWeight: 520, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsText(item) || 'Короткий материал АПГ. Откройте, чтобы узнать больше.'}</span>
                    <span style={{ marginTop: 2, color: T.textSoft, fontSize: 11, fontWeight: 720 }}>{getNewsViews(item)} просмотров</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {modal && <NewsModal item={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function NewsFeed({ news, onOpenNews }) {
  return <NewsWidget news={news} onOpenNews={onOpenNews} />;
}

// ─── Баннер ───────────────────────────────────────────────────────────────────

function HeroBanner({ userKeys, userName, streak }) {
  const level    = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const pct      = getLevelProgress(userKeys);
  const toNext   = getKeysToNext(userKeys);

  return (
    <div style={{
      margin: '8px 16px',
      borderRadius: 28,
      ...GLASS_STRONG,
      padding: '22px 20px 20px',
      position: 'relative', overflow: 'hidden',
      animation: 'fadeInUp 0.5s ease both',
    }}>
      {/* Лёгкий золотой gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, transparent 60%)', pointerEvents: 'none', borderRadius: 28 }} />
      <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}28, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10, opacity: 0.85 }}>
          ✦ Альянс Партнёров Города
        </div>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: T.textSec, fontWeight: 500, marginBottom: 2 }}>Добро пожаловать,</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T.textPri, lineHeight: 1.15, letterSpacing: -0.5 }}>
              {userName ?? 'участник'} 👋
            </div>
          </div>
          {streak >= 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,100,0,0.15)', border: '1px solid rgba(255,100,0,0.35)', borderRadius: 12, padding: '6px 10px', gap: 1 }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#FF8C42' }}>{streak}</span>
              <span style={{ fontSize: 8, color: T.textSec, textTransform: 'uppercase', letterSpacing: 0.3 }}>дней</span>
            </div>
          )}
        </div>

        {/* Уровень + ключи */}
        <div style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 18, padding: '14px 16px', border: `1px solid ${level.color}44`, boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.2)` }}>

          {/* Верхняя строка: уровень и счётчик */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `${level.color}30`, border: `1px solid ${level.color}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {level.emoji}
              </div>
              <div>
                <div style={{ fontSize: 11, color: level.color, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{level.label}</div>
                <div style={{
                  fontSize: 22, fontWeight: 900, color: T.textPri, lineHeight: 1, letterSpacing: -0.5,
                  display: 'inline-block',
                  animation: counterPulse ? 'keyCounterPulse 0.42s ease-out' : undefined,
                }}>
                  {userKeys} <span style={{ fontSize: 14, fontWeight: 700, color: T.goldL }}>🗝️</span>
                </div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 3 }}>
                  {nextLevel ? `До ${nextLevel.label}: ${toNext} ключей` : 'Максимальный уровень 👑'}
                </div>
              </div>
            </div>
            {nextLevel && (
              <div style={{ textAlign: 'center', background: T.chipBg, borderRadius: 10, padding: '6px 10px', border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.textSec, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>следующий</div>
                <div style={{ fontSize: 16 }}>{nextLevel.emoji}</div>
                <div style={{ fontSize: 9, color: T.textPri, fontWeight: 700 }}>{nextLevel.label}</div>
              </div>
            )}
          </div>

          {/* Прогресс-бар */}
          <div style={{ height: 8, background: T.border, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, ${level.color}, ${T.goldL})`,
              borderRadius: 8, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: `0 0 12px ${level.color}`,
            }} />
          </div>

          {/* Подпись */}
          <div style={{ fontSize: 12, color: T.textPri, textAlign: 'center', fontWeight: 600 }}>
            {nextLevel
              ? `До ${nextLevel.emoji} ${nextLevel.label}: ещё ${toNext} ключей`
              : '👑 Максимальный уровень — вы Амбассадор АПГ!'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Стрик ───────────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [3, 7, 30];

function StreakWidget({ streak, lastScanDate, onOpenTasks }) {
  if (streak < 1) return null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const scannedToday = lastScanDate === todayKey;

  const nextMilestone = STREAK_MILESTONES.find(m => streak < m) ?? null;
  const daysLeft = nextMilestone ? nextMilestone - streak : 0;

  // Показываем 7 точек: последние дни серии + сегодня
  const totalDots = 7;
  const dots = Array.from({ length: totalDots }, (_, i) => {
    const daysAgo = totalDots - 1 - i; // 6..0
    if (daysAgo === 0) return scannedToday ? 'done' : 'today';
    return streak > daysAgo ? 'done' : 'empty';
  });

  const flameSize = streak >= 30 ? 28 : streak >= 7 ? 24 : 20;

  return (
    <div style={{ margin: '10px 16px 0', borderRadius: 24, padding: '14px 16px', background: T.chipBg, backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', border: '1px solid rgba(255,100,0,0.22)', boxShadow: '0 8px 28px rgba(0,0,0,0.18), inset 0 1.5px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeInUp 0.4s ease both' }}>
      {/* Иконка пламени */}
      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,100,0,0.15)', border: '1px solid rgba(255,100,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: flameSize, flexShrink: 0 }}>
        🔥
      </div>

      {/* Контент */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#FF8C42', lineHeight: 1 }}>{streak}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,140,66,0.8)', fontWeight: 600 }}>{streak === 1 ? 'день подряд' : streak < 5 ? 'дня подряд' : 'дней подряд'}</span>
        </div>

        {/* Точки-дни */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          {dots.map((state, i) => (
            <div key={i} style={{
              width: state === 'done' ? 18 : 16,
              height: state === 'done' ? 18 : 16,
              borderRadius: '50%',
              background: state === 'done' ? 'linear-gradient(135deg, #FF8C42, #FF4500)' : state === 'today' ? 'rgba(255,140,66,0.2)' : T.border,
              border: state === 'today' ? '2px dashed rgba(255,140,66,0.6)' : state === 'done' ? '2px solid rgba(255,140,66,0.6)' : `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, transition: 'all 0.3s',
              boxShadow: state === 'done' ? '0 0 6px rgba(255,140,66,0.4)' : 'none',
            }}>
              {state === 'done' ? '✓' : ''}
            </div>
          ))}
        </div>

        {/* Подсказка */}
        {scannedToday
          ? <div style={{ fontSize: 11, color: T.textSec }}>{nextMilestone ? `До задания «${nextMilestone} дней»: ещё ${daysLeft}` : '🏆 Рекорд! Так держать!'}</div>
          : <div style={{ fontSize: 11, color: '#FF8C42', fontWeight: 600 }}>Посети партнёра сегодня, чтобы не потерять серию</div>
        }
      </div>

      {/* Кнопка к заданиям */}
      {nextMilestone && (
        <button onClick={onOpenTasks} style={{ background: 'rgba(255,100,0,0.15)', border: '1px solid rgba(255,100,0,0.3)', borderRadius: 10, padding: '6px 10px', color: '#FF8C42', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, textAlign: 'center', lineHeight: '14px' }}>
          🎁<br/>{daysLeft}д
        </button>
      )}
    </div>
  );
}

// ─── Быстрые действия ────────────────────────────────────────────────────────

function QuickActions({ onShare, onOpenLeaderboard, onOpenEvents, onOpenTasks, onOpenRewards, userRank }) {
  const actions = [
    { icon: '🗓️', label: 'События',               color: T.blue,    onClick: onOpenEvents },
    { icon: '✦',  label: 'Задания',               color: '#9B7EDF', onClick: onOpenTasks },
    { icon: '🏆', label: 'Рейтинг', rank: userRank, color: T.gold,    onClick: onOpenLeaderboard },
    { icon: '🎁', label: 'Призы',                 color: T.green,   onClick: onOpenRewards },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 16px' }}>
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick} style={{
          ...GLASS,
          borderRadius: 20, padding: '13px 4px',
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 7, position: 'relative',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 14,
            background: `linear-gradient(145deg, ${a.color}28, ${a.color}10)`,
            border: `1px solid ${a.color}35`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px ${a.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {a.icon}
          </div>
          <span style={{ color: T.textSec, fontSize: 10, fontWeight: 600 }}>{a.label}</span>
          {a.rank != null && (
            <div style={{
              position: 'absolute', top: 6, right: 6,
              background: T.gold, borderRadius: 8, padding: '1px 5px',
              fontSize: 9, fontWeight: 800, color: '#0F0F1A', lineHeight: '14px',
            }}>#{a.rank}</div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Логотип ─────────────────────────────────────────────────────────────────

function ApgLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="0.75" y="0.75" width="28.5" height="28.5" rx="8" fill="rgba(201,168,76,0.12)" stroke="rgba(201,168,76,0.45)" strokeWidth="1.5"/>
        <polygon points="15,4 24,15 15,26 6,15" fill="rgba(201,168,76,0.07)" stroke="#C9A84C" strokeWidth="1.3"/>
        <line x1="15" y1="4" x2="15" y2="26" stroke="rgba(201,168,76,0.22)" strokeWidth="0.8"/>
        <line x1="6" y1="15" x2="24" y2="15" stroke="rgba(201,168,76,0.22)" strokeWidth="0.8"/>
        <circle cx="15" cy="15" r="2.8" fill="#C9A84C"/>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: 17, letterSpacing: 2, lineHeight: 1 }}>АПГ</span>
          <span style={{ color: 'rgba(201,168,76,0.6)', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1 }}>Зеленоград</span>
        </div>
        <span style={{ color: 'rgba(201,168,76,0.45)', fontSize: 7.5, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', lineHeight: 1 }}>Альянс Партнёров Города</span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skel({ w = '100%', h = 16, radius = 8, style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, flexShrink: 0,
      background: `linear-gradient(90deg, ${T.border} 0%, rgba(201,168,76,0.08) 50%, ${T.border} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      ...extra,
    }} />
  );
}

function SkeletonHome() {
  return (
    <div>
      {/* Hero */}
      <div style={{ margin: '8px 16px', borderRadius: 24, ...GLASS, padding: '22px 20px' }}>
        <Skel h={11} w={140} radius={6} style={{ marginBottom: 10 }} />
        <Skel h={26} w={190} radius={8} style={{ marginBottom: 4 }} />
        <Skel h={18} w={110} radius={8} style={{ marginBottom: 18 }} />
        <div style={{ background: T.chipBg, borderRadius: 14, padding: '12px 14px' }}>
          <Skel h={14} w={160} radius={6} style={{ marginBottom: 10 }} />
          <Skel h={5} radius={3} />
        </div>
      </div>

      {/* QuickActions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '12px 16px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ ...GLASS, borderRadius: 16, padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Skel w={38} h={38} radius={12} />
            <Skel w={32} h={10} radius={5} />
          </div>
        ))}
      </div>

      {/* Partners */}
      <div style={{ padding: '20px 16px 8px' }}>
        <Skel h={18} w={140} radius={8} style={{ marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ ...GLASS, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Skel w={56} h={56} radius={28} />
              <Skel h={13} w={80} radius={6} />
              <Skel h={10} w={56} radius={5} />
              <Skel h={34} radius={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Закрытые мероприятия ─────────────────────────────────────────────────────

function calcTimeLeft(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function PrivateEventCard({ event, userKeys, isRegistered, onRegister }) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(event.eventDate));

  useEffect(() => {
    if (!event.eventDate) return;
    const id = setInterval(() => setTimeLeft(calcTimeLeft(event.eventDate)), 1000);
    return () => clearInterval(id);
  }, [event.eventDate]);

  const minKeys = event.minKeys ?? 0;
  const hasEnough = minKeys === 0 || userKeys >= minKeys;
  const isFull = event.maxParticipants > 0 && (event.registeredCount ?? 0) >= event.maxParticipants;
  const isPast = timeLeft === null && !!event.eventDate;
  const need = minKeys - userKeys;

  return (
    <div style={{ margin: '16px 16px 0', ...GLASS_GOLD, borderRadius: 24, padding: '18px 18px 16px' }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>{event.emoji ?? '🎉'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>✦ Следующее мероприятие АПГ</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: '19px' }}>
              {(event.priority ?? 0) >= 8 && <span style={{ fontSize: 9, fontWeight: 800, color: T.gold, background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 4, padding: '1px 5px', marginRight: 5, verticalAlign: 'middle' }}>📌</span>}
              {event.title}
            </div>
          </div>
        </div>
        {isRegistered && (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.green + '18', border: `1px solid ${T.green}40`, borderRadius: 10, padding: '4px 9px', flexShrink: 0 }}>✓ Записан</div>
        )}
      </div>

      {/* Таймер обратного отсчёта */}
      {!isPast && event.eventDate && timeLeft && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
          {[
            { v: timeLeft.days,    l: 'дн'  },
            { v: timeLeft.hours,   l: 'ч'   },
            { v: timeLeft.minutes, l: 'мин' },
            { v: timeLeft.seconds, l: 'сек' },
          ].map(({ v, l }) => (
            <div key={l} style={{ flex: 1, ...GLASS, borderRadius: 14, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.textPri, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{String(v).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: T.textSec, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {isPast && (
        <div style={{ fontSize: 12, color: T.textSec, textAlign: 'center', marginBottom: 12 }}>Мероприятие состоялось</div>
      )}

      {/* Прогресс ключей */}
      {minKeys > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: T.textSec }}>Прогресс к порогу</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: hasEnough ? T.green : T.gold }}>
              {Math.min(userKeys, minKeys)} / {minKeys} 🗝️
            </span>
          </div>
          <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.min((userKeys / minKeys) * 100, 100)}%`,
              background: hasEnough
                ? `linear-gradient(90deg, ${T.green}, #6ECC6E)`
                : `linear-gradient(90deg, ${T.gold}, ${T.goldL})`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Кнопка */}
      {isRegistered ? (
        <button onClick={() => onRegister(event)} style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: `1px solid ${T.green}40`, background: T.green + '12', color: T.green, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ✓ Я записан — отменить?
        </button>
      ) : isFull ? (
        <div style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: T.chipBg, border: `1px solid ${T.border}`, color: T.textSec, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
          Мест нет
        </div>
      ) : isPast ? null : hasEnough ? (
        <button onClick={() => onRegister(event)} style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          Я иду! 🎉
        </button>
      ) : (
        <div style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: T.chipBg, border: `1px solid ${T.border}`, color: T.textSec, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
          Нужно ещё {need} {need === 1 ? 'ключ' : need < 5 ? 'ключа' : 'ключей'} 🗝️
        </div>
      )}

      {/* Дата, место и поделиться */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={{ fontSize: 11, color: T.textSec }}>
          {event.date && `📅 ${event.date}`}{event.address && ` · ${event.address}`}
        </div>
        <button
          onClick={async () => {
            const text = `🔒 Закрытое мероприятие АПГ: «${event.title}»${event.date ? ` — ${event.date}` : ''}. Нужно ${minKeys} ключей АПГ для входа!`;
            if (navigator.share) {
              try { await navigator.share({ title: 'АПГ', text, url: APP_URL }); return; } catch (err) { if (err.name === 'AbortError') return; }
            }
            vkBridge.send('VKWebAppShare', { link: APP_URL, text }).catch(() => {});
          }}
          style={{ background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '5px 10px', fontSize: 11, color: T.textSec, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
        >
          ↗ Поделиться
        </button>
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

const VK_APP_URL = 'https://vk.com/app54601851';

function openVKApp() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href =
      'intent://vk.com/app54601851#Intent;scheme=https;package=com.vkontakte.android;' +
      'S.browser_fallback_url=' + encodeURIComponent(VK_APP_URL) + ';end';
    return;
  }
  window.location.href = VK_APP_URL;
}

function V2FullHomeSections({
  user,
  partners,
  events,
  recentReviews,
  favorites,
  userKeys,
  completedTasks,
  referralCount,
  scannedCount,
  streak,
  userRank,
  userCount,
  joinedGroup,
  partnerOfMonth,
  featuredPartner,
  taskPreview,
  nextPrivateEvent,
  registeredEventIds,
  onOpenPartner,
  onToggleFavorite,
  onOpenEvents,
  onOpenTasks,
  onOpenRewards,
  onOpenLeaderboard,
  onOpenNearby,
  onOpenMap,
  onShare,
  onJoinGroup,
  onOpenForPartners,
  onEventRegister,
  onSelectEvent,
}) {
  const imageOf = (item) => item?.imageUrl || item?.coverPhoto || item?.logoUrl || item?.photoUrl || item?.photo || item?.image || '';
  const titleOf = (item, fallback) => String(item?.title || item?.name || item?.offer || fallback).trim();
  const firstName = user?.first_name || user?.firstName || user?.name?.split(' ')?.[0] || 'участник';
  const topPartners = [
    partnerOfMonth,
    featuredPartner && featuredPartner.id !== partnerOfMonth?.id ? featuredPartner : null,
    ...partners.filter(p => p.id !== partnerOfMonth?.id && p.id !== featuredPartner?.id),
  ].filter(Boolean).slice(0, 6);
  const visibleReviews = recentReviews.slice(0, 4);
  const visibleEvents = events.slice(0, 5);
  const keyGoal = Math.max(10, Math.ceil((userKeys + 1) / 10) * 10);
  const keyProgress = Math.min(100, Math.round((userKeys / keyGoal) * 100));
  const keysLeft = Math.max(0, keyGoal - userKeys);
  const quickActions = [
    { icon: '◌', label: 'Локи', sub: 'помощник АПГ', onClick: onOpenLoki },
    { icon: '⌕', label: 'Справочник', sub: 'быстрые ответы', onClick: onOpenReference },
    { icon: '✦', label: 'Получить ключ', sub: 'Скан QR у партнера', onClick: onOpenTasks },
    { icon: '⌖', label: 'Рядом со мной', sub: 'Места поблизости', onClick: onOpenNearby || onOpenMap },
    { icon: '◆', label: 'Розыгрыши', sub: 'Подарки недели', onClick: onOpenRewards },
    { icon: '◷', label: 'Все события', sub: visibleEvents.length ? `${visibleEvents.length} в афише` : 'Афиша города', onClick: onOpenEvents },
  ];
  const fallbackBg = 'radial-gradient(circle at 22% 12%, rgba(244,217,140,0.26), transparent 36%), radial-gradient(circle at 86% 78%, rgba(82,54,102,0.16), transparent 42%), linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025))';
  const imageLayer = (image, opacity = 0.5) => image ? (
    <img src={image} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity, filter: 'saturate(1.08) contrast(1.04)' }} />
  ) : (
    <div style={{ position: 'absolute', inset: 0, background: fallbackBg }}>
      <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: 44, right: -28, top: 18, border: '1px solid rgba(244,217,140,0.18)', transform: 'rotate(-18deg)' }} />
      <div style={{ position: 'absolute', width: 70, height: 70, borderRadius: 26, left: 22, bottom: 24, background: V2.goldMetal, opacity: 0.16, filter: 'blur(5px)' }} />
    </div>
  );

  return (
    <section style={{
      padding: '10px 22px 180px',
      background: 'radial-gradient(circle at 8% 14%, rgba(244,217,140,0.085), transparent 30%), radial-gradient(circle at 92% 48%, rgba(82,54,102,0.13), transparent 38%), linear-gradient(180deg, #0F1011 0%, #121217 48%, #0D0E10 100%)',
      overflow: 'hidden',
    }}>
      <div style={{ ...GlassCard, borderRadius: 38, border: 'none', padding: 18, marginBottom: 14, background: 'radial-gradient(circle at 12% 0%, rgba(244,217,140,0.16), transparent 36%), linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))', animation: 'fadeInUp 0.5s ease both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ color: V2.text, fontSize: 22, lineHeight: '27px', fontWeight: 800 }}>До следующей награды</div>
            <div style={{ color: V2.textMuted, fontSize: 13, lineHeight: '18px', marginTop: 5 }}>{firstName}, осталось {keysLeft} {keysLeft === 1 ? 'ключ' : keysLeft < 5 ? 'ключа' : 'ключей'}</div>
          </div>
          <div style={{ width: 58, height: 58, borderRadius: 23, background: V2.goldMetal, color: '#18130A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 900, boxShadow: '0 18px 42px rgba(216,184,103,0.20), inset 0 1px 0 rgba(255,255,255,0.42)' }}>{userKeys}</div>
        </div>
        <button
          onClick={onOpenTasks}
          {...pressMotion}
          style={{ width: '100%', border: 'none', padding: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ display: 'block', height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.09)', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09)' }}>
            <span style={{ display: 'block', height: '100%', width: `${keyProgress}%`, borderRadius: 99, background: V2.goldMetal, boxShadow: '0 0 28px rgba(244,217,140,0.28)', transition: 'width 0.5s ease' }} />
          </span>
          <span style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', color: V2.textMuted, fontSize: 12, lineHeight: '16px', fontWeight: 650 }}>
            <span>{userKeys} ключей сейчас</span>
            <span>{keyGoal} цель</span>
          </span>
        </button>
      </div>

      <div style={{ color: V2.text, fontSize: 27, lineHeight: '32px', fontWeight: 790, marginBottom: 16 }}>Быстрые действия</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 34 }}>
        {quickActions.map((action, index) => (
          <button key={action.label} onClick={action.onClick} {...pressMotion} style={{ ...GlassCard, border: 'none', borderRadius: 32, padding: 16, minHeight: 132, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: index === 0 ? 'radial-gradient(circle at 25% 0%, rgba(244,217,140,0.18), transparent 42%), linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035))' : GlassCard.background, animation: 'fadeInUp 0.48s ease both', animationDelay: `${0.08 + index * 0.035}s` }}>
            <span style={{ width: 42, height: 42, borderRadius: 18, background: V2.goldMetal, color: '#18130A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, boxShadow: '0 14px 30px rgba(216,184,103,0.16), inset 0 1px 0 rgba(255,255,255,0.34)' }}>{action.icon}</span>
            <span>
              <span style={{ display: 'block', color: V2.text, fontSize: 17, lineHeight: '21px', fontWeight: 810, marginBottom: 5 }}>{action.label}</span>
              <span style={{ display: 'block', color: V2.textMuted, fontSize: 12, lineHeight: '16px', fontWeight: 560 }}>{action.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div>
          <div style={{ color: V2.text, fontSize: 27, lineHeight: '32px', fontWeight: 790 }}>Партнер дня</div>
          <div style={{ color: V2.textMuted, fontSize: 13, lineHeight: '19px', marginTop: 4 }}>Места, которые стоит открыть</div>
        </div>
        <button onClick={onOpenNearby || onOpenMap} style={{ ...GlassButton, minHeight: 38, padding: '0 15px', fontSize: 12, border: 'none', cursor: 'pointer' }}>Рядом</button>
      </div>

      {topPartners.length === 0 ? (
        <div style={{ ...GlassCard, borderRadius: 38, padding: 22, minHeight: 160, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: fallbackBg, marginBottom: 34 }}>
          <span style={{ ...GlassBadge, alignSelf: 'flex-start' }}>Скоро</span>
          <span>
            <span style={{ display: 'block', color: V2.text, fontSize: 22, lineHeight: '27px', fontWeight: 790 }}>Партнеры появятся здесь</span>
            <span style={{ display: 'block', color: V2.textMuted, fontSize: 13, lineHeight: '19px', marginTop: 7 }}>Мы готовим подборку мест АПГ.</span>
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: 34 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 12, marginBottom: 12 }}>
            <button onClick={() => onOpenPartner?.(topPartners[0])} {...pressMotion} style={{ ...GlassCard, minHeight: 270, border: 'none', borderRadius: 38, overflow: 'hidden', position: 'relative', padding: 0, cursor: 'pointer', textAlign: 'left', background: fallbackBg }}>
              {imageLayer(imageOf(topPartners[0]), 0.55)}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(14,14,16,0.06), rgba(14,14,16,0.34) 42%, rgba(14,14,16,0.88))' }} />
              <div style={{ position: 'relative', zIndex: 1, minHeight: 270, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <span style={{ ...GlassBadge, alignSelf: 'flex-start' }}>{topPartners[0].partnerOfMonth ? 'Партнер месяца' : 'Рекомендуем'}</span>
                <span>
                  <span style={{ color: V2.text, fontSize: 24, lineHeight: '29px', fontWeight: 810, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textShadow: '0 12px 30px rgba(0,0,0,0.48)' }}>{titleOf(topPartners[0], 'Партнер АПГ')}</span>
                  {topPartners[0].offer && <span style={{ display: 'block', color: V2.textSoft, fontSize: 13, lineHeight: '18px', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topPartners[0].offer}</span>}
                </span>
              </div>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topPartners.slice(1, 3).map((partner, index) => (
                <button key={partner.id ?? partner.name} onClick={() => onOpenPartner?.(partner)} {...pressMotion} style={{ ...GlassCard, border: 'none', borderRadius: 30, minHeight: 129, padding: 14, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                  {imageLayer(imageOf(partner), 0.24)}
                  <span style={{ position: 'relative', zIndex: 1, color: 'transparent', background: V2.goldMetal, WebkitBackgroundClip: 'text', backgroundClip: 'text', fontSize: 11, lineHeight: '15px', fontWeight: 820 }}>{index === 0 ? 'Акция' : 'Место'}</span>
                  <span style={{ position: 'relative', zIndex: 1, color: V2.text, fontSize: 16, lineHeight: '20px', fontWeight: 790, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{titleOf(partner, 'Партнер')}</span>
                </button>
              ))}
            </div>
          </div>

          {topPartners.length > 3 && (
            <div onTouchStart={e => e.stopPropagation()}>
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 10, paddingBottom: 2 }}>
                  {topPartners.slice(3).map((partner, index) => (
                    <button key={partner.id ?? partner.name} onClick={() => onOpenPartner?.(partner)} {...pressMotion} style={{ ...GlassCard, width: 154, height: 112, flexShrink: 0, border: 'none', borderRadius: 26, padding: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <span style={{ color: V2.textMuted, fontSize: 11, lineHeight: '14px', fontWeight: 650 }}>{partner.categoryLabel || 'АПГ'}</span>
                      <span style={{ color: V2.text, fontSize: 14, lineHeight: '18px', fontWeight: 780, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{titleOf(partner, 'Партнер')}</span>
                    </button>
                  ))}
                </div>
              </HorizontalScroll>
            </div>
          )}
        </div>
      )}

      {nextPrivateEvent && (
        <button onClick={() => onSelectEvent?.(nextPrivateEvent)} {...pressMotion} style={{ ...GlassCard, width: '100%', border: 'none', borderRadius: 38, minHeight: 150, padding: 18, marginBottom: 34, cursor: 'pointer', textAlign: 'left', display: 'grid', gridTemplateColumns: '72px 1fr', gap: 15, alignItems: 'center', background: fallbackBg }}>
          <span style={{ width: 68, height: 96, borderRadius: 26, ...V2.goldGlass, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1C1609' }}>
            <span style={{ fontSize: 18, fontWeight: 900 }}>VIP</span>
            <span style={{ fontSize: 10, fontWeight: 850, marginTop: 5 }}>{registeredEventIds.includes(nextPrivateEvent.id) ? 'вы идете' : 'закрытое'}</span>
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ ...GlassBadge, display: 'inline-flex', marginBottom: 10 }}>Закрытое событие</span>
            <span style={{ color: V2.text, fontSize: 20, lineHeight: '25px', fontWeight: 810, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{titleOf(nextPrivateEvent, 'Событие АПГ')}</span>
          </span>
        </button>
      )}

      <div style={{ color: V2.text, fontSize: 27, lineHeight: '32px', fontWeight: 790, marginBottom: 16 }}>Задания и бонусы</div>
      <div style={{ display: 'grid', gridTemplateColumns: taskPreview.length > 1 ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 34 }}>
        {(taskPreview.length ? taskPreview : [{ id: 'keys-empty', title: 'Сканируйте QR у партнеров', reward: 1, emoji: '◎', ready: false }]).slice(0, 2).map((task, index) => (
          <button key={task.id ?? task.title} onClick={onOpenTasks} {...pressMotion} style={{ ...GlassCard, border: 'none', borderRadius: 32, minHeight: 146, padding: 17, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: task.ready ? 'radial-gradient(circle at 22% 12%, rgba(244,217,140,0.22), transparent 38%), linear-gradient(145deg, rgba(255,255,255,0.10), rgba(255,255,255,0.032))' : GlassCard.background }}>
            <span style={{ fontSize: 25, lineHeight: '28px' }}>{task.emoji || '✦'}</span>
            <span>
              <span style={{ color: V2.text, fontSize: 17, lineHeight: '22px', fontWeight: 790, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.title}</span>
              <span style={{ display: 'block', color: task.ready ? V2.gold : V2.textMuted, fontSize: 12, lineHeight: '16px', fontWeight: 720, marginTop: 8 }}>{task.ready ? 'Можно забрать' : `+${task.reward ?? 1} ключ`}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div>
          <div style={{ color: V2.text, fontSize: 27, lineHeight: '32px', fontWeight: 790 }}>Отзывы</div>
          <div style={{ color: V2.textMuted, fontSize: 13, lineHeight: '19px', marginTop: 4 }}>Живые впечатления участников</div>
        </div>
      </div>

      {visibleReviews.length === 0 ? (
        <div style={{ ...GlassCard, borderRadius: 36, padding: 20, minHeight: 136, marginBottom: 34, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ ...GlassBadge, alignSelf: 'flex-start' }}>Скоро</span>
          <span style={{ color: V2.text, fontSize: 19, lineHeight: '24px', fontWeight: 780 }}>Отзывы появятся после первых визитов</span>
        </div>
      ) : (
        <div onTouchStart={e => e.stopPropagation()} style={{ marginBottom: 34 }}>
          <HorizontalScroll>
            <div style={{ display: 'flex', gap: 12, paddingBottom: 2 }}>
              {visibleReviews.map((review, index) => (
                <div key={review.id ?? index} style={{ ...GlassCard, width: index === 0 ? 250 : 214, minHeight: 164, flexShrink: 0, borderRadius: 34, padding: 17, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', animation: 'fadeInUp 0.5s ease both', animationDelay: `${index * 0.04}s` }}>
                  <span style={{ color: '#F4D98C', fontSize: 13, letterSpacing: 1 }}>{'★'.repeat(Math.max(1, Math.min(5, review.stars ?? 5)))}</span>
                  <span style={{ color: V2.text, fontSize: 15, lineHeight: '21px', fontWeight: 650, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{review.text || `Отзыв о ${review.partnerName || 'партнере АПГ'}`}</span>
                  <span style={{ color: V2.textMuted, fontSize: 12, lineHeight: '16px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{review.userName || 'Участник АПГ'} · {review.partnerName || 'АПГ'}</span>
                </div>
              ))}
            </div>
          </HorizontalScroll>
        </div>
      )}

      {!joinedGroup && (
        <button onClick={onJoinGroup} {...pressMotion} style={{ ...GlassCard, width: '100%', border: 'none', borderRadius: 36, padding: 18, minHeight: 122, marginBottom: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 54, height: 54, borderRadius: 22, background: V2.goldMetal, color: '#18130A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, flexShrink: 0 }}>АПГ</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', color: V2.text, fontSize: 18, lineHeight: '23px', fontWeight: 800 }}>Вступить в сообщество</span>
            <span style={{ display: 'block', color: V2.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 4 }}>Новости, акции и +1 ключ за подписку</span>
          </span>
        </button>
      )}

      {userCount > 0 && (
        <button onClick={onOpenForPartners} {...pressMotion} style={{ ...GlassCard, width: '100%', border: 'none', borderRadius: 32, padding: 17, minHeight: 84, textAlign: 'left', cursor: onOpenForPartners ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: V2.text, fontSize: 16, lineHeight: '21px', fontWeight: 780 }}>Уже {userCount.toLocaleString('ru')} жителей в АПГ</span>
          <span style={{ color: 'transparent', background: V2.goldMetal, WebkitBackgroundClip: 'text', backgroundClip: 'text', fontSize: 20, fontWeight: 900 }}>→</span>
        </button>
      )}

      <div style={{ textAlign: 'center', padding: '30px 0 0', color: V2.textMuted, fontSize: 11, lineHeight: '16px', letterSpacing: 1.2, textTransform: 'uppercase' }}>
        АПГ 2.0 · Зеленоград
      </div>
    </section>
  );
}

export function HomePanelV2({
  user, userKeys = 0, favorites = [], partners = [], experts = [], events = [], news = [], recentReviews = [],
  loading = false, error = null, streak = 0, lastScanDate = null,
  completedTasks = [], referralCount = 0, scannedCount = 0, unreadCount = 0, isWebMode = false,
  registeredEventIds = [], onEventRegister, userRank = null, customTasks = [],
  appearance = 'light',
  joinedGroup = false, onJoinGroup,
  userCount = 0, onOpenForPartners,
  counterPulse = false,
  onOpenPartner, onToggleFavorite, onScan, onShare, onOpenEvents, onOpenExperts, onOpenOffers, onOpenTasks, onOpenLeaderboard, onRetry, onOpenNotifications, onRefresh, onOpenMap, onOpenNearby, onOpenRewards, onOpenReference, onOpenLoki, onOpenNews,
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Pull-to-refresh ────────────────────────────────────────────────────────
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef       = useRef(null);
  const touchStartY        = useRef(0);
  const touchStartScroll   = useRef(0);
  const pullYRef           = useRef(0);
  const isRefreshingRef    = useRef(false);

  const PULL_TRIGGER = 28; // dampened px to trigger refresh
  const PULL_DAMPEN  = 0.45;
  const PULL_MAX     = 56;

  const updatePull = (val) => { pullYRef.current = val; setPullY(val); };

  const handleTouchStart = useCallback((e) => {
    if (isRefreshingRef.current) return;
    touchStartScroll.current = window.scrollY;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (isRefreshingRef.current) return;
    // Проверяем текущую позицию скролла — если не в самом верху, PTR не активируем
    if (window.scrollY > 4) { updatePull(0); return; }
    if (touchStartScroll.current > 4) { updatePull(0); return; }
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy <= 0) { updatePull(0); return; }
    updatePull(Math.min(dy * PULL_DAMPEN, PULL_MAX));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    const py = pullYRef.current;
    if (py >= PULL_TRIGGER) {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      updatePull(0);
      try { await onRefresh?.(); } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    } else {
      updatePull(0);
    }
  }, [onRefresh]);

  const featuredPartner   = partners.find(p => p.featured === true) ?? null;
  const partnerOfMonth    = partners.find(p => p.partnerOfMonth === true) ?? null;

  const nextPrivateEvent = useMemo(() => {
    const privates = events.filter(e => e.isPrivate);
    if (!privates.length) return null;
    const nowMs = Date.now();
    const upcoming = privates
      .filter(e => e.eventDate && new Date(e.eventDate).getTime() > nowMs)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    if (upcoming.length) return upcoming[0];
    return privates.sort((a, b) => new Date(b.eventDate || 0) - new Date(a.eventDate || 0))[0] ?? null;
  }, [events]);

  const taskPreview = useMemo(() => {
    function checkCustom(t) {
      const v = t.target ?? 0;
      switch (t.type) {
        case 'keys':      return userKeys >= v;
        case 'favs':      return favorites.length >= v;
        case 'referrals': return referralCount >= v;
        case 'streak':    return streak >= v;
        case 'scanned':   return scannedCount >= v;
        case 'manual':    return true;
        default:          return false;
      }
    }
    const statuses = TASKS.map(t => ({
      ...t,
      done:  completedTasks.includes(t.id),
      ready: t.check(userKeys, favorites.length, referralCount, streak, scannedCount) && !completedTasks.includes(t.id),
      prog:  t.progress ? t.progress(userKeys, favorites.length, referralCount, streak, scannedCount) : 0,
    }));
    const customStatuses = customTasks.map(t => ({
      ...t,
      done:  completedTasks.includes(t.id),
      ready: checkCustom(t) && !completedTasks.includes(t.id),
      prog:  0,
    }));
    const all = [...statuses, ...customStatuses];
    const claimable  = all.filter(s => s.ready);
    const inProgress = all.filter(s => !s.done && !s.ready);
    return [...claimable, ...inProgress].slice(0, 2);
  }, [userKeys, favorites.length, referralCount, streak, scannedCount, completedTasks, customTasks]);

  const isSearching = searchQuery.trim().length > 0;
  const filteredPartners = useMemo(() => partners
    .filter(p => isSearching || activeCategory === 'all' || p.category === activeCategory)
    .filter(p => !isSearching || (() => {
      const q = searchQuery.trim().toLowerCase();
      return p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.categoryLabel?.toLowerCase().includes(q) ||
        p.offer?.toLowerCase().includes(q);
    })()), [partners, isSearching, activeCategory, searchQuery]);

  return (
    <Panel id="home" data-home-version="v2">
      <span data-home-version="v2" style={{ display: 'none' }} />
      {/* GreetingSection */}
      <V2FirstScreen
        user={user}
        userKeys={userKeys}
        events={events}
        featuredPartner={featuredPartner}
        partnerOfMonth={partnerOfMonth}
        unreadCount={unreadCount}
        onOpenNotifications={onOpenNotifications}
        onOpenPartner={onOpenPartner}
        onOpenNearby={onOpenNearby}
        onOpenEvents={onOpenEvents}
        onOpenRewards={onOpenRewards}
        onOpenTasks={onOpenTasks}
        onOpenReference={onOpenReference}
        onOpenLoki={onOpenLoki}
      />

      {/* Pull-to-refresh indicator */}
      <div style={{
        height: isRefreshing ? 52 : Math.round(pullY),
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: (isRefreshing || pullY === 0) ? 'height 0.3s ease' : 'none',
        background: 'transparent', pointerEvents: 'none',
      }}>
        {(pullY > 12 || isRefreshing) && (
          <>
            <span style={{
              fontSize: 18, display: 'inline-block', color: T.gold, lineHeight: 1,
              animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none',
              transform: isRefreshing ? 'none' : `rotate(${Math.min((pullY / PULL_TRIGGER) * 180, 180)}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.15s',
            }}>↻</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>
              {isRefreshing ? 'Обновление...' : pullY >= PULL_TRIGGER ? 'Отпустите' : 'Потяните вниз'}
            </span>
          </>
        )}
      </div>

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ background: 'transparent', minHeight: '100%' }}
      >

        {/* HeroSection */}
        {loading && <SkeletonHome />}

        {!loading && error && (
          <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ animation: 'float 3s ease-in-out infinite' }}>
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="46" fill="rgba(230,70,70,0.05)" stroke="rgba(230,70,70,0.18)" strokeWidth="1.5"/>
                <path d="M22 52 C22 38 35 26 50 26 C65 26 78 38 78 52" stroke="rgba(230,70,70,0.35)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                <path d="M31 60 C31 50 40 41 50 41 C60 41 69 50 69 60" stroke="rgba(230,70,70,0.55)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                <line x1="43" y1="68" x2="57" y2="82" stroke="#E64646" strokeWidth="3" strokeLinecap="round"/>
                <line x1="57" y1="68" x2="43" y2="82" stroke="#E64646" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="50" cy="75" r="6" fill="rgba(230,70,70,0.1)"/>
              </svg>
            </div>
            <div>
              <div style={{ color: T.textPri, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Нет подключения</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px', marginBottom: 20 }}>Проверьте интернет и попробуйте снова</div>
              <button onClick={onRetry} style={{
                padding: '13px 36px', borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
                color: '#0F0F1A', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Повторить</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <V2SecondScreen
              user={user}
              partners={partners}
              experts={experts}
              events={events}
              news={news}
              featuredPartner={featuredPartner}
              partnerOfMonth={partnerOfMonth}
              onOpenPartner={onOpenPartner}
              onOpenEvents={onOpenEvents}
              onOpenExperts={onOpenExperts}
              onOpenRewards={onOpenRewards}
              onOpenNews={onOpenNews}
            />

          </>
        )}
      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </Panel>
  );
}
