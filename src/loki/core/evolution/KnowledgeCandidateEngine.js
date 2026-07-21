import { list, normalizeTopic, text } from './ConversationLearning.js';

const CANDIDATE_THRESHOLD = 3;

function countTopics(experiences = []) {
  return list(experiences).reduce((acc, row) => {
    const topic = row.topic || normalizeTopic(row.query);
    if (!topic) return acc;
    acc[topic] = acc[topic] || { topic, count: 0, users: new Set(), lastDate: '' };
    acc[topic].count += 1;
    if (row.userId) acc[topic].users.add(row.userId);
    acc[topic].lastDate = row.createdAt || acc[topic].lastDate;
    return acc;
  }, {});
}

export function buildKnowledgeCandidates({ experiences = [], existingCandidates = [] } = {}) {
  const existing = new Set(list(existingCandidates).map(row => row.topic));
  return Object.values(countTopics(experiences))
    .filter(row => row.count >= CANDIDATE_THRESHOLD && !existing.has(row.topic))
    .map(row => ({
      id: `kc_${row.topic.replace(/[^a-zа-я0-9]+/gi, '_').slice(0, 42)}`,
      topic: row.topic,
      frequency: row.count,
      users: row.users.size,
      currentAnswer: text(list(experiences).find(item => item.topic === row.topic)?.answer, 600),
      confidence: Math.min(0.9, 0.45 + row.count * 0.08),
      suggestedOfficialArticle: `Добавить проверенный ответ: ${row.topic}`,
      source: 'conversation_queue',
      status: 'needs_review',
      lastDate: row.lastDate,
    })).slice(0, 50);
}

export function buildUnknownTopics(experiences = []) {
  return list(experiences)
    .filter(row => row.fallback || normalizeTopic(row.intent).includes('unknown'))
    .reduce((acc, row) => {
      const topic = row.topic || normalizeTopic(row.query);
      if (!topic) return acc;
      const current = acc.find(item => item.topic === topic);
      if (current) {
        current.count += 1;
        current.lastDate = row.createdAt || current.lastDate;
      } else {
        acc.push({ topic, count: 1, users: row.userId ? 1 : 0, category: row.intent || 'unknown', lastDate: row.createdAt || '' });
      }
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}
