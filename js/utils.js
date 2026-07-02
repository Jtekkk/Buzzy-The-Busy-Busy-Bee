/* ============================================================
   utils.js — small, dependency-free helpers shared across the game.
   Everything is attached to the global BUZZY namespace so the other
   plain <script> files can use it without a module system.
   ============================================================ */

// Global namespace + design-time constants. All gameplay math happens in a
// fixed "design resolution" so the game feels identical at any screen size.
const BUZZY = {
  WIDTH: 960,
  HEIGHT: 540,
};

BUZZY.Utils = {
  /** Random float in [min, max). */
  rand(min, max) {
    return Math.random() * (max - min) + min;
  },

  /** Random integer in [min, max] inclusive. */
  randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /** Pick a random element from an array. */
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  /** Constrain a value to the [min, max] range. */
  clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  },

  /** Linear interpolation between a and b by t (0..1). */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /** Distance between two points. */
  dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Circle-vs-circle overlap test. Entities expose x/y (centre) and a
   * collision radius, which gives fairer, more forgiving hit detection
   * than axis-aligned boxes for round-ish sprites.
   */
  circleHit(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const r = a.radius + b.radius;
    return dx * dx + dy * dy <= r * r;
  },

  /** Axis-aligned bounding-box overlap (kept for rectangular entities). */
  aabbHit(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y + b.h / 2 &&
      a.y + a.h / 2 > b.y - b.h / 2
    );
  },

  /** Convert HSL to a CSS colour string (used for smooth day/night tints). */
  hsl(h, s, l, a = 1) {
    return `hsla(${h}, ${s}%, ${l}%, ${a})`;
  },

  /** Blend two [r,g,b] colours by t and return a css rgb() string. */
  mixRgb(c1, c2, t) {
    const r = Math.round(BUZZY.Utils.lerp(c1[0], c2[0], t));
    const g = Math.round(BUZZY.Utils.lerp(c1[1], c2[1], t));
    const b = Math.round(BUZZY.Utils.lerp(c1[2], c2[2], t));
    return `rgb(${r}, ${g}, ${b})`;
  },
};
