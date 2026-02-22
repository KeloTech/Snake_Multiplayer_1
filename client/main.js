// Configuration
const BASE_TILE_SIZE = 24; // Starting zoom (bigger = more zoomed in)
const MIN_TILE_SIZE = 18;  // Max zoom out (higher = stays more zoomed in)
const ZOOM_OUT_PER_SEGMENT = 0.12; // How much to zoom out per snake segment (smaller = zoom stays in longer)
const GRID_TILE_A = '#c5d0e8';   // pastel blue
const GRID_TILE_B = '#b8c5e0';
const BORDER_WIDTH = 2;
const BORDER_COLOR = '#8b9dc3';
const COIN_COLOR = '#d4b843';    // richer gold so points stand out
const LOCAL_SNAKE_COLOR = '#2db896';   // saturated teal – visible on floor
const OTHER_SNAKE_COLOR = '#e07a6b';   // saturated coral – visible on floor
const SNAKE_OUTLINE_COLOR = '#1e3d4a'; // dark outline so snake pops

// Dynamic tile size
let currentTileSize = BASE_TILE_SIZE;
let targetTileSize = BASE_TILE_SIZE;

// State
let socket = null;
let localPlayerId = null;
let gameState = {
  players: [],
  coins: [],
  foodOrbs: [],
  weapons: [],
  projectiles: [],
  mapWidth: 120,
  mapHeight: 120
};
let canvas, ctx;
let cameraOffset = { x: 0, y: 0 };

// Preloaded images (coins use same asset as logo)
let coinImage = null;
const COIN_IMAGE_PATH = 'assets/Krypto_snake_image.png';
(function preloadCoinImage() {
  const img = new Image();
  img.onload = () => { coinImage = img; };
  img.onerror = () => { console.warn('Coin image failed to load:', COIN_IMAGE_PATH); };
  img.src = COIN_IMAGE_PATH;
})();

// Input buffer
let currentDirection = 'RIGHT';
let inputQueue = [];

// DOM Elements
const startScreen = document.getElementById('startScreen');
const playBtn = document.getElementById('playBtn');
const menu = document.getElementById('menu');
const joinBtn = document.getElementById('joinBtn');
const nicknameInput = document.getElementById('nickname');
const serverUrlInput = document.getElementById('serverUrl');
const statusDiv = document.getElementById('status');
const scoreboard = document.getElementById('scoreboard');
const scoreList = document.getElementById('scoreList');
const gameCanvas = document.getElementById('gameCanvas');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const deathScreen = document.getElementById('deathScreen');
const deathScore = document.getElementById('deathScore');
const deathLength = document.getElementById('deathLength');
const respawnBtn = document.getElementById('respawnBtn');
const quitBtn = document.getElementById('quitBtn');
const infoBtn = document.getElementById('infoBtn');
const rulesModal = document.getElementById('rulesModal');
const rulesBackdrop = document.getElementById('rulesBackdrop');
const rulesCloseBtn = document.getElementById('rulesCloseBtn');
const serverConfig = document.getElementById('serverConfig');
const serverConfigToggle = document.getElementById('serverConfigToggle');
const gameMusic = document.getElementById('gameMusic');
const soundToggle = document.getElementById('soundToggle');

let musicMuted = false;

// Initialize canvas
function initCanvas() {
  canvas = gameCanvas;
  ctx = canvas.getContext('2d');
  
  // Set canvas to window size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Connect to server
function connect() {
  const serverUrl = serverUrlInput.value.trim() || 'https://snake-multiplayer-1.onrender.com/';

  
  statusDiv.textContent = 'Connecting...';
  statusDiv.className = 'status';
  joinBtn.disabled = true;
  
  socket = io(serverUrl, {
    transports: ['websocket'],
    reconnection: false
  });
  
  socket.on('connect', () => {
    console.log('Connected to server');
    
    // Send join request
    const nickname = nicknameInput.value.trim() || 'Player';
    socket.emit('join', { name: nickname });
  });
  
  socket.on('joined', (data) => {
    console.log('Joined game:', data);
    console.log(`🎮 Joined room: ${data.roomId}`);
    localPlayerId = data.id;
    gameState.mapWidth = data.mapWidth;
    gameState.mapHeight = data.mapHeight;
    
    // Hide menu, show game
    menu.classList.add('hidden');
    scoreboard.classList.remove('hidden');
    backToMenuBtn.classList.remove('hidden');
    
    if (!musicMuted && gameMusic) {
      gameMusic.volume = 0.5;
      gameMusic.play().catch(() => {});
    }
    
    // Start input handling
    setupInput();
    
    // Focus canvas so arrow keys work immediately (and after clicking back to tab)
    canvas.focus();
    
    // Start render loop
    requestAnimationFrame(render);
  });
  
  socket.on('snapshot', (snapshot) => {
    gameState.players = snapshot.players;
    gameState.coins = snapshot.coins;
    gameState.foodOrbs = snapshot.foodOrbs || [];
    gameState.weapons = snapshot.weapons || [];
    gameState.projectiles = snapshot.projectiles || [];
  });
  
  socket.on('death', (data) => {
    console.log('Player died:', data);
    showDeathScreen(data.score, data.length);
  });
  
  socket.on('respawned', (data) => {
    console.log('Player respawned');
    hideDeathScreen();
    // Put focus back on canvas so arrow keys work (Respawn button had focus)
    canvas.focus();
  });
  
  socket.on('weaponHit', (data) => {
    console.log('Weapon hit:', data);
    // Visual feedback for hits
    showHitEffect(data.position, data.type);
  });
  
  socket.on('explosion', (data) => {
    console.log('Explosion:', data);
    // Visual feedback for explosion
    showExplosionEffect(data.x, data.y, data.radius);
  });
  
  socket.on('error', (data) => {
    statusDiv.textContent = data.message;
    statusDiv.className = 'status error';
    joinBtn.disabled = false;
  });
  
  socket.on('connect_error', (error) => {
    statusDiv.textContent = 'Connection failed. Check server URL.';
    statusDiv.className = 'status error';
    joinBtn.disabled = false;
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    returnToMenu('Disconnected from server');
  });
}

// Return to menu
function returnToMenu(message) {
  menu.classList.remove('hidden');
  scoreboard.classList.add('hidden');
  backToMenuBtn.classList.add('hidden');
  deathScreen.classList.add('hidden');
  if (gameMusic) {
    gameMusic.pause();
    gameMusic.currentTime = 0;
  }
  statusDiv.textContent = message || '';
  statusDiv.className = message ? 'status error' : 'status';
  joinBtn.disabled = false;
  
  if (socket) {
    socket.close();
    socket = null;
  }
}

// Show death screen
function showDeathScreen(score, length) {
  deathScore.textContent = score;
  deathLength.textContent = length;
  deathScreen.classList.remove('hidden');
}

// Hide death screen
function hideDeathScreen() {
  deathScreen.classList.add('hidden');
}

// Visual effects
let effects = [];

function showHitEffect(position, type) {
  effects.push({
    type: 'hit',
    x: position.x,
    y: position.y,
    time: Date.now(),
    duration: 500,
    weaponType: type
  });
}

function showExplosionEffect(x, y, radius) {
  effects.push({
    type: 'explosion',
    x: x,
    y: y,
    radius: radius,
    time: Date.now(),
    duration: 1000
  });
}

function drawEffects() {
  const now = Date.now();
  effects = effects.filter(effect => now - effect.time < effect.duration);
  
  for (const effect of effects) {
    const age = (now - effect.time) / effect.duration;
    const alpha = 1 - age;
    
    if (effect.type === 'hit') {
      const x = effect.x * currentTileSize;
      const y = effect.y * currentTileSize;
      
      ctx.strokeStyle = `rgba(245, 230, 163, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + currentTileSize / 2, y + currentTileSize / 2, currentTileSize * (1 + age), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'explosion') {
      const centerX = effect.x * currentTileSize + currentTileSize / 2;
      const centerY = effect.y * currentTileSize + currentTileSize / 2;
      const maxRadius = effect.radius * currentTileSize;
      const radius = maxRadius * age;
      
      ctx.fillStyle = `rgba(240, 168, 154, ${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = `rgba(240, 140, 130, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// Input handling
function setupInput() {
  const keyMap = {
    'ArrowUp': 'UP',
    'ArrowDown': 'DOWN',
    'ArrowLeft': 'LEFT',
    'ArrowRight': 'RIGHT',
    'KeyW': 'UP',
    'KeyS': 'DOWN',
    'KeyA': 'LEFT',
    'KeyD': 'RIGHT'
  };
  
  document.addEventListener('keydown', (e) => {
    const dir = keyMap[e.code];
    if (dir && dir !== currentDirection) {
      currentDirection = dir;
      
      // Send input to server
      if (socket && socket.connected) {
        socket.emit('input', {
          dir: dir,
          clientTime: Date.now()
        });
      }
    }
    
    // Weapon action (Space bar)
    if (e.code === 'Space') {
      e.preventDefault();
      const localPlayer = getLocalPlayer();
      if (localPlayer && localPlayer.weapon && socket && socket.connected) {
        socket.emit('weaponAction', {});
      }
    }
  });
  
  // When user clicks on canvas, give it focus so arrow keys work (e.g. after clicking back to tab)
  canvas.addEventListener('click', () => {
    canvas.focus();
  });

  // Mouse click for weapon action
  canvas.addEventListener('click', () => {
    const localPlayer = getLocalPlayer();
    if (localPlayer && localPlayer.weapon && socket && socket.connected) {
      socket.emit('weaponAction', {});
    }
  });
}

// Get local player
function getLocalPlayer() {
  return gameState.players.find(p => p.id === localPlayerId);
}

// Update camera to follow local player
function updateCamera() {
  const localPlayer = getLocalPlayer();
  if (!localPlayer || !localPlayer.snake || localPlayer.snake.length === 0) {
    return;
  }
  
  // Calculate dynamic zoom based on snake length
  const snakeLength = localPlayer.snake.length;
  targetTileSize = Math.max(
    MIN_TILE_SIZE,
    BASE_TILE_SIZE - (snakeLength * ZOOM_OUT_PER_SEGMENT)
  );
  
  // Smooth zoom transition
  const zoomSpeed = 0.1;
  currentTileSize += (targetTileSize - currentTileSize) * zoomSpeed;
  
  const head = localPlayer.snake[0];
  const targetX = head.x * currentTileSize - canvas.width / 2;
  const targetY = head.y * currentTileSize - canvas.height / 2;
  
  // Smooth camera (or instant)
  cameraOffset.x = targetX;
  cameraOffset.y = targetY;
  
  // Clamp camera to map bounds
  const maxX = gameState.mapWidth * currentTileSize - canvas.width;
  const maxY = gameState.mapHeight * currentTileSize - canvas.height;
  
  cameraOffset.x = Math.max(0, Math.min(cameraOffset.x, maxX));
  cameraOffset.y = Math.max(0, Math.min(cameraOffset.y, maxY));
}

// Render game
function render() {
  if (!socket || !socket.connected) {
    return;
  }
  
  // Don't render if death screen is showing
  const localPlayer = getLocalPlayer();
  const isDead = !localPlayer || !localPlayer.snake || localPlayer.snake.length === 0;
  
  if (!isDead) {
    // Clear canvas (pastel)
    ctx.fillStyle = '#c5d0e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update camera
    updateCamera();
    
    // Save context
    ctx.save();
    ctx.translate(-cameraOffset.x, -cameraOffset.y);
    
    // Draw grid
    drawGrid();
    
    // Draw coins
    drawCoins();
    
    // Draw food orbs
    drawFoodOrbs();
    
    // Draw weapon pickups
    drawWeaponPickups();
    
    // Draw projectiles
    drawProjectiles();
    
    // Draw snakes
    drawSnakes();
    
    // Draw effects (explosions, hits)
    drawEffects();
    
    // Restore context
    ctx.restore();
    
    // Draw UI
    drawScoreboard();
    drawWeaponUI();
  }
  
  // Continue render loop
  requestAnimationFrame(render);
}

// Draw grid: 2-tile border, then playable area with 3x3 same-color blocks (reduces flicker when moving)
function drawGrid() {
  const startX = Math.floor(cameraOffset.x / currentTileSize);
  const startY = Math.floor(cameraOffset.y / currentTileSize);
  const endX = Math.ceil((cameraOffset.x + canvas.width) / currentTileSize);
  const endY = Math.ceil((cameraOffset.y + canvas.height) / currentTileSize);
  const ts = currentTileSize;
  const mw = gameState.mapWidth;
  const mh = gameState.mapHeight;
  const BLOCK = 3; // 3x3 tile blocks share one color

  for (let gy = startY; gy <= endY; gy++) {
    for (let gx = startX; gx <= endX; gx++) {
      const inBorder = gx < BORDER_WIDTH || gx >= mw - BORDER_WIDTH ||
                       gy < BORDER_WIDTH || gy >= mh - BORDER_WIDTH;
      const bx = Math.floor(gx / BLOCK);
      const by = Math.floor(gy / BLOCK);
      ctx.fillStyle = inBorder ? BORDER_COLOR : ((bx + by) % 2 === 0 ? GRID_TILE_A : GRID_TILE_B);
      ctx.fillRect(gx * ts, gy * ts, ts, ts);
    }
  }
}

// Draw coins (using coin image asset)
function drawCoins() {
  const size = currentTileSize;
  const cx = size / 2;
  
  for (const coin of gameState.coins) {
    const x = coin.x * size;
    const y = coin.y * size;
    const centerX = x + cx;
    const centerY = y + cx;
    
    if (coinImage && coinImage.complete && coinImage.naturalWidth) {
      const coinScale = 1.4;
      const coinSize = size * coinScale;
      const offset = (coinSize - size) / 2;
      ctx.drawImage(coinImage, x - offset, y - offset, coinSize, coinSize);
    } else {
      const r = size / 3;
      ctx.fillStyle = COIN_COLOR;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(centerX - 2, centerY - 2, size / 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Draw food orbs (from cut snakes) – visible on floor
function drawFoodOrbs() {
  for (const orb of gameState.foodOrbs) {
    const x = orb.x * currentTileSize;
    const y = orb.y * currentTileSize;
    const cx = x + currentTileSize / 2;
    const cy = y + currentTileSize / 2;
    ctx.strokeStyle = 'rgba(50, 35, 40, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#e07a6b';
    ctx.beginPath();
    ctx.arc(cx, cy, currentTileSize / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Draw weapon pickups
function drawWeaponPickups() {
  const weaponColors = {
    SWORD: '#e0ddd8',
    GUN: '#a8c5e8',
    ROCKET: '#f0a89a'
  };
  
  const weaponIcons = {
    SWORD: '⚔️',
    GUN: '🔫',
    ROCKET: '🚀'
  };
  
  for (const weapon of gameState.weapons) {
    if (!weapon.position) continue; // weapon is held by player
    
    const x = weapon.position.x * currentTileSize;
    const y = weapon.position.y * currentTileSize;
    
    // Draw background
    ctx.fillStyle = weaponColors[weapon.type] || '#c4b5c8';
    ctx.fillRect(x + 2, y + 2, currentTileSize - 4, currentTileSize - 4);
    
    // Draw icon
    ctx.font = `${currentTileSize - 4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(weaponIcons[weapon.type] || '?', x + currentTileSize / 2, y + currentTileSize / 2);
  }
}

// Draw projectiles
function drawProjectiles() {
  for (const proj of gameState.projectiles) {
    const x = proj.x * currentTileSize;
    const y = proj.y * currentTileSize;
    
    if (proj.type === 'BULLET') {
      ctx.fillStyle = '#f5e6a3';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.type === 'ROCKET') {
      ctx.fillStyle = '#f0a89a';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(240, 168, 154, 0.4)';
      ctx.beginPath();
      ctx.arc(x - proj.vx * 2, y - proj.vy * 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Get head facing direction from segment positions (in pixel space, normalized)
function getHeadDirection(segs, ts) {
  const half = ts / 2;
  if (segs.length < 2) return { dx: 1, dy: 0 };
  const hx = segs[0].x * ts + half;
  const hy = segs[0].y * ts + half;
  const nx = segs[1].x * ts + half;
  const ny = segs[1].y * ts + half;
  let dx = hx - nx;
  let dy = hy - ny;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  return { dx, dy };
}

// Draw snakes: detailed body, glow, cute face (eyes, smile, blush)
function drawSnakes() {
  const ts = currentTileSize;
  const half = ts / 2;

  for (const player of gameState.players) {
    const isLocal = player.id === localPlayerId;
    const snakeColor = player.color || (isLocal ? LOCAL_SNAKE_COLOR : OTHER_SNAKE_COLOR);
    const bodyDark = adjustBrightness(snakeColor, -18);
    const bodyLight = adjustBrightness(snakeColor, 25);

    if (!player.snake || player.snake.length === 0) continue;

    const segs = player.snake;
    const path = segs.map(s => ({ x: s.x * ts + half, y: s.y * ts + half }));

    if (segs.length === 1) {
      // Single segment: head only – oval with soft gradient, no harsh circle
      const cx = path[0].x;
      const cy = path[0].y;
      const r = half - 0.5;
      ctx.fillStyle = `rgba(255,255,255,0.12)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.08, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy, 0, cx, cy, r);
      grad.addColorStop(0, bodyLight);
      grad.addColorStop(0.6, snakeColor);
      grad.addColorStop(1, bodyDark);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.08, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bodyDark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Body glow (soft outline)
      ctx.strokeStyle = `rgba(255,255,255,0.15)`;
      ctx.lineWidth = ts + 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();

      // Main body stroke (dark outline so snake stands out from floor)
      ctx.strokeStyle = SNAKE_OUTLINE_COLOR;
      ctx.lineWidth = ts + 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();

      // Body fill (main color)
      ctx.strokeStyle = snakeColor;
      ctx.lineWidth = ts - 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();

      // Scale shine: centered on body centerline (soft oval highlights)
      for (let i = 1; i < path.length - 1; i += 2) {
        const p = path[i];
        const prev = path[i - 1];
        const next = path[i + 1];
        const tx = (next.x - prev.x) / 2;
        const ty = (next.y - prev.y) / 2;
        const angle = Math.atan2(ty, tx);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, ts * 0.18, ts * 0.3, angle, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head: oval (elongated in movement direction) so it’s not a perfect circle
      const headX = path[0].x;
      const headY = path[0].y;
      const headR = half - 0.5;
      const dir = getHeadDirection(segs, ts);
      const angle = Math.atan2(dir.dy, dir.dx);
      const rFwd = headR * 1.08;   // slightly longer forward
      const rSide = headR * 0.92;  // slightly narrower sideways
      const headPath = new Path2D();
      headPath.ellipse(headX, headY, rFwd, rSide, angle, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(
        headX - dir.dx * headR * 0.3, headY - dir.dy * headR * 0.3, 0,
        headX, headY, Math.max(rFwd, rSide)
      );
      gradient.addColorStop(0, bodyLight);
      gradient.addColorStop(0.5, snakeColor);
      gradient.addColorStop(1, bodyDark);
      ctx.fillStyle = gradient;
      ctx.fill(headPath);
      ctx.strokeStyle = bodyDark;
      ctx.lineWidth = 1.5;
      ctx.stroke(headPath);

      // Tail: darker circle with small tip
      const tailX = path[path.length - 1].x;
      const tailY = path[path.length - 1].y;
      ctx.fillStyle = bodyDark;
      ctx.beginPath();
      ctx.arc(tailX, tailY, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = adjustBrightness(snakeColor, -35);
      ctx.beginPath();
      ctx.arc(tailX, tailY, headR * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cute face (direction-aware)
    const head = segs[0];
    const cx = head.x * ts + half;
    const cy = head.y * ts + half;
    const dir = getHeadDirection(segs, ts);
    const faceUpX = -dir.dx;
    const faceUpY = -dir.dy;
    const faceRightX = -dir.dy;
    const faceRightY = dir.dx;

    const eyeSize = Math.max(3, ts * 0.32);
    const eyeX = ts * 0.28;
    const pupilSize = Math.max(1.5, ts * 0.12);
    const highlightSize = Math.max(1, ts * 0.08);
    // Eyes centered on head: symmetric left/right on line perpendicular to direction
    const leftEyeX = cx - dir.dx * eyeX;
    const leftEyeY = cy - dir.dy * eyeX;
    const rightEyeX = cx + dir.dx * eyeX;
    const rightEyeY = cy + dir.dy * eyeX;

    function drawOneEye(ex, ey) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      const irisColor = adjustBrightness(snakeColor, 55);
      ctx.fillStyle = irisColor;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeSize * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b7ba8';
      ctx.beginPath();
      ctx.arc(ex, ey, pupilSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(ex - pupilSize * 0.4, ey - pupilSize * 0.4, highlightSize, 0, Math.PI * 2);
      ctx.fill();
    }
    drawOneEye(leftEyeX, leftEyeY);
    drawOneEye(rightEyeX, rightEyeY);

    // Smile (small arc below eyes, direction-aware)
    const smileDist = ts * 0.18;
    const smileCX = cx + faceUpX * (-smileDist);
    const smileCY = cy + faceUpY * (-smileDist);
    const smileRadius = ts * 0.2;
    const smileStart = Math.atan2(-faceRightY, -faceRightX);
    ctx.strokeStyle = 'rgba(107, 123, 168, 0.5)';
    ctx.lineWidth = Math.max(1, ts * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(smileCX, smileCY, smileRadius, smileStart + 0.3, smileStart + Math.PI - 0.3);
    ctx.stroke();

    // Blush (two small pink circles)
    const blushDist = ts * 0.38;
    const blushY = ts * 0.15;
    const blushX = ts * 0.35;
    const blushR = Math.max(2, ts * 0.12);
    const blush1X = cx + faceUpX * blushY + faceRightX * (-blushX);
    const blush1Y = cy + faceUpY * blushY + faceRightY * (-blushX);
    const blush2X = cx + faceUpX * blushY + faceRightX * blushX;
    const blush2Y = cy + faceUpY * blushY + faceRightY * blushX;
    ctx.fillStyle = 'rgba(248, 200, 212, 0.55)';
    ctx.beginPath();
    ctx.arc(blush1X, blush1Y, blushR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(blush2X, blush2Y, blushR, 0, Math.PI * 2);
    ctx.fill();

    // Name above head – black for contrast on pastel floor
    const nameOffsetY = half + Math.max(14, ts * 0.85);
    ctx.font = `bold ${Math.max(10, ts * 0.75)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeText(player.name, cx, cy - nameOffsetY);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(player.name, cx, cy - nameOffsetY);
    ctx.textBaseline = 'alphabetic';
  }
}

// Draw scoreboard
function drawScoreboard() {
  // Sort players by score (highest first / most points on top)
  const sortedPlayers = [...gameState.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Build scoreboard HTML
  let html = '';
  const weaponIcons = { SWORD: '⚔️', GUN: '🔫', ROCKET: '🚀' };
  
  for (const player of sortedPlayers) {
    const isLocal = player.id === localPlayerId;
    const className = isLocal ? 'score-item local' : 'score-item';
    const length = player.snake ? player.snake.length : 0;
    const weaponIcon = player.weapon ? weaponIcons[player.weapon] : '';
    const nameColor = player.color || (isLocal ? '#2db896' : '#e07a6b');
    html += `<div class="${className}">
      <span class="name" style="color:${nameColor}">${escapeHtml(player.name)} ${weaponIcon}</span>
      <span class="score">${length}</span>
    </div>`;
  }
  
  scoreList.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Draw weapon UI
function drawWeaponUI() {
  const localPlayer = getLocalPlayer();
  if (!localPlayer || !localPlayer.weapon) return;
  
  // Draw weapon indicator in bottom-right
  const padding = 20;
  const boxWidth = 150;
  const boxHeight = 60;
  const x = canvas.width - boxWidth - padding;
  const y = canvas.height - boxHeight - padding;
  
  // Background
  ctx.fillStyle = 'rgba(197, 208, 232, 0.92)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  
  ctx.strokeStyle = '#1e3d4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  
  // Weapon icon
  const weaponIcons = {
    SWORD: '⚔️',
    GUN: '🔫',
    ROCKET: '🚀'
  };
  
  ctx.font = '32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(weaponIcons[localPlayer.weapon] || '?', x + 40, y + boxHeight / 2);
  
  // Weapon name
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#1a1a2e';
  ctx.textAlign = 'left';
  ctx.fillText(localPlayer.weapon, x + 65, y + 20);
  
  if (localPlayer.weapon === 'GUN' || localPlayer.weapon === 'ROCKET') {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = localPlayer.ammo > 0 ? '#1a1a2e' : '#b91c1c';
    ctx.fillText(`${localPlayer.ammo}`, x + 65, y + 38);
    
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('ammo', x + 85, y + 38);
  } else {
    // Instructions for sword
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText('SPACE / CLICK', x + 65, y + 40);
  }
}

// Utility: adjust brightness
function adjustBrightness(color, amount) {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Event listeners
playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  menu.classList.remove('hidden');
});

joinBtn.addEventListener('click', () => {
  connect();
});

nicknameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

backToMenuBtn.addEventListener('click', () => {
  returnToMenu('You left the game');
});

respawnBtn.addEventListener('click', () => {
  if (socket && socket.connected) {
    socket.emit('respawn');
  }
});

quitBtn.addEventListener('click', () => {
  returnToMenu('You left the game');
});

if (infoBtn) {
  infoBtn.addEventListener('click', () => {
    if (rulesModal) {
      rulesModal.classList.remove('hidden');
      rulesModal.setAttribute('aria-hidden', 'false');
    }
  });
}
if (rulesBackdrop) {
  rulesBackdrop.addEventListener('click', closeRulesModal);
}
if (rulesCloseBtn) {
  rulesCloseBtn.addEventListener('click', closeRulesModal);
}
function closeRulesModal() {
  if (rulesModal) {
    rulesModal.classList.add('hidden');
    rulesModal.setAttribute('aria-hidden', 'true');
  }
}

if (serverConfigToggle && serverConfig) {
  serverConfigToggle.addEventListener('click', () => {
    serverConfig.classList.toggle('hidden');
    serverConfigToggle.textContent = serverConfig.classList.contains('hidden') ? 'Server (dev)' : 'Hide server';
  });
}

if (soundToggle && gameMusic) {
  try {
    const saved = localStorage.getItem('snakeMusicMuted');
    if (saved === 'true') {
      musicMuted = true;
      gameMusic.muted = true;
      soundToggle.textContent = '🔇 Muted';
    }
  } catch (e) {}
  soundToggle.addEventListener('click', () => {
    musicMuted = !musicMuted;
    gameMusic.muted = musicMuted;
    soundToggle.textContent = musicMuted ? '🔇 Muted' : '🔊 Sound';
    try {
      localStorage.setItem('snakeMusicMuted', musicMuted ? 'true' : 'false');
    } catch (e) {}
    if (!musicMuted && !menu.classList.contains('hidden')) {
      gameMusic.pause();
      gameMusic.currentTime = 0;
    }
  });
}

// Initialize
initCanvas();
console.log('🐍 Snake Multiplayer Client ready');
