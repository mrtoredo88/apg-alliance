import assert from 'node:assert/strict';
import {
  buildPeopleRows,
  buildPeopleSections,
  peoplePresenceLabel,
  peopleSuggestionReason,
  personInterestTags,
  publicPerson,
  recentPeopleGroups,
  relationStatusForPerson,
  searchPeopleGroups,
} from '../src/social/PeopleCore.js';

assert.doesNotThrow(() => publicPerson(null), 'publicPerson accepts null selectedPerson');
assert.equal(publicPerson(null).displayName, 'Участник АПГ', 'null person becomes safe public fallback');
assert.equal(relationStatusForPerson(null, { actorId: null, connections: [null], requests: [null], blocked: [null] }), 'stranger', 'null person relation is safe');
assert.equal(peoplePresenceLabel(null), '', 'null presence is safe');
assert.equal(peopleSuggestionReason(null), '', 'null recommendation is safe');
assert.deepEqual(personInterestTags(null), [], 'null person tags are safe');

const rows = buildPeopleRows({
  users: [null, { id: 'u1', displayName: 'Анна' }],
  connections: [null, { id: 'u2', status: 'connected', contact: null }],
  requests: [null, { id: 'r1', status: 'pending', senderId: 'u3', recipientId: null, sender: null, recipient: null }],
  dialogs: [null, { id: 'd1', type: 'direct', participants: [null, { id: 'u4', displayName: 'Максим' }], context: null }],
  blocked: [null],
  actor: null,
});

assert.ok(Array.isArray(rows), 'buildPeopleRows returns rows with null currentUser');
assert.ok(rows.every(row => row && row.id), 'null inputs do not create empty people rows');
assert.ok(rows.find(row => row.displayName === 'Анна'), 'valid user remains visible');
assert.ok(rows.find(row => row.displayName === 'Максим'), 'valid dialog participant remains visible');

assert.doesNotThrow(() => buildPeopleSections({ people: [null, ...rows], pinnedIds: [null, 'u1'] }), 'sections tolerate null recommendations');
assert.doesNotThrow(() => recentPeopleGroups([null, ...rows]), 'recent people tolerates null rows');
assert.doesNotThrow(() => searchPeopleGroups({ query: 'анна', people: [null, ...rows], partners: [null], experts: [null], events: [null] }), 'search tolerates null groups');

console.log('people-null-safety regression PASS');
