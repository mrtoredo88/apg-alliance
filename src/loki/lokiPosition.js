export const LOKI_POSITIONS = {
  home: {
    right: 'max(12px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
    width: 'min(292px, calc(100vw - 24px))',
    justifyItems: 'end',
  },
  firstCard: {
    right: 'max(18px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(206px + env(safe-area-inset-bottom, 0px))',
    width: 'min(292px, calc(100vw - 24px))',
    justifyItems: 'end',
  },
  eventCard: {
    right: 'max(20px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(242px + env(safe-area-inset-bottom, 0px))',
    width: 'min(300px, calc(100vw - 24px))',
    justifyItems: 'end',
  },
  profile: {
    right: 'max(16px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(178px + env(safe-area-inset-bottom, 0px))',
    width: 'min(292px, calc(100vw - 24px))',
    justifyItems: 'end',
  },
  rewardShelf: {
    right: 'max(18px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(220px + env(safe-area-inset-bottom, 0px))',
    width: 'min(292px, calc(100vw - 24px))',
    justifyItems: 'end',
  },
  map: {
    right: 'calc(50vw - 42px)',
    bottom: 'calc(150px + env(safe-area-inset-bottom, 0px))',
    width: 84,
    justifyItems: 'center',
  },
  center: {
    right: 'calc(50vw - 42px)',
    bottom: 'calc(46vh - 42px)',
    width: 84,
    justifyItems: 'center',
  },
  celebrate: {
    right: 'calc(50vw - 42px)',
    bottom: 'calc(38vh - 42px)',
    width: 84,
    justifyItems: 'center',
  },
  notice: {
    right: 'max(18px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(184px + env(safe-area-inset-bottom, 0px))',
    width: 'min(292px, calc(100vw - 24px))',
    justifyItems: 'end',
  },
};

export function getLokiPosition(anchor) {
  return LOKI_POSITIONS[anchor] ?? LOKI_POSITIONS.home;
}
