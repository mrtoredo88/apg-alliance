import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

let scanning = false;
let lastValue = '';
let lastAt = 0;

export function canUseNativeScanner() { return Capacitor.getPlatform() === 'android'; }

export async function scanNativeQr() {
  if (!canUseNativeScanner()) return null;
  if (scanning) throw Object.assign(new Error('Scanner already active'), { code: 'SCAN_IN_PROGRESS' });
  scanning = true;
  try {
    let permission = await BarcodeScanner.checkPermissions();
    if (permission.camera !== 'granted') permission = await BarcodeScanner.requestPermissions();
    if (permission.camera !== 'granted') throw Object.assign(new Error('Camera permission denied'), { code: 'CAMERA_DENIED' });
    const result = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    const value = String(result.barcodes?.[0]?.rawValue || '').trim();
    if (!value) return null;
    const now = Date.now();
    if (value === lastValue && now - lastAt < 2500) return null;
    lastValue = value;
    lastAt = now;
    return value;
  } finally {
    scanning = false;
  }
}
