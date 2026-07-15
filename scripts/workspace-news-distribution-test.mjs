import assert from 'node:assert/strict';
import {
  buildApgNewsDistributionPatch,
  buildProfileOnlyNewsPatch,
  buildWorkspaceNewsFromEvent,
  isApgNewsPublication,
  isProfileOnlyNews,
  normalizeWorkspaceNewsDistribution,
  sanitizeWorkspaceNewsPatch,
} from '../server-shared/workspace-news.js';

const profilePatch = buildProfileOnlyNewsPatch();
assert.equal(normalizeWorkspaceNewsDistribution(profilePatch), 'profile', 'profile patch must resolve as profile-only');
assert.equal(isProfileOnlyNews(profilePatch), true, 'profile patch must be profile-only');
assert.equal(isApgNewsPublication(profilePatch), false, 'profile patch must not be APG news');

const apgPatch = buildApgNewsDistributionPatch();
assert.equal(normalizeWorkspaceNewsDistribution(apgPatch), 'apg', 'APG patch must resolve as APG news');
assert.equal(isApgNewsPublication(apgPatch), true, 'APG patch must be visible in common APG feed');
assert.equal(isProfileOnlyNews(apgPatch), false, 'APG patch must not be profile-only');

const workspaceProfileNews = {
  id: 'n-profile',
  source: 'workspace',
  ownerProfileId: 'partner-1',
  status: 'published',
  active: true,
};
assert.equal(normalizeWorkspaceNewsDistribution(workspaceProfileNews), 'profile', 'workspace-owned saved publication defaults to profile-only');

const submittedWorkspaceNews = {
  ...workspaceProfileNews,
  submittedAt: '2026-07-15T10:00:00.000Z',
  submittedByUserId: 'user-1',
};
assert.equal(normalizeWorkspaceNewsDistribution(submittedWorkspaceNews), 'apg', 'submitted workspace publication becomes APG candidate');

const legacyAdminNews = {
  id: 'legacy-news',
  source: 'admin',
  status: 'published',
  active: true,
};
assert.equal(normalizeWorkspaceNewsDistribution(legacyAdminNews), 'apg', 'legacy public news must remain in APG feed');

const sanitized = sanitizeWorkspaceNewsPatch({
  title: 'Летнее меню',
  distributionMode: 'profile',
  visibility: 'profile',
  publishScope: 'profile',
  apgPublication: false,
  profileOnly: true,
  unexpected: 'ignored',
});
assert.deepEqual(
  {
    distributionMode: sanitized.distributionMode,
    visibility: sanitized.visibility,
    publishScope: sanitized.publishScope,
    apgPublication: sanitized.apgPublication,
    profileOnly: sanitized.profileOnly,
  },
  profilePatch,
  'sanitizer must preserve distribution fields and ignore unknown fields',
);
assert.equal(Object.hasOwn(sanitized, 'unexpected'), false, 'sanitizer must ignore unknown fields');

const eventPublication = buildWorkspaceNewsFromEvent(
  {
    id: 'event-1',
    title: 'Нетворкинг',
    description: 'Встречаемся вечером',
    startAt: '2026-07-22T19:00:00.000Z',
  },
  { id: 'partner-1', name: 'Coffee House' },
  'partner',
);
assert.equal(isProfileOnlyNews(eventPublication), true, 'publication created from event must start in profile timeline only');
assert.equal(isApgNewsPublication(eventPublication), false, 'publication created from event must not enter common APG feed automatically');

console.log('workspace-news-distribution-test: ok');
