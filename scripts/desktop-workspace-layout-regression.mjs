import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDesktopWorkspaceLayoutPlan, WORKSPACE_LAYOUT, WORKSPACE_Z } from '../src/workspace/WorkspaceLayoutEngine.js';

const viewports = [
  [1024, 768],
  [1180, 820],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1512, 982],
  [1728, 1117],
  [1920, 1080],
];

for (const [width, height] of viewports) {
  const plan = getDesktopWorkspaceLayoutPlan(width, height, false);
  assert.equal(plan.hasHorizontalOverflow, false, `${width}x${height}: layout must not overflow horizontally`);
  assert.ok(plan.workAreaHeight >= 520, `${width}x${height}: workspace work area is too short`);
  assert.ok(plan.sidebarWidth >= WORKSPACE_LAYOUT.collapsedSidebar, `${width}x${height}: sidebar width is invalid`);

  if (width < WORKSPACE_LAYOUT.drawerBelow) {
    assert.equal(plan.aiAsDrawer, true, `${width}x${height}: AI Workspace must become drawer`);
    assert.equal(plan.effectiveSidebarCollapsed, true, `${width}x${height}: sidebar must collapse on narrow desktop`);
  } else {
    assert.equal(plan.aiAsDrawer, false, `${width}x${height}: AI Workspace must be independent column`);
    assert.ok(plan.aiPanelWidth >= WORKSPACE_LAYOUT.aiMin, `${width}x${height}: AI panel below min width`);
  }

  assert.equal(plan.contentReadable, true, `${width}x${height}: content column is below readable width`);
}

assert.ok(WORKSPACE_Z.header < WORKSPACE_Z.drawer, 'drawer must be above header');
assert.ok(WORKSPACE_Z.drawer < WORKSPACE_Z.popover, 'popover must be above drawer');
assert.ok(WORKSPACE_Z.popover < WORKSPACE_Z.modal, 'modal must be top workspace layer');

const lokiAsset = resolve(process.cwd(), 'public/loki.png');
assert.ok(existsSync(lokiAsset), 'Loki asset public/loki.png must exist');
assert.ok(statSync(lokiAsset).size > 1024, 'Loki asset must not be an empty placeholder');

console.log('Desktop Workspace layout regression smoke passed');
