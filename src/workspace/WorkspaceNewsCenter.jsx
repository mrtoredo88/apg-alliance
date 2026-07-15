import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { GalleryUpload, PhotoUpload } from '../PhotoUpload.jsx';
import { userAction } from '../userApi.js';
import { NEWS_CATEGORIES, getNewsCategoryLabel, getNewsImage, getNewsStats, getNewsText, getNewsTitle } from '../newsUtils.js';
import {
  buildWorkspaceNewsKpis,
  filterWorkspaceNews,
  isApgNewsPublication,
  sanitizeWorkspaceNewsPatch,
  workspaceNewsStatus,
  workspaceNewsStatusLabel,
} from '../../server-shared/workspace-news.js';
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
  ['scheduled', 'Запланировано'],
  ['archived', 'Архив'],
  ['all', 'Все'],
];

const PERIODS = [
  ['all', 'Любой период'],
  ['today', 'Сегодня'],
  ['week', 'Неделя'],
  ['month', 'Месяц'],
];

const PUBLICATION_TYPES = [
  ['Новость', 'Новость'],
  ['Фото', 'Фото'],
  ['Видео', 'Видео'],
  ['Совет', 'Совет'],
  ['История', 'История'],
  ['Кейс', 'Кейс'],
  ['Анонс', 'Анонс'],
  ['Обновление', 'Обновление'],
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

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateText(value) {
  const date = toDate(value);
  return date ? date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Дата не задана';
}

function Kpi({ label, value, color }) {
  return (
    <div style={card({ padding: 12, minHeight: 64, boxShadow: '0 12px 32px rgba(82,60,30,0.07)' })}>
      <div style={{ color: UI.muted, fontSize: 11, fontWeight: 780, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
      <div style={{ color: color || UI.text, fontSize: 23, lineHeight: '28px', fontWeight: 930, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Empty({ title, text }) {
  return (
    <div style={card({ padding: 22, textAlign: 'center', boxShadow: '0 12px 32px rgba(82,60,30,0.06)' })}>
      <div style={{ color: UI.text, fontSize: 17, fontWeight: 900 }}>{title}</div>
      <div style={{ color: UI.soft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{text}</div>
    </div>
  );
}

function NewsRow({ item, view, selected, onOpen, onSubmit, onArchive }) {
  const stats = getNewsStats(item);
  const image = getNewsImage(item);
  const status = workspaceNewsStatus(item);
  const apgPublication = isApgNewsPublication(item);
  const statusColor = status === 'published' ? UI.green : status === 'moderation' || status === 'scheduled' ? UI.gold : status === 'archived' ? UI.muted : UI.blue;
  const compact = view === 'table';
  return (
    <button onClick={() => onOpen(item)} style={{ ...card({ padding: compact ? 10 : 12, display: 'grid', gridTemplateColumns: compact ? '1fr auto' : '86px minmax(0,1fr) auto', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', boxShadow: selected ? '0 18px 44px rgba(200,155,60,0.18)' : '0 10px 28px rgba(82,60,30,0.06)', border: selected ? '1px solid rgba(200,155,60,0.42)' : `1px solid ${UI.line}` }), fontFamily: 'inherit', cursor: 'pointer' }}>
      {!compact && <div style={{ width: 86, height: 64, borderRadius: 8, overflow: 'hidden', background: 'rgba(200,155,60,0.14)', display: 'grid', placeItems: 'center', color: UI.gold, fontSize: 24 }}>{image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📰'}</div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: statusColor, border: `1px solid ${statusColor}55`, background: `${statusColor}12`, borderRadius: 999, padding: '4px 7px', fontSize: 11, fontWeight: 850 }}>{workspaceNewsStatusLabel(item)}</span>
          <span style={{ color: apgPublication ? UI.gold : UI.blue, border: `1px solid ${apgPublication ? 'rgba(200,155,60,0.30)' : 'rgba(91,143,219,0.30)'}`, background: apgPublication ? 'rgba(200,155,60,0.10)' : 'rgba(91,143,219,0.10)', borderRadius: 999, padding: '4px 7px', fontSize: 11, fontWeight: 850 }}>{apgPublication ? 'АПГ' : 'Только профиль'}</span>
          <span style={{ color: UI.gold, border: `1px solid rgba(200,155,60,0.26)`, background: 'rgba(200,155,60,0.10)', borderRadius: 999, padding: '4px 7px', fontSize: 11, fontWeight: 850 }}>{item.publicationType || 'Новость'}</span>
          <span style={{ color: UI.muted, fontSize: 11, fontWeight: 760 }}>{getNewsCategoryLabel(item)}</span>
          <span style={{ color: UI.muted, fontSize: 11, fontWeight: 760 }}>{item.source || 'workspace'}</span>
        </div>
        <div style={{ color: UI.text, fontSize: compact ? 14 : 16, lineHeight: compact ? '19px' : '21px', fontWeight: 920, marginTop: 6, overflowWrap: 'anywhere' }}>{getNewsTitle(item)}</div>
        {!compact && <div style={{ color: UI.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle || item.summary || getNewsText(item) || 'Текст публикации пока не заполнен'}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: UI.muted, fontSize: 11.5, marginTop: 8 }}>
          <span>{dateText(item.publishedAt || item.scheduledAt || item.updatedAt || item.createdAt)}</span>
          <span>{item.author || item.sourceName || 'Автор не указан'}</span>
          <span>{stats.views} просмотров</span>
          <span>{stats.comments} комментариев</span>
          <span>{stats.likes} реакций</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        {!apgPublication && status !== 'archived' && <span onClick={event => { event.stopPropagation(); onSubmit(item); }} style={button('primary', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Опубликовать в АПГ</span>}
        {status !== 'archived' && <span onClick={event => { event.stopPropagation(); onArchive(item); }} style={button('light', { minHeight: 30, padding: '5px 8px', fontSize: 12 })}>Архив</span>}
      </div>
    </button>
  );
}

function defaultDraft(profile, role) {
  return {
    title: '',
    subtitle: '',
    summary: '',
    text: '',
    category: role === 'expert' ? 'experts' : 'partners',
    publicationType: 'Новость',
    timelineType: 'publication',
    coverPhoto: '',
    gallery: [],
    tags: [],
    linkUrl: '',
    linkLabel: '',
    videos: [],
    ctaButtons: [],
    seoTitle: '',
    seoDescription: '',
    commentsEnabled: true,
    status: 'published',
    active: true,
    author: profile?.name || profile?.title || '',
    sourceName: profile?.name || profile?.title || '',
    distributionMode: 'profile',
    visibility: 'profile',
    publishScope: 'profile',
    apgPublication: false,
    profileOnly: true,
  };
}

function NewsEditor({ item, profile, role, events, onSaved, onCreatedFromEvent, onClose, onToast }) {
  const storageKey = `apg.workspace.news.draft.${role?.id || 'partner'}.${profile?.id || 'none'}.${item?.id || 'new'}`;
  const [draft, setDraft] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) return { ...defaultDraft(profile, role?.id), ...JSON.parse(saved) };
    return { ...defaultDraft(profile, role?.id), ...(item || {}) };
  });
  const [status, setStatus] = useState('Готово');
  const dirtyRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setDraft(saved ? { ...defaultDraft(profile, role?.id), ...JSON.parse(saved) } : { ...defaultDraft(profile, role?.id), ...(item || {}) });
    dirtyRef.current = false;
    setStatus('Готово');
  }, [item?.id, profile?.id, role?.id]);

  const patch = value => {
    dirtyRef.current = true;
    setDraft(prev => ({ ...prev, ...value }));
  };

  const save = async ({ submit = false, silent = false } = {}) => {
    const clean = sanitizeWorkspaceNewsPatch(draft);
    if (!clean.title && !clean.text) {
      onToast?.('Добавьте заголовок или текст.', 'error');
      return null;
    }
    setStatus(submit ? 'Отправляем в АПГ...' : 'Публикуем в профиле...');
    let currentId = item?.id || draft.id || '';
    if (submit) {
      const created = await userAction('workspaceNews:save', { id: currentId, profileId: profile.id, role: role?.id, patch: clean });
      currentId = currentId || created.id;
      onSaved(created.news);
    }
    const result = await userAction(submit ? 'workspaceNews:submit' : 'workspaceNews:save', submit
      ? { id: currentId, profileId: profile.id, role: role?.id }
      : { id: currentId, profileId: profile.id, role: role?.id, patch: clean });
    localStorage.removeItem(storageKey);
    dirtyRef.current = false;
    setStatus(submit ? 'Отправлено на модерацию АПГ' : 'Опубликовано в профиле');
    onSaved(result.news || { ...draft, ...result.patch, id: result.id || draft.id });
    if (!silent) onToast?.(submit ? 'Публикация отправлена на модерацию АПГ.' : 'Публикация обновлена в профиле.', 'success');
    return result;
  };

  useEffect(() => {
    if (!dirtyRef.current) return undefined;
    localStorage.setItem(storageKey, JSON.stringify(draft));
    setStatus('Черновик сохранён локально');
    const timer = setTimeout(() => save({ silent: true }).catch(error => setStatus(error?.message || 'Не удалось сохранить')), 1200);
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
  }, [draft, item?.id, profile?.id]);

  const lokiApply = type => {
    if (type === 'title') patch({ title: draft.title ? `${draft.title}: главное для жителей` : 'Что важно знать жителям Зеленограда' });
    if (type === 'summary') patch({ summary: (draft.text || draft.title || '').slice(0, 180) });
    if (type === 'cta') patch({ ctaButtons: [{ label: 'Подробнее', url: draft.linkUrl || '' }] });
    if (type === 'social') patch({ text: `${draft.text || draft.summary || draft.title}\n\nКоротко: ${draft.summary || draft.subtitle || draft.title}`.trim() });
  };

  return (
    <div style={card({ padding: 14, display: 'grid', gap: 12, background: UI.strong })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <div>
          <div style={{ color: UI.gold, fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Редактор публикации</div>
          <div style={{ color: UI.text, fontSize: 20, lineHeight: '25px', fontWeight: 940, marginTop: 3 }}>{item?.id ? 'Редактирование публикации' : 'Новая публикация'}</div>
          <div style={{ color: UI.muted, fontSize: 12, marginTop: 3 }}>{status}</div>
          <div style={{ color: UI.soft, fontSize: 12.5, lineHeight: '18px', marginTop: 7 }}>Сохранение публикует запись в личной ленте профиля. Для общей новостной ленты АПГ отправьте её на модерацию отдельно.</div>
        </div>
        <button onClick={onClose} style={button('light', { minHeight: 32, padding: '6px 8px' })}>Закрыть</button>
      </div>

      <PhotoUpload value={draft.coverPhoto || draft.imageUrl || ''} onChange={value => patch({ coverPhoto: value, imageUrl: value })} folder="news" label="Обложка новости" shape="cover" theme={{ chipBg: UI.controlSoft, border: UI.line, textSec: UI.soft, gold: UI.gold }} />
      <GalleryUpload value={Array.isArray(draft.gallery) ? draft.gallery : []} onChange={value => patch({ gallery: value, photos: value })} folder="news" max={8} theme={{ chipBg: UI.controlSoft, border: UI.line, textSec: UI.soft, gold: UI.gold }} />

      <input value={draft.title || ''} onChange={event => patch({ title: event.target.value })} placeholder="Заголовок" style={input({ fontSize: 18, fontWeight: 850 })} />
      <input value={draft.subtitle || ''} onChange={event => patch({ subtitle: event.target.value })} placeholder="Подзаголовок" style={input()} />
      <textarea value={draft.summary || ''} onChange={event => patch({ summary: event.target.value })} placeholder="Краткое описание" style={input({ minHeight: 74, padding: 11, lineHeight: '19px', resize: 'vertical' })} />
      <textarea value={draft.text || draft.fullText || ''} onChange={event => patch({ text: event.target.value, fullText: event.target.value })} placeholder="Текст новости, markdown, цитаты и блоки" style={input({ minHeight: 220, padding: 12, lineHeight: '20px', resize: 'vertical' })} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
        <select value={draft.category || 'partners'} onChange={event => patch({ category: event.target.value })} style={button('light')}>{NEWS_CATEGORIES.filter(item => item.id !== 'all').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <select value={draft.publicationType || 'Новость'} onChange={event => patch({ publicationType: event.target.value, timelineType: event.target.value.toLowerCase() })} style={button('light')}>{PUBLICATION_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <input value={(draft.tags || []).join(', ')} onChange={event => patch({ tags: event.target.value.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="Теги через запятую" style={input()} />
        <input value={draft.linkUrl || ''} onChange={event => patch({ linkUrl: event.target.value })} placeholder="Ссылка" style={input()} />
        <input value={draft.linkLabel || ''} onChange={event => patch({ linkLabel: event.target.value })} placeholder="Текст кнопки" style={input()} />
        <input value={draft.publishedAt || ''} onChange={event => patch({ publishedAt: event.target.value })} placeholder="Дата публикации ISO" style={input()} />
        <input value={draft.scheduledAt || ''} onChange={event => patch({ scheduledAt: event.target.value, status: 'scheduled' })} placeholder="Запланировать ISO" style={input()} />
      </div>

      <div style={card({ padding: 12, boxShadow: 'none', background: 'rgba(200,155,60,0.08)' })}>
        <div style={{ color: UI.text, fontSize: 14, fontWeight: 900 }}>Локи помогает</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
          <button onClick={() => lokiApply('title')} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>Заголовок</button>
          <button onClick={() => lokiApply('summary')} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>Описание</button>
          <button onClick={() => lokiApply('cta')} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>CTA</button>
          <button onClick={() => lokiApply('social')} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>Для соцсетей</button>
        </div>
      </div>

      <div style={card({ padding: 12, boxShadow: 'none' })}>
        <div style={{ color: UI.text, fontSize: 14, fontWeight: 900 }}>Создать из мероприятия</div>
        <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
          {events.slice(0, 5).map(event => <button key={event.id} onClick={() => onCreatedFromEvent(event.id)} style={{ ...button('light'), textAlign: 'left' }}>{event.title || event.name || 'Мероприятие'} · {dateText(event.startAt || event.eventDate || event.date)}</button>)}
          {!events.length && <div style={{ color: UI.muted, fontSize: 12 }}>Нет доступных мероприятий для черновика.</div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => save()} style={button('light')}>Опубликовать в профиле</button>
        <button onClick={() => save({ submit: true })} style={button('primary')}>Опубликовать в АПГ</button>
      </div>
    </div>
  );
}

function Preview({ item }) {
  if (!item) return <Empty title="Выберите публикацию" text="Предпросмотр и статистика появятся справа." />;
  const image = getNewsImage(item);
  return (
    <div style={card({ padding: 14, display: 'grid', gap: 10 })}>
      <div style={{ height: 160, borderRadius: 8, overflow: 'hidden', background: 'rgba(200,155,60,0.12)', display: 'grid', placeItems: 'center', color: UI.gold, fontSize: 32 }}>{image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📰'}</div>
      <div style={{ color: UI.gold, fontSize: 12, fontWeight: 850 }}>{getNewsCategoryLabel(item)} · {workspaceNewsStatusLabel(item)}</div>
      <div style={{ color: isApgNewsPublication(item) ? UI.gold : UI.blue, fontSize: 12, fontWeight: 850 }}>{isApgNewsPublication(item) ? 'Общая лента АПГ' : 'Личная лента профиля'}</div>
      <div style={{ color: UI.text, fontSize: 20, lineHeight: '25px', fontWeight: 940 }}>{getNewsTitle(item)}</div>
      <div style={{ color: UI.soft, fontSize: 13, lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{(item.summary || getNewsText(item)).slice(0, 700)}</div>
      <div style={{ color: UI.muted, fontSize: 12 }}>Push: {isApgNewsPublication(item) ? (item.pushStatus || 'через модерацию') : 'не отправляется'} · VK: {item.vkPostId || item.postUrl ? 'связано' : 'не связано'}</div>
    </div>
  );
}

export function WorkspaceNewsCenter({ role, profile, events = [], actions, onOpenPanel, onToast }) {
  const initialIntent = useMemo(() => readWorkspaceLinkIntent('content') || {}, []);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState(initialIntent.query || '');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('all');
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState('cards');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);

  const load = async () => {
    if (!profile?.id || !['partner', 'expert'].includes(role?.id)) return;
    setLoading(true);
    setError('');
    try {
      const result = await userAction('workspaceNews:list', { profileId: profile.id, role: role.id });
      const rows = Array.isArray(result.news) ? result.news : [];
      setItems(rows);
      setSelected(prev => prev ? rows.find(item => item.id === prev.id) || prev : rows[0] || null);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить публикации');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.id, role?.id]);

  useEffect(() => {
    if (!selected?.id) {
      setComments([]);
      return;
    }
    fetch(`${API_BASE_URL}/api/news-comments?newsId=${encodeURIComponent(selected.id)}`)
      .then(res => res.json())
      .then(data => setComments(Array.isArray(data.comments) ? data.comments : []))
      .catch(() => setComments([]));
  }, [selected?.id]);

  const kpis = useMemo(() => buildWorkspaceNewsKpis(items), [items]);
  const filtered = useMemo(() => filterWorkspaceNews(items, { query, status, category, period, view }), [items, query, status, category, period, view]);

  const upsert = news => {
    if (!news?.id) return;
    setItems(prev => prev.some(item => item.id === news.id) ? prev.map(item => item.id === news.id ? { ...item, ...news } : item) : [news, ...prev]);
    setSelected(prev => prev?.id === news.id ? { ...prev, ...news } : news);
  };

  useEffect(() => {
    if (!initialIntent.newsId || selected?.id) return;
    const found = items.find(item => String(item.id || '') === String(initialIntent.newsId));
    if (found) setSelected(found);
  }, [initialIntent.newsId, items, selected?.id]);

  const submit = async item => {
    const result = await userAction('workspaceNews:submit', { id: item.id, profileId: profile.id, role: role.id });
    upsert(result.news);
    onToast?.('Публикация отправлена на модерацию АПГ.', 'success');
  };

  const archive = async item => {
    if (!window.confirm('Отправить новость в архив?')) return;
    const result = await userAction('workspaceNews:archive', { id: item.id, profileId: profile.id, role: role.id });
    upsert(result.news);
    onToast?.('Новость отправлена в архив.', 'success');
  };

  const createFromEvent = async eventId => {
    const result = await userAction('workspaceNews:fromEvent', { eventId, profileId: profile.id, role: role.id });
    upsert(result.news);
    onToast?.('Публикация по мероприятию опубликована в профиле.', 'success');
  };

  if (!profile?.id || !['partner', 'expert'].includes(role?.id)) {
    return <div style={card({ padding: 24 })}><h2 style={{ margin: 0, color: UI.text }}>Новости</h2><p style={{ color: UI.soft }}>Контент-центр доступен партнёрам и экспертам после выбора рабочего профиля.</p></div>;
  }

  return (
    <div data-workspace-news-center style={{ display: 'grid', gap: 14 }}>
      <section style={card({ padding: 18, background: 'var(--apg-workspace-panel-accent, linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,248,232,0.82)))' })}>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ color: UI.gold, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>Контент-центр</div>
            <h1 style={{ margin: '5px 0 0', color: UI.text, fontSize: 30, lineHeight: '36px', fontWeight: 940 }}>Лента и публикации</h1>
            <div style={{ color: UI.soft, fontSize: 14.5, lineHeight: '21px', marginTop: 5 }}>{profile.name || profile.title}: новости, фото, видео, советы, истории, кейсы, черновики, модерация и статистика.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={load} style={button('light')}>{loading ? 'Обновляем...' : 'Обновить'}</button>
            <button onClick={() => setSelected({ ...defaultDraft(profile, role.id), id: '' })} style={button('primary')}>Создать публикацию</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 10, marginTop: 16 }}>
          <Kpi label="Всего" value={kpis.total} />
          <Kpi label="Черновики" value={kpis.draft} color={UI.blue} />
          <Kpi label="На модерации" value={kpis.moderation} color={UI.gold} />
          <Kpi label="Опубликовано" value={kpis.published} color={UI.green} />
          <Kpi label="Запланировано" value={kpis.scheduled} />
          <Kpi label="Архив" value={kpis.archived} color={UI.muted} />
          <Kpi label="Просмотры" value={kpis.views} />
          <Kpi label="Комментарии" value={kpis.comments} />
        </div>
      </section>

      {error && <div style={card({ padding: 12, color: UI.red, background: 'rgba(217,93,84,0.10)', boxShadow: 'none' })}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px,1fr) minmax(380px,0.78fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={card({ padding: 12 })}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по заголовку, тегам, тексту" style={input()} />
              <select value={status} onChange={event => setStatus(event.target.value)} style={button('light')}>{STATUS_FILTERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
              <select value={category} onChange={event => setCategory(event.target.value)} style={button('light')}>{NEWS_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              <select value={period} onChange={event => setPeriod(event.target.value)} style={button('light')}>{PERIODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
              <select value={view} onChange={event => setView(event.target.value)} style={button('light')}><option value="cards">Карточки</option><option value="table">Таблица</option><option value="calendar">Календарь публикаций</option></select>
            </div>
          </div>
          {loading ? <div style={card({ padding: 18, color: UI.soft })}>Загружаем публикации...</div> : !filtered.length ? <Empty title="Публикаций нет" text="Создайте первую новость или измените фильтры." /> : filtered.map(item => <NewsRow key={item.id} item={item} view={view} selected={selected?.id === item.id} onOpen={setSelected} onSubmit={submit} onArchive={archive} />)}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <NewsEditor item={selected} profile={profile} role={role} events={events.filter(event => String(event.partnerId || event.expertId || event.submittedProfileId || '') === String(profile.id || ''))} onSaved={upsert} onCreatedFromEvent={createFromEvent} onClose={() => setSelected(null)} onToast={onToast} />
          <Preview item={selected} />
          <WorkspaceRelatedLinks
            links={buildWorkspaceRelatedLinks({ source: 'news', item: selected || {}, events, profile })}
            actions={actions}
            emptyText="Выберите новость, чтобы увидеть связанные мероприятия, автора и аналитику."
          />
          <div style={card({ padding: 14 })}>
            <div style={{ color: UI.text, fontSize: 16, fontWeight: 910 }}>Комментарии</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 9 }}>
              {comments.slice(0, 6).map(comment => <div key={comment.id} style={{ color: UI.soft, fontSize: 12.5, lineHeight: '18px' }}><b style={{ color: UI.text }}>{comment.userName}</b>: {comment.text}</div>)}
              {!comments.length && <div style={{ color: UI.muted, fontSize: 12.5 }}>Комментариев пока нет или новость ещё не опубликована.</div>}
              <button onClick={() => onOpenPanel?.('news')} style={button('light', { minHeight: 32, padding: '6px 8px', fontSize: 12 })}>Открыть публичную ленту</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceNewsCenter;
