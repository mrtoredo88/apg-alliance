const MAX_TOOL_HISTORY = 40;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function addToolHistoryItem(history = [], event = {}) {
  const item = {
    id: `${event.type || 'tool'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: event.type || 'TOOL_EVENT',
    toolId: event.toolId || event.call?.id || '',
    status: event.status || 'unknown',
    durationMs: Number(event.durationMs || 0),
    reason: event.reason || '',
    createdAt: new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_TOOL_HISTORY);
}

export function buildToolHistoryPatch(memory = {}, events = []) {
  const toolHistory = list(events).reduce((acc, event) => addToolHistoryItem(acc, event), memory.toolHistory || []);
  return { toolHistory };
}

export function summarizeToolHistory(memory = {}) {
  const rows = list(memory.toolHistory);
  const completed = rows.filter(item => item.status === 'completed').length;
  const failed = rows.filter(item => item.status === 'failed' || item.status === 'denied').length;
  return {
    recent: rows.slice(0, 5),
    completed,
    failed,
    lastToolId: rows[0]?.toolId || '',
  };
}
