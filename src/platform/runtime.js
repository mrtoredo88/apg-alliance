import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform() {
  return isNativeApp() ? Capacitor.getPlatform() : 'web';
}

export function isAndroidNativeApp() {
  return getNativePlatform() === 'android';
}
