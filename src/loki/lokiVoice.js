const LOKI_VOICE_PROFILES = {
  neutral: { rate: 1.01, pitch: 1.15, volume: 0.96 },
  warm: { rate: 0.98, pitch: 1.13, volume: 0.96 },
  excited: { rate: 1.06, pitch: 1.22, volume: 0.98 },
  calm: { rate: 0.94, pitch: 1.08, volume: 0.94 },
};

function voiceScore(voice = {}) {
  const name = String(voice.name || '').toLowerCase();
  const lang = String(voice.lang || '').toLowerCase();
  if (!lang.startsWith('ru')) return -1000;
  let score = lang === 'ru-ru' ? 30 : 20;
  if (/milena|алёна|alena|irina|ирина|svetlana|светлана|tatyana|татьяна/.test(name)) score += 80;
  if (/premium|enhanced|natural|neural|online/.test(name)) score += 35;
  if (/google|microsoft|apple/.test(name)) score += 16;
  if (/female|женск/.test(name)) score += 12;
  if (/compact|espeak/.test(name)) score -= 25;
  if (/yuri|юрий|male|мужск/.test(name)) score -= 8;
  return score;
}

export function selectLokiVoice(voices = []) {
  return [...voices]
    .filter(voice => String(voice?.lang || '').toLowerCase().startsWith('ru'))
    .sort((left, right) => voiceScore(right) - voiceScore(left))[0] || null;
}

export function getLokiVoice(speechSynthesisApi = globalThis.speechSynthesis) {
  try {
    return selectLokiVoice(speechSynthesisApi?.getVoices?.() || []);
  } catch {
    return null;
  }
}

export function prepareLokiSpeechText(value = '') {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`>|~]+/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s*[-–—]\s*/g, ', ')
    .replace(/([.!?])(?=\S)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createLokiUtterance(text, { emotion = 'warm', rate, pitch, volume } = {}) {
  if (typeof SpeechSynthesisUtterance === 'undefined') return null;
  const spokenText = prepareLokiSpeechText(text);
  if (!spokenText) return null;
  const profile = LOKI_VOICE_PROFILES[emotion] || LOKI_VOICE_PROFILES.warm;
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = 'ru-RU';
  utterance.voice = getLokiVoice();
  utterance.rate = Math.min(1.25, Math.max(0.75, Number(rate) || profile.rate));
  utterance.pitch = Math.min(1.35, Math.max(0.8, Number(pitch) || profile.pitch));
  utterance.volume = Math.min(1, Math.max(0.4, Number(volume) || profile.volume));
  return utterance;
}
