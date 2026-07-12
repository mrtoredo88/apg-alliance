import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getWorkspaceNavigation,
  normalizeWorkspaceRole,
  WORKSPACE_MODES,
} from '../src/workspace/WorkspaceCore.js';

const expectedUserModePanels = ['home', 'offers', null, 'experts', 'profile'];

for (const role of ['user', 'owner', 'super_admin', 'administrator']) {
  const nav = getWorkspaceNavigation({ mode: WORKSPACE_MODES.mobile, role });
  assert.equal(nav.placement, 'bottom', `PWA User Mode must use bottom navigation for ${role}`);
  assert.deepEqual(
    nav.primary.map(item => item.panelId),
    expectedUserModePanels,
    `PWA User Mode navigation must not disappear after Email auth role=${role}`,
  );
}

assert.equal(normalizeWorkspaceRole('super_admin'), 'owner');
assert.equal(normalizeWorkspaceRole('administrator'), 'admin');

const userAppSource = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
assert.match(userAppSource, /readCachedArray\('apg_news_cache'\)\.filter\(item => isNotArchived\(item\) && isPublicContent\(item\)\)/);
assert.match(userAppSource, /readCachedArray\('apg_events_cache'\)[\s\S]*isPublicContent\(item\) \|\| normalizeContentStatus\(item\) === 'completed'/);
assert.match(userAppSource, /UserApp Branch/);
assert.match(userAppSource, /Service Worker/);

console.log('PWA User Mode regression passed');
