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

export function ExpertCabinetPage({ nav = 'expert-cabinet', variant = 'v2', expert: initialExpert, onBack, onExpertUpdate }) {
  const [expert, setExpert]       = useState(initialExpert);
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('stats');
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
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.07)', color: APG2_PROFILE.text,
    fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12,
  };

  if (variant === 'v2') {
    return (
      <Panel id={nav}>
        <GlassPanel>
          <ScreenHeader title="Кабинет" subtitle={expert.name} kicker="Эксперт АПГ" onBack={onBack} />
          <ProfileHero
            image={fPhoto}
            title={expert.name}
            subtitle={expert.specialization}
            status="Эксперт"
            description={expert.offer || expert.description}
            avatar={fPhoto ? <img src={fPhoto} alt="" style={{ width: 64, height: 64, borderRadius: 24, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.24)' }} /> : <GlassBadge tone="gold">🧑‍💼</GlassBadge>}
            badges={[expert.premium ? 'Premium' : 'Проверенный', avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : `${ratingCount} отзывов`].filter(Boolean)}
          />
          <GlassCard style={{ borderRadius: 28, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 16 }}>
            {[['stats', 'Статистика'], ['qr', 'QR'], ['edit', 'Карточка']].map(([id, label]) => (
              <GlassButton key={id} onClick={() => setActiveTab(id)} tone={activeTab === id ? 'gold' : 'glass'} style={{ minHeight: 44, borderRadius: 20, color: activeTab === id ? '#17120a' : APG2_PROFILE.text }}>{label}</GlassButton>
            ))}
          </GlassCard>

          {activeTab === 'stats' && (
            <GlassSection title="Метрики">
              {loading ? <EmptyStateV2 icon="📊" title="Загружаем статистику" text="Собираем данные карточки эксперта." /> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <StatPill label="служебный QR" value={totalVisits} tone="gold" />
                    <StatPill label="публичный QR" value={publicQRScans} />
                    <StatPill label="просмотров" value={viewCount} />
                    <StatPill label="конверсия" value={viewCount > 0 ? `${conversionPct}%` : '—'} />
                  </div>
                  {(avgRating > 0 || ratingCount > 0) && (
                    <GlassCard style={{ marginTop: 12, borderRadius: 30 }}>
                      <div style={{ color: APG2_PROFILE.gold, fontSize: 34, fontWeight: 930 }}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
                      <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13 }}>{ratingCount} отзывов</div>
                    </GlassCard>
                  )}
                </>
              )}
            </GlassSection>
          )}

          {activeTab === 'qr' && (
            <GlassSection title="QR-коды и материалы">
              <GlassCard style={{ borderRadius: 32 }}>
                <ExpertQRSection expert={expert} />
              </GlassCard>
            </GlassSection>
          )}

          {activeTab === 'edit' && (
            <GlassSection title="Карточка эксперта">
              <GlassCard style={{ borderRadius: 32 }}>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Фото</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 14px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 24, background: APG2_PROFILE.goldSoft, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{fPhoto ? <img src={fPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍💼'}</div>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  <GlassButton onClick={() => photoInputRef.current?.click()}>{uploading ? 'Загрузка...' : 'Загрузить'}</GlassButton>
                </div>
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Описание</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={4} style={{ ...v2InputStyle, resize: 'vertical', marginTop: 6 }} />
                <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Акция / предложение</label>
                <textarea value={fOffer} onChange={e => setFOffer(e.target.value)} rows={3} style={{ ...v2InputStyle, resize: 'vertical', marginTop: 6 }} />
                {[['Телефон', fPhone, setFPhone], ['Запись', fBooking, setFBooking], ['Сайт', fWebsite, setFWebsite], ['VK', fVk, setFVk], ['Telegram', fTelegram, setFTelegram], ['MAX', fMax, setFMax]].map(([label, value, setter]) => (
                  <React.Fragment key={label}>
                    <label style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{label}</label>
                    <input value={value} onChange={e => setter(e.target.value)} style={{ ...v2InputStyle, marginTop: 6 }} />
                  </React.Fragment>
                ))}
                <GlassButton onClick={handleSave} tone="gold" style={{ width: '100%', color: '#17120a' }}>{saving ? 'Сохраняем...' : saved ? 'Сохранено' : 'Сохранить изменения'}</GlassButton>
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
