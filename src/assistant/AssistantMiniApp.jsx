import React, { useEffect, useMemo, useRef, useState } from 'react';
import guides from './guides.json';
import faq from './faq.json';
import { APP_URL } from '../constants.js';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel } from '../components/Apg2ProfileGlass.jsx';
import { MOTION, motionDelay, motionTransition } from '../motion.js';
import { askLokiCore } from '../loki/core/LokiCore.js';
import { clearLokiUserMemory, learnFromLokiQuery, loadLokiUserMemory } from '../loki/core/lokiUserMemory.js';
import { APG_KNOWLEDGE_BASE, findKnowledgeItems, getLatestChronicles } from '../loki/knowledge/index.js';
import { LOKI_APP_ACTIONS } from '../loki/lokiActionTypes.js';

const SECTIONS = [
  { id: 'loki', label: 'Локи', icon: '◌' },
  { id: 'news', label: 'Новости', icon: '📰' },
  { id: 'events', label: 'События', icon: '🎉' },
  { id: 'directory', label: 'Справочник', icon: '⌕' },
  { id: 'partners', label: 'Партнёры', icon: '🏪' },
  { id: 'experts', label: 'Эксперты', icon: '🎓' },
  { id: 'rewards', label: 'Призы', icon: '🎁' },
  { id: 'profile', label: 'Профиль', icon: '👤' },
];

const QUICK_COMMANDS = [
  { label: '📍 Что рядом?', text: 'Что рядом?' },
  { label: '🎉 Сегодня события', text: 'Какие сегодня события?' },
  { label: '📰 Что нового?', text: 'Что нового появилось?' },
  { label: '☕ Где кофе?', text: 'Где выпить кофе?' },
  { label: '🍽 Где поужинать?', text: 'Где можно поужинать?' },
  { label: '🎯 Как получить ключи?', text: 'Как заработать ключи?' },
];

const SECTION_LINKS = {
  news: `${APP_URL}/#/`,
  events: `${APP_URL}/#/`,
  directory: `${APP_URL}/#/telegram-helper?section=directory`,
  partners: `${APP_URL}/#/`,
  experts: `${APP_URL}/#/`,
  rewards: `${APP_URL}/#/`,
  profile: `${APP_URL}/#/`,
};

function normalize(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').trim();
}

function scoreByText(query, fields) {
  const q = normalize(query);
  if (!q) return 0;
  const words = q.split(/\s+/).filter(Boolean);
  const source = normalize(fields.join(' '));
  return words.reduce((sum, word) => sum + (source.includes(word) ? 2 : 0), 0) + (source.includes(q) ? 4 : 0);
}

function findGuideMatches(query) {
  const guideMatches = guides
    .map(guide => ({
      type: 'guide',
      id: guide.id,
      title: guide.title,
      text: guide.description,
      score: scoreByText(query, [guide.title, guide.description, ...(guide.keywords || []), ...guide.steps.map(step => `${step.title} ${step.text}`)]),
    }))
    .filter(item => item.score > 0);

  const faqMatches = faq
    .map(item => ({
      type: 'faq',
      id: item.guideId,
      title: item.question,
      text: item.answer,
      score: scoreByText(query, [item.question, item.answer, ...(item.keywords || [])]),
    }))
    .filter(item => item.score > 0);

  return [...faqMatches, ...guideMatches].sort((a, b) => b.score - a.score).slice(0, 8);
}

function getInitialSection() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? new URLSearchParams(hash.slice(hash.indexOf('?') + 1)) : new URLSearchParams(window.location.search);
  return query.get('section') || 'loki';
}

function useTelegramShell() {
  const [tg, setTg] = useState(null);
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    setTg(webApp);
    webApp.ready?.();
    webApp.expand?.();
    webApp.setHeaderColor?.('secondary_bg_color');
    webApp.setBackgroundColor?.(webApp.themeParams?.bg_color || '#111113');
    document.documentElement.setAttribute('data-theme', webApp.colorScheme === 'dark' ? 'dark' : 'light');
    document.documentElement.style.setProperty('--safe-top', `${webApp.safeAreaInset?.top || 0}px`);
  }, []);
  return tg;
}

function openExternal(url, tg) {
  if (tg?.openLink) tg.openLink(url, { try_instant_view: false });
  else window.open(url, '_blank', 'noopener');
}

function actionToUrl(action) {
  const type = action?.type;
  if (type === LOKI_APP_ACTIONS.SHOW_NEAREST_PARTNERS || type === LOKI_APP_ACTIONS.OPEN_MAP) return `${APP_URL}/#/`;
  if (type === LOKI_APP_ACTIONS.OPEN_EVENT) return `${APP_URL}/#/`;
  if (type === LOKI_APP_ACTIONS.OPEN_PRIZE) return `${APP_URL}/#/`;
  if (type === LOKI_APP_ACTIONS.SHOW_PROFILE || type === LOKI_APP_ACTIONS.OPEN_SETTINGS) return `${APP_URL}/#/`;
  if (type === LOKI_APP_ACTIONS.START_QR_SCANNER) return `${APP_URL}/#/`;
  return APP_URL;
}

function LokiHero({ state }) {
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const speaking = state === 'speaking';
  const animation = speaking ? 'lokiWave 1.1s' : listening ? 'lokiListen 1.55s' : thinking ? 'lokiThinking 1.4s' : 'lokiIdle 4.8s';
  return (
    <GlassCard style={{ borderRadius: 38, padding: 18, display: 'grid', gap: 13, justifyItems: 'center', overflow: 'hidden', position: 'relative' }}>
      <span style={{ position: 'absolute', inset: -80, background: 'radial-gradient(circle at 50% 18%, rgba(215,184,106,0.24), transparent 28%), radial-gradient(circle at 82% 8%, rgba(255,255,255,0.10), transparent 24%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', width: 154, height: 154, display: 'grid', placeItems: 'center' }}>
        <span style={{ position: 'absolute', inset: 10, borderRadius: 54, background: listening ? 'radial-gradient(circle, rgba(120,214,255,0.25), transparent 68%)' : 'radial-gradient(circle, rgba(215,184,106,0.28), transparent 68%)', filter: 'blur(9px)', opacity: listening || thinking || speaking ? 1 : 0.72, animation: thinking || speaking ? 'lokiSparkle 1.3s ease-in-out infinite' : 'none' }} />
        <span style={{ width: 132, height: 132, borderRadius: 44, overflow: 'hidden', position: 'relative', border: '1px solid rgba(215,184,106,0.34)', backgroundImage: 'url(/loki.png)', backgroundSize: '285%', backgroundPosition: '50% 23%', backgroundRepeat: 'no-repeat', boxShadow: '0 28px 70px rgba(0,0,0,0.32), 0 0 38px rgba(215,184,106,0.22)', animation: `${animation} var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) infinite` }}>
          <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 52% 24%, rgba(255,255,255,0.16), transparent 34%), linear-gradient(180deg, transparent, rgba(0,0,0,0.10))' }} />
          {speaking && <span style={{ position: 'absolute', left: 52, bottom: 32, width: 30, height: 7, borderRadius: 999, background: 'rgba(20,14,24,0.34)', animation: 'lokiBlink 740ms ease-in-out infinite' }} />}
        </span>
      </div>
      <div style={{ position: 'relative', textAlign: 'center', display: 'grid', gap: 5 }}>
        <GlassBadge tone="gold" style={{ justifySelf: 'center' }}>Локи в Telegram</GlassBadge>
        <div style={{ color: APG2_PROFILE.text, fontSize: 25, lineHeight: '30px', fontWeight: 930 }}>Карманный вход в АПГ</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '20px' }}>{listening ? 'Слушаю внимательно...' : speaking ? 'Отвечаю и показываю следующий шаг.' : 'Спроси обычными словами. Я использую те же Хроники АПГ и тот же мозг Локи.'}</div>
      </div>
    </GlassCard>
  );
}

function MessageCard({ item, onAction }) {
  const user = item.from === 'user';
  return (
    <div style={{ display: 'grid', justifyItems: user ? 'end' : 'start', gap: 8 }}>
      <div style={{ ...APG2_PROFILE.glass, maxWidth: user ? '82%' : '94%', borderRadius: user ? '22px 22px 6px 22px' : '22px 22px 22px 6px', padding: '11px 13px', color: APG2_PROFILE.text, border: user ? '1px solid rgba(215,184,106,0.30)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: user ? 'linear-gradient(135deg, rgba(215,184,106,0.24), rgba(var(--apg2-glass-a,255,255,255),0.08))' : APG2_PROFILE.glass.background }}>
        <div style={{ fontSize: 13.5, lineHeight: '19px', fontWeight: 720 }}>{item.text}</div>
      </div>
      {!!item.cards?.length && (
        <div style={{ width: '100%', display: 'grid', gap: 8 }}>
          {item.cards.slice(0, 3).map(card => (
            <GlassCard key={`${item.id}-${card.id}`} onClick={() => onAction(card.action)} style={{ padding: 11, borderRadius: 22 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 860 }}>{card.title}</div>
              <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 4 }}>{card.text}</div>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '16px', fontWeight: 820, marginTop: 8 }}>{card.label || 'Открыть'}</div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function LokiScreen({ tg }) {
  const [input, setInput] = useState('');
  const [voiceState, setVoiceState] = useState('idle');
  const [memory, setMemory] = useState(() => loadLokiUserMemory());
  const [messages, setMessages] = useState(() => ([
    { id: 'hello', from: 'loki', text: 'Я рядом. Можем продолжить разговор об АПГ прямо здесь.', cards: [] },
  ]));
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, voiceState]);

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
    utterance.rate = 1;
    utterance.pitch = 1.05;
    utterance.onstart = () => setVoiceState('speaking');
    utterance.onend = () => setVoiceState('idle');
    utterance.onerror = () => setVoiceState('idle');
    window.speechSynthesis.speak(utterance);
  };

  const ask = async (text, options = {}) => {
    const question = text.trim();
    if (!question || voiceState === 'thinking') return;
    setInput('');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, from: 'user', text: question, cards: [] }]);
    setVoiceState('thinking');
    const result = await askLokiCore({
      text: question,
      appState: { activePanel: 'telegram-miniapp', userKeys: 0, partners: [], experts: [], events: [], news: [], notifications: [], customTasks: [] },
      memory: { lastPanel: 'telegram-miniapp' },
      userMemory: memory,
      debug: (() => {
        try { return localStorage.getItem('apg_loki_debug') === '1'; } catch { return false; }
      })(),
    });
    const cards = result.cards?.length ? result.cards : result.card ? [result.card] : [];
    setMessages(prev => [...prev, { id: `l-${Date.now()}`, from: 'loki', text: result.text, cards }]);
    setMemory(prev => learnFromLokiQuery(prev, question, result));
    setVoiceState('idle');
    if (options.speak) speak(result.text);
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { id: `vf-${Date.now()}`, from: 'loki', text: 'Голосовой режим пока недоступен в этом Telegram WebView. Напиши мне текстом.', cards: [] }]);
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
        setMessages(prev => [...prev, { id: `ve-${Date.now()}`, from: 'loki', text: 'Я не расслышал. Попробуем ещё раз или напиши текстом.', cards: [] }]);
      };
      recognition.onend = () => setVoiceState(prev => prev === 'listening' ? 'idle' : prev);
      recognition.onresult = event => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? '';
        ask(transcript, { speak: true });
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceState('idle');
      setMessages(prev => [...prev, { id: `vx-${Date.now()}`, from: 'loki', text: 'Голосовой режим не запустился. Напиши мне запрос текстом.', cards: [] }]);
    }
  };

  const openAction = action => openExternal(actionToUrl(action), tg);

  return (
    <div style={{ display: 'grid', gap: 13 }}>
      <LokiHero state={voiceState} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
        {QUICK_COMMANDS.map(item => (
          <button key={item.label} type="button" onClick={() => ask(item.text)} style={{ ...APG2_PROFILE.glass, minHeight: 40, flex: '0 0 auto', borderRadius: 999, padding: '0 12px', color: APG2_PROFILE.text, border: '1px solid rgba(215,184,106,0.18)', fontSize: 12.5, lineHeight: '16px', fontWeight: 780, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{item.label}</button>
        ))}
      </div>
      <div ref={scrollRef} style={{ maxHeight: 280, overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'grid', gap: 10 }}>
        {messages.map(item => <MessageCard key={item.id} item={item} onAction={openAction} />)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ ...APG2_PROFILE.glass, borderRadius: 28, padding: 9, display: 'grid', gridTemplateColumns: '44px 1fr 48px', gap: 8, alignItems: 'center', border: '1px solid rgba(215,184,106,0.22)' }}>
        <button type="button" onClick={startVoice} aria-label="Голосовой режим" style={{ width: 44, height: 44, borderRadius: 18, border: voiceState === 'listening' ? '1px solid rgba(120,214,255,0.38)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: voiceState === 'listening' ? 'rgba(120,214,255,0.12)' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: voiceState === 'listening' ? '#78D6FF' : APG2_PROFILE.gold, fontSize: 19, fontFamily: 'inherit' }}>🎙</button>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Спроси Локи..." autoComplete="off" style={{ minWidth: 0, height: 44, border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontSize: 15, fontWeight: 650, fontFamily: 'inherit' }} />
        <GlassButton type="submit" tone="gold" disabled={!input.trim() || voiceState === 'thinking'} style={{ minHeight: 44, height: 44, borderRadius: 18, padding: 0, fontSize: 17, color: '#17120a' }}>↑</GlassButton>
      </form>
      <button type="button" onClick={() => { clearLokiUserMemory(); setMemory(loadLokiUserMemory()); setMessages(prev => [...prev, { id: `mc-${Date.now()}`, from: 'loki', text: 'Я очистил личную память в Telegram. Начнём заново.', cards: [] }]); }} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760, fontFamily: 'inherit' }}>Очистить память Локи</button>
    </div>
  );
}

function KnowledgeCard({ item, onClick }) {
  return (
    <GlassCard onClick={onClick} style={{ padding: 15, borderRadius: 26, display: 'grid', gap: 6 }}>
      <GlassBadge style={{ justifySelf: 'start' }}>{item.type === 'screen' ? 'Раздел' : item.type === 'feature' ? 'Функция' : 'Хроника'}</GlassBadge>
      <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 880 }}>{item.title}</div>
      <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>{item.text || item.purpose || item.description}</div>
    </GlassCard>
  );
}

function DirectoryScreen({ tg }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const knowledgeMatches = findKnowledgeItems(query, APG_KNOWLEDGE_BASE).map(item => ({ ...item, text: item.purpose || item.description }));
    return query.trim() ? [...knowledgeMatches, ...findGuideMatches(query)].slice(0, 10) : APG_KNOWLEDGE_BASE.screens.map(item => ({ ...item, type: 'screen', text: item.purpose }));
  }, [query]);
  return (
    <div style={{ display: 'grid', gap: 13 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <GlassBadge tone="gold" style={{ justifySelf: 'start' }}>Справочник</GlassBadge>
        <h1 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 30, lineHeight: '34px', fontWeight: 930 }}>Хроники и разделы АПГ</h1>
        <p style={{ margin: 0, color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px' }}>Один источник знаний для Web App и Telegram.</p>
      </div>
      <GlassInput value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти раздел, ключи, события..." />
      <div style={{ display: 'grid', gap: 10 }}>
        {matches.map((item, index) => (
          <KnowledgeCard key={`${item.type}-${item.id}-${index}`} item={item} onClick={() => item.id && openExternal(SECTION_LINKS[item.id] || APP_URL, tg)} />
        ))}
      </div>
    </div>
  );
}

function EcosystemSection({ section, tg, onOpenDirectory }) {
  const chronicles = getLatestChronicles(3);
  const guideBySection = guides.find(guide => guide.id === section);
  const titleMap = {
    news: 'Новости АПГ',
    events: 'События города',
    partners: 'Партнёры',
    experts: 'Эксперты',
    rewards: 'Призы и ключи',
    profile: 'Профиль',
  };
  const textMap = {
    news: 'Свежие главы Хроник и обновления проекта.',
    events: 'Быстрый вход в афишу и мероприятия.',
    partners: 'Места города, акции и получение ключей.',
    experts: 'Специалисты и экспертные карточки АПГ.',
    rewards: 'Ключи, розыгрыши, призы и достижения.',
    profile: 'Профиль, настройки и личный прогресс.',
  };
  return (
    <div style={{ display: 'grid', gap: 13 }}>
      <GlassCard style={{ borderRadius: 34, padding: 18, display: 'grid', gap: 10 }}>
        <GlassBadge tone="gold" style={{ justifySelf: 'start' }}>Экосистема АПГ</GlassBadge>
        <h1 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 30, lineHeight: '34px', fontWeight: 930 }}>{titleMap[section] || 'АПГ'}</h1>
        <p style={{ margin: 0, color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px' }}>{textMap[section] || 'Раздел АПГ.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <GlassButton tone="gold" onClick={() => openExternal(SECTION_LINKS[section] || APP_URL, tg)} style={{ color: '#17120a' }}>Открыть в АПГ</GlassButton>
          <GlassButton onClick={onOpenDirectory}>Справочник</GlassButton>
        </div>
      </GlassCard>
      {section === 'news' && chronicles.map(item => (
        <GlassCard key={item.version} style={{ padding: 15, borderRadius: 26 }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 850 }}>{item.date}</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 880, marginTop: 5 }}>{item.title}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{item.changes?.[0]}</div>
        </GlassCard>
      ))}
      {guideBySection && (
        <GlassCard style={{ padding: 15, borderRadius: 26 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 880 }}>{guideBySection.title}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{guideBySection.description}</div>
        </GlassCard>
      )}
    </div>
  );
}

export function AssistantMiniApp() {
  const tg = useTelegramShell();
  const [section, setSection] = useState(getInitialSection);

  const content = section === 'loki'
    ? <LokiScreen tg={tg} />
    : section === 'directory'
      ? <DirectoryScreen tg={tg} />
      : <EcosystemSection section={section} tg={tg} onOpenDirectory={() => setSection('directory')} />;

  return (
    <GlassPanel style={{ minHeight: '100dvh', padding: 'calc(14px + var(--safe-top, 0px)) 14px calc(92px + env(safe-area-inset-bottom, 0px))', background: 'radial-gradient(circle at 50% -12%, rgba(215,184,106,0.20), transparent 32%), radial-gradient(circle at 100% 8%, rgba(255,255,255,0.10), transparent 30%), var(--apg2-bg, #111113)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'grid', gap: 13, transition: motionTransition(['opacity', 'transform'], 'panel'), animation: `fadeInUp var(--motion-panel, 280ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 19, lineHeight: '23px', fontWeight: 930 }}>АПГ</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px' }}>Один Локи во всей экосистеме</div>
          </div>
          <GlassButton onClick={() => openExternal(APP_URL, tg)} style={{ minHeight: 38, borderRadius: 17, padding: '8px 11px', fontSize: 12 }}>Web App</GlassButton>
        </div>
        {content}
      </div>
      <div style={{ position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ ...APG2_PROFILE.glass, maxWidth: 480, width: '100%', borderRadius: 28, padding: 7, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, pointerEvents: 'auto', border: '1px solid rgba(215,184,106,0.18)' }}>
          {SECTIONS.slice(0, 8).map((item, index) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                style={{ minHeight: 44, borderRadius: 18, border: active ? '1px solid rgba(215,184,106,0.34)' : '1px solid transparent', background: active ? 'rgba(215,184,106,0.18)' : 'transparent', color: active ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '13px', fontWeight: 800, fontFamily: 'inherit', display: 'grid', placeItems: 'center', gap: 2, animation: `fadeInUp var(--motion-fast, 180ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both`, animationDelay: motionDelay(index, 18) }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}
