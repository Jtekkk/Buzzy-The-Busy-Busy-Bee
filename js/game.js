/* ============================================================
   game.js — the Game class
   Owns the game loop, state machine (menu / playing / paused /
   gameover), entity spawning, progressive difficulty, the day/night
   cycle, collision handling, the achievement system and all
   background rendering.
   ============================================================ */

(function () {
  const U = BUZZY.Utils;
  const W = BUZZY.WIDTH;
  const H = BUZZY.HEIGHT;

  /* -----------------------------------------------------------
     Achievement definitions. `check` receives the game and returns
     true once the condition is met; unlocking is one-way + persisted.
     ----------------------------------------------------------- */
  const ACHIEVEMENTS = [
    { id: "first_nectar", icon: "🌼", name: "Sweet Beginning", desc: "Collect your first nectar", check: (g) => g.stats.nectar >= 1 },
    { id: "combo10", icon: "🔥", name: "On a Roll", desc: "Collect 10 nectar without a hit", check: (g) => g.stats.streak >= 10 },
    { id: "score500", icon: "⭐", name: "Busy Bee", desc: "Reach 500 points", check: (g) => g.score >= 500 },
    { id: "score2000", icon: "🌟", name: "Honey Hoarder", desc: "Reach 2,000 points", check: (g) => g.score >= 2000 },
    { id: "score5000", icon: "👑", name: "Queen Bee", desc: "Reach 5,000 points", check: (g) => g.score >= 5000 },
    { id: "survive60", icon: "⏱️", name: "Marathon Flyer", desc: "Survive for 60 seconds", check: (g) => g.elapsed >= 60 },
    { id: "sunflower", icon: "🌻", name: "Big Score", desc: "Collect a rare sunflower", check: (g) => g.stats.sunflower },
    { id: "all_powerups", icon: "✨", name: "Power Player", desc: "Use all three power-ups", check: (g) => g.stats.powerupsUsed.size >= 3 },
    { id: "shield_save", icon: "🛡️", name: "Close Call", desc: "Block a hit with a shield", check: (g) => g.stats.shieldSaves >= 1 },
    { id: "night_owl", icon: "🌙", name: "Night Owl", desc: "Fly into the night", check: (g) => g.stats.reachedNight },
  ];

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.state = "menu"; // menu | playing | paused | gameover

      this.input = new BUZZY.InputManager(canvas);
      this.audio = new BUZZY.AudioManager();
      this.bee = new BUZZY.Bee();

      this.groundY = H - 70;

      // Entity collections (kept in separate arrays for clear iteration).
      this.flowers = [];
      this.obstacles = [];
      this.powerups = [];
      this.particles = [];
      this.clouds = [];

      // Background parallax + celestial state.
      this.bgScroll = 0;
      this.stars = [];
      for (let i = 0; i < 70; i++) {
        this.stars.push({ x: U.rand(0, W), y: U.rand(0, this.groundY * 0.8), r: U.rand(0.5, 1.8), tw: U.rand(0, Math.PI * 2) });
      }

      this._cacheDom();
      this._wireInput();

      this.lastTime = 0;
      this.dayLength = 60; // seconds for a full day/night cycle

      this._resetRunState();
      this._loop = this._loop.bind(this);
    }

    /* -------------------------------------------------------
       DOM helpers
       ------------------------------------------------------- */
    _cacheDom() {
      const $ = (id) => document.getElementById(id);
      this.dom = {
        hud: $("hud"),
        score: $("score"),
        highScore: $("high-score"),
        lives: $("lives"),
        powerupTimers: $("powerup-timers"),
        startScreen: $("start-screen"),
        pauseScreen: $("pause-screen"),
        gameoverScreen: $("gameover-screen"),
        achScreen: $("achievements-screen"),
        finalScore: $("final-score"),
        finalHigh: $("final-high"),
        newRecord: $("new-record"),
        muteBtn: $("mute-btn"),
        toastContainer: $("toast-container"),
        achList: $("achievements-list"),
      };
      this.dom.highScore.textContent = BUZZY.Storage.getHighScore();
      this._refreshMuteBtn();
    }

    _wireInput() {
      this.input.onPause(() => {
        if (this.state === "playing") this.pause();
        else if (this.state === "paused") this.resume();
      });
      this.input.onMute(() => this.toggleMute());
    }

    /* -------------------------------------------------------
       Run/session state
       ------------------------------------------------------- */
    _resetRunState() {
      this.score = 0;
      this.displayScore = 0; // eased toward score for a rolling counter
      this.lives = 3;
      this.maxLives = 3;
      this.elapsed = 0;
      this.scrollSpeed = 180;

      // Spawn timers (seconds until next spawn of each kind).
      this.flowerTimer = 0.5;
      this.obstacleTimer = 2.5;
      this.powerupTimer = 12;
      this.distanceScoreAcc = 0;

      // Per-run stats used for achievements + game-over summary.
      this.stats = {
        nectar: 0,
        streak: 0,
        sunflower: false,
        powerupsUsed: new Set(),
        shieldSaves: 0,
        reachedNight: false,
      };
    }

    /* -------------------------------------------------------
       State transitions (also toggle the HTML overlays)
       ------------------------------------------------------- */
    setState(state) {
      this.state = state;
      const d = this.dom;
      d.startScreen.classList.toggle("hidden", state !== "menu");
      d.pauseScreen.classList.toggle("hidden", state !== "paused");
      d.gameoverScreen.classList.toggle("hidden", state !== "gameover");
      d.hud.classList.toggle("hidden", state !== "playing" && state !== "paused");
    }

    start() {
      // Begin a fresh play session.
      this.audio.unlock();
      this._resetRunState();
      this.bee.reset();
      this.flowers.length = 0;
      this.obstacles.length = 0;
      this.powerups.length = 0;
      this.particles.length = 0;
      this._seedClouds();
      this._updateHud();
      this.setState("playing");
      this.audio.startMusic();
      this.audio.click();
    }

    pause() {
      if (this.state !== "playing") return;
      this.setState("paused");
      this.audio.click();
    }

    resume() {
      if (this.state !== "paused") return;
      this.setState("playing");
      this.lastTime = performance.now(); // avoid a big dt jump
      this.audio.click();
    }

    quitToMenu() {
      this.audio.stopMusic();
      this.setState("menu");
      this.audio.click();
    }

    gameOver() {
      this.audio.stopMusic();
      this.audio.gameOver();

      // Persist + report high score.
      const prevHigh = BUZZY.Storage.getHighScore();
      const isRecord = this.score > prevHigh;
      if (isRecord) BUZZY.Storage.setHighScore(this.score);

      this.dom.finalScore.textContent = Math.floor(this.score);
      this.dom.finalHigh.textContent = BUZZY.Storage.getHighScore();
      this.dom.highScore.textContent = BUZZY.Storage.getHighScore();
      this.dom.newRecord.classList.toggle("hidden", !isRecord);

      this.setState("gameover");
    }

    /* -------------------------------------------------------
       The main loop (fixed to real time via delta seconds)
       ------------------------------------------------------- */
    run() {
      this.lastTime = performance.now();
      requestAnimationFrame(this._loop);
    }

    _loop(now) {
      // Delta time in seconds, clamped so a background tab / lag spike
      // can't teleport entities through each other.
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dt > 0.05) dt = 0.05;

      if (this.state === "playing") this._update(dt);
      this._render(dt);

      requestAnimationFrame(this._loop);
    }

    /* -------------------------------------------------------
       Update
       ------------------------------------------------------- */
    _update(dt) {
      this.elapsed += dt;

      // --- Progressive difficulty: speed ramps up over ~2 minutes ---
      const diff = U.clamp(this.elapsed / 120, 0, 1);
      this.scrollSpeed = U.lerp(180, 470, diff);
      this.audio.setMusicIntensity(diff);

      // Passive score from distance travelled (rewards survival).
      this.distanceScoreAcc += this.scrollSpeed * dt * 0.02;
      if (this.distanceScoreAcc >= 1) {
        const add = Math.floor(this.distanceScoreAcc);
        this.score += add;
        this.distanceScoreAcc -= add;
      }

      // --- Day/night bookkeeping ---
      const phase = (this.elapsed % this.dayLength) / this.dayLength;
      if (phase >= 0.5) this.stats.reachedNight = true;

      // --- Bee + parallax ---
      this.bee.update(dt, this);
      this.bgScroll += this.scrollSpeed * dt;
      this.clouds.forEach((c) => c.update(dt, this));

      // --- Spawning ---
      this._handleSpawns(dt, diff);

      // --- Update + cull entity lists ---
      this._updateList(this.flowers, dt);
      this._updateList(this.obstacles, dt);
      this._updateList(this.powerups, dt);
      this._updateList(this.particles, dt);

      // --- Collisions ---
      this._handleCollisions();

      // --- HUD + achievements ---
      this.displayScore = U.lerp(this.displayScore, this.score, 0.2);
      this._updateHud();
      this._checkAchievements();
    }

    _updateList(list, dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].update(dt, this);
        if (!list[i].active) list.splice(i, 1);
      }
    }

    _spawnY() {
      return U.rand(70, this.groundY - 40);
    }

    _handleSpawns(dt, diff) {
      // Flowers: steady supply, a touch more frequent over time.
      this.flowerTimer -= dt;
      if (this.flowerTimer <= 0) {
        this.flowerTimer = U.rand(0.7, 1.4) - diff * 0.3;
        this.flowers.push(new BUZZY.Flower(W + 40, this._spawnY(), BUZZY.Flower.randomType()));
        // Occasionally a little arc of nectar for a satisfying grab.
        if (Math.random() < 0.25) {
          const t = BUZZY.Flower.randomType();
          const y0 = this._spawnY();
          for (let i = 1; i <= 3; i++) {
            this.flowers.push(new BUZZY.Flower(W + 40 + i * 46, U.clamp(y0 + Math.sin(i) * 30, 70, this.groundY - 40), t));
          }
        }
      }

      // Obstacles: rarer at first, ramping toward frequent.
      this.obstacleTimer -= dt;
      if (this.obstacleTimer <= 0) {
        this.obstacleTimer = U.rand(2.2, 3.4) - diff * 1.6; // down to ~0.6-1.8s
        this._spawnObstacle(diff);
        // At high difficulty sometimes spawn a pair.
        if (diff > 0.5 && Math.random() < diff * 0.5) {
          this._spawnObstacle(diff);
        }
      }

      // Power-ups: occasional treats.
      this.powerupTimer -= dt;
      if (this.powerupTimer <= 0) {
        this.powerupTimer = U.rand(11, 17);
        this.powerups.push(new BUZZY.PowerUp(W + 40, this._spawnY(), BUZZY.PowerUp.randomKind()));
      }
    }

    _spawnObstacle(diff) {
      const y = this._spawnY();
      const r = Math.random();
      let ob;
      if (r < 0.4) ob = new BUZZY.Spider(W + 40, U.rand(90, this.groundY - 80));
      else if (r < 0.75) ob = new BUZZY.Bird(W + 40, this._spawnY());
      else ob = new BUZZY.Pesticide(W + 40, y);
      this.obstacles.push(ob);
    }

    _seedClouds() {
      this.clouds.length = 0;
      for (let i = 0; i < 5; i++) {
        const scale = U.rand(0.5, 1.2);
        this.clouds.push(new BUZZY.Cloud(U.rand(0, W), U.rand(30, 180), scale, U.rand(12, 30) * scale));
      }
    }

    /* -------------------------------------------------------
       Collisions
       ------------------------------------------------------- */
    _handleCollisions() {
      const bee = this.bee;

      // Nectar
      for (const f of this.flowers) {
        if (!f.active) continue;
        if (U.circleHit(bee, f)) {
          f.active = false;
          this.score += f.type.points;
          this.stats.nectar++;
          this.stats.streak++;
          if (f.type.name === "sunflower") this.stats.sunflower = true;
          this._spawnBurst(f.x, f.y, f.type.center, 10);
          this.particles.push(
            new BUZZY.Particle(f.x, f.y - 10, { text: "+" + f.type.points, color: "#fff", size: 20, vy: -60, gravity: 40, life: 0.9 })
          );
          if (f.type.points >= 75) this.audio.bigNectar();
          else this.audio.nectar();
        }
      }

      // Power-ups
      for (const p of this.powerups) {
        if (!p.active) continue;
        if (U.circleHit(bee, p)) {
          p.active = false;
          this._applyPowerUp(p);
        }
      }

      // Obstacles
      for (const o of this.obstacles) {
        if (!o.active) continue;
        if (U.circleHit(bee, o)) {
          const hadShield = bee.shield > 0;
          const counts = bee.takeHit();
          if (counts) {
            // Real hit: lose a heart, reset streak, big feedback.
            this.lives--;
            this.stats.streak = 0;
            this._spawnBurst(bee.x, bee.y, "#ff5252", 16);
            this.audio.hit();
            o.active = false;
            if (this.lives <= 0) {
              this.gameOver();
              return;
            }
          } else if (hadShield) {
            // Shield absorbed the hit.
            this.stats.shieldSaves++;
            this._spawnBurst(bee.x, bee.y, "#40c4ff", 14);
            this.audio.shieldBlock();
            o.active = false;
          }
        }
      }
    }

    _applyPowerUp(p) {
      const info = p.info;
      const bee = this.bee;
      if (p.kind === "speed") bee.speedBoost = info.duration;
      if (p.kind === "shield") bee.shield = info.duration;
      if (p.kind === "magnet") bee.magnet = info.duration;
      this.stats.powerupsUsed.add(p.kind);
      this._spawnBurst(p.x, p.y, info.color, 14);
      this.audio.powerup();
      this.showToast(info.icon + " " + info.label + "!");
    }

    /* -------------------------------------------------------
       Particle helpers
       ------------------------------------------------------- */
    _spawnBurst(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const a = U.rand(0, Math.PI * 2);
        const sp = U.rand(60, 220);
        this.particles.push(
          new BUZZY.Particle(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, size: U.rand(2, 5), life: U.rand(0.4, 0.8), gravity: 260 })
        );
      }
    }

    /* -------------------------------------------------------
       Achievements
       ------------------------------------------------------- */
    _checkAchievements() {
      for (const a of ACHIEVEMENTS) {
        if (a.check(this) && BUZZY.Storage.unlock(a.id)) {
          this.audio.achievement();
          this.showToast("🏆 " + a.name + " unlocked!");
        }
      }
    }

    showToast(text) {
      const el = document.createElement("div");
      el.className = "toast";
      el.textContent = text;
      this.dom.toastContainer.appendChild(el);
      // Remove after the CSS out-animation finishes (~3s).
      setTimeout(() => el.remove(), 3000);
    }

    /* -------------------------------------------------------
       HUD
       ------------------------------------------------------- */
    _updateHud() {
      this.dom.score.textContent = Math.floor(this.displayScore);

      // Hearts for lives.
      let hearts = "";
      for (let i = 0; i < this.maxLives; i++) hearts += i < this.lives ? "❤️" : "🖤";
      this.dom.lives.textContent = hearts;

      // Active power-up chips with remaining time.
      const chips = [];
      const b = this.bee;
      if (b.speedBoost > 0) chips.push(`<span class="pu-chip">⚡ ${b.speedBoost.toFixed(0)}s</span>`);
      if (b.shield > 0) chips.push(`<span class="pu-chip">🛡️ ${b.shield.toFixed(0)}s</span>`);
      if (b.magnet > 0) chips.push(`<span class="pu-chip">🧲 ${b.magnet.toFixed(0)}s</span>`);
      this.dom.powerupTimers.innerHTML = chips.join("");
    }

    _refreshMuteBtn() {
      if (this.dom.muteBtn) this.dom.muteBtn.textContent = this.audio.muted ? "🔇" : "🔊";
    }

    toggleMute() {
      this.audio.toggleMute();
      this._refreshMuteBtn();
    }

    /* =======================================================
       RENDERING
       ======================================================= */
    _render(dt) {
      const ctx = this.ctx;
      const phase = ((this.state === "playing" || this.state === "paused")
        ? (this.elapsed % this.dayLength) / this.dayLength
        : 0.2); // menu shows a pleasant daytime scene

      this._drawSky(ctx, phase);
      this._drawCelestial(ctx, phase);
      if (phase >= 0.5) this._drawStars(ctx, phase, dt);
      this.clouds.forEach((c) => c.draw(ctx, phase < 0.5 ? 1 : 0.5));
      this._drawHills(ctx, phase);
      this._drawGround(ctx, phase);

      // Entities (only meaningful while a run is active, but harmless otherwise).
      this.flowers.forEach((f) => f.draw(ctx));
      this.powerups.forEach((p) => p.draw(ctx));
      this.obstacles.forEach((o) => o.draw(ctx));

      // The star of the show — draw the bee during play/pause/gameover.
      if (this.state !== "menu") this.bee.draw(ctx);

      this.particles.forEach((p) => p.draw(ctx));

      // Subtle night-time darkening vignette for atmosphere.
      if (phase >= 0.5) {
        const nf = Math.sin(((phase - 0.5) / 0.5) * Math.PI) * 0.35;
        ctx.fillStyle = `rgba(10, 15, 40, ${nf})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Interpolated sky gradient across the day/night keyframes.
    _drawSky(ctx, phase) {
      // Keyframes: [phase, topRGB, bottomRGB]
      const keys = [
        [0.0, [255, 183, 94], [255, 224, 178]], // dawn
        [0.25, [100, 181, 246], [187, 222, 251]], // day
        [0.5, [255, 138, 101], [255, 204, 128]], // dusk
        [0.75, [16, 22, 60], [40, 53, 110]], // night
        [1.0, [255, 183, 94], [255, 224, 178]], // back to dawn
      ];
      let top = keys[0][1], bot = keys[0][2];
      for (let i = 0; i < keys.length - 1; i++) {
        if (phase >= keys[i][0] && phase <= keys[i + 1][0]) {
          const t = (phase - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
          top = [0, 1, 2].map((c) => U.lerp(keys[i][1][c], keys[i + 1][1][c], t));
          bot = [0, 1, 2].map((c) => U.lerp(keys[i][2][c], keys[i + 1][2][c], t));
          break;
        }
      }
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `rgb(${top.map(Math.round).join(",")})`);
      grad.addColorStop(1, `rgb(${bot.map(Math.round).join(",")})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Sun (day half) or moon (night half) arcing across the sky.
    _drawCelestial(ctx, phase) {
      const isDay = phase < 0.5;
      const p = isDay ? phase / 0.5 : (phase - 0.5) / 0.5;
      const x = U.lerp(0.12, 0.88, p) * W;
      const y = this.groundY - Math.sin(p * Math.PI) * this.groundY * 0.75;

      ctx.save();
      if (isDay) {
        // Sun with a soft glow.
        const glow = ctx.createRadialGradient(x, y, 10, x, y, 90);
        glow.addColorStop(0, "rgba(255, 245, 180, 0.9)");
        glow.addColorStop(1, "rgba(255, 245, 180, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff59d";
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Moon with a crescent shadow.
        const glow = ctx.createRadialGradient(x, y, 6, x, y, 70);
        glow.addColorStop(0, "rgba(220, 230, 255, 0.6)");
        glow.addColorStop(1, "rgba(220, 230, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#eceff1";
        ctx.beginPath();
        ctx.arc(x, y, 28, 0, Math.PI * 2);
        ctx.fill();
        // Shadow bite to make a crescent.
        ctx.fillStyle = this._nightSkyColorAt(phase);
        ctx.beginPath();
        ctx.arc(x + 12, y - 6, 26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _nightSkyColorAt() {
      // Approximate mid-night sky for the moon's crescent shadow.
      return "rgb(22, 30, 78)";
    }

    _drawStars(ctx, phase, dt) {
      const alpha = Math.sin(((phase - 0.5) / 0.5) * Math.PI); // 0..1..0 across night
      ctx.save();
      for (const s of this.stars) {
        s.tw += dt * 3;
        const tw = 0.5 + Math.sin(s.tw) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${alpha * tw})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Two rolling hill layers for depth (parallax at different speeds).
    _drawHills(ctx, phase) {
      const dark = phase >= 0.5;
      const layers = [
        { color: dark ? "#1b3a2a" : "#66bb6a", amp: 40, base: this.groundY - 20, speed: 0.15, len: 300 },
        { color: dark ? "#12281d" : "#4caf50", amp: 60, base: this.groundY + 10, speed: 0.3, len: 220 },
      ];
      for (const L of layers) {
        const off = (this.bgScroll * L.speed) % L.len;
        ctx.fillStyle = L.color;
        ctx.beginPath();
        ctx.moveTo(-off, L.base);
        for (let x = -off; x <= W + L.len; x += L.len / 2) {
          const y = L.base - Math.abs(Math.sin((x + off) / L.len * Math.PI)) * L.amp;
          ctx.quadraticCurveTo(x + L.len / 4, y - L.amp * 0.3, x + L.len / 2, L.base - Math.abs(Math.sin((x + off + L.len / 2) / L.len * Math.PI)) * L.amp);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Foreground grassy ground with scrolling blades of grass.
    _drawGround(ctx, phase) {
      const dark = phase >= 0.5;
      ctx.fillStyle = dark ? "#1f3d29" : "#5db84a";
      ctx.fillRect(0, this.groundY, W, H - this.groundY);

      // Darker soil strip.
      ctx.fillStyle = dark ? "#12251a" : "#3e8e30";
      ctx.fillRect(0, this.groundY + 26, W, H - this.groundY - 26);

      // Grass blades along the top edge, scrolling with the world.
      ctx.strokeStyle = dark ? "#2e5a3a" : "#4aa63a";
      ctx.lineWidth = 3;
      const off = this.bgScroll % 24;
      for (let x = -off; x < W; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, this.groundY);
        ctx.quadraticCurveTo(x + 4, this.groundY - 12, x + 8, this.groundY);
        ctx.stroke();
      }
    }

    /* -------------------------------------------------------
       Achievements screen population (called from main.js)
       ------------------------------------------------------- */
    renderAchievementsList() {
      const unlocked = BUZZY.Storage.getUnlocked();
      this.dom.achList.innerHTML = ACHIEVEMENTS.map((a) => {
        const got = !!unlocked[a.id];
        return `<div class="ach-item ${got ? "unlocked" : ""}">
          <div class="ach-icon">${got ? a.icon : "🔒"}</div>
          <div class="ach-text"><b>${a.name}</b><span>${a.desc}</span></div>
        </div>`;
      }).join("");
    }
  }

  BUZZY.Game = Game;
  BUZZY.ACHIEVEMENTS = ACHIEVEMENTS;
})();
