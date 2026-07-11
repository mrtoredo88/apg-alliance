import React, { useState } from 'react';
import { EXPERT_CATEGORIES, EXPERT_WORK_FORMATS, calculateExpertProfileCompletion, hasPremiumExpertAccess, normalizeExpertVideo } from '../expertProfileForm.js';
import { EXPERT_AUDIENCE_TAGS, EXPERT_TARIFFS, normalizeExpertTariff } from '../tariffConfig.js';
import { parseVideoUrl } from '../utils/parseVideoUrl.js';

const FORMAT_OPTIONS = EXPERT_WORK_FORMATS;

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

export function ExpertQuestionnaire({ fields, files, onField, onFiles, uploading }) {
  const [open, setOpen] = useState({ tariff: true, main: true, services: true, offer: false, media: false, contacts: false, legal: false, comment: false });
  const [videoInput, setVideoInput] = useState('');
  const [socialInput, setSocialInput] = useState('');
  const [videoError, setVideoError] = useState('');
  const tariff = normalizeExpertTariff(fields.tariff);
  const premium = hasPremiumExpertAccess(tariff);
  const completion = calculateExpertProfileCompletion({
    ...fields,
    primaryCategory: listValue(fields.categories)[0],
    workFormats: listValue(fields.workFormats),
    photo: files.find(file => file.role === 'avatar')?.url || '',
    coverPhoto: files.find(file => file.role === 'cover')?.url || '',
  });
  const toggle = id => setOpen(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleArray = (name, value) => onField(name, listValue(fields[name]).includes(value) ? listValue(fields[name]).filter(item => item !== value) : [...listValue(fields[name]), value]);
  const addVideo = () => {
    const video = validateVideo(videoInput);
    if (!video) { setVideoError('Поддерживаются публичные ссылки YouTube, VK Видео, Rutube и MAX.'); return; }
    onField('videos', [...listValue(fields.videos), video]); setVideoInput(''); setVideoError('');
  };
  const addSocial = () => {
    try { const url = new URL(/^https?:\/\//i.test(socialInput) ? socialInput : `https://${socialInput}`); onField('otherSocials', [...listValue(fields.otherSocials), url.toString()]); setSocialInput(''); } catch { setSocialInput(socialInput.trim()); }
  };
  const fieldErrors = {
    phone: fields.phone && !/^\+?[\d\s()-]{10,20}$/.test(fields.phone) ? 'Проверьте номер телефона.' : '',
    email: fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ? 'Проверьте email.' : '',
    inn: fields.inn && !/^\d{10}$|^\d{12}$/.test(String(fields.inn).replace(/\D/g, '')) ? 'ИНН должен содержать 10 или 12 цифр.' : '',
  };

  return <>
    <div style={{ position: 'sticky', top: 8, zIndex: 20, marginBottom: 12, padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(201,168,76,0.30)', boxShadow: '0 10px 30px rgba(31,28,18,0.10)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, fontWeight: 850 }}><span>Заполненность анкеты</span><span style={{ color: '#80651e' }}>{completion}%</span></div>
      <div style={{ marginTop: 8, height: 7, borderRadius: 99, background: 'rgba(25,23,19,0.08)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${completion}%`, background: 'linear-gradient(90deg,#C9A84C,#E8C97A)', transition: 'width 220ms ease' }} /></div>
      <Hint>Черновик сохраняется автоматически на этом устройстве.</Hint>
    </div>

    <Section id="tariff" title="1. Тариф" subtitle="Сначала выберите формат участия — анкета перестроится автоматически" open={open.tariff} onToggle={toggle}>
      <div style={{ display: 'grid', gap: 9 }}>{EXPERT_TARIFFS.map(item => {
        const active = tariff === item.id;
        return <button key={item.id} type="button" onClick={() => onField('tariff', item.id)} style={{ padding: 13, borderRadius: 15, border: `1px solid ${active ? 'rgba(201,168,76,0.52)' : 'rgba(25,23,19,0.10)'}`, background: active ? 'rgba(201,168,76,0.17)' : 'rgba(255,255,255,0.52)', textAlign: 'left', cursor: 'pointer' }}><strong>{item.label}</strong><span style={{ display: 'block', marginTop: 4, fontSize: 11.5, lineHeight: '17px', color: 'rgba(25,23,19,0.58)' }}>{item.description}</span><span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>{item.features.map(feature => <span key={feature} style={{ borderRadius: 999, padding: '4px 8px', background: 'rgba(25,23,19,0.06)', color: 'rgba(25,23,19,0.68)', fontSize: 10.5, fontWeight: 800 }}>{feature}</span>)}</span></button>;
      })}</div>
      {!premium && <Hint>Поля новостей, мероприятий и юридических данных не показываются на тарифе Практика.</Hint>}
    </Section>

    <Section id="main" title="2. Основная информация" subtitle="Имя, направления, описание и аудитория рекомендаций" open={open.main} onToggle={toggle}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        <Field label="Фамилия"><input style={inputStyle()} value={fields.lastName || ''} onChange={e => onField('lastName', e.target.value)} /></Field>
        <Field label="Имя"><input style={inputStyle()} value={fields.firstName || ''} onChange={e => onField('firstName', e.target.value)} /></Field>
        <Field label="Отчество — необязательно"><input style={inputStyle()} value={fields.middleName || ''} onChange={e => onField('middleName', e.target.value)} /></Field>
      </div>
      <Field label="Направления деятельности" hint="Можно выбрать несколько направлений. Первое станет основным.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{EXPERT_CATEGORIES.map(category => { const active = listValue(fields.categories).includes(category.id); return <button key={category.id} type="button" onClick={() => toggleArray('categories', category.id)} style={{ minHeight: 36, padding: '0 10px', borderRadius: 999, border: `1px solid ${active ? 'rgba(201,168,76,0.52)' : 'rgba(25,23,19,0.12)'}`, background: active ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.58)', color: active ? '#6b5316' : '#37332b', fontWeight: 750, cursor: 'pointer' }}>{category.label}</button>; })}</div>
      </Field>
      <Field label="Коротко о себе" hint="Например: юрист, психолог, нутрициолог, финансовый консультант или коуч."><input style={inputStyle()} value={fields.shortDescription || ''} onChange={e => onField('shortDescription', e.target.value)} maxLength={160} /></Field>
      <Field label="Подробно о себе" hint="С кем вы работаете, какой у вас опыт, какие задачи решаете и чем полезны пользователям АПГ."><textarea style={textareaStyle(150)} value={fields.description || ''} onChange={e => onField('description', e.target.value)} /></Field>
      <Field label="Кому могу помочь" hint="Эти теги дальше будут использоваться для рекомендаций Локи.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{EXPERT_AUDIENCE_TAGS.map(tag => { const active = listValue(fields.audienceTags).includes(tag.id); return <button key={tag.id} type="button" onClick={() => toggleArray('audienceTags', tag.id)} style={{ minHeight: 36, padding: '0 10px', borderRadius: 999, border: `1px solid ${active ? 'rgba(201,168,76,0.52)' : 'rgba(25,23,19,0.12)'}`, background: active ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.58)', color: active ? '#6b5316' : '#37332b', fontWeight: 750, cursor: 'pointer' }}>{tag.label}</button>; })}</div>
      </Field>
    </Section>

    <Section id="services" title="3. Услуги" subtitle="Что вы предлагаете и в каких форматах работаете" open={open.services} onToggle={toggle}>
      <Field label="Какие услуги оказываете" hint="Перечислите основные услуги. Стоимость будет добавлена позднее отдельным каталогом услуг."><textarea style={textareaStyle()} value={fields.services || ''} onChange={e => onField('services', e.target.value)} /></Field>
      <Field label="Форматы работы"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{FORMAT_OPTIONS.map(format => { const active = listValue(fields.workFormats).includes(format.id); return <button key={format.id} type="button" onClick={() => toggleArray('workFormats', format.id)} style={{ ...inputStyle(), width: 'auto', minHeight: 36, padding: '0 10px', cursor: 'pointer', background: active ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.58)' }}>{format.label}</button>; })}</div></Field>
    </Section>

    <Section id="offer" title="4. Акция" subtitle="Акция только для пользователей АПГ" open={open.offer} onToggle={toggle}><Field label="Акция для пользователей АПГ" hint="Скидка, подарок, бесплатная консультация, бонус или промокод."><textarea style={textareaStyle()} value={fields.offer || ''} onChange={e => onField('offer', e.target.value)} /></Field></Section>

    <Section id="media" title="5. Медиа" subtitle="Фотография профиля, галерея, обложка и видео" open={open.media} onToggle={toggle}>
      {[['avatar', 'Фотография профиля', 'Квадратное фото от 800×800 px, 1 файл'], ['gallery', 'Галерея фотографий', 'Рекомендуется 3–6 вертикальных или квадратных фото'], ['cover', 'Горизонтальная обложка карточки', 'Рекомендуемый размер от 1600×900 px, 1 файл']].map(([role, label, hint]) => <Field key={role} label={label} hint={hint}><input type="file" accept="image/*" multiple={role === 'gallery'} onChange={e => onFiles(e.target.files, role)} style={{ ...inputStyle(), padding: 9 }} /></Field>)}
      {uploading && <Hint>Загружаем изображения…</Hint>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8, marginTop: 10 }}>{files.filter(file => file.url).map((file, index) => <div key={`${file.url}-${index}`}><img src={file.preview || file.url} alt="" style={{ width: '100%', aspectRatio: file.role === 'cover' ? '16/9' : '1/1', objectFit: 'cover', borderRadius: 12 }} /><div style={{ fontSize: 9.5, marginTop: 3 }}>{file.role}</div></div>)}</div>
      <Field label="Видео" hint="YouTube, VK Видео, Rutube или публичное видео MAX." error={videoError}><div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}><input style={inputStyle(!!videoError)} value={videoInput} onChange={e => setVideoInput(e.target.value)} placeholder="https://..." /><button type="button" onClick={addVideo} style={{ ...inputStyle(), width: 'auto', fontWeight: 850, cursor: 'pointer' }}>Добавить</button></div></Field>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{listValue(fields.videos).map((video, index) => { const parsed = parseVideoUrl(video.url); return <div key={`${video.url}-${index}`} style={{ padding: 10, borderRadius: 14, background: 'rgba(25,23,19,0.05)', display: 'grid', gridTemplateColumns: parsed?.thumbnailUrl ? '88px 1fr auto' : '1fr auto', gap: 9, alignItems: 'center' }}>{parsed?.thumbnailUrl && <img src={parsed.thumbnailUrl} alt="" style={{ width: 88, height: 50, borderRadius: 9, objectFit: 'cover' }} />}<div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 12 }}>{video.platformLabel}</div><div style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.url}</div></div><button type="button" onClick={() => onField('videos', listValue(fields.videos).filter((_, i) => i !== index))} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>×</button></div>; })}</div>
    </Section>

    <Section id="contacts" title="6. Контакты" subtitle="Связь, сайт и отдельная ссылка для записи" open={open.contacts} onToggle={toggle}>
      <Field label="Контактное лицо"><input style={inputStyle()} value={fields.contactName || ''} onChange={e => onField('contactName', e.target.value)} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}><Field label="Телефон" error={fieldErrors.phone}><input style={inputStyle(!!fieldErrors.phone)} value={fields.phone || ''} onChange={e => onField('phone', e.target.value)} /></Field><Field label="Email" error={fieldErrors.email}><input type="email" style={inputStyle(!!fieldErrors.email)} value={fields.email || ''} onChange={e => onField('email', e.target.value)} /></Field></div>
      {[['website', 'Сайт'], ['bookingUrl', 'Запись'], ['vk', 'VK'], ['telegram', 'Telegram'], ['max', 'MAX']].map(([key, label]) => <Field key={key} label={label} hint={key === 'bookingUrl' ? 'Отдельная ссылка на запись или бронирование.' : ''}><input style={inputStyle()} value={fields[key] || ''} onChange={e => onField(key, e.target.value)} placeholder="https://..." /></Field>)}
      <Field label="Другие социальные сети" hint="Можно добавить несколько ссылок."><div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}><input style={inputStyle()} value={socialInput} onChange={e => setSocialInput(e.target.value)} /><button type="button" onClick={addSocial} style={{ ...inputStyle(), width: 'auto', cursor: 'pointer' }}>Добавить</button></div></Field>
      {listValue(fields.otherSocials).map((url, index) => <div key={`${url}-${index}`} style={{ marginTop: 6, fontSize: 11, display: 'flex', gap: 8 }}><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</span><button type="button" onClick={() => onField('otherSocials', listValue(fields.otherSocials).filter((_, i) => i !== index))} style={{ border: 0, background: 'transparent' }}>×</button></div>)}
    </Section>

    {premium && <Section id="legal" title="7. Возможности Амбассадора" subtitle="Новости, мероприятия и юридические данные" open={open.legal} onToggle={toggle}><Field label="Новости" hint="Темы и поводы, о которых можно рассказать пользователям."><textarea style={textareaStyle()} value={fields.newsInfo || ''} onChange={e => onField('newsInfo', e.target.value)} /></Field><Field label="Мероприятия" hint="Встречи, эфиры, консультации и другие активности."><textarea style={textareaStyle()} value={fields.activities || ''} onChange={e => onField('activities', e.target.value)} /></Field><Field label="ИНН" hint="Другие реквизиты появятся позднее в защищённом юридическом профиле." error={fieldErrors.inn}><input style={inputStyle(!!fieldErrors.inn)} value={fields.inn || ''} onChange={e => onField('inn', e.target.value.replace(/\D/g, '').slice(0, 12))} /></Field></Section>}

    <Section id="comment" title="9. Комментарий" subtitle="Только для администрации — пользователи его не увидят" open={open.comment} onToggle={toggle}><Field label="Комментарий для администрации"><textarea style={textareaStyle()} value={fields.comment || ''} onChange={e => onField('comment', e.target.value)} /></Field></Section>
  </>;
}
