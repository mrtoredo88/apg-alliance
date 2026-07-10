import React, { useMemo, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel } from './components/Apg2ProfileGlass.jsx';
import { useLoki } from './loki/LokiProvider.jsx';
import { isVK } from './vk.js';

const QUICK_ACTIONS = [
  { id: 'food', icon: '🍽️', title: 'Где поесть', text: 'Подберу лучшее место сейчас', prompt: 'Где поесть сегодня?' },
  { id: 'events', icon: '🎉', title: 'Чем заняться', text: 'Соберу лучший вариант дня', prompt: 'Чем заняться сегодня?' },
  { id: 'expert', icon: '👨‍⚕️', title: 'Найти специалиста', text: 'Выберу эксперта под задачу', prompt: 'Найди специалиста или эксперта' },
  { id: 'service', icon: '🛍️', title: 'Найти услугу', text: 'Подберу партнёра АПГ', prompt: 'Найди полезную услугу рядом' },
  { id: 'family', icon: '👨‍👩‍👧', title: 'Для семьи', text: 'План для родителей и детей', prompt: 'Что посоветуешь для семьи?' },
  { id: 'meet', icon: '🤝', title: 'Найти мероприятие', text: 'Покажу лучшее событие', prompt: 'Найди мероприятие, на которое стоит пойти' },
];

const EXAMPLE_PROMPTS = [
  'Что интересного сегодня?',
  'Куда сходить вечером?',
  'Как заработать ключи?',
  'Что рядом со мной?',
];

function cardTypeLabel(type) {
  if (type === 'event') return 'Событие';
  if (type === 'partner') return 'Партнёр';
  if (type === 'expert') return 'Эксперт';
  if (type === 'news') return 'Новость';
  if (type === 'prize') return 'Приз';
  if (type === 'task') return 'Задание';
  return 'АПГ';
}

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function shortText(value, limit = 120) {
  const text = safeText(value).replace(/\s+/g, ' ');
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

export function LokiPage({ onBack, onOpenReference, onOpenPanel }) {
  const loki = useLoki();
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState(null);
  const dashboard = loki.dashboard ?? {};

  const recommendations = useMemo(() => {
    const rows = dashboard.todayRecommendations?.length ? dashboard.todayRecommendations : loki.recommendationFeed ?? [];
    return rows.slice(0, 3);
  }, [dashboard.todayRecommendations, loki.recommendationFeed]);

  const runCardAction = async (action) => {
    if (!action) return;
    await loki.executeAction(action);
  };

  const openHref = (href) => {
    if (!href) return;
    try { window.open(href, '_blank', 'noopener,noreferrer'); } catch {}
  };

  const ask = async (text) => {
    const question = String(text || '').trim();
    if (!question || loki.brainThinking) return;
    setInput('');
    setAnswer({ question, loading: true, text: 'Локи собирает лучшее решение...', cards: [] });
    const result = await loki.askExperience(question);
    setAnswer({
      question,
      loading: false,
      text: result?.text || 'Пока я этого не знаю, но могу открыть справочник АПГ.',
      cards: result?.cards?.length ? result.cards : result?.card ? [result.card] : [],
    });
  };

  const renderLokiCard = (card, keyPrefix = 'card') => (
    <GlassCard key={`${keyPrefix}-${card.id}`} onClick={() => runCardAction(card.action)} style={{ borderRadius: 26, padding: 0, overflow: 'hidden' }}>
      {card.image && <div style={{ height: 104, backgroundImage: `url(${card.image})`, backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />}
      <div style={{ padding: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <GlassBadge tone={card.type === 'event' ? 'gold' : 'glass'}>{cardTypeLabel(card.type)}</GlassBadge>
          <span style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 840 }}>{card.label || 'Открыть'}</span>
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '20px', fontWeight: 920 }}>{safeText(card.title, 'Рекомендация АПГ')}</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 6 }}>{shortText(card.reason || card.text || 'Открою детали и помогу выбрать действие.', 126)}</div>
        {!!card.actions?.length && (
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 11, paddingBottom: 2 }} onClick={e => e.stopPropagation()}>
            {card.actions.slice(0, 3).map((act, idx) => (
              <GlassButton key={`${card.id}-action-${idx}`} tone={idx === 0 ? 'gold' : 'default'} onClick={() => act.href ? openHref(act.href) : runCardAction(act.action)} style={{ minHeight: 34, borderRadius: 999, padding: '7px 10px', fontSize: 12, flex: '0 0 auto', color: idx === 0 ? '#17120a' : undefined }}>{act.label}</GlassButton>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );

  const progress = dashboard.progress ?? {};
  const mainNews = dashboard.mainNews ?? null;

  return (
    <GlassPanel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <GlassButton onClick={onBack} style={{ width: 44, minHeight: 44, borderRadius: 18, padding: 0 }}>‹</GlassButton>
        <div style={{ minWidth: 0, flex: 1 }}>
          <GlassBadge tone="gold" style={{ marginBottom: 7 }}>{isVK() ? 'Loki Home в VK' : 'Loki Home'}</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 28, lineHeight: '32px', fontWeight: 940 }}>AI Dashboard</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '19px', marginTop: 4 }}>Персональная главная страница АПГ.</div>
        </div>
      </div>

      <GlassCard style={{ borderRadius: 38, padding: 18, marginBottom: 14, overflow: 'hidden', position: 'relative' }}>
        <span style={{ position: 'absolute', inset: -80, background: 'radial-gradient(circle at 12% 6%, rgba(215,184,106,0.28), transparent 34%), radial-gradient(circle at 92% 12%, rgba(255,255,255,0.12), transparent 30%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '82px 1fr', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 82, height: 82, borderRadius: 28, backgroundImage: 'url(/loki.png)', backgroundSize: '285%', backgroundPosition: '50% 23%', backgroundRepeat: 'no-repeat', border: '1px solid rgba(215,184,106,0.38)', boxShadow: '0 22px 58px rgba(0,0,0,0.30), 0 0 30px rgba(215,184,106,0.18)' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '27px', fontWeight: 940 }}>{dashboard.greeting || 'Добрый день'}{dashboard.userName ? `, ${dashboard.userName}` : ''}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '20px', marginTop: 7 }}>{dashboard.summary || 'Я собрал для тебя события, новости, задания и полезные действия внутри АПГ.'}</div>
          </div>
        </div>
      </GlassCard>

      <section style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 19, lineHeight: '24px', fontWeight: 920 }}>Сегодня для тебя</div>
          <GlassBadge>{recommendations.length || 0} варианта</GlassBadge>
        </div>
        <div style={{ display: 'grid', gap: 9 }}>
          {recommendations.length ? recommendations.map(card => renderLokiCard(card, 'today')) : (
            <GlassCard style={{ borderRadius: 26, padding: 16 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 880 }}>Локи готов собрать подборку</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Спроси, что интересно сегодня, и я выберу лучший вариант из данных АПГ.</div>
            </GlassCard>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 14 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 19, lineHeight: '24px', fontWeight: 920, marginBottom: 10 }}>Быстрые сценарии</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
          {QUICK_ACTIONS.map(item => (
            <GlassCard key={item.id} onClick={() => ask(item.prompt)} style={{ borderRadius: 26, padding: 14, minHeight: 124, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 26, lineHeight: '30px' }}>{item.icon}</div>
              <div>
                <div style={{ color: APG2_PROFILE.text, fontSize: 15.5, lineHeight: '19px', fontWeight: 900 }}>{item.title}</div>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 4 }}>{item.text}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      <GlassCard style={{ borderRadius: 30, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <GlassBadge tone="gold">План дня</GlassBadge>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5 }}>лучший маршрут от Локи</div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {(dashboard.dayPlan ?? []).slice(0, 4).map((step, idx) => (
            <div key={`${step.title}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'start' }}>
              <div style={{ width: 34, height: 34, borderRadius: 15, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 920 }}>{idx + 1}</div>
              <div>
                <div style={{ color: APG2_PROFILE.text, fontSize: 14.5, lineHeight: '19px', fontWeight: 860 }}>{step.title}</div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 2 }}>{step.text}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
        <GlassCard style={{ borderRadius: 26, padding: 14 }}>
          <GlassBadge>Прогресс</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 28, lineHeight: '33px', fontWeight: 950, marginTop: 10 }}>{Number(progress.keys ?? 0)}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px' }}>ключей сейчас</div>
        </GlassCard>
        <GlassCard style={{ borderRadius: 26, padding: 14 }}>
          <GlassBadge>Сегодня</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 28, lineHeight: '33px', fontWeight: 950, marginTop: 10 }}>{Number(progress.activeTasks ?? 0)}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px' }}>активных заданий</div>
        </GlassCard>
      </div>

      {mainNews && (
        <GlassCard onClick={() => runCardAction(mainNews.action)} style={{ borderRadius: 30, padding: 16, marginBottom: 14 }}>
          <GlassBadge tone="gold">Главная новость дня</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 920, marginTop: 11 }}>{safeText(mainNews.title, 'Новость АПГ')}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 7 }}>{shortText(mainNews.text, 150)}</div>
        </GlassCard>
      )}

      <GlassCard style={{ borderRadius: 32, padding: 14, marginBottom: 14 }}>
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 20, lineHeight: '25px', fontWeight: 930 }}>Чем я могу помочь сегодня?</div>
          <GlassButton onClick={() => ask('Объясни этот экран')} tone="gold" style={{ width: '100%', minHeight: 46, borderRadius: 20, color: '#17120a' }}>Объяснить этот экран</GlassButton>
          <GlassInput value={input} onChange={e => setInput(e.target.value)} placeholder="Напиши задачу, а не команду" aria-label="Вопрос Локи" style={{ minHeight: 56, borderRadius: 24 }} />
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            {EXAMPLE_PROMPTS.map(prompt => <GlassButton key={prompt} onClick={() => ask(prompt)} style={{ minHeight: 38, borderRadius: 999, padding: '8px 11px', flex: '0 0 auto', fontSize: 12 }}>{prompt}</GlassButton>)}
          </div>
          <GlassButton type="submit" tone="gold" disabled={!input.trim() || loki.brainThinking} style={{ color: '#17120a' }}>{loki.brainThinking ? 'Думаю...' : 'Получить решение'}</GlassButton>
        </form>
      </GlassCard>

      {answer && (
        <GlassCard style={{ borderRadius: 30, padding: 16, marginBottom: 14 }}>
          <GlassBadge>{answer.question}</GlassBadge>
          <div style={{ whiteSpace: 'pre-line', color: APG2_PROFILE.text, fontSize: 14, lineHeight: '20px', fontWeight: 740, marginTop: 11 }}>{answer.text}</div>
          {!!answer.cards?.length && <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>{answer.cards.slice(0, 3).map(card => renderLokiCard(card, 'answer'))}</div>}
        </GlassCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <GlassButton onClick={onOpenReference}>Справочник</GlassButton>
        <GlassButton onClick={() => onOpenPanel?.('nearby')}>Что рядом?</GlassButton>
      </div>
    </GlassPanel>
  );
}
