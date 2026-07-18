import React, { useEffect, useMemo, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel } from './components/Apg2ProfileGlass.jsx';
import { useLoki } from './loki/LokiProvider.jsx';
import { LokiIdentity } from './loki/LokiIdentity.jsx';
import { isVK } from './vk.js';
import { APG_EVENT_TYPES, trackAppEvent } from './intelligence/index.js';

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
  const [hiddenRecommendationIds, setHiddenRecommendationIds] = useState(() => new Set());
  const dashboard = loki.dashboard ?? {};

  const recommendations = useMemo(() => {
    const rows = dashboard.todayRecommendations?.length ? dashboard.todayRecommendations : loki.recommendationFeed ?? [];
    return rows.slice(0, 3);
  }, [dashboard.todayRecommendations, loki.recommendationFeed]);
  const personalSummary = Array.isArray(dashboard.personalSummary) ? dashboard.personalSummary : [];
  const continueItems = Array.isArray(dashboard.continueItems) ? dashboard.continueItems : [];
  const changes = Array.isArray(dashboard.changes) ? dashboard.changes : [];
  const todayBlocks = Array.isArray(dashboard.todayBlocks) ? dashboard.todayBlocks : [];
  const recommendationSections = dashboard.recommendationSections || {};
  const recommendationCards = [
    ...(recommendationSections.events || []),
    ...(recommendationSections.partners || []),
    ...(recommendationSections.news || []),
    ...(recommendationSections.experts || []),
    ...recommendations,
  ].filter(Boolean);
  const uniqueRecommendationCards = recommendationCards
    .filter((card, index, list) => list.findIndex(row => `${row.type}-${row.id}` === `${card.type}-${card.id}`) === index)
    .filter(card => !hiddenRecommendationIds.has(`${card.type}-${card.id}`))
    .slice(0, 5);

  useEffect(() => {
    recommendations.forEach(card => {
      trackAppEvent('loki:recommendation_view', {
        type: APG_EVENT_TYPES.RECOMMENDATION_VIEWED,
        user: loki.lokiContext?.user,
        entityType: card.type || 'recommendation',
        entityId: card.id,
        payload: { title: card.title, recommendationType: card.type, source: 'loki_page' },
      });
    });
  }, [loki.lokiContext?.user, recommendations]);

  const runCardAction = async (action) => {
    if (!action) return;
    await loki.executeAction(action);
    trackAppEvent('loki:action_completed', {
      type: APG_EVENT_TYPES.LOKI_ACTION_COMPLETED,
      user: loki.lokiContext?.user,
      entityType: 'loki',
      entityId: action?.type || action?.id || 'action',
      payload: { action },
    });
  };

  const openHref = (href) => {
    if (!href) return;
    try { window.open(href, '_blank', 'noopener,noreferrer'); } catch {}
  };

  const ask = async (text) => {
    const question = String(text || '').trim();
    if (!question || loki.brainThinking) return;
    trackAppEvent('loki:question', {
      type: APG_EVENT_TYPES.LOKI_QUESTION_ASKED,
      user: loki.lokiContext?.user,
      entityType: 'loki',
      entityId: 'question',
      payload: { question },
    });
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
    <GlassCard key={`${keyPrefix}-${card.id}`} onClick={() => {
      trackAppEvent('loki:recommendation_interaction', {
        type: APG_EVENT_TYPES.RECOMMENDATION_INTERACTED,
        user: loki.lokiContext?.user,
        entityType: card.type || 'recommendation',
        entityId: card.id,
        payload: { title: card.title, recommendationType: card.type, source: keyPrefix },
      });
      runCardAction(card.action);
    }} style={{ borderRadius: 26, padding: 0, overflow: 'hidden' }}>
      {card.image && <div style={{ height: 104, backgroundImage: `url(${card.image})`, backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />}
      <div style={{ padding: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <GlassBadge tone={card.type === 'event' ? 'gold' : 'glass'}>{cardTypeLabel(card.type)}</GlassBadge>
          <span style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 840 }}>{card.label || 'Открыть'}</span>
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '20px', fontWeight: 920 }}>{safeText(card.title, 'Рекомендация АПГ')}</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 6 }}>{shortText(card.reason || card.text || 'Открою детали и помогу выбрать действие.', 126)}</div>
        {!!card.explanation?.length && (
          <div style={{ display: 'grid', gap: 3, marginTop: 8 }}>
            {card.explanation.slice(0, 2).map((reason, idx) => (
              <div key={`${card.id}-reason-${idx}`} style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px' }}>• {reason}</div>
            ))}
          </div>
        )}
        {!!card.actions?.length && (
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 11, paddingBottom: 2 }} onClick={e => e.stopPropagation()}>
            {card.actions.slice(0, 3).map((act, idx) => (
              <GlassButton key={`${card.id}-action-${idx}`} tone={idx === 0 ? 'gold' : 'default'} onClick={() => {
                if (act.localAction === 'hideRecommendation') {
                  setHiddenRecommendationIds(prev => new Set([...prev, `${card.type}-${card.id}`]));
                  return;
                }
                if (act.href) openHref(act.href);
                else runCardAction(act.action);
              }} style={{ minHeight: 34, borderRadius: 999, padding: '7px 10px', fontSize: 12, flex: '0 0 auto', color: idx === 0 ? '#17120a' : undefined }}>{act.label}</GlassButton>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );

  const progress = dashboard.progress ?? {};
  const mainNews = dashboard.mainNews ?? null;
  const renderSectionTitle = (title, meta = '') => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
      <div style={{ color: APG2_PROFILE.text, fontSize: 19, lineHeight: '24px', fontWeight: 920 }}>{title}</div>
      {meta ? <GlassBadge>{meta}</GlassBadge> : null}
    </div>
  );
  const renderInsightList = (items = []) => (
    <GlassCard style={{ borderRadius: 28, padding: 15, display: 'grid', gap: 8 }}>
      {items.map((item, idx) => (
        <div key={`${item}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 9, alignItems: 'start' }}>
          <span style={{ width: 24, height: 24, borderRadius: 12, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{idx + 1}</span>
          <span style={{ color: APG2_PROFILE.textSoft, fontSize: 13.2, lineHeight: '18px' }}>{item}</span>
        </div>
      ))}
    </GlassCard>
  );
  const renderEvaluationBlock = () => {
    const snapshot = loki.lastEvaluationSnapshot;
    const evaluationHistory = Array.isArray(loki.lastEvaluationHistory) ? loki.lastEvaluationHistory : [];
    if (!snapshot && !evaluationHistory.length) return null;
    const rows = [
      ['Overall Score', snapshot?.Overall],
      ['Grade', snapshot?.Grade],
      ['Confidence', snapshot?.Confidence],
      ['Context Coverage', snapshot?.Context],
      ['Hallucination', snapshot?.Hallucination],
      ['Tool Quality', snapshot?.Tools],
      ['Decision Quality', snapshot?.Decision],
      ['Conversation Quality', snapshot?.Conversation],
      ['Personalization', snapshot?.Personalization],
    ];
    return (
      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Evaluation', evaluationHistory.length ? `${evaluationHistory.length} оценок` : '')}
        <GlassCard style={{ borderRadius: 28, padding: 15, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 10, minWidth: 0 }}>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '14px', fontWeight: 760 }}>{label}</div>
                <div style={{ color: label === 'Grade' ? APG2_PROFILE.gold : APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 930, marginTop: 3 }}>{value ?? '—'}</div>
              </div>
            ))}
          </div>
          {!!evaluationHistory.length && (
            <div style={{ display: 'grid', gap: 6 }}>
              {evaluationHistory.slice(0, 5).map((item, idx) => (
                <div key={item.evaluationId || `${item.createdAt}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '46px 42px 1fr', gap: 8, alignItems: 'center', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                  <span style={{ color: APG2_PROFILE.text, fontWeight: 900 }}>{item.overallScore}</span>
                  <span style={{ color: APG2_PROFILE.gold, fontWeight: 900 }}>{item.grade}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.hallucination} · confidence {item.confidence}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>
    );
  };
  const renderCapabilityBlock = () => {
    const snapshot = loki.lastCapabilitySnapshot;
    const capabilityContext = loki.lastCapabilityContext;
    const capabilityHistory = Array.isArray(loki.lastCapabilityHistory) ? loki.lastCapabilityHistory : [];
    if (!snapshot && !capabilityContext && !capabilityHistory.length) return null;
    const rows = [
      ['Detected Capability', snapshot?.DetectedCapability || capabilityContext?.capability],
      ['Confidence', snapshot?.Confidence ?? capabilityContext?.confidence],
      ['Alternatives', (snapshot?.Alternatives || capabilityContext?.alternatives?.map?.(item => item.id) || []).join(', ')],
      ['Parameters', (snapshot?.Parameters || capabilityContext?.required || []).join(', ')],
      ['Missing Parameters', (snapshot?.Missing || capabilityContext?.missing || []).join(', ')],
      ['Related Tools', (snapshot?.RelatedTools || capabilityContext?.relatedTools || []).join(', ')],
      ['Execution Order', (snapshot?.ExecutionOrder || capabilityContext?.executionOrder || []).map?.(item => item.capability || item).join(' → ')],
    ];
    return (
      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Capability', capabilityHistory.length ? `${capabilityHistory.length} записей` : '')}
        <GlassCard style={{ borderRadius: 28, padding: 15, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 7 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 8, alignItems: 'start', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                <span style={{ color: APG2_PROFILE.textMuted, fontWeight: 760 }}>{label}</span>
                <span style={{ color: label === 'Detected Capability' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontWeight: label === 'Detected Capability' ? 900 : 720, minWidth: 0, overflowWrap: 'anywhere' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
          {!!capabilityHistory.length && (
            <div style={{ display: 'grid', gap: 6 }}>
              {capabilityHistory.slice(0, 5).map((item, idx) => (
                <div key={item.id || `${item.createdAt}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 46px', gap: 8, alignItems: 'center', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.capability}</span>
                  <span style={{ color: APG2_PROFILE.gold, fontWeight: 900, textAlign: 'right' }}>{item.confidence}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>
    );
  };
  const renderSkillBlock = () => {
    const snapshot = loki.lastSkillSnapshot;
    const skillContext = loki.lastSkillContext;
    const skillHistory = Array.isArray(loki.lastSkillHistory) ? loki.lastSkillHistory : [];
    if (!snapshot && !skillContext && !skillHistory.length) return null;
    const rows = [
      ['Selected Skill', snapshot?.SelectedSkill || skillContext?.skill],
      ['Confidence', snapshot?.Confidence ?? skillContext?.confidence],
      ['Alternatives', (snapshot?.Alternatives || skillContext?.alternatives?.map?.(item => item.id) || []).join(', ')],
      ['Planner', snapshot?.Planner || skillContext?.planner],
      ['Workflow', snapshot?.Workflow || skillContext?.workflow],
      ['Related Tools', (snapshot?.RelatedTools || skillContext?.tools || []).join(', ')],
      ['Capability', snapshot?.Capability || skillContext?.capability],
    ];
    return (
      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Skills', skillHistory.length ? `${skillHistory.length} записей` : '')}
        <GlassCard style={{ borderRadius: 28, padding: 15, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 7 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 8, alignItems: 'start', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                <span style={{ color: APG2_PROFILE.textMuted, fontWeight: 760 }}>{label}</span>
                <span style={{ color: label === 'Selected Skill' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontWeight: label === 'Selected Skill' ? 900 : 720, minWidth: 0, overflowWrap: 'anywhere' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
          {!!skillHistory.length && (
            <div style={{ display: 'grid', gap: 6 }}>
              {skillHistory.slice(0, 5).map((item, idx) => (
                <div key={item.id || `${item.createdAt}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 46px', gap: 8, alignItems: 'center', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.skill} · {item.capability}</span>
                  <span style={{ color: APG2_PROFILE.gold, fontWeight: 900, textAlign: 'right' }}>{item.confidence}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>
    );
  };
  const renderExecutionBlock = () => {
    const snapshot = loki.lastExecutionSnapshot;
    const executionContext = loki.lastExecutionContext;
    const executionHistory = Array.isArray(loki.lastExecutionHistory) ? loki.lastExecutionHistory : [];
    if (!snapshot && !executionContext && !executionHistory.length) return null;
    const plan = snapshot?.ExecutionPlan || executionContext?.executionPlan?.order || executionContext?.executionOrder?.map?.(item => item.capability) || [];
    const rows = [
      ['Capability', snapshot?.Capability || executionContext?.capability],
      ['Execution Plan', plan.join(' → ')],
      ['Planner', snapshot?.Planner || executionContext?.planner],
      ['Workflow', snapshot?.Workflow || executionContext?.workflow],
      ['Navigation', snapshot?.Navigation || executionContext?.navigation?.screen],
      ['Tools', (snapshot?.Tools || executionContext?.tools || []).join(', ')],
      ['Resolved Parameters', Object.keys(snapshot?.ResolvedParameters || executionContext?.resolved || {}).join(', ')],
      ['Missing Parameters', (snapshot?.Missing || executionContext?.missing || []).join(', ')],
      ['Execution Ready', String(snapshot?.Ready ?? executionContext?.ready ?? false)],
    ];
    return (
      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Execution', executionHistory.length ? `${executionHistory.length} записей` : '')}
        <GlassCard style={{ borderRadius: 28, padding: 15, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 7 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 8, alignItems: 'start', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                <span style={{ color: APG2_PROFILE.textMuted, fontWeight: 760 }}>{label}</span>
                <span style={{ color: label === 'Execution Ready' ? ((value === 'true' || value === true) ? APG2_PROFILE.gold : APG2_PROFILE.textSoft) : label === 'Capability' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontWeight: label === 'Capability' || label === 'Execution Ready' ? 900 : 720, minWidth: 0, overflowWrap: 'anywhere' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
          {executionContext?.clarificationQuestion && (
            <div style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 10, color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px' }}>
              <span style={{ color: APG2_PROFILE.textMuted, fontWeight: 760 }}>Clarification</span>
              <div style={{ color: APG2_PROFILE.text, fontWeight: 820, marginTop: 4 }}>{executionContext.clarificationQuestion}</div>
            </div>
          )}
          {!!executionHistory.length && (
            <div style={{ display: 'grid', gap: 6 }}>
              {executionHistory.slice(0, 5).map((item, idx) => (
                <div key={item.id || `${item.createdAt}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 58px', gap: 8, alignItems: 'center', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.capability} · {item.navigation || item.workflow || item.execution || '—'}</span>
                  <span style={{ color: item.ready ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontWeight: 900, textAlign: 'right' }}>{item.ready ? 'ready' : 'wait'}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>
    );
  };
  const renderControlledExecutionBlock = () => {
    const snapshot = loki.lastControlledExecutionSnapshot;
    const controlledContext = loki.lastControlledExecutionContext;
    const controlledHistory = Array.isArray(loki.lastControlledExecutionHistory) ? loki.lastControlledExecutionHistory : [];
    if (!snapshot && !controlledContext && !controlledHistory.length) return null;
    const confirmation = controlledContext?.confirmation || {};
    const rows = [
      ['Policy', snapshot?.Policy || controlledContext?.policy?.policy],
      ['Ready', String(snapshot?.Ready ?? controlledContext?.executionReady ?? false)],
      ['Confirmation', `${snapshot?.ConfirmationStatus || confirmation.status || '—'}${confirmation.executionId ? ` · ${confirmation.executionId}` : ''}`],
      ['Dispatcher', snapshot?.Dispatcher || controlledContext?.dispatcher?.dispatcher],
      ['Action', snapshot?.ActionType || controlledContext?.dispatcher?.action?.type],
      ['Execution Result', snapshot?.Result || controlledContext?.result?.status],
      ['Reason', snapshot?.Reason || controlledContext?.result?.reason || controlledContext?.guard?.reason],
    ];
    return (
      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Controlled Execution', controlledHistory.length ? `${controlledHistory.length} записей` : '')}
        <GlassCard style={{ borderRadius: 28, padding: 15, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 7 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 8, alignItems: 'start', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                <span style={{ color: APG2_PROFILE.textMuted, fontWeight: 760 }}>{label}</span>
                <span style={{ color: label === 'Policy' || label === 'Ready' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontWeight: label === 'Policy' || label === 'Ready' ? 900 : 720, minWidth: 0, overflowWrap: 'anywhere' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
          {(snapshot?.Preview || controlledContext?.preview?.text) && (
            <div style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 10, color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', whiteSpace: 'pre-line' }}>
              {snapshot?.Preview || controlledContext?.preview?.text}
            </div>
          )}
          {!!controlledHistory.length && (
            <div style={{ display: 'grid', gap: 6 }}>
              {controlledHistory.slice(0, 5).map((item, idx) => (
                <div key={item.id || `${item.createdAt}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 78px', gap: 8, alignItems: 'center', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.capability} · {item.policy} · {item.dispatcher || '—'}</span>
                  <span style={{ color: item.ready ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontWeight: 900, textAlign: 'right' }}>{item.resultStatus || (item.ready ? 'ready' : 'blocked')}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>
    );
  };
  const renderContinueItem = (item) => (
    <button
      key={`${item.type}-${item.id}`}
      type="button"
      onClick={() => runCardAction(item.action)}
      style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.06)', color: APG2_PROFILE.text, borderRadius: 20, padding: 12, textAlign: 'left', display: 'grid', gap: 4 }}
    >
      <span style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 840, textTransform: 'uppercase' }}>{item.label || cardTypeLabel(item.type)}</span>
      <span style={{ fontSize: 14, lineHeight: '18px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.text}</span>
    </button>
  );

  return (
    <GlassPanel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <GlassButton onClick={onBack} style={{ width: 44, minHeight: 44, borderRadius: 18, padding: 0 }}>‹</GlassButton>
        <div style={{ minWidth: 0, flex: 1 }}>
          <GlassBadge tone="gold" style={{ marginBottom: 7 }}>{isVK() ? 'Loki Home в VK' : 'Loki Home'}</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 28, lineHeight: '32px', fontWeight: 940 }}>Личный секретарь</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '19px', marginTop: 4 }}>Единый центр персональных рекомендаций АПГ.</div>
        </div>
      </div>

      <GlassCard style={{ borderRadius: 38, padding: 18, marginBottom: 14, overflow: 'hidden', position: 'relative' }}>
        <span style={{ position: 'absolute', inset: -80, background: 'radial-gradient(circle at 12% 6%, rgba(215,184,106,0.28), transparent 34%), radial-gradient(circle at 92% 12%, rgba(255,255,255,0.12), transparent 30%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '82px 1fr', gap: 14, alignItems: 'center' }}>
          <LokiIdentity size={78} state="recommending" showText={false} style={{ placeItems: 'center' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '27px', fontWeight: 940 }}>{dashboard.greeting || 'Добрый день'}{dashboard.userName ? `, ${dashboard.userName}` : ''}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '20px', marginTop: 7 }}>{dashboard.summary || 'Я собрал для тебя события, новости, задания и полезные действия внутри АПГ.'}</div>
          </div>
        </div>
      </GlassCard>

      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Сегодня для вас', `${personalSummary.length || 0} фактов`)}
        {personalSummary.length ? renderInsightList(personalSummary) : (
          <GlassCard style={{ borderRadius: 28, padding: 15 }}>
            <div style={{ color: APG2_PROFILE.text, fontWeight: 880 }}>Локи собирает контекст</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Чем больше вы пользуетесь АПГ, тем точнее будет ежедневная сводка.</div>
          </GlassCard>
        )}
      </section>

      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Продолжить', continueItems.length ? `${continueItems.length}` : '')}
        <div style={{ display: 'grid', gridTemplateColumns: continueItems.length > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 9 }}>
          {continueItems.length ? continueItems.slice(0, 4).map(renderContinueItem) : (
            <GlassCard style={{ borderRadius: 26, padding: 15 }}>
              <div style={{ color: APG2_PROFILE.text, fontWeight: 880 }}>Нет незавершённых действий</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Когда вы начнёте читать новости, смотреть партнёров или мероприятия, Локи запомнит путь.</div>
            </GlassCard>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Локи рекомендует', `${uniqueRecommendationCards.length || 0}`)}
        <div style={{ display: 'grid', gap: 9 }}>
          {uniqueRecommendationCards.length ? uniqueRecommendationCards.map(card => renderLokiCard(card, 'recommend')) : (
            <GlassCard style={{ borderRadius: 26, padding: 16 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 880 }}>Локи готов собрать подборку</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Спроси, что интересно сегодня, и я выберу лучший вариант из данных АПГ.</div>
            </GlassCard>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Что изменилось', changes.length ? 'с последнего периода' : '')}
        {changes.length ? renderInsightList(changes) : (
          <GlassCard style={{ borderRadius: 28, padding: 15 }}>
            <div style={{ color: APG2_PROFILE.text, fontWeight: 880 }}>Пока без заметных изменений</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Локи покажет новые события, новости, партнёров и начисления, когда они появятся.</div>
          </GlassCard>
        )}
      </section>

      <section style={{ marginBottom: 14 }}>
        {renderSectionTitle('Сегодня', todayBlocks.length ? 'план дня' : '')}
        <div style={{ display: 'grid', gap: 9 }}>
          {todayBlocks.length ? todayBlocks.slice(0, 3).map(card => renderLokiCard(card, 'today-block')) : (
            <GlassCard style={{ borderRadius: 28, padding: 15 }}>
              <div style={{ color: APG2_PROFILE.text, fontWeight: 880 }}>Сегодня без срочных задач</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Позже здесь появятся мероприятие дня, акция, новость, напоминания и погодный контекст.</div>
            </GlassCard>
          )}
        </div>
      </section>

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
          <div style={{ color: APG2_PROFILE.text, fontSize: 20, lineHeight: '25px', fontWeight: 930 }}>Спросите Локи</div>
          <GlassButton onClick={() => ask('Объясни этот экран')} tone="gold" style={{ width: '100%', minHeight: 46, borderRadius: 20, color: '#17120a' }}>Объяснить этот экран</GlassButton>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {QUICK_ACTIONS.slice(0, 4).map(item => (
              <GlassButton key={item.id} onClick={() => ask(item.prompt)} style={{ minHeight: 42, borderRadius: 18, padding: '8px 9px', fontSize: 12 }}>{item.title}</GlassButton>
            ))}
          </div>
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

      {renderCapabilityBlock()}
      {renderSkillBlock()}
      {renderExecutionBlock()}
      {renderControlledExecutionBlock()}
      {renderEvaluationBlock()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <GlassButton onClick={onOpenReference}>Справочник</GlassButton>
        <GlassButton onClick={() => onOpenPanel?.('nearby')}>Что рядом?</GlassButton>
      </div>
    </GlassPanel>
  );
}
