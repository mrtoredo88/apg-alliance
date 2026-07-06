export const MOTION = {
  duration: {
    instant: 120,
    fast: 180,
    base: 240,
    panel: 280,
    modal: 320,
    splash: 760,
  },
  ease: {
    standard: 'cubic-bezier(0.22,1,0.36,1)',
    soft: 'cubic-bezier(0.2,0,0,1)',
    out: 'cubic-bezier(0.16,1,0.3,1)',
    inOut: 'cubic-bezier(0.4,0,0.2,1)',
  },
  press: {
    card: 0.985,
    button: 0.97,
    tab: 1.06,
  },
};

export const motionTime = (key) => `${MOTION.duration[key] ?? MOTION.duration.base}ms`;

export const motionTransition = (props = ['transform', 'opacity'], duration = 'base', ease = 'standard') =>
  props.map(prop => `${prop} ${motionTime(duration)} ${MOTION.ease[ease]}`).join(', ');

export const motionDelay = (index = 0, step = 36, max = 180) => `${Math.min(index * step, max)}ms`;

