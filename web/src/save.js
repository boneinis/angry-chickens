// Persistence layer: wraps localStorage for game progress. Standalone module
// (no game imports). All storage access is guarded so the game keeps working
// in private mode / when storage is blocked, falling back to an in-memory copy.

const KEY = "angryChickens.save.v1";

// In-memory fallback used when localStorage is unavailable or throws.
let memory = null;

function defaults() {
  return { unlockedLevel: 0, best: {} };
}

// Best-effort read of the raw stored string (null if unavailable).
function readRaw() {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(KEY);
  } catch (_) { /* storage blocked */ }
  return memory;
}

// Best-effort write; always mirrors to memory so the API behaves in-session.
function writeRaw(str) {
  memory = str;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, str);
  } catch (_) { /* storage blocked */ }
}

// Parse stored JSON into a normalized, safe progress object. Never throws.
export function loadProgress() {
  const raw = readRaw();
  if (raw == null) return defaults();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults();
    const unlockedLevel = Number.isFinite(parsed.unlockedLevel) ? parsed.unlockedLevel : 0;
    const best = parsed.best && typeof parsed.best === "object" ? parsed.best : {};
    return { unlockedLevel, best };
  } catch (_) {
    return defaults();
  }
}

// Merge a level result in: scores/stars only ever go up, unlock advances.
// Persists and returns the updated progress. Never throws.
export function recordResult(levelIndex, score, stars) {
  const p = loadProgress();
  const prev = p.best[levelIndex] || { score: 0, stars: 0 };
  p.best[levelIndex] = {
    score: Math.max(prev.score || 0, score || 0),
    stars: Math.max(prev.stars || 0, stars || 0),
  };
  p.unlockedLevel = Math.max(p.unlockedLevel, levelIndex + 1);
  try {
    writeRaw(JSON.stringify(p));
  } catch (_) { /* serialization should not fail, but stay safe */ }
  return p;
}

// Best score/stars recorded for a level, or zeros if never played.
export function getBest(levelIndex) {
  const b = loadProgress().best[levelIndex];
  return b ? { score: b.score || 0, stars: b.stars || 0 } : { score: 0, stars: 0 };
}

// Highest unlocked level index (0 means only level 0 is playable).
export function getUnlocked() {
  return loadProgress().unlockedLevel;
}

// Whether a given level index is currently unlocked.
export function isUnlocked(levelIndex) {
  return levelIndex <= getUnlocked();
}

// Wipe all saved progress. Never throws.
export function resetProgress() {
  memory = null;
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch (_) { /* storage blocked */ }
}
