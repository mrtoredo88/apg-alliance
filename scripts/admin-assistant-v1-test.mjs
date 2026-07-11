import assert from 'node:assert/strict';
import { buildAdminContext, ADMIN_SECTION_TITLES } from '../src/adminAssistant/AdminContextEngine.js';
import { answerAdminCommand, buildAdminInsights, sectionKnowledge } from '../src/adminAssistant/AdminAssistantEngine.js';

const now = new Date('2026-07-11T12:00:00Z');
const context = buildAdminContext({
  activeTab: 'partners',
  role: 'admin',
  permissions: ['partners:read'],
  filters: { partners: 'all' },
  search: '',
  selected: { partnerId: 'p1' },
  loadedAt: now.toISOString(),
  data: {
    partners: [{ id: 'p1', name: 'Без логотипа', description: '', createdAt: now.toISOString() }, { id: 'p2', name: 'Полный', logoUrl: 'logo', description: 'Описание', vk: 'vk' }],
    experts: [{ id: 'e1', name: 'Эксперт' }],
    events: [{ id: 'v1', title: 'Событие', startAt: '2026-07-12T10:00:00Z', endAt: '2026-07-12T12:00:00Z' }, { id: 'v2', title: 'Пересечение', startAt: '2026-07-12T11:00:00Z', endAt: '2026-07-12T13:00:00Z' }],
    news: [{ id: 'n1', title: 'Черновик', status: 'draft' }],
    users: [{ id: 'u1', registrationCompleted: false }],
    comments: [{ id: 'c1', status: 'pending' }],
    errors: [{ id: 'r1', message: 'Auth token failed', severity: 'critical' }],
  },
});

assert.equal(context.page, 'Партнёры');
assert.equal(context.selected.partnerId, 'p1');
const insights = buildAdminInsights(context, now);
assert.equal(insights.current.find(row => row.id === 'partners.no_logo').count, 1);
assert.equal(insights.all.find(row => row.id === 'events.overlap').count, 1);
assert.equal(insights.all.find(row => row.id === 'errors.auth').count, 1);
assert.equal(insights.summary.find(row => row.id === 'summary.users').count, 0);

const partnerCommand = answerAdminCommand('Покажи партнёров без логотипов', context, insights);
assert.match(partnerCommand.text, /1/);
assert.equal(partnerCommand.actions[0].tab, 'partners');
const unknown = answerAdminCommand('Скажи то, чего нет в данных', context, insights);
assert.match(unknown.text, /Не могу подтвердить/);

for (const section of Object.keys(ADMIN_SECTION_TITLES)) assert.ok(sectionKnowledge(section).description.includes('загруженные данные'));
for (const role of ['owner', 'super_admin', 'admin', 'editor', 'moderator', 'analyst']) {
  assert.equal(buildAdminContext({ activeTab: 'dashboard', role, data: {} }).role, role);
}

console.log(`Admin Assistant V1: ${Object.keys(ADMIN_SECTION_TITLES).length} sections, 6 roles, tests passed`);
