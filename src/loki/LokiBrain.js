import { askLokiCore } from './core/LokiCore.js';
import { recordLokiMessageTrace, recordLokiPipelineError, recordLokiPipelineReturn } from './lokiMessageTrace.js';

export async function askLokiBrain(args) {
  recordLokiMessageTrace('askLokiBrain REQUEST START', { textLength: String(args?.text || '').length });
  try {
    const result = await askLokiCore(args);
    recordLokiPipelineReturn('askLokiBrain', result);
    recordLokiMessageTrace('askLokiBrain REQUEST END', { returned: Boolean(result), intent: result?.intent || '' });
    return result;
  } catch (error) {
    recordLokiPipelineError('askLokiBrain', error);
    throw error;
  }
}

export { buildLokiBrainContext } from './core/LokiCore.js';
