import { buildToolResult, sourceSearch } from '../ToolResult.js';

export const PartnerTool = {
  find({ call, knowledge }) {
    const rows = sourceSearch(knowledge, call.params?.query || '', ['partner', 'location'], 5);
    return buildToolResult({
      tool: 'partner',
      method: 'find',
      title: 'партнёры',
      text: rows.length ? `Нашёл ${rows.length} партнёров/локаций. Лучший вариант: «${rows[0].title || rows[0].name}».` : 'По актуальным данным партнёров не нашёл.',
      items: rows,
      data: { count: rows.length },
    });
  },

  open({ call, knowledge }) {
    const id = String(call.params?.id || '');
    const rows = (knowledge.sources?.partners || []).filter(item => String(item.id) === id || String(item.slug || '') === id).slice(0, 1);
    return buildToolResult({
      tool: 'partner',
      method: 'open',
      title: 'партнёр',
      text: rows.length ? `Нашёл карточку «${rows[0].title || rows[0].name}».` : 'Не нашёл эту карточку партнёра в загруженных данных.',
      items: rows,
      itemType: 'partner',
      data: { id, count: rows.length },
    });
  },
};
