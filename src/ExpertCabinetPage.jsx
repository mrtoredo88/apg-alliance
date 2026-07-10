import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { T, GLASS, GLASS_GOLD } from './design.js';
import { AiProfileSection, Stars, StatCard } from './PartnerCabinetPage.jsx';
import { ExpertQRSection } from './PartnerQRSection.jsx';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, GlassSection, ProfileHero, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';
import { CabinetEventsBlock } from './EventProposalTools.jsx';
import { userAction } from './userApi.js';

import { uploadPhoto } from './utils/uploadPhoto.js';
import { normalizeExternalUrl, validateExternalUrl } from './utils/externalUrls.js';
import { shareLink } from './utils/shareLink.js';
import { buildAiProfileDraft, sanitizeAiProfile } from './aiProfile.js';
import {
  EXPERT_CATEGORIES,
  EXPERT_SOCIAL_FIELDS,
  EXPERT_TARIFFS,
  EXPERT_WORK_FORMATS,
  buildExpertAiSuggestions,
  calculateExpertProfileCompletion,
  hasPremiumExpertAccess,
  normalizeExpertVideo,
} from './expertProfileForm.js';

function splitExpertName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    lastName: parts[0] || '',
    firstName: parts[1] || parts[0] || '',
    middleName: parts.length > 2 ? parts.slice(2).join(' ') : '',
  };
}

function buildExpertForm(expert = {}) {
  const name = splitExpertName(expert.name);
  return {
    lastName: expert.lastName || name.lastName || '',
    firstName: expert.firstName || name.firstName || '',
    middleName: expert.middleName || '',
    primaryCategory: expert.primaryCategory || expert.category || '',
    secondaryCategories: Array.isArray(expert.secondaryCategories) ? expert.secondaryCategories : [],
    shortDescription: String(expert.shortDescription || expert.specialization || '').slice(0, 120),
    description: expert.description || '',
    workFormats: Array.isArray(expert.workFormats) ? expert.workFormats : Array.isArray(expert.formats) ? expert.formats : [],
    offer: expert.offer || '',
    tariff: expert.tariff || expert.tier || 'basic',
    contactName: expert.contactName || expert.managerName || '',
    phone: expert.phone || '',
    email: expert.email || '',
    inn: expert.inn || '',
    city: expert.city || '',
    websiteUrl: expert.websiteUrl || '',
    bookingUrl: expert.bookingUrl || '',
    vkUrl: expert.vkUrl || '',
    telegramUrl: expert.telegramUrl || '',
    maxUrl: expert.maxUrl || '',
    instagramUrl: expert.instagramUrl || '',
    youtubeUrl: expert.youtubeUrl || '',
    rutubeUrl: expert.rutubeUrl || '',
    comment: expert.comment || '',
    photo: expert.photo || '',
    logoUrl: expert.logoUrl || '',
    coverPhoto: expert.coverPhoto || '',
    gallery: Array.isArray(expert.gallery) ? expert.gallery.filter(Boolean) : [],
    videos: Array.isArray(expert.videos) ? expert.videos.filter(Boolean) : [],
  };
}

function getExpertReadyState(expert = {}) {
  const galleryCount = (Array.isArray(expert.gallery) ? expert.gallery : []).filter(Boolean).length;
  const videosCount  = (Array.isArray(expert.videos)  ? expert.videos  : []).filter(Boolean).length;
  const checks = [
    { key: 'photo',    label: 'добавить фото профиля',      done: Boolean(expert.photo),                                                                                    tab: 'edit' },
    { key: 'desc',     label: 'написать о себе',             done: Boolean(String(expert.description || '').trim()),                                                        tab: 'edit' },
    { key: 'spec',     label: 'указать специализацию',       done: Boolean(String(expert.specialization || '').trim()),                                                     tab: 'edit' },
    { key: 'contacts', label: 'добавить контакты / запись',  done: Boolean(expert.phone || expert.bookingUrl || expert.vkUrl || expert.telegramUrl),                       tab: 'edit' },
    { key: 'offer',    label: 'создать предложение для АПГ', done: Boolean(String(expert.offer || '').trim()),                                                              tab: 'edit' },
    { key: 'gallery',  label: 'добавить фото в галерею',     done: galleryCount >= 1,                                                                                      tab: 'content' },
    { key: 'video',    label: 'добавить видео',              done: videosCount  >= 1,                                                                                      tab: 'content' },
    { key: 'verified', label: 'получить подтверждение АПГ',  done: Boolean(expert.verified),                                                                               tab: 'start' },
  ];
  const doneCount = checks.filter(c => c.done).length;
  return { checks, percent: Math.round((doneCount / checks.length) * 100), doneCount };
}

export function ExpertCabinetPage({ nav = 'expert-cabinet', variant = 'v2', expert: initialExpert, events = [], onBack, onExpertUpdate, onEventCreated, onToast }) {
  const [expert, setExpert]       = useState(initialExpert);
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('start');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInputRef             = useRef(null);
  const logoInputRef              = useRef(null);
  const coverInputRef             = useRef(null);
  const galleryInputRef           = useRef(null);

  const [fDesc,     setFDesc]     = useState('');
  const [fOffer,    setFOffer]    = useState('');
  const [fPhone,    setFPhone]    = useState('');
  const [fBooking,  setFBooking]  = useState('');
  const [fWebsite,  setFWebsite]  = useState('');
  const [fVk,       setFVk]       = useState('');
  const [fTelegram, setFTelegram] = useState('');
  const [fMax,      setFMax]      = useState('');
  const [fPhoto,    setFPhoto]    = useState('');
  const [fAiProfile, setFAiProfile] = useState(null);
  const [form, setForm]           = useState(() => buildExpertForm(initialExpert || {}));
  const [videoUrl, setVideoUrl]   = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);

  const updateForm = (patch) => {
    setForm(prev => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (!initialExpert?.id) return;
    setLoading(true);

    Promise.all([
      getDoc(doc(db, 'experts', initialExpert.id)),
      getDocs(query(
        collection(db, 'expertReviews'),
        where('expertId', '==', initialExpert.id),
        orderBy('createdAt', 'desc'),
        limit(20),
      )).catch(() => ({ docs: [] })),
    ]).then(([eSnap, rSnap]) => {
      const e = eSnap.exists() ? { id: eSnap.id, ...eSnap.data() } : initialExpert;
      const draftKey = `apg_expert_form_draft_${initialExpert.id}`;
      let nextForm = buildExpertForm(e);
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          nextForm = { ...nextForm, ...JSON.parse(raw) };
          setDraftRestored(true);
        }
      } catch {}
      setExpert(e);
      setFDesc(e.description ?? '');
      setFOffer(e.offer ?? '');
      setFPhone(e.phone ?? '');
      setFBooking(e.bookingUrl ?? '');
      setFWebsite(e.websiteUrl ?? '');
      setFVk(e.vkUrl ?? '');
      setFTelegram(e.telegramUrl ?? '');
      setFMax(e.maxUrl ?? '');
      setFPhoto(e.photo ?? '');
      setForm(nextForm);
      setFAiProfile(sanitizeAiProfile(e.aiProfile || buildAiProfileDraft(e, 'expert')));
      setReviews(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [initialExpert?.id]);

  useEffect(() => {
    if (!expert?.id) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`apg_expert_form_draft_${expert.id}`, JSON.stringify(form));
      } catch {}
    }, 600);
    return () => clearTimeout(timer);
  }, [expert?.id, form]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { onToast?.('Файл слишком большой. Максимум 1 МБ.', 'error'); e.target.value = ''; return; }
    setUploading(true);
    try {
      const url = await uploadPhoto(file, `experts/${expert.id}`);
      setFPhoto(url);
      updateForm({ photo: url });
    } catch { onToast?.('Ошибка загрузки фото', 'error'); }
    setUploading(false);
  };

  const handleMediaUpload = async (e, field, { multi = false } = {}) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !expert?.id) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files.slice(0, multi ? 12 : 1)) {
        if (file.size > 3 * 1024 * 1024) {
          onToast?.('Файл слишком большой. Максимум 3 МБ.', 'error');
          continue;
        }
        uploaded.push(await uploadPhoto(file, `experts/${expert.id}/${field}`));
      }
      if (uploaded.length) {
        setForm(prev => ({
          ...prev,
          [field]: multi ? [...(Array.isArray(prev[field]) ? prev[field] : []), ...uploaded].slice(0, 24) : uploaded[0],
        }));
      }
    } catch {
      onToast?.('Ошибка загрузки медиа', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!expert?.id) return;
    const phone = form.phone.trim();
    if (phone && !/^[+\d()\s-]{7,16}$/.test(phone)) {
      onToast?.('Некорректный номер телефона. Пример: +7 (499) 123-45-67', 'error');
      return;
    }
    const urlFields = [
      ['Запись', form.bookingUrl, ''],
      ['Сайт', form.websiteUrl, ''],
      ...EXPERT_SOCIAL_FIELDS.map(item => [item.label, form[item.key], item.platform]),
    ];
    for (const [label, value, platform] of urlFields) {
      const result = validateExternalUrl(value, platform ? { platform } : {});
      if (!result.ok) {
        onToast?.(`${label}: ${result.error}`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const fullName = [form.lastName, form.firstName, form.middleName].map(v => String(v || '').trim()).filter(Boolean).join(' ');
      const primaryCategory = EXPERT_CATEGORIES.find(c => c.id === form.primaryCategory);
      const data = {
        name:             fullName || expert.name,
        lastName:         form.lastName.trim(),
        firstName:        form.firstName.trim(),
        middleName:       form.middleName.trim(),
        category:         form.primaryCategory,
        categoryLabel:    primaryCategory?.label || '',
        primaryCategory:  form.primaryCategory,
        secondaryCategories: form.secondaryCategories,
        specialization:   form.shortDescription.trim().slice(0, 120),
        shortDescription: form.shortDescription.trim().slice(0, 120),
        description:      form.description.trim(),
        workFormats:      form.workFormats,
        formats:          form.workFormats,
        offer:            form.offer.trim(),
        tariff:           form.tariff,
        contactName:      form.contactName.trim(),
        phone:            phone,
        email:            form.email.trim(),
        inn:              hasPremiumExpertAccess(form.tariff) ? form.inn.trim() : '',
        city:             form.city.trim(),
        websiteUrl:       normalizeExternalUrl(form.websiteUrl),
        bookingUrl:       normalizeExternalUrl(form.bookingUrl),
        vkUrl:            normalizeExternalUrl(form.vkUrl, { platform: 'vk' }),
        telegramUrl:      normalizeExternalUrl(form.telegramUrl, { platform: 'telegram' }),
        maxUrl:           normalizeExternalUrl(form.maxUrl, { platform: 'max' }),
        instagramUrl:     normalizeExternalUrl(form.instagramUrl),
        youtubeUrl:       normalizeExternalUrl(form.youtubeUrl),
        rutubeUrl:        normalizeExternalUrl(form.rutubeUrl),
        comment:          form.comment.trim(),
        photo:            form.photo.trim(),
        logoUrl:          form.logoUrl.trim(),
        coverPhoto:       form.coverPhoto.trim(),
        gallery:          form.gallery.filter(Boolean),
        videos:           form.videos.filter(Boolean),
        servicesDraftReady: true,
      };
      await userAction('expert:profileUpdate', { id: expert.id, patch: data });
      const updated = { ...expert, ...data };
      setExpert(updated);
      setFDesc(data.description);
      setFOffer(data.offer);
      setFPhone(data.phone);
      setFBooking(data.bookingUrl);
      setFWebsite(data.websiteUrl);
      setFVk(data.vkUrl);
      setFTelegram(data.telegramUrl);
      setFMax(data.maxUrl);
      setFPhoto(data.photo);
      onExpertUpdate?.(updated);
      try { localStorage.removeItem(`apg_expert_form_draft_${expert.id}`); } catch {}
      setDraftRestored(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { onToast?.('Ошибка сохранения. Попробуйте ещё раз.', 'error'); }
    setSaving(false);
  };

  const handleAiProfileSave = async (aiProfile) => {
    if (!expert?.id) return;
    await userAction('expert:profileUpdate', { id: expert.id, patch: { aiProfile } });
    const updated = { ...expert, aiProfile };
    setExpert(updated);
    setFAiProfile(aiProfile);
    onExpertUpdate?.(updated);
  };

  if (!expert) return null;

  const totalVisits    = expert.totalVisits    ?? 0;
  const publicQRScans  = expert.publicQRScans  ?? 0;
  const viewCount      = expert.viewCount      ?? 0;
  const avgRating      = expert.avgRating      ?? 0;
  const ratingCount    = expert.reviewCount    ?? reviews.length;
  const conversionPct  = viewCount > 0 ? Math.round((totalVisits / viewCount) * 100) : 0;

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
    const galleryCount  = (Array.isArray(expert.gallery) ? expert.gallery : []).filter(Boolean).length;
    const videosCount   = (Array.isArray(expert.videos)  ? expert.videos  : []).filter(Boolean).length;
    const favCount      = expert.favoritesCount ?? 0;
    const readyState    = getExpertReadyState(expert);
    const formCompletion = calculateExpertProfileCompletion(form);
    const aiSuggestions  = buildExpertAiSuggestions(form);
    const premiumAccess  = hasPremiumExpertAccess(form.tariff);
    const firstTodoIdx  = readyState.checks.findIndex(c => !c.done);
    const nextTodo      = firstTodoIdx >= 0 ? readyState.checks[firstTodoIdx] : null;
    const statusLabel   = expert.tier === 'ambassador' ? 'Амбассадор' : expert.verified ? 'Проверенный' : 'Эксперт';

    const achievements = [
      { icon: '👁',  label: 'Первый просмотр',  done: viewCount   >= 1,   need: Math.max(0, 1   - viewCount),   unit: 'просмотр' },
      { icon: '🎯',  label: 'Первый клиент',    done: totalVisits >= 1,   need: Math.max(0, 1   - totalVisits), unit: 'клиент'   },
      { icon: '⭐',  label: 'Первый отзыв',     done: ratingCount >= 1,   need: Math.max(0, 1   - ratingCount), unit: 'отзыв'    },
      { icon: '💫',  label: '100 просмотров',   done: viewCount   >= 100, need: Math.max(0, 100 - viewCount),   unit: 'просмотров' },
      { icon: '🔟',  label: '10 клиентов',      done: totalVisits >= 10,  need: Math.max(0, 10  - totalVisits), unit: 'клиентов' },
      { icon: '✅',  label: 'Подтверждён АПГ',  done: Boolean(expert.verified), need: 0, unit: '' },
    ];
    const weekGoal = achievements.find(a => !a.done && a.need > 0);

    const getLokiMsg = () => {
      if (!expert.photo)                             return { msg: 'Добавьте фото профиля — карточки с фото получают вдвое больше просмотров.', cta: 'Загрузить фото', tab: 'edit' };
      if (!String(expert.description || '').trim())  return { msg: 'Расскажите о себе и своём подходе — именно по описанию клиенты выбирают специалиста.', cta: 'Написать о себе', tab: 'edit' };
      if (!String(expert.offer || '').trim())        return { msg: 'Специальное предложение для участников АПГ поможет привлечь первых клиентов быстрее.', cta: 'Добавить предложение', tab: 'edit' };
      if (viewCount > 20 && totalVisits === 0)       return { msg: `Карточку посмотрели ${viewCount} раз, но до записи не доходят. Добавьте прямую ссылку или телефон.`, cta: 'Добавить контакты', tab: 'edit' };
      if (!videosCount)                              return { msg: 'Видео о вашей работе значительно повышает доверие клиентов и конверсию в запись.', cta: 'Перейти к контенту', tab: 'content' };
      if (!galleryCount)                             return { msg: 'Добавьте фото из вашей работы — это первое, что видят потенциальные клиенты.', cta: 'Перейти к контенту', tab: 'content' };
      if (avgRating > 0 && avgRating < 3.5)          return { msg: 'Рейтинг можно повысить — попросите довольных клиентов оставить отзыв.', cta: 'Посмотреть отзывы', tab: 'reviews' };
      if (readyState.percent === 100)                return { msg: 'Профиль полностью готов! Поддерживайте активность — ваша карточка всегда в топе.', cta: 'Посмотреть статистику', tab: 'stats' };
      return { msg: 'Заполняйте профиль шаг за шагом — каждый дополненный раздел увеличивает шансы на запись.', cta: null, tab: null };
    };
    const loki = getLokiMsg();

    return (
      <Panel id={nav}>
        <GlassPanel>
          <ScreenHeader title="Кабинет" subtitle={expert.name} kicker="Эксперт АПГ" onBack={onBack} />

          <ProfileHero
            image={fPhoto || expert.coverPhoto}
            title={expert.name}
            subtitle={expert.specialization}
            status={statusLabel}
            description={expert.offer || expert.description}
            avatar={fPhoto
              ? <img src={fPhoto} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(215,184,106,0.4)' }} />
              : <GlassBadge tone="gold">🧑‍💼</GlassBadge>}
            badges={[
              expert.tier === 'ambassador' ? '🏆 Амбассадор' : expert.verified ? '✅ Проверенный' : null,
              avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : null,
              expert.keys ? `+${expert.keys} 🗝️ за визит` : null,
            ].filter(Boolean)}
          />

          {/* Быстрые действия */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginTop: 12 }}>
            {[
              { icon: '✏️', label: 'Профиль',  action: () => setActiveTab('edit') },
              { icon: '📅', label: 'Расписание', action: () => setActiveTab('schedule') },
              { icon: '📸', label: 'Контент',  action: () => setActiveTab('content') },
              { icon: '📲', label: 'QR-код',   action: () => setActiveTab('qr') },
              { icon: '🌐', label: 'Карточка', action: () => window.open(shareLink('expert', expert.id), '_blank') },
            ].map(({ icon, label, action }) => (
              <button key={label} onClick={action} style={{
                ...APG2_PROFILE.glass, borderRadius: 22, padding: '11px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: 760, color: APG2_PROFILE.textSoft, textAlign: 'center', lineHeight: '13px' }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Навигация */}
          <GlassCard style={{ borderRadius: 28, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 12 }}>
            {[['start', 'Старт'], ['schedule', 'Расписание'], ['ai-profile', 'AI Profile'], ['stats', 'Аналитика'], ['content', 'Контент'], ['qr', 'QR'], ['reviews', 'Отзывы'], ['edit', 'Карточка']].map(([id, label]) => (
              <GlassButton key={id} onClick={() => setActiveTab(id)} tone={activeTab === id ? 'gold' : 'glass'} style={{ minHeight: 44, borderRadius: 20, color: activeTab === id ? '#17120a' : APG2_PROFILE.text }}>{label}</GlassButton>
            ))}
          </GlassCard>

          {/* ── СТАРТ ── */}
          {activeTab === 'start' && (
            <GlassSection title="Готовность профиля">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                <StatPill label="просмотров" value={viewCount} />
                <StatPill label="клиентов" value={totalVisits} tone="gold" />
                <StatPill label="рейтинг" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} />
              </div>

              <GlassCard tone="gold" style={{ borderRadius: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: '#17120a', fontSize: 18, lineHeight: '22px', fontWeight: 930 }}>
                      Профиль готов на {readyState.percent}%
                    </div>
                    <div style={{ color: 'rgba(23,18,10,0.60)', fontSize: 13, marginTop: 3 }}>
                      {readyState.doneCount} из {readyState.checks.length} шагов выполнено
                    </div>
                  </div>
                  <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(23,18,10,0.14)" strokeWidth="4" />
                    <circle
                      cx="26" cy="26" r="21" fill="none" stroke="#17120a" strokeWidth="4"
                      strokeLinecap="round" transform="rotate(-90 26 26)"
                      strokeDasharray={String(2 * Math.PI * 21)}
                      strokeDashoffset={String(2 * Math.PI * 21 * (1 - readyState.percent / 100))}
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                    <text x="26" y="31" textAnchor="middle" fontSize="12" fontWeight="900" fill="#17120a">{readyState.percent}%</text>
                  </svg>
                </div>

                <div style={{ height: 6, borderRadius: 999, background: 'rgba(23,18,10,0.14)', overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ width: `${readyState.percent}%`, height: '100%', borderRadius: 999, background: '#17120a', transition: 'width 0.8s ease' }} />
                </div>

                {nextTodo && (
                  <div style={{ background: 'rgba(255,255,255,0.30)', borderRadius: 20, padding: '10px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0, color: '#17120a' }}>▶</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: 'rgba(23,18,10,0.52)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Следующий шаг</div>
                      <div style={{ fontSize: 13, color: '#17120a', fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextTodo.label}</div>
                    </div>
                    <button onClick={() => setActiveTab(nextTodo.tab)} style={{
                      background: '#17120a', border: 'none', borderRadius: 14, padding: '6px 12px',
                      color: '#D7B86A', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                      WebkitTapHighlightColor: 'transparent',
                    }}>Сделать</button>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 6 }}>
                  {readyState.checks.map((item, idx) => (
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
                      }}>{item.done ? '✓' : String(idx + 1)}</span>
                      <span style={{ flex: 1, fontSize: 13, opacity: item.done ? 0.60 : 1, textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                      {!item.done && <span style={{ fontSize: 13, color: 'rgba(23,18,10,0.40)', flexShrink: 0 }}>→</span>}
                    </button>
                  ))}
                </div>
              </GlassCard>

              <GlassCard style={{ borderRadius: 30, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 14, background: APG2_PROFILE.goldSoft, border: '1px solid rgba(215,184,106,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🦊</div>
                  <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, letterSpacing: 0.8, textTransform: 'uppercase' }}>Локи · персональный менеджер</div>
                </div>
                <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '21px', fontWeight: 760 }}>{loki.msg}</div>
                {loki.cta && loki.tab && (
                  <GlassButton onClick={() => setActiveTab(loki.tab)} style={{ marginTop: 12, width: '100%' }}>{loki.cta}</GlassButton>
                )}
              </GlassCard>

              <GlassSection title="Достижения">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {achievements.map(a => (
                    <GlassCard key={a.label} style={{ borderRadius: 22, padding: '12px 12px', opacity: a.done ? 1 : 0.55 }}>
                      <div style={{ fontSize: 26, marginBottom: 6, filter: a.done ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
                      <div style={{ color: APG2_PROFILE.text, fontSize: 13, fontWeight: 820, lineHeight: '17px' }}>{a.label}</div>
                      {a.done
                        ? <div style={{ fontSize: 10, color: 'rgba(75,179,75,0.9)', fontWeight: 760, marginTop: 4 }}>Выполнено ✓</div>
                        : <div style={{ fontSize: 10, color: APG2_PROFILE.textMuted, marginTop: 4 }}>{a.need > 0 ? `ещё ${a.need} ${a.unit}` : 'Обратитесь к АПГ'}</div>}
                    </GlassCard>
                  ))}
                </div>
              </GlassSection>

              {weekGoal && (
                <GlassCard tone="gold" style={{ borderRadius: 26, marginTop: 4 }}>
                  <div style={{ color: 'rgba(23,18,10,0.60)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Ближайшая цель</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{weekGoal.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#17120a', fontSize: 15, fontWeight: 900 }}>{weekGoal.label}</div>
                      <div style={{ color: 'rgba(23,18,10,0.60)', fontSize: 13, marginTop: 2 }}>Ещё {weekGoal.need} {weekGoal.unit}</div>
                    </div>
                  </div>
                </GlassCard>
              )}
            </GlassSection>
          )}

          {activeTab === 'schedule' && (
            <CabinetEventsBlock
              type="expert"
              profile={expert}
              events={events}
              onToast={onToast}
              onEventCreated={onEventCreated}
            />
          )}

          {activeTab === 'ai-profile' && (
            <AiProfileSection
              type="expert"
              entity={{ ...expert, aiProfile: fAiProfile || expert.aiProfile }}
              inputStyle={v2InputStyle}
              onSave={handleAiProfileSave}
              onToast={onToast}
            />
          )}

          {/* ── АНАЛИТИКА ── */}
          {activeTab === 'stats' && (
            <GlassSection title="Аналитика">
              {loading ? (
                <EmptyStateV2 icon="📊" title="Загружаем статистику" text="Собираем данные профиля." />
              ) : totalVisits === 0 && viewCount === 0 && publicQRScans === 0 ? (
                <EmptyStateV2
                  icon="📊"
                  title="Статистика собирается"
                  text="Данные появятся после первых посещений вашей карточки участниками АПГ."
                  action={<GlassButton onClick={() => setActiveTab('qr')}>Посмотреть QR-коды</GlassButton>}
                />
              ) : (
                <>
                  <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, fontWeight: 760, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Охват</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    <StatPill label="просмотров карточки" value={viewCount} />
                    <StatPill label="в избранном" value={favCount} />
                  </div>
                  <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, fontWeight: 760, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Клиенты</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                    <StatPill label="служебный QR" value={totalVisits} tone="gold" />
                    <StatPill label="публичный QR" value={publicQRScans} />
                    <StatPill label="конверсия" value={viewCount > 0 ? `${conversionPct}%` : '—'} />
                  </div>
                  {(avgRating > 0 || ratingCount > 0) && (
                    <>
                      <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, fontWeight: 760, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Рейтинг</div>
                      <GlassCard style={{ borderRadius: 30 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ flexShrink: 0 }}>
                            <div style={{ color: APG2_PROFILE.gold, fontSize: 38, fontWeight: 930, lineHeight: 1 }}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
                            <Stars rating={avgRating} />
                            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 4 }}>{ratingCount} отзывов</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            {[5,4,3,2,1].map(star => {
                              const count = reviews.filter(r => (r.stars ?? r.rating) === star).length;
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
                    </>
                  )}
                </>
              )}
            </GlassSection>
          )}

          {/* ── КОНТЕНТ ── */}
          {activeTab === 'content' && (
            <GlassSection title="Контент">
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { icon: '📸', title: 'Фото в галерее',   count: galleryCount, unit: 'фото',   done: galleryCount >= 1 },
                  { icon: '🎬', title: 'Видео',            count: videosCount,  unit: 'видео',  done: videosCount  >= 1 },
                  { icon: '📋', title: 'Форматы работы',   count: (Array.isArray(expert.formats) ? expert.formats : []).length, unit: 'формата', done: (Array.isArray(expert.formats) ? expert.formats : []).length > 0 },
                ].map(({ icon, title, count, unit, done }) => (
                  <GlassCard key={title} style={{ borderRadius: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: 18, flexShrink: 0,
                      background: done ? 'rgba(75,179,75,0.18)' : APG2_PROFILE.goldSoft,
                      border: done ? '1px solid rgba(75,179,75,0.34)' : '1px solid rgba(215,184,106,0.25)',
                      display: 'grid', placeItems: 'center', fontSize: 24,
                    }}>
                      {done ? '✓' : icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 850 }}>{title}</div>
                      <div style={{ color: done ? 'rgba(75,179,75,0.88)' : APG2_PROFILE.textSoft, fontSize: 12, marginTop: 3 }}>
                        {count > 0 ? `${count} ${unit}` : 'Не добавлено'}
                      </div>
                    </div>
                    {count > 0 && (
                      <div style={{ background: APG2_PROFILE.goldSoft, borderRadius: 12, padding: '4px 10px', color: APG2_PROFILE.gold, fontSize: 14, fontWeight: 900, flexShrink: 0 }}>{count}</div>
                    )}
                  </GlassCard>
                ))}

                {galleryCount > 0 && (
                  <GlassCard style={{ borderRadius: 24 }}>
                    <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginBottom: 10 }}>Фото</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                      {expert.gallery.filter(Boolean).slice(0, 6).map((url, i) => (
                        <div key={i} style={{ aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: APG2_PROFILE.goldSoft }}>
                          <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>

              <GlassCard style={{ borderRadius: 24, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🦊</span>
                  <span style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, letterSpacing: 0.8, textTransform: 'uppercase' }}>Совет Локи</span>
                </div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px' }}>
                  Галерея, видео и форматы работы добавляются совместно с командой АПГ. Пришлите нам материалы, и мы их оформим и разместим.
                </div>
              </GlassCard>
            </GlassSection>
          )}

          {/* ── QR ── */}
          {activeTab === 'qr' && (
            <GlassSection title="QR-коды и материалы">
              <GlassCard style={{ borderRadius: 32 }}>
                <ExpertQRSection expert={expert} />
              </GlassCard>
            </GlassSection>
          )}

          {/* ── ОТЗЫВЫ ── */}
          {activeTab === 'reviews' && (
            <GlassSection title="Отзывы">
              {reviews.length === 0 ? (
                <EmptyStateV2 icon="⭐" title="Отзывов пока нет" text="После первых сессий здесь появятся оценки и комментарии ваших клиентов." />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {reviews.map(review => (
                    <GlassCard key={review.id} style={{ borderRadius: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 850 }}>{review.userName || 'Участник АПГ'}</div>
                        <Stars rating={review.stars ?? review.rating ?? 0} />
                      </div>
                      <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>{review.text || 'Без текста'}</div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </GlassSection>
          )}

          {/* ── КАРТОЧКА ── */}
          {activeTab === 'edit' && (
            <GlassSection title="Анкета эксперта">
              <GlassCard tone="gold" style={{ borderRadius: 32, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: '#17120a', fontSize: 20, fontWeight: 930 }}>Заполнено: {formCompletion}%</div>
                    <div style={{ color: 'rgba(23,18,10,0.62)', fontSize: 12, marginTop: 4 }}>{draftRestored ? 'Черновик восстановлен автоматически.' : 'Черновик сохраняется автоматически на устройстве.'}</div>
                  </div>
                  <GlassBadge style={{ color: '#17120a', background: 'rgba(255,255,255,0.28)' }}>{EXPERT_TARIFFS.find(t => t.id === form.tariff)?.label || 'Базовый'}</GlassBadge>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(23,18,10,0.15)', overflow: 'hidden' }}>
                  <div style={{ width: `${formCompletion}%`, height: '100%', borderRadius: 999, background: '#17120a', transition: 'width 0.35s ease' }} />
                </div>
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>1. Основная информация</GlassBadge>
                {[
                  ['Фамилия', 'lastName', 'Иванов'],
                  ['Имя', 'firstName', 'Иван'],
                  ['Отчество (необязательно)', 'middleName', 'Иванович'],
                ].map(([label, key, ph]) => (
                  <React.Fragment key={key}>
                    <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{label}</label>
                    <input value={form[key]} onChange={e => updateForm({ [key]: e.target.value })} placeholder={ph} style={{ ...v2InputStyle, marginTop: 6 }} />
                  </React.Fragment>
                ))}
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>2. Направление деятельности</GlassBadge>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Основная категория</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0 14px' }}>
                  {EXPERT_CATEGORIES.map(category => (
                    <GlassButton key={category.id} onClick={() => updateForm({ primaryCategory: category.id })} tone={form.primaryCategory === category.id ? 'gold' : 'glass'} style={{ minHeight: 42, borderRadius: 18, color: form.primaryCategory === category.id ? '#17120a' : APG2_PROFILE.text }}>{category.label}</GlassButton>
                  ))}
                </div>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Дополнительные категории</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {EXPERT_CATEGORIES.filter(c => c.id !== form.primaryCategory).map(category => {
                    const active = form.secondaryCategories.includes(category.id);
                    return <GlassButton key={category.id} onClick={() => updateForm({ secondaryCategories: active ? form.secondaryCategories.filter(id => id !== category.id) : [...form.secondaryCategories, category.id] })} tone={active ? 'gold' : 'glass'} style={{ minHeight: 36, borderRadius: 999, padding: '7px 11px', color: active ? '#17120a' : APG2_PROFILE.text }}>{category.label}</GlassButton>;
                  })}
                </div>
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>3. Описание</GlassBadge>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Короткое описание · до 120 символов</label>
                <input value={form.shortDescription} maxLength={120} onChange={e => updateForm({ shortDescription: e.target.value.slice(0, 120) })} placeholder="Юрист, психолог, финансовый консультант..." style={{ ...v2InputStyle, marginTop: 6 }} />
                <div style={{ textAlign: 'right', color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: -8, marginBottom: 8 }}>{form.shortDescription.length}/120</div>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Подробное описание</label>
                <textarea value={form.description} onChange={e => updateForm({ description: e.target.value })} rows={7} style={{ ...v2InputStyle, resize: 'vertical', marginTop: 6 }} placeholder="С кем работаете. Какие задачи решаете. Чем будете полезны пользователям АПГ." />
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>4. Форматы работы</GlassBadge>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {EXPERT_WORK_FORMATS.map(item => {
                    const active = form.workFormats.includes(item.id);
                    return <GlassButton key={item.id} onClick={() => updateForm({ workFormats: active ? form.workFormats.filter(id => id !== item.id) : [...form.workFormats, item.id] })} tone={active ? 'gold' : 'glass'} style={{ minHeight: 42, borderRadius: 18, color: active ? '#17120a' : APG2_PROFILE.text }}>{active ? '☑ ' : '☐ '}{item.label}</GlassButton>;
                  })}
                </div>
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>5. Специальное предложение</GlassBadge>
                <textarea value={form.offer} onChange={e => updateForm({ offer: e.target.value })} rows={3} style={{ ...v2InputStyle, resize: 'vertical' }} placeholder="Скидка, бесплатная консультация, подарок, бонус или сертификат для пользователей АПГ." />
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>6. Тариф и доступы</GlassBadge>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  {EXPERT_TARIFFS.map(tariff => (
                    <GlassButton key={tariff.id} onClick={() => updateForm({ tariff: tariff.id })} tone={form.tariff === tariff.id ? 'gold' : 'glass'} style={{ minHeight: 42, borderRadius: 18, color: form.tariff === tariff.id ? '#17120a' : APG2_PROFILE.text }}>{tariff.label}</GlassButton>
                  ))}
                </div>
                {premiumAccess ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <GlassBadge>Новости доступны</GlassBadge>
                    <GlassBadge>Мероприятия доступны</GlassBadge>
                    <GlassBadge>Реквизиты доступны</GlassBadge>
                  </div>
                ) : (
                  <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>Блоки новостей, мероприятий и ИНН доступны только тарифам Премиум и Амбассадор.</div>
                )}
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>7. Контакты и город</GlassBadge>
                {[
                  ['Контактное лицо', 'contactName', 'Имя ответственного'],
                  ['Телефон', 'phone', '+7 (499) 123-45-67'],
                  ['Email', 'email', 'expert@example.ru'],
                  ['Город (необязательно)', 'city', 'Зеленоград'],
                ].map(([label, key, ph]) => (
                  <React.Fragment key={key}>
                    <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{label}</label>
                    <input value={form[key]} onChange={e => updateForm({ [key]: e.target.value })} placeholder={ph} style={{ ...v2InputStyle, marginTop: 6 }} />
                  </React.Fragment>
                ))}
                {premiumAccess && (
                  <>
                    <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>ИНН</label>
                    <input value={form.inn} onChange={e => updateForm({ inn: e.target.value })} placeholder="ИНН для документов" style={{ ...v2InputStyle, marginTop: 6 }} />
                  </>
                )}
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>8. Ссылки и соцсети</GlassBadge>
                {[
                  ['Сайт', 'websiteUrl', 'https://...'],
                  ['Онлайн-запись', 'bookingUrl', 'https://...'],
                ].map(([label, key, ph]) => (
                  <React.Fragment key={key}>
                    <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{label}</label>
                    <input value={form[key]} onChange={e => updateForm({ [key]: e.target.value })} placeholder={ph} style={{ ...v2InputStyle, marginTop: 6 }} />
                  </React.Fragment>
                ))}
                {EXPERT_SOCIAL_FIELDS.map(item => (
                  <React.Fragment key={item.key}>
                    <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{item.label}</label>
                    <input value={form[item.key]} onChange={e => updateForm({ [item.key]: e.target.value })} placeholder={item.placeholder} style={{ ...v2InputStyle, marginTop: 6 }} />
                  </React.Fragment>
                ))}
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>9. Видео</GlassBadge>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '18px', marginBottom: 10 }}>Поддерживаются YouTube, VK Видео, RuTube и MAX. Можно добавить несколько ссылок.</div>
                <input value={videoTitle} onChange={e => setVideoTitle(e.target.value)} placeholder="Название видео" style={v2InputStyle} />
                <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/... или https://rutube.ru/..." style={v2InputStyle} />
                <GlassButton onClick={() => {
                  const video = normalizeExpertVideo(videoUrl, videoTitle);
                  if (!video) return;
                  updateForm({ videos: [...form.videos, video].slice(0, 12) });
                  setVideoUrl('');
                  setVideoTitle('');
                }} style={{ width: '100%', marginBottom: 10 }}>Добавить видео</GlassButton>
                <div style={{ display: 'grid', gap: 8 }}>
                  {form.videos.map((video, index) => (
                    <GlassCard key={`${video.url}-${index}`} style={{ borderRadius: 18, padding: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: APG2_PROFILE.text, fontSize: 13, fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title || video.url}</div>
                        <div style={{ color: APG2_PROFILE.gold, fontSize: 11, marginTop: 2 }}>{video.platformLabel || video.platform}</div>
                      </div>
                      <GlassButton onClick={() => updateForm({ videos: form.videos.filter((_, i) => i !== index) })} style={{ minHeight: 34, borderRadius: 14, padding: '6px 10px' }}>Удалить</GlassButton>
                    </GlassCard>
                  ))}
                </div>
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>10. Медиа</GlassBadge>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '18px', marginBottom: 12 }}>Фото профиля: 800×800. Логотип: 512×512. Обложка: 1600×900. Галерея: от 1200 px по ширине.</div>
                {[
                  ['Фото профиля', 'photo', photoInputRef, false],
                  ['Логотип', 'logoUrl', logoInputRef, false],
                  ['Горизонтальная обложка карточки', 'coverPhoto', coverInputRef, false],
                ].map(([label, key, ref]) => (
                  <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ width: 58, height: 46, borderRadius: 16, overflow: 'hidden', background: APG2_PROFILE.goldSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {form[key] ? <img src={form[key]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '＋'}
                    </div>
                    <div style={{ flex: 1, color: APG2_PROFILE.text, fontSize: 13, fontWeight: 820 }}>{label}</div>
                    <input ref={ref} type="file" accept="image/*" onChange={e => key === 'photo' ? handlePhotoUpload(e) : handleMediaUpload(e, key)} style={{ display: 'none' }} />
                    <GlassButton onClick={() => ref.current?.click()} style={{ minHeight: 38, borderRadius: 16, padding: '7px 12px' }}>{uploading ? '...' : 'Загрузить'}</GlassButton>
                  </div>
                ))}
                <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={e => handleMediaUpload(e, 'gallery', { multi: true })} style={{ display: 'none' }} />
                <GlassButton onClick={() => galleryInputRef.current?.click()} style={{ width: '100%', marginBottom: 10 }}>Добавить фото в галерею</GlassButton>
                {!!form.gallery.length && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {form.gallery.map((url, index) => (
                      <div key={`${url}-${index}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: APG2_PROFILE.goldSoft }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => updateForm({ gallery: form.gallery.filter((_, i) => i !== index) })} style={{ position: 'absolute', top: 5, right: 5, border: 0, borderRadius: 999, width: 24, height: 24, background: 'rgba(0,0,0,0.55)', color: '#fff' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>11. Комментарий</GlassBadge>
                <textarea value={form.comment} onChange={e => updateForm({ comment: e.target.value })} rows={3} style={{ ...v2InputStyle, resize: 'vertical' }} placeholder="Внутренний комментарий для команды АПГ или модерации." />
              </GlassCard>

              <GlassCard style={{ borderRadius: 32, marginBottom: 12 }}>
                <GlassBadge tone="gold" style={{ marginBottom: 12 }}>AI-помощник анкеты</GlassBadge>
                <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '21px', fontWeight: 760, marginBottom: 10 }}>SEO-заголовок: {aiSuggestions.seoTitle}</div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px', marginBottom: 10 }}>Краткое описание: {aiSuggestions.shortDescription}</div>
                {aiSuggestions.missing.length ? (
                  <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px' }}>Не хватает: {aiSuggestions.missing.join(', ')}.</div>
                ) : (
                  <div style={{ color: 'rgba(75,179,75,0.9)', fontSize: 13, fontWeight: 820 }}>Основные поля заполнены.</div>
                )}
                <GlassButton onClick={() => updateForm({ description: aiSuggestions.improvedDescription, shortDescription: aiSuggestions.shortDescription })} style={{ width: '100%', marginTop: 12 }}>Улучшить описание AI</GlassButton>
              </GlassCard>

              <GlassButton onClick={handleSave} tone="gold" style={{ width: '100%', color: '#17120a', marginTop: 4 }}>
                {saving ? 'Сохраняем...' : saved ? '✓ Сохранено' : 'Сохранить анкету'}
              </GlassButton>
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
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🧑‍💼 {expert.name}</div>
            <div style={{ fontSize: 10, color: T.gold, marginTop: 1 }}>Личный кабинет эксперта</div>
          </div>
        </div>
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

        {/* ── СТАТИСТИКА ── */}
        {activeTab === 'stats' && (
          <>
            <div style={{ ...GLASS_GOLD, borderRadius: 24, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, overflow: 'hidden' }}>
                {fPhoto
                  ? <img src={fPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : '🧑‍💼'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>{expert.name}</div>
                {expert.specialization && <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{expert.specialization}</div>}
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
                  <StatCard icon="🎯" label="Конверсия" color={T.green}
                    value={viewCount > 0 ? `${conversionPct}%` : '—'}
                    sub={viewCount > 0 ? 'просмотр → скан' : 'пока нет данных'}
                  />
                  {(avgRating > 0 || ratingCount > 0) && (
                    <StatCard icon="⭐" label="Средняя оценка" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} color="#FFD700" sub={`${ratingCount} отзывов`} />
                  )}
                </div>

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
                    <div style={{ color: T.textSec, fontSize: 12, lineHeight: '18px' }}>Данные появятся после первых посещений вашей карточки участниками АПГ</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── QR-КОДЫ ── */}
        {activeTab === 'qr' && (
          <div style={{ ...GLASS, borderRadius: 24, padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 14 }}>📲 QR-коды эксперта</div>
            <ExpertQRSection expert={expert} />
          </div>
        )}

        {/* ── РЕДАКТИРОВАНИЕ ── */}
        {activeTab === 'edit' && (
          <>
            {/* Фото */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...GLASS, borderRadius: 20, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0, overflow: 'hidden' }}>
                {fPhoto
                  ? <img src={fPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : '🧑‍💼'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 6 }}>Фото профиля</div>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => photoInputRef.current?.click()} disabled={uploading}
                    style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.chipBg, color: T.textPri, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
                    {uploading ? 'Загрузка...' : '📷 Загрузить фото'}
                  </button>
                  {fPhoto && (
                    <button onClick={() => setFPhoto('')} style={{ padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(230,70,70,0.3)', background: 'rgba(230,70,70,0.08)', color: '#E64646', fontSize: 11, cursor: 'pointer' }}>
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            </div>

            <label style={labelStyle}>О себе</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              placeholder="Расскажите о своей деятельности, опыте, подходе к работе..."
              value={fDesc} onChange={e => setFDesc(e.target.value)} />

            <label style={labelStyle}>🎁 Спецпредложение для участников АПГ</label>
            <input style={inputStyle} placeholder="Скидка 10% на первую консультацию" value={fOffer} onChange={e => setFOffer(e.target.value)} />

            <label style={labelStyle}>📞 Телефон</label>
            <input style={inputStyle} placeholder="+7 (499) 123-45-67" value={fPhone} onChange={e => setFPhone(e.target.value)} />

            <label style={labelStyle}>📅 Ссылка для записи</label>
            <input style={inputStyle} placeholder="https://..." value={fBooking} onChange={e => setFBooking(e.target.value)} />

            <label style={labelStyle}>🌐 Сайт</label>
            <input style={inputStyle} placeholder="https://..." value={fWebsite} onChange={e => setFWebsite(e.target.value)} />

            <label style={labelStyle}>🔵 ВКонтакте</label>
            <input style={inputStyle} placeholder="https://vk.com/..." value={fVk} onChange={e => setFVk(e.target.value)} />

            <label style={labelStyle}>✈️ Telegram</label>
            <input style={inputStyle} placeholder="https://t.me/..." value={fTelegram} onChange={e => setFTelegram(e.target.value)} />

            <label style={labelStyle}>💬 Max</label>
            <input style={inputStyle} placeholder="https://..." value={fMax} onChange={e => setFMax(e.target.value)} />

            <button onClick={handleSave} disabled={saving} style={{
              width: '100%', padding: '15px 0', borderRadius: 16, border: 'none',
              background: saved ? 'rgba(75,179,75,0.2)' : `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
              color: saved ? T.green : '#0F0F1A',
              fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1, transition: 'all 0.25s',
              outline: saved ? '1px solid rgba(75,179,75,0.4)' : 'none',
            }}>
              {saving ? 'Сохраняем...' : saved ? '✓ Сохранено!' : 'Сохранить изменения'}
            </button>

            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px' }}>
                💡 Имя, специализация, количество ключей и категория управляются администратором АПГ. По всем вопросам пишите нам.
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
