function active(items) {
  return (Array.isArray(items) ? items : []).filter(item => item?.archived !== true && item?.hidden !== true && item?.deleted !== true);
}

function textOf(item) {
  return [item?.title, item?.name, item?.category, item?.specialization, item?.description, item?.summary, item?.tags?.join?.(' ')]
    .filter(Boolean).join(' ').toLowerCase().replace(/ё/g, 'е');
}

function terms(query) {
  return String(query || '').toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/).filter(word => word.length > 2);
}

function rank(items, query, interests = []) {
  const queryTerms = terms(query);
  const interestTerms = interests.flatMap(terms);
  return active(items).map(item => {
    const text = textOf(item);
    const score = queryTerms.reduce((sum, term) => sum + (text.includes(term) ? 3 : 0), 0)
      + interestTerms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
    return { item, score };
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score);
}

export const Reasoner = {
  id: 'reasoner',
  combine({ query, context }) {
    const interests = context?.userMemory?.favoriteCategories
      ? Object.entries(context.userMemory.favoriteCategories).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key]) => key)
      : [];
    return {
      partners: rank(context?.apg?.partners, query, interests).slice(0, 3),
      experts: rank(context?.apg?.experts, query, interests).slice(0, 3),
      events: rank(context?.apg?.events, query, interests).slice(0, 3),
      news: rank(context?.apg?.news, query, interests).slice(0, 3),
      evidence: ['partners', 'experts', 'events', 'news'].filter(key => Array.isArray(context?.apg?.[key])),
    };
  },
};
