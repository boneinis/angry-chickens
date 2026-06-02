// ---- HUD / overlay --------------------------------------------------------
import { G } from "./state.js";
import { LEVELS } from "./levels.js";
import { unlockAudio } from "./audio.js";

// ---- DOM ------------------------------------------------------------------
const levelPill = document.getElementById("level-pill");
const catsPill = document.getElementById("cats-pill");
const scorePill = document.getElementById("score-pill");
const muteBtn = document.getElementById("mute-btn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const overlayBtn = document.getElementById("overlay-btn");
const hint = document.getElementById("hint");

export { overlay, hint };

export function updateHUD() {
  levelPill.textContent = `Level ${G.levelIndex + 1} — ${LEVELS[G.levelIndex].name}`;
  catsPill.textContent = `🐱 × ${Math.max(0, G.remainingCats)}`;
  scorePill.textContent = `Score: ${G.score}`;
}

export function showOverlay(title, text, btn, onClick) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayBtn.textContent = btn;
  overlay.classList.remove("hidden");
  overlayBtn.onclick = () => {
    unlockAudio();
    overlay.classList.add("hidden");
    onClick();
  };
}

muteBtn.addEventListener("click", () => {
  G.muted = !G.muted;
  muteBtn.textContent = G.muted ? "🔇" : "🔊";
});
