import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sanitizeWorkspaceEventPatch } from '../server-shared/workspace-events.js';

const [ui, api] = await Promise.all([
  readFile(new URL('../src/workspace/WorkspaceEventsManager.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8'),
]);

assert.deepEqual(
  sanitizeWorkspaceEventPatch({ priceType: 'paid', price: 750, priceIsFrom: true }),
  { priceType: 'paid', price: 750, priceIsFrom: true },
);
assert.deepEqual(
  sanitizeWorkspaceEventPatch({ priceType: 'free', price: 750, priceIsFrom: true }),
  { priceType: 'free', price: 0, priceIsFrom: false },
);

assert.match(ui, /checked=\{draft\.priceIsFrom\}[\s\S]*?Цена «от»/);
assert.match(ui, /workspace:eventUpdate'[\s\S]*?publishImmediately: true/);
assert.match(api, /const publishImmediately = publicEvent && req\.body\?\.publishImmediately === true/);
assert.match(api, /status: 'published', lifecycleStatus: 'published', contentStatus: 'published'/);
assert.match(api, /active: true, published: true, pendingWorkspacePatch: null/);
assert.match(api, /pendingModeration: publicEvent && !publishImmediately/);

console.log('Partner published-event editing: ok');
