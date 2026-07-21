import { buildConversationExperience } from './ConversationLearning.js';
import { detectLokiFeedback } from './FeedbackEngine.js';
import { appendExperience, summarizeExperience } from './ExperienceEngine.js';
import { buildKnowledgeCandidates, buildUnknownTopics } from './KnowledgeCandidateEngine.js';
import { buildPersonalMemoryPatch } from './MemoryRanker.js';
import { evaluateKnowledgeQuality } from './KnowledgeQuality.js';

export function runLearningEngine({ question = '', result = {}, appState = {}, context = {}, memory = {}, userMemory = {}, knowledgeIndexResult = {}, startedAt = null } = {}) {
  const experience = buildConversationExperience({ question, result, appState, context, knowledgeIndexResult, startedAt });
  const feedback = detectLokiFeedback(question, memory?.lastExperience || null);
  const stored = appendExperience(userMemory, experience, feedback);
  const experiences = stored.experienceMemory;
  const personal = buildPersonalMemoryPatch({ question, result, currentMemory: userMemory });
  const newCandidates = buildKnowledgeCandidates({ experiences, existingCandidates: userMemory.knowledgeCandidates });
  const candidates = [...(userMemory.knowledgeCandidates || []), ...newCandidates].slice(0, 80);
  const unknownTopics = buildUnknownTopics(experiences);
  const quality = evaluateKnowledgeQuality({ result, knowledgeIndexResult, experience });
  return {
    experience,
    feedback,
    experienceSummary: summarizeExperience(experiences),
    personalMemoryPatch: personal.patch,
    personalMemoryBlocked: personal.blocked,
    memoryTypes: personal.memoryTypes || [],
    knowledgeCandidates: candidates,
    unknownTopics,
    quality,
    learningPatch: {
      ...stored,
      ...personal.patch,
      knowledgeCandidates: candidates,
      unknownTopics,
      lastExperience: experience,
      lastFeedback: feedback,
      lastQuality: quality,
    },
  };
}
