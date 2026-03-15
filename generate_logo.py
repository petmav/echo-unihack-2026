#!/usr/bin/env python3
"""Generate a standalone SVG file for the Echo app logo."""

import math

# Constants
VIEW_W, VIEW_H = 512, 512
CY = 256
X_START, X_END = 46, 466
NUM_PTS = 48
X_STEP = (X_END - X_START) / (NUM_PTS - 1)

LAYERS = [
    {"offset": 0,   "sw": 4,   "op": 0.95},
    {"offset": 20,  "sw": 3,   "op": 0.75},
    {"offset": -20, "sw": 3,   "op": 0.75},
    {"offset": 42,  "sw": 2.2, "op": 0.55},
    {"offset": -42, "sw": 2.2, "op": 0.55},
    {"offset": 66,  "sw": 1.5, "op": 0.35},
    {"offset": -66, "sw": 1.5, "op": 0.35},
    {"offset": 90,  "sw": 1,   "op": 0.18},
    {"offset": -90, "sw": 1,   "op": 0.18},
]

NOW = 2000  # frozen time
ENERGY = 0.55
MAX_AMP = 180

# Step 1: Compute master offsets
master_offsets = []
for i in range(NUM_PTS):
    t = i / (NUM_PTS - 1)
    envelope = math.pow(math.sin(t * math.pi), 0.8)

    n1 = math.sin(t * 7.3 + NOW * 0.0012) * 0.6
    n2 = math.sin(t * 12.1 + NOW * 0.002 + 1.7) * 0.35
    n3 = math.sin(t * 19.7 + NOW * 0.003 + 3.2) * 0.15
    n4 = math.sin(t * 3.1 + NOW * 0.0006 + 0.5) * 0.2
    noise = n1 + n2 + n3 + n4

    master_offsets.append(noise * MAX_AMP * envelope * ENERGY)


def build_path(layer):
    """Build an SVG path string for a wave layer using Catmull-Rom interpolation."""
    offset = layer["offset"]
    dampen = 1 - abs(offset) / 200

    # Compute points
    pts = []
    for i in range(NUM_PTS):
        x = X_START + i * X_STEP
        y = CY + offset + master_offsets[i] * dampen
        pts.append((x, y))

    # Build path with Catmull-Rom to cubic bezier
    d = f"M{pts[0][0]:.2f},{pts[0][1]:.2f}"

    for i in range(len(pts) - 1):
        p0 = pts[max(i - 1, 0)]
        p1 = pts[i]
        p2 = pts[i + 1]
        p3 = pts[min(i + 2, len(pts) - 1)]

        cp1x = p1[0] + (p2[0] - p0[0]) / 6
        cp1y = p1[1] + (p2[1] - p0[1]) / 6
        cp2x = p2[0] - (p3[0] - p1[0]) / 6
        cp2y = p2[1] - (p3[1] - p1[1]) / 6

        d += f" C{cp1x:.2f},{cp1y:.2f} {cp2x:.2f},{cp2y:.2f} {p2[0]:.2f},{p2[1]:.2f}"

    return d


# Step 2: Build SVG
svg_parts = []
svg_parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW_W} {VIEW_H}" width="{VIEW_W}" height="{VIEW_H}">')

# Defs: gradients
svg_parts.append("  <defs>")

# Linear gradient (horizontal) for wave strokes
svg_parts.append('    <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">')
svg_parts.append('      <stop offset="0%"   stop-color="#C8856C" stop-opacity="0"/>')
svg_parts.append('      <stop offset="15%"  stop-color="#C8856C" stop-opacity="1"/>')
svg_parts.append('      <stop offset="50%"  stop-color="#D49A82" stop-opacity="1"/>')
svg_parts.append('      <stop offset="85%"  stop-color="#C8856C" stop-opacity="1"/>')
svg_parts.append('      <stop offset="100%" stop-color="#C8856C" stop-opacity="0"/>')
svg_parts.append("    </linearGradient>")

# Radial glow
svg_parts.append('    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">')
svg_parts.append('      <stop offset="0%"   stop-color="#D9A58E" stop-opacity="0.19"/>')
svg_parts.append('      <stop offset="50%"  stop-color="#C8856C" stop-opacity="0.08"/>')
svg_parts.append('      <stop offset="100%" stop-color="#C8856C" stop-opacity="0"/>')
svg_parts.append("    </radialGradient>")

svg_parts.append("  </defs>")

# Background glow circle
svg_parts.append(f'  <circle cx="{VIEW_W // 2}" cy="{VIEW_H // 2}" r="220" fill="url(#glow)"/>')

# Wave layers (render outermost first so center is on top)
for layer in reversed(LAYERS):
    path_d = build_path(layer)
    svg_parts.append(
        f'  <path d="{path_d}" '
        f'fill="none" stroke="url(#waveGrad)" '
        f'stroke-width="{layer["sw"]}" '
        f'opacity="{layer["op"]}" '
        f'stroke-linecap="round"/>'
    )

svg_parts.append("</svg>")

svg_content = "\n".join(svg_parts)

# Step 3: Write to file
output_path = "/Users/langkee/Desktop/echo-unihack-2026/frontend/public/echo-logo.svg"
with open(output_path, "w") as f:
    f.write(svg_content)

print(f"SVG written to {output_path}")
print(f"File size: {len(svg_content)} bytes")
