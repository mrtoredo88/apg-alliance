const SIDE_INSET = 'max(12px, env(safe-area-inset-left, 0px))';
const SIDE_INSET_RIGHT = 'max(12px, env(safe-area-inset-right, 0px))';
const BOTTOM_SAFE = 'max(env(safe-area-inset-bottom, 0px), var(--apg-vv-bottom, 0px))';

const ANCHOR_BOTTOM = {
  home: 100,
  firstCard: 152,
  eventCard: 160,
  profile: 142,
  rewardShelf: 156,
  map: 146,
  center: 220,
  celebrate: 194,
  notice: 148,
};

const ANCHOR_ALIGN = {
  map: 'center',
  center: 'center',
  celebrate: 'center',
};

function bottomFor(anchor) {
  const value = ANCHOR_BOTTOM[anchor] ?? ANCHOR_BOTTOM.home;
  return `calc(${value}px + ${BOTTOM_SAFE})`;
}

export function getLokiPosition(anchor) {
  const align = ANCHOR_ALIGN[anchor] ?? 'end';
  return {
    left: SIDE_INSET,
    right: SIDE_INSET_RIGHT,
    bottom: bottomFor(anchor),
    width: 'auto',
    maxWidth: 'calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))',
    justifyItems: align,
    justifyContent: align,
    boxSizing: 'border-box',
  };
}
