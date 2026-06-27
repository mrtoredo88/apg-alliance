import React, { useState, useEffect, useRef } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { T, GLASS, GLASS_GOLD } from './design.js';
import { APP_URL } from './constants.js';

const IMGBB_KEY = '0c37a46d4e13e9a30cddb1c79c8e6374';

async function uploadToImgBB(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
  const json = await res.json();
  if (!json.success) throw new Error('ImgBB error');
  return json.data.url;
}

function Stars({ rating }) {
  const r = Math.round(rating ?? 0);
  return <span style={{ color: '#FFD700', letterSpacing: 0.5 }}>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span>;
}

function StatCard({ icon, label, value, sub, color }) {
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

export function PartnerCabinetPage({ nav = 'partner-cabinet', partner: initialPartner, expert, onBack, onPartnerUpdate }) {
  const [partner, setPartner]     = useState(initialPartner);
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('stats');
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
      setReviews(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [initialPartner?.id]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('Файл слишком большой. Максимум 1 МБ.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToImgBB(file);
      setFLogo(url);
    } catch { alert('Ошибка загрузки фото'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!partner?.id) return;
    const phone = fPhone.trim();
    if (phone && !/^[+\d()\s\-]{7,16}$/.test(phone)) {
      alert('Некорректный формат номера телефона.\nПример: +7 (999) 123-45-67');
      return;
    }
    setSaving(true);
    try {
      const data = {
        description:      fDesc.trim(),
        offer:            fOffer.trim(),
        phone:            fPhone.trim(),
        hours:            fHours.trim(),
        socialUrl:        fSocial.trim(),
        logoUrl:          fLogo.trim(),
        profileUpdatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'partners', partner.id), data);
      const updated = { ...partner, ...data };
      setPartner(updated);
      onPartnerUpdate?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { alert('Ошибка сохранения'); }
    setSaving(false);
  };

  if (!partner) return null;

  const totalVisits    = partner.totalVisits ?? 0;
  const viewCount      = partner.viewCount ?? 0;
  const favoritesCount = partner.favoritesCount ?? 0;
  const avgRating      = partner.avgRating ?? 0;
  const ratingCount    = partner.reviewCount ?? reviews.length;
  const conversionPct  = viewCount > 0 ? Math.round((totalVisits / viewCount) * 100) : 0;

  const inputStyle = {
    width: '100%', padding: '11px 13px', borderRadius: 12,
    border: `1px solid ${T.border}`,
    background: T.chipBg, color: T.textPri,
    fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12,
  };
  const labelStyle = { fontSize: 12, color: T.textSec, marginBottom: 5, display: 'block', fontWeight: 600 };

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
          {[['stats', '📊 Статистика'], ['edit', '✏️ Карточка']].map(([id, label]) => (
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
                  <StatCard icon="📲" label="QR-сканирований" value={totalVisits} color={T.gold} />
                  <StatCard icon="👁" label="Просмотров карточки" value={viewCount} color={T.blue} />
                  <StatCard icon="❤️" label="В избранном" value={favoritesCount} color="#E64646" />
                  <StatCard
                    icon="🎯" label="Конверсия" color={T.green}
                    value={viewCount > 0 ? `${conversionPct}%` : '—'}
                    sub={viewCount > 0 ? 'просмотр → скан' : 'пока нет данных'}
                  />
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

            <label style={labelStyle}>🔗 Соцсеть / сайт</label>
            <input style={inputStyle} placeholder="https://vk.com/mypage" value={fSocial} onChange={e => setFSocial(e.target.value)} />

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
