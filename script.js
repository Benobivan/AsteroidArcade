(() => {
  "use strict";

  // ===== Canvas / Grundsetup =====
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  // ===== Konfiguration =====
  const CONFIG = {
    ship: {
      radius: 14,
      rotationSpeed: Math.PI * 2.4,
      thrust: 260,
      friction: 0.992,
      maxSpeed: 420,
      respawnInvincibleMs: 1600,
    },
    bullets: {
      speed: 520,
      lifeMs: 850,
      cooldownMs: 140,
      radius: 2,
    },
    asteroids: {
      baseSpeed: 42,
      speedVariance: 58,
      spawnSafeRadius: 140,
      sizes: [48, 28, 16], // groß -> klein
    },
    gameplay: {
      startLives: 3,
      waveBaseCount: 4,
      pointsBySize: [20, 50, 100],
    },
  };

  // ===== Eingabe =====
  const input = {
    left: false,
    right: false,
    thrust: false,
    shoot: false,
  };

  // ===== Spielzustand =====
  let state;

  function makeInitialState() {
    return {
      running: true,
      paused: false,
      score: 0,
      lives: CONFIG.gameplay.startLives,
      wave: 1,
      ship: createShip(),
      bullets: [],
      asteroids: [],
      particles: [],
      lastShotAt: 0,
      flashUntil: 0,
      now: performance.now(),
      lastTime: performance.now(),
      gameOverAt: null,
    };
  }

  // ===== Entities =====
  function createShip() {
    return {
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      alive: true,
      invincibleUntil: performance.now() + CONFIG.ship.respawnInvincibleMs,
    };
  }

  function createAsteroid(x, y, sizeIndex) {
    const angle = Math.random() * Math.PI * 2;
    const speed = CONFIG.asteroids.baseSpeed + Math.random() * CONFIG.asteroids.speedVariance;

    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      sizeIndex,
      radius: CONFIG.asteroids.sizes[sizeIndex],
      spin: (Math.random() - 0.5) * 1.2,
      angle: Math.random() * Math.PI * 2,
      shape: buildRockShape(),
    };
  }

  function buildRockShape() {
    // Unregelmäßige Formpunkte für Retro-Asteroiden
    const points = 10;
    const arr = [];
    for (let i = 0; i < points; i++) {
      const t = (i / points) * Math.PI * 2;
      const radialOffset = 0.72 + Math.random() * 0.38;
      arr.push({ t, r: radialOffset });
    }
    return arr;
  }

  function spawnWave() {
    const count = CONFIG.gameplay.waveBaseCount + state.wave;

    for (let i = 0; i < count; i++) {
      let x;
      let y;
      let tries = 0;

      // Nicht direkt auf dem Spawnpunkt des Schiffs starten
      do {
        x = Math.random() * width;
        y = Math.random() * height;
        tries += 1;
      } while (
        tries < 40 &&
        distance(x, y, state.ship.x, state.ship.y) < CONFIG.asteroids.spawnSafeRadius
      );

      state.asteroids.push(createAsteroid(x, y, 0));
    }
  }

  // ===== Hilfsfunktionen =====
  function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function wrap(entity) {
    if (entity.x < 0) entity.x += width;
    if (entity.x >= width) entity.x -= width;
    if (entity.y < 0) entity.y += height;
    if (entity.y >= height) entity.y -= height;
  }

  function clampMagnitude(obj, max) {
    const speed = Math.hypot(obj.vx, obj.vy);
    if (speed > max) {
      const factor = max / speed;
      obj.vx *= factor;
      obj.vy *= factor;
    }
  }

  function angleToVector(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  // ===== Input Handling =====
  function onKeyChange(e, down) {
    switch (e.code) {
      case "ArrowLeft":
        input.left = down;
        e.preventDefault();
        break;
      case "ArrowRight":
        input.right = down;
        e.preventDefault();
        break;
      case "ArrowUp":
        input.thrust = down;
        e.preventDefault();
        break;
      case "Space":
        input.shoot = down;
        e.preventDefault();
        break;
      case "Enter":
        if (down && !state.running) {
          restartGame();
        }
        break;
      case "KeyP":
        if (down && state.running) {
          state.paused = !state.paused;
        }
        break;
      default:
        break;
    }
  }

  window.addEventListener("keydown", (e) => onKeyChange(e, true));
  window.addEventListener("keyup", (e) => onKeyChange(e, false));

  // ===== Gameplay Logik =====
  function shoot(now) {
    if (!state.ship.alive) return;
    if (now - state.lastShotAt < CONFIG.bullets.cooldownMs) return;

    const dir = angleToVector(state.ship.angle);
    const noseX = state.ship.x + dir.x * (CONFIG.ship.radius + 2);
    const noseY = state.ship.y + dir.y * (CONFIG.ship.radius + 2);

    state.bullets.push({
      x: noseX,
      y: noseY,
      vx: state.ship.vx + dir.x * CONFIG.bullets.speed,
      vy: state.ship.vy + dir.y * CONFIG.bullets.speed,
      bornAt: now,
      radius: CONFIG.bullets.radius,
    });

    state.flashUntil = now + 50;
    state.lastShotAt = now;
  }

  function breakAsteroid(asteroid) {
    state.score += CONFIG.gameplay.pointsBySize[asteroid.sizeIndex] ?? 0;

    // Partikel-Explosion (schlicht)
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 130;
      state.particles.push({
        x: asteroid.x,
        y: asteroid.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 260 + Math.random() * 260,
        createdAt: state.now,
      });
    }

    // Split in kleinere Asteroiden
    if (asteroid.sizeIndex < CONFIG.asteroids.sizes.length - 1) {
      const nextSize = asteroid.sizeIndex + 1;
      for (let i = 0; i < 2; i++) {
        const child = createAsteroid(asteroid.x, asteroid.y, nextSize);
        child.vx += asteroid.vx * 0.25;
        child.vy += asteroid.vy * 0.25;
        state.asteroids.push(child);
      }
    }
  }

  function loseLife() {
    state.lives -= 1;

    // Schiffsexplosion
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 70 + Math.random() * 140;
      state.particles.push({
        x: state.ship.x,
        y: state.ship.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 350 + Math.random() * 250,
        createdAt: state.now,
      });
    }

    if (state.lives <= 0) {
      state.ship.alive = false;
      state.running = false;
      state.gameOverAt = state.now;
      return;
    }

    // Respawn in der Mitte
    state.ship = createShip();
  }

  function restartGame() {
    state = makeInitialState();
    spawnWave();
  }

  function updateShip(dt, now) {
    const ship = state.ship;
    if (!ship.alive) return;

    if (input.left) ship.angle -= CONFIG.ship.rotationSpeed * dt;
    if (input.right) ship.angle += CONFIG.ship.rotationSpeed * dt;

    if (input.thrust) {
      const dir = angleToVector(ship.angle);
      ship.vx += dir.x * CONFIG.ship.thrust * dt;
      ship.vy += dir.y * CONFIG.ship.thrust * dt;

      // Mini-Triebwerksfunken
      if (Math.random() < 0.4) {
        state.particles.push({
          x: ship.x - dir.x * CONFIG.ship.radius,
          y: ship.y - dir.y * CONFIG.ship.radius,
          vx: -dir.x * (70 + Math.random() * 80) + (Math.random() - 0.5) * 35,
          vy: -dir.y * (70 + Math.random() * 80) + (Math.random() - 0.5) * 35,
          life: 140 + Math.random() * 120,
          createdAt: now,
        });
      }
    }

    ship.vx *= CONFIG.ship.friction;
    ship.vy *= CONFIG.ship.friction;
    clampMagnitude(ship, CONFIG.ship.maxSpeed);

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship);

    if (input.shoot) shoot(now);
  }

  function updateBullets(dt, now) {
    state.bullets = state.bullets.filter((b) => now - b.bornAt <= CONFIG.bullets.lifeMs);
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      wrap(bullet);
    }
  }

  function updateAsteroids(dt) {
    for (const asteroid of state.asteroids) {
      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;
      asteroid.angle += asteroid.spin * dt;
      wrap(asteroid);
    }
  }

  function updateParticles(now, dt) {
    state.particles = state.particles.filter((p) => now - p.createdAt <= p.life);
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      wrap(p);
    }
  }

  function handleCollisions(now) {
    // Bullet vs Asteroid
    for (let b = state.bullets.length - 1; b >= 0; b--) {
      const bullet = state.bullets[b];
      let hit = false;

      for (let a = state.asteroids.length - 1; a >= 0; a--) {
        const asteroid = state.asteroids[a];
        const hitDistance = asteroid.radius + bullet.radius;
        if (distance(bullet.x, bullet.y, asteroid.x, asteroid.y) <= hitDistance) {
          state.asteroids.splice(a, 1);
          breakAsteroid(asteroid);
          hit = true;
          break;
        }
      }

      if (hit) state.bullets.splice(b, 1);
    }

    // Ship vs Asteroid
    const ship = state.ship;
    const invincible = now < ship.invincibleUntil;
    if (ship.alive && !invincible) {
      for (const asteroid of state.asteroids) {
        if (distance(ship.x, ship.y, asteroid.x, asteroid.y) <= CONFIG.ship.radius + asteroid.radius * 0.78) {
          loseLife();
          break;
        }
      }
    }
  }

  function updateWaveProgress() {
    if (state.asteroids.length === 0 && state.running) {
      state.wave += 1;
      spawnWave();
    }
  }

  // ===== Rendering =====
  function clearCanvas() {
    ctx.fillStyle = "#02030a";
    ctx.fillRect(0, 0, width, height);
  }

  function drawShip(now) {
    const ship = state.ship;
    if (!ship.alive) return;

    const invincible = now < ship.invincibleUntil;
    const blink = Math.floor(now / 90) % 2 === 0;
    if (invincible && !blink) return;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.strokeStyle = "#e5f3ff";
    ctx.lineWidth = 2;

    // Raumschiff (Dreieck)
    ctx.beginPath();
    ctx.moveTo(CONFIG.ship.radius, 0);
    ctx.lineTo(-CONFIG.ship.radius * 0.82, CONFIG.ship.radius * 0.72);
    ctx.lineTo(-CONFIG.ship.radius * 0.52, 0);
    ctx.lineTo(-CONFIG.ship.radius * 0.82, -CONFIG.ship.radius * 0.72);
    ctx.closePath();
    ctx.stroke();

    // Mündungsfeuer (kurzer Blitz)
    if (now < state.flashUntil) {
      ctx.strokeStyle = "#ffe083";
      ctx.beginPath();
      ctx.moveTo(CONFIG.ship.radius + 2, 0);
      ctx.lineTo(CONFIG.ship.radius + 10, 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBullets() {
    ctx.fillStyle = "#ffe083";
    for (const bullet of state.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAsteroids() {
    ctx.strokeStyle = "#9fbbff";
    ctx.lineWidth = 2;

    for (const asteroid of state.asteroids) {
      ctx.save();
      ctx.translate(asteroid.x, asteroid.y);
      ctx.rotate(asteroid.angle);
      ctx.beginPath();

      asteroid.shape.forEach((point, i) => {
        const px = Math.cos(point.t) * asteroid.radius * point.r;
        const py = Math.sin(point.t) * asteroid.radius * point.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });

      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawParticles(now) {
    for (const p of state.particles) {
      const age = now - p.createdAt;
      const alpha = Math.max(0, 1 - age / p.life);
      ctx.fillStyle = `rgba(255, 215, 150, ${alpha.toFixed(3)})`;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }

  function drawHUD() {
    ctx.fillStyle = "#d3e3ff";
    ctx.font = '20px "Courier New", monospace';
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${state.score}`, 20, 32);
    ctx.fillText(`Leben: ${state.lives}`, 20, 58);
    ctx.fillText(`Welle: ${state.wave}`, 20, 84);
    if (state.paused && state.running) {
      ctx.fillStyle = "#ffe083";
      ctx.fillText("Status: Pausiert", 20, 110);
    }
  }

  function drawGameOver(now) {
    if (state.running) return;

    const pulse = 0.65 + Math.sin(now * 0.01) * 0.2;
    ctx.fillStyle = `rgba(2, 3, 10, ${0.6 + pulse * 0.2})`;
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff9ea1";
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.fillText("GAME OVER", width / 2, height / 2 - 18);

    ctx.fillStyle = "#e4eeff";
    ctx.font = '22px "Courier New", monospace';
    ctx.fillText(`Final Score: ${state.score}`, width / 2, height / 2 + 28);
    ctx.fillText("Drücke Enter für Neustart", width / 2, height / 2 + 72);
  }

  function drawPauseOverlay() {
    if (!state.paused || !state.running) return;

    ctx.fillStyle = "rgba(2, 3, 10, 0.45)";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe083";
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.fillText("PAUSE", width / 2, height / 2 - 8);
    ctx.fillStyle = "#e4eeff";
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText("Drücke P zum Fortsetzen", width / 2, height / 2 + 30);
  }

  function render(now) {
    clearCanvas();
    drawAsteroids();
    drawBullets();
    drawShip(now);
    drawParticles(now);
    drawHUD();
    drawPauseOverlay();
    drawGameOver(now);
  }

  // ===== Game Loop =====
  function gameLoop(now) {
    state.now = now;
    const dt = Math.min(0.033, (now - state.lastTime) / 1000); // stabiler Delta-Zeitschritt
    state.lastTime = now;

    if (state.running && !state.paused) {
      updateShip(dt, now);
      updateBullets(dt, now);
      updateAsteroids(dt);
      updateParticles(now, dt);
      handleCollisions(now);
      updateWaveProgress();
    } else if (!state.running) {
      updateParticles(now, dt);
    }

    render(now);
    requestAnimationFrame(gameLoop);
  }

  function init() {
    state = makeInitialState();
    spawnWave();
    requestAnimationFrame(gameLoop);
  }

  init();
})();
