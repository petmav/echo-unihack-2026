# Echo Logo Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the sonar-wave logo with a two-crescent "shared breath" mark, fix SVG animation transform bugs, and set the new mark as the Android APK icon.

**Architecture:** The new mark uses two mirrored bezier-crescent paths sharing the same top/bottom anchor points, creating an almond-shaped gap between them. A radial gradient ellipse fills that gap — the "shared breath space." Framer Motion animates each crescent group independently (breathing apart on inhale) and staggers two oval ripple rings outward. All animated SVG elements get the `transformBox: "fill-box"` fix that was missing before. The icon is generated from `public/icon.svg` using `sharp` (already installed), then handed to `@capacitor/assets` to produce all Android density buckets.

**Tech Stack:** React/Framer Motion (logo component), SVG bezier paths, `sharp` (SVG→PNG), `@capacitor/assets` (Android icon generation)

---

## Task 1: Rewrite `EchoLogo.tsx`

**Files:**
- Modify: `frontend/src/components/echo/EchoLogo.tsx`

### Step 1: Replace the entire file with the new component

The key changes:
1. **New shape** — two mirrored crescent paths sharing anchor points at `(256,152)` and `(256,360)`. Left crescent outer control at `x≈100`, inner at `x≈206`. Right crescent outer at `x≈412`, inner at `x≈306`. The gap between inner edges is ~100px wide at the midline — the "shared breath space."
2. **Animation fix** — every `motion.*` SVG element gets `style={{ transformBox: "fill-box" as const, transformOrigin: "center" as const }}`. Without this, Framer Motion scales SVG elements from the viewport top-left instead of their own centre, causing visible drift.
3. **Crescent breathing** — each crescent is wrapped in `<motion.g>` and translates outward (`x: ±5px`) on inhale instead of uniform scale, expanding the shared space.
4. **Staggered ripples** — two oval rings pulse outward with a `duration * 0.5` delay between them.

```tsx
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { PresenceLevel } from "@/lib/types";

interface EchoLogoProps {
  size?: number;
  animate?: boolean;
  presenceLevel?: PresenceLevel;
  onClick?: () => void;
  className?: string;
}

const BREATHE_DURATION = 7;

const PRESENCE_VISUAL = [
  { arcHue: "#C8856C", glowOpacity: 0.38, arcBoost: 0,    durationScale: 1.00 },
  { arcHue: "#C07A60", glowOpacity: 0.46, arcBoost: 0.05, durationScale: 0.95 },
  { arcHue: "#B86F54", glowOpacity: 0.54, arcBoost: 0.10, durationScale: 0.90 },
  { arcHue: "#AE6248", glowOpacity: 0.62, arcBoost: 0.15, durationScale: 0.85 },
  { arcHue: "#A4553C", glowOpacity: 0.70, arcBoost: 0.20, durationScale: 0.80 },
] as const;

// Required for Framer Motion scale/translate to work correctly on SVG elements.
// Without transformBox:"fill-box", transforms pivot from the SVG viewport origin
// (top-left corner) instead of the element's own bounding box centre.
const SVG_T: React.CSSProperties = {
  transformBox: "fill-box",
  transformOrigin: "center",
};

function makeTrans(duration: number, delay = 0) {
  return {
    duration,
    delay,
    ease: [0.42, 0, 0.58, 1] as const,
    repeat: Infinity,
    repeatType: "loop" as const,
  };
}

export function EchoLogo({
  size = 100,
  animate = true,
  presenceLevel = 0,
  onClick,
  className,
}: EchoLogoProps) {
  const animState = animate ? "breathe" : "idle";
  const visual = PRESENCE_VISUAL[presenceLevel];
  const dur = BREATHE_DURATION * visual.durationScale;

  // Left crescent breathes leftward (expanding the shared space)
  const leftV = useMemo(() => ({
    idle:    { x: 0 },
    breathe: { x: [0, -5, -4, -5, 0], transition: makeTrans(dur) },
  }), [dur]);

  // Right crescent mirrors left
  const rightV = useMemo(() => ({
    idle:    { x: 0 },
    breathe: { x: [0, 5, 4, 5, 0], transition: makeTrans(dur) },
  }), [dur]);

  // The shared breath glow brightens and expands on inhale
  const glowV = useMemo(() => {
    const peak = Math.min(visual.glowOpacity + 0.28, 0.92);
    return {
      idle:    { scale: 1, opacity: visual.glowOpacity },
      breathe: {
        scale:   [1, 1.18, 1.14, 1.18, 1],
        opacity: [visual.glowOpacity, peak, peak * 0.95, peak, visual.glowOpacity],
        transition: makeTrans(dur),
      },
    };
  }, [visual.glowOpacity, dur]);

  // Two oval ripples expand outward, staggered by half a breath cycle
  const ripple1V = useMemo(() => ({
    idle:    { scale: 1, opacity: 0 },
    breathe: {
      scale:   [1, 1.55],
      opacity: [0.28 + visual.arcBoost, 0],
      transition: { duration: dur * 0.48, delay: 0, ease: "easeOut" as const, repeat: Infinity, repeatDelay: dur * 0.52 },
    },
  }), [visual.arcBoost, dur]);

  const ripple2V = useMemo(() => ({
    idle:    { scale: 1, opacity: 0 },
    breathe: {
      scale:   [1, 1.55],
      opacity: [0.18 + visual.arcBoost, 0],
      transition: { duration: dur * 0.48, delay: dur * 0.5, ease: "easeOut" as const, repeat: Infinity, repeatDelay: dur * 0.52 },
    },
  }), [visual.arcBoost, dur]);

  return (
    <motion.div
      className={className}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined, lineHeight: 0 }}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? "Share what's on your mind" : "Echo logo"}
      data-presence-level={presenceLevel}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Vertical gradient — consistent direction on both crescents */}
          <linearGradient id="echo-crescent-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#D49A82" />
            <stop offset="100%" stopColor={visual.arcHue} />
          </linearGradient>
          {/* Radial glow for the shared breath space */}
          <radialGradient id="echo-breath-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#D9A58E" stopOpacity="1" />
            <stop offset="55%"  stopColor={visual.arcHue} stopOpacity="0.55" />
            <stop offset="100%" stopColor={visual.arcHue} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Ripple ring 2 (behind ring 1, more delay) ── */}
        <motion.ellipse
          cx="256" cy="256" rx="168" ry="108"
          stroke={visual.arcHue} strokeWidth="1.5" fill="none"
          variants={ripple2V} animate={animState}
          style={SVG_T}
        />

        {/* ── Ripple ring 1 ── */}
        <motion.ellipse
          cx="256" cy="256" rx="168" ry="108"
          stroke={visual.arcHue} strokeWidth="2" fill="none"
          variants={ripple1V} animate={animState}
          style={SVG_T}
        />

        {/* ── Left crescent ── */}
        {/*
          Path: starts at top anchor (256,152), sweeps left (outer, ctrl≈100),
          arrives at bottom anchor (256,360), then curves back along inner
          concave edge (ctrl≈206) to top. Creates a "(" crescent shape.
        */}
        <motion.g variants={leftV} animate={animState} style={SVG_T}>
          <path
            d="M 256 152 C 100 195, 100 317, 256 360 C 206 317, 206 195, 256 152 Z"
            fill="url(#echo-crescent-grad)"
          />
        </motion.g>

        {/* ── Right crescent (mirror of left) ── */}
        {/*
          Outer ctrl≈412 (sweeps right), inner ctrl≈306 (concave facing left).
        */}
        <motion.g variants={rightV} animate={animState} style={SVG_T}>
          <path
            d="M 256 152 C 412 195, 412 317, 256 360 C 306 317, 306 195, 256 152 Z"
            fill="url(#echo-crescent-grad)"
          />
        </motion.g>

        {/* ── Shared breath space glow ── */}
        {/* Ellipse fills the almond gap between the two crescent inner edges */}
        <motion.ellipse
          cx="256" cy="256" rx="50" ry="104"
          fill="url(#echo-breath-glow)"
          variants={glowV} animate={animState}
          style={SVG_T}
        />
      </svg>
    </motion.div>
  );
}

export function EchoLogoSmall() {
  return (
    <svg width="28" height="28" viewBox="0 0 512 512" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="echo-sm-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#D49A82" />
          <stop offset="100%" stopColor="#A06B55" />
        </linearGradient>
        <radialGradient id="echo-sm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#D9A58E" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#C8856C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M 256 152 C 100 195, 100 317, 256 360 C 206 317, 206 195, 256 152 Z"
        fill="url(#echo-sm-grad)"
      />
      <path
        d="M 256 152 C 412 195, 412 317, 256 360 C 306 317, 306 195, 256 152 Z"
        fill="url(#echo-sm-grad)"
      />
      <ellipse cx="256" cy="256" rx="50" ry="104" fill="url(#echo-sm-glow)" />
    </svg>
  );
}
```

### Step 2: Verify visually in dev server

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`. Check:
- Two warm crescent shapes face each other with a glowing almond between them
- Logo breathes — the crescents gently drift apart on inhale
- Two oval rings expand outward sequentially (not simultaneously)
- No drift/jump when animation starts (the old transform-origin bug)
- `data-presence-level` attribute exists on the outer div

### Step 3: Commit

```bash
git add frontend/src/components/echo/EchoLogo.tsx
git commit -m "feat: redesign logo to two-crescent shared-breath mark, fix SVG animation transform-origin"
```

---

## Task 2: Update `public/icon.svg`

**Files:**
- Modify: `frontend/public/icon.svg`

### Step 1: Replace with simplified mark (no text, no ripples, with background)

```svg
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="crescent-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D49A82"/>
      <stop offset="100%" stop-color="#A06B55"/>
    </linearGradient>
    <radialGradient id="breath-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#D9A58E" stop-opacity="0.7"/>
      <stop offset="55%"  stop-color="#C8856C" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#C8856C" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background fill — matches Echo's beige theme (#FAF7F2) -->
  <rect width="512" height="512" fill="#FAF7F2"/>

  <!-- Left crescent -->
  <path d="M 256 152 C 100 195, 100 317, 256 360 C 206 317, 206 195, 256 152 Z"
        fill="url(#crescent-grad)"/>

  <!-- Right crescent -->
  <path d="M 256 152 C 412 195, 412 317, 256 360 C 306 317, 306 195, 256 152 Z"
        fill="url(#crescent-grad)"/>

  <!-- Shared breath glow -->
  <ellipse cx="256" cy="256" rx="50" ry="104" fill="url(#breath-glow)"/>
</svg>
```

### Step 2: Verify in browser

Open `frontend/public/icon.svg` directly in a browser. Should show: two warm crescent shapes on beige, glowing almond gap between them, no text.

### Step 3: Commit

```bash
git add frontend/public/icon.svg
git commit -m "feat: update icon.svg with two-crescent mark"
```

---

## Task 3: Generate `resources/icon.png` and install `@capacitor/assets`

**Files:**
- Create: `frontend/scripts/generate-icon.js`
- Create: `frontend/resources/icon.png` (generated, committed)

### Step 1: Install `@capacitor/assets`

```bash
cd frontend && npm install -D @capacitor/assets
```

Expected: adds `@capacitor/assets` to devDependencies.

### Step 2: Write the icon generation script

`sharp` is already installed (it's a transitive dependency). This script renders `public/icon.svg` to a 1024×1024 PNG at `resources/icon.png`.

```js
// frontend/scripts/generate-icon.js
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const outDir  = path.join(__dirname, '..', 'resources');
const outPath = path.join(outDir, 'icon.png');

fs.mkdirSync(outDir, { recursive: true });

sharp(svgPath)
  .resize(1024, 1024)
  .png()
  .toFile(outPath)
  .then(() => console.log('[generate-icon] Written: ' + outPath))
  .catch(err => { console.error(err); process.exit(1); });
```

### Step 3: Add npm script

In `frontend/package.json`, add to `"scripts"`:

```json
"gen:icon": "node scripts/generate-icon.js"
```

### Step 4: Run it

```bash
cd frontend && npm run gen:icon
```

Expected output:
```
[generate-icon] Written: .../frontend/resources/icon.png
```

Verify the PNG exists and looks correct:
```bash
ls -lh frontend/resources/icon.png
```
Expected: file exists, size ~30–80 KB.

Open `frontend/resources/icon.png` in an image viewer — should show two crescents on beige at 1024×1024.

### Step 5: Generate Android icon assets

```bash
cd frontend && npx @capacitor/assets generate --android
```

This reads `resources/icon.png` and writes all required density buckets into `android/app/src/main/res/mipmap-*/`. Expected output includes lines like:
```
✔  Generated android adaptive icon
✔  Generated android round icon
✔  Generated android icon
```

If `android/` doesn't exist yet (gitignored, fresh machine):
```bash
npm run cap:setup   # runs cap add android + patches gradle.properties
npm run gen:icon    # then re-run icon generation
npx @capacitor/assets generate --android
```

### Step 6: Commit

```bash
git add frontend/scripts/generate-icon.js frontend/package.json frontend/resources/icon.png
git commit -m "feat: generate 1024px icon PNG for Android APK"
```

Note: `android/` remains gitignored — the icon assets inside it are regenerated from `resources/icon.png` during `cap:setup` or CI.

---

## Task 4: Wire icon generation into CI and `cap:setup`

**Files:**
- Modify: `frontend/package.json`
- Modify: `.github/workflows/build-apk.yml`

### Step 1: Update `cap:setup` to include icon generation

In `frontend/package.json`, update:

```json
"cap:setup": "npx cap add android && node scripts/setup-android.js && npm run gen:icon && npx @capacitor/assets generate --android"
```

### Step 2: Add icon generation step to CI workflow

In `.github/workflows/build-apk.yml`, after the "Patch android/local.properties" step, add:

```yaml
      - name: Generate Android icon assets
        working-directory: frontend
        run: |
          npm run gen:icon
          npx @capacitor/assets generate --android
```

### Step 3: Verify CI workflow YAML is valid

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/build-apk.yml')); print('valid')"
```

### Step 4: Commit

```bash
git add frontend/package.json .github/workflows/build-apk.yml
git commit -m "feat: wire icon generation into cap:setup and CI workflow"
```

---

## Task 5: Full local verification

### Step 1: Run the full APK build pipeline

```bash
cd frontend
npm run build:mobile
npm run cap:sync
node scripts/setup-android.js
npx @capacitor/assets generate --android
cd android && ./gradlew assembleDebug --no-daemon
```

Expected: `BUILD SUCCESSFUL`

APK at: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### Step 2: Install on phone and verify icon

```bash
adb install frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

On the phone:
- Check the app icon in the launcher — should show the two-crescent mark on a beige background
- Open the app — logo on home screen shows the same mark, breathing animation works
- Tap the logo — crescents drift apart smoothly on inhale, ripple rings expand outward sequentially, no drift/jump artefact

### Step 3: Final commit if everything looks good

```bash
git add -A
git status  # review before committing
git commit -m "chore: verify logo redesign end-to-end on device"
```
