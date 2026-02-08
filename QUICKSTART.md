# 🐍 QUICK START GUIDE

## You're all set! Here's how to play:

### Step 1: Server is Running ✅
The server is already running on **port 3001**. You should see:
```
🐍 Snake Multiplayer Server running on port 3001
Game loop running at 12 ticks/second
Map size: 120x120
Max players: 10
```

### Step 2: Open the Game
You have several options:

#### Option A: Direct File (Simplest)
1. Navigate to the `client` folder
2. Double-click `index.html` to open it in your default browser
3. Change the Server URL to: `ws://localhost:3001`
4. Enter your nickname and click "Join Game"

#### Option B: Using Python (Recommended)
```bash
cd client
python -m http.server 8000
```
Then open: http://localhost:8000

#### Option C: Using VS Code Live Server
1. Install "Live Server" extension in VS Code
2. Right-click on `client/index.html`
3. Click "Open with Live Server"

### Step 3: Play!
- Use **Arrow Keys** or **WASD** to move
- Eat yellow coins to grow
- Avoid walls and other snakes
- Your snake is **green**, others are **orange**

---

## 🌐 Play with Friends (LAN)

### On the Server Computer:
1. Find your local IP address:
   - **Windows**: Run `ipconfig` in Command Prompt
   - Look for "IPv4 Address" (e.g., 192.168.1.100)

2. Server is already running on port 3001

### On Other Computers:
1. Open `client/index.html` in a browser
2. Change Server URL to: `ws://SERVER_IP:3001`
   - Example: `ws://192.168.1.100:3001`
3. Enter nickname and join!

---

## 🎮 Game Controls
- **Arrow Keys** or **WASD** - Move snake
- Camera automatically follows your snake
- Scoreboard shows all players (top-left)

## 📊 Game Stats
- Map Size: 120x120 tiles (large map!)
- Coins: 30 coins always available
- Tick Rate: 12 updates per second
- Max Players: 10 per room

---

## ⚙️ Restart Server (if needed)
If you need to restart the server:
```bash
cd server
npm start
```

## 🎯 Checklist - All Features Working:
✅ Server-authoritative gameplay (no cheating possible)
✅ Up to 10 players simultaneously
✅ 30 coins spawning across the map
✅ Smart spawn system (players spawn away from each other)
✅ Large 120x120 map with camera following player
✅ Collision detection (walls, snakes, self)
✅ Respawning on collision
✅ Real-time scoreboard
✅ LAN multiplayer ready
✅ Easy to deploy (static client + Node server)

---

## 🚀 Deployment (Production)

### Deploy Server (Render, Fly.io, Railway, etc.)
1. Push this repo to GitHub
2. Create a new web service
3. Set root directory to `server`
4. Build command: `npm install`
5. Start command: `npm start`
6. The PORT environment variable will be set automatically

### Deploy Client (Netlify, Vercel, GitHub Pages)
1. Deploy the `client` folder
2. Before deploying, update the default server URL in `client/index.html` line 44:
   ```html
   <input type="text" id="serverUrl" value="wss://your-server.com">
   ```
   ⚠️ Use `wss://` (secure WebSocket) for HTTPS sites

---

## 🐛 Troubleshooting

**"Connection failed"**
- Make sure server is running
- Check the server URL matches
- Try `ws://localhost:3001` for local testing

**"Room is full"**
- Max 10 players per server
- Start another server instance or wait for someone to leave

**Lag/Stuttering**
- Check network connection
- Try reducing number of players
- Adjust TICK_RATE in server/index.js (lower = less network traffic)

---

## 🎨 Customization

Edit `server/index.js` to change:
- Map size (MAP_WIDTH, MAP_HEIGHT)
- Number of coins (COIN_TARGET)
- Game speed (TICK_RATE)
- Player limit (MAX_PLAYERS)
- Spawn distance (MIN_SPAWN_DISTANCE)

Edit `client/main.js` to change:
- Colors (snake, coins, grid)
- Tile size (TILE_SIZE)
- Visual effects

---

Enjoy your multiplayer Snake game! 🐍✨
