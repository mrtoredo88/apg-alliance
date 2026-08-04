import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync('src/ProfilePanel.jsx', 'utf8');
const userApp = readFileSync('src/UserApp.jsx', 'utf8');
const actions = readFileSync('server/src/routes/user-actions.js', 'utf8');
const economy = readFileSync('server/src/apg/account/repositories/EconomyRepository.js', 'utf8');

const profileSync = actions.slice(
  actions.indexOf('async function actionProfileSync'),
  actions.indexOf('async function actionProfileDelete'),
);

assert.doesNotMatch(profileSync, /getEconomyReward\('daily_activity'\)/, 'profile sync must not award a launch key');
assert.match(profileSync, /awardDailyBonus/, 'Account Core should award the daily activity key during authenticated profile sync');
assert.match(profileSync, /timeZone:\s*'Europe\/Moscow'/, 'daily activity day should use the Moscow calendar date');
assert.doesNotMatch(profile, /\+1 ключ за вход/, 'profile must not advertise keys for launching the app');
assert.match(userApp, /Ежедневный бонус — \+1 ключ/, 'startup should confirm a newly awarded daily key');
assert.match(economy, /WHERE idempotency_key = \$1 LIMIT 1/, 'visit rewards must replay by idempotency key');
assert.match(economy, /apg_economy_visit_rewards/, 'visit rewards must keep a durable uniqueness record');
assert.match(economy, /metadata->>'dateKey' = \$4/, 'visit rewards must be unique per Moscow calendar day');
assert.match(economy, /const resolvedUserId = row\.user_id/, 'visit rewards must be written to the canonical Account Core profile');
assert.doesNotMatch(economy, /Boolean\(legacyScans\?\./, 'historic scanned flags must not block a new-day reward');
assert.match(economy, /ON CONFLICT \(user_id, subject_type, subject_id\)/, 'latest visit reward marker must be updated on a later day');
assert.match(profile, /label: 'Поделиться'/, 'Referrals entry must be renamed without changing its handler');
assert.match(profile, /id: 'notifications'/, 'profile must keep the notifications action');
assert.match(profile, /ownedPartner && \{ id: 'partner'/, 'partner cabinet must remain role-gated');
assert.doesNotMatch(profile, />↗<\/GlassButton>/, 'profile hero must not render the standalone top-right arrow');

console.log('Profile visit idempotency regression test passed');
