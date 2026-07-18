import { TOOL_IDS } from '../../tools/ToolRegistry.js';
import { PLANNER_GOALS } from '../../planner/GoalResolver.js';
import { LokiSkill } from '../LokiSkill.js';

export const BookingSkill = new LokiSkill({
  id: 'booking',
  title: 'Booking',
  supportedCapabilities: ['BOOK_APPOINTMENT', 'VIEW_BOOKINGS', 'RESCHEDULE_BOOKING', 'CANCEL_BOOKING'],
  supportedEntities: ['partner', 'expert', 'location', 'booking'],
  supportedContexts: ['partner', 'expert', 'location'],
  priority: 98,
  description: 'Подготовка контекста записи: партнёр, филиал, специалист, услуга, дата и время.',
  planner: PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT,
  workflow: 'booking',
  tools: [TOOL_IDS.PARTNER_FIND, TOOL_IDS.EXPERT_FIND, TOOL_IDS.MEETING_LIST],
  signals: ['запис', 'бронь', 'приём', 'прием', 'перенести', 'отменить', 'услуг', 'дата', 'время'],
  prepare({ question = '', capabilityContext = {}, knowledge = {} } = {}) {
    const sources = knowledge.sources || {};
    const screenItem = knowledge.screenContext?.item || null;
    const partner = screenItem?.type === 'partner' ? screenItem : sources.partners?.[0] || null;
    const expert = screenItem?.type === 'expert' ? screenItem : sources.experts?.[0] || null;
    const location = screenItem?.type === 'location' ? screenItem : partner?.mainLocation || partner?.locations?.[0] || null;
    const lower = String(question || '').toLowerCase();
    const service = capabilityContext.resolved?.serviceId || lower.match(/массаж|стрижк\w*|маникюр|стоматолог\w*|консультац\w*|тренировк\w*/i)?.[0] || '';
    const date = capabilityContext.resolved?.date || lower.match(/сегодня|завтра|\d{1,2}[./-]\d{1,2}|понедельник|вторник|среду|среда|четверг|пятниц\w*|суббот\w*|воскрес\w*/i)?.[0] || '';
    const time = capabilityContext.resolved?.time || lower.match(/\b\d{1,2}[:.]\d{2}\b/)?.[0] || '';
    return {
      entity: partner ? 'Partner' : expert ? 'Expert' : 'Booking',
      normalizedQuery: question,
      preparedParameters: {
        ...capabilityContext.resolved,
        partnerId: capabilityContext.resolved?.partnerId || partner?.id || '',
        expertId: capabilityContext.resolved?.expertId || expert?.id || '',
        locationId: capabilityContext.resolved?.locationId || location?.id || '',
        serviceId: service,
        date,
        time,
      },
      planner: PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT,
      workflow: 'booking',
      recommendations: ['prepare_booking_context', 'ask_single_missing_parameter'],
    };
  },
});
