import assert from 'node:assert/strict';
import { runSalesScout } from '../server/src/lib/salesScout.js';
import { analyzeLead, buildSalesOffer, buildCommunicatorDraft, inferStageFromMessage, buildManagerSummary } from '../server/src/lib/salesAgents.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.TWOGIS_API_KEY;

try {
  process.env.TWOGIS_API_KEY = 'pipeline-test-key';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      result: {
        items: [{
          id: '2gis-restaurant-1',
          name: 'Тестовый гастроцентр',
          full_address_name: 'Москва, Зеленоград, Крюково',
          point: { lat: 55.98, lon: 37.18 },
          rubrics: [{ name: 'Ресторан' }, { name: 'Гастрономический центр' }],
          contact_groups: [{ contacts: [
            { type: 'website', value: 'example.test' },
            { type: 'phone', value: '+7 999 000-00-00' },
          ] }],
        }],
      },
    }),
  });

  // 1. Разведчик
  const scout = await runSalesScout({ city: 'Зеленоград', district: 'Крюково', category: 'food', limit: 10 });
  assert.equal(scout.provider, '2gis');
  assert.equal(scout.candidates.length, 1);
  const candidate = scout.candidates[0];
  assert.equal(candidate.name, 'Тестовый гастроцентр');
  assert.ok(candidate.evidence.length >= 4);

  // 2. Аналитик
  const leadInput = {
    ...candidate,
    local: true,
    hasOfflinePoint: true,
    activeSocials: true,
    runsEvents: true,
    hasRepeatCustomers: true,
    canBringAudience: true,
    decisionMakerFound: false,
  };
  const analysis = analyzeLead(leadInput);
  assert.ok(analysis.score >= 80);
  assert.equal(analysis.priority, 'high');

  // 3. Продажник
  const lead = { ...leadInput, ...analysis, stage: 'qualified' };
  const offer = buildSalesOffer(lead);
  assert.match(offer, /Тестовый гастроцентр/);
  assert.match(offer, /АПГ/);

  // 4. Коммуникатор
  const outbound = { id: 'm1', direction: 'outbound', channel: 'manual', text: offer };
  assert.equal(inferStageFromMessage(outbound), 'contacted');
  const inbound = { id: 'm2', direction: 'inbound', channel: 'manual', text: 'Да, интересно. Давайте встретимся и обсудим.' };
  assert.equal(inferStageFromMessage(inbound), 'meeting');
  const replyDraft = buildCommunicatorDraft({ ...lead, stage: 'meeting' }, [outbound, inbound], 'reply');
  assert.match(replyDraft, /встрет|созвон/i);

  // 5. Руководитель
  const summary = buildManagerSummary(
    [{ ...lead, stage: 'meeting', offerDraft: offer }],
    [outbound, inbound],
  );
  assert.equal(summary.total, 1);
  assert.equal(summary.stages.meeting, 1);
  assert.equal(summary.communications.sent, 1);
  assert.equal(summary.communications.replies, 1);
  assert.equal(summary.conversion.replyRate, 100);
  assert.equal(summary.conversion.meetingRate, 100);

  console.log(JSON.stringify({
    status: 'PASS',
    pipeline: ['scout', 'analyst', 'salesperson', 'communicator', 'manager'],
    score: analysis.score,
    stage: 'meeting',
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.TWOGIS_API_KEY;
  else process.env.TWOGIS_API_KEY = originalKey;
}
