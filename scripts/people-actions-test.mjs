import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPeopleRows, PEOPLE_RELATION_STATUS } from '../src/social/PeopleCore.js';

const profile = await readFile(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');

const actor = { id: 'email:owner@example.com', displayName: 'Mr. TOREDO' };
const anna = { id: 'email:anna@example.com', displayName: 'Анна Белова', company: 'Bell Pub' };
const maxim = { id: 'email:maxim@example.com', displayName: 'Максим Иванов', role: 'Юрист' };
const tatyana = { id: 'email:tatyana@example.com', displayName: 'Татьяна Гордеева', role: 'Старший администратор' };

const rows = buildPeopleRows({
  actor,
  users: [anna, maxim, tatyana],
  connections: [
    { id: anna.id, contactUserId: anna.id, status: 'connected', dialogId: '', contact: anna },
    { id: 'email:friend-dialog@example.com', contactUserId: 'email:friend-dialog@example.com', status: 'connected', dialogId: 'direct_existing', contact: { id: 'email:friend-dialog@example.com', displayName: 'Друг с диалогом' } },
  ],
  requests: [
    { id: 'req-out', connection: true, status: 'pending', direction: 'outgoing', senderId: actor.id, recipientId: maxim.id, sender: actor, recipient: maxim },
    { id: 'req-in', connection: true, status: 'pending', direction: 'incoming', senderId: tatyana.id, recipientId: actor.id, sender: tatyana, recipient: actor },
  ],
  dialogs: [{ id: 'direct_existing', type: 'direct', participants: [actor, { id: 'email:friend-dialog@example.com', displayName: 'Друг с диалогом' }] }],
});

assert.equal(rows.find(row => row.id === anna.id)?.relationStatus, PEOPLE_RELATION_STATUS.FRIEND, 'friend without dialog is still a friend');
assert.equal(rows.find(row => row.id === maxim.id)?.relationStatus, PEOPLE_RELATION_STATUS.OUTGOING, 'outgoing request is represented in People');
assert.equal(rows.find(row => row.id === tatyana.id)?.relationStatus, PEOPLE_RELATION_STATUS.INCOMING, 'incoming request is represented in People');
assert.equal(rows.find(row => row.dialogId === 'direct_existing')?.relationStatus, PEOPLE_RELATION_STATUS.FRIEND, 'existing direct dialog stays write-ready');

assert.match(profile, /function profilePersonId/, 'ProfilePanel has stable person id resolver');
assert.match(profile, /const patchPeoplePerson = useCallback/, 'People actions patch local person rows');
assert.match(profile, /setPeopleSearchResults\(prev => prev\.map\(merge\)\)/, 'search result cards update without refresh');
assert.match(profile, /setPeopleSheet\(prev => prev \? merge\(prev\) : prev\)/, 'bottom sheet updates without refresh');
assert.match(profile, /setConnectionTarget\(prev => \{[\s\S]*target: merge\(prev\.target \|\| \{\}\)/, 'connection target context is preserved after action');
assert.match(profile, /userAction\('dialog:open'[\s\S]*type: 'direct'[\s\S]*targetUserId: id/, 'write action opens or creates direct dialog through existing backend action');
assert.match(profile, /if \(person\.relationStatus === PEOPLE_RELATION_STATUS\.FRIEND\) \{[\s\S]*if \(person\.dialogId\) onOpenDialog\?\.\(person\.dialogId\);[\s\S]*else openPersonDialog\(person\);/, 'friend without dialog is not a dead action');
assert.match(profile, /if \(person\.relationStatus === PEOPLE_RELATION_STATUS\.INCOMING && person\.request\?\.id\)[\s\S]*updateConnectionRequest\(person\.request\.id, 'accepted'\)/, 'incoming request primary action accepts request');
assert.match(profile, /if \(person\.relationStatus === PEOPLE_RELATION_STATUS\.STRANGER\)[\s\S]*requestConnection\(person\.id, 'people'\)/, 'stranger primary action sends connection request');
assert.match(profile, /setConnectionRequests\(prev => \[request, \.\.\.prev\.filter/, 'new request is inserted optimistically into request state');
assert.match(profile, /patchPeoplePerson\(id, patch\)/, 'request action patches person state after backend response');
assert.match(profile, /status === 'accepted' && data\.connection[\s\S]*setConnections/, 'accepted request updates local friends state');
assert.match(profile, /patchPeoplePerson\(targetId,[\s\S]*PEOPLE_RELATION_STATUS\.FRIEND/, 'accepted request marks person as friend immediately');
assert.doesNotMatch(profile, /PEOPLE_RELATION_STATUS\.FRIEND && !person\.dialogId/, 'friend without dialog must not disable write button');
assert.match(profile, /role="button" tabIndex=\{0\} onClick=\{\(\) => openPersonProfile\(person\)\}/, 'suggestion card is clickable without nesting a button inside a button');
assert.match(profile, /disabled=\{peopleSheet\.relationStatus === PEOPLE_RELATION_STATUS\.OUTGOING \|\| peopleSheet\.relationStatus === PEOPLE_RELATION_STATUS\.BLOCKED\}/, 'bottom sheet prevents duplicate outgoing requests');
assert.match(profile, /data-people-card/, 'people cards remain available');
assert.match(profile, /data-people-bottom-sheet/, 'people bottom sheet remains available');

console.log('people-actions regression PASS');
