import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { userAction } from '../userApi.js';
import { getPushDeviceId, logPushStage } from '../pushDiagnostics.js';
import { openDeepLink } from './deepLinks.js';

const PENDING_TOKEN = 'apg.native.pending_push_token';
let installed = false;
let currentUser = null;

function tokenMeta(token = '') { return { present: Boolean(token), length: String(token).length }; }

async function bindToken(token) {
  if (!token) return;
  if (!currentUser?.id) {
    await Preferences.set({ key: PENDING_TOKEN, value: token });
    logPushStage('native token pending auth', tokenMeta(token));
    return;
  }
  await userAction('push:registerNative', { userId: String(currentUser.id), deviceId: getPushDeviceId(), token, platform: 'android' });
  await Preferences.remove({ key: PENDING_TOKEN });
  logPushStage('native token bound', { deviceId: getPushDeviceId(), ...tokenMeta(token) });
}

export async function installNativePush() {
  if (!Capacitor.isNativePlatform() || installed) return;
  installed = true;
  await PushNotifications.createChannel({ id: 'messages', name: 'Сообщения', importance: 5, visibility: 1, vibration: true });
  await PushNotifications.createChannel({ id: 'important', name: 'Важное', importance: 4, visibility: 1, vibration: true });
  await PushNotifications.createChannel({ id: 'updates', name: 'Новости и обновления', importance: 3, visibility: 1 });
  await PushNotifications.addListener('registration', ({ value }) => bindToken(value).catch(error => logPushStage('native token bind failed', { code: error?.code || 'BIND_FAILED' })));
  await PushNotifications.addListener('registrationError', error => logPushStage('native registration failed', { code: error?.code || 'REGISTRATION_FAILED' }));
  await PushNotifications.addListener('pushNotificationReceived', notification => {
    window.dispatchEvent(new CustomEvent('apg:native_push_received', { detail: { id: notification.id, data: notification.data || {} } }));
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    openDeepLink(notification.data?.deepLink || notification.data?.url || notification.data?.actionUrl || '/notifications');
  });
}

export async function registerNativePush(user, { requestPermission = true } = {}) {
  currentUser = user || null;
  await installNativePush();
  let permission = await PushNotifications.checkPermissions();
  if (requestPermission && permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') throw Object.assign(new Error(`Notification permission: ${permission.receive}`), { code: 'PUSH_PERMISSION_DENIED' });
  const pending = await Preferences.get({ key: PENDING_TOKEN });
  if (pending.value) await bindToken(pending.value);
  await PushNotifications.register();
  return { result: { deviceId: getPushDeviceId(), native: true }, diagnostics: { platform: 'Android native', permission: permission.receive } };
}

export async function unregisterNativePush(userId) {
  if (!Capacitor.isNativePlatform()) return;
  await userAction('push:unregisterNative', { userId: String(userId || ''), deviceId: getPushDeviceId() }).catch(() => {});
  currentUser = null;
  await Preferences.remove({ key: PENDING_TOKEN });
}
