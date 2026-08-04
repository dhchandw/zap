/**
 *
 *    Copyright (c) 2020 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * This file contains watchdogs.
 *
 * @module watchdog API: initializes times.
 */

/**
 * Creates an independent watchdog instance.
 *
 * A watchdog is a refreshable timer: if `reset()` is not called within
 * `expirationInterval` ms, `triggerFunction` fires once. Call `stop()` to
 * cancel it entirely. Multiple watchdogs can coexist (e.g. one per
 * template render and one for overall server inactivity).
 *
 * @param {number} expirationInterval - ms of inactivity before triggering.
 * @param {Function} triggerFunction - invoked when the watchdog expires.
 * @returns {{ reset: Function, stop: Function }}
 */
function createWatchdog(expirationInterval, triggerFunction) {
  let stopped = false
  let lastActivity = performance.now()
  let id = null

  /**
   * Arms the watchdog timer for the given interval.
   * @param {number} interval - ms until the next expire check.
   */
  function arm(interval) {
    id = setTimeout(expire, interval)
    // Do not keep the event loop alive just because of this timer.
    if (typeof id.unref === 'function') id.unref()
  }

  /**
   * Handles watchdog expiry: re-arms if activity was recent, otherwise triggers.
   */
  function expire() {
    if (stopped) return
    // Timers fire late when the event loop is blocked, so by the time we get
    // here activity may already have been recorded. Compare against the last
    // activity instead of trusting the timer, and re-arm for whatever time is
    // left, so only genuine inactivity triggers.
    let idleTime = performance.now() - lastActivity
    if (!(idleTime >= 0)) {
      // reset() was handed a timestamp that did not come from this clock, so
      // it is either not a number or lies in the future. Restart from now,
      // which costs one extra interval instead of muting the watchdog.
      lastActivity = performance.now()
      arm(expirationInterval)
    } else if (idleTime < expirationInterval) {
      arm(expirationInterval - idleTime)
    } else {
      id = null
      triggerFunction()
    }
  }

  arm(expirationInterval)

  return {
    /**
     * Records activity so the idle timer does not expire.
     * @param {number} [time=performance.now()] - optional pre-computed timestamp
     *   for callers that reset many watchdogs in one pass.
     */
    reset(time = performance.now()) {
      if (stopped) return
      lastActivity = time
    },
    stop() {
      stopped = true
      if (id != null) {
        clearTimeout(id)
        id = null
      }
    }
  }
}

exports.createWatchdog = createWatchdog
