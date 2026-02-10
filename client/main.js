// Configuration
const TILE_SIZE = 16;
const GRID_COLOR = '#1a2840';
const COIN_COLOR = '#ffd93d';
const LOCAL_SNAKE_COLOR = '#4ecca3';
const OTHER_SNAKE_COLOR = '#ee6c4d';
const SNAKE_OUTLINE_COLOR = '#16213e';

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

// Input buffer
let currentDirection = 'RIGHT';
let inputQueue = [];

// DOM Elements
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
  const serverUrl = serverUrlInput.value.trim() || 'ws://localhost:3001';

  
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
    
    // Start input handling
    setupInput();
    
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
      const x = effect.x * TILE_SIZE;
      const y = effect.y * TILE_SIZE;
      
      ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * (1 + age), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'explosion') {
      const centerX = effect.x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = effect.y * TILE_SIZE + TILE_SIZE / 2;
      const maxRadius = effect.radius * TILE_SIZE;
      const radius = maxRadius * age;
      
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = `rgba(255, 50, 0, ${alpha})`;
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
  
  const head = localPlayer.snake[0];
  const targetX = head.x * TILE_SIZE - canvas.width / 2;
  const targetY = head.y * TILE_SIZE - canvas.height / 2;
  
  // Smooth camera (or instant)
  cameraOffset.x = targetX;
  cameraOffset.y = targetY;
  
  // Clamp camera to map bounds
  const maxX = gameState.mapWidth * TILE_SIZE - canvas.width;
  const maxY = gameState.mapHeight * TILE_SIZE - canvas.height;
  
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
    // Clear canvas
    ctx.fillStyle = '#0f3460';
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

// Draw grid
function drawGrid() {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  
  // Calculate visible area
  const startX = Math.floor(cameraOffset.x / TILE_SIZE);
  const startY = Math.floor(cameraOffset.y / TILE_SIZE);
  const endX = Math.ceil((cameraOffset.x + canvas.width) / TILE_SIZE);
  const endY = Math.ceil((cameraOffset.y + canvas.height) / TILE_SIZE);
  
  // Draw vertical lines
  for (let x = startX; x <= endX; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_SIZE, startY * TILE_SIZE);
    ctx.lineTo(x * TILE_SIZE, endY * TILE_SIZE);
    ctx.stroke();
  }
  
  // Draw horizontal lines
  for (let y = startY; y <= endY; y++) {
    ctx.beginPath();
    ctx.moveTo(startX * TILE_SIZE, y * TILE_SIZE);
    ctx.lineTo(endX * TILE_SIZE, y * TILE_SIZE);
    ctx.stroke();
  }
}

// Draw coins
function drawCoins() {
  ctx.fillStyle = COIN_COLOR;
  
  for (const coin of gameState.coins) {
    const x = coin.x * TILE_SIZE;
    const y = coin.y * TILE_SIZE;
    
    // Draw coin as circle
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Add shine effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2 - 2, TILE_SIZE / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COIN_COLOR;
  }
}

// Draw food orbs (from cut snakes)
function drawFoodOrbs() {
  for (const orb of gameState.foodOrbs) {
    const x = orb.x * TILE_SIZE;
    const y = orb.y * TILE_SIZE;
    
    // Draw orb as small circle
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Outline
    ctx.strokeStyle = '#ff5252';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// Draw weapon pickups
function drawWeaponPickups() {
  const weaponColors = {
    SWORD: '#c0c0c0',
    GUN: '#4a90e2',
    ROCKET: '#e74c3c'
  };
  
  const weaponIcons = {
    SWORD: '⚔️',
    GUN: '🔫',
    ROCKET: '🚀'
  };
  
  for (const weapon of gameState.weapons) {
    if (!weapon.position) continue; // weapon is held by player
    
    const x = weapon.position.x * TILE_SIZE;
    const y = weapon.position.y * TILE_SIZE;
    
    // Draw background
    ctx.fillStyle = weaponColors[weapon.type] || '#888';
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    
    // Draw icon
    ctx.font = `${TILE_SIZE - 4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(weaponIcons[weapon.type] || '?', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
  }
}

// Draw projectiles
function drawProjectiles() {
  for (const proj of gameState.projectiles) {
    const x = proj.x * TILE_SIZE;
    const y = proj.y * TILE_SIZE;
    
    if (proj.type === 'BULLET') {
      // Small yellow dot
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.type === 'ROCKET') {
      // Larger red projectile
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Trail effect
      ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
      ctx.beginPath();
      ctx.arc(x - proj.vx * 2, y - proj.vy * 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Draw snakes
function drawSnakes() {
  for (const player of gameState.players) {
    const isLocal = player.id === localPlayerId;
    const snakeColor = isLocal ? LOCAL_SNAKE_COLOR : OTHER_SNAKE_COLOR;
    
    if (!player.snake || player.snake.length === 0) continue;
    
    // Draw each segment
    for (let i = 0; i < player.snake.length; i++) {
      const segment = player.snake[i];
      const x = segment.x * TILE_SIZE;
      const y = segment.y * TILE_SIZE;
      
      // Outline
      ctx.fillStyle = SNAKE_OUTLINE_COLOR;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      
      // Body
      const isHead = i === 0;
      if (isHead) {
        // Draw head brighter
        ctx.fillStyle = snakeColor;
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        
        // Draw eyes
        ctx.fillStyle = '#16213e';
        const eyeSize = 3;
        const eyeOffset = 4;
        ctx.fillRect(x + eyeOffset, y + eyeOffset, eyeSize, eyeSize);
        ctx.fillRect(x + TILE_SIZE - eyeOffset - eyeSize, y + eyeOffset, eyeSize, eyeSize);
      } else {
        // Draw body slightly darker
        ctx.fillStyle = adjustBrightness(snakeColor, -10);
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }
    }
    
    // Draw name above head
    const head = player.snake[0];
    ctx.fillStyle = snakeColor;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, head.x * TILE_SIZE + TILE_SIZE / 2, head.y * TILE_SIZE - 5);
  }
}

// Draw scoreboard
function drawScoreboard() {
  // Sort players by score
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  
  // Build scoreboard HTML
  let html = '';
  const weaponIcons = { SWORD: '⚔️', GUN: '🔫', ROCKET: '🚀' };
  
  for (const player of sortedPlayers) {
    const isLocal = player.id === localPlayerId;
    const className = isLocal ? 'score-item local' : 'score-item';
    const length = player.snake ? player.snake.length : 0;
    const weaponIcon = player.weapon ? weaponIcons[player.weapon] : '';
    html += `<div class="${className}">
      <span class="name">${player.name} ${weaponIcon}</span>
      <span class="score">⚡${player.score} (${length})</span>
    </div>`;
  }
  
  scoreList.innerHTML = html;
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
  ctx.fillStyle = 'rgba(22, 33, 62, 0.9)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  
  // Border
  ctx.strokeStyle = '#4ecca3';
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
  ctx.fillStyle = '#4ecca3';
  ctx.textAlign = 'left';
  ctx.fillText(localPlayer.weapon, x + 65, y + 20);
  
  // Ammo count (if weapon has ammo)
  if (localPlayer.weapon === 'GUN' || localPlayer.weapon === 'ROCKET') {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = localPlayer.ammo > 0 ? '#ffd93d' : '#ff6b6b';
    ctx.fillText(`${localPlayer.ammo}`, x + 65, y + 38);
    
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('ammo', x + 85, y + 38);
  } else {
    // Instructions for sword
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#aaa';
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

// Initialize
initCanvas();
console.log('🐍 Snake Multiplayer Client ready');
