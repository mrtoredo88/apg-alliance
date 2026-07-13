import assert from 'node:assert/strict';
import {
  canUseDesktopWorkspace,
  DESKTOP_WORKSPACE_FLAG,
  getWorkspaceUserRoles,
  isDesktopWorkspaceDevice,
  normalizeWorkspaceFlag,
  resolveDesktopWorkspaceMode,
} from '../src/workspace/WorkspaceFeatureFlags.js';
import { buildWorkspaceLayout, WORKSPACE_MODES, WORKSPACE_REGIONS } from '../src/workspace/WorkspaceCore.js';
import { getWorkspaceWidgetLayout, moveWorkspaceWidget, WORKSPACE_WIDGETS } from '../src/workspace/WorkspaceWidgets.js';

assert.equal(normalizeWorkspaceFlag('OWNER'), DESKTOP_WORKSPACE_FLAG.owner);
assert.equal(normalizeWorkspaceFlag('unknown'), DESKTOP_WORKSPACE_FLAG.expert);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, flag: DESKTOP_WORKSPACE_FLAG.off }), false);
assert.equal(canUseDesktopWorkspace({ user: { isOwner: true }, flag: DESKTOP_WORKSPACE_FLAG.owner }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'super_admin' }, flag: DESKTOP_WORKSPACE_FLAG.owner }), true);
assert.equal(canUseDesktopWorkspace({ user: { id: '988504' }, flag: DESKTOP_WORKSPACE_FLAG.owner }), false);
assert.equal(canUseDesktopWorkspace({ user: { roles: ['owner'] }, flag: DESKTOP_WORKSPACE_FLAG.owner }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'admin' }, flag: DESKTOP_WORKSPACE_FLAG.admin }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'admin' }, flag: DESKTOP_WORKSPACE_FLAG.owner }), false);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, partner: { id: 'p1' }, flag: DESKTOP_WORKSPACE_FLAG.partner }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, expert: { id: 'e1' }, flag: DESKTOP_WORKSPACE_FLAG.expert }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, partner: { id: 'p1' } }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, expert: { id: 'e1' } }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' } }), false);
assert.deepEqual(getWorkspaceUserRoles({ user: { role: 'super_admin' }, partner: { id: 'p1' } }).sort(), ['partner', 'super_admin']);

assert.equal(isDesktopWorkspaceDevice({ width: 1440, platform: 'MacIntel' }), true);
assert.equal(isDesktopWorkspaceDevice({ width: 1100, platform: 'MacIntel', maxTouchPoints: 0 }), true);
assert.equal(isDesktopWorkspaceDevice({ width: 900, platform: 'MacIntel', maxTouchPoints: 0 }), false);
assert.equal(isDesktopWorkspaceDevice({ width: 1100, platform: 'iPhone' }), false);
assert.equal(resolveDesktopWorkspaceMode({ requestedMode: 'auto', available: true }), 'workspace');
assert.equal(resolveDesktopWorkspaceMode({ requestedMode: 'user', available: true }), 'user');
assert.equal(resolveDesktopWorkspaceMode({ requestedMode: 'workspace', available: false }), 'user');

const layout = buildWorkspaceLayout({ mode: WORKSPACE_MODES.desktop, contextOpen: true, pinnedContext: true });
assert.equal(layout.regions[WORKSPACE_REGIONS.header].visible, true);
assert.equal(layout.regions[WORKSPACE_REGIONS.leftSidebar].visible, true);
assert.equal(layout.regions[WORKSPACE_REGIONS.content].visible, true);
assert.equal(layout.regions[WORKSPACE_REGIONS.rightSidebar].visible, true);
assert.equal(layout.regions[WORKSPACE_REGIONS.statusBar].visible, true);

const defaultLayout = getWorkspaceWidgetLayout();
assert.equal(defaultLayout.length, WORKSPACE_WIDGETS.length);
assert.equal(defaultLayout[0].id, 'welcome');
assert.equal(defaultLayout[0].draggable, false);
assert.ok(defaultLayout.slice(1).every(widget => widget.draggable));

const moved = moveWorkspaceWidget(defaultLayout, 'tasks', 'latest-news');
assert.equal(moved.findIndex(widget => widget.id === 'tasks') < moved.findIndex(widget => widget.id === 'latest-news'), true);

const lockedMove = moveWorkspaceWidget(defaultLayout, 'welcome', 'tasks');
assert.equal(lockedMove[0].id, 'welcome');

console.log('Desktop Workspace smoke test passed');
