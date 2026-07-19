import React, { useMemo, useState } from 'react';
import { APG2_PROFILE, GlassButton, GlassCard } from '../Apg2ProfileGlass.jsx';
import { FIRST_JOURNEY_LOKI_QUESTIONS } from '../../firstJourney.js';

function StepRow({ step }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 24px', gap: 9, alignItems: 'center' }}>
      <span style={{ width: 28, height: 28, borderRadius: 11, display: 'grid', placeItems: 'center', background: step.done ? APG2_PROFILE.goldSoft : 'rgba(255,255,255,0.08)', fontSize: 14 }}>{step.icon}</span>
      <span style={{ minWidth: 0, color: step.done ? APG2_PROFILE.textSoft : APG2_PROFILE.text, fontSize: 13, lineHeight: '17px', fontWeight: step.done ? 690 : 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.title}</span>
      <span style={{ width: 24, height: 24, borderRadius: 12, display: 'grid', placeItems: 'center', background: step.done ? 'rgba(74,179,75,0.16)' : 'rgba(255,255,255,0.06)', color: step.done ? '#4BB34B' : APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 900 }}>{step.done ? '✓' : ''}</span>
    </div>
  );
}

function ExploreCard({ icon, title, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ minHeight: 82, borderRadius: 22, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: APG2_PROFILE.text, cursor: 'pointer', fontFamily: 'inherit', display: 'grid', placeItems: 'center', gap: 6, padding: 12 }}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, lineHeight: '16px', fontWeight: 850 }}>{title}</span>
    </button>
  );
}

function StepContent({ stepId, onEmailLogin, onAskLoki, onOpenRewards, onOpenPanel, onOpenLoki, onOpenHome }) {
  if (stepId === 'installed') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '20px' }}>Откройте АПГ с иконки на рабочем столе телефона. В установленной PWA этот шаг отметится автоматически.</div>
      </div>
    );
  }
  if (stepId === 'email') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '20px' }}>Электронная почта является основным способом входа в АПГ. Через неё сохраняются ваш профиль, друзья, бонусы, сообщения и записи.</div>
        <GlassButton tone="gold" onClick={onEmailLogin} style={{ width: '100%', minHeight: 50, color: '#17120a' }}>Войти по электронной почте</GlassButton>
      </div>
    );
  }
  if (stepId === 'loki') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '20px' }}>Локи поможет найти партнёров, мероприятия, акции и ответит на вопросы.</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {FIRST_JOURNEY_LOKI_QUESTIONS.map(item => (
            <button key={item.text} type="button" onClick={() => onAskLoki?.(item.text)} style={{ flex: '0 0 auto', minHeight: 40, borderRadius: 999, border: '1px solid rgba(215,184,106,0.24)', background: 'rgba(215,184,106,0.10)', color: APG2_PROFILE.text, padding: '0 13px', fontSize: 12.5, lineHeight: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{item.label}</button>
          ))}
        </div>
      </div>
    );
  }
  if (stepId === 'rewards') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '20px' }}>Многие партнёры дарят подарки участникам АПГ.</div>
        <GlassButton tone="gold" onClick={onOpenRewards} style={{ width: '100%', minHeight: 50, color: '#17120a' }}>Открыть подарки</GlassButton>
      </div>
    );
  }
  if (stepId === 'explore') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        <ExploreCard icon="🏪" title="Партнёры" onClick={() => onOpenPanel?.('partners')} />
        <ExploreCard icon="📅" title="Мероприятия" onClick={() => onOpenPanel?.('events')} />
        <ExploreCard icon="💬" title="Сообщения" onClick={() => onOpenPanel?.('dialogs')} />
        <ExploreCard icon="🎁" title="Подарки" onClick={() => onOpenPanel?.('rewards')} />
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 46, lineHeight: 1 }}>🎉</div>
      <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '26px', fontWeight: 920 }}>Добро пожаловать в АПГ!</div>
      <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '20px' }}>Вы готовы пользоваться всеми возможностями приложения.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <GlassButton onClick={onOpenHome}>🏠 На главную</GlassButton>
        <GlassButton tone="gold" onClick={onOpenLoki} style={{ color: '#17120a' }}>🤖 Открыть Локи</GlassButton>
      </div>
    </div>
  );
}

export function FirstJourneyCard({ journey, onEmailLogin, onAskLoki, onOpenRewards, onOpenPanel, onOpenLoki, onOpenHome }) {
  const [expanded, setExpanded] = useState(false);
  const safeJourney = journey || { completedCount: 0, totalCount: 5, steps: [], complete: false, hidden: true };
  const progress = useMemo(() => Math.round((safeJourney.completedCount / safeJourney.totalCount) * 100), [safeJourney.completedCount, safeJourney.totalCount]);
  if (!journey || journey.complete || journey.hidden) return null;
  const current = journey.currentStep || journey.steps.find(step => !step.done) || null;
  return (
    <>
      <GlassCard data-first-journey-card interactiveAs="div" style={{ margin: '14px 14px 0', borderRadius: 26, padding: 14, display: 'grid', gap: 10, border: '1px solid rgba(215,184,106,0.24)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '21px', fontWeight: 900 }}>Добро пожаловать!</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px', marginTop: 2 }}>{journey.completedCount} из {journey.totalCount} шагов</div>
          </div>
          <GlassButton tone="gold" onClick={() => setExpanded(true)} style={{ minHeight: 40, borderRadius: 17, padding: '0 14px', color: '#17120a' }}>Продолжить</GlassButton>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: APG2_PROFILE.goldGradient, transition: 'width 260ms ease' }} />
        </div>
      </GlassCard>

      {expanded && (
        <div data-first-journey-modal onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }} style={{ position: 'fixed', inset: 0, zIndex: 12650, background: 'rgba(10,10,14,0.76)', backdropFilter: 'blur(16px) saturate(1.35)', WebkitBackdropFilter: 'blur(16px) saturate(1.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 14px calc(16px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', overflowY: 'auto' }}>
          <GlassCard interactiveAs="div" style={{ width: '100%', maxWidth: 450, borderRadius: 30, padding: 18, display: 'grid', gap: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.6 }}>First Journey</div>
                <div style={{ color: APG2_PROFILE.text, fontSize: 23, lineHeight: '28px', fontWeight: 930, marginTop: 5 }}>{current ? `${current.icon} ${current.title}` : '🎉 Добро пожаловать в АПГ!'}</div>
              </div>
              <button type="button" onClick={() => setExpanded(false)} aria-label="Закрыть First Journey" style={{ width: 34, height: 34, borderRadius: 17, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: APG2_PROFILE.textSoft, fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {journey.steps.map(step => <StepRow key={step.id} step={step} />)}
            </div>
            <StepContent
              stepId={current?.id || 'done'}
              onEmailLogin={onEmailLogin}
              onAskLoki={(text) => {
                setExpanded(false);
                onAskLoki?.(text);
              }}
              onOpenRewards={() => {
                setExpanded(false);
                onOpenRewards?.();
              }}
              onOpenPanel={(panel) => {
                setExpanded(false);
                onOpenPanel?.(panel);
              }}
              onOpenLoki={onOpenLoki}
              onOpenHome={onOpenHome}
            />
          </GlassCard>
        </div>
      )}
    </>
  );
}
