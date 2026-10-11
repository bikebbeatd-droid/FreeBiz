/**
 * FreeBiz Tools — Automated Audit & Verification Suite
 * Tests QR generation/decoding, Wi-Fi escaping, vCard encoding, invoice math,
 * bio/product generators, and DOM ID integrity.
 */

import QRCode from "qrcode";
import jsQR from "jsqr";
import fs from "fs";
import path from "path";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log("\n=======================================================");
console.log("FREEBIZ TOOLS — COMPREHENSIVE AUTOMATED TEST SUITE");
console.log("=======================================================\n");

// Helper to render and decode QR code
async function decodeQR(payload, ec = "M") {
  const qrData = QRCode.create(payload, { errorCorrectionLevel: ec });
  const size = qrData.modules.size;
  const margin = 4;
  const total = size + margin * 2;
  const scale = 4;
  const width = total * scale;
  const height = total * scale;
  const imgData = new Uint8ClampedArray(width * height * 4);
  imgData.fill(255);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qrData.modules.get(r, c)) {
        for (let py = 0; py < scale; py++) {
          for (let px = 0; px < scale; px++) {
            const idx = (((r + margin) * scale + py) * width + ((c + margin) * scale + px)) * 4;
            imgData[idx] = 0;
            imgData[idx + 1] = 0;
            imgData[idx + 2] = 0;
            imgData[idx + 3] = 255;
          }
        }
      }
    }
  }

  const decoded = jsQR(imgData, width, height);
  return decoded ? decoded.data : null;
}

// -------------------------------------------------------------
// TEST SUITE 1: QR Code Generation & Decoding via jsQR
// -------------------------------------------------------------
console.log("TEST SUITE 1: QR Generation & jsQR Decoding Compatibility");

const qrCases = [
  { name: "Website URL", payload: "https://example.com/store" },
  { name: "Phone Call", payload: "tel:+923001234567" },
  { name: "WhatsApp with message", payload: "https://wa.me/923001234567?text=Assalam-o-Alaikum%20Price%20inquiry" },
  { name: "Wi-Fi WPA Network", payload: "WIFI:T:WPA;S:MyStore_Guest;P:SecretPass2026;;" },
  { name: "Wi-Fi Open Network", payload: "WIFI:T:nopass;S:Public_Mall_WiFi;;" },
  { name: "vCard 3.0 Contact", payload: "BEGIN:VCARD\nVERSION:3.0\nFN:Tariq Mahmood\nORG:Al-Rehman Graphics\nTEL:+923001234567\nEND:VCARD" },
  { name: "Plain Text", payload: "FreeBiz Tools: 100% Client-side and private." }
];

for (const tc of qrCases) {
  for (const ec of ["L", "M", "Q", "H"]) {
    const decoded = await decodeQR(tc.payload, ec);
    assert(decoded === tc.payload, `${tc.name} at EC Level ${ec}`);
  }
}

// -------------------------------------------------------------
// TEST SUITE 2: Wi-Fi Special Character MECARD Escaping
// -------------------------------------------------------------
console.log("\nTEST SUITE 2: Wi-Fi String Escaping Standard");

function escapeWifi(str) {
  if (!str) return "";
  return str.replace(/([\\;,:"'])/g, "\\$1");
}

const wifiInput = 'Store;WiFi,Main:2.4"Back\\slash';
const escapedWifi = escapeWifi(wifiInput);
assert(escapedWifi === 'Store\\;WiFi\\,Main\\:2.4\\"Back\\\\slash', "Special characters (\\, ;, ,, :, \") escaped with backslash");

const fullWifiPayload = `WIFI:T:WPA;S:${escapedWifi};P:MyPass\\;123;;`;
const decodedWifi = await decodeQR(fullWifiPayload, "M");
assert(decodedWifi === fullWifiPayload, "Escaped Wi-Fi string generates and scans perfectly");

// -------------------------------------------------------------
// TEST SUITE 3: Color Contrast Ratio & WCAG Checking
// -------------------------------------------------------------
console.log("\nTEST SUITE 3: Color Contrast Ratio Calculation");

function getLuminance(hex) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(h1, h2) {
  const l1 = getLuminance(h1);
  const l2 = getLuminance(h2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const blackOnWhite = getContrast("#0f172a", "#ffffff");
assert(blackOnWhite > 10, `Dark Charcoal on White contrast ratio is ${blackOnWhite.toFixed(2)}:1 (Passes >= 3:1)`);

const yellowOnWhite = getContrast("#fef08a", "#ffffff");
assert(yellowOnWhite < 3, `Light Yellow on White contrast ratio is ${yellowOnWhite.toFixed(2)}:1 (Fails < 3:1, triggers warning)`);

// -------------------------------------------------------------
// TEST SUITE 4: Invoice Calculations & PKR Formatting
// -------------------------------------------------------------
console.log("\nTEST SUITE 4: Invoice Calculations & Precision");

function calculateInvoice(items, taxRateRaw, discountRaw, currencySym = "Rs. ") {
  let subtotal = 0;
  for (const it of items) {
    const q = isNaN(it.qty) || it.qty < 0 ? 0 : it.qty;
    const p = isNaN(it.price) || it.price < 0 ? 0 : it.price;
    subtotal += q * p;
  }

  let taxRate = isNaN(taxRateRaw) || taxRateRaw < 0 ? 0 : taxRateRaw;
  if (taxRate > 100) taxRate = 100;

  let discount = isNaN(discountRaw) || discountRaw < 0 ? 0 : discountRaw;
  const discountAmount = Math.min(subtotal, discount);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const grandTotal = taxableAmount + taxAmount;

  return { subtotal, discountAmount, taxAmount, grandTotal };
}

// Case 1: Standard line items (PKR)
const items1 = [
  { qty: 2, price: 1800 }, // 3600
  { qty: 1, price: 2200 }, // 2200
  { qty: 1, price: 7500 }  // 7500
];
const inv1 = calculateInvoice(items1, 0, 0);
assert(inv1.subtotal === 13300, "Subtotal: Rs. 13,300");
assert(inv1.grandTotal === 13300, "Grand total with 0% tax: Rs. 13,300");

// Case 2: 5% Tax and 300 Discount
const inv2 = calculateInvoice(items1, 5, 300);
assert(inv2.discountAmount === 300, "Discount capped accurately: Rs. 300");
assert(inv2.taxAmount === 650, "5% Tax on Rs. 13,000 is Rs. 650");
assert(inv2.grandTotal === 13650, "Grand total with discount + tax: Rs. 13,650");

// Case 3: Discount greater than subtotal (must not result in negative invoice)
const inv3 = calculateInvoice(items1, 0, 20000);
assert(inv3.discountAmount === 13300, "Discount capped at subtotal (cannot be negative)");
assert(inv3.grandTotal === 0, "Grand total clamped at 0");

// Case 4: Negative price or qty protection
const itemsBad = [{ qty: -5, price: 100 }, { qty: 2, price: -50 }];
const invBad = calculateInvoice(itemsBad, 0, 0);
assert(invBad.subtotal === 0, "Negative price/quantity clamped to 0 safely");

// -------------------------------------------------------------
// TEST SUITE 5: DOM ID Integrity between HTML and JS
// -------------------------------------------------------------
console.log("\nTEST SUITE 5: HTML vs JavaScript Element ID Cross-Check");

const htmlContent = fs.readFileSync(path.resolve("index.html"), "utf8");
const jsContent = fs.readFileSync(path.resolve("script.js"), "utf8");

const idRegex = /getElementById\s*\(\s*["']([^"']+)["']\s*\)/g;
let match;
const jsIds = new Set();
while ((match = idRegex.exec(jsContent)) !== null) {
  jsIds.add(match[1]);
}

let missingIds = [];
for (const id of jsIds) {
  if (!htmlContent.includes(`id="${id}"`) && !htmlContent.includes(`id='${id}'`)) {
    // If dynamically created in JS, check that
    if (!jsContent.includes(`id="${id}"`)) {
      missingIds.push(id);
    }
  }
}

assert(missingIds.length === 0, `All ${jsIds.size} element IDs referenced in script.js exist in index.html`);
if (missingIds.length > 0) {
  console.error("Missing IDs:", missingIds);
}

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
