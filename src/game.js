(() => {
  const canvas = document.getElementById('game');
  const ctx    = canvas.getContext('2d');
  const ui     = document.getElementById('ui');
  const uiBox  = document.getElementById('ui-content');

  let W = 0, H = 0;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // === константы ===
  const PLAYER_START_R = 20;
  const PLAYER_MAX_R   = 160;
  const ENEMY_COUNT    = 25;
  const SAFE_SPAWN_D   = 220;
  const TRAIL_LEN      = 18;

  // === состояние ===
  const state = {
    player: { x: 0, y: 0, r: PLAYER_START_R },
    target: { x: 0, y: 0 },
    enemies: [],
    trail: [],   // [{x, y, r}]
    score: 0,
    pulse: 0,    // фаза пульсации игрока
    glitch: 0,   // счётчик глитча (в кадрах)
    status: 'menu'   // menu | playing | paused | dead | win
  };

  // === UI ===
  function showMenu() {
    state.status = 'menu';
    if (window.YaSDK) YaSDK.gameplayStop();
    uiBox.innerHTML =
      '<h1>ПОЖИРАТЕЛЬ</h1>' +
      '<p class="sub">расти. ешь. не дай себя съесть.</p>' +
      '<button id="btn-play">играть</button>' +
      '<p class="hint">веди палец или мышь</p>';
    ui.classList.add('show');
    document.getElementById('btn-play').onclick = startGame;
  }

  function showDead() {
    state.status = 'dead';
    if (window.YaSDK) YaSDK.gameplayStop();
    triggerGlitch();
    uiBox.innerHTML =
      '<h1 style="color:#ff6b6b;text-shadow:0 0 8px rgba(255,107,107,0.5)">ТЕБЯ СЪЕЛИ</h1>' +
      '<p class="score">' + state.score + '</p>' +
      '<button id="btn-again">ещё раз</button>';
    ui.classList.add('show');
    document.getElementById('btn-again').onclick = startGame;
  }

  function showWin() {
    state.status = 'win';
    if (window.YaSDK) YaSDK.gameplayStop();
    uiBox.innerHTML =
      '<h1>ТЫ ВЫРОС</h1>' +
      '<p class="score">' + state.score + '</p>' +
      '<button id="btn-again">ещё раз</button>';
    ui.classList.add('show');
    document.getElementById('btn-again').onclick = startGame;
  }

  function hideUi() {
    ui.classList.remove('show');
  }

  // === игра ===
  function startGame() {
    hideUi();
    state.player.x = W / 2;
    state.player.y = H / 2;
    state.player.r = PLAYER_START_R;
    state.target.x = W / 2;
    state.target.y = H / 2;
    state.enemies = [];
    state.trail = [];
    state.score = 0;
    state.pulse = 0;
    state.glitch = 0;
    state.status = 'playing';
    for (let i = 0; i < ENEMY_COUNT; i++) spawnEnemy();
    if (window.YaSDK) YaSDK.gameplayStart();
  }

  function spawnEnemy() {
    const pr = state.player.r;
    let r;
    const roll = Math.random();
    if (roll < 0.55) r = 6 + Math.random() * pr * 0.7;
    else             r = pr * 0.9 + Math.random() * pr * 1.6;
    r = Math.max(6, Math.min(r, 140));

    let x, y, tries = 0;
    do {
      x = r + Math.random() * (W - r * 2);
      y = r + Math.random() * (H - r * 2);
      tries++;
    } while (
      Math.hypot(x - state.player.x, y - state.player.y) < SAFE_SPAWN_D &&
      tries < 20
    );

    const speed = 0.2 + Math.random() * 0.6;
    const ang   = Math.random() * Math.PI * 2;

    state.enemies.push({
      x, y, r,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      hue: r < pr ? 'prey' : 'pred'
    });
  }

  function triggerGlitch() {
    state.glitch = 12; // кадров глитча
  }

  function update() {
    if (state.glitch > 0) state.glitch--;
    state.pulse += 0.08;

    if (state.status !== 'playing') return;

    const p = state.player;

    // след
    state.trail.push({ x: p.x, y: p.y, r: p.r });
    if (state.trail.length > TRAIL_LEN) state.trail.shift();

    const dx = state.target.x - p.x;
    const dy = state.target.y - p.y;
    const d  = Math.hypot(dx, dy);
    if (d > 1) {
      const speed = (3.5 * 25) / p.r;
      const step  = Math.min(speed, d);
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
    p.x = Math.max(p.r, Math.min(W - p.r, p.x));
    p.y = Math.max(p.r, Math.min(H - p.r, p.y));

    for (const e of state.enemies) {
      e.x += e.vx;
      e.y += e.vy;
      if (e.x < e.r || e.x > W - e.r) e.vx *= -1;
      if (e.y < e.r || e.y > H - e.r) e.vy *= -1;

      const dist = Math.hypot(e.x - p.x, e.y - p.y);

      if (dist < p.r + e.r * 0.6) {
        if (p.r > e.r * 1.1) {
          p.r = Math.sqrt(p.r * p.r + e.r * e.r * 0.4);
          state.score += Math.floor(e.r);
          e.dead = true;
          triggerGlitch();
        } else if (e.r > p.r * 1.1) {
          showDead();
          return;
        }
      }
    }

    state.enemies = state.enemies.filter(e => !e.dead);

    if (p.r >= PLAYER_MAX_R) {
      showWin();
      return;
    }

    while (state.enemies.length < ENEMY_COUNT) spawnEnemy();
  }

  function draw() {
    // фон: очень тёмный радиальный градиент
    const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#0a0f0a');
    bg.addColorStop(1, '#020202');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (state.status === 'menu') return;

    // след игрока
    for (let i = 0; i < state.trail.length; i++) {
      const t = state.trail[i];
      const k = i / state.trail.length;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (0.6 + k * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(179,255,179,' + (k * 0.08) + ')';
      ctx.fill();
    }

    // враги
    for (const e of state.enemies) {
      const isPrey = e.hue === 'prey';
      const color = isPrey ? '42,74,42' : '90,31,31';
      const glow  = isPrey ? '80,180,80' : '255,80,80';

      // тело
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(' + color + ')';
      ctx.fill();

      // лёгкое свечение
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + glow + ',0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // игрок
    const p = state.player;
    const pulseR = p.r + Math.sin(state.pulse) * 2;

    // свечение
    ctx.save();
    ctx.shadowBlur = 24 + Math.sin(state.pulse) * 8;
    ctx.shadowColor = 'rgba(179,255,179,0.7)';

    ctx.beginPath();
    ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = '#b3ffb3';
    ctx.fill();
    ctx.restore();

    // ядро
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;

    // === HUD ===
    ctx.fillStyle = 'rgba(216,216,216,0.85)';
    ctx.font = '14px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', 20, 30);
    ctx.fillText('SIZE',  20, 56);

    ctx.fillStyle = '#b3ffb3';
    ctx.font = '20px "IBM Plex Mono", monospace';
    ctx.fillText(String(state.score), 100, 32);
    ctx.fillText(String(Math.floor(p.r)), 100, 58);

    // прогресс-бар
    const prog = Math.min(1, (p.r - PLAYER_START_R) / (PLAYER_MAX_R - PLAYER_START_R));
    const bw = Math.min(240, W - 140);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(20, 74, bw, 4);
    ctx.fillStyle = '#b3ffb3';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(179,255,179,0.6)';
    ctx.fillRect(20, 74, bw * prog, 4);
    ctx.shadowBlur = 0;

    // глитч: горизонтальный сдвиг
    if (state.glitch > 0) {
      const offset = (Math.random() - 0.5) * 6;
      ctx.drawImage(canvas, offset, 0);
      ctx.fillStyle = 'rgba(179,255,179,' + (state.glitch / 60) + ')';
      ctx.fillRect(0, Math.random() * H, W, 2);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // === ввод ===
  let pointerDown = false;

  function setTarget(x, y) {
    if (state.status !== 'playing') return;
    state.target.x = x;
    state.target.y = y;
  }

  canvas.addEventListener('mousemove', e => {
    if (!pointerDown) return;
    setTarget(e.clientX, e.clientY);
  });
  canvas.addEventListener('mousedown', e => {
    pointerDown = true;
    setTarget(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => { pointerDown = false; });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    setTarget(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    setTarget(t.clientX, t.clientY);
  }, { passive: false });

  // === события платформы ===
  window.onGamePause = () => {
    if (state.status === 'playing') {
      state.status = 'paused';
      if (window.YaSDK) YaSDK.gameplayStop();
    }
  };

  window.onGameResume = () => {
    if (state.status === 'paused') {
      state.status = 'playing';
      if (window.YaSDK) YaSDK.gameplayStart();
    }
  };

  // === старт ===
  (async () => {
    if (window.YaSDK) await YaSDK.init();
    showMenu();
    loop();
  })();
})();
