export const HOME_HYDRATION_STAGES = {
  SHELL: 'shell',
  NEWS: 'news',
  PARTNERS: 'partners',
  EVENTS: 'events',
  JOURNEY: 'journey',
  LOKI: 'loki',
  RECOMMENDATIONS: 'recommendations',
};

export const HOME_HYDRATION_STAGE_ORDER = [
  HOME_HYDRATION_STAGES.SHELL,
  HOME_HYDRATION_STAGES.NEWS,
  HOME_HYDRATION_STAGES.PARTNERS,
  HOME_HYDRATION_STAGES.EVENTS,
  HOME_HYDRATION_STAGES.JOURNEY,
  HOME_HYDRATION_STAGES.LOKI,
  HOME_HYDRATION_STAGES.RECOMMENDATIONS,
];

export const HOME_HYDRATION_READY_MARKS = {
  [HOME_HYDRATION_STAGES.SHELL]: 'home_shell_ready',
  [HOME_HYDRATION_STAGES.NEWS]: 'home_news_ready',
  [HOME_HYDRATION_STAGES.PARTNERS]: 'home_partners_ready',
  [HOME_HYDRATION_STAGES.EVENTS]: 'home_events_ready',
  [HOME_HYDRATION_STAGES.JOURNEY]: 'home_journey_ready',
  [HOME_HYDRATION_STAGES.LOKI]: 'home_loki_ready',
  [HOME_HYDRATION_STAGES.RECOMMENDATIONS]: 'home_recommendations_ready',
};

export function createHomeHydrationTask({ stage, priority, delayMs = 0, idle = false } = {}) {
  const id = String(stage || '').trim();
  if (!HOME_HYDRATION_STAGE_ORDER.includes(id)) throw new Error(`home_hydration_stage_unknown:${id}`);
  return {
    id,
    stage: id,
    priority: Number(priority || HOME_HYDRATION_STAGE_ORDER.indexOf(id) + 1),
    delayMs: Math.max(0, Number(delayMs || 0)),
    idle: Boolean(idle),
  };
}
