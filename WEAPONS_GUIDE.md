# ⚔️🔫🚀 Weapons System Guide

## Overview

The game now features a **slither.io-style weapon system** with 3 unique weapons that **cut** snakes instead of killing them. This creates dynamic gameplay where snakes lose segments and the removed parts become collectible food.

---

## 🎮 Core Mechanics

### Cutting (Not Killing!)
- **Snakes DON'T DIE from weapons** - they get **cut**
- When hit at segment index `i`:
  - Snake keeps segments `0` to `i` (head to hit point)
  - Segments `i+1` to end are removed
  - Removed segments instantly turn into **food orbs** at their positions
- Victim's length and score reduced proportionally
- Victims can collect the food orbs to regrow

### Weapon Uniqueness
- **Only 3 weapons total** in each room
- Each weapon can be owned by **at most 1 player** at a time
- Max 3 players can have weapons simultaneously
- Weapons spawn as pickups on the map
- When weapon-holder dies, weapon drops at death location

---

## ⚔️ Weapons

### 1. SWORD (Melee)
**Icon:** ⚔️  
**Color:** Silver  

**Mechanics:**
- **Range:** 1 grid tile from attacker's head
- **Action:** Press SPACE or CLICK to strike
- **Effect:** Cuts the **nearest enemy segment** within range
- **Cooldown:** 1 second

**Strategy:**
- Ambush enemies by getting close
- Quick strikes in crowded areas
- Low risk, low reward

**How it Works:**
1. Press attack when enemy nearby
2. Server finds closest enemy segment ≤ 1 tile away
3. Enemy cut at that segment
4. Removed tail → food orbs

---

### 2. GUN (Ranged)
**Icon:** 🔫  
**Color:** Blue  

**Mechanics:**
- **Range:** 30 tiles max
- **Speed:** 2 tiles per tick (fast bullet)
- **Action:** Press SPACE or CLICK to fire
- **Effect:** Cuts at **exact hit segment**
- **Cooldown:** 0.5 seconds

**Strategy:**
- Snipe from distance
- Cut long snakes to steal their food
- Predict enemy movement
- Can spam shots with short cooldown

**How it Works:**
1. Bullet fires in snake's facing direction
2. Travels in straight line until hit or max range
3. First snake segment hit = cut point
4. Removed tail → food orbs

---

### 3. ROCKET (AoE)
**Icon:** 🚀  
**Color:** Red  

**Mechanics:**
- **Range:** Unlimited (until impact)
- **Speed:** 1.5 tiles per tick (slower than bullet)
- **Explosion:** 5×5 grid area (radius 2)
- **Action:** Press SPACE or CLICK to fire
- **Effect:** Cuts **ALL snakes** in explosion area
- **Cooldown:** 2 seconds

**Strategy:**
- Devastating in crowded areas
- Cut multiple snakes at once
- Creates massive food opportunity
- Long cooldown = use wisely

**How it Works:**
1. Rocket fires in facing direction
2. Travels until it hits any snake
3. Explodes in 5×5 area
4. For each snake in area:
   - Find closest segment to explosion center
   - Cut at that segment
   - Removed tail → food orbs
5. Also destroys food orbs in explosion

---

## 🎯 Gameplay Loop

### Weapon Spawning
- All 3 weapons spawn on map at room creation
- Spawned at random positions as pickups
- Visible as colored tiles with weapon icons

### Picking Up Weapons
- Move your snake head over weapon pickup
- Automatic pickup on contact
- If you already have a weapon, it drops at your position
- **You can only hold 1 weapon at a time**

### Using Weapons
- **Controls:** Press SPACE bar or CLICK mouse
- Action depends on weapon type
- Cooldowns prevent spam
- Visual feedback on hit/explosion

### Weapon Drops
- When you die, your weapon drops at your death location
- Other players can pick it up
- Weapons never disappear - always either held or on ground

### Collecting Food Orbs
- Red circular orbs (smaller than coins)
- Created from cut snake segments
- Worth 1 point each (coins still give 1 point too)
- Grow your snake back after being cut

---

## 🎨 Visual Indicators

### Weapon Pickups (on ground)
- **SWORD:** Silver tile with ⚔️
- **GUN:** Blue tile with 🔫
- **ROCKET:** Red tile with 🚀

### Weapon UI (bottom-right)
- Shows your current weapon
- Displays weapon icon and name
- Shows "SPACE / CLICK" instruction
- Only visible when you have a weapon

### Scoreboard
- Players with weapons show icon next to name
- Example: "Player1 ⚔️" has sword

### Projectiles
- **Bullet:** Small yellow dot (fast)
- **Rocket:** Larger red circle with trail (slower)

### Effects
- **Hit:** Yellow expanding ring
- **Explosion:** Orange expanding blast with fade

### Food Orbs
- Red circles (from cut snakes)
- Smaller than yellow coins
- Scattered where segments were

---

## 📊 Strategic Tips

### For Attackers
1. **Sword:** Get behind enemies and strike tail repeatedly
2. **Gun:** Lead your shots - aim where they'll be
3. **Rocket:** Fire into groups or at long snakes
4. **Combos:** Cut enemies, then collect their food to grow massive

### For Defenders
1. **Dodge:** Projectiles travel predictably - weave and turn
2. **Bait:** Make attackers waste ammo/cooldowns
3. **Counter:** Pick up dropped weapons from dead players
4. **Protect tail:** Your tail is most vulnerable to cuts

### Advanced Tactics
- **Weapon denial:** Control weapon spawns to prevent enemies from arming
- **Ambush:** Hold sword near spawn points
- **Sniper:** Hold gun and patrol from distance
- **Area control:** Rocket user can deny entire zones
- **Feed loop:** Cut enemies → collect food → grow → cut more

---

## 🔧 Technical Details

### Server-Authoritative
- All weapon logic runs on server
- Clients only send input (move + attack)
- Prevents cheating and ensures fairness
- Server validates all hits and cuts

### Projectile System
- Projectiles updated every tick
- Bullet: 2 tiles/tick, max 30 tiles
- Rocket: 1.5 tiles/tick, unlimited range
- Hit detection on grid positions

### Cutting Algorithm
```
1. Find hit segment index i
2. Keep snake[0..i]
3. Remove snake[i+1..end]
4. For each removed segment:
   - Create food orb at segment position
   - Add to room.foodOrbs[]
5. Reduce player.score by # removed segments
```

### Weapon State Tracking
```javascript
// Per room
weapons: Map<weaponType, {
  owner: socketId | null,
  position: {x, y} | null,
  lastUsed: timestamp
}>

// Per player
player.weapon: 'SWORD' | 'GUN' | 'ROCKET' | null
player.weaponCooldown: timestamp
```

---

## 🎮 Controls Summary

| Action | Key/Mouse |
|--------|-----------|
| Move Up | ↑ or W |
| Move Down | ↓ or S |
| Move Left | ← or A |
| Move Right | → or D |
| Use Weapon | SPACE or CLICK |

---

## 🐛 Edge Cases Handled

✅ **Multiple players firing at once** - Server processes sequentially  
✅ **Weapon pickup conflicts** - First player to touch gets it  
✅ **Cutting 1-segment snake** - Can't cut below 1 segment (head protected)  
✅ **Self-damage** - Own projectiles can't hit self  
✅ **Explosion on self** - Explosions don't affect rocket owner  
✅ **Death while holding weapon** - Weapon drops immediately  
✅ **Respawn with weapon** - Weapon released before respawn  
✅ **Empty explosion** - No error if explosion hits nothing  
✅ **Projectile cleanup** - Old projectiles removed when out of bounds  

---

## 🎯 Game Balance

### Weapon Power Ranking
1. **Rocket** - High impact, but rare use (long cooldown)
2. **Gun** - Consistent damage, good range
3. **Sword** - High risk, but fastest cooldown

### Counters
- **Sword** counters: Keep distance, use gun/rocket
- **Gun** counters: Erratic movement, get close with sword
- **Rocket** counters: Spread out, don't group up

### Resource Economy
- **Coins:** Passive growth (spawn automatically)
- **Food Orbs:** Aggressive growth (from combat)
- **Strategy:** Fight for food orbs to outgrow passive players

---

## 📈 Future Enhancements (Ideas)

- More weapon types (laser, shotgun, mines)
- Weapon upgrades (faster bullets, bigger explosions)
- Temporary powerups (shields, speed boost)
- Weapon ammo limits
- Team-based weapon sharing
- Weapon spawn zones
- Kill streaks / combo multipliers

---

## 🚀 Quick Start

1. **Join game** - Connect to server
2. **Find weapon** - Look for colored tiles with icons (⚔️🔫🚀)
3. **Pick it up** - Move over it
4. **Use it** - Press SPACE or CLICK
5. **Cut enemies** - Aim and fire!
6. **Collect food** - Eat red orbs from cut snakes
7. **Grow massive** - Repeat!

---

## 🎬 Example Combat Scenario

**Situation:** You have GUN 🔫, enemy has long snake (30 segments)

1. **Position:** Get perpendicular to enemy's path
2. **Aim:** Face direction they're moving
3. **Fire:** Press SPACE when they're ~10 tiles away
4. **Hit:** Bullet travels and hits at segment 15
5. **Result:** Enemy loses 15 segments (tail cut off)
6. **Profit:** 15 red food orbs appear where tail was
7. **Collect:** Eat the orbs to grow from 10 → 25 segments
8. **Dominate:** Now you're longer than they are!

---

**Have fun and may your cuts be clean!** ✂️🐍
