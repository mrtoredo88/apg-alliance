import assert from 'node:assert/strict';
import { enrichLead, nextBestAction, scoreLead, summarizePipeline } from '../src/salesAi/salesAgentCore.js';

const score = scoreLead({ local: true, hasOfflinePoint: true, activeSocials: true });
assert.ok(score.score >= 0 && score.score <= 100, 'score must be within 0..100');

const lead = enrichLead({
  name: 'Тестовый гастроцентр',
  category: 'food',
  city: 'Зеленоград',
  local: true,
  hasOfflinePoint: true,
  activeSocials: true,
  runsEvents: true,
  hasRepeatCustomers: true,
  canBringAudience: true,
  decisionMakerFound: true,
  website: 'https://example.test',
});

assert.equal(lead.priority, 'high');
assert.ok(lead.offerDraft.includes('АПГ'));
assert.equal(nextBestAction(lead), 'Проверить данные и подтвердить оценку');

const summary = summarizePipeline([
  lead,
  { ...lead, id: '2', stage: 'contacted' },
  { ...lead, id: '3', stage: 'replied' },
  { ...lead, id: '4', stage: 'meeting' },
  { ...lead, id: '5', stage: 'won' },
]);

assert.deepEqual(
  { total: summary.total, contacted: summary.contacted, replied: summary.replied, meetings: summary.meetings, won: summary.won },
  { total: 5, contacted: 4, replied: 3, meetings: 2, won: 1 },
);

console.log('AI sales department core: OK');
