import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RichText } from './components/RichText.jsx';
import { TASKS } from './tasks.js';
import { getLevel, getNextLevel, getLevelProgress, getKeysToNext } from './levels.js';
import { Panel } from '@vkontakte/vkui';
import vkBridge, { openUrl } from './vk.js';
import { APP_URL } from './constants.js';
import { MOTION, motionDelay, motionTransition } from './motion.js';
import { formatEventPrice } from './eventPrice.js';
import { formatNewsDate, getNewsCategory, getNewsCategoryLabel, getNewsImage, getNewsPhotoItems, getNewsReactionsTotal, getNewsStats, getNewsText, getNewsTitle, getNewsViews, getReadingMinutes, hasNewsVideo, isFreshNews } from './newsUtils.js';
import { buildAdaptiveHomeData } from './interestEngine.js';
import { APG2_PROFILE } from './components/Apg2ProfileGlass.jsx';
import { DesktopTopOverview } from './components/DesktopUI.jsx';
import { LokiIdentity } from './loki/LokiIdentity.jsx';
import { selectActualEvents } from './eventSchedule.js';
import { haversine, formatDistance } from './utils/geo.js';

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
  { id: 'shopping',      label: 'Магазины',      emoji: '🛍️' },
  { id: 'other',         label: 'Другое',        emoji: '📦' },
];

const getCategoryTone = (categoryId) => {
  const palette = [
    { bg: 'rgba(244,217,140,0.24)', border: 'rgba(244,217,140,0.46)', color: 'rgba(244,217,140,0.98)' },
    { bg: 'rgba(101,163,255,0.20)', border: 'rgba(101,163,255,0.44)', color: 'rgba(177,214,255,0.95)' },
    { bg: 'rgba(106,224,174,0.18)', border: 'rgba(106,224,174,0.45)', color: 'rgba(196,255,230,0.95)' },
    { bg: 'rgba(255,149,130,0.20)', border: 'rgba(255,149,130,0.42)', color: 'rgba(255,205,196,0.95)' },
    { bg: 'rgba(171,128,255,0.19)', border: 'rgba(171,128,255,0.44)', color: 'rgba(220,205,255,0.95)' },
  ];
  const safe = String(categoryId || 'other').toLowerCase();
  let idx = 0;
  for (let i = 0; i < safe.length; i += 1) {
    idx = ((idx << 5) - idx + safe.charCodeAt(i)) & 0xffffffff;
  }
  return palette[Math.abs(idx) % palette.length];
};

const contentImageOf = (item) =>
  getNewsPhotoItems(item)[0]?.url || item?.coverPhoto || item?.imageUrl || item?.thumbnail || item?.banner || item?.image || '';

const profileImageOf = (item) =>
  item?.coverPhoto || item?.imageUrl || item?.logoUrl || item?.photoUrl || item?.photo || item?.image || '';

const getEntityKey = (item) => String(item?.id ?? `${item?.title ?? ''}-${item?.date ?? ''}-${item?.time ?? ''}`);

const pickPrimaryEvent = (events = []) => {
  const normalized = Array.isArray(events) ? events : [];
  return normalized.find(event => contentImageOf(event)) ?? normalized[0] ?? null;
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getEntityCoords = (item = {}) => {
  if (!item || typeof item !== 'object') return null;
  const lat = toFiniteNumber(item.latitude ?? item.lat ?? item.coords?.lat ?? item.location?.lat);
  const lon = toFiniteNumber(item.longitude ?? item.lon ?? item.lng ?? item.long ?? item.coords?.lon ?? item.coords?.lng ?? item.location?.lon ?? item.location?.lng);
  if (lat == null || lon == null) return null;
  return { lat, lon };
};

const getUserCoords = (user = {}) => getEntityCoords(user?.location || user);

const parseDistanceKm = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value || '').replace(',', '.').trim();
  const match = text.match(/([\d.]+)/);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return null;
  return /м\b/i.test(text) && !/км/i.test(text) ? num / 1000 : num;
};

const getEntityDistanceKm = (item, userCoords) => {
  const coords = getEntityCoords(item);
  if (coords && userCoords) return haversine(userCoords.lat, userCoords.lon, coords.lat, coords.lon);
  return parseDistanceKm(item?.distance ?? item?._dist);
};

const formatNearbyDistance = (distanceKm) => {
  if (!Number.isFinite(Number(distanceKm))) return 'город';
  return formatDistance(Number(distanceKm));
};

const isTodayEntity = (item = {}) => {
  const raw = item.eventDate || item.date || item.startDate || item.datetime || item.createdAt;
  const date = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    const today = new Date();
    const day = String(today.getDate());
    const month = today.toLocaleDateString('ru-RU', { month: 'long' });
    return String(raw || '').toLowerCase().includes(day) && String(raw || '').toLowerCase().includes(month);
  }
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

const isEntityOpenNow = (item = {}) => Boolean(item.openNow || item.isOpenNow || item.status === 'open' || item.workStatus === 'open');

const getPopularityScore = (item = {}) => Number(item.views || item.viewCount || item.visits || item.scanCount || item.rating || item.avgRating || item.participants || 0) || 0;

const openRouteForEntity = (item = {}) => {
  const coords = getEntityCoords(item);
  if (coords) {
    openUrl(`https://yandex.ru/maps/?pt=${coords.lon},${coords.lat}&z=16&l=map`);
    return;
  }
  const address = item.address || item.place || item.locationText;
  if (address) openUrl(`https://yandex.ru/maps/?text=${encodeURIComponent(`${address}, Зеленоград`)}`);
};

const V2 = {
  pageBg: APG2_PROFILE.bg,
  text: APG2_PROFILE.text,
  textSoft: APG2_PROFILE.textSoft,
  textMuted: APG2_PROFILE.textMuted,
  gold: APG2_PROFILE.gold,
  goldMetal: APG2_PROFILE.goldGradient,
  glass: APG2_PROFILE.glass,
  glowGlass: {
    ...APG2_PROFILE.glass,
    background: APG2_PROFILE.heroSurface,
    border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.34))',
    boxShadow: '0 42px 104px var(--apg2-elev-shadow, rgba(0,0,0,0.30)), 0 0 74px rgba(216,184,103,0.12), inset 0 2px 0 rgba(var(--apg2-glass-a,255,255,255),0.42), inset 0 -42px 86px rgba(var(--apg2-glass-a,255,255,255),0.07)',
  },
  goldGlass: {
    ...APG2_PROFILE.goldGlass,
  },
  sectionGap: APG2_PROFILE.rhythm.section,
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
  background: 'radial-gradient(circle at 50% 0%, rgba(var(--apg2-glass-a,255,255,255),0.40), transparent 56%), linear-gradient(145deg, var(--apg2-control, rgba(255,255,255,0.38)), var(--apg2-control-soft, rgba(255,255,255,0.18)))',
  border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.32))',
  color: V2.text,
  fontSize: 14,
  fontWeight: 760,
  backdropFilter: V2.glass.backdropFilter,
  WebkitBackdropFilter: V2.glass.WebkitBackdropFilter,
  boxShadow: 'inset 0 1.5px 0 rgba(var(--apg2-glass-a,255,255,255),0.40), inset 0 -14px 28px rgba(var(--apg2-glass-a,255,255,255),0.06), 0 14px 34px var(--apg2-elev-shadow, rgba(0,0,0,0.18))',
  transition: motionTransition(['transform', 'box-shadow'], 'base'),
};

const revealMotion = (index = 0, duration = 'panel') => ({
  animation: `fadeInUp var(--motion-${duration}, ${MOTION.duration[duration] ?? MOTION.duration.panel}ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both`,
  animationDelay: motionDelay(index),
});

const GlassIsland = {
  ...V2.glass,
  borderRadius: 42,
  boxShadow: '0 28px 76px var(--apg2-elev-shadow, rgba(0,0,0,0.34)), 0 0 58px rgba(216,184,103,0.10), inset 0 2px 0 rgba(var(--apg2-glass-a,255,255,255),0.25), inset 0 -26px 52px rgba(var(--apg2-glass-a,255,255,255),0.045)',
};

const GlassBadge = {
  padding: '7px 12px',
  borderRadius: 999,
  color: V2.text,
  fontSize: 11,
  fontWeight: 720,
  background: 'radial-gradient(circle at 35% 0%, rgba(var(--apg2-glass-a,255,255,255),0.36), transparent 58%), var(--apg2-control-soft, rgba(255,255,255,0.24))',
  border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.28))',
  backdropFilter: V2.glass.backdropFilter,
  WebkitBackdropFilter: V2.glass.WebkitBackdropFilter,
  boxShadow: 'inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.36), 0 10px 24px var(--apg2-elev-shadow, rgba(0,0,0,0.14))',
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

const DESKTOP_LAYOUT = {
  containerMax: 'min(1960px, calc(100vw - 28px))',
  pagePaddingX: 'clamp(10px, 1.45vw, 24px)',
  supportColumn: 'minmax(316px, 386px)',
  firstHeroColumns: 'minmax(0, 1.36fr) minmax(316px, 386px)',
  secondColumns: 'minmax(0, 1fr) minmax(300px, 380px)',
  highlightColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  sectionGap: 15,
  compactGap: 10,
  topPad: 'calc(14px + var(--safe-top, 0px))',
  sidePad: 'calc(104px + env(safe-area-inset-bottom, 0px))',
  cardRadius: 24,
  heroHeight: 158,
  heroHeightMobileSecond: 330,
  heroText: 34,
  heroTagline: 14,
  topContentRowHeight: 268,
  lowerContentRowHeight: 198,
  quickBarHeight: 86,
  headerRowGap: 8,
};

const getDesktopLayout = (rawWidth = 1280) => {
  const width = Number.isFinite(Number(rawWidth)) ? Number(rawWidth) : 1280;
  if (width >= 1728) {
    return {
      ...DESKTOP_LAYOUT,
      containerMax: 'min(2260px, calc(100vw - 48px))',
      pagePaddingX: 'clamp(14px, 1.55vw, 30px)',
      supportColumn: 'minmax(390px, 430px)',
      firstHeroColumns: 'minmax(0, 1.58fr) minmax(390px, 430px)',
      secondColumns: 'minmax(0, 1fr) minmax(390px, 430px)',
      sectionGap: 20,
      compactGap: 12,
      sidePad: 'calc(126px + env(safe-area-inset-bottom, 0px))',
      heroHeight: 168,
      heroText: 29,
      heroTagline: 13,
      topContentRowHeight: 276,
      lowerContentRowHeight: 204,
      headerRowGap: 8,
      quickBarHeight: 84,
    };
  }
  if (width >= 1600) {
    return {
      ...DESKTOP_LAYOUT,
      containerMax: 'min(2100px, calc(100vw - 40px))',
      pagePaddingX: 'clamp(12px, 1.55vw, 28px)',
      supportColumn: 'minmax(370px, 410px)',
      firstHeroColumns: 'minmax(0, 1.52fr) minmax(370px, 410px)',
      secondColumns: 'minmax(0, 1fr) minmax(370px, 410px)',
      sectionGap: 18,
      compactGap: 11,
      sidePad: 'calc(120px + env(safe-area-inset-bottom, 0px))',
      heroHeight: 166,
      heroText: 29,
      heroTagline: 13,
      topContentRowHeight: 272,
      lowerContentRowHeight: 202,
      headerRowGap: 8,
      quickBarHeight: 86,
    };
  }
  if (width >= 1440) {
    return {
      ...DESKTOP_LAYOUT,
      containerMax: 'min(1880px, calc(100vw - 34px))',
      pagePaddingX: 'clamp(12px, 1.5vw, 26px)',
      supportColumn: 'minmax(350px, 398px)',
      firstHeroColumns: 'minmax(0, 1.46fr) minmax(350px, 398px)',
      secondColumns: 'minmax(0, 1fr) minmax(350px, 398px)',
      sectionGap: 16,
      compactGap: 11,
      sidePad: 'calc(114px + env(safe-area-inset-bottom, 0px))',
      heroHeight: 162,
      heroText: 28,
      heroTagline: 12.5,
      topContentRowHeight: 268,
      lowerContentRowHeight: 200,
      headerRowGap: 8,
      quickBarHeight: 86,
    };
  }
  if (width >= 1280) {
    return {
      ...DESKTOP_LAYOUT,
      containerMax: 'min(1660px, calc(100vw - 28px))',
      pagePaddingX: 'clamp(10px, 1.35vw, 22px)',
      supportColumn: 'minmax(326px, 382px)',
      firstHeroColumns: 'minmax(0, 1.38fr) minmax(326px, 382px)',
      secondColumns: 'minmax(0, 1fr) minmax(326px, 382px)',
      sectionGap: 16,
      compactGap: 10,
      heroHeight: 158,
      heroText: 27,
      heroTagline: 12.5,
      topContentRowHeight: 260,
      lowerContentRowHeight: 194,
      headerRowGap: 8,
      quickBarHeight: 86,
    };
  }
  return DESKTOP_LAYOUT;
};

const DesktopSectionHeader = {
  color: V2.text,
  fontWeight: 780,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
};

const DesktopTile = {
  ...GlassCard,
  borderRadius: 24,
  padding: 14,
};

const DesktopDenseTile = {
  ...GlassCard,
  borderRadius: 20,
  padding: 10,
};

const EmptyDesktopCard = {
  ...GlassCard,
  borderRadius: 24,
  padding: 12,
  color: V2.textSoft,
};

const horizontalSnapTrack = {
  display: 'flex',
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  scrollSnapType: 'x mandatory',
  scrollBehavior: 'smooth',
  overscrollBehaviorX: 'contain',
  overscrollBehaviorY: 'auto',
  touchAction: 'pan-x',
  scrollbarWidth: 'none',
};

const horizontalSnapItem = {
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
  touchAction: 'manipulation',
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
  streak = 0,
  completedTasks = [],
  referralCount = 0,
  scannedCount = 0,
  registeredEventIds = [],
  favorites = [],
  partners = [],
  counterPulse,
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
  onOpenProfile,
  onOpenOffers,
  onOpenPartners,
  onOpenNews,
  onOpenMap,
  onOpenExperts,
  desktopWorkspaceAvailable = false,
  onSwitchAppMode,
  desktopWorkspaceMode = 'user',
  desktopMode = false,
  isOffline = false,
}) {
  if (desktopMode) {
    return (
      <V2FirstScreenDesktop
        user={user}
        userKeys={userKeys}
        streak={streak}
        completedTasks={completedTasks}
        referralCount={referralCount}
        scannedCount={scannedCount}
        registeredEventIds={registeredEventIds}
        favorites={favorites}
        partners={partners}
        events={events}
        featuredPartner={featuredPartner}
        partnerOfMonth={partnerOfMonth}
        unreadCount={unreadCount}
        counterPulse={counterPulse}
        onOpenNotifications={onOpenNotifications}
        onOpenPartner={onOpenPartner}
        onOpenNearby={onOpenNearby}
        onOpenEvents={onOpenEvents}
        onOpenRewards={onOpenRewards}
        onOpenTasks={onOpenTasks}
        onOpenReference={onOpenReference}
        onOpenLoki={onOpenLoki}
        onOpenProfile={onOpenProfile}
        onOpenOffers={onOpenOffers}
        onOpenPartners={onOpenPartners}
        onOpenNews={onOpenNews}
        onOpenMap={onOpenMap}
        onOpenExperts={onOpenExperts}
        desktopWorkspaceAvailable={desktopWorkspaceAvailable}
        desktopWorkspaceMode={desktopWorkspaceMode}
        onSwitchAppMode={onSwitchAppMode}
        isOffline={isOffline}
      />
    );
  }
  return (
    <V2FirstScreenMobile
      user={user}
      userKeys={userKeys}
      streak={streak}
      completedTasks={completedTasks}
      referralCount={referralCount}
      scannedCount={scannedCount}
      registeredEventIds={registeredEventIds}
      favorites={favorites}
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
      isOffline={isOffline}
      desktopMode={desktopMode}
    />
  );
}

function V2FirstScreenMobile({
  user,
  userKeys,
  streak = 0,
  completedTasks = [],
  referralCount = 0,
  scannedCount = 0,
  registeredEventIds = [],
  favorites = [],
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
  desktopMode = false,
  isOffline = false,
}) {
  const heroPartner = partnerOfMonth ?? featuredPartner ?? null;
  const heroEvent = events.find(e => contentImageOf(e)) ?? events[0] ?? null;
  const heroImage = heroEvent ? contentImageOf(heroEvent) : profileImageOf(heroPartner);
  const heroTitle = heroEvent?.title ?? heroPartner?.name ?? 'Пульс города рядом';
  const heroMeta = heroEvent?.date ?? heroPartner?.offer ?? 'Главный повод выйти в город сегодня';
  const heroAction = heroEvent ? () => onOpenEvents?.(heroEvent) : heroPartner ? () => onOpenPartner?.(heroPartner) : () => onOpenEvents?.();
  const firstName = getUserFirstName(user);
  const greeting = firstName ? `${getDayGreeting()}, ${firstName}!` : `${getDayGreeting()}!`;
  const heroMediaRef = useRef(null);
  const fullName = [user?.first_name || user?.firstName, user?.last_name || user?.lastName].filter(Boolean).join(' ') || user?.displayName || user?.name || 'Участник';
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'У';
  const avatarUrl = user?.photo_200 || user?.photo || user?.avatarUrl || '';
  const level = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const keysToNext = getKeysToNext(userKeys);
  const levelProgress = getLevelProgress(userKeys);
  const nextAchievement = TASKS
    .map(task => ({
      ...task,
      done: completedTasks.includes(task.id),
      progressValue: task.progress ? task.progress(userKeys, favorites.length, referralCount, streak, scannedCount) : 0,
    }))
    .filter(task => !task.done)
    .sort((a, b) => (b.progressValue || 0) - (a.progressValue || 0))[0] || null;
  const profileProgress = Math.max(0, Math.min(100, Math.round(nextAchievement?.progressValue || levelProgress || 0)));
  const eventsTodayCount = events.filter(isTodayEntity).length;
  const todayForYou = unreadCount > 0
    ? 'есть новые уведомления'
    : eventsTodayCount > 0
      ? `${eventsTodayCount} событ. сегодня`
      : keysToNext > 0
        ? `до уровня ${keysToNext} ключей`
        : 'новый уровень уже открыт';

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
      padding: desktopMode ? 'calc(20px + var(--safe-top, 0px)) 26px 18px' : 'calc(14px + var(--safe-top, 0px)) 18px 24px',
      overflow: 'hidden',
      background: V2.pageBg,
    }}>
      <div style={{ position: 'absolute', left: -80, right: -80, top: 128, height: 230, background: 'linear-gradient(110deg, transparent 8%, rgba(244,217,140,0.055) 35%, rgba(255,255,255,0.04) 48%, transparent 74%)', transform: 'rotate(-8deg)', filter: 'blur(1px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: desktopMode ? 1180 : 'none', margin: desktopMode ? '0 auto' : 0, ...revealMotion(0, 'splash') }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 'clamp(16px, 2.4svh, 22px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="АПГ" style={{ width: 44, height: 44, borderRadius: 18, objectFit: 'cover', boxShadow: '0 14px 34px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.18)' }} />
            </picture>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: V2.text, fontSize: 17, lineHeight: '20px', fontWeight: 880, letterSpacing: 0 }}>АПГ: ЗЕЛЕНОГРАД</div>
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

        <div style={{ display: desktopMode ? 'grid' : 'block', gridTemplateColumns: desktopMode ? 'minmax(0, 1.45fr) minmax(320px, 0.85fr)' : undefined, gap: desktopMode ? 16 : undefined, alignItems: 'stretch' }}>
        <button
          onClick={heroAction}
          {...pressMotion}
          style={{
            width: '100%', minHeight: desktopMode ? 330 : 'clamp(176px, 26svh, 236px)', border: 'none', borderRadius: desktopMode ? 38 : 34, padding: 0,
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

          <div style={{ position: 'relative', zIndex: 1, minHeight: desktopMode ? 330 : 'clamp(176px, 26svh, 236px)', padding: desktopMode ? 24 : 'clamp(14px, 2.5svh, 18px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ alignSelf: 'flex-start', ...GlassBadge, padding: 'clamp(5px, 0.9svh, 7px) 11px', fontSize: 'clamp(10px, 1.5svh, 11px)' }}>
                Сегодня нельзя пропустить
              </div>
              <div aria-hidden="true" style={{ width: 'clamp(34px, 5.8svh, 42px)', height: 'clamp(34px, 5.8svh, 42px)', borderRadius: 17, background: V2.goldMetal, boxShadow: '0 12px 32px rgba(216,184,103,0.18), inset 0 1px 0 rgba(255,255,255,0.42), inset 0 -10px 20px rgba(83,58,18,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#18130A', fontSize: 12, fontWeight: 900, letterSpacing: 0 }}>
                АПГ
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--apg2-hero-text, var(--apg2-text, #F7F1E6))', fontSize: desktopMode ? 34 : 'clamp(21px, 3.4svh, 25px)', lineHeight: desktopMode ? '39px' : 'clamp(25px, 4.1svh, 30px)', fontWeight: 800, letterSpacing: 0, marginBottom: 'clamp(6px, 1.2svh, 10px)', textShadow: '0 2px 8px rgba(0,0,0,0.18), 0 18px 42px rgba(0,0,0,0.16)' }}>
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

        <button
          type="button"
          onClick={onOpenTasks}
          {...pressMotion}
          style={{
            width: '100%',
            marginTop: desktopMode ? 0 : 'clamp(10px, 1.9svh, 16px)',
            border: '1px solid rgba(244,217,140,0.22)',
            borderRadius: 30,
            padding: 'clamp(10px, 1.8svh, 13px)',
            textAlign: 'left',
            cursor: 'pointer',
            color: V2.text,
            background: 'radial-gradient(circle at 18% 0%, rgba(244,217,140,0.18), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.034))',
            boxShadow: '0 18px 48px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.13)',
            display: 'grid',
            gap: 9,
            ...revealMotion(2, 'splash'),
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 52, height: 52, borderRadius: 21, overflow: 'hidden', background: V2.goldMetal, color: '#211706', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 920, boxShadow: '0 12px 30px rgba(216,184,103,0.14)' }}>
              {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} /> : initials}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', color: V2.text, fontSize: 17, lineHeight: '20px', fontWeight: 920, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</span>
              <span style={{ display: 'block', color: V2.textSoft, fontSize: 11.3, lineHeight: '14px', fontWeight: 720, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{level.label} · {todayForYou}</span>
            </span>
            <span style={{ borderRadius: 999, padding: '6px 9px', background: 'rgba(244,217,140,0.14)', border: '1px solid rgba(244,217,140,0.28)', color: V2.gold, fontSize: 10.2, lineHeight: '12px', fontWeight: 880 }}>Кабинет</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            {[
              ['Ключи', userKeys, '🗝️'],
              ['Серия', streak, '🔥'],
              ['События', Array.isArray(registeredEventIds) ? registeredEventIds.length : 0, '📅'],
              ['Партнёры', scannedCount, '🏙️'],
            ].map(([label, value, icon]) => (
              <span key={label} style={{ minHeight: 41, borderRadius: 16, padding: '6px 5px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', overflow: 'hidden' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 3, color: V2.gold, fontSize: 12, lineHeight: '14px', fontWeight: 900 }}><span>{icon}</span><span>{value}</span></span>
                <span style={{ display: 'block', color: V2.textMuted, fontSize: 8.6, lineHeight: '10px', fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{label}</span>
              </span>
            ))}
          </div>
          <span style={{ display: 'grid', gap: 5 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: V2.textSoft, fontSize: 10.5, lineHeight: '13px', fontWeight: 760 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextAchievement?.title || (nextLevel ? `До уровня ${nextLevel.label}` : 'Максимальный уровень')}</span>
              <span style={{ color: V2.gold, fontWeight: 900 }}>{profileProgress}%</span>
            </span>
            <span style={{ height: 7, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <span style={{ display: 'block', width: `${profileProgress}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${level.color || V2.gold}, #E8C97A)`, transition: 'width 0.65s ease' }} />
            </span>
          </span>
        </button>

        <div style={{ marginTop: desktopMode ? 0 : 'clamp(10px, 1.9svh, 16px)', ...revealMotion(2, 'splash') }}>
          <div style={{ color: V2.text, fontSize: 'clamp(15px, 2.5svh, 17px)', lineHeight: 'clamp(18px, 3svh, 21px)', fontWeight: 850, marginBottom: 'clamp(7px, 1.4svh, 10px)', opacity: 0.92 }}>
            Что важно сейчас
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: desktopMode ? '1fr' : '1fr 1fr', gap: 10,
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
      </div>
    </section>
  );
}

function V2FirstScreenDesktop({
  user,
  userKeys,
  streak = 0,
  completedTasks = [],
  referralCount = 0,
  scannedCount = 0,
  registeredEventIds = [],
  favorites = [],
  partners = [],
  events,
  featuredPartner,
  partnerOfMonth,
  unreadCount,
  counterPulse = false,
  onOpenNotifications,
  onOpenPartner,
  onOpenNearby,
  onOpenEvents,
  onOpenRewards,
  onOpenTasks,
  onOpenReference,
  onOpenLoki,
  onOpenProfile,
  onOpenPartners,
  onOpenOffers,
  onOpenNews,
  onOpenMap,
  onOpenExperts,
  desktopWorkspaceAvailable = false,
  desktopWorkspaceMode = 'user',
  onSwitchAppMode,
  desktopMode = false,
  isOffline = false,
}) {
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const firstName = getUserFirstName(user);
  const greeting = firstName ? `${getDayGreeting()}, ${firstName}!` : `${getDayGreeting()}!`;
  const heroPartner = partnerOfMonth ?? featuredPartner ?? partners[0] ?? null;
  const heroEvent = pickPrimaryEvent(events);
  const heroImage = heroEvent ? contentImageOf(heroEvent) : profileImageOf(heroPartner);
  const heroTitle = heroEvent?.title ?? heroPartner?.name ?? 'Пульс города сегодня';
  const heroMeta = heroEvent?.date ?? heroPartner?.offer ?? 'Главный повод выйти в город';
  const heroAction = heroEvent ? () => onOpenEvents?.(heroEvent) : heroPartner ? () => onOpenPartner?.(heroPartner) : () => onOpenEvents?.();
  const offerPartner = partners.find(partner => partner?.offer) || heroPartner;
  const level = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const keysToNext = getKeysToNext(userKeys);
  const levelProgress = getLevelProgress(userKeys);
  const fullName = [user?.first_name || user?.firstName, user?.last_name || user?.lastName].filter(Boolean).join(' ') || user?.displayName || user?.name || 'Участник';
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'У';
  const avatarUrl = user?.photo_200 || user?.photo || user?.avatarUrl || '';
  const desktopLayout = getDesktopLayout(typeof window === 'undefined' ? 1280 : window.innerWidth);
  const handleOpenPartners = onOpenPartners;
  const nextAchievement = TASKS
    .map(task => ({
      ...task,
      done: completedTasks.includes(task.id),
      progressValue: task.progress ? task.progress(userKeys, favorites.length, referralCount, streak, scannedCount) : 0,
    }))
    .filter(task => !task.done)
    .sort((a, b) => (b.progressValue || 0) - (a.progressValue || 0))[0] || null;
  const nextAchievementProgress = Math.max(0, Math.min(100, Math.round(nextAchievement?.progressValue || levelProgress || 0)));
  const eventsTodayCount = events.filter(isTodayEntity).length;
  const todayForYou = unreadCount > 0
    ? 'проверьте новые уведомления'
    : eventsTodayCount > 0
      ? `${eventsTodayCount} мероприятие сегодня`
      : offerPartner?.offer
        ? `акция: ${offerPartner.offer}`
        : keysToNext > 0
          ? `до нового уровня осталось ${keysToNext} ключей`
          : 'новый уровень уже открыт';
  const latestActivity = completedTasks.length > 0
    ? `Последнее: ${completedTasks.length} достиж. в профиле`
    : scannedCount > 0
      ? `Последнее: посещено партнёров ${scannedCount}`
      : registeredEventIds.length > 0
        ? `Последнее: запись на событие`
        : userKeys > 0
          ? `Последнее: баланс ${userKeys} ключей`
          : '';
  const profileStats = [
    { label: 'Ключи', value: counterPulse ? `+${userKeys}` : userKeys, accent: V2.gold, icon: '🗝️' },
    { label: 'События', value: Array.isArray(registeredEventIds) ? registeredEventIds.length : 0, accent: '#8EC5FF', icon: '📅' },
    { label: 'Партнёры', value: scannedCount, accent: '#7EE0B8', icon: '🏙️' },
    { label: 'Достиж.', value: completedTasks.length, accent: '#E8C97A', icon: '🏆' },
    { label: 'Серия', value: streak, accent: '#FF8C42', icon: '🔥' },
    { label: 'Друзья', value: referralCount, icon: '👥' },
  ];
  const navItems = [
    { label: 'Главная', isActive: true, onClick: () => {} },
    { label: 'Новости', onClick: onOpenNews },
    { label: 'Мероприятия', onClick: onOpenEvents },
    { label: 'Партнёры', onClick: handleOpenPartners },
    { label: 'Эксперты', onClick: onOpenExperts },
    { label: 'Акции', onClick: onOpenOffers },
    { label: 'Подарки', onClick: onOpenRewards },
    { label: 'О проекте', onClick: onOpenReference },
  ];
  const runDesktopSearch = useCallback(() => {
    const text = desktopSearchQuery.trim();
    if (!text) return;
    const query = text.toLowerCase().replace(/ё/g, 'е');
    if (query.includes('новост') || query.includes('обновлен') || query.includes('объявлен')) {
      onOpenNews?.();
      return;
    }
    if (query.includes('событ') || query.includes('мероприят') || query.includes('афиш')) {
      onOpenEvents?.();
      return;
    }
    if (query.includes('акци') || query.includes('скид')) {
      onOpenOffers?.();
      return;
    }
    if (query.includes('партнер') || query.includes('партн') || query.includes('организац') || query.includes('бизнес')) {
      handleOpenPartners?.();
      return;
    }
    if (query.includes('эксперт') || query.includes('консультац')) {
      onOpenExperts?.();
      return;
    }
    if (query.includes('подар') || query.includes('приз') || query.includes('наград')) {
      onOpenRewards?.();
      return;
    }
    if (query.includes('рядом') || query.includes('карт')) {
      onOpenNearby?.();
      return;
    }
    onOpenLoki?.();
  }, [desktopSearchQuery, handleOpenPartners, onOpenEvents, onOpenExperts, onOpenLoki, onOpenNearby, onOpenNews, onOpenOffers, onOpenRewards]);

  const todayCards = [
    { title: 'Мероприятие дня', value: heroTitle, onClick: heroAction, icon: '🎉' },
    { title: 'Партнёр дня', value: heroPartner?.name || 'Выберите партнёра', onClick: heroPartner ? () => onOpenPartner?.(heroPartner) : undefined, icon: '🏢' },
    { title: 'Акция дня', value: offerPartner?.offer || 'Актуальные предложения', onClick: offerPartner ? () => onOpenPartner?.(offerPartner) : onOpenOffers, icon: '✦' },
    { title: 'Рядом', value: 'Найти место рядом', onClick: onOpenNearby, icon: '📍' },
  ];

  return (
    <section style={{ position: 'relative', minHeight: 'auto', boxSizing: 'border-box', padding: `${DESKTOP_LAYOUT.topPad} ${desktopLayout.pagePaddingX} 18px`, overflow: 'hidden', background: V2.pageBg }}>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: desktopLayout.containerMax, margin: '0 auto' }}>
        <DesktopTopOverview
          activeSection="home"
          navItems={navItems.map(item => ({ ...item, id: item.label === 'Главная' ? 'home' : item.label.toLowerCase() }))}
          searchValue={desktopSearchQuery}
          onSearchChange={setDesktopSearchQuery}
          onSearchSubmit={runDesktopSearch}
          onSearchClear={() => setDesktopSearchQuery('')}
          unreadCount={unreadCount}
          onOpenNotifications={onOpenNotifications}
          onOpenLoki={onOpenLoki}
          onOpenProfile={onOpenProfile}
          workspaceAction={desktopWorkspaceAvailable && typeof onSwitchAppMode === 'function' ? (
            <button
              type="button"
              onClick={() => onSwitchAppMode(desktopWorkspaceMode === 'workspace' ? 'user' : 'workspace')}
              style={{ ...GlassBadge, borderRadius: 999, background: 'linear-gradient(145deg, rgba(201,168,76,0.18), rgba(255,255,255,0.08))', borderColor: 'rgba(201,168,76,0.42)', color: V2.text, cursor: 'pointer', minHeight: 30, padding: '0 10px', fontWeight: 760, fontSize: 10.8 }}
            >
              {desktopWorkspaceMode === 'workspace' ? '📱 Пользовательский' : '💼 Workspace'}
            </button>
          ) : null}
          userName={fullName}
          userSubtitle="Мой профиль"
          avatarUrl={avatarUrl}
          initials={initials}
          profileBadge={level.label}
          profileRole="Личный городской кабинет"
          profileToday={todayForYou}
          profileLatestActivity={latestActivity}
          profileProgressColor={level.color}
          heroTitle={heroTitle}
          heroSubtitle={heroMeta}
          heroKicker={`${greeting} · Сегодня в АПГ`}
          heroImage={heroImage}
          heroActions={[
            { id: 'events', label: 'Все мероприятия', onClick: () => onOpenEvents?.() },
            { id: 'partner', label: 'Найти партнёра', tone: 'gold', onClick: heroPartner ? () => onOpenPartner?.(heroPartner) : handleOpenPartners },
          ]}
          stats={profileStats}
          progressTitle={nextAchievement?.title || (nextLevel ? `До уровня ${nextLevel.label}` : 'Максимальный уровень')}
          progressSubtitle={nextAchievement ? 'Следующее достижение' : keysToNext > 0 ? `Осталось ${keysToNext} ключей` : 'Новый уровень открыт'}
          progressValue={nextAchievementProgress}
          quickActions={[
            { id: 'profile', label: 'Профиль', tone: 'gold', onClick: onOpenProfile },
            { id: 'tasks', label: 'Достижения', onClick: onOpenTasks },
            { id: 'rewards', label: 'Награды', onClick: onOpenRewards },
          ]}
          isOffline={isOffline}
        />
      </div>
    </section>
  );

  return (
    <section style={{
      position: 'relative',
      minHeight: 'auto',
      boxSizing: 'border-box',
      padding: `${DESKTOP_LAYOUT.topPad} ${desktopLayout.pagePaddingX} 18px`,
      overflow: 'hidden',
      background: V2.pageBg,
    }}>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: desktopLayout.containerMax, margin: '0 auto' }}>
        {isOffline ? (
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 16,
            color: V2.text,
            background: 'linear-gradient(145deg, rgba(230,70,70,0.18), rgba(255,255,255,0.06))',
            border: '1px solid rgba(230,70,70,0.34)',
            fontSize: 13,
            fontWeight: 720,
            letterSpacing: 0.2,
          }}>
            Работа в офлайн-режиме: новые действия недоступны до восстановления сети.
          </div>
        ) : null}
        <header style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 11,
          alignItems: 'center',
          marginBottom: desktopLayout.headerRowGap,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="АПГ" style={{ width: 40, height: 40, borderRadius: 16, objectFit: 'cover', boxShadow: '0 12px 30px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.18)' }} />
            </picture>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: V2.text, fontSize: 16, lineHeight: '19px', fontWeight: 880 }}>АПГ: ЗЕЛЕНОГРАД</div>
              <div style={{ color: V2.textMuted, fontSize: 10.5, lineHeight: '13px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Альянс партнёров города</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {navItems.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => item.onClick?.()}
                style={{
                  ...GlassBadge,
                  borderRadius: 999,
                  borderColor: item.isActive ? 'rgba(201,168,76,0.70)' : 'rgba(255,255,255,0.33)',
                  background: item.isActive
                    ? 'linear-gradient(145deg, rgba(201,168,76,0.26), rgba(201,168,76,0.08))'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))',
                  color: item.isActive ? V2.gold : V2.textSoft,
                  cursor: 'pointer',
                  minHeight: 32,
                  fontWeight: 780,
                  padding: '0 12px',
                  fontSize: 11.7,
                  boxShadow: item.isActive ? '0 0 0 1px rgba(201,168,76,0.32)' : undefined,
                  transition: motionTransition(['background', 'transform', 'border-color'], 'base'),
                  ...pressMotion,
                }}
                aria-current={item.isActive ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              ...V2.glass,
              width: 'clamp(178px, 14.2vw, 246px)',
              height: 38,
              borderRadius: 999,
              display: 'grid',
              gridTemplateColumns: '18px 1fr auto',
              alignItems: 'center',
              gap: 7,
              padding: '0 10px 0 12px',
              boxSizing: 'border-box',
              color: V2.textMuted,
              background: 'linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))',
              border: '1px solid rgba(255,255,255,0.30)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 30px rgba(0,0,0,0.10)',
            }}>
              <span aria-hidden="true" style={{ fontSize: 13, lineHeight: '18px', opacity: 0.82 }}>⌕</span>
              <input
                type="search"
                value={desktopSearchQuery}
                onChange={(event) => setDesktopSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runDesktopSearch();
                  }
                }}
                placeholder="Поиск по АПГ..."
                aria-label="Поиск по АПГ"
                style={{
                  minWidth: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                  outline: 0,
                  background: 'transparent',
                  color: V2.text,
                  fontSize: 12,
                  lineHeight: '16px',
                  fontWeight: 720,
                }}
              />
              {desktopSearchQuery.trim() ? (
                <button
                  type="button"
                  aria-label="Очистить поиск"
                  onClick={() => setDesktopSearchQuery('')}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.20)',
                    background: 'rgba(255,255,255,0.10)',
                    color: V2.textMuted,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    lineHeight: '18px',
                    padding: 0,
                  }}
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Запустить поиск"
                  onClick={runDesktopSearch}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    border: '1px solid rgba(201,168,76,0.22)',
                    background: 'rgba(201,168,76,0.10)',
                    color: V2.gold,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    lineHeight: '18px',
                    padding: 0,
                  }}
                >
                  ↵
                </button>
              )}
            </div>
            <button
              onClick={onOpenNotifications}
              aria-label="Уведомления"
              style={{
                width: 38, height: 38, flexShrink: 0, borderRadius: 16, cursor: 'pointer',
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
            {desktopWorkspaceAvailable && typeof onSwitchAppMode === 'function' && (
              <button
                onClick={() => {
                  onSwitchAppMode(desktopWorkspaceMode === 'workspace' ? 'user' : 'workspace');
                }}
                style={{
                  ...GlassBadge,
                  borderRadius: 999,
                  background: 'linear-gradient(145deg, rgba(201,168,76,0.18), rgba(255,255,255,0.08))',
                  borderColor: 'rgba(201,168,76,0.42)',
                  color: V2.text,
                  cursor: 'pointer',
                  minHeight: 30,
                  padding: '0 10px',
                  fontWeight: 760,
                  fontSize: 10.8,
                  marginTop: 2,
                }}
              >
                {desktopWorkspaceMode === 'workspace' ? '📱 Пользовательский' : '💼 Workspace'}
              </button>
            )}
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: desktopLayout.firstHeroColumns, gap: desktopLayout.sectionGap, alignItems: 'start' }}>
          <div>
            <div
              onClick={heroAction}
              {...pressMotion}
              style={{
                width: '100%',
                minHeight: desktopLayout.heroHeight,
                height: desktopLayout.heroHeight,
                border: 'none',
                borderRadius: 36,
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                overflow: 'hidden',
                position: 'relative',
                ...GlassHero,
                animation: 'fadeInUp 0.5s ease both',
              }}
            >
              <div style={{ position: 'absolute', inset: -28, pointerEvents: 'none' }}>
                {heroImage ? (
                  <img src={heroImage} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.48, filter: 'saturate(1.12) contrast(1.04)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at 28% 18%, rgba(244,217,140,0.28), transparent 42%), linear-gradient(135deg, rgba(24,29,48,0.70), rgba(255,255,255,0.08) 46%, rgba(14,12,18,0.32))' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'var(--apg2-hero-overlay, radial-gradient(circle at 18% 12%, rgba(255,240,184,0.20), transparent 34%), linear-gradient(180deg, rgba(14,15,18,0.03), rgba(14,15,18,0.24) 42%, rgba(12,12,14,0.74)))' }} />
              </div>

              <div style={{ position: 'relative', zIndex: 1, minHeight: desktopLayout.heroHeight, padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                <div>
                  <div style={{ color: V2.gold, fontWeight: 800, fontSize: 10, letterSpacing: 0.8, marginBottom: 5 }}>{greeting.toUpperCase()} · СЕГОДНЯ В АПГ</div>
                  <div style={{ color: 'var(--apg2-hero-text, var(--apg2-text, #F7F1E6))', fontSize: `${desktopLayout.heroText}px`, lineHeight: 1.02, fontWeight: 800, letterSpacing: 0, marginBottom: 6 }}>{heroTitle}</div>
                  <div style={{ color: 'var(--apg2-hero-muted, rgba(247,244,234,0.8))', fontSize: desktopLayout.heroTagline, lineHeight: '15px', marginBottom: 8 }}>{heroMeta}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    role="button"
                    onClick={(event) => { event.stopPropagation(); onOpenEvents?.(); }}
                    style={{ ...GlassButton, minHeight: 28, padding: '0 12px', fontSize: 12.2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                  >
                    Все мероприятия
                  </span>
                  <span
                    role="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (heroPartner) {
                        onOpenPartner?.(heroPartner);
                      } else {
                        onOpenOffers?.();
                      }
                    }}
                    style={{ ...GlassButton, minHeight: 28, padding: '0 12px', fontSize: 12.2, color: '#17120A', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                  >
                    Найти партнёра
                  </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6, alignSelf: 'center' }}>
                  <span style={{ ...GlassBadge, padding: '5px 9px', fontSize: 10 }}>Главный повод дня</span>
                  <span style={{ ...GlassBadge, padding: '5px 9px', fontSize: 10 }}>Откройте подробности</span>
                </div>
              </div>
            </div>
          </div>

        <div style={{ display: 'grid', gap: 11, alignSelf: 'stretch' }}>
              <div style={{
                ...GlassPanel,
                borderRadius: 30,
                padding: 10,
                height: desktopLayout.heroHeight,
                boxSizing: 'border-box',
                display: 'grid',
                gridTemplateRows: '40px 36px minmax(0, 1fr) 25px',
                gap: 4,
                overflow: 'hidden',
                animation: 'fadeInUp 0.5s ease both',
              }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 8, alignItems: 'center', minHeight: 40 }}>
                <button
                  type="button"
                  aria-label="Открыть профиль"
                  onClick={onOpenProfile}
                  style={{ width: 40, height: 40, border: 'none', padding: 0, borderRadius: 16, overflow: 'hidden', ...V2.goldGlass, color: '#17120A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 900, cursor: 'pointer', boxShadow: '0 12px 28px rgba(201,168,76,0.20), inset 0 1px 0 rgba(255,255,255,0.42)' }}
                >
                  {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} /> : initials}
                </button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: V2.text, fontWeight: 880, fontSize: 14.2, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Мой профиль</div>
                  <div style={{ color: V2.textMuted, fontSize: 10.2, lineHeight: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
                </div>
                <div style={{ ...GlassBadge, padding: '5px 8px', fontSize: 9.6, color: level.color, borderColor: `${level.color}70`, background: `${level.color}1F`, maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{level.label}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4, alignItems: 'stretch', minHeight: 36 }}>
                {profileStats.map(stat => (
                  <div key={stat.label} style={{ ...GlassCard, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '4px 3px', minHeight: 34, display: 'grid', alignContent: 'center', textAlign: 'center', overflow: 'hidden' }}>
                    <div style={{ color: stat.accent || V2.text, fontSize: 12.2, lineHeight: '12px', fontWeight: 900 }}>{stat.value}</div>
                    <div style={{ color: V2.textMuted, fontSize: 7.1, lineHeight: '8px', fontWeight: 720, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gap: 3, alignSelf: 'stretch', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: V2.text, fontSize: 10.2, lineHeight: '11px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nextAchievement?.title || `До уровня ${nextLevel.label}`}
                    </div>
                    <div style={{ color: V2.textMuted, fontSize: 7.8, lineHeight: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nextAchievement ? 'Следующее достижение' : keysToNext > 0 ? `Осталось ${keysToNext} ключей` : 'Новый уровень открыт'}
                    </div>
                  </div>
                  <div style={{ color: V2.gold, fontSize: 10.2, lineHeight: '11px', fontWeight: 880 }}>{nextAchievementProgress}%</div>
                </div>
                <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ width: `${nextAchievementProgress}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${level.color}, #E8C97A)`, boxShadow: `0 0 16px ${level.color}80`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                <button type="button" onClick={onOpenProfile} style={{ ...GlassButton, minHeight: 25, padding: '0 7px', fontSize: 9.4, color: '#17120A' }}>Профиль</button>
                <button type="button" onClick={onOpenTasks} style={{ ...GlassButton, minHeight: 25, padding: '0 7px', fontSize: 9.4 }}>Достижения</button>
                <button type="button" onClick={onOpenRewards} style={{ ...GlassButton, minHeight: 25, padding: '0 7px', fontSize: 9.4 }}>Награды</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function V2SecondScreen({
  user,
  partners,
  favorites = [],
  experts = [],
  events,
  news,
  featuredPartner,
  partnerOfMonth,
  onOpenPartner,
  onOpenEvents,
  onOpenExperts,
  onOpenPartners,
  onOpenOffers,
  onOpenRewards,
  onOpenTasks,
  onOpenNews,
  onOpenNewsItem,
  onOpenLoki,
  onOpenNearby,
  loading = false,
  interestProfile,
  isOffline = false,
  desktopMode = false,
  homeExperience = null,
  continueExperience = null,
  recommendations = null,
}) {
  if (desktopMode) {
    return (
      <V2SecondScreenDesktop
        user={user}
        partners={partners}
        favorites={favorites}
        experts={experts}
        events={events}
        news={news}
        featuredPartner={featuredPartner}
        partnerOfMonth={partnerOfMonth}
        onOpenPartner={onOpenPartner}
        onOpenEvents={onOpenEvents}
        onOpenExperts={onOpenExperts}
        onOpenPartners={onOpenPartners}
        onOpenOffers={onOpenOffers}
        onOpenRewards={onOpenRewards}
        onOpenTasks={onOpenTasks}
        onOpenNews={onOpenNews}
        onOpenNewsItem={onOpenNewsItem}
        onOpenLoki={onOpenLoki}
        onOpenNearby={onOpenNearby}
        loading={loading}
        isOffline={isOffline}
        homeExperience={homeExperience}
        continueExperience={continueExperience}
        recommendations={recommendations}
      />
    );
  }
  return (
    <V2SecondScreenMobile
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
      onOpenNewsItem={onOpenNewsItem}
      onOpenLoki={onOpenLoki}
      isOffline={isOffline}
      interestProfile={interestProfile}
      desktopMode={desktopMode}
      homeExperience={homeExperience}
      continueExperience={continueExperience}
      recommendations={recommendations}
    />
  );
}

function V2SecondScreenMobile({
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
  onOpenTasks,
  onOpenNews,
  onOpenNewsItem,
  onOpenLoki,
  interestProfile,
  isOffline = false,
  desktopMode = false,
  homeExperience = null,
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
      padding: desktopMode ? '12px 26px calc(104px + env(safe-area-inset-bottom, 0px))' : '24px 0 calc(96px + env(safe-area-inset-bottom, 0px))',
      background: V2.pageBg,
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
      overflow: 'hidden',
    }}>
      <div style={{ maxWidth: desktopMode ? 1180 : 'none', margin: desktopMode ? '0 auto' : 0 }}>
      <div style={{ padding: desktopMode ? '0 0 18px' : '0 22px 18px' }}>
        <div style={{ color: V2.text, fontSize: 30, lineHeight: '35px', fontWeight: 780, letterSpacing: 0, marginBottom: 9 }}>
          Что интересного сегодня
        </div>
        <div style={{ color: V2.textMuted, fontSize: 14, lineHeight: '22px', fontWeight: 420 }}>
          Подборка поводов выйти в город и открыть новые места
        </div>
      </div>

      <div data-apg-horizontal-scroll={!desktopMode ? 'true' : undefined} onTouchStart={e => e.stopPropagation()}>
          <div style={desktopMode ? { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', alignItems: 'stretch', gap: 12, padding: '0 0 22px' } : { ...horizontalSnapTrack, alignItems: 'stretch', gap: 12, padding: '0 18px 26px', scrollPaddingLeft: 18 }}>
            {forYouCards.map((card, index) => (
              <button
                key={`${card.label}-${index}`}
                onClick={card.onClick}
                {...pressMotion}
                style={{
                  flex: desktopMode ? undefined : '0 0 min(74vw, 244px)',
                  height: desktopMode ? 246 : 286,
                  border: 'none', borderRadius: 32,
                  overflow: 'hidden', padding: 0, position: 'relative', textAlign: 'left', cursor: 'pointer',
                  ...horizontalSnapItem,
                  ...GlassCard,
                  background: fallbackCardBg,
                  boxShadow: '0 26px 68px var(--apg2-elev-shadow, rgba(0,0,0,0.30)), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -24px 48px rgba(255,255,255,0.035)',
                  animation: 'fadeInUp 0.54s ease both',
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                {renderImageLayer(card.image, index === 0 ? 0.6 : 0.52)}
                <div style={{ position: 'absolute', inset: 0, background: layerShade }} />
                <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: 18, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                  <span style={{ alignSelf: 'flex-start', ...GlassBadge, padding: '7px 11px', minHeight: 30, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}>
                    {card.label}
                  </span>
                  <span style={{ marginTop: 'auto', alignSelf: 'stretch', minHeight: 76, maxHeight: 76, padding: '13px 14px', borderRadius: 24, color: V2.text, fontSize: 17, lineHeight: '21px', fontWeight: 800, textShadow: '0 10px 28px rgba(0,0,0,0.18)', overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.24)', border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.15))', backdropFilter: 'blur(36px) saturate(1.55)', WebkitBackdropFilter: 'blur(36px) saturate(1.55)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
      </div>

      <div style={{ padding: '0 0 0', display: desktopMode ? 'grid' : 'block', gridTemplateColumns: desktopMode ? 'minmax(0, 1fr) minmax(340px, 0.62fr)' : undefined, gap: desktopMode ? 18 : undefined, alignItems: 'start' }}>
        <div>
        <NewsFeed news={newsItems} onOpenNews={onOpenNews} onOpenNewsItem={onOpenNewsItem} />
        </div>

        <div>
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
      </div>
      </div>
    </section>
  );
}

function V2SecondScreenDesktop({
  user,
  partners = [],
  favorites = [],
  experts = [],
  events = [],
  news = [],
  featuredPartner,
  onOpenPartner,
  onOpenEvents,
  onOpenExperts,
  onOpenPartners,
  onOpenOffers,
  onOpenRewards,
  onOpenTasks,
  onOpenNews,
  onOpenNewsItem,
  onOpenNearby,
  onOpenLoki,
  loading = false,
  isOffline = false,
  homeExperience = null,
  continueExperience = null,
  recommendations = null,
}) {
  const desktopWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const titleOf = (item, fallback) => String(item?.title || item?.name || item?.offer || item?.specialization || fallback).trim();
  const eventDayParts = (event) => {
    const parts = String(event?.date || 'Скоро').split(/[,\s]+/).filter(Boolean);
    return {
      day: parts[0] || 'Скоро',
      month: parts.slice(1, 2).join(' ') || '',
      time: String(event?.time || 'Время уточняется'),
      place: event?.address || event?.partner || 'Зеленоград',
      status: event?.status || (event?.isCompleted ? 'Завершено' : 'Ожидает'),
      participants: Number.isFinite(Number(event?.participants)) ? Number(event?.participants) : 0,
    };
  };
  const newsForYou = useMemo(() => {
    const prepared = (Array.isArray(news) ? news : [])
      .filter(Boolean)
      .slice()
      .sort((a, b) => {
        const ta = new Date(a?.publishedAt || a?.createdAt || 0).getTime();
        const tb = new Date(b?.publishedAt || b?.createdAt || 0).getTime();
        return tb - ta;
      });
    return prepared.slice(0, 4);
  }, [news]);

  const nearbyPartners = useMemo(() => {
    return partners.slice(0, 6);
  }, [partners]);

  const topExperts = useMemo(() => experts.slice(0, 5), [experts]);
  const offers = useMemo(() => partners.filter(p => p.offer).slice(0, 8), [partners]);
  const topEvents = useMemo(() => events.slice(0, 5), [events]);
  const allEvents = useMemo(() => topEvents.filter(Boolean), [topEvents]);
  const heroEvent = pickPrimaryEvent(allEvents);
  const heroEventKey = heroEvent ? getEntityKey(heroEvent) : null;
  const eventsWithoutHero = useMemo(() => (
    heroEventKey ? allEvents.filter((event) => getEntityKey(event) !== heroEventKey) : allEvents
  ), [allEvents, heroEventKey]);
  const primaryEvent = eventsWithoutHero[0] || allEvents[0] || null;
  const afishaEvents = useMemo(() => eventsWithoutHero.slice(0, 4), [eventsWithoutHero]);
  const afishaMaxColumns = desktopWidth >= 1500 ? 4 : 3;
  const afishaColumns = Math.min(afishaMaxColumns, Math.max(1, afishaEvents.length || 1));
  const afishaTileHeight = afishaColumns === 1 ? 172 : afishaColumns === 2 ? 154 : 136;
  const compactPartnerColumns = desktopWidth >= 1728 ? 4 : desktopWidth >= 1280 ? 3 : 2;
  const compactExpertsColumns = compactPartnerColumns;
  const mainNews = newsForYou[0] || null;
  const dayOffer = offers[0] || null;
  const partnerOfDay = featuredPartner || nearbyPartners[0] || null;
  const popularPartners = nearbyPartners
    .filter((partner) => partner?.id !== partnerOfDay?.id)
    .slice(0, 6);
  const todayExpert = topExperts[1] || null;
  const todayExpertKey = todayExpert ? getEntityKey(todayExpert) : null;
  const expertsPreview = useMemo(() => {
    if (!topExperts.length) return [];
    if (!todayExpertKey) {
      return topExperts.slice(0, 4);
    }
    return topExperts.filter((expert) => getEntityKey(expert) !== todayExpertKey).slice(0, 4);
  }, [todayExpertKey, topExperts]);
  const addRecentAction = useCallback((item, type) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('apg-home-recent-actions');
      const parsed = raw ? JSON.parse(raw) : [];
      const existing = Array.isArray(parsed) ? parsed : [];
      const next = [
        { id: item?.id || `${type}-${Date.now()}`, label: titleOf(item, type), type, timestamp: Date.now() },
        ...existing.filter((row) => row?.id !== item?.id),
      ].slice(0, 10);
      window.localStorage.setItem('apg-home-recent-actions', JSON.stringify(next));
    } catch {
      // no-op
    }
  }, [titleOf]);
  const sideNews = useMemo(() => {
    const list = [];

    const addNews = (article, index = 1) => {
      if (!article) return;
      list.push({
        kind: index === 1 ? 'Новость' : 'Лента',
        key: `news-${article.id || article.title || index}`,
        title: getNewsTitle(article),
        subtitle: getNewsCategoryLabel(article),
        extra: formatNewsDate(article),
        image: getNewsImage(article),
        onAction: () => {
          addRecentAction(article, 'news');
          onOpenNewsItem?.(article);
        },
      });
    };

    const addPartner = () => {
      const partner = nearbyPartners[1] || nearbyPartners[0] || null;
      if (!partner) return;
      list.push({
        kind: partner.offer ? 'Партнёр' : 'Город',
        key: `partner-${partner?.id || partner?.name || 0}`,
        title: partner.name || 'Партнёр',
        subtitle: partner.categoryLabel || (CATEGORIES.find(c => c.id === partner?.category)?.label) || 'Место рядом',
        extra: partner.offer || 'Подробнее',
        image: profileImageOf(partner),
        onAction: () => {
          addRecentAction(partner, 'partner');
          onOpenPartner?.(partner);
        },
      });
    };

    const addOffer = () => {
      const offerPartner = dayOffer || offers[0] || nearbyPartners[1] || null;
      if (!offerPartner) return;
      list.push({
        kind: offerPartner.offer ? 'Акция' : 'Партнёр',
        key: `offer-${offerPartner?.id || offerPartner?.name || 0}`,
        title: offerPartner.offer || offerPartner.name || 'Актуальная акция',
        subtitle: offerPartner.name || 'Выберите предложение',
        extra: offerPartner.offer || 'Посмотреть партнёра',
        image: profileImageOf(offerPartner),
        onAction: () => {
          if (offerPartner?.id && offerPartner?.offer) {
            addRecentAction(offerPartner, 'offer');
            onOpenPartner?.(offerPartner);
            return;
          }
          onOpenOffers?.();
        },
      });
    };
    const addExpert = () => {
      const expert = topExperts[0] || null;
      if (!expert) return;
      list.push({
        kind: 'Эксперт',
        key: `expert-news-${expert?.id || expert?.name || 0}`,
        title: expert.name || expert.specialization || 'Эксперт АПГ',
        subtitle: expert.specialization || expert.category || 'Практическая помощь',
        extra: expert.rating ? `${Number(expert.rating).toFixed(1)} ★` : 'Открыть раздел',
        image: profileImageOf(expert),
        onAction: () => {
          addRecentAction(expert, 'expert');
          onOpenExperts?.();
        },
      });
    };

    addNews(newsForYou[1], 1);
    addNews(newsForYou[2], 2);
    if (list.length < 4) addPartner();
    if (list.length < 4) addExpert();
    if (list.length < 4) addOffer();

    while (list.length < 4) {
      list.push({
        kind: list.length === 0 ? 'Новость' : list.length === 1 ? 'Партнёр' : list.length === 2 ? 'Эксперт' : 'Обновление',
        key: `side-empty-${list.length}`,
        title: 'Загрузка данных',
        subtitle: 'Скоро появится',
        extra: 'Обновите ленту',
        onAction: onOpenNews,
      });
    }

    return list.slice(0, 4);
  }, [addRecentAction, dayOffer, newsForYou, onOpenExperts, onOpenNews, onOpenNewsItem, onOpenOffers, onOpenPartner, offers, nearbyPartners, topExperts]);
  const todayInApg = useMemo(() => {
    const expertForToday = todayExpert || (topExperts[0] ? { name: 'Профессиональные консультации', specialization: 'Эксперт АПГ', rating: 0, id: 'expert-today-fallback' } : null);
    const cards = [
      {
        label: 'Главное событие',
        title: primaryEvent?.title || 'Афиша обновляется',
        subtitle: primaryEvent ? `${eventDayParts(primaryEvent).day} ${eventDayParts(primaryEvent).month}` : 'Скоро появятся события',
        detail: primaryEvent ? `${eventDayParts(primaryEvent).place} · ${eventDayParts(primaryEvent).time}` : 'Новые события позже',
        image: contentImageOf(primaryEvent || {}),
        variant: 'lead',
        onClick: onOpenEvents,
      },
    ];
    const fallbackNews = sideNews[0]?.title || mainNews?.title || 'Новости обновляются';
      cards.push({
      label: 'Главная новость',
      title: fallbackNews,
      subtitle: sideNews[0]?.subtitle || getNewsCategoryLabel(mainNews || {}),
      detail: sideNews[0]?.extra || formatNewsDate(mainNews) || 'Скоро обновится',
      image: getNewsImage(mainNews || {}),
      onClick: sideNews[0]?.onAction || onOpenNews,
    });
    cards.push({
      label: expertForToday?.name ? 'Эксперт дня' : 'Рекомендуемый эксперт',
      title: expertForToday?.name || 'Рекомендуемый эксперт',
      subtitle: expertForToday?.specialization || expertForToday?.category || 'Получите практическую помощь',
      detail: expertForToday?.rating ? `Рейтинг ${expertForToday.rating.toFixed(1)} ★` : 'Работает с локальными задачами',
      image: profileImageOf(expertForToday),
      onClick: topExperts.length ? () => onOpenExperts?.() : undefined,
    });
      cards.push({
      label: 'Акция дня',
      title: dayOffer?.offer || dayOffer?.name || 'Акции и бонусы',
      subtitle: dayOffer?.name || 'Откройте раздел акций',
      detail: formatEventPrice(dayOffer) || 'Актуальное предложение',
      image: profileImageOf(dayOffer),
      onClick: dayOffer ? () => onOpenPartner?.(dayOffer) : onOpenOffers,
    });
    return cards;
  }, [dayOffer, getNewsCategoryLabel, getNewsImage, mainNews, onOpenEvents, onOpenExperts, onOpenOffers, onOpenPartner, primaryEvent, sideNews, topExperts]);
  const userCoords = useMemo(() => getUserCoords(user), [user]);
  const nearbyObjects = useMemo(() => {
    const favoriteIds = new Set((Array.isArray(favorites) ? favorites : []).map(String));
    const recommendationIds = new Set([
      ...(recommendations?.partners || []),
      ...(recommendations?.events || []),
      ...(recommendations?.experts || []),
      ...(homeExperience?.recommendations?.partners || []),
      ...(homeExperience?.recommendations?.events || []),
      ...(homeExperience?.recommendations?.experts || []),
    ].map(row => String(row?.id || row?.item?.id || '')).filter(Boolean));

    const enrich = (item, type, index) => {
      const id = String(item?.id || getEntityKey(item) || `${type}-${index}`);
      const distanceKm = getEntityDistanceKm(item, userCoords);
      const hasCoords = Boolean(getEntityCoords(item));
      const isFavorite = favoriteIds.has(id);
      const hasOffer = Boolean(item?.offer || item?.discount || item?.promo);
      const today = type === 'event' && isTodayEntity(item);
      const openNow = isEntityOpenNow(item);
      const recommendationBoost = recommendationIds.has(id) ? 0.2 : 0;
      const popularity = getPopularityScore(item);
      const score = (Number.isFinite(distanceKm) ? distanceKm : 999)
        - (openNow ? 0.28 : 0)
        - (today ? 0.24 : 0)
        - (isFavorite ? 0.18 : 0)
        - (hasOffer ? 0.12 : 0)
        - recommendationBoost
        - Math.min(popularity / 10000, 0.08);
      return {
        item,
        type,
        id,
        key: `nearby-${type}-${id}`,
        title: titleOf(item, type === 'event' ? 'Мероприятие' : type === 'expert' ? 'Эксперт' : 'Партнёр'),
        subtitle: type === 'event'
          ? `${eventDayParts(item).time} · ${eventDayParts(item).place}`
          : type === 'expert'
            ? (item.specialization || item.category || 'Эксперт поблизости')
            : (item.categoryLabel || (CATEGORIES.find(c => c.id === item?.category)?.label) || 'Партнёр поблизости'),
        meta: Number.isFinite(distanceKm) ? formatNearbyDistance(distanceKm) : (item.address || item.offer || 'город'),
        badge: type === 'event' ? (today ? 'Сегодня' : 'Событие') : type === 'expert' ? 'Эксперт' : hasOffer ? 'Акция' : 'Место',
        distanceKm,
        hasCoords,
        hasOffer,
        today,
        openNow,
        isFavorite,
        score,
        popularity,
      };
    };

    return [
      ...(Array.isArray(partners) ? partners : []).filter(Boolean).map((item, index) => enrich(item, 'partner', index)),
      ...(Array.isArray(allEvents) ? allEvents : []).filter(Boolean).map((item, index) => enrich(item, 'event', index)),
      ...(Array.isArray(experts) ? experts : []).filter(Boolean).map((item, index) => enrich(item, 'expert', index)),
    ]
      .sort((a, b) => a.score - b.score || Number(b.openNow) - Number(a.openNow) || Number(b.today) - Number(a.today) || Number(b.isFavorite) - Number(a.isFavorite) || Number(b.hasOffer) - Number(a.hasOffer) || b.popularity - a.popularity)
      .slice(0, 4);
  }, [allEvents, eventDayParts, experts, favorites, homeExperience, partners, recommendations, titleOf, userCoords]);
  const nearbySummary = useMemo(() => ({
    partners: nearbyObjects.filter(item => item.type === 'partner').length || (Array.isArray(partners) ? partners.length : 0),
    eventsToday: (Array.isArray(allEvents) ? allEvents : []).filter(isTodayEntity).length,
    experts: nearbyObjects.filter(item => item.type === 'expert').length || (Array.isArray(experts) ? experts.length : 0),
    offers: (Array.isArray(partners) ? partners : []).filter(partner => partner?.offer || partner?.discount || partner?.promo).length,
    hasCoords: nearbyObjects.some(item => item.hasCoords),
  }), [allEvents, experts, nearbyObjects, partners]);
  const handleNearbyPrimaryAction = useCallback((entry) => {
    if (!entry) return;
    addRecentAction(entry.item, entry.type);
    if (entry.type === 'partner') onOpenPartner?.(entry.item);
    else if (entry.type === 'event') onOpenEvents?.(entry.item);
    else onOpenExperts?.();
  }, [addRecentAction, onOpenEvents, onOpenExperts, onOpenPartner]);
  const handleNearbyRoute = useCallback((entry) => {
    if (!entry) return;
    openRouteForEntity(entry.item);
  }, []);
  const recentActions = useMemo(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('apg-home-recent-actions');
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 5);
    } catch {
      return [];
    }
  }, []);
  const intelligenceContinueItems = Array.isArray(continueExperience?.items) ? continueExperience.items : [];
  const hasContinueSection = intelligenceContinueItems.length > 0 || recentActions.length > 0;

  const getRecentActionAction = (row) => {
    if (!row?.type) return undefined;
    if (row.type === 'news') {
      return () => {
        if (row.item) {
          onOpenNewsItem?.(row.item);
          return;
        }
        if (newsForYou?.[0] && row.id === newsForYou[0].id) {
          onOpenNewsItem?.(newsForYou[0]);
          return;
        }
        const fromStorage = recentActions.find((entry) => entry.id === row.id);
        if (fromStorage?.label) {
          const target = (Array.isArray(news) ? news : []).find((item) => item?.id === row.id);
          if (target) {
            onOpenNewsItem?.(target);
          }
        }
      };
    }
    if (row.type === 'event') return () => onOpenEvents?.(row.item || undefined);
    if (row.type === 'expert') return () => onOpenExperts?.();
    if (row.type === 'partner') return row.item ? () => onOpenPartner?.(row.item) : () => onOpenPartners?.();
    if (row.type === 'offer') return row.item ? () => onOpenPartner?.(row.item) : () => onOpenOffers?.();
    return undefined;
  };
  const desktopLayout = getDesktopLayout(typeof window === 'undefined' ? 1280 : window.innerWidth);
  const desktopSectionShell = {
    ...GlassPanel,
    borderRadius: 28,
    padding: 10,
    boxSizing: 'border-box',
    overflow: 'hidden',
  };
  const desktopRowGap = Math.max(6, desktopLayout.compactGap - 4);
  const desktopSecondRowGap = Math.max(7, desktopLayout.compactGap - 3);
  const desktopContentGrid = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) minmax(0, 1fr) ${desktopLayout.supportColumn || 'minmax(326px, 382px)'}`,
    gap: desktopLayout.sectionGap,
    alignItems: 'start',
    alignContent: 'start',
  };
  const desktopFirstRowStyle = {
    ...desktopSectionShell,
    height: desktopLayout.topContentRowHeight,
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    alignItems: 'stretch',
  };
  const desktopSecondRowStyle = {
    ...desktopSectionShell,
    height: desktopLayout.lowerContentRowHeight,
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    alignItems: 'stretch',
  };
  const desktopSideCardColumns = desktopWidth >= 1500
    ? 'minmax(0, 1.18fr) minmax(154px, 0.82fr)'
    : 'minmax(0, 1.14fr) minmax(138px, 0.78fr)';
  const desktopNewsCardColumns = desktopWidth >= 1500
    ? 'minmax(0, 1.52fr) minmax(176px, 0.86fr)'
    : 'minmax(0, 1.46fr) minmax(154px, 0.82fr)';
  const compactSectionTileHeight = 132;
  const compactSectionLeadImageHeight = 110;
  const compactNewsLeadImageHeight = 126;
  const compactSectionTileMetaGap = 4;

  return (
    <section style={{
      ...GlassPanel,
      padding: `4px ${desktopLayout.pagePaddingX} clamp(20px, 2.2vh, 32px)`,
      background: V2.pageBg,
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
      overflow: 'hidden',
    }}>
      <div style={{ maxWidth: desktopLayout.containerMax, margin: '0 auto' }}>
        {isOffline ? (
          <div style={{
            marginBottom: 12,
            borderRadius: 14,
            padding: '10px 12px',
            color: V2.text,
            background: 'linear-gradient(145deg, rgba(230,70,70,0.17), rgba(255,255,255,0.06))',
            border: '1px solid rgba(230,70,70,0.34)',
            fontSize: 13,
            fontWeight: 720,
            letterSpacing: 0.2,
          }}>
            Переход в офлайн-режим. Показываем закешированные данные.
          </div>
        ) : null}
          <div style={desktopContentGrid}>
            <section style={desktopFirstRowStyle}>
              <div style={{ marginBottom: 6 }}>
                <div style={{ ...DesktopSectionHeader, fontSize: 23 }}>Сегодня в АПГ</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: desktopSideCardColumns, gap: desktopRowGap, alignItems: 'stretch', minHeight: 0 }}>
                {todayInApg.map((card, index) => (
                  <button
                    key={`${card.label}-${index}`}
                    type="button"
                    onClick={card.onClick}
                    {...pressMotion}
                    style={{
                      ...DesktopTile,
                      border: 'none',
                      padding: 0,
                      overflow: 'hidden',
                      height: index === 0 ? '100%' : '100%',
                      textAlign: 'left',
                      cursor: card.onClick ? 'pointer' : 'default',
                      display: 'grid',
                      gridColumn: index === 0 ? '1 / 2' : '2 / 3',
                      gridRow: index === 0 ? '1 / span 3' : undefined,
                    gridTemplateRows: index === 0 ? '110px 1fr' : undefined,
                      gridTemplateColumns: index === 0 ? undefined : '34px 1fr',
                      alignItems: index === 0 ? undefined : 'stretch',
                    }}
                  >
                    <div style={{ position: 'relative', minHeight: index === 0 ? undefined : 62, background: 'radial-gradient(circle at 24% 16%, rgba(244,217,140,0.24), transparent 42%), rgba(255,255,255,0.06)' }}>
                      {card.image ? <img src={card.image} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,12,14,0.05), rgba(12,12,14,0.60))' }} />
                      {index === 0 ? <span style={{ position: 'absolute', left: 12, top: 12, ...GlassBadge, background: 'rgba(8,8,10,0.46)' }}>{card.label}</span> : null}
                    </div>
                    <div style={{ padding: index === 0 ? '11px' : '7px 8px', display: 'grid', alignContent: index === 0 ? 'start' : 'center', gap: index === 0 ? 5 : 3, minWidth: 0 }}>
                      {index > 0 ? <div style={{ color: V2.gold, fontSize: 9.8, lineHeight: '12px', fontWeight: 820, textTransform: 'uppercase', letterSpacing: 0.4 }}>{card.label}</div> : null}
                      <div style={{ color: V2.text, fontSize: index === 0 ? 16.1 : 12.6, lineHeight: index === 0 ? '19px' : '15px', fontWeight: 850, minHeight: index === 0 ? 34 : undefined, display: '-webkit-box', WebkitLineClamp: index === 0 ? 2 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.title}</div>
                      <div style={{ color: V2.textSoft, fontSize: index === 0 ? 11.4 : 10.2, lineHeight: index === 0 ? '14px' : '13px', display: '-webkit-box', WebkitLineClamp: index === 0 ? 2 : 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.subtitle}</div>
                      {index === 0 && card.detail ? <div style={{ color: V2.textMuted, fontSize: 10.2, lineHeight: '13px', fontWeight: 740 }}>{card.detail}</div> : null}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section style={desktopFirstRowStyle}>
              <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ ...DesktopSectionHeader, fontSize: 22 }}>Главная новость дня</div>
                </div>
                <button type="button" onClick={() => onOpenNews?.()} style={{ ...GlassButton, minHeight: 30, padding: '0 10px', fontSize: 10.8, flexShrink: 0 }}>Все новости</button>
              </div>
              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: desktopNewsCardColumns, gap: desktopRowGap, alignItems: 'stretch', minHeight: 0, alignContent: 'start', height: '100%' }}>
                  <div style={{ ...DesktopTile, border: 'none', padding: 0, height: '100%', overflow: 'hidden' }}>
                    <Skel h={compactSectionLeadImageHeight} w="100%" radius={0} />
                    <div style={{ padding: 10, display: 'grid', gap: 6 }}>
                      <Skel h={10} w={110} radius={5} />
                      <Skel h={30} w="94%" radius={9} />
                      <Skel h={16} w="82%" radius={8} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 6, gridTemplateRows: 'repeat(4, minmax(0, 1fr))', height: '100%' }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={`main-news-side-skel-${i}`} style={{ ...DesktopDenseTile, border: 'none', padding: '7px 8px', display: 'grid', gridTemplateColumns: '34px 1fr', gap: 7, alignItems: 'center', minHeight: 0, height: '100%' }}>
                        <Skel w={34} h={34} radius={10} />
                        <div style={{ display: 'grid', gap: 4 }}>
                          <Skel h={9.5} w={56} radius={4} />
                          <Skel h={14} w="98%" radius={5} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !mainNews ? (
                  <div style={{ ...EmptyDesktopCard, height: '100%', padding: 14, display: 'flex', alignItems: 'center' }}>Новости появятся после обновления редакции.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: desktopNewsCardColumns, gap: desktopRowGap, alignItems: 'stretch', minHeight: 0, alignContent: 'start', height: '100%' }}>
                    <button
                      type="button"
                      onClick={() => { addRecentAction(mainNews, 'news'); onOpenNewsItem?.(mainNews); }}
                      {...pressMotion}
                      style={{ ...DesktopTile, border: 'none', padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer', display: 'grid', gridTemplateRows: `${compactNewsLeadImageHeight}px 1fr`, height: '100%' }}
                    >
                    <div style={{ position: 'relative', background: 'radial-gradient(circle at 20% 16%, rgba(244,217,140,0.26), transparent 42%), rgba(255,255,255,0.06)' }}>
                      {getNewsImage(mainNews) ? <img src={getNewsImage(mainNews)} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(8,8,10,0.72))' }} />
                      <span style={{ position: 'absolute', left: 16, top: 16, ...GlassBadge, background: 'rgba(8,8,10,0.52)' }}>{getNewsCategoryLabel(mainNews)}</span>
                    </div>
                    <div style={{ padding: '12px 12px 11px', display: 'grid', alignContent: 'start', gap: compactSectionTileMetaGap }}>
                        <div style={{ color: V2.textMuted, fontSize: 10.8, lineHeight: '13px', marginBottom: 1 }}>{formatNewsDate(mainNews)}</div>
                        <div style={{ color: V2.text, fontSize: 17.1, lineHeight: '20px', fontWeight: 920, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsTitle(mainNews)}</div>
                        <div style={{ marginTop: 1, color: V2.textSoft, fontSize: 10.9, lineHeight: '13.5px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsText(mainNews)}</div>
                      </div>
                  </button>
                  <div style={{ display: 'grid', gap: 6, gridTemplateRows: 'repeat(4, minmax(0, 1fr))', height: '100%' }}>
                    {sideNews.slice(0, 4).map((sideItem, index) => (
                      <button
                        key={sideItem?.key || sideItem?.id || `${sideItem?.title}-${index}`}
                        type="button"
                        onClick={sideItem?.onAction}
                        style={{ ...DesktopDenseTile, border: 'none', height: '100%', padding: '7px 8px', textAlign: 'left', cursor: sideItem?.onAction ? 'pointer' : 'default', display: 'grid', gap: 7, gridTemplateColumns: sideItem.image ? '34px 1fr' : '1fr', alignItems: 'center', minHeight: 0 }}
                      >
                          <div style={{ minWidth: 0, gridColumn: sideItem.image ? '2 / 3' : '1 / -1', display: 'grid', gap: 2 }}>
                          <div style={{ color: V2.gold, fontSize: 8.8, lineHeight: '10px', fontWeight: 840, textTransform: 'uppercase', letterSpacing: 0.42 }}>{sideItem.kind}</div>
                          <div style={{ color: V2.text, fontSize: 11.9, lineHeight: '14px', fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sideItem.title}</div>
                          <div style={{ color: V2.textSoft, fontSize: 9.6, lineHeight: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[sideItem.subtitle, sideItem.extra].filter(Boolean).join(' · ') || 'Актуальная информация'}</div>
                        </div>
                        {sideItem.image ? (
                          <div style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.12)' }}>
                            <img src={sideItem.image} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section style={desktopFirstRowStyle}>
              <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ ...DesktopSectionHeader, fontSize: 23 }}>Афиша</div>
                </div>
                <button type="button" onClick={onOpenEvents} style={{ ...GlassButton, minHeight: 32, padding: '0 13px', fontSize: 11.5 }}>Все мероприятия</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${afishaColumns}, minmax(0, 1fr))`, gap: desktopLayout.compactGap, height: '100%', alignContent: 'start' }}>
                {loading ? [0, 1, 2, 3].map(i => <div key={`event-skel-${i}`} style={{ ...DesktopTile, minHeight: afishaTileHeight, height: afishaTileHeight }}><Skel h={18} w="60%" radius={7} /></div>) : afishaEvents.length === 0 ? (
                  <div style={{
                    ...EmptyDesktopCard,
                    gridColumn: '1 / -1',
                    minHeight: afishaTileHeight,
                    height: afishaTileHeight,
                    padding: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    width: '100%',
                  }}>
                    Сейчас нет запланированных мероприятий.
                  </div>
                ) : afishaEvents.map((event, index) => {
                  const parsed = eventDayParts(event);
                  return (
                    <button
                      key={event.id || `event-${index}`}
                      type="button"
                      onClick={() => { addRecentAction(event, 'event'); onOpenEvents?.(); }}
                      {...pressMotion}
                      style={{ ...DesktopTile, border: 'none', minHeight: afishaTileHeight, height: afishaTileHeight, textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                        <div style={{ borderRadius: 12, background: 'rgba(255,255,255,0.14)', padding: '7px 7px', minWidth: 56, textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 920, color: V2.gold, lineHeight: '19px' }}>{parsed.day}</div>
                          <div style={{ fontSize: 9.9, color: V2.textSoft, marginTop: 1 }}>{parsed.month}</div>
                        </div>
                        <span style={{ ...GlassBadge, fontSize: 9.8, padding: '5px 8px' }}>{parsed.status}</span>
                      </div>
                      <div>
                        <div style={{ color: V2.text, fontSize: 14.2, lineHeight: '17px', fontWeight: 860, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titleOf(event, 'Мероприятие АПГ')}</div>
                        <div style={{ color: V2.textMuted, fontSize: 10.4, lineHeight: '13px', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{parsed.time} · {parsed.place}</div>
                        <div style={{ marginTop: 5, color: V2.gold, fontSize: 10.2, fontWeight: 780, lineHeight: '13px' }}>{formatEventPrice(event) || 'Бесплатно'} · {parsed.participants ? `${parsed.participants} мест` : 'Открытая регистрация'}</div>
                        <div
                          onClick={() => { onOpenEvents?.(); }}
                          style={{ ...GlassButton, marginTop: 6, minHeight: 28, fontSize: 10.2, padding: '0 10px', width: 'fit-content', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                          Записаться
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={desktopSecondRowStyle}>
              <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ ...DesktopSectionHeader, fontSize: 23 }}>Популярные партнёры</div>
                </div>
                <button type="button" onClick={onOpenPartners} style={{ ...GlassButton, minHeight: 32, padding: '0 13px', fontSize: 11.5 }}>Все партнёры</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compactPartnerColumns}, minmax(0, 1fr))`, gap: desktopSecondRowGap, height: '100%', alignContent: 'start' }}>
                {loading ? [0, 1, 2].map(i => (
                  <div key={`partner-skel-${i}`} style={{ ...DesktopDenseTile, minHeight: compactSectionTileHeight, height: '100%', padding: 12, display: 'grid', gap: 7, gridTemplateColumns: '1fr', alignContent: 'start' }}>
                    <Skel h={44} w="100%" radius={11} />
                    <Skel h={13} w="84%" radius={6} />
                    <Skel h={10} w="68%" radius={4} />
                  </div>
                )) : (popularPartners.length ? popularPartners : nearbyPartners).slice(0, 4).map((partner) => (
                  <button
                    key={partner.id || partner.name}
                    onClick={() => { addRecentAction(partner, 'partner'); onOpenPartner?.(partner); }}
                    type="button"
                    style={{ ...DesktopDenseTile, border: 'none', minHeight: compactSectionTileHeight, height: '100%', padding: 12, textAlign: 'left', display: 'grid', gap: 8, alignItems: 'start', cursor: 'pointer', gridTemplateRows: 'auto 1fr', boxSizing: 'border-box' }}
                  >
                    <PartnerLogo partner={partner} size={44} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: V2.text, fontWeight: 850, fontSize: 13.3, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</div>
                      <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                        <span
                          style={{
                            ...getCategoryTone(partner.category),
                            borderRadius: 999,
                            padding: '2px 5px',
                            fontSize: 9.2,
                            fontWeight: 790,
                            display: 'inline-flex',
                            maxWidth: '68%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            border: `1px solid ${getCategoryTone(partner.category).border}`,
                          }}
                        >
                          {partner.categoryLabel || (CATEGORIES.find(c => c.id === partner.category)?.label) || 'Категория'}
                        </span>
                        {partner.offer ? <span style={{ color: V2.gold, fontSize: 9.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.offer}</span> : null}
                      </div>
                      <div style={{ marginTop: 2, color: V2.textSoft, fontSize: 10.1, lineHeight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.description || partner.specialization || 'Место для жителей города'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section style={desktopSecondRowStyle}>
              <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ ...DesktopSectionHeader, fontSize: 23 }}>Эксперты</div>
                </div>
                <button type="button" onClick={onOpenExperts} style={{ ...GlassButton, minHeight: 32, padding: '0 13px', fontSize: 11.5 }}>Все эксперты</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compactExpertsColumns}, minmax(0, 1fr))`, gap: desktopSecondRowGap, height: '100%', alignContent: 'start' }}>
                {loading ? [0, 1, 2].map(i => (
                  <div key={`expert-skel-${i}`} style={{ ...DesktopDenseTile, minHeight: compactSectionTileHeight, height: '100%', padding: 12, display: 'grid', gap: 7, alignItems: 'start', justifyItems: 'start', gridTemplateRows: 'auto auto auto' }}>
                    <Skel h={52} w={52} radius={13} />
                    <Skel h={11} w="92%" radius={6} />
                    <Skel h={9} w="76%" radius={4} />
                  </div>
                )) : expertsPreview.length === 0 ? (
                  <div style={{ ...EmptyDesktopCard, gridColumn: '1 / -1' }}>Эксперты появятся после публикации профилей.</div>
                ) : expertsPreview.slice(0, 3).map((expert, index) => (
                  <button
                    key={expert.id || `${expert.name}-${index}`}
                    onClick={onOpenExperts}
                    type="button"
                    style={{ ...DesktopDenseTile, border: 'none', minHeight: compactSectionTileHeight, height: '100%', padding: 12, textAlign: 'left', display: 'grid', gap: 7, alignItems: 'start', cursor: 'pointer', gridTemplateRows: 'auto 1fr auto', justifyItems: 'start', boxSizing: 'border-box' }}
                  >
                    <img src={profileImageOf(expert)} alt={expert?.name || ''} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: 52, height: 52, borderRadius: 15, objectFit: 'cover', background: 'rgba(255,255,255,0.14)' }} />
                    <div style={{ minWidth: 0, width: '100%' }}>
                      <div style={{ color: V2.text, fontWeight: 850, fontSize: 13.3, lineHeight: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{expert.name || expert.specialization || 'Эксперт АПГ'}</div>
                      <div style={{ color: V2.textSoft, fontSize: 10.7, lineHeight: '13px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expert.specialization || expert.category || 'Консультации'}</div>
                      <div style={{ color: V2.textMuted, fontSize: 10.1, lineHeight: '12px', marginTop: 3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{expert.shortDescription || expert.bio || expert.about || 'Практическая помощь жителям города'}</div>
                    </div>
                    <div style={{ color: V2.gold, fontSize: 10.8, lineHeight: '13px', fontWeight: 820, justifySelf: 'end' }}>
                      {expert.rating ? `${Number(expert.rating).toFixed(1)} ★` : '→'}
                    </div>
                  </button>
                ))}
              </div>
            </section>

              <section style={{ ...desktopSecondRowStyle, display: 'grid', gridTemplateRows: hasContinueSection ? 'auto 1fr' : '1fr', gap: 10 }}>
                {hasContinueSection ? (
                  <div>
                    <div style={{ color: V2.text, fontWeight: 850, fontSize: 18, marginBottom: 8 }}>Продолжить</div>
                    <div style={{ display: 'grid', gap: 7 }}>
                    {(intelligenceContinueItems.length ? intelligenceContinueItems : recentActions).slice(0, 2).map((row) => (
                      <button key={`${row.type}-${row.id}`} type="button" onClick={getRecentActionAction(row)} style={{ ...DesktopDenseTile, border: '1px solid rgba(255,255,255,0.16)', padding: 10, color: V2.text, textAlign: 'left', width: '100%', cursor: getRecentActionAction(row) ? 'pointer' : 'default' }}>
                        <span style={{ color: V2.textMuted, fontSize: 11, textTransform: 'uppercase' }}>{row.type}</span>
                        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 830, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label || row.title || row.item?.title || row.item?.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ color: V2.text, fontWeight: 850, fontSize: 23 }}>Рядом</div>
                  <button type="button" onClick={onOpenNearby} style={{ ...GlassButton, minHeight: 32, padding: '0 12px', fontSize: 12 }}>Открыть карту</button>
                </div>
                <div style={{ ...DesktopDenseTile, padding: 10, display: 'grid', gap: 8 }}>
                  {nearbySummary.hasCoords ? (
                    <button
                      type="button"
                      onClick={onOpenNearby}
                      style={{
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 15,
                        minHeight: 32,
                        padding: '5px 8px',
                        background: 'radial-gradient(circle at 16% 50%, rgba(244,217,140,0.24), transparent 18%), linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        color: V2.text,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        {nearbyObjects.filter(item => item.hasCoords).slice(0, 4).map((item, index) => (
                          <span key={`${item.key}-dot`} style={{ width: 7 + index, height: 7 + index, borderRadius: 99, background: index === 0 ? V2.gold : 'rgba(255,255,255,0.48)', boxShadow: index === 0 ? '0 0 14px rgba(244,217,140,0.62)' : 'none' }} />
                        ))}
                        <span style={{ color: V2.textSoft, fontSize: 10.4, lineHeight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nearbyObjects[0]?.meta ? `Ближайшее: ${nearbyObjects[0].meta}` : 'Объекты на карте'}
                        </span>
                      </span>
                      <span style={{ color: V2.gold, fontSize: 10.5, fontWeight: 820 }}>Карта</span>
                    </button>
                  ) : null}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                    {[
                      ['📍', nearbySummary.partners, 'партнёров'],
                      ['🎉', nearbySummary.eventsToday, 'сегодня'],
                      ['👨‍💼', nearbySummary.experts, 'экспертов'],
                      ['🎁', nearbySummary.offers, 'акций'],
                    ].map(([icon, value, label]) => (
                      <div key={label} style={{ borderRadius: 12, padding: '6px 5px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)', minWidth: 0 }}>
                        <div style={{ color: V2.text, fontSize: 12, fontWeight: 860, lineHeight: '13px', whiteSpace: 'nowrap' }}>{icon} {value}</div>
                        <div style={{ color: V2.textMuted, fontSize: 8.8, lineHeight: '10px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {nearbyObjects.length === 0 ? (
                      <button type="button" onClick={onOpenNearby} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, background: 'rgba(255,255,255,0.07)', padding: 11, color: V2.text, textAlign: 'left', cursor: 'pointer' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 850, lineHeight: '16px' }}>Сегодня рядом новых событий нет.</div>
                        <div style={{ color: V2.textSoft, fontSize: 11, lineHeight: '14px', marginTop: 4 }}>Посмотрите популярные места в городе.</div>
                      </button>
                    ) : nearbyObjects.slice(0, nearbySummary.hasCoords ? 3 : 4).map((entry) => (
                    <div
                        key={entry.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleNearbyPrimaryAction(entry)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') handleNearbyPrimaryAction(entry);
                        }}
                        style={{
                          border: '1px solid rgba(255,255,255,0.11)',
                          background: 'rgba(255,255,255,0.07)',
                          borderRadius: 14,
                          color: V2.text,
                          minHeight: 42,
                          padding: '7px 8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 8,
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ minWidth: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 7, alignItems: 'center' }}>
                          <span style={{ width: 28, height: 28, borderRadius: 10, display: 'grid', placeItems: 'center', background: entry.type === 'event' ? 'rgba(244,217,140,0.16)' : entry.type === 'expert' ? 'rgba(101,163,255,0.16)' : 'rgba(106,224,174,0.13)', border: '1px solid rgba(255,255,255,0.13)', fontSize: 14 }}>
                            {entry.type === 'event' ? '🎉' : entry.type === 'expert' ? '👨‍💼' : '📍'}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                              <span style={{ color: V2.text, fontSize: 12.2, fontWeight: 850, lineHeight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</span>
                              <span style={{ color: entry.today || entry.hasOffer ? V2.gold : V2.textMuted, fontSize: 9.1, fontWeight: 820, whiteSpace: 'nowrap' }}>{entry.badge}</span>
                            </span>
                            <span style={{ display: 'block', color: V2.textSoft, fontSize: 9.8, lineHeight: '12px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.subtitle}</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'end', minWidth: 0 }}>
                          <span style={{ color: V2.gold, fontSize: 10.3, fontWeight: 850, whiteSpace: 'nowrap' }}>{entry.meta}</span>
                          {(entry.hasCoords || entry.item?.address || entry.item?.place) ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleNearbyRoute(entry);
                              }}
                              style={{ ...GlassButton, minHeight: 25, padding: '0 7px', fontSize: 9.5, borderRadius: 10 }}
                            >
                              Маршрут
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleNearbyPrimaryAction(entry);
                            }}
                            style={{ ...GlassButton, minHeight: 25, padding: '0 7px', fontSize: 9.5, borderRadius: 10, color: entry.type === 'event' ? '#17120a' : V2.text, background: entry.type === 'event' ? V2.goldMetal : GlassButton.background }}
                          >
                            {entry.type === 'event' ? 'Записаться' : 'Открыть'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

          </div>
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
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }} onClick={onClose}>
      <div style={{
        ...V2.glass,
        borderRadius: '34px 34px 0 0',
        width: '100%', padding: '24px 20px calc(48px + env(safe-area-inset-bottom, 0px))',
        maxHeight: '85vh', overflowY: 'auto',
        borderBottom: 'none',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.22)', borderRadius: 2, margin: '0 auto 20px' }} />

        {eventImage && (
          <div style={{ margin: '-24px -20px 20px', overflow: 'hidden', borderRadius: '0' }}>
            <img src={eventImage} alt="" loading="lazy" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display='none'} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 52 }}>{event.emoji ?? '🎉'}</div>
          <button onClick={onClose} style={{
            ...V2.glass, border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: V2.textSoft,
          }}>✕</button>
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: V2.text, marginBottom: 12, lineHeight: '26px' }}>
          {(event.priority ?? 0) >= 8 && <span style={{ fontSize: 10, fontWeight: 800, color: V2.gold, background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 5, padding: '2px 6px', marginRight: 7, verticalAlign: 'middle' }}>📌 Важно</span>}
          {event.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {event.date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(74,144,217,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
              <span style={{ color: V2.text, fontSize: 14 }}>{event.date}</span>
            </div>
          )}
          {event.partner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
              <span style={{ color: V2.text, fontSize: 14 }}>{event.partner}</span>
            </div>
          )}
          {event.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(75,179,75,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</div>
              <span style={{ color: V2.text, fontSize: 14 }}>{event.address}</span>
            </div>
          )}
        </div>

        {event.description && (
          <div style={{ ...V2.glass, borderRadius: 18, padding: 14, marginBottom: 20 }}>
            <RichText color={V2.textSoft} fontSize={14}>{event.description}</RichText>
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
              background: 'linear-gradient(135deg, #4A90D9, #2D6FBC)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              📲 Перейти к событию
            </button>
          )}
          {event.linkUrl && event.linkLabel && (
            <button onClick={() => openUrl(event.linkUrl)} style={{
              width: '100%', padding: '15px 0', borderRadius: 14,
              ...V2.glass, color: V2.text, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              {event.linkLabel} →
            </button>
          )}
          <button onClick={onClose} style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            ...V2.glass, color: V2.textSoft, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
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
        border: '1.5px solid rgba(255,255,255,0.12)',
      }}>
        {initial}
      </div>
    );
  }
  return (
    <img
      src={partner.logoUrl} alt={name} loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.12)', display: 'block', flexShrink: 0 }}
    />
  );
}

// ─── Карточка партнёра ────────────────────────────────────────────────────────

export function PartnerCard({ partner, isFavorite, onOpen, onToggleFavorite, index = 0 }) {
  const isNew = (() => {
    if (!partner.createdAt) return false;
    const ts = partner.createdAt.toDate ? partner.createdAt.toDate() : new Date(partner.createdAt);
    return Date.now() - ts.getTime() < 14 * 24 * 60 * 60 * 1000;
  })();

  return (
    <div style={{
      ...V2.glass,
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
          background: V2.gold, boxShadow: `0 0 6px ${V2.gold}`,
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
          background: 'rgba(75,179,75,0.13)', border: '1px solid rgba(75,179,75,0.33)',
          borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: '#4BB34B',
        }}>🎁 акция</div>
      )}

      <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }}>
        <PartnerLogo partner={partner} size={56} />
        <button onClick={() => onToggleFavorite(partner.id)} style={{
          position: 'absolute', top: -4, right: -4,
          background: isFavorite ? '#E64646' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${isFavorite ? '#E64646' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 10, padding: 0, color: isFavorite ? '#fff' : V2.text,
        }}>
          {isFavorite ? '♥' : '♡'}
        </button>
        {partner.visitCount > 0 && (
          <div style={{
            position: 'absolute', bottom: -4, left: -4,
            ...V2.glass, borderRadius: 8, padding: '1px 5px',
            fontSize: 9, fontWeight: 700, color: V2.textSoft, lineHeight: '14px',
          }}>×{partner.visitCount}</div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: V2.text, lineHeight: '16px', marginBottom: 3 }}>
          {partner.name ?? 'Партнёр'}
        </div>
        {partner.avgRating > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#FFD700', letterSpacing: 0.5 }}>
              {'★'.repeat(Math.round(partner.avgRating))}{'☆'.repeat(5 - Math.round(partner.avgRating))}
            </span>
            <span style={{ fontSize: 10, color: V2.textSoft }}>{partner.avgRating.toFixed(1)}</span>
          </div>
        ) : partner.categoryLabel ? (
          <div style={{ fontSize: 10, color: V2.gold }}>
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
              <span style={{ fontSize: 9, color: done ? V2.gold : V2.textSoft, fontWeight: 700 }}>🎟️ Штамп</span>
              <span style={{ fontSize: 9, color: done ? V2.gold : V2.textSoft, fontWeight: 700 }}>{filled}/{partner.stampTarget}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: done ? V2.gold : 'rgba(201,168,76,0.5)', transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })()}

      <button onClick={() => onOpen(partner)} style={{
        width: '100%', padding: '9px 0', borderRadius: 12, border: 'none',
        background: 'linear-gradient(135deg, #D6B766, #E8C97A)',
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
          ...V2.goldGlass,
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
            <div style={{ fontSize: 15, fontWeight: 800, color: V2.text, lineHeight: 1.2 }}>{partner.name}</div>
            {partner.offer && (
              <div style={{ fontSize: 12, color: V2.textSoft, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🎁 {partner.offer}
              </div>
            )}
          </div>

          <div style={{ fontSize: 18, color: V2.textSoft, flexShrink: 0 }}>›</div>
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
            <div style={{ fontSize: 9, fontWeight: 800, color: V2.gold, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>
              🏆 Партнёр месяца
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: V2.text, lineHeight: 1.2 }}>{partner.name}</div>
            {reason && (
              <div style={{ fontSize: 12, color: V2.textSoft, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {reason}
              </div>
            )}
          </div>
          <div style={{ fontSize: 18, color: V2.textSoft, flexShrink: 0 }}>›</div>
        </div>
      </button>
    </div>
  );
}

// ─── Новостной виджет ────────────────────────────────────────────────────────

function NewsWidget({ news = [], onOpenNews, onOpenNewsItem }) {
  const items = useMemo(() => (Array.isArray(news) ? news.filter(Boolean).slice(0, 8) : []), [news]);
  const freshCount = useMemo(() => items.filter(isFreshNews).length, [items]);

  if (!items.length) return null;

  return (
    <>
      <div style={{ margin: '0 0 28px', ...V2.glowGlass, borderRadius: 32, overflow: 'hidden', position: 'relative', ...revealMotion(0, 'panel') }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 16% 0%, rgba(244,217,140,0.13), transparent 34%)' }} />
        <div style={{ position: 'relative', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 880, color: V2.gold, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 6 }}>✦ Новости АПГ</div>
              <div style={{ color: V2.text, fontSize: 22, lineHeight: '27px', fontWeight: 900 }}>Что нового в городе</div>
              {freshCount > 0 && <div style={{ color: V2.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 5 }}>{freshCount} новых материалов</div>}
            </div>
              <button
                type="button"
                onClick={() => onOpenNews?.()}
                style={{ border: '1px solid rgba(201,168,76,0.28)', background: 'rgba(201,168,76,0.12)', color: V2.gold, borderRadius: 999, minHeight: 36, padding: '0 13px', fontSize: 12, fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Все новости →
            </button>
          </div>

          <div data-apg-horizontal-scroll="true" style={{ ...horizontalSnapTrack, gap: 12, paddingBottom: 2, margin: '0 -16px', paddingLeft: 16, paddingRight: 16, scrollPaddingLeft: 16 }}>
            {items.map((item, index) => {
              const image = getNewsImage(item);
              const photo = getNewsPhotoItems(item)[0];
              const ratio = photo?.width && photo?.height ? photo.width / photo.height : null;
              const objectFit = item?.source === 'vk' || (ratio && ratio < 0.82) ? 'contain' : 'cover';
              const stats = getNewsStats(item);
              const reactions = getNewsReactionsTotal(item) || stats.likes;
              return (
                <button
                  key={item.id || `${getNewsTitle(item)}-${index}`}
                  type="button"
                  onClick={() => {
                    if (typeof onOpenNewsItem === 'function') {
                      onOpenNewsItem(item);
                    } else {
                      onOpenNews?.();
                    }
                  }}
                  {...pressMotion}
                  aria-label={`Открыть новость: ${getNewsTitle(item)}`}
                  style={{ flex: '0 0 260px', minHeight: 304, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', borderRadius: 28, padding: 0, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: V2.text, textAlign: 'left', overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', ...horizontalSnapItem }}
                >
                  <span style={{ display: 'block', position: 'relative', height: 136, background: 'radial-gradient(circle at 20% 16%, rgba(244,217,140,0.26), transparent 42%), rgba(255,255,255,0.06)' }}>
                    {image && <img src={image} alt="" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit }} />}
                    <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(8,8,10,0.72))' }} />
                    <span style={{ position: 'absolute', left: 12, top: 12, padding: '7px 10px', borderRadius: 999, background: 'rgba(8,8,10,0.48)', border: '1px solid rgba(244,217,140,0.24)', color: V2.gold, fontSize: 10.5, lineHeight: '13px', fontWeight: 850, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>{getNewsCategoryLabel(item)}</span>
                    {isFreshNews(item) && <span style={{ position: 'absolute', left: 12, bottom: 12, padding: '6px 9px', borderRadius: 999, background: 'rgba(201,168,76,0.22)', border: '1px solid rgba(244,217,140,0.28)', color: '#FFF2B8', fontSize: 10.5, fontWeight: 870 }}>🆕 Новое</span>}
                    {hasNewsVideo(item) && <span style={{ position: 'absolute', right: 12, top: 12, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(8,8,10,0.52)', border: '1px solid rgba(255,255,255,0.20)', color: '#fff' }}>▶</span>}
                  </span>
                  <span style={{ display: 'grid', gap: 9, padding: 14 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: V2.textSoft, fontSize: 10.5, fontWeight: 720 }}>
                      <span>{formatNewsDate(item)}</span>
                      <span>{getReadingMinutes(item)} мин</span>
                      {isFreshNews(item) && <span style={{ color: V2.gold }}>Новое</span>}
                    </span>
                    <span style={{ color: V2.text, fontSize: 17, lineHeight: '21px', fontWeight: 900, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsTitle(item)}</span>
                    <span style={{ color: V2.textSoft, fontSize: 12.5, lineHeight: '18px', fontWeight: 520, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsText(item) || 'Короткий материал АПГ. Откройте, чтобы узнать больше.'}</span>
                    <span style={{ marginTop: 2, color: V2.textMuted, fontSize: 11, fontWeight: 720 }}>{getNewsViews(item)} просмотров · ♥ {reactions} · 💬 {stats.comments}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function NewsFeed({ news, onOpenNews, onOpenNewsItem }) {
  return <NewsWidget news={news} onOpenNews={onOpenNews} onOpenNewsItem={onOpenNewsItem} />;
}

// ─── Баннер ───────────────────────────────────────────────────────────────────

function HeroBanner({ userKeys, userName, streak, counterPulse = false }) {
  const level    = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const pct      = getLevelProgress(userKeys);
  const toNext   = getKeysToNext(userKeys);

  return (
    <div style={{
      margin: '8px 16px',
      borderRadius: 28,
      ...V2.glowGlass,
      padding: '22px 20px 20px',
      position: 'relative', overflow: 'hidden',
      animation: 'fadeInUp 0.5s ease both',
    }}>
      {/* Лёгкий золотой gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, transparent 60%)', pointerEvents: 'none', borderRadius: 28 }} />
      <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}28, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, color: V2.gold, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10, opacity: 0.85 }}>
          ✦ Альянс Партнёров Города
        </div>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: V2.textSoft, fontWeight: 500, marginBottom: 2 }}>Добро пожаловать,</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: V2.text, lineHeight: 1.15, letterSpacing: -0.5 }}>
              {userName ?? 'участник'} 👋
            </div>
          </div>
          {streak >= 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,100,0,0.15)', border: '1px solid rgba(255,100,0,0.35)', borderRadius: 12, padding: '6px 10px', gap: 1 }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#FF8C42' }}>{streak}</span>
              <span style={{ fontSize: 8, color: V2.textSoft, textTransform: 'uppercase', letterSpacing: 0.3 }}>дней</span>
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
                  fontSize: 22, fontWeight: 900, color: V2.text, lineHeight: 1, letterSpacing: -0.5,
                  display: 'inline-block',
                  animation: counterPulse ? 'keyCounterPulse 0.42s ease-out' : undefined,
                }}>
                  {userKeys} <span style={{ fontSize: 14, fontWeight: 700, color: V2.gold }}>🗝️</span>
                </div>
                <div style={{ fontSize: 11, color: V2.textSoft, marginTop: 3 }}>
                  {nextLevel ? `До ${nextLevel.label}: ${toNext} ключей` : 'Максимальный уровень 👑'}
                </div>
              </div>
            </div>
            {nextLevel && (
              <div style={{ textAlign: 'center', ...V2.glass, borderRadius: 10, padding: '6px 10px' }}>
                <div style={{ fontSize: 9, color: V2.textSoft, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>следующий</div>
                <div style={{ fontSize: 16 }}>{nextLevel.emoji}</div>
                <div style={{ fontSize: 9, color: V2.text, fontWeight: 700 }}>{nextLevel.label}</div>
              </div>
            )}
          </div>

          <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, ${level.color}, #E8C97A)`,
              borderRadius: 8, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: `0 0 12px ${level.color}`,
            }} />
          </div>

          <div style={{ fontSize: 12, color: V2.text, textAlign: 'center', fontWeight: 600 }}>
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
    <div style={{ margin: '10px 16px 0', borderRadius: 24, padding: '14px 16px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', border: '1px solid rgba(255,100,0,0.22)', boxShadow: '0 8px 28px rgba(0,0,0,0.18), inset 0 1.5px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeInUp 0.4s ease both' }}>
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
              background: state === 'done' ? 'linear-gradient(135deg, #FF8C42, #FF4500)' : state === 'today' ? 'rgba(255,140,66,0.2)' : 'rgba(255,255,255,0.12)',
              border: state === 'today' ? '2px dashed rgba(255,140,66,0.6)' : state === 'done' ? '2px solid rgba(255,140,66,0.6)' : '1px solid rgba(255,255,255,0.12)',
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
          ? <div style={{ fontSize: 11, color: V2.textSoft }}>{nextMilestone ? `До задания «${nextMilestone} дней»: ещё ${daysLeft}` : '🏆 Рекорд! Так держать!'}</div>
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
    { icon: '🗓️', label: 'События',               color: '#4A90D9', onClick: onOpenEvents },
    { icon: '✦',  label: 'Задания',               color: '#9B7EDF', onClick: onOpenTasks },
    { icon: '🏆', label: 'Рейтинг', rank: userRank, color: V2.gold,   onClick: onOpenLeaderboard },
    { icon: '🎁', label: 'Призы',                 color: '#4BB34B', onClick: onOpenRewards },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 16px' }}>
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick} style={{
          ...V2.glass,
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
          <span style={{ color: V2.textSoft, fontSize: 10, fontWeight: 600 }}>{a.label}</span>
          {a.rank != null && (
            <div style={{
              position: 'absolute', top: 6, right: 6,
              background: V2.gold, borderRadius: 8, padding: '1px 5px',
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
      background: 'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(201,168,76,0.08) 50%, rgba(255,255,255,0.12) 100%)',
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
      <div style={{ margin: '8px 16px', borderRadius: 24, ...V2.glass, padding: '22px 20px' }}>
        <Skel h={11} w={140} radius={6} style={{ marginBottom: 10 }} />
        <Skel h={26} w={190} radius={8} style={{ marginBottom: 4 }} />
        <Skel h={18} w={110} radius={8} style={{ marginBottom: 18 }} />
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
          <Skel h={14} w={160} radius={6} style={{ marginBottom: 10 }} />
          <Skel h={5} radius={3} />
        </div>
      </div>

      {/* QuickActions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '12px 16px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ ...V2.glass, borderRadius: 16, padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
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
            <div key={i} style={{ ...V2.glass, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
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

export function HomePanelV2({
  user, userKeys = 0, favorites = [], partners = [], experts = [], events: rawEvents = [], news = [], recentReviews = [],
  loading = false, error = null, streak = 0, lastScanDate = null,
  completedTasks = [], referralCount = 0, scannedCount = 0, unreadCount = 0, isWebMode = false,
  registeredEventIds = [], onEventRegister, userRank = null, customTasks = [],
  appearance = 'light',
  joinedGroup = false, onJoinGroup,
  userCount = 0, onOpenForPartners,
  counterPulse = false,
  interestProfile = null,
  desktopMode = false,
  onOpenPartner, onToggleFavorite, onScan, onShare, onOpenEvents, onOpenExperts, onOpenPartners, onOpenOffers, onOpenTasks, onOpenLeaderboard, onRetry, onOpenNotifications, onRefresh, onOpenMap, onOpenNearby, onOpenRewards, onOpenReference, onOpenLoki, onOpenNews, onOpenNewsItem,
  onOpenProfile,
  desktopWorkspaceAvailable = false,
  onSwitchAppMode,
  desktopWorkspaceMode = 'user',
  homeExperience = null,
  continueExperience = null,
  recommendations = null,
}) {
  // Главная показывает только актуальные события: не удалённые/архивные и не завершившиеся, ближайшие первыми
  const events = useMemo(() => selectActualEvents(rawEvents), [rawEvents]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator === 'undefined' ? false : !navigator.onLine);

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
  const adaptiveHome = useMemo(() => buildAdaptiveHomeData({ partners, experts, events, news, interestProfile }), [partners, experts, events, news, interestProfile]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateConnection = () => setIsOffline(!window.navigator.onLine);
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  return (
    <Panel id="home" data-home-version="v2">
      <span data-home-version="v2" style={{ display: 'none' }} />
      {/* GreetingSection */}
      <V2FirstScreen
        user={user}
        userKeys={userKeys}
        streak={streak}
        completedTasks={completedTasks}
        referralCount={referralCount}
        scannedCount={scannedCount}
        registeredEventIds={registeredEventIds}
        favorites={favorites}
        events={adaptiveHome.events}
        featuredPartner={featuredPartner}
        partnerOfMonth={partnerOfMonth}
        unreadCount={unreadCount}
        counterPulse={counterPulse}
        onOpenNotifications={onOpenNotifications}
        onOpenPartner={onOpenPartner}
        onOpenNearby={onOpenNearby}
        onOpenPartners={onOpenPartners}
        onOpenOffers={onOpenOffers}
        onOpenEvents={onOpenEvents}
        onOpenRewards={onOpenRewards}
        onOpenTasks={onOpenTasks}
        onOpenReference={onOpenReference}
        onOpenLoki={onOpenLoki}
        onOpenProfile={onOpenProfile}
        onOpenNews={onOpenNews}
        onOpenMap={onOpenMap}
        onOpenExperts={onOpenExperts}
        isOffline={isOffline}
        desktopWorkspaceAvailable={desktopWorkspaceAvailable}
        onSwitchAppMode={onSwitchAppMode}
        desktopWorkspaceMode={desktopWorkspaceMode}
        desktopMode={desktopMode}
        homeExperience={homeExperience}
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
              fontSize: 18, display: 'inline-block', color: V2.gold, lineHeight: 1,
              animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none',
              transform: isRefreshing ? 'none' : `rotate(${Math.min((pullY / PULL_TRIGGER) * 180, 180)}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.15s',
            }}>↻</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: V2.gold }}>
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
              <div style={{ color: V2.text, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Нет подключения</div>
              <div style={{ color: V2.textSoft, fontSize: 13, lineHeight: '19px', marginBottom: 20 }}>Проверьте интернет и попробуйте снова</div>
              <button onClick={onRetry} style={{
                padding: '13px 36px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #D6B766, #E8C97A)',
                color: '#0F0F1A', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Повторить</button>
            </div>
          </div>
        )}

        {!error && (
          <>
            <V2SecondScreen
              user={user}
              favorites={favorites}
              partners={adaptiveHome.partners}
              experts={adaptiveHome.experts}
              events={adaptiveHome.events}
              news={adaptiveHome.news}
              featuredPartner={featuredPartner}
              partnerOfMonth={partnerOfMonth}
              interestProfile={adaptiveHome.interestProfile}
              onOpenPartner={onOpenPartner}
              onOpenEvents={onOpenEvents}
              onOpenExperts={onOpenExperts}
              onOpenPartners={onOpenPartners}
              onOpenRewards={onOpenRewards}
              onOpenNews={onOpenNews}
              onOpenNewsItem={onOpenNewsItem}
              onOpenOffers={onOpenOffers}
              onOpenLoki={onOpenLoki}
              onOpenNearby={onOpenNearby}
              loading={loading}
              isOffline={isOffline}
              desktopMode={desktopMode}
              homeExperience={homeExperience}
              continueExperience={continueExperience}
              recommendations={recommendations}
            />

          </>
        )}
      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </Panel>
  );
}
