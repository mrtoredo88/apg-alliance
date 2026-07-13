import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { userAction } from '../userApi.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, ScreenHeader } from '../components/Apg2ProfileGlass.jsx';
import { buildDialogAutoAnswer, buildDialogContext, getDialogObjectLabel } from '../../server-shared/context-dialogs.js';

function tsMs(value) {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function timeText(value) {
  const ms = tsMs(value);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function userIdOf(user) {
  return user?.id ? String(user.id) : '';
}

function ContextBadge({ context }) {
  return <GlassBadge tone={context?.type === 'promotion' ? 'gold' : 'glass'}>{getDialogObjectLabel(context)}</GlassBadge>;
}

function DialogListItem({ dialog, active, onClick }) {
  const context = dialog.context || {};
  const preview = dialog.lastMessage?.text || 'Диалог создан. Задайте вопрос по объекту.';
  return (
    <GlassCard onClick={onClick} style={{ borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 10, alignItems: 'center', border: active ? '1px solid rgba(215,184,106,0.44)' : APG2_PROFILE.glass.border }}>
      <div style={{ width: 42, height: 42, borderRadius: 16, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 20, overflow: 'hidden' }}>
        {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (context.type === 'event' ? '🎫' : context.type === 'expert' ? '✦' : context.type === 'promotion' ? '🎁' : '🏪')}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 870, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{context.title || 'Диалог АПГ'}</div>
        </div>
        <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 780, marginBottom: 3 }}>{context.parentTitle || context.subtitle || getDialogObjectLabel(context)}</div>
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        <ContextBadge context={context} />
        {dialog.unreadCount > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: APG2_PROFILE.gold, color: '#17120a', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{dialog.unreadCount}</span>}
      </div>
    </GlassCard>
  );
}

function ContextHeader({ context, onOpenObject }) {
  if (!context) return null;
  const rows = [
    context.subtitle,
    context.date,
    context.hours,
    context.address,
  ].filter(Boolean).slice(0, 3);
  return (
    <GlassCard style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 8px)', zIndex: 6, borderRadius: 26, padding: 14, display: 'grid', gridTemplateColumns: '52px 1fr', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 20, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 24, overflow: 'hidden' }}>
        {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (context.type === 'event' ? '🎫' : context.type === 'expert' ? '✦' : context.type === 'promotion' ? '🎁' : '🏪')}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <ContextBadge context={context} />
          {context.parentTitle && <GlassBadge>{context.parentTitle}</GlassBadge>}
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '21px', fontWeight: 900 }}>{context.title}</div>
        {rows.length > 0 && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 5 }}>{rows.join(' · ')}</div>}
        <GlassButton onClick={() => onOpenObject?.(context)} style={{ marginTop: 10, minHeight: 36, borderRadius: 16 }}>Открыть карточку</GlassButton>
      </div>
    </GlassCard>
  );
}

function MessageBubble({ message, own }) {
  const loki = message.senderRole === 'loki';
  return (
    <div style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '82%', borderRadius: own ? '22px 22px 6px 22px' : '22px 22px 22px 6px', padding: 12, background: loki ? APG2_PROFILE.goldSoft : own ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', border: loki ? '1px solid rgba(215,184,106,0.36)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', color: APG2_PROFILE.text }}>
        <div style={{ color: loki ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{loki ? 'Локи' : message.senderName || 'Участник'}</div>
        {message.text && <div style={{ fontSize: 14, lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{message.text}</div>}
        {message.attachments?.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {message.attachments.map((file, index) => file.type === 'image'
              ? <img key={file.url || index} src={file.url} alt={file.name || ''} style={{ maxWidth: 220, borderRadius: 16, border: '1px solid rgba(255,255,255,0.14)' }} />
              : <a key={file.url || index} href={file.url} target="_blank" rel="noreferrer" style={{ color: APG2_PROFILE.gold }}>{file.name || 'Файл'}</a>)}
          </div>
        )}
        <div style={{ marginTop: 5, color: APG2_PROFILE.textMuted, fontSize: 10.5, textAlign: 'right' }}>{timeText(message.createdAt)} · {message.status || 'delivered'}</div>
      </div>
    </div>
  );
}

function OwnerAssist({ enabled, onToggle, context, lastQuestion, onUse }) {
  const suggestion = enabled && lastQuestion ? `Можно ответить так: «Спасибо за вопрос по ${context?.title || 'объекту'}. Да, уточним детали и вернемся с точной информацией.»` : '';
  return (
    <GlassCard style={{ borderRadius: 22, padding: 12, display: 'grid', gap: 9 }}>
      <button onClick={() => onToggle(!enabled)} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', fontWeight: 850, cursor: 'pointer', padding: 0 }}>
        <span>ИИ помогает отвечать</span>
        <span style={{ width: 40, height: 24, borderRadius: 999, background: enabled ? APG2_PROFILE.gold : 'rgba(var(--apg2-glass-a,255,255,255),0.14)', display: 'grid', placeItems: 'center', color: enabled ? '#17120a' : APG2_PROFILE.textMuted, fontSize: 11 }}>{enabled ? 'on' : 'off'}</span>
      </button>
      {suggestion && (
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px' }}>
          {suggestion}
          <GlassButton onClick={() => onUse(suggestion.replace(/^Можно ответить так: «|»$/g, ''))} tone="gold" style={{ marginTop: 9, color: '#17120a' }}>Вставить ответ</GlassButton>
        </div>
      )}
    </GlassCard>
  );
}

export function ContextDialogsPage({ user, initialRequest, onBack, onOpenObject }) {
  const uid = userIdOf(user);
  const [dialogs, setDialogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeDialogId, setActiveDialogId] = useState('');
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [aiAssist, setAiAssist] = useState(Boolean(user?.contextDialogAiAssist));
  const [attachment, setAttachment] = useState(null);
  const messagesEndRef = useRef(null);
  const lastRequestRef = useRef(0);

  useEffect(() => setAiAssist(Boolean(user?.contextDialogAiAssist)), [user?.contextDialogAiAssist]);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubDialogs = onSnapshot(collection(db, 'users', uid, 'contextDialogs'), snap => {
      setDialogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => tsMs(b.lastMessageAt || b.updatedAt) - tsMs(a.lastMessageAt || a.updatedAt)));
    });
    const unsubMessages = onSnapshot(collection(db, 'users', uid, 'contextDialogMessages'), snap => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt)));
    });
    return () => { unsubDialogs(); unsubMessages(); };
  }, [uid]);

  useEffect(() => {
    const req = initialRequest;
    if (!uid || !req?.type || !req?.item || lastRequestRef.current === req.nonce) return;
    lastRequestRef.current = req.nonce;
    const context = buildDialogContext(req.type, req.item, { source: req.source || 'ui' });
    if (!context) return;
    setPending(true);
    setError('');
    userAction('dialog:open', { type: context.type, objectId: context.objectId, context })
      .then(result => setActiveDialogId(result.dialogId))
      .catch(err => setError(err?.message || 'Не удалось открыть диалог.'))
      .finally(() => setPending(false));
  }, [initialRequest, uid]);

  useEffect(() => {
    if (!activeDialogId) return;
    userAction('dialog:read', { dialogId: activeDialogId }).catch(() => {});
  }, [activeDialogId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeDialogId, messages.length]);

  const activeDialog = useMemo(() => dialogs.find(dialog => dialog.id === activeDialogId) || dialogs[0] || null, [dialogs, activeDialogId]);
  const activeMessages = useMemo(() => messages.filter(message => message.dialogId === activeDialog?.dialogId || message.dialogId === activeDialog?.id), [messages, activeDialog]);
  const activeContext = activeDialog?.context || null;
  const isOwner = activeDialog?.ownerUserIds?.includes?.(uid);
  const lastQuestion = [...activeMessages].reverse().find(message => message.senderRole === 'user')?.text || '';
  const typingUsers = Object.entries(activeDialog?.typing || {}).filter(([id, value]) => id !== uid && value).length;

  const sendText = async (overrideText = '', senderRole = '') => {
    const body = String(overrideText || text || '').trim();
    if ((!body && !attachment) || !activeDialog || pending) return;
    const autoAnswer = !senderRole && !isOwner ? buildDialogAutoAnswer(activeContext, body) : null;
    setPending(true);
    setError('');
    try {
      if (autoAnswer) {
        await userAction('dialog:message', { dialogId: activeDialog.id, text: body });
        await userAction('dialog:message', { dialogId: activeDialog.id, text: autoAnswer, senderRole: 'loki' });
      } else {
        await userAction('dialog:message', { dialogId: activeDialog.id, text: body, senderRole: senderRole || undefined, attachments: attachment ? [attachment] : [] });
      }
      setText('');
      setAttachment(null);
    } catch (err) {
      setError(err?.message || 'Не удалось отправить сообщение.');
    } finally {
      setPending(false);
    }
  };

  const toggleAiAssist = async (enabled) => {
    setAiAssist(enabled);
    await userAction('dialog:aiAssist', { enabled }).catch(() => {});
  };

  const handlePhoto = (file) => {
    if (!file) return;
    if (file.size > 450 * 1024) {
      setError('Фото должно быть меньше 450 КБ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ type: 'image', url: String(reader.result || ''), name: file.name || 'photo.jpg' });
    reader.readAsDataURL(file);
  };

  if (!uid) {
    return <GlassPanel><ScreenHeader title="Диалоги" subtitle="Войдите, чтобы задавать вопросы по объектам АПГ" onBack={onBack} /><EmptyStateV2 icon="💬" title="Нужна авторизация" text="Контекстные диалоги доступны участникам АПГ." /></GlassPanel>;
  }

  return (
    <GlassPanel>
      <ScreenHeader title="Контекстные диалоги" subtitle="Каждая переписка привязана к партнеру, эксперту, событию или акции" kicker="Связь АПГ" onBack={onBack} />
      {error && <GlassCard style={{ borderRadius: 20, padding: 12, marginBottom: 12, color: '#ff8e8e' }}>{error}</GlassCard>}
      {pending && !dialogs.length && <GlassCard style={{ borderRadius: 22, padding: 18, color: APG2_PROFILE.textSoft }}>Открываем диалог...</GlassCard>}
      {!activeDialog ? (
        <EmptyStateV2 icon="💬" title="Диалогов пока нет" text="Откройте партнера, эксперта, мероприятие или акцию и нажмите «Задать вопрос»." />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {dialogs.length > 1 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {dialogs.slice(0, 8).map(dialog => <DialogListItem key={dialog.id} dialog={dialog} active={dialog.id === activeDialog.id} onClick={() => setActiveDialogId(dialog.id)} />)}
            </div>
          )}
          <ContextHeader context={activeContext} onOpenObject={onOpenObject} />
          {isOwner && <OwnerAssist enabled={aiAssist} onToggle={toggleAiAssist} context={activeContext} lastQuestion={lastQuestion} onUse={value => setText(value)} />}
          <div style={{ display: 'grid', gap: 9, minHeight: 220 }}>
            {activeMessages.length ? activeMessages.map(message => <MessageBubble key={message.id} message={message} own={message.senderId === uid && message.senderRole !== 'loki'} />) : (
              <GlassCard style={{ borderRadius: 24, padding: 18, color: APG2_PROFILE.textSoft, textAlign: 'center' }}>История по этому объекту начнется здесь.</GlassCard>
            )}
            {typingUsers > 0 && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12 }}>Собеседник печатает...</div>}
            <div ref={messagesEndRef} />
          </div>
          {attachment && (
            <GlassCard style={{ borderRadius: 18, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={attachment.url} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0, color: APG2_PROFILE.textSoft, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</div>
              <button onClick={() => setAttachment(null)} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.textSoft, fontSize: 18 }}>×</button>
            </GlassCard>
          )}
          <GlassCard style={{ borderRadius: 26, padding: 10, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'end' }}>
            <label style={{ width: 42, height: 42, borderRadius: 17, display: 'grid', placeItems: 'center', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, cursor: 'pointer' }}>
              📷
              <input type="file" accept="image/*" onChange={e => handlePhoto(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
            <textarea
              value={text}
              onFocus={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: true }).catch(() => {})}
              onBlur={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: false }).catch(() => {})}
              onChange={e => setText(e.target.value)}
              placeholder={isOwner ? 'Ответить по этому объекту...' : 'Задать вопрос по этому объекту...'}
              style={{ minHeight: 42, maxHeight: 110, resize: 'vertical', border: 0, outline: 0, background: 'transparent', color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontFamily: 'inherit', padding: '10px 0' }}
            />
            <GlassButton onClick={() => sendText()} tone="gold" style={{ minHeight: 42, borderRadius: 17, color: '#17120a', opacity: pending ? 0.6 : 1 }}>Отправить</GlassButton>
          </GlassCard>
        </div>
      )}
    </GlassPanel>
  );
}

export default ContextDialogsPage;
