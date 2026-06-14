export const LEVELS = [
  { id: 'newcomer',   label: 'Новичок',       emoji: '🌱', min: 0,   color: '#7EB87E' },
  { id: 'member',     label: 'Участник',       emoji: '⭐', min: 10,  color: '#4A90D9' },
  { id: 'active',     label: 'Активный',       emoji: '🔥', min: 25,  color: '#E07B39' },
  { id: 'pro',        label: 'Профи',          emoji: '💎', min: 50,  color: '#9B59B6' },
  { id: 'ambassador', label: 'Амбассадор АПГ', emoji: '👑', min: 100, color: '#C9A84C' },
];

export const getLevel = (keys) =>
  [...LEVELS].reverse().find(l => keys >= l.min) ?? LEVELS[0];

export const getNextLevel = (keys) =>
  LEVELS.find(l => l.min > keys) ?? null;

export const getLevelProgress = (keys) => {
  const cur = getLevel(keys);
  const next = getNextLevel(keys);
  if (!next) return 100;
  return Math.round(((keys - cur.min) / (next.min - cur.min)) * 100);
};

export const getKeysToNext = (keys) => {
  const next = getNextLevel(keys);
  return next ? next.min - keys : 0;
};
