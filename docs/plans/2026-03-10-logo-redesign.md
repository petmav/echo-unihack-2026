# Echo Logo Redesign — Design Doc
_2026-03-10_

## Summary

Replace the current sonar/WiFi-wave logo with an original "shared breath" mark: two soft crescent shapes facing each other with a glowing almond gap between them. Simultaneously fix the broken SVG animation transform-origin bugs and set the new mark as the Android APK icon.

---

## Shape

Two bezier-based crescents symmetric about the vertical axis of a 512×512 viewBox.

- **Left crescent**: convex outer edge curves left, concave inner edge opens right. Soft tapered ends at top and bottom.
- **Right crescent**: mirror of left.
- **Shared breath space**: the gap between the crescents forms an almond / vesica-piscis shape. A radial gradient ellipse fills this space — warm terracotta at centre, fading to transparent. This is the emotional core of the mark.
- No dot. No WiFi arcs. Nothing that reads as a tech signal.

The two crescents nearly meet at top and bottom, creating a contained oval silhouette. At small sizes the almond glow reads as a simple warm highlight — the mark stays legible at 48 px.

---

## Animation (fixes + redesign)

### Bug fixes
Current animated SVG elements use `style={{ originX: "256px", originY: "256px" }}`. SVG path elements require `transformBox: "fill-box"` and `transformOrigin: "center"` for Framer Motion scale transforms to pivot correctly. Without this, paths scale from the SVG viewport origin (top-left), causing visible jump/drift.

All animated elements get:
```ts
style={{ transformBox: "fill-box", transformOrigin: "center" }}
```

### New animation behaviour
| Element | Animation |
|---------|-----------|
| Left crescent | Breathe: subtle `translateX(-3px)` on inhale, back on exhale — expands the shared space |
| Right crescent | Mirror: `translateX(+3px)` on inhale |
| Shared glow ellipse | Opacity and scale pulse — brighter/larger on inhale |
| Outer ripple 1 | Oval ring, expands from form boundary outward, fades — 0 s delay |
| Outer ripple 2 | Same, 1.2 s delay — sequential, not simultaneous |

Ripples stagger outward so they feel like actual breath propagating, not a uniform pulse.

---

## Colour

Unchanged from current palette:
- Crescents: gradient `#D49A82 → #A06B55`
- Glow: radial `#C8856C` at centre → transparent
- Ripple strokes: `#C8856C` at low opacity

Presence level system (arcHue, glowOpacity, arcBoost) carries over unchanged — the crescent hue and glow intensity still respond to "Breathing With Others" count.

---

## Icon versions

### `public/icon.svg` (favicon / PWA)
Two crescents + glow only. No ripples. On `#FAF7F2` background circle. Same viewBox.

### `EchoLogoSmall` component
Rebuild with the same crescent paths, no animation, used in nav/metadata.

### Android APK icon
1. Redesign `public/icon.svg` with the new mark
2. Create `frontend/resources/icon.png` — 1024×1024 PNG render of the icon SVG on `#FAF7F2` background
3. Run `npx @capacitor/assets generate --android` to produce all required density buckets (mdpi → xxxhdpi, adaptive icon layers, Play Store icon)
4. The `resources/` directory is committed to git (unlike `android/`, which is gitignored)

---

## Files changed

| File | Change |
|------|--------|
| `frontend/src/components/echo/EchoLogo.tsx` | Full rewrite of SVG shape + animation fix |
| `frontend/public/icon.svg` | New crescent mark, no text |
| `frontend/resources/icon.png` | New — 1024×1024 PNG for Capacitor asset generation |
| `frontend/resources/icon-background.png` | New — flat colour background layer for adaptive icon |
| `frontend/resources/icon-foreground.png` | New — foreground layer (the mark itself) |
