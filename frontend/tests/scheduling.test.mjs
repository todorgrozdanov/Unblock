import assert from 'node:assert/strict'
import test from 'node:test'
import { getTimeOptions, isFutureInstant } from '../src/host/scheduling.ts'

test('winter and summer conversions use Skopje, independently of the system timezone', () => {
  assert.deepEqual(getTimeOptions('2027-01-15', '10:00'), [
    { instant: '2027-01-15T09:00:00Z', offset: '+01:00' },
  ])
  assert.deepEqual(getTimeOptions('2027-07-15', '10:00'), [
    { instant: '2027-07-15T08:00:00Z', offset: '+02:00' },
  ])
})
test('rejects nonexistent spring-forward local times instead of shifting them', () => {
  assert.throws(() => getTimeOptions('2027-03-28', '02:30'), /does not exist/)
})
test('returns both occurrences of an ambiguous autumn local time', () => {
  assert.deepEqual(getTimeOptions('2027-10-31', '02:30'), [
    { instant: '2027-10-31T00:30:00Z', offset: '+02:00' },
    { instant: '2027-10-31T01:30:00Z', offset: '+01:00' },
  ])
})
test('rejects malformed dates, calendar overflows, and invalid times', () => {
  for (const [date, time] of [
    ['', '10:00'],
    ['2027-02-30', '10:00'],
    ['2027-01-15', '25:00'],
    ['2027-01-15', '10:00Z'],
  ]) {
    assert.throws(() => getTimeOptions(date, time), /valid date and start time/)
  }
})
test('only future instants pass the future-time check', () => {
  assert.equal(isFutureInstant('2000-01-01T00:00:00Z'), false)
  assert.equal(isFutureInstant('2099-01-01T00:00:00Z'), true)
  assert.equal(isFutureInstant('invalid'), false)
})
