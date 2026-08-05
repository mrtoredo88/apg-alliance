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
const constants = read('src/constants.js');
const pushDiagnostics = read('src/pushDiagnostics.js');
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
assert.match(userActions, /deadRuStoreTokens[\s\S]*deadWebSubscriptions/, 'message delivery cleans broken RuStore and web subscriptions');
assert.match(userActions, /sendRuStorePush/, 'message notifications support RuStore delivery');
assert.match(userApp, /browser's current PushManager[\s\S]*subscription is authoritative/, 'installed PWA uses its actual device subscription as the notification source');
assert.doesNotMatch(userApp, /hasStoredPushChannel[\s\S]{0,800}setNotifEnabled\(false\)/, 'a lagging server profile cannot disable a working PWA subscription');
assert.match(constants, /WEB_PUSH_VAPID_PUBLIC_KEY = 'BIY6fBBaGoouByjJosD9BKLXBRVoChXSpwgkXTwDJZs_gykj9gr8Fe5LVnTKCs8hseG5iJGLR-rqprfbS3Y3YLs'/, 'frontend uses the active backend VAPID public key');
assert.match(pushDiagnostics, /registeredVapidKey !== WEB_PUSH_VAPID_PUBLIC_KEY[\s\S]*?subscription\.unsubscribe\(\)[\s\S]*?subscription rotated/, 'stale subscriptions are rotated after a VAPID key change');
const webPushPermissionHandler = userApp.slice(
  userApp.indexOf('const requestWebPushPermission'),
  userApp.indexOf('const handleToggleNotifications'),
);
assert.doesNotMatch(webPushPermissionHandler, /localStorage\.removeItem\('apg_notif_enabled'\);[\s\S]*?setNotifEnabled\(false\)/, 'a transient registration failure does not erase an already configured device');
assert.match(userApp, /push:disableNotifications/, 'profile notification switch disables every account push channel on the server');
assert.match(userApp, /Разрешение на уведомления заблокировано[\s\S]*Сервис уведомлений ещё загружается/, 'push failures explain the actual browser or service-worker cause');
assert.equal(pkg.scripts['test:notification-delivery'], 'node scripts/notification-delivery-pipeline-test.mjs');

console.log('notification delivery pipeline PASS');
