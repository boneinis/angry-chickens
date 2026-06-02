// ---- Audio (tiny WebAudio blips, no asset files) --------------------------
import { G } from "./state.js";

export function beep(freq, dur, type = "sine", vol = 0.2) {
  if (G.muted) return;
  try {
    G.audioCtx = G.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = G.audioCtx.createOscillator();
    const g = G.audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(G.audioCtx.destination);
    const t = G.audioCtx.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.stop(t + dur);
  } catch (e) { /* audio not available */ }
}

// Create/resume the AudioContext from a user gesture (browsers start it
// suspended otherwise, silently dropping all sound).
export function unlockAudio() {
  try {
    G.audioCtx = G.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (G.audioCtx.state === "suspended") G.audioCtx.resume();
  } catch (e) { /* audio not available */ }
}

export const sndLaunch = () => beep(220, 0.18, "triangle", 0.25);
export const sndHit = () => { beep(640, 0.08, "square", 0.18); beep(320, 0.16, "square", 0.12); };
export const sndThud = () => beep(90, 0.1, "sine", 0.15);
