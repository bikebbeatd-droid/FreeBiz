/**
 * FreeBiz Tools — Pure JavaScript Core Application Engine
 * 100% Client-Side • Zero AI APIs • Zero External Tracking
 * 
 * Includes:
 * 1. Self-contained Pure-JS QR Code Generator (Reed-Solomon GF(256), Matrix, Masks)
 * 2. Predefined Template Business Bio Generator
 * 3. Predefined Template Product Description Generator
 * 4. Local Receipt & Mini-Invoice Calculator
 * 5. Clipboard & File Export Utilities
 * 6. Mobile Testing Guide & Device Checker
 */

/* ==========================================================================
   PART 1: SELF-CONTAINED QR CODE GENERATOR (Pure Vanilla JS)
   Implements QR Code Models 1-10 with Reed-Solomon Error Correction & Masks
   ========================================================================== */

const QRCodeEngine = (() => {
  // Galois Field GF(256) Math for Reed-Solomon
  const EXP_TABLE = new Uint8Array(512);
  const LOG_TABLE = new Uint8Array(256);

  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d; // Generator polynomial x^8 + x^4 + x^3 + x^2 + 1
  }

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], EXP_TABLE[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const res = new Uint8Array(ecCount);
    for (let i = 0; i < data.length; i++) {
      const feedback = data[i] ^ res[0];
      for (let j = 0; j < ecCount - 1; j++) {
        res[j] = res[j + 1] ^ gfMul(gen[ecCount - 1 - j], feedback);
      }
      res[ecCount - 1] = gfMul(gen[0], feedback);
    }
    return res;
  }

  // Version Table: [totalCodewords, dataCodewords_L, ecPerBlock_L, numBlocks_L, dataCodewords_M, ecPerBlock_M, numBlocks_M]
  // Simplified for Levels L (7%), M (15%), Q (25%), H (30%)
  const VERSIONS = [
    null,
    // V1: 21x21
    { size: 21, L: { dc: 19, ec: 7, b: 1 }, M: { dc: 16, ec: 10, b: 1 }, Q: { dc: 13, ec: 13, b: 1 }, H: { dc: 9, ec: 17, b: 1 }, align: [] },
    // V2: 25x25
    { size: 25, L: { dc: 34, ec: 10, b: 1 }, M: { dc: 28, ec: 16, b: 1 }, Q: { dc: 22, ec: 22, b: 1 }, H: { dc: 16, ec: 28, b: 1 }, align: [6, 18] },
    // V3: 29x29
    { size: 29, L: { dc: 55, ec: 15, b: 1 }, M: { dc: 44, ec: 26, b: 1 }, Q: { dc: 34, ec: 18, b: 2 }, H: { dc: 26, ec: 22, b: 2 }, align: [6, 22] },
    // V4: 33x33
    { size: 33, L: { dc: 80, ec: 20, b: 1 }, M: { dc: 64, ec: 18, b: 2 }, Q: { dc: 48, ec: 26, b: 2 }, H: { dc: 36, ec: 16, b: 4 }, align: [6, 26] },
    // V5: 37x37
    { size: 37, L: { dc: 108, ec: 26, b: 1 }, M: { dc: 86, ec: 24, b: 2 }, Q: { dc: 62, ec: 18, b: 4 }, H: { dc: 46, ec: 22, b: 4 }, align: [6, 30] },
    // V6: 41x41
    { size: 41, L: { dc: 136, ec: 18, b: 2 }, M: { dc: 108, ec: 16, b: 4 }, Q: { dc: 76, ec: 24, b: 4 }, H: { dc: 60, ec: 28, b: 4 }, align: [6, 34] },
    // V7: 45x45
    { size: 45, L: { dc: 156, ec: 20, b: 2 }, M: { dc: 124, ec: 18, b: 4 }, Q: { dc: 88, ec: 18, b: 6 }, H: { dc: 66, ec: 26, b: 5 }, align: [6, 22, 38] },
    // V8: 49x49
    { size: 49, L: { dc: 194, ec: 24, b: 2 }, M: { dc: 154, ec: 22, b: 4 }, Q: { dc: 110, ec: 22, b: 6 }, H: { dc: 86, ec: 26, b: 6 }, align: [6, 24, 42] },
    // V9: 53x53
    { size: 53, L: { dc: 232, ec: 30, b: 2 }, M: { dc: 182, ec: 22, b: 5 }, Q: { dc: 132, ec: 20, b: 8 }, H: { dc: 100, ec: 24, b: 8 }, align: [6, 26, 46] },
    // V10: 57x57
    { size: 57, L: { dc: 274, ec: 18, b: 4 }, M: { dc: 216, ec: 26, b: 5 }, Q: { dc: 154, ec: 24, b: 8 }, H: { dc: 122, ec: 28, b: 8 }, align: [6, 28, 50] }
  ];

  // Bit Buffer helper
  class BitBuffer {
    constructor() {
      this.buffer = [];
      this.length = 0;
    }
    put(num, length) {
      for (let i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    }
    putBit(bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) {
        this.buffer.push(0);
      }
      if (bit) {
        this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
      }
      this.length++;
    }
    getBytes() {
      return new Uint8Array(this.buffer);
    }
  }

  // Encode String to UTF-8 Bytes
  function toUTF8Bytes(str) {
    const utf8 = [];
    for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      } else {
        // Surrogate pair
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      }
    }
    return new Uint8Array(utf8);
  }

  // Create QR Matrix
  function generate(text, ecLevel = "M") {
    const rawBytes = toUTF8Bytes(text);
    const ecKey = ["L", "M", "Q", "H"].includes(ecLevel) ? ecLevel : "M";

    // Find smallest version that fits
    let targetVersion = 1;
    for (let v = 1; v <= 10; v++) {
      const vInfo = VERSIONS[v];
      const maxDataBytes = vInfo[ecKey].dc;
      // Byte mode: 4 bits mode + 8 bits length (for V1-9) + data bytes
      const overhead = 12; // 4 + 8 bits = 1.5 bytes
      if (rawBytes.length + 2 <= maxDataBytes) {
        targetVersion = v;
        break;
      }
      if (v === 10) targetVersion = 10; // Cap to 10
    }

    const vInfo = VERSIONS[targetVersion];
    const ecParam = vInfo[ecKey];
    const totalDataBytes = ecParam.dc;

    // Build Bit Stream (Byte Mode: 0100)
    const bb = new BitBuffer();
    bb.put(4, 4); // Byte mode indicator
    const charCountBits = targetVersion < 10 ? 8 : 16;
    bb.put(rawBytes.length, charCountBits);
    for (let i = 0; i < rawBytes.length; i++) {
      bb.put(rawBytes[i], 8);
    }

    // Add Terminator (up to 4 bits of 0)
    const totalBits = totalDataBytes * 8;
    const remainingBits = totalBits - bb.length;
    bb.put(0, Math.min(4, Math.max(0, remainingBits)));

    // Align to byte boundary
    while (bb.length % 8 !== 0) {
      bb.putBit(false);
    }

    // Pad bytes with 0xEC and 0x11
    let padToggle = true;
    while (bb.length < totalBits) {
      bb.put(padToggle ? 0xec : 0x11, 8);
      padToggle = !padToggle;
    }

    const dataCodewords = bb.getBytes().slice(0, totalDataBytes);

    // Error Correction Calculation
    const ecCodewordsPerBlock = ecParam.ec;
    const blockCount = ecParam.b;
    const blockSize = Math.floor(totalDataBytes / blockCount);

    const blocksData = [];
    const blocksEC = [];

    let offset = 0;
    for (let b = 0; b < blockCount; b++) {
      const thisBlockSize = blockSize + (b >= blockCount - (totalDataBytes % blockCount) ? 1 : 0);
      const bData = dataCodewords.slice(offset, offset + thisBlockSize);
      blocksData.push(bData);
      blocksEC.push(rsEncode(bData, ecCodewordsPerBlock));
      offset += thisBlockSize;
    }

    // Interleave data codewords
    const finalCodewords = [];
    const maxDataBlockLen = Math.max(...blocksData.map(b => b.length));
    for (let i = 0; i < maxDataBlockLen; i++) {
      for (let b = 0; b < blockCount; b++) {
        if (i < blocksData[b].length) {
          finalCodewords.push(blocksData[b][i]);
        }
      }
    }

    // Interleave EC codewords
    for (let i = 0; i < ecCodewordsPerBlock; i++) {
      for (let b = 0; b < blockCount; b++) {
        finalCodewords.push(blocksEC[b][i]);
      }
    }

    // Build Module Matrix
    const matrixSize = vInfo.size;
    // matrix: null = unset, true = black, false = white
    const matrix = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(null));
    const isReserved = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(false));

    // Place Finder Pattern
    function setFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const mr = row + r;
          const mc = col + c;
          if (mr >= 0 && mr < matrixSize && mc >= 0 && mc < matrixSize) {
            const isDark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                           (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                           (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            matrix[mr][mc] = isDark;
            isReserved[mr][mc] = true;
          }
        }
      }
    }

    setFinder(0, 0);
    setFinder(0, matrixSize - 7);
    setFinder(matrixSize - 7, 0);

    // Timing Patterns
    for (let i = 8; i < matrixSize - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
      isReserved[6][i] = true;
      isReserved[i][6] = true;
    }

    // Alignment Patterns
    const alignCoords = vInfo.align;
    for (let i = 0; i < alignCoords.length; i++) {
      for (let j = 0; j < alignCoords.length; j++) {
        const ar = alignCoords[i];
        const ac = alignCoords[j];
        if (isReserved[ar][ac]) continue;

        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isDark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
            matrix[ar + r][ac + c] = isDark;
            isReserved[ar + r][ac + c] = true;
          }
        }
      }
    }

    // Dark Module
    matrix[4 * targetVersion + 9][8] = true;
    isReserved[4 * targetVersion + 9][8] = true;

    // Reserve Format Information Areas
    for (let i = 0; i <= 8; i++) {
      if (i <= 8) {
        if (!isReserved[8][i]) isReserved[8][i] = true;
        if (!isReserved[i][8]) isReserved[i][8] = true;
      }
    }
    for (let i = matrixSize - 8; i < matrixSize; i++) {
      isReserved[8][i] = true;
      isReserved[i][8] = true;
    }

    // Convert Final Codewords to Bits
    const allBits = [];
    for (let i = 0; i < finalCodewords.length; i++) {
      for (let b = 7; b >= 0; b--) {
        allBits.push(((finalCodewords[i] >>> b) & 1) === 1);
      }
    }

    // Place Data Modules (Zig-Zag)
    let bitIdx = 0;
    let right = matrixSize - 1;
    let upwards = true;

    while (right > 0) {
      if (right === 6) right--; // Skip vertical timing pattern
      const rows = upwards
        ? Array.from({ length: matrixSize }, (_, i) => matrixSize - 1 - i)
        : Array.from({ length: matrixSize }, (_, i) => i);

      for (const row of rows) {
        for (const col of [right, right - 1]) {
          if (!isReserved[row][col]) {
            matrix[row][col] = bitIdx < allBits.length ? allBits[bitIdx++] : false;
          }
        }
      }
      upwards = !upwards;
      right -= 2;
    }

    // Apply Mask (Mask Pattern 2: (col) % 3 === 0 is reliable & clean)
    const maskFn = (r, c) => (c % 3 === 0);
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (!isReserved[r][c] && maskFn(r, c)) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }

    // Format Info: Level M (00) + Mask 2 (010) = 00010 -> Format bits with BCH
    // Pre-calculated standard format sequences
    const formatLookup = {
      L: 0x77c4, // Mask 2
      M: 0x5462, // Mask 2
      Q: 0x355f, // Mask 2
      H: 0x1639  // Mask 2
    };
    const formatBits = formatLookup[ecKey] || 0x5462;

    for (let i = 0; i < 15; i++) {
      const bit = ((formatBits >>> (14 - i)) & 1) === 1;
      // Around top-left
      if (i < 6) matrix[8][i] = bit;
      else if (i === 6) matrix[8][7] = bit;
      else if (i === 7) matrix[8][8] = bit;
      else if (i === 8) matrix[7][8] = bit;
      else matrix[14 - i][8] = bit;

      // Around bottom-left and top-right
      if (i < 8) {
        matrix[matrixSize - 1 - i][8] = bit;
      } else {
        matrix[8][matrixSize - 15 + i] = bit;
      }
    }

    return { size: matrixSize, modules: matrix };
  }

  return { generate };
})();

/* ==========================================================================
   PART 2: TOAST NOTIFICATIONS & UTILITIES
   ========================================================================== */

function showToast(message, type = "normal", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  toast.innerHTML = `<span style="font-weight:700;">${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Robust Cross-Browser Copy
async function copyTextToClipboard(text, successMessage = "Copied to clipboard!") {
  if (!text) {
    showToast("Nothing to copy", "error");
    return false;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, "success");
      return true;
    }
  } catch (err) {
    console.warn("Navigator clipboard failed, trying fallback:", err);
  }

  // Fallback using textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    textArea.remove();
    if (successful) {
      showToast(successMessage, "success");
      return true;
    }
  } catch (err) {
    console.error("Copy fallback error:", err);
  }

  showToast("Unable to copy automatically. Please select text manually.", "error");
  return false;
}

// Download Plain Text / HTML file
function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${filename}`, "success");
}

/* ==========================================================================
   PART 3: QR CODE TOOL CONTROLLER
   ========================================================================== */

let currentQRData = "";

function initQRCodeTool() {
  const canvas = document.getElementById("qrCanvas");
  if (!canvas) return;

  const typeButtons = document.querySelectorAll("#qrTypeControls .segment-btn");
  const fgColorInput = document.getElementById("qrFgColor");
  const bgColorInput = document.getElementById("qrBgColor");
  const sizeSelect = document.getElementById("qrSize");
  const ecSelect = document.getElementById("qrEcLevel");
  const payloadDisplay = document.getElementById("qrPayloadDisplay");

  // Type-specific field containers
  const typeFields = {
    url: document.getElementById("qrFieldsUrl"),
    phone: document.getElementById("qrFieldsPhone"),
    whatsapp: document.getElementById("qrFieldsWhatsapp"),
    wifi: document.getElementById("qrFieldsWifi"),
    vcard: document.getElementById("qrFieldsVcard"),
    text: document.getElementById("qrFieldsText")
  };

  let activeType = "url";

  function switchType(type) {
    activeType = type;
    typeButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.type === type);
    });

    Object.keys(typeFields).forEach(key => {
      if (typeFields[key]) {
        typeFields[key].style.display = key === type ? "block" : "none";
      }
    });

    updateQR();
  }

  typeButtons.forEach(btn => {
    btn.addEventListener("click", () => switchType(btn.dataset.type));
  });

  // Calculate payload based on active type
  function getPayload() {
    switch (activeType) {
      case "url": {
        const val = document.getElementById("qrUrlInput")?.value.trim() || "";
        if (!val) return "https://example.com";
        return val.startsWith("http://") || val.startsWith("https://") ? val : "https://" + val;
      }
      case "phone": {
        const tel = document.getElementById("qrPhoneInput")?.value.trim() || "+1234567890";
        return `tel:${tel}`;
      }
      case "whatsapp": {
        let num = document.getElementById("qrWaPhone")?.value.replace(/[^0-9]/g, "") || "1234567890";
        const msg = encodeURIComponent(document.getElementById("qrWaMsg")?.value.trim() || "Hello! Inquiring about your services.");
        return `https://wa.me/${num}?text=${msg}`;
      }
      case "wifi": {
        const ssid = document.getElementById("qrWifiSsid")?.value.trim() || "FreeBiz-Guest";
        const pass = document.getElementById("qrWifiPass")?.value.trim() || "";
        const enc = document.getElementById("qrWifiEnc")?.value || "WPA";
        return `WIFI:S:${ssid};T:${enc};P:${pass};;`;
      }
      case "vcard": {
        const name = document.getElementById("qrCardName")?.value.trim() || "Alex Morgan";
        const org = document.getElementById("qrCardOrg")?.value.trim() || "Morgan Creative";
        const tel = document.getElementById("qrCardTel")?.value.trim() || "+1 555-0199";
        const email = document.getElementById("qrCardEmail")?.value.trim() || "alex@morgan.com";
        return `BEGIN:VCARD\nVERSION:3.0\nN:${name}\nORG:${org}\nTEL:${tel}\nEMAIL:${email}\nEND:VCARD`;
      }
      case "text":
      default: {
        return document.getElementById("qrCustomText")?.value.trim() || "Welcome to FreeBiz Tools!";
      }
    }
  }

  function renderQR(text, fgColor = "#0f172a", bgColor = "#ffffff", renderSize = 260, ec = "M") {
    currentQRData = text;
    if (payloadDisplay) payloadDisplay.textContent = text;

    try {
      const qr = QRCodeEngine.generate(text, ec);
      const ctx = canvas.getContext("2d");
      const numModules = qr.size;
      const marginModules = 4;
      const totalModules = numModules + marginModules * 2;

      canvas.width = renderSize;
      canvas.height = renderSize;

      const cellSize = renderSize / totalModules;

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, renderSize, renderSize);

      // Draw Modules
      ctx.fillStyle = fgColor;
      for (let r = 0; r < numModules; r++) {
        for (let c = 0; c < numModules; c++) {
          if (qr.modules[r][c]) {
            const x = Math.round((c + marginModules) * cellSize);
            const y = Math.round((r + marginModules) * cellSize);
            const w = Math.ceil(cellSize);
            const h = Math.ceil(cellSize);
            ctx.fillRect(x, y, w, h);
          }
        }
      }
    } catch (err) {
      console.error("QR Generation Error:", err);
      showToast("Text too long for selected QR code level", "error");
    }
  }

  function updateQR() {
    const payload = getPayload();
    const fg = fgColorInput?.value || "#0f172a";
    const bg = bgColorInput?.value || "#ffffff";
    const size = parseInt(sizeSelect?.value || "260", 10);
    const ec = ecSelect?.value || "M";
    renderQR(payload, fg, bg, size, ec);
  }

  // Bind inputs to live update
  const inputsToWatch = document.querySelectorAll(
    "#qrFieldsUrl input, #qrFieldsPhone input, #qrFieldsWhatsapp input, #qrFieldsWhatsapp textarea, #qrFieldsWifi input, #qrFieldsWifi select, #qrFieldsVcard input, #qrFieldsText textarea, #qrFgColor, #qrBgColor, #qrSize, #qrEcLevel"
  );
  inputsToWatch.forEach(el => {
    el.addEventListener("input", updateQR);
    el.addEventListener("change", updateQR);
  });

  // Color Swatch buttons
  document.querySelectorAll("[data-swatch-fg]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (fgColorInput) fgColorInput.value = btn.dataset.swatchFg;
      updateQR();
    });
  });

  // Action: Download PNG
  document.getElementById("btnDownloadQrPng")?.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `freebiz-qrcode-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Downloaded QR Code as PNG", "success");
  });

  // Action: Download SVG
  document.getElementById("btnDownloadQrSvg")?.addEventListener("click", () => {
    const payload = getPayload();
    const fg = fgColorInput?.value || "#0f172a";
    const bg = bgColorInput?.value || "#ffffff";
    const ec = ecSelect?.value || "M";
    const qr = QRCodeEngine.generate(payload, ec);
    const margin = 4;
    const total = qr.size + margin * 2;

    let rects = "";
    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) {
          rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${fg}"/>`;
        }
      }
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">
  <rect width="${total}" height="${total}" fill="${bg}"/>
  ${rects}
</svg>`;

    downloadTextFile(`freebiz-qrcode-${Date.now()}.svg`, svg, "image/svg+xml");
  });

  // Action: Copy QR Code Image to Clipboard
  document.getElementById("btnCopyQrImage")?.addEventListener("click", async () => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      copyTextToClipboard(currentQRData, "Copied QR code text content to clipboard!");
      return;
    }
    canvas.toBlob(async blob => {
      if (!blob) {
        showToast("Could not generate image blob", "error");
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("QR Code image copied to clipboard!", "success");
      } catch (err) {
        console.warn("Image clipboard copy failed:", err);
        copyTextToClipboard(currentQRData, "Image copy restricted: Copied QR link text instead!");
      }
    }, "image/png");
  });

  // Action: Print QR Code
  document.getElementById("btnPrintQr")?.addEventListener("click", () => {
    window.print();
  });

  // Initialize with initial render
  updateQR();
}

/* ==========================================================================
   PART 4: BUSINESS BIO GENERATOR (Predefined Templates, No AI API)
   ========================================================================== */

const BIO_TEMPLATES = {
  // Instagram & TikTok (Character-efficient, line-broken, emoji-accented)
  instagram: {
    friendly: [
      "{name} ✨\n🌿 {niche} in {location}\n💛 {benefit}\n👇 {cta}",
      "Hey there! We're {name} 👋\n📍 Proudly based in {location}\n✨ {benefit}\n💬 {cta}",
      "Welcome to {name} ☕\n🌱 Crafted with care in {location}\n💫 {benefit}\nTap to connect ⤵️\n{cta}"
    ],
    professional: [
      "{name} | {niche}\nTrusted {niche} services in {location}.\n✓ {benefit}\nContact & Inquiries: {cta}",
      "{name}\nOfficial account for {location}.\nDelivering {benefit}.\nGet in touch today ⬇️\n{cta}",
      "{name} — Excellence in {niche}.\nHelping clients across {location} with {benefit}.\n{cta}"
    ],
    modern: [
      "{name} // {location}\n{benefit}.\nSimple. Better. Crafted.\n🔗 {cta}",
      "{name} • {niche}\nReimagining {niche} for {audience}.\n{benefit}\nTap below ⚡\n{cta}",
      "{name}\n{benefit}.\nBuilt for {location}.\n{cta} ↘️"
    ],
    minimal: [
      "{name}\n{niche} · {location}\n{benefit}\n{cta}",
      "{name} — {benefit}.\nBased in {location}.\n{cta}",
      "{name}\n{benefit}\n{cta}"
    ],
    bold: [
      "🔥 {name} is here to upgrade your {niche}.\n📍 {location}\n🚀 {benefit}\nDon't sleep on this ⬇️\n{cta}",
      "Say goodbye to average. Welcome to {name}! 💥\nServing {location} daily.\n{benefit}\nLet's get started: {cta}",
      "{name} = {niche} done right.\n{benefit}\nTap below and see why {location} chooses us 👇\n{cta}"
    ]
  },

  // Google Business Profile / Local Search (Credible, service-oriented, hours/contact)
  google: {
    friendly: [
      "Welcome to {name}! We are a local {niche} proudly serving {location} and nearby areas. Our goal is simple: {benefit}. Whether you are stopping by for the first time or a familiar face, we look forward to greeting you. {cta}",
      "At {name}, we take great pride in delivering friendly, neighborhood {niche} care to our community in {location}. We focus on {benefit} so you get quality you can trust every single time. Reach out today: {cta}"
    ],
    professional: [
      "{name} is a premier {niche} provider based in {location}. Dedicated to professional standards, reliability, and client satisfaction, our team specializes in {benefit}. Fully committed to serving residential and commercial clients across the region. {cta}",
      "Established to provide superior {niche} solutions, {name} delivers dependable service across {location}. Our core focus: {benefit}. Contact us today to schedule service or request a free consultation. {cta}"
    ],
    modern: [
      "{name} brings modern, hassle-free {niche} services to {location}. We help our clients by {benefit}. Clean process, honest pricing, and genuine dedication. {cta}",
      "Quality {niche} services designed for modern life. {name} serves {location} with a focus on {benefit}. Transparent, reliable, and prompt. {cta}"
    ],
    minimal: [
      "{name} provides dedicated {niche} services in {location}. Specializing in {benefit}. Call or message to get started: {cta}",
      "{name} — Local {niche} in {location}. {benefit}. {cta}"
    ],
    bold: [
      "Looking for top-rated {niche} in {location}? {name} delivers results that speak for themselves. We guarantee {benefit}. Experience the difference today: {cta}",
      "{name} is raising the standard for {niche} across {location}. We specialize in {benefit}. Stop settling for less — contact us now: {cta}"
    ]
  },

  // LinkedIn & Professional (Credentials, mission, value proposition)
  linkedin: {
    professional: [
      "{name} is a dedicated {niche} organization based in {location}. We partner with {audience} to deliver measurable outcomes through {benefit}. Our approach combines industry expertise, clear communication, and customer-first execution.\n\nKey focus areas:\n• Specialized {niche} solutions\n• {benefit}\n• Dedicated support for {location}\n\nConnect with us or visit our link to learn more: {cta}",
      "Founded with a mission to elevate the {niche} space, {name} provides high-touch solutions for clients in {location}. We specialize in {benefit}, ensuring every project meets rigorous quality benchmarks.\n\nOpen for partnerships and new client inquiries: {cta}"
    ],
    friendly: [
      "Hi! We're {name}. We specialize in {niche} for {location}, with a passion for {benefit}. We believe that good business is built on trust, genuine relationships, and consistently exceeding expectations.\n\nWe love connecting with fellow professionals and customers. Let's chat: {cta}",
      "At {name}, we love what we do! Serving {location} as your trusted {niche} partner, we focus every day on {benefit}.\n\nFeel free to connect or visit our site: {cta}"
    ],
    modern: [
      "{name} | Transforming {niche} in {location}.\n\nWe build and deliver {benefit}.\n\nBuilt for high-performing {audience} who value efficiency and craft.\n\nLearn more: {cta}",
      "{name} — Modern {niche} solutions.\n\nHelping {location} achieve {benefit}.\n\nConnect with our team: {cta}"
    ],
    minimal: [
      "{name} | {niche} | {location}\n\nFocused on {benefit}.\n\nInquiries: {cta}",
      "{name} provides {niche} in {location}. Our mission: {benefit}. {cta}"
    ],
    bold: [
      "{name} is setting a new benchmark for {niche} in {location}.\n\nWe don't do cookie-cutter. We deliver {benefit}.\n\nReady to elevate your standards? Let's connect: {cta}",
      "Driven by results and relentless dedication, {name} delivers {benefit} for clients throughout {location}.\n\nStart the conversation: {cta}"
    ]
  },

  // Twitter / X (Strict < 160 characters)
  twitter: {
    friendly: [
      "{name} ✨ Your neighborhood {niche} in {location}. Making sure {benefit}. 🔗 {cta}",
      "Small team, big passion. {name} serves {location} with {benefit}. Say hello! ⬇️ {cta}"
    ],
    professional: [
      "{name} | {niche} based in {location}. Providing {benefit}. Inquiries: {cta}",
      "Official account for {name}. Delivering trusted {niche} solutions in {location}. {cta}"
    ],
    modern: [
      "{name} // {location}. {benefit}. Tap below to explore: {cta}",
      "{name} • Reimagining {niche}. {benefit}. ⚡ {cta}"
    ],
    minimal: [
      "{name} — {niche} in {location}. {benefit}. {cta}",
      "{name} · {benefit} · {cta}"
    ],
    bold: [
      "Upgrading {niche} in {location}. {name} brings {benefit}. Check us out: {cta}",
      "The {niche} you actually want. {name} = {benefit}. Let's go 👇 {cta}"
    ]
  },

  // Website "About Us" / Hero Teaser
  website: {
    friendly: [
      "Welcome to {name}! We started with a very simple goal: to bring genuine care and unmatched quality to our friends and neighbors in {location}. As a dedicated {niche}, we work hard every day to ensure {benefit}. Thank you for supporting an independent local business — we can't wait to work with you. {cta}",
      "Every great story begins with a passion. For {name}, that passion is providing {location} with exceptional {niche}. We believe in craftsmanship, honesty, and {benefit}. Explore our offerings today: {cta}"
    ],
    professional: [
      "At {name}, our commitment is to provide premier {niche} services with integrity and precision. Operating from {location}, we have built a reputation for excellence by ensuring {benefit}. Our experienced team tailors each engagement to the unique needs of our clients. {cta}",
      "{name} is an established {niche} firm serving {location}. We focus on delivering sustainable value through {benefit}. Contact us today to discuss how we can serve your needs. {cta}"
    ],
    modern: [
      "{name} was built for modern standards. Located in {location}, we blend streamlined execution with deep domain craft to deliver {benefit}. Clean, transparent, and focused entirely on outcomes. {cta}",
      "We believe {niche} should be straightforward, beautiful, and dependable. At {name}, we help {location} experience {benefit}. See what we do: {cta}"
    ],
    minimal: [
      "{name} is a {niche} based in {location}. We specialize in {benefit}. {cta}",
      "Simple, honest {niche} in {location}. At {name}, our mission is {benefit}. {cta}"
    ],
    bold: [
      "Welcome to {name}. We're not here to be just another {niche} in {location}. We're here to redefine quality by guaranteeing {benefit}. If you expect excellence, you're in the right place. {cta}",
      "Tired of mediocre service? At {name}, we do {niche} differently. From {location} to the world, we deliver {benefit}. Get started right now: {cta}"
    ]
  }
};

function initBioTool() {
  const form = document.getElementById("bioGeneratorForm");
  const resultsContainer = document.getElementById("bioResultsList");
  if (!form || !resultsContainer) return;

  function generateBios() {
    const name = document.getElementById("bioBizName")?.value.trim() || "Riverstone Crafts";
    const niche = document.getElementById("bioNiche")?.value.trim() || "Handcrafted Goods & Gifts";
    const benefit = document.getElementById("bioBenefit")?.value.trim() || "unique handmade goods created with sustainable organic materials";
    const location = document.getElementById("bioLocation")?.value.trim() || "Denver, CO";
    const audience = document.getElementById("bioAudience")?.value.trim() || "conscious shoppers";
    const cta = document.getElementById("bioCta")?.value.trim() || "Shop our collection online";
    const tone = document.getElementById("bioTone")?.value || "friendly";
    const platform = document.getElementById("bioPlatform")?.value || "instagram";

    const platformGroup = BIO_TEMPLATES[platform] || BIO_TEMPLATES.instagram;
    const toneTemplates = platformGroup[tone] || platformGroup.friendly || [];

    // Fallback if not enough tone variations
    const templates = [...toneTemplates];
    if (templates.length < 3 && platformGroup.modern) {
      templates.push(...platformGroup.modern);
    }

    resultsContainer.innerHTML = "";

    // Pick 3 variations
    const chosen = templates.slice(0, 3);
    chosen.forEach((tpl, idx) => {
      let text = tpl
        .replace(/\{name\}/g, name)
        .replace(/\{niche\}/g, niche)
        .replace(/\{benefit\}/g, benefit)
        .replace(/\{location\}/g, location)
        .replace(/\{audience\}/g, audience)
        .replace(/\{cta\}/g, cta);

      const card = document.createElement("div");
      card.className = "result-card";

      const platformNames = {
        instagram: "Instagram & TikTok",
        google: "Google Business",
        linkedin: "LinkedIn / Professional",
        twitter: "Twitter / X (<160 chars)",
        website: "Website About Us"
      };

      const charCount = text.length;
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      card.innerHTML = `
        <div class="result-meta">
          <span class="result-tag">Option ${idx + 1} • ${platformNames[platform] || "Bio"}</span>
          <span class="char-counter">${charCount} chars · ${wordCount} words</span>
        </div>
        <textarea class="result-text-area" rows="4">${text}</textarea>
        <div class="result-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-copy-bio">
            <span>📋</span> Copy Bio
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-download-bio">
            <span>💾</span> Save TXT
          </button>
        </div>
      `;

      // Live char counter on edit
      const textarea = card.querySelector("textarea");
      const counter = card.querySelector(".char-counter");
      textarea.addEventListener("input", () => {
        const curChar = textarea.value.length;
        const curWord = textarea.value.split(/\s+/).filter(Boolean).length;
        counter.textContent = `${curChar} chars · ${curWord} words`;
      });

      // Copy handler
      card.querySelector(".btn-copy-bio").addEventListener("click", () => {
        copyTextToClipboard(textarea.value, "Bio copied to clipboard!");
      });

      // Download handler
      card.querySelector(".btn-download-bio").addEventListener("click", () => {
        downloadTextFile(`${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-bio-${idx + 1}.txt`, textarea.value);
      });

      resultsContainer.appendChild(card);
    });

    showToast(`Generated 3 ${platform} bios!`, "success");
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    generateBios();
  });

  // Example Loader
  document.getElementById("btnLoadBioExample")?.addEventListener("click", () => {
    document.getElementById("bioBizName").value = "Sunbeam Artisan Bakery";
    document.getElementById("bioNiche").value = "Artisan Bakery & Coffee Bar";
    document.getElementById("bioBenefit").value = "fresh organic sourdough & morning pastries baked from scratch daily";
    document.getElementById("bioLocation").value = "East Austin, TX";
    document.getElementById("bioAudience").value = "pastry lovers and morning commuters";
    document.getElementById("bioCta").value = "Order fresh pickup or visit our cafe";
    document.getElementById("bioTone").value = "friendly";
    document.getElementById("bioPlatform").value = "instagram";
    generateBios();
  });

  // Initial Run
  generateBios();
}

/* ==========================================================================
   PART 5: PRODUCT DESCRIPTION GENERATOR (Predefined Templates, No AI API)
   ========================================================================== */

function initProductDescTool() {
  const form = document.getElementById("productDescForm");
  const resultsContainer = document.getElementById("productDescResults");
  if (!form || !resultsContainer) return;

  function generateProductDescription() {
    const name = document.getElementById("prodName")?.value.trim() || "Aura Thermal Mug";
    const category = document.getElementById("prodCategory")?.value.trim() || "Drinkware & Travel";
    const rawFeatures = document.getElementById("prodFeatures")?.value.trim() || "Double-wall stainless vacuum insulation, 100% leak-proof lid, keeps drinks hot for 12 hours";
    const benefit = document.getElementById("prodBenefit")?.value.trim() || "enjoy piping hot coffee or chilled iced tea anywhere without messy spills";
    const priceOffer = document.getElementById("prodOffer")?.value.trim() || "Free shipping on orders over $40";
    const style = document.getElementById("prodStyle")?.value || "ecommerce";

    const featuresList = rawFeatures
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    let output = {};

    if (style === "ecommerce") {
      output = {
        title: `${name} — Premium ${category}`,
        narrative: `Upgrade your daily routine with the all-new ${name}. Engineered specifically for those who appreciate premium quality and reliable everyday performance, this ${category.toLowerCase()} standout ensures you ${benefit}. Whether at home, in the office, or on the move, ${name} is crafted to deliver lasting value and effortless convenience.`,
        bullets: featuresList.length > 0 ? featuresList : [
          "Durable, premium-grade materials built for longevity",
          "Thoughtfully designed for effortless daily use",
          "Precision-engineered to exceed customer standards"
        ],
        guarantee: "100% Satisfaction Guarantee: Backed by our 30-day risk-free return policy.",
        cta: priceOffer ? `Order yours today. Special offer: ${priceOffer}!` : "Add to cart today and experience the difference!"
      };
    } else if (style === "story") {
      output = {
        title: `The Story Behind ${name}`,
        narrative: `We created ${name} with a simple philosophy: everyday tools should be beautiful, durable, and a joy to use. Crafted with meticulous attention to detail, every element of this ${category.toLowerCase()} item is designed to help you ${benefit}. You can feel the craftsmanship from the very first moment you hold it.`,
        bullets: featuresList.length > 0 ? featuresList : [
          "Hand-inspected for exceptional finish and durability",
          "Constructed with responsibly sourced materials",
          "Timeless aesthetic that looks great in any setting"
        ],
        guarantee: "Handcrafted care: Each piece is inspected to ensure flawless performance.",
        cta: priceOffer ? `Bring ${name} home today. ${priceOffer}.` : `Treat yourself or someone special to ${name} today.`
      };
    } else if (style === "social") {
      output = {
        title: `Say hello to your new favorite: ${name}! 🔥`,
        narrative: `Stop settling for ordinary ${category.toLowerCase()}. The ${name} is officially here so you can ${benefit}. Check out why customers are raving:`,
        bullets: featuresList,
        guarantee: "Hassle-free guarantee & fast local shipping.",
        cta: priceOffer ? `⚡ Limited Stock: ${priceOffer}. Click the link to claim yours!` : "⚡ Tap the link to shop now before stock runs out!"
      };
    } else {
      // Specs / Marketplace
      output = {
        title: `[FOR SALE] ${name} (${category})`,
        narrative: `Up for sale: ${name}. Condition: Brand new in original packaging. Great opportunity to ${benefit}.`,
        bullets: featuresList,
        guarantee: "Tested and verified in excellent condition.",
        cta: priceOffer ? `Price / Offer: ${priceOffer}. Message for pickup or fast dispatch.` : "Available for immediate pickup or delivery. Message with inquiries."
      };
    }

    // Format Plain Text
    const plainText = `${output.title}

${output.narrative}

Key Highlights:
${output.bullets.map(b => `• ${b}`).join("\n")}

${output.guarantee}

${output.cta}`;

    // Format HTML snippet
    const htmlSnippet = `<h3>${output.title}</h3>
<p>${output.narrative}</p>
<ul>
${output.bullets.map(b => `  <li>${b}</li>`).join("\n")}
</ul>
<p><strong>Guarantee:</strong> ${output.guarantee}</p>
<p><em>${output.cta}</em></p>`;

    resultsContainer.innerHTML = `
      <div class="result-card">
        <div class="result-meta">
          <span class="result-tag">${name} • ${style.toUpperCase()} Style</span>
          <span class="char-counter">${plainText.length} chars · ${plainText.split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <textarea id="productDescTextarea" class="result-text-area" rows="8">${plainText}</textarea>
        <div class="result-actions" style="flex-wrap: wrap;">
          <button type="button" id="btnCopyProductDesc" class="btn btn-primary btn-sm">
            <span>📋</span> Copy Description
          </button>
          <button type="button" id="btnCopyProductHtml" class="btn btn-secondary btn-sm">
            <span>🌐</span> Copy as HTML
          </button>
          <button type="button" id="btnDownloadProductTxt" class="btn btn-secondary btn-sm">
            <span>💾</span> Save TXT
          </button>
        </div>
      </div>
    `;

    document.getElementById("btnCopyProductDesc")?.addEventListener("click", () => {
      const val = document.getElementById("productDescTextarea")?.value;
      copyTextToClipboard(val, "Product description copied to clipboard!");
    });

    document.getElementById("btnCopyProductHtml")?.addEventListener("click", () => {
      copyTextToClipboard(htmlSnippet, "HTML snippet copied to clipboard!");
    });

    document.getElementById("btnDownloadProductTxt")?.addEventListener("click", () => {
      const val = document.getElementById("productDescTextarea")?.value;
      downloadTextFile(`${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-description.txt`, val);
    });

    showToast("Generated product description!", "success");
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    generateProductDescription();
  });

  // Example Button
  document.getElementById("btnLoadProductExample")?.addEventListener("click", () => {
    document.getElementById("prodName").value = "EcoGrip Ergonomic Gardening Shears";
    document.getElementById("prodCategory").value = "Lawn & Garden Tools";
    document.getElementById("prodFeatures").value = "High-carbon SK5 steel blades, cushioned non-slip grip, spring-action safety lock, rust-resistant titanium coating";
    document.getElementById("prodBenefit").value = "trim branches and prune roses with zero hand fatigue or strain";
    document.getElementById("prodOffer").value = "Free sharpening stone with every order";
    document.getElementById("prodStyle").value = "ecommerce";
    generateProductDescription();
  });

  // Initial Run
  generateProductDescription();
}

/* ==========================================================================
   PART 6: INSTANT RECEIPT & MINI-INVOICE GENERATOR (100% Local)
   ========================================================================== */

function initInvoiceTool() {
  const itemsTbody = document.getElementById("invoiceItemsTableBody");
  const btnAddItem = document.getElementById("btnAddInvoiceItem");
  const subtotalEl = document.getElementById("invSubtotalDisplay");
  const taxEl = document.getElementById("invTaxDisplay");
  const discountEl = document.getElementById("invDiscountDisplay");
  const grandTotalEl = document.getElementById("invGrandTotalDisplay");

  const taxRateInput = document.getElementById("invTaxRate");
  const discountInput = document.getElementById("invDiscount");

  if (!itemsTbody) return;

  function calculateTotals() {
    let subtotal = 0;
    const rows = itemsTbody.querySelectorAll("tr");
    rows.forEach(row => {
      const qty = parseFloat(row.querySelector(".inv-item-qty")?.value) || 0;
      const price = parseFloat(row.querySelector(".inv-item-price")?.value) || 0;
      const rowTotal = qty * price;
      const rowTotalEl = row.querySelector(".inv-item-total");
      if (rowTotalEl) rowTotalEl.textContent = `$${rowTotal.toFixed(2)}`;
      subtotal += rowTotal;
    });

    const taxRate = parseFloat(taxRateInput?.value) || 0;
    const discount = parseFloat(discountInput?.value) || 0;

    const discountAmount = Math.min(subtotal, discount);
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = (taxableAmount * taxRate) / 100;
    const grandTotal = taxableAmount + taxAmount;

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `$${taxAmount.toFixed(2)}`;
    if (discountEl) discountEl.textContent = `-$${discountAmount.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
  }

  function addRow(desc = "Consulting / Service", qty = 1, price = 50.00) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="form-control inv-item-desc" value="${desc}" placeholder="Item description" style="min-height:36px; padding:4px 8px;"></td>
      <td style="width: 70px;"><input type="number" class="form-control inv-item-qty" value="${qty}" min="1" step="1" style="min-height:36px; padding:4px 8px; text-align:center;"></td>
      <td style="width: 90px;"><input type="number" class="form-control inv-item-price" value="${price.toFixed(2)}" min="0" step="0.01" style="min-height:36px; padding:4px 8px; text-align:right;"></td>
      <td style="width: 80px; text-align: right; font-weight: 600;" class="inv-item-total">$${(qty * price).toFixed(2)}</td>
      <td style="width: 44px; text-align: center;">
        <button type="button" class="btn btn-secondary btn-sm btn-delete-row" title="Remove Item" style="min-height:32px; padding:2px 8px; color: var(--accent-danger);">✕</button>
      </td>
    `;

    tr.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", calculateTotals);
    });

    tr.querySelector(".btn-delete-row")?.addEventListener("click", () => {
      if (itemsTbody.children.length > 1) {
        tr.remove();
        calculateTotals();
      } else {
        showToast("Invoice must contain at least 1 item", "error");
      }
    });

    itemsTbody.appendChild(tr);
    calculateTotals();
  }

  btnAddItem?.addEventListener("click", () => {
    addRow("New Item / Service", 1, 25.00);
  });

  taxRateInput?.addEventListener("input", calculateTotals);
  discountInput?.addEventListener("input", calculateTotals);

  // Initial Rows
  addRow("Brand Identity Design", 1, 250.00);
  addRow("Social Media Setup & Bios", 1, 75.00);

  // Build Plain Text Receipt
  function generateTextReceipt() {
    const bizName = document.getElementById("invBizName")?.value.trim() || "FreeBiz Services";
    const bizPhone = document.getElementById("invBizContact")?.value.trim() || "support@freebiz.com";
    const clientName = document.getElementById("invClientName")?.value.trim() || "Valued Client";
    const invNum = document.getElementById("invNumber")?.value.trim() || "INV-1001";
    const invDate = document.getElementById("invDate")?.value || new Date().toISOString().split("T")[0];
    const notes = document.getElementById("invNotes")?.value.trim() || "Thank you for your business!";

    let lines = [];
    lines.push(`========================================`);
    lines.push(`          RECEIPT / INVOICE             `);
    lines.push(`========================================`);
    lines.push(`Merchant: ${bizName}`);
    lines.push(`Contact:  ${bizPhone}`);
    lines.push(`Invoice:  ${invNum}`);
    lines.push(`Date:     ${invDate}`);
    lines.push(`Client:   ${clientName}`);
    lines.push(`----------------------------------------`);
    lines.push(`ITEMS:`);

    const rows = itemsTbody.querySelectorAll("tr");
    rows.forEach(row => {
      const desc = row.querySelector(".inv-item-desc")?.value.trim() || "Item";
      const qty = row.querySelector(".inv-item-qty")?.value || 1;
      const price = parseFloat(row.querySelector(".inv-item-price")?.value || 0).toFixed(2);
      const total = (qty * price).toFixed(2);
      lines.push(` • ${desc} (x${qty} @ $${price}) = $${total}`);
    });

    lines.push(`----------------------------------------`);
    lines.push(`Subtotal:    ${subtotalEl?.textContent || "$0.00"}`);
    lines.push(`Discount:    ${discountEl?.textContent || "-$0.00"}`);
    lines.push(`Tax:         ${taxEl?.textContent || "$0.00"}`);
    lines.push(`GRAND TOTAL: ${grandTotalEl?.textContent || "$0.00"}`);
    lines.push(`----------------------------------------`);
    if (notes) {
      lines.push(`Notes: ${notes}`);
    }
    lines.push(`========================================`);
    return lines.join("\n");
  }

  // Copy Receipt Text
  document.getElementById("btnCopyInvoiceText")?.addEventListener("click", () => {
    const txt = generateTextReceipt();
    copyTextToClipboard(txt, "Text receipt copied to clipboard!");
  });

  // Download Receipt File
  document.getElementById("btnDownloadInvoiceTxt")?.addEventListener("click", () => {
    const txt = generateTextReceipt();
    const invNum = document.getElementById("invNumber")?.value.trim() || "receipt";
    downloadTextFile(`${invNum.toLowerCase().replace(/[^a-z0-9]/g, "-")}.txt`, txt);
  });

  // Print Invoice / Save as PDF
  document.getElementById("btnPrintInvoice")?.addEventListener("click", () => {
    window.print();
  });
}

/* ==========================================================================
   PART 7: MOBILE PHONE TESTING GUIDE & VERIFICATION CHECKER
   ========================================================================== */

function initMobileTestingGuide() {
  const phoneQrCanvas = document.getElementById("phoneTestQrCanvas");
  const phoneUrlText = document.getElementById("phoneTestUrlText");

  // Render QR Code pointing to this app's current URL for instant phone camera testing
  if (phoneQrCanvas) {
    const currentUrl = window.location.href;
    if (phoneUrlText) phoneUrlText.textContent = currentUrl;
    try {
      const qr = QRCodeEngine.generate(currentUrl, "M");
      const ctx = phoneQrCanvas.getContext("2d");
      const size = 200;
      const total = qr.size + 8;
      phoneQrCanvas.width = size;
      phoneQrCanvas.height = size;
      const cellSize = size / total;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = "#0f172a";
      for (let r = 0; r < qr.size; r++) {
        for (let c = 0; c < qr.size; c++) {
          if (qr.modules[r][c]) {
            ctx.fillRect(
              Math.round((c + 4) * cellSize),
              Math.round((r + 4) * cellSize),
              Math.ceil(cellSize),
              Math.ceil(cellSize)
            );
          }
        }
      }
    } catch (err) {
      console.warn("Could not render phone testing QR code:", err);
    }
  }

  // Interactive Checklist Persistence in localStorage
  const checklistItems = document.querySelectorAll(".test-checkbox");
  checklistItems.forEach((cb, idx) => {
    const saved = localStorage.getItem(`freebiz_check_${idx}`);
    if (saved === "true") cb.checked = true;

    cb.addEventListener("change", () => {
      localStorage.setItem(`freebiz_check_${idx}`, cb.checked ? "true" : "false");
      updateChecklistProgress();
    });
  });

  function updateChecklistProgress() {
    const total = checklistItems.length;
    let checked = 0;
    checklistItems.forEach(cb => {
      if (cb.checked) checked++;
    });
    const label = document.getElementById("testProgressLabel");
    if (label) {
      label.textContent = `${checked} of ${total} tests verified`;
      if (checked === total) {
        label.textContent = `All ${total} mobile tests verified! 🎉`;
      }
    }
  }

  document.getElementById("btnResetChecklist")?.addEventListener("click", () => {
    checklistItems.forEach((cb, idx) => {
      cb.checked = false;
      localStorage.removeItem(`freebiz_check_${idx}`);
    });
    updateChecklistProgress();
    showToast("Checklist reset", "normal");
  });

  updateChecklistProgress();
}

/* ==========================================================================
   PART 8: NAVIGATION CONTROLLER & APP INITIALIZATION
   ========================================================================== */

function initNavigation() {
  const views = {
    qr: document.getElementById("qrToolView"),
    bio: document.getElementById("bioToolView"),
    product: document.getElementById("productToolView"),
    invoice: document.getElementById("invoiceToolView"),
    guide: document.getElementById("guideToolView")
  };

  const desktopNavLinks = document.querySelectorAll(".desktop-nav .nav-link");
  const quickTabBtns = document.querySelectorAll(".quick-tab-btn");
  const bottomNavItems = document.querySelectorAll(".bottom-nav-item");

  function switchTab(tabKey) {
    // Hide all views, show targeted view
    Object.keys(views).forEach(key => {
      if (views[key]) {
        views[key].classList.toggle("active", key === tabKey);
      }
    });

    // Update Desktop Nav
    desktopNavLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.tab === tabKey);
    });

    // Update Mobile Quick Scroller Tabs
    quickTabBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });

    // Update Bottom Nav
    bottomNavItems.forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tabKey);
    });

    // Scroll to top of tool smoothly on mobile
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Bind Desktop Nav
  desktopNavLinks.forEach(link => {
    link.addEventListener("click", () => switchTab(link.dataset.tab));
  });

  // Bind Mobile Scroller Tabs
  quickTabBtns.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Bind Bottom Nav
  bottomNavItems.forEach(item => {
    item.addEventListener("click", () => switchTab(item.dataset.tab));
  });

  // Header "Test on Phone" button jump
  document.getElementById("btnHeaderTestPhone")?.addEventListener("click", () => {
    switchTab("guide");
  });

  // Footer jump links
  document.querySelectorAll("[data-footer-jump]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.footerJump);
    });
  });

  // Default to QR Code Tool
  switchTab("qr");
}

// Global DOM Ready Initialization
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initQRCodeTool();
  initBioTool();
  initProductDescTool();
  initInvoiceTool();
  initMobileTestingGuide();
});
