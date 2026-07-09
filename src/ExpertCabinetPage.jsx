import React, { useState, useEffect, useRef } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { T, GLASS, GLASS_GOLD } from './design.js';
import { APP_URL } from './constants.js';
import { Stars, StatCard } from './PartnerCabinetPage.jsx';
import { ExpertQRSection } from './PartnerQRSection.jsx';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, GlassSection, ProfileHero, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';
import { userAction } from './userApi.js';

import { uploadPhoto } from './utils/uploadPhoto.js';
import { normalizeExternalUrl, validateExternalUrl } from './utils/externalUrls.js';

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

export function ExpertCabinetPage({ nav = 'expert-cabinet', variant = 'v2', expert: initialExpert, onBack, onExpertUpdate }) {
  const [expert, setExpert]       = useState(initialExpert);
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('start');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInputRef             = useRef(null);

  const [fDesc,     setFDesc]     = useState('');
  const [fOffer,    setFOffer]    = useState('');
  const [fPhone,    setFPhone]    = useState('');
  const [fBooking,  setFBooking]  = useState('');
  const [fWebsite,  setFWebsite]  = useState('');
  const [fVk,       setFVk]       = useState('');
  const [fTelegram, setFTelegram] = useState('');
  const [fMax,      setFMax]      = useState('');
  const [fPhoto,    setFPhoto]    = useState('');

  useEffect(() => {
    if (!initialExpert?.id) return;
    setLoading(true);

    Promise.all([
      getDoc(doc(db, 'experts', initialExpert.id)),
      getDocs(query(
        collection(db, 'experts', initialExpert.id, 'reviews'),
        orderBy('createdAt', 'desc'),
        limit(20),
      )).catch(() => ({ docs: [] })),
    ]).then(([eSnap, rSnap]) => {
      const e = eSnap.exists() ? { id: eSnap.id, ...eSnap.data() } : initialExpert;
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
      setReviews(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [initialExpert?.id]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { alert('Файл слишком большой. Максимум 1 МБ.'); e.target.value = ''; return; }
    setUploading(true);
    try {
      const url = await uploadPhoto(file, `experts/${expert.id}`);
      setFPhoto(url);
    } catch { alert('Ошибка загрузки фото'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!expert?.id) return;
    const phone = fPhone.trim();
    if (phone && !/^[+\d()\s-]{7,16}$/.test(phone)) {
      alert('Некорректный формат номера телефона.\nПример: +7 (499) 123-45-67');
      return;
    }
    const urlFields = [
      ['Запись', fBooking, ''],
      ['Сайт', fWebsite, ''],
      ['VK', fVk, 'vk'],
      ['Telegram', fTelegram, 'telegram'],
      ['Max', fMax, 'max'],
    ];
    for (const [label, value, platform] of urlFields) {
      const result = validateExternalUrl(value, platform ? { platform } : {});
      if (!result.ok) {
        alert(`${label}: ${result.error}`);
        return;
      }
    }
    setSaving(true);
    try {
      const data = {
        description:      fDesc.trim(),
        offer:            fOffer.trim(),
        phone:            phone,
        bookingUrl:       normalizeExternalUrl(fBooking),
        websiteUrl:       normalizeExternalUrl(fWebsite),
        vkUrl:            normalizeExternalUrl(fVk, { platform: 'vk' }),
        telegramUrl:      normalizeExternalUrl(fTelegram, { platform: 'telegram' }),
        maxUrl:           normalizeExternalUrl(fMax, { platform: 'max' }),
        photo:            fPhoto.trim(),
      };
      await userAction('expert:profileUpdate', { id: expert.id, patch: data });
      const updated = { ...expert, ...data };
      setExpert(updated);
      onExpertUpdate?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { alert('Ошибка сохранения'); }
    setSaving(false);
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
              { icon: '📸', label: 'Контент',  action: () => setActiveTab('content') },
              { icon: '📲', label: 'QR-код',   action: () => setActiveTab('qr') },
              { icon: '🌐', label: 'Карточка', action: () => window.open(`${APP_URL}/?expert=${expert.id}`, '_blank') },
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
            {[['start', 'Старт'], ['stats', 'Аналитика'], ['content', 'Контент'], ['qr', 'QR'], ['reviews', 'Отзывы'], ['edit', 'Карточка']].map(([id, label]) => (
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
            <GlassSection title="Карточка эксперта">
              <GlassCard style={{ borderRadius: 32 }}>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Фото профиля</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 14px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: APG2_PROFILE.goldSoft, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {fPhoto ? <img src={fPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍💼'}
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  <GlassButton onClick={() => photoInputRef.current?.click()}>{uploading ? 'Загрузка...' : 'Загрузить'}</GlassButton>
                </div>

                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>О себе</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={4} style={{ ...v2InputStyle, resize: 'vertical', marginTop: 6 }} placeholder="Расскажите о своей деятельности, опыте, подходе к работе..." />

                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Предложение для участников АПГ</label>
                <textarea value={fOffer} onChange={e => setFOffer(e.target.value)} rows={3} style={{ ...v2InputStyle, resize: 'vertical', marginTop: 6 }} placeholder="Скидка 10% на первую консультацию" />

                {[
                  ['Телефон',       fPhone,    setFPhone,    '+7 (499) 123-45-67'],
                  ['Ссылка для записи', fBooking, setFBooking, 'https://...'],
                  ['Сайт',          fWebsite,  setFWebsite,  'https://...'],
                  ['ВКонтакте',     fVk,       setFVk,       'https://vk.com/...'],
                  ['Telegram',      fTelegram, setFTelegram, 'https://t.me/...'],
                  ['Max',           fMax,      setFMax,      'https://...'],
                ].map(([label, value, setter, ph]) => (
                  <React.Fragment key={label}>
                    <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{label}</label>
                    <input value={value} onChange={e => setter(e.target.value)} placeholder={ph} style={{ ...v2InputStyle, marginTop: 6 }} />
                  </React.Fragment>
                ))}

                <GlassButton onClick={handleSave} tone="gold" style={{ width: '100%', color: '#17120a', marginTop: 4 }}>
                  {saving ? 'Сохраняем...' : saved ? '✓ Сохранено' : 'Сохранить изменения'}
                </GlassButton>

                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(215,184,106,0.07)', border: '1px solid rgba(215,184,106,0.18)', borderRadius: 16 }}>
                  <div style={{ fontSize: 11, color: APG2_PROFILE.textMuted, lineHeight: '17px' }}>
                    💡 Имя, специализация, ключи и категории управляются администратором АПГ.
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
