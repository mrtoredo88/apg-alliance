import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getWorkspaceNavigation,
  WORKSPACE_MODES,
} from '../src/workspace/WorkspaceCore.js';
import { getPrimaryRole, normalizeRole } from '../src/roleEngine.js';

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

assert.equal(getPrimaryRole({ role: 'super_admin' }), 'super_admin');
assert.equal(normalizeRole('administrator'), 'admin');

const userAppSource = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');
const lokiAssistantSource = readFileSync(new URL('../src/loki/LokiAssistant.jsx', import.meta.url), 'utf8');
const workspaceCoreSource = readFileSync(new URL('../src/workspace/WorkspaceCore.js', import.meta.url), 'utf8');
assert.match(userAppSource, /restoreHomeCache\(\)/);
assert.match(userAppSource, /restoredHomeCache\.values\.news[\s\S]*isNotArchived\(item\) && isPublicContent\(item\)/);
assert.match(userAppSource, /restoredHomeCache\.values\.events[\s\S]*isPublicContent\(item\) \|\| normalizeContentStatus\(item\) === 'completed'/);
assert.match(userAppSource, /UserApp Branch/);
assert.match(userAppSource, /'serviceWorker' in navigator/);
assert.match(lokiAssistantSource, /data-floating-messages-button/);
assert.match(lokiAssistantSource, /zIndex: 10040/);
assert.doesNotMatch(workspaceCoreSource, /id: 'messages',[\s\S]{0,160}regions: \[WORKSPACE_REGIONS\.bottomBar\]/);

console.log('PWA User Mode regression passed');
