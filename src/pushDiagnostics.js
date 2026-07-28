import { WEB_PUSH_VAPID_PUBLIC_KEY } from './constants.js';
import { userAction } from './userApi.js';
import { getDeviceInfo } from './diagnostics.js';

const DEVICE_ID_KEY = 'apg_push_device_id';
const PUSH_LOG_KEY = 'apg_push_register_log';

function safeNow() {
  return new Date().toISOString();
}

function endpointInfo(endpoint = '') {
  const value = String(endpoint || '');
  if (!value) return { host: '', length: 0 };
  try {
    return { host: new URL(value).host, length: value.length };
  } catch {
    return { host: value.slice(0, 24), length: value.length };
  }
}

function readLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUSH_LOG_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPushDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = `push_${crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `push_${Date.now()}`;
  }
}

export function logPushStage(stage, detail = {}) {
  const entry = {
    at: safeNow(),
    stage,
    ...detail,
  };
  try {
    const next = [entry, ...readLog()].slice(0, 24);
    localStorage.setItem(PUSH_LOG_KEY, JSON.stringify(next));
  } catch {}
  return entry;
}

export function getPushRegistrationLog() {
  return readLog();
}

export function isStandalonePwa() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator?.standalone === true
  );
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function getReadyServiceWorker(timeoutMs = 8000) {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    window.__swRegPromise ?? navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function getCurrentPushSubscription() {
  const registration = await getReadyServiceWorker();
  if (!registration?.pushManager) return null;
  return registration.pushManager.getSubscription();
}

export async function collectPushDiagnostics(user = {}) {
  const deviceId = getPushDeviceId();
  const deviceInfo = getDeviceInfo();
  const notificationSupported = 'Notification' in window;
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const pushManagerSupported = 'PushManager' in window;
  const permission = notificationSupported ? Notification.permission : 'unsupported';
  const registration = await getReadyServiceWorker();
  const subscription = registration?.pushManager ? await registration.pushManager.getSubscription().catch(() => null) : null;
  const json = subscription?.toJSON?.() || null;
  const endpoint = endpointInfo(json?.endpoint);
  const registered = Array.isArray(user?.webPushSubscriptions)
    ? user.webPushSubscriptions.some(item => item?.endpoint === json?.endpoint)
    : false;
  const devices = user?.pushDevices && typeof user.pushDevices === 'object' ? user.pushDevices : {};
  const currentDevice = devices[deviceId] || null;
  return {
    deviceId,
    platform: isStandalonePwa() ? 'PWA standalone' : 'Browser tab',
    device: deviceInfo.device,
    os: deviceInfo.os,
    browser: deviceInfo.browser,
    appVersion: deviceInfo.appVersion,
    notificationPermission: permission,
    notificationSupported,
    serviceWorkerSupported,
    serviceWorkerReady: Boolean(registration),
    serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
    pushManagerSupported,
    subscriptionExists: Boolean(subscription),
    subscriptionActiveInProfile: registered,
    subscriptionEndpointHost: endpoint.host,
    subscriptionEndpointLength: endpoint.length,
    fcmTokenCount: Array.isArray(user?.fcmTokens) ? user.fcmTokens.length : 0,
    registeredDeviceCount: Object.keys(devices).length || (Array.isArray(user?.webPushSubscriptions) ? user.webPushSubscriptions.length : 0),
    profileSubscriptionCount: Array.isArray(user?.webPushSubscriptions) ? user.webPushSubscriptions.length : 0,
    lastRegistration: currentDevice?.lastRegistrationAt || user?.lastPushRegistration?.at || null,
    lastSuccessfulPush: currentDevice?.lastSuccessfulPushAt || null,
    lastPushStatus: currentDevice?.lastPushStatus || null,
    localLog: getPushRegistrationLog().slice(0, 8),
  };
}

export async function registerCurrentPushDevice(user = {}, { requestPermission = true } = {}) {
  const deviceId = getPushDeviceId();
  logPushStage('push register start', { deviceId });
  if (!('Notification' in window)) throw new Error('Notification API unsupported');
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker unsupported');
  if (!('PushManager' in window)) throw new Error('PushManager unsupported');
  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
  logPushStage('permission', { permission });
  if (permission !== 'granted') throw new Error(`Notification permission: ${permission}`);
  const registration = await getReadyServiceWorker();
  logPushStage('service worker ready', { ready: Boolean(registration) });
  if (!registration?.pushManager) throw new Error('Service Worker is not ready for push');
  let subscription = await registration.pushManager.getSubscription();
  const vapidStorageKey = 'apg_webpush_vapid_public_key';
  const registeredVapidKey = localStorage.getItem(vapidStorageKey);
  if (subscription && registeredVapidKey !== WEB_PUSH_VAPID_PUBLIC_KEY) {
    await subscription.unsubscribe().catch(() => false);
    subscription = null;
    logPushStage('subscription rotated', { reason: 'vapid_key_changed' });
  }
  logPushStage('subscription exists', { exists: Boolean(subscription) });
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY),
    });
    logPushStage('subscription created', endpointInfo(subscription.toJSON()?.endpoint));
  }
  localStorage.setItem(vapidStorageKey, WEB_PUSH_VAPID_PUBLIC_KEY);
  const diagnostics = await collectPushDiagnostics(user);
  const result = await userAction('push:register', {
    userId: String(user?.id || ''),
    deviceId,
    subscription: subscription.toJSON(),
    diagnostics,
  });
  logPushStage('subscription saved', { deviceId, active: true });
  return { result, diagnostics: await collectPushDiagnostics({ ...user, pushDevices: { ...(user?.pushDevices || {}), [deviceId]: result.device || {} }, webPushSubscriptions: [subscription.toJSON()] }) };
}

export async function cleanupCurrentPushSubscriptions(user = {}) {
  const subscription = await getCurrentPushSubscription();
  const deviceId = getPushDeviceId();
  const result = await userAction('push:cleanupSubscriptions', {
    userId: String(user?.id || ''),
    deviceId,
    subscription: subscription?.toJSON?.() || null,
  });
  logPushStage('subscription updated', { deviceId, kept: result.keptSubscriptions ?? 0, removed: result.removedSubscriptions ?? 0 });
  return result;
}

export async function sendCurrentDeviceTestPush(user = {}) {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) throw new Error('На этом устройстве нет Web Push подписки.');
  const deviceId = getPushDeviceId();
  const result = await userAction('push:testDevice', {
    userId: String(user?.id || ''),
    deviceId,
    subscription: subscription.toJSON(),
  });
  logPushStage(result.sent ? 'subscription updated' : 'subscription failed', { deviceId, sent: result.sent ?? 0, failed: result.failed ?? 0, reason: result.reason || '' });
  return result;
}
