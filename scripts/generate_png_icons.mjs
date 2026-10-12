import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

/**
 * Draws the FreeBiz QR Scanner brand icon onto a PNG instance
 * @param {PNG} png 
 * @param {number} size 
 * @param {object} options 
 */
function drawIcon(png, size, options = {}) {
  const { isRound = false, isForegroundOnly = false } = options;
  const cx = size / 2;
  const cy = size / 2;
  const rCorner = size * 0.18; // rounded rect radius

  // Colors
  const cNavyDark = [6, 13, 30, 255];      // #060D1E
  const cNavyLight = [12, 28, 56, 255];    // #0C1C38
  const cCyan = [0, 240, 255, 255];        // #00F0FF
  const cCyanDim = [0, 180, 220, 180];     // #00B4DC
  const cWhite = [255, 255, 255, 255];     // #FFFFFF
  const cTransparent = [0, 0, 0, 0];

  function setPixel(x, y, color) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (size * Math.floor(y) + Math.floor(x)) << 2;
    // Alpha blending
    const a = color[3] / 255;
    if (a <= 0) return;
    if (a >= 1) {
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = 255;
    } else {
      const bgA = png.data[idx + 3] / 255;
      const outA = a + bgA * (1 - a);
      if (outA > 0) {
        png.data[idx] = Math.round((color[0] * a + png.data[idx] * bgA * (1 - a)) / outA);
        png.data[idx + 1] = Math.round((color[1] * a + png.data[idx + 1] * bgA * (1 - a)) / outA);
        png.data[idx + 2] = Math.round((color[2] * a + png.data[idx + 2] * bgA * (1 - a)) / outA);
        png.data[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  function fillRect(x0, y0, w, h, color) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        setPixel(x, y, color);
      }
    }
  }

  // 1. Draw Background
  if (!isForegroundOnly) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let inside = false;
        if (isRound) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= (cx - 1) * (cx - 1)) {
            inside = true;
          }
        } else {
          // Rounded rect
          const dx = Math.max(0, Math.abs(x - cx) - (cx - rCorner));
          const dy = Math.max(0, Math.abs(y - cy) - (cy - rCorner));
          if (dx * dx + dy * dy <= rCorner * rCorner) {
            inside = true;
          }
        }

        if (inside) {
          // Subtle vertical gradient
          const grad = y / size;
          const r = Math.round(cNavyDark[0] * (1 - grad) + cNavyLight[0] * grad);
          const g = Math.round(cNavyDark[1] * (1 - grad) + cNavyLight[1] * grad);
          const b = Math.round(cNavyDark[2] * (1 - grad) + cNavyLight[2] * grad);
          setPixel(x, y, [r, g, b, 255]);
        }
      }
    }
  }

  // 2. Viewfinder Reticle Brackets (Cyan Corners)
  // Corner coordinates relative to center
  const scale = size / 100;
  const bDist = 34 * scale;   // distance from center
  const bLen = 14 * scale;    // corner arm length
  const bThick = Math.max(2, Math.round(3.5 * scale)); // stroke thickness

  // Helper to draw thick line segment
  function drawThickLine(x1, y1, x2, y2, color) {
    const minX = Math.min(x1, x2) - bThick / 2;
    const maxX = Math.max(x1, x2) + bThick / 2;
    const minY = Math.min(y1, y2) - bThick / 2;
    const maxY = Math.max(y1, y2) + bThick / 2;
    fillRect(minX, minY, maxX - minX, maxY - minY, color);
  }

  // Top-Left Reticle
  drawThickLine(cx - bDist, cy - bDist, cx - bDist + bLen, cy - bDist, cCyan);
  drawThickLine(cx - bDist, cy - bDist, cx - bDist, cy - bDist + bLen, cCyan);

  // Top-Right Reticle
  drawThickLine(cx + bDist - bLen, cy - bDist, cx + bDist, cy - bDist, cCyan);
  drawThickLine(cx + bDist, cy - bDist, cx + bDist, cy - bDist + bLen, cCyan);

  // Bottom-Left Reticle
  drawThickLine(cx - bDist, cy + bDist, cx - bDist + bLen, cy + bDist, cCyan);
  drawThickLine(cx - bDist, cy + bDist - bLen, cx - bDist, cy + bDist, cCyan);

  // Bottom-Right Reticle
  drawThickLine(cx + bDist - bLen, cy + bDist, cx + bDist, cy + bDist, cCyan);
  drawThickLine(cx + bDist, cy + bDist - bLen, cx + bDist, cy + bDist, cCyan);

  // 3. Central QR Pattern Finder Squares
  // Standard 7x7 module finder pattern rendered at 3 corners
  const qrMod = 3.6 * scale;

  function drawFinderPattern(ox, oy) {
    // Outer 7x7 box (white)
    fillRect(ox, oy, 7 * qrMod, 7 * qrMod, cWhite);
    // Inner 5x5 cutout (dark navy if background, transparent if foreground only)
    const cutColor = isForegroundOnly ? [0, 0, 0, 0] : cNavyDark;
    fillRect(ox + qrMod, oy + qrMod, 5 * qrMod, 5 * qrMod, cutColor);
    // Center 3x3 dot (cyan)
    fillRect(ox + 2 * qrMod, oy + 2 * qrMod, 3 * qrMod, 3 * qrMod, cCyan);
  }

  // Top-left finder
  drawFinderPattern(cx - 24 * scale, cy - 24 * scale);
  // Top-right finder
  drawFinderPattern(cx + 24 * scale - 7 * qrMod, cy - 24 * scale);
  // Bottom-left finder
  drawFinderPattern(cx - 24 * scale, cy + 24 * scale - 7 * qrMod);

  // Data modules
  const dataModules = [
    [-0.5, -5.5, cCyan], [1.5, -5.5, cWhite],
    [-0.5, -3.5, cWhite], [3.5, -3.5, cCyan],
    [-5.5, -0.5, cCyan], [-3.5, -0.5, cWhite], [-1.5, -0.5, cWhite], [0.5, -0.5, cCyan], [2.5, -0.5, cWhite], [4.5, -0.5, cCyan],
    [-0.5, 1.5, cWhite], [1.5, 1.5, cCyan], [3.5, 1.5, cWhite],
    [-0.5, 3.5, cCyan], [1.5, 3.5, cWhite], [3.5, 3.5, cCyan],
    [-0.5, 5.5, cWhite], [3.5, 5.5, cCyan]
  ];

  dataModules.forEach(([mx, my, col]) => {
    fillRect(cx + mx * qrMod * 1.5, cy + my * qrMod * 1.5, qrMod * 1.3, qrMod * 1.3, col);
  });

  // 4. Glowing Cyan Laser Scan Beam
  const beamW = 68 * scale;
  const beamY = cy;
  for (let bx = cx - beamW / 2; bx <= cx + beamW / 2; bx++) {
    const distFromCenter = Math.abs(bx - cx) / (beamW / 2);
    const alpha = Math.max(0, 1 - distFromCenter);
    // Core beam
    setPixel(bx, beamY, [255, 255, 255, Math.round(255 * alpha)]);
    // Upper & lower glow
    setPixel(bx, beamY - 1, [0, 240, 255, Math.round(180 * alpha)]);
    setPixel(bx, beamY + 1, [0, 240, 255, Math.round(180 * alpha)]);
    setPixel(bx, beamY - 2, [0, 200, 255, Math.round(80 * alpha)]);
    setPixel(bx, beamY + 2, [0, 200, 255, Math.round(80 * alpha)]);
  }
}

function savePng(filePath, size, options = {}) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const png = new PNG({ width: size, height: size });
  drawIcon(png, size, options);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated ${filePath} (${size}x${size})`);
}

function main() {
  const densities = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
  };

  const resBase = 'android/app/src/main/res';
  for (const [folder, size] of Object.entries(densities)) {
    // Standard icon
    savePng(path.join(resBase, folder, 'ic_launcher.png'), size, { isRound: false });
    // Round icon
    savePng(path.join(resBase, folder, 'ic_launcher_round.png'), size, { isRound: true });
    // Adaptive foreground icon
    const fgSize = Math.round(size * 108 / 48);
    savePng(path.join(resBase, folder, 'ic_launcher_foreground.png'), fgSize, { isForegroundOnly: true });
  }

  // Web PWA / App icons
  savePng('public/icon-192.png', 192, { isRound: false });
  savePng('public/icon-512.png', 512, { isRound: false });
  console.log('All Android & Web PNG icons generated successfully!');
}

main();
