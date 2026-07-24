import { App as CapacitorApp } from '@capacitor/app';
import { ANDROID_RELEASE_MANIFEST_URL } from '../constants.js';
import { isAndroidNativeApp } from './runtime.js';

export function normalizeVersionCode(value) {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

export function evaluateAndroidUpdate(currentVersionCode, release) {
  const current = normalizeVersionCode(currentVersionCode);
  const latest = normalizeVersionCode(release?.versionCode);
  const minimum = normalizeVersionCode(release?.minimumVersionCode);
  if (!current || !latest || latest <= current) return { available: false, required: false };
  return {
    available: true,
    required: minimum > current,
    currentVersionCode: current,
    latestVersionCode: latest,
  };
}

export async function checkAndroidUpdate() {
  if (!isAndroidNativeApp()) return null;
  const [appInfo, response] = await Promise.all([
    CapacitorApp.getInfo(),
    fetch(ANDROID_RELEASE_MANIFEST_URL, { cache: 'no-store' }),
  ]);
  if (!response.ok) throw new Error(`Android release manifest HTTP ${response.status}`);
  const release = await response.json();
  return {
    appInfo,
    release,
    ...evaluateAndroidUpdate(appInfo.build, release),
  };
}
