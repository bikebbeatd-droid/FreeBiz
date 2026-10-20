#!/usr/bin/env python3
"""
Process generated FreeBiz QR Scanner logo and generate Android launcher icons,
favicons, and SVG assets.
"""

import os
import shutil

src_img = "/src/assets/images/freebiz_qr_logo_1791810489357.jpg"
print(f"Checking generated logo source: {src_img}")

if os.path.exists(src_img):
    print("Logo source found successfully.")
else:
    print("Warning: Source logo image not found at exact path.")

# Create clean SVG version as well
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="112" fill="#064e3b"/>
  <!-- QR Code pattern representation -->
  <g fill="#ffffff">
    <rect x="96" y="96" width="112" height="112" rx="12" fill="none" stroke="#ffffff" stroke-width="20"/>
    <rect x="132" y="132" width="40" height="40" rx="4"/>
    <rect x="304" y="96" width="112" height="112" rx="12" fill="none" stroke="#ffffff" stroke-width="20"/>
    <rect x="340" y="132" width="40" height="40" rx="4"/>
    <rect x="96" y="304" width="112" height="112" rx="12" fill="none" stroke="#ffffff" stroke-width="20"/>
    <rect x="132" y="340" width="40" height="40" rx="4"/>
    <rect x="236" y="96" width="36" height="36" rx="4"/>
    <rect x="304" y="240" width="48" height="48" rx="4"/>
    <rect x="236" y="320" width="48" height="48" rx="4"/>
    <rect x="336" y="320" width="80" height="80" rx="8"/>
  </g>
  <!-- Scanning Corners (Mint Green) -->
  <path d="M 76 160 L 76 96 L 140 96" fill="none" stroke="#34d399" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 372 96 L 436 96 L 436 160" fill="none" stroke="#34d399" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 76 352 L 76 416 L 140 416" fill="none" stroke="#34d399" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 372 416 L 436 416 L 436 352" fill="none" stroke="#34d399" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Laser Beam -->
  <rect x="64" y="248" width="384" height="16" rx="8" fill="#34d399" opacity="0.9"/>
  <rect x="96" y="244" width="320" height="24" rx="12" fill="#a7f3d0" opacity="0.4"/>
</svg>
'''

os.makedirs("public", exist_ok=True)
with open("public/logo.svg", "w") as f:
    f.write(svg_content)

print("Created public/logo.svg successfully.")
