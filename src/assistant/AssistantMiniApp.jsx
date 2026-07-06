import React, { useEffect, useMemo, useState } from 'react';
import guides from './guides.json';
import faq from './faq.json';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel } from '../components/Apg2ProfileGlass.jsx';
import { MOTION, motionDelay, motionTransition } from '../motion.js';

const QUICK_ACTIONS = [
  { guideId: 'start', label: 'Как пользоваться АПГ' },
  { guideId: 'keys', label: 'Как получать ключи' },
  { guideId: 'events', label: 'Как работают мероприятия' },
  { guideId: 'partners', label: 'Как стать партнёром' },
  { guideId: 'experts', label: 'Как стать экспертом' },
  { guideId: 'raffles', label: 'Розыгрыши и призы' },
  { guideId: 'support', label: 'Связаться с нами' },
];

const VISUALS = {
  account: { icon: '👤', label: 'Профиль' },
  telegram: { icon: '✈️', label: 'Telegram' },
  city: { icon: '🏙️', label: 'Город' },
  reward: { icon: '🎁', label: 'Ключи' },
  visit: { icon: '🏪', label: 'Визит' },
  qr: { icon: '▦', label: 'QR АПГ' },
  camera: { icon: '📷', label: 'Сканер' },
  success: { icon: '✓', label: 'Готово' },
  calendar: { icon: '📅', label: 'Дата' },
  ticket: { icon: '🎟️', label: 'Афиша' },
  check: { icon: '✓', label: 'Подтверждение' },
  place: { icon: '⌖', label: 'Рядом' },
  card: { icon: '◇', label: 'Карточка' },
  expert: { icon: '🎓', label: 'Эксперт' },
  profile: { icon: '◌', label: 'Профиль' },
  message: { icon: '💬', label: 'Сообщение' },
  gift: { icon: '✦', label: 'Приз' },
  support: { icon: '?', label: 'Помощь' },
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

function findMatches(query) {
  const guideMatches = guides
    .map(guide => ({
      type: 'guide',
      guide,
      score: scoreByText(query, [guide.title, guide.description, ...(guide.keywords || []), ...guide.steps.map(step => `${step.title} ${step.text}`)]),
    }))
    .filter(item => item.score > 0);

  const faqMatches = faq
    .map(item => ({
      type: 'faq',
      faq: item,
      guide: guides.find(guide => guide.id === item.guideId),
      score: scoreByText(query, [item.question, item.answer, ...(item.keywords || [])]),
    }))
    .filter(item => item.score > 0);

  return [...faqMatches, ...guideMatches]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function useTelegramShell() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.('#111113');
    tg.setBackgroundColor?.('#111113');
  }, []);
}

function AssistantVisual({ visual }) {
  const meta = VISUALS[visual] || VISUALS.city;
  return (
    <div style={{
      minHeight: 190,
      borderRadius: 34,
      position: 'relative',
      overflow: 'hidden',
      background: 'radial-gradient(circle at 28% 18%, rgba(244,217,140,0.28), transparent 36%), radial-gradient(circle at 80% 16%, rgba(var(--apg2-glass-a,255,255,255),0.16), transparent 36%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.16), rgba(var(--apg2-glass-a,255,255,255),0.045))',
      border: '1px solid rgba(215,184,106,0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.24), 0 22px 54px var(--apg2-elev-shadow, rgba(0,0,0,0.28))',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, transparent 0%, rgba(255,240,184,0.10) 48%, transparent 74%)', transform: 'rotate(-9deg) scale(1.2)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', justifyItems: 'center', gap: 12 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 36,
          background: APG2_PROFILE.goldGlass.background,
          border: APG2_PROFILE.goldGlass.border,
          boxShadow: '0 24px 58px rgba(215,184,106,0.18), inset 0 1px 0 rgba(255,247,214,0.48)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#17120a', fontSize: meta.icon.length > 1 ? 38 : 48, fontWeight: 920,
        }}>
          {meta.icon}
        </div>
        <GlassBadge tone="gold">{meta.label}</GlassBadge>
      </div>
    </div>
  );
}

function MascotCard({ onAsk }) {
  return (
    <GlassCard style={{ padding: 18, borderRadius: 34, display: 'grid', gridTemplateColumns: '58px 1fr', gap: 14, alignItems: 'center', animation: `fadeInUp var(--motion-panel, 280ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both` }}>
      <picture>
        <source srcSet="/logo.webp" type="image/webp" />
        <img src="/logo.png" alt="АПГ" style={{ width: 58, height: 58, borderRadius: 22, objectFit: 'cover', boxShadow: '0 16px 34px rgba(0,0,0,0.26)' }} />
      </picture>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '22px', fontWeight: 880 }}>Навигатор АПГ</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 4 }}>Я помогу разобраться с ключами, партнёрами, экспертами и мероприятиями.</div>
        <button
          type="button"
          onClick={onAsk}
          style={{ marginTop: 11, padding: 0, border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontSize: 13, lineHeight: '17px', fontWeight: 820, cursor: 'pointer' }}
        >
          🎙 Задать вопрос
        </button>
      </div>
    </GlassCard>
  );
}

function HomeScreen({ onOpenGuide, onAsk }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 8, padding: '4px 2px 2px' }}>
        <GlassBadge tone="gold" style={{ justifySelf: 'start' }}>Telegram Mini App</GlassBadge>
        <h1 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 34, lineHeight: '38px', fontWeight: 920, letterSpacing: 0 }}>Помощник АПГ</h1>
        <p style={{ margin: 0, color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '22px' }}>Не чат-бот, а короткий навигатор по приложению. Один экран — одна мысль.</p>
      </div>

      <MascotCard onAsk={onAsk} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {QUICK_ACTIONS.map((action, index) => {
          const guide = guides.find(item => item.id === action.guideId);
          return (
            <GlassCard
              key={action.guideId}
              onClick={() => onOpenGuide(action.guideId)}
              style={{ minHeight: index === 0 ? 132 : 112, padding: 15, borderRadius: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', animation: `fadeInUp var(--motion-panel, 280ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both`, animationDelay: motionDelay(index) }}
            >
              <span style={{ width: 42, height: 42, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: index === 0 ? APG2_PROFILE.goldGlass.background : APG2_PROFILE.goldSoft, color: index === 0 ? '#17120a' : APG2_PROFILE.gold, fontSize: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)' }}>{guide?.emoji}</span>
              <span style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 820 }}>{action.label}</span>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function GuideScreen({ guide, stepIndex, onNext, onBack, onHome }) {
  const step = guide.steps[stepIndex];
  const isLast = stepIndex >= guide.steps.length - 1;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" onClick={onBack} aria-label="Назад" style={{ width: 44, height: 44, borderRadius: 18, border: APG2_PROFILE.glass.border, background: APG2_PROFILE.glass.background, color: APG2_PROFILE.text, fontSize: 18, cursor: 'pointer' }}>‹</button>
        <GlassBadge>{stepIndex + 1} / {guide.steps.length}</GlassBadge>
      </div>

      <GlassCard style={{ borderRadius: 38, padding: 18, display: 'grid', gap: 16, animation: `fadeInUp var(--motion-modal, 320ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both` }}>
        <div>
          <GlassBadge tone="gold" style={{ marginBottom: 10 }}>{guide.emoji} {guide.title}</GlassBadge>
          <h2 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 30, lineHeight: '34px', fontWeight: 920 }}>{step.title}</h2>
          <p style={{ margin: '10px 0 0', color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '23px' }}>{step.text}</p>
        </div>

        <AssistantVisual visual={step.visual} />

        <GlassButton tone="gold" onClick={onNext} style={{ minHeight: 52, borderRadius: 24, color: '#17120a' }}>
          {isLast ? 'Готово' : 'Далее'}
        </GlassButton>
        {isLast && (
          <GlassButton onClick={onHome} style={{ minHeight: 48, borderRadius: 22 }}>
            На главный экран
          </GlassButton>
        )}
      </GlassCard>
    </div>
  );
}

function SearchScreen({ query, setQuery, matches, onOpenGuide, onHome }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onHome} aria-label="Назад" style={{ width: 44, height: 44, borderRadius: 18, border: APG2_PROFILE.glass.border, background: APG2_PROFILE.glass.background, color: APG2_PROFILE.text, fontSize: 18, cursor: 'pointer' }}>‹</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '26px', fontWeight: 900 }}>Задать вопрос</div>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px' }}>Пока отвечает локальная база знаний.</div>
        </div>
      </div>

      <GlassInput
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Например: где получить ключ?"
        style={{ fontSize: 16 }}
      />

      <div style={{ display: 'grid', gap: 10 }}>
        {query.trim() && matches.length === 0 && (
          <GlassCard style={{ padding: 18, borderRadius: 28 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 820 }}>Пока не нашёл точный ответ</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 6 }}>Попробуйте слова «ключ», «мероприятие», «Telegram», «партнёр» или «розыгрыш».</div>
          </GlassCard>
        )}

        {!query.trim() && faq.slice(0, 4).map((item, index) => (
          <GlassCard key={item.id} onClick={() => onOpenGuide(item.guideId)} style={{ padding: 16, borderRadius: 26, animation: `fadeInUp var(--motion-panel, 280ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both`, animationDelay: motionDelay(index) }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontWeight: 840 }}>{item.question}</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 5 }}>Открыть короткую инструкцию</div>
          </GlassCard>
        ))}

        {matches.map((match, index) => {
          const title = match.type === 'faq' ? match.faq.question : match.guide.title;
          const text = match.type === 'faq' ? match.faq.answer : match.guide.description;
          const guideId = match.guide?.id || match.faq?.guideId;
          return (
            <GlassCard key={`${match.type}-${title}`} onClick={() => onOpenGuide(guideId)} style={{ padding: 16, borderRadius: 26, animation: `fadeInUp var(--motion-panel, 280ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both`, animationDelay: motionDelay(index) }}>
              <GlassBadge style={{ marginBottom: 9 }}>{match.type === 'faq' ? 'Ответ' : 'Инструкция'}</GlassBadge>
              <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 860 }}>{title}</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 6 }}>{text}</div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

export function AssistantMiniApp() {
  const [screen, setScreen] = useState('home');
  const [activeGuideId, setActiveGuideId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [query, setQuery] = useState('');
  useTelegramShell();

  const activeGuide = guides.find(guide => guide.id === activeGuideId) || guides[0];
  const matches = useMemo(() => findMatches(query), [query]);

  const openGuide = (id) => {
    setActiveGuideId(id);
    setStepIndex(0);
    setScreen('guide');
  };

  const goHome = () => {
    setScreen('home');
    setStepIndex(0);
  };

  const goBack = () => {
    if (screen === 'guide' && stepIndex > 0) {
      setStepIndex(prev => prev - 1);
      return;
    }
    goHome();
  };

  const goNext = () => {
    if (stepIndex < activeGuide.steps.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      goHome();
    }
  };

  return (
    <GlassPanel style={{ minHeight: '100dvh', padding: 'calc(16px + var(--safe-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))', background: 'radial-gradient(circle at 50% -12%, rgba(215,184,106,0.20), transparent 32%), radial-gradient(circle at 100% 8%, rgba(255,255,255,0.10), transparent 30%), var(--apg2-bg, #111113)' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', minHeight: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ transition: motionTransition(['opacity', 'transform'], 'panel'), animation: `fadeInUp var(--motion-panel, 280ms) var(--motion-ease-standard, ${MOTION.ease.standard}) both` }}>
          {screen === 'home' && <HomeScreen onOpenGuide={openGuide} onAsk={() => setScreen('search')} />}
          {screen === 'guide' && <GuideScreen guide={activeGuide} stepIndex={stepIndex} onNext={goNext} onBack={goBack} onHome={goHome} />}
          {screen === 'search' && <SearchScreen query={query} setQuery={setQuery} matches={matches} onOpenGuide={openGuide} onHome={goHome} />}
        </div>
      </div>
    </GlassPanel>
  );
}
