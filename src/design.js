// Дизайн-токены через CSS-переменные — адаптируются к тёмной/светлой теме автоматически

export const T = {
  bg:       'var(--c-bg,      #0F0F1A)',
  surface:  'var(--c-card,    #1A1A2E)',
  surface2: 'var(--c-card2,   #16213E)',
  border:   'var(--c-border,  rgba(255,255,255,0.07))',
  textPri:  'var(--c-text,    #F0F0F0)',
  textSec:  'var(--c-text-sec,rgba(240,240,240,0.5))',
  gold:     '#C9A84C',
  goldL:    '#E8C97A',
  blue:     '#4A90D9',
  green:    '#4BB34B',
  red:      '#E64646',
  white:    '#FFFFFF',
};

export const GLASS = {
  background:          'var(--c-surface, rgba(255,255,255,0.07))',
  backdropFilter:      'blur(28px) saturate(1.8)',
  WebkitBackdropFilter:'blur(28px) saturate(1.8)',
  border:              '1px solid var(--c-border, rgba(255,255,255,0.13))',
  boxShadow:           '0 8px 32px rgba(0,0,0,0.2), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.08)',
};

export const GLASS_STRONG = {
  background:          'var(--c-surface, rgba(255,255,255,0.08))',
  backdropFilter:      'blur(48px) saturate(2)',
  WebkitBackdropFilter:'blur(48px) saturate(2)',
  border:              '1px solid var(--c-border, rgba(255,255,255,0.16))',
  boxShadow:           '0 16px 48px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.1)',
};

export const GLASS_GOLD = {
  background:          'linear-gradient(135deg, rgba(201,168,76,0.16), rgba(201,168,76,0.06))',
  backdropFilter:      'blur(28px) saturate(1.8)',
  WebkitBackdropFilter:'blur(28px) saturate(1.8)',
  border:              '1px solid rgba(201,168,76,0.28)',
  boxShadow:           '0 8px 28px rgba(201,168,76,0.12), inset 0 1.5px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.08)',
};
