---
name: hd-canvas-pixel-game
description: Render crisp pixel-art games by matching Canvas logical resolution to display size, avoiding CSS scaling blur
source: auto-skill
extracted_at: '2026-07-04T02:26:25.082Z'
---

## Problem
Canvas games with `Press Start 2P` pixel fonts appear blurry when the Canvas logical resolution (e.g. 480×270) is upscaled via CSS to a larger display size (e.g. 960×540). CSS scaling causes font rasterization blur and pixel smearing.

## Solution
Set the Canvas `width`/`height` attributes to the **final display resolution** directly, eliminating CSS upscaling. Then double all in-game coordinates, sizes, and font values to match.

## Procedure

### Step 1: Canvas resolution
```html
<!-- BEFORE: small logical res + CSS stretch = blurry -->
<canvas width="480" height="270" style="width:960px;height:540px">

<!-- AFTER: native res = display size = crisp -->
<canvas width="960" height="540">
```
Remove any `width`/`height` CSS on the canvas element — let the HTML attributes define the pixel dimensions.

### Step 2: Double all constants
Multiply by 2:
- `W`, `H` resolution constants
- `groundY`, `moveSpeed`, `jumpForce`
- Attack ranges (`lightRange`, `heavyRange`, `specialRange`)
- Collision box dimensions (`this.w`, `this.h`)
- HUD bar widths/heights, font sizes
- Menu button sizes, positions, font sizes
- Background building positions/sizes
- Effect sizes (spark positions, damage number offsets)
- Sprite draw `scale` parameter

### Step 3: Font size rule
Every `ctx.font` value must be doubled:
```js
// BEFORE
ctx.font = '8px "Press Start 2P", monospace';
// AFTER
ctx.font = '16px "Press Start 2P", monospace';
```

### Step 4: CRT overlay adjustment
If using a CSS scanline overlay, double the stripe sizes to match the higher resolution:
```css
/* BEFORE: 1px lines */
repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)

/* AFTER: 2px lines */
repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 2px, transparent 2px, transparent 6px)
```

### Key insight
`image-rendering: pixelated` only prevents interpolation during CSS scaling — it does **not** fix font rasterization blur. The only reliable fix is to make the Canvas pixel grid match the display pixel grid 1:1.

### Step 5: AI distance thresholds
AI decision logic that uses `Math.abs(p1.x - p2.x)` distance checks must have its thresholds updated to match the new entity sizes and canvas scale. Old thresholds (50-70px) will cause AI to never perceive "close range" and refuse to attack. Double all distance thresholds when resolution doubles.

### Step 6: justPressed key state management
In frame-based input systems, un-consumed `justPressed` states accumulate across frames and across screen transitions. Add a `clearJustPressed()` call at the **end of every game loop frame** (after all screen update functions) to prevent stale key states from being silently consumed by prior screens:

```js
function clearJustPressed() {
    for (const k in justPressed) {
        if (justPressed[k]) justPressed[k] = false;
    }
}
// In gameLoop(), after all screen updates:
clearJustPressed();
```
This is critical for button responsiveness on screens that appear after other screens (e.g. result screen after fight screen).
