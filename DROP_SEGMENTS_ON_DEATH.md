# Drop All Segments on Death

## Change Summary

**Goal:** Make snakes drop all their body segments as food orbs whenever they die (from any cause), not just when cut by weapons.

## Implementation

### 1. New Function: `dropAllSegmentsAsFoodOrbs()`

Created a helper function that converts all snake segments (except the head) into food orbs:

```javascript
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
```

### 2. Called on All Death Events

The function is now called in all death scenarios:

#### Wall Collision (lines ~962-965)
```javascript
if (newHead.x < 0 || newHead.x >= MAP_WIDTH || 
    newHead.y < 0 || newHead.y >= MAP_HEIGHT) {
  dropAllSegmentsAsFoodOrbs(player, roomState);
  player.alive = false;
  continue;
}
```

#### Self-Collision (lines ~1017-1023)
```javascript
for (let i = 1; i < player.snake.length; i++) {
  const segment = player.snake[i];
  if (head.x === segment.x && head.y === segment.y) {
    dropAllSegmentsAsFoodOrbs(player, roomState);
    player.alive = false;
    break;
  }
}
```

#### Head-to-Head Collision (lines ~1033-1039)
```javascript
const otherHead = other.snake[0];
if (head.x === otherHead.x && head.y === otherHead.y) {
  dropAllSegmentsAsFoodOrbs(player, roomState);  // Both snakes drop
  dropAllSegmentsAsFoodOrbs(other, roomState);
  player.alive = false;
  other.alive = false;
  break;
}
```

#### Head-to-Body Collision (lines ~1042-1048)
```javascript
for (const segment of other.snake) {
  if (head.x === segment.x && segment.y === segment.y) {
    dropAllSegmentsAsFoodOrbs(player, roomState);
    player.alive = false;
    break;
  }
}
```

## Gameplay Impact

### Before
- Weapon cuts: dropped segments as food orbs ✅
- Wall death: nothing dropped ❌
- Self-collision: nothing dropped ❌
- Snake collision: nothing dropped ❌

### After
- **All death types:** drop all body segments as food orbs ✅
- Creates more dynamic gameplay
- Dead snakes leave food trails
- Encourages scavenging behavior
- Makes deaths more rewarding for survivors

## Visual Effect

When a snake dies:
1. Snake body disappears
2. Red food orbs appear at each body segment position (except head)
3. Other snakes can collect these orbs for points
4. Console logs: `💀 [PlayerName] dropped X food orbs`

## Technical Notes

- Skips the head segment (index 0) to avoid clutter at death position
- Each segment becomes a food orb with value = 1
- Food orbs are rendered as small red circles on the client
- Works for both human players and bots
- Works in combination with weapon cuts (weapon cuts happen first, then if snake dies from other causes, remaining segments drop)

## Testing

1. **Wall collision:** Run into wall → see food orbs appear along your body
2. **Self-collision:** Run into yourself → food orbs drop
3. **Snake collision:** Run into another snake → both drop food orbs
4. **Weapon death:** Get cut by weapon, then die → remaining segments drop

Console will show: `💀 [PlayerName] dropped X food orbs` for each death.
