import { buildPersonalUserContext } from './UserContextBuilder.js';
import { analyzeUserProfile } from './UserProfileAnalyzer.js';
import { resolvePreferences } from './PreferenceResolver.js';
import { adjustRecommendations } from './RecommendationAdjuster.js';
import { buildPersonalizationPrivacyAnswer, buildPersonalizedPrefix, isExplainPersonalizationQuery } from './ExplanationBuilder.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function mergeSuggestions(result = {}, userContext = {}) {
  const suggestions = list(result.suggestions);
  const extra = [];
  if (userContext.capabilities?.workspace && result.intent?.includes('workspace')) extra.push({ label: 'Открыть Workspace', action: result.card?.action || null });
  if (list(userContext.activeBookings).length && result.intent?.includes('book')) extra.push({ label: 'Продолжить запись', action: result.card?.action || null });
  if (list(userContext.favoritePartners).length && result.intent?.includes('find_partner')) extra.push({ label: 'Открыть любимое', action: result.card?.action || null });
  const seen = new Set();
  return [...extra, ...suggestions].filter(item => {
    if (!item?.label) return false;
    const key = `${item.label}:${item.action?.type || item.href || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export function runPersonalizationEngine({ question = '', result = null, context = {}, appState = {} } = {}) {
  const userContext = buildPersonalUserContext({ context, appState });
  const analysis = analyzeUserProfile(userContext);
  const preferences = resolvePreferences(userContext);
  if (isExplainPersonalizationQuery(question)) {
    return buildPersonalizationPrivacyAnswer({ userContext, preferences, analysis });
  }
  if (!result || result.intent?.startsWith('personalization.')) return result;
  if (!analysis.hasPersonalData || !preferences.hasEnoughData) {
    return {
      ...result,
      personalizationContext: { enabled: false, reason: 'insufficient_user_context' },
    };
  }
  const adjusted = adjustRecommendations({ result, userContext, preferences, analysis });
  const prefix = buildPersonalizedPrefix({ analysis, reasons: adjusted.reasons, preferences });
  const baseText = String(adjusted.result.text || result.text || '').trim();
  const shouldPrefix = prefix && !baseText.includes(prefix);
  return {
    ...adjusted.result,
    preserveText: true,
    text: shouldPrefix ? `${prefix}\n\n${baseText}` : baseText,
    suggestions: mergeSuggestions(adjusted.result, userContext),
    personalizationContext: {
      enabled: adjusted.applied || analysis.hasPersonalData,
      applied: adjusted.applied,
      experience: analysis.experience,
      reasons: adjusted.reasons,
      preferences: {
        categories: preferences.categories.slice(0, 3),
        districts: preferences.districts.slice(0, 3),
        hasEnoughData: preferences.hasEnoughData,
      },
      privacy: 'loaded_app_state_only',
    },
  };
}
