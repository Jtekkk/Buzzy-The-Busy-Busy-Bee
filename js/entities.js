/* ============================================================
   entities.js — game objects
   Every visible thing in the world is an Entity subclass. All art is
   drawn procedurally with the Canvas 2D API for a crisp, cartoonish
   look and zero image downloads. Each entity exposes:
     x, y      — centre position in design space
     radius    — collision radius (circle-based hit testing)
     active    — false when it should be removed
     update(dt, game)
     draw(ctx)
   ============================================================ */

(function () {
  const U = BUZZY.Utils;

  /* -----------------------------------------------------------
     Base Entity
     ----------------------------------------------------------- */
  class Entity {
    constructor(x, y, radius) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.active = true;
    }
    // Default behaviour: scroll left with the world.
    update(dt, game) {
      this.x -= game.scrollSpeed * dt;
      if (this.x + this.radius < -40) this.active = false;
    }
    draw(ctx) {}
  }

  /* -----------------------------------------------------------
     Bee (the player, "Buzzy")
     Smooth, momentum-based flight with a flapping-wing animation,
     shield bubble, magnet aura and invulnerability flashing.
     ----------------------------------------------------------- */
  const BEE = {
    accel: 2200, // px/s^2 applied from input
    maxSpeed: 420, // px/s cap
    friction: 6, // velocity damping when no input
  };

  class Bee extends Entity {
    constructor() {
      super(220, BUZZY.HEIGHT / 2, 26);
      this.vx = 0;
      this.vy = 0;
      this.w = 64;
      this.h = 46;
      this.flap = 0; // wing animation phase
      this.tilt = 0; // visual tilt based on vertical velocity

      // Power-up / status timers (seconds remaining).
      this.shield = 0;
      this.speedBoost = 0;
      this.magnet = 0;
      this.invuln = 0; // brief mercy invincibility after a hit
    }

    reset() {
      this.x = 220;
      this.y = BUZZY.HEIGHT / 2;
      this.vx = this.vy = 0;
      this.shield = this.speedBoost = this.magnet = this.invuln = 0;
    }

    update(dt, game) {
      const input = game.input;
      const boost = this.speedBoost > 0 ? 1.6 : 1;

      // --- Determine desired direction from keyboard or touch ---
      let dx = input.dir.x;
      let dy = input.dir.y;
      if (input.touchActive) {
        // Fly toward the finger; normalise so it isn't jittery when close.
        const tx = input.touchX - this.x;
        const ty = input.touchY - this.y;
        const d = Math.hypot(tx, ty);
        if (d > 6) {
          dx = tx / d;
          dy = ty / d;
        } else {
          dx = dy = 0;
        }
      }

      // --- Apply acceleration + friction for a floaty, momentum feel ---
      this.vx += dx * BEE.accel * boost * dt;
      this.vy += dy * BEE.accel * boost * dt;
      // Damp toward zero when idle on an axis.
      if (dx === 0) this.vx -= this.vx * Math.min(1, BEE.friction * dt);
      if (dy === 0) this.vy -= this.vy * Math.min(1, BEE.friction * dt);

      const maxS = BEE.maxSpeed * boost;
      this.vx = U.clamp(this.vx, -maxS, maxS);
      this.vy = U.clamp(this.vy, -maxS, maxS);

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // --- Keep Buzzy on screen (bounce softly off edges) ---
      const pad = this.radius;
      if (this.x < pad) {
        this.x = pad;
        this.vx *= -0.3;
      }
      if (this.x > BUZZY.WIDTH - pad) {
        this.x = BUZZY.WIDTH - pad;
        this.vx *= -0.3;
      }
      if (this.y < pad + 4) {
        this.y = pad + 4;
        this.vy *= -0.3;
      }
      const floor = game.groundY - pad;
      if (this.y > floor) {
        this.y = floor;
        this.vy *= -0.3;
      }

      // --- Animation state ---
      this.flap += dt * 40; // fast wing beat
      this.tilt = U.lerp(this.tilt, U.clamp(this.vy / maxS, -1, 1) * 0.4, 0.2);

      // --- Tick down status timers ---
      ["shield", "speedBoost", "magnet", "invuln"].forEach((k) => {
        if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
      });
    }

    // Called by the game when the bee takes a hit. Returns true if the hit
    // "counts" (i.e. was not absorbed by a shield or mercy invulnerability).
    takeHit() {
      if (this.invuln > 0) return false;
      if (this.shield > 0) {
        this.shield = 0;
        this.invuln = 1.0;
        return false; // shield absorbed it
      }
      this.invuln = 1.5; // mercy window after losing a heart
      return true;
    }

    draw(ctx) {
      const flapY = Math.sin(this.flap) * 10;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.tilt);

      // Blink out during invulnerability (skip some frames).
      const blinking = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
      if (blinking) ctx.globalAlpha = 0.35;

      // --- Magnet aura ---
      if (this.magnet > 0) {
        ctx.save();
        ctx.globalAlpha = 0.15 + Math.sin(this.flap * 0.3) * 0.05;
        ctx.fillStyle = "#7c4dff";
        ctx.beginPath();
        ctx.arc(0, 0, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- Wings (behind body), semi-transparent, flapping ---
      ctx.fillStyle = "rgba(220, 240, 255, 0.75)";
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      // Upper wing
      ctx.save();
      ctx.translate(-6, -14);
      ctx.rotate(-0.3 + flapY * 0.03);
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // Lower wing
      ctx.save();
      ctx.translate(-6, 6);
      ctx.rotate(0.3 - flapY * 0.03);
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // --- Body (rounded, striped) ---
      ctx.fillStyle = "#ffcc33";
      ctx.strokeStyle = "#3a2e1f";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Black stripes (clipped to the body shape).
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#3a2e1f";
      for (const sx of [-2, 10]) {
        ctx.fillRect(sx, -22, 8, 44);
      }
      ctx.restore();

      // Stinger
      ctx.fillStyle = "#3a2e1f";
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(-36, -5);
      ctx.lineTo(-36, 5);
      ctx.closePath();
      ctx.fill();

      // --- Head ---
      ctx.fillStyle = "#3a2e1f";
      ctx.beginPath();
      ctx.arc(24, -2, 12, 0, Math.PI * 2);
      ctx.fill();

      // Eye (white + pupil looking forward)
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(28, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(30, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(26, 2, 5, 0.1 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      // Antennae
      ctx.strokeStyle = "#3a2e1f";
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(26, -10);
        ctx.quadraticCurveTo(34, -20 - s * 3, 40 + s * 2, -22 - s * 4);
        ctx.stroke();
        ctx.fillStyle = "#ffcc33";
        ctx.beginPath();
        ctx.arc(40 + s * 2, -22 - s * 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // --- Shield bubble (drawn last, over everything) ---
      if (this.shield > 0) {
        const pulse = 0.6 + Math.sin(this.flap * 0.5) * 0.15;
        ctx.strokeStyle = `rgba(80, 200, 255, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(120, 210, 255, 0.12)`;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /* -----------------------------------------------------------
     Flower / Nectar collectible
     Different types are worth different points and look distinct.
     ----------------------------------------------------------- */
  const FLOWER_TYPES = [
    { name: "daisy", points: 10, petal: "#ffffff", center: "#ffcc33", petals: 8, r: 18, weight: 45 },
    { name: "tulip", points: 25, petal: "#ff6f91", center: "#ffd54f", petals: 6, r: 19, weight: 28 },
    { name: "rose", points: 50, petal: "#e53935", center: "#b71c1c", petals: 10, r: 20, weight: 18 },
    { name: "bluebell", points: 75, petal: "#5c6bc0", center: "#c5cae9", petals: 6, r: 18, weight: 7 },
    { name: "sunflower", points: 100, petal: "#ffb300", center: "#6d4c41", petals: 12, r: 24, weight: 2 },
  ];

  class Flower extends Entity {
    constructor(x, y, type) {
      super(x, y, (type.r || 18) + 4);
      this.type = type;
      this.baseY = y;
      this.phase = U.rand(0, Math.PI * 2);
      this.spin = U.rand(-0.5, 0.5);
      this.angle = 0;
      this.collected = false;
    }

    // Weighted random flower type (rarer flowers = more points).
    static randomType() {
      const total = FLOWER_TYPES.reduce((s, t) => s + t.weight, 0);
      let r = Math.random() * total;
      for (const t of FLOWER_TYPES) {
        if ((r -= t.weight) <= 0) return t;
      }
      return FLOWER_TYPES[0];
    }

    update(dt, game) {
      super.update(dt, game);
      // Gentle bob + slow rotation.
      this.phase += dt * 2;
      this.y = this.baseY + Math.sin(this.phase) * 6;
      this.angle += this.spin * dt;

      // Magnet: drift toward the bee when active and nearby.
      if (game.bee.magnet > 0) {
        const d = U.dist(this.x, this.y, game.bee.x, game.bee.y);
        if (d < 220) {
          const pull = (1 - d / 220) * 600 * dt;
          const a = Math.atan2(game.bee.y - this.y, game.bee.x - this.x);
          this.x += Math.cos(a) * pull;
          this.baseY += Math.sin(a) * pull;
        }
      }
    }

    draw(ctx) {
      const t = this.type;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Petals
      ctx.fillStyle = t.petal;
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < t.petals; i++) {
        const a = (i / t.petals) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -t.r * 0.7, t.r * 0.42, t.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Center with a little glossy highlight (marks it as collectable).
      ctx.fillStyle = t.center;
      ctx.beginPath();
      ctx.arc(0, 0, t.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(-t.r * 0.12, -t.r * 0.12, t.r * 0.14, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /* -----------------------------------------------------------
     Spider — dangles from a web thread and bobs up and down.
     ----------------------------------------------------------- */
  class Spider extends Entity {
    constructor(x, y) {
      super(x, y, 20);
      this.baseY = y;
      this.phase = U.rand(0, Math.PI * 2);
      this.legPhase = 0;
      this.anchorY = -20; // top of the thread (off-screen)
    }
    update(dt, game) {
      super.update(dt, game);
      this.phase += dt * 1.5;
      this.y = this.baseY + Math.sin(this.phase) * 40;
      this.legPhase += dt * 8;
    }
    draw(ctx) {
      // Web thread from the top of the screen down to the spider.
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.x, this.anchorY);
      ctx.lineTo(this.x, this.y - this.radius);
      ctx.stroke();

      ctx.save();
      ctx.translate(this.x, this.y);

      // Legs (animated wiggle)
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2.5;
      const wig = Math.sin(this.legPhase) * 3;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const ly = -8 + i * 8;
          ctx.beginPath();
          ctx.moveTo(0, ly - 4);
          ctx.quadraticCurveTo(s * 18, ly - 6 + wig, s * 24, ly + 6 - wig);
          ctx.stroke();
        }
      }

      // Body
      ctx.fillStyle = "#2b2b2b";
      ctx.beginPath();
      ctx.arc(0, 6, 14, 0, Math.PI * 2); // abdomen
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -8, 9, 0, Math.PI * 2); // head
      ctx.fill();

      // A little red hourglass marking + eyes for menace/charm.
      ctx.fillStyle = "#e53935";
      ctx.beginPath();
      ctx.arc(0, 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 3, -9, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* -----------------------------------------------------------
     Bird — flies leftward faster than the scroll, flapping wings.
     ----------------------------------------------------------- */
  class Bird extends Entity {
    constructor(x, y) {
      super(x, y, 22);
      this.flap = U.rand(0, Math.PI * 2);
      this.bobPhase = U.rand(0, Math.PI * 2);
      this.baseY = y;
      this.extraSpeed = U.rand(80, 160); // birds overtake the world
      this.color = U.pick(["#5d4037", "#455a64", "#6d4c41", "#37474f"]);
    }
    update(dt, game) {
      this.x -= (game.scrollSpeed + this.extraSpeed) * dt;
      this.bobPhase += dt * 3;
      this.y = this.baseY + Math.sin(this.bobPhase) * 12;
      this.flap += dt * 14;
      if (this.x + this.radius < -40) this.active = false;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const wing = Math.sin(this.flap) * 18;

      // Body
      ctx.fillStyle = this.color;
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Wings (flap up/down)
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(-14, -wing, -26, -wing * 0.4);
      ctx.quadraticCurveTo(-14, 6, -2, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.quadraticCurveTo(14, -wing, 26, -wing * 0.4);
      ctx.quadraticCurveTo(14, 6, 2, 4);
      ctx.fill();

      // Head + beak (facing left, the way it flies)
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(-16, -4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9800";
      ctx.beginPath();
      ctx.moveTo(-24, -4);
      ctx.lineTo(-34, -2);
      ctx.lineTo(-24, 1);
      ctx.closePath();
      ctx.fill();
      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-18, -6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(-18.5, -6, 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /* -----------------------------------------------------------
     Pesticide spray — a drifting toxic cloud with wobbling puffs.
     ----------------------------------------------------------- */
  class Pesticide extends Entity {
    constructor(x, y) {
      super(x, y, 28);
      this.phase = U.rand(0, Math.PI * 2);
      this.baseY = y;
      // Pre-compute a few puff offsets for a lumpy cloud silhouette.
      this.puffs = [];
      for (let i = 0; i < 6; i++) {
        this.puffs.push({
          dx: U.rand(-22, 22),
          dy: U.rand(-14, 14),
          r: U.rand(12, 20),
          sp: U.rand(1, 3),
        });
      }
    }
    update(dt, game) {
      super.update(dt, game);
      this.phase += dt * 3;
      this.y = this.baseY + Math.sin(this.phase) * 8;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // Greenish toxic haze
      for (const p of this.puffs) {
        const wob = Math.sin(this.phase * p.sp) * 3;
        ctx.fillStyle = "rgba(140, 200, 80, 0.55)";
        ctx.beginPath();
        ctx.arc(p.dx + wob, p.dy + wob, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Skull hint in the middle to read as danger.
      ctx.fillStyle = "rgba(60, 90, 30, 0.9)";
      ctx.beginPath();
      ctx.arc(0, -2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(140, 200, 80, 0.9)";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 2.5, -3, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(-3, 3, 6, 3);
      ctx.restore();
    }
  }

  /* -----------------------------------------------------------
     PowerUp — floating orb: speed boost, shield or nectar magnet.
     ----------------------------------------------------------- */
  const POWERUP_TYPES = {
    speed: { color: "#ff5252", icon: "⚡", label: "Speed Boost", duration: 6 },
    shield: { color: "#40c4ff", icon: "🛡️", label: "Shield", duration: 8 },
    magnet: { color: "#7c4dff", icon: "🧲", label: "Nectar Magnet", duration: 7 },
  };

  class PowerUp extends Entity {
    constructor(x, y, kind) {
      super(x, y, 22);
      this.kind = kind;
      this.info = POWERUP_TYPES[kind];
      this.baseY = y;
      this.phase = U.rand(0, Math.PI * 2);
    }
    static randomKind() {
      return U.pick(Object.keys(POWERUP_TYPES));
    }
    update(dt, game) {
      super.update(dt, game);
      this.phase += dt * 3;
      this.y = this.baseY + Math.sin(this.phase) * 10;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const pulse = 1 + Math.sin(this.phase * 1.5) * 0.08;
      ctx.scale(pulse, pulse);

      // Glow halo
      ctx.fillStyle = this.info.color + "55";
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      // Orb
      const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 20);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, this.info.color);
      grad.addColorStop(1, this.info.color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon
      ctx.font = "18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.info.icon, 0, 1);
      ctx.restore();
    }
  }

  /* -----------------------------------------------------------
     Cloud — pure background decoration (parallax layer).
     ----------------------------------------------------------- */
  class Cloud extends Entity {
    constructor(x, y, scale, speed) {
      super(x, y, 0);
      this.scale = scale;
      this.speed = speed; // own parallax speed, independent of world
    }
    update(dt, game) {
      this.x -= this.speed * dt;
      if (this.x < -160 * this.scale) {
        this.x = BUZZY.WIDTH + 160 * this.scale;
        this.y = U.rand(30, 180);
      }
    }
    draw(ctx, alpha = 1) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.scale, this.scale);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`;
      // Cluster of circles = fluffy cloud.
      const blobs = [
        [0, 0, 34],
        [-30, 8, 26],
        [30, 8, 26],
        [-12, -14, 24],
        [16, -12, 22],
      ];
      for (const [bx, by, br] of blobs) {
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* -----------------------------------------------------------
     Particle — short-lived visual effect (sparkles, poof, hearts).
     ----------------------------------------------------------- */
  class Particle extends Entity {
    constructor(x, y, opts = {}) {
      super(x, y, 0);
      this.vx = opts.vx ?? U.rand(-120, 120);
      this.vy = opts.vy ?? U.rand(-160, -40);
      this.life = opts.life ?? U.rand(0.4, 0.9);
      this.maxLife = this.life;
      this.color = opts.color ?? "#ffd54f";
      this.size = opts.size ?? U.rand(3, 6);
      this.gravity = opts.gravity ?? 300;
      this.text = opts.text ?? null; // floating score/emoji
      this.scroll = opts.scroll ?? true;
    }
    update(dt, game) {
      this.life -= dt;
      if (this.life <= 0) {
        this.active = false;
        return;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += this.gravity * dt;
      if (this.scroll) this.x -= game.scrollSpeed * dt;
    }
    draw(ctx) {
      const a = U.clamp(this.life / this.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (this.text) {
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px "Trebuchet MS", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.text, this.x, this.y);
      } else {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Expose entity classes + config on the namespace.
  BUZZY.Entity = Entity;
  BUZZY.Bee = Bee;
  BUZZY.Flower = Flower;
  BUZZY.Spider = Spider;
  BUZZY.Bird = Bird;
  BUZZY.Pesticide = Pesticide;
  BUZZY.PowerUp = PowerUp;
  BUZZY.Cloud = Cloud;
  BUZZY.Particle = Particle;
  BUZZY.FLOWER_TYPES = FLOWER_TYPES;
  BUZZY.POWERUP_TYPES = POWERUP_TYPES;
})();
