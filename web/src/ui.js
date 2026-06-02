// ---- HUD + overlay screens ------------------------------------------------
import { G } from "./state.js";
import { LEVELS } from "./levels.js";
import { unlockAudio } from "./audio.js";
import { getBest, isUnlocked } from "./save.js";

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

// ---- Title menu -----------------------------------------------------------
export function showMenu({ onPlay, onLevels }) {
  openOverlay(`
    <h1 class="ov-title">Angry Chickens 🐱</h1>
    <p class="ov-text">Drag the cat back on the slingshot and release to fling
      it at the chickens. Defeat them all to clear the level!</p>
    <div class="ov-btns">
      <button class="btn" data-action="play">Play</button>
      <button class="btn secondary" data-action="levels">Level Select</button>
    </div>`);
  wire("play", onPlay);
  wire("levels", onLevels);
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
export function showLevelSelect({ onSelect, onBack }) {
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
  openOverlay(`
    <h1 class="ov-title">Select a Level</h1>
    <div class="lvl-grid">${tiles}</div>
    <div class="ov-btns"><button class="btn secondary" data-action="back">Back</button></div>`);
  card.querySelectorAll(".lvl-tile:not(:disabled)").forEach((el) => {
    el.onclick = () => { unlockAudio(); closeOverlay(); onSelect(parseInt(el.dataset.idx, 10)); };
  });
  wire("back", onBack);
}

muteBtn.addEventListener("click", () => {
  G.muted = !G.muted;
  muteBtn.textContent = G.muted ? "🔇" : "🔊";
});
