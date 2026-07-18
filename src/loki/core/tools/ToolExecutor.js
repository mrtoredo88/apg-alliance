import { LOKI_TOOL_EVENTS, getToolDefinition } from './ToolRegistry.js';
import { makeToolDeniedResult, validateToolCall, validateToolResult } from './ToolValidator.js';
import { nowMs } from './ToolResult.js';
import { UserTool } from './tools/UserTool.js';
import { PartnerTool } from './tools/PartnerTool.js';
import { ExpertTool } from './tools/ExpertTool.js';
import { PromotionTool } from './tools/PromotionTool.js';
import { GiftTool } from './tools/GiftTool.js';
import { EventTool } from './tools/EventTool.js';
import { NewsTool } from './tools/NewsTool.js';
import { MeetingTool } from './tools/MeetingTool.js';
import { JourneyTool } from './tools/JourneyTool.js';
import { WorkspaceTool } from './tools/WorkspaceTool.js';
import { SearchTool } from './tools/SearchTool.js';

const TOOL_MODULES = {
  user: UserTool,
  partner: PartnerTool,
  expert: ExpertTool,
  promotion: PromotionTool,
  gift: GiftTool,
  event: EventTool,
  news: NewsTool,
  meeting: MeetingTool,
  journey: JourneyTool,
  workspace: WorkspaceTool,
  search: SearchTool,
};

const cache = new Map();

function dataSignature(definition = {}, knowledge = {}) {
  const sources = knowledge.sources || {};
  const relevant = {
    user: ['userProfile'],
    partner: ['partners', 'locations'],
    expert: ['experts'],
    promotion: ['promotions', 'partners'],
    gift: ['gifts'],
    event: ['events'],
    news: ['news'],
    meeting: ['bookings', 'meetings'],
    journey: ['userProfile', 'bookings', 'gifts'],
    workspace: ['workspaceAnalytics', 'dialogs', 'bookings'],
    search: ['partners', 'experts', 'events', 'news', 'promotions', 'gifts', 'locations'],
  }[definition.tool] || [];
  return relevant.map(key => {
    const value = sources[key];
    if (Array.isArray(value)) {
      return `${key}:${value.length}:${value.map(item => `${item.id || item.title || ''}:${item.updatedAt || item.createdAt || item.publishedAt || item.startAt || ''}`).join('|')}`;
    }
    return `${key}:${JSON.stringify(value || null).slice(0, 240)}`;
  }).join('::');
}

function cacheKey(call = {}, definition = {}, knowledge = {}) {
  return `${call.id}:${JSON.stringify(call.params || {})}:${dataSignature(definition, knowledge)}`;
}

export function clearToolCache() {
  cache.clear();
}

export function executeLokiTool(call = {}, { knowledge = {}, context = {}, appState = {} } = {}) {
  const safeKnowledge = knowledge || {};
  const safeContext = context || {};
  const safeAppState = appState || {};
  const started = nowMs();
  const requested = { type: LOKI_TOOL_EVENTS.REQUESTED, toolId: call.id, status: 'requested' };
  const validation = validateToolCall(call, { context: safeContext, knowledge: safeKnowledge });
  if (!validation.ok) {
    return makeToolDeniedResult(validation, started);
  }
  const definition = validation.definition || getToolDefinition(call.id);
  const key = cacheKey(call, definition, safeKnowledge);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.createdAt <= definition.cacheTtlMs) {
    return {
      ...cached.result,
      toolContext: {
        ...cached.result.toolContext,
        cacheHit: true,
        events: [
          requested,
          { type: LOKI_TOOL_EVENTS.RESOLVED, toolId: call.id, status: 'resolved', cacheHit: true },
          { type: LOKI_TOOL_EVENTS.COMPLETED, toolId: call.id, status: 'completed', durationMs: 0, cacheHit: true },
        ],
      },
    };
  }
  const module = TOOL_MODULES[definition.tool];
  const method = module?.[definition.method];
  if (typeof method !== 'function') {
    return makeToolDeniedResult({ ...validation, reason: 'Инструмент найден, но его метод недоступен.' }, started);
  }
  try {
    const raw = method({ call, definition, knowledge: safeKnowledge, context: safeContext, appState: safeAppState });
    const resultValidation = validateToolResult(raw);
    if (!resultValidation.ok) {
      return {
        intent: 'tool.failed',
        preserveText: true,
        text: resultValidation.reason,
        card: null,
        cards: [],
        toolContext: {
          call,
          status: 'failed',
          durationMs: Math.round(nowMs() - started),
          events: [
            requested,
            { type: LOKI_TOOL_EVENTS.RESOLVED, toolId: call.id, status: 'resolved' },
            { type: LOKI_TOOL_EVENTS.FAILED, toolId: call.id, status: 'failed', reason: resultValidation.reason },
          ],
        },
      };
    }
    const result = {
      ...raw,
      toolContext: {
        call,
        status: 'completed',
        durationMs: Math.round(nowMs() - started),
        cacheHit: false,
        events: [
          requested,
          { type: LOKI_TOOL_EVENTS.RESOLVED, toolId: call.id, status: 'resolved' },
          { type: LOKI_TOOL_EVENTS.STARTED, toolId: call.id, status: 'started' },
          { type: LOKI_TOOL_EVENTS.COMPLETED, toolId: call.id, status: 'completed', durationMs: Math.round(nowMs() - started) },
        ],
      },
    };
    cache.set(key, { createdAt: Date.now(), result });
    return result;
  } catch (error) {
    const reason = error?.message || 'Не удалось выполнить инструмент Локи.';
    return {
      intent: 'tool.failed',
      preserveText: true,
      text: `Не смог получить данные: ${reason}`,
      card: null,
      cards: [],
      toolContext: {
        call,
        status: 'failed',
        durationMs: Math.round(nowMs() - started),
        events: [
          requested,
          { type: LOKI_TOOL_EVENTS.FAILED, toolId: call.id, status: 'failed', reason },
        ],
      },
    };
  }
}
