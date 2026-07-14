import React, { useEffect, useMemo, useRef, useState } from 'react';
import { userAction } from '../userApi.js';
import {
  BOOKING_STATUSES,
  buildBookingCalendar,
  buildBookingProfile,
  formatBookingDateKey,
  groupBookingsForProfile,
  normalizeBooking,
} from '../../server-shared/booking.js';
import {
  buildBookingContactActions,
  buildFreeTimeSlots,
  buildWorkspaceBookingKpis,
  buildWorkspaceBookingSearchText,
  filterWorkspaceBookings,
  getBookingSourceLabel,
  isWorkspaceBookingArchived,
  sanitizeBookingInternalNotes,
} from '../../server-shared/workspace-bookings.js';
import { WorkspaceRelatedLinks, buildWorkspaceRelatedLinks, readWorkspaceLinkIntent } from './WorkspaceLinks.jsx';

const CRM = {
  text: '#1F1A14',
  soft: 'rgba(31,26,20,0.64)',
  muted: 'rgba(31,26,20,0.46)',
  line: 'rgba(88,67,37,0.12)',
  card: 'rgba(255,255,255,0.78)',
  strong: 'rgba(255,255,255,0.94)',
  gold: '#C89B3C',
  green: '#2EB36B',
  red: '#D95D54',
  blue: '#5B8FDB',
  shadow: '0 22px 62px rgba(82,60,30,0.10)',
};

const STATUS_COLORS = {
  pending: CRM.gold,
  new: CRM.gold,
  confirmed: CRM.green,
  reschedule_requested: CRM.blue,
  rescheduled: CRM.blue,
  cancelled: CRM.red,
  cancelled_by_user: CRM.red,
  cancelled_by_provider: CRM.red,
  completed: CRM.green,
  no_show: CRM.red,
  archived: CRM.muted,
};

function card(extra = {}) {
  return {
    background: CRM.card,
    border: `1px solid ${CRM.line}`,
    borderRadius: 8,
    boxShadow: CRM.shadow,
    backdropFilter: 'blur(22px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
    ...extra,
  };
}

function button(tone = 'light', extra = {}) {
  const primary = tone === 'primary';
  const danger = tone === 'danger';
  return {
    border: `1px solid ${primary ? 'rgba(200,155,60,0.46)' : danger ? 'rgba(217,93,84,0.34)' : CRM.line}`,
    background: primary ? 'linear-gradient(135deg,#F3D98C,#C89B3C)' : danger ? 'rgba(217,93,84,0.10)' : 'rgba(255,255,255,0.64)',
    color: primary ? '#241807' : danger ? CRM.red : CRM.text,
    borderRadius: 8,
    padding: '9px 11px',
    minHeight: 38,
    fontSize: 13,
    fontWeight: 820,
    cursor: 'pointer',
    fontFamily: 'inherit',
    ...extra,
  };
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateRange(mode) {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  if (mode === 'day') to.setDate(to.getDate() + 1);
  else if (mode === 'month') to.setDate(to.getDate() + 42);
  else to.setDate(to.getDate() + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

function sameDay(item, date) {
  const key = formatBookingDateKey(date);
  return item.dateKey === key || formatBookingDateKey(item.startAt) === key;
}

function formatTime(item) {
  return item.time || toDate(item.startAt)?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) || '—';
}

function formatDateTime(item) {
  const date = toDate(item.startAt);
  if (!date) return [item.dateLabel, item.time].filter(Boolean).join(' ') || 'Дата не указана';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function avatarText(name = '') {
  const parts = String(name || 'Клиент').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'К') + (parts[1]?.[0] || '');
}

function contactHref(kind, value) {
  if (!value) return '';
  if (kind === 'phone') return `tel:${String(value).replace(/[^\d+]/g, '')}`;
  if (kind === 'telegram') return String(value).startsWith('http') ? value : `https://telegram.me/${String(value).replace(/^@+/, '')}`;
  if (kind === 'whatsapp') return String(value).startsWith('http') ? value : `https://wa.me/${String(value).replace(/\D/g, '')}`;
  if (kind === 'email') return `mailto:${value}`;
  return '';
}

function Kpi({ label, value, color }) {
  return (
    <div style={card({ padding: 13, minHeight: 70, boxShadow: '0 12px 32px rgba(82,60,30,0.07)' })}>
      <div style={{ color: CRM.muted, fontSize: 11, fontWeight: 780, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
      <div style={{ color: color || CRM.text, fontSize: 24, lineHeight: '29px', fontWeight: 930, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ item }) {
  const color = STATUS_COLORS[item.status] || CRM.muted;
  return <span style={{ color, border: `1px solid ${color}55`, background: `${color}13`, borderRadius: 999, padding: '5px 8px', fontSize: 11, fontWeight: 850, whiteSpace: 'nowrap' }}>{item.statusLabel || 'Статус'}</span>;
}

function MeetingCard({ item, onOpen, onAction, onOpenDialog, onArchive, onReschedule }) {
  const contacts = buildBookingContactActions(item);
  const color = STATUS_COLORS[item.status] || CRM.muted;
  const lastHistory = [...(item.statusHistory || []), ...(item.workspaceHistory || [])].filter(Boolean).slice(-1)[0];
  return (
    <div draggable onDragStart={event => event.dataTransfer.setData('text/plain', item.id || item.bookingId)} style={card({ padding: 12, display: 'grid', gridTemplateColumns: '54px minmax(0,1fr)', gap: 12, borderLeft: `4px solid ${color}` })}>
      <button onClick={() => onOpen(item)} style={{ border: 0, width: 54, height: 54, borderRadius: 8, background: `${color}16`, color, fontSize: 18, fontWeight: 930, cursor: 'pointer' }}>
        {item.userPhoto ? <img src={item.userPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : avatarText(item.userName)}
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge item={item} />
          <span style={{ color: CRM.muted, fontSize: 11, fontWeight: 760 }}>{formatDateTime(item)}</span>
          <span style={{ color: CRM.muted, fontSize: 11, fontWeight: 760 }}>{getBookingSourceLabel(item)}</span>
        </div>
        <button onClick={() => onOpen(item)} style={{ display: 'block', width: '100%', border: 0, background: 'transparent', padding: '7px 0 0', textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ color: CRM.text, fontSize: 16, lineHeight: '21px', fontWeight: 920, overflowWrap: 'anywhere' }}>{item.userName || 'Клиент'}</div>
          <div style={{ color: CRM.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 3 }}>{item.serviceTitle || 'Услуга'} · {item.specialistName || 'Специалист'} · {item.address || 'Место не указано'}</div>
        </button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: CRM.muted, fontSize: 11.5, marginTop: 8 }}>
          {contacts.phone && <span>{contacts.phone}</span>}
          {contacts.telegram && <span>Telegram</span>}
          {contacts.email && <span>{contacts.email}</span>}
          {item.dialogId && <span>диалог есть</span>}
        </div>
        {(item.internalNotes || item.comment || lastHistory?.text) && <div style={{ color: CRM.soft, background: 'rgba(88,67,37,0.05)', borderRadius: 8, padding: 8, fontSize: 12, lineHeight: '17px', marginTop: 8 }}>{item.internalNotes || item.comment || lastHistory.text}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          {[BOOKING_STATUSES.pending, BOOKING_STATUSES.new].includes(item.status) && <button onClick={() => onAction('booking:confirm', item)} style={button('primary', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Подтвердить</button>}
          {[BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status) && <button onClick={() => onAction('booking:complete', item)} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Завершить</button>}
          {item.isActive && <button onClick={() => onReschedule(item)} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Перенести</button>}
          {[BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status) && <button onClick={() => onAction('booking:noShow', item, { reason: 'Клиент не пришел' })} style={button('danger', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Неявка</button>}
          {item.isActive && <button onClick={() => onAction('booking:cancel', item, { reason: prompt('Причина отмены') || 'Отменено в Workspace' })} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Отменить</button>}
          {item.dialogId && <button onClick={() => onOpenDialog(item)} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Диалог</button>}
          {item.isFinal && !isWorkspaceBookingArchived(item) && <button onClick={() => onArchive(item)} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Архив</button>}
        </div>
      </div>
    </div>
  );
}

function MeetingCrmSheet({ item, bookings, events, actions, profile, onClose, onAction, onSaved, onOpenDialog, onOpenPanel, onToast, onReschedule }) {
  const [tab, setTab] = useState('main');
  const [notes, setNotes] = useState(() => {
    const stored = localStorage.getItem(`apg.meeting.notes.${item.id || item.bookingId}`);
    return stored ?? item.internalNotes ?? '';
  });
  const [status, setStatus] = useState('Готово');
  const dirtyRef = useRef(false);
  const contacts = buildBookingContactActions(item);
  const relatedEvent = events.find(event => String(event.id || '') === String(item.eventId || item.sourceEventId || ''));
  const previous = bookings
    .filter(row => row.id !== item.id && row.userId === item.userId && row.userId)
    .sort((a, b) => (b.startMs || 0) - (a.startMs || 0))
    .slice(0, 5);

  useEffect(() => {
    localStorage.setItem(`apg.meeting.notes.${item.id || item.bookingId}`, notes);
    dirtyRef.current = true;
    setStatus('Локально сохранено');
  }, [notes, item.id, item.bookingId]);

  useEffect(() => {
    if (!dirtyRef.current) return undefined;
    const timer = setTimeout(async () => {
      try {
        setStatus('Сохраняем...');
        const result = await userAction('booking:workspaceUpdate', { bookingId: item.id || item.bookingId, patch: { internalNotes: sanitizeBookingInternalNotes(notes) } });
        onSaved(result.booking);
        dirtyRef.current = false;
        setStatus('Заметки сохранены');
      } catch (error) {
        setStatus(error.message || 'Не удалось сохранить');
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [notes, item.id, item.bookingId]);

  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        userAction('booking:workspaceUpdate', { bookingId: item.id || item.bookingId, patch: { internalNotes: sanitizeBookingInternalNotes(notes) } })
          .then(result => { onSaved(result.booking); dirtyRef.current = false; setStatus('Сохранено'); })
          .catch(error => setStatus(error.message || 'Не удалось сохранить'));
      }
    };
    const onUnload = event => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [notes, item.id, item.bookingId]);

  const contactButton = (kind, label, value) => {
    const href = contactHref(kind, value);
    if (!href) return null;
    return <a href={href} target={kind === 'phone' || kind === 'email' ? undefined : '_blank'} rel="noreferrer" style={{ ...button('light'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{label}</a>;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(31,26,20,0.32)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '28px 16px 48px' }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={card({ width: '100%', maxWidth: 980, padding: 18, background: CRM.strong })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'start' }}>
          <div>
            <div style={{ color: CRM.muted, fontSize: 12, fontWeight: 780 }}>CRM-карточка встречи · {getBookingSourceLabel(item)}</div>
            <h2 style={{ margin: '4px 0 0', color: CRM.text, fontSize: 26, lineHeight: '32px', fontWeight: 940 }}>{item.userName || 'Клиент'}</h2>
            <div style={{ color: CRM.soft, fontSize: 14, lineHeight: '21px', marginTop: 4 }}>{item.serviceTitle || 'Услуга'} · {formatDateTime(item)} · {item.address || 'место не указано'}</div>
          </div>
          <button onClick={onClose} style={button('light', { width: 40, minWidth: 40, padding: 0, fontSize: 20 })}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
          {['main', 'history', 'notes', 'links'].map(id => <button key={id} onClick={() => setTab(id)} style={button(tab === id ? 'primary' : 'light', { minHeight: 32, padding: '6px 10px' })}>{id === 'main' ? 'Основное' : id === 'history' ? 'История' : id === 'notes' ? 'Заметки' : 'Связи'}</button>)}
        </div>
        {tab === 'main' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10, marginTop: 14 }}>
            {[
              ['Статус', item.statusLabel],
              ['Телефон', contacts.phone || '—'],
              ['Telegram', contacts.telegram ? 'есть' : '—'],
              ['Email', contacts.email || '—'],
              ['Источник', getBookingSourceLabel(item)],
              ['Последнее сообщение', item.lastMessage?.text || item.lastMessageText || '—'],
            ].map(([label, value]) => (
              <div key={label} style={card({ padding: 12, boxShadow: 'none' })}>
                <div style={{ color: CRM.muted, fontSize: 11.5, fontWeight: 800 }}>{label}</div>
                <div style={{ color: CRM.text, fontSize: 14, lineHeight: '19px', fontWeight: 860, marginTop: 4, overflowWrap: 'anywhere' }}>{value || '—'}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'history' && (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {[...(item.statusHistory || []), ...(item.workspaceHistory || [])].filter(Boolean).length ? [...(item.statusHistory || []), ...(item.workspaceHistory || [])].filter(Boolean).slice().reverse().map((entry, index) => (
              <div key={`${entry.at || index}_${index}`} style={card({ padding: 12, boxShadow: 'none' })}>
                <div style={{ color: CRM.text, fontSize: 13.5, fontWeight: 860 }}>{entry.text || entry.reason || `${entry.fromStatus || '—'} → ${entry.toStatus || '—'}`}</div>
                <div style={{ color: CRM.muted, fontSize: 11.5, marginTop: 4 }}>{entry.at ? new Date(entry.at).toLocaleString('ru-RU') : 'время не указано'} · {entry.actorRole || 'system'}</div>
              </div>
            )) : <EmptyCrm text="История изменений пока пуста." />}
          </div>
        )}
        {tab === 'notes' && (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <div style={{ color: CRM.soft, fontSize: 12.5 }}>{status}. Эти заметки видит только владелец встречи.</div>
            <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Внутренние заметки, договорённости, что важно помнить..." style={{ width: '100%', minHeight: 180, borderRadius: 8, border: `1px solid ${CRM.line}`, background: 'rgba(255,255,255,0.72)', color: CRM.text, padding: 12, fontSize: 14, lineHeight: '20px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
          </div>
        )}
        {tab === 'links' && (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {contactButton('phone', 'Позвонить', contacts.phone)}
              {contactButton('telegram', 'Telegram', contacts.telegram)}
              {contactButton('whatsapp', 'WhatsApp', contacts.whatsapp)}
              {contactButton('email', 'Email', contacts.email)}
              {item.dialogId && <button onClick={() => onOpenDialog(item)} style={button('primary')}>Открыть диалог</button>}
              {relatedEvent && <button onClick={() => onOpenPanel?.('events')} style={button('light')}>Открыть мероприятие</button>}
            </div>
            <WorkspaceRelatedLinks
              links={buildWorkspaceRelatedLinks({ source: 'booking', item, bookings, events, profile })}
              actions={actions}
              emptyText="У встречи пока нет связанных объектов."
              style={{ boxShadow: 'none' }}
            />
            <div style={card({ padding: 12, boxShadow: 'none' })}>
              <div style={{ color: CRM.text, fontSize: 15, fontWeight: 900 }}>Предыдущие встречи</div>
              {previous.length ? previous.map(row => <div key={row.id} style={{ color: CRM.soft, fontSize: 13, marginTop: 7 }}>{formatDateTime(row)} · {row.serviceTitle} · {row.statusLabel}</div>) : <div style={{ color: CRM.muted, fontSize: 13, marginTop: 7 }}>Истории предыдущих встреч пока нет.</div>}
            </div>
            <div style={card({ padding: 12, boxShadow: 'none' })}>
              <div style={{ color: CRM.text, fontSize: 15, fontWeight: 900 }}>Следующая встреча</div>
              <div style={{ color: CRM.soft, fontSize: 13, marginTop: 7 }}>Используйте действие «Назначить повторную встречу» или кнопку «Создать встречу» в рабочем центре.</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {[BOOKING_STATUSES.pending, BOOKING_STATUSES.new].includes(item.status) && <button onClick={() => onAction('booking:confirm', item)} style={button('primary')}>Подтвердить</button>}
          {[BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status) && <button onClick={() => onAction('booking:complete', item)} style={button('light')}>Завершить</button>}
          {item.isActive && <button onClick={() => onReschedule(item)} style={button('light')}>Изменить время</button>}
          {[BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status) && <button onClick={() => onAction('booking:noShow', item, { reason: 'Клиент не пришел' })} style={button('danger')}>Неявка</button>}
          {item.isActive && <button onClick={() => onAction('booking:cancel', item, { reason: prompt('Причина отмены') || 'Отменено в Workspace' })} style={button('light')}>Отменить</button>}
          <button onClick={() => onToast?.('Повторная встреча создаётся через кнопку «Создать встречу».', 'info')} style={button('light')}>Назначить повторную</button>
        </div>
      </div>
    </div>
  );
}

function EmptyCrm({ text }) {
  return <div style={card({ padding: 18, color: CRM.soft, fontSize: 14, lineHeight: '20px', boxShadow: 'none' })}>{text}</div>;
}

function ManualBookingModal({ profile, providerType, bookingProfile, bookings, onClose, onCreated, onToast }) {
  const firstService = bookingProfile.services[0] || {};
  const firstSpecialist = bookingProfile.specialists[0] || {};
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(10, 0, 0, 0);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    telegram: '',
    email: '',
    serviceId: firstService.id || '',
    specialistId: firstSpecialist.id || 'default',
    startAt: new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    notes: '',
    comment: '',
  });
  const [saving, setSaving] = useState(false);
  const service = bookingProfile.services.find(item => item.id === form.serviceId) || firstService;
  const duration = Number(service.durationMinutes || 60);
  const endAt = form.startAt ? new Date(new Date(form.startAt).getTime() + duration * 60000).toISOString() : '';
  const conflicts = form.startAt ? bookings.filter(item => item.providerId === profile.id && item.specialistId === form.specialistId && item.isActive && new Date(item.startAt).getTime() < new Date(endAt).getTime() && new Date(form.startAt).getTime() < new Date(item.endAt).getTime()) : [];
  const input = { width: '100%', minHeight: 42, borderRadius: 8, border: `1px solid ${CRM.line}`, background: 'rgba(255,255,255,0.76)', color: CRM.text, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box', outline: 'none' };
  const label = { color: CRM.soft, fontSize: 12, fontWeight: 780, margin: '8px 0 5px', display: 'block' };
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const create = async () => {
    if (!form.name.trim() || !form.startAt) {
      onToast?.('Укажите клиента и время встречи.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await userAction('booking:manualCreate', {
        providerType,
        providerId: profile.id,
        serviceId: form.serviceId,
        specialistId: form.specialistId,
        slot: { startAt: new Date(form.startAt).toISOString(), endAt, specialistId: form.specialistId },
        customer: { name: form.name, phone: form.phone, telegram: form.telegram, email: form.email },
        internalNotes: form.notes,
        comment: form.comment,
        source: 'manual',
      });
      onCreated(result.booking);
      onToast?.('Встреча создана.', 'success');
      onClose();
    } catch (error) {
      onToast?.(error.message || 'Не удалось создать встречу.', 'error');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1210, background: 'rgba(31,26,20,0.32)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={card({ width: '100%', maxWidth: 620, padding: 18, background: CRM.strong })}>
        <h2 style={{ margin: 0, color: CRM.text, fontSize: 24 }}>Создать встречу</h2>
        <div style={{ color: CRM.soft, fontSize: 13, marginTop: 5 }}>Встреча будет привязана к текущему профилю: {bookingProfile.title}</div>
        <label style={label}>ФИО клиента</label><input style={input} value={form.name} onChange={event => set('name', event.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
          <div><label style={label}>Телефон</label><input style={input} value={form.phone} onChange={event => set('phone', event.target.value)} /></div>
          <div><label style={label}>Telegram</label><input style={input} value={form.telegram} onChange={event => set('telegram', event.target.value)} /></div>
          <div><label style={label}>Email</label><input style={input} value={form.email} onChange={event => set('email', event.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
          <div><label style={label}>Услуга</label><select style={input} value={form.serviceId} onChange={event => set('serviceId', event.target.value)}>{bookingProfile.services.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
          <div><label style={label}>Специалист</label><select style={input} value={form.specialistId} onChange={event => set('specialistId', event.target.value)}>{bookingProfile.specialists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        </div>
        <label style={label}>Дата и время</label><input style={input} type="datetime-local" value={form.startAt} onChange={event => set('startAt', event.target.value)} />
        {conflicts.length > 0 && <div style={{ color: CRM.red, fontSize: 12.5, marginTop: 8 }}>Есть пересечение с другой встречей. Сервер не даст создать дубликат слота.</div>}
        <label style={label}>Комментарий для клиента</label><textarea style={{ ...input, minHeight: 74, resize: 'vertical' }} value={form.comment} onChange={event => set('comment', event.target.value)} />
        <label style={label}>Внутренние заметки</label><textarea style={{ ...input, minHeight: 88, resize: 'vertical' }} value={form.notes} onChange={event => set('notes', event.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={button('light')}>Закрыть</button>
          <button disabled={saving || conflicts.length > 0} onClick={create} style={button('primary', { opacity: saving || conflicts.length > 0 ? 0.55 : 1 })}>{saving ? 'Создаём...' : 'Создать'}</button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceMeetingsCRM({ role, profile, events = [], actions, onOpenDialog, onOpenPanel, onToast }) {
  const initialIntent = useMemo(() => readWorkspaceLinkIntent('booking') || {}, []);
  const providerType = role?.id === 'expert' ? 'expert' : 'partner';
  const bookingProfile = useMemo(() => buildBookingProfile(profile || {}, providerType), [profile, providerType]);
  const [calendarMode, setCalendarMode] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1180 ? 'week' : 'day');
  const [statusFilter, setStatusFilter] = useState(initialIntent.filter || 'active');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [query, setQuery] = useState(initialIntent.query || '');
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBookings = async () => {
    if (!profile?.id || loading) return;
    setLoading(true);
    setError('');
    try {
      const range = dateRange(calendarMode);
      const result = await userAction('booking:calendar', { providerType, providerId: profile.id, from: range.from, to: range.to, specialistId: specialistFilter, status: '' });
      setBookings(Array.isArray(result.bookings) ? result.bookings.map(normalizeBooking) : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить встречи');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBookings(); }, [profile?.id, providerType, calendarMode, specialistFilter]);

  const now = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => new Date(Date.now() + 86400000), []);
  const rows = useMemo(() => filterWorkspaceBookings(bookings, { includeArchived: statusFilter === 'archived' }), [bookings, statusFilter]);
  const groups = useMemo(() => groupBookingsForProfile(rows), [rows]);
  const kpis = useMemo(() => buildWorkspaceBookingKpis(rows, now), [rows, now]);
  const filtered = useMemo(() => rows.filter(item => {
    if (statusFilter === 'active' && !item.isActive) return false;
    if (statusFilter === 'today' && !sameDay(item, now)) return false;
    if (statusFilter === 'tomorrow' && !sameDay(item, tomorrow)) return false;
    if (statusFilter === 'pending' && ![BOOKING_STATUSES.pending, BOOKING_STATUSES.new, BOOKING_STATUSES.rescheduleRequested].includes(item.status)) return false;
    if (statusFilter === 'confirmed' && ![BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status)) return false;
    if (statusFilter === 'completed' && ![BOOKING_STATUSES.completed, BOOKING_STATUSES.noShow].includes(item.status)) return false;
    if (statusFilter === 'cancelled' && ![BOOKING_STATUSES.cancelled, BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider].includes(item.status)) return false;
    if (statusFilter === 'archived' && !isWorkspaceBookingArchived(item)) return false;
    const text = query.trim().toLowerCase();
    return !text || buildWorkspaceBookingSearchText(item).includes(text);
  }), [rows, statusFilter, query, now, tomorrow]);
  const range = useMemo(() => dateRange(calendarMode), [calendarMode]);
  const calendarItems = useMemo(() => buildBookingCalendar({ bookings: filtered, ...range, specialistId: specialistFilter, status: '' }), [filtered, range, specialistFilter]);
  const todayItems = useMemo(() => rows.filter(item => sameDay(item, now)).sort((a, b) => (a.startMs || 0) - (b.startMs || 0)), [rows, now]);
  const tomorrowItems = useMemo(() => rows.filter(item => sameDay(item, tomorrow)).sort((a, b) => (a.startMs || 0) - (b.startMs || 0)), [rows, tomorrow]);
  const freeSlots = useMemo(() => buildFreeTimeSlots({ bookings: rows, date: now, slotTimes: profile?.bookingSlotTimes, providerType, providerId: profile?.id, specialistId: specialistFilter || 'default' }), [rows, now, profile, providerType, specialistFilter]);
  const nextMeeting = groups.upcoming[0] || todayItems.find(item => item.isActive) || null;

  const upsertBooking = booking => {
    const next = normalizeBooking(booking);
    setBookings(prev => prev.some(row => String(row.id || row.bookingId) === String(next.id || next.bookingId)) ? prev.map(row => String(row.id || row.bookingId) === String(next.id || next.bookingId) ? next : row) : [next, ...prev]);
    setSelectedBooking(prev => prev && String(prev.id || prev.bookingId) === String(next.id || next.bookingId) ? next : prev);
  };

  useEffect(() => {
    if (!initialIntent.bookingId || selectedBooking) return;
    const found = rows.find(item => String(item.id || item.bookingId) === String(initialIntent.bookingId));
    if (found) setSelectedBooking(found);
  }, [initialIntent.bookingId, rows, selectedBooking]);

  const runAction = async (action, item, payload = {}) => {
    try {
      const result = await userAction(action, { bookingId: item.id || item.bookingId, ...payload });
      if (result?.booking) upsertBooking(result.booking);
      else await loadBookings();
      onToast?.('Встреча обновлена.', 'success');
    } catch (err) {
      setError(err?.message || 'Не удалось обновить встречу');
      onToast?.(err?.message || 'Не удалось обновить встречу', 'error');
    }
  };

  const archive = item => {
    if (!window.confirm('Архивировать встречу?')) return;
    runAction('booking:archive', item);
  };

  const openDialog = item => {
    if (item?.dialogId) onOpenDialog?.(item.dialogId);
    else actions.openDialogs();
  };

  const handleDropSlot = (slot, event) => {
    const bookingId = event.dataTransfer.getData('text/plain');
    const item = rows.find(row => String(row.id || row.bookingId) === String(bookingId));
    if (!item || slot.occupied) return;
    if (!window.confirm(`Перенести встречу на ${slot.time}?`)) return;
    runAction('booking:requestReschedule', item, { slot: { startAt: slot.startAt, endAt: slot.endAt, specialistId: item.specialistId || 'default', time: slot.time }, reason: 'Перенос из календаря Workspace' });
  };

  const requestReschedule = item => {
    const current = toDate(item.startAt);
    const defaultValue = current ? new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    const value = window.prompt('Новое время встречи в формате YYYY-MM-DDTHH:mm', defaultValue);
    if (!value) return;
    const start = new Date(value);
    if (Number.isNaN(start.getTime())) {
      onToast?.('Некорректное время переноса.', 'error');
      return;
    }
    const end = new Date(start.getTime() + Math.max(15, Number(item.durationMinutes || 60)) * 60000);
    runAction('booking:requestReschedule', item, { slot: { startAt: start.toISOString(), endAt: end.toISOString(), specialistId: item.specialistId || 'default', specialistName: item.specialistName || '', time: start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }, reason: 'Перенос из CRM Workspace' });
  };

  if (!profile?.id || !['partner', 'expert'].includes(role?.id)) {
    return <div style={card({ padding: 24 })}><h2 style={{ margin: 0, color: CRM.text }}>Встречи</h2><p style={{ color: CRM.soft }}>Раздел доступен партнёрам и экспертам после выбора рабочего профиля.</p></div>;
  }

  return (
    <div data-workspace-meetings-crm style={{ display: 'grid', gap: 14 }}>
      <section style={card({ padding: 18, background: 'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,248,232,0.82))' })}>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ color: CRM.gold, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Встречи CRM</div>
            <h1 style={{ margin: '5px 0 0', color: CRM.text, fontSize: 30, lineHeight: '36px', fontWeight: 940 }}>Центр работы с людьми</h1>
            <div style={{ color: CRM.soft, fontSize: 14.5, lineHeight: '21px', marginTop: 5 }}>{bookingProfile.title}: сегодня, подтверждения, переносы, заметки, диалоги и история клиентов.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={loadBookings} style={button('light')}>{loading ? 'Обновляем...' : 'Обновить'}</button>
            <button onClick={() => setShowCreate(true)} style={button('primary')}>Создать встречу</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 10, marginTop: 16 }}>
          <Kpi label="Сегодня" value={kpis.today} color={CRM.blue} />
          <Kpi label="Завтра" value={kpis.tomorrow} />
          <Kpi label="На неделе" value={kpis.week} />
          <Kpi label="Ожидают" value={kpis.pending} color={CRM.gold} />
          <Kpi label="Переносы" value={kpis.rescheduled} color={CRM.blue} />
          <Kpi label="Завершены" value={kpis.completed} color={CRM.green} />
          <Kpi label="Неявка" value={kpis.noShow} color={CRM.red} />
          <Kpi label="Отменены" value={kpis.cancelled} color={CRM.red} />
        </div>
      </section>

      {error && <div style={card({ padding: 12, color: CRM.red, background: 'rgba(217,93,84,0.10)', boxShadow: 'none' })}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={card({ padding: 12 })}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ФИО, телефон, Telegram, услуга, дата" style={{ minHeight: 40, borderRadius: 8, border: `1px solid ${CRM.line}`, padding: '0 11px', background: 'rgba(255,255,255,0.72)', color: CRM.text, outline: 'none' }} />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={button('light')}><option value="active">Активные</option><option value="today">Сегодня</option><option value="tomorrow">Завтра</option><option value="pending">Ожидают</option><option value="confirmed">Подтверждённые</option><option value="completed">Завершённые</option><option value="cancelled">Отменённые</option><option value="archived">Архив</option><option value="all">Все</option></select>
              <select value={specialistFilter} onChange={event => setSpecialistFilter(event.target.value)} style={button('light')}><option value="">Все специалисты</option>{bookingProfile.specialists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <select value={calendarMode} onChange={event => setCalendarMode(event.target.value)} style={button('light')}><option value="day">День</option><option value="week">Неделя</option><option value="month">Месяц</option></select>
            </div>
          </div>
          {!calendarItems.length ? <EmptyCrm text="Встреч на выбранный период нет. Создайте встречу или измените фильтры." /> : calendarItems.map(item => <MeetingCard key={item.id || item.bookingId} item={item} onOpen={setSelectedBooking} onAction={runAction} onOpenDialog={openDialog} onArchive={archive} onReschedule={requestReschedule} />)}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={card({ padding: 14 })}>
            <div style={{ color: CRM.text, fontSize: 17, fontWeight: 900 }}>Сегодня</div>
            <div style={{ color: CRM.soft, fontSize: 13, marginTop: 4 }}>{nextMeeting ? `Следующая: ${formatTime(nextMeeting)} · ${nextMeeting.userName || 'Клиент'}` : 'Сегодня свободных встреч нет в списке.'}</div>
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {todayItems.slice(0, 5).map(item => <button key={item.id || item.bookingId} onClick={() => setSelectedBooking(item)} style={{ ...button('light'), textAlign: 'left', display: 'grid' }}>{formatTime(item)} · {item.userName || 'Клиент'} · {item.serviceTitle || 'Услуга'}</button>)}
              {!todayItems.length && <EmptyCrm text="Сегодня нет встреч." />}
            </div>
          </div>
          <div style={card({ padding: 14 })}>
            <div style={{ color: CRM.text, fontSize: 17, fontWeight: 900 }}>Свободное время</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7, marginTop: 10 }}>
              {freeSlots.map(slot => <button key={slot.startAt} onDrop={event => handleDropSlot(slot, event)} onDragOver={event => event.preventDefault()} style={button(slot.occupied ? 'danger' : 'light', { minHeight: 32, padding: '6px 8px', fontSize: 12, opacity: slot.occupied ? 0.65 : 1 })}>{slot.time}</button>)}
            </div>
          </div>
          <div style={card({ padding: 14 })}>
            <div style={{ color: CRM.text, fontSize: 17, fontWeight: 900 }}>Завтра</div>
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {tomorrowItems.slice(0, 5).map(item => <button key={item.id || item.bookingId} onClick={() => setSelectedBooking(item)} style={{ ...button('light'), textAlign: 'left', display: 'grid' }}>{formatTime(item)} · {item.userName || 'Клиент'}</button>)}
              {!tomorrowItems.length && <EmptyCrm text="На завтра встреч пока нет." />}
            </div>
          </div>
        </div>
      </div>

      {selectedBooking && <MeetingCrmSheet item={selectedBooking} bookings={rows} events={events} actions={actions} profile={profile} onClose={() => setSelectedBooking(null)} onAction={runAction} onSaved={upsertBooking} onOpenDialog={openDialog} onOpenPanel={onOpenPanel} onToast={onToast} onReschedule={requestReschedule} />}
      {showCreate && <ManualBookingModal profile={profile} providerType={providerType} bookingProfile={bookingProfile} bookings={rows} onClose={() => setShowCreate(false)} onCreated={upsertBooking} onToast={onToast} />}
    </div>
  );
}
