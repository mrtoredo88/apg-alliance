import world from './world/about.json';
import screens from './screens/screens.json';
import features from './features/features.json';
import chronicles from './updates/chronicles.json';
import categories from './categories/categories.json';

export const APG_KNOWLEDGE_BASE = {
  id: 'apg-chronicles',
  title: 'Хроники АПГ',
  version: 1,
  locale: 'ru',
  world,
  screens,
  features,
  chronicles,
  categories,
};

export function validateApgKnowledgeBase(knowledge = APG_KNOWLEDGE_BASE) {
  const issues = [];
  if (!knowledge.world?.name) issues.push('world.name missing');
  if (!Array.isArray(knowledge.screens) || !knowledge.screens.length) issues.push('screens missing');
  if (!Array.isArray(knowledge.features) || !knowledge.features.length) issues.push('features missing');
  if (!Array.isArray(knowledge.chronicles)) issues.push('chronicles missing');
  if (!Array.isArray(knowledge.categories) || !knowledge.categories.length) issues.push('categories missing');
  return { ok: issues.length === 0, issues };
}

export function findKnowledgeItems(query, knowledge = APG_KNOWLEDGE_BASE) {
  const text = String(query ?? '').toLowerCase().replace(/ё/g, 'е');
  const matches = [];
  for (const item of [...knowledge.screens, ...knowledge.features]) {
    const haystack = [item.title, item.purpose, item.description, ...(item.keywords ?? [])].filter(Boolean).join(' ').toLowerCase().replace(/ё/g, 'е');
    if (haystack && haystack.split(/\s+/).some(word => word.length > 3 && text.includes(word))) {
      matches.push({ ...item, type: item.purpose ? 'screen' : 'feature' });
    }
  }
  return matches.slice(0, 4);
}

export function getLatestChronicles(limit = 3, knowledge = APG_KNOWLEDGE_BASE) {
  return [...knowledge.chronicles].slice(0, limit);
}
