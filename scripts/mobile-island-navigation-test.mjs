import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { USER_MODE_NAV_ITEMS } from '../src/workspace/WorkspaceCore.js';
const source = fs.readFileSync('src/UserApp.jsx', 'utf8');
const panels = USER_MODE_NAV_ITEMS.map(item => item.panelId).filter(Boolean);
assert.deepEqual(panels, ['home', 'offers', 'events', 'profile']);
assert.equal(USER_MODE_NAV_ITEMS.find(item => item.label === 'Афиша').panelId, 'events');
assert.ok(!source.includes('SWIPE_TABS'));
const start = source.slice(source.indexOf('  const handleSwipeStart'), source.indexOf('  const handleSwipeMove'));
const end = source.slice(source.indexOf('  const handleSwipeEnd'), source.indexOf('  const handleSwipeCancel'));
for (const panel of panels) {
  for (const [x, finish, boundary] of [[200, 20, false], [100, 350, false], [5, 200, false], [250, 20, true]]) {
    const calls = [];
    const context = { activePanel: panel, MAIN_PANEL_IDS: panels, useCallback: fn => fn,
      swipeTouchX: { current: null }, swipeTouchY: { current: null }, edgeSwipeRef: { current: false },
      pullTouchRef: { current: {} }, pullClickSuppressUntilRef: { current: 0 }, pullRefreshing: false,
      getPullStartState: () => ({ active: !boundary }), setPullDistance: () => {}, logGestureDebug: () => {},
      goPanel: id => calls.push(id), goBackPanel: () => calls.push('back'), triggerPullRefresh: () => calls.push('refresh'),
      PULL_TRIGGER_DY_PX: 100,
    };
    vm.createContext(context);
    vm.runInContext(`${start}\n${end}\nglobalThis.start = handleSwipeStart; globalThis.end = handleSwipeEnd;`, context);
    context.start({ touches: [{ clientX: x, clientY: 100 }], target: { closest: () => boundary } });
    context.end({ changedTouches: [{ clientX: finish, clientY: 100 }] });
    assert.deepEqual(calls, [], `${panel}: horizontal gesture must not navigate`);
  }
}
console.log('Mobile island: canonical events route and 16 horizontal/edge/carousel gesture cases passed.');
