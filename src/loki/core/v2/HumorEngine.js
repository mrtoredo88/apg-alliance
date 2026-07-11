import { selectPersonalityPhrase } from '../modules/PersonalityEngine.js';

export const HumorEngine = {
  id: 'humorEngine',
  pick({ event, style = 'friendly', critical = false, seed = '', context = {}, history = [] } = {}) {
    let state = [...String(seed || event || '')].reduce((sum, char) => sum + char.charCodeAt(0), 1);
    const random = () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
    return selectPersonalityPhrase({ event, mode: style, critical, context, history, random, force: true })?.text || null;
  },
};
