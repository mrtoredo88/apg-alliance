import { buildToolResult, list } from '../ToolResult.js';

export const WorkspaceTool = {
  summary({ knowledge }) {
    const analytics = knowledge.sources?.workspaceAnalytics || {};
    const kpis = analytics.kpis || analytics.summary || analytics || {};
    const dialogs = list(knowledge.sources?.dialogs);
    const meetings = list(knowledge.sources?.bookings || knowledge.sources?.meetings);
    const tasks = Number(kpis.tasks || kpis.openTasks || analytics.tasks || 0);
    const unreadDialogs = Number(kpis.unreadDialogs || kpis.newDialogs || dialogs.filter(item => item.unread || item.unreadCount > 0).length || 0);
    const activeBookings = Number(kpis.newBookings || kpis.bookings || meetings.length || 0);
    const rows = [
      tasks ? `${tasks} задач` : '',
      unreadDialogs ? `${unreadDialogs} непрочитанных диалогов` : '',
      activeBookings ? `${activeBookings} записей` : '',
    ].filter(Boolean);
    return buildToolResult({
      tool: 'workspace',
      method: 'summary',
      title: 'Workspace',
      text: rows.length ? `Краткая сводка Workspace: ${rows.join(', ')}.` : 'В текущих данных Workspace нет срочных задач, диалогов или записей.',
      items: [],
      data: { tasks, unreadDialogs, activeBookings },
    });
  },
};
