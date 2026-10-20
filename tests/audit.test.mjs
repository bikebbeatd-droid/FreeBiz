/**
 * FreeBiz Tools — Production Automated Test & Audit Suite
 * 
 * Directly imports and verifies the REAL production modules in src/core.js,
 * testing QR generation/decoding with jsQR, XSS escaping, dangerous input handling,
 * invoice arithmetic precision, bio/product template processing, and DOM ID integrity.
 */

import QRCode from "qrcode";
import jsQR from "jsqr";
import fs from "fs";
import path from "path";

import { PNG } from "pngjs";

// Direct import of REAL PRODUCTION CODE
import {
  escapeHtml,
  validateAndFormatUrl,
  validatePhoneNumber,
  formatWhatsAppPayload,
  escapeWifiField,
  formatWifiPayload,
  escapeVcardField,
  formatVcardPayload,
  isValidHexColor,
  getLuminance,
  getContrastRatio,
  validateQuantity,
  validatePrice,
  validateTaxRate,
  validateDiscount,
  calculateInvoiceSummary,
  formatCurrency,
  generateReceiptTextSlip,
  generateBioOutputs,
  generateProductDescriptionOutputs,
  safeGetStorage,
  safeSetStorage,
  safeRemoveStorage,
  isSafeUrlToOpen,
  decodeQrPixels,
  decodeBarcodePixels,
  decodePixelsWithZxing,
  applyContrastStretching,
  savePngToNativeOrWeb,
  SUPPORTED_BARCODE_FORMATS,
  getFormatDisplayName,
  parseQrPayload,
  parseCsvData
} from "../src/core.js";

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
console.log("FREEBIZ TOOLS — PRODUCTION CODE VERIFICATION SUITE");
console.log("=======================================================\n");

// Helper to render QR code and decode using jsQR
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
// TEST SUITE 1: XSS Security & HTML Escaping (Real Production Code)
// -------------------------------------------------------------
console.log("TEST SUITE 1: XSS Security & Dangerous Input Handling");

const xssPayloads = [
  "<script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  "';alert(String.fromCharCode(88,83,83))//",
  "<svg/onload=alert('XSS')>",
  '"><script>alert(document.cookie)</script>'
];

for (const p of xssPayloads) {
  const escaped = escapeHtml(p);
  assert(!escaped.includes("<") && !escaped.includes(">"), `HTML tags escaped: ${p.slice(0, 25)}...`);
  assert(!escaped.includes('"') || escaped.includes("&quot;"), "Quotes safely converted to HTML entities");
}

assert(escapeHtml(null) === "", "Null safely converts to empty string");
assert(escapeHtml(undefined) === "", "Undefined safely converts to empty string");
assert(escapeHtml("Tom & Jerry") === "Tom &amp; Jerry", "Ampersands escaped correctly");
assert(escapeHtml("Urdu Text: چائے اور پراٹھا") === "Urdu Text: چائے اور پراٹھا", "Unicode and Urdu text preserved without distortion");

// -------------------------------------------------------------
// TEST SUITE 2: URL Validation & Scheme Security (Real Production Code)
// -------------------------------------------------------------
console.log("\nTEST SUITE 2: URL Validation & Dangerous Scheme Rejection");

const dangerousUrls = [
  "javascript:alert(1)",
  "JAVASCRIPT:alert('hack')",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd"
];

for (const bad of dangerousUrls) {
  const res = validateAndFormatUrl(bad);
  assert(res.valid === false && res.url === null, `Rejected dangerous scheme: ${bad.slice(0, 25)}`);
}

const validUrls = [
  { in: "https://example.com/shop", out: "https://example.com/shop" },
  { in: "http://mybusiness.pk", out: "http://mybusiness.pk/" },
  { in: "store.online.pk/catalog?item=12", out: "https://store.online.pk/catalog?item=12" }
];

for (const good of validUrls) {
  const res = validateAndFormatUrl(good.in);
  assert(res.valid === true && res.url === good.out, `Normalized valid URL: ${good.in} -> ${res.url}`);
}

assert(validateAndFormatUrl("").valid === false, "Empty URL input rejected cleanly");
assert(validateAndFormatUrl("   ").valid === false, "Whitespace-only URL input rejected cleanly");

// -------------------------------------------------------------
// TEST SUITE 3: Phone & WhatsApp Validation (Real Production Code)
// -------------------------------------------------------------
console.log("\nTEST SUITE 3: Phone & WhatsApp International Formatting");

const phoneCases = [
  { in: "+92 300 1234567", expected: "+923001234567", valid: true },
  { in: "(021) 3456-7890", expected: "02134567890", valid: true },
  { in: "+1-800-555-0199", expected: "+18005550199", valid: true },
  { in: "123", expected: null, valid: false }, // too short
  { in: "abc-def-ghij", expected: null, valid: false } // letters
];

for (const pc of phoneCases) {
  const res = validatePhoneNumber(pc.in);
  assert(res.valid === pc.valid, `Phone validation '${pc.in}': valid=${res.valid}`);
  if (pc.valid) {
    assert(res.phone === pc.expected, `Phone normalized cleanly to ${res.phone}`);
  }
}

// WhatsApp payload encoding
const wa1 = formatWhatsAppPayload("923001234567", "Hello & Welcome! Price?");
assert(wa1.valid === true, "WhatsApp payload valid with country code");
assert(wa1.payload === "https://wa.me/923001234567?text=Hello%20%26%20Welcome!%20Price%3F", "WhatsApp message URL-encoded accurately");

const waNoMsg = formatWhatsAppPayload("+92-300-1234567", "");
assert(waNoMsg.payload === "https://wa.me/923001234567", "WhatsApp without message outputs clean direct link");

const waInvalid = formatWhatsAppPayload("123");
assert(waInvalid.valid === false, "WhatsApp with invalid short number rejected");

// -------------------------------------------------------------
// TEST SUITE 4: Wi-Fi MECARD Escaping & Open Networks (Real Production Code)
// -------------------------------------------------------------
console.log("\nTEST SUITE 4: Wi-Fi MECARD Escaping & Open Networks");

const specialSsid = 'Shop;WiFi,2.4:"Corner"\\Back';
const wifiEscaped = escapeWifiField(specialSsid);
assert(wifiEscaped === 'Shop\\;WiFi\\,2.4\\:\\"Corner\\"\\\\Back', "All 5 MECARD characters (\\, ;, ,, :, \") escaped with backslash");

// Standard WPA Wi-Fi
const wifiWpa = formatWifiPayload({
  ssid: specialSsid,
  password: 'Pass;123"Secret',
  encryption: "WPA"
});
assert(wifiWpa.valid === true, "Wi-Fi WPA payload valid");
assert(wifiWpa.payload.includes("P:Pass\\;123\\\"Secret"), "Password escaped inside payload");

// Open Network (nopass) must NOT require or contain password
const wifiOpen = formatWifiPayload({
  ssid: "Airport_Free_WiFi",
  encryption: "nopass"
});
assert(wifiOpen.valid === true, "Open Wi-Fi network valid");
assert(wifiOpen.payload === "WIFI:T:nopass;S:Airport_Free_WiFi;;", "Open Wi-Fi has T:nopass and no P: parameter");

// -------------------------------------------------------------
// TEST SUITE 5: vCard 3.0 Encoding (Real Production Code)
// -------------------------------------------------------------
console.log("\nTEST SUITE 5: vCard 3.0 Formatting & Escaping");

const vcardRes = formatVcardPayload({
  name: "Tariq Mahmood",
  org: "Al-Rehman Graphics; Printing, Ltd.",
  tel: "+92 300 1234567",
  email: "contact@alrehman.pk",
  title: "Managing Partner"
});
assert(vcardRes.valid === true, "vCard payload valid");
assert(vcardRes.payload.includes("FN:Tariq Mahmood"), "Formatted Name FN included");
assert(vcardRes.payload.includes("N:Mahmood;Tariq;;;"), "Structured Name N (Last;First) included");
assert(vcardRes.payload.includes("ORG:Al-Rehman Graphics\\; Printing\\, Ltd."), "Special characters in ORG escaped");
assert(vcardRes.payload.includes("TEL;TYPE=CELL,VOICE:+92 300 1234567"), "Telephone included");
assert(vcardRes.payload.includes("END:VCARD"), "vCard ends correctly");

// -------------------------------------------------------------
// TEST SUITE 6: Full QR Scan & Decode Verification (jsQR)
// -------------------------------------------------------------
console.log("\nTEST SUITE 6: QR Generation & jsQR Decoding Roundtrip");

const payloadsToTest = [
  { name: "Website URL", payload: "https://example.com/store" },
  { name: "Phone Call", payload: "tel:+923001234567" },
  { name: "WhatsApp with message", payload: wa1.payload },
  { name: "Wi-Fi WPA Network", payload: wifiWpa.payload },
  { name: "Wi-Fi Open Network", payload: wifiOpen.payload },
  { name: "vCard 3.0", payload: vcardRes.payload },
  { name: "Plain Text Unicode", payload: "FreeBiz Tools: 100% Client-Side. مفت بزنس ٹولز" }
];

for (const pt of payloadsToTest) {
  for (const ec of ["L", "M", "Q", "H"]) {
    const decoded = await decodeQR(pt.payload, ec);
    assert(decoded === pt.payload, `${pt.name} at EC Level ${ec} matches input byte-for-byte`);
  }
}

// -------------------------------------------------------------
// TEST SUITE 7: Color Contrast & WCAG 2.1 (Real Production Code)
// -------------------------------------------------------------
console.log("\nTEST SUITE 7: Color Contrast & WCAG 2.1 Thresholds");

assert(isValidHexColor("#0f172a") === true, "#0f172a is valid hex color");
assert(isValidHexColor("#ffffff") === true, "#ffffff is valid hex color");
assert(isValidHexColor("red") === false, "Named color rejected by hex validator");
assert(isValidHexColor("#12345") === false, "5-char hex rejected");

const crHigh = getContrastRatio("#0f172a", "#ffffff");
assert(crHigh > 10, `Dark Charcoal on White contrast ratio is ${crHigh.toFixed(2)}:1 (Passes >= 3:1)`);

const crLow = getContrastRatio("#fef3c7", "#ffffff");
assert(crLow < 3, `Light Cream on White contrast ratio is ${crLow.toFixed(2)}:1 (Fails < 3:1, triggers warning)`);

// -------------------------------------------------------------
// TEST SUITE 8: Invoice Mathematics & Precision (Real Production Code)
// -------------------------------------------------------------
console.log("\nTEST SUITE 8: Invoice Validation & Arithmetic Precision");

// Quantity tests
assert(validateQuantity(5) === 5, "Integer 5 validated");
assert(validateQuantity("3") === 3, "Numeric string '3' converted to 3");
assert(validateQuantity(2.8) === 2, "Float 2.8 truncated to positive integer 2");
assert(validateQuantity(0) === 0, "Zero quantity rejected as 0");
assert(validateQuantity(-4) === 0, "Negative quantity clamped to 0");
assert(validateQuantity(NaN) === 0, "NaN quantity clamped to 0");
assert(validateQuantity(Infinity) === 0, "Infinity quantity clamped to 0");
assert(validateQuantity(10000000) === 1000000, "Excessive quantity capped to 1,000,000");

// Price tests
assert(validatePrice(150.50) === 150.50, "Decimal price 150.50 validated");
assert(validatePrice("24.99") === 24.99, "Price string '24.99' validated");
assert(validatePrice(-10) === 0, "Negative price clamped to 0");
assert(validatePrice(NaN) === 0, "NaN price clamped to 0");
assert(validatePrice(Infinity) === 0, "Infinity price clamped to 0");

// Tax rate tests
assert(validateTaxRate(5) === 5, "5% Tax rate validated");
assert(validateTaxRate(0) === 0, "0% Tax rate validated");
assert(validateTaxRate(-2) === 0, "Negative tax rate clamped to 0");
assert(validateTaxRate(150) === 100, "Tax rate above 100% capped at 100%");

// Discount limits
assert(validateDiscount(500, 1000) === 500, "Valid discount accepted");
assert(validateDiscount(1500, 1000) === 1000, "Discount capped at subtotal (cannot exceed)");
assert(validateDiscount(-50, 1000) === 0, "Negative discount clamped to 0");

// Real Line Items Case 1: Standard Pakistani Business Order (PKR)
const items1 = [
  { desc: "Flex Banner Printing (10x4 ft)", qty: 2, price: 1800 }, // 3600
  { desc: "Visiting Cards (1000 Pcs)", qty: 1, price: 2200 },       // 2200
  { desc: "Social Media Post Kit", qty: 1, price: 7500 }            // 7500
];
const inv1 = calculateInvoiceSummary(items1, 0, 0);
assert(inv1.subtotal === 13300, "Subtotal: Rs. 13,300");
assert(inv1.discount === 0, "Discount: Rs. 0");
assert(inv1.taxAmount === 0, "Tax: Rs. 0");
assert(inv1.grandTotal === 13300, "Grand total with 0% tax: Rs. 13,300");

// Case 2: 5% Tax and 300 Discount
const inv2 = calculateInvoiceSummary(items1, 5, 300);
assert(inv2.discount === 300, "Discount: Rs. 300");
assert(inv2.taxableAmount === 13000, "Taxable amount: Rs. 13,000");
assert(inv2.taxAmount === 650, "5% Tax on Rs. 13,000 is Rs. 650");
assert(inv2.grandTotal === 13650, "Grand total with discount + tax: Rs. 13,650");
assert(inv2.grandTotal === inv2.taxableAmount + inv2.taxAmount, "Mathematical consistency guaranteed");

// Case 3: Discount exceeds subtotal -> grand total clamped to 0
const inv3 = calculateInvoiceSummary(items1, 5, 50000);
assert(inv3.discount === 13300, "Discount strictly capped at subtotal");
assert(inv3.taxableAmount === 0, "Taxable amount is 0");
assert(inv3.grandTotal === 0, "Grand total clamped at 0 (never negative)");

// Case 4: Decimal prices and cent rounding
const itemsDec = [
  { desc: "Single Item A", qty: 3, price: 19.99 }, // 59.97
  { desc: "Single Item B", qty: 1, price: 0.05 }   // 0.05
];
const invDec = calculateInvoiceSummary(itemsDec, 8.25, 10.00);
assert(invDec.subtotal === 60.02, `Subtotal: ${invDec.subtotal}`);
assert(invDec.discount === 10.00, `Discount: ${invDec.discount}`);
assert(invDec.taxableAmount === 50.02, `Taxable: ${invDec.taxableAmount}`);
assert(invDec.taxAmount === 4.13, `Tax amount: ${invDec.taxAmount}`);
assert(invDec.grandTotal === 54.15, `Grand total: ${invDec.grandTotal}`);

// Receipt slip text generation
const slip = generateReceiptTextSlip({
  bizName: "Al-Rehman Graphics",
  bizContact: "+92 300 1234567",
  clientName: "Tariq Mahmood",
  invNumber: "REC-2026-081",
  currencyCode: "PKR",
  currencySymbol: "Rs. ",
  items: items1,
  taxRate: 5,
  discount: 300
});
assert(slip.includes("Merchant: Al-Rehman Graphics"), "Merchant name in receipt slip");
assert(slip.includes("Receipt#: REC-2026-081"), "Receipt number in slip");
assert(slip.includes("Subtotal:    Rs. 13,300.00"), "Receipt subtotal matches calculator");
assert(slip.includes("Discount:    -Rs. 300.00"), "Receipt discount matches calculator");
assert(slip.includes("Tax (5%):   Rs. 650.00"), "Receipt tax matches calculator");
assert(slip.includes("GRAND TOTAL: Rs. 13,650.00"), "Receipt grand total matches calculator");

// Regression Case 5: Zero-quantity and empty invoice items
const invZeroQty = calculateInvoiceSummary([{ desc: "Test", qty: 0, price: 500 }], 0, 0);
assert(invZeroQty.subtotal === 0, "Item with qty 0 yields 0 subtotal");
assert(invZeroQty.grandTotal === 0, "Grand total with 0 qty is 0");

const invEmpty = calculateInvoiceSummary([], 10, 50);
assert(invEmpty.subtotal === 0, "Empty items array yields 0 subtotal");
assert(invEmpty.grandTotal === 0, "Empty items array yields 0 grand total");

assert(validateQuantity(0.9) === 0, "Float < 1 truncated to 0");
assert(validatePrice(1e12) === 1000000000, "Extreme price clamped to maximum 1,000,000,000");
assert(validateTaxRate(250) === 100, "Tax rate > 100% clamped to 100%");

// -------------------------------------------------------------
// TEST SUITE 9: Product Description Generation & Safe HTML Output
// -------------------------------------------------------------
console.log("\nTEST SUITE 9: Product Description Generator & Escaped HTML");

const prodRes = generateProductDescriptionOutputs({
  name: "EcoGrip <Shears>",
  category: "Gardening & Tools",
  rawFeatures: "SK5 Steel, Anti-Rust, Grip > Rubber",
  benefit: "cut branches with 'zero' effort",
  priceOffer: "COD Available & Free Delivery",
  style: "ecommerce"
});

assert(prodRes.valid === true, "Product description generated");
assert(prodRes.plainText.includes("EcoGrip <Shears>"), "Plain text retains readable characters");
// Check HTML snippet safety
assert(!prodRes.htmlSnippet.includes("<Shears>"), "Unescaped <Shears> eliminated from HTML snippet");
assert(prodRes.htmlSnippet.includes("EcoGrip &lt;Shears&gt;"), "Product name escaped in HTML snippet");
assert(prodRes.htmlSnippet.includes("Grip &gt; Rubber"), "Bullet feature escaped in HTML snippet");
assert(prodRes.htmlSnippet.includes("&apos;zero&apos;") || prodRes.htmlSnippet.includes("&#39;zero&#39;"), "Quotes in benefit escaped in HTML snippet");

// Empty input handling
const prodEmpty = generateProductDescriptionOutputs({ name: "" });
assert(prodEmpty.valid === false, "Empty product inputs safely rejected with error message");

// -------------------------------------------------------------
// TEST SUITE 10: Business Bio Generation (Real Production Code)
// -------------------------------------------------------------
console.log("\nTEST SUITE 10: Business Bio Generator");

const bioRes = generateBioOutputs({
  name: "Karak & Co.",
  niche: "Chai & Snacks",
  benefit: "hot fresh matka chai",
  location: "Lahore",
  tone: "friendly",
  platform: "instagram"
});

assert(bioRes.valid === true, "Bio generated successfully");
assert(bioRes.results.length === 3, "Generated 3 distinct bio drafts");
assert(bioRes.results[0].text.includes("Karak & Co."), "Business name substituted into template");
assert(bioRes.results[0].text.includes("hot fresh matka chai"), "Benefit substituted into template");
assert(bioRes.results[0].charCount > 20, "Character count computed");
assert(bioRes.results[0].wordCount > 3, "Word count computed");

// Empty bio inputs
const bioEmpty = generateBioOutputs({ name: "" });
assert(bioEmpty.valid === false, "Empty bio inputs safely rejected with error message");

// -------------------------------------------------------------
// TEST SUITE 11: Safe Storage Handling (Graceful Degradation)
// -------------------------------------------------------------
console.log("\nTEST SUITE 11: Storage Safety Wrappers");

// In Node environment without window.localStorage, safe helpers must not throw
assert(safeGetStorage("test_key") === null, "safeGetStorage gracefully returns null outside browser");
assert(safeSetStorage("test_key", "val") === false, "safeSetStorage gracefully returns false without throwing");
assert(safeRemoveStorage("test_key") === false, "safeRemoveStorage gracefully returns false without throwing");

// -------------------------------------------------------------
// TEST SUITE 12: DOM ID Integrity between HTML and JS
// -------------------------------------------------------------
console.log("\nTEST SUITE 12: HTML vs JavaScript Element ID Cross-Check");

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
// TEST SUITE 13: QR Decoder & Real Pixel Decoding
// -------------------------------------------------------------
console.log("\nTEST SUITE 13: Live Image & Pixel QR Decoder (jsQR Integration)");

// Create a real QR matrix to test decodeQrPixels
const testPayload = "https://freebiz.pk/scan-test-ok";
const qrObj = QRCode.create(testPayload, { errorCorrectionLevel: "M" });
const modSize = 4;
const border = 4;
const modulesCount = qrObj.modules.size;
const imgDim = (modulesCount + border * 2) * modSize;
const pixelData = new Uint8ClampedArray(imgDim * imgDim * 4);

// Fill with white background
pixelData.fill(255);

// Render QR modules onto RGBA buffer
for (let r = 0; r < modulesCount; r++) {
  for (let c = 0; c < modulesCount; c++) {
    if (qrObj.modules.get(r, c)) {
      for (let y = 0; y < modSize; y++) {
        for (let x = 0; x < modSize; x++) {
          const px = ((border + c) * modSize + x);
          const py = ((border + r) * modSize + y);
          const idx = (py * imgDim + px) * 4;
          pixelData[idx] = 0;     // R
          pixelData[idx + 1] = 0; // G
          pixelData[idx + 2] = 0; // B
          pixelData[idx + 3] = 255;
        }
      }
    }
  }
}

const decodeRes = decodeQrPixels(pixelData, imgDim, imgDim);
assert(decodeRes.success === true, "decodeQrPixels successfully detected and decoded QR code");
assert(decodeRes.data === testPayload, `Decoded payload matches input exactly: ${decodeRes.data}`);

// Test failure on blank image
const blankPixels = new Uint8ClampedArray(100 * 100 * 4);
blankPixels.fill(255);
const blankRes = decodeQrPixels(blankPixels, 100, 100);
assert(blankRes.success === false, "Blank image correctly rejected with friendly error");
assert(blankRes.error.includes("No readable QR code"), "Error explains that no code was found");

// Test dimension validation
const invalidDimRes = decodeQrPixels(blankPixels, 0, 100);
assert(invalidDimRes.success === false, "Zero width rejected cleanly");

// -------------------------------------------------------------
// TEST SUITE 14: QR Payload Parser & Structured Metadata
// -------------------------------------------------------------
console.log("\nTEST SUITE 14: QR Payload Parser & Metadata Extraction");

// 1. Wi-Fi
const wifiPayload = "WIFI:S:FreeBiz_HQ;T:WPA;P:Secret\\;Pass\\:123;H:false;;";
const parsedWifi = parseQrPayload(wifiPayload);
assert(parsedWifi.type === "wifi", "Identified Wi-Fi network type");
assert(parsedWifi.details.ssid === "FreeBiz_HQ", `Parsed SSID: ${parsedWifi.details.ssid}`);
assert(parsedWifi.details.encryption === "WPA", `Parsed encryption: ${parsedWifi.details.encryption}`);
assert(parsedWifi.details.password === "Secret;Pass:123", `Unescaped password: ${parsedWifi.details.password}`);
assert(parsedWifi.details.hidden === "No", "Hidden flag identified");

// Open Wi-Fi
const parsedOpenWifi = parseQrPayload("WIFI:S:Guest_WiFi;T:nopass;;");
assert(parsedOpenWifi.type === "wifi", "Open Wi-Fi identified");
assert(parsedOpenWifi.details.encryption.includes("Open"), "Open encryption identified");

// 2. vCard 3.0
const vcardPayload = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Fatima Noor\r\nORG:Noor Textiles\r\nTEL:+923001234567\r\nEMAIL:fatima@noortextiles.pk\r\nURL:https://noortextiles.pk\r\nEND:VCARD";
const parsedVcard = parseQrPayload(vcardPayload);
assert(parsedVcard.type === "vcard", "Identified vCard contact card");
assert(parsedVcard.details.name === "Fatima Noor", `Parsed contact name: ${parsedVcard.details.name}`);
assert(parsedVcard.details.organization === "Noor Textiles", "Parsed organization");
assert(parsedVcard.details.phone === "+923001234567", "Parsed phone number");
assert(parsedVcard.details.email === "fatima@noortextiles.pk", "Parsed email");
assert(parsedVcard.isSafeUrl === true, "vCard website verified as safe URL");

// 3. WhatsApp Direct Chat
const waPayload = "https://wa.me/923001234567?text=Hello%20Catalog%20Price";
const parsedWa = parseQrPayload(waPayload);
assert(parsedWa.type === "whatsapp", "Identified WhatsApp chat link");
assert(parsedWa.details.phone === "+923001234567", `Parsed WhatsApp phone: ${parsedWa.details.phone}`);
assert(parsedWa.details.message === "Hello Catalog Price", `Parsed decoded message: ${parsedWa.details.message}`);

// 4. Telephone
const phonePayload = "tel:+923001234567";
const parsedPhone = parseQrPayload(phonePayload);
assert(parsedPhone.type === "phone", "Identified Phone Call payload");
assert(parsedPhone.details.phone === "+923001234567", "Extracted phone digits");

// 5. Email
const emailPayload = "mailto:sales@shop.pk?subject=Order";
const parsedEmail = parseQrPayload(emailPayload);
assert(parsedEmail.type === "email", "Identified Email payload");
assert(parsedEmail.details.email === "sales@shop.pk", "Extracted email address");

// 6. Website URL
const urlPayload = "https://example.com/products?ref=qr";
const parsedUrl = parseQrPayload(urlPayload);
assert(parsedUrl.type === "url", "Identified Website URL payload");
assert(parsedUrl.isSafeUrl === true, "Marked safe URL");
assert(parsedUrl.safeUrl === urlPayload, "Safe URL preserved");

// 7. Plain Text
const textPayload = "Item 102 - Shelf B4 - Warehouse Lahore";
const parsedText = parseQrPayload(textPayload);
assert(parsedText.type === "text", "Identified Plain Text payload");
assert(parsedText.details.length === textPayload.length, "Computed text length");

// 8. Empty payload
const parsedEmpty = parseQrPayload("");
assert(parsedEmpty.type === "unknown", "Empty payload returns unknown type");

// -------------------------------------------------------------
// TEST SUITE 15: Safe URL Action Verifier
// -------------------------------------------------------------
console.log("\nTEST SUITE 15: Safe URL Action Verifier");

assert(isSafeUrlToOpen("https://google.com") === true, "Valid HTTPS URL permitted");
assert(isSafeUrlToOpen("http://mybiz.pk/page") === true, "Valid HTTP URL permitted");
assert(isSafeUrlToOpen("store.online.pk") === true, "Valid domain name permitted");
assert(isSafeUrlToOpen("javascript:alert(1)") === false, "Dangerous javascript: scheme rejected");
assert(isSafeUrlToOpen("JAVASCRIPT:alert(document.cookie)") === false, "Case-insensitive javascript: rejected");
assert(isSafeUrlToOpen("data:text/html,<script>alert(1)</script>") === false, "Dangerous data: scheme rejected");
assert(isSafeUrlToOpen("vbscript:msgbox(1)") === false, "Dangerous vbscript: scheme rejected");
assert(isSafeUrlToOpen("file:///etc/passwd") === false, "Dangerous file: scheme rejected");
assert(isSafeUrlToOpen("") === false, "Empty URL rejected");
assert(isSafeUrlToOpen(null) === false, "Null URL rejected");

// -------------------------------------------------------------
// TEST SUITE 16: QR PNG Generation & Decoding Roundtrip Integrity
// -------------------------------------------------------------
console.log("\nTEST SUITE 16: QR PNG Generation & Decoding Roundtrip");

const roundtripPayload = "FreeBiz QR Scanner Verified Roundtrip 2026! +92 300 1234567";
const pngBuffer = await QRCode.toBuffer(roundtripPayload, {
  type: "png",
  width: 300,
  margin: 4,
  errorCorrectionLevel: "H"
});

assert(pngBuffer.length > 100, `Generated PNG buffer has valid non-zero size: ${pngBuffer.length} bytes`);
// Check standard PNG magic bytes: \x89PNG\r\n\x1a\n
assert(
  pngBuffer[0] === 0x89 &&
  pngBuffer[1] === 0x50 &&
  pngBuffer[2] === 0x4E &&
  pngBuffer[3] === 0x47,
  "PNG magic header bytes verified (0x89, 'P', 'N', 'G')"
);

// Parse the PNG and decode its pixels with jsQR
const parsedPng = PNG.sync.read(pngBuffer);
assert(parsedPng.width === 300 && parsedPng.height === 300, `Parsed PNG dimensions match requested resolution (${parsedPng.width}x${parsedPng.height})`);

const roundtripDecoded = decodeQrPixels(new Uint8ClampedArray(parsedPng.data), parsedPng.width, parsedPng.height);
assert(roundtripDecoded.success === true, "jsQR successfully decoded generated PNG buffer");
assert(roundtripDecoded.data === roundtripPayload, "Decoded content strictly matches original payload byte-for-byte with zero loss");

// -------------------------------------------------------------
// TEST SUITE 17: CSV Parser for Bulk QR Generation
// -------------------------------------------------------------
console.log("\nTEST SUITE 17: CSV Parser for Bulk QR Generation");
const sampleCsv = `title,content
"Store URL","https://freebiz.pk"
"WhatsApp Contact","https://wa.me/923001234567"
"Plain Wi-Fi","WIFI:S:FreeBiz;T:WPA;P:secret123;;"`;

const csvResult = parseCsvData(sampleCsv);
assert(csvResult.error === null, "CSV parsed successfully without errors");
assert(csvResult.headers.length === 2, "CSV headers count verified (2)");
assert(csvResult.rows.length === 3, "CSV rows count verified (3)");
assert(csvResult.rows[0][0] === "Store URL", "First row title parsed correctly");
assert(csvResult.rows[0][1] === "https://freebiz.pk", "First row content parsed correctly");

const emptyCsvRes = parseCsvData("");
assert(emptyCsvRes.error !== null, "Empty CSV correctly rejected with error message");

// -------------------------------------------------------------
// TEST SUITE 18: Multi-Format Barcode Engine & Formats
// -------------------------------------------------------------
console.log("\nTEST SUITE 18: Multi-Format Barcode Engine & Formats");

assert(SUPPORTED_BARCODE_FORMATS.length >= 12, "All 12 requested barcode formats are configured");
const expectedFormatKeys = ["QR_CODE", "CODE_128", "CODE_39", "EAN_13", "EAN_8", "UPC_A", "UPC_E", "ITF", "CODABAR", "PDF_417", "DATA_MATRIX", "AZTEC"];
expectedFormatKeys.forEach(key => {
  const exists = SUPPORTED_BARCODE_FORMATS.some(f => f.id === key);
  assert(exists, `Format ${key} is present in SUPPORTED_BARCODE_FORMATS`);
});

assert(getFormatDisplayName("QR_CODE") === "QR Code", "QR_CODE mapped to 'QR Code'");
assert(getFormatDisplayName("code_128") === "Code 128", "code_128 mapped to 'Code 128'");
assert(getFormatDisplayName("EAN_13") === "EAN-13", "EAN_13 mapped to 'EAN-13'");
assert(getFormatDisplayName("UPC_A") === "UPC-A", "UPC_A mapped to 'UPC-A'");
assert(getFormatDisplayName("data_matrix") === "Data Matrix", "data_matrix mapped to 'Data Matrix'");
assert(getFormatDisplayName("aztec") === "Aztec", "aztec mapped to 'Aztec'");

// Test decodeBarcodePixels on real QR code
const qrTestPayload = "https://freebiz.pk/barcode-suite-verified";
const qrTestBuffer = await QRCode.toBuffer(qrTestPayload, { width: 250, margin: 2 });
const qrPng = PNG.sync.read(qrTestBuffer);
const bcResult = decodeBarcodePixels(qrPng.data, qrPng.width, qrPng.height);
assert(bcResult.success === true, "decodeBarcodePixels detected QR code successfully");
assert(bcResult.data === qrTestPayload, "decodeBarcodePixels extracted correct payload");
assert(bcResult.format === "QR_CODE", "decodeBarcodePixels returned format QR_CODE");
assert(bcResult.formatLabel === "QR Code", "decodeBarcodePixels returned formatLabel 'QR Code'");

// -------------------------------------------------------------
// TEST SUITE 19: Barcode Payload Parsing & Leading Zeros Preservation
// -------------------------------------------------------------
console.log("\nTEST SUITE 19: Barcode Payload Parsing & Leading Zeros Preservation");

// 1. UPC-A with leading zero
const upcAWithLeadingZero = "012345678905";
const parsedUpc = parseQrPayload(upcAWithLeadingZero, "UPC_A");
assert(parsedUpc.type === "product_barcode", "UPC-A parsed as product_barcode");
assert(parsedUpc.raw === "012345678905", "Preserved raw value with leading zero");
assert(parsedUpc.details["Barcode Number"] === "012345678905", "Preserved leading zero in details");
assert(parsedUpc.details["Barcode Format"] === "UPC-A", "Format detail set to UPC-A");

// 2. EAN-13 with leading zero
const eanWithLeadingZero = "0793573189912";
const parsedEan = parseQrPayload(eanWithLeadingZero, "EAN_13");
assert(parsedEan.type === "product_barcode", "EAN-13 parsed as product_barcode");
assert(parsedEan.raw === "0793573189912", "Preserved leading zero in EAN-13");
assert(parsedEan.details["Character Count"] === 13, "EAN-13 character count is exactly 13");

// 3. Code 128 with leading zeros and alphanumeric
const code128Val = "000456ABC";
const parsed128 = parseQrPayload(code128Val, "CODE_128");
assert(parsed128.type === "barcode", "Code 128 parsed as barcode");
assert(parsed128.raw === "000456ABC", "Code 128 preserved leading zeros and characters");
assert(parsed128.formatLabel === "Code 128", "Format label is Code 128");

// 4. Data Matrix
const dmVal = "BATCH-2026-X99";
const parsedDm = parseQrPayload(dmVal, "DATA_MATRIX");
assert(parsedDm.format === "DATA_MATRIX", "Data Matrix format preserved");
assert(parsedDm.formatLabel === "Data Matrix", "Data Matrix label correct");

// 5. Aztec
const aztecVal = "BOARDING-PASS-PK-786";
const parsedAztec = parseQrPayload(aztecVal, "AZTEC");
assert(parsedAztec.format === "AZTEC", "Aztec format preserved");
assert(parsedAztec.formatLabel === "Aztec", "Aztec label correct");

// -------------------------------------------------------------
// TEST SUITE 20: Phone Camera Photo Preprocessing & Resiliency
// -------------------------------------------------------------
console.log("\nTEST SUITE 20: Phone Camera Photo Preprocessing & Resiliency");

// 1. Off-center placement in large 1600x1200 simulated phone photo
const bigWidth = 1600;
const bigHeight = 1200;
const bigRgba = new Uint8ClampedArray(bigWidth * bigHeight * 4);
bigRgba.fill(240); // simulated desk/paper background

// Place 250x250 QR code at offset (x=900, y=550) - off-center
const subQrBuf = await QRCode.toBuffer("https://freebiz.pk/phone-cam-photo-success", { width: 250, margin: 2 });
const subQrPng = PNG.sync.read(subQrBuf);

const posX = 900;
const posY = 550;
for (let y = 0; y < subQrPng.height; y++) {
  for (let x = 0; x < subQrPng.width; x++) {
    const sIdx = (y * subQrPng.width + x) * 4;
    const dIdx = ((posY + y) * bigWidth + (posX + x)) * 4;
    bigRgba[dIdx] = subQrPng.data[sIdx];
    bigRgba[dIdx + 1] = subQrPng.data[sIdx + 1];
    bigRgba[dIdx + 2] = subQrPng.data[sIdx + 2];
    bigRgba[dIdx + 3] = 255;
  }
}

const offCenterResult = decodeBarcodePixels(bigRgba, bigWidth, bigHeight);
assert(offCenterResult.success === true, "Off-center QR in large 1600x1200 frame decoded successfully");
assert(offCenterResult.data === "https://freebiz.pk/phone-cam-photo-success", "Decoded data matches original");

// 2. Contrast stretching logic test
const mockImageData = {
  data: new Uint8ClampedArray([
    100, 100, 100, 255,  // low luminance min
    130, 130, 130, 255,  // washed out
    160, 160, 160, 255   // low luminance max (range = 60, washed out photo)
  ])
};
const stretched = applyContrastStretching(mockImageData);
assert(stretched.data[0] <= 10, "Minimum luminance stretched down towards 0");
assert(stretched.data[8] >= 240, "Maximum luminance stretched up towards 255");

// -------------------------------------------------------------
// TEST SUITE 21: Direct PNG Save vs Share Separation
// -------------------------------------------------------------
console.log("\nTEST SUITE 21: Direct PNG Save vs Share Separation");

// Verify savePngToNativeOrWeb exists and handles web & native
const sampleDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const saveRes = await savePngToNativeOrWeb("freebiz-test.png", sampleDataUrl, null);
assert(typeof saveRes === "object", "savePngToNativeOrWeb returns result object");
assert(saveRes.success === true, "savePngToNativeOrWeb succeeds without error");
assert(saveRes.message.includes("freebiz-test.png"), "Result message references filename");

// -------------------------------------------------------------
// TEST SUITE 22: Security & XSS Hardening for Decoded Barcode Content
// -------------------------------------------------------------
console.log("\nTEST SUITE 22: Security & XSS Hardening for Decoded Content");

// Dangerous script payload inside barcode
const maliciousScriptBarcode = '<script>document.cookie="stolen"</script>';
const parsedMalicious = parseQrPayload(maliciousScriptBarcode, "CODE_128");
assert(parsedMalicious.isSafeUrl === false, "Dangerous script barcode is not marked as safe URL");
assert(parsedMalicious.safeUrl === null, "SafeUrl is strictly null for script payload");
assert(parsedMalicious.raw === maliciousScriptBarcode, "Raw payload preserved faithfully without execution");

// Dangerous URL schemes
const javascriptUrl = "javascript:alert('pwned')";
const parsedJsUrl = parseQrPayload(javascriptUrl);
assert(parsedJsUrl.isSafeUrl === false, "javascript: scheme strictly blocked");
assert(parsedJsUrl.safeUrl === null, "safeUrl is null for javascript: scheme");

const dataUrlScheme = "data:text/html,<script>alert(1)</script>";
const parsedDataUrl = parseQrPayload(dataUrlScheme);
assert(parsedDataUrl.isSafeUrl === false, "data: scheme strictly blocked");
assert(parsedDataUrl.safeUrl === null, "safeUrl is null for data: scheme");

const fileUrlScheme = "file:///etc/passwd";
const parsedFileUrl = parseQrPayload(fileUrlScheme);
assert(parsedFileUrl.isSafeUrl === false, "file: scheme strictly blocked");
assert(parsedFileUrl.safeUrl === null, "safeUrl is null for file: scheme");

// Legitimate HTTPS URL
const validHttps = "https://freebiz.pk/store";
const parsedHttps = parseQrPayload(validHttps);
assert(parsedHttps.isSafeUrl === true, "Valid HTTPS URL is marked as safe");
assert(parsedHttps.safeUrl === validHttps, "Safe URL preserved");

// -------------------------------------------------------------
// SUMMARY & EXIT
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

