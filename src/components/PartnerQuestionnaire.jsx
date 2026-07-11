import React, { useState } from 'react';
import { PARTNER_CATEGORIES, PARTNER_TARIFFS, hasPartnerAllianceAccess, hasPartnerPremiumAccess, normalizePartnerTariff } from '../tariffConfig.js';
import { normalizeExpertVideo } from '../expertProfileForm.js';
import { parseVideoUrl } from '../utils/parseVideoUrl.js';

function Hint({ children }) {
  return <div style={{ marginTop: 5, color: 'rgba(25,23,19,0.52)', fontSize: 11.5, lineHeight: '17px' }}>{children}</div>;
}

function Field({ label, hint, error, children }) {
  return <label style={{ display: 'block' }}><span style={{ display: 'block', margin: '13px 0 7px', fontSize: 12, fontWeight: 850, color: error ? '#b91c1c' : 'rgba(25,23,19,0.65)' }}>{label}</span>{children}{hint && <Hint>{hint}</Hint>}{error && <div style={{ marginTop: 5, color: '#b91c1c', fontSize: 11.5 }}>{error}</div>}</label>;
}

function Section({ id, title, subtitle, open, onToggle, children }) {
  return <section style={{ marginTop: 12, borderRadius: 20, border: '1px solid rgba(25,23,19,0.10)', background: 'rgba(255,255,255,0.44)', overflow: 'hidden' }}>
    <button type="button" onClick={() => onToggle(id)} style={{ width: '100%', border: 0, background: 'transparent', padding: 15, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 930, color: '#191713' }}>{title}</span><span style={{ display: 'block', marginTop: 3, fontSize: 11.5, lineHeight: '17px', color: 'rgba(25,23,19,0.54)' }}>{subtitle}</span></span>
      <span style={{ color: '#80651e', fontWeight: 900 }}>{open ? '−' : '+'}</span>
    </button>
    {open && <div style={{ padding: '0 15px 16px' }}>{children}</div>}
  </section>;
}

function inputStyle(error = false) {
  return { width: '100%', minHeight: 48, border: `1px solid ${error ? 'rgba(185,28,28,0.48)' : 'rgba(25,23,19,0.12)'}`, borderRadius: 16, background: 'rgba(255,255,255,0.74)', color: '#191713', font: 'inherit', fontSize: 15, outline: 'none', padding: '0 13px', boxSizing: 'border-box' };
}

function textareaStyle(height = 112) {
  return { ...inputStyle(), minHeight: height, padding: 13, resize: 'vertical', lineHeight: '21px' };
}

function listValue(value) {
  return Array.isArray(value) ? value : [];
}

function validateVideo(value) {
  const normalized = normalizeExpertVideo(value);
  if (!normalized) return null;
  if (normalized.platform === 'max') return normalized;
  return parseVideoUrl(normalized.url) ? normalized : null;
}

function completion(fields, files, tariff) {
  const checks = [
    Boolean(fields.title?.trim()),
    Boolean(fields.category),
    Boolean(fields.shortDescription?.trim()),
    Boolean(fields.description?.trim()),
    Boolean(fields.offer?.trim()),
    Boolean(fields.contactName?.trim()),
    Boolean(fields.phone?.trim()),
    Boolean(fields.email?.trim()),
    Boolean(files.some(file => ['logo', 'main'].includes(file.role) && file.url)),
    Boolean(files.some(file => file.role === 'cover' && file.url)),
    !hasPartnerAllianceAccess(tariff) || Boolean(fields.bookingUrl?.trim() || fields.website?.trim()),
    !hasPartnerPremiumAccess(tariff) || Boolean(fields.newsInfo?.trim() || fields.activities?.trim()),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function PartnerQuestionnaire({ fields, files, onField, onFiles, uploading }) {
  const [open, setOpen] = useState({ tariff: true, main: true, offer: true, media: false, contacts: false, premium: false, comment: false });
  const [videoInput, setVideoInput] = useState('');
  const [videoError, setVideoError] = useState('');
  const tariff = normalizePartnerTariff(fields.tariff);
  const alliance = hasPartnerAllianceAccess(tariff);
  const premium = hasPartnerPremiumAccess(tariff);
  const fieldErrors = {
    phone: fields.phone && !/^\+?[\d\s()-]{10,20}$/.test(fields.phone) ? 'Проверьте номер телефона.' : '',
    email: fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ? 'Проверьте email.' : '',
    website: fields.website && !/^https?:\/\/|^[a-z0-9.-]+\.[a-z]{2,}/i.test(fields.website) ? 'Проверьте ссылку.' : '',
    bookingUrl: fields.bookingUrl && !/^https?:\/\/|^[a-z0-9.-]+\.[a-z]{2,}/i.test(fields.bookingUrl) ? 'Проверьте ссылку записи.' : '',
  };
  const toggle = id => setOpen(prev => ({ ...prev, [id]: !prev[id] }));
  const addVideo = () => {
    const video = validateVideo(videoInput);
    if (!video) { setVideoError('Поддерживаются публичные ссылки YouTube, VK Видео, Rutube и MAX.'); return; }
    onField('videos', [...listValue(fields.videos), video]); setVideoInput(''); setVideoError('');
  };

  return <>
    <div style={{ position: 'sticky', top: 8, zIndex: 20, marginBottom: 12, padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(201,168,76,0.30)', boxShadow: '0 10px 30px rgba(31,28,18,0.10)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, fontWeight: 850 }}><span>Заполненность анкеты</span><span style={{ color: '#80651e' }}>{completion(fields, files, tariff)}%</span></div>
      <div style={{ marginTop: 8, height: 7, borderRadius: 99, background: 'rgba(25,23,19,0.08)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${completion(fields, files, tariff)}%`, background: 'linear-gradient(90deg,#C9A84C,#E8C97A)', transition: 'width 220ms ease' }} /></div>
      <Hint>Черновик сохраняется автоматически на этом устройстве.</Hint>
    </div>

    <Section id="tariff" title="1. Тариф" subtitle="Выберите тариф — лишние поля исчезнут из анкеты" open={open.tariff} onToggle={toggle}>
      <div style={{ display: 'grid', gap: 9 }}>{PARTNER_TARIFFS.map(item => {
        const active = tariff === item.id;
        return <button key={item.id} type="button" onClick={() => onField('tariff', item.id)} style={{ padding: 13, borderRadius: 15, border: `1px solid ${active ? 'rgba(201,168,76,0.52)' : 'rgba(25,23,19,0.10)'}`, background: active ? 'rgba(201,168,76,0.17)' : 'rgba(255,255,255,0.52)', textAlign: 'left', cursor: 'pointer' }}><strong>{item.label}</strong><span style={{ display: 'block', marginTop: 4, fontSize: 11.5, lineHeight: '17px', color: 'rgba(25,23,19,0.58)' }}>{item.description}</span><span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>{item.features.map(feature => <span key={feature} style={{ borderRadius: 999, padding: '4px 8px', background: 'rgba(25,23,19,0.06)', color: 'rgba(25,23,19,0.68)', fontSize: 10.5, fontWeight: 800 }}>{feature}</span>)}</span></button>;
      })}</div>
      {!premium && <Hint>Новости, мероприятия и юридические поля показываются только на Премиум.</Hint>}
    </Section>

    <Section id="main" title="2. Основная информация" subtitle="Компания, категория и описание" open={open.main} onToggle={toggle}>
      <Field label="Название компании"><input style={inputStyle()} value={fields.title || ''} onChange={e => onField('title', e.target.value)} /></Field>
      <Field label="Категория"><select style={inputStyle()} value={fields.category || 'other'} onChange={e => onField('category', e.target.value)}>{PARTNER_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
      <Field label="Короткое описание" hint="1-2 предложения для быстрого понимания карточки."><input style={inputStyle()} value={fields.shortDescription || ''} onChange={e => onField('shortDescription', e.target.value)} maxLength={160} /></Field>
      <Field label="Подробное описание" hint="Что вы делаете, чем полезны жителям и почему стоит прийти именно к вам."><textarea style={textareaStyle(150)} value={fields.description || ''} onChange={e => onField('description', e.target.value)} /></Field>
      <Field label="Услуги / направления" hint="Основные услуги без цен. Каталог услуг и онлайн-оплата зарезервированы для будущего расширения."><textarea style={textareaStyle()} value={fields.services || ''} onChange={e => onField('services', e.target.value)} /></Field>
    </Section>

    <Section id="offer" title="3. Акция" subtitle="Специальное предложение для пользователей АПГ" open={open.offer} onToggle={toggle}>
      <Field label="Акция для пользователей АПГ" hint="Скидка, подарок, бонус, промокод или особое условие."><textarea style={textareaStyle()} value={fields.offer || ''} onChange={e => onField('offer', e.target.value)} /></Field>
      <Field label="Подарок / бонус за ключи" hint="Если хотите использовать механику ключей."><textarea style={textareaStyle()} value={fields.gift || ''} onChange={e => onField('gift', e.target.value)} /></Field>
    </Section>

    <Section id="media" title="4. Медиа" subtitle="Логотип, фото, горизонтальная обложка и видео" open={open.media} onToggle={toggle}>
      {[['logo', 'Логотип', 'PNG или WebP, 1 файл'], ['gallery', 'Галерея фотографий', 'Рекомендуется 3–6 фото'], ['cover', 'Горизонтальная обложка карточки', 'Рекомендуемый размер от 1600×900 px, 1 файл']].map(([role, label, hint]) => <Field key={role} label={label} hint={hint}><input type="file" accept="image/*" multiple={role === 'gallery'} onChange={e => onFiles(e.target.files, role)} style={{ ...inputStyle(), padding: 9 }} /></Field>)}
      {uploading && <Hint>Загружаем изображения…</Hint>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8, marginTop: 10 }}>{files.filter(file => file.url).map((file, index) => <div key={`${file.url}-${index}`}><img src={file.preview || file.url} alt="" style={{ width: '100%', aspectRatio: file.role === 'cover' ? '16/9' : '1/1', objectFit: 'cover', borderRadius: 12 }} /><div style={{ fontSize: 9.5, marginTop: 3 }}>{file.role}</div></div>)}</div>
      {alliance && <Field label="Видео" hint="YouTube, VK Видео, Rutube или публичное видео MAX." error={videoError}><div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}><input style={inputStyle(!!videoError)} value={videoInput} onChange={e => setVideoInput(e.target.value)} placeholder="https://..." /><button type="button" onClick={addVideo} style={{ ...inputStyle(), width: 'auto', fontWeight: 850, cursor: 'pointer' }}>Добавить</button></div></Field>}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{listValue(fields.videos).map((video, index) => <div key={`${video.url}-${index}`} style={{ padding: 10, borderRadius: 14, background: 'rgba(25,23,19,0.05)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 9, alignItems: 'center' }}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 12 }}>{video.platformLabel}</div><div style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.url}</div></div><button type="button" onClick={() => onField('videos', listValue(fields.videos).filter((_, i) => i !== index))} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>×</button></div>)}</div>
    </Section>

    <Section id="contacts" title="5. Контакты" subtitle="Связь, адрес, сайт и запись" open={open.contacts} onToggle={toggle}>
      <Field label="Контактное лицо"><input style={inputStyle()} value={fields.contactName || ''} onChange={e => onField('contactName', e.target.value)} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}><Field label="Телефон" error={fieldErrors.phone}><input style={inputStyle(!!fieldErrors.phone)} value={fields.phone || ''} onChange={e => onField('phone', e.target.value)} /></Field><Field label="Email" error={fieldErrors.email}><input type="email" style={inputStyle(!!fieldErrors.email)} value={fields.email || ''} onChange={e => onField('email', e.target.value)} /></Field></div>
      <Field label="Адрес"><input style={inputStyle()} value={fields.address || ''} onChange={e => onField('address', e.target.value)} /></Field>
      <Field label="График работы"><input style={inputStyle()} value={fields.hours || ''} onChange={e => onField('hours', e.target.value)} /></Field>
      <Field label="Сайт" error={fieldErrors.website}><input style={inputStyle(!!fieldErrors.website)} value={fields.website || ''} onChange={e => onField('website', e.target.value)} placeholder="https://..." /></Field>
      {alliance && <Field label="Онлайн-запись" hint="Отдельная ссылка, не объединяем с сайтом." error={fieldErrors.bookingUrl}><input style={inputStyle(!!fieldErrors.bookingUrl)} value={fields.bookingUrl || ''} onChange={e => onField('bookingUrl', e.target.value)} placeholder="https://..." /></Field>}
      {[['vk', 'VK'], ['telegram', 'Telegram'], ['max', 'MAX']].map(([key, label]) => <Field key={key} label={label}><input style={inputStyle()} value={fields[key] || ''} onChange={e => onField(key, e.target.value)} placeholder="https://..." /></Field>)}
    </Section>

    {premium && <Section id="premium" title="6. Возможности Премиум" subtitle="Контент, мероприятия и будущий юридический профиль" open={open.premium} onToggle={toggle}>
      <Field label="Новости" hint="Инфоповоды, которые можно превратить в публикации."><textarea style={textareaStyle()} value={fields.newsInfo || ''} onChange={e => onField('newsInfo', e.target.value)} /></Field>
      <Field label="Мероприятия" hint="События, мастер-классы, дегустации, встречи или активности."><textarea style={textareaStyle()} value={fields.activities || ''} onChange={e => onField('activities', e.target.value)} /></Field>
      <Field label="ИНН" hint="Пока только ИНН. Остальные реквизиты подготовлены архитектурно для юридического профиля."><input style={inputStyle()} value={fields.inn || ''} onChange={e => onField('inn', e.target.value.replace(/\D/g, '').slice(0, 12))} /></Field>
    </Section>}

    <Section id="comment" title="7. Комментарий" subtitle="Только для администрации — пользователи его не увидят" open={open.comment} onToggle={toggle}><Field label="Комментарий для администрации"><textarea style={textareaStyle()} value={fields.comment || ''} onChange={e => onField('comment', e.target.value)} /></Field></Section>
  </>;
}
