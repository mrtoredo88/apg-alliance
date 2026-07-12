import assert from 'node:assert/strict';
import {
  buildWorkspaceLayout,
  createWorkspaceCache,
  getWorkspaceMode,
  getWorkspaceNavigation,
  makeVirtualWindow,
  USER_MODE_NAV_ITEMS,
  WORKSPACE_BREAKPOINTS,
  WORKSPACE_MODES,
  WORKSPACE_NAV_ITEMS,
  WORKSPACE_REGIONS,
} from '../src/workspace/WorkspaceCore.js';

assert.equal(getWorkspaceMode(WORKSPACE_BREAKPOINTS.mobile), WORKSPACE_MODES.mobile);
assert.equal(getWorkspaceMode(WORKSPACE_BREAKPOINTS.tablet), WORKSPACE_MODES.tablet);
assert.equal(getWorkspaceMode(WORKSPACE_BREAKPOINTS.desktop), WORKSPACE_MODES.desktop);

const mobile = buildWorkspaceLayout({ width: 390 });
assert.equal(mobile.mode, WORKSPACE_MODES.mobile);
assert.equal(mobile.regions[WORKSPACE_REGIONS.bottomBar].visible, true);
assert.equal(mobile.regions[WORKSPACE_REGIONS.leftSidebar].visible, false);
assert.equal(mobile.contextPresentation, 'overlay');

const tablet = buildWorkspaceLayout({ width: 820 });
assert.equal(tablet.mode, WORKSPACE_MODES.tablet);
assert.equal(tablet.regions[WORKSPACE_REGIONS.bottomBar].visible, true);
assert.equal(tablet.regions[WORKSPACE_REGIONS.leftSidebar].visible, false);

const desktop = buildWorkspaceLayout({ width: 1280, contextOpen: true, pinnedContext: true });
assert.equal(desktop.mode, WORKSPACE_MODES.desktop);
assert.equal(desktop.regions[WORKSPACE_REGIONS.leftSidebar].visible, true);
assert.equal(desktop.regions[WORKSPACE_REGIONS.bottomBar].visible, false);
assert.equal(desktop.regions[WORKSPACE_REGIONS.rightSidebar].visible, true);
assert.equal(desktop.regions[WORKSPACE_REGIONS.statusBar].visible, true);
assert.equal(desktop.contextPresentation, 'docked');

const mobileNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.mobile, role: 'user' });
assert.equal(mobileNav.placement, 'bottom');
assert.deepEqual(mobileNav.primary.map(item => item.id), ['home', 'offers', 'scan', 'experts', 'profile']);

const superAdminMobileNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.mobile, role: 'super_admin' });
assert.equal(superAdminMobileNav.role, 'super_admin');
assert.deepEqual(superAdminMobileNav.primary.map(item => item.id), ['home', 'offers', 'scan', 'experts', 'profile']);
assert.deepEqual(superAdminMobileNav.primary.map(item => item.panelId), ['home', 'offers', null, 'experts', 'profile']);

const unknownMobileNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.mobile, role: 'unknown-role' });
assert.equal(unknownMobileNav.role, 'user');
assert.deepEqual(unknownMobileNav.unknownRoles, ['unknown-role']);
assert.deepEqual(USER_MODE_NAV_ITEMS.map(item => item.id), ['home', 'offers', 'scan', 'experts', 'profile']);

const desktopPartnerNav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.desktop, role: 'partner' });
assert.equal(desktopPartnerNav.placement, 'sidebar');
assert.ok(desktopPartnerNav.primary.some(item => item.id === 'business-hub'));

const navIds = WORKSPACE_NAV_ITEMS.map(item => item.id);
assert.equal(navIds.length, new Set(navIds).size);

const cache = createWorkspaceCache({ ttl: 1000, max: 1 });
cache.set('a', 1);
assert.equal(cache.get('a'), 1);
cache.set('b', 2);
assert.equal(cache.get('a'), undefined);
assert.equal(cache.get('b'), 2);

const virtual = makeVirtualWindow({ total: 1000, scrollTop: 720, itemHeight: 72, viewportHeight: 360, overscan: 2 });
assert.equal(virtual.start, 8);
assert.equal(virtual.end, 17);
assert.equal(virtual.count, 9);
assert.equal(virtual.offsetTop, 576);

console.log('Workspace Core smoke test passed');
