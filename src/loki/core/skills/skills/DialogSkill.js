import { LokiSkill } from '../LokiSkill.js';

export const DialogSkill = new LokiSkill({
  id: 'dialog',
  title: 'Dialog',
  supportedCapabilities: ['OPEN_DIALOG', 'SEND_MESSAGE'],
  supportedEntities: ['dialog', 'message', 'user'],
  supportedContexts: ['dialog', 'profile'],
  priority: 72,
  description: 'Диалоги и сообщения через существующий социальный контекст приложения.',
  workflow: '',
  tools: [],
  signals: ['диалог', 'чат', 'сообщ', 'напис'],
  prepare({ question = '', capabilityContext = {} } = {}) {
    return {
      entity: 'Dialog',
      normalizedQuery: question,
      preparedParameters: { ...capabilityContext.resolved },
      recommendations: ['use_existing_dialog_navigation'],
    };
  },
});
