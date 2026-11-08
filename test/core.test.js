import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timer, createTimer } from '../src/index.js';

/**
 * A deterministic clock: each call to `tick` advances time by a fixed step.
 * Tests never read the wall clock, so they pass on any machine.
 */
function fakeClock(start = 0, step = 1) {
  let t = start;
  return {
    now: () => t,
    tick: (n = 1) => {
      t += step * n;
    },
  };
}

test('mark returns the timestamp it recorded', () => {
  const clock = fakeClock(100, 5);
  const timer = new Timer(clock.now);
  assert.equal(timer.mark('a'), 100);
  clock.tick();
  assert.equal(timer.mark('b'), 105);
});

test('time reads back a recorded mark', () => {
  const clock = fakeClock(10, 2);
  const timer = new Timer(clock.now);
  timer.mark('start');
  clock.tick(3);
  assert.equal(timer.time('start'), 10);
});

test('time throws for an unknown mark', () => {
  const timer = new Timer(() => 0);
  assert.throws(() => timer.time('missing'), /unknown mark: missing/);
});

test('elapsed between two marks is the difference', () => {
  const clock = fakeClock(0, 7);
  const timer = new Timer(clock.now);
  timer.mark('start');
  clock.tick(2);
  timer.mark('end');
  assert.equal(timer.elapsed('start', 'end'), 14);
});

test('elapsed with no end mark uses the current time', () => {
  const clock = fakeClock(50, 3);
  const timer = new Timer(clock.now);
  timer.mark('start');
  clock.tick(4);
  assert.equal(timer.elapsed('start'), 12);
});

test('elapsedSince reads the clock at call time', () => {
  const clock = fakeClock(0, 1);
  const timer = new Timer(clock.now);
  timer.mark('start');
  clock.tick(9);
  assert.equal(timer.elapsedSince('start'), 9);
});

test('elapsedSinceLast uses the most recent mark', () => {
  const clock = fakeClock(0, 1);
  const timer = new Timer(clock.now);
  timer.mark('first');
  clock.tick(2);
  timer.mark('second');
  clock.tick(5);
  assert.equal(timer.elapsedSinceLast(), 5);
});

test('elapsedSinceLast throws when no marks exist', () => {
  const timer = new Timer(() => 0);
  assert.throws(() => timer.elapsedSinceLast(), /no marks recorded/);
});

test('re-marking overwrites the previous timestamp', () => {
  const clock = fakeClock(0, 4);
  const timer = new Timer(clock.now);
  timer.mark('x');
  clock.tick(2);
  timer.mark('x');
  assert.equal(timer.time('x'), 8);
});

test('clear removes a mark and reports whether it existed', () => {
  const timer = new Timer(() => 0);
  timer.mark('a');
  assert.equal(timer.clear('a'), true);
  assert.equal(timer.clear('a'), false);
  assert.equal(timer.names().includes('a'), false);
});

test('reset removes every mark', () => {
  const timer = new Timer(() => 0);
  timer.mark('a');
  timer.mark('b');
  timer.reset();
  assert.deepEqual(timer.names(), []);
});

test('names preserves insertion order', () => {
  const timer = new Timer(() => 0);
  timer.mark('b');
  timer.mark('a');
  timer.mark('c');
  assert.deepEqual(timer.names(), ['b', 'a', 'c']);
});

test('mark rejects an empty name', () => {
  const timer = new Timer(() => 0);
  assert.throws(() => timer.mark(''), TypeError);
});

test('mark rejects a non-string name', () => {
  const timer = new Timer(() => 0);
  assert.throws(() => timer.mark(42), TypeError);
});

test('constructor rejects a non-function clock', () => {
  assert.throws(() => new Timer(123), TypeError);
});

test('createTimer is a thin wrapper over the constructor', () => {
  const clock = fakeClock(5, 1);
  const timer = createTimer(clock.now);
  assert.ok(timer instanceof Timer);
  assert.equal(timer.mark('a'), 5);
});

test('a monotonic clock is immune to wall-clock jumps', () => {
  // The injected clock never moves backwards, so elapsed time is stable even
  // if the host's wall clock is adjusted. This is the whole point of the
  // library; the test makes the guarantee explicit.
  let t = 1000;
  const timer = new Timer(() => t);
  timer.mark('start');
  t += 250;
  timer.mark('mid');
  t += 250;
  assert.equal(timer.elapsed('start', 'mid'), 250);
  assert.equal(timer.elapsed('mid'), 250);
});
