import { TOOL_IDS } from '../../tools/ToolRegistry.js';

export const WorkspaceWorkflow = {
  id: 'workspace',
  title: 'Workspace',
  goals: ['REVIEW_WORKSPACE', 'WORKSPACE'],
  plannerGoals: ['REVIEW_WORKSPACE'],
  intents: ['planner.workspace_overview', 'workspace.question'],
  keywords: ['workspace', 'кабинет', 'задач', 'диалог', 'запис', 'аналитик'],
  roles: ['partner', 'expert', 'owner', 'admin'],
  reason: 'запрос относится к рабочей зоне партнёра или эксперта',
  steps: [
    { id: 'summary', title: 'Получить сводку Workspace', kind: 'tool', toolId: TOOL_IDS.WORKSPACE_SUMMARY },
    { id: 'meetings', title: 'Проверить записи', kind: 'tool', toolId: TOOL_IDS.MEETING_LIST },
    { id: 'unfinished-journey', title: 'Проверить незавершённые сценарии', kind: 'tool', toolId: TOOL_IDS.JOURNEY_UNFINISHED },
    { id: 'open-workspace', title: 'Открыть Workspace', kind: 'user_action', actionId: 'OPEN_WORKSPACE', dependencies: ['summary'] },
  ],
};
