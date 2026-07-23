import assert from 'node:assert/strict';
import fs from 'node:fs';

const glass = fs.readFileSync(new URL('../src/components/Apg2ProfileGlass.jsx', import.meta.url), 'utf8');
const partnerCabinet = fs.readFileSync(new URL('../src/PartnerCabinetPage.jsx', import.meta.url), 'utf8');
const expertCabinet = fs.readFileSync(new URL('../src/ExpertCabinetPage.jsx', import.meta.url), 'utf8');
const actions = fs.readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');

assert.match(glass, /Читать полностью/, 'Long reviews must expose a full-text control.');
assert.match(glass, /ownerReply\?\.text/, 'Public review cards must render an owner reply.');
assert.match(partnerCabinet, /profileType: 'partner'[\s\S]*ReviewReplyEditor/, 'Partner cabinet must support review replies.');
assert.match(expertCabinet, /profileType: 'expert'[\s\S]*ReviewReplyEditor/, 'Expert cabinet must support review replies.');
assert.match(actions, /async function actionReviewReply/, 'The server must implement review replies.');
assert.match(actions, /assertOwnedProfile\(db, actor, profileType, profileId\)/, 'Only profile owners may reply.');
assert.match(actions, /if \(action === 'review:reply'\)/, 'The review reply action must be registered.');

console.log('review-replies-test: ok');
