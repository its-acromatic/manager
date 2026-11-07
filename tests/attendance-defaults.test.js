import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DayStatus,
  defaultStatusForDateISO,
  generateSessionDayObjects
} from '../js/attendance/engine.js';

test('unseeded dates remain unmarked, including weekend dates', () => {
  const days = generateSessionDayObjects('2026-11-01', '2026-11-30');
  assert.equal(days.length, 30);
  assert.ok(days.every((day) => day.status === DayStatus.UNMARKED));
});

test('seed defaults still mark Sundays and second/fourth Saturdays off', () => {
  assert.equal(defaultStatusForDateISO('2026-11-01'), DayStatus.OFF);
  assert.equal(defaultStatusForDateISO('2026-11-14'), DayStatus.OFF);
  assert.equal(defaultStatusForDateISO('2026-11-28'), DayStatus.OFF);
  assert.equal(defaultStatusForDateISO('2026-11-07'), DayStatus.UNMARKED);
});

test('saved attendance overrides remain visible for generated dates', () => {
  const days = generateSessionDayObjects('2026-11-01', '2026-11-02', {
    '2026-11-01': { status: DayStatus.PRESENT, meta: { note: 'Marked present' } }
  });
  assert.equal(days[0].status, DayStatus.PRESENT);
  assert.deepEqual(days[0].meta, { note: 'Marked present' });
  assert.equal(days[1].status, DayStatus.UNMARKED);
});
