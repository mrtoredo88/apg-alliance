import React, { useMemo, useState } from 'react';
import PhotoUpload from './PhotoUpload.jsx';
import { APG2_PROFILE, ApgModal, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassSection, StatPill } from './components/Apg2ProfileGlass.jsx';
import { userAction } from './userApi.js';

const STATUS_META = {
  draft: ['Черновик', 'glass'],
  pending_review: ['На модерации', 'gold'],
  approved: ['Опубликовано', 'gold'],
  published: ['Опубликовано', 'gold'],
  revision_requested: ['На доработке', 'glass'],
  rejected: ['Отклонено', 'glass'],
  completed: ['Завершено', 'glass'],
};

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(event) {
  return toDate(event?.startAt || event?.eventDate || event?.date || event?.submittedAt || event?.createdAt);
}

function eventStatus(event) {
  const raw = String(event?.submissionStatus || event?.moderationStatus || event?.status || '').toLowerCase();
  const date = eventDate(event);
  if ((raw === 'published' || raw === 'approved') && date && date.getTime() < Date.now() - 24 * 60 * 60 * 1000) return 'completed';
  return raw || 'draft';
}

function formatEventDate(event) {
  const date = eventDate(event);
  if (!date) return event?.date || 'Дата не указана';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
}

function registrations(event) {
  return Number(event?.registeredCount ?? event?.registrationsCount ?? 0) || 0;
}

function profileEvents(events, profile, type) {
  if (!profile?.id) return [];
  return (events || []).filter(event => {
    if (type === 'expert') return event.expertId === profile.id || event.submittedProfileId === profile.id || event.proposalAuthorType === 'expert' && event.submittedProfileName === profile.name;
    return event.partnerId === profile.id || event.submittedProfileId === profile.id || event.proposalAuthorType === 'partner' && event.submittedProfileName === profile.name;
  });
}

function MiniCalendar({ events }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const marked = new Set(events.map(eventDate).filter(Boolean).map(d => d.toISOString().slice(0, 10)));
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <GlassCard style={{ borderRadius: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 860 }}>
          {today.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
        </div>
        <GlassBadge tone="gold">{events.length} событий</GlassBadge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
          <div key={day} style={{ color: APG2_PROFILE.textMuted, fontSize: 10, textAlign: 'center', fontWeight: 820 }}>{day}</div>
        ))}
        {cells.map((day, idx) => {
          const key = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : `empty-${idx}`;
          const isToday = day === today.getDate();
          const hasEvent = marked.has(key);
          return (
            <div key={key} style={{ minHeight: 34, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isToday ? '#17120a' : APG2_PROFILE.textSoft, background: isToday ? APG2_PROFILE.gold : hasEvent ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', border: hasEvent ? '1px solid rgba(215,184,106,0.34)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', fontSize: 12, fontWeight: 820 }}>
              {day || ''}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function EventList({ title, events, emptyText }) {
  return (
    <GlassSection title={title}>
      {!events.length ? (
        <EmptyStateV2 icon="📅" title={emptyText} text="Когда появится мероприятие, оно будет видно здесь." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {events.map(event => {
            const statusKey = eventStatus(event);
            const meta = STATUS_META[statusKey] || [event.status || 'Черновик', 'glass'];
            return (
              <GlassCard key={event.id} style={{ borderRadius: 26, padding: 13, display: 'grid', gridTemplateColumns: '48px 1fr', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 19, overflow: 'hidden', background: APG2_PROFILE.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  {event.coverPhoto ? <img src={event.coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (event.emoji || '🎉')}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                    <GlassBadge tone={meta[1]} style={{ fontSize: 10, padding: '4px 8px' }}>{meta[0]}</GlassBadge>
                    <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 720 }}>{registrations(event)} регистраций</span>
                  </div>
                  <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 830, overflowWrap: 'anywhere' }}>{event.title || 'Без названия'}</div>
                  <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 3 }}>{formatEventDate(event)}{event.time ? ` · ${event.time}` : ''}</div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </GlassSection>
  );
}

function ProposalModal({ open, profile, type, onClose, onCreated, onToast }) {
  const [form, setForm] = useState({ title: '', date: '', time: '', place: '', description: '', coverPhoto: '', maxParticipants: '', price: '', linkUrl: '', comment: '' });
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const input = {
    width: '100%',
    minHeight: 48,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.24)',
    background: 'rgba(255,255,255,0.16)',
    color: APG2_PROFILE.text,
    padding: '12px 13px',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
  };
  const label = { display: 'block', color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760, margin: '10px 0 6px' };
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!form.title.trim() || !form.date.trim()) {
      onToast?.('Укажите название и дату мероприятия.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await userAction('event:propose', {
        authorType: type,
        profileId: profile.id,
        event: {
          ...form,
          partner: type === 'partner' ? profile.name : '',
          maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : 0,
        },
      });
      onCreated?.({ ...result.event, id: result.id, submittedProfileId: profile.id, submittedProfileName: profile.name, [type === 'expert' ? 'expertId' : 'partnerId']: profile.id, [type === 'expert' ? 'expert' : 'partner']: profile.name });
      onToast?.('Предложение отправлено на модерацию.', 'success');
      setForm({ title: '', date: '', time: '', place: '', description: '', coverPhoto: '', maxParticipants: '', price: '', linkUrl: '', comment: '' });
      onClose?.();
    } catch (error) {
      onToast?.(error.message || 'Не удалось отправить предложение.', 'error');
    }
    setSaving(false);
  };

  return (
    <ApgModal title="Предложить мероприятие" subtitle="Администратор проверит детали перед публикацией." onClose={onClose} maxWidth={520}>
      <label style={label}>Название</label>
      <input style={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Мастер-класс, лекция, встреча" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={label}>Дата</label><input style={input} type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
        <div><label style={label}>Время</label><input style={input} type="time" value={form.time} onChange={e => set('time', e.target.value)} /></div>
      </div>
      <label style={label}>Место</label>
      <input style={input} value={form.place} onChange={e => set('place', e.target.value)} placeholder="Адрес или онлайн-площадка" />
      <label style={label}>Описание</label>
      <textarea style={{ ...input, minHeight: 110, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Коротко о программе и для кого мероприятие" />
      <label style={label}>Фотография</label>
      <PhotoUpload value={form.coverPhoto} onChange={url => set('coverPhoto', url)} folder="events" label="Загрузить фото" shape="cover" theme={{ chipBg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.24)', textSec: APG2_PROFILE.textSoft, gold: APG2_PROFILE.gold }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={label}>Макс. участников</label><input style={input} type="number" min="0" value={form.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} placeholder="30" /></div>
        <div><label style={label}>Стоимость</label><input style={input} value={form.price} onChange={e => set('price', e.target.value)} placeholder="Бесплатно / 1500 ₽" /></div>
      </div>
      <label style={label}>Ссылка</label>
      <input style={input} value={form.linkUrl} onChange={e => set('linkUrl', e.target.value)} placeholder="https://..." />
      <label style={label}>Комментарий для администратора</label>
      <textarea style={{ ...input, minHeight: 76, resize: 'vertical' }} value={form.comment} onChange={e => set('comment', e.target.value)} placeholder="Что важно учесть при модерации" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
        <GlassButton onClick={onClose}>Закрыть</GlassButton>
        <GlassButton tone="gold" disabled={saving} onClick={submit}>{saving ? 'Отправляем...' : 'Отправить'}</GlassButton>
      </div>
    </ApgModal>
  );
}

export function CabinetEventsBlock({ type = 'partner', profile, events = [], onEventCreated, onToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const list = useMemo(() => profileEvents(events, profile, type), [events, profile, type]);
  const future = list.filter(event => {
    const date = eventDate(event);
    return !date || date.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
  }).sort((a, b) => (eventDate(a)?.getTime() || 0) - (eventDate(b)?.getTime() || 0));
  const past = list.filter(event => {
    const date = eventDate(event);
    return date && date.getTime() < Date.now() - 24 * 60 * 60 * 1000;
  }).sort((a, b) => (eventDate(b)?.getTime() || 0) - (eventDate(a)?.getTime() || 0));
  const next = future[0] || null;

  return (
    <>
      <GlassSection
        title={type === 'expert' ? 'Расписание' : 'Календарь'}
        action={<GlassButton tone="gold" onClick={() => setModalOpen(true)} style={{ minHeight: 38, borderRadius: 17, padding: '8px 11px', color: '#17120a' }}>Предложить мероприятие</GlassButton>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
          <StatPill label="всего" value={list.length} />
          <StatPill label="будущих" value={future.length} tone="gold" />
          <StatPill label="регистраций" value={list.reduce((sum, event) => sum + registrations(event), 0)} />
        </div>
        <MiniCalendar events={list} />
      </GlassSection>

      {type === 'expert' && next && (
        <GlassSection title="Ближайшее мероприятие">
          <GlassCard tone="gold" style={{ borderRadius: 30 }}>
            <div style={{ color: '#17120a', fontSize: 19, lineHeight: '23px', fontWeight: 930 }}>{next.title}</div>
            <div style={{ color: 'rgba(23,18,10,0.66)', fontSize: 13, lineHeight: '19px', marginTop: 6 }}>{formatEventDate(next)}{next.location ? ` · ${next.location}` : ''}</div>
          </GlassCard>
        </GlassSection>
      )}

      {type === 'expert' && (
        <EventList
          title="Форматы"
          events={future.filter(event => ['masterclass', 'consultation', 'lecture', 'webinar'].includes(String(event.category || event.format || '').toLowerCase())).slice(0, 8)}
          emptyText="Мастер-классы, консультации, лекции и вебинары пока не запланированы"
        />
      )}
      <EventList title={type === 'expert' ? 'Будущие мероприятия' : 'Будущие мероприятия'} events={future} emptyText="Будущих мероприятий пока нет" />
      <EventList title={type === 'expert' ? 'История мероприятий' : 'Прошедшие мероприятия'} events={past} emptyText="История пока пуста" />
      <ProposalModal open={modalOpen} profile={profile} type={type} onClose={() => setModalOpen(false)} onCreated={onEventCreated} onToast={onToast} />
    </>
  );
}
