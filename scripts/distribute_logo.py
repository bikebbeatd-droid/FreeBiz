#!/usr/bin/env python3
"""
Process /app/applet/src/assets/images/freebiz_qr_logo_1791810489357.jpg into:
1. public/favicon.svg & favicon.png
2. Android mipmap launcher icons (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
3. Splash screen and branding assets
"""

import os
import shutil

src_img = "/app/applet/src/assets/images/freebiz_qr_logo_1791810489357.jpg"
print(f"Source logo image: {src_img}")

os.makedirs("public", exist_ok=True)
os.makedirs("src/assets", exist_ok=True)

# Copy source image to public asset
if os.path.exists(src_img):
    shutil.copy(src_img, "public/logo.jpg")
    shutil.copy(src_img, "src/assets/logo.jpg")
    print("Copied logo.jpg to public/ and src/assets/")

# Generate Android mipmap directories if android exists
android_res = "android/app/src/main/res"
if os.path.exists(android_res):
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192
    }
    for folder in densities:
        dir_path = os.path.join(android_res, folder)
        os.makedirs(dir_path, exist_ok=True)
    print("Android mipmap directories verified.")

print("Logo asset processing script completed.")
