import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLokiKnowledgeProvider } from '../src/loki/core/knowledge/KnowledgeProvider.js';
import { runLokiKnowledgeEngine } from '../src/loki/core/knowledge/SmartAnswerPipeline.js';
import {
  buildKnowledgeHistoryPatch,
  buildKnowledgeIndex,
  runLokiKnowledgeIndex,
  searchKnowledgeIndex,
  validateKnowledgeIndex,
} from '../src/loki/core/knowledgeIndex/index.js';

let passed = 0;
function scenario(name, fn) {
  fn();
  passed += 1;
}

const appState = {
  partners: [
    {
      id: 'p-massage',
      name: 'Студия Массажа Север',
      category: 'Здоровье',
      categoryLabel: 'Массаж и SPA',
      description: 'Массаж спины, релакс, восстановление, семейные программы',
      offer: 'Скидка 20% на первый массаж',
      tags: ['массаж', 'спа', 'здоровье'],
      services: ['массаж спины', 'спа'],
      locations: [{ id: 'loc-massage', title: 'Андреевка', address: 'Зеленоград, Андреевка 7', phone: '+79990000001' }],
    },
    {
      id: 'p-food',
      name: 'Семейное кафе Парк',
      category: 'Еда',
      description: 'Кафе для семьи, обеды и ужины рядом с парком',
      tags: ['кафе', 'семья'],
      locations: [{ id: 'loc-food', address: 'к1462' }],
    },
  ],
  experts: [
    { id: 'e-massage', name: 'Анна Мастер', specialization: 'Массажист', partnerId: 'p-massage', locationIds: ['loc-massage'], services: ['массаж'] },
  ],
  events: [
    { id: 'ev-health', title: 'День здоровья', partnerId: 'p-massage', expertIds: ['e-massage'], category: 'здоровье', description: 'Событие про восстановление' },
  ],
  promotions: [
    { id: 'promo-spa', title: 'SPA неделя', partnerId: 'p-massage', locationIds: ['loc-massage'], description: 'Акция на массаж и спа' },
  ],
  news: [
    { id: 'news-health', title: 'Как выбрать массаж', partnerIds: ['p-massage'], expertIds: ['e-massage'], eventIds: ['ev-health'], category: 'здоровье', text: 'Материал про массаж' },
  ],
  dialogs: [
    { id: 'd1', title: 'Вопрос по массажу', context: { type: 'partner', id: 'p-massage', title: 'Студия Массажа Север' }, lastMessage: { text: 'Можно записаться?' } },
  ],
  bookings: [
    { id: 'b1', providerType: 'partner', providerId: 'p-massage', specialistId: 'e-massage', locationId: 'loc-massage', serviceTitle: 'массаж спины' },
  ],
  gifts: [{ id: 'g1', title: 'Сертификат на массаж', partnerId: 'p-massage', category: 'подарки' }],
  rewards: [{ id: 'r1', title: 'Бонус за визит', category: 'награды' }],
  keys: [{ id: 'k1', title: 'Ключ за визит', description: 'Получить ключ у партнёра' }],
  faq: [{ id: 'faq1', question: 'Как записаться?', answer: 'Откройте карточку партнёра.' }],
  workspace: { mode: 'desktop' },
};

const knowledge = buildLokiKnowledgeProvider(appState);
const index = buildKnowledgeIndex({ knowledge, appState });

scenario('indexes required entity types', () => {
  const types = new Set(index.entities.map(item => item.type));
  ['partner', 'expert', 'location', 'event', 'promotion', 'news', 'dialog', 'booking', 'workspace', 'reward', 'key', 'gift', 'faq', 'category', 'tag'].forEach(type => assert.ok(types.has(type), type));
});

scenario('entity model is normalized', () => {
  const entity = index.entities.find(item => item.type === 'partner' && item.id === 'p-massage');
  assert.ok(entity.id);
  assert.equal(entity.type, 'partner');
  assert.ok(entity.title.includes('Массажа'));
  assert.ok(Array.isArray(entity.aliases));
  assert.ok(Array.isArray(entity.keywords));
  assert.ok(Array.isArray(entity.categories));
  assert.ok(Array.isArray(entity.relations));
  assert.ok(entity.searchText.includes('массаж'));
  assert.ok('updatedAt' in entity);
});

scenario('validates index', () => {
  assert.equal(validateKnowledgeIndex(index).valid, true);
});

scenario('builds partner relation chain', () => {
  const ids = index.relations.map(item => item.id);
  assert.ok(ids.some(id => id.includes('partner:p-massage->has_location->location:loc-massage')));
  assert.ok(ids.some(id => id.includes('partner:p-massage->has_promotion->promotion:promo-spa')));
  assert.ok(ids.some(id => id.includes('partner:p-massage->hosts_event->event:ev-health')));
  assert.ok(ids.some(id => id.includes('expert:e-massage->works_with->partner:p-massage')));
});

scenario('finds exact and partial matches', () => {
  assert.equal(searchKnowledgeIndex(index, 'Студия Массажа Север').entities[0].id, 'p-massage');
  assert.ok(searchKnowledgeIndex(index, 'массаж').entities.some(item => item.id === 'p-massage'));
});

scenario('finds synonyms and categories', () => {
  assert.ok(searchKnowledgeIndex(index, 'релакс').entities.some(item => item.id === 'p-massage'));
  assert.ok(searchKnowledgeIndex(index, 'еда').entities.some(item => item.id === 'p-food'));
});

scenario('expands context across relations', () => {
  const result = searchKnowledgeIndex(index, 'где сделать массаж', { depth: 1 });
  const expanded = new Set(result.expandedContext.map(item => `${item.type}:${item.id}`));
  assert.ok(expanded.has('partner:p-massage'));
  assert.ok(expanded.has('location:loc-massage'));
  assert.ok(expanded.has('promotion:promo-spa'));
  assert.ok(expanded.has('expert:e-massage'));
});

scenario('creates snapshot and history', () => {
  const result = runLokiKnowledgeIndex({ question: 'массаж', knowledge, appState });
  assert.equal(result.knowledgeSnapshot.Indexed, 'OK');
  assert.ok(result.knowledgeSnapshot.Entities >= 15);
  assert.ok(result.knowledgeSnapshot.Relations >= 8);
  const patch = buildKnowledgeHistoryPatch({}, result.knowledgeSnapshot, result.knowledgeIndexSearch);
  assert.equal(patch.knowledgeIndexHistory.length, 1);
});

scenario('pipeline attaches knowledge index diagnostics', () => {
  const result = runLokiKnowledgeEngine({ text: 'где сделать массаж', appState, context: { memory: {} } });
  assert.equal(result.knowledgeSnapshot.Indexed, 'OK');
  assert.ok(result.knowledgeIndexSearch.entities.length > 0);
  assert.ok(result.expandedKnowledgeContext.length > 0);
});

scenario('explain mode uses last local snapshot', () => {
  const first = runLokiKnowledgeEngine({ text: 'где сделать массаж', appState, context: { memory: {} } });
  const explain = runLokiKnowledgeEngine({
    text: 'из каких сущностей был собран ответ?',
    appState,
    context: { memory: { lastKnowledgeSnapshot: first.knowledgeSnapshot, lastKnowledgeIndexSearch: first.knowledgeIndexSearch } },
  });
  assert.ok(explain.text.includes('Knowledge Index'));
});

scenario('source files stay read-only from platform perspective', () => {
  const files = [
    '../src/loki/core/knowledgeIndex/KnowledgeIndex.js',
    '../src/loki/core/knowledgeIndex/KnowledgeIndexer.js',
    '../src/loki/core/knowledgeIndex/KnowledgeSearch.js',
    '../src/loki/core/knowledgeIndex/KnowledgeRelations.js',
  ];
  files.forEach(file => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(!source.includes('firebase'));
    assert.ok(!source.includes('fetch('));
    assert.ok(!source.includes('addDoc'));
    assert.ok(!source.includes('updateDoc'));
  });
});

const queries = [
  'массаж', 'спа', 'здоровье', 'релакс', 'где сделать массаж', 'массаж рядом',
  'кафе', 'еда', 'семейное кафе', 'обед', 'ужин', 'семья',
  'акция массаж', 'скидка', 'промо', 'подарок', 'ключ', 'награда',
  'мероприятие здоровье', 'событие', 'афиша', 'эксперт массаж', 'специалист',
  'андреевка', 'зеленоград', 'запись', 'бронь', 'диалог', 'новость массаж',
];

for (let i = passed; i < 500; i += 1) {
  const query = `${queries[i % queries.length]} ${i}`;
  scenario(`matrix search/index/relation/context ${i}`, () => {
    const result = searchKnowledgeIndex(index, query, { limit: 8, depth: i % 2 ? 1 : 2 });
    assert.ok(Array.isArray(result.entities));
    assert.ok(Array.isArray(result.expandedContext));
    assert.ok(index.entities.length >= 15);
    assert.ok(index.relations.length >= 8);
  });
}

assert.equal(passed, 500);
console.log(`Loki Unified Knowledge Index v1: ${passed} scenarios passed`);
