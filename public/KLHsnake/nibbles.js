/* NIBBLES — Updated JS Implementation
   Grid: 40 x 30 on 640x480 canvas (cell = 16px)
   Features: 10 levels, lives, scoring, speed ramp, pause, beep, fullscreen, mobile swipe
*/

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 480;

  // HUD elements
  const elScore = document.getElementById("score");
  const elHi = document.getElementById("hiScore");
  const elLevel = document.getElementById("level");
  const elLevelCount = document.getElementById("levelCount");
  const elLives = document.getElementById("lives");
  const elStatus = document.getElementById("statusText");
  const overlay = document.getElementById("overlay");
  const btnOverlayStart = document.getElementById("btnOverlayStart");
  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnReset = document.getElementById("btnReset");
  const soundToggle = document.getElementById("soundToggle");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const crt = document.querySelector(".crt");

  // Mobile panel
  const panelToggle = document.getElementById('panelToggle');
  const panel = document.querySelector('.panel');
  if(panelToggle && panel){
    panelToggle.addEventListener('click', () => {
      panel.classList.toggle('open');
      panelToggle.textContent = panel.classList.contains('open') ? 'Hide Controls' : 'Show Controls';
    });
  }

  // Optional on-screen buttons
  const mobileButtons = {
    up: document.getElementById("btnUp"),
    down: document.getElementById("btnDown"),
    left: document.getElementById("btnLeft"),
    right: document.getElementById("btnRight"),
    pause: document.getElementById("btnPauseMobile")
  };

  // Grid
  const CELL = 16;
  const COLS = canvas.width / CELL;
  const ROWS = canvas.height / CELL;

  // Game state
  const state = {
    levelIndex: 0,
    lives: 3,
    score: 0,
    hiScore: Number(localStorage.getItem("nibbles_hiscore") || 0),
    running: false,
    paused: false,
    tickMs: 150,
    baseTick: 150,
    targetPellets: 9,
    pelletsEaten: 0,
    allowTurnThisTick: true,
    lastTick: 0,
    flash: false
  };

  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let particles = [];

  let walls = new Set();
  let forbidden = new Set();
  let Levels = defineLevels();
  elLevelCount.textContent = Levels.length.toString();

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  /* ---------- Fullscreen ---------- */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      crt.requestFullscreen().catch(err => console.warn("Fullscreen failed:", err));
    } else {
      document.exitFullscreen();
    }
  }

  /* ---------- Level definitions ---------- */
  function defineLevels() {
    const lvls = [];
    const S = (x, y) => `${x},${y}`;
    const border = () => {
      const w = new Set();
      for (let x = 0; x < COLS; x++) { w.add(S(x, 0)); w.add(S(x, ROWS - 1)); }
      for (let y = 0; y < ROWS; y++) { w.add(S(0, y)); w.add(S(COLS - 1, y)); }
      return w;
    };

    lvls.push({
      name: "Boot Sector", speed: 150, quota: 8,
      build() { return { walls: border(), forbidden: new Set() }; }
    });
    lvls.push({
      name: "Core Memory", speed: 140, quota: 9,
      build() {
        const w = border(); const f = new Set();
        for (let x = 10; x < COLS - 10; x++) { w.add(S(x, 8)); w.add(S(x, ROWS - 9)); }
        for (let y = 8; y < ROWS - 8; y++) { w.add(S(10, y)); w.add(S(COLS - 11, y)); }
        for (let x = 11; x < COLS - 11; x++) {
          for (let y = 9; y < ROWS - 9; y++) f.add(S(x, y));
        }
        return { walls: w, forbidden: f };
      }
    });
    lvls.push({
      name: "Interrupt", speed: 130, quota: 10,
      build() {
        const w = border();
        const midX = COLS >> 1, midY = ROWS >> 1;
        for (let x = 6; x < COLS - 6; x++) w.add(S(x, midY));
        for (let y = 4; y < ROWS - 4; y++) w.add(S(midX, y));
        return { walls: w, forbidden: new Set() };
      }
    });
    lvls.push({
      name: "Twin Pipes", speed: 120, quota: 11,
      build() {
        const w = border();
        for (let y = 4; y < ROWS - 4; y++) { w.add(S(12, y)); w.add(S(COLS - 13, y)); }
        return { walls: w, forbidden: new Set() };
      }
    });
    lvls.push({
      name: "Zig RAM", speed: 110, quota: 12,
      build() {
        const w = border();
        for (let y = 4; y < ROWS - 4; y += 4) {
          for (let x = 6; x < COLS - 6; x += 2) {
            if (((x + y) / 2) % 2 === 0) w.add(S(x, y));
          }
        }
        return { walls: w, forbidden: new Set() };
      }
    });
    lvls.push({
      name: "Quadrants", speed: 100, quota: 13,
      build() {
        const w = border();
        const boxes = [
          [4,4, 14,10], [COLS-15,4, COLS-5,10],
          [4,ROWS-11, 14,ROWS-5], [COLS-15,ROWS-11, COLS-5,ROWS-5]
        ];
        for (const [x1,y1,x2,y2] of boxes) {
          for (let x=x1; x<=x2; x++) { w.add(S(x,y1)); w.add(S(x,y2)); }
          for (let y=y1; y<=y2; y++) { w.add(S(x1,y)); w.add(S(x2,y)); }
        }
        return { walls: w, forbidden: new Set() };
      }
    });
    lvls.push({
      name: "Bus Lines", speed: 90, quota: 14,
      build() {
        const w = border();
        for (let x = 5; x < COLS - 5; x += 4) {
          for (let y = 6; y < ROWS - 6; y++) w.add(S(x, y));
        }
        return { walls: w, forbidden: new Set() };
      }
    });
    lvls.push({
      name: "IRQ Storm", speed: 80, quota: 15,
      build() {
        const w = border();
        for (let x=6; x<COLS-6; x++){ w.add(S(x,6)); w.add(S(x,ROWS-7)); }
        for (let y=6; y<ROWS-6; y++){ w.add(S(6,y)); w.add(S(COLS-7,y)); }
        const midX = COLS >> 1, midY = ROWS >> 1;
        for (let x=8; x<COLS-8; x++) w.add(S(x, midY));
        for (let y=8; y<ROWS-8; y++) w.add(S(midX, y));
        return { walls: w, forbidden: new Set() };
      }
    });
    lvls.push({
      name: "Data Teeth", speed: 70, quota: 16,
      build() {
        const w = border();
        for (let x=2; x<COLS-2; x++){ if (x%2===0){ w.add(S(x, 3)); w.add(S(x, ROWS-4)); } }
        for (let y=2; y<ROWS-2; y++){ if (y%2===0){ w.add(S(3, y)); w.add(S(COLS-4, y)); } }
        return { walls: w, forbidden: new Set() };
      }
    });
    lvls.push({
      name: "Stack Overflow", speed: 60, quota: 18,
      build() {
        const w = border();
        for (let y=4; y<ROWS-4; y+=2){
          for (let x=4; x<COLS-4; x++){ if ((x+y)%4===0) w.add(S(x,y)); }
        }
        return { walls: w, forbidden: new Set() };
      }
    });
     return lvls;
  }

  /* ---------- Utilities ---------- */
  const key = (x,y) => `${x},${y}`;
  const fromKey = k => k.split(",").map(Number);

  function randCell(excludeSet){
    const freeCells = [];
    for (let x=0; x<COLS; x++){
      for (let y=0; y<ROWS; y++){
        const k = key(x,y);
        if(!excludeSet.has(k)) freeCells.push({x,y});
      }
    }
    return freeCells[Math.floor(Math.random()*freeCells.length)];
  }

  function setStatus(text, warn=false){
    elStatus.textContent = text;
    elStatus.style.color = warn ? "#ff0066" : "lime";
  }

  function beep(freq=880, dur=60, vol=0.05){
    if (!soundToggle.checked) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    setTimeout(()=>{ o.stop(); }, dur);
  }

  /* ---------- Rendering ---------- */
  function drawCell(x,y, color="#00ff00"){
    ctx.fillStyle = color;
    ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
  }
  function drawWall(x,y){
    ctx.fillStyle = "#00aa55";
    ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
    ctx.fillStyle = "#003f1f";
    ctx.fillRect(x*CELL+4, y*CELL+4, CELL-8, CELL-8);
  }
  function drawFood(x,y){
    ctx.fillStyle = "#00ffaa";
    ctx.fillRect(x*CELL+3, y*CELL+3, CELL-6, CELL-6);
  }

  function drawParticles(){
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
      p.x += p.vx; p.y += p.vy;
      p.life--;
    });
    particles = particles.filter(p => p.life > 0);
  }

  function drawHUD(){
    elScore.textContent = state.score.toString().padStart(4,"0");
    elHi.textContent = state.hiScore.toString().padStart(4,"0");
    elLevel.textContent = (state.levelIndex+1).toString();
    elLives.textContent = "❤".repeat(state.lives);
  }

  function render(){
    ctx.fillStyle = state.flash ? "#600" : "rgba(0,40,0,0.35)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    walls.forEach(k=>{ const [x,y]=fromKey(k); drawWall(x,y); });
    drawFood(food.x, food.y);

    snake.forEach((s,i)=>{
      if(i===0){
        const grad = ctx.createLinearGradient(s.x*CELL, s.y*CELL, (s.x+1)*CELL, (s.y+1)*CELL);
        grad.addColorStop(0,"#0f0");
        grad.addColorStop(1,"#0c0");
        drawCell(s.x,s.y,grad);
      } else drawCell(s.x,s.y,"#0c4");
    });

    drawParticles();

    ctx.fillStyle = "#0f0";
    ctx.font = "14px monospace";
    ctx.fillText(`SCORE ${state.score.toString().padStart(4,"0")}  HI ${state.hiScore.toString().padStart(4,"0")}  LV ${(state.levelIndex+1).toString().padStart(2,"0")}  LIVES ${"■".repeat(state.lives)}`, 8, 18);
    ctx.fillText(`TARGET ${state.pelletsEaten}/${state.targetPellets}`, 8, 36);
  }

  function flashScreen(){
    state.flash = true;
    setTimeout(()=>state.flash=false, 100);
  }

  function spawnParticles(x, y){
    for(let i=0;i<10;i++){
      particles.push({
        x:x*CELL + CELL/2, y:y*CELL + CELL/2,
        vx:(Math.random()-0.5)*2, vy:(Math.random()-0.5)*2,
        color:"#0ff", life:20
      });
    }
  }

  /* ---------- Level Init ---------- */
  function initLevel(firstOfRun=false){
    const built = Levels[state.levelIndex].build();
    walls = built.walls;
    forbidden = built.forbidden || new Set();

    state.baseTick = Levels[state.levelIndex].speed;
    state.tickMs = state.baseTick;
    state.targetPellets = Levels[state.levelIndex].quota;
    state.pelletsEaten = 0;

    const start = { x: 4, y: Math.floor(ROWS/2) };
    snake = [ start, {x:start.x-1, y:start.y}, {x:start.x-2, y:start.y} ];
    dir = {x:1,y:0};
    nextDir = {x:1,y:0};

    placeFood();
    clearCanvas();
    countdown(firstOfRun ? "READY" : `LEVEL ${state.levelIndex+1}`);
  }

  function countdown(msg){
    let counter = 3;
    const interval = setInterval(()=>{
      clearCanvas();
      render();
      ctx.fillStyle="#0f0";
      ctx.font="30px monospace";
      ctx.fillText(counter>0 ? counter : "GO!", canvas.width/2-20, canvas.height/2);
      counter--;
      if(counter<0){ clearInterval(interval); if(!state.running) startGame(); }
    }, 600);
  }

  function placeFood(){
    const exclude = new Set(walls);
    forbidden.forEach(k => exclude.add(k));
    snake.forEach(s => exclude.add(key(s.x,s.y)));
    food = randCell(exclude);
  }

  function clearCanvas(){ ctx.fillStyle = "#000"; ctx.fillRect(0,0,canvas.width,canvas.height); }

  /* ---------- Game Loop ---------- */
  function gameLoop(timestamp){
    if(!state.running || state.paused){
      requestAnimationFrame(gameLoop);
      return;
    }
    if(!state.lastTick || timestamp - state.lastTick >= state.tickMs){
      tick();
      state.lastTick = timestamp;
    }
    requestAnimationFrame(gameLoop);
  }

  function tick(){
    state.allowTurnThisTick = true;
    dir = nextDir;
    const head = { ...snake[0] };
    head.x += dir.x; head.y += dir.y;

    const out = head.x<0 || head.y<0 || head.x>=COLS || head.y>=ROWS;
    const intoWall = walls.has(key(head.x, head.y));
    const intoSelf = snake.some(seg => seg.x===head.x && seg.y===head.y);

    if (out || intoWall || intoSelf){
      beep(220, 120, 0.06);
      state.lives--;
      flashScreen();
      drawHUD();
      setStatus("CRASH! — Life lost", true);
      if (state.lives <= 0){ gameOver(); return; }
      initLevel(false);
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y){
      beep(1046, 50, 0.045);
      state.score += 10; state.pelletsEaten++;
      spawnParticles(head.x, head.y);
      state.tickMs = Math.max(50, state.baseTick - state.pelletsEaten*3); // dynamic speed ramp
      if (state.score > state.hiScore){
        state.hiScore = state.score;
        localStorage.setItem("nibbles_hiscore", String(state.hiScore));
      }
      placeFood(); drawHUD();
      if (state.pelletsEaten >= state.targetPellets){ levelComplete(); return; }
    } else {
      snake.pop();
    }

    clearCanvas(); render();
  }

  function levelComplete(){
    beep(880, 80, 0.06); setTimeout(()=>beep(1175,80,0.06),90); setTimeout(()=>beep(1568,120,0.06),180);
    setStatus("LEVEL CLEAR!");
    state.levelIndex = (state.levelIndex+1) % Levels.length;
    initLevel(false);
  }

  function gameOver(){
    state.running=false;
    setStatus("GAME OVER", true);
    overlay.classList.remove("hidden");
  }

  /* ---------- Controls ---------- */
  document.addEventListener("keydown", e=>{
    const k=e.key;
    if ((k==="ArrowUp"||k==="w") && state.allowTurnThisTick && dir.y!==1){ nextDir={x:0,y:-1}; state.allowTurnThisTick=false; e.preventDefault();}
    else if ((k==="ArrowDown"||k==="s") && state.allowTurnThisTick && dir.y!==-1){ nextDir={x:0,y:1}; state.allowTurnThisTick=false; e.preventDefault();}
    else if ((k==="ArrowLeft"||k==="a") && state.allowTurnThisTick && dir.x!==1){ nextDir={x:-1,y:0}; state.allowTurnThisTick=false; e.preventDefault();}
    else if ((k==="ArrowRight"||k==="d") && state.allowTurnThisTick && dir.x!==-1){ nextDir={x:1,y:0}; state.allowTurnThisTick=false; e.preventDefault();}
    else if (k==="p"||k==="P"){ togglePause(); }
    else if (k==="r"||k==="R"){ fullReset(); }
    else if (k==="f"||k==="F"){ toggleFullscreen(); }
    else if (k==="Enter"||k===" "){ if (!state.running) startGame(); else if (state.paused) togglePause(); }
  });

  // Mobile swipe
  let touchStartX=0, touchStartY=0;
  canvas.addEventListener("touchstart", e => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  });
  canvas.addEventListener("touchend", e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if(Math.abs(dx) > Math.abs(dy)){
      if(dx>0 && dir.x!==-1) nextDir={x:1,y:0};
      else if(dx<0 && dir.x!==1) nextDir={x:-1,y:0};
    } else {
      if(dy>0 && dir.y!==-1) nextDir={x:0,y:1};
      else if(dy<0 && dir.y!==1) nextDir={x:0,y:-1};
    }
    state.allowTurnThisTick=false;
  });

  // On-screen buttons
  Object.entries(mobileButtons).forEach(([name, btn])=>{
    if(btn) btn.addEventListener('click', ()=>{
      if(name==='up' && dir.y!==1) nextDir={x:0,y:-1};
      else if(name==='down' && dir.y!==-1) nextDir={x:0,y:1};
      else if(name==='left' && dir.x!==1) nextDir={x:-1,y:0};
      else if(name==='right' && dir.x!==-1) nextDir={x:1,y:0};
      else if(name==='pause') togglePause();
      state.allowTurnThisTick=false;
    });
  });

  btnOverlayStart.onclick = startGame;
  btnStart.onclick = startGame;
  btnPause.onclick = togglePause;
  btnReset.onclick = fullReset;
  if (btnFullscreen) btnFullscreen.onclick = toggleFullscreen;

  function startGame(){
    overlay.classList.add("hidden");
    if (!state.running){ state.running=true; state.paused=false; setStatus("RUNNING"); requestAnimationFrame(gameLoop); }
  }
  function togglePause(){
    if (!state.running) return;
    state.paused=!state.paused;
    setStatus(state.paused ? "PAUSED" : "RUNNING");
  }
  function fullReset(){
    state.levelIndex=0; state.lives=3; state.score=0; state.paused=false; state.running=false;
    drawHUD(); initLevel(true); overlay.classList.remove("hidden");
  }

  /* ---------- Boot ---------- */
  drawHUD(); initLevel(true);
})();