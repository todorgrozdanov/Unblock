import assert from 'node:assert/strict'
import test from 'node:test'
import {
  slotDateKey,
  monthCells,
  monthStart,
  moveMonth,
} from '../src/booking/calendar.ts'

test('slot dates use Skopje even across UTC midnight', () => {
  assert.equal(slotDateKey('2027-01-15T23:30:00Z'), '2027-01-16')
  assert.equal(slotDateKey('2027-07-15T22:30:00Z'), '2027-07-16')
})
test('both autumn occurrences belong to the same calendar date', () => {
  assert.equal(slotDateKey('2027-10-31T00:30:00Z'), '2027-10-31')
  assert.equal(slotDateKey('2027-10-31T01:30:00Z'), '2027-10-31')
})
test('calendar includes leap days and whole Monday-first weeks', () => {
  const cells = monthCells('2028-02-01')
  assert.equal(cells.length % 7, 0)
  assert.equal(cells[0], null)
  assert.equal(cells[1], '2028-02-01')
  assert.equal(cells.filter(Boolean).length, 29)
})
test('month navigation crosses year boundaries', () => {
  assert.equal(monthStart('2027-12-31'), '2027-12-01')
  assert.equal(moveMonth('2027-12-01', 1), '2028-01-01')
  assert.equal(moveMonth('2028-01-01', -1), '2027-12-01')
})
