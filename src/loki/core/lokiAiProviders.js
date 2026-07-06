export const LOKI_AI_PROVIDERS = {
  LOCAL_RULES: 'localRules',
  CLOUD_LLM: 'cloudLlm',
  SPECIALIZED_MODEL: 'specializedModel',
};

export function getActiveLokiAiProvider() {
  return LOKI_AI_PROVIDERS.LOCAL_RULES;
}
