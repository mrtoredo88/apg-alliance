import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { AndroidBiometryStrength, BiometricAuth } from '@aparajita/capacitor-biometric-auth';

const KEY_PREFIX = 'apg_native_';
const APP_LOCK_KEY = 'biometric_lock_enabled';
export const APP_LOCK_HINT_KEY = 'apg_native_biometric_lock_enabled';

export function nativeSecuritySupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function prepareStorage() {
  await SecureStorage.setKeyPrefix(KEY_PREFIX);
}

export async function getNativeSecurityStatus() {
  if (!nativeSecuritySupported()) return { supported: false, available: false, enabled: false };
  await prepareStorage();
  const [biometry, enabled] = await Promise.all([
    BiometricAuth.checkBiometry(),
    SecureStorage.get(APP_LOCK_KEY).catch(() => false),
  ]);
  return {
    supported: true,
    available: Boolean(biometry.isAvailable || biometry.deviceIsSecure),
    strongAvailable: Boolean(biometry.strongBiometryIsAvailable),
    enabled: enabled === true,
  };
}

export async function authenticateNativeUser(reason = 'Подтвердите вход в АПГ') {
  if (!nativeSecuritySupported()) return true;
  await BiometricAuth.authenticate({
    reason,
    androidTitle: 'АПГ',
    androidSubtitle: reason,
    androidConfirmationRequired: false,
    androidBiometryStrength: AndroidBiometryStrength.weak,
    allowDeviceCredential: true,
  });
  return true;
}

export async function setNativeAppLock(enabled) {
  if (!nativeSecuritySupported()) return false;
  await prepareStorage();
  if (enabled) await authenticateNativeUser('Включение защиты приложения');
  await SecureStorage.set(APP_LOCK_KEY, Boolean(enabled));
  try {
    if (enabled) localStorage.setItem(APP_LOCK_HINT_KEY, '1');
    else localStorage.removeItem(APP_LOCK_HINT_KEY);
  } catch {}
  return Boolean(enabled);
}
