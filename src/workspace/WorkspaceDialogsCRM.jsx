import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { userAction } from '../userApi.js';
import { buildDialogAutoAnswer, getDialogObjectLabel } from '../../server-shared/context-dialogs.js';
import { normalizeBooking } from '../../server-shared/booking.js';
import {
  buildDialogWorkspaceHistory,
  buildWorkspaceDialogKpis,
  enrichWorkspaceDialogs,
  filterWorkspaceDialogs,
  sanitizeDialogWorkspaceNotes,
} from '../../server-shared/workspace-dialogs.js';
import { WorkspaceRelatedLinks, buildWorkspaceRelatedLinks, readWorkspaceLinkIntent } from './WorkspaceLinks.jsx';

const UI = {
  text: 'var(--apg-workspace-text, #1F1A14)',
  soft: 'var(--apg-workspace-soft, rgba(31,26,20,0.64))',
  muted: 'var(--apg-workspace-muted, rgba(31,26,20,0.46))',
  line: 'var(--apg-workspace-line, rgba(88,67,37,0.12))',
  card: 'var(--apg-workspace-card, rgba(255,255,255,0.78))',
  strong: 'var(--apg-workspace-card-strong, rgba(255,255,255,0.94))',
  control: 'var(--apg-workspace-control, rgba(255,255,255,0.72))',
  controlSoft: 'var(--apg-workspace-control-soft, rgba(255,255,255,0.64))',
  gold: '#C89B3C',
  green: '#2EB36B',
  red: '#D95D54',
  blue: '#5B8FDB',
  shadow: 'var(--apg-workspace-shadow-soft, 0 22px 62px rgba(82,60,30,0.10))',
};

const FILTERS = [
  ['active', 'Активные'],
  ['unread', 'Непрочитанные'],
  ['awaiting', 'Ждут ответа'],
  ['today', 'Сегодня'],
  ['week', 'Неделя'],
  ['has-bookings', 'Есть встречи'],
  ['no-bookings', 'Без встреч'],
  ['notes', 'Есть заметки'],
  ['pinned', 'Закреплённые'],
  ['archive', 'Архив'],
  ['all', 'Все'],
];

function card(extra = {}) {
  return {
    background: UI.card,
    border: `1px solid ${UI.line}`,
    borderRadius: 24,
    boxShadow: UI.shadow,
    backdropFilter: 'blur(22px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
    ...extra,
  };
}

function button(tone = 'light', extra = {}) {
  const primary = tone === 'primary';
  const danger = tone === 'danger';
  return {
    border: `1px solid ${primary ? 'rgba(200,155,60,0.48)' : danger ? 'rgba(217,93,84,0.34)' : UI.line}`,
    background: primary ? 'linear-gradient(135deg,#F3D98C,#C89B3C)' : danger ? 'rgba(217,93,84,0.10)' : UI.controlSoft,
    color: primary ? '#241807' : danger ? UI.red : UI.text,
    borderRadius: 16,
    padding: '9px 11px',
    minHeight: 38,
    fontSize: 13,
    fontWeight: 820,
    cursor: 'pointer',
    fontFamily: 'inherit',
    ...extra,
  };
}

function input(extra = {}) {
  return {
    minHeight: 40,
    borderRadius: 16,
    border: `1px solid ${UI.line}`,
    background: UI.control,
    color: UI.text,
    outline: 'none',
    padding: '0 11px',
    fontFamily: 'inherit',
    fontSize: 13,
    ...extra,
  };
}

function toMs(value) {
  if (!value) return 0;
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function timeText(value) {
  const ms = toMs(value);
  return ms ? new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
}

function dateText(value) {
  const ms = toMs(value);
  return ms ? new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

function actorId(user) {
  return String(user?.id || user?.uid || '');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object';
}

function firestoreRows(snap) {
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(isRecord);
}

function avatarLabel(dialog) {
  const name = dialog.context?.title || dialog.context?.parentTitle || dialog.userName || 'Диалог';
  const parts = String(name).split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'Д') + (parts[1]?.[0] || '');
}

function contactHref(kind, value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (kind === 'phone') return `tel:${clean.replace(/[^\d+]/g, '')}`;
  if (kind === 'telegram') return clean.startsWith('http') ? clean : `https://telegram.me/${clean.replace(/^@+/, '')}`;
  if (kind === 'whatsapp') return clean.startsWith('http') ? clean : `https://wa.me/${clean.replace(/\D/g, '')}`;
  if (kind === 'email') return `mailto:${clean}`;
  return '';
}

function Kpi({ label, value, color }) {
  return (
    <div style={card({ padding: 12, minHeight: 64, boxShadow: '0 12px 32px rgba(82,60,30,0.07)' })}>
      <div style={{ color: UI.muted, fontSize: 11, fontWeight: 780, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
      <div style={{ color: color || UI.text, fontSize: 23, lineHeight: '28px', fontWeight: 930, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Skeleton() {
  return <div style={card({ padding: 18, color: UI.soft })}>Загружаем коммуникационный центр...</div>;
}

function Empty({ title, text }) {
  return (
    <div style={card({ padding: 22, textAlign: 'center', boxShadow: '0 12px 32px rgba(82,60,30,0.06)' })}>
      <div style={{ color: UI.text, fontSize: 17, fontWeight: 900 }}>{title}</div>
      <div style={{ color: UI.soft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{text}</div>
    </div>
  );
}

function DialogRow({ dialog, active, onClick }) {
  const context = dialog.context || {};
  const preview = dialog.lastMessage?.text || 'История по объекту';
  const meeting = dialog.upcomingBooking;
  return (
    <button onClick={onClick} style={{ ...card({ padding: 11, display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', boxShadow: active ? '0 18px 44px rgba(200,155,60,0.18)' : '0 10px 28px rgba(82,60,30,0.06)', border: active ? '1px solid rgba(200,155,60,0.42)' : `1px solid ${UI.line}` }), fontFamily: 'inherit', cursor: 'pointer' }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(200,155,60,0.14)', color: UI.gold, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 930, overflow: 'hidden' }}>
        {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatarLabel(dialog)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
          <span style={{ color: UI.text, fontSize: 14, lineHeight: '18px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{context.title || 'Диалог АПГ'}</span>
          {dialog.workspaceState?.pinned && <span style={{ color: UI.gold, fontSize: 11, fontWeight: 900 }}>PIN</span>}
        </div>
        <div style={{ color: UI.gold, fontSize: 11, lineHeight: '15px', fontWeight: 790, marginTop: 2 }}>{getDialogObjectLabel(context)}{meeting ? ` · встреча ${dateText(meeting.startAt)}` : ''}</div>
        <div style={{ color: UI.soft, fontSize: 12, lineHeight: '16px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        <span style={{ color: UI.muted, fontSize: 11 }}>{timeText(dialog.lastMessageAt)}</span>
        {dialog.unreadCount > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: UI.red, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 920 }}>{dialog.unreadCount}</span>}
      </div>
    </button>
  );
}

function MessageBubble({ message, own }) {
  const system = message.isSystem || message.senderRole === 'system';
  if (system) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '84%', borderRadius: 8, padding: '9px 12px', background: 'rgba(200,155,60,0.10)', border: '1px solid rgba(200,155,60,0.20)', color: UI.soft, fontSize: 12.5, lineHeight: '18px', textAlign: 'center', whiteSpace: 'pre-wrap' }}>
          {message.text}
          <div style={{ marginTop: 4, color: UI.muted, fontSize: 10.5 }}>{dateText(message.createdAt)}</div>
        </div>
      </div>
    );
  }
  const loki = message.senderRole === 'loki';
  return (
    <div style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%', borderRadius: 8, padding: 12, background: loki ? 'rgba(200,155,60,0.16)' : own ? 'rgba(200,155,60,0.18)' : UI.control, border: `1px solid ${loki ? 'rgba(200,155,60,0.34)' : UI.line}`, color: UI.text }}>
        <div style={{ color: loki ? UI.gold : UI.muted, fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 4 }}>{loki ? 'Локи' : message.senderName || 'Участник'}</div>
        {message.text && <div style={{ fontSize: 14, lineHeight: '20px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</div>}
        {message.attachments?.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {message.attachments.map((file, index) => file.type === 'image'
              ? <img key={file.url || index} src={file.url} alt="" style={{ maxWidth: 220, borderRadius: 8, border: `1px solid ${UI.line}` }} />
              : <a key={file.url || index} href={file.url} target="_blank" rel="noreferrer" style={{ color: UI.gold }}>{file.name || 'Файл'}</a>)}
          </div>
        )}
        <div style={{ marginTop: 5, color: UI.muted, fontSize: 10.5, textAlign: 'right' }}>{timeText(message.createdAt)} · {message.status || 'delivered'}</div>
      </div>
    </div>
  );
}

function CrmPanel({ dialog, userId, events = [], bookings = [], actions, onOpenPanel, onPatch, onCreateMeeting }) {
  const [notes, setNotes] = useState(() => dialog?.workspaceState?.notes || '');
  const [status, setStatus] = useState('Готово');
  const dirtyRef = useRef(false);
  const context = dialog?.context || {};
  const history = useMemo(() => (dialog ? buildDialogWorkspaceHistory(dialog).slice(0, 10) : []), [dialog]);
  const contacts = [
    ['phone', 'Позвонить', context.phone || dialog?.userPhone],
    ['telegram', 'Telegram', context.telegram || dialog?.userTelegram],
    ['whatsapp', 'WhatsApp', context.whatsapp || dialog?.userWhatsapp],
    ['email', 'Email', context.email || dialog?.userEmail],
  ].filter(([, , value]) => value);

  useEffect(() => {
    setNotes(dialog?.workspaceState?.notes || '');
    dirtyRef.current = false;
    setStatus('Готово');
  }, [dialog?.id, dialog?.workspaceState?.notes]);

  useEffect(() => {
    if (!dialog?.id || !dirtyRef.current) return undefined;
    localStorage.setItem(`apg.workspace.dialog.notes.${userId}.${dialog.id}`, notes);
    setStatus('Черновик сохранён');
    const timer = setTimeout(async () => {
      try {
        setStatus('Сохраняем...');
        await onPatch({ notes: sanitizeDialogWorkspaceNotes(notes) });
        dirtyRef.current = false;
        setStatus('Заметки сохранены');
      } catch (error) {
        setStatus(error?.message || 'Не удалось сохранить');
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [notes, dialog?.id, userId]);

  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onPatch({ notes: sanitizeDialogWorkspaceNotes(notes) }).then(() => {
          dirtyRef.current = false;
          setStatus('Сохранено');
        }).catch(error => setStatus(error?.message || 'Не удалось сохранить'));
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
  }, [notes, onPatch]);

  if (!dialog) return <div style={card({ padding: 18, color: UI.soft })}>Выберите диалог, чтобы увидеть CRM-панель клиента.</div>;

  return (
    <aside style={{ display: 'grid', gap: 10 }}>
      <div style={card({ padding: 14, background: UI.strong })}>
        <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 54, height: 54, borderRadius: 8, background: 'rgba(200,155,60,0.14)', color: UI.gold, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 930, overflow: 'hidden' }}>
            {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatarLabel(dialog)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: UI.text, fontSize: 17, lineHeight: '21px', fontWeight: 940 }}>{context.title || 'Клиент АПГ'}</div>
            <div style={{ color: UI.gold, fontSize: 12, fontWeight: 820, marginTop: 2 }}>{getDialogObjectLabel(context)} · {context.parentTitle || context.subtitle || 'контекст'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
          {contacts.map(([kind, label, value]) => <a key={kind} href={contactHref(kind, value)} target={kind === 'phone' || kind === 'email' ? undefined : '_blank'} rel="noreferrer" style={button('light', { textDecoration: 'none', minHeight: 32, padding: '6px 8px', fontSize: 12 })}>{label}</a>)}
          <button onClick={() => onOpenPanel?.('profile')} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>Открыть профиль</button>
        </div>
      </div>

      <div style={card({ padding: 14 })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div style={{ color: UI.text, fontSize: 16, fontWeight: 910 }}>Встречи</div>
          <button onClick={onCreateMeeting} style={button('primary', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>Создать</button>
        </div>
        <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
          {dialog.upcomingBooking && <div style={{ borderRadius: 8, padding: 9, background: 'rgba(46,179,107,0.10)', color: UI.green, fontSize: 12.5, fontWeight: 820 }}>Ближайшая: {dateText(dialog.upcomingBooking.startAt)} · {dialog.upcomingBooking.serviceTitle || 'услуга'}</div>}
          {dialog.relatedBookings?.slice(0, 4).map(item => <div key={item.id || item.bookingId} style={{ color: UI.soft, fontSize: 12.5, lineHeight: '18px' }}>{dateText(item.startAt)} · {item.serviceTitle || 'встреча'} · {item.statusLabel || item.status}</div>)}
          {!dialog.relatedBookings?.length && <div style={{ color: UI.muted, fontSize: 12.5 }}>Связанных встреч пока нет.</div>}
        </div>
      </div>

      <div style={card({ padding: 14 })}>
        <div style={{ color: UI.text, fontSize: 16, fontWeight: 910 }}>Внутренние заметки</div>
        <textarea value={notes} onChange={event => { dirtyRef.current = true; setNotes(event.target.value); }} placeholder="Заметки видны только владельцу или сотрудникам организации" style={input({ width: '100%', minHeight: 128, resize: 'vertical', padding: 11, marginTop: 9, lineHeight: '19px' })} />
        <div style={{ color: UI.muted, fontSize: 11.5, marginTop: 7 }}>{status}</div>
      </div>

      <div style={card({ padding: 14 })}>
        <div style={{ color: UI.text, fontSize: 16, fontWeight: 910 }}>Связи и история</div>
        <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
          <WorkspaceRelatedLinks
            compact
            links={buildWorkspaceRelatedLinks({ source: 'dialog', item: dialog, events, bookings, profile: { id: dialog?.context?.parentId, name: dialog?.context?.parentTitle } })}
            actions={actions}
            emptyText="Связи появятся после встречи или действия по объекту."
          />
          {dialog.relatedEvents?.slice(0, 3).map(item => <button key={item.id} onClick={() => onOpenPanel?.('events')} style={{ ...button('light', { textAlign: 'left', minHeight: 32, padding: '6px 8px', fontSize: 12 }) }}>{item.title || item.name || 'Мероприятие'}</button>)}
          {history.map(item => <div key={item.id} style={{ color: UI.soft, fontSize: 12, lineHeight: '17px' }}>{dateText(item.at)} · {item.text}</div>)}
          {!history.length && <div style={{ color: UI.muted, fontSize: 12.5 }}>История появится после сообщений и действий.</div>}
        </div>
      </div>
    </aside>
  );
}

export function WorkspaceDialogsCRM({ user, role, profile, events = [], actions, onOpenPanel, onToast, compact = false }) {
  const initialIntent = useMemo(() => readWorkspaceLinkIntent('dialogs') || {}, []);
  const uid = actorId(user);
  const providerType = role?.id === 'expert' ? 'expert' : 'partner';
  const [dialogs, setDialogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeId, setActiveId] = useState(initialIntent.dialogId || '');
  const [query, setQuery] = useState(initialIntent.query || '');
  const [filter, setFilter] = useState(initialIntent.filter || 'active');
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!uid) return undefined;
    setLoading(true);
    const unsubDialogs = onSnapshot(collection(db, 'users', uid, 'contextDialogs'), snap => {
      setDialogs(firestoreRows(snap));
      setLoading(false);
    }, err => {
      setError(err?.message || 'Не удалось загрузить диалоги');
      setLoading(false);
    });
    const unsubMessages = onSnapshot(collection(db, 'users', uid, 'contextDialogMessages'), snap => {
      setMessages(firestoreRows(snap));
    });
    return () => { unsubDialogs(); unsubMessages(); };
  }, [uid]);

  const loadBookings = async () => {
    if (!profile?.id || !['partner', 'expert'].includes(role?.id)) return;
    try {
      const from = new Date();
      from.setDate(from.getDate() - 90);
      const to = new Date();
      to.setDate(to.getDate() + 180);
      const result = await userAction('booking:calendar', { providerType, providerId: profile.id, from: from.toISOString(), to: to.toISOString(), status: '' });
      setBookings(Array.isArray(result.bookings) ? result.bookings.filter(isRecord).map(normalizeBooking) : []);
    } catch (err) {
      onToast?.(err?.message || 'Не удалось загрузить связи со встречами.', 'error');
    }
  };

  useEffect(() => { loadBookings(); }, [profile?.id, providerType, role?.id]);

  const enriched = useMemo(() => enrichWorkspaceDialogs({ dialogs, messages, bookings, events }), [dialogs, messages, bookings, events]);
  const filtered = useMemo(() => filterWorkspaceDialogs(enriched, { filter, query }), [enriched, filter, query]);
  const kpis = useMemo(() => buildWorkspaceDialogKpis(enriched), [enriched]);
  const activeDialog = useMemo(() => enriched.find(item => item.id === activeId) || filtered[0] || enriched[0] || null, [enriched, filtered, activeId]);
  const activeMessages = Array.isArray(activeDialog?.messages) ? activeDialog.messages : [];
  const isOwner = activeDialog?.ownerUserIds?.includes?.(uid);
  const typingUsers = Object.entries(activeDialog?.typing || {}).filter(([id, value]) => id !== uid && value).length;

  useEffect(() => {
    if (!initialIntent.dialogId || activeId) return;
    const found = enriched.find(item => String(item.id || item.dialogId) === String(initialIntent.dialogId));
    if (found) setActiveId(found.id);
  }, [initialIntent.dialogId, enriched, activeId]);

  useEffect(() => {
    if (!activeDialog?.id) return;
    setActiveId(activeDialog.id);
    userAction('dialog:read', { dialogId: activeDialog.id }).catch(() => {});
    const stored = localStorage.getItem(`apg.workspace.dialog.draft.${uid}.${activeDialog.id}`);
    setText(stored || '');
  }, [activeDialog?.id, uid]);

  useEffect(() => {
    if (!activeDialog?.id) return;
    localStorage.setItem(`apg.workspace.dialog.draft.${uid}.${activeDialog.id}`, text);
  }, [text, activeDialog?.id, uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeDialog?.id, activeMessages.length]);

  const patchDialog = async patch => {
    if (!activeDialog?.id) return;
    const result = await userAction('dialog:workspaceUpdate', { dialogId: activeDialog.id, patch });
    setDialogs(prev => prev.map(item => String(item.id || item.dialogId) === activeDialog.id ? { ...item, workspacePrivate: { ...(item.workspacePrivate || {}), ...(result.workspacePrivate || patch) } } : item));
  };

  const sendMessage = async (override = '') => {
    const body = String(override || text || '').trim();
    if (!activeDialog?.id || sending || (!body && !attachment)) return;
    setSending(true);
    setError('');
    setLastFailedMessage('');
    try {
      const autoAnswer = !isOwner ? buildDialogAutoAnswer(activeDialog.context, body) : null;
      await userAction('dialog:message', { dialogId: activeDialog.id, text: body, attachments: attachment ? [attachment] : [] });
      if (autoAnswer) await userAction('dialog:message', { dialogId: activeDialog.id, text: autoAnswer, senderRole: 'loki' });
      setText('');
      setAttachment(null);
      localStorage.removeItem(`apg.workspace.dialog.draft.${uid}.${activeDialog.id}`);
    } catch (err) {
      setLastFailedMessage(body);
      setError(err?.message || 'Не удалось отправить сообщение.');
    } finally {
      setSending(false);
    }
  };

  const handleFile = file => {
    if (!file) return;
    if (file.size > 650 * 1024) {
      setError('Файл должен быть меньше 650 КБ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ type: file.type?.startsWith('image/') ? 'image' : 'file', url: String(reader.result || ''), name: file.name || 'file' });
    reader.readAsDataURL(file);
  };

  const onDropFile = event => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  if (!uid) return <Empty title="Нужна авторизация" text="People Workspace доступен после входа в АПГ." />;

  return (
    <div data-workspace-dialogs-crm style={{ display: 'grid', gap: 14 }}>
      <section data-workspace-people-desktop style={card({ padding: 18, background: 'radial-gradient(circle at 12% 0%, rgba(91,143,219,0.18), transparent 34%), radial-gradient(circle at 92% 0%, rgba(200,155,60,0.20), transparent 34%), var(--apg-workspace-panel-accent, linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,248,232,0.82)))' })}>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ color: UI.gold, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>People Workspace</div>
            <h1 style={{ margin: '5px 0 0', color: UI.text, fontSize: 30, lineHeight: '36px', fontWeight: 940 }}>Люди и переписки</h1>
            <div style={{ color: UI.soft, fontSize: 14.5, lineHeight: '21px', marginTop: 5 }}>Клиенты, знакомства, вопросы, встречи, история и внутренние заметки собраны в одном профессиональном рабочем экране.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={loadBookings} style={button('light')}>Обновить связи</button>
            <button onClick={() => actions?.openBooking?.()} style={button('primary')}>Создать встречу</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 10, marginTop: 16 }}>
          <Kpi label="Всего" value={kpis.all} />
          <Kpi label="Непрочитано" value={kpis.unread} color={UI.red} />
          <Kpi label="Ждут ответа" value={kpis.awaiting} color={UI.gold} />
          <Kpi label="Сегодня" value={kpis.today} color={UI.blue} />
          <Kpi label="Со встречами" value={kpis.withBookings} color={UI.green} />
          <Kpi label="Заметки" value={kpis.notes} />
          <Kpi label="Закреплено" value={kpis.pinned} />
          <Kpi label="Архив" value={kpis.archived} />
        </div>
      </section>

      {error && <div style={card({ padding: 12, color: UI.red, background: 'rgba(217,93,84,0.10)', boxShadow: 'none' })}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0,1fr)' : '340px minmax(430px,1fr) 340px', gap: 14, alignItems: 'start' }}>
        <aside style={{ display: 'grid', gap: 10 }}>
          <div style={card({ padding: 12 })}>
            <div style={{ color: UI.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>People Inbox</div>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти человека, телефон, email, Telegram, встречу или текст" style={input({ width: '100%', marginBottom: 8 })} />
            <select value={filter} onChange={event => setFilter(event.target.value)} style={{ ...button('light'), width: '100%' }}>
              {FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          {loading ? <Skeleton /> : !filtered.length ? <Empty title="Переписок нет" text="Измените фильтр или откройте чат из карточки человека или объекта." /> : filtered.filter(isRecord).map(dialog => <DialogRow key={dialog.id} dialog={dialog} active={activeDialog?.id === dialog.id} onClick={() => setActiveId(dialog.id)} />)}
        </aside>

        <main data-workspace-people-chat-pane onDrop={onDropFile} onDragOver={event => event.preventDefault()} style={card({ minHeight: compact ? 520 : 640, display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden', background: 'linear-gradient(180deg, var(--apg-workspace-card-strong, rgba(255,255,255,0.94)), var(--apg-workspace-card, rgba(255,255,255,0.78)))' })}>
          {activeDialog ? (
            <>
              <div style={{ padding: 14, borderBottom: `1px solid ${UI.line}`, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: UI.text, fontSize: 18, lineHeight: '23px', fontWeight: 940 }}>{activeDialog.context?.title || 'Переписка АПГ'}</div>
                  <div style={{ color: UI.soft, fontSize: 12.5, marginTop: 3 }}>{getDialogObjectLabel(activeDialog.context)} · {activeDialog.context?.parentTitle || activeDialog.context?.subtitle || 'контекст'}{typingUsers ? ' · собеседник печатает' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => patchDialog({ pinned: !activeDialog.workspaceState?.pinned })} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>{activeDialog.workspaceState?.pinned ? 'Открепить' : 'Закрепить'}</button>
                  <button onClick={() => patchDialog({ archived: !activeDialog.workspaceState?.archived })} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>{activeDialog.workspaceState?.archived ? 'Вернуть' : 'Архив'}</button>
                </div>
              </div>
              <div style={{ padding: 14, overflowY: 'auto', display: 'grid', gap: 9, alignContent: 'start', minHeight: 0 }}>
                {activeMessages.length ? activeMessages.map(message => <MessageBubble key={message.id} message={message} own={message.senderId === uid && message.senderRole !== 'loki'} />) : <Empty title="История начнётся здесь" text="Напишите сообщение или дождитесь вопроса по объекту." />}
                <div ref={endRef} />
              </div>
              <div style={{ padding: 12, borderTop: `1px solid ${UI.line}`, display: 'grid', gap: 8 }}>
                {lastFailedMessage && <div data-workspace-message-send-error style={{ borderRadius: 16, padding: 10, background: 'rgba(217,93,84,0.10)', border: '1px solid rgba(217,93,84,0.22)', color: UI.soft, fontSize: 12.5, lineHeight: '18px', display: 'flex', gap: 9, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}><span>Сообщение не отправилось. Можно повторить.</span><button onClick={() => sendMessage(lastFailedMessage)} style={button('primary', { minHeight: 30, padding: '6px 9px', fontSize: 12 })}>Повторить</button></div>}
                {attachment && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: UI.soft, fontSize: 12 }}><span>{attachment.name}</span><button onClick={() => setAttachment(null)} style={button('light', { minHeight: 28, padding: '4px 7px', fontSize: 12 })}>Убрать</button></div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'end' }}>
                  <label style={button('light', { minWidth: 40, padding: 0, display: 'grid', placeItems: 'center' })}>＋<input type="file" accept="image/*,.pdf,.doc,.docx" onChange={event => handleFile(event.target.files?.[0])} style={{ display: 'none' }} /></label>
                  <textarea
                    value={text}
                    onFocus={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: true }).catch(() => {})}
                    onBlur={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: false }).catch(() => {})}
                    onKeyDown={event => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    onChange={event => setText(event.target.value)}
                    placeholder={isOwner ? 'Ответить человеку или клиенту...' : 'Написать сообщение...'}
                    style={input({ minHeight: 44, maxHeight: 120, resize: 'vertical', padding: 11, lineHeight: '19px' })}
                  />
                  <button onClick={() => sendMessage()} disabled={sending} style={button('primary', { opacity: sending ? 0.62 : 1 })}>{sending ? '...' : 'Отправить'}</button>
                </div>
              </div>
            </>
          ) : <Empty title="Выберите переписку" text="People Workspace покажет чат, контекст человека и рабочую CRM-панель." />}
        </main>

        {!compact && <CrmPanel dialog={activeDialog} userId={uid} events={events} bookings={bookings} actions={actions} onOpenPanel={onOpenPanel} onPatch={patchDialog} onCreateMeeting={() => actions?.openBooking?.()} />}
      </div>
    </div>
  );
}

export default WorkspaceDialogsCRM;
