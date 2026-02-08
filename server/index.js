const { Server } = require('socket.io');

// Configuration
const PORT = process.env.PORT || 3001;
const TICK_RATE = 12; // ticks per second
const TICK_INTERVAL = 1000 / TICK_RATE;
const MAP_WIDTH = 120;
const MAP_HEIGHT = 120;
const MAX_PLAYERS = 10;
const COIN_TARGET = 30;
const MIN_SPAWN_DISTANCE = 15;
const INITIAL_SNAKE_LENGTH = 3;

// Directions
const DIRS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
};

// Opposite directions (for preventing reverse)
const OPPOSITES = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT'
};

// Game state
const game = {
  tick: 0,
  players: new Map(), // socketId -> player
  coins: [],
  room: 'lobby'
};

// Player structure
function createPlayer(socketId, name, spawnPos) {
  return {
    id: socketId,
    name: sanitizeName(name),
    snake: [spawnPos], // head at index 0
    dir: 'RIGHT',
    nextDir: 'RIGHT',
    alive: true,
    score: 0,
    lastInputTime: 0
  };
}

// Sanitize player name
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Player';
  return name.trim().slice(0, 20).replace(/[<>]/g, '') || 'Player';
}

// Random position
function randomPos() {
  return {
    x: Math.floor(Math.random() * MAP_WIDTH),
    y: Math.floor(Math.random() * MAP_HEIGHT)
  };
}

// Check if position is valid (not on snake or coin)
function isPositionOccupied(pos, excludeSnakeId = null) {
  // Check all snakes
  for (const [id, player] of game.players) {
    if (id === excludeSnakeId) continue;
    for (const segment of player.snake) {
      if (segment.x === pos.x && segment.y === pos.y) {
        return true;
      }
    }
  }
  return false;
}

// Distance between two points
function distance(p1, p2) {
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

// Find valid spawn position
function findSpawnPosition(attempts = 100) {
  let minDist = MIN_SPAWN_DISTANCE;
  
  for (let i = 0; i < attempts; i++) {
    const pos = randomPos();
    
    // Check if occupied
    if (isPositionOccupied(pos)) continue;
    
    // Check distance from other snake heads
    let valid = true;
    for (const [_, player] of game.players) {
      if (!player.alive) continue;
      const head = player.snake[0];
      if (distance(pos, head) < minDist) {
        valid = false;
        break;
      }
    }
    
    if (valid) return pos;
    
    // Relax distance requirement gradually
    if (i > 0 && i % 20 === 0) {
      minDist = Math.max(5, minDist - 2);
    }
  }
  
  // Fallback: return any non-occupied position
  for (let i = 0; i < 100; i++) {
    const pos = randomPos();
    if (!isPositionOccupied(pos)) return pos;
  }
  
  // Last resort
  return randomPos();
}

// Spawn initial snake at position
function spawnSnake(pos) {
  const snake = [pos];
  // Add initial tail segments to the left
  for (let i = 1; i < INITIAL_SNAKE_LENGTH; i++) {
    snake.push({ x: pos.x - i, y: pos.y });
  }
  return snake;
}

// Spawn coins
function spawnCoin() {
  for (let i = 0; i < 100; i++) {
    const pos = randomPos();
    
    // Check if position is free
    let occupied = false;
    
    // Check snakes
    for (const [_, player] of game.players) {
      for (const segment of player.snake) {
        if (segment.x === pos.x && segment.y === pos.y) {
          occupied = true;
          break;
        }
      }
      if (occupied) break;
    }
    
    // Check existing coins
    if (!occupied) {
      for (const coin of game.coins) {
        if (coin.x === pos.x && coin.y === pos.y) {
          occupied = true;
          break;
        }
      }
    }
    
    if (!occupied) {
      game.coins.push(pos);
      return;
    }
  }
  
  // Fallback
  game.coins.push(randomPos());
}

// Maintain coin count
function maintainCoins() {
  while (game.coins.length < COIN_TARGET) {
    spawnCoin();
  }
}

// Respawn player
function respawnPlayer(player) {
  const spawnPos = findSpawnPosition();
  player.snake = spawnSnake(spawnPos);
  player.dir = 'RIGHT';
  player.nextDir = 'RIGHT';
  player.alive = true;
}

// Game tick
function gameTick() {
  game.tick++;
  
  // Move all snakes
  for (const [_, player] of game.players) {
    if (!player.alive) continue;
    
    // Apply validated direction
    if (player.nextDir && player.nextDir !== OPPOSITES[player.dir]) {
      player.dir = player.nextDir;
    }
    
    // Calculate new head position
    const head = player.snake[0];
    const dir = DIRS[player.dir];
    const newHead = {
      x: head.x + dir.x,
      y: head.y + dir.y
    };
    
    // Check wall collision (wrap or respawn)
    if (newHead.x < 0 || newHead.x >= MAP_WIDTH || 
        newHead.y < 0 || newHead.y >= MAP_HEIGHT) {
      player.alive = false;
      continue;
    }
    
    // Check coin collision
    let ateFood = false;
    const coinIndex = game.coins.findIndex(coin => 
      coin.x === newHead.x && coin.y === newHead.y
    );
    
    if (coinIndex !== -1) {
      ateFood = true;
      game.coins.splice(coinIndex, 1);
      player.score++;
    }
    
    // Move snake
    player.snake.unshift(newHead);
    if (!ateFood) {
      player.snake.pop(); // Remove tail if didn't eat
    }
  }
  
  // Check collisions
  const alivePlayers = Array.from(game.players.values()).filter(p => p.alive);
  
  for (const player of alivePlayers) {
    const head = player.snake[0];
    
    // Check self collision
    for (let i = 1; i < player.snake.length; i++) {
      const segment = player.snake[i];
      if (head.x === segment.x && head.y === segment.y) {
        player.alive = false;
        break;
      }
    }
    
    if (!player.alive) continue;
    
    // Check collision with other snakes
    for (const other of alivePlayers) {
      if (other.id === player.id) continue;
      
      // Check head-to-head collision
      const otherHead = other.snake[0];
      if (head.x === otherHead.x && head.y === otherHead.y) {
        player.alive = false;
        other.alive = false;
        break;
      }
      
      // Check head-to-body collision
      for (const segment of other.snake) {
        if (head.x === segment.x && head.y === segment.y) {
          player.alive = false;
          break;
        }
      }
      
      if (!player.alive) break;
    }
  }
  
  // Respawn dead players
  for (const [_, player] of game.players) {
    if (!player.alive) {
      respawnPlayer(player);
    }
  }
  
  // Maintain coins
  maintainCoins();
  
  // Broadcast snapshot
  broadcastSnapshot();
}

// Broadcast game state
function broadcastSnapshot() {
  const snapshot = {
    tick: game.tick,
    players: Array.from(game.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      snake: p.snake,
      score: p.score
    })),
    coins: game.coins
  };
  
  io.to(game.room).emit('snapshot', snapshot);
}

// Setup Socket.io server
const io = new Server(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

console.log(`🐍 Snake Multiplayer Server running on port ${PORT}`);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  socket.on('join', (data) => {
    // Check room capacity
    if (game.players.size >= MAX_PLAYERS) {
      socket.emit('error', { message: 'Room is full (10/10 players)' });
      return;
    }
    
    // Create player
    const spawnPos = findSpawnPosition();
    const player = createPlayer(socket.id, data.name, spawnPos);
    player.snake = spawnSnake(spawnPos);
    
    game.players.set(socket.id, player);
    socket.join(game.room);
    
    console.log(`Player joined: ${player.name} (${socket.id}) - Total: ${game.players.size}`);
    
    // Send initial state
    socket.emit('joined', {
      id: socket.id,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT
    });
  });
  
  socket.on('input', (data) => {
    const player = game.players.get(socket.id);
    if (!player) return;
    
    // Rate limiting: ignore if too fast
    const now = Date.now();
    if (now - player.lastInputTime < TICK_INTERVAL * 0.5) {
      return;
    }
    player.lastInputTime = now;
    
    // Validate direction
    const validDirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    if (validDirs.includes(data.dir)) {
      player.nextDir = data.dir;
    }
  });
  
  socket.on('disconnect', () => {
    const player = game.players.get(socket.id);
    if (player) {
      console.log(`Player left: ${player.name} (${socket.id}) - Total: ${game.players.size - 1}`);
      game.players.delete(socket.id);
    }
  });
});

// Initialize coins
maintainCoins();

// Start game loop
setInterval(gameTick, TICK_INTERVAL);

console.log(`Game loop running at ${TICK_RATE} ticks/second`);
console.log(`Map size: ${MAP_WIDTH}x${MAP_HEIGHT}`);
console.log(`Max players: ${MAX_PLAYERS}`);
