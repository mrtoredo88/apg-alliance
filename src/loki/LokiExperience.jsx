import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APG2_PROFILE, GlassButton, GlassCard } from '../components/Apg2ProfileGlass.jsx';
import { LOKI_ACTIONS } from './lokiBehavior.js';
import { LOKI_APP_ACTIONS, createLokiAction } from './lokiActionTypes.js';

const QUICK_ACTIONS = [
  { label: '📍 Что рядом?', text: 'Что рядом?', action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS) },
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

function getShortTitle(value) {
  return String(value || 'АПГ').trim().slice(0, 48);
}

function getLokiVoice() {
  try {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    return voices.find(voice => voice.lang === 'ru-RU' && /milena|yuri|google|microsoft|premium|natural/i.test(voice.name))
      ?? voices.find(voice => voice.lang === 'ru-RU')
      ?? voices.find(voice => String(voice.lang || '').startsWith('ru'))
      ?? null;
  } catch {
    return null;
  }
}

function getContextKey(context) {
  if (!context) return '';
  return `${context.type || 'context'}:${context.newsId || context.id || context.title || ''}`;
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
  const animation = speaking ? 'lokiWave 1.35s' : listening ? 'lokiListen 1.8s' : thinking ? 'lokiThinking 1.65s' : 'lokiIdle 6.2s';
  return (
    <div style={{ position: 'relative', width: 178, height: 178, margin: '0 auto', display: 'grid', placeItems: 'center' }}>
      <span style={{ position: 'absolute', inset: 12, borderRadius: 60, background: listening ? 'radial-gradient(circle, rgba(120,214,255,0.24), transparent 68%)' : 'radial-gradient(circle, rgba(215,184,106,0.28), transparent 68%)', filter: 'blur(10px)', opacity: thinking || listening || speaking ? 1 : 0.76, animation: thinking || speaking ? 'lokiAmbientGlow 2.8s ease-in-out infinite' : 'lokiAmbientGlow 5.2s ease-in-out infinite' }} />
      <span style={{ width: 148, height: 148, borderRadius: 48, overflow: 'hidden', position: 'relative', border: '1px solid rgba(215,184,106,0.34)', backgroundImage: 'url(/loki.png)', backgroundSize: '285%', backgroundPosition: '50% 23%', backgroundRepeat: 'no-repeat', boxShadow: '0 30px 80px rgba(0,0,0,0.34), 0 0 44px rgba(215,184,106,0.22)', animation: `${animation} var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) infinite` }}>
        <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 52% 24%, rgba(255,255,255,0.16), transparent 34%), linear-gradient(180deg, transparent, rgba(0,0,0,0.10))' }} />
        {speaking && <span style={{ position: 'absolute', left: 58, bottom: 36, width: 34, height: 8, borderRadius: 999, background: 'rgba(20,14,24,0.34)', animation: 'lokiMouthSmile 820ms ease-in-out infinite' }} />}
      </span>
    </div>
  );
}

function ResultCard({ card, onOpen }) {
  return (
    <GlassCard onClick={onOpen} style={{ padding: 10, borderRadius: 22, display: 'grid', gridTemplateColumns: card.image ? '64px 1fr' : '1fr', gap: 10, alignItems: 'center' }}>
      {card.image && (
        <span style={{ width: 64, height: 64, borderRadius: 18, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', display: 'block' }}>
          <img src={card.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </span>
      )}
      <span style={{ minWidth: 0, display: 'grid', gap: 4 }}>
        <span style={{ color: APG2_PROFILE.text, fontSize: 13, lineHeight: '17px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getShortTitle(card.title)}</span>
        <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.text}</span>
        <span style={{ color: APG2_PROFILE.gold, fontSize: 11.5, lineHeight: '15px', fontWeight: 820 }}>{card.label || 'Открыть'}</span>
      </span>
    </GlassCard>
  );
}

export function LokiExperience({ loki }) {
  const [input, setInput] = useState('');
  const [voiceState, setVoiceState] = useState('idle');
  const [conversation, setConversation] = useState(() => buildInitialConversation(loki));
  const scrollerRef = useRef(null);
  const recognitionRef = useRef(null);

  const visibleCards = useMemo(() => conversation.flatMap(item => item.cards || []).slice(-6), [conversation]);
  const contextKey = getContextKey(loki.activeContext || loki.memory?.lastContext || null);
  const activeNewsContext = (loki.activeContext || loki.memory?.lastContext || null)?.type === 'news' ? (loki.activeContext || loki.memory?.lastContext) : null;
  const quickActions = activeNewsContext ? NEWS_QUICK_ACTIONS : QUICK_ACTIONS;
  const contextTitle = activeNewsContext?.title || activeNewsContext?.article?.title || '';
  const summaryToSpeak = activeNewsContext?.initialAnswer || conversation.find(item => item.from === 'loki')?.text || '';

  useEffect(() => {
    setConversation(buildInitialConversation(loki));
    setInput('');
  }, [contextKey]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
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
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.voice = getLokiVoice();
    utterance.rate = 0.88;
    utterance.pitch = 0.96;
    utterance.volume = 0.92;
    utterance.onstart = () => setVoiceState('speaking');
    utterance.onend = () => setVoiceState('idle');
    utterance.onerror = () => setVoiceState('idle');
    window.speechSynthesis.speak(utterance);
  };

  const ask = async (text, quickAction = null, options = {}) => {
    const question = text.trim();
    if (!question || loki.brainThinking) return;
    setInput('');
    const userMessage = { id: `user-${Date.now()}`, from: 'user', text: question, cards: [] };
    setConversation(prev => [...prev, userMessage]);
    const result = await loki.askExperience(question, { autoExecute: false });
    if (!result) return;
    const cards = result.cards?.length ? result.cards : result.card ? [result.card] : [];
    setConversation(prev => [...prev, {
      id: `loki-${Date.now()}`,
      from: 'loki',
      text: result.text || 'Готово.',
      cards,
      debug: result.debug ?? null,
    }]);
    const action = result.executeAction || quickAction || (question.toLowerCase().includes('покажи') ? result.autoAction : null);
    if (options.speak) speak(result.text);
    if (action) setTimeout(() => loki.executeAction(action), 520);
  };

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
      <div style={{ width: '100%', maxWidth: 480, height: '100%', margin: '0 auto', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', padding: 'calc(var(--safe-top, 0px) + 12px) 14px calc(env(safe-area-inset-bottom, 0px) + 14px)', boxSizing: 'border-box', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: APG2_PROFILE.gold, fontSize: 13, lineHeight: '17px', fontWeight: 900 }}>Пространство Локи</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', fontWeight: 680 }}>Главный проводник по АПГ</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
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
          <LokiAvatar thinking={loki.brainThinking || voiceState === 'thinking' || loki.action === LOKI_ACTIONS.LOOK_AROUND} listening={voiceState === 'listening'} speaking={voiceState === 'speaking'} />
          <div style={{ textAlign: 'center', display: 'grid', gap: 5 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 23, lineHeight: '28px', fontWeight: 900 }}>{activeNewsContext ? 'Обсуждаем новость' : 'Что сделаем?'}</div>
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

          {conversation.map(item => (
            <div key={item.id} style={{ display: 'grid', justifyItems: item.from === 'user' ? 'end' : 'start', gap: 8 }}>
              <div style={{ ...APG2_PROFILE.glass, maxWidth: item.from === 'user' ? '82%' : '92%', borderRadius: item.from === 'user' ? '22px 22px 6px 22px' : '22px 22px 22px 6px', padding: '11px 13px', color: APG2_PROFILE.text, border: item.from === 'user' ? '1px solid rgba(215,184,106,0.30)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: item.from === 'user' ? 'linear-gradient(135deg, rgba(215,184,106,0.24), rgba(var(--apg2-glass-a,255,255,255),0.08))' : APG2_PROFILE.glass.background }}>
                <div style={{ fontSize: 13.5, lineHeight: '19px', fontWeight: 720 }}>{item.text}</div>
              </div>
              {!!item.cards?.length && (
                <div style={{ width: '100%', display: 'grid', gap: 8 }}>
                  {item.cards.slice(0, 3).map(card => (
                    <ResultCard key={`${item.id}-${card.id}`} card={card} onOpen={() => loki.executeAction(card.action)} />
                  ))}
                </div>
              )}
              {item.debug && (
                <div style={{ ...APG2_PROFILE.glass, width: '100%', borderRadius: 18, padding: 10, border: '1px solid rgba(215,184,106,0.14)', color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '15px', display: 'grid', gap: 4 }}>
                  <span style={{ color: APG2_PROFILE.gold, fontWeight: 850 }}>Loki Core debug · {item.debug.provider} · {item.debug.totalMs}ms</span>
                  {item.debug.trace?.slice(0, 8).map(step => (
                    <span key={`${item.id}-${step.module}-${step.decision}`}>{step.module}: {step.decision} · {step.ms}ms</span>
                  ))}
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
