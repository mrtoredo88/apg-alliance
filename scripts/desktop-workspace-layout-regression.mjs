import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
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
  assert.equal(WORKSPACE_LAYOUT.collapsedSidebar, 76, 'collapsed sidebar must keep compact polished icon rail width');

  if (width < WORKSPACE_LAYOUT.drawerBelow) {
    assert.equal(plan.aiAsDrawer, true, `${width}x${height}: AI Workspace must become drawer`);
    assert.equal(plan.effectiveSidebarCollapsed, true, `${width}x${height}: sidebar must collapse on narrow desktop`);
    assert.equal(plan.sidebarWidth, WORKSPACE_LAYOUT.collapsedSidebar, `${width}x${height}: drawer breakpoint must use icon rail`);
  } else {
    assert.equal(plan.aiAsDrawer, false, `${width}x${height}: AI Workspace must be independent column`);
    assert.ok(plan.aiPanelWidth >= WORKSPACE_LAYOUT.aiMin, `${width}x${height}: AI panel below min width`);
  }

  if (width >= WORKSPACE_LAYOUT.forceCollapsedBelow) {
    assert.equal(plan.sidebarWidth, WORKSPACE_LAYOUT.expandedSidebar, `${width}x${height}: full desktop must use expanded sidebar`);
  }

  assert.equal(plan.contentReadable, true, `${width}x${height}: content column is below readable width`);
}

assert.ok(WORKSPACE_Z.header < WORKSPACE_Z.drawer, 'drawer must be above header');
assert.ok(WORKSPACE_Z.drawer < WORKSPACE_Z.popover, 'popover must be above drawer');
assert.ok(WORKSPACE_Z.popover < WORKSPACE_Z.modal, 'modal must be top workspace layer');

const lokiAsset = resolve(process.cwd(), 'public/loki.png');
assert.ok(existsSync(lokiAsset), 'Loki asset public/loki.png must exist');
assert.ok(statSync(lokiAsset).size > 1024, 'Loki asset must not be an empty placeholder');
const lokiIdentitySource = readFileSync(resolve(process.cwd(), 'src/loki/LokiIdentity.jsx'), 'utf8');
assert.ok(lokiIdentitySource.includes("LOKI_CANONICAL_ASSET = '/loki.png'"), 'LokiIdentity must use canonical Loki asset');
assert.ok(lokiIdentitySource.includes("backgroundSize: '285%'"), 'LokiIdentity must use canonical Loki crop size');
assert.ok(lokiIdentitySource.includes("backgroundPosition: '50% 23%'"), 'LokiIdentity must use canonical Loki crop position');
assert.ok(!lokiIdentitySource.includes('<img'), 'LokiIdentity must not render the full poster as img');
for (const state of ['thinking', 'answering', 'listening', 'waiting', 'recommending']) {
  assert.ok(lokiIdentitySource.includes(`${state}:`), `LokiIdentity must support ${state} state`);
}
const visualLokiFiles = [
  'src/loki/LokiAssistant.jsx',
  'src/loki/LokiExperience.jsx',
  'src/LokiPage.jsx',
  'src/assistant/AssistantMiniApp.jsx',
  'src/cabinet/CabinetCorePage.jsx',
  'src/PartnerCabinetPage.jsx',
  'src/ExpertCabinetPage.jsx',
  'src/workspace/DesktopWorkspace.jsx',
  'src/businessHub/BusinessHub.jsx',
];
for (const file of visualLokiFiles) {
  const source = readFileSync(resolve(process.cwd(), file), 'utf8');
  assert.ok(!source.includes("url(/loki.png)") && !source.includes("'🦊'") && !source.includes('>🦊<'), `${file}: visual Loki must use LokiIdentity`);
}
const desktopWorkspaceSource = readFileSync(resolve(process.cwd(), 'src/workspace/DesktopWorkspace.jsx'), 'utf8');
assert.ok(desktopWorkspaceSource.includes('NewsCard'), 'Desktop Workspace must reuse NewsCard');
assert.ok(desktopWorkspaceSource.includes('EventPosterCard'), 'Desktop Workspace must reuse EventPosterCard');
assert.ok(desktopWorkspaceSource.includes('data-workspace-shell="theme-aware-saas"'), 'Desktop Workspace shell must be theme-aware');
assert.ok(desktopWorkspaceSource.includes("background: 'var(--apg-workspace-root-bg)'"), 'Desktop Workspace root must use theme workspace background token');
assert.ok(!desktopWorkspaceSource.includes('data-workspace-shell="light-saas"'), 'Desktop Workspace must not force the light shell');
const indexCssSource = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
assert.ok(indexCssSource.includes('--apg-workspace-root-bg'), 'Theme CSS must expose Workspace background tokens');
assert.ok(indexCssSource.includes('[data-theme="dark"]') && indexCssSource.includes('--apg-workspace-page: #0F0F0F'), 'Dark theme must define Workspace palette');

console.log('Desktop Workspace layout regression smoke passed');
