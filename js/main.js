/* ============================================================
   main.js — bootstrap
   Creates the Game, wires up the menu buttons, handles responsive
   canvas scaling, audio unlock on first gesture, and starts the loop.
   ============================================================ */

(function () {
  const canvas = document.getElementById("game-canvas");
  const game = new BUZZY.Game(canvas);

  /* -------------------------------------------------------
     Responsive scaling
     The canvas keeps a fixed internal resolution (960x540) and is
     stretched with CSS to the largest 16:9 box that fits the screen.
     Drawing therefore stays resolution-independent and crisp.
     ------------------------------------------------------- */
  function resize() {
    const container = document.getElementById("game-container");
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const targetRatio = BUZZY.WIDTH / BUZZY.HEIGHT;
    let w = cw;
    let h = cw / targetRatio;
    if (h > ch) {
      h = ch;
      w = ch * targetRatio;
    }
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  resize();

  /* -------------------------------------------------------
     Audio unlock — browsers block sound until a user gesture.
     Show a hint, then resume the audio context on first tap/key.
     ------------------------------------------------------- */
  const tapHint = document.getElementById("tap-hint");
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    game.audio.unlock();
    tapHint.classList.add("hidden");
  }
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, { once: false })
  );

  /* -------------------------------------------------------
     Button wiring
     ------------------------------------------------------- */
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };

  on("start-btn", () => game.start());
  on("restart-btn", () => game.start());
  on("resume-btn", () => game.resume());
  on("pause-btn", () => (game.state === "paused" ? game.resume() : game.pause()));
  on("quit-btn", () => game.quitToMenu());
  on("menu-btn", () => game.quitToMenu());
  on("mute-btn", () => game.toggleMute());

  // Achievements screen (opened from the menu, closed back to it).
  const achScreen = document.getElementById("achievements-screen");
  const startScreen = document.getElementById("start-screen");
  on("achievements-btn", () => {
    game.renderAchievementsList();
    startScreen.classList.add("hidden");
    achScreen.classList.remove("hidden");
    game.audio.click();
  });
  on("ach-back-btn", () => {
    achScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    game.audio.click();
  });

  /* -------------------------------------------------------
     Auto-pause when the tab is hidden, so players don't come back
     to a lost run.
     ------------------------------------------------------- */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "playing") game.pause();
  });

  // Kick off the render/update loop.
  game.run();

  // Expose for debugging in the console.
  window.buzzy = game;
})();
