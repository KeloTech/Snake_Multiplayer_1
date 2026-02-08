# 🎮 Snake Multiplayer - Configuration Guide

## Server Configuration (server/index.js)

### Game Settings
```javascript
// Line 4-10 in server/index.js
const PORT = process.env.PORT || 3001;  // Server port
const TICK_RATE = 12;                   // Game updates per second (6-20 recommended)
const MAP_WIDTH = 120;                  // Map width in tiles (60-200)
const MAP_HEIGHT = 120;                 // Map height in tiles (60-200)
const MAX_PLAYERS = 10;                 // Maximum players (1-50)
const COIN_TARGET = 30;                 // Number of coins (10-100)
const MIN_SPAWN_DISTANCE = 15;          // Min spawn separation in tiles (10-30)
const INITIAL_SNAKE_LENGTH = 3;         // Starting snake length (3-10)
```

### Recommended Presets

#### Fast & Chaotic (Small Map)
```javascript
const MAP_WIDTH = 60;
const MAP_HEIGHT = 60;
const TICK_RATE = 15;
const COIN_TARGET = 20;
const MIN_SPAWN_DISTANCE = 10;
```

#### Standard (Current)
```javascript
const MAP_WIDTH = 120;
const MAP_HEIGHT = 120;
const TICK_RATE = 12;
const COIN_TARGET = 30;
const MIN_SPAWN_DISTANCE = 15;
```

#### Epic Battle (Large Map)
```javascript
const MAP_WIDTH = 200;
const MAP_HEIGHT = 200;
const TICK_RATE = 10;
const COIN_TARGET = 50;
const MIN_SPAWN_DISTANCE = 25;
```

---

## Client Configuration (client/main.js)

### Visual Settings
```javascript
// Line 2-7 in client/main.js
const TILE_SIZE = 16;                   // Tile size in pixels (12-24)
const GRID_COLOR = '#1a2840';           // Grid line color
const COIN_COLOR = '#ffd93d';           // Coin color (yellow)
const LOCAL_SNAKE_COLOR = '#4ecca3';    // Your snake (green)
const OTHER_SNAKE_COLOR = '#ee6c4d';    // Other snakes (orange)
const SNAKE_OUTLINE_COLOR = '#16213e';  // Snake border (dark blue)
```

### Color Themes

#### Neon Theme
```javascript
const GRID_COLOR = '#1a1a1a';
const COIN_COLOR = '#00ff00';
const LOCAL_SNAKE_COLOR = '#00ffff';
const OTHER_SNAKE_COLOR = '#ff00ff';
const SNAKE_OUTLINE_COLOR = '#000000';
```

#### Pastel Theme
```javascript
const GRID_COLOR = '#e8e8e8';
const COIN_COLOR = '#ffd700';
const LOCAL_SNAKE_COLOR = '#90ee90';
const OTHER_SNAKE_COLOR = '#ffb6c1';
const SNAKE_OUTLINE_COLOR = '#696969';
```

#### Dark Theme (Current)
```javascript
const GRID_COLOR = '#1a2840';
const COIN_COLOR = '#ffd93d';
const LOCAL_SNAKE_COLOR = '#4ecca3';
const OTHER_SNAKE_COLOR = '#ee6c4d';
const SNAKE_OUTLINE_COLOR = '#16213e';
```

---

## Network Configuration

### Default Server URL (client/index.html)
```html
<!-- Line 44 in client/index.html -->
<input type="text" id="serverUrl" value="ws://localhost:3001">
```

### For Production Deployment
```html
<!-- Use wss:// for HTTPS sites -->
<input type="text" id="serverUrl" value="wss://your-server.com">
```

### For LAN Testing
```html
<!-- Use your server's local IP -->
<input type="text" id="serverUrl" value="ws://192.168.1.100:3001">
```

---

## Performance Tuning

### For Low Latency Networks
- Increase TICK_RATE to 15-20
- Smaller MAP_WIDTH/HEIGHT (60-80)
- Reduce COIN_TARGET to 15-20

### For High Latency Networks
- Decrease TICK_RATE to 8-10
- Larger MAP_WIDTH/HEIGHT (150-200)
- Increase COIN_TARGET to 40-50

### For Many Players (20+)
- Increase MAX_PLAYERS to 20+
- Larger map (200x200)
- More coins (50-80)
- Higher MIN_SPAWN_DISTANCE (20-30)

---

## Gameplay Modifications

### Faster Snake
Increase TICK_RATE in server/index.js:
```javascript
const TICK_RATE = 18; // Very fast
```

### Slower Snake
Decrease TICK_RATE:
```javascript
const TICK_RATE = 8; // Slower, strategic
```

### More Coins (Easier to Grow)
```javascript
const COIN_TARGET = 50;
```

### Fewer Coins (Harder to Grow)
```javascript
const COIN_TARGET = 15;
```

### Longer Starting Snake
```javascript
const INITIAL_SNAKE_LENGTH = 5;
```

### Enable Wrapping (No Wall Death)
In server/index.js, replace the wall collision check (lines ~167-172):
```javascript
// Current (respawn on wall hit):
if (newHead.x < 0 || newHead.x >= MAP_WIDTH || 
    newHead.y < 0 || newHead.y >= MAP_HEIGHT) {
  player.alive = false;
  continue;
}

// Change to (wrap around):
newHead.x = (newHead.x + MAP_WIDTH) % MAP_WIDTH;
newHead.y = (newHead.y + MAP_HEIGHT) % MAP_HEIGHT;
```

---

## Advanced Customization

### Change Scoreboard Position (client/main.js)
Edit CSS in styles.css (line 127-135):
```css
.scoreboard {
  position: fixed;
  top: 20px;      /* Change to bottom: 20px for bottom-left */
  left: 20px;     /* Change to right: 20px for right side */
  /* ... */
}
```

### Add Sound Effects
Add to client/main.js in the appropriate functions:
```javascript
// After coin eaten
const eatSound = new Audio('coin.mp3');
eatSound.play();

// After respawn
const deathSound = new Audio('death.mp3');
deathSound.play();
```

### Change Tile Size for Mobile
In client/main.js:
```javascript
const TILE_SIZE = 12; // Smaller tiles = more visible area on small screens
```

---

## Environment Variables

### Server (Production)
Set these in your hosting platform:
```
PORT=3001          # Server port (usually set automatically)
NODE_ENV=production
```

### Server (Development)
Create a `.env` file in server folder:
```
PORT=3001
```

Then modify server/index.js to use dotenv:
```javascript
require('dotenv').config();
const PORT = process.env.PORT || 3001;
```

---

## Testing Configurations

### Single Player Testing
```javascript
const MAX_PLAYERS = 1;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;
const TICK_RATE = 10;
```

### Stress Test (Many Players)
```javascript
const MAX_PLAYERS = 50;
const MAP_WIDTH = 300;
const MAP_HEIGHT = 300;
const COIN_TARGET = 100;
```

---

## Troubleshooting Performance

### Server CPU Usage Too High
- Decrease TICK_RATE (8-10)
- Reduce MAX_PLAYERS (5-8)
- Smaller map size

### Client Rendering Slow
- Decrease TILE_SIZE (12-14)
- Reduce visible grid area
- Simplify snake drawing (remove eyes)

### Network Lag
- Decrease TICK_RATE (8-10)
- Compress snapshot data (use shorter property names)
- Implement dead reckoning/interpolation

---

## After Configuration Changes

1. **Server Changes**: Restart the server
   ```bash
   cd server
   npm start
   ```

2. **Client Changes**: Refresh browser (Ctrl+R or Cmd+R)

3. **Both**: Close all clients, restart server, reload clients

---

## Need Help?

Check the README.md for full documentation or QUICKSTART.md for setup instructions.
