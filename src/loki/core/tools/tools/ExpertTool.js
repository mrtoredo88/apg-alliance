import { buildToolResult, sourceSearch } from '../ToolResult.js';

export const ExpertTool = {
  find({ call, knowledge }) {
    const rows = sourceSearch(knowledge, call.params?.query || '', ['expert'], 5);
    return buildToolResult({
      tool: 'expert',
      method: 'find',
      title: 'эксперты',
      text: rows.length ? `Нашёл ${rows.length} экспертов. Лучший вариант: «${rows[0].title || rows[0].name}».` : 'По актуальным данным экспертов не нашёл.',
      items: rows,
      itemType: 'expert',
      data: { count: rows.length },
    });
  },
};
