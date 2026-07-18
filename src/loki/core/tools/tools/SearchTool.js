import { buildToolResult, sourceSearch } from '../ToolResult.js';

export const SearchTool = {
  query({ call, knowledge }) {
    const types = call.params?.types?.length ? call.params.types : ['partner', 'expert', 'event', 'news'];
    const rows = sourceSearch(knowledge, call.params?.query || '', types, 5);
    return buildToolResult({
      tool: 'search',
      method: 'query',
      title: 'результаты поиска',
      text: rows.length ? `Нашёл ${rows.length} результатов по актуальным данным АПГ. Начал бы с «${rows[0].title || rows[0].name}».` : 'По актуальным данным АПГ ничего подходящего не нашёл.',
      items: rows,
      data: { count: rows.length, types },
    });
  },
};
