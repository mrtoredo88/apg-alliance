import React, { useEffect, useMemo, useRef, useState } from 'react';
import PhotoUpload from '../PhotoUpload.jsx';
import { MdEditor } from '../components/MdEditor.jsx';
import { userAction } from '../userApi.js';
import { buildDaySlots, findEventConflicts, formatConflictLabel, getEventInterval } from '../eventSchedule.js';
import {
  filterWorkspaceEvents,
  findWorkspaceEventConflicts,
  isWorkspaceEventPast,
  workspaceEventStatus,
  workspaceEventStatusLabel,
} from '../../server-shared/workspace-events.js';
import { WorkspaceRelatedLinks, buildWorkspaceRelatedLinks, readWorkspaceLinkIntent } from './WorkspaceLinks.jsx';

const WSE = {
  text: 'var(--apg-workspace-text, #1F1A14)',
  soft: 'var(--apg-workspace-soft, rgba(31,26,20,0.64))',
  muted: 'var(--apg-workspace-muted, rgba(31,26,20,0.46))',
  line: 'var(--apg-workspace-line, rgba(88,67,37,0.12))',
  card: 'var(--apg-workspace-card, rgba(255,255,255,0.78))',
  strong: 'var(--apg-workspace-card-strong, rgba(255,255,255,0.92))',
  control: 'var(--apg-workspace-control, rgba(255,255,255,0.72))',
  controlSoft: 'var(--apg-workspace-control-soft, rgba(255,255,255,0.64))',
  gold: '#C89B3C',
  green: '#2EB36B',
  red: '#D95D54',
  blue: '#5B8FDB',
  shadow: 'var(--apg-workspace-shadow-soft, 0 22px 62px rgba(82,60,30,0.10))',
};

const EVENT_CATEGORIES = [
  { id: 'economy', label: 'Экономика', color: '#6AABEC' },
  { id: 'society', label: 'Общество', color: '#A78BFA' },
  { id: 'sport', label: 'Спорт', color: '#2EB36B' },
  { id: 'culture', label: 'Культура', color: '#E39A35' },
  { id: 'education', label: 'Образование', color: '#38BDF8' },
  { id: 'transport', label: 'Транспорт', color: '#FB923C' },
];

const STATUS_TONES = {
  draft: WSE.muted,
  moderation: WSE.gold,
  pending_review: WSE.gold,
  revision_requested: WSE.red,
  rejected: WSE.red,
  approved: WSE.green,
  published: WSE.green,
  completed: WSE.blue,
  archived: WSE.muted,
  deleted: WSE.red,
};

function cardStyle(extra = {}) {
  return {
    background: WSE.card,
    border: `1px solid ${WSE.line}`,
    borderRadius: 8,
    boxShadow: WSE.shadow,
    backdropFilter: 'blur(22px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
    ...extra,
  };
}

function buttonStyle(tone = 'light', extra = {}) {
  const primary = tone === 'primary';
  const danger = tone === 'danger';
  return {
    border: `1px solid ${primary ? 'rgba(200,155,60,0.42)' : danger ? 'rgba(217,93,84,0.32)' : WSE.line}`,
    background: primary ? 'linear-gradient(135deg,#F3D98C,#C89B3C)' : danger ? 'rgba(217,93,84,0.10)' : WSE.controlSoft,
    color: primary ? '#241807' : danger ? WSE.red : WSE.text,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 820,
    cursor: 'pointer',
    minHeight: 40,
    ...extra,
  };
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputDateTime(value) {
  const date = toDate(value);
  if (!date) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return 'Дата не указана';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function eventStart(event) {
  return event?.startAt || event?.eventDate || event?.date || event?.createdAt;
}

function eventMetric(event, keys) {
  return keys.reduce((sum, key) => sum || Number(event?.[key] || 0), 0);
}

function eventPrice(event) {
  if (String(event?.priceType || '').toLowerCase() === 'paid' || Number(event?.price || 0) > 0) {
    return `${event.priceIsFrom ? 'от ' : ''}${Number(event.price || 0).toLocaleString('ru-RU')} ${event.currency || '₽'}`;
  }
  return event?.pricePublic || event?.priceClub || 'Бесплатно';
}

function statusTone(event) {
  return STATUS_TONES[workspaceEventStatus(event)] || WSE.muted;
}

function isHiddenStatus(event) {
  const status = workspaceEventStatus(event);
  return ['archived', 'deleted', 'trash'].includes(status) || event?.archived === true || event?.deleted === true;
}

function cleanDraft(event = {}) {
  return {
    title: event.title || '',
    date: event.date || '',
    time: event.time || '',
    partner: event.partner || event.partnerName || '',
    emoji: event.emoji || '🎉',
    description: event.description || '',
    socialUrl: event.socialUrl || '',
    address: event.address || '',
    deadline: event.deadline || '',
    isPrivate: !!event.isPrivate,
    minKeys: event.minKeys || 0,
    maxParticipants: event.maxParticipants || 0,
    eventDate: event.eventDate || '',
    isExpertEvent: !!event.isExpertEvent,
    priceClub: event.priceClub || '',
    pricePublic: event.pricePublic || '',
    linkLabel: event.linkLabel || '',
    linkUrl: event.linkUrl || '',
    priority: event.priority || 0,
    category: event.category || '',
    coverPhoto: event.coverPhoto || '',
    startAt: toInputDateTime(event.startAt || event.eventDate),
    endAt: toInputDateTime(event.endAt),
    location: event.location || event.address || '',
    priceType: event.priceType || (Number(event.price || 0) > 0 ? 'paid' : 'free'),
    price: event.price || 0,
    currency: event.currency || '₽',
    priceIsFrom: !!event.priceIsFrom,
    workspaceComment: event.workspaceComment || '',
  };
}

function buildPatch(draft) {
  return {
    ...draft,
    startAt: draft.startAt ? new Date(draft.startAt).toISOString() : '',
    endAt: draft.endAt ? new Date(draft.endAt).toISOString() : '',
    eventDate: draft.eventDate || (draft.startAt ? new Date(draft.startAt).toISOString() : ''),
    price: draft.priceType === 'paid' ? Number(draft.price || 0) : 0,
    minKeys: Number(draft.minKeys || 0),
    maxParticipants: Number(draft.maxParticipants || 0),
    priority: Number(draft.priority || 0),
  };
}

function KpiCard({ label, value, tone }) {
  return (
    <div style={cardStyle({ padding: 14, minHeight: 72 })}>
      <div style={{ color: WSE.muted, fontSize: 11, fontWeight: 760, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
      <div style={{ color: tone || WSE.text, fontSize: 24, lineHeight: '30px', fontWeight: 920, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function WorkspaceEventCalendar({ events, mode, selectedDate, onSelectDate, onOpen }) {
  const base = toDate(selectedDate) || new Date();
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const dayEvents = events.filter(event => {
    const start = toDate(eventStart(event));
    return start && start.toISOString().slice(0, 10) === base.toISOString().slice(0, 10);
  });
  if (mode === 'day') {
    const slots = buildDaySlots(dayEvents, base);
    return (
      <div style={cardStyle({ padding: 14, display: 'grid', gap: 6 })}>
        {slots.map(slot => (
          <div key={slot.hour} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 10, minHeight: 42, alignItems: 'stretch' }}>
            <div style={{ color: WSE.muted, fontSize: 12, fontWeight: 760 }}>{String(slot.hour).padStart(2, '0')}:00</div>
            <div style={{ borderRadius: 8, border: `1px solid ${slot.state === 'free' ? WSE.line : 'rgba(200,155,60,0.28)'}`, background: slot.state === 'free' ? WSE.controlSoft : 'rgba(200,155,60,0.10)', padding: 8, display: 'grid', gap: 6 }}>
              {!slot.events.length ? <span style={{ color: WSE.muted, fontSize: 12 }}>Свободно</span> : slot.events.map(event => (
                <button key={event.id} onClick={() => onOpen(event)} style={{ ...buttonStyle('light', { textAlign: 'left', minHeight: 32, padding: '6px 8px', borderColor: statusTone(event), color: WSE.text }) }}>{event.title || 'Мероприятие'}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  return (
    <div style={cardStyle({ padding: 14 })}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <div key={day} style={{ color: WSE.muted, fontSize: 11, fontWeight: 820, textAlign: 'center' }}>{day}</div>)}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;
          const date = new Date(base.getFullYear(), base.getMonth(), day);
          const key = date.toISOString().slice(0, 10);
          const matches = events.filter(event => toDate(eventStart(event))?.toISOString().slice(0, 10) === key);
          const isSelected = key === base.toISOString().slice(0, 10);
          return (
            <button key={key} onClick={() => onSelectDate(date)} style={{ border: `1px solid ${isSelected ? 'rgba(200,155,60,0.55)' : WSE.line}`, background: isSelected ? 'rgba(200,155,60,0.16)' : WSE.controlSoft, borderRadius: 8, minHeight: mode === 'week' ? 108 : 86, padding: 8, textAlign: 'left', cursor: 'pointer', overflow: 'hidden' }}>
              <div style={{ color: WSE.text, fontSize: 13, fontWeight: 860, marginBottom: 6 }}>{day}</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {matches.slice(0, mode === 'week' ? 4 : 2).map(event => (
                  <div key={event.id} onClick={e => { e.stopPropagation(); onOpen(event); }} style={{ color: WSE.text, borderLeft: `3px solid ${statusTone(event)}`, background: WSE.control, borderRadius: 6, padding: '4px 6px', fontSize: 11, lineHeight: '14px', fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatDate(eventStart(event)).split(',').pop()} {event.title}
                  </div>
                ))}
                {matches.length > (mode === 'week' ? 4 : 2) && <div style={{ color: WSE.muted, fontSize: 10 }}>+{matches.length - (mode === 'week' ? 4 : 2)}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceEventEditor({ event, events, profileType, profile, onClose, onSaved, onToast }) {
  const storageKey = `apg.workspace.eventDraft.${profileType}.${profile?.id || 'none'}.${event?.id || 'new'}`;
  const [draft, setDraft] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try { return { ...cleanDraft(event), ...JSON.parse(stored) }; } catch {}
    }
    return cleanDraft(event);
  });
  const [saving, setSaving] = useState(false);
  const [autosave, setAutosave] = useState(event?.id ? 'Готово к автосохранению' : 'Локальный черновик');
  const [serverConflicts, setServerConflicts] = useState([]);
  const dirtyRef = useRef(false);

  const patch = useMemo(() => buildPatch(draft), [draft]);
  const localConflicts = useMemo(() => findWorkspaceEventConflicts(events, { ...event, ...patch }, event?.id), [events, event, patch]);
  const scheduleConflicts = useMemo(() => {
    const start = patch.startAt ? new Date(patch.startAt) : null;
    const end = patch.endAt ? new Date(patch.endAt) : null;
    return start ? findEventConflicts(events, start, end, event?.id) : [];
  }, [events, patch, event]);
  const conflicts = serverConflicts.length ? serverConflicts : localConflicts.length ? localConflicts : scheduleConflicts;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(draft));
    dirtyRef.current = true;
  }, [draft, storageKey]);

  useEffect(() => {
    if (!event?.id || !dirtyRef.current) return undefined;
    setAutosave('Сохраняем черновик...');
    const timer = setTimeout(async () => {
      try {
        const result = await userAction('workspace:eventUpdate', { eventId: event.id, profileId: profile.id, profileType, patch });
        setServerConflicts(result.conflicts || []);
        onSaved(result.event);
        setAutosave(result.pendingModeration ? 'Правки ждут модерации' : 'Черновик сохранён');
        dirtyRef.current = false;
      } catch (error) {
        setAutosave(error.message || 'Не удалось сохранить');
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [patch, event?.id, profile?.id, profileType]);

  useEffect(() => {
    const handler = eventKey => {
      if ((eventKey.metaKey || eventKey.ctrlKey) && eventKey.key.toLowerCase() === 's') {
        eventKey.preventDefault();
        saveNow();
      }
    };
    const beforeUnload = eventKey => {
      if (!dirtyRef.current) return;
      eventKey.preventDefault();
      eventKey.returnValue = '';
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  });

  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const input = { width: '100%', minHeight: 44, borderRadius: 8, border: `1px solid ${WSE.line}`, background: WSE.control, color: WSE.text, padding: '10px 12px', fontSize: 14, boxSizing: 'border-box', outline: 'none' };
  const label = { display: 'block', color: WSE.soft, fontSize: 12, fontWeight: 780, margin: '10px 0 6px' };

  async function saveNow() {
    if (!event?.id) return;
    setSaving(true);
    try {
      const result = await userAction('workspace:eventUpdate', { eventId: event.id, profileId: profile.id, profileType, patch });
      setServerConflicts(result.conflicts || []);
      onSaved(result.event);
      setAutosave(result.pendingModeration ? 'Правки ждут модерации' : 'Сохранено');
      dirtyRef.current = false;
      onToast?.('Мероприятие сохранено.', 'success');
    } catch (error) {
      onToast?.(error.message || 'Не удалось сохранить мероприятие.', 'error');
    }
    setSaving(false);
  }

  async function submitModeration() {
    await saveNow();
    setSaving(true);
    try {
      const result = await userAction('workspace:eventSubmit', { eventId: event.id, profileId: profile.id, profileType });
      setServerConflicts(result.conflicts || []);
      onSaved(result.event);
      localStorage.removeItem(storageKey);
      dirtyRef.current = false;
      onToast?.('Мероприятие отправлено на модерацию.', 'success');
      onClose();
    } catch (error) {
      onToast?.(error.message || 'Не удалось отправить на модерацию.', 'error');
    }
    setSaving(false);
  }

  const badInterval = patch.startAt && patch.endAt && new Date(patch.endAt).getTime() <= new Date(patch.startAt).getTime();
  const past = patch.startAt && new Date(patch.startAt).getTime() < Date.now() - 3600000;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(31,26,20,0.32)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '28px 16px 48px' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={cardStyle({ width: '100%', maxWidth: 840, padding: 18 })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ color: WSE.muted, fontSize: 12, fontWeight: 780 }}>Мероприятие · {workspaceEventStatusLabel(event)}</div>
            <h2 style={{ margin: '3px 0 0', color: WSE.text, fontSize: 24, lineHeight: '30px', fontWeight: 920 }}>{draft.title || 'Новое мероприятие'}</h2>
            <div style={{ color: WSE.soft, fontSize: 13, marginTop: 4 }}>{autosave}</div>
          </div>
          <button onClick={onClose} style={buttonStyle('light', { width: 42, minWidth: 42, padding: 0, fontSize: 20 })}>×</button>
        </div>

        {(badInterval || past || conflicts.length > 0) && (
          <div style={cardStyle({ padding: 12, background: 'rgba(217,93,84,0.08)', borderColor: 'rgba(217,93,84,0.24)', marginBottom: 12, boxShadow: 'none' })}>
            {badInterval && <div style={{ color: WSE.red, fontSize: 13, fontWeight: 820 }}>Конец мероприятия должен быть позже начала.</div>}
            {past && <div style={{ color: WSE.red, fontSize: 13, fontWeight: 820 }}>Дата уже прошла. Сохранить можно, но перед публикацией лучше проверить время.</div>}
            {conflicts.length > 0 && <div style={{ color: WSE.red, fontSize: 13, fontWeight: 820 }}>Есть пересечения: {conflicts.slice(0, 3).map(item => item.title ? `«${item.title}»` : formatConflictLabel(item)).join(', ')}</div>}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          <div>
            <label style={label}>Название *</label>
            <input style={input} value={draft.title} onChange={e => set('title', e.target.value)} placeholder="Мастер-класс, лекция, встреча" />
            <label style={label}>Описание</label>
            <MdEditor value={draft.description} onChange={value => set('description', value)} placeholder="Коротко о программе и для кого мероприятие" style={{ ...input, minHeight: 150 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={label}>Начало</label><input style={input} type="datetime-local" value={draft.startAt} onChange={e => set('startAt', e.target.value)} /></div>
              <div><label style={label}>Конец</label><input style={input} type="datetime-local" value={draft.endAt} onChange={e => set('endAt', e.target.value)} /></div>
            </div>
            <label style={label}>Место</label>
            <input style={input} value={draft.location} onChange={e => { set('location', e.target.value); set('address', e.target.value); }} placeholder="Зеленоград, корпус..." />
            <label style={label}>Ссылка на регистрацию или подробности</label>
            <input style={input} value={draft.linkUrl} onChange={e => set('linkUrl', e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label style={label}>Обложка</label>
            <PhotoUpload value={draft.coverPhoto} onChange={url => set('coverPhoto', url)} folder="events" label="Загрузить обложку" shape="cover" theme={{ chipBg: WSE.controlSoft, border: WSE.line, textSec: WSE.soft, gold: WSE.gold }} />
            {draft.coverPhoto && <img src={draft.coverPhoto} alt="" loading="lazy" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={label}>Эмодзи</label><input style={input} value={draft.emoji} onChange={e => set('emoji', e.target.value.slice(0, 4))} /></div>
              <div><label style={label}>Лимит</label><input style={input} type="number" min="0" value={draft.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} /></div>
            </div>
            <label style={label}>Категория</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EVENT_CATEGORIES.map(category => (
                <button key={category.id} onClick={() => set('category', draft.category === category.id ? '' : category.id)} style={buttonStyle('light', { minHeight: 32, padding: '6px 9px', color: draft.category === category.id ? category.color : WSE.soft, borderColor: draft.category === category.id ? category.color : WSE.line })}>{category.label}</button>
              ))}
            </div>
            <label style={label}>Стоимость</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select style={input} value={draft.priceType} onChange={e => set('priceType', e.target.value)}><option value="free">Бесплатно</option><option value="paid">Платно</option></select>
              <input style={input} type="number" min="0" value={draft.price} onChange={e => set('price', e.target.value)} disabled={draft.priceType !== 'paid'} />
            </div>
            <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none' }}><input type="checkbox" checked={draft.isPrivate} onChange={e => set('isPrivate', e.target.checked)} /> Закрытое мероприятие по ключам</label>
            {draft.isPrivate && <input style={input} type="number" min="0" value={draft.minKeys} onChange={e => set('minKeys', e.target.value)} placeholder="Минимум ключей" />}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button disabled={saving || badInterval} onClick={saveNow} style={buttonStyle('light', { opacity: saving || badInterval ? 0.55 : 1 })}>{saving ? 'Сохраняем...' : 'Сохранить'}</button>
          <button disabled={saving || badInterval || !draft.title.trim()} onClick={submitModeration} style={buttonStyle('primary', { opacity: saving || badInterval || !draft.title.trim() ? 0.55 : 1 })}>Отправить на модерацию</button>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, events, profile, actions: workspaceActions, onEdit, onSubmit, onDuplicate, onArchive, onDelete, onStats, onPublic }) {
  const status = workspaceEventStatus(event);
  const cardActions = [];
  if (['draft', 'revision_requested', 'rejected'].includes(status)) cardActions.push(['Продолжить', onEdit, 'primary'], ['На модерацию', onSubmit, 'light']);
  if (['moderation', 'pending_review'].includes(status)) cardActions.push(['Открыть', onEdit, 'light']);
  if (['published', 'approved'].includes(status)) cardActions.push(['Редактировать', onEdit, 'light'], ['Публичная карточка', onPublic, 'light']);
  if (!['deleted', 'trash'].includes(status)) cardActions.push(['Создать похожее', onDuplicate, 'light'], ['Статистика', onStats, 'light']);
  if (!['archived', 'deleted', 'trash'].includes(status)) cardActions.push(['Архив', onArchive, 'light']);
  if (['draft', 'rejected', 'archived'].includes(status)) cardActions.push(['Удалить', onDelete, 'danger']);

  return (
    <div style={cardStyle({ padding: 12, display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 12 })}>
      <div style={{ width: 72, height: 72, borderRadius: 8, background: 'rgba(200,155,60,0.12)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
        {event.coverPhoto ? <img src={event.coverPhoto} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (event.emoji || '🎉')}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ color: statusTone(event), background: WSE.controlSoft, border: `1px solid ${statusTone(event)}55`, borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 840 }}>{workspaceEventStatusLabel(event)}</span>
          <span style={{ color: WSE.muted, fontSize: 11, fontWeight: 760 }}>{formatDate(eventStart(event))}</span>
          <span style={{ color: WSE.muted, fontSize: 11, fontWeight: 760 }}>{eventPrice(event)}</span>
        </div>
        <div style={{ color: WSE.text, fontSize: 16, lineHeight: '21px', fontWeight: 900, marginTop: 7, overflowWrap: 'anywhere' }}>{event.title || 'Без названия'}</div>
        <div style={{ color: WSE.soft, fontSize: 12, lineHeight: '17px', marginTop: 4 }}>{event.location || event.address || 'Место не указано'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: WSE.muted, fontSize: 11, marginTop: 8 }}>
          <span>просмотры: {eventMetric(event, ['views', 'viewsCount', 'openCount', 'opensCount'])}</span>
          <span>регистрации: {eventMetric(event, ['registeredCount', 'registrationsCount'])}</span>
          <span>изменено: {formatDate(event.updatedAt || event.createdAt)}</span>
        </div>
        {(event.moderationComment || event.adminComment || event.rejectionReason) && (
          <div style={{ marginTop: 8, color: WSE.red, fontSize: 12, lineHeight: '17px', background: 'rgba(217,93,84,0.08)', borderRadius: 8, padding: 8 }}>{event.moderationComment || event.adminComment || event.rejectionReason}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {cardActions.map(([label, fn, tone]) => <button key={label} onClick={() => fn(event)} style={buttonStyle(tone, { minHeight: 32, padding: '6px 9px', fontSize: 12 })}>{label}</button>)}
        </div>
        <WorkspaceRelatedLinks
          compact
          links={buildWorkspaceRelatedLinks({ source: 'event', item: event, events, profile })}
          actions={workspaceActions}
          style={{ marginTop: 10 }}
        />
      </div>
    </div>
  );
}

export function WorkspaceEventsManager({ role, profile, roleViews = [], activeViewId, onRoleChange, events = [], actions, onOpenPublicEvents, onEventChanged, onToast }) {
  const initialIntent = useMemo(() => readWorkspaceLinkIntent('events') || {}, []);
  const profileType = role?.id === 'expert' ? 'expert' : 'partner';
  const [localEvents, setLocalEvents] = useState(events || []);
  const [query, setQuery] = useState(initialIntent.query || '');
  const [statusFilter, setStatusFilter] = useState('active');
  const [dateFilter, setDateFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [calendarMode, setCalendarMode] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editing, setEditing] = useState(null);
  const [statsEvent, setStatsEvent] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLocalEvents(events || []), [events]);

  useEffect(() => {
    if (!initialIntent.eventId || editing?.id) return;
    const found = localEvents.find(item => String(item.id || '') === String(initialIntent.eventId));
    if (found) setEditing(found);
  }, [initialIntent.eventId, localEvents, editing?.id]);

  const ownedEvents = useMemo(() => filterWorkspaceEvents(localEvents, profile, profileType, { includeDeleted: true }), [localEvents, profile, profileType]);
  const visibleEvents = useMemo(() => {
    const text = query.trim().toLowerCase();
    return ownedEvents
      .filter(event => {
        const status = workspaceEventStatus(event);
        if (statusFilter === 'active' && isHiddenStatus(event)) return false;
        if (statusFilter !== 'active' && statusFilter !== 'all' && status !== statusFilter) return false;
        if (dateFilter === 'upcoming' && isWorkspaceEventPast(event)) return false;
        if (dateFilter === 'past' && !isWorkspaceEventPast(event)) return false;
        if (!text) return true;
        return [event.title, event.description, event.location, event.address, event.partner, event.expertName].some(value => String(value || '').toLowerCase().includes(text));
      })
      .sort((a, b) => (toDate(eventStart(a))?.getTime() || 0) - (toDate(eventStart(b))?.getTime() || 0));
  }, [ownedEvents, query, statusFilter, dateFilter]);

  const activeEvents = ownedEvents.filter(event => !isHiddenStatus(event));
  const upcoming = activeEvents.filter(event => !isWorkspaceEventPast(event)).sort((a, b) => (toDate(eventStart(a))?.getTime() || 0) - (toDate(eventStart(b))?.getTime() || 0));
  const kpi = {
    total: ownedEvents.length,
    drafts: ownedEvents.filter(event => workspaceEventStatus(event) === 'draft').length,
    moderation: ownedEvents.filter(event => ['moderation', 'pending_review'].includes(workspaceEventStatus(event))).length,
    published: ownedEvents.filter(event => ['published', 'approved'].includes(workspaceEventStatus(event))).length,
    upcoming: upcoming.length,
    past: ownedEvents.filter(event => isWorkspaceEventPast(event)).length,
    views: ownedEvents.reduce((sum, event) => sum + eventMetric(event, ['views', 'viewsCount', 'openCount', 'opensCount']), 0),
    registrations: ownedEvents.reduce((sum, event) => sum + eventMetric(event, ['registeredCount', 'registrationsCount']), 0),
  };

  const upsertEvent = event => {
    const clean = { ...event };
    setLocalEvents(prev => {
      const index = prev.findIndex(item => item.id === clean.id);
      if (index === -1) return [clean, ...prev];
      return prev.map(item => item.id === clean.id ? { ...item, ...clean } : item);
    });
    onEventChanged?.(clean);
  };

  async function createEvent() {
    if (!profile?.id || busy) return;
    setBusy(true);
    try {
      const result = await userAction('workspace:eventCreate', { profileId: profile.id, profileType, idempotencyKey: `create_${profileType}_${profile.id}_${Date.now()}` });
      upsertEvent(result.event);
      setEditing(result.event);
      onToast?.('Черновик мероприятия создан.', 'success');
    } catch (error) {
      onToast?.(error.message || 'Не удалось создать мероприятие.', 'error');
    }
    setBusy(false);
  }

  async function submitEvent(event) {
    try {
      const result = await userAction('workspace:eventSubmit', { eventId: event.id, profileId: profile.id, profileType });
      upsertEvent(result.event);
      onToast?.('Мероприятие отправлено на модерацию.', 'success');
    } catch (error) {
      onToast?.(error.message || 'Не удалось отправить на модерацию.', 'error');
    }
  }

  async function duplicateEvent(event) {
    try {
      const result = await userAction('workspace:eventDuplicate', { eventId: event.id, profileId: profile.id, profileType });
      upsertEvent(result.event);
      setEditing(result.event);
      onToast?.('Создан похожий черновик.', 'success');
    } catch (error) {
      onToast?.(error.message || 'Не удалось дублировать мероприятие.', 'error');
    }
  }

  async function lifecycle(event, action) {
    const title = action === 'workspace:eventDelete' ? 'Удалить черновик?' : 'Архивировать мероприятие?';
    if (!window.confirm(title)) return;
    try {
      const result = await userAction(action, { eventId: event.id, profileId: profile.id, profileType });
      upsertEvent(result.event);
      onToast?.(action === 'workspace:eventDelete' ? 'Мероприятие удалено.' : 'Мероприятие отправлено в архив.', 'success');
    } catch (error) {
      onToast?.(error.message || 'Не удалось изменить статус.', 'error');
    }
  }

  if (!profile?.id) {
    return (
      <div style={cardStyle({ padding: 24 })}>
        <h2 style={{ margin: 0, color: WSE.text, fontSize: 26 }}>Мои мероприятия</h2>
        <p style={{ color: WSE.soft, fontSize: 14, lineHeight: '21px' }}>Для рабочего центра нужен профиль партнёра или эксперта. Как только профиль будет связан с аккаунтом, здесь появятся черновики, календарь и модерация.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={cardStyle({ padding: 18, display: 'grid', gap: 14 })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280 }}>
            <div style={{ color: WSE.muted, fontSize: 12, fontWeight: 820, textTransform: 'uppercase', letterSpacing: 0 }}>Рабочий центр</div>
            <h1 style={{ margin: '4px 0 5px', color: WSE.text, fontSize: 30, lineHeight: '36px', fontWeight: 940 }}>Мои мероприятия</h1>
            <div style={{ color: WSE.soft, fontSize: 14, lineHeight: '21px' }}>Черновики, модерация, календарь, конфликты времени и статистика событий профиля.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {roleViews.length > 1 && roleViews.filter(view => ['partner', 'expert'].includes(view.id)).map(view => (
              <button key={view.id} onClick={() => onRoleChange?.(view.id)} style={buttonStyle(activeViewId === view.id ? 'primary' : 'light')}>{view.label}</button>
            ))}
            <button disabled={busy} onClick={createEvent} style={buttonStyle('primary', { opacity: busy ? 0.6 : 1 })}>Создать мероприятие</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 10 }}>
          <KpiCard label="Всего" value={kpi.total} />
          <KpiCard label="Черновики" value={kpi.drafts} />
          <KpiCard label="Модерация" value={kpi.moderation} tone={WSE.gold} />
          <KpiCard label="Опубликовано" value={kpi.published} tone={WSE.green} />
          <KpiCard label="Ближайшие" value={kpi.upcoming} tone={WSE.blue} />
          <KpiCard label="Прошедшие" value={kpi.past} />
          <KpiCard label="Просмотры" value={kpi.views} />
          <KpiCard label="Регистрации" value={kpi.registrations} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по названию, месту, описанию" style={{ minHeight: 42, borderRadius: 8, border: `1px solid ${WSE.line}`, padding: '0 12px', background: WSE.control, color: WSE.text, outline: 'none' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={buttonStyle('light')}><option value="active">Активные</option><option value="all">Все</option><option value="draft">Черновики</option><option value="pending_review">Модерация</option><option value="published">Опубликовано</option><option value="completed">Завершено</option><option value="archived">Архив</option></select>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={buttonStyle('light')}><option value="all">Все даты</option><option value="upcoming">Будущие</option><option value="past">Прошедшие</option></select>
          <select value={viewMode} onChange={e => setViewMode(e.target.value)} style={buttonStyle('light')}><option value="list">Список</option><option value="calendar">Календарь</option></select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {viewMode === 'calendar' && (
            <>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: WSE.text, fontSize: 18, fontWeight: 900 }}>{selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['month', 'week', 'day'].map(mode => <button key={mode} onClick={() => setCalendarMode(mode)} style={buttonStyle(calendarMode === mode ? 'primary' : 'light', { minHeight: 34, padding: '6px 10px' })}>{mode === 'month' ? 'Месяц' : mode === 'week' ? 'Неделя' : 'День'}</button>)}
                </div>
              </div>
              <WorkspaceEventCalendar events={visibleEvents} mode={calendarMode} selectedDate={selectedDate} onSelectDate={setSelectedDate} onOpen={setEditing} />
            </>
          )}
          {viewMode === 'list' && !visibleEvents.length && (
            <div style={cardStyle({ padding: 28, textAlign: 'center' })}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🎉</div>
              <div style={{ color: WSE.text, fontSize: 20, fontWeight: 920 }}>Мероприятий пока нет</div>
              <div style={{ color: WSE.soft, fontSize: 14, lineHeight: '21px', marginTop: 6 }}>Создайте первый черновик или измените фильтры.</div>
              <button onClick={createEvent} style={buttonStyle('primary', { marginTop: 14 })}>Создать мероприятие</button>
            </div>
          )}
          {viewMode === 'list' && visibleEvents.map(event => (
            <EventCard key={event.id} event={event} events={ownedEvents} profile={profile} actions={actions} onEdit={setEditing} onSubmit={submitEvent} onDuplicate={duplicateEvent} onArchive={item => lifecycle(item, 'workspace:eventArchive')} onDelete={item => lifecycle(item, 'workspace:eventDelete')} onStats={setStatsEvent} onPublic={onOpenPublicEvents} />
          ))}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={cardStyle({ padding: 14 })}>
            <div style={{ color: WSE.text, fontSize: 17, fontWeight: 900, marginBottom: 10 }}>Ближайшие</div>
            {!upcoming.length ? <div style={{ color: WSE.soft, fontSize: 13, lineHeight: '19px' }}>Будущих мероприятий нет. Прошедшие события не попадают в этот блок.</div> : upcoming.slice(0, 5).map(event => (
              <button key={event.id} onClick={() => setEditing(event)} style={{ width: '100%', border: 0, background: 'transparent', padding: '9px 0', borderBottom: `1px solid ${WSE.line}`, textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ color: WSE.muted, fontSize: 11, fontWeight: 760 }}>{formatDate(eventStart(event))}</div>
                <div style={{ color: WSE.text, fontSize: 14, lineHeight: '19px', fontWeight: 860 }}>{event.title || 'Мероприятие'}</div>
              </button>
            ))}
          </div>
          <div style={cardStyle({ padding: 14 })}>
            <div style={{ color: WSE.text, fontSize: 17, fontWeight: 900, marginBottom: 10 }}>Конфликты</div>
            {ownedEvents.flatMap(event => findWorkspaceEventConflicts(ownedEvents, event, event.id).map(conflict => [event, conflict])).slice(0, 4).length === 0 ? (
              <div style={{ color: WSE.soft, fontSize: 13, lineHeight: '19px' }}>Пересечений по времени не найдено.</div>
            ) : ownedEvents.flatMap(event => findWorkspaceEventConflicts(ownedEvents, event, event.id).map(conflict => [event, conflict])).slice(0, 4).map(([event, conflict]) => (
              <div key={`${event.id}_${conflict.id}`} style={{ color: WSE.red, fontSize: 12, lineHeight: '17px', marginBottom: 8 }}>{event.title} пересекается с {conflict.title}</div>
            ))}
          </div>
        </div>
      </div>

      {editing && <WorkspaceEventEditor event={editing} events={ownedEvents} profileType={profileType} profile={profile} onClose={() => setEditing(null)} onSaved={upsertEvent} onToast={onToast} />}
      {statsEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1190, background: 'rgba(31,26,20,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setStatsEvent(null); }}>
          <div style={cardStyle({ width: '100%', maxWidth: 440, padding: 18 })}>
            <h2 style={{ margin: 0, color: WSE.text, fontSize: 22 }}>Статистика</h2>
            <div style={{ color: WSE.soft, fontSize: 14, marginTop: 4 }}>{statsEvent.title || 'Мероприятие'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <KpiCard label="Просмотры" value={eventMetric(statsEvent, ['views', 'viewsCount', 'openCount', 'opensCount'])} />
              <KpiCard label="Регистрации" value={eventMetric(statsEvent, ['registeredCount', 'registrationsCount'])} />
              <KpiCard label="Сохранения" value={eventMetric(statsEvent, ['savesCount', 'savedCount'])} />
              <KpiCard label="Переходы" value={eventMetric(statsEvent, ['clicksCount', 'linkClicks'])} />
            </div>
            <WorkspaceRelatedLinks
              links={buildWorkspaceRelatedLinks({ source: 'event', item: statsEvent, events: ownedEvents, profile, analytics: true })}
              actions={actions}
              style={{ marginTop: 12, boxShadow: 'none' }}
            />
            <div style={{ color: WSE.muted, fontSize: 12, lineHeight: '18px', marginTop: 12 }}>Показываются только реально сохранённые метрики. Если сбор данных для показателя ещё не подключён, значение остаётся нулевым.</div>
            <button onClick={() => setStatsEvent(null)} style={buttonStyle('primary', { width: '100%', marginTop: 14 })}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
