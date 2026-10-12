#!/usr/bin/env python3
"""
Generate professional original FreeBiz QR Scanner icons:
- Dark navy background (#060D1E)
- Cyan scanning corners (#00F0FF)
- Geometric QR matrix pattern in center
- Glowing scan laser beam
- Outputs SVG and all required Android PNG launcher resolutions
"""

import os
import subprocess

# SVG Vector Template (108dp canvas standard for Android Adaptive Icon)
SVG_CONTENT = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050C1A" />
      <stop offset="50%" stop-color="#0A1628" />
      <stop offset="100%" stop-color="#0F243E" />
    </linearGradient>

    <!-- Cyan Glow Filter -->
    <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Laser Beam Gradient -->
    <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F0FF" stop-opacity="0" />
      <stop offset="20%" stop-color="#00F0FF" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="1" />
      <stop offset="80%" stop-color="#00F0FF" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#00F0FF" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="512" height="512" rx="104" fill="url(#bgGrad)" />

  <!-- Subtle grid circuit lines in background -->
  <path d="M64 160h384M64 256h384M64 352h384M160 64v384M256 64v384M352 64v384" 
        stroke="#1E3A5F" stroke-width="1.5" stroke-opacity="0.35" stroke-dasharray="4 8" />

  <!-- Outer Cyan Viewfinder Reticle Corners -->
  <g stroke="#00F0FF" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" filter="url(#cyanGlow)">
    <!-- Top-Left Corner -->
    <path d="M96 156 V108 H144" fill="none" />
    <!-- Top-Right Corner -->
    <path d="M416 156 V108 H368" fill="none" />
    <!-- Bottom-Left Corner -->
    <path d="M96 356 V404 H144" fill="none" />
    <!-- Bottom-Right Corner -->
    <path d="M416 356 V404 H368" fill="none" />
  </g>

  <!-- High-Tech Central QR Matrix Pattern (Geometric modules) -->
  <g fill="#FFFFFF">
    <!-- Top-Left Finder Outer Box -->
    <path d="M140 140 h80 v80 h-80 z M156 156 v48 h48 v-48 z" fill-rule="evenodd" />
    <!-- Top-Left Finder Center Dot -->
    <rect x="168" y="168" width="24" height="24" rx="4" fill="#00F0FF" />

    <!-- Top-Right Finder Outer Box -->
    <path d="M292 140 h80 v80 h-80 z M308 156 v48 h48 v-48 z" fill-rule="evenodd" />
    <!-- Top-Right Finder Center Dot -->
    <rect x="320" y="168" width="24" height="24" rx="4" fill="#00F0FF" />

    <!-- Bottom-Left Finder Outer Box -->
    <path d="M140 292 h80 v80 h-80 z M156 308 v48 h48 v-48 z" fill-rule="evenodd" />
    <!-- Bottom-Left Finder Center Dot -->
    <rect x="168" y="320" width="24" height="24" rx="4" fill="#00F0FF" />

    <!-- Central & Surrounding QR Data Modules -->
    <rect x="244" y="140" width="24" height="24" rx="3" />
    <rect x="244" y="180" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="140" y="244" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="180" y="244" width="24" height="24" rx="3" />
    <rect x="220" y="244" width="24" height="24" rx="3" />
    <rect x="268" y="244" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="308" y="244" width="24" height="24" rx="3" />
    <rect x="348" y="244" width="24" height="24" rx="3" />
    
    <rect x="244" y="284" width="24" height="24" rx="3" />
    <rect x="284" y="284" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="348" y="284" width="24" height="24" rx="3" />

    <rect x="244" y="324" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="284" y="348" width="24" height="24" rx="3" />
    <rect x="324" y="324" width="24" height="24" rx="3" />
    <rect x="348" y="348" width="24" height="24" rx="3" fill="#00F0FF" />
  </g>

  <!-- Glowing Cyan Scan Beam Laser across center -->
  <g filter="url(#cyanGlow)">
    <line x1="88" y1="256" x2="424" y2="256" stroke="url(#laserGrad)" stroke-width="4" stroke-linecap="round" />
    <circle cx="256" cy="256" r="5" fill="#FFFFFF" />
  </g>
</svg>
'''

# Foreground Vector for Android Adaptive Icon (No rounded rect background, centered in 108dp viewport)
ADAPTIVE_FG_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F0FF" stop-opacity="0" />
      <stop offset="20%" stop-color="#00F0FF" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="1" />
      <stop offset="80%" stop-color="#00F0FF" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#00F0FF" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Outer Cyan Viewfinder Reticle Corners -->
  <g stroke="#00F0FF" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" filter="url(#cyanGlow)">
    <path d="M112 172 V128 H156" fill="none" />
    <path d="M400 172 V128 H356" fill="none" />
    <path d="M112 340 V384 H156" fill="none" />
    <path d="M400 340 V384 H356" fill="none" />
  </g>

  <!-- High-Tech Central QR Matrix Pattern -->
  <g fill="#FFFFFF">
    <path d="M148 148 h72 v72 h-72 z M162 162 v44 h44 v-44 z" fill-rule="evenodd" />
    <rect x="172" y="172" width="24" height="24" rx="4" fill="#00F0FF" />

    <path d="M292 148 h72 v72 h-72 z M306 162 v44 h44 v-44 z" fill-rule="evenodd" />
    <rect x="316" y="172" width="24" height="24" rx="4" fill="#00F0FF" />

    <path d="M148 292 h72 v72 h-72 z M162 306 v44 h44 v-44 z" fill-rule="evenodd" />
    <rect x="172" y="316" width="24" height="24" rx="4" fill="#00F0FF" />

    <rect x="244" y="148" width="24" height="24" rx="3" />
    <rect x="244" y="184" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="148" y="244" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="184" y="244" width="24" height="24" rx="3" />
    <rect x="220" y="244" width="24" height="24" rx="3" />
    <rect x="268" y="244" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="304" y="244" width="24" height="24" rx="3" />
    <rect x="340" y="244" width="24" height="24" rx="3" />

    <rect x="244" y="280" width="24" height="24" rx="3" />
    <rect x="280" y="280" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="340" y="280" width="24" height="24" rx="3" />

    <rect x="244" y="316" width="24" height="24" rx="3" fill="#00F0FF" />
    <rect x="280" y="340" width="24" height="24" rx="3" />
    <rect x="316" y="316" width="24" height="24" rx="3" />
    <rect x="340" y="340" width="24" height="24" rx="3" fill="#00F0FF" />
  </g>

  <!-- Laser Beam -->
  <g filter="url(#cyanGlow)">
    <line x1="104" y1="256" x2="408" y2="256" stroke="url(#laserGrad)" stroke-width="5" stroke-linecap="round" />
    <circle cx="256" cy="256" r="6" fill="#FFFFFF" />
  </g>
</svg>
'''

def main():
    os.makedirs('public', exist_ok=True)
    os.makedirs('scripts', exist_ok=True)

    # Save Master SVGs
    with open('public/app-logo.svg', 'w') as f:
        f.write(SVG_CONTENT)
    with open('public/adaptive-fg.svg', 'w') as f:
        f.write(ADAPTIVE_FG_SVG)

    print("Master SVGs written successfully.")

    # Android launcher densities and dimensions
    densities = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    }

    # Generate PNG icons for each Android density
    res_base = 'android/app/src/main/res'
    if os.path.exists(res_base):
        for folder, size in densities.items():
            folder_path = os.path.join(res_base, folder)
            os.makedirs(folder_path, exist_ok=True)
            
            # Standard Launcher Icon
            out_icon = os.path.join(folder_path, 'ic_launcher.png')
            subprocess.run(['convert', '-background', 'none', '-density', '384',
                            'public/app-logo.svg', '-resize', f'{size}x{size}', out_icon], check=True)
            
            # Round Launcher Icon
            out_round = os.path.join(folder_path, 'ic_launcher_round.png')
            # Create a circular mask for round icon
            subprocess.run(['convert', out_icon, '(', '+clone', '-alpha', 'extract',
                            '-draw', f'fill black polygon 0,0 0,{size} {size},{size} {size},0 fill white circle {size/2},{size/2} {size/2},0',
                            ')', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', out_round], check=True)
            
            # Adaptive Foreground Icon
            fg_size = int(size * 108 / 48)  # standard adaptive foreground sizing
            out_fg = os.path.join(folder_path, 'ic_launcher_foreground.png')
            subprocess.run(['convert', '-background', 'none', '-density', '384',
                            'public/adaptive-fg.svg', '-resize', f'{fg_size}x{fg_size}', out_fg], check=True)

            print(f"Generated {folder} launcher icons ({size}x{size})")

    # Generate web app icons
    subprocess.run(['convert', '-background', 'none', '-density', '384',
                    'public/app-logo.svg', '-resize', '192x192', 'public/icon-192.png'], check=True)
    subprocess.run(['convert', '-background', 'none', '-density', '384',
                    'public/app-logo.svg', '-resize', '512x512', 'public/icon-512.png'], check=True)
    print("All Android & Web launcher icons generated successfully.")

if __name__ == '__main__':
    main()
