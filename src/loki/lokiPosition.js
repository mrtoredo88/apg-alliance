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

function bottomFor(anchor) {
  const value = ANCHOR_BOTTOM[anchor] ?? ANCHOR_BOTTOM.home;
  return `calc(${value}px + ${BOTTOM_SAFE})`;
}

export function getLokiPosition(anchor) {
  return {
    right: SIDE_INSET_RIGHT,
    bottom: bottomFor(anchor),
    width: 'fit-content',
    maxWidth: 'calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))',
    justifyItems: 'end',
    justifyContent: 'end',
    boxSizing: 'border-box',
  };
}
