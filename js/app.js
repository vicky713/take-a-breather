/**
 * One-Minute Breather — timers, countdown, breath phases, UI.
 */
(function () {
  "use strict";

  const COUNTDOWN_SEC = 60;
  const INHALE_SEC = 4;
  const EXHALE_SEC = 6;
  const MIN_SCALE = 0.38;
  const MAX_SCALE = 1;
  const MINUTE_RING_R = 142;
  const MINUTE_RING_LEN = 2 * Math.PI * MINUTE_RING_R;

  const state = {
    sessionStarted: false,
    paused: false,
    countdownComplete: false,
    breathPhase: "inhale",
    breathPhaseStart: 0,
    countRemainingAtSegment: COUNTDOWN_SEC,
    countSegmentStart: 0,
    breathElapsedAtPause: 0,
  };

  const els = {
    success: document.getElementById("success-banner"),
    controlsIdle: document.getElementById("controls-idle"),
    controlsRun: document.getElementById("controls-run"),
    controlsDone: document.getElementById("controls-done"),
    btnStart: document.getElementById("btn-start"),
    btnStartDone: document.getElementById("btn-start-done"),
    btnPause: document.getElementById("btn-pause"),
    btnResume: document.getElementById("btn-resume"),
    btnReset: document.getElementById("btn-reset"),
    timer: document.getElementById("timer"),
    breathLabel: document.getElementById("breath-label"),
    circleScale: document.getElementById("circle-scale"),
    minuteArc: document.getElementById("minute-arc"),
  };

  function phaseDuration(phase) {
    return phase === "inhale" ? INHALE_SEC : EXHALE_SEC;
  }

  function minuteProgress() {
    if (state.countdownComplete) return 1;
    if (!state.sessionStarted) return 0;
    const elapsed = COUNTDOWN_SEC - countdownRemaining();
    return Math.min(1, Math.max(0, elapsed / COUNTDOWN_SEC));
  }

  function easeBreath(t) {
    const x = Math.max(0, Math.min(1, t));
    return 0.5 - 0.5 * Math.cos(Math.PI * x);
  }

  function scaleFromProgress(phase, progress) {
    const p = easeBreath(Math.max(0, Math.min(1, progress)));
    if (phase === "inhale") {
      return MIN_SCALE + (MAX_SCALE - MIN_SCALE) * p;
    }
    return MAX_SCALE - (MAX_SCALE - MIN_SCALE) * p;
  }

  function formatMmSs(seconds) {
    const s = Math.floor(Math.max(0, seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function countdownRemaining() {
    if (state.countdownComplete) return 0;
    if (!state.sessionStarted) return COUNTDOWN_SEC;
    if (state.paused) {
      return Math.max(0, state.countRemainingAtSegment);
    }
    const raw =
      state.countRemainingAtSegment -
      (performance.now() / 1000 - state.countSegmentStart);
    return Math.max(0, raw);
  }

  function currentBreathElapsed() {
    if (state.paused || state.countdownComplete) {
      return state.breathElapsedAtPause;
    }
    return performance.now() / 1000 - state.breathPhaseStart;
  }

  function advancePhases() {
    if (
      !state.sessionStarted ||
      state.paused ||
      state.countdownComplete
    ) {
      return;
    }
    const now = performance.now() / 1000;
    let dur = phaseDuration(state.breathPhase);
    let elapsed = now - state.breathPhaseStart;
    while (elapsed >= dur) {
      elapsed -= dur;
      state.breathPhase = state.breathPhase === "inhale" ? "exhale" : "inhale";
      dur = phaseDuration(state.breathPhase);
      state.breathPhaseStart = now - elapsed;
    }
  }

  function tickCountdownComplete() {
    if (
      !state.sessionStarted ||
      state.countdownComplete ||
      state.paused
    ) {
      return;
    }
    if (countdownRemaining() <= 0) {
      const now = performance.now() / 1000;
      state.breathElapsedAtPause = now - state.breathPhaseStart;
      state.countdownComplete = true;
      state.countRemainingAtSegment = 0;
      state.sessionStarted = false;
      updateControls();
    }
  }

  function freezeCountdown() {
    if (state.countdownComplete) return;
    const now = performance.now() / 1000;
    state.countRemainingAtSegment = Math.max(
      0,
      state.countRemainingAtSegment -
        (now - state.countSegmentStart)
    );
  }

  function start() {
    const now = performance.now() / 1000;
    state.sessionStarted = true;
    state.breathPhase = "inhale";
    state.breathPhaseStart = now;
    state.paused = false;
    state.breathElapsedAtPause = 0;
    state.countRemainingAtSegment = COUNTDOWN_SEC;
    state.countSegmentStart = now;
    state.countdownComplete = false;
    updateControls();
  }

  function pause() {
    if (
      !state.sessionStarted ||
      state.paused ||
      state.countdownComplete
    ) {
      return;
    }
    const now = performance.now() / 1000;
    freezeCountdown();
    state.breathElapsedAtPause = now - state.breathPhaseStart;
    state.paused = true;
    updateControls();
  }

  function resume() {
    if (!state.sessionStarted || !state.paused || state.countdownComplete) {
      return;
    }
    const now = performance.now() / 1000;
    state.countSegmentStart = now;
    state.breathPhaseStart = now - state.breathElapsedAtPause;
    state.paused = false;
    updateControls();
  }

  function reset() {
    const now = performance.now() / 1000;
    state.sessionStarted = false;
    state.breathPhase = "inhale";
    state.breathPhaseStart = now;
    state.paused = false;
    state.breathElapsedAtPause = 0;
    state.countRemainingAtSegment = COUNTDOWN_SEC;
    state.countSegmentStart = now;
    state.countdownComplete = false;
    updateControls();
  }

  function updateControls() {
    const idle = !state.sessionStarted && !state.countdownComplete;
    const done = state.countdownComplete;

    els.success.classList.toggle("hidden", !done);
    els.controlsIdle.classList.toggle("hidden", !idle);
    els.controlsRun.classList.toggle("hidden", idle || done);
    els.controlsDone.classList.toggle("hidden", !done);

    if (state.sessionStarted && !done) {
      els.btnPause.classList.toggle("hidden", state.paused);
      els.btnResume.classList.toggle("hidden", !state.paused);
    }
  }

  function updateFrame() {
    tickCountdownComplete();
    advancePhases();

    const idle = !state.sessionStarted && !state.countdownComplete;
    let scale;
    let label;

    if (state.countdownComplete) {
      scale = (MIN_SCALE + MAX_SCALE) / 2;
      label = "Your minute is up";
    } else if (idle) {
      scale = (MIN_SCALE + MAX_SCALE) / 2;
      label = "Press Start when you’re ready";
    } else {
      const dur = phaseDuration(state.breathPhase);
      const elapsed = currentBreathElapsed();
      const progress = Math.max(0, Math.min(1, elapsed / dur));
      scale = scaleFromProgress(state.breathPhase, progress);
      label =
        state.breathPhase === "inhale" ? "Breathe in" : "Breathe out";
    }

    const rem = countdownRemaining();
    els.timer.textContent = formatMmSs(rem);
    els.breathLabel.textContent = label;
    els.circleScale.style.setProperty("--circle-scale", String(scale));

    const mp = minuteProgress();
    els.minuteArc.setAttribute("stroke-dasharray", String(MINUTE_RING_LEN));
    els.minuteArc.setAttribute(
      "stroke-dashoffset",
      String(MINUTE_RING_LEN * (1 - mp))
    );

    requestAnimationFrame(updateFrame);
  }

  els.btnStart.addEventListener("click", start);
  els.btnStartDone.addEventListener("click", start);
  els.btnPause.addEventListener("click", pause);
  els.btnResume.addEventListener("click", resume);
  els.btnReset.addEventListener("click", reset);

  updateControls();
  requestAnimationFrame(updateFrame);
})();
