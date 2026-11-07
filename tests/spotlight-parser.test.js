import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpotlightInput } from '../js/spotlight/parser.js';

const now = new Date(2026, 10, 7, 10, 0);
const parse = (input) => parseSpotlightInput(input, now);

test('forced modes, cleaned titles, and priority', () => {
  const parsed = parse('task finish physics homework tomorrow 5pm urgent');
  assert.equal(parsed.type, 'task');
  assert.equal(parsed.title, 'Finish Physics Homework');
  assert.equal(parsed.priority, 'urgent');
  assert.equal(parsed.time.hour, 17);
  assert.equal(parsed.dueDate, '2026-11-08');
  assert.ok(parsed.scheduledDateTime);
});

test('supports exam, event, reminder, and focus intents', () => {
  assert.equal(parse('exam chemistry monday 8am').type, 'exam');
  assert.equal(parse('event annual function 25 december').dueDate, '2026-12-25');
  assert.equal(parse('reminder call sir at 7pm').title, 'Call Sir');
  assert.equal(parse('focus deep work 9pm').time.hour, 21);
});

test('supports numeric and relative dates', () => {
  assert.equal(parse('event 12/06/2026').dueDate, '2026-06-12');
  assert.equal(parse('event 12-06-2026').dueDate, '2026-06-12');
  assert.equal(parse('event annual function 25 dec').dueDate, '2026-12-25');
  assert.equal(parse('event june 12').dueDate, '2027-06-12');
  assert.equal(parse('task after 3 days').dueDate, '2026-11-10');
  assert.equal(parse('task next week').dueDate, '2026-11-14');
  assert.equal(parse('task this saturday').dueDate, '2026-11-07');
  assert.equal(parse('task next monday').dueDate, '2026-11-09');
});

test('supports exact and vague time phrases', () => {
  assert.equal(parse('meeting with sir friday 2:30pm').time.hour, 14);
  assert.equal(parse('meeting with sir friday 2:30pm').time.minute, 30);
  assert.equal(parse('meeting tomorrow at 17:30').time.hour, 17);
  assert.equal(parse('meeting tomorrow at 17:30').time.minute, 30);
  assert.equal(parse('task 7 in evening').time.hour, 19);
  assert.equal(parse('task tomorrow morning').time.hour, 9);
  assert.equal(parse('task tonight').time.hour, 21);
  assert.equal(parse('task noon').time.hour, 12);
  assert.equal(parse('task midnight').time.hour, 0);
});

test('handles shorthand and unclear bare hours safely', () => {
  const parsed = parse('tas phy hw tomrrow 5');
  assert.equal(parsed.type, 'task');
  assert.equal(parsed.title, 'Physics Homework');
  assert.equal(parsed.dueDate, '2026-11-08');
  assert.equal(parsed.time, null);
  assert.ok(parsed.confidence < 0.6);
  assert.match(parsed.clarification, /ambiguous/);
});

test('does not interpret numbers inside titles as times', () => {
  const parsed = parse('task unit 2 homework tomorrow');
  assert.equal(parsed.title, 'Unit 2 Homework');
  assert.equal(parsed.time, null);
});

test('stores capture scheduling separately and handles offsets/tags', () => {
  const parsed = parse('reminder meeting tomorrow 5pm 30 minutes before #work high');
  assert.ok(parsed.scheduledDateTime);
  assert.equal(Date.parse(parsed.scheduledDateTime) - Date.parse(parsed.reminderAtDateTime), 30 * 60 * 1000);
  assert.deepEqual(parsed.tags, ['work']);
  assert.equal(parsed.priority, 'high');
});

test('date-only items have a scheduled date but no reminder clock time', () => {
  const parsed = parse('task buy notebook today');
  assert.ok(parsed.scheduledDateTime);
  assert.equal(parsed.scheduledHasTime, false);
  assert.equal(parsed.reminderAtDateTime, null);
});

test('recognizes immediate focus intent and preserves explicit time', () => {
  assert.equal(parse('focus coding now').launchNow, true);
  assert.equal(parse('task now at 5pm').time.hour, 17);
});
