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
  const serverUrl =
  serverUrlInput.value.trim() ||
  (location.hostname === "localhost"
    ? "ws://localhost:3001"
    : "wss://snake-multiplayer-1.onrender.com");

  
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
  statusDiv.textContent = message || '';
  statusDiv.className = message ? 'status error' : 'status';
  joinBtn.disabled = false;
  
  if (socket) {
    socket.close();
    socket = null;
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
  
  // Draw snakes
  drawSnakes();
  
  // Restore context
  ctx.restore();
  
  // Draw UI
  drawScoreboard();
  
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
  for (const player of sortedPlayers) {
    const isLocal = player.id === localPlayerId;
    const className = isLocal ? 'score-item local' : 'score-item';
    const length = player.snake ? player.snake.length : 0;
    html += `<div class="${className}">
      <span class="name">${player.name}</span>
      <span class="score">⚡${player.score} (${length})</span>
    </div>`;
  }
  
  scoreList.innerHTML = html;
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

// Initialize
initCanvas();
console.log('🐍 Snake Multiplayer Client ready');
