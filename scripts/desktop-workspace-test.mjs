import assert from 'node:assert/strict';
import {
  canUseDesktopWorkspace,
  DESKTOP_WORKSPACE_FLAG,
  getWorkspaceUserRoles,
  normalizeWorkspaceFlag,
} from '../src/workspace/WorkspaceFeatureFlags.js';
import { buildWorkspaceLayout, WORKSPACE_MODES, WORKSPACE_REGIONS } from '../src/workspace/WorkspaceCore.js';
import { getWorkspaceWidgetLayout, moveWorkspaceWidget, WORKSPACE_WIDGETS } from '../src/workspace/WorkspaceWidgets.js';

assert.equal(normalizeWorkspaceFlag('OWNER'), DESKTOP_WORKSPACE_FLAG.owner);
assert.equal(normalizeWorkspaceFlag('unknown'), DESKTOP_WORKSPACE_FLAG.owner);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, flag: DESKTOP_WORKSPACE_FLAG.off }), false);
assert.equal(canUseDesktopWorkspace({ user: { isOwner: true }, flag: DESKTOP_WORKSPACE_FLAG.owner }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'admin' }, flag: DESKTOP_WORKSPACE_FLAG.admin }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, partner: { id: 'p1' }, flag: DESKTOP_WORKSPACE_FLAG.partner }), true);
assert.equal(canUseDesktopWorkspace({ user: { role: 'user' }, expert: { id: 'e1' }, flag: DESKTOP_WORKSPACE_FLAG.expert }), true);
assert.deepEqual(getWorkspaceUserRoles({ user: { role: 'super_admin' }, partner: { id: 'p1' } }).sort(), ['admin', 'partner']);

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
