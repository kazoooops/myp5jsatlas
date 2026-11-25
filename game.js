(() => {
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const screen = document.querySelector("#screen");
  const startButton = document.querySelector("#start-button");
  const restartButton = document.querySelector("#restart-button");
  const livesLabel = document.querySelector("#lives");
  const starLabel = document.querySelector("#star-count");
  const titleLabel = document.querySelector("#screen-title");
  const copyLabel = document.querySelector("#screen-copy");
  const kickerLabel = document.querySelector("#screen-kicker");

  const VIEW_WIDTH = canvas.width;
  const VIEW_HEIGHT = canvas.height;
  const WORLD_WIDTH = 3660;
  const GROUND_Y = 460;
  const gravity = 0.62;
  const platforms = [
    { x: 0, y: GROUND_Y, w: 870, h: 120 },
    { x: 1010, y: GROUND_Y, w: 750, h: 120 },
    { x: 1880, y: GROUND_Y, w: 790, h: 120 },
    { x: 2790, y: GROUND_Y, w: 870, h: 120 },
    { x: 310, y: 370, w: 150, h: 16 },
    { x: 580, y: 310, w: 145, h: 16 },
    { x: 1120, y: 375, w: 155, h: 16 },
    { x: 1430, y: 320, w: 160, h: 16 },
    { x: 2050, y: 365, w: 155, h: 16 },
    { x: 2340, y: 300, w: 150, h: 16 },
    { x: 2920, y: 370, w: 160, h: 16 },
    { x: 3220, y: 310, w: 150, h: 16 }
  ];
  const starSpots = [
    [355, 331], [625, 271], [1170, 336], [1490, 281],
    [2110, 326], [2400, 261], [2970, 331], [3270, 271]
  ];
  const enemySpots = [540, 810, 1220, 1640, 1990, 2260, 2570, 3000, 3390];
  const keys = new Set();
  const touchState = new Set();
  const stars = starSpots.map(([x, y]) => ({ x, y, collected: false, phase: Math.random() * Math.PI * 2 }));
  const enemies = enemySpots.map((x, index) => ({
    x, startX: x, y: GROUND_Y - 27, w: 34, h: 27,
    direction: index % 2 ? -1 : 1, speed: 0.65 + (index % 3) * 0.12,
    alive: true, phase: Math.random() * 5
  }));
  const player = { x: 65, y: GROUND_Y - 48, w: 30, h: 42, vx: 0, vy: 0, facing: 1, grounded: false, invulnerable: 0, attack: 0 };

  let state = "ready";
  let cameraX = 0;
  let lives = 3;
  let collected = 0;
  let lastTime = 0;
  let elapsed = 0;
  let jumpWasDown = false;

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VIEW_WIDTH * ratio;
    canvas.height = VIEW_HEIGHT * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function resetGame() {
    state = "playing";
    player.x = 65;
    player.y = GROUND_Y - player.h;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.invulnerable = 0;
    player.attack = 0;
    jumpWasDown = false;
    cameraX = 0;
    lives = 3;
    collected = 0;
    stars.forEach(star => { star.collected = false; });
    enemies.forEach(enemy => {
      enemy.alive = true;
      enemy.x = enemy.startX;
      enemy.direction = enemy.startX % 2 ? -1 : 1;
    });
    updateHud();
    screen.classList.add("is-hidden");
  }

  function updateHud() {
    livesLabel.textContent = `${"♥ ".repeat(lives).trim()}${lives < 3 ? ` ${"♡ ".repeat(3 - lives).trim()}` : ""}`;
    starLabel.textContent = `${collected} / 8`;
  }

  function showScreen(kind) {
    state = kind;
    screen.classList.remove("is-hidden");
    if (kind === "won") {
      kickerLabel.textContent = "YOU FOUND YOUR WAY HOME";
      titleLabel.textContent = "夜明けがきた！";
      copyLabel.innerHTML = `星を ${collected} 個みつけたよ。<br>すてきな冒険だったね！`;
      startButton.innerHTML = "もう一度あそぶ <span aria-hidden=\"true\">↻</span>";
    } else if (kind === "lost") {
      kickerLabel.textContent = "ONE MORE TRY?";
      titleLabel.textContent = "もう少しだったのに…";
      copyLabel.innerHTML = `星を ${collected} 個みつけたよ。<br>もう一度、ゴールを目指そう！`;
      startButton.innerHTML = "もう一度チャレンジ <span aria-hidden=\"true\">→</span>";
    } else {
      kickerLabel.textContent = "A LITTLE NIGHT ADVENTURE";
      titleLabel.textContent = "星をあつめよう";
      copyLabel.innerHTML = "草原を駆け抜けて、光る星を集めよう。<br>敵はジャンプで踏むか、攻撃で倒せるよ。";
      startButton.innerHTML = "冒険をはじめる <span aria-hidden=\"true\">→</span>";
    }
  }

  function isPressed(...controls) {
    return controls.some(control => keys.has(control) || touchState.has(control));
  }

  function update(dt) {
    if (state !== "playing") return;
    const frame = Math.min(dt / 16.67, 2);
    elapsed += dt;
    const left = isPressed("ArrowLeft", "a", "left");
    const right = isPressed("ArrowRight", "d", "right");
    const move = Number(right) - Number(left);
    if (move) player.facing = move;
    player.vx = move * 3.8;
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x + player.vx * frame));

    const jumpDown = isPressed("Space", "ArrowUp", "w", "jump");
    if (jumpDown && !jumpWasDown && player.grounded) {
      player.vy = -12.4;
      player.grounded = false;
    }
    jumpWasDown = jumpDown;
    if (isPressed("x", "j", "attack") && player.attack <= 0) player.attack = 13;
    if (player.attack > 0) player.attack -= frame;
    if (player.invulnerable > 0) player.invulnerable -= frame;

    const previousBottom = player.y + player.h;
    player.vy = Math.min(player.vy + gravity * frame, 14);
    player.y += player.vy * frame;
    player.grounded = false;
    for (const platform of platforms) {
      const horizontallyOverlapping = player.x + player.w > platform.x && player.x < platform.x + platform.w;
      if (horizontallyOverlapping && previousBottom <= platform.y && player.y + player.h >= platform.y && player.vy >= 0) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }

    for (const star of stars) {
      if (!star.collected && overlaps(player.x, player.y, player.w, player.h, star.x - 12, star.y - 12, 24, 24)) {
        star.collected = true;
        collected++;
        updateHud();
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.direction * enemy.speed * frame;
      if (Math.abs(enemy.x - enemy.startX) > 48) enemy.direction *= -1;
      if (!overlaps(player.x, player.y, player.w, player.h, enemy.x, enemy.y, enemy.w, enemy.h)) continue;
      const stomping = player.vy > 1 && previousBottom <= enemy.y + 10;
      const attacking = player.attack > 0 && (
        player.facing > 0
          ? player.x + player.w <= enemy.x + 31 && player.x + player.w + 36 > enemy.x
          : player.x >= enemy.x + 3 && player.x - 36 < enemy.x + enemy.w
      );
      if (stomping || attacking) {
        enemy.alive = false;
        player.vy = stomping ? -7.3 : player.vy;
      } else if (player.invulnerable <= 0) {
        lives--;
        updateHud();
        player.invulnerable = 95;
        player.vy = -7;
        player.vx = player.x < enemy.x ? -5 : 5;
        if (lives <= 0) showScreen("lost");
      }
    }

    if (player.y > VIEW_HEIGHT + 90) {
      lives--;
      updateHud();
      if (lives <= 0) {
        showScreen("lost");
      } else {
        const safeGround = platforms.filter(platform => platform.y === GROUND_Y && platform.x < player.x).pop() || platforms[0];
        player.x = Math.max(65, safeGround.x + 80);
        player.y = safeGround.y - player.h - 1;
        player.vy = -5;
        player.invulnerable = 100;
      }
    }
    cameraX += (Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, player.x - VIEW_WIDTH * 0.38)) - cameraX) * 0.12;
    if (player.x > 3520) showScreen("won");
  }

  function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    sky.addColorStop(0, "#202b55");
    sky.addColorStop(.64, "#485680");
    sky.addColorStop(1, "#a07886");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX * .12, 0);
    ctx.fillStyle = "rgba(255, 246, 202, .88)";
    ctx.beginPath();
    ctx.arc(760, 103, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 245, 204, .12)";
    ctx.beginPath();
    ctx.arc(760, 103, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#202b55";
    ctx.beginPath();
    ctx.arc(775, 91, 33, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 50; i++) {
      const x = (i * 173 + 50) % (WORLD_WIDTH + 100);
      const y = 25 + (i * 67) % 205;
      const twinkle = .45 + Math.sin(elapsed * .002 + i) * .3;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = i % 4 === 0 ? "#ffe39b" : "#eef0ff";
      ctx.fillRect(x, y, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawHillLayer("#3d4c72", .22, 353, 47);
    drawHillLayer("#52617c", .39, 408, 61);
    drawCloud(200 - cameraX * .2, 135);
    drawCloud(625 - cameraX * .14, 197);
    drawCloud(920 - cameraX * .2, 118);
  }

  function drawHillLayer(color, speed, base, size) {
    ctx.save();
    ctx.translate(-cameraX * speed, 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-50, VIEW_HEIGHT);
    for (let x = -100; x < WORLD_WIDTH + VIEW_WIDTH; x += size) {
      const peak = base - 25 - ((Math.sin(x * .013) + 1) * 24);
      ctx.quadraticCurveTo(x + size * .5, peak, x + size, base + 34);
    }
    ctx.lineTo(WORLD_WIDTH + VIEW_WIDTH, VIEW_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCloud(x, y) {
    const wrappedX = ((x - cameraX + 1100) % 1200) - 100;
    ctx.fillStyle = "rgba(209, 215, 241, .13)";
    ctx.beginPath();
    ctx.ellipse(wrappedX, y, 42, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(wrappedX - 18, y - 5, 17, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(wrappedX + 4, y - 10, 20, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(wrappedX + 25, y - 4, 17, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround() {
    for (const platform of platforms) {
      const x = platform.x - cameraX;
      if (x + platform.w < -10 || x > VIEW_WIDTH + 10) continue;
      if (platform.y === GROUND_Y) {
        ctx.fillStyle = "#344653";
        ctx.fillRect(x, platform.y, platform.w, platform.h);
        ctx.fillStyle = "#83b481";
        ctx.fillRect(x, platform.y, platform.w, 9);
        ctx.fillStyle = "#a0cb8c";
        ctx.fillRect(x, platform.y, platform.w, 3);
        ctx.fillStyle = "rgba(14, 24, 38, .25)";
        for (let tile = 0; tile < platform.w; tile += 42) {
          ctx.fillRect(x + tile + 8, platform.y + 28 + (tile % 3) * 9, 17, 3);
          ctx.fillRect(x + tile + 22, platform.y + 57, 8, 3);
        }
      } else {
        ctx.fillStyle = "#334352";
        roundedRect(x, platform.y, platform.w, platform.h, 5);
        ctx.fillStyle = "#92c58b";
        roundedRect(x, platform.y, platform.w, 6, 4);
        ctx.fillStyle = "#bdd494";
        ctx.fillRect(x + 11, platform.y + 5, platform.w - 22, 2);
      }
    }
    for (let x = -((cameraX * .8) % 90); x < VIEW_WIDTH + 40; x += 90) {
      drawFlower(x + 18, GROUND_Y - 9, "#e9c5d5");
      drawFlower(x + 67, GROUND_Y - 8, "#f5d98b");
    }
  }

  function drawFlower(x, y, color) {
    ctx.fillStyle = "#75a777";
    ctx.fillRect(x, y, 2, 8);
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, y - 3, 3, 3);
    ctx.fillRect(x + 2, y - 3, 3, 3);
    ctx.fillRect(x, y - 5, 3, 3);
    ctx.fillStyle = "#f4d781";
    ctx.fillRect(x, y - 2, 3, 3);
  }

  function drawStars() {
    for (const star of stars) {
      if (star.collected) continue;
      const x = star.x - cameraX;
      if (x < -30 || x > VIEW_WIDTH + 30) continue;
      const bob = Math.sin(elapsed * .004 + star.phase) * 4;
      ctx.save();
      ctx.translate(x, star.y + bob);
      ctx.rotate(Math.sin(elapsed * .002 + star.phase) * .15);
      ctx.shadowColor = "#ffe384";
      ctx.shadowBlur = 17;
      ctx.fillStyle = "#ffdc79";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 12 : 5;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemy(enemy) {
    if (!enemy.alive) return;
    const x = enemy.x - cameraX;
    if (x < -50 || x > VIEW_WIDTH + 50) return;
    const bounce = Math.sin(elapsed * .009 + enemy.phase) * 2;
    ctx.save();
    ctx.translate(x, enemy.y + bounce);
    ctx.fillStyle = "rgba(14, 19, 38, .2)";
    ctx.beginPath();
    ctx.ellipse(17, 27, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8176ae";
    ctx.beginPath();
    ctx.moveTo(2, 23);
    ctx.quadraticCurveTo(-3, 7, 8, 4);
    ctx.quadraticCurveTo(16, -1, 24, 5);
    ctx.quadraticCurveTo(37, 10, 32, 24);
    ctx.quadraticCurveTo(18, 31, 2, 23);
    ctx.fill();
    ctx.fillStyle = "#aaa0d1";
    ctx.fillRect(8, 5, 5, 3);
    ctx.fillRect(22, 5, 5, 3);
    ctx.fillStyle = "#fff1bd";
    ctx.fillRect(9, 12, 4, 6);
    ctx.fillRect(22, 12, 4, 6);
    ctx.fillStyle = "#353355";
    ctx.fillRect(11, 14, 2, 3);
    ctx.fillRect(23, 14, 2, 3);
    ctx.fillStyle = "#ed9eaa";
    ctx.fillRect(15, 20, 5, 2);
    ctx.restore();
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(player.invulnerable / 6) % 2 === 0) return;
    const x = player.x - cameraX;
    const y = player.y;
    const running = Math.abs(player.vx) > .2 && player.grounded;
    const step = running ? Math.sin(elapsed * .02) * 3 : 0;
    ctx.save();
    ctx.translate(x, y);
    if (player.facing < 0) {
      ctx.translate(player.w, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = "rgba(14, 19, 38, .22)";
    ctx.beginPath();
    ctx.ellipse(15, 43, 15, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (player.attack > 5) {
      ctx.strokeStyle = "rgba(255, 235, 154, .85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(29, 22, 25, -1.05, .9);
      ctx.stroke();
      ctx.fillStyle = "#fff0a1";
      ctx.beginPath();
      ctx.arc(49, 17, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#3e456c";
    ctx.fillRect(8, 31, 7, 10 + step);
    ctx.fillRect(19, 31, 7, 10 - step);
    ctx.fillStyle = "#f0bb9d";
    ctx.fillRect(7, 38 + step, 9, 4);
    ctx.fillRect(19, 38 - step, 9, 4);
    ctx.fillStyle = "#e9958f";
    ctx.beginPath();
    ctx.moveTo(6, 19);
    ctx.lineTo(27, 18);
    ctx.lineTo(29, 35);
    ctx.lineTo(8, 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f1b99c";
    ctx.fillRect(8, 9, 17, 16);
    ctx.fillStyle = "#463c5b";
    ctx.fillRect(6, 7, 19, 7);
    ctx.fillRect(9, 4, 13, 5);
    ctx.fillStyle = "#fff1cf";
    ctx.fillRect(20, 1, 8, 4);
    ctx.fillStyle = "#534969";
    ctx.fillRect(17, 14, 3, 4);
    ctx.fillStyle = "#d68182";
    ctx.fillRect(20, 21, 4, 2);
    ctx.fillStyle = "#f8d68e";
    ctx.fillRect(4, 23, 5, 4);
    ctx.restore();
  }

  function drawGoal() {
    const x = 3525 - cameraX;
    if (x < -80 || x > VIEW_WIDTH + 80) return;
    ctx.fillStyle = "rgba(255, 230, 150, .14)";
    ctx.beginPath();
    ctx.ellipse(x + 30, GROUND_Y - 47, 42, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5f5279";
    ctx.fillRect(x, GROUND_Y - 89, 11, 89);
    ctx.fillRect(x + 52, GROUND_Y - 89, 11, 89);
    ctx.fillRect(x - 5, GROUND_Y - 96, 73, 12);
    ctx.fillStyle = "#f4ce79";
    ctx.fillRect(x + 11, GROUND_Y - 81, 41, 5);
    ctx.fillStyle = "#fff0ad";
    ctx.beginPath();
    ctx.arc(x + 31, GROUND_Y - 48, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a2799b";
    ctx.fillRect(x + 17, GROUND_Y - 19, 29, 19);
  }

  function draw() {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawBackground();
    drawGround();
    drawGoal();
    drawStars();
    enemies.forEach(drawEnemy);
    drawPlayer();
    const progress = Math.min(player.x / (WORLD_WIDTH - 100), 1);
    ctx.fillStyle = "rgba(12, 18, 37, .25)";
    ctx.fillRect(0, VIEW_HEIGHT - 4, VIEW_WIDTH, 4);
    ctx.fillStyle = "rgba(255, 222, 125, .8)";
    ctx.fillRect(0, VIEW_HEIGHT - 3, VIEW_WIDTH * progress, 3);
  }

  function loop(time) {
    const dt = lastTime ? time - lastTime : 16.67;
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", event => {
    const key = event.code === "Space" ? "Space" : (event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(key)) event.preventDefault();
    keys.add(key);
    if ((key === "Enter" || key === "Space") && state !== "playing") resetGame();
  });
  window.addEventListener("keyup", event => {
    const key = event.code === "Space" ? "Space" : (event.key.length === 1 ? event.key.toLowerCase() : event.key);
    keys.delete(key);
  });
  window.addEventListener("blur", () => keys.clear());
  startButton.addEventListener("click", resetGame);
  restartButton.addEventListener("click", () => {
    resetGame();
    screen.classList.remove("is-hidden");
    showScreen("ready");
  });
  document.querySelectorAll("[data-control]").forEach(button => {
    const control = button.dataset.control;
    const release = event => {
      event.preventDefault();
      touchState.delete(control);
      button.classList.remove("is-pressed");
    };
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touchState.add(control);
      button.classList.add("is-pressed");
      if (state !== "playing") resetGame();
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  updateHud();
  requestAnimationFrame(loop);
})();
