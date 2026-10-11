/**
 * FreeBiz Tools — Core Logic Engine
 * 100% Client-Side • Pure Functions • Zero AI APIs • Zero External Tracking
 * 
 * Reusable, verifiable business logic exported for both the web application
 * and the automated test suite.
 */

// ---------------------------------------------------------------------------
// 1. HTML Escaping & Sanitization (XSS Prevention)
// ---------------------------------------------------------------------------

/**
 * Escapes HTML-sensitive characters to prevent Cross-Site Scripting (XSS).
 * @param {any} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Validates and normalizes website URLs, explicitly rejecting dangerous schemes.
 * @param {string} raw
 * @returns {{ valid: boolean, url: string | null, error: string | null }}
 */
export function validateAndFormatUrl(raw) {
  if (!raw || !raw.trim()) {
    return { valid: false, url: null, error: "Please enter a website URL" };
  }

  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Reject dangerous schemes immediately
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return { valid: false, url: null, error: "Dangerous or unsupported URL scheme detected" };
  }

  // Prepend https:// if protocol is omitted
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = "https://" + candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, url: null, error: "Only http:// and https:// URLs are supported for website QR codes" };
    }
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return { valid: false, url: null, error: "Please enter a valid website domain name" };
    }
    return { valid: true, url: parsed.href, error: null };
  } catch {
    return { valid: false, url: null, error: "Invalid URL format" };
  }
}

// ---------------------------------------------------------------------------
// 2. QR Code Payload Generators & Field Encoders
// ---------------------------------------------------------------------------

/**
 * Validates international telephone numbers.
 * @param {string} raw
 * @returns {{ valid: boolean, phone: string | null, error: string | null }}
 */
export function validatePhoneNumber(raw) {
  if (!raw || !raw.trim()) {
    return { valid: false, phone: null, error: "Please enter a phone number" };
  }

  const cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, "");
  // Allow optional leading +, followed by 5 to 16 digits
  if (!/^\+?[0-9]{5,16}$/.test(cleaned)) {
    return { valid: false, phone: null, error: "Please enter a valid phone number (5 to 16 digits)" };
  }

  return { valid: true, phone: cleaned, error: null };
}

/**
 * Encodes WhatsApp direct chat link with international phone and optional message.
 * @param {string} rawPhone
 * @param {string} [rawMessage=""]
 * @returns {{ valid: boolean, payload: string | null, error: string | null }}
 */
export function formatWhatsAppPayload(rawPhone, rawMessage = "") {
  if (!rawPhone || !rawPhone.trim()) {
    return { valid: false, payload: null, error: "Please enter a WhatsApp phone number" };
  }

  const digitsOnly = rawPhone.replace(/\D/g, "");
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { valid: false, payload: null, error: "Please enter a valid WhatsApp number with country code (e.g. 923001234567)" };
  }

  const msg = (rawMessage || "").trim();
  const url = msg
    ? `https://wa.me/${digitsOnly}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/${digitsOnly}`;

  return { valid: true, payload: url, error: null };
}

/**
 * Escapes special characters for MECARD Wi-Fi strings: \ ; , : "
 * @param {string} str
 * @returns {string}
 */
export function escapeWifiField(str) {
  if (!str) return "";
  return String(str).replace(/([\\;,:"'])/g, "\\$1");
}

/**
 * Formats a standard Wi-Fi network payload according to the MECARD specification.
 * @param {{ ssid: string, password?: string, encryption?: string, isHidden?: boolean }} config
 * @returns {{ valid: boolean, payload: string | null, error: string | null }}
 */
export function formatWifiPayload({ ssid, password = "", encryption = "WPA", isHidden = false }) {
  if (!ssid || !ssid.trim()) {
    return { valid: false, payload: null, error: "Please enter a Wi-Fi network name (SSID)" };
  }

  const escapedSsid = escapeWifiField(ssid.trim());
  const hiddenParam = isHidden ? "H:true;" : "";

  if (encryption === "nopass" || !encryption) {
    return { valid: true, payload: `WIFI:T:nopass;S:${escapedSsid};${hiddenParam};`, error: null };
  }

  const escapedPass = escapeWifiField(password);
  return { valid: true, payload: `WIFI:T:${encryption};S:${escapedSsid};P:${escapedPass};${hiddenParam};`, error: null };
}

/**
 * Escapes special characters for vCard 3.0: \ ; , and newlines.
 * @param {string} str
 * @returns {string}
 */
export function escapeVcardField(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Formats a vCard 3.0 digital contact card payload.
 * @param {{ name?: string, org?: string, tel?: string, email?: string, title?: string }} info
 * @returns {{ valid: boolean, payload: string | null, error: string | null }}
 */
export function formatVcardPayload({ name = "", org = "", tel = "", email = "", title = "" }) {
  const trimmedName = (name || "").trim();
  const trimmedOrg = (org || "").trim();
  const trimmedTel = (tel || "").trim();
  const trimmedEmail = (email || "").trim();
  const trimmedTitle = (title || "").trim();

  if (!trimmedName && !trimmedOrg && !trimmedTel && !trimmedEmail) {
    return { valid: false, payload: null, error: "Please enter at least a name, organization, or contact number" };
  }

  const nameParts = trimmedName ? trimmedName.split(/\s+/) : [];
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : trimmedName;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

  let vcard = `BEGIN:VCARD\nVERSION:3.0\n`;
  if (trimmedName) {
    vcard += `FN:${escapeVcardField(trimmedName)}\n`;
    vcard += `N:${escapeVcardField(lastName)};${escapeVcardField(firstName)};;;\n`;
  }
  if (trimmedOrg) vcard += `ORG:${escapeVcardField(trimmedOrg)}\n`;
  if (trimmedTitle) vcard += `TITLE:${escapeVcardField(trimmedTitle)}\n`;
  if (trimmedTel) vcard += `TEL;TYPE=CELL,VOICE:${escapeVcardField(trimmedTel)}\n`;
  if (trimmedEmail) vcard += `EMAIL;TYPE=WORK,INTERNET:${escapeVcardField(trimmedEmail)}\n`;
  vcard += `END:VCARD`;

  return { valid: true, payload: vcard, error: null };
}

// ---------------------------------------------------------------------------
// 3. Color & Contrast Validation (WCAG 2.1)
// ---------------------------------------------------------------------------

/**
 * Validates a 6-digit hex color string (e.g. #0f172a).
 * @param {string} hex
 * @returns {boolean}
 */
export function isValidHexColor(hex) {
  return typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex);
}

/**
 * Calculates relative luminance of a color for WCAG contrast computation.
 * @param {string} hex
 * @returns {number}
 */
export function getLuminance(hex) {
  if (!isValidHexColor(hex)) return 0;
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

/**
 * Computes contrast ratio between two hex colors.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
export function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// 4. Invoice & Receipt Calculation & Precision
// ---------------------------------------------------------------------------

/**
 * Validates quantity input: must be a positive integer >= 1.
 * @param {any} val
 * @returns {number}
 */
export function validateQuantity(val) {
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num) || num <= 0) return 0;
  const intVal = Math.floor(num);
  return Math.min(intVal, 1000000);
}

/**
 * Validates unit price: finite, non-negative number.
 * @param {any} val
 * @returns {number}
 */
export function validatePrice(val) {
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num) || num < 0) return 0;
  const clamped = Math.min(num, 1000000000);
  return Math.round(clamped * 100) / 100;
}

/**
 * Validates tax rate percentage: 0% through 100%.
 * @param {any} val
 * @returns {number}
 */
export function validateTaxRate(val) {
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num) || num < 0) return 0;
  if (num > 100) return 100;
  return Math.round(num * 100) / 100;
}

/**
 * Validates discount amount: finite, non-negative, capped at subtotal.
 * @param {any} val
 * @param {number} [subtotal=Infinity]
 * @returns {number}
 */
export function validateDiscount(val, subtotal = Infinity) {
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num) || num < 0) return 0;
  const rounded = Math.round(num * 100) / 100;
  const safeSubtotal = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 0;
  return Math.min(rounded, safeSubtotal);
}

/**
 * Performs complete mathematically consistent invoice calculations.
 * @param {Array<{ desc?: string, qty: any, price: any }>} rawItems
 * @param {any} taxRateRaw
 * @param {any} discountRaw
 * @returns {{
 *   items: Array<{ desc: string, qty: number, price: number, total: number }>,
 *   subtotal: number,
 *   discount: number,
 *   taxRate: number,
 *   taxableAmount: number,
 *   taxAmount: number,
 *   grandTotal: number
 * }}
 */
export function calculateInvoiceSummary(rawItems, taxRateRaw, discountRaw) {
  let subtotal = 0;
  const items = (rawItems || []).map(item => {
    const qty = validateQuantity(item.qty);
    const price = validatePrice(item.price);
    const total = Math.round(qty * price * 100) / 100;
    subtotal += total;
    return {
      desc: item.desc ? String(item.desc).trim() : "",
      qty,
      price,
      total
    };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  const discount = validateDiscount(discountRaw, subtotal);
  const taxableAmount = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const taxRate = validateTaxRate(taxRateRaw);
  const taxAmount = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  return {
    items,
    subtotal,
    discount,
    taxRate,
    taxableAmount,
    taxAmount,
    grandTotal
  };
}

/**
 * Formats a numeric amount with currency symbol.
 * @param {number} amount
 * @param {string} [symbol="Rs. "]
 * @returns {string}
 */
export function formatCurrency(amount, symbol = "Rs. ") {
  const safe = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  return `${symbol}${safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates plain text receipt slip.
 * @param {{
 *   bizName?: string,
 *   bizContact?: string,
 *   clientName?: string,
 *   invNumber?: string,
 *   invDate?: string,
 *   notes?: string,
 *   currencyCode?: string,
 *   currencySymbol?: string,
 *   items: Array<{ desc?: string, qty: any, price: any }>,
 *   taxRate: any,
 *   discount: any
 * }} data
 * @returns {string}
 */
export function generateReceiptTextSlip(data) {
  const bizName = (data.bizName || "").trim() || "FreeBiz Services";
  const bizContact = (data.bizContact || "").trim();
  const clientName = (data.clientName || "").trim() || "Valued Customer";
  const invNumber = (data.invNumber || "").trim() || `REC-${Date.now().toString().slice(-4)}`;
  const invDate = (data.invDate || "").trim() || new Date().toISOString().split("T")[0];
  const notes = (data.notes || "").trim();
  const sym = data.currencySymbol || "Rs. ";
  const code = data.currencyCode || "PKR";

  const summary = calculateInvoiceSummary(data.items, data.taxRate, data.discount);

  const lines = [];
  lines.push(`========================================`);
  lines.push(`             RECEIPT SLIP               `);
  lines.push(`========================================`);
  lines.push(`Merchant: ${bizName}`);
  if (bizContact) lines.push(`Contact:  ${bizContact}`);
  lines.push(`Receipt#: ${invNumber}`);
  lines.push(`Date:     ${invDate}`);
  lines.push(`Client:   ${clientName}`);
  lines.push(`Currency: ${code}`);
  lines.push(`----------------------------------------`);
  lines.push(`ITEMS:`);

  summary.items.forEach(it => {
    const desc = it.desc || "Item";
    lines.push(` • ${desc} (x${it.qty} @ ${sym}${it.price.toFixed(2)}) = ${sym}${it.total.toFixed(2)}`);
  });

  lines.push(`----------------------------------------`);
  lines.push(`Subtotal:    ${formatCurrency(summary.subtotal, sym)}`);
  lines.push(`Discount:    -${formatCurrency(summary.discount, sym)}`);
  lines.push(`Tax (${summary.taxRate}%):   ${formatCurrency(summary.taxAmount, sym)}`);
  lines.push(`GRAND TOTAL: ${formatCurrency(summary.grandTotal, sym)}`);
  lines.push(`----------------------------------------`);
  if (notes) {
    lines.push(`Notes: ${notes}`);
  }
  lines.push(`========================================`);
  lines.push(`Customer receipt template. Not a tax invoice.`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 5. Bio Generator Templates & Processing
// ---------------------------------------------------------------------------

export const BIO_TEMPLATES = {
  instagram: {
    friendly: [
      "{name} ✨\n🌿 {niche}{location_line}\n💛 {benefit}\n👇 {cta}",
      "Assalam-o-Alaikum! We're {name} 👋\n📍 {location}\n✨ {benefit}\n💬 {cta}",
      "Welcome to {name} ☕\n🌱 Crafted with care in {location}\n💫 {benefit}\nTap to connect ⤵️\n{cta}"
    ],
    professional: [
      "{name} | {niche}\nTrusted {niche} in {location}.\n✓ {benefit}\nContact & Inquiries: {cta}",
      "{name}\nOfficial account for {location}.\nDelivering {benefit}.\nGet in touch today ⬇️\n{cta}",
      "{name} — Excellence in {niche}.\nHelping clients across {location} with {benefit}.\n{cta}"
    ],
    modern: [
      "{name} // {location}\n{benefit}.\nSimple. Reliable. Fast.\n🔗 {cta}",
      "{name} • {niche}\nModern solutions for {audience}.\n{benefit}\nTap below ⚡\n{cta}",
      "{name}\n{benefit}.\nBuilt for {location}.\n{cta} ↘️"
    ],
    minimal: [
      "{name}\n{niche} · {location}\n{benefit}\n{cta}",
      "{name} — {benefit}.\nBased in {location}.\n{cta}",
      "{name}\n{benefit}\n{cta}"
    ],
    bold: [
      "🔥 {name} is here to upgrade your {niche}.\n📍 {location}\n🚀 {benefit}\nConnect now ⬇️\n{cta}",
      "Say goodbye to delays. Welcome to {name}! 💥\nServing {location} daily.\n{benefit}\nLet's get started: {cta}",
      "{name} = {niche} done right.\n{benefit}\nTap below and see why {location} trusts us 👇\n{cta}"
    ]
  },
  google: {
    friendly: [
      "Welcome to {name}! We are a local {niche} proudly serving {location} and nearby areas. Our goal is simple: {benefit}. Whether you are visiting for the first time or a familiar face, we look forward to assisting you. {cta}",
      "At {name}, we take great pride in delivering friendly {niche} service to our community in {location}. We focus on {benefit} so you get quality you can trust every single time. Reach out today: {cta}"
    ],
    professional: [
      "{name} is a premier {niche} provider based in {location}. Dedicated to professional standards, reliability, and client satisfaction, our team specializes in {benefit}. Fully committed to serving residential and commercial clients across the region. {cta}",
      "Established to provide dependable {niche} solutions, {name} delivers reliable service across {location}. Our core focus: {benefit}. Contact us today to schedule service or request a quote. {cta}"
    ],
    modern: [
      "{name} brings modern, hassle-free {niche} services to {location}. We help our clients by {benefit}. Clean process, honest pricing, and genuine dedication. {cta}",
      "Quality {niche} services designed for modern businesses. {name} serves {location} with a focus on {benefit}. Transparent, reliable, and prompt. {cta}"
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
  linkedin: {
    professional: [
      "{name} is a dedicated {niche} provider based in {location}. We partner with {audience} to deliver measurable outcomes through {benefit}. Our approach combines industry expertise, clear communication, and customer-first execution.\n\nKey focus areas:\n• Specialized {niche} solutions\n• {benefit}\n• Dedicated support for {location}\n\nConnect with us or visit our link to learn more: {cta}",
      "Founded with a mission to elevate the {niche} space, {name} provides high-touch solutions for clients in {location}. We specialize in {benefit}, ensuring every project meets rigorous quality benchmarks.\n\nOpen for partnerships and new client inquiries: {cta}"
    ],
    friendly: [
      "Hi! We're {name}. We specialize in {niche} for {location}, with a passion for {benefit}. We believe that good business is built on trust, genuine relationships, and consistently exceeding expectations.\n\nWe love connecting with fellow professionals and customers. Let's chat: {cta}",
      "At {name}, we love what we do! Serving {location} as your trusted {niche} partner, we focus every day on {benefit}.\n\nFeel free to connect or visit our site: {cta}"
    ],
    modern: [
      "{name} | Transforming {niche} in {location}.\n\nWe deliver {benefit}.\n\nBuilt for {audience} who value efficiency and craft.\n\nLearn more: {cta}",
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
  twitter: {
    friendly: [
      "{name} ✨ Your trusted {niche} in {location}. Making sure {benefit}. 🔗 {cta}",
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

/**
 * Generates filled bio template options.
 * @param {{
 *   name?: string,
 *   niche?: string,
 *   benefit?: string,
 *   location?: string,
 *   audience?: string,
 *   cta?: string,
 *   tone?: string,
 *   platform?: string
 * }} params
 * @returns {{ valid: boolean, results?: Array<{ text: string, charCount: number, wordCount: number }>, error?: string }}
 */
export function generateBioOutputs(params) {
  const name = (params.name || "").trim();
  const niche = (params.niche || "").trim();
  const benefit = (params.benefit || "").trim();
  const location = (params.location || "").trim() || "our community";
  const audience = (params.audience || "").trim() || "valued clients";
  const cta = (params.cta || "").trim() || "Contact us or tap the link to learn more";
  const tone = params.tone || "friendly";
  const platform = params.platform || "instagram";

  if (!name || !niche || !benefit) {
    return { valid: false, error: "Please enter Business Name, Industry/Niche, and Benefit/Value proposition." };
  }

  const platformGroup = BIO_TEMPLATES[platform] || BIO_TEMPLATES.instagram;
  const toneTemplates = platformGroup[tone] || platformGroup.friendly || [];

  const candidates = [...toneTemplates];
  if (candidates.length < 3 && platformGroup.modern) {
    candidates.push(...platformGroup.modern);
  }

  const chosen = candidates.slice(0, 3);
  const results = chosen.map(tpl => {
    const text = tpl
      .replace(/\{name\}/g, name)
      .replace(/\{niche\}/g, niche)
      .replace(/\{benefit\}/g, benefit)
      .replace(/\{location\}/g, location)
      .replace(/\{location_line\}/g, location !== "our community" ? ` in ${location}` : "")
      .replace(/\{audience\}/g, audience)
      .replace(/\{cta\}/g, cta);

    return {
      text,
      charCount: text.length,
      wordCount: text.split(/\s+/).filter(Boolean).length
    };
  });

  return { valid: true, results };
}

// ---------------------------------------------------------------------------
// 6. Product Description Templates & Safe HTML Generation
// ---------------------------------------------------------------------------

/**
 * Generates product description in plain text and safely escaped HTML.
 * @param {{
 *   name?: string,
 *   category?: string,
 *   rawFeatures?: string,
 *   benefit?: string,
 *   priceOffer?: string,
 *   style?: string
 * }} params
 * @returns {{
 *   valid: boolean,
 *   plainText?: string,
 *   htmlSnippet?: string,
 *   title?: string,
 *   charCount?: number,
 *   wordCount?: number,
 *   error?: string
 * }}
 */
export function generateProductDescriptionOutputs(params) {
  const name = (params.name || "").trim();
  const category = (params.category || "").trim();
  const rawFeatures = (params.rawFeatures || "").trim();
  const benefit = (params.benefit || "").trim();
  const priceOffer = (params.priceOffer || "").trim();
  const style = params.style || "ecommerce";

  if (!name || !category || !rawFeatures || !benefit) {
    return { valid: false, error: "Please enter Product Name, Category, Features, and Key Benefit." };
  }

  const featuresList = rawFeatures
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  let output = {};

  if (style === "ecommerce") {
    output = {
      title: `${name} — Premium ${category}`,
      narrative: `Upgrade your daily routine with the all-new ${name}. Engineered specifically for those who appreciate dependable everyday quality, this ${category.toLowerCase()} standout ensures you ${benefit}. Thoughtfully designed to deliver lasting value and effortless convenience.`,
      bullets: featuresList,
      guarantee: priceOffer ? `Special Offer: ${priceOffer}` : "",
      cta: "Order today and experience the difference!"
    };
  } else if (style === "story") {
    output = {
      title: `The Story Behind ${name}`,
      narrative: `We created ${name} with a simple philosophy: everyday tools should be reliable, well-crafted, and a joy to use. Built to help you ${benefit}, every element of this ${category.toLowerCase()} piece is designed with care.`,
      bullets: featuresList,
      guarantee: priceOffer ? `Note: ${priceOffer}` : "",
      cta: `Treat yourself to ${name} today.`
    };
  } else if (style === "social") {
    output = {
      title: `Say hello to your new favorite: ${name}! 🔥`,
      narrative: `Upgrade your ${category.toLowerCase()}. The ${name} is officially available so you can ${benefit}. Check out why customers love it:`,
      bullets: featuresList,
      guarantee: priceOffer ? `⚡ Special: ${priceOffer}` : "",
      cta: "⚡ Message or click the link to claim yours today!"
    };
  } else {
    // Marketplace classified
    output = {
      title: `[FOR SALE] ${name} (${category})`,
      narrative: `Up for sale: ${name}. Quality ${category.toLowerCase()} designed to ${benefit}.`,
      bullets: featuresList,
      guarantee: priceOffer ? `Price / Offer: ${priceOffer}` : "",
      cta: "Available for pickup or dispatch. Message with inquiries."
    };
  }

  const bulletText = output.bullets.map(b => `• ${b}`).join("\n");
  const plainText = `${output.title}\n\n${output.narrative}\n\nKey Highlights:\n${bulletText}${output.guarantee ? `\n\n${output.guarantee}` : ""}\n\n${output.cta}`;

  // SECURITY FIX: Every dynamic value is strictly escaped via escapeHtml()
  const escapedTitle = escapeHtml(output.title);
  const escapedNarrative = escapeHtml(output.narrative);
  const escapedBullets = output.bullets.map(b => `  <li>${escapeHtml(b)}</li>`).join("\n");
  const escapedGuarantee = output.guarantee ? `\n<p><strong>Note:</strong> ${escapeHtml(output.guarantee)}</p>` : "";
  const escapedCta = escapeHtml(output.cta);

  const htmlSnippet = `<h3>${escapedTitle}</h3>
<p>${escapedNarrative}</p>
<ul>
${escapedBullets}
</ul>${escapedGuarantee}
<p><em>${escapedCta}</em></p>`;

  return {
    valid: true,
    plainText,
    htmlSnippet,
    title: output.title,
    charCount: plainText.length,
    wordCount: plainText.split(/\s+/).filter(Boolean).length
  };
}

// ---------------------------------------------------------------------------
// 7. Safe Storage Wrapper (Graceful Private Browsing / Error Handling)
// ---------------------------------------------------------------------------

/**
 * Safe localStorage reader.
 * @param {string} key
 * @returns {string | null}
 */
export function safeGetStorage(key) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Storage access restricted (e.g. strict private mode)
  }
  return null;
}

/**
 * Safe localStorage writer.
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
export function safeSetStorage(key, value) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return true;
    }
  } catch {
    // Storage quota exceeded or disabled
  }
  return false;
}

/**
 * Safe localStorage remover.
 * @param {string} key
 * @returns {boolean}
 */
export function safeRemoveStorage(key) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
      return true;
    }
  } catch {
    // Storage access restricted
  }
  return false;
}
