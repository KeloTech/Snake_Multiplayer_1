# ⚡ Weapons Quick Start

## 🎮 What's New?

Your Snake game now has **3 unique weapons** that **cut** snakes instead of killing them!

- **⚔️ SWORD** - Melee strikes
- **🔫 GUN** - Ranged bullets  
- **🚀 ROCKET** - Area explosions

Cut enemies → Their tail becomes food → Eat it to grow huge!

---

## 🚀 How to Play

### 1. Start the Server ✅
**Already running!** Server is live on `ws://localhost:3001` with weapons enabled.

### 2. Open Client
**Hard refresh your browser:**
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

Make sure Server URL shows: `ws://localhost:3001`

### 3. Find a Weapon
Look for colored tiles on the map:
- **Silver ⚔️** = Sword
- **Blue 🔫** = Gun
- **Red 🚀** = Rocket

Move your snake over it to pick it up!

### 4. Use Your Weapon
- Press **SPACE** or **CLICK mouse**
- Watch the bottom-right corner for your weapon UI
- Each weapon has a cooldown (can't spam)

---

## ⚔️ Quick Weapon Guide

### SWORD (Melee)
- **Range:** Very close (1 tile)
- **Cooldown:** 1 second
- **Best for:** Quick strikes, close combat
- **Tip:** Get behind enemies

### GUN (Ranged)
- **Range:** 30 tiles
- **Cooldown:** 0.5 seconds  
- **Best for:** Sniping, consistent damage
- **Tip:** Lead your shots

### ROCKET (AoE)
- **Range:** Unlimited
- **Cooldown:** 2 seconds
- **Best for:** Groups, massive cuts
- **Tip:** Explodes in 5×5 area!

---

## 🎯 Core Rules

1. **Snakes DON'T DIE from weapons** - They get **CUT**
2. Cut segments turn into **RED FOOD ORBS**
3. Eat the orbs to grow back
4. Only **3 weapons total** per room (1 of each type)
5. When you die, your weapon **drops at your death location**
6. You can only hold **1 weapon at a time**

---

## 🎨 Visual Guide

### What You'll See:

**Weapon Pickups (on ground):**
- Silver tile = Sword available
- Blue tile = Gun available  
- Red tile = Rocket available

**Your Weapon (bottom-right box):**
- Shows weapon icon and name
- "SPACE / CLICK" reminder
- Only visible when armed

**Scoreboard:**
- Players with weapons show icon
- Example: "Player ⚔️" has sword

**Food Orbs:**
- **Yellow circles** = Coins (regular)
- **Red circles** = Food orbs (from cuts)

**Projectiles:**
- Yellow dot = Bullet (fast)
- Red circle with trail = Rocket (slower)

**Effects:**
- Yellow ring = Hit effect
- Orange blast = Explosion

---

## 💡 Pro Tips

### For Beginners
1. **Start with Sword** - Simplest to use
2. **Stay near weapons** - Control weapon spawns
3. **Cut from behind** - Safer attacks
4. **Collect food fast** - Before others do

### For Advanced Players
1. **Gun spam** - Fast cooldown = rapid fire
2. **Rocket groups** - Hit multiple snakes
3. **Bait and cut** - Let enemies grow, then cut them
4. **Weapon cycling** - Drop weapon, pick up another

### Combos
- Cut with weapon → Collect food → Grow huge
- Rocket cluster → Gun cleanup → Mass collection
- Sword ambush → Immediate food collection

---

## 🧪 Test It Out

1. **Join game** with 2 browser tabs
2. **Find weapons** - All 3 spawn on map
3. **Test Sword:**
   - Tab 1: Get close to Tab 2
   - Press SPACE
   - Watch Tab 2 get cut!
4. **Test Gun:**
   - Face direction
   - Press SPACE
   - See bullet fly
5. **Test Rocket:**
   - Aim at enemy
   - Press SPACE  
   - Watch explosion!

---

## 🐛 Troubleshooting

**Can't see weapons?**
- Hard refresh browser (Ctrl+Shift+R)
- Check console for errors (F12)

**Weapon not working?**
- Check bottom-right for weapon UI
- Wait for cooldown to expire
- Make sure you're alive

**No hit detection?**
- Weapons are server-side
- Small lag is normal
- Check server logs

**Missing food orbs?**
- Food orbs are RED circles
- Coins are YELLOW circles
- Both give points

---

## 📊 Server Status

Check terminal for:
```
🐍 Snake Multiplayer Server running on port 3001
📊 Configuration:
   - Map size: 120x120
   - Max players per room: 15
   - Tick rate: 12 ticks/second
   - Dynamic rooms: Enabled (snake-1, snake-2, ...)
🎮 Global game loop started!
```

If you see this, weapons are active! ✅

---

## 📚 Full Documentation

- **WEAPONS_GUIDE.md** - Complete gameplay guide
- **WEAPONS_IMPLEMENTATION.md** - Technical details  
- **TESTING_ROOMS.md** - Room system testing

---

## 🎮 Quick Controls

| Action | Key/Button |
|--------|-----------|
| Move | Arrow Keys or WASD |
| Attack | SPACE or CLICK |
| Menu | Back to Menu button |

---

## 🎉 Have Fun!

This is a **fully working** weapon system with:
- ✅ 3 unique weapons
- ✅ Cutting mechanics
- ✅ Food orbs
- ✅ Projectiles  
- ✅ Explosions
- ✅ Visual effects
- ✅ Server authority

**Time to dominate!** ⚔️🔫🚀🐍
