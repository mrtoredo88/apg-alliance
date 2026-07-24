import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeUpdater = registerPlugin('NativeUpdater');

export function isNativeUpdaterAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function addNativeUpdateProgressListener(listener) {
  return NativeUpdater.addListener('downloadProgress', listener);
}

export async function downloadAndInstallAndroidUpdate(release) {
  if (!isNativeUpdaterAvailable()) throw new Error('NATIVE_UPDATER_UNAVAILABLE');
  return NativeUpdater.downloadAndInstall({
    url: String(release?.apkUrl || ''),
    sha256: String(release?.sha256 || '').toLowerCase(),
    versionCode: Number(release?.versionCode || 0),
  });
}
