import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APG2_PROFILE, GlassButton, GlassCard } from '../components/Apg2ProfileGlass.jsx';
import { LOKI_ACTIONS } from './lokiBehavior.js';
import { LOKI_APP_ACTIONS, createLokiAction } from './lokiActionTypes.js';
import { LokiIdentity } from './LokiIdentity.jsx';
import { recordLokiMessageTrace, resetLokiMessageTrace } from './lokiMessageTrace.js';
import { inspectLokiResponseText, isLokiUserDebugVisible } from './lokiResponseText.js';
import { createLokiUtterance } from './lokiVoice.js';
import { describeLokiPreferences } from './core/memory/PreferenceMemory.js';
import { chooseLokiCard, compareLokiCards } from './core/decision/ChoiceAssistant.js';

const QUICK_ACTIONS = [
  { label: '✨ Что интересного?', text: 'Что интересного сегодня?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_OFFERS) },
  { label: '🎁 Мои призы', text: 'Какие призы доступны?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE) },
  { label: '🎉 События', text: 'Что интересного сегодня?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT) },
  { label: '☕ Найти кафе', text: 'Где выпить кофе?' },
  { label: '🎯 Как заработать ключи?', text: 'Как заработать больше ключей?' },
  { label: '📰 Что нового?', text: 'Что нового?' },
];

const NEWS_QUICK_ACTIONS = [
  { label: '📄 Кратко', text: 'Кратко перескажи новость' },
  { label: '🎯 Главное', text: 'Что главное в этой новости?' },
  { label: '👶 Простыми словами', text: 'Объясни простыми словами' },
  { label: '💼 Для бизнеса', text: 'Что это значит для бизнеса?' },
  { label: '👨 Для жителей', text: 'Что это значит для жителей?' },
  { label: '📅 События', text: 'Есть ли связанные события?' },
  { label: '🏢 Партнёры', text: 'Какие партнёры участвуют?' },
  { label: '👤 Эксперты', text: 'Какие эксперты могут помочь?' },
  { label: '📰 Похожие', text: 'Похожие новости' },
];

const FEEDBACK_REASONS = [
  ['irrelevant', 'Не то'],
  ['too_far', 'Далеко'],
  ['closed', 'Закрыто'],
  ['expensive', 'Дорого'],
  ['other', 'Другое'],
];

function getShortTitle(value) {
  return String(value || 'АПГ').trim().slice(0, 48);
}

function getContextKey(context) {
  if (!context) return '';
  return `${context.type || 'context'}:${context.newsId || context.id || context.title || ''}`;
}

function humanizeMemory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const known = {
    coffee: 'Хороший кофе',
    cafe: 'Кафе и пекарни',
    events: 'Мероприятия',
    gifts: 'Подарки',
    news: 'Новости АПГ',
  };
  return known[normalized] || String(value || '').replace(/[_-]+/g, ' ').trim();
}

function filterCardsForQuestion(cards, question) {
  const query = String(question || '').toLowerCase().replace(/ё/g, 'е');
  if (!/(кофе|кофейн|капучино|латте)/.test(query)) return cards;
  const coffeeTerms = ['кофе', 'кофейн', 'кафе', 'пекар', 'выпеч', 'десерт', 'ресторан', 'завтрак', 'капучино', 'латте'];
  return cards.filter(card => {
    const haystack = `${card.title || ''} ${card.text || ''} ${(card.meta || []).join(' ')}`.toLowerCase().replace(/ё/g, 'е');
    return coffeeTerms.some(term => haystack.includes(term));
  });
}

function buildInitialConversation(loki) {
  const context = loki.activeContext || loki.memory?.lastContext || null;
  if (context?.type === 'news') {
    return [{
      id: `context-news-${context.newsId || Date.now()}`,
      from: 'loki',
      text: context.initialAnswer || `Мы обсуждали новость «${context.title || 'АПГ'}». Продолжим?`,
      cards: [],
    }];
  }
  return [
    { id: 'welcome', from: 'loki', text: 'Я рядом. Скажи, что хочешь сделать в АПГ.', cards: [] },
  ];
}

function LokiAvatar({ thinking, listening, speaking }) {
  const state = speaking ? 'speaking' : listening ? 'listening' : thinking ? 'thinking' : 'ready';
  return (
    <div style={{ position: 'relative', width: 178, height: 178, margin: '0 auto', display: 'grid', placeItems: 'center' }}>
      <LokiIdentity size={148} state={state} showText={false} style={{ placeItems: 'center' }} />
    </div>
  );
}

function OfficeDashboard({ loki, onAsk }) {
  const dashboard = loki.dashboard || {};
  const today = Array.isArray(dashboard.todayBlocks) ? dashboard.todayBlocks.slice(0, 3) : [];
  const counters = [
    { icon: '📰', label: 'Новости', value: dashboard.counts?.news || 0, text: 'Что нового?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS) },
    { icon: '✦', label: 'Акции', value: dashboard.counts?.offers || 0, text: 'Какие акции доступны?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_OFFERS) },
    { icon: '◷', label: 'События', value: dashboard.counts?.events || 0, text: 'Какие мероприятия сегодня?', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT) },
  ];
  return (
    <section className="loki-office-dashboard" aria-label="Сводка кабинета Локи">
      <div className="loki-office-welcome">
        <div>
          <div className="loki-office-kicker">СЕГОДНЯ В КАБИНЕТЕ</div>
          <h1>{dashboard.greeting || 'Добрый день'}{dashboard.userName ? `, ${dashboard.userName}` : ''}</h1>
          <p>{dashboard.summary || 'Я собрал важное и готов сразу перейти к делу.'}</p>
        </div>
        <LokiAvatar thinking={loki.brainThinking} />
      </div>
      <div className="loki-office-counters">
        {counters.map(item => (
          <button key={item.label} type="button" onClick={() => onAsk(item.text, item.action)}>
            <span>{item.icon}</span>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
      {dashboard.proactivePrompt && (
        <button
          type="button"
          className="loki-office-proactive"
          onClick={() => onAsk(dashboard.proactivePrompt.prompt, dashboard.proactivePrompt.action)}
        >
          <span>{dashboard.proactivePrompt.icon}</span>
          <span><strong>{dashboard.proactivePrompt.title}</strong><small>{dashboard.proactivePrompt.text}</small></span>
          <b>→</b>
        </button>
      )}
      {!!today.length && (
        <div className="loki-office-desk">
          <div className="loki-office-kicker">НА СТОЛЕ У ЛОКИ</div>
          <div className="loki-office-desk-grid">
            {today.map((item, index) => (
              <button key={item.id || index} type="button" onClick={() => item.action && loki.executeAction(item.action)}>
                <span>{item.type === 'event' ? '◷' : item.type === 'news' ? '📰' : '✦'}</span>
                <strong>{getShortTitle(item.title)}</strong>
                <small>{item.text}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ResultCard({ card, onOpen, onAction, onExternalAction }) {
  const sourceActions = Array.isArray(card.actions) ? card.actions.filter(Boolean) : [];
  const openAction = sourceActions.find(item => /^(открыть|читать|записаться)$/i.test(item.label || '')) || (card.action ? { label: card.type === 'news' ? 'Читать' : 'Открыть', action: card.action } : null);
  const routeAction = sourceActions.find(item => /маршрут|карт/i.test(item.label || ''));
  const callAction = sourceActions.find(item => /позвонить|телефон/i.test(item.label || ''));
  const actions = [openAction, routeAction && { ...routeAction, label: 'Маршрут' }, callAction && { ...callAction, label: 'Позвонить' }].filter(Boolean);
  return (
    <GlassCard onClick={onOpen} style={{ padding: 10, borderRadius: 22, display: 'grid', gap: 10 }}>
      <span style={{ display: 'grid', gridTemplateColumns: card.image ? '64px 1fr' : '1fr', gap: 10, alignItems: 'center', minWidth: 0 }}>
        {card.image && (
          <span style={{ width: 64, height: 64, borderRadius: 18, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', display: 'block' }}>
            <img src={card.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </span>
        )}
        <span style={{ minWidth: 0, display: 'grid', gap: 4 }}>
          <span style={{ color: APG2_PROFILE.text, fontSize: 13, lineHeight: '17px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getShortTitle(card.title)}</span>
          <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.text}</span>
          {!!card.meta?.length && <span style={{ color: APG2_PROFILE.gold, fontSize: 11.5, lineHeight: '15px', fontWeight: 820 }}>{card.meta.slice(0, 2).join(' · ')}</span>}
        </span>
      </span>
      {!!actions.length && (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {actions.map(item => (
            <GlassButton
              key={`${item.label}-${item.action?.type || item.href || ''}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (item.action) onAction?.(item.action);
                else if (item.href && typeof window !== 'undefined') {
                  onExternalAction?.(String(item.href).startsWith('tel:') ? 'call' : 'website');
                  window.open(item.href, '_blank', 'noopener,noreferrer');
                }
              }}
              style={{ minHeight: 32, borderRadius: 999, padding: '0 10px', fontSize: 11, lineHeight: '14px', fontWeight: 820 }}
            >
              {item.label}
            </GlassButton>
          ))}
        </span>
      )}
    </GlassCard>
  );
}

export function LokiExperience({ loki }) {
  const [input, setInput] = useState('');
  const [voiceState, setVoiceState] = useState('idle');
  const [conversation, setConversation] = useState(() => buildInitialConversation(loki));
  const [feedbackPromptId, setFeedbackPromptId] = useState('');
  const scrollerRef = useRef(null);
  const recognitionRef = useRef(null);

  const visibleCards = useMemo(() => conversation.flatMap(item => item.cards || []).slice(-6), [conversation]);
  const contextKey = getContextKey(loki.activeContext || loki.memory?.lastContext || null);
  const activeNewsContext = (loki.activeContext || loki.memory?.lastContext || null)?.type === 'news' ? (loki.activeContext || loki.memory?.lastContext) : null;
  const quickActions = activeNewsContext ? NEWS_QUICK_ACTIONS : QUICK_ACTIONS;
  const contextTitle = activeNewsContext?.title || activeNewsContext?.article?.title || '';
  const summaryToSpeak = activeNewsContext?.initialAnswer || conversation.find(item => item.from === 'loki')?.text || '';
  const showDebug = isLokiUserDebugVisible();
  const memoryChips = useMemo(() => {
    const memory = loki.userMemory || {};
    return [
      ...describeLokiPreferences(memory.preferences).map(item => ({ type: 'preferences', value: item.key, label: `✓ ${item.label}` })),
      ...(memory.interests || []).map(value => ({ type: 'interests', value, label: `♥ ${humanizeMemory(value)}` })),
      ...(memory.frequentQuestions || []).slice(0, 2).map(value => ({ type: 'frequentQuestions', value, label: `Часто ищете: ${humanizeMemory(value)}` })),
      ...(memory.visitedPartners || []).slice(0, 2).map(value => ({ type: 'visitedPartners', value, label: `Были у: ${humanizeMemory(value)}` })),
      ...(memory.favoriteExperts || []).slice(0, 2).map(value => ({ type: 'favoriteExperts', value, label: `Ваш эксперт: ${humanizeMemory(value)}` })),
    ].filter(item => item.value).slice(0, 10);
  }, [loki.userMemory]);

  useEffect(() => {
    setConversation(buildInitialConversation(loki));
    setInput('');
  }, [contextKey]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (conversation.length <= 1 && !loki.brainThinking) {
      scroller.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, [conversation, loki.brainThinking]);

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    } catch {}
  }, []);

  const speak = (text) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = createLokiUtterance(text, { emotion: 'warm' });
    if (!utterance) return;
    utterance.onstart = () => setVoiceState('speaking');
    utterance.onend = () => setVoiceState('idle');
    utterance.onerror = () => setVoiceState('idle');
    window.speechSynthesis.speak(utterance);
  };

  const ask = async (text, quickAction = null, options = {}) => {
    const question = text.trim();
    resetLokiMessageTrace({ question, source: quickAction ? 'quick_action' : 'input' });
    recordLokiMessageTrace('STEP 1 Message/Input received', { questionLength: question.length, brainThinking: loki.brainThinking });
    if (!question || loki.brainThinking) {
      recordLokiMessageTrace('STOP input ignored', { empty: !question, brainThinking: loki.brainThinking });
      return;
    }
    setInput('');
    const userMessage = { id: `user-${Date.now()}`, from: 'user', text: question, cards: [] };
    setConversation(prev => [...prev, userMessage]);
    recordLokiMessageTrace('STEP 2 Conversation user message added', { messageId: userMessage.id });
    let result = null;
    try {
      recordLokiMessageTrace('STEP 3 Provider askExperience start', { autoExecute: false });
      result = await loki.askExperience(question, { autoExecute: false });
      recordLokiMessageTrace('STEP 18 Provider askExperience returned', { hasResult: Boolean(result), intent: result?.intent || '', hasText: Boolean(result?.text) });
    } catch (error) {
      recordLokiMessageTrace('STOP Provider askExperience rejected', { error: error?.message || String(error) });
      result = {
        text: 'Не получилось ответить с первого раза. Повторите вопрос, пожалуйста.',
        card: null,
        cards: [],
        debug: { trace: typeof window !== 'undefined' ? window.__APG_LOKI_MESSAGE_TRACE__ || [] : [] },
      };
    }
    if (!result) {
      recordLokiMessageTrace('STOP Provider returned empty result', {});
      result = {
        text: 'Не получилось ответить с первого раза. Повторите вопрос, пожалуйста.',
        card: null,
        cards: [],
        debug: { trace: typeof window !== 'undefined' ? window.__APG_LOKI_MESSAGE_TRACE__ || [] : [] },
      };
    }
    const rawCards = result.cards?.length ? result.cards : result.card ? [result.card] : [];
    const cards = filterCardsForQuestion(rawCards, question);
    const resultText = cards.length !== rawCards.length && cards.length
      ? `Нашёл ${cards.length === 1 ? 'одно подходящее место' : `${cards.length} подходящих места`}.\nЛучшее сейчас — «${getShortTitle(cards[0].title)}».`
      : result.text || 'Готово.';
    const answerInspection = inspectLokiResponseText(resultText);
    const answerText = answerInspection.text;
    setConversation(prev => [...prev, {
      id: `loki-${Date.now()}`,
      from: 'loki',
      text: answerText,
      cards,
      debug: result.debug ?? null,
      taskSuccess: result.taskSuccess || null,
    }]);
    recordLokiMessageTrace('STEP 19 UI answer message added', { textLength: answerText.length, cardCount: cards.length });
    const action = result.executeAction || quickAction || (question.toLowerCase().includes('покажи') ? result.autoAction : null);
    if (options.speak) speak(answerText);
    if (action) setTimeout(() => loki.executeAction(action), 520);
  };

  const submitFeedback = (messageId, taskId, value, reason = '') => {
    if (!taskId || !loki.recordTaskFeedback?.(taskId, value, reason)) return;
    setConversation(prev => prev.map(item => item.id === messageId
      ? { ...item, feedback: { value, reason } }
      : item));
    setFeedbackPromptId('');
  };

  const compareResults = (cards) => {
    const comparison = compareLokiCards(cards);
    if (comparison.length < 2) return;
    setConversation(prev => [...prev, {
      id: `compare-${Date.now()}`,
      from: 'loki',
      text: 'Сравнил главное. Выбирай по тому, что важнее сейчас.',
      cards: [],
      comparison,
    }]);
  };

  const decideForUser = (cards) => {
    const choice = chooseLokiCard(cards, loki.userMemory?.preferences);
    if (!choice) return;
    setConversation(prev => [...prev, {
      id: `choice-${Date.now()}`,
      from: 'loki',
      text: `Я бы выбрал «${getShortTitle(choice.card.title)}».\n${choice.reason}.`,
      cards: [choice.card],
      decisionMade: true,
    }]);
  };

  useEffect(() => {
    const pending = loki.pendingFirstJourneyQuestion;
    if (!pending?.text || loki.brainThinking) return;
    loki.clearPendingFirstJourneyQuestion?.();
    ask(pending.text, null, { source: 'first_journey' });
  }, [loki.pendingFirstJourneyQuestion?.id]);

  const startVoiceMode = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setConversation(prev => [...prev, { id: `voice-${Date.now()}`, from: 'loki', text: 'Голосовой режим пока недоступен в этом браузере. Напиши мне текстом.', cards: [] }]);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setVoiceState('listening');
      recognition.onerror = () => {
        setVoiceState('idle');
        setConversation(prev => [...prev, { id: `voice-error-${Date.now()}`, from: 'loki', text: 'Я не расслышал. Попробуем ещё раз или напиши текстом.', cards: [] }]);
      };
      recognition.onend = () => setVoiceState(prev => prev === 'listening' ? 'idle' : prev);
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? '';
        setVoiceState('thinking');
        ask(transcript, null, { speak: true });
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceState('idle');
      setConversation(prev => [...prev, { id: `voice-fallback-${Date.now()}`, from: 'loki', text: 'Голосовой режим не запустился. Напиши мне запрос текстом.', cards: [] }]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Локи"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 14000,
        color: APG2_PROFILE.text,
        background: 'radial-gradient(circle at 50% -8%, rgba(215,184,106,0.22), transparent 34%), radial-gradient(circle at 100% 12%, rgba(255,255,255,0.08), transparent 30%), var(--apg2-bg, #101114)',
        backdropFilter: 'blur(22px) saturate(1.35)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.35)',
        overflow: 'hidden',
        animation: 'lokiAppear var(--motion-modal, 320ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
      }}
    >
      <style>{`
        .loki-office-shell{width:100%;max-width:1080px;height:100%;margin:0 auto;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:calc(var(--safe-top,0px) + 12px) 14px calc(env(safe-area-inset-bottom,0px) + 14px);box-sizing:border-box;gap:12px}
        .loki-office-dashboard{display:grid;gap:12px}
        .loki-office-welcome{display:grid;grid-template-columns:minmax(0,1fr) 150px;align-items:center;padding:18px 22px;border:1px solid rgba(215,184,106,.22);border-radius:30px;background:linear-gradient(135deg,rgba(87,62,26,.62),rgba(25,24,22,.86)),radial-gradient(circle at 84% 20%,rgba(215,184,106,.22),transparent 36%);box-shadow:0 24px 70px rgba(0,0,0,.22)}
        .loki-office-welcome h1{font-size:clamp(24px,4vw,38px);line-height:1.05;margin:6px 0 8px;color:${APG2_PROFILE.text}}
        .loki-office-welcome p{max-width:600px;margin:0;color:${APG2_PROFILE.textSoft};font-size:13px;line-height:19px}
        .loki-office-welcome>div:last-child{width:140px;height:140px}
        .loki-office-kicker{color:${APG2_PROFILE.gold};font-size:10px;line-height:14px;font-weight:900;letter-spacing:1.4px}
        .loki-office-counters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .loki-office-counters button,.loki-office-desk-grid button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:${APG2_PROFILE.text};font:inherit;text-align:left;cursor:pointer}
        .loki-office-counters button{min-height:76px;border-radius:22px;padding:12px;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center}
        .loki-office-counters strong{font-size:22px}.loki-office-counters small{grid-column:2;color:${APG2_PROFILE.textMuted};font-weight:700}
        .loki-office-proactive{width:100%;min-height:62px;border:1px solid rgba(215,184,106,.24);border-radius:20px;padding:10px 13px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;background:linear-gradient(135deg,rgba(215,184,106,.14),rgba(255,255,255,.045));color:${APG2_PROFILE.text};text-align:left;font:inherit;cursor:pointer}
        .loki-office-proactive>span:first-child{font-size:22px}.loki-office-proactive>span:nth-child(2){display:grid;gap:2px}.loki-office-proactive strong{font-size:12.5px;line-height:16px}.loki-office-proactive small{color:${APG2_PROFILE.textMuted};font-size:10.5px;line-height:14px}.loki-office-proactive b{color:${APG2_PROFILE.gold};font-size:18px}
        .loki-office-desk{padding:14px;border-radius:24px;border:1px solid rgba(128,82,38,.28);background:linear-gradient(145deg,rgba(73,42,18,.46),rgba(30,21,16,.45))}
        .loki-office-desk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:9px}
        .loki-office-desk-grid button{min-height:92px;border-radius:17px;padding:11px;display:grid;grid-template-columns:auto 1fr;align-content:start;gap:5px 8px}
        .loki-office-desk-grid strong{font-size:12px;line-height:16px}.loki-office-desk-grid small{grid-column:1/-1;color:${APG2_PROFILE.textMuted};font-size:10.5px;line-height:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        @media(max-width:600px){.loki-office-shell{max-width:480px}.loki-office-welcome{grid-template-columns:1fr 96px;padding:15px}.loki-office-welcome>div:last-child{width:96px;height:96px}.loki-office-welcome>div:last-child>div{transform:scale(.68);transform-origin:center}.loki-office-desk-grid{grid-template-columns:1fr}.loki-office-desk-grid button{min-height:70px}.loki-office-counters button{min-height:68px;padding:9px}.loki-office-counters strong{font-size:18px}}
      `}</style>
      <div className="loki-office-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: APG2_PROFILE.gold, fontSize: 13, lineHeight: '17px', fontWeight: 900 }}>Кабинет Локи</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', fontWeight: 680, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6FDB9A', boxShadow: '0 0 0 4px rgba(111,219,154,.12)' }} /> На связи · готов помочь</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {loki.settings.dockedToHeader && (
              <button
                type="button"
                onClick={() => loki.setDockedToHeader(false)}
                aria-label="Вернуть Локи на экран"
                title="Вернуть Локи на экран"
                style={{ width: 42, height: 42, borderRadius: 17, border: '1px solid rgba(215,184,106,0.28)', background: 'rgba(215,184,106,0.12)', color: APG2_PROFILE.gold, fontSize: 18, fontFamily: 'inherit' }}
              >
                ↗
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                loki.resetUserMemory();
                setConversation(prev => [...prev, { id: `memory-clear-${Date.now()}`, from: 'loki', text: 'Я очистил личную память. Буду заново учиться тому, что тебе интересно.', cards: [] }]);
              }}
              aria-label="Очистить память Локи"
              style={{ width: 42, height: 42, borderRadius: 17, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.18)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textSoft, fontSize: 17, fontFamily: 'inherit' }}
            >
              ♻
            </button>
            <button type="button" onClick={loki.closeExperience} aria-label="Закрыть Локи" style={{ width: 42, height: 42, borderRadius: 17, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.18)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textSoft, fontSize: 24, lineHeight: '36px', fontFamily: 'inherit' }}>×</button>
          </div>
        </div>

        <div ref={scrollerRef} style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'grid', alignContent: 'start', gap: 12, paddingBottom: 4 }}>
          {!activeNewsContext && <OfficeDashboard loki={loki} onAsk={ask} />}
          {activeNewsContext && <LokiAvatar thinking={loki.brainThinking || voiceState === 'thinking' || loki.action === LOKI_ACTIONS.LOOK_AROUND} listening={voiceState === 'listening'} speaking={voiceState === 'speaking'} />}
          <div style={{ textAlign: 'center', display: 'grid', gap: 5 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 23, lineHeight: '28px', fontWeight: 900 }}>{activeNewsContext ? 'Обсуждаем новость' : 'Спросите Локи'}</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13, lineHeight: '18px', fontWeight: 650 }}>{voiceState === 'listening' ? 'Слушаю внимательно...' : voiceState === 'speaking' ? 'Отвечаю голосом и показываю результат.' : activeNewsContext ? `Контекст: «${getShortTitle(contextTitle)}». Можно задавать вопросы прямо по статье.` : 'Можно написать или сказать обычными словами. Я покажу результат, а не длинную инструкцию.'}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, flexWrap: 'wrap' }}>
            {[
              ['professional', 'Профессиональный'],
              ['friendly', 'Дружелюбный'],
              ['charismatic', 'Харизматичный'],
            ].map(([mode, label]) => {
              const active = loki.settings.personalityMode === mode;
              return (
                <button key={mode} type="button" onClick={() => loki.setPersonalityMode(mode)} style={{ minHeight: 34, borderRadius: 999, padding: '0 11px', border: active ? '1px solid rgba(215,184,106,0.42)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: active ? 'rgba(215,184,106,0.16)' : 'rgba(var(--apg2-glass-a,255,255,255),0.05)', color: active ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 10.5, fontWeight: 780, fontFamily: 'inherit' }}>{label}</button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '2px 0 4px', scrollbarWidth: 'none' }}>
            {activeNewsContext && (
              <button
                type="button"
                onClick={() => speak(summaryToSpeak)}
                style={{ ...APG2_PROFILE.glass, minHeight: 42, flex: '0 0 auto', borderRadius: 999, padding: '0 13px', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.24)', fontSize: 12.5, lineHeight: '16px', fontWeight: 820, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                ▶ Прослушать
              </button>
            )}
            {quickActions.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => ask(item.text, item.action)}
                style={{ ...APG2_PROFILE.glass, minHeight: 42, flex: '0 0 auto', borderRadius: 999, padding: '0 13px', color: APG2_PROFILE.text, border: '1px solid rgba(215,184,106,0.18)', fontSize: 12.5, lineHeight: '16px', fontWeight: 780, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {!!memoryChips.length && (
            <div style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: 10, display: 'grid', gap: 8, border: '1px solid rgba(215,184,106,0.13)' }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '15px', fontWeight: 860 }}>Локи помнит</div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                {memoryChips.map(item => (
                  <button
                    key={`${item.type}-${item.value}`}
                    type="button"
                    onClick={() => loki.clearUserMemoryItem?.(item.type, item.value)}
                    title="Удалить из памяти"
                    style={{ flex: '0 0 auto', minHeight: 30, borderRadius: 999, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2_PROFILE.textSoft, fontSize: 10.5, lineHeight: '14px', fontWeight: 760, padding: '0 10px', fontFamily: 'inherit', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {item.label} ×
                  </button>
                ))}
              </div>
            </div>
          )}

          {conversation.map(item => (
            <div key={item.id} style={{ display: 'grid', justifyItems: item.from === 'user' ? 'end' : 'start', gap: 8 }}>
              <div style={{ ...APG2_PROFILE.glass, maxWidth: item.from === 'user' ? '82%' : '92%', borderRadius: item.from === 'user' ? '22px 22px 6px 22px' : '22px 22px 22px 6px', padding: '11px 13px', color: APG2_PROFILE.text, border: item.from === 'user' ? '1px solid rgba(215,184,106,0.30)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: item.from === 'user' ? 'linear-gradient(135deg, rgba(215,184,106,0.24), rgba(var(--apg2-glass-a,255,255,255),0.08))' : APG2_PROFILE.glass.background }}>
                <div style={{ fontSize: 13.5, lineHeight: '19px', fontWeight: 720 }}>{item.text}</div>
              </div>
              {!!item.cards?.length && (
                <div style={{ width: '100%', display: 'grid', gap: 8 }}>
                  {item.cards.slice(0, 3).map(card => (
                    <ResultCard key={`${item.id}-${card.id}`} card={card} onOpen={() => card.action && loki.executeAction(card.action)} onAction={action => loki.executeAction(action)} onExternalAction={kind => loki.recordExternalTaskAction?.(kind)} />
                  ))}
                </div>
              )}
              {!!item.comparison?.length && (
                <div style={{ width: '100%', overflowX: 'auto', border: '1px solid rgba(215,184,106,.16)', borderRadius: 18, background: 'rgba(255,255,255,.035)' }}>
                  <div style={{ minWidth: 520, display: 'grid', gridTemplateColumns: '1.5fr repeat(4,1fr)', fontSize: 10.5, lineHeight: '14px' }}>
                    {['Вариант', 'Рейтинг', 'Расстояние', 'Цена', 'Выгода'].map(label => <strong key={label} style={{ padding: 9, color: APG2_PROFILE.gold, borderBottom: '1px solid rgba(255,255,255,.08)' }}>{label}</strong>)}
                    {item.comparison.flatMap(row => [
                      <span key={`${row.id}-title`} style={{ padding: 9, color: APG2_PROFILE.text, fontWeight: 800 }}>{getShortTitle(row.title)}</span>,
                      <span key={`${row.id}-rating`} style={{ padding: 9, color: APG2_PROFILE.textMuted }}>{row.rating}</span>,
                      <span key={`${row.id}-distance`} style={{ padding: 9, color: APG2_PROFILE.textMuted }}>{row.distance}</span>,
                      <span key={`${row.id}-price`} style={{ padding: 9, color: APG2_PROFILE.textMuted }}>{row.price}</span>,
                      <span key={`${row.id}-benefit`} style={{ padding: 9, color: APG2_PROFILE.textMuted }}>{row.benefit}</span>,
                    ])}
                  </div>
                </div>
              )}
              {item.cards?.length > 1 && !item.decisionMade && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => compareResults(item.cards)} style={{ minHeight: 34, borderRadius: 999, padding: '0 12px', border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.055)', color: APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 800, fontFamily: 'inherit' }}>Сравнить</button>
                  <button type="button" onClick={() => decideForUser(item.cards)} style={{ minHeight: 34, borderRadius: 999, padding: '0 12px', border: '1px solid rgba(215,184,106,.28)', background: 'rgba(215,184,106,.13)', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, fontFamily: 'inherit' }}>Реши за меня</button>
                </div>
              )}
              {item.from === 'loki' && item.taskSuccess?.id && (
                <div style={{ width: '100%', display: 'grid', gap: 7, justifyItems: 'start', paddingLeft: 4 }}>
                  {item.feedback ? (
                    <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 700 }}>
                      {item.feedback.value === 'positive' ? 'Спасибо — это поможет Локи стать точнее.' : 'Понял. Учту это в следующих рекомендациях.'}
                    </span>
                  ) : feedbackPromptId === item.id ? (
                    <>
                      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 700 }}>Что оказалось не так?</span>
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {FEEDBACK_REASONS.map(([reason, label]) => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => submitFeedback(item.id, item.taskSuccess.id, 'negative', reason)}
                            style={{ minHeight: 30, borderRadius: 999, padding: '0 10px', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2_PROFILE.textSoft, fontSize: 10.5, fontWeight: 760, fontFamily: 'inherit' }}
                          >
                            {label}
                          </button>
                        ))}
                      </span>
                    </>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 700 }}>Помогло?</span>
                      <button type="button" aria-label="Ответ Локи помог" onClick={() => submitFeedback(item.id, item.taskSuccess.id, 'positive')} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(111,219,154,.22)', background: 'rgba(111,219,154,.08)', color: APG2_PROFILE.textSoft, fontSize: 14, fontFamily: 'inherit' }}>👍</button>
                      <button type="button" aria-label="Ответ Локи не помог" onClick={() => setFeedbackPromptId(item.id)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: APG2_PROFILE.textSoft, fontSize: 14, fontFamily: 'inherit' }}>👎</button>
                    </span>
                  )}
                </div>
              )}
              {showDebug && item.debug && (
                <div style={{ ...APG2_PROFILE.glass, width: '100%', borderRadius: 18, padding: 10, border: '1px solid rgba(215,184,106,0.14)', color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '15px', display: 'grid', gap: 4 }}>
                  <span style={{ color: APG2_PROFILE.gold, fontWeight: 850 }}>Loki Core debug · {item.debug.provider} · {item.debug.totalMs}ms</span>
                  {item.debug.trace?.slice(0, 8).map(step => (
                    <span key={`${item.id}-${step.module}-${step.decision}`}>{step.module}: {step.decision} · {step.ms}ms</span>
                  ))}
                  {!!item.debug.pipelineTimeline?.length && (
                    <>
                      <span style={{ color: APG2_PROFILE.gold, fontWeight: 850, marginTop: 4 }}>Pipeline Timeline</span>
                      {item.debug.pipelineTimeline.slice(-10).map((step, index) => (
                        <span key={`${item.id}-timeline-${index}`}>{step.step}: {step.status} · {JSON.stringify(step.output || {}).slice(0, 96)}</span>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {loki.brainThinking && (
            <div style={{ ...APG2_PROFILE.glass, justifySelf: 'start', borderRadius: 22, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 8, color: APG2_PROFILE.textSoft }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(215,184,106,0.22)', borderTopColor: APG2_PROFILE.gold, animation: 'spin 0.82s linear infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 760 }}>Думаю и смотрю данные АПГ...</span>
            </div>
          )}

          {!!visibleCards.length && (
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', textAlign: 'center', marginTop: 2 }}>Карточки можно открыть прямо из разговора.</div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          style={{ ...APG2_PROFILE.glass, borderRadius: 28, padding: 9, display: 'grid', gridTemplateColumns: '44px 1fr 48px', gap: 8, alignItems: 'center', border: '1px solid rgba(215,184,106,0.22)' }}
        >
          <button type="button" onClick={startVoiceMode} aria-label="Голосовой режим" title="Сказать Локи" style={{ width: 44, height: 44, borderRadius: 18, border: voiceState === 'listening' ? '1px solid rgba(120,214,255,0.38)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: voiceState === 'listening' ? 'rgba(120,214,255,0.12)' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: voiceState === 'listening' ? '#78D6FF' : APG2_PROFILE.gold, fontSize: 19, fontFamily: 'inherit' }}>🎙</button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={activeNewsContext ? 'Спроси по этой новости...' : 'Например: пицца, массаж, куда сходить?'}
            autoComplete="off"
            style={{ minWidth: 0, height: 44, border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontSize: 15, fontWeight: 650, fontFamily: 'inherit' }}
          />
          <GlassButton type="submit" tone="gold" disabled={!input.trim() || loki.brainThinking} style={{ minHeight: 44, height: 44, borderRadius: 18, padding: 0, fontSize: 17, color: '#17120a' }}>↑</GlassButton>
        </form>
      </div>
    </div>
  );
}
