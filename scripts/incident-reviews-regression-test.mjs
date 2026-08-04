import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appData = readFileSync(new URL('../server/src/routes/app-data.js', import.meta.url), 'utf8');
const partnerPage = readFileSync(new URL('../src/PartnerPage.jsx', import.meta.url), 'utf8');
const userActions = readFileSync(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
const accountService = readFileSync(new URL('../server/src/apg/account/services/AccountCoreService.js', import.meta.url), 'utf8');
const economy = readFileSync(new URL('../server/src/apg/account/repositories/EconomyRepository.js', import.meta.url), 'utf8');

assert.match(appData, /'expertReviews'/, 'Public expert reviews must be readable.');
assert.match(appData, /collectionName === 'reviews'/, 'Nested partner reviews must have an explicit public-read rule.');
assert.match(appData, /\['partners', 'experts'\]\.includes\(publicParts\[0\]\)/, 'Only supported public profile review paths may be read.');
assert.match(partnerPage, /PartnerPage\.refreshReviewsAfterSubmit/, 'Post-submit refresh must be best-effort.');
assert.match(partnerPage, /setReviews\(previous => \[savedReview/, 'Successful review response must update UI before refresh.');
assert.match(userActions, /idempotencyKey: `review:partner:\$\{partnerId\}:\$\{userId\}`/, 'Review reward must be idempotent.');
assert.match(userActions, /idempotencyKey: `review:expert:\$\{expertId\}:\$\{userId\}`/, 'Expert review reward must be idempotent.');
assert.match(accountService, /async awardAction\(payload\)/, 'Account Core must expose action rewards.');
assert.match(economy, /async awardAction\(/, 'Postgres economy must persist action rewards.');

console.log('incident-reviews-regression-test: ok');
