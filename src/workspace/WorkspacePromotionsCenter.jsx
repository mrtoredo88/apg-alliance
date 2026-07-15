import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GalleryUpload, PhotoUpload } from '../PhotoUpload.jsx';
import { userAction } from '../userApi.js';
import {
  WORKSPACE_PROMOTION_TYPES,
  buildWorkspacePromotionKpis,
  filterWorkspacePromotions,
  sanitizeWorkspacePromotionPatch,
  workspacePromotionStatus,
  workspacePromotionStatusLabel,
} from '../../server-shared/workspace-promotions.js';
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

const STATUS_FILTERS = [
  ['active', 'Активные'],
  ['draft', 'Черновики'],
  ['moderation', 'На модерации'],
  ['published', 'Опубликовано'],
  ['revision', 'Доработка'],
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
    background: primary ? 'linear-gradient(135deg,#F3D98C,#C89B3C)' : danger ? 'rgba(217,93,84,0.10)' : UI.controlSoft,
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
    background: UI.control,
    color: UI.text,
    outline: 'none',
    padding: '0 11px',
    fontFamily: 'inherit',
    fontSize: 13,
    ...extra,
  };
}

function dateText(value) {
  if (!value) return 'Срок не задан';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
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
    title: '',
    description: '',
    offer: '',
    category: profile?.category || '',
    promotionType: 'special_offer',
    coverPhoto: profile?.coverPhoto || profile?.logoUrl || profile?.photo || '',
    gallery: Array.isArray(profile?.gallery) ? profile.gallery : [],
    conditions: '',
    restrictions: '',
    startAt: '',
    endAt: '',
    limit: 0,
    quantity: 0,
    remaining: 0,
    cost: 0,
    currency: 'RUB',
    buttonLabel: role?.id === 'expert' ? 'Записаться' : 'Открыть',
    buttonUrl: profile?.websiteUrl || profile?.bookingUrl || '',
    tags: [],
    ctaButtons: [],
    links: [],
    themeColor: '',
    seoTitle: '',
    seoDescription: '',
    status: 'draft',
  };
}

function PromotionRow({ item, view, selected, onOpen, onSubmit, onArchive }) {
  const status = workspacePromotionStatus(item);
  const statusColor = status === 'published' ? UI.green : status === 'moderation' ? UI.gold : status === 'archived' ? UI.muted : status === 'rejected' ? UI.red : UI.blue;
  const compact = view === 'table';
  const period = [item.startAt ? dateText(item.startAt) : '', item.endAt ? dateText(item.endAt) : ''].filter(Boolean).join(' - ') || 'Период не задан';
  return (
    <button onClick={() => onOpen(item)} style={{ ...card({ padding: compact ? 10 : 12, display: 'grid', gridTemplateColumns: compact ? '1fr auto' : '86px minmax(0,1fr) auto', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', boxShadow: selected ? '0 18px 44px rgba(200,155,60,0.18)' : '0 10px 28px rgba(82,60,30,0.06)', border: selected ? '1px solid rgba(200,155,60,0.42)' : `1px solid ${UI.line}` }), fontFamily: 'inherit', cursor: 'pointer' }}>
      {!compact && <div style={{ width: 86, height: 64, borderRadius: 8, overflow: 'hidden', background: 'rgba(200,155,60,0.14)', display: 'grid', placeItems: 'center', color: UI.gold, fontSize: 24 }}>{item.coverPhoto ? <img src={item.coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎁'}</div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: statusColor, border: `1px solid ${statusColor}55`, background: `${statusColor}12`, borderRadius: 999, padding: '4px 7px', fontSize: 11, fontWeight: 850 }}>{workspacePromotionStatusLabel(item)}</span>
          <span style={{ color: UI.muted, fontSize: 11, fontWeight: 760 }}>{WORKSPACE_PROMOTION_TYPES.find(type => type.id === item.promotionType)?.label || 'Акция'}</span>
          <span style={{ color: UI.muted, fontSize: 11, fontWeight: 760 }}>{item.profileName}</span>
        </div>
        <div style={{ color: UI.text, fontSize: compact ? 14 : 16, lineHeight: compact ? '19px' : '21px', fontWeight: 920, marginTop: 6, overflowWrap: 'anywhere' }}>{item.title || item.offer || 'Новая акция'}</div>
        {!compact && <div style={{ color: UI.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.offer || item.description || 'Условия акции пока не заполнены'}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: UI.muted, fontSize: 11.5, marginTop: 8 }}>
          <span>{period}</span>
          <span>{item.remaining || item.quantity || 'без лимита'} осталось</span>
          <span>{item.views || 0} просмотров</span>
          <span>{item.claimed || 0} заявок</span>
          <span>{item.used || 0} использовано</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        {['draft', 'revision'].includes(status) && <span onClick={event => { event.stopPropagation(); onSubmit(item); }} style={button('primary', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>На модерацию</span>}
        {status !== 'archived' && <span onClick={event => { event.stopPropagation(); onArchive(item); }} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Архив</span>}
      </div>
    </button>
  );
}

function PromotionEditor({ item, profile, role, events, news, onSaved, onToast }) {
  const storageKey = `apg.workspace.promotion.draft.${role?.id || 'partner'}.${profile?.id || 'none'}.${item?.id || 'main'}`;
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
    const clean = sanitizeWorkspacePromotionPatch(draft);
    if (!clean.title && !clean.offer && !clean.description) {
      onToast?.('Добавьте заголовок, описание или предложение.', 'error');
      return null;
    }
    setStatus(submit ? 'Отправляем...' : 'Сохраняем...');
    const result = await userAction(submit ? 'workspacePromotion:submit' : 'workspacePromotion:save', { profileId: profile.id, role: role?.id, patch: clean });
    localStorage.removeItem(storageKey);
    dirtyRef.current = false;
    setStatus(submit ? 'Отправлено на модерацию' : 'Сохранено');
    onSaved(result.promotion || { ...draft, ...clean });
    if (!silent) onToast?.(submit ? 'Акция отправлена на модерацию.' : 'Акция сохранена.', 'success');
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
    if (type === 'title') patch({ title: draft.title || `${profile?.name || 'Партнёр АПГ'}: специальное предложение` });
    if (type === 'description') patch({ description: draft.description || 'Короткое предложение для жителей Зеленограда с понятной выгодой и простыми условиями.' });
    if (type === 'cta') patch({ buttonLabel: role?.id === 'expert' ? 'Записаться' : 'Получить предложение' });
    if (type === 'conditions') patch({ conditions: draft.conditions || 'Действует при обращении через АПГ. Количество предложений ограничено.' });
  };

  return (
    <div style={card({ padding: 14, display: 'grid', gap: 12, background: UI.strong })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <div>
          <div style={{ color: UI.muted, fontSize: 12, fontWeight: 800 }}>Редактор акции</div>
          <div style={{ color: UI.text, fontSize: 18, fontWeight: 930 }}>{draft.title || 'Новая акция'}</div>
        </div>
        <div style={{ color: UI.muted, fontSize: 12, fontWeight: 780 }}>{status}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <input value={draft.title || ''} onChange={e => patch({ title: e.target.value })} placeholder="Название акции" style={input()} />
        <select value={draft.promotionType || 'special_offer'} onChange={e => patch({ promotionType: e.target.value })} style={input()}>
          {WORKSPACE_PROMOTION_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
        </select>
      </div>
      <textarea value={draft.description || ''} onChange={e => patch({ description: e.target.value, offer: e.target.value })} placeholder="Короткое описание и ценность предложения" rows={4} style={input({ padding: 11, resize: 'vertical', lineHeight: '19px' })} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <input value={draft.category || ''} onChange={e => patch({ category: e.target.value })} placeholder="Категория" style={input()} />
        <input value={draft.tags?.join(', ') || ''} onChange={e => patch({ tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder="Теги через запятую" style={input()} />
        <input type="date" value={(draft.startAt || '').slice(0, 10)} onChange={e => patch({ startAt: e.target.value })} style={input()} />
        <input type="date" value={(draft.endAt || '').slice(0, 10)} onChange={e => patch({ endAt: e.target.value })} style={input()} />
        <input type="number" value={draft.quantity || ''} onChange={e => patch({ quantity: e.target.value, remaining: e.target.value })} placeholder="Количество" style={input()} />
        <input type="number" value={draft.cost || ''} onChange={e => patch({ cost: e.target.value })} placeholder="Стоимость/цена" style={input()} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <textarea value={draft.conditions || ''} onChange={e => patch({ conditions: e.target.value })} placeholder="Условия" rows={3} style={input({ padding: 11, resize: 'vertical' })} />
        <textarea value={draft.restrictions || ''} onChange={e => patch({ restrictions: e.target.value })} placeholder="Ограничения" rows={3} style={input({ padding: 11, resize: 'vertical' })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <input value={draft.buttonLabel || ''} onChange={e => patch({ buttonLabel: e.target.value })} placeholder="Текст кнопки" style={input()} />
        <input value={draft.buttonUrl || ''} onChange={e => patch({ buttonUrl: e.target.value })} placeholder="Ссылка кнопки" style={input()} />
        <select value={draft.eventId || ''} onChange={e => patch({ eventId: e.target.value })} style={input()}>
          <option value="">Связать с мероприятием</option>
          {(events || []).map(event => <option key={event.id} value={event.id}>{event.title || event.name}</option>)}
        </select>
        <select value={draft.newsId || ''} onChange={e => patch({ newsId: e.target.value })} style={input()}>
          <option value="">Связать с новостью</option>
          {(news || []).map(item => <option key={item.id} value={item.id}>{item.title || item.name}</option>)}
        </select>
      </div>
      <div style={card({ padding: 12, boxShadow: '0 10px 28px rgba(82,60,30,0.05)', display: 'grid', gap: 10 })}>
        <div style={{ color: UI.text, fontSize: 13, fontWeight: 900 }}>Медиа</div>
        <PhotoUpload value={draft.coverPhoto || ''} onChange={url => patch({ coverPhoto: url, imageUrl: url })} label="Обложка акции" />
        <GalleryUpload value={draft.gallery || []} onChange={gallery => patch({ gallery })} label="Галерея акции" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['title', 'description', 'cta', 'conditions'].map(type => <button key={type} onClick={() => lokiApply(type)} style={button('light', { minHeight: 34, padding: '7px 9px' })}>Локи: {type === 'title' ? 'название' : type === 'description' ? 'текст' : type === 'cta' ? 'CTA' : 'условия'}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => save().catch(error => onToast?.(error?.message || 'Не удалось сохранить', 'error'))} style={button('light')}>Сохранить</button>
        <button onClick={() => save({ submit: true }).catch(error => onToast?.(error?.message || 'Не удалось отправить', 'error'))} style={button('primary')}>На модерацию</button>
      </div>
    </div>
  );
}

export function WorkspacePromotionsCenter({ role, profile, events = [], news = [], actions, onOpenPanel, onToast }) {
  const initialIntent = useMemo(() => readWorkspaceLinkIntent('offers') || {}, []);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(initialIntent.promotionId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(initialIntent.query || '');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('all');
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState('cards');

  const load = async () => {
    if (!profile?.id && role?.id !== 'admin') return;
    setLoading(true);
    setError('');
    try {
      const result = await userAction('workspacePromotion:list', { role: role?.id, profileId: profile?.id || '' });
      setItems(result.promotions || []);
      setSelectedId(prev => prev || result.promotions?.[0]?.id || '');
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить акции');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.id, role?.id]);

  const categories = useMemo(() => Array.from(new Set(items.map(item => item.category).filter(Boolean))), [items]);
  const filtered = useMemo(() => filterWorkspacePromotions(items, { query, status, category, period, view }), [items, query, status, category, period, view]);
  const kpis = useMemo(() => buildWorkspacePromotionKpis(items), [items]);
  const selected = items.find(item => item.id === selectedId) || items[0] || null;
  const editorProfile = profile?.id ? profile : selected ? { id: selected.profileId, name: selected.profileName } : profile;
  const editorRole = role?.id === 'admin' && selected?.profileType ? { id: selected.profileType } : role;
  const conversion = kpis.views ? `${Math.round((kpis.used / kpis.views) * 1000) / 10}%` : '0%';

  const upsert = item => {
    setItems(prev => {
      const exists = prev.some(row => row.id === item.id);
      return exists ? prev.map(row => row.id === item.id ? item : row) : [item, ...prev];
    });
    setSelectedId(item.id);
  };

  const submit = async item => {
    const result = await userAction('workspacePromotion:submit', { role: item.profileType || role?.id, profileId: item.profileId, patch: item });
    upsert(result.promotion);
    onToast?.('Акция отправлена на модерацию.', 'success');
  };

  const archive = async item => {
    const result = await userAction('workspacePromotion:archive', { role: item.profileType || role?.id, profileId: item.profileId });
    upsert(result.promotion);
    onToast?.('Акция отправлена в архив.', 'success');
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={card({ padding: 16, background: UI.strong })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: UI.muted, fontSize: 12, fontWeight: 820, textTransform: 'uppercase', letterSpacing: 0 }}>Workspace Promotions Center</div>
            <div style={{ color: UI.text, fontSize: 25, lineHeight: '31px', fontWeight: 940, marginTop: 4 }}>Акции как инструмент продаж</div>
            <div style={{ color: UI.soft, fontSize: 13, lineHeight: '19px', marginTop: 5, maxWidth: 720 }}>Создавайте предложения, отправляйте их на модерацию, следите за откликами и конверсией без отдельной системы акций.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedId(selected?.id || '')} style={button('primary')}>Создать акцию</button>
            <button onClick={() => onOpenPanel?.('offers')} style={button('light')}>Публичный каталог</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(96px,1fr))', gap: 10, marginTop: 14 }}>
          <Kpi label="Всего" value={kpis.total} />
          <Kpi label="Активные" value={kpis.published} color={UI.green} />
          <Kpi label="Черновики" value={kpis.draft} color={UI.blue} />
          <Kpi label="Модерация" value={kpis.moderation} color={UI.gold} />
          <Kpi label="Архив" value={kpis.archived} />
          <Kpi label="Просмотры" value={kpis.views} />
          <Kpi label="Заявки" value={kpis.claimed} />
          <Kpi label="Конверсия" value={conversion} color={UI.gold} />
        </div>
      </div>

      <div style={card({ padding: 12, display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) repeat(4, max-content)', gap: 8, alignItems: 'center' })}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по названию, условиям, тегам" style={input()} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={input()}>
          {STATUS_FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} style={input()}>
          <option value="all">Все категории</option>
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={input()}>
          {PERIODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {['cards', 'table', 'calendar'].map(mode => <button key={mode} onClick={() => setView(mode)} style={button(view === mode ? 'primary' : 'light', { minHeight: 36, padding: '7px 9px' })}>{mode === 'cards' ? 'Карточки' : mode === 'table' ? 'Таблица' : 'Календарь'}</button>)}
        </div>
      </div>

      {loading ? (
        <div style={card({ padding: 22, color: UI.soft, fontWeight: 820 })}>Загружаем акции...</div>
      ) : error ? (
        <div style={card({ padding: 18, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' })}>
          <span style={{ color: UI.red, fontWeight: 820 }}>{error}</span>
          <button onClick={load} style={button('primary')}>Повторить</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(360px,0.46fr)', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.length ? filtered.map(item => (
              <PromotionRow key={item.id} item={item} view={view} selected={selected?.id === item.id} onOpen={row => setSelectedId(row.id)} onSubmit={submit} onArchive={archive} />
            )) : (
              <div style={card({ padding: 22, textAlign: 'center', boxShadow: '0 12px 32px rgba(82,60,30,0.06)' })}>
                <div style={{ color: UI.text, fontSize: 17, fontWeight: 900 }}>Акций по фильтру нет</div>
                <div style={{ color: UI.soft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Создайте первое предложение или измените фильтры.</div>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <PromotionEditor item={selected || { ...defaultDraft(editorProfile, editorRole), id: `${editorRole?.id || 'partner'}:${editorProfile?.id || 'profile'}:main`, profileId: editorProfile?.id, profileType: editorRole?.id }} profile={editorProfile} role={editorRole} events={events} news={news} onSaved={upsert} onToast={onToast} />
            <WorkspaceRelatedLinks
              links={buildWorkspaceRelatedLinks({ source: 'promotion', item: selected || {}, events, news, promotions: items, profile })}
              actions={actions}
              emptyText="Выберите акцию, чтобы увидеть связанные подарки, события, новости и аналитику."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspacePromotionsCenter;
