// ---- Audio (fully procedural WebAudio, no asset files / no network) --------
import { G } from "./state.js";

// Lazily create (and return) the shared AudioContext, or null if unavailable.
function ctx() {
  try {
    G.audioCtx = G.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    return G.audioCtx;
  } catch (e) { return null; /* audio not available */ }
}

// A single short oscillator blip with an exponential decay envelope.
export function beep(freq, dur, type = "sine", vol = 0.2) {
  if (G.muted) return;
  const ac = ctx();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(ac.destination);
    const t = ac.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.stop(t + dur);
  } catch (e) { /* audio not available */ }
}

// ---- SFX ------------------------------------------------------------------

// Slingshot "thwip": a fast downward pitch sweep with a quick fade.
export const sndLaunch = () => {
  if (G.muted) return;
  const ac = ctx();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sawtooth";
    const t = ac.currentTime;
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.18);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.24);
  } catch (e) { /* audio not available */ }
};

// Chicken-defeat "pop"/squawk: a quick upward blip plus a short squawky chirp.
export const sndHit = () => {
  if (G.muted) return;
  const ac = ctx();
  if (!ac) return;
  try {
    const t = ac.currentTime;
    // The "pop": short rising sine.
    const o1 = ac.createOscillator();
    const g1 = ac.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(420, t);
    o1.frequency.exponentialRampToValueAtTime(900, t + 0.07);
    g1.gain.setValueAtTime(0.22, t);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o1.connect(g1).connect(ac.destination);
    o1.start(t);
    o1.stop(t + 0.11);
    // The "squawk": a detuned square that wobbles downward.
    const o2 = ac.createOscillator();
    const g2 = ac.createGain();
    o2.type = "square";
    o2.frequency.setValueAtTime(680, t + 0.05);
    o2.frequency.exponentialRampToValueAtTime(300, t + 0.18);
    g2.gain.setValueAtTime(0.12, t + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o2.connect(g2).connect(ac.destination);
    o2.start(t + 0.05);
    o2.stop(t + 0.21);
  } catch (e) { /* audio not available */ }
};

// Low wooden knock for structural impacts: a fast-decaying low sine "thock".
export const sndThud = () => {
  if (G.muted) return;
  const ac = ctx();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    const t = ac.currentTime;
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.15);
  } catch (e) { /* audio not available */ }
};

// Crunchy noise burst for blocks shattering. Uses a short white-noise buffer
// pushed through a band-passy filter for a "crack/crunch" texture.
export const sndBreak = () => {
  if (G.muted) return;
  const ac = ctx();
  if (!ac) return;
  try {
    const t = ac.currentTime;
    const dur = 0.18;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // White noise with a decaying amplitude so it sounds like a burst.
      const decay = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 800;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(ac.destination);
    src.start(t);
    src.stop(t + dur);
  } catch (e) { /* audio not available */ }
};

// ---- Background music (procedural, looping arpeggio bed) ------------------

const MUSIC_DEFAULT_VOLUME = 0.07; // subtle: SFX stay clearly audible above it
let musicVolume = MUSIC_DEFAULT_VOLUME;
let musicGain = null;       // master gain node for all music output
let musicTimer = null;      // setInterval handle for the lookahead scheduler
let nextNoteTime = 0;       // absolute AudioContext time of the next note
let stepIndex = 0;          // index into the arpeggio sequence

// A gentle major-ish progression (frequencies in Hz). Plays as a slow arpeggio.
const MUSIC_SEQUENCE = [
  261.63, 329.63, 392.00, 329.63, // C major
  293.66, 349.23, 440.00, 349.23, // D minor
  220.00, 261.63, 329.63, 261.63, // A minor
  349.23, 440.00, 523.25, 440.00, // F major
];
const STEP_DUR = 0.32;      // seconds per arpeggio step
const SCHEDULE_AHEAD = 0.2; // how far ahead (s) to schedule notes
const LOOKAHEAD_MS = 50;    // scheduler tick interval

// Schedule one note at the given time, routed through the music master gain.
function scheduleNote(ac, freq, time) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  // Soft pluck envelope so notes blend into a mellow bed.
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.18, time + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, time + STEP_DUR * 0.95);
  o.connect(g).connect(musicGain);
  o.start(time);
  o.stop(time + STEP_DUR);
}

// Lookahead scheduler tick: queue any notes whose time has nearly arrived, and
// keep the master gain at 0 while muted so output is suppressed (but the loop
// keeps running and resumes seamlessly when unmuted).
function musicTick() {
  const ac = G.audioCtx;
  if (!ac || !musicGain) return;
  // Mute by pulling the master gain to ~0; restore the chosen volume otherwise.
  const target = G.muted ? 0.0001 : musicVolume;
  try { musicGain.gain.setTargetAtTime(target, ac.currentTime, 0.05); } catch (e) {}
  while (nextNoteTime < ac.currentTime + SCHEDULE_AHEAD) {
    scheduleNote(ac, MUSIC_SEQUENCE[stepIndex % MUSIC_SEQUENCE.length], nextNoteTime);
    nextNoteTime += STEP_DUR;
    stepIndex++;
  }
}

// Start the looping music bed. Idempotent: a second call is a no-op while
// already playing. Safe to call when audio is unavailable.
export function startMusic() {
  if (musicTimer !== null) return; // already running
  const ac = ctx();
  if (!ac) return;
  try {
    musicGain = ac.createGain();
    musicGain.gain.value = G.muted ? 0.0001 : musicVolume;
    musicGain.connect(ac.destination);
    stepIndex = 0;
    nextNoteTime = ac.currentTime + 0.1;
    musicTick();
    musicTimer = setInterval(musicTick, LOOKAHEAD_MS);
  } catch (e) {
    // Clean up partial setup so a later call can retry.
    musicTimer = null;
    musicGain = null;
  }
}

// Stop the music loop and tear down the master gain. Idempotent.
export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicGain) {
    try { musicGain.disconnect(); } catch (e) {}
    musicGain = null;
  }
}

// Adjust the music volume (0..~1). Takes effect on the next scheduler tick.
export function setMusicVolume(v) {
  musicVolume = Math.max(0, Math.min(1, v));
  const ac = G.audioCtx;
  if (ac && musicGain && !G.muted) {
    try { musicGain.gain.setTargetAtTime(musicVolume, ac.currentTime, 0.05); } catch (e) {}
  }
}

// ---- Gesture unlock -------------------------------------------------------

// Create/resume the AudioContext from a user gesture (browsers start it
// suspended otherwise, silently dropping all sound) and kick off the music.
export function unlockAudio() {
  const ac = ctx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
  } catch (e) { /* audio not available */ }
  // Auto-start the background bed from this gesture (idempotent + safe).
  startMusic();
}
