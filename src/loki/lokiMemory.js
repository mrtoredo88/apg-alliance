const LOKI_MEMORY_KEY = 'apg_loki_agent_memory_v1';

export const DEFAULT_LOKI_MEMORY = {
  lastMessage: null,
  lastAction: null,
  lastPanel: null,
  panelVisits: {},
  shownAdvice: {},
  emotionalState: null,
  inDialog: false,
  updatedAt: null,
};

export function loadLokiMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOKI_MEMORY_KEY) || '{}');
    return { ...DEFAULT_LOKI_MEMORY, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch {
    return DEFAULT_LOKI_MEMORY;
  }
}

export function saveLokiMemory(memory) {
  try {
    localStorage.setItem(LOKI_MEMORY_KEY, JSON.stringify({ ...DEFAULT_LOKI_MEMORY, ...memory, updatedAt: new Date().toISOString() }));
  } catch {}
}
