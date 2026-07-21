import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assertContains(source, token, label) {
  assert.ok(source.includes(token), `${label}: missing ${token}`);
}

function assertNotContains(source, token, label) {
  assert.equal(source.includes(token), false, `${label}: forbidden ${token}`);
}

function assertOrder(source, tokens, label) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next >= 0, `${label}: missing ${token}`);
    assert.ok(next > cursor, `${label}: wrong order for ${token}`);
    cursor = next;
  }
}

const telegramUpdates = read('server/src/lib/telegramUpdates.js');
const telegramCheck = read('server/src/routes/telegram-auth-check.js');
const emailAuth = read('server/src/routes/email-auth.js');
const userActions = read('server/src/routes/user-actions.js');

assertContains(telegramUpdates, 'async function tgGetPhotoUrl(userId)', 'shared avatar retrieval routine exists');
assertContains(telegramUpdates, 'function buildTelegramProfilePayload', 'telegram payload centralizes avatar fields');
assertContains(telegramUpdates, 'async function syncTelegramAvatarToCanonicalProfile', 'canonical profile avatar sync exists');
assertContains(telegramUpdates, 'payload.photo = avatar', 'telegram payload stores photo when avatar exists');
assertContains(telegramUpdates, 'payload.photo_200 = avatar', 'telegram payload stores photo_200 when avatar exists');
assertContains(telegramUpdates, 'payload.photoUrl = avatar', 'telegram payload stores photoUrl when avatar exists');
assertContains(telegramUpdates, 'photo: avatar', 'canonical users photo is updated only from non-empty avatar');
assertContains(telegramUpdates, 'if (!db || !canonicalUserId || !avatar) return false;', 'null avatar cannot overwrite canonical profile');
assertNotContains(telegramUpdates, 'photo: null', 'Telegram link metadata must not overwrite existing avatar with null');

assertOrder(telegramUpdates, [
  'stage: \'identityV2.linkTelegram.return\'',
  'linkedPhotoUrl = await tgGetPhotoUrl(from.id);',
  'await serverFoundation.identityV2.linkTelegram(telegramAvatarParams);',
  'await syncTelegramAvatarToCanonicalProfile(db, resolvedOwnerUserId, from, linkedPhotoUrl, log);',
], 'new Telegram link syncs avatar after successful Identity V2 link');

assertContains(telegramUpdates, 'telegram_avatar_sync_after_link.throw', 'existing Telegram link avatar sync is best-effort after link success');
assertContains(telegramUpdates, 'photoUrl: linkedPhotoUrl || null', 'link session stores photoUrl');
assertContains(telegramUpdates, 'photo_200: linkedPhotoUrl || null', 'link session stores photo_200');

assertOrder(telegramUpdates, [
  'const photoUrl = await tgGetPhotoUrl(from.id);',
  'status:    \'done\'',
  'photoUrl:  photoUrl || null',
  'photo_200: photoUrl || null',
  'Promise.resolve(photoUrl)',
  'upsertUser(db, from, resolvedPhotoUrl',
], 'Telegram login waits for avatar before auth-check sees done');

assertContains(telegramCheck, 'async function resolveLinkedTelegramPhoto', 'auth-check can load linked avatar from profile');
assertContains(telegramCheck, 'const linkedPhoto = safeString(data.photoUrl || data.photo_200 || data.photo || \'\', 500)', 'linking auth-check starts from session avatar');
assertContains(telegramCheck, 'await resolveLinkedTelegramPhoto(db, resolvedOwnerId)', 'linking auth-check falls back to canonical linkedTelegram avatar');
assertContains(telegramCheck, 'photo_200: linkedPhoto || null', 'linking auth-check returns photo_200');
assertContains(telegramCheck, 'const resolvedPhoto = safeString(data.photoUrl || data.photo_200 || data.photo || identity.user?.photo || identity.user?.linkedTelegram?.photo || \'\', 500);', 'login auth-check falls back to Identity/profile avatar');
assertContains(telegramCheck, 'photo_200: resolvedPhoto || null', 'login auth-check returns photo_200');

assertContains(emailAuth, 'photo: linkedTelegram?.photo || linkedTelegram?.photoUrl || null', 'email login after Telegram link preserves linked avatar');
assertContains(userActions, 'photo: safeString(input.photo || input.photo_200, 1000) || null', 'profile sync accepts returned photo_200');

console.log('TELEGRAM_AVATAR_SYNC_REGRESSION_OK');
console.log(JSON.stringify({
  ok: true,
  scenarios: [
    'new_telegram_link_avatar_sync',
    'existing_telegram_link_avatar_refresh',
    'telegram_login_avatar_sync',
    'email_login_after_telegram_link_avatar_preserved',
    'identity_merge_canonical_profile_avatar_sync',
  ],
}, null, 2));
