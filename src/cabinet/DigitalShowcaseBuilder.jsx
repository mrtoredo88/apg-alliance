import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassInput, GlassSection } from '../components/Apg2ProfileGlass.jsx';
import { EntityPreviewCard } from '../components/EntityPreviewCard.jsx';
import { GalleryUpload, PhotoUpload } from '../PhotoUpload.jsx';
import { userAction } from '../userApi.js';
import { LokiIdentity } from '../loki/LokiIdentity.jsx';
import { normalizeLocationIds } from '../../server-shared/locations.js';
import {
  SOCIAL_LINK_TYPES,
  SHOWCASE_TABS,
  buildShowcaseAnalytics,
  buildShowcaseDraft,
  buildShowcaseLokiTips,
  buildShowcasePatch,
  calculateShowcaseCompletion,
  moveShowcaseItem,
} from './ShowcaseBuilderCore.js';

const inputStyle = {
  minHeight: 46,
  borderRadius: 18,
  fontSize: 14,
  fontWeight: 650,
};

const textareaStyle = {
  ...APG2_PROFILE.glass,
  width: '100%',
  minHeight: 96,
  borderRadius: 20,
  padding: 13,
  color: APG2_PROFILE.text,
  border: APG2_PROFILE.glass.border,
  background: 'rgba(var(--apg2-glass-a,255,255,255),0.18)',
  fontSize: 14,
  lineHeight: '20px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'vertical',
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 780 }}>{label}</span>
      {children}
    </label>
  );
}

function TextArea({ value, onChange, rows = 4, placeholder }) {
  return <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} style={textareaStyle} />;
}

function ListEditor({ title, items = [], onChange, placeholder = 'Новый пункт' }) {
  const add = () => onChange([...(items || []), '']);
  const update = (index, value) => onChange(items.map((item, i) => i === index ? value : item));
  const remove = (index) => onChange(items.filter((_, i) => i !== index));
  return (
    <GlassCard style={{ borderRadius: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880 }}>{title}</div>
        <GlassButton onClick={add} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px' }}>Добавить</GlassButton>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {!items.length && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '18px' }}>{placeholder}</div>}
        {items.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 36px', gap: 7 }}>
            <GlassInput value={item} onChange={e => update(index, e.target.value)} placeholder={placeholder} style={inputStyle} />
            <GlassButton onClick={() => remove(index)} style={{ minHeight: 46, borderRadius: 16, padding: 0 }}>×</GlassButton>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function CompletionCard({ completion, onOpenTab }) {
  return (
    <GlassCard tone="gold" style={{ borderRadius: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
        <div>
          <div style={{ color: '#17120a', fontSize: 20, lineHeight: '24px', fontWeight: 930 }}>Профиль заполнен на {completion.percent}%</div>
          <div style={{ color: 'rgba(23,18,10,0.62)', fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>{completion.doneCount} из {completion.checks.length} пунктов готовы</div>
        </div>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: `conic-gradient(#17120a ${completion.percent * 3.6}deg, rgba(23,18,10,0.14) 0deg)`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.34)', color: '#17120a', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 930 }}>{completion.percent}%</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
        {completion.checks.map(item => (
          <button key={item.id} type="button" onClick={() => onOpenTab(item.tab)} style={{ border: 0, borderRadius: 16, padding: '9px 11px', background: item.done ? 'rgba(23,18,10,0.08)' : 'rgba(255,255,255,0.30)', color: '#17120a', display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 9, alignItems: 'center', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: item.done ? '#17120a' : 'rgba(23,18,10,0.13)', color: item.done ? '#D7B86A' : 'rgba(23,18,10,0.48)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{item.done ? '✓' : '•'}</span>
            <span style={{ fontSize: 13, lineHeight: '17px', fontWeight: 780 }}>{item.label}</span>
            {!item.done && <span style={{ fontSize: 12, opacity: 0.55 }}>Исправить</span>}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function SaveState({ state }) {
  const label = state === 'saving' ? 'Сохраняем...' : state === 'dirty' ? 'Есть несохранённые изменения' : state === 'error' ? 'Не сохранено' : state === 'saved' ? 'Изменения сохранены' : 'Автосохранение';
  return <GlassBadge tone={state === 'saved' ? 'gold' : 'glass'}>{state === 'saved' ? '✓ ' : state === 'dirty' ? '• ' : ''}{label}</GlassBadge>;
}

function ShowcaseTab({ draft, update, roleId, publicUrl }) {
  return (
    <GlassSection title="Витрина">
      <EntityPreviewCard type={roleId === 'expert' ? 'expert' : 'partner'} item={{ ...draft, offer: draft.slogan, specialization: draft.shortDescription }} compact />
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <Field label={roleId === 'expert' ? 'Имя эксперта' : 'Название'}><GlassInput value={draft.name} onChange={e => update({ name: e.target.value })} style={inputStyle} /></Field>
        <Field label="Категория"><GlassInput value={draft.categoryLabel || draft.category} onChange={e => update({ categoryLabel: e.target.value })} style={inputStyle} /></Field>
        <Field label="Слоган / главное предложение"><GlassInput value={draft.slogan} onChange={e => update({ slogan: e.target.value })} style={inputStyle} placeholder="Коротко: почему к вам стоит прийти" /></Field>
        <Field label="Короткое описание"><GlassInput value={draft.shortDescription} maxLength={140} onChange={e => update({ shortDescription: e.target.value.slice(0, 140) })} style={inputStyle} /></Field>
        <Field label="Полное описание"><TextArea value={draft.description} onChange={description => update({ description })} placeholder="Расскажите, кому вы полезны и что получит клиент." /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Город"><GlassInput value={draft.city} onChange={e => update({ city: e.target.value })} style={inputStyle} /></Field>
          <Field label="Район"><GlassInput value={draft.district} onChange={e => update({ district: e.target.value })} style={inputStyle} /></Field>
        </div>
        <Field label="Адрес"><GlassInput value={draft.address} onChange={e => update({ address: e.target.value })} style={inputStyle} /></Field>
        <Field label="Часы работы"><GlassInput value={draft.hours} onChange={e => update({ hours: e.target.value })} style={inputStyle} placeholder="Пн-Пт 10:00-20:00" /></Field>
        {publicUrl && <GlassButton onClick={() => window.open(publicUrl, '_blank')} style={{ width: '100%' }}>Открыть публичную карточку</GlassButton>}
      </div>
    </GlassSection>
  );
}

function MediaTab({ draft, update, roleId, profileId }) {
  const updateVideo = (index, patch) => update({ videos: draft.videos.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const addVideo = () => update({ videos: [...draft.videos, { title: '', url: '' }] });
  const removeVideo = (index) => update({ videos: draft.videos.filter((_, i) => i !== index) });
  return (
    <GlassSection title="Фото и видео">
      <div style={{ display: 'grid', gap: 12 }}>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880, marginBottom: 10 }}>Логотип / фото профиля</div>
          <PhotoUpload value={draft.logoUrl || draft.photo} onChange={url => update({ logoUrl: url, photo: roleId === 'expert' ? url : draft.photo })} folder={`${roleId}s/${profileId}/showcase`} shape={roleId === 'expert' ? 'round' : 'round'} />
        </GlassCard>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880, marginBottom: 10 }}>Обложка</div>
          <PhotoUpload value={draft.coverPhoto} onChange={coverPhoto => update({ coverPhoto })} folder={`${roleId}s/${profileId}/cover`} shape="cover" label="Загрузить обложку" />
        </GlassCard>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880 }}>Галерея</div>
            <GlassBadge>{draft.gallery.length}/12</GlassBadge>
          </div>
          <GalleryUpload value={draft.gallery} onChange={gallery => update({ gallery })} folder={`${roleId}s/${profileId}/gallery`} max={12} />
          {draft.gallery.length > 1 && (
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {draft.gallery.map((url, index) => (
                <div key={`${url}-${index}`} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 36px 36px', gap: 7, alignItems: 'center' }}>
                  <img src={url} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover' }} />
                  <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12 }}>Фото {index + 1}{index === 0 ? ' · главное' : ''}</div>
                  <GlassButton disabled={index === 0} onClick={() => update({ gallery: moveShowcaseItem(draft.gallery, index, -1) })} style={{ minHeight: 36, padding: 0, borderRadius: 14 }}>↑</GlassButton>
                  <GlassButton disabled={index === draft.gallery.length - 1} onClick={() => update({ gallery: moveShowcaseItem(draft.gallery, index, 1) })} style={{ minHeight: 36, padding: 0, borderRadius: 14 }}>↓</GlassButton>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880 }}>Видео</div>
            <GlassButton onClick={addVideo} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px' }}>Добавить</GlassButton>
          </div>
          <div style={{ display: 'grid', gap: 9 }}>
            {!draft.videos.length && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5 }}>YouTube, VK Видео и Rutube можно добавить ссылкой.</div>}
            {draft.videos.map((video, index) => (
              <GlassCard key={index} style={{ borderRadius: 20, padding: 10 }}>
                <GlassInput value={video.title || ''} onChange={e => updateVideo(index, { title: e.target.value })} placeholder="Название видео" style={{ ...inputStyle, marginBottom: 7 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px', gap: 7 }}>
                  <GlassInput value={video.url || ''} onChange={e => updateVideo(index, { url: e.target.value })} placeholder="https://..." style={inputStyle} />
                  <GlassButton onClick={() => removeVideo(index)} style={{ minHeight: 46, padding: 0, borderRadius: 16 }}>×</GlassButton>
                </div>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      </div>
    </GlassSection>
  );
}

function ContactsTab({ draft, update }) {
  const addSocial = () => update({ socialLinks: [...draft.socialLinks, { type: 'custom', label: 'Ссылка', url: '' }] });
  const updateSocial = (index, patch) => update({ socialLinks: draft.socialLinks.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const removeSocial = (index) => update({ socialLinks: draft.socialLinks.filter((_, i) => i !== index) });
  return (
    <GlassSection title="Контакты и соцсети">
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Телефон"><GlassInput value={draft.phone} onChange={e => update({ phone: e.target.value })} inputMode="tel" style={inputStyle} /></Field>
        <Field label="Email"><GlassInput value={draft.email} onChange={e => update({ email: e.target.value })} inputMode="email" style={inputStyle} /></Field>
        <Field label="Сайт"><GlassInput value={draft.websiteUrl} onChange={e => update({ websiteUrl: e.target.value })} inputMode="url" style={inputStyle} /></Field>
        <Field label="Онлайн-запись"><GlassInput value={draft.bookingUrl} onChange={e => update({ bookingUrl: e.target.value })} inputMode="url" style={inputStyle} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Telegram"><GlassInput value={draft.telegramUrl} onChange={e => update({ telegramUrl: e.target.value })} style={inputStyle} /></Field>
          <Field label="WhatsApp"><GlassInput value={draft.whatsappUrl} onChange={e => update({ whatsappUrl: e.target.value })} style={inputStyle} /></Field>
        </div>
        <Field label="Сообщество для ленты VK">
          <GlassInput value={draft.vkUrl} onChange={e => update({ vkUrl: e.target.value })} inputMode="url" style={inputStyle} placeholder="https://vk.com/..." />
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '18px', marginTop: 6 }}>Укажите ссылку на ваше сообщество VK. Записи VK станут частью общей “Ленты” вашей карточки.</div>
        </Field>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880 }}>Дополнительные ссылки</div>
            <GlassButton onClick={addSocial} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px' }}>Добавить</GlassButton>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {draft.socialLinks.map((link, index) => (
              <GlassCard key={index} style={{ borderRadius: 20, padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 38px', gap: 7 }}>
                  <select value={link.type || 'custom'} onChange={e => {
                    const type = SOCIAL_LINK_TYPES.find(item => item.id === e.target.value);
                    updateSocial(index, { type: e.target.value, label: type?.label || link.label });
                  }} style={{ ...inputStyle, ...APG2_PROFILE.glass, color: APG2_PROFILE.text, background: 'rgba(var(--apg2-glass-a,255,255,255),0.18)', border: APG2_PROFILE.glass.border, padding: '0 10px', fontFamily: 'inherit' }}>
                    {SOCIAL_LINK_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                  </select>
                  <GlassInput value={link.label || ''} onChange={e => updateSocial(index, { label: e.target.value })} placeholder="Название" style={inputStyle} />
                  <GlassButton onClick={() => removeSocial(index)} style={{ minHeight: 46, padding: 0, borderRadius: 16 }}>×</GlassButton>
                </div>
                <GlassInput value={link.url || ''} onChange={e => updateSocial(index, { url: e.target.value })} placeholder="https://..." style={{ ...inputStyle, marginTop: 7 }} />
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      </div>
    </GlassSection>
  );
}

function LocationsTab({ draft, update }) {
  const locations = Array.isArray(draft.locations) ? draft.locations : [];
  const specialists = Array.isArray(draft.bookingSpecialists) ? draft.bookingSpecialists : [];
  const updateLocation = (index, patch) => update({
    locations: locations.map((item, i) => i === index ? { ...item, ...patch } : item),
  });
  const updateSpecialistLocations = (index, patch) => update({
    bookingSpecialists: specialists.map((item, i) => i === index ? { ...item, ...patch } : item),
  });
  const toggleSpecialistLocation = (index, locationId) => {
    update({
      bookingSpecialists: specialists.map((item, i) => {
        if (i !== index) return item;
        const ids = normalizeLocationIds(item.locationIds || item.locations || item.branchIds);
        const next = ids.includes(locationId) ? ids.filter(id => id !== locationId) : [...ids, locationId];
        return { ...item, locationIds: next };
      }),
    });
  };
  const addLocation = () => update({
    locations: [
      ...locations,
      {
        id: `location-${Date.now()}`,
        title: '',
        address: '',
        description: '',
        phone: draft.phone || '',
        whatsapp: '',
        telegram: '',
        website: '',
        workingHours: draft.hours || '',
        coordinates: null,
        comment: '',
        isMain: locations.length === 0,
      },
    ],
  });
  const removeLocation = (index) => {
    const next = locations.filter((_, i) => i !== index);
    update({ locations: next.map((item, i) => ({ ...item, isMain: next.some(row => row.isMain) ? item.isMain : i === 0 })) });
  };
  const setMain = (index) => update({ locations: locations.map((item, i) => ({ ...item, isMain: i === index })) });
  const copyLocation = (index) => {
    const source = locations[index] || {};
    update({
      locations: [
        ...locations.slice(0, index + 1),
        { ...source, id: `location-${Date.now()}`, title: `${source.title || `Локация ${index + 1}`} копия`, isMain: false },
        ...locations.slice(index + 1),
      ],
    });
  };
  const moveLocation = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= locations.length) return;
    const next = [...locations];
    [next[index], next[target]] = [next[target], next[index]];
    update({ locations: next });
  };
  return (
    <GlassSection title="Локации">
      <div style={{ display: 'grid', gap: 12 }}>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontWeight: 880 }}>Филиалы и точки организации</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 6 }}>Если у вас несколько адресов, добавьте каждый филиал отдельно. Посетители смогут выбрать удобную локацию.</div>
          <GlassButton onClick={addLocation} tone="gold" style={{ marginTop: 12, minHeight: 42, borderRadius: 18, color: '#17120a' }}>Добавить филиал</GlassButton>
        </GlassCard>
        {!locations.length && (
          <EmptyStateV2 icon="📍" title="Локаций пока нет" text="Старый адрес карточки продолжит работать как основная локация." action={<GlassButton onClick={addLocation}>Добавить локацию</GlassButton>} />
        )}
        {locations.map((location, index) => (
          <GlassCard key={location.id || index} style={{ borderRadius: 28, display: 'grid', gap: 9, border: location.isMain ? '1px solid rgba(201,168,76,0.42)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880 }}>{location.isMain ? 'Главная локация' : `Локация ${index + 1}`}</div>
              {location.isMain ? <GlassBadge tone="gold">Главная</GlassBadge> : <GlassButton onClick={() => setMain(index)} style={{ minHeight: 32, borderRadius: 14, padding: '6px 10px' }}>Сделать главной</GlassButton>}
            </div>
            <Field label="Название филиала"><GlassInput value={location.title || ''} onChange={e => updateLocation(index, { title: e.target.value })} placeholder="Центральный салон" style={inputStyle} /></Field>
            <Field label="Адрес"><GlassInput value={location.address || ''} onChange={e => updateLocation(index, { address: e.target.value })} placeholder="Зеленоград, корпус..." style={inputStyle} /></Field>
            <Field label="Описание филиала"><TextArea value={location.description || ''} onChange={description => updateLocation(index, { description })} rows={2} placeholder="Например: косметология, парикмахерский зал, отдельный вход." /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Телефон"><GlassInput value={location.phone || ''} onChange={e => updateLocation(index, { phone: e.target.value })} inputMode="tel" style={inputStyle} /></Field>
              <Field label="График"><GlassInput value={location.workingHours || ''} onChange={e => updateLocation(index, { workingHours: e.target.value })} placeholder="Пн-Пт 10:00-20:00" style={inputStyle} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="WhatsApp"><GlassInput value={location.whatsapp || ''} onChange={e => updateLocation(index, { whatsapp: e.target.value })} placeholder="https://wa.me/..." style={inputStyle} /></Field>
              <Field label="Telegram"><GlassInput value={location.telegram || ''} onChange={e => updateLocation(index, { telegram: e.target.value })} placeholder="https://t.me/..." style={inputStyle} /></Field>
            </div>
            <Field label="Сайт филиала"><GlassInput value={location.website || ''} onChange={e => updateLocation(index, { website: e.target.value })} placeholder="https://..." style={inputStyle} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Широта"><GlassInput value={location.coordinates?.latitude ?? ''} onChange={e => updateLocation(index, { coordinates: { ...(location.coordinates || {}), latitude: e.target.value } })} inputMode="decimal" style={inputStyle} /></Field>
              <Field label="Долгота"><GlassInput value={location.coordinates?.longitude ?? ''} onChange={e => updateLocation(index, { coordinates: { ...(location.coordinates || {}), longitude: e.target.value } })} inputMode="decimal" style={inputStyle} /></Field>
            </div>
            <Field label="Комментарий"><TextArea value={location.comment || ''} onChange={comment => updateLocation(index, { comment })} rows={2} placeholder="Например: вход со двора, парковка рядом." /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7 }}>
              <GlassButton onClick={() => moveLocation(index, -1)} disabled={index === 0} style={{ minHeight: 38, borderRadius: 16 }}>Выше</GlassButton>
              <GlassButton onClick={() => moveLocation(index, 1)} disabled={index === locations.length - 1} style={{ minHeight: 38, borderRadius: 16 }}>Ниже</GlassButton>
              <GlassButton onClick={() => copyLocation(index)} style={{ minHeight: 38, borderRadius: 16 }}>Копия</GlassButton>
              <GlassButton onClick={() => removeLocation(index)} style={{ minHeight: 38, borderRadius: 16 }}>Удалить</GlassButton>
            </div>
          </GlassCard>
        ))}
        {locations.length > 1 && specialists.length > 0 && (
          <GlassCard style={{ borderRadius: 28, display: 'grid', gap: 10 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontWeight: 880 }}>Специалисты по филиалам</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px' }}>Если филиалы не выбраны, специалист считается доступным во всех филиалах.</div>
            {specialists.map((specialist, specialistIndex) => {
              const ids = normalizeLocationIds(specialist.locationIds || specialist.locations || specialist.branchIds);
              return (
                <GlassCard key={specialist.id || specialistIndex} style={{ borderRadius: 22, padding: 11, display: 'grid', gap: 8 }}>
                  <Field label="Специалист"><GlassInput value={specialist.name || specialist.title || ''} onChange={e => updateSpecialistLocations(specialistIndex, { name: e.target.value })} style={inputStyle} /></Field>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {locations.map(location => {
                      const active = ids.includes(location.id);
                      return (
                        <GlassButton key={location.id} tone={active ? 'gold' : 'glass'} onClick={() => toggleSpecialistLocation(specialistIndex, location.id)} style={{ minHeight: 34, borderRadius: 16, padding: '6px 10px', color: active ? '#17120a' : APG2_PROFILE.text }}>
                          {active ? '✓ ' : ''}{location.title || location.address || 'Филиал'}
                        </GlassButton>
                      );
                    })}
                  </div>
                </GlassCard>
              );
            })}
          </GlassCard>
        )}
      </div>
    </GlassSection>
  );
}

function AboutTab({ draft, update, roleId }) {
  return (
    <GlassSection title={roleId === 'expert' ? 'О эксперте' : 'О бизнесе'}>
      <div style={{ display: 'grid', gap: 10 }}>
        <ListEditor title="Услуги" items={draft.services} onChange={services => update({ services })} />
        <ListEditor title="Направления" items={draft.directions} onChange={directions => update({ directions })} />
        <ListEditor title="Преимущества" items={draft.advantages} onChange={advantages => update({ advantages })} />
        <ListEditor title={roleId === 'expert' ? 'Стоимость консультаций' : 'Цены'} items={draft.prices} onChange={prices => update({ prices })} />
        <ListEditor title="Способы оплаты" items={draft.paymentMethods} onChange={paymentMethods => update({ paymentMethods })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Парковка"><GlassInput value={draft.parking} onChange={e => update({ parking: e.target.value })} style={inputStyle} /></Field>
          <Field label="Доставка"><GlassInput value={draft.delivery} onChange={e => update({ delivery: e.target.value })} style={inputStyle} /></Field>
        </div>
        <Field label="Что нужно знать клиенту"><TextArea value={draft.customerNotes} onChange={customerNotes => update({ customerNotes })} rows={3} /></Field>
        <ListEditor title="Особенности" items={draft.features} onChange={features => update({ features })} />
        {roleId === 'expert' && (
          <>
            <Field label="Образование"><TextArea value={draft.education} onChange={education => update({ education })} rows={3} /></Field>
            <Field label="Опыт"><TextArea value={draft.experience} onChange={experience => update({ experience })} rows={3} /></Field>
            <ListEditor title="Сертификаты" items={draft.certificates} onChange={certificates => update({ certificates })} />
            <Field label="Формат работы"><GlassInput value={draft.workFormat} onChange={e => update({ workFormat: e.target.value })} style={inputStyle} placeholder="очно, онлайн, выезд" /></Field>
          </>
        )}
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880, marginBottom: 10 }}>FAQ</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {draft.faq.map((item, index) => (
              <GlassCard key={index} style={{ borderRadius: 20, padding: 10 }}>
                <GlassInput value={item.question || ''} onChange={e => update({ faq: draft.faq.map((faq, i) => i === index ? { ...faq, question: e.target.value } : faq) })} placeholder="Вопрос" style={{ ...inputStyle, marginBottom: 7 }} />
                <TextArea value={item.answer || ''} onChange={answer => update({ faq: draft.faq.map((faq, i) => i === index ? { ...faq, answer } : faq) })} rows={2} placeholder="Ответ" />
                <GlassButton onClick={() => update({ faq: draft.faq.filter((_, i) => i !== index) })} style={{ marginTop: 7, minHeight: 38, width: '100%' }}>Удалить вопрос</GlassButton>
              </GlassCard>
            ))}
            <GlassButton onClick={() => update({ faq: [...draft.faq, { question: '', answer: '' }] })}>Добавить вопрос</GlassButton>
          </div>
        </GlassCard>
      </div>
    </GlassSection>
  );
}

function ContentTab({ roleId, events, onOpenModule, onEventCreated, profile, onToast }) {
  const actions = [
    ['Новость', 'Создать публикацию о запуске, обновлении или важной новости.', 'history'],
    ['Мероприятие', 'Создать событие, мастер-класс или встречу.', 'events'],
    ['Акция', 'Оформить спецпредложение для участников АПГ.', 'promotions'],
    ['Розыгрыш', 'Подготовить механику подарка или бонуса.', 'subscription'],
  ];
  return (
    <GlassSection title="Контент">
      <div style={{ display: 'grid', gap: 10 }}>
        {actions.map(([title, text, module]) => (
          <GlassCard key={title} onClick={() => onOpenModule?.(module)} style={{ borderRadius: 24, display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 38, height: 38, borderRadius: 16, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontWeight: 900 }}>+</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', color: APG2_PROFILE.text, fontSize: 15, fontWeight: 850 }}>{title}</span>
              <span style={{ display: 'block', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 2 }}>{text}</span>
            </span>
            <span style={{ color: APG2_PROFILE.gold, fontSize: 20 }}>›</span>
          </GlassCard>
        ))}
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880, marginBottom: 10 }}>Мероприятия из кабинета</div>
          <EmptyStateV2 icon="📅" title={events.length ? `${events.length} связано с профилем` : 'Можно создать мероприятие'} text="Существующий центр событий остаётся рабочим: конструктор только даёт быстрый вход." action={<GlassButton onClick={() => onOpenModule?.('events')}>Открыть центр событий</GlassButton>} />
        </GlassCard>
      </div>
    </GlassSection>
  );
}

function AnalyticsTab({ analytics }) {
  return (
    <GlassSection title="Аналитика">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        {analytics.map(item => (
          <GlassCard key={item.id} style={{ borderRadius: 22, padding: 13 }}>
            <div style={{ color: APG2_PROFILE.gold, fontSize: 26, fontWeight: 930, lineHeight: 1 }}>{item.value}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11, lineHeight: '15px', marginTop: 5 }}>{item.label}</div>
          </GlassCard>
        ))}
      </div>
      <GlassCard style={{ borderRadius: 26, marginTop: 12 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '20px', fontWeight: 760 }}>Здесь только быстрые рабочие числа: без сложных графиков, чтобы владелец сразу понял, что происходит сегодня.</div>
      </GlassCard>
    </GlassSection>
  );
}

function ClientViewTab({ draft, roleId, publicUrl }) {
  return (
    <GlassSection title="Как видят клиенты">
      <EntityPreviewCard type={roleId === 'expert' ? 'expert' : 'partner'} item={{ ...draft, offer: draft.slogan, specialization: draft.shortDescription }} />
      <GlassCard style={{ borderRadius: 28, marginTop: 12 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 880 }}>{draft.name || 'Карточка АПГ'}</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 8 }}>{draft.description || 'Описание появится здесь сразу после заполнения.'}</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
          {[draft.phone && 'Телефон', draft.address && 'Адрес', draft.telegramUrl && 'Telegram', draft.websiteUrl && 'Сайт', draft.bookingUrl && 'Запись'].filter(Boolean).map(item => <GlassBadge key={item}>{item}</GlassBadge>)}
        </div>
        {publicUrl && <GlassButton onClick={() => window.open(publicUrl, '_blank')} tone="gold" style={{ width: '100%', marginTop: 12, color: '#17120a' }}>Открыть как клиент</GlassButton>}
      </GlassCard>
    </GlassSection>
  );
}

function LokiTab({ tips, onOpenTab }) {
  return (
    <GlassSection title="Локи рекомендует улучшить профиль">
      <GlassCard style={{ borderRadius: 30, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <LokiIdentity size={34} state="recommending" showText={false} style={{ placeItems: 'center', flexShrink: 0 }} />
          <GlassBadge tone="gold">Локи · витрина</GlassBadge>
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '21px', fontWeight: 760 }}>
          Я смотрю на карточку так же, как её увидит клиент: полнота, доверие, понятные действия и свежий контент.
        </div>
      </GlassCard>
      <div style={{ display: 'grid', gap: 10 }}>
        {!tips.length && <EmptyStateV2 icon="✓" title="Витрина выглядит готовой" text="Поддерживайте актуальность фото, контактов и предложений." />}
        {tips.map(tip => (
          <GlassCard key={tip.id} style={{ borderRadius: 24 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 880 }}>{tip.title}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{tip.text}</div>
            <GlassButton onClick={() => onOpenTab(tip.tab)} tone="gold" style={{ marginTop: 10, width: '100%', color: '#17120a' }}>Исправить</GlassButton>
          </GlassCard>
        ))}
      </div>
    </GlassSection>
  );
}

export function DigitalShowcaseBuilder({ role, profile, relatedEvents = [], onSaved, onOpenModule, onEventCreated, onToast, publicUrl }) {
  const roleId = role?.id || 'partner';
  const draftKey = profile?.id ? `apg_showcase_draft_${roleId}_${profile.id}` : '';
  const [activeTab, setActiveTab] = useState('showcase');
  const [draft, setDraft] = useState(() => {
    const base = buildShowcaseDraft(profile, roleId);
    if (!profile?.id || typeof localStorage === 'undefined') return base;
    try {
      const saved = JSON.parse(localStorage.getItem(`apg_showcase_draft_${roleId}_${profile.id}`) || 'null');
      return saved?.draft ? { ...base, ...saved.draft } : base;
    } catch {
      return base;
    }
  });
  const [saveState, setSaveState] = useState('idle');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const base = buildShowcaseDraft(profile, roleId);
    let restored = null;
    if (profile?.id && typeof localStorage !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem(`apg_showcase_draft_${roleId}_${profile.id}`) || 'null');
        restored = saved?.draft ? { ...base, ...saved.draft } : null;
      } catch {}
    }
    setDraft(restored || base);
    setDirty(Boolean(restored));
    setSaveState('idle');
  }, [profile?.id, roleId]);

  const saveDraft = useCallback(async () => {
    if (!role?.updateAction || !profile?.id) return;
    setSaveState('saving');
    try {
      const patch = buildShowcasePatch(draft, roleId);
      await userAction(role.updateAction, { id: profile.id, patch });
      const updated = { ...profile, ...patch };
      onSaved?.(updated);
      if (draftKey && typeof localStorage !== 'undefined') localStorage.removeItem(draftKey);
      setDirty(false);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      onToast?.(error.message || 'Не удалось сохранить витрину.', 'error');
    }
  }, [draft, draftKey, onSaved, onToast, profile, role?.updateAction, roleId]);

  useEffect(() => {
    if (!dirty || !role?.updateAction || !profile?.id) return undefined;
    setSaveState('dirty');
    const timer = setTimeout(saveDraft, 900);
    return () => clearTimeout(timer);
  }, [dirty, draft, role?.updateAction, profile?.id, roleId]);

  useEffect(() => {
    if (!dirty || !draftKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ draft, updatedAt: Date.now() }));
    } catch {}
  }, [dirty, draft, draftKey]);

  useEffect(() => {
    const onBeforeUnload = event => {
      if (!dirty) return undefined;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = event => {
      if (!(event.metaKey || event.ctrlKey) || event.key?.toLowerCase() !== 's') return;
      event.preventDefault();
      saveDraft();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveDraft]);

  const update = (patch) => {
    setDraft(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const completion = useMemo(() => calculateShowcaseCompletion(draft, roleId), [draft, roleId]);
  const tips = useMemo(() => buildShowcaseLokiTips(draft, roleId), [draft, roleId]);
  const analytics = useMemo(() => buildShowcaseAnalytics(profile, relatedEvents), [profile, relatedEvents]);
  const visibleTabs = useMemo(() => SHOWCASE_TABS.filter(tab => !tab.roles || tab.roles.includes(roleId)), [roleId]);
  const tabTitle = visibleTabs.find(tab => tab.id === activeTab)?.label || 'Витрина';

  useEffect(() => {
    if (!visibleTabs.some(tab => tab.id === activeTab)) setActiveTab(visibleTabs[0]?.id || 'showcase');
  }, [activeTab, visibleTabs]);

  const renderTab = () => {
    if (activeTab === 'showcase') return <ShowcaseTab draft={draft} update={update} roleId={roleId} publicUrl={publicUrl} />;
    if (activeTab === 'locations' && roleId === 'partner') return <LocationsTab draft={draft} update={update} />;
    if (activeTab === 'media') return <MediaTab draft={draft} update={update} roleId={roleId} profileId={profile?.id} />;
    if (activeTab === 'contacts') return <ContactsTab draft={draft} update={update} />;
    if (activeTab === 'about') return <AboutTab draft={draft} update={update} roleId={roleId} />;
    if (activeTab === 'content') return <ContentTab roleId={roleId} events={relatedEvents} onOpenModule={onOpenModule} onEventCreated={onEventCreated} profile={profile} onToast={onToast} />;
    if (activeTab === 'analytics') return <AnalyticsTab analytics={analytics} />;
    if (activeTab === 'client-view') return <ClientViewTab draft={draft} roleId={roleId} publicUrl={publicUrl} />;
    if (activeTab === 'loki') return <LokiTab tips={tips} onOpenTab={setActiveTab} />;
    return null;
  };

  return (
    <>
      <GlassCard style={{ borderRadius: 30, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <GlassBadge tone="gold">Конструктор витрины</GlassBadge>
            <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '27px', fontWeight: 940, marginTop: 10 }}>Соберите страницу, которую увидит клиент</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 6 }}>Редактирование идёт по тем же данным, что используются в публичной карточке.</div>
          </div>
          <SaveState state={saveState} />
        </div>
      </GlassCard>

      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '12px 0 4px', WebkitOverflowScrolling: 'touch' }}>
        {visibleTabs.map(tab => (
          <GlassButton key={tab.id} tone={activeTab === tab.id ? 'gold' : 'glass'} onClick={() => setActiveTab(tab.id)} style={{ minHeight: 38, borderRadius: 18, padding: '8px 11px', whiteSpace: 'nowrap', color: activeTab === tab.id ? '#17120a' : APG2_PROFILE.text }}>
            {tab.short}
          </GlassButton>
        ))}
      </div>

      <CompletionCard completion={completion} onOpenTab={setActiveTab} />

      <GlassCard style={{ borderRadius: 24, marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 820, letterSpacing: 0.8, textTransform: 'uppercase' }}>Открыт раздел</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 880, marginTop: 3 }}>{tabTitle}</div>
        </div>
        <GlassButton onClick={() => setActiveTab('loki')} style={{ minHeight: 38, borderRadius: 17, padding: '8px 11px' }}>Локи</GlassButton>
      </GlassCard>

      {renderTab()}
    </>
  );
}
