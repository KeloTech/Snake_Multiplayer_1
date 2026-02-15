const { Server } = require('socket.io');

// Configuration
const PORT = process.env.PORT || 3001;
const TICK_RATE = 24; // ticks per second (increased for input responsiveness)
const TICK_INTERVAL = 1000 / TICK_RATE;
const MOVE_EVERY_N_TICKS = 2; // Snake moves every 2 ticks = 12 moves/sec (same speed as before)
const SNAPSHOT_EVERY_N_TICKS = 2; // Broadcast snapshots every 2 ticks = 12 snapshots/sec
const MAP_WIDTH = 120;
const MAP_HEIGHT = 120;
const MAX_PLAYERS_PER_ROOM = 15;
const COIN_TARGET = 30;
const MIN_SPAWN_DISTANCE = 15;
const INITIAL_SNAKE_LENGTH = 3;

// Bot Configuration
const BOT_COUNT = 4; // Number of bots per room
const BOT_LOOKAHEAD_STEPS = 3; // How far ahead bots look
const BOT_SPACE_CHECK_DEPTH = 5; // How deep to check free space
const BOT_MISTAKE_PROBABILITY_MIN = 0.03; // 3% minimum mistake chance
const BOT_MISTAKE_PROBABILITY_MAX = 0.08; // 8% maximum mistake chance
const BOT_FOOD_WEIGHT_MIN = 0.3; // Min food attraction
const BOT_FOOD_WEIGHT_MAX = 0.7; // Max food attraction
const BOT_EDGE_PENALTY_MIN = 5; // Min penalty for being near edges
const BOT_EDGE_PENALTY_MAX = 15; // Max penalty for being near edges
const BOT_RISK_MIN = 0.3; // Conservative
const BOT_RISK_MAX = 0.8; // Aggressive
const BOT_MOVE_EVERY_N_TICKS = 5; // Bots decide direction every N ticks (slower = less spamming)

// Weapon Configuration
const WEAPON_TYPES = ['SWORD', 'GUN', 'ROCKET'];
const SWORD_RANGE = 1; // tiles
const SWORD_COOLDOWN = 1000; // ms
const GUN_COOLDOWN = 500; // ms
const GUN_BULLET_SPEED = 2; // tiles per tick
const GUN_MAX_DISTANCE = 30; // tiles
const GUN_MAX_AMMO = 10; // bullets
const ROCKET_COOLDOWN = 2000; // ms
const ROCKET_SPEED = 1.5; // tiles per tick
const ROCKET_EXPLOSION_RADIUS = 2; // 5x5 grid (radius 2)
const ROCKET_MAX_AMMO = 5; // rockets

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

// Global room state
const rooms = new Map(); // roomId -> RoomState
const socketToRoom = new Map(); // socketId -> roomId
let nextRoomNumber = 1;
let nextBotId = 1;

// Bot names for variety
const BOT_NAMES = [
  'BotAlpha', 'BotBeta', 'BotGamma', 'BotDelta',
  'SnakeBot', 'AI-Snake', 'CyberSnake', 'RoboSnake',
  'ZigZag', 'Hunter', 'Dasher', 'Slither'
];

// Bot personality class
class BotPersonality {
  constructor() {
    this.mistakeProbability = Math.random() * (BOT_MISTAKE_PROBABILITY_MAX - BOT_MISTAKE_PROBABILITY_MIN) + BOT_MISTAKE_PROBABILITY_MIN;
    this.foodWeight = Math.random() * (BOT_FOOD_WEIGHT_MAX - BOT_FOOD_WEIGHT_MIN) + BOT_FOOD_WEIGHT_MIN;
    this.edgePenalty = Math.random() * (BOT_EDGE_PENALTY_MAX - BOT_EDGE_PENALTY_MIN) + BOT_EDGE_PENALTY_MIN;
    this.riskiness = Math.random() * (BOT_RISK_MAX - BOT_RISK_MIN) + BOT_RISK_MIN;
    this.seed = Math.random();
  }
}

// Room structure
function createRoom(roomId) {
  const room = {
    id: roomId,
    tick: 0,
    players: new Map(), // socketId -> player
    coins: [],
    foodOrbs: [], // from cut snakes
    weapons: new Map(), // weaponType -> { owner: socketId | null, position: {x,y} | null, lastUsed: timestamp }
    projectiles: [], // { id, type, x, y, vx, vy, ownerId, distanceTraveled }
    nextProjectileId: 1,
    createdAt: Date.now(),
    bots: [] // Bot IDs in this room
  };
  
  // Initialize coins for the room
  while (room.coins.length < COIN_TARGET) {
    room.coins.push(randomPos());
  }
  
  // Initialize weapons (all available as pickups)
  WEAPON_TYPES.forEach(type => {
    room.weapons.set(type, {
      owner: null,
      position: randomPos(),
      lastUsed: 0
    });
  });
  
  console.log(`✨ Room created: ${roomId}`);
  
  // Spawn bots after a short delay (let initial coins/weapons settle)
  setTimeout(() => spawnBots(room), 500);
  
  return room;
}

// Player structure
function createPlayer(socketId, name, spawnPos, isBot = false) {
  return {
    id: socketId,
    name: sanitizeName(name),
    snake: [spawnPos], // head at index 0
    dir: 'RIGHT',
    nextDir: 'RIGHT',
    alive: true,
    score: 0,
    lastInputTime: 0,
    waitingToRespawn: false,
    weapon: null, // 'SWORD' | 'GUN' | 'ROCKET' | null
    weaponCooldown: 0,
    ammo: 0, // Current ammo for equipped weapon
    isBot: isBot,
    botPersonality: isBot ? new BotPersonality() : null
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
function isPositionOccupied(pos, roomState, excludeSnakeId = null) {
  // Check all snakes in the room
  for (const [id, player] of roomState.players) {
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
function findSpawnPosition(roomState, attempts = 100) {
  let minDist = MIN_SPAWN_DISTANCE;
  
  for (let i = 0; i < attempts; i++) {
    const pos = randomPos();
    
    // Check if occupied
    if (isPositionOccupied(pos, roomState)) continue;
    
    // Check distance from other snake heads
    let valid = true;
    for (const [_, player] of roomState.players) {
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
    if (!isPositionOccupied(pos, roomState)) return pos;
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
function spawnCoin(roomState) {
  for (let i = 0; i < 100; i++) {
    const pos = randomPos();
    
    // Check if position is free
    let occupied = false;
    
    // Check snakes
    for (const [_, player] of roomState.players) {
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
      for (const coin of roomState.coins) {
        if (coin.x === pos.x && coin.y === pos.y) {
          occupied = true;
          break;
        }
      }
    }
    
    if (!occupied) {
      roomState.coins.push(pos);
      return;
    }
  }
  
  // Fallback
  roomState.coins.push(randomPos());
}

// Maintain coin count
function maintainCoins(roomState) {
  while (roomState.coins.length < COIN_TARGET) {
    spawnCoin(roomState);
  }
}

// Respawn player
function respawnPlayer(player, roomState) {
  const spawnPos = findSpawnPosition(roomState);
  if (!spawnPos) {
    console.error(`❌ Could not find spawn position for ${player.name}`);
    // Try a random position as last resort
    spawnPos = {
      x: Math.floor(Math.random() * (MAP_WIDTH - 20)) + 10,
      y: Math.floor(Math.random() * (MAP_HEIGHT - 20)) + 10
    };
  }
  
  player.snake = spawnSnake(spawnPos);
  player.dir = 'RIGHT';
  player.nextDir = 'RIGHT';
  player.alive = true;
  player.waitingToRespawn = false;
  
  // Release weapon if player had one
  if (player.weapon) {
    releaseWeapon(player, roomState);
  }
  
  console.log(`✅ Respawned ${player.name} at (${spawnPos.x}, ${spawnPos.y}), alive=${player.alive}, snake=${player.snake.length}`);
}

// ===== BOT AI SYSTEM =====

// Spawn bots in room
function spawnBots(roomState) {
  for (let i = 0; i < BOT_COUNT; i++) {
    const botId = `bot-${nextBotId++}`;
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 100);
    const spawnPos = findSpawnPosition(roomState);
    
    const bot = createPlayer(botId, botName, spawnPos, true);
    bot.snake = spawnSnake(spawnPos);
    
    roomState.players.set(botId, bot);
    roomState.bots.push(botId);
    
    console.log(`🤖 Bot spawned: ${botName} (${botId}) in ${roomState.id}`);
  }
}

// Check if position is safe (no collision) - generic, optionally ignore one player entirely
function isSafe(x, y, roomState, ignoreBotId = null) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
  
  for (const [id, player] of roomState.players) {
    if (id === ignoreBotId) continue;
    if (!player.alive) continue;
    for (const segment of player.snake) {
      if (segment.x === x && segment.y === y) return false;
    }
  }
  return true;
}

// Safe for a specific player to MOVE to (x,y). Treats that player's tail as vacated (tail moves).
function isSafeForMove(movingPlayer, x, y, roomState) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
  
  for (const [id, player] of roomState.players) {
    if (!player.alive) continue;
    const snake = player.snake;
    const tailIndex = snake.length - 1;
    for (let i = 0; i < snake.length; i++) {
      if (movingPlayer.id === id && i === tailIndex) continue; // moving player's tail vacates
      const seg = snake[i];
      if (seg.x === x && seg.y === y) return false;
    }
  }
  return true;
}

// Count free space using simple flood fill (limited depth). Uses moving bot for tail-vacated check.
function countFreeSpace(startX, startY, roomState, bot, depth = BOT_SPACE_CHECK_DEPTH) {
  const visited = new Set();
  const queue = [{x: startX, y: startY, d: 0}];
  visited.add(`${startX},${startY}`);
  let count = 0;
  
  while (queue.length > 0 && count < 100) {
    const {x, y, d} = queue.shift();
    if (d >= depth) continue;
    count++;
    
    const dirs = [{x:0,y:-1}, {x:0,y:1}, {x:-1,y:0}, {x:1,y:0}];
    for (const dir of dirs) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      const key = `${nx},${ny}`;
      
      if (!visited.has(key) && isSafeForMove(bot, nx, ny, roomState)) {
        visited.add(key);
        queue.push({x: nx, y: ny, d: d + 1});
      }
    }
  }
  
  return count;
}

// Find nearest food (coin or orb)
function findNearestFood(headX, headY, roomState) {
  let nearest = null;
  let minDist = Infinity;
  
  // Check coins
  for (const coin of roomState.coins) {
    const dist = Math.abs(coin.x - headX) + Math.abs(coin.y - headY);
    if (dist < minDist) {
      minDist = dist;
      nearest = coin;
    }
  }
  
  // Check food orbs
  for (const orb of roomState.foodOrbs) {
    const dist = Math.abs(orb.x - headX) + Math.abs(orb.y - headY);
    if (dist < minDist) {
      minDist = dist;
      nearest = orb;
    }
  }
  
  return nearest;
}

// Calculate edge distance (how close to walls)
function getEdgeDistance(x, y) {
  return Math.min(x, MAP_WIDTH - 1 - x, y, MAP_HEIGHT - 1 - y);
}

// Get all possible directions
function getPossibleDirections(currentDir) {
  const all = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
  const opposite = OPPOSITES[currentDir];
  return all.filter(d => d !== opposite);
}

// Bot AI: Choose best direction
function chooseBotDirection(bot, roomState) {
  const head = bot.snake[0];
  const personality = bot.botPersonality;
  const possibleDirs = getPossibleDirections(bot.dir);
  
  // Score each direction
  const scores = [];
  
  for (const dir of possibleDirs) {
    const dirVec = DIRS[dir];
    const newX = head.x + dirVec.x;
    const newY = head.y + dirVec.y;
    
    let score = 0;
    
    // Hard reject: immediate collision (use isSafeForMove so we don't treat own tail as obstacle)
    if (!isSafeForMove(bot, newX, newY, roomState)) {
      score = -1000;
    } else {
      // Safety: count free space ahead
      const freeSpace = countFreeSpace(newX, newY, roomState, bot);
      score += freeSpace * (1 + personality.riskiness);
      
      // Food attraction: reduce distance to nearest food
      const nearestFood = findNearestFood(head.x, head.y, roomState);
      if (nearestFood) {
        const currentDist = Math.abs(nearestFood.x - head.x) + Math.abs(nearestFood.y - head.y);
        const newDist = Math.abs(nearestFood.x - newX) + Math.abs(nearestFood.y - newY);
        const foodScore = (currentDist - newDist) * 10 * personality.foodWeight;
        score += foodScore;
      }
      
      // Edge penalty: avoid getting too close to walls
      const edgeDist = getEdgeDistance(newX, newY);
      if (edgeDist < 5) {
        score -= (5 - edgeDist) * personality.edgePenalty;
      }
      
      // Random variation (personality)
      score += (Math.random() - 0.5) * 5 * personality.seed;
      
      // Look ahead: check if next move would be safe
      const nextX = newX + dirVec.x;
      const nextY = newY + dirVec.y;
      if (isSafeForMove(bot, nextX, nextY, roomState)) {
        score += 10; // Bonus for moves that keep options open
      }
    }
    
    scores.push({ dir, score });
  }
  
  // Sort by score
  scores.sort((a, b) => b.score - a.score);
  
  // Mistake: occasionally pick suboptimal move
  const makeMistake = Math.random() < personality.mistakeProbability;
  
  if (makeMistake && scores.length > 1 && scores[1].score > -500) {
    // Pick 2nd best or random valid move
    const validMoves = scores.filter(s => s.score > -500);
    if (validMoves.length > 1) {
      return validMoves[Math.floor(Math.random() * validMoves.length)].dir;
    }
  }
  
  // Return best move
  return scores[0].score > -500 ? scores[0].dir : bot.dir;
}

// Bot weapon usage decision
function botDecideWeaponUse(bot, roomState) {
  if (!bot.weapon || !bot.alive) return false;
  
  const personality = bot.botPersonality;
  const head = bot.snake[0];
  
  if (bot.weapon === 'SWORD') {
    // Check if any enemy nearby
    for (const [id, player] of roomState.players) {
      if (id === bot.id || !player.alive) continue;
      
      for (const segment of player.snake) {
        const dist = Math.abs(segment.x - head.x) + Math.abs(segment.y - head.y);
        if (dist <= SWORD_RANGE) {
          // 70% chance to strike if enemy in range
          return Math.random() < 0.7;
        }
      }
    }
  } else if (bot.weapon === 'GUN' && bot.ammo > 0) {
    // Find target in firing direction
    const dirVec = DIRS[bot.dir];
    for (let i = 1; i <= 15; i++) {
      const checkX = head.x + dirVec.x * i;
      const checkY = head.y + dirVec.y * i;
      
      for (const [id, player] of roomState.players) {
        if (id === bot.id || !player.alive) continue;
        
        for (const segment of player.snake) {
          if (segment.x === checkX && segment.y === checkY) {
            // Found target in line of fire - shoot with some probability
            return Math.random() < 0.4 * personality.riskiness;
          }
        }
      }
    }
  } else if (bot.weapon === 'ROCKET' && bot.ammo > 0) {
    // Use rocket if multiple enemies nearby or low on ammo
    let nearbyEnemies = 0;
    for (const [id, player] of roomState.players) {
      if (id === bot.id || !player.alive) continue;
      const playerHead = player.snake[0];
      const dist = Math.abs(playerHead.x - head.x) + Math.abs(playerHead.y - head.y);
      if (dist < 15) nearbyEnemies++;
    }
    
    // More likely to fire if multiple enemies or last rocket
    const urgency = nearbyEnemies > 1 || bot.ammo === 1;
    return urgency && Math.random() < 0.2;
  }
  
  return false;
}

// Update bot inputs (direction only every BOT_MOVE_EVERY_N_TICKS to reduce spamming)
function updateBotInputs(roomState) {
  const shouldDecideMove = (roomState.tick % BOT_MOVE_EVERY_N_TICKS) === 0;
  
  for (const botId of roomState.bots) {
    const bot = roomState.players.get(botId);
    if (!bot || !bot.alive) continue; // Only update alive bots
    
    if (shouldDecideMove) {
      const bestDir = chooseBotDirection(bot, roomState);
      bot.nextDir = bestDir;
    }
    
    // Decide weapon usage
    if (botDecideWeaponUse(bot, roomState)) {
      // Trigger weapon action
      const now = Date.now();
      switch (bot.weapon) {
        case 'SWORD':
          if (now - bot.weaponCooldown >= SWORD_COOLDOWN) {
            handleSwordStrike(bot, roomState, io);
          }
          break;
        case 'GUN':
          if (now - bot.weaponCooldown >= GUN_COOLDOWN) {
            handleGunFire(bot, roomState, io);
          }
          break;
        case 'ROCKET':
          if (now - bot.weaponCooldown >= ROCKET_COOLDOWN) {
            handleRocketFire(bot, roomState, io);
          }
          break;
      }
    }
  }
}

// Auto-respawn dead bots (REMOVED - now handled inline in updateRoom)

// Release weapon (drop at position)
function releaseWeapon(player, roomState) {
  if (!player.weapon) return;
  
  const weaponState = roomState.weapons.get(player.weapon);
  if (weaponState && weaponState.owner === player.id) {
    // Drop weapon at player's head position
    const head = player.snake[0];
    weaponState.owner = null;
    weaponState.position = { x: head.x, y: head.y };
    console.log(`💥 Weapon dropped: ${player.weapon} at (${head.x}, ${head.y})`);
  }
  
  player.weapon = null;
  player.weaponCooldown = 0;
  player.ammo = 0;
}

// Check weapon pickup
function checkWeaponPickup(player, roomState) {
  const head = player.snake[0];
  
  for (const [weaponType, weaponState] of roomState.weapons) {
    // Weapon must be on ground (not owned) and at player's head position
    if (!weaponState.owner && weaponState.position &&
        weaponState.position.x === head.x && weaponState.position.y === head.y) {
      
      // Drop current weapon at RANDOM position if player has one
      if (player.weapon) {
        const oldWeapon = player.weapon;
        const oldWeaponState = roomState.weapons.get(oldWeapon);
        if (oldWeaponState && oldWeaponState.owner === player.id) {
          // Drop at random location instead of player position
          oldWeaponState.owner = null;
          oldWeaponState.position = randomPos();
          console.log(`🔄 Weapon swapped: ${oldWeapon} dropped at random location`);
        }
        player.weapon = null;
        player.ammo = 0;
      }
      
      // Pick up new weapon with full ammo
      player.weapon = weaponType;
      weaponState.owner = player.id;
      weaponState.position = null;
      
      // Set ammo based on weapon type
      if (weaponType === 'GUN') {
        player.ammo = GUN_MAX_AMMO;
      } else if (weaponType === 'ROCKET') {
        player.ammo = ROCKET_MAX_AMMO;
      } else {
        player.ammo = 0; // Sword has no ammo
      }
      
      console.log(`⚔️  Player ${player.name} picked up ${weaponType} (ammo: ${player.ammo})`);
      return true;
    }
  }
  return false;
}

// Get direction vector from direction string
function getDirVector(dir) {
  return DIRS[dir] || { x: 0, y: 0 };
}

// Cut snake at segment index (convert tail to food)
function cutSnake(player, cutIndex, roomState) {
  if (cutIndex < 0 || cutIndex >= player.snake.length) return;
  
  // Keep head to cutIndex
  const removedSegments = player.snake.slice(cutIndex + 1);
  player.snake = player.snake.slice(0, cutIndex + 1);
  
  // Convert removed segments to food orbs
  removedSegments.forEach(segment => {
    roomState.foodOrbs.push({
      x: segment.x,
      y: segment.y,
      value: 1
    });
  });
  
  // Reduce score
  player.score = Math.max(0, player.score - removedSegments.length);
  
  console.log(`✂️  Snake cut: ${player.name} lost ${removedSegments.length} segments`);
}

// Drop all snake segments as food orbs when snake dies
function dropAllSegmentsAsFoodOrbs(player, roomState) {
  if (!player.snake || player.snake.length === 0) return;
  
  // Convert all segments to food orbs (skip head to avoid clutter at death position)
  for (let i = 1; i < player.snake.length; i++) {
    const segment = player.snake[i];
    roomState.foodOrbs.push({
      x: segment.x,
      y: segment.y,
      value: 1
    });
  }
  
  console.log(`💀 ${player.name} dropped ${player.snake.length - 1} food orbs`);
}

// Sword strike
function handleSwordStrike(attacker, roomState, io) {
  const now = Date.now();
  if (now - attacker.weaponCooldown < SWORD_COOLDOWN) return;
  
  const attackerHead = attacker.snake[0];
  let closestEnemy = null;
  let closestSegmentIndex = -1;
  let closestDistance = Infinity;
  
  // Find closest enemy segment within range
  for (const [id, player] of roomState.players) {
    if (id === attacker.id || !player.alive) continue;
    
    player.snake.forEach((segment, index) => {
      const dist = Math.abs(segment.x - attackerHead.x) + Math.abs(segment.y - attackerHead.y);
      if (dist <= SWORD_RANGE && dist < closestDistance) {
        closestDistance = dist;
        closestEnemy = player;
        closestSegmentIndex = index;
      }
    });
  }
  
  if (closestEnemy && closestSegmentIndex >= 0) {
    cutSnake(closestEnemy, closestSegmentIndex, roomState);
    attacker.weaponCooldown = now;
    
    // Notify hit
    io.to(roomState.id).emit('weaponHit', {
      type: 'SWORD',
      attacker: attacker.id,
      victim: closestEnemy.id,
      position: closestEnemy.snake[closestSegmentIndex]
    });
  }
}

// Fire gun
function handleGunFire(attacker, roomState, io) {
  const now = Date.now();
  if (now - attacker.weaponCooldown < GUN_COOLDOWN) return;
  
  // Check ammo
  if (attacker.ammo <= 0) {
    console.log(`❌ Gun out of ammo: ${attacker.name}`);
    return;
  }
  
  const head = attacker.snake[0];
  const dirVec = getDirVector(attacker.dir);
  
  // Create bullet projectile - spawn from CENTER of head tile
  roomState.projectiles.push({
    id: roomState.nextProjectileId++,
    type: 'BULLET',
    x: head.x + 0.5 + dirVec.x * 0.5, // Center + half a tile in direction
    y: head.y + 0.5 + dirVec.y * 0.5,
    vx: dirVec.x * GUN_BULLET_SPEED,
    vy: dirVec.y * GUN_BULLET_SPEED,
    ownerId: attacker.id,
    distanceTraveled: 0
  });
  
  attacker.weaponCooldown = now;
  attacker.ammo--;
  console.log(`🔫 Gun fired by ${attacker.name} (${attacker.ammo} ammo left)`);
}

// Fire rocket
function handleRocketFire(attacker, roomState, io) {
  const now = Date.now();
  if (now - attacker.weaponCooldown < ROCKET_COOLDOWN) return;
  
  // Check ammo
  if (attacker.ammo <= 0) {
    console.log(`❌ Rocket out of ammo: ${attacker.name}`);
    return;
  }
  
  const head = attacker.snake[0];
  const dirVec = getDirVector(attacker.dir);
  
  // Create rocket projectile - spawn from CENTER of head tile
  roomState.projectiles.push({
    id: roomState.nextProjectileId++,
    type: 'ROCKET',
    x: head.x + 0.5 + dirVec.x * 0.5, // Center + half a tile in direction
    y: head.y + 0.5 + dirVec.y * 0.5,
    vx: dirVec.x * ROCKET_SPEED,
    vy: dirVec.y * ROCKET_SPEED,
    ownerId: attacker.id,
    distanceTraveled: 0
  });
  
  attacker.weaponCooldown = now;
  attacker.ammo--;
  console.log(`🚀 Rocket fired by ${attacker.name} (${attacker.ammo} ammo left)`);
}

// Update projectiles
function updateProjectiles(roomState, io) {
  const toRemove = [];
  
  roomState.projectiles.forEach((proj, index) => {
    // Move projectile
    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.distanceTraveled += Math.abs(proj.vx) + Math.abs(proj.vy);
    
    const gridX = Math.round(proj.x);
    const gridY = Math.round(proj.y);
    
    // Check bounds
    if (gridX < 0 || gridX >= MAP_WIDTH || gridY < 0 || gridY >= MAP_HEIGHT) {
      toRemove.push(index);
      return;
    }
    
    // Check max distance for bullets
    if (proj.type === 'BULLET' && proj.distanceTraveled > GUN_MAX_DISTANCE) {
      toRemove.push(index);
      return;
    }
    
    // Check collision with snakes
    for (const [id, player] of roomState.players) {
      if (id === proj.ownerId || !player.alive) continue;
      
      const hitIndex = player.snake.findIndex(seg => seg.x === gridX && seg.y === gridY);
      
      if (hitIndex >= 0) {
        if (proj.type === 'BULLET') {
          // Bullet: cut at hit segment
          cutSnake(player, hitIndex, roomState);
          toRemove.push(index);
          
          io.to(roomState.id).emit('weaponHit', {
            type: 'GUN',
            attacker: proj.ownerId,
            victim: id,
            position: { x: gridX, y: gridY }
          });
          return;
        } else if (proj.type === 'ROCKET') {
          // Rocket: explode
          handleExplosion(gridX, gridY, proj.ownerId, roomState, io);
          toRemove.push(index);
          return;
        }
      }
    }
  });
  
  // Remove dead projectiles (reverse order to maintain indices)
  toRemove.reverse().forEach(idx => roomState.projectiles.splice(idx, 1));
}

// Handle rocket explosion
function handleExplosion(centerX, centerY, attackerId, roomState, io) {
  console.log(`💥 Explosion at (${centerX}, ${centerY})`);
  
  // 5x5 area (radius 2)
  const affected = new Map(); // playerId -> closest segment index
  
  for (let dx = -ROCKET_EXPLOSION_RADIUS; dx <= ROCKET_EXPLOSION_RADIUS; dx++) {
    for (let dy = -ROCKET_EXPLOSION_RADIUS; dy <= ROCKET_EXPLOSION_RADIUS; dy++) {
      const x = centerX + dx;
      const y = centerY + dy;
      
      // Check each player's segments
      for (const [id, player] of roomState.players) {
        if (id === attackerId || !player.alive) continue;
        
        player.snake.forEach((segment, index) => {
          if (segment.x === x && segment.y === y) {
            const currentBest = affected.get(id);
            if (currentBest === undefined || index < currentBest) {
              affected.set(id, index);
            }
          }
        });
      }
      
      // Destroy food orbs in explosion
      roomState.foodOrbs = roomState.foodOrbs.filter(orb => {
        const inExplosion = orb.x === x && orb.y === y;
        return !inExplosion;
      });
    }
  }
  
  // Cut affected snakes
  affected.forEach((segmentIndex, playerId) => {
    const player = roomState.players.get(playerId);
    if (player) {
      cutSnake(player, segmentIndex, roomState);
    }
  });
  
  // Broadcast explosion
  io.to(roomState.id).emit('explosion', {
    x: centerX,
    y: centerY,
    radius: ROCKET_EXPLOSION_RADIUS,
    attacker: attackerId,
    victims: Array.from(affected.keys())
  });
}

// Find or create room with available capacity
function findOrCreateRoom() {
  // Find first room with available capacity
  for (const [roomId, room] of rooms) {
    if (room.players.size < MAX_PLAYERS_PER_ROOM) {
      return roomId;
    }
  }
  
  // Create new room
  const newRoomId = `snake-${nextRoomNumber++}`;
  const newRoom = createRoom(newRoomId);
  rooms.set(newRoomId, newRoom);
  return newRoomId;
}

// Add player to room
function addPlayerToRoom(socket, player, roomId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  room.players.set(socket.id, player);
  socket.join(roomId);
  socketToRoom.set(socket.id, roomId);
  
  console.log(`👤 Player joined: ${player.name} (${socket.id}) → ${roomId} [${room.players.size}/${MAX_PLAYERS_PER_ROOM}]`);
  return true;
}

// Remove player from room
function removePlayerFromRoom(socketId, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  const player = room.players.get(socketId);
  if (player) {
    room.players.delete(socketId);
    console.log(`👋 Player left: ${player.name} (${socketId}) → ${roomId} [${room.players.size}/${MAX_PLAYERS_PER_ROOM}]`);
  }
  
  socketToRoom.delete(socketId);
  
  // Delete empty rooms
  if (room.players.size === 0) {
    rooms.delete(roomId);
    console.log(`🗑️  Room deleted: ${roomId} (empty)`);
  }
}

// Update single room (game logic)
function updateRoom(roomState) {
  roomState.tick++;
  
  // Update bot AI inputs (every tick for responsiveness)
  updateBotInputs(roomState);
  
  // ALWAYS process direction changes (responsive input)
  for (const [_, player] of roomState.players) {
    if (!player.alive) continue;
    
    // Apply validated direction every tick for instant response
    if (player.nextDir && player.nextDir !== OPPOSITES[player.dir]) {
      player.dir = player.nextDir;
    }
  }
  
  // Only move snakes every N ticks (maintains original speed)
  const shouldMove = (roomState.tick % MOVE_EVERY_N_TICKS === 0);
  
  if (shouldMove) {
    // Move all snakes
    for (const [_, player] of roomState.players) {
      if (!player.alive) continue;
      
      // Calculate new head position
      const head = player.snake[0];
      const dir = DIRS[player.dir];
      const newHead = {
        x: head.x + dir.x,
        y: head.y + dir.y
      };
      
      // Check wall collision
      if (newHead.x < 0 || newHead.x >= MAP_WIDTH || 
          newHead.y < 0 || newHead.y >= MAP_HEIGHT) {
        dropAllSegmentsAsFoodOrbs(player, roomState);
        player.alive = false;
        continue;
      }
      
      // Check coin collision
      let ateFood = false;
      const coinIndex = roomState.coins.findIndex(coin => 
        coin.x === newHead.x && coin.y === newHead.y
      );
      
      if (coinIndex !== -1) {
        ateFood = true;
        roomState.coins.splice(coinIndex, 1);
        player.score++;
      }
      
      // Check food orb collision
      const orbIndex = roomState.foodOrbs.findIndex(orb =>
        orb.x === newHead.x && orb.y === newHead.y
      );
      
      if (orbIndex !== -1) {
        ateFood = true;
        const orb = roomState.foodOrbs.splice(orbIndex, 1)[0];
        player.score += orb.value;
      }
      
      // Move snake
      player.snake.unshift(newHead);
      if (!ateFood) {
        player.snake.pop();
      }
    }
    
    // Check weapon pickups (after movement)
    for (const [_, player] of roomState.players) {
      if (player.alive) {
        checkWeaponPickup(player, roomState);
      }
    }
  }
  
  // Update projectiles every tick (they're fast-moving)
  updateProjectiles(roomState, io);
  
  // Check collisions (only on movement ticks)
  if (shouldMove) {
    const alivePlayers = Array.from(roomState.players.values()).filter(p => p.alive);
    
    for (const player of alivePlayers) {
      const head = player.snake[0];
      
      // Check self collision
      for (let i = 1; i < player.snake.length; i++) {
        const segment = player.snake[i];
        if (head.x === segment.x && head.y === segment.y) {
          dropAllSegmentsAsFoodOrbs(player, roomState);
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
          dropAllSegmentsAsFoodOrbs(player, roomState);
          dropAllSegmentsAsFoodOrbs(other, roomState);
          player.alive = false;
          other.alive = false;
          break;
        }
        
        // Check head-to-body collision
        for (const segment of other.snake) {
          if (head.x === segment.x && head.y === segment.y) {
            dropAllSegmentsAsFoodOrbs(player, roomState);
            player.alive = false;
            break;
          }
        }
        
        if (!player.alive) break;
      }
    }
  }
  
  // Notify dead players and release weapons (only on movement ticks)
  if (shouldMove) {
    for (const [id, player] of roomState.players) {
      if (!player.alive && !player.waitingToRespawn) {
        player.waitingToRespawn = true;
        
        // Release weapon at death position
        if (player.weapon) {
          releaseWeapon(player, roomState);
        }
        
        // Only show death screen to human players, not bots
        if (!player.isBot) {
          io.to(id).emit('death', { 
            message: 'You died!',
            score: player.score,
            length: player.snake.length
          });
        } else {
          // Bots respawn immediately on next tick
          console.log(`🤖 Bot died: ${player.name}, will respawn`);
        }
      }
    }
    
    // Auto-respawn bots immediately (don't wait for death screen)
    for (const botId of roomState.bots) {
      const bot = roomState.players.get(botId);
      if (!bot) {
        console.error(`❌ Bot ${botId} not found in room ${roomState.id}!`);
        continue;
      }
      
      if (!bot.alive && bot.waitingToRespawn) {
        try {
          respawnPlayer(bot, roomState);
          console.log(`🤖 Bot respawned: ${bot.name} (alive=${bot.alive}, snake length=${bot.snake.length})`);
        } catch (error) {
          console.error(`❌ Failed to respawn bot ${bot.name}:`, error);
        }
      }
    }
    
    // Maintain coins
    maintainCoins(roomState);
  }
}

// Broadcast room snapshot
function broadcastRoom(roomState, roomId) {
  const snapshot = {
    tick: roomState.tick,
    players: Array.from(roomState.players.values())
      .filter(p => p.alive)
      .map(p => ({
        id: p.id,
        name: p.name,
        snake: p.snake,
        score: p.score,
        weapon: p.weapon,
        ammo: p.ammo
      })),
    coins: roomState.coins,
    foodOrbs: roomState.foodOrbs,
    weapons: Array.from(roomState.weapons.entries()).map(([type, state]) => ({
      type,
      owner: state.owner,
      position: state.position
    })),
    projectiles: roomState.projectiles.map(p => ({
      id: p.id,
      type: p.type,
      x: p.x,
      y: p.y
    }))
  };
  
  io.to(roomId).emit('snapshot', snapshot);
}

// Global game tick - updates ALL rooms
function globalGameTick() {
  for (const [roomId, roomState] of rooms) {
    updateRoom(roomState);
    
    // Broadcast snapshots at reduced rate (every N ticks)
    if (roomState.tick % SNAPSHOT_EVERY_N_TICKS === 0) {
      broadcastRoom(roomState, roomId);
    }
  }
}

// Setup Socket.io server
const io = new Server(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

console.log(`🐍 Snake Multiplayer Server running on port ${PORT}`);
console.log(`📊 Configuration:`);
console.log(`   - Map size: ${MAP_WIDTH}x${MAP_HEIGHT}`);
console.log(`   - Max players per room: ${MAX_PLAYERS_PER_ROOM}`);
console.log(`   - Tick rate: ${TICK_RATE} ticks/second`);
console.log(`   - Dynamic rooms: Enabled (snake-1, snake-2, ...)`);

io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);
  
  socket.on('join', (data) => {
    // Find or create room with capacity
    const roomId = findOrCreateRoom();
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Failed to join room' });
      return;
    }
    
    // Create player
    const spawnPos = findSpawnPosition(room);
    const player = createPlayer(socket.id, data.name, spawnPos);
    player.snake = spawnSnake(spawnPos);
    
    // Add player to room
    addPlayerToRoom(socket, player, roomId);
    
    // Send initial state
    socket.emit('joined', {
      id: socket.id,
      roomId: roomId,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT
    });
  });
  
  socket.on('input', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    // Rate limiting
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
  
  socket.on('respawn', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    if (player.waitingToRespawn) {
      respawnPlayer(player, room);
      player.waitingToRespawn = false;
      socket.emit('respawned', {
        id: socket.id
      });
    }
  });
  
  socket.on('weaponAction', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player || !player.alive || !player.weapon) return;
    
    // Handle weapon action based on type
    switch (player.weapon) {
      case 'SWORD':
        handleSwordStrike(player, room, io);
        break;
      case 'GUN':
        handleGunFire(player, room, io);
        break;
      case 'ROCKET':
        handleRocketFire(player, room, io);
        break;
    }
  });
  
  socket.on('disconnect', () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      removePlayerFromRoom(socket.id, roomId);
    }
  });
});

// Start global game loop (updates all rooms)
setInterval(globalGameTick, TICK_INTERVAL);

console.log(`🎮 Global game loop started!`);
