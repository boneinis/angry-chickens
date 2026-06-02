// ---- HUD + overlay screens ------------------------------------------------
import { G } from "./state.js";
import { LEVELS } from "./levels.js";
import { unlockAudio, setMusicVolume } from "./audio.js";
import { getBest, isUnlocked, resetProgress } from "./save.js";

// ---- DOM ------------------------------------------------------------------
const levelPill = document.getElementById("level-pill");
const catsPill = document.getElementById("cats-pill");
const scorePill = document.getElementById("score-pill");
const muteBtn = document.getElementById("mute-btn");
const overlay = document.getElementById("overlay");
const card = document.getElementById("overlay-card");
const hint = document.getElementById("hint");

export { overlay, hint };

export function updateHUD() {
  const lvl = LEVELS[G.levelIndex] || {};
  levelPill.textContent = `Level ${G.levelIndex + 1} — ${lvl.name || ""}`;
  catsPill.textContent = `🐱 × ${Math.max(0, G.remainingCats)}`;
  scorePill.textContent = `Score: ${G.score}`;
}

function closeOverlay() { overlay.classList.add("hidden"); }
function openOverlay(html) {
  card.innerHTML = html;
  overlay.classList.remove("hidden");
  // re-trigger the pop animation
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "";
}

// Wire a button (by data-action) to: unlock audio, close overlay, run cb.
function wire(action, cb) {
  if (!cb) return;
  const el = card.querySelector(`[data-action="${action}"]`);
  if (el) el.onclick = () => { unlockAudio(); closeOverlay(); cb(); };
}

function starsHTML(n, total = 3, animate = false) {
  let s = '<div class="stars">';
  for (let i = 0; i < total; i++) {
    const on = i < n;
    const cls = `${on ? "on" : "off"}${animate && on ? " pop" : ""}`;
    const style = animate && on ? ` style="animation-delay:${i * 0.18}s"` : "";
    s += `<span class="${cls}"${style}>${on ? "★" : "☆"}</span>`;
  }
  return s + "</div>";
}

// Remembered music volume (0..1) for the Settings slider. Mirrors audio.js's
// internal default (0.07) but scaled to a friendlier 0..100 slider range.
let musicVol = 0.07;

// ---- Title menu -----------------------------------------------------------
export function showMenu(cb) {
  const { onPlay, onLevels } = cb;
  openOverlay(`
    <h1 class="ov-title">Angry Chickens 🐱</h1>
    <p class="ov-tag">Cats vs. Chickens</p>
    <p class="ov-text">Drag the cat back on the slingshot and release to fling
      it at the chickens. Defeat them all to clear the level!</p>
    <div class="ov-btns ov-btns-col">
      <button class="btn" data-action="play">Play</button>
      <button class="btn secondary" data-action="levels">Level Select</button>
      <button class="btn secondary" data-action="settings">Settings</button>
    </div>`);
  wire("play", onPlay);
  wire("levels", onLevels);
  // Settings stays within the overlay flow; Back returns to this menu.
  const sBtn = card.querySelector('[data-action="settings"]');
  if (sBtn) sBtn.onclick = () => { unlockAudio(); showSettings({ onBack: () => showMenu(cb) }); };
}

// ---- Settings -------------------------------------------------------------
export function showSettings({ onBack }) {
  openOverlay(`
    <h1 class="ov-title">Settings ⚙️</h1>
    <div class="settings">
      <div class="set-row">
        <span>Sound effects</span>
        <button class="btn toggle ${G.muted ? "secondary" : ""}" data-action="sfx">${G.muted ? "Off" : "On"}</button>
      </div>
      <div class="set-row">
        <label for="musicVol">Music volume</label>
        <input id="musicVol" type="range" min="0" max="100" value="${Math.round(musicVol * 100)}" data-action="music" />
      </div>
      <div class="set-row">
        <span>Progress</span>
        <button class="btn secondary" data-action="reset">Reset</button>
      </div>
    </div>
    <div class="ov-btns"><button class="btn" data-action="back">Back</button></div>`);

  const sfxBtn = card.querySelector('[data-action="sfx"]');
  if (sfxBtn) sfxBtn.onclick = () => {
    G.muted = !G.muted;
    muteBtn.textContent = G.muted ? "🔇" : "🔊";
    sfxBtn.textContent = G.muted ? "Off" : "On";
    sfxBtn.classList.toggle("secondary", G.muted);
  };

  const slider = card.querySelector('[data-action="music"]');
  if (slider) slider.oninput = () => {
    musicVol = slider.value / 100;
    unlockAudio();             // ensure the audio context/music is running
    setMusicVolume(musicVol);
  };

  const resetBtn = card.querySelector('[data-action="reset"]');
  if (resetBtn) resetBtn.onclick = () => {
    resetProgress();
    resetBtn.textContent = "Done ✓";
    resetBtn.disabled = true;
  };

  // Back stays inside the overlay (doesn't close it / unpause).
  const backBtn = card.querySelector('[data-action="back"]');
  if (backBtn) backBtn.onclick = () => { if (onBack) onBack(); };
}

// ---- Results (level cleared) ----------------------------------------------
export function showResults(o) {
  const { base, bonus, total, stars, best, isLast, won } = o;
  const title = won && isLast ? "You Win! 🏆" : "Level Complete! ⭐";
  const bestLine = best && best.score
    ? `<div class="row best"><span>Best</span><span>${best.score} ${"★".repeat(best.stars)}</span></div>` : "";
  openOverlay(`
    <h1 class="ov-title">${title}</h1>
    ${starsHTML(stars, 3, true)}
    <div class="ov-lines">
      <div class="row"><span>Chickens</span><span>${base}</span></div>
      <div class="row"><span>Cats left bonus</span><span>+${bonus}</span></div>
      <div class="row total"><span>Total</span><span>${total}</span></div>
      ${bestLine}
    </div>
    <div class="ov-btns">
      ${isLast ? "" : '<button class="btn" data-action="next">Next Level</button>'}
      <button class="btn ${isLast ? "" : "secondary"}" data-action="replay">Replay</button>
      <button class="btn secondary" data-action="levels">Level Select</button>
    </div>`);
  wire("next", o.onNext);
  wire("replay", o.onReplay);
  wire("levels", o.onLevels);
}

// ---- Game over ------------------------------------------------------------
export function showGameOver({ score, onRetry, onLevels }) {
  openOverlay(`
    <h1 class="ov-title">Out of Cats! 😿</h1>
    <p class="ov-text">Score: ${score}</p>
    <div class="ov-btns">
      <button class="btn" data-action="retry">Try Again</button>
      <button class="btn secondary" data-action="levels">Level Select</button>
    </div>`);
  wire("retry", onRetry);
  wire("levels", onLevels);
}

// ---- Level select ---------------------------------------------------------
export function showLevelSelect({ onSelect, onBack, onResume }) {
  let tiles = "";
  for (let i = 0; i < LEVELS.length; i++) {
    const unlocked = isUnlocked(i);
    const best = getBest(i);
    const st = `<span class="tstars">${"★".repeat(best.stars)}<span class="off">${"☆".repeat(3 - best.stars)}</span></span>`;
    tiles += `
      <button class="lvl-tile ${unlocked ? "" : "locked"}" data-idx="${i}" ${unlocked ? "" : "disabled"}>
        <span class="num">${i + 1}</span>
        <span class="nm">${LEVELS[i].name || ""}</span>
        ${unlocked ? st : ""}
      </button>`;
  }
  const resumeBtn = onResume ? '<button class="btn" data-action="resume">Resume</button>' : "";
  openOverlay(`
    <h1 class="ov-title">Select a Level</h1>
    <div class="lvl-grid">${tiles}</div>
    <div class="ov-btns">
      ${resumeBtn}
      <button class="btn secondary" data-action="back">Back</button>
    </div>`);
  card.querySelectorAll(".lvl-tile:not(:disabled)").forEach((el) => {
    el.onclick = () => { unlockAudio(); closeOverlay(); onSelect(parseInt(el.dataset.idx, 10)); };
  });
  wire("resume", onResume);
  wire("back", onBack);
}

muteBtn.addEventListener("click", () => {
  G.muted = !G.muted;
  muteBtn.textContent = G.muted ? "🔇" : "🔊";
});
