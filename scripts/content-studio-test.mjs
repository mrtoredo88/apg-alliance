import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('src/components/ContentStudio.jsx', 'utf8');
const partner = fs.readFileSync('src/PartnerCabinetPage.jsx', 'utf8');
const expert = fs.readFileSync('src/ExpertCabinetPage.jsx', 'utf8');
const upload = fs.readFileSync('src/PhotoUpload.jsx', 'utf8');

assert.match(studio, /export function ContentStudio/, 'ContentStudio must be a shared component');
assert.match(studio, /apg_content_studio_draft_/, 'ContentStudio must persist local drafts for recovery');
assert.match(studio, /Найден несохранённый черновик/, 'Draft Recovery prompt must be visible');
assert.match(studio, /STATUS_LABELS/, 'ContentStudio must expose visible editing statuses');
assert.match(studio, /workspaceNews:save/, 'ContentStudio must publish through existing workspaceNews save action');
assert.match(studio, /workspaceNews:submit/, 'ContentStudio must submit to APG through existing moderation action');
assert.match(studio, /UniversalFeedCard/, 'Preview must reuse Feed Framework card');
assert.match(studio, /PhotoUpload/, 'Cover media must use existing PhotoUpload');
assert.match(studio, /GalleryUpload/, 'Gallery media must use existing GalleryUpload');
assert.match(studio, /Content Health/, 'Content Health recommendations must be present');
assert.match(studio, /AI Ready/, 'AI extension points must be present');
assert.match(studio, /datetime-local/, 'Scheduling UI must support date and time');
assert.match(studio, /beforeunload/, 'Unsaved draft guard must be present');

assert.match(partner, /import \{ ContentStudio \}/, 'Partner cabinet must import ContentStudio');
assert.match(partner, /<ContentStudio profile=\{partner\} role="partner"/, 'Partner content tab must render ContentStudio');
assert.match(expert, /import \{ ContentStudio \}/, 'Expert cabinet must import ContentStudio');
assert.match(expert, /<ContentStudio profile=\{expert\} role="expert"/, 'Expert content tab must render ContentStudio');

assert.match(upload, /onDrop=\{e => \{ e\.preventDefault\(\); setDragging\(false\); uploadMany\(e\.dataTransfer\.files\); \}\}/, 'GalleryUpload must support drag and drop');

console.log('Content Studio V1 regression test passed');
