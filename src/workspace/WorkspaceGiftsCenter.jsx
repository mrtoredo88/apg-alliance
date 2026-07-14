import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GalleryUpload, PhotoUpload } from '../PhotoUpload.jsx';
import { userAction } from '../userApi.js';
import {
  WORKSPACE_GIFT_TYPES,
  buildWorkspaceGiftKpis,
  filterWorkspaceGifts,
  sanitizeWorkspaceGiftPatch,
  workspaceGiftStatus,
  workspaceGiftStatusLabel,
} from '../../server-shared/workspace-gifts.js';

const UI = {
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
  violet: '#8D6BE8',
  shadow: '0 22px 62px rgba(82,60,30,0.10)',
};

const STATUS_FILTERS = [
  ['active', 'Активные'],
  ['draft', 'Черновики'],
  ['moderation', 'На модерации'],
  ['published', 'Опубликовано'],
  ['revision', 'Замечания'],
  ['archived', 'Архив'],
  ['all', 'Все'],
];

const PERIODS = [
  ['all', 'Любой период'],
  ['today', 'Сегодня'],
  ['week', 'Неделя'],
  ['month', 'Месяц'],
];

function card(extra = {}) {
  return {
    background: UI.card,
    border: `1px solid ${UI.line}`,
    borderRadius: 8,
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
    background: primary ? 'linear-gradient(135deg,#F3D98C,#C89B3C)' : danger ? 'rgba(217,93,84,0.10)' : 'rgba(255,255,255,0.64)',
    color: primary ? '#241807' : danger ? UI.red : UI.text,
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

function input(extra = {}) {
  return {
    minHeight: 40,
    borderRadius: 8,
    border: `1px solid ${UI.line}`,
    background: 'rgba(255,255,255,0.72)',
    color: UI.text,
    outline: 'none',
    padding: '0 11px',
    fontFamily: 'inherit',
    fontSize: 13,
    ...extra,
  };
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateText(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Дата не задана';
}

function inputDateTime(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 16) : '';
}

function Kpi({ label, value, color }) {
  return (
    <div style={card({ padding: 12, minHeight: 64, boxShadow: '0 12px 32px rgba(82,60,30,0.07)' })}>
      <div style={{ color: UI.muted, fontSize: 11, fontWeight: 780, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
      <div style={{ color: color || UI.text, fontSize: 23, lineHeight: '28px', fontWeight: 930, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function defaultDraft(profile, role) {
  return {
    id: '',
    name: '',
    title: '',
    description: '',
    coverPhoto: '',
    imageUrl: '',
    gallery: [],
    type: 'purchase',
    opportunityType: 'reward',
    conditions: '',
    restrictions: '',
    cost: 1,
    ticketCost: 1,
    stock: '',
    quantity: '',
    remaining: '',
    startAt: '',
    endAt: '',
    raffleDate: '',
    emoji: '🎁',
    tags: [],
    buttonLabel: 'Подробнее',
    buttonUrl: '',
    ctaButtons: [],
    links: [],
    seoTitle: '',
    seoDescription: '',
    partnerId: role?.id === 'partner' ? profile?.id || '' : '',
    expertId: role?.id === 'expert' ? profile?.id || '' : '',
    eventId: '',
    promotionId: '',
    newsId: '',
    qrValue: '',
    active: false,
    status: 'draft',
  };
}

function GiftRow({ item, view, selected, onOpen, onSubmit, onArchive }) {
  const status = workspaceGiftStatus(item);
  const statusColor = status === 'published' ? UI.green : status === 'moderation' ? UI.gold : status === 'archived' ? UI.muted : status === 'rejected' ? UI.red : UI.blue;
  const compact = view === 'table';
  const period = item.type === 'raffle' ? `Розыгрыш: ${dateText(item.raffleDate)}` : [item.startAt ? dateText(item.startAt) : '', item.endAt ? dateText(item.endAt) : ''].filter(Boolean).join(' - ') || 'Срок не задан';
  return (
    <button onClick={() => onOpen(item)} style={{ ...card({ padding: compact ? 10 : 12, display: 'grid', gridTemplateColumns: compact ? '1fr auto' : '82px minmax(0,1fr) auto', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', boxShadow: selected ? '0 18px 44px rgba(200,155,60,0.18)' : '0 10px 28px rgba(82,60,30,0.06)', border: selected ? '1px solid rgba(200,155,60,0.42)' : `1px solid ${UI.line}` }), fontFamily: 'inherit', cursor: 'pointer' }}>
      {!compact && <div style={{ width: 82, height: 66, borderRadius: 8, overflow: 'hidden', background: 'rgba(200,155,60,0.14)', display: 'grid', placeItems: 'center', color: UI.gold, fontSize: 28 }}>{item.coverPhoto || item.imageUrl ? <img src={item.coverPhoto || item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : item.emoji || '🎁'}</div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: statusColor, border: `1px solid ${statusColor}55`, background: `${statusColor}12`, borderRadius: 999, padding: '4px 7px', fontSize: 11, fontWeight: 850 }}>{workspaceGiftStatusLabel(item)}</span>
          <span style={{ color: UI.muted, fontSize: 11, fontWeight: 760 }}>{WORKSPACE_GIFT_TYPES.find(type => type.id === item.type)?.label || 'Подарок'}</span>
          {item.donorName && <span style={{ color: UI.muted, fontSize: 11, fontWeight: 760 }}>{item.donorName}</span>}
        </div>
        <div style={{ color: UI.text, fontSize: compact ? 14 : 16, lineHeight: compact ? '19px' : '21px', fontWeight: 920, marginTop: 6, overflowWrap: 'anywhere' }}>{item.name || item.title || 'Новый подарок'}</div>
        {!compact && <div style={{ color: UI.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || item.conditions || 'Описание и условия пока не заполнены'}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: UI.muted, fontSize: 11.5, marginTop: 8 }}>
          <span>{item.type === 'raffle' ? `${item.ticketCost || 0} ключей/билет` : `${item.cost || 0} ключей`}</span>
          <span>{item.stock === null ? 'без лимита' : `${item.remaining ?? item.stock ?? 0} осталось`}</span>
          <span>{item.received || 0} получено</span>
          <span>{item.issued || 0} выдано</span>
          <span>{period}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        {['draft', 'revision'].includes(status) && <span onClick={event => { event.stopPropagation(); onSubmit(item); }} style={button('primary', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>На модерацию</span>}
        {status !== 'archived' && <span onClick={event => { event.stopPropagation(); onArchive(item); }} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Архив</span>}
      </div>
    </button>
  );
}

function GiftEditor({ item, profile, role, events, news, onSaved, onToast }) {
  const storageKey = `apg.workspace.gift.draft.${role?.id || 'partner'}.${profile?.id || 'none'}.${item?.id || 'new'}`;
  const [draft, setDraft] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) return { ...defaultDraft(profile, role), ...JSON.parse(saved) };
    return { ...defaultDraft(profile, role), ...(item || {}) };
  });
  const [status, setStatus] = useState('Готово');
  const dirtyRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setDraft(saved ? { ...defaultDraft(profile, role), ...JSON.parse(saved) } : { ...defaultDraft(profile, role), ...(item || {}) });
    dirtyRef.current = false;
    setStatus('Готово');
  }, [item?.id, profile?.id, role?.id]);

  const patch = value => {
    dirtyRef.current = true;
    setDraft(prev => ({ ...prev, ...value }));
  };

  const save = async ({ submit = false, silent = false } = {}) => {
    const clean = sanitizeWorkspaceGiftPatch(draft);
    if (!clean.name && !clean.title) {
      onToast?.('Добавьте название подарка.', 'error');
      return null;
    }
    setStatus(submit ? 'Отправляем...' : 'Сохраняем...');
    const payload = { id: item?.id || draft.id || '', profileId: profile?.id || draft.profileId || '', role: role?.id, patch: clean };
    const result = await userAction(submit ? 'workspaceGift:submit' : 'workspaceGift:save', payload);
    localStorage.removeItem(storageKey);
    dirtyRef.current = false;
    setStatus(submit ? 'Отправлено на модерацию' : 'Сохранено');
    onSaved(result.gift || { ...draft, ...clean, id: result.id || draft.id });
    if (!silent) onToast?.(submit ? 'Подарок отправлен на модерацию.' : 'Подарок сохранён.', 'success');
    return result;
  };

  useEffect(() => {
    if (!dirtyRef.current) return undefined;
    localStorage.setItem(storageKey, JSON.stringify(draft));
    setStatus('Черновик сохранён локально');
    const timer = setTimeout(() => save({ silent: true }).catch(error => setStatus(error?.message || 'Не удалось сохранить')), 1300);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save().catch(error => setStatus(error?.message || 'Не удалось сохранить'));
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
  }, [draft, profile?.id, role?.id]);

  const lokiApply = type => {
    if (type === 'description') patch({ description: draft.description || 'Подарок для участников АПГ: понятная ценность, простые условия получения и ограниченное количество.' });
    if (type === 'offer') patch({ name: draft.name || 'Подарок участника АПГ', title: draft.title || 'Подарок участника АПГ' });
    if (type === 'conditions') patch({ conditions: draft.conditions || 'Можно получить после подтверждения участия в программе АПГ. Количество подарков ограничено.' });
    if (type === 'variants') patch({ tags: Array.from(new Set([...(draft.tags || []), 'подарок', 'лояльность', 'ключи'])) });
  };

  return (
    <div style={card({ padding: 14, display: 'grid', gap: 12, background: UI.strong })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <div>
          <div style={{ color: UI.muted, fontSize: 12, fontWeight: 800 }}>Редактор подарка</div>
          <div style={{ color: UI.text, fontSize: 18, fontWeight: 930 }}>{draft.name || draft.title || 'Новый подарок'}</div>
        </div>
        <div style={{ color: UI.muted, fontSize: 12, fontWeight: 780 }}>{status}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 148px', gap: 10 }}>
        <input value={draft.name || draft.title || ''} onChange={e => patch({ name: e.target.value, title: e.target.value })} placeholder="Название подарка" style={input()} />
        <input value={draft.emoji || ''} onChange={e => patch({ emoji: e.target.value.slice(0, 4) })} placeholder="Иконка" style={input()} />
      </div>
      <textarea value={draft.description || ''} onChange={e => patch({ description: e.target.value })} placeholder="Описание" rows={4} style={input({ padding: 11, resize: 'vertical', lineHeight: '19px' })} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <select value={draft.type || 'purchase'} onChange={e => patch({ type: e.target.value, opportunityType: e.target.value === 'purchase' ? 'reward' : e.target.value })} style={input()}>
          {WORKSPACE_GIFT_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
        </select>
        <input type="number" value={draft.type === 'raffle' ? draft.ticketCost || '' : draft.cost || ''} onChange={e => draft.type === 'raffle' ? patch({ ticketCost: e.target.value }) : patch({ cost: e.target.value })} placeholder={draft.type === 'raffle' ? 'Ключей за билет' : 'Стоимость в ключах'} style={input()} />
        <input type="number" value={draft.stock ?? ''} onChange={e => patch({ stock: e.target.value, quantity: e.target.value, remaining: e.target.value })} placeholder="Остаток / лимит" style={input()} />
        {draft.type === 'raffle' ? <input type="datetime-local" value={inputDateTime(draft.raffleDate)} onChange={e => patch({ raffleDate: e.target.value ? new Date(e.target.value).toISOString() : '' })} style={input()} /> : <input type="date" value={(draft.endAt || '').slice(0, 10)} onChange={e => patch({ endAt: e.target.value })} style={input()} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <textarea value={draft.conditions || ''} onChange={e => patch({ conditions: e.target.value })} placeholder="Условия получения" rows={3} style={input({ padding: 11, resize: 'vertical' })} />
        <textarea value={draft.restrictions || ''} onChange={e => patch({ restrictions: e.target.value })} placeholder="Ограничения" rows={3} style={input({ padding: 11, resize: 'vertical' })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <select value={draft.eventId || ''} onChange={e => patch({ eventId: e.target.value })} style={input()}>
          <option value="">Связать с мероприятием</option>
          {(events || []).map(event => <option key={event.id} value={event.id}>{event.title || event.name}</option>)}
        </select>
        <select value={draft.newsId || ''} onChange={e => patch({ newsId: e.target.value })} style={input()}>
          <option value="">Связать с новостью</option>
          {(news || []).map(item => <option key={item.id} value={item.id}>{item.title || item.name}</option>)}
        </select>
        <input value={draft.qrValue || draft.qrCode || ''} onChange={e => patch({ qrValue: e.target.value, qrCode: e.target.value })} placeholder="QR / код выдачи" style={input()} />
        <input value={draft.tags?.join(', ') || ''} onChange={e => patch({ tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder="Теги" style={input()} />
      </div>
      <div style={card({ padding: 12, boxShadow: '0 10px 28px rgba(82,60,30,0.05)', display: 'grid', gap: 10 })}>
        <div style={{ color: UI.text, fontSize: 13, fontWeight: 900 }}>Медиа и предпросмотр</div>
        <PhotoUpload value={draft.coverPhoto || draft.imageUrl || ''} onChange={url => patch({ coverPhoto: url, imageUrl: url })} label="Обложка подарка" />
        <GalleryUpload value={draft.gallery || []} onChange={gallery => patch({ gallery })} label="Галерея подарка" />
      </div>
      <div style={card({ padding: 12, display: 'grid', gap: 6, boxShadow: '0 10px 28px rgba(82,60,30,0.05)' })}>
        <div style={{ color: UI.text, fontSize: 13, fontWeight: 900 }}>Предпросмотр</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(200,155,60,0.14)', display: 'grid', placeItems: 'center', overflow: 'hidden', fontSize: 24 }}>{draft.coverPhoto ? <img src={draft.coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : draft.emoji || '🎁'}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: UI.text, fontWeight: 900, overflowWrap: 'anywhere' }}>{draft.name || draft.title || 'Подарок АПГ'}</div>
            <div style={{ color: UI.soft, fontSize: 12, marginTop: 2 }}>{draft.type === 'raffle' ? `${draft.ticketCost || 0} ключей за билет` : `${draft.cost || 0} ключей`} · {draft.stock === '' || draft.stock === null ? 'без лимита' : `${draft.stock} шт.`}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['description', 'offer', 'conditions', 'variants'].map(type => <button key={type} onClick={() => lokiApply(type)} style={button('light', { minHeight: 34, padding: '7px 9px' })}>Локи: {type === 'description' ? 'описание' : type === 'offer' ? 'оффер' : type === 'conditions' ? 'условия' : 'варианты'}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => save().catch(error => onToast?.(error?.message || 'Не удалось сохранить', 'error'))} style={button('light')}>Сохранить</button>
        <button onClick={() => save({ submit: true }).catch(error => onToast?.(error?.message || 'Не удалось отправить', 'error'))} style={button('primary')}>На модерацию</button>
      </div>
    </div>
  );
}

export function WorkspaceGiftsCenter({ role, profile, events = [], news = [], onOpenPanel, onToast }) {
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [newMode, setNewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [type, setType] = useState('all');
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState('cards');

  const load = async () => {
    if (!profile?.id && role?.id !== 'admin') return;
    setLoading(true);
    setError('');
    try {
      const result = await userAction('workspaceGift:list', { role: role?.id, profileId: profile?.id || '' });
      setItems(result.gifts || []);
      setClaims(result.claims || []);
      setEntries(result.entries || []);
      setSelectedId(prev => prev || result.gifts?.[0]?.id || '');
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить подарки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.id, role?.id]);

  const filtered = useMemo(() => filterWorkspaceGifts(items, { query, status, type, period, view }), [items, query, status, type, period, view]);
  const kpis = useMemo(() => buildWorkspaceGiftKpis(items), [items]);
  const selected = newMode ? null : items.find(item => item.id === selectedId) || items[0] || null;
  const selectedClaims = claims.filter(claim => String(claim.prizeId || '') === String(selected?.id || ''));
  const selectedEntries = entries.filter(entry => String(entry.prizeId || '') === String(selected?.id || ''));
  const editorProfile = profile?.id ? profile : selected ? { id: selected.partnerId || selected.expertId || '', name: selected.donorName } : profile;
  const editorRole = role?.id === 'admin' && selected?.expertId ? { id: 'expert' } : role?.id === 'admin' && selected?.partnerId ? { id: 'partner' } : role;
  const conversion = kpis.views ? `${Math.round((kpis.received / kpis.views) * 1000) / 10}%` : '0%';

  const upsert = item => {
    setItems(prev => {
      const exists = prev.some(row => row.id === item.id);
      return exists ? prev.map(row => row.id === item.id ? item : row) : [item, ...prev];
    });
    setSelectedId(item.id);
    setNewMode(false);
  };

  const submit = async item => {
    const result = await userAction('workspaceGift:submit', { id: item.id, role: item.expertId ? 'expert' : item.partnerId ? 'partner' : role?.id, profileId: item.expertId || item.partnerId || profile?.id, patch: item });
    upsert(result.gift);
    onToast?.('Подарок отправлен на модерацию.', 'success');
  };

  const archive = async item => {
    const result = await userAction('workspaceGift:archive', { id: item.id, role: item.expertId ? 'expert' : item.partnerId ? 'partner' : role?.id, profileId: item.expertId || item.partnerId || profile?.id });
    upsert(result.gift);
    onToast?.('Подарок отправлен в архив.', 'success');
  };

  const markGiven = async claim => {
    const result = await userAction('workspaceGift:claimStatus', { claimId: claim.id, status: 'given', role: selected?.expertId ? 'expert' : selected?.partnerId ? 'partner' : role?.id, profileId: selected?.expertId || selected?.partnerId || profile?.id });
    setClaims(prev => prev.map(item => item.id === claim.id ? result.claim : item));
    onToast?.('Выдача отмечена как выполненная.', 'success');
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={card({ padding: 16, background: UI.strong })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: UI.muted, fontSize: 12, fontWeight: 820, textTransform: 'uppercase', letterSpacing: 0 }}>Workspace Gifts Center</div>
            <div style={{ color: UI.text, fontSize: 25, lineHeight: '31px', fontWeight: 940, marginTop: 4 }}>Подарки, бонусы и призы</div>
            <div style={{ color: UI.soft, fontSize: 13, lineHeight: '19px', marginTop: 5, maxWidth: 740 }}>Управляйте жизненным циклом подарка: создание, модерация, публикация, получение, выдача и аналитика.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setNewMode(true); setSelectedId(''); }} style={button('primary')}>Создать подарок</button>
            <button onClick={() => onOpenPanel?.('rewards')} style={button('light')}>Витрина призов</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(92px,1fr))', gap: 10, marginTop: 14 }}>
          <Kpi label="Всего" value={kpis.total} />
          <Kpi label="Активные" value={kpis.published} color={UI.green} />
          <Kpi label="Черновики" value={kpis.draft} color={UI.blue} />
          <Kpi label="Модерация" value={kpis.moderation} color={UI.gold} />
          <Kpi label="Архив" value={kpis.archived} />
          <Kpi label="Получено" value={kpis.received} color={UI.violet} />
          <Kpi label="Выдано" value={kpis.issued} color={UI.green} />
          <Kpi label="Остаток" value={kpis.remaining} />
          <Kpi label="Конверсия" value={conversion} color={UI.gold} />
        </div>
      </div>

      <div style={card({ padding: 12, display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) repeat(4, max-content)', gap: 8, alignItems: 'center' })}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по названию, условиям, тегам" style={input()} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={input()}>
          {STATUS_FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} style={input()}>
          <option value="all">Все типы</option>
          {WORKSPACE_GIFT_TYPES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={input()}>
          {PERIODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {['cards', 'table', 'calendar'].map(mode => <button key={mode} onClick={() => setView(mode)} style={button(view === mode ? 'primary' : 'light', { minHeight: 36, padding: '7px 9px' })}>{mode === 'cards' ? 'Карточки' : mode === 'table' ? 'Таблица' : 'Окончание'}</button>)}
        </div>
      </div>

      {loading ? (
        <div style={card({ padding: 22, color: UI.soft, fontWeight: 820 })}>Загружаем подарки...</div>
      ) : error ? (
        <div style={card({ padding: 18, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' })}>
          <span style={{ color: UI.red, fontWeight: 820 }}>{error}</span>
          <button onClick={load} style={button('primary')}>Повторить</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(380px,0.48fr)', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.length ? filtered.map(item => (
              <GiftRow key={item.id} item={item} view={view} selected={!newMode && selected?.id === item.id} onOpen={row => { setSelectedId(row.id); setNewMode(false); }} onSubmit={submit} onArchive={archive} />
            )) : (
              <div style={card({ padding: 22, textAlign: 'center', boxShadow: '0 12px 32px rgba(82,60,30,0.06)' })}>
                <div style={{ color: UI.text, fontSize: 17, fontWeight: 900 }}>Подарков по фильтру нет</div>
                <div style={{ color: UI.soft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Создайте первый подарок или измените фильтры.</div>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <GiftEditor item={selected || { ...defaultDraft(editorProfile, editorRole) }} profile={editorProfile} role={editorRole} events={events} news={news} onSaved={upsert} onToast={onToast} />
            <div style={card({ padding: 14, display: 'grid', gap: 10, background: UI.strong })}>
              <div style={{ color: UI.text, fontSize: 16, fontWeight: 920 }}>История выдачи</div>
              {!selected && <div style={{ color: UI.soft, fontSize: 13 }}>Сохраните подарок, чтобы увидеть выдачи и заявки.</div>}
              {selected && selectedClaims.length === 0 && <div style={{ color: UI.soft, fontSize: 13 }}>Получений пока нет.</div>}
              {selectedClaims.map(claim => {
                const given = ['given', 'issued', 'completed'].includes(String(claim.status || '').toLowerCase());
                return (
                  <div key={claim.id} style={{ ...card({ padding: 10, boxShadow: '0 8px 24px rgba(82,60,30,0.05)', display: 'flex', gap: 10, alignItems: 'center' }), opacity: given ? 0.62 : 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: given ? 'rgba(46,179,107,0.12)' : 'rgba(200,155,60,0.14)', display: 'grid', placeItems: 'center' }}>{claim.prizeEmoji || '🎁'}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: UI.text, fontSize: 13, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.userName || claim.userId || 'Участник АПГ'}</div>
                      <div style={{ color: UI.muted, fontSize: 11, marginTop: 2 }}>{dateText(claim.claimedAt)} · {claim.status || 'pending'} {claim.qrValue || claim.code ? `· QR ${claim.qrValue || claim.code}` : ''}</div>
                    </div>
                    {!given && <button onClick={() => markGiven(claim).catch(error => onToast?.(error?.message || 'Не удалось обновить выдачу', 'error'))} style={button('primary', { minHeight: 32, padding: '6px 9px', fontSize: 12 })}>Выдан</button>}
                  </div>
                );
              })}
              {selected && selectedEntries.length > 0 && (
                <div style={{ borderTop: `1px solid ${UI.line}`, paddingTop: 10 }}>
                  <div style={{ color: UI.text, fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Розыгрыш</div>
                  <div style={{ color: UI.soft, fontSize: 12 }}>{selectedEntries.length} участников · {selectedEntries.reduce((sum, entry) => sum + Number(entry.ticketsCount || 0), 0)} билетов</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceGiftsCenter;
