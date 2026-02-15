# Bot Disappearing Fix

## Problem
Bots were sometimes disappearing from the game view, making it seem like they died in ways different from human players.

## Root Cause
The issue was NOT that bots were dying incorrectly. Bots were dying from the same collisions as human players (walls, self-collision, other snakes). However, there was a timing issue in the respawn logic:

1. **Death notification** happened on movement ticks
2. **Bot respawn** happened in a separate function (`updateBotRespawns`) also on movement ticks
3. **Between these two events**, bots would be marked as `!alive` and `waitingToRespawn = true`
4. **The snapshot broadcast** filtered out dead players (`.filter(p => p.alive)`)
5. This meant bots would **disappear from view** for 1-2 ticks while waiting to respawn

## Solution
Consolidated the bot respawn logic directly into the death notification block:

1. When a player dies:
   - If it's a **human player**: emit death screen, set `waitingToRespawn = true`
   - If it's a **bot**: just log the death and set `waitingToRespawn = true`

2. Immediately after death notification (same movement tick):
   - Check all bots that are `!alive` and `waitingToRespawn`
   - Call `respawnPlayer()` immediately
   - Bot respawns in the same tick it died

3. Removed the separate `updateBotRespawns()` function to prevent race conditions

## Result
- Bots now respawn **instantly** (within the same movement tick)
- Bots are never filtered out of snapshots due to being dead
- Bots and human players have **identical death conditions** (walls, self-collision, snake collision)
- Bots simply respawn faster (no death screen delay)

## Key Code Changes

### `server/index.js` - Death notification and bot respawn (lines ~1037-1062):
```javascript
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
    if (bot && !bot.alive && bot.waitingToRespawn) {
      respawnPlayer(bot, roomState);
      console.log(`🤖 Bot respawned: ${bot.name}`);
    }
  }
  
  // Maintain coins
  maintainCoins(roomState);
}
```

### Additional safeguards:
- `isSafe()` function now explicitly only checks **alive** snakes
- `updateBotInputs()` skips bots that are not alive
- All collision checks work the same for bots and humans

## Testing
1. Start server: `npm start` (in `/server` folder)
2. Open client in browser
3. Join the game - you should see 4 bots spawn
4. Watch bots move - they should:
   - Avoid walls and snakes most of the time
   - Die when they crash (just like human players)
   - Respawn immediately at a new location
   - **Never disappear** from the game view

## Verification
Look for these console logs on the server:
- `🤖 Bot died: [name], will respawn` - when a bot crashes
- `🤖 Bot respawned: [name]` - immediately after death

Bots should maintain a consistent count of 4 throughout the game.
