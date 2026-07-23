import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { becamePublicContent, isPublicContent } from '../server/src/lib/contentNotifications.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

assert.equal(isPublicContent({ active: true }), true, 'active content is public');
assert.equal(isPublicContent({ active: true, status: 'archived' }), false, 'archived content is not public');
assert.equal(isPublicContent({ status: 'published' }), true, 'published status is public');
assert.equal(isPublicContent({ active: false, status: 'draft' }), false, 'draft content is not public');
assert.equal(
  becamePublicContent({ active: false, status: 'draft' }, { active: true, status: 'published' }),
  true,
  'draft-to-published transition is detected',
);
assert.equal(
  becamePublicContent({ active: true, status: 'published' }, { active: true, status: 'published' }),
  false,
  'saving published content does not create a duplicate notification',
);

const contentPipeline = read('server/src/lib/contentNotifications.js');
const pushRoute = read('server/src/routes/send-push.js');
const adminActions = read('server/src/routes/admin-actions.js');
const userActions = read('server/src/routes/user-actions.js');
const userApp = read('src/UserApp.jsx');
const pkg = JSON.parse(read('package.json'));

for (const category of ['news', 'events', 'partners', 'experts']) {
  assert.match(contentPipeline, new RegExp(`${category}:\\s*\\{[\\s\\S]*category:\\s*'${category}'`), `${category} has a notification category`);
}

assert.match(adminActions, /dispatchPublishedContentNotification\(db, request, 'news'/, 'news publication dispatch is wired');
assert.match(adminActions, /\['partners', 'experts', 'events'\]\.includes\(resource\)[\s\S]*dispatchPublishedContentNotification\(db, request, resource/, 'directory publication dispatch is wired');
assert.match(contentPipeline, /content_\$\{resource\}_/, 'content notifications have deterministic ids');
assert.match(contentPipeline, /already_dispatched/, 'already delivered content is not sent twice');
assert.match(pushRoute, /\[400, 403, 404, 410\]\.includes\(e\.statusCode\)/, 'broken web push subscriptions are cleaned');
assert.match(pushRoute, /notifications\.sendMessage/, 'content notifications support VK delivery');
assert.match(pushRoute, /\/api\/send-push\/retry-pending/, 'pending content notifications have a retry endpoint');
assert.match(pushRoute, /stale_pending_notification/, 'stale pending notifications are not sent late');
assert.match(pushRoute, /reason: 'category_disabled'/, 'direct delivery respects category preferences');
assert.match(userActions, /sendDialogVkPush/, 'message notifications support VK delivery');
assert.match(userActions, /deadFcmTokens[\s\S]*deadWebSubscriptions/, 'message delivery cleans broken subscriptions');
assert.match(userApp, /Согласие без подписки не является работающим push-каналом/, 'UI does not report consent-only users as push-enabled');
assert.equal(pkg.scripts['test:notification-delivery'], 'node scripts/notification-delivery-pipeline-test.mjs');

console.log('notification delivery pipeline PASS');
