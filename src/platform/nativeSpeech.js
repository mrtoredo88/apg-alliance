import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeSpeech = registerPlugin('NativeSpeech');

export function isNativeSpeechAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function recognizeNativeSpeech() {
  if (!isNativeSpeechAvailable()) throw new Error('NATIVE_SPEECH_UNAVAILABLE');
  const result = await NativeSpeech.startListening();
  return String(result?.transcript || '').trim();
}
