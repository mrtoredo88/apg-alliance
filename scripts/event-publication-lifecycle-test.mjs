import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventPublicationReadiness } from '../server-shared/event-publication.js';
import { isLifecyclePublic, normalizeContentStatus } from '../server-shared/content-lifecycle.js';

const [eventSheetSource, adminSource] = await Promise.all([
  readFile(new URL('../src/EventDetailSheet.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8'),
]);

assert.match(eventSheetSource, /isRegistered \? 'Вы идёте · отменить' : 'Я пойду'/);
assert.doesNotMatch(eventSheetSource, /Зарегистрироваться/);
assert.match(adminSource, /const text = value => String\(value \?\? ''\)\.trim\(\);/);
assert.match(adminSource, /setESaving\(true\);\s*try \{\s*const data = \{/);
assert.match(adminSource, /finally \{\s*setESaving\(false\);\s*\}/);
assert.match(adminSource, /window\.alert\(`Не удалось сохранить событие:/);

const vedogonEvent = {
  title: 'Спектакль театра «Ведогонь»',
  partner: 'Театр «Ведогонь»',
  coverPhoto: 'https://example.test/vedogon.jpg',
  description: 'Премьера спектакля театра «Ведогонь» для жителей Зеленограда и гостей города. Подробности программы, состава и условий посещения указаны в карточке.',
  startAt: '2026-09-12T16:00:00+03:00',
  location: 'Театр «Ведогонь»',
  category: 'culture',
};

assert.deepEqual(eventPublicationReadiness(vedogonEvent), { ready: true, blockers: [], warnings: [] });

const incomplete = eventPublicationReadiness({ title: 'Событие', startAt: vedogonEvent.startAt });
assert.equal(incomplete.ready, false);
assert.deepEqual(incomplete.blockers.map(item => item.code), ['cover', 'organizer', 'description']);

const warningOnly = eventPublicationReadiness({ ...vedogonEvent, description: 'Короткое описание', category: '', location: '' });
assert.equal(warningOnly.ready, true);
assert.deepEqual(warningOnly.warnings.map(item => item.code), ['short_description', 'category', 'location']);

const approved = { ...vedogonEvent, active: false, published: false, verified: true, status: 'approved', lifecycleStatus: 'draft' };
assert.equal(normalizeContentStatus(approved), 'draft');
assert.equal(isLifecyclePublic(approved), false);

const published = { ...approved, active: true, published: true, status: 'published', lifecycleStatus: 'published' };
assert.equal(normalizeContentStatus(published), 'published');
assert.equal(isLifecyclePublic(published), true);

console.log('event publication lifecycle: ok');
