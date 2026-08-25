// Accelerometer step detection used by the Walk/Run tracker.
//
// It works on the MAGNITUDE of the gravity-included acceleration vector, which
// is rotation-invariant — it counts the body's up/down bounce whether the
// phone is in a pocket, held in a hand, or being used (e.g. while texting),
// while ignoring small hand jitter such as typing on a desk.
//
// This mirrors the native detector in WalkTrackerService.kt exactly; keep the
// two in sync when tuning.

/**
 * Create a peak-detecting step counter.
 *
 * Tuning (m/s² deviations from a slowly-adapting baseline):
 *  - PEAK:    deviation that "arms" a step (walking produces ~1–3 m/s² bounces)
 *  - DISARM:  deviation the signal must drop back under to complete the step
 *  - MIN_MS:  fastest plausible cadence between steps
 *  - DWELL_MS: how long the deviation must stay above PEAK — rejects the
 *    single-sample blips of phone moves and typing
 *  - ARM_MAX_MS: a deviation that outlives this is a tilt/phone move, not a
 *    step: it re-anchors the baseline without counting
 *
 * Returns { feed(magnitude, now), steps, reset }.
 */
export function createStepDetector({
  peak = 1.3,
  disarm = 0.55,
  minMs = 320,
  dwellMs = 100,
  armMaxMs = 600,
} = {}) {
  let baseline = 0;
  let armed = false;
  let lastStepAt = -minMs; // never stepped yet — don't drop the first step
  let armedSinceAt = 0;
  let wasAbovePeak = false;
  let runStartAt = 0; // start of the current run above the peak
  let aboveAt = 0; // last sample time the deviation was above the peak
  let steps = 0;

  return {
    feed(mag, now = Date.now()) {
      const m = Number(mag);
      if (!Number.isFinite(m) || m <= 0) return;
      if (baseline <= 0) {
        baseline = m;
        return;
      }
      const dev = m - baseline;
      if (armed) {
        if (dev > peak) {
          if (!wasAbovePeak) runStartAt = now; // a new run above peak began
          wasAbovePeak = true;
          aboveAt = now;
        } else {
          wasAbovePeak = false;
        }
        // Sustained deviation = phone moved/tilted, not a step.
        if (now - armedSinceAt > armMaxMs) {
          armed = false;
          baseline = m;
          return;
        }
        if (dev < disarm) {
          armed = false;
          // The step counts only if the bounce really spent dwellMs above the
          // peak (span of the above-peak run), not just touched it.
          const dwell = aboveAt > 0 && runStartAt > 0 ? aboveAt - runStartAt : 0;
          if (dwell >= dwellMs && now - lastStepAt >= minMs) {
            lastStepAt = now;
            steps += 1;
          }
        }
      } else {
        // Not armed: the baseline keeps adapting (slowly — 0.02/sample, so it
        // converges on the signal's resting mean without being able to chase a
        // single step bounce, which would compress the deviation).
        baseline = baseline * 0.98 + m * 0.02;
        if (dev > peak) {
          armed = true;
          armedSinceAt = now;
          wasAbovePeak = true;
          runStartAt = now;
          aboveAt = now;
        }
      }
    },
    get steps() {
      return steps;
    },
    reset() {
      baseline = 0;
      armed = false;
      lastStepAt = -minMs;
      armedSinceAt = 0;
      wasAbovePeak = false;
      runStartAt = 0;
      aboveAt = 0;
      steps = 0;
    },
  };
}