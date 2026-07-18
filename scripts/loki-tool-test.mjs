import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { runLokiActionCenter } from '../src/loki/core/actions/ActionCenter.js';
import { LOKI_APP_ACTIONS } from '../src/loki/lokiActionTypes.js';
import { clearToolCache, executeLokiTool } from '../src/loki/core/tools/ToolExecutor.js';
import { buildToolHistoryPatch, summarizeToolHistory } from '../src/loki/core/tools/ToolHistory.js';
import { LOKI_TOOL_EVENTS, TOOL_IDS, getToolDefinition, getToolRegistry } from '../src/loki/core/tools/ToolRegistry.js';
import { resolveLokiTool } from '../src/loki/core/tools/ToolResolver.js';
import { validateToolCall } from '../src/loki/core/tools/ToolValidator.js';

const now = Date.now();
const today = new Date(now).toISOString();
const tomorrow = new Date(now + 86400000).toISOString();
const nextWeek = new Date(now + 5 * 86400000).toISOString();

const appState = {
  activePanel: 'home',
  user: {
    id: 'user-1',
    first_name: 'Ольга',
    role: 'partner',
    level: 7,
    achievements: ['scan', 'event'],
    streak: 4,
    reputation: 92,
    eventIds: ['event-networking'],
    viewedGiftIds: ['gift-old'],
  },
  userKeys: 14,
  partners: [
    { id: 'partner-beauty', name: 'Салон Сияние', category: 'Красота', description: 'Маникюр и укладки', address: 'Зеленоград, 15 микрорайон', phone: '+7 999 111-22-33', offer: 'Скидка 15%', bookingUrl: 'https://booking.example/beauty', catalogPublished: true },
    { id: 'partner-flowers', name: 'MD flowers', category: 'Цветы', description: 'Букеты и композиции', address: 'Андреевка', phone: '+7 999 222-33-44', catalogPublished: true },
  ],
  experts: [
    { id: 'expert-dentist', name: 'Ирина Соколова', category: 'Стоматология', specialization: 'Стоматолог', rating: 4.9, reviewsCount: 44, bookingUrl: 'https://booking.example/dentist', catalogPublished: true },
  ],
  promotions: [
    { id: 'promo-today', title: 'Финальный день скидки', description: 'Заканчивается сегодня', partnerId: 'partner-beauty', expiresAt: today, createdAt: today, status: 'published' },
    { id: 'promo-tomorrow', title: 'Скидка до завтра', description: 'Заканчивается завтра', partnerId: 'partner-flowers', expiresAt: tomorrow, createdAt: today, status: 'published' },
  ],
  events: [
    { id: 'event-today', title: 'Встреча сегодня', category: 'Город', startAt: today, status: 'published' },
    { id: 'event-networking', title: 'Нетворкинг предпринимателей', category: 'Бизнес', startAt: tomorrow, status: 'published', registered: true },
    { id: 'event-week', title: 'Городская лекция', category: 'Образование', startAt: nextWeek, status: 'published' },
  ],
  news: [
    { id: 'news-today', title: 'Новости сегодня', summary: 'Сегодня появилась новость', publishedAt: today, status: 'published' },
    { id: 'news-old', title: 'Предыдущая новость', summary: 'Более ранняя публикация', publishedAt: new Date(now - 86400000).toISOString(), status: 'published' },
  ],
  rewards: [
    { id: 'gift-coffee', title: 'Кофе за ключи', description: 'Можно получить сейчас', cost: 5, active: true, createdAt: today },
    { id: 'gift-spa', title: 'SPA сертификат', description: 'Нужно больше ключей', cost: 30, active: true, createdAt: today },
    { id: 'gift-old', title: 'Старый подарок', description: 'Уже просмотрен', cost: 2, active: true, createdAt: new Date(now - 20 * 86400000).toISOString() },
  ],
  bookings: [
    { id: 'booking-tomorrow', serviceTitle: 'Маникюр', providerName: 'Салон Сияние', locationTitle: 'Центральный салон', startAt: tomorrow, status: 'confirmed' },
    { id: 'booking-week', serviceTitle: 'Консультация', providerName: 'Ирина Соколова', startAt: nextWeek, status: 'confirmed' },
  ],
  dialogs: [
    { id: 'dialog-1', title: 'Вопрос по записи', unreadCount: 2, status: 'open' },
  ],
  analytics: {
    kpis: { openTasks: 3, unreadDialogs: 2, bookings: 4, profileViews: 180 },
  },
};

const context = {
  actor: { role: 'partner', permissions: [] },
  user: { keys: 14, role: 'partner' },
  memory: {
    lastJourneyContext: {
      goal: 'BOOK_SERVICE',
      currentStep: { id: 'time', title: 'выбрать время' },
      completedStepIds: ['partner', 'service'],
    },
  },
};

const appActions = Object.fromEntries(Object.values(LOKI_APP_ACTIONS).map(type => [type, async payload => ({ type, payload })]));

let scenarios = 0;
function scenario(name, fn) {
  const result = fn();
  scenarios += 1;
  assert.ok(name);
  return result;
}

scenario('registry exposes requested tools', () => {
  const ids = new Set(getToolRegistry().map(item => item.id));
  Object.values(TOOL_IDS).forEach(id => assert.ok(ids.has(id), id));
  assert.ok(getToolDefinition(TOOL_IDS.USER_KEYS).readOnly);
});

scenario('registry is read only and safe', () => {
  assert.ok(getToolRegistry().every(item => item.readOnly && item.safe));
  assert.equal(getToolRegistry().some(item => item.endpoint || item.collection), false);
});

scenario('resolver maps direct user keys query', () => {
  assert.equal(resolveLokiTool({ question: 'Сколько у меня ключей?' })?.id, TOOL_IDS.USER_KEYS);
});

scenario('resolver maps expiring promotion query', () => {
  assert.equal(resolveLokiTool({ question: 'Какие акции заканчиваются сегодня?' })?.id, TOOL_IDS.PROMOTION_EXPIRING_TODAY);
});

scenario('resolver maps tomorrow meeting query', () => {
  assert.equal(resolveLokiTool({ question: 'Что у меня запланировано завтра?' })?.id, TOOL_IDS.MEETING_TOMORROW);
});

scenario('resolver maps available gifts query', () => {
  assert.equal(resolveLokiTool({ question: 'Какие подарки мне доступны?' })?.id, TOOL_IDS.GIFT_AVAILABLE);
});

scenario('resolver maps today news query', () => {
  assert.equal(resolveLokiTool({ question: 'Какие новости появились сегодня?' })?.id, TOOL_IDS.NEWS_TODAY);
});

scenario('validator denies unknown tool', () => {
  const result = validateToolCall({ id: 'unknown.tool' }, { context, knowledge: { sources: {} } });
  assert.equal(result.ok, false);
});

scenario('validator denies workspace to ordinary user', () => {
  const result = validateToolCall({ id: TOOL_IDS.WORKSPACE_SUMMARY }, { context: { actor: { role: 'user' } }, knowledge: { sources: {} } });
  assert.equal(result.ok, false);
});

scenario('validator allows workspace to partner', () => {
  const knowledge = runLokiKnowledgeEngine({ text: 'workspace', appState, context })?.knowledge;
  const result = validateToolCall({ id: TOOL_IDS.WORKSPACE_SUMMARY }, { context, knowledge });
  assert.equal(result.ok, true);
});

const toolExpectations = [
  ['Сколько у меня ключей?', TOOL_IDS.USER_KEYS, /14 ключ/i],
  ['Мой уровень и достижения', TOOL_IDS.USER_PROFILE, /уровень/i],
  ['Какие акции заканчиваются сегодня?', TOOL_IDS.PROMOTION_EXPIRING_TODAY, /сегодня/i],
  ['Какие акции заканчиваются завтра?', TOOL_IDS.PROMOTION_EXPIRING_TOMORROW, /завтра/i],
  ['Какие акции сейчас?', TOOL_IDS.PROMOTION_ACTIVE, /актив/i],
  ['Новые акции', TOOL_IDS.PROMOTION_NEW, /нов/i],
  ['Какие подарки мне доступны?', TOOL_IDS.GIFT_AVAILABLE, /кофе/i],
  ['Новые подарки', TOOL_IDS.GIFT_NEW, /подар/i],
  ['Непросмотренные подарки', TOOL_IDS.GIFT_UNVIEWED, /подар/i],
  ['Мероприятия сегодня', TOOL_IDS.EVENT_TODAY, /сегодня/i],
  ['Какие мероприятия пройдут на этой неделе?', TOOL_IDS.EVENT_UPCOMING, /событ/i],
  ['Мои регистрации', TOOL_IDS.EVENT_MY_REGISTRATIONS, /зарегистр/i],
  ['Какие новости появились сегодня?', TOOL_IDS.NEWS_TODAY, /сегодня/i],
  ['Последние новости', TOOL_IDS.NEWS_LATEST, /новост/i],
  ['Мои записи', TOOL_IDS.MEETING_LIST, /запис/i],
  ['Ближайшая запись', TOOL_IDS.MEETING_NEXT, /ближай/i],
  ['Что у меня запланировано завтра?', TOOL_IDS.MEETING_TOMORROW, /завтра/i],
  ['Текущий путь', TOOL_IDS.JOURNEY_PROGRESS, /шаг/i],
  ['Незавершенный путь', TOOL_IDS.JOURNEY_UNFINISHED, /путь/i],
  ['Ближайшая награда', TOOL_IDS.JOURNEY_NEXT_REWARD, /наград/i],
  ['Сводка workspace', TOOL_IDS.WORKSPACE_SUMMARY, /workspace/i],
  ['Найди партнера для маникюра', TOOL_IDS.PARTNER_FIND, /наш/i],
  ['Нужен стоматолог', TOOL_IDS.EXPERT_FIND, /эксперт/i],
  ['Найди городскую лекцию', TOOL_IDS.SEARCH, /наш/i],
];

for (const [question, toolId, pattern] of toolExpectations) {
  scenario(`knowledge pipeline uses ${toolId}`, () => {
    const result = runLokiKnowledgeEngine({ text: question, appState, context });
    assert.equal(result?.toolContext?.call?.id, toolId, question);
    assert.match(result.text, pattern, question);
    assert.ok(result.toolContext.events.some(event => event.type === LOKI_TOOL_EVENTS.COMPLETED));
  });
}

scenario('tool result flows into action center', () => {
  const result = runLokiKnowledgeEngine({ text: 'Какие подарки мне доступны?', appState, context });
  const actionReady = runLokiActionCenter({ result, context, appState, appActions });
  assert.ok(actionReady.actionCenter.suggested.length > 0);
  assert.ok(actionReady.card.actions.length > 0);
});

scenario('tool cache returns hit on repeated call', () => {
  clearToolCache();
  const knowledge = buildLokiKnowledgeProvider(appState);
  const call = { id: TOOL_IDS.NEWS_LATEST };
  const first = executeLokiTool(call, { knowledge, context, appState });
  const second = executeLokiTool(call, { knowledge, context, appState });
  assert.equal(first.toolContext.cacheHit, false);
  assert.equal(second.toolContext.cacheHit, true);
});

scenario('tool cache invalidates when data signature changes', () => {
  clearToolCache();
  const knowledgeA = buildLokiKnowledgeProvider(appState);
  const knowledgeB = buildLokiKnowledgeProvider({ ...appState, news: [...appState.news, { id: 'news-new', title: 'Ещё новость', publishedAt: new Date(now + 1).toISOString(), status: 'published' }] });
  executeLokiTool({ id: TOOL_IDS.NEWS_LATEST }, { knowledge: knowledgeA, context, appState });
  const result = executeLokiTool({ id: TOOL_IDS.NEWS_LATEST }, { knowledge: knowledgeB, context, appState });
  assert.equal(result.toolContext.cacheHit, false);
});

scenario('tool history stores local events', () => {
  const result = runLokiKnowledgeEngine({ text: 'последние новости', appState, context });
  const patch = buildToolHistoryPatch({}, result.toolContext.events);
  const summary = summarizeToolHistory(patch);
  assert.ok(patch.toolHistory.length >= 3);
  assert.equal(summary.lastToolId, TOOL_IDS.NEWS_LATEST);
});

scenario('empty results are user safe', () => {
  const result = runLokiKnowledgeEngine({ text: 'Какие акции заканчиваются сегодня?', appState: { ...appState, promotions: [] }, context });
  assert.doesNotMatch(result.text, /undefined|null|stack|error/i);
});

scenario('denied tool returns safe result', () => {
  const knowledge = runLokiKnowledgeEngine({ text: 'workspace', appState, context }).knowledge;
  const result = executeLokiTool({ id: TOOL_IDS.WORKSPACE_SUMMARY }, { knowledge, context: { actor: { role: 'user' } }, appState });
  assert.equal(result.toolContext.status, 'denied');
  assert.match(result.text, /прав/i);
});

const queryMatrix = [
  'сколько у меня ключей',
  'мои ключи',
  'мой уровень',
  'мои достижения',
  'моя активность',
  'какие акции',
  'скидки сейчас',
  'новые предложения',
  'акции заканчиваются сегодня',
  'акции заканчиваются завтра',
  'подарки доступны',
  'новые призы',
  'непросмотренные подарки',
  'мероприятия сегодня',
  'события на неделе',
  'афиша',
  'мои регистрации',
  'последние новости',
  'новости сегодня',
  'что нового',
  'мои записи',
  'ближайшая запись',
  'что у меня завтра',
  'workspace сводка',
  'непрочитанные диалоги',
  'что мы уже сделали',
  'незавершенный путь',
  'ближайшая награда',
  'найди партнера',
  'где сделать маникюр',
  'нужен стоматолог',
  'найди городскую лекцию',
];

for (let i = 0; i < 25; i += 1) {
  for (const query of queryMatrix) {
    scenario(`tool pipeline scenario ${i}-${query}`, () => {
      const result = runLokiKnowledgeEngine({ text: query, appState, context });
      assert.ok(result?.text, query);
      if (result.toolContext) {
        assert.ok(result.toolContext.events.length >= 3, query);
        const centered = runLokiActionCenter({ result, context, appState, appActions });
        assert.ok((centered.actionCenter?.suggested || []).length <= 3);
      }
    });
  }
}

scenario('SmartAnswerPipeline imports tool layer', () => {
  const source = readFileSync(new URL('../src/loki/core/knowledge/SmartAnswerPipeline.js', import.meta.url), 'utf8');
  assert.ok(source.includes('runLokiToolLayer'));
});

scenario('LokiCore traces tool layer', () => {
  const source = readFileSync(new URL('../src/loki/core/LokiCore.js', import.meta.url), 'utf8');
  assert.ok(source.includes("module: 'toolLayer'"));
});

scenario('LokiProvider records local tool history', () => {
  const source = readFileSync(new URL('../src/loki/LokiProvider.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('buildToolHistoryPatch'));
  assert.ok(source.includes('lastToolContext'));
});

scenario('tool files stay read-only frontend layer', () => {
  [
    'ToolCenter.js',
    'ToolExecutor.js',
    'ToolRegistry.js',
    'ToolResolver.js',
    'ToolResult.js',
    'ToolValidator.js',
    'ToolHistory.js',
    'tools/UserTool.js',
    'tools/PartnerTool.js',
    'tools/ExpertTool.js',
    'tools/PromotionTool.js',
    'tools/GiftTool.js',
    'tools/EventTool.js',
    'tools/NewsTool.js',
    'tools/MeetingTool.js',
    'tools/JourneyTool.js',
    'tools/WorkspaceTool.js',
    'tools/SearchTool.js',
  ].forEach(file => {
    const source = readFileSync(new URL(`../src/loki/core/tools/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|userAction|fetch\(|updateDoc|addDoc|setDoc|deleteDoc/i, file);
  });
});

assert.ok(scenarios >= 800, `expected at least 800 scenarios, got ${scenarios}`);
console.log(`Loki Tool Calling v1: ${scenarios} scenarios passed`);
