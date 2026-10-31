---
name: canvas-fighting-game-ai
description: Design and iteratively tune AI opponents for HTML Canvas fighting games, avoiding common pitfalls with distance thresholds, reaction timing, and combo systems
source: auto-skill
extracted_at: '2026-07-04T03:05:00.000Z'
---

## Problem

AI opponents in Canvas fighting games often exhibit three failure modes:
1. **Never attacks** — distance thresholds are based on old entity sizes, so AI always perceives "too far"
2. **Too aggressive** — reacts instantly, chains combos relentlessly, gives player no breathing room
3. **Too passive** — defends too often, never uses special abilities, feels like a punching bag

## Solution Architecture

### Core AI Decision Loop

```js
let ai = {
    decision: 'idle',
    decisionTimer: 0,
    reactionDelay: 0,
    comboCount: 0,        // tracks follow-up attacks after a hit
    aggressiveMode: false, // toggles behavior based on health advantage
};

function updateAI() {
    if (p2.state === 'ko' || p2.hitStun > 0) return;

    ai.decisionTimer--;
    if (ai.decisionTimer > 0) return; // only decide once per decision cycle

    const dist = Math.abs(p1.x - p2.x);
    const p1Attacking = p1.state === 'lightAtk' || p1.state === 'heavyAtk' || p1.state === 'special';
    const healthDiff = p2.health - p1.health;

    // Reaction delay (frames) — gives player a window to react
    ai.reactionDelay = 6 + Math.floor(Math.random() * 8);
    ai.decisionTimer = ai.reactionDelay + Math.floor(Math.random() * 10);

    // Aggressive mode: only when significantly ahead
    ai.aggressiveMode = healthDiff > 30;

    // Distance-based decision tree (thresholds MUST match entity sizes)
    // ...
}
```

### Distance Threshold Rules

Distance thresholds must scale with **collision box width**, not canvas resolution. Rule of thumb:

| Situation | Threshold formula | Example (w=96) |
|-----------|------------------|----------------|
| "Close range" (can attack) | `collision_w * 1.3` | ~125px |
| "Mid range" (approach needed) | `collision_w * 2.0` | ~190px |
| "Far range" (must approach) | `collision_w * 2.2` | ~210px |

When entity collision box doubles from 48→96, thresholds must also roughly double (50→120, 70→200).

### Balanced Probability Distribution

For a fair but challenging AI (good for casual play):

| Situation | Defense | Light Atk | Heavy Atk | Special | Approach | Idle |
|-----------|---------|-----------|-----------|---------|----------|------|
| Opponent attacking, in range | 60% | 20% | 20% | — | — | — |
| Close range | 30% | 25% | 25% | 20%* | — | — |
| Mid range | — | 15% | 10% | — | 50% | 25% |
| Far range | — | — | — | — | 100% | — |

*Special only when energy ≥ 50.

### Combo System

Limit AI combos so they feel threatening but not oppressive:

```js
// After AI hits: 40% chance of 1 follow-up (not guaranteed chains)
if (dist < 130 && Math.random() < 0.4) ai.comboCount = 1;

// Follow-up: only 50% of the time
if (ai.comboCount > 0 && dist < 130 && Math.random() < 0.5) {
    ai.decision = Math.random() < 0.6 ? 'lightAtk' : 'heavyAtk';
    ai.comboCount--;
}
```

### Energy Management

- **Energy 45-49**: 70% defend, 30% approach (play safe to charge ultimate)
- **Energy ≥ 50 + leading by 30+**: 50% chance to use special when in range
- **Energy ≥ 50 + behind**: still prefer regular attacks (don't waste ultimate defensively)

### Tuning Workflow

1. **Start weak**: High reaction delay (10-20 frames), 70%+ defense rate, no combos
2. **Test**: Play 2-3 rounds, note if AI feels like a "punching bag"
3. **Increase aggression**: Lower reaction to 6-14 frames, reduce defense to 50-60%, add occasional combos
4. **Test again**: Note if AI is "unbeatable" or "fair challenge"
5. **Fine-tune**: Adjust individual probabilities by 10-15% increments, not 50% jumps
6. **Cap abilities**: Remove jump-attack chains, limit special usage, cap combo length at 1-2

### Common Pitfalls

- **`ai.defend && (ai.decision = 'defend')`** — this is a no-op, not an assignment. Use `else ai.decision = 'defend'`
- **`setTimeout` for AI actions** — async callbacks can fire after the AI is KO'd or stunned. Always check `p2.state !== 'ko'` inside callbacks
- **Decision timer too short** — if `ai.decisionTimer` reaches 0 every frame, AI spams attacks. Minimum 3-frame delay + random spread
- **No state guards** — always check `p2.state === 'ko' || p2.hitStun > 0` at the top of `updateAI()` to prevent actions during stun/KO
