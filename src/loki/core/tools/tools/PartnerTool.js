import { buildToolResult, sourceSearch } from '../ToolResult.js';

export const PartnerTool = {
  find({ call, knowledge }) {
    const query = call.params?.query || '';
    const coffeeRequest = /(кофе|кофейн|капучино|латте)/i.test(query);
    const rows = coffeeRequest
      ? ['кофе', 'кофейня', 'кафе', 'ресторан', 'кондитерская', 'пекарня', 'выпечка', 'десерт', 'завтрак']
        .flatMap(term => sourceSearch(knowledge, term, ['partner'], 5))
        .filter((row, index, all) => all.findIndex(candidate => `${candidate.type}:${candidate.id}` === `${row.type}:${row.id}`) === index)
        .slice(0, 5)
      : sourceSearch(knowledge, query, ['partner', 'location'], 5);
    return buildToolResult({
      tool: 'partner',
      method: 'find',
      title: 'партнёры',
      text: rows.length
        ? coffeeRequest
          ? `Нашёл ${rows.length} ${rows.length === 1 ? 'подходящее место' : 'подходящих места'} среди кофеен, кафе, ресторанов, кондитерских и пекарен. Начал бы с «${rows[0].title || rows[0].name}».`
          : `Нашёл ${rows.length} партнёров/локаций. Лучший вариант: «${rows[0].title || rows[0].name}».`
        : coffeeRequest
          ? 'Среди партнёров АПГ сейчас не нашлось места с кофе. Попробуйте посмотреть кафе, рестораны, кондитерские и пекарни в каталоге.'
          : 'По актуальным данным партнёров не нашёл.',
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
