import assert from 'node:assert/strict';
import { analyzeLead, buildCommunicatorDraft, buildManagerSummary, buildSalesOffer, inferStageFromMessage, prepareLead } from '../server/src/lib/salesAgents.js';

const lead = {
  name: 'Тестовое кафе', category: 'food', local: true, hasOfflinePoint: true,
  activeSocials: true, runsEvents: true, hasRepeatCustomers: true,
  canBringAudience: true, decisionMakerFound: true, website: 'https://example.test',
};

const analysis = analyzeLead(lead);
assert.ok(analysis.score >= 80);
assert.equal(analysis.priority, 'high');
assert.ok(analysis.reasons.length >= 5);

const offer = buildSalesOffer(lead);
assert.match(offer, /Тестовое кафе/);
assert.match(offer, /АПГ/);

const prepared = prepareLead(lead);
assert.equal(prepared.priority, 'high');
assert.ok(prepared.offerDraft.length > 100);

assert.equal(inferStageFromMessage({ direction: 'outbound', text: 'Здравствуйте' }), 'contacted');
assert.equal(inferStageFromMessage({ direction: 'inbound', text: 'Да, давайте встретимся' }), 'meeting');
assert.equal(inferStageFromMessage({ direction: 'inbound', text: 'Спасибо, не интересно' }), 'lost');
assert.equal(inferStageFromMessage({ direction: 'inbound', text: 'Расскажите подробнее' }), 'replied');

const priceReply = buildCommunicatorDraft(lead, [{ direction: 'inbound', text: 'Сколько это стоит?' }], 'reply');
assert.match(priceReply, /условия|стоимость/i);
const followup = buildCommunicatorDraft(lead, [], 'followup');
assert.match(followup, /Напомню|напомню/);

const summary = buildManagerSummary([
  { ...lead, id: '1', stage: 'contacted', priority: 'high' },
  { ...lead, id: '2', stage: 'replied', priority: 'medium' },
  { ...lead, id: '3', stage: 'meeting', priority: 'high' },
  { ...lead, id: '4', stage: 'won', priority: 'high' },
], [
  { direction: 'outbound' }, { direction: 'outbound' }, { direction: 'inbound' },
]);
assert.equal(summary.total, 4);
assert.equal(summary.needsFollowup, 1);
assert.equal(summary.communications.sent, 2);
assert.equal(summary.communications.replies, 1);
assert.ok(summary.conversion.replyRate > 0);
assert.ok(summary.priorities.length > 0);

console.log('sales-ai-agents-test: ok');
