import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const userApp = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/HomePanelV2.jsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/components/KeyHistoryModal.jsx', import.meta.url), 'utf8');
const tasks = readFileSync(new URL('../src/TasksPage.jsx', import.meta.url), 'utf8');
const rewardsPage = readFileSync(new URL('../src/RewardsPage.jsx', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
const rewards = readFileSync(new URL('../server-shared/reward-service.js', import.meta.url), 'utf8');

assert.match(actions, /actionEconomyHistory/);
assert.match(actions, /assertOwn\(actor, req\.body\?\.userId \|\| actor\.userId\)/);
assert.match(actions, /action === 'economy:history'/);
assert.match(actions, /keys: -cost/);
assert.match(rewards, /targetUserId: context\.userId/);
assert.match(rewards, /accountCore\.awardVisit/);
assert.match(rewards, /balanceAfter: awarded\.operation\.balanceAfter/);
assert.match(userApp, /rewardBelongsToCurrentUser/);
assert.match(userApp, /document\.addEventListener\('visibilitychange', handleResume\)/);
assert.match(userApp, /<KeyHistoryModal/);
assert.match(home, /onOpenKeyHistory/);
assert.match(profile, /onOpenKeyHistory/);
assert.match(modal, /userAction\('economy:history'/);
assert.match(modal, /История ключей/);
assert.match(tasks, /onOpenKeyHistory/);
assert.match(rewardsPage, /onOpenKeyHistory/);
assert.match(userApp, /pushManager\.getSubscription\(\)/);

console.log('key-history-regression-test: ok');
