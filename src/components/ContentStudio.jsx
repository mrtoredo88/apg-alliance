import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GalleryUpload, PhotoUpload } from '../PhotoUpload.jsx';
import { userAction } from '../userApi.js';
import { NEWS_CATEGORIES } from '../newsUtils.js';
import { APG2_PROFILE, GlassButton, GlassCard, GlassSection } from './Apg2ProfileGlass.jsx';
import { MdEditor } from './MdEditor.jsx';
import { UniversalFeedCard } from './FeedFramework.jsx';
import { sanitizeWorkspaceNewsPatch } from '../../server-shared/workspace-news.js';

const STATUS_LABELS = {
  draft: 'Черновик',
  dirty: 'Черновик',
  saving: 'Сохранение...',
  saved: 'Сохранено',
  error: 'Ошибка',
  published: 'Опубликовано',
  scheduled: 'Запланировано',
  moderation: 'На модерации',
  recovered: 'Найден черновик',
};

const PUBLICATION_TYPES = [
  ['Новость', 'Новость'],
  ['Анонс', 'Анонс'],
  ['Совет', 'Совет'],
  ['История', 'История'],
  ['Кейс', 'Кейс'],
  ['Фото', 'Фото'],
  ['Видео', 'Видео'],
];

const AI_EXTENSIONS = [
  ['rewrite', 'AI Rewrite'],
  ['summary', 'AI Summary'],
  ['image', 'AI Image'],
  ['title', 'AI Title'],
];

function safeLocalStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function readDraft(key) {
  const storage = safeLocalStorage();
  if (!storage || !key) return null;
  try {
    return JSON.parse(storage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeDraft(key, value) {
  const storage = safeLocalStorage();
  if (!storage || !key) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clearDraft(key) {
  const storage = safeLocalStorage();
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {}
}

function nowLocalDateTime() {
  const date = new Date(Date.now() + 3600000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function defaultDraft(profile = {}, role = 'partner') {
  const author = profile.name || profile.title || '';
  return {
    title: '',
    subtitle: '',
    summary: '',
    text: '',
    fullText: '',
    category: role === 'expert' ? 'experts' : 'partners',
    publicationType: 'Новость',
    timelineType: 'publication',
    coverPhoto: '',
    imageUrl: '',
    gallery: [],
    photos: [],
    videos: [],
    tags: [],
    linkUrl: '',
    linkLabel: '',
    commentsEnabled: true,
    status: 'draft',
    scheduledAt: '',
    author,
    sourceName: author,
    source: 'workspace',
    distributionMode: 'profile',
    visibility: 'profile',
    publishScope: 'profile',
    apgPublication: false,
    profileOnly: true,
  };
}

function normalizeDraft(draft = {}, profile = {}, role = 'partner') {
  const base = defaultDraft(profile, role);
  const next = { ...base, ...draft };
  next.gallery = Array.isArray(next.gallery) ? next.gallery.filter(Boolean) : [];
  next.photos = Array.isArray(next.photos) ? next.photos.filter(Boolean) : next.gallery;
  next.videos = Array.isArray(next.videos) ? next.videos.filter(Boolean) : [];
  next.tags = Array.isArray(next.tags) ? next.tags.filter(Boolean) : [];
  next.text = String(next.text || next.fullText || '');
  next.fullText = String(next.fullText || next.text || '');
  next.imageUrl = next.imageUrl || next.coverPhoto || '';
  next.coverPhoto = next.coverPhoto || next.imageUrl || '';
  return next;
}

function draftKey(profileId, role) {
  return profileId ? `apg_content_studio_draft_${role}_${profileId}` : '';
}

function contentHealth(draft = {}) {
  const text = String(draft.text || draft.fullText || '').trim();
  const title = String(draft.title || '').trim();
  return [
    !title ? 'Добавьте заголовок' : title.length < 12 ? 'Заголовок можно сделать подробнее' : '',
    !draft.category ? 'Выберите категорию' : '',
    !String(draft.summary || draft.subtitle || '').trim() ? 'Добавьте короткое описание' : '',
    !draft.coverPhoto && !(Array.isArray(draft.gallery) && draft.gallery.length) ? 'Добавьте изображение для ленты' : '',
    text.length < 80 ? 'Текст можно раскрыть подробнее' : '',
    !draft.linkUrl && !draft.linkLabel ? 'Можно добавить ссылку или действие' : '',
  ].filter(Boolean);
}

function getFeedPreviewItem(draft = {}, profile = {}, role = 'partner') {
  const type = String(draft.publicationType || '').toLowerCase();
  return {
    id: 'content-studio-preview',
    type: type.includes('видео') ? 'video' : type.includes('фото') ? 'photo' : 'publication',
    title: draft.title || 'Заголовок публикации',
    text: draft.text || draft.summary || 'Текст публикации появится здесь.',
    summary: draft.summary,
    image: draft.coverPhoto || draft.imageUrl || '',
    gallery: draft.gallery,
    videos: draft.videos,
    date: draft.scheduledAt || Date.now(),
    feedTimestamp: Date.now(),
    author: profile.name || profile.title || (role === 'expert' ? 'Эксперт АПГ' : 'Партнёр АПГ'),
    authorLogo: profile.logoUrl || profile.photo || '',
    entity: draft,
  };
}

function inputStyle(extra = {}) {
  return {
    minHeight: 44,
    borderRadius: 18,
    border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)',
    background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)',
    color: APG2_PROFILE.text,
    outline: 'none',
    padding: '0 13px',
    fontFamily: 'inherit',
    fontSize: 13,
    boxSizing: 'border-box',
    width: '100%',
    ...extra,
  };
}

function insertMarkdown(text, marker) {
  const value = String(text || '');
  if (marker === 'quote') return `${value}${value ? '\n' : ''}> Важная мысль\n`;
  if (marker === 'list') return `${value}${value ? '\n' : ''}- Первый пункт\n- Второй пункт\n`;
  if (marker === 'link') return `${value}${value ? '\n' : ''}[Подробнее](https://)\n`;
  if (marker === 'emoji') return `${value} ✨`;
  return value;
}

export function ContentStudio({ profile, role = 'partner', events = [], onToast }) {
  const key = draftKey(profile?.id, role);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);
  const [draft, setDraft] = useState(() => normalizeDraft(readDraft(key)?.data, profile, role));
  const [status, setStatus] = useState('draft');
  const [message, setMessage] = useState('Черновик готов к редактированию');
  const [recovery, setRecovery] = useState(null);
  const [videoInput, setVideoInput] = useState('');
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    const stored = readDraft(key);
    const nextDraft = normalizeDraft(stored?.data, profile, role);
    setDraft(nextDraft);
    setRecovery(stored?.data ? stored : null);
    setStatus(stored?.data ? 'recovered' : 'draft');
    setMessage(stored?.data ? 'Найден несохранённый черновик. Продолжить редактирование?' : 'Черновик готов к редактированию');
    dirtyRef.current = false;
  }, [key, profile?.id, role]);

  const health = useMemo(() => contentHealth(draft), [draft]);
  const previewItem = useMemo(() => getFeedPreviewItem(draft, profile, role), [draft, profile, role]);

  const patch = useCallback((value) => {
    dirtyRef.current = true;
    setDraft(prev => normalizeDraft({ ...prev, ...value }, profile, role));
    setStatus(prev => prev === 'recovered' ? 'recovered' : 'dirty');
    setMessage('Черновик изменён');
  }, [profile, role]);

  useEffect(() => {
    if (!key) return undefined;
    if (!dirtyRef.current) return undefined;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setStatus(prev => prev === 'recovered' ? prev : prev === 'published' || prev === 'moderation' ? prev : 'saving');
    saveTimerRef.current = setTimeout(() => {
      writeDraft(key, { data: draft, updatedAt: Date.now(), role, profileId: profile?.id });
      setStatus(prev => prev === 'recovered' ? prev : 'saved');
      setMessage('Черновик сохранён на устройстве');
    }, 900);
    return () => clearTimeout(saveTimerRef.current);
  }, [draft, key, profile?.id, role]);

  useEffect(() => {
    const beforeUnload = event => {
      if (!key || !readDraft(key)?.data) return undefined;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [key]);

  const restoreDraft = () => {
    if (!recovery?.data) return;
    dirtyRef.current = true;
    setDraft(normalizeDraft(recovery.data, profile, role));
    setRecovery(null);
    setStatus('saved');
    setMessage('Черновик восстановлен');
  };

  const discardDraft = () => {
    clearDraft(key);
    dirtyRef.current = false;
    setRecovery(null);
    setDraft(defaultDraft(profile, role));
    setStatus('draft');
    setMessage('Черновик очищен');
  };

  const publish = async ({ submit = false } = {}) => {
    const normalized = normalizeDraft(draft, profile, role);
    const patchData = sanitizeWorkspaceNewsPatch({
      ...normalized,
      status: normalized.scheduledAt && !submit ? 'scheduled' : 'published',
      scheduledAt: normalized.scheduledAt,
      active: true,
    });
    if (!patchData.title && !patchData.text) {
      setStatus('error');
      setMessage('Добавьте заголовок или текст');
      onToast?.('Добавьте заголовок или текст.', 'error');
      return;
    }
    setStatus('saving');
    setMessage(submit ? 'Отправляем на модерацию АПГ...' : 'Публикуем в личной ленте...');
    try {
      const saved = await userAction('workspaceNews:save', { profileId: profile.id, role, patch: patchData });
      if (submit) await userAction('workspaceNews:submit', { id: saved.id, profileId: profile.id, role });
      clearDraft(key);
      dirtyRef.current = false;
      setRecovery(null);
      setStatus(submit ? 'moderation' : normalized.scheduledAt ? 'scheduled' : 'published');
      setMessage(submit ? 'Публикация отправлена на модерацию АПГ' : normalized.scheduledAt ? 'Публикация подготовлена как запланированная' : 'Публикация появилась в личной ленте');
      setDraft(defaultDraft(profile, role));
      onToast?.(submit ? 'Публикация отправлена на модерацию АПГ.' : 'Публикация опубликована в личной ленте.', 'success');
    } catch (error) {
      writeDraft(key, { data: draft, updatedAt: Date.now(), role, profileId: profile?.id });
      setStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'error' : 'error');
      setMessage(error?.message || 'Ошибка публикации. Черновик сохранён на устройстве.');
      onToast?.(error?.message || 'Ошибка публикации. Черновик сохранён.', 'error');
    }
  };

  const addVideo = () => {
    const value = videoInput.trim();
    if (!value) return;
    patch({ videos: [...(draft.videos || []), value] });
    setVideoInput('');
  };

  const moveGallery = (from, to) => {
    const list = [...(draft.gallery || [])];
    if (to < 0 || to >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    patch({ gallery: list, photos: list });
  };

  if (!profile?.id) {
    return <GlassSection title="Content Studio"><GlassCard>Профиль ещё загружается.</GlassCard></GlassSection>;
  }

  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.draft;
  const statusTone = status === 'error' ? '#E64646' : status === 'published' || status === 'saved' ? '#4BB34B' : APG2_PROFILE.gold;

  return (
    <GlassSection title="Content Studio">
      <div style={{ display: 'grid', gap: 12 }}>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.7 }}>Современный редактор</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '28px', fontWeight: 940, marginTop: 4 }}>Публикация для Ленты</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Черновик сохраняется автоматически на устройстве. В личную ленту публикация попадает сразу, в АПГ — после модерации.</div>
            </div>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
              <div style={{ color: statusTone, fontSize: 13, fontWeight: 900 }}>{statusLabel}</div>
              <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, textAlign: 'right' }}>{message}</div>
            </div>
          </div>
          {recovery && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 18, background: 'rgba(215,184,106,0.12)', border: '1px solid rgba(215,184,106,0.28)' }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 880 }}>Найден несохранённый черновик. Продолжить редактирование?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <GlassButton tone="gold" onClick={restoreDraft} style={{ color: '#17120a', minHeight: 36, borderRadius: 14 }}>Продолжить</GlassButton>
                <GlassButton onClick={discardDraft} style={{ minHeight: 36, borderRadius: 14 }}>Начать заново</GlassButton>
              </div>
            </div>
          )}
        </GlassCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 12, alignItems: 'start' }}>
          <GlassCard style={{ borderRadius: 28, display: 'grid', gap: 10 }}>
            <input value={draft.title} onChange={e => patch({ title: e.target.value })} placeholder="Заголовок" style={inputStyle({ fontSize: 20, fontWeight: 900 })} />
            <input value={draft.subtitle} onChange={e => patch({ subtitle: e.target.value, summary: e.target.value })} placeholder="Подзаголовок" style={inputStyle()} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                ['quote', 'Цитата'],
                ['list', 'Список'],
                ['link', 'Ссылка'],
                ['emoji', 'Эмодзи'],
              ].map(([id, label]) => <GlassButton key={id} onClick={() => patch({ text: insertMarkdown(draft.text, id), fullText: insertMarkdown(draft.text, id) })} style={{ minHeight: 34, borderRadius: 14, padding: '6px 10px', fontSize: 12 }}>{label}</GlassButton>)}
            </div>
            <MdEditor value={draft.text} onChange={value => patch({ text: value, fullText: value })} placeholder="Основной текст. Можно использовать списки, цитаты, ссылки и выделение." style={inputStyle({ minHeight: 220, padding: 13, lineHeight: '21px', resize: 'vertical' })} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
              <select value={draft.category} onChange={e => patch({ category: e.target.value })} style={inputStyle()}>{NEWS_CATEGORIES.filter(item => item.id !== 'all').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              <select value={draft.publicationType} onChange={e => patch({ publicationType: e.target.value })} style={inputStyle()}>{PUBLICATION_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
              <input value={(draft.tags || []).join(', ')} onChange={e => patch({ tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })} placeholder="Теги через запятую" style={inputStyle()} />
              <input value={draft.linkUrl} onChange={e => patch({ linkUrl: e.target.value })} placeholder="Ссылка" style={inputStyle()} />
              <input value={draft.linkLabel} onChange={e => patch({ linkLabel: e.target.value })} placeholder="Текст кнопки" style={inputStyle()} />
              <input type="datetime-local" value={draft.scheduledAt} onChange={e => patch({ scheduledAt: e.target.value, status: e.target.value ? 'scheduled' : 'draft' })} style={inputStyle()} />
            </div>

            <div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 880, marginBottom: 8 }}>Медиа</div>
              <PhotoUpload value={draft.coverPhoto} onChange={url => patch({ coverPhoto: url, imageUrl: url })} folder={`content/${role}/${profile.id}/cover`} label="Перетащите обложку публикации" shape="cover" theme={{ chipBg: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: 'rgba(var(--apg2-glass-a,255,255,255),0.14)', textSec: APG2_PROFILE.textSoft, gold: APG2_PROFILE.gold }} />
              <GalleryUpload value={draft.gallery} onChange={value => patch({ gallery: value, photos: value })} folder={`content/${role}/${profile.id}/gallery`} max={8} theme={{ chipBg: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: 'rgba(var(--apg2-glass-a,255,255,255),0.14)', textSec: APG2_PROFILE.textSoft, gold: APG2_PROFILE.gold }} />
              {draft.gallery.length > 1 && (
                <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                  {draft.gallery.map((url, index) => (
                    <div key={`${url}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center', color: APG2_PROFILE.textSoft, fontSize: 12 }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Фото {index + 1}</span>
                      <GlassButton onClick={() => moveGallery(index, index - 1)} style={{ minHeight: 28, borderRadius: 12, padding: '4px 8px' }}>↑</GlassButton>
                      <GlassButton onClick={() => moveGallery(index, index + 1)} style={{ minHeight: 28, borderRadius: 12, padding: '4px 8px' }}>↓</GlassButton>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
                <input value={videoInput} onChange={e => setVideoInput(e.target.value)} placeholder="Ссылка на видео" style={inputStyle()} />
                <GlassButton onClick={addVideo} style={{ minHeight: 44, borderRadius: 18 }}>Добавить</GlassButton>
              </div>
              {draft.videos.length > 0 && <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{draft.videos.map((url, index) => <div key={`${url}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center', color: APG2_PROFILE.textSoft, fontSize: 12 }}><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span><GlassButton onClick={() => patch({ videos: draft.videos.filter((_, i) => i !== index) })} style={{ minHeight: 28, borderRadius: 12, padding: '4px 8px' }}>Удалить</GlassButton></div>)}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <GlassButton onClick={() => setPreview(value => !value)} style={{ minHeight: 40, borderRadius: 16 }}>{preview ? 'Скрыть предпросмотр' : 'Предпросмотр'}</GlassButton>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <GlassButton onClick={() => publish()} style={{ minHeight: 40, borderRadius: 16 }}>Опубликовать в профиле</GlassButton>
                <GlassButton tone="gold" onClick={() => publish({ submit: true })} style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Отправить в АПГ</GlassButton>
              </div>
            </div>
          </GlassCard>

          <div style={{ display: 'grid', gap: 12 }}>
            {preview && <GlassCard style={{ borderRadius: 28 }}><UniversalFeedCard item={previewItem} desktop /></GlassCard>}
            <GlassCard style={{ borderRadius: 28 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900 }}>Content Health</div>
              <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
                {health.length ? health.map(item => <div key={item} style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px' }}>• {item}</div>) : <div style={{ color: '#4BB34B', fontSize: 13, fontWeight: 820 }}>Публикация выглядит готовой.</div>}
              </div>
            </GlassCard>
            <GlassCard style={{ borderRadius: 28 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900 }}>AI Ready</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 5 }}>Точки расширения подготовлены для будущего подключения Локи.</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>{AI_EXTENSIONS.map(([id, label]) => <GlassButton key={id} disabled style={{ minHeight: 34, borderRadius: 14, padding: '6px 10px', opacity: 0.55 }}>{label}</GlassButton>)}</div>
            </GlassCard>
            {events.length > 0 && (
              <GlassCard style={{ borderRadius: 28 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900 }}>Связать с событием</div>
                <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>{events.slice(0, 4).map(event => <GlassButton key={event.id} onClick={() => patch({ title: draft.title || event.title || event.name || '', summary: draft.summary || event.description || '', linkLabel: 'Подробнее' })} style={{ justifyContent: 'flex-start', minHeight: 36, borderRadius: 14 }}>{event.title || event.name || 'Мероприятие'}</GlassButton>)}</div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </GlassSection>
  );
}

export default ContentStudio;
