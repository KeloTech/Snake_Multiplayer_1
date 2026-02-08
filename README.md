# 🐍 Snake Multiplayer

A server-authoritative multiplayer Snake game with classic grid-based gameplay. Up to 10 players can play simultaneously on the same server.

## Features

- **Classic Grid Snake**: Tile-based movement, not slither-style
- **Multiplayer**: Up to 10 players per room
- **Server-Authoritative**: Prevents cheating, server controls all game logic
- **Large Map**: 120x120 tiles with camera following your snake
- **Smart Spawning**: New snakes spawn away from other players
- **30 Coins**: Always maintained across the map
- **Real-time**: 12 ticks per second for smooth gameplay

## Quick Start

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Start the Server

```bash
npm start
```

Server will run on port **3001** by default.

### 3. Open the Client

Open `client/index.html` in your web browser, or use a static server:

**Option A: Using Python**
```bash
cd client
python -m http.server 8000
```
Then open: `http://localhost:8000`

**Option B: Using Node.js (http-server)**
```bash
npx http-server client -p 8000
```
Then open: `http://localhost:8000`

**Option C: VS Code Live Server**
- Install "Live Server" extension
- Right-click on `client/index.html`
- Click "Open with Live Server"

### 4. Play!

1. Enter your nickname
2. Click "Join Game"
3. Use **Arrow Keys** or **WASD** to move
4. Eat coins (yellow circles) to grow
5. Avoid walls and other snakes

## Playing on LAN (Multiple Computers)

### Server Setup

1. Find your server computer's local IP address:
   - **Windows**: Open Command Prompt and run `ipconfig`, look for "IPv4 Address" (e.g., `192.168.1.100`)
   - **Mac/Linux**: Run `ifconfig` or `ip addr`, look for your local network IP

2. Start the server as usual:
   ```bash
   cd server
   npm start
   ```

3. Make sure your firewall allows incoming connections on port 3001

### Client Setup (Other Computers)

1. Open `client/index.html` in a web browser
2. In the "Server URL" field at the bottom, enter: `ws://SERVER_IP:3001`
   - Replace `SERVER_IP` with the server's local IP (e.g., `ws://192.168.1.100:3001`)
3. Enter nickname and join!

## Configuration

### Server Settings (`server/index.js`)

```javascript
const PORT = 3001;              // Server port
const TICK_RATE = 12;           // Ticks per second
const MAP_WIDTH = 120;          // Map width in tiles
const MAP_HEIGHT = 120;         // Map height in tiles
const MAX_PLAYERS = 10;         // Maximum players per room
const COIN_TARGET = 30;         // Number of coins to maintain
const MIN_SPAWN_DISTANCE = 15;  // Minimum distance between spawns
```

### Client Settings (`client/main.js`)

```javascript
const TILE_SIZE = 16;                    // Size of each tile in pixels
const LOCAL_SNAKE_COLOR = '#4ecca3';     // Your snake color
const OTHER_SNAKE_COLOR = '#ee6c4d';     // Other snakes color
const COIN_COLOR = '#ffd93d';            // Coin color
```

## Deployment

### Server Deployment (Render, Fly.io, etc.)

1. Push code to a Git repository
2. Deploy the `server` folder to your hosting service
3. Set environment variable: `PORT` (many hosts set this automatically)
4. The server will listen on the provided port

### Client Deployment (Netlify, Vercel, etc.)

1. Deploy the `client` folder as a static site
2. Before deploying, update the default server URL in `client/index.html`:
   ```html
   <input type="text" id="serverUrl" value="wss://your-server.com" placeholder="ws://localhost:3001">
   ```
   Note: Use `wss://` (secure WebSocket) for production HTTPS sites

## Game Rules

- **Movement**: Cannot reverse direction directly (no instant 180° turns)
- **Growth**: Eating a coin adds one segment to your snake
- **Collisions**:
  - Wall collision → respawn
  - Hit another snake's body → respawn
  - Head-to-head collision → both respawn
  - Self-collision → respawn
- **Scoring**: Score = number of coins eaten

## Technical Architecture

### Server
- **Node.js** with **Socket.io** for WebSocket communication
- Fixed timestep game loop at 12 ticks/second
- Server-authoritative: clients send only input, server computes everything
- Collision detection, snake movement, coin spawning all server-side

### Client
- Vanilla JavaScript with HTML5 Canvas
- Camera system that follows local player
- Real-time rendering at 60 FPS
- Minimal prediction (displays last received server state)

### Network Protocol

**Client → Server**
- `join`: `{name: string}` - Join the game
- `input`: `{dir: 'UP'|'DOWN'|'LEFT'|'RIGHT', clientTime: number}` - Send direction input

**Server → Client**
- `joined`: `{id: string, mapWidth: number, mapHeight: number}` - Join confirmation
- `snapshot`: `{tick: number, players: Array, coins: Array}` - Game state update
- `error`: `{message: string}` - Error message (e.g., room full)

## Troubleshooting

### "Connection failed"
- Make sure the server is running
- Check the server URL in the client
- Verify firewall settings

### "Room is full"
- Maximum 10 players per server
- Wait for a player to leave or start another server instance

### Camera/Rendering Issues
- Try refreshing the page
- Check browser console for errors
- Make sure canvas is visible (press F12 to check)

### Lag/Stuttering
- Check your network connection
- Server tick rate can be adjusted in `server/index.js`
- Close other bandwidth-heavy applications

## Development

### Project Structure
```
Snake Multiplayer/
├── server/
│   ├── package.json
│   └── index.js          # Server logic
├── client/
│   ├── index.html        # HTML structure
│   ├── styles.css        # Styles
│   └── main.js           # Client game logic
└── README.md
```

### Adding Features

**Example: Change snake speed**
- Edit `TICK_RATE` in `server/index.js` (higher = faster)

**Example: Larger map**
- Edit `MAP_WIDTH` and `MAP_HEIGHT` in `server/index.js`

**Example: More coins**
- Edit `COIN_TARGET` in `server/index.js`

**Example: Different colors**
- Edit color constants in `client/main.js`

## License

Free to use and modify. Have fun! 🎮
