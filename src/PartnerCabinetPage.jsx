import React, { useState, useEffect, useRef } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { T, GLASS, GLASS_GOLD } from './design.js';
import { APP_URL } from './constants.js';
import { PartnerQRSection } from './PartnerQRSection.jsx';
import { APG2_PROFILE, ContactCard, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, GlassSection, ProfileHero, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';
import { CabinetEventsBlock } from './EventProposalTools.jsx';
import { userAction } from './userApi.js';

import { uploadPhoto } from './utils/uploadPhoto.js';
import { normalizeExternalUrl, validateExternalUrl } from './utils/externalUrls.js';
import { shareLink } from './utils/shareLink.js';
import { aiProfileListToText, buildAiProfileDraft, sanitizeAiProfile } from './aiProfile.js';
import { LokiIdentity } from './loki/LokiIdentity.jsx';

export function Stars({ rating }) {
  const r = Math.round(rating ?? 0);
  return <span style={{ color: '#FFD700', letterSpacing: 0.5 }}>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span>;
}

export function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: T.chipBg, backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)', borderRadius: 20, padding: '14px 12px',
      textAlign: 'center', border: `1px solid ${color ? color + '30' : T.border}`,
    }}>
      <div style={{ fontSize: 26, marginBottom: 5 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: color ?? T.gold, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textSec, marginTop: 3, lineHeight: '14px' }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: color ?? T.gold, fontWeight: 700, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function getPartnerLaunchState(partner = {}) {
  const photosCount = [partner.logoUrl, partner.coverPhoto, ...(Array.isArray(partner.gallery) ? partner.gallery : [])].filter(Boolean).length;
  const checks = [
    { key: 'logo', label: 'загрузить логотип', done: Boolean(partner.logoUrl), tab: 'edit' },
    { key: 'photos', label: 'добавить фотографии', done: photosCount >= 3, tab: 'edit' },
    { key: 'offer', label: 'создать первую акцию', done: Boolean(String(partner.offer || '').trim()), tab: 'edit' },
    { key: 'news', label: 'разместить первую новость', done: Boolean(partner.firstNewsCreatedAt), tab: 'publications' },
    { key: 'event', label: 'создать мероприятие', done: Boolean(partner.firstEventCreatedAt), tab: 'publications' },
    { key: 'contacts', label: 'проверить контакты', done: Boolean(partner.phone && partner.hours && (partner.socialUrl || partner.vkGroupUrl || partner.websiteUrl || partner.telegramCommunityUrl)), tab: 'edit' },
    { key: 'verified', label: 'получить бейдж “Проверенный”', done: Boolean(partner.verifiedPartner || partner.lifecycleStatus === 'verified_partner'), tab: 'launch' },
    { key: 'share', label: 'поделиться карточкой', done: Boolean(partner.firstShareAt), tab: 'launch' },
    { key: 'clients', label: 'пригласить первых клиентов', done: Boolean(partner.firstReviewInviteAt || partner.publicQRScans > 0 || partner.totalVisits > 0), tab: 'qr' },
  ];
  const doneCount = checks.filter(item => item.done).length;
  return {
    checks,
    percent: Math.round((doneCount / checks.length) * 100),
    doneCount,
  };
}

function nextWeekdayDate(targetDay) {
  const date = new Date();
  const current = date.getDay();
  const diff = (targetDay + 7 - current) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function analyzePartnerAiText(text = '', partner = {}) {
  const source = String(text || '').trim();
  const lower = source.toLowerCase();
  const types = new Set();
  if (/(дегустац|мастер|класс|встреч|лекц|вебинар|мероприят|провести|приглашаем|открыти[ея])/.test(lower)) types.add('event');
  if (/(нов|открываем|филиал|запуск|расскаж|обнов|важн|анонс)/.test(lower)) types.add('news');
  if (/(скидк|акци|спец|промо|бонус|подар|сегодня)/.test(lower)) types.add('promotion');
  if (/(push|пуш|уведом|напомн|сообщить)/.test(lower)) types.add('push');
  if (/(афиш|плакат|баннер|постер|визуал)/.test(lower)) types.add('poster');
  if (/(задан|челлендж|приди|сделай|отметь|отзыв)/.test(lower)) types.add('task');
  if (/(ключ|ключи|бонус)/.test(lower)) types.add('keys');
  if (!types.size) {
    types.add('news');
    if (/(пятниц|суббот|воскрес|сегодня|завтра|мастер|дегустац)/.test(lower)) types.add('event');
  }
  let date = '';
  if (lower.includes('сегодня')) date = new Date().toISOString().slice(0, 10);
  else if (lower.includes('завтра')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    date = d.toISOString().slice(0, 10);
  } else if (lower.includes('пятниц')) date = nextWeekdayDate(5);
  else if (lower.includes('суббот')) date = nextWeekdayDate(6);
  else if (lower.includes('воскрес')) date = nextWeekdayDate(0);
  const timeMatch = lower.match(/(?:в|к)\s*(\d{1,2})(?::(\d{2}))?/);
  const title = source.split(/[.!?\n]/)[0]?.trim() || 'Идея партнёра';
  return {
    title: title.length > 90 ? `${title.slice(0, 87).trim()}...` : title,
    description: source,
    types: Array.from(types),
    date,
    time: timeMatch ? `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2] || '00'}` : '',
    place: partner.address || '',
    linkUrl: partner.websiteUrl || partner.socialUrl || '',
    rewardKeys: lower.includes('ключ') ? 1 : 0,
  };
}

function PartnerAiAssistant({ partner, onToast, onDraftCreated }) {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const actionMeta = {
    event: ['Создать событие', 'Черновик мероприятия попадёт в Центр событий.'],
    news: ['Создать новость', 'Черновик новости попадёт на модерацию.'],
    promotion: ['Создать акцию', 'Акция будет оформлена как черновик публикации.'],
    push: ['Создать push', 'Уведомление будет ждать проверки администратора.'],
    poster: ['Создать афишу', 'Заявка попадёт в AI Editor / афиши.'],
    task: ['Добавить задание', 'Черновик задания будет создан для модерации.'],
    keys: ['Добавить ключи', 'Ключи будут оформлены через черновик задания.'],
  };
  const inputStyle = {
    width: '100%',
    minHeight: 118,
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.24)',
    background: 'rgba(255,255,255,0.16)',
    color: APG2_PROFILE.text,
    padding: 14,
    fontSize: 15,
    lineHeight: '21px',
    boxSizing: 'border-box',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  };

  const runAnalysis = () => {
    const next = analyzePartnerAiText(text, partner);
    if (!next.description) {
      onToast?.('Опишите идею: акция, событие, новость или задача.', 'info');
      return;
    }
    setAnalysis(next);
    setSelected(next.types);
  };

  const toggle = (type) => {
    setSelected(prev => prev.includes(type) ? prev.filter(item => item !== type) : [...prev, type]);
  };

  const createDrafts = async () => {
    if (!analysis || !selected.length) return;
    setSaving(true);
    try {
      const result = await userAction('partner:aiDraft', {
        partnerId: partner.id,
        draft: { ...analysis, types: selected },
      });
      onToast?.(`Создано черновиков: ${result.created?.length || 0}. Они отправлены на модерацию.`, 'success');
      onDraftCreated?.(result.created || []);
      setText('');
      setAnalysis(null);
      setSelected([]);
    } catch (error) {
      onToast?.(error.message || 'Не удалось создать черновики.', 'error');
    }
    setSaving(false);
  };

  return (
    <GlassSection title="AI-помощник">
      <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <GlassBadge tone="gold">Partner AI</GlassBadge>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px' }}>создаёт только черновики</div>
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 20, lineHeight: '25px', fontWeight: 930, marginBottom: 8 }}>Расскажите, что происходит у вас</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px', marginBottom: 12 }}>
          Например: «В пятницу будет дегустация», «Сегодня скидка», «Открываем новый филиал», «Хотим провести мастер-класс».
        </div>
        <textarea style={inputStyle} value={text} onChange={e => setText(e.target.value)} placeholder="Напишите свободным текстом..." />
        <GlassButton tone="gold" onClick={runAnalysis} style={{ marginTop: 10, color: '#17120a' }}>Проанализировать</GlassButton>
      </GlassCard>

      {analysis && (
        <GlassCard style={{ borderRadius: 32 }}>
          <GlassBadge>AI понял идею</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 900, marginTop: 10 }}>{analysis.title}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px', marginTop: 6 }}>
            {analysis.date ? `Дата: ${analysis.date}` : 'Дата не распознана автоматически'}{analysis.time ? ` · ${analysis.time}` : ''}
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {Object.entries(actionMeta).map(([type, [title, help]]) => {
              const active = selected.includes(type);
              const suggested = analysis.types.includes(type);
              return (
                <button key={type} onClick={() => toggle(type)} style={{ ...APG2_PROFILE.glass, borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, alignItems: 'center', textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit', cursor: 'pointer', border: active ? '1px solid rgba(215,184,106,0.58)' : APG2_PROFILE.glass.border }}>
                  <span style={{ width: 28, height: 28, borderRadius: 12, display: 'grid', placeItems: 'center', background: active ? APG2_PROFILE.gold : 'rgba(255,255,255,0.10)', color: active ? '#17120a' : APG2_PROFILE.textSoft, fontWeight: 920 }}>{active ? '✓' : suggested ? '•' : '+'}</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 860 }}>{title}</span>
                    <span style={{ display: 'block', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 2 }}>{help}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <GlassCard style={{ borderRadius: 24, marginTop: 12, background: 'rgba(215,184,106,0.12)' }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 13, lineHeight: '19px', fontWeight: 760 }}>AI не публикует автоматически. Все выбранные материалы будут созданы как черновики и попадут на модерацию АПГ.</div>
          </GlassCard>
          <GlassButton tone="gold" disabled={saving || !selected.length} onClick={createDrafts} style={{ marginTop: 12, color: '#17120a' }}>{saving ? 'Создаём черновики...' : 'Создать выбранные черновики'}</GlassButton>
        </GlassCard>
      )}
    </GlassSection>
  );
}

export function AiProfileSection({ type = 'partner', entity, inputStyle, onSave, onToast }) {
  const [draft, setDraft] = useState(() => sanitizeAiProfile(entity?.aiProfile || buildAiProfileDraft(entity, type)));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(sanitizeAiProfile(entity?.aiProfile || buildAiProfileDraft(entity, type)));
  }, [entity?.id, entity?.aiProfile, type]);
  const statusLabel = draft.status === 'submitted' ? 'На обновлении' : draft.status === 'approved' ? 'Подтверждён' : draft.status === 'generated' ? 'Сгенерирован' : 'Черновик';
  const update = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const save = async (status = draft.status || 'draft') => {
    setSaving(true);
    try {
      const aiProfile = sanitizeAiProfile({ ...draft, status, source: 'cabinet', needsReview: status !== 'approved' });
      await onSave(aiProfile);
      setDraft(aiProfile);
      onToast?.(status === 'submitted' ? 'AI Profile отправлен на обновление.' : 'AI Profile сохранён.', 'success');
    } catch (error) {
      onToast?.(error.message || 'Не удалось сохранить AI Profile.', 'error');
    }
    setSaving(false);
  };
  const field = (label, key, rows = 2, placeholder = '') => (
    <>
      <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{label}</label>
      <textarea
        value={Array.isArray(draft[key]) ? aiProfileListToText(draft[key]) : draft[key] || ''}
        onChange={e => update(key, e.target.value)}
        rows={rows}
        style={{ ...inputStyle, resize: 'vertical', marginTop: 6 }}
        placeholder={placeholder}
      />
    </>
  );
  return (
    <GlassSection title="AI Profile">
      <GlassCard style={{ borderRadius: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <GlassBadge tone="gold">Локи читает это</GlassBadge>
          <GlassBadge>{statusLabel}</GlassBadge>
        </div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px', marginBottom: 14 }}>
          AI Profile помогает Локи понимать, кому рекомендовать карточку и на какие запросы она отвечает. Это не публикуется автоматически.
        </div>
        {field('Краткое описание', 'summary', 4, 'Коротко: чем полезна карточка для участников АПГ')}
        {field('Специализация', 'specialization', 2, type === 'expert' ? 'Например: семейный психолог, юрист, нутрициолог' : 'Например: семейное кафе, студия красоты, сервис для дома')}
        {field('Сильные стороны', 'strengths', 3, 'Каждый пункт с новой строки')}
        {field('Категории', 'categories', 2, 'food, children, beauty...')}
        {field('Типичные клиенты', 'typicalClients', 3)}
        {field('Кому рекомендуется', 'recommendedFor', 3)}
        {field('Типичные запросы пользователей', 'typicalRequests', 3, 'Где поесть с детьми\\nНайти специалиста\\nКуда сходить вечером')}
        {field('Связанные категории', 'relatedCategories', 2)}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <GlassButton disabled={saving} onClick={() => save('draft')}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </GlassButton>
          <GlassButton disabled={saving} tone="gold" onClick={() => save('submitted')} style={{ color: '#17120a' }}>
            Отправить на обновление
          </GlassButton>
        </div>
      </GlassCard>
    </GlassSection>
  );
}

export function PartnerCabinetPage({ nav = 'partner-cabinet', variant = 'v2', partner: initialPartner, expert, events = [], onBack, onPartnerUpdate, onEventCreated, onToast }) {
  const [partner, setPartner]     = useState(initialPartner);
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('launch');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef              = useRef(null);

  // Поля редактирования
  const [fDesc,   setFDesc]   = useState('');
  const [fOffer,  setFOffer]  = useState('');
  const [fPhone,  setFPhone]  = useState('');
  const [fHours,  setFHours]  = useState('');
  const [fSocial, setFSocial] = useState('');
  const [fLogo,   setFLogo]   = useState('');
  const [fAiProfile, setFAiProfile] = useState(null);

  useEffect(() => {
    if (!initialPartner?.id) return;
    setLoading(true);

    Promise.all([
      getDoc(doc(db, 'partners', initialPartner.id)),
      getDocs(query(
        collection(db, 'partners', initialPartner.id, 'reviews'),
        orderBy('createdAt', 'desc'),
        limit(20),
      )).catch(() => ({ docs: [] })),
    ]).then(([pSnap, rSnap]) => {
      const p = pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } : initialPartner;
      setPartner(p);
      setFDesc(p.description ?? '');
      setFOffer(p.offer ?? '');
      setFPhone(p.phone ?? '');
      setFHours(p.hours ?? '');
      setFSocial(p.socialUrl ?? '');
      setFLogo(p.logoUrl ?? '');
      setFAiProfile(sanitizeAiProfile(p.aiProfile || buildAiProfileDraft(p, 'partner')));
      setReviews(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [initialPartner?.id]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      onToast?.('Файл слишком большой. Максимум 1 МБ.', 'error');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPhoto(file, `partners/${partner.id}`);
      setFLogo(url);
    } catch { onToast?.('Ошибка загрузки фото', 'error'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!partner?.id) return;
    const phone = fPhone.trim();
    if (phone && !/^[+\d()\s-]{7,16}$/.test(phone)) {
      onToast?.('Некорректный номер телефона. Пример: +7 (999) 123-45-67', 'error');
      return;
    }
    const socialResult = validateExternalUrl(fSocial);
    if (!socialResult.ok) {
      onToast?.(`Соцсеть: ${socialResult.error}`, 'error');
      return;
    }
    setSaving(true);
    try {
      const data = {
        description:      fDesc.trim(),
        offer:            fOffer.trim(),
        phone:            fPhone.trim(),
        hours:            fHours.trim(),
        socialUrl:        normalizeExternalUrl(fSocial),
        logoUrl:          fLogo.trim(),
      };
      await userAction('partner:profileUpdate', { id: partner.id, patch: data });
      const updated = { ...partner, ...data };
      setPartner(updated);
      onPartnerUpdate?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      onToast?.(error?.message || 'Ошибка сохранения. Попробуйте ещё раз.', 'error');
    }
    setSaving(false);
  };

  const handleAiProfileSave = async (aiProfile) => {
    if (!partner?.id) return;
    await userAction('partner:profileUpdate', { id: partner.id, patch: { aiProfile } });
    const updated = { ...partner, aiProfile };
    setPartner(updated);
    setFAiProfile(aiProfile);
    onPartnerUpdate?.(updated);
  };

  if (!partner) return null;

  const totalVisits    = partner.totalVisits ?? 0;
  const publicQRScans  = partner.publicQRScans ?? 0;
  const viewCount      = partner.viewCount ?? 0;
  const favoritesCount = partner.favoritesCount ?? 0;
  const routeClicks    = partner.routeClicks ?? partner.mapRouteClicks ?? 0;
  const websiteClicks  = partner.websiteClicks ?? partner.siteClicks ?? 0;
  const vkClicks       = partner.vkClicks ?? partner.vkGroupClicks ?? 0;
  const telegramClicks = partner.telegramClicks ?? 0;
  const phoneClicks    = partner.phoneClicks ?? 0;
  const qrOpens        = partner.qrOpenCount ?? partner.qrOpens ?? 0;
  const avgRating      = partner.avgRating ?? 0;
  const ratingCount    = partner.reviewCount ?? reviews.length;
  const conversionPct  = viewCount > 0 ? Math.round((totalVisits / viewCount) * 100) : 0;
  const launchState    = getPartnerLaunchState(partner);
  const lifecycleLabel = partner.lifecycleStatusLabel || partner.connectionStatusLabel || (partner.catalogPublished ? 'Опубликовано' : 'Карточка оформляется');

  const inputStyle = {
    width: '100%', padding: '11px 13px', borderRadius: 12,
    border: `1px solid ${T.border}`,
    background: T.chipBg, color: T.textPri,
    fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12,
  };
  const labelStyle = { fontSize: 12, color: T.textSec, marginBottom: 5, display: 'block', fontWeight: 600 };

  const v2InputStyle = {
    width: '100%', padding: '13px 14px', borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.24)',
    background: 'rgba(255,255,255,0.20)', color: APG2_PROFILE.text,
    fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12,
  };

  if (variant === 'v2') {
    const firstTodoIdx = launchState.checks.findIndex(c => !c.done);
    const nextTodo     = firstTodoIdx >= 0 ? launchState.checks[firstTodoIdx] : null;

    const getLokiMessage = () => {
      if (launchState.percent < 33)
        return { msg: 'Карточка только начинает оформляться. Начните с логотипа и описания — это первое, что видят участники АПГ.', cta: 'Заполнить карточку', tab: 'edit' };
      if (!partner.logoUrl)
        return { msg: 'Без логотипа карточка выглядит неполно. Загрузите фото или логотип — конверсия вырастет.', cta: 'Загрузить фото', tab: 'edit' };
      if (!String(partner.offer || '').trim())
        return { msg: 'Акция для участников АПГ — ваш главный крючок. Добавьте спецпредложение, и больше людей захотят прийти.', cta: 'Добавить акцию', tab: 'edit' };
      if (viewCount > 0 && totalVisits === 0)
        return { msg: `Карточку уже посмотрели ${viewCount} раз. До QR‑скана пока не доходят — разместите QR‑код на видном месте у кассы.`, cta: 'Посмотреть QR', tab: 'qr' };
      if (viewCount > 30 && conversionPct < 5)
        return { msg: `Охват хороший (${viewCount} просмотров), но конверсия ${conversionPct}%. Попробуйте обновить акцию или добавить новое фото.`, cta: 'Обновить акцию', tab: 'edit' };
      if (avgRating > 0 && avgRating < 3.5)
        return { msg: 'Рейтинг можно улучшить. Предложите клиентам бонус за следующий визит и попросите оставить честный отзыв.', cta: 'Посмотреть отзывы', tab: 'reviews' };
      if (totalVisits > 0 && !partner.firstNewsCreatedAt)
        return { msg: 'Отличный старт! Первая публикация поможет пользователям вас запомнить — расскажите о заведении или акции.', cta: 'Создать контент', tab: 'publications' };
      if (launchState.percent === 100)
        return { msg: 'Карточка заполнена полностью. Сосредоточьтесь на качестве — довольные клиенты сами приведут следующих.', cta: 'Посмотреть статистику', tab: 'stats' };
      return { msg: 'Заполняйте чек‑лист шаг за шагом, и карточка начнёт привлекать всё больше участников АПГ.', cta: null, tab: null };
    };
    const loki = getLokiMessage();

    return (
      <Panel id={nav}>
        <GlassPanel>
          <ScreenHeader title="Кабинет" subtitle={partner.name} kicker="Партнер АПГ" onBack={onBack} />

          <ProfileHero
            image={partner.coverPhoto || fLogo}
            title={partner.name}
            subtitle={partner.categoryLabel || partner.address}
            status={lifecycleLabel}
            description={partner.offer || partner.description}
            avatar={fLogo ? <img src={fLogo} alt="" style={{ width: 64, height: 64, borderRadius: 24, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.24)' }} /> : <GlassBadge tone="gold">{partner.emoji ?? '🏪'}</GlassBadge>}
            badges={[partner.verifiedPartner || partner.lifecycleStatus === 'verified_partner' ? 'Проверенный' : partner.featured ? 'Партнер дня' : 'Запуск', avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : `${ratingCount} отзывов`].filter(Boolean)}
          />

          {/* Быстрые действия */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginTop: 12 }}>
            {[
              { icon: '📷', label: 'Фото',     action: () => setActiveTab('edit') },
              { icon: '🎁', label: 'Акция',     action: () => setActiveTab('edit') },
              { icon: '🤖', label: 'AI',        action: () => setActiveTab('ai') },
              { icon: '📅', label: 'Календарь', action: () => setActiveTab('calendar') },
              { icon: '📲', label: 'QR-код',    action: () => setActiveTab('qr') },
              { icon: '🌐', label: 'Карточка',  action: () => window.open(shareLink('partner', partner.id), '_blank') },
            ].map(({ icon, label, action }) => (
              <button key={label} onClick={action} style={{
                ...APG2_PROFILE.glass,
                borderRadius: 22, padding: '11px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: 760, color: APG2_PROFILE.textSoft, textAlign: 'center', lineHeight: '13px' }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Навигация по вкладкам */}
          <GlassCard style={{ borderRadius: 28, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 12 }}>
            {[['launch', 'Старт'], ['ai', 'AI-помощник'], ['ai-profile', 'AI Profile'], ['calendar', 'Календарь'], ['stats', 'Аналитика'], ['edit', 'Карточка'], ['qr', 'QR'], ['publications', 'Контент'], ['reviews', 'Отзывы'], ['docs', 'Документы']].map(([id, label]) => (
              <GlassButton key={id} onClick={() => setActiveTab(id)} tone={activeTab === id ? 'gold' : 'glass'} style={{ minHeight: 44, borderRadius: 20, color: activeTab === id ? '#17120a' : APG2_PROFILE.text }}>{label}</GlassButton>
            ))}
          </GlassCard>

          {/* ── Старт ── */}
          {activeTab === 'launch' && (
            <GlassSection title="Готовность кабинета">

              {/* Мини-метрики */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                <StatPill label="просмотров" value={viewCount} />
                <StatPill label="QR-сканов" value={totalVisits + publicQRScans} tone="gold" />
                <StatPill label="рейтинг" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} />
              </div>

              {/* Карта прогресса */}
              <GlassCard tone="gold" style={{ borderRadius: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: '#17120a', fontSize: 18, lineHeight: '22px', fontWeight: 930 }}>
                      Профиль готов на {launchState.percent}%
                    </div>
                    <div style={{ color: 'rgba(23,18,10,0.60)', fontSize: 13, marginTop: 3 }}>
                      {launchState.doneCount} из {launchState.checks.length} шагов выполнено
                    </div>
                  </div>
                  <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(23,18,10,0.14)" strokeWidth="4" />
                    <circle
                      cx="26" cy="26" r="21" fill="none" stroke="#17120a" strokeWidth="4"
                      strokeLinecap="round" transform="rotate(-90 26 26)"
                      strokeDasharray={String(2 * Math.PI * 21)}
                      strokeDashoffset={String(2 * Math.PI * 21 * (1 - launchState.percent / 100))}
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                    <text x="26" y="31" textAnchor="middle" fontSize="12" fontWeight="900" fill="#17120a">{launchState.percent}%</text>
                  </svg>
                </div>

                <div style={{ height: 6, borderRadius: 999, background: 'rgba(23,18,10,0.14)', overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ width: `${launchState.percent}%`, height: '100%', borderRadius: 999, background: '#17120a', transition: 'width 0.8s ease' }} />
                </div>

                {/* Следующий шаг */}
                {nextTodo && (
                  <div style={{ background: 'rgba(255,255,255,0.30)', borderRadius: 20, padding: '10px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0, color: '#17120a' }}>▶</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: 'rgba(23,18,10,0.52)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Следующий шаг</div>
                      <div style={{ fontSize: 13, color: '#17120a', fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextTodo.label}</div>
                    </div>
                    <button onClick={() => setActiveTab(nextTodo.tab)} style={{
                      background: '#17120a', border: 'none', borderRadius: 14,
                      padding: '6px 12px', color: '#D7B86A',
                      fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                      Сделать
                    </button>
                  </div>
                )}

                {/* Чек-лист */}
                <div style={{ display: 'grid', gap: 6 }}>
                  {launchState.checks.map((item, idx) => (
                    <button key={item.key} onClick={() => setActiveTab(item.tab)} style={{
                      border: 0, borderRadius: 16, padding: '9px 12px', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: item.done ? 'rgba(23,18,10,0.08)' : idx === firstTodoIdx ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.22)',
                      color: '#17120a', fontWeight: 780, cursor: 'pointer', fontFamily: 'inherit',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: item.done ? '#17120a' : 'rgba(23,18,10,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 900,
                        color: item.done ? '#D7B86A' : 'rgba(23,18,10,0.45)',
                      }}>
                        {item.done ? '✓' : String(idx + 1)}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, opacity: item.done ? 0.60 : 1, textDecoration: item.done ? 'line-through' : 'none' }}>
                        {item.label}
                      </span>
                      {!item.done && <span style={{ fontSize: 13, color: 'rgba(23,18,10,0.40)', flexShrink: 0 }}>→</span>}
                    </button>
                  ))}
                </div>
              </GlassCard>

              {/* Локи */}
              <GlassCard style={{ borderRadius: 30, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <LokiIdentity size={34} state="recommending" showText={false} style={{ placeItems: 'center', flexShrink: 0 }} />
                  <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, letterSpacing: 0.8, textTransform: 'uppercase' }}>Локи · персональный менеджер</div>
                </div>
                <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '21px', fontWeight: 760 }}>
                  {loki.msg}
                </div>
                {loki.cta && loki.tab && (
                  <GlassButton onClick={() => setActiveTab(loki.tab)} style={{ marginTop: 12, width: '100%' }}>
                    {loki.cta}
                  </GlassButton>
                )}
              </GlassCard>

              {/* Ссылка эксперта */}
              {expert && (
                <GlassCard tone="gold" style={{ borderRadius: 30, marginTop: 12 }}>
                  <div style={{ color: '#17120a', fontSize: 14, lineHeight: '20px', fontWeight: 780, marginBottom: 8 }}>
                    Отправьте клиенту ссылку — при открытии ему начислится ключ.
                  </div>
                  <div style={{ color: 'rgba(20,15,8,0.68)', fontSize: 12, lineHeight: '17px', overflowWrap: 'anywhere', marginBottom: 10 }}>
                    {`${APP_URL}/?scan=expert_${expert.id}`}
                  </div>
                  <GlassButton onClick={() => navigator.clipboard.writeText(`${APP_URL}/?scan=expert_${expert.id}`).catch(() => {})} style={{ color: '#17120a', background: 'rgba(255,255,255,0.32)' }}>
                    Скопировать ссылку
                  </GlassButton>
                </GlassCard>
              )}
            </GlassSection>
          )}

          {activeTab === 'calendar' && (
            <CabinetEventsBlock
              type="partner"
              profile={partner}
              events={events}
              onToast={onToast}
              onEventCreated={onEventCreated}
            />
          )}

          {activeTab === 'ai' && (
            <PartnerAiAssistant
              partner={partner}
              onToast={onToast}
              onDraftCreated={() => {
                setPartner(prev => prev ? { ...prev, lastPartnerAiDraftAt: new Date().toISOString() } : prev);
              }}
            />
          )}

          {activeTab === 'ai-profile' && (
            <AiProfileSection
              type="partner"
              entity={{ ...partner, aiProfile: fAiProfile || partner.aiProfile }}
              inputStyle={v2InputStyle}
              onSave={handleAiProfileSave}
              onToast={onToast}
            />
          )}

          {/* ── Аналитика ── */}
          {activeTab === 'stats' && (
            <GlassSection title="Аналитика">
              {loading ? (
                <EmptyStateV2 icon="📊" title="Загружаем статистику" text="Собираем данные карточки." />
              ) : totalVisits === 0 && viewCount === 0 && publicQRScans === 0 ? (
                <EmptyStateV2
                  icon="📊"
                  title="Статистика собирается"
                  text="Данные появятся после первых посещений вашего заведения участниками АПГ."
                  action={<GlassButton onClick={() => setActiveTab('qr')}>Посмотреть QR-коды</GlassButton>}
                />
              ) : (
                <>
                  {/* Охват */}
                  <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, fontWeight: 760, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Охват</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    <StatPill label="просмотров карточки" value={viewCount} />
                    <StatPill label="в избранном" value={favoritesCount} />
                  </div>

                  {/* Сканирования */}
                  <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, fontWeight: 760, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Сканирования</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                    <StatPill label="служебный QR" value={totalVisits} tone="gold" />
                    <StatPill label="публичный QR" value={publicQRScans} />
                    <StatPill label="открытий QR" value={qrOpens} />
                  </div>

                  {/* Конверсия */}
                  {viewCount > 0 && (
                    <GlassCard style={{ borderRadius: 24, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginBottom: 3 }}>Конверсия</div>
                          <div style={{ color: APG2_PROFILE.text, fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{conversionPct}%</div>
                          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: 4 }}>просмотр → визит с QR</div>
                        </div>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: `conic-gradient(${APG2_PROFILE.gold} ${Math.min(conversionPct * 3.6, 360)}deg, rgba(255,255,255,0.08) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <div style={{ width: 42, height: 42, borderRadius: '50%', ...APG2_PROFILE.glass }} />
                        </div>
                      </div>
                    </GlassCard>
                  )}

                  {/* Каналы переходов */}
                  {(websiteClicks + vkClicks + telegramClicks + phoneClicks + routeClicks) > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, fontWeight: 760, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Переходы из карточки</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                        {phoneClicks   > 0 && <StatPill label="📞 звонков"       value={phoneClicks} />}
                        {websiteClicks > 0 && <StatPill label="🌐 на сайт"       value={websiteClicks} />}
                        {vkClicks      > 0 && <StatPill label="🔵 ВКонтакте"     value={vkClicks} />}
                        {telegramClicks > 0 && <StatPill label="✈️ Telegram"     value={telegramClicks} />}
                        {routeClicks   > 0 && <StatPill label="🗺️ маршрутов"    value={routeClicks} />}
                      </div>
                    </>
                  )}

                  {/* Рейтинг */}
                  {(avgRating > 0 || ratingCount > 0) && (
                    <GlassCard style={{ borderRadius: 30 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flexShrink: 0 }}>
                          <div style={{ color: APG2_PROFILE.gold, fontSize: 38, fontWeight: 930, lineHeight: 1 }}>
                            {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                          </div>
                          <Stars rating={avgRating} />
                          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 4 }}>{ratingCount} отзывов</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          {[5,4,3,2,1].map(star => {
                            const count = reviews.filter(r => r.stars === star).length;
                            const pct   = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
                            return (
                              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                <span style={{ fontSize: 10, color: APG2_PROFILE.textMuted, width: 8 }}>{star}</span>
                                <span style={{ fontSize: 10, color: '#FFD700' }}>★</span>
                                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: APG2_PROFILE.gold, borderRadius: 2, transition: 'width 0.5s' }} />
                                </div>
                                <span style={{ fontSize: 10, color: APG2_PROFILE.textMuted, width: 14, textAlign: 'right' }}>{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </GlassCard>
                  )}
                </>
              )}
            </GlassSection>
          )}

          {/* ── QR-коды ── */}
          {activeTab === 'qr' && (
            <GlassSection title="QR-коды и материалы">
              <GlassCard style={{ borderRadius: 32 }}>
                <PartnerQRSection partner={partner} />
              </GlassCard>
            </GlassSection>
          )}

          {/* ── Контент ── */}
          {activeTab === 'publications' && (
            <GlassSection title="Контент">
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { icon: '📰', title: 'Новости',      text: 'Расскажите о запуске, обновлении услуг или важном событии.', done: Boolean(partner.firstNewsCreatedAt) },
                  { icon: '🎁', title: 'Акции',        text: 'Добавьте специальное предложение для участников АПГ.',       done: Boolean(String(partner.offer || '').trim()) },
                  { icon: '📅', title: 'Мероприятия',  text: 'Пригласите пользователей на встречу или мастер-класс.',       done: Boolean(partner.firstEventCreatedAt) },
                  { icon: '🏆', title: 'Призы',        text: 'Подготовьте бонус для активности пользователей.',             done: false },
                ].map(({ icon, title, text, done }) => (
                  <GlassCard key={title} style={{ borderRadius: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 18, flexShrink: 0,
                      background: done ? 'rgba(75,179,75,0.18)' : APG2_PROFILE.goldSoft,
                      border: done ? '1px solid rgba(75,179,75,0.34)' : '1px solid rgba(215,184,106,0.25)',
                      display: 'grid', placeItems: 'center', fontSize: 22,
                    }}>
                      {done ? '✓' : icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 850 }}>{title}</div>
                      <div style={{ color: done ? 'rgba(75,179,75,0.88)' : APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 3 }}>
                        {done ? 'Выполнено ✓' : text}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
              <GlassCard style={{ borderRadius: 24, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <LokiIdentity size={26} state="ready" showText={false} style={{ placeItems: 'center', flexShrink: 0 }} />
                  <span style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, letterSpacing: 0.8, textTransform: 'uppercase' }}>Совет Локи</span>
                </div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px' }}>
                  Контент создаётся совместно с командой АПГ. Сообщите нам о ваших событиях или акциях — мы оформим публикацию и разместим её в ленте.
                </div>
              </GlassCard>
            </GlassSection>
          )}

          {/* ── Отзывы ── */}
          {activeTab === 'reviews' && (
            <GlassSection title="Отзывы">
              {reviews.length === 0 ? (
                <EmptyStateV2 icon="⭐" title="Отзывов пока нет" text="После запуска карточки здесь появятся оценки и комментарии участников АПГ." />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {reviews.map(review => (
                    <GlassCard key={review.id} style={{ borderRadius: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 850 }}>{review.userName || 'Участник АПГ'}</div>
                        <div style={{ color: APG2_PROFILE.gold, fontSize: 12 }}><Stars rating={review.rating || 0} /></div>
                      </div>
                      <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>{review.text || 'Без текста'}</div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </GlassSection>
          )}

          {/* ── Документы ── */}
          {activeTab === 'docs' && (
            <GlassSection title="Документы">
              <EmptyStateV2 icon="📄" title="Документы и реквизиты" text="Договоры, счета и юридическая информация будут доступны после подключения документооборота." />
            </GlassSection>
          )}

          {/* ── Карточка ── */}
          {activeTab === 'edit' && (
            <GlassSection title="Карточка партнера">
              <GlassCard style={{ borderRadius: 32 }}>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Логотип</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 14px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 24, background: APG2_PROFILE.goldSoft, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {fLogo ? <img src={fLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (partner.emoji ?? '🏪')}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  <GlassButton onClick={() => logoInputRef.current?.click()}>{uploading ? 'Загрузка...' : 'Загрузить'}</GlassButton>
                </div>

                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Описание</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={4} style={{ ...v2InputStyle, resize: 'vertical', marginTop: 6 }} placeholder="Расскажите о своём заведении..." />

                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Акция для участников АПГ</label>
                <textarea value={fOffer} onChange={e => setFOffer(e.target.value)} rows={3} style={{ ...v2InputStyle, resize: 'vertical', marginTop: 6 }} placeholder="Скидка 10% на первый визит" />

                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Телефон</label>
                <input value={fPhone} onChange={e => setFPhone(e.target.value)} style={{ ...v2InputStyle, marginTop: 6 }} placeholder="+7 (499) 123-45-67" />

                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Часы работы</label>
                <input value={fHours} onChange={e => setFHours(e.target.value)} style={{ ...v2InputStyle, marginTop: 6 }} placeholder="Пн–Пт 10:00–20:00, Сб–Вс 11:00–18:00" />

                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Сообщество для ленты VK / соцсеть</label>
                <input value={fSocial} onChange={e => setFSocial(e.target.value)} style={{ ...v2InputStyle, marginTop: 6 }} placeholder="https://vk.com/mypage" />
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '18px', marginTop: -6, marginBottom: 10 }}>Укажите ссылку на ваше сообщество VK. Записи VK станут частью общей “Ленты” вашей карточки.</div>

                <GlassButton onClick={handleSave} tone="gold" style={{ width: '100%', color: '#17120a', marginTop: 4 }}>
                  {saving ? 'Сохраняем...' : saved ? '✓ Сохранено' : 'Сохранить изменения'}
                </GlassButton>

                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(215,184,106,0.07)', border: '1px solid rgba(215,184,106,0.18)', borderRadius: 16 }}>
                  <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, lineHeight: '17px' }}>
                    💡 Название, категория и QR управляются администратором АПГ. По вопросам — пишите нам.
                  </div>
                </div>
              </GlassCard>
            </GlassSection>
          )}

        </GlassPanel>
      </Panel>
    );
  }

  return (
    <Panel id={nav}>
      {/* Хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)',
        WebkitBackdropFilter: 'blur(36px) saturate(2)',
        borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏪 {partner.name}</div>
            <div style={{ fontSize: 10, color: T.gold, marginTop: 1 }}>Личный кабинет партнёра</div>
          </div>
        </div>
        {/* Вкладки */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
          {[['stats', '📊 Статистика'], ['qr', '📲 QR-коды'], ['edit', '✏️ Карточка']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: activeTab === id ? T.gold : T.chipBg,
              color: activeTab === id ? '#0F0F1A' : T.textSec,
              transition: 'all 0.18s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ background: 'transparent', minHeight: '100%', padding: '12px 16px 90px' }}>

        {/* ── Ссылка эксперта ── */}
        {expert && (() => {
          const link = `${APP_URL}/?scan=expert_${expert.id}`;
          return (
            <div style={{ ...GLASS_GOLD, borderRadius: 20, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, marginBottom: 8 }}>🔗 Ссылка для клиента</div>
              <div style={{ fontSize: 11, color: T.textSec, lineHeight: '16px', marginBottom: 10 }}>
                Отправьте ссылку клиенту — при открытии ему автоматически начислится {expert.keys ?? 1} {(expert.keys ?? 1) === 1 ? 'ключ' : 'ключа'}. Каждый клиент может воспользоваться ссылкой только один раз.
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: T.textPri, wordBreak: 'break-all', marginBottom: 10 }}>
                {link}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link).catch(() => {});
                }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
                  color: '#0F0F1A', fontSize: 13, fontWeight: 700,
                }}
              >
                Скопировать ссылку
              </button>
            </div>
          );
        })()}

        {/* ── СТАТИСТИКА ── */}
        {activeTab === 'stats' && (
          <>
            {/* Шапка карточки */}
            <div style={{ ...GLASS_GOLD, borderRadius: 24, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, overflow: 'hidden' }}>
                {fLogo
                  ? <img src={fLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : partner.emoji ?? '🏪'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>{partner.name}</div>
                {partner.address && <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>📍 {partner.address}</div>}
                {avgRating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <Stars rating={avgRating} />
                    <span style={{ fontSize: 11, color: T.textSec }}>{avgRating.toFixed(1)} · {ratingCount} отз.</span>
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[1,2,3,4].map(i => <div key={i} style={{ ...GLASS, borderRadius: 20, height: 95, animation: 'shimmer 1.5s ease-in-out infinite' }} />)}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: T.textSec, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Ключевые метрики</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <StatCard icon="🔑" label="Служебный QR" value={totalVisits} color={T.gold} sub="ключи начислены" />
                  <StatCard icon="🌐" label="Публичный QR" value={publicQRScans} color="#4A90D9" sub="переходов" />
                  <StatCard icon="👁" label="Просмотров карточки" value={viewCount} color={T.blue} />
                  <StatCard icon="❤️" label="В избранном" value={favoritesCount} color="#E64646" />
                  <StatCard
                    icon="🎯" label="Конверсия" color={T.green}
                    value={viewCount > 0 ? `${conversionPct}%` : '—'}
                    sub={viewCount > 0 ? 'просмотр → скан' : 'пока нет данных'}
                  />
                  {(avgRating > 0 || ratingCount > 0) && (
                    <StatCard icon="⭐" label="Средняя оценка" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} color="#FFD700" sub={`${ratingCount} отзывов`} />
                  )}
                </div>

                {/* Рейтинг */}
                {avgRating > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: T.textSec, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Рейтинг и отзывы</div>
                    <div style={{ ...GLASS, borderRadius: 20, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 38, fontWeight: 900, color: T.gold, lineHeight: 1 }}>{avgRating.toFixed(1)}</div>
                        <Stars rating={avgRating} />
                        <div style={{ fontSize: 10, color: T.textSec, marginTop: 3 }}>{ratingCount} отзывов</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        {[5,4,3,2,1].map(star => {
                          const count = reviews.filter(r => r.stars === star).length;
                          const pct = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
                          return (
                            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 10, color: T.textSec, width: 8 }}>{star}</span>
                              <span style={{ fontSize: 10, color: '#FFD700' }}>★</span>
                              <div style={{ flex: 1, height: 5, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: T.gold, borderRadius: 2, transition: 'width 0.5s' }} />
                              </div>
                              <span style={{ fontSize: 10, color: T.textSec, width: 12 }}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {reviews.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {reviews.slice(0, 5).map(r => (
                          <div key={r.id} style={{ ...GLASS, borderRadius: 14, padding: '11px 13px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: r.text ? 5 : 0 }}>
                              <Stars rating={r.stars} />
                              <span style={{ fontSize: 10, color: T.textSec, marginLeft: 'auto' }}>
                                {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}
                              </span>
                            </div>
                            {r.text && <div style={{ fontSize: 12, color: T.textSec, lineHeight: '17px' }}>{r.text}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {totalVisits === 0 && viewCount === 0 && (
                  <div style={{ ...GLASS, borderRadius: 24, padding: '32px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>📊</div>
                    <div style={{ color: T.textPri, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Статистика собирается</div>
                    <div style={{ color: T.textSec, fontSize: 12, lineHeight: '18px' }}>Данные появятся после первых посещений вашего заведения участниками АПГ</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── QR-КОДЫ ── */}
        {activeTab === 'qr' && (
          <div style={{ ...GLASS, borderRadius: 24, padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 14 }}>📲 QR-коды партнёра</div>
            <PartnerQRSection partner={partner} />
          </div>
        )}

        {/* ── РЕДАКТИРОВАНИЕ ── */}
        {activeTab === 'edit' && (
          <>
            {/* Логотип */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...GLASS, borderRadius: 20, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                {fLogo
                  ? <img src={fLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : partner.emoji ?? '🏪'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 6 }}>Логотип заведения</div>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploading}
                    style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.chipBg, color: T.textPri, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}
                  >
                    {uploading ? 'Загрузка...' : '📷 Загрузить фото'}
                  </button>
                  {fLogo && (
                    <button onClick={() => setFLogo('')} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid rgba(230,70,70,0.3)`, background: 'rgba(230,70,70,0.08)', color: '#E64646', fontSize: 11, cursor: 'pointer' }}>
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            </div>

            <label style={labelStyle}>Описание заведения</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              placeholder="Расскажите о своём заведении..."
              value={fDesc} onChange={e => setFDesc(e.target.value)}
            />

            <label style={labelStyle}>🎁 Спецпредложение для участников АПГ</label>
            <input style={inputStyle} placeholder="Скидка 10% на первый визит" value={fOffer} onChange={e => setFOffer(e.target.value)} />

            <label style={labelStyle}>📞 Телефон</label>
            <input style={inputStyle} placeholder="+7 (499) 123-45-67" value={fPhone} onChange={e => setFPhone(e.target.value)} />

            <label style={labelStyle}>🕐 Часы работы</label>
            <input style={inputStyle} placeholder="Пн-Пт 10:00-20:00, Сб-Вс 11:00-18:00" value={fHours} onChange={e => setFHours(e.target.value)} />

            <label style={labelStyle}>🔗 Сообщество для ленты VK / соцсеть</label>
            <input style={inputStyle} placeholder="https://vk.com/mypage" value={fSocial} onChange={e => setFSocial(e.target.value)} />
            <div style={{ color: T.textSec, fontSize: 11.5, lineHeight: '17px', margin: '-6px 0 10px' }}>Укажите ссылку на ваше сообщество VK. Записи VK станут частью общей “Ленты”.</div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 16, border: 'none',
                background: saved
                  ? 'rgba(75,179,75,0.2)'
                  : `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
                color: saved ? T.green : '#0F0F1A',
                fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1, transition: 'all 0.25s',
                outline: saved ? '1px solid rgba(75,179,75,0.4)' : 'none',
              }}
            >
              {saving ? 'Сохраняем...' : saved ? '✓ Сохранено!' : 'Сохранить изменения'}
            </button>

            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px' }}>
                💡 Название заведения, категория и QR-код управляются администратором АПГ. По всем вопросам пишите нам.
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
