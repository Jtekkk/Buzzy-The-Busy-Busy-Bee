/* ============================================================
   storage.js — thin wrapper over localStorage for the high score,
   sound preference and achievement progress. All access is guarded
   so the game still runs in private-mode browsers that throw on
   localStorage access.
   ============================================================ */

BUZZY.Storage = (function () {
  const KEYS = {
    highScore: "buzzy_high_score",
    muted: "buzzy_muted",
    achievements: "buzzy_achievements",
  };

  // Read helper that never throws (falls back to a default value).
  function read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  // Write helper that silently no-ops if storage is unavailable.
  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* ignore — storage may be disabled */
    }
  }

  return {
    /* -------- High score -------- */
    getHighScore() {
      return parseInt(read(KEYS.highScore, "0"), 10) || 0;
    },
    setHighScore(score) {
      write(KEYS.highScore, String(Math.floor(score)));
    },

    /* -------- Mute preference -------- */
    isMuted() {
      return read(KEYS.muted, "false") === "true";
    },
    setMuted(muted) {
      write(KEYS.muted, muted ? "true" : "false");
    },

    /* -------- Achievements (stored as a { id: true } map) -------- */
    getUnlocked() {
      try {
        return JSON.parse(read(KEYS.achievements, "{}")) || {};
      } catch (e) {
        return {};
      }
    },
    unlock(id) {
      const map = this.getUnlocked();
      if (map[id]) return false; // already had it
      map[id] = true;
      write(KEYS.achievements, JSON.stringify(map));
      return true; // newly unlocked
    },
  };
})();
