# 🧪 Dynamic Rooms Testing Guide

## What Changed

The server now supports **dynamic rooms** with automatic room creation and management:

- **MAX_PLAYERS_PER_ROOM**: 15 players per room
- **Room naming**: `snake-1`, `snake-2`, `snake-3`, etc.
- **Auto-assignment**: Players automatically join the first available room
- **Room creation**: New rooms created on demand when existing rooms are full
- **Room cleanup**: Empty rooms are automatically deleted
- **Isolated gameplay**: Players only see other players in their room

## Testing Checklist

### ✅ Test 1: Basic Room Assignment
**Goal**: Verify players are assigned to `snake-1` initially

1. Open the client in your browser
2. Join with nickname "Player1"
3. Check browser console - should see: `🎮 Joined room: snake-1`
4. Check server logs - should see:
   ```
   ✨ Room created: snake-1
   👤 Player joined: Player1 (socket-id) → snake-1 [1/15]
   ```

**Expected**: First player creates and joins `snake-1`

---

### ✅ Test 2: Multiple Players in Same Room
**Goal**: Verify multiple players join the same room

1. Keep Player1 tab open
2. Open 5 more browser tabs
3. Join with nicknames: Player2, Player3, Player4, Player5, Player6
4. Check each browser console - all should show: `🎮 Joined room: snake-1`
5. Check server logs - should see player count increasing:
   ```
   👤 Player joined: Player2 (socket-id) → snake-1 [2/15]
   👤 Player joined: Player3 (socket-id) → snake-1 [3/15]
   ...
   👤 Player joined: Player6 (socket-id) → snake-1 [6/15]
   ```

**Expected**: All 6 players in `snake-1`, can see each other's snakes

---

### ✅ Test 3: Room Capacity & New Room Creation
**Goal**: Verify new room created when `snake-1` reaches 15 players

1. Open 15 browser tabs total
2. Join all with different nicknames (Player1-Player15)
3. Verify all join `snake-1` (check server logs)
4. Open a 16th browser tab
5. Join with nickname "Player16"
6. Check browser console - should see: `🎮 Joined room: snake-2`
7. Check server logs - should see:
   ```
   ✨ Room created: snake-2
   👤 Player joined: Player16 (socket-id) → snake-2 [1/15]
   ```

**Expected**: 
- First 15 players → `snake-1`
- 16th player → `snake-2` (new room)

---

### ✅ Test 4: Room Isolation (No Cross-Room Visibility)
**Goal**: Verify players in different rooms don't see each other

1. Have Player1 in `snake-1` and Player16 in `snake-2`
2. In Player1's tab (snake-1):
   - Check scoreboard - should only show players 1-15
   - Check game canvas - should only see snakes from snake-1
3. In Player16's tab (snake-2):
   - Check scoreboard - should only show Player16
   - Check game canvas - should only see their own snake

**Expected**: Complete isolation between rooms

---

### ✅ Test 5: Room Deletion on Disconnect
**Goal**: Verify empty rooms are deleted

**Setup**: Have Player16 alone in `snake-2`

1. Close Player16's browser tab (or click "Back to Menu")
2. Check server logs - should see:
   ```
   👋 Player left: Player16 (socket-id) → snake-2 [0/15]
   🗑️  Room deleted: snake-2 (empty)
   ```

**Expected**: `snake-2` deleted immediately when last player leaves

---

### ✅ Test 6: Partial Room Cleanup
**Goal**: Verify room persists with remaining players

**Setup**: Have 5 players in `snake-1`

1. Close 3 players' tabs
2. Check server logs - should see players leaving:
   ```
   👋 Player left: Player3 (socket-id) → snake-1 [4/15]
   👋 Player left: Player4 (socket-id) → snake-1 [3/15]
   👋 Player left: Player5 (socket-id) → snake-1 [2/15]
   ```
3. Verify NO room deletion message (room still has 2 players)
4. In remaining tabs, verify game continues normally

**Expected**: Room stays active with 2 players, no deletion

---

### ✅ Test 7: Room Refill After Cleanup
**Goal**: Verify `snake-1` accepts new players after some leave

**Setup**: `snake-1` has 10 players

1. Close 3 players' tabs (now 7 players in snake-1)
2. Open a new browser tab
3. Join with a new nickname
4. Check browser console - should see: `🎮 Joined room: snake-1`
5. Check server logs - should see player count:
   ```
   👤 Player joined: NewPlayer (socket-id) → snake-1 [8/15]
   ```

**Expected**: New player fills available spot in `snake-1`

---

### ✅ Test 8: Multiple Rooms Active Simultaneously
**Goal**: Verify multiple rooms run independently

1. Fill `snake-1` with 15 players
2. Create `snake-2` with 10 players
3. Create `snake-3` with 5 players
4. Check server logs - should show all 3 rooms active
5. Play in different rooms simultaneously:
   - Move snakes in each room
   - Eat coins in each room
   - Verify each room updates independently
6. Check browser consoles - each shows only their room's players

**Expected**: All 3 rooms active, isolated, updating independently

---

### ✅ Test 9: Cascade Room Deletion
**Goal**: Verify multiple empty rooms are deleted

**Setup**: Have `snake-1`, `snake-2`, `snake-3` active

1. Close all tabs in `snake-3`
2. Check server logs - should see `snake-3` deleted
3. Close all tabs in `snake-2`
4. Check server logs - should see `snake-2` deleted
5. Close all tabs in `snake-1`
6. Check server logs - should see `snake-1` deleted
7. Open a new tab and join
8. Check console - should see: `🎮 Joined room: snake-1` (new room, number reused)

**Expected**: Empty rooms deleted, room numbers can be reused

---

### ✅ Test 10: Death/Respawn in Rooms
**Goal**: Verify death screen works within rooms

1. Join `snake-1` with 3 players
2. Make Player1 die (hit wall/snake)
3. Verify death screen appears for Player1
4. Verify Player1's snake disappears from other players' views
5. Click "Respawn" on Player1
6. Verify Player1 respawns in the same room (`snake-1`)
7. Verify other players can now see Player1's snake again

**Expected**: Death/respawn works correctly within room context

---

## Server Logs to Watch For

### Good Logs ✅
```
✨ Room created: snake-1
👤 Player joined: Alice (abc123) → snake-1 [1/15]
👤 Player joined: Bob (def456) → snake-1 [2/15]
✨ Room created: snake-2
👤 Player joined: Charlie (ghi789) → snake-2 [1/15]
👋 Player left: Alice (abc123) → snake-1 [1/15]
🗑️  Room deleted: snake-2 (empty)
```

### Bad Logs ⚠️
- `Failed to join room` - Room creation failed
- Players seeing snakes from other rooms - Cross-room visibility bug
- Room not deleted when empty - Memory leak
- Player count wrong - State sync issue

---

## Console Commands for Debugging

Open browser console and check:

```javascript
// See which room you're in (after joining)
// Look for log: 🎮 Joined room: snake-X

// See current game state
console.log(gameState);

// See local player ID
console.log(localPlayerId);

// See all players in your view
console.log(gameState.players);
```

---

## Quick Test Script

For automated testing, open 20 tabs sequentially and verify:

1. Tabs 1-15 → All join `snake-1`
2. Tab 16 → Creates and joins `snake-2`
3. Tabs 17-20 → Join `snake-2`
4. Close tabs 1-15 → `snake-1` deleted
5. Close tabs 16-19 → `snake-2` still active (1 player)
6. Close tab 20 → `snake-2` deleted

---

## Expected Server Capacity

- **15 players/room** × **N rooms** = Unlimited players (memory permitting)
- Each room runs independently
- Only active rooms are updated each tick
- Empty rooms are cleaned up immediately

---

## Troubleshooting

### Issue: Players see snakes from other rooms
**Cause**: Snapshot broadcast not room-scoped
**Fix**: Check `broadcastRoom()` uses `io.to(roomId).emit()`

### Issue: Room not deleted when empty
**Cause**: `removePlayerFromRoom()` not checking room size
**Fix**: Verify `room.players.size === 0` triggers deletion

### Issue: New players can't join full room
**Cause**: `findOrCreateRoom()` not creating new room
**Fix**: Verify room creation when all rooms full

### Issue: Cross-room input interference
**Cause**: Input handler not checking room ID
**Fix**: Verify `socketToRoom.get()` in input handler

---

## Performance Testing

Test server performance with many rooms:

1. Create 10 rooms (150 players total)
2. Monitor server CPU/memory
3. Check tick rate consistency (should stay at 12 tps)
4. Verify no lag in any room
5. Check network bandwidth (snapshot size × rooms)

**Expected**: Server handles 10+ rooms smoothly at 12 ticks/second

---

## Success Criteria

✅ Rooms created on demand
✅ Players auto-assigned to available rooms
✅ Room capacity enforced (15 players max)
✅ Complete isolation between rooms
✅ Empty rooms deleted automatically
✅ Multiple rooms run simultaneously
✅ No cross-room visibility
✅ Death/respawn works within rooms
✅ Server performance stable with multiple rooms

---

Happy Testing! 🎮🐍
