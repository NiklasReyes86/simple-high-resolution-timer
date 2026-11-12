# simple-high-resolution-timer

A monotonic timer that measures elapsed time between named marks using `performance.now`, so it is not affected by system clock adjustments.

```js
import { Timer } from 'simple-high-resolution-timer';

const timer = new Timer();
timer.mark('start');
// ... do work ...
timer.mark('end');
console.log(timer.elapsed('start', 'end'), 'ms');
```

## Why this exists

`Date.now()` is wall-clock time. If the system clock is corrected by NTP, or the user changes their timezone, or a VM is resumed from a snapshot, readings can jump forwards or backwards. A timer built on `Date.now()` will happily report negative durations. `performance.now()` is monotonic, so differences between readings are always meaningful.

The trade-off is that the timer only knows about differences it has seen. There is no start/stop state machine, because a "stopped" timer that is started again is ambiguous: does it resume, or reset? This library exposes marks and differences, and leaves that policy to the caller.

## API

- `new Timer([now])` — `now` is an optional function returning milliseconds. It defaults to `performance.now` when available, otherwise `Date.now`. Injecting a clock is what makes the timer testable without sleeping.
- `timer.mark(name)` — records the current time under `name` and returns it. Re-marking overwrites.
- `timer.time(name)` — returns the recorded timestamp. Throws if the mark is unknown.
- `timer.elapsed(from, to?)` — milliseconds between two marks. If `to` is omitted, the current time is used.
- `timer.elapsedSince(name)` — milliseconds from `name` to now.
- `timer.elapsedSinceLast()` — milliseconds from the most recently recorded mark to now. Throws if there are no marks.
- `timer.clear(name)` — removes a mark, returns whether it existed.
- `timer.reset()` — removes every mark.
- `timer.names()` — mark names in insertion order.
- `createTimer([now])` — convenience factory equivalent to `new Timer(now)`.

## The awkward edge

A timer with no marks has nothing to measure. `elapsedSinceLast()` throws rather than returning `0`, because `0` would silently hide a missing `mark()` call. If you want a zero baseline, call `mark('start')` before you begin. Similarly, `time()` and `elapsed()` throw on unknown mark names instead of returning `NaN`.

Marks are stored in a `Map`, so re-marking an existing name replaces its timestamp without changing insertion order. That is the documented behaviour and the tests rely on it.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

