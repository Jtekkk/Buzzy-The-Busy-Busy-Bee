/* ============================================================
   input.js — InputManager
   Normalises keyboard (arrows + WASD) and touch/pointer into a single
   directional vector the Bee reads each frame. On touch devices the
   bee flies toward wherever the player is holding, which feels natural
   on phones without needing an on-screen d-pad.
   ============================================================ */

BUZZY.InputManager = class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {}; // raw key state
    // dir.x / dir.y are in the range [-1, 1] and consumed by the Bee.
    this.dir = { x: 0, y: 0 };

    // Touch state: when active, the bee targets (touchX, touchY) in design space.
    this.touchActive = false;
    this.touchX = 0;
    this.touchY = 0;

    // One-shot action callbacks (pause / mute) registered by the game.
    this._onPause = null;
    this._onMute = null;

    this._bindKeyboard();
    this._bindTouch();
  }

  onPause(cb) {
    this._onPause = cb;
  }
  onMute(cb) {
    this._onMute = cb;
  }

  /* -------- Keyboard -------- */
  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      // Prevent the page from scrolling on arrow / space presses.
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
        e.preventDefault();
      }
      this.keys[k] = true;

      if (k === "p" || k === "escape") this._onPause && this._onPause();
      if (k === "m") this._onMute && this._onMute();

      this._updateKeyDir();
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this._updateKeyDir();
    });

    // Clear held keys if the window loses focus (prevents "stuck" movement).
    window.addEventListener("blur", () => {
      this.keys = {};
      this.dir.x = 0;
      this.dir.y = 0;
    });
  }

  // Translate the current key state into a -1..1 direction vector.
  _updateKeyDir() {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k["arrowleft"] || k["a"]) x -= 1;
    if (k["arrowright"] || k["d"]) x += 1;
    if (k["arrowup"] || k["w"]) y -= 1;
    if (k["arrowdown"] || k["s"]) y += 1;
    this.dir.x = x;
    this.dir.y = y;
  }

  /* -------- Touch / pointer -------- */
  _bindTouch() {
    const setFromEvent = (clientX, clientY) => {
      // Map screen pixels to the fixed design resolution.
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = BUZZY.WIDTH / rect.width;
      const scaleY = BUZZY.HEIGHT / rect.height;
      this.touchX = (clientX - rect.left) * scaleX;
      this.touchY = (clientY - rect.top) * scaleY;
    };

    const start = (e) => {
      const t = e.touches ? e.touches[0] : e;
      setFromEvent(t.clientX, t.clientY);
      this.touchActive = true;
    };
    const move = (e) => {
      if (!this.touchActive) return;
      const t = e.touches ? e.touches[0] : e;
      setFromEvent(t.clientX, t.clientY);
      if (e.cancelable) e.preventDefault();
    };
    const end = () => {
      this.touchActive = false;
    };

    // Touch events (mobile).
    this.canvas.addEventListener("touchstart", start, { passive: true });
    this.canvas.addEventListener("touchmove", move, { passive: false });
    this.canvas.addEventListener("touchend", end);
    this.canvas.addEventListener("touchcancel", end);

    // Pointer/mouse (lets you also fly with the mouse on desktop).
    this.canvas.addEventListener("mousedown", start);
    window.addEventListener("mousemove", (e) => this.touchActive && move(e));
    window.addEventListener("mouseup", end);
  }
};
