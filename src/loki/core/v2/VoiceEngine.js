export class VoiceEngine {
  constructor({ speechSynthesisApi = globalThis.speechSynthesis } = {}) {
    this.api = speechSynthesisApi;
    this.queue = [];
    this.mode = 'text';
    this.rate = 1;
    this.active = false;
  }

  configure({ mode = this.mode, rate = this.rate } = {}) {
    if (!['text', 'voice', 'both'].includes(mode)) throw new Error('Unsupported Loki voice mode');
    this.mode = mode;
    this.rate = Math.min(1.8, Math.max(0.6, Number(rate) || 1));
  }

  enqueue(text, options = {}) {
    if (this.mode === 'text' || !String(text || '').trim()) return false;
    this.queue.push({ text: String(text).trim(), emotion: options.emotion || 'neutral' });
    this.playNext();
    return true;
  }

  playNext() {
    if (this.active || !this.queue.length || !this.api || typeof SpeechSynthesisUtterance === 'undefined') return;
    const item = this.queue.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = 'ru-RU';
    utterance.rate = this.rate;
    utterance.pitch = item.emotion === 'excited' ? 1.08 : item.emotion === 'calm' ? 0.94 : 1;
    utterance.onend = () => { this.active = false; this.playNext(); };
    utterance.onerror = () => { this.active = false; this.playNext(); };
    this.active = true;
    this.api.speak(utterance);
  }

  stop() {
    this.queue = [];
    this.active = false;
    this.api?.cancel?.();
  }
}
