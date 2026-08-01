import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { userAction } from '../userApi.js';
import { getPushDeviceId, logPushStage } from '../pushDiagnostics.js';

const RuStorePush = registerPlugin('RuStorePush');
const PENDING_TOKEN = 'apg.native.pending_rustore_push_token';
let currentUser = null;

function tokenMeta(token = '') { return { present: Boolean(token), length: String(token).length, provider: 'rustore' }; }

async function bindToken(token) {
  if (!token) return;
  if (!currentUser?.id) {
    await Preferences.set({ key: PENDING_TOKEN, value: token });
    logPushStage('rustore token pending auth', tokenMeta(token));
    return;
  }
  await userAction('push:registerNative', { userId: String(currentUser.id), deviceId: getPushDeviceId(), token, platform: 'android', provider: 'rustore' });
  await Promise.all([Preferences.remove({ key: PENDING_TOKEN }), RuStorePush.clearPendingToken().catch(() => {})]);
  logPushStage('rustore token bound', { deviceId: getPushDeviceId(), ...tokenMeta(token) });
}

export async function installNativePush() {
  if (!Capacitor.isNativePlatform()) return;
  const [nativePending, webPending] = await Promise.all([RuStorePush.getPendingToken().catch(() => ({ value: '' })), Preferences.get({ key: PENDING_TOKEN })]);
  const token = nativePending?.value || webPending.value;
  if (token) await bindToken(token);
}

export async function registerNativePush(user, { requestPermission = true } = {}) {
  currentUser = user || null;
  let permission = await RuStorePush.checkPermissions();
  if (requestPermission && permission.receive !== 'granted') permission = await RuStorePush.requestPermissions();
  if (permission.receive !== 'granted') throw Object.assign(new Error(`Notification permission: ${permission.receive}`), { code: 'PUSH_PERMISSION_DENIED' });
  const { value } = await RuStorePush.getToken();
  await bindToken(value);
  return { result: { deviceId: getPushDeviceId(), native: true, provider: 'rustore' }, diagnostics: { platform: 'Android native', provider: 'rustore', permission: permission.receive } };
}

export async function unregisterNativePush(userId) {
  if (!Capacitor.isNativePlatform()) return;
  await userAction('push:unregisterNative', { userId: String(userId || ''), deviceId: getPushDeviceId(), provider: 'rustore' }).catch(() => {});
  currentUser = null;
  await Promise.all([Preferences.remove({ key: PENDING_TOKEN }), RuStorePush.deleteToken().catch(() => {})]);
}
