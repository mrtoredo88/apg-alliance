import React, { useEffect, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel } from './components/Apg2ProfileGlass.jsx';
import { useLoki } from './loki/LokiProvider.jsx';
import { isVK } from './vk.js';

const QUICK_QUESTIONS = [
  'Как получать ключи?',
  'Что интересного сегодня?',
  'Где найти партнёров?',
  'Как участвовать в розыгрыше?',
  'Что умеет Локи?',
];

export function LokiPage({ onBack, onOpenReference, onOpenPanel }) {
  const loki = useLoki();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => ([
    { id: 'hello', from: 'loki', text: isVK() ? 'Привет! Я Локи. Теперь я живу и здесь, в VK. Помогу тебе открыть АПГ быстрее.' : 'Привет! Я Локи. Помогу тебе быстрее разобраться в АПГ.' },
  ]));

  useEffect(() => {
    loki.showMessage?.('daily_visit', {
      message: isVK()
        ? 'Я рядом в VK Mini App. Можно спросить про ключи, партнёров, события или призы.'
        : 'Я рядом. Спроси меня про АПГ обычными словами.',
      source: 'loki_page',
    });
  }, []);

  const ask = async (text) => {
    const question = String(text || '').trim();
    if (!question || loki.brainThinking) return;
    setInput('');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, from: 'user', text: question }]);
    const result = await loki.askExperience(question);
    setMessages(prev => [...prev, {
      id: `l-${Date.now()}`,
      from: 'loki',
      text: result?.text || 'Пока я этого не знаю, но могу открыть справочник АПГ.',
      cards: result?.cards?.length ? result.cards : result?.card ? [result.card] : [],
    }]);
  };

  const runCardAction = async (action) => {
    if (!action) return;
    await loki.executeAction(action);
  };

  return (
    <GlassPanel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <GlassButton onClick={onBack} style={{ width: 44, minHeight: 44, borderRadius: 18, padding: 0 }}>‹</GlassButton>
        <div style={{ minWidth: 0, flex: 1 }}>
          <GlassBadge tone="gold" style={{ marginBottom: 7 }}>{isVK() ? 'Локи в VK' : 'Локи АПГ'}</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 28, lineHeight: '32px', fontWeight: 940 }}>Помощник АПГ</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '19px', marginTop: 4 }}>Один Локи для Web App, Telegram Mini App и VK Mini App.</div>
        </div>
      </div>

      <GlassCard style={{ borderRadius: 38, padding: 18, marginBottom: 14, overflow: 'hidden', position: 'relative' }}>
        <span style={{ position: 'absolute', inset: -80, background: 'radial-gradient(circle at 50% 10%, rgba(215,184,106,0.22), transparent 32%), radial-gradient(circle at 88% 8%, rgba(255,255,255,0.10), transparent 28%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 12 }}>
          <div style={{ width: 142, height: 142, borderRadius: 46, backgroundImage: 'url(/loki.png)', backgroundSize: '285%', backgroundPosition: '50% 23%', backgroundRepeat: 'no-repeat', border: '1px solid rgba(215,184,106,0.36)', boxShadow: '0 28px 76px rgba(0,0,0,0.34), 0 0 40px rgba(215,184,106,0.20)', animation: loki.brainThinking ? 'lokiThinking 1.4s var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) infinite' : 'lokiIdle 4.8s var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '25px', fontWeight: 920 }}>{loki.brainThinking ? 'Думаю...' : 'Чем могу помочь?'}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '20px', marginTop: 5 }}>Спроси про город, ключи, партнёров, события или призы. Я отвечаю на основе данных АПГ.</div>
          </div>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 3, marginBottom: 12 }}>
        {QUICK_QUESTIONS.map(question => (
          <GlassButton key={question} onClick={() => ask(question)} style={{ minHeight: 40, flex: '0 0 auto', borderRadius: 999, padding: '8px 12px' }}>{question}</GlassButton>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
        {messages.slice(-8).map(item => {
          const user = item.from === 'user';
          return (
            <div key={item.id} style={{ display: 'grid', justifyItems: user ? 'end' : 'start', gap: 8 }}>
              <div style={{ ...APG2_PROFILE.glass, maxWidth: user ? '84%' : '96%', borderRadius: user ? '22px 22px 7px 22px' : '22px 22px 22px 7px', padding: '11px 13px', color: APG2_PROFILE.text, border: user ? '1px solid rgba(215,184,106,0.30)' : APG2_PROFILE.glass.border }}>
                <div style={{ fontSize: 13.5, lineHeight: '19px', fontWeight: 740 }}>{item.text}</div>
              </div>
              {!!item.cards?.length && (
                <div style={{ width: '100%', display: 'grid', gap: 8 }}>
                  {item.cards.slice(0, 3).map(card => (
                    <GlassCard key={`${item.id}-${card.id}`} onClick={() => runCardAction(card.action)} style={{ borderRadius: 22, padding: 12 }}>
                      <div style={{ color: APG2_PROFILE.text, fontSize: 14.5, lineHeight: '19px', fontWeight: 860 }}>{card.title}</div>
                      <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>{card.text}</div>
                      <div style={{ color: APG2_PROFILE.gold, fontSize: 12.5, lineHeight: '17px', fontWeight: 820, marginTop: 8 }}>{card.label || 'Открыть'}</div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ ...APG2_PROFILE.glass, borderRadius: 28, padding: 9, display: 'grid', gridTemplateColumns: '1fr 48px', gap: 8, alignItems: 'center', border: '1px solid rgba(215,184,106,0.22)', marginBottom: 12 }}>
        <GlassInput value={input} onChange={e => setInput(e.target.value)} placeholder="Напишите Локи..." aria-label="Вопрос Локи" style={{ minHeight: 46, borderRadius: 20, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)' }} />
        <GlassButton type="submit" tone="gold" disabled={!input.trim() || loki.brainThinking} style={{ width: 48, minHeight: 46, borderRadius: 20, padding: 0, color: '#17120a' }}>→</GlassButton>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <GlassButton onClick={onOpenReference}>Справочник</GlassButton>
        <GlassButton onClick={() => onOpenPanel?.('nearby')}>Что рядом?</GlassButton>
      </div>
    </GlassPanel>
  );
}
