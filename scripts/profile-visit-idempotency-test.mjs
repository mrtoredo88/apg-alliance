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
assert.doesNotMatch(profileSync, /awardDailyBonus/, 'Account Core must not award a launch key during profile sync');
assert.doesNotMatch(profile, /\+1 ключ за вход/, 'profile must not advertise keys for launching the app');
assert.doesNotMatch(userApp, /Ежедневный бонус — \+1 ключ/, 'startup must not show a launch reward');
assert.match(economy, /WHERE idempotency_key = \$1 LIMIT 1/, 'visit rewards must replay by idempotency key');
assert.match(economy, /apg_economy_visit_rewards/, 'visit rewards must keep a durable uniqueness record');
assert.match(profile, /label: 'Поделиться'/, 'Referrals entry must be renamed without changing its handler');
assert.match(profile, /id: 'notifications'/, 'profile must keep the notifications action');
assert.match(profile, /ownedPartner && \{ id: 'partner'/, 'partner cabinet must remain role-gated');
assert.doesNotMatch(profile, />↗<\/GlassButton>/, 'profile hero must not render the standalone top-right arrow');

console.log('Profile visit idempotency regression test passed');
