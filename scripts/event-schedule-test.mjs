import {
  buildDaySlots,
  findEventConflicts,
  findFreeWindows,
  getEventInterval,
} from '../src/eventSchedule.js';

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failed += 1;
    console.error(`✗ ${name}\n  ожидалось: ${JSON.stringify(expected)}\n  получено:  ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

const day = '2026-07-22';
const ev = (id, from, to, extra = {}) => ({
  id,
  title: id,
  startAt: `${day}T${from}:00`,
  endAt: to ? `${day}T${to}:00` : null,
  ...extra,
});

const slotStates = (events, fromHour, toHour) =>
  buildDaySlots(events, new Date(`${day}T12:00:00`), fromHour, toHour).map(s => `${s.hour}:${s.state}`);

// 1. Событие 11:00–16:00 занимает часы 11..15, 16:00 свободен
check('11:00–16:00 занимает 11–15, 16 свободен',
  slotStates([ev('a', '11:00', '16:00')], 10, 18),
  ['10:free', '11:busy', '12:busy', '13:busy', '14:busy', '15:busy', '16:free', '17:free']);

// 2. 10:30–12:30 — частичная занятость 10 и 12, полная 11
check('10:30–12:30 → 10 частично, 11 занято, 12 частично',
  slotStates([ev('b', '10:30', '12:30')], 10, 13),
  ['10:partial', '11:busy', '12:partial']);

// 3. 09:00–09:30 — частично занят 9:00
check('09:00–09:30 → 9 частично',
  slotStates([ev('c', '09:00', '09:30')], 9, 11),
  ['9:partial', '10:free']);

// 4. 18:00–22:00 занимает 18..21
check('18:00–22:00 занимает 18–21',
  slotStates([ev('d', '18:00', '22:00')], 17, 22),
  ['17:free', '18:busy', '19:busy', '20:busy', '21:busy']);

// 5. Подряд идущие события без пересечений
const seq = [ev('m1', '10:00', '12:00'), ev('m2', '12:00', '14:00')];
check('подряд идущие 10–12 и 12–14 не конфликтуют',
  findEventConflicts(seq, new Date(`${day}T12:00:00`), new Date(`${day}T14:00:00`), 'm2').map(e => e.id),
  []);
check('подряд идущие занимают 10–13 полностью',
  slotStates(seq, 10, 15),
  ['10:busy', '11:busy', '12:busy', '13:busy', '14:free']);

// 6. Пересекающиеся события находятся
check('11–16 конфликтует с новым 15:00–17:00',
  findEventConflicts([ev('a', '11:00', '16:00')], new Date(`${day}T15:00:00`), new Date(`${day}T17:00:00`)).map(e => e.id),
  ['a']);
check('11–16 НЕ конфликтует с новым 16:00–17:00 (полуинтервал)',
  findEventConflicts([ev('a', '11:00', '16:00')], new Date(`${day}T16:00:00`), new Date(`${day}T17:00:00`)).map(e => e.id),
  []);

// 7. Изменение времени: событие не конфликтует само с собой (excludeId)
check('редактирование не конфликтует с самим собой',
  findEventConflicts([ev('a', '11:00', '16:00')], new Date(`${day}T11:00:00`), new Date(`${day}T16:00:00`), 'a').map(e => e.id),
  []);

// 8. Удаление события освобождает интервалы (deleted/archived игнорируются)
check('удалённое событие освобождает слоты',
  slotStates([ev('a', '11:00', '16:00', { status: 'deleted' })], 11, 13),
  ['11:free', '12:free']);
check('архивное событие освобождает слоты',
  slotStates([ev('a', '11:00', '16:00', { lifecycleStatus: 'archived' })], 11, 13),
  ['11:free', '12:free']);

// 9. Событие без endAt занимает 1 час по умолчанию
check('событие без конца занимает 1 час',
  slotStates([ev('e', '11:00', null)], 10, 13),
  ['10:free', '11:busy', '12:free']);

// 10. Свободные окна между мероприятиями
const windows = findFreeWindows(buildDaySlots([ev('a', '11:00', '13:00'), ev('b', '15:00', '16:00')], new Date(`${day}T12:00:00`), 9, 18));
check('свободные окна: 9–11, 13–15, 16–18',
  windows,
  [{ from: 9, to: 11 }, { from: 13, to: 15 }, { from: 16, to: 18 }]);

// 11. Интервал события парсится из Timestamp-подобных значений
const tsLike = { startAt: { toDate: () => new Date(`${day}T11:00:00`) }, endAt: { toDate: () => new Date(`${day}T16:00:00`) } };
const interval = getEventInterval(tsLike);
check('Timestamp-подобные значения поддерживаются',
  [interval.start.getHours(), interval.end.getHours()],
  [11, 16]);

if (failed) {
  console.error(`\n${failed} проверок провалено`);
  process.exit(1);
}
console.log('\nВсе проверки расчёта занятости календаря пройдены.');
