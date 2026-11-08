/**
 * A monotonic elapsed-time timer.
 *
 * The design decision here is to keep the timer as a tiny state machine that
 * depends on an injected `now` function rather than reaching for
 * `performance.now` directly. That makes the timer testable without sleeping
 * and without mocking globals, and it lets callers opt into a different
 * monotonic source (for example `process.hrtime.bigint`) on runtimes where
 * `performance.now` is unavailable.
 *
 * All timestamps are milliseconds. They are never compared for equality;
 * only differences are meaningful.
 */

/**
 * Resolve the default monotonic clock.
 *
 * `performance.now` is the only monotonic clock guaranteed by the ESM
 * standard in browsers and in Node. We fall back to `Date.now` only as a
 * last resort because it is wall-clock and therefore not truly monotonic;
 * the caller can always inject a better source.
 */
function defaultNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * A monotonic timer that records marks and measures elapsed time between
 * them.
 *
 * The timer is intentionally not a stopwatch: there is no start/stop state
 * machine, only marks and differences. That keeps the API honest about what
 * it can guarantee (differences between monotonic readings) and avoids the
 * ambiguity of what a "stopped" timer means when it is started again.
 */
export class Timer {
  /**
   * @param {() => number} [now] Monotonic clock in milliseconds. Defaults to
   *   `performance.now` when available, otherwise `Date.now`.
   */
  constructor(now = defaultNow) {
    if (typeof now !== 'function') {
      throw new TypeError('now must be a function returning milliseconds');
    }
    /** @type {() => number} */
    this._now = now;
    /** @type {Map<string, number>} */
    this._marks = new Map();
  }

  /**
   * Record the current monotonic time under `name`.
   *
   * Re-marking an existing name overwrites it. That is deliberate: callers
   * routinely want to reset a mark inside a loop without allocating a new
   * timer.
   *
   * @param {string} name
   * @returns {number} The timestamp that was recorded.
   */
  mark(name) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('mark name must be a non-empty string');
    }
    const t = this._now();
    this._marks.set(name, t);
    return t;
  }

  /**
   * Read the timestamp recorded for `name` without removing it.
   *
   * @param {string} name
   * @returns {number}
   * @throws {Error} If the mark has not been recorded.
   */
  time(name) {
    if (!this._marks.has(name)) {
      throw new Error(`unknown mark: ${name}`);
    }
    return this._marks.get(name);
  }

  /**
   * Milliseconds elapsed between two marks.
   *
   * If `to` is omitted, the current time is used. If `from` is omitted as
   * well the call is equivalent to `elapsedSince` on the most recently
   * recorded mark, which is the common "how long since the last checkpoint"
   * case.
   *
   * @param {string} from
   * @param {string} [to]
   * @returns {number}
   */
  elapsed(from, to) {
    const start = this.time(from);
    const end = to === undefined ? this._now() : this.time(to);
    return end - start;
  }

  /**
   * Milliseconds elapsed since `name` was marked, using the current clock.
   *
   * @param {string} name
   * @returns {number}
   */
  elapsedSince(name) {
    return this._now() - this.time(name);
  }

  /**
   * Milliseconds elapsed since the most recently recorded mark.
   *
   * @returns {number}
   * @throws {Error} If no marks have been recorded.
   */
  elapsedSinceLast() {
    let last;
    for (const t of this._marks.values()) {
      last = t;
    }
    if (last === undefined) {
      throw new Error('no marks recorded');
    }
    return this._now() - last;
  }

  /**
   * Remove a mark. Returns `true` if the mark existed.
   *
   * @param {string} name
   * @returns {boolean}
   */
  clear(name) {
    return this._marks.delete(name);
  }

  /**
   * Remove every mark.
   */
  reset() {
    this._marks.clear();
  }

  /**
   * Names of all recorded marks, in insertion order.
   *
   * @returns {string[]}
   */
  names() {
    return [...this._marks.keys()];
  }
}

/**
 * Convenience factory for callers who prefer a function over `new`.
 *
 * @param {() => number} [now]
 * @returns {Timer}
 */
export function createTimer(now) {
  return new Timer(now);
}
