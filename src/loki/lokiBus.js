const listeners = new Set();

export function subscribeLoki(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showLokiMessage(eventType, payload = {}) {
  listeners.forEach(listener => listener(eventType, payload));
}
