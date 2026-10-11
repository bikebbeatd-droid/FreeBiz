/**
 * FreeBiz Tools — Core JavaScript Application Engine
 * 100% Client-Side • Zero AI APIs • Zero External Tracking
 * 
 * Includes:
 * 1. Verified ISO-compliant QR Code Generator (Reed-Solomon GF(256), Canvas & SVG)
 * 2. Template-Driven Business Bio Generator
 * 3. Structured Product Description Generator
 * 4. Configurable Currency Invoice / Receipt Calculator (PKR Default)
 * 5. Clipboard & File Export Utilities with Honest Feedback
 * 6. Mobile Testing Guide & Persistent Checklist
 */

import QRCode from "qrcode";

/* ==========================================================================
   PART 1: TOAST NOTIFICATIONS & CLIPBOARD UTILITIES
   ========================================================================== */

function showToast(message, type = "normal", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  toast.innerHTML = `<span style="font-weight:700;" aria-hidden="true">${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Robust Cross-Browser Copy with Honest Feedback
async function copyTextToClipboard(text, successMessage = "Copied to clipboard!") {
  if (!text || !text.trim()) {
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
    console.warn("Navigator clipboard write failed, trying execCommand fallback:", err);
  }

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

// Download Plain Text / HTML file with meaningful filename
function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  try {
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
  } catch (err) {
    console.error("Download failed:", err);
    showToast("Download failed. Please check browser permissions.", "error");
  }
}

// Calculate relative luminance for color contrast checking (WCAG 2.1)
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

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ==========================================================================
   PART 2: QR CODE TOOL CONTROLLER
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
  const emptyState = document.getElementById("qrEmptyState");
  const activeState = document.getElementById("qrActiveState");
  const statusBadge = document.getElementById("qrStatusBadge");
  const contrastNotice = document.getElementById("qrContrastNotice");

  const btnDownloadPng = document.getElementById("btnDownloadQrPng");
  const btnDownloadSvg = document.getElementById("btnDownloadQrSvg");
  const btnCopyImage = document.getElementById("btnCopyQrImage");
  const btnPrint = document.getElementById("btnPrintQr");

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
      const isActive = btn.dataset.type === type;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
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

  // Escape special MECARD/WIFI characters: \ ; , : "
  function escapeWifiField(str) {
    if (!str) return "";
    return str.replace(/([\\;,:"'])/g, "\\$1");
  }

  // Escape vCard special characters: \ ; , \n
  function escapeVcardField(str) {
    if (!str) return "";
    return str
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  // Get payload from user input; return null if input is empty
  function getPayload() {
    switch (activeType) {
      case "url": {
        let val = document.getElementById("qrUrlInput")?.value.trim() || "";
        if (!val) return null;
        if (!/^https?:\/\//i.test(val)) {
          val = "https://" + val;
        }
        return val;
      }
      case "phone": {
        const raw = document.getElementById("qrPhoneInput")?.value.trim() || "";
        if (!raw) return null;
        const cleaned = raw.replace(/[^\d+]/g, "");
        if (cleaned.length < 5) return null;
        return `tel:${cleaned}`;
      }
      case "whatsapp": {
        const rawPhone = document.getElementById("qrWaPhone")?.value.trim() || "";
        if (!rawPhone) return null;
        const phone = rawPhone.replace(/\D/g, "");
        if (phone.length < 7) return null;
        const msg = document.getElementById("qrWaMsg")?.value.trim() || "";
        return msg ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/${phone}`;
      }
      case "wifi": {
        const ssid = document.getElementById("qrWifiSsid")?.value.trim() || "";
        if (!ssid) return null;
        const enc = document.getElementById("qrWifiEnc")?.value || "WPA";
        const pass = document.getElementById("qrWifiPass")?.value || "";
        const isHidden = document.getElementById("qrWifiHidden")?.checked || false;

        const escapedSsid = escapeWifiField(ssid);
        const hiddenParam = isHidden ? "H:true;" : "";

        if (enc === "nopass") {
          return `WIFI:T:nopass;S:${escapedSsid};${hiddenParam};`;
        }
        return `WIFI:T:${enc};S:${escapedSsid};P:${escapeWifiField(pass)};${hiddenParam};`;
      }
      case "vcard": {
        const name = document.getElementById("qrCardName")?.value.trim() || "";
        const org = document.getElementById("qrCardOrg")?.value.trim() || "";
        const tel = document.getElementById("qrCardTel")?.value.trim() || "";
        const email = document.getElementById("qrCardEmail")?.value.trim() || "";
        const title = document.getElementById("qrCardTitle")?.value.trim() || "";

        if (!name && !org && !tel && !email) return null;

        // Structured name: split into last and first name if possible
        const nameParts = name.split(/\s+/);
        const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : name;
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

        let vcard = `BEGIN:VCARD\nVERSION:3.0\n`;
        if (name) {
          vcard += `FN:${escapeVcardField(name)}\n`;
          vcard += `N:${escapeVcardField(lastName)};${escapeVcardField(firstName)};;;\n`;
        }
        if (org) vcard += `ORG:${escapeVcardField(org)}\n`;
        if (title) vcard += `TITLE:${escapeVcardField(title)}\n`;
        if (tel) vcard += `TEL;TYPE=CELL,VOICE:${escapeVcardField(tel)}\n`;
        if (email) vcard += `EMAIL;TYPE=WORK,INTERNET:${escapeVcardField(email)}\n`;
        vcard += `END:VCARD`;
        return vcard;
      }
      case "text":
      default: {
        const text = document.getElementById("qrCustomText")?.value.trim() || "";
        return text ? text : null;
      }
    }
  }

  function setActionButtonsEnabled(enabled) {
    if (btnDownloadPng) btnDownloadPng.disabled = !enabled;
    if (btnDownloadSvg) btnDownloadSvg.disabled = !enabled;
    if (btnCopyImage) btnCopyImage.disabled = !enabled;
    if (btnPrint) btnPrint.disabled = !enabled;
  }

  async function updateQR() {
    const payload = getPayload();
    const fg = fgColorInput?.value || "#0f172a";
    const bg = bgColorInput?.value || "#ffffff";
    const size = parseInt(sizeSelect?.value || "280", 10);
    const ec = ecSelect?.value || "M";

    // Check color contrast
    const contrast = getContrastRatio(fg, bg);
    if (contrastNotice) {
      contrastNotice.style.display = contrast < 3.0 ? "flex" : "none";
    }

    if (!payload) {
      currentQRData = "";
      if (emptyState) emptyState.style.display = "flex";
      if (activeState) activeState.style.display = "none";
      if (statusBadge) {
        statusBadge.textContent = "Awaiting Input";
        statusBadge.style.color = "var(--text-muted)";
      }
      if (payloadDisplay) payloadDisplay.textContent = "";
      setActionButtonsEnabled(false);
      return;
    }

    currentQRData = payload;
    if (emptyState) emptyState.style.display = "none";
    if (activeState) activeState.style.display = "flex";
    if (statusBadge) {
      statusBadge.textContent = "✓ Ready to Scan";
      statusBadge.style.color = "var(--accent-secondary)";
    }
    if (payloadDisplay) {
      payloadDisplay.textContent = payload;
    }

    try {
      await QRCode.toCanvas(canvas, payload, {
        width: size,
        margin: 4,
        color: {
          dark: fg,
          light: bg
        },
        errorCorrectionLevel: ec
      });
      setActionButtonsEnabled(true);
    } catch (err) {
      console.error("QR Code generation error:", err);
      setActionButtonsEnabled(false);
      showToast("Data too large for selected error correction level. Try Level L.", "error");
    }
  }

  // Bind inputs to live update
  const inputsToWatch = document.querySelectorAll(
    "#qrFieldsUrl input, #qrFieldsPhone input, #qrFieldsWhatsapp input, #qrFieldsWhatsapp textarea, #qrFieldsWifi input, #qrFieldsWifi select, #qrFieldsVcard input, #qrFieldsText textarea, #qrFgColor, #qrBgColor, #qrSize, #qrEcLevel, #qrWifiHidden"
  );
  inputsToWatch.forEach(el => {
    el.addEventListener("input", updateQR);
    el.addEventListener("change", updateQR);
  });

  // Wi-Fi security change handler: hide password when open
  document.getElementById("qrWifiEnc")?.addEventListener("change", e => {
    const passGroup = document.getElementById("qrWifiPassGroup");
    if (passGroup) {
      passGroup.style.display = e.target.value === "nopass" ? "none" : "block";
    }
  });

  // Bind foreground swatches to [data-swatch-fg]
  document.querySelectorAll("[data-swatch-fg]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (fgColorInput) fgColorInput.value = btn.dataset.swatchFg;
      updateQR();
    });
  });

  // Bind background swatches to [data-swatch-bg]
  document.querySelectorAll("[data-swatch-bg]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (bgColorInput) bgColorInput.value = btn.dataset.swatchBg;
      updateQR();
    });
  });

  // Action: Download PNG
  btnDownloadPng?.addEventListener("click", () => {
    if (!currentQRData) {
      showToast("Please enter content to generate a QR code first.", "error");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl.length < 50) {
        showToast("QR code image is not ready to download", "error");
        return;
      }
      const link = document.createElement("a");
      link.download = `freebiz-qr-${activeType}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Downloaded QR Code as PNG", "success");
    } catch (err) {
      console.error("PNG download error:", err);
      showToast("Download failed", "error");
    }
  });

  // Action: Download SVG
  btnDownloadSvg?.addEventListener("click", async () => {
    if (!currentQRData) {
      showToast("Please enter content to generate a QR code first.", "error");
      return;
    }
    const fg = fgColorInput?.value || "#0f172a";
    const bg = bgColorInput?.value || "#ffffff";
    const ec = ecSelect?.value || "M";

    try {
      const svgString = await QRCode.toString(currentQRData, {
        type: "svg",
        margin: 4,
        color: { dark: fg, light: bg },
        errorCorrectionLevel: ec
      });
      downloadTextFile(`freebiz-qr-${activeType}-${Date.now()}.svg`, svgString, "image/svg+xml");
    } catch (err) {
      console.error("SVG generation error:", err);
      showToast("Could not generate SVG", "error");
    }
  });

  // Action: Copy QR Code Image to Clipboard (Honest feedback)
  btnCopyImage?.addEventListener("click", () => {
    if (!currentQRData) {
      showToast("No QR code content to copy", "error");
      return;
    }
    if (!navigator.clipboard || !window.ClipboardItem) {
      copyTextToClipboard(currentQRData, "Image clipboard unsupported: Copied QR link text instead!");
      return;
    }
    canvas.toBlob(async blob => {
      if (!blob) {
        showToast("Could not create image blob", "error");
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("QR Code image copied to clipboard!", "success");
      } catch (err) {
        console.warn("ClipboardItem write failed:", err);
        copyTextToClipboard(currentQRData, "Browser restricted image copy: Copied QR link text instead!");
      }
    }, "image/png");
  });

  // Action: Print QR Code
  btnPrint?.addEventListener("click", () => {
    if (!currentQRData) {
      showToast("Please enter content to generate a QR code before printing.", "error");
      return;
    }
    window.print();
  });

  // Action: Load Sample Data
  document.getElementById("btnLoadQrExample")?.addEventListener("click", () => {
    switch (activeType) {
      case "url":
        document.getElementById("qrUrlInput").value = "https://example.com/shop";
        break;
      case "phone":
        document.getElementById("qrPhoneInput").value = "+92 300 1234567";
        break;
      case "whatsapp":
        document.getElementById("qrWaPhone").value = "923001234567";
        document.getElementById("qrWaMsg").value = "Assalam-o-Alaikum! Inquiring about catalog prices.";
        break;
      case "wifi":
        document.getElementById("qrWifiSsid").value = "Store_Guest_WiFi";
        document.getElementById("qrWifiPass").value = "welcome2026";
        document.getElementById("qrWifiEnc").value = "WPA";
        break;
      case "vcard":
        document.getElementById("qrCardName").value = "Tariq Mahmood";
        document.getElementById("qrCardOrg").value = "Al-Rehman Graphics";
        document.getElementById("qrCardTel").value = "+92 300 1234567";
        document.getElementById("qrCardEmail").value = "contact@alrehman.pk";
        document.getElementById("qrCardTitle").value = "Managing Partner";
        break;
      case "text":
        document.getElementById("qrCustomText").value = "FreeBiz Tools — 100% Free & Private Business Utilities";
        break;
    }
    updateQR();
    showToast(`Loaded sample data for ${activeType.toUpperCase()} QR code`, "normal");
  });

  // Initial check (starts empty)
  updateQR();
}

/* ==========================================================================
   PART 3: BUSINESS BIO GENERATOR (Predefined Templates, No AI API)
   ========================================================================== */

const BIO_TEMPLATES = {
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

function initBioTool() {
  const form = document.getElementById("bioGeneratorForm");
  const resultsContainer = document.getElementById("bioResultsList");
  if (!form || !resultsContainer) return;

  function generateBios() {
    const name = document.getElementById("bioBizName")?.value.trim();
    const niche = document.getElementById("bioNiche")?.value.trim();
    const benefit = document.getElementById("bioBenefit")?.value.trim();
    const location = document.getElementById("bioLocation")?.value.trim() || "our community";
    const audience = document.getElementById("bioAudience")?.value.trim() || "valued clients";
    const cta = document.getElementById("bioCta")?.value.trim() || "Contact us or tap the link to learn more";
    const tone = document.getElementById("bioTone")?.value || "friendly";
    const platform = document.getElementById("bioPlatform")?.value || "instagram";

    if (!name || !niche || !benefit) {
      showToast("Please fill in Business Name, Industry, and Value Proposition.", "error");
      return;
    }

    const platformGroup = BIO_TEMPLATES[platform] || BIO_TEMPLATES.instagram;
    const toneTemplates = platformGroup[tone] || platformGroup.friendly || [];

    const templates = [...toneTemplates];
    if (templates.length < 3 && platformGroup.modern) {
      templates.push(...platformGroup.modern);
    }

    resultsContainer.innerHTML = "";

    const chosen = templates.slice(0, 3);
    chosen.forEach((tpl, idx) => {
      let text = tpl
        .replace(/\{name\}/g, name)
        .replace(/\{niche\}/g, niche)
        .replace(/\{benefit\}/g, benefit)
        .replace(/\{location\}/g, location)
        .replace(/\{location_line\}/g, location !== "our community" ? ` in ${location}` : "")
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
        <textarea class="result-text-area" rows="4" aria-label="Editable bio option ${idx + 1}"></textarea>
        <div class="result-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-copy-bio">
            <span aria-hidden="true">📋</span> Copy Bio
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-download-bio">
            <span aria-hidden="true">💾</span> Save TXT
          </button>
        </div>
      `;

      // Use textContent / property for safe content injection
      const textarea = card.querySelector("textarea");
      textarea.value = text;

      const counter = card.querySelector(".char-counter");
      textarea.addEventListener("input", () => {
        const curChar = textarea.value.length;
        const curWord = textarea.value.split(/\s+/).filter(Boolean).length;
        counter.textContent = `${curChar} chars · ${curWord} words`;
      });

      card.querySelector(".btn-copy-bio").addEventListener("click", () => {
        copyTextToClipboard(textarea.value, "Bio copied to clipboard!");
      });

      card.querySelector(".btn-download-bio").addEventListener("click", () => {
        const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
        downloadTextFile(`${safeName}-bio-${idx + 1}.txt`, textarea.value);
      });

      resultsContainer.appendChild(card);
    });

    showToast(`Generated 3 ${platform} bio drafts!`, "success");
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    generateBios();
  });

  // Example Loader
  document.getElementById("btnLoadBioExample")?.addEventListener("click", () => {
    document.getElementById("bioBizName").value = "Karak & Co. Chai House";
    document.getElementById("bioNiche").value = "Traditional Tea & Bakery Cafe";
    document.getElementById("bioBenefit").value = "freshly brewed karak matka chai and hot crispy parathas made to order";
    document.getElementById("bioLocation").value = "Karachi, Pakistan";
    document.getElementById("bioAudience").value = "chai lovers and morning commuters";
    document.getElementById("bioCta").value = "Visit us at Main Boulevard or WhatsApp to order";
    document.getElementById("bioTone").value = "friendly";
    document.getElementById("bioPlatform").value = "instagram";
    generateBios();
  });
}

/* ==========================================================================
   PART 4: PRODUCT DESCRIPTION GENERATOR (Predefined Templates, No AI API)
   ========================================================================== */

function initProductDescTool() {
  const form = document.getElementById("productDescForm");
  const resultsContainer = document.getElementById("productDescResults");
  if (!form || !resultsContainer) return;

  function generateProductDescription() {
    const name = document.getElementById("prodName")?.value.trim();
    const category = document.getElementById("prodCategory")?.value.trim();
    const rawFeatures = document.getElementById("prodFeatures")?.value.trim();
    const benefit = document.getElementById("prodBenefit")?.value.trim();
    const priceOffer = document.getElementById("prodOffer")?.value.trim() || "";
    const style = document.getElementById("prodStyle")?.value || "ecommerce";

    if (!name || !category || !rawFeatures || !benefit) {
      showToast("Please enter Product Name, Category, Features, and Benefit.", "error");
      return;
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
      // Marketplace
      output = {
        title: `[FOR SALE] ${name} (${category})`,
        narrative: `Up for sale: ${name}. Quality ${category.toLowerCase()} designed to ${benefit}.`,
        bullets: featuresList,
        guarantee: priceOffer ? `Price / Offer: ${priceOffer}` : "",
        cta: "Available for pickup or dispatch. Message with inquiries."
      };
    }

    const bulletText = output.bullets.map(b => `• ${b}`).join("\n");
    const plainText = `${output.title}

${output.narrative}

Key Highlights:
${bulletText}${output.guarantee ? `\n\n${output.guarantee}` : ""}

${output.cta}`;

    const htmlSnippet = `<h3>${output.title}</h3>
<p>${output.narrative}</p>
<ul>
${output.bullets.map(b => `  <li>${b}</li>`).join("\n")}
</ul>${output.guarantee ? `\n<p><strong>Note:</strong> ${output.guarantee}</p>` : ""}
<p><em>${output.cta}</em></p>`;

    resultsContainer.innerHTML = `
      <div class="result-card">
        <div class="result-meta">
          <span class="result-tag">${name} • ${style.toUpperCase()} Style</span>
          <span class="char-counter">${plainText.length} chars · ${plainText.split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <textarea id="productDescTextarea" class="result-text-area" rows="8" aria-label="Editable product description"></textarea>
        <div class="result-actions" style="flex-wrap: wrap;">
          <button type="button" id="btnCopyProductDesc" class="btn btn-primary btn-sm">
            <span aria-hidden="true">📋</span> Copy Description
          </button>
          <button type="button" id="btnCopyProductHtml" class="btn btn-secondary btn-sm">
            <span aria-hidden="true">🌐</span> Copy HTML
          </button>
          <button type="button" id="btnDownloadProductTxt" class="btn btn-secondary btn-sm">
            <span aria-hidden="true">💾</span> Save TXT
          </button>
        </div>
      </div>
    `;

    const textarea = document.getElementById("productDescTextarea");
    textarea.value = plainText;

    document.getElementById("btnCopyProductDesc")?.addEventListener("click", () => {
      copyTextToClipboard(textarea.value, "Product description copied to clipboard!");
    });

    document.getElementById("btnCopyProductHtml")?.addEventListener("click", () => {
      copyTextToClipboard(htmlSnippet, "HTML snippet copied to clipboard!");
    });

    document.getElementById("btnDownloadProductTxt")?.addEventListener("click", () => {
      const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      downloadTextFile(`${safeName}-description.txt`, textarea.value);
    });

    showToast("Generated product description!", "success");
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    generateProductDescription();
  });

  document.getElementById("btnLoadProductExample")?.addEventListener("click", () => {
    document.getElementById("prodName").value = "EcoGrip Heavy Duty Pruning Shears";
    document.getElementById("prodCategory").value = "Lawn & Gardening Tools";
    document.getElementById("prodFeatures").value = "High-carbon SK5 steel blades, non-slip ergonomic grip, spring-assisted safety lock, anti-rust coating";
    document.getElementById("prodBenefit").value = "trim thick branches and prune roses with zero hand fatigue or wrist strain";
    document.getElementById("prodOffer").value = "Cash on delivery available nationwide";
    document.getElementById("prodStyle").value = "ecommerce";
    generateProductDescription();
  });
}

/* ==========================================================================
   PART 5: CONFIGURABLE CURRENCY INVOICE / RECEIPT CALCULATOR (PKR DEFAULT)
   ========================================================================== */

function initInvoiceTool() {
  const itemsTbody = document.getElementById("invoiceItemsTableBody");
  const btnAddItem = document.getElementById("btnAddInvoiceItem");
  const currencySelect = document.getElementById("invCurrency");
  const subtotalEl = document.getElementById("invSubtotalDisplay");
  const taxEl = document.getElementById("invTaxDisplay");
  const discountEl = document.getElementById("invDiscountDisplay");
  const grandTotalEl = document.getElementById("invGrandTotalDisplay");

  const taxRateInput = document.getElementById("invTaxRate");
  const discountInput = document.getElementById("invDiscount");
  const dateInput = document.getElementById("invDate");

  if (!itemsTbody) return;

  // Automatically initialize with client's current date
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }

  function getCurrencySymbol() {
    const selected = currencySelect?.options[currencySelect.selectedIndex];
    return selected?.dataset.symbol || "Rs. ";
  }

  function formatMoney(amount) {
    const sym = getCurrencySymbol();
    const safeAmount = isNaN(amount) || amount < 0 ? 0 : amount;
    return `${sym}${safeAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function calculateTotals() {
    let subtotal = 0;
    const rows = itemsTbody.querySelectorAll("tr");
    rows.forEach(row => {
      const qtyRaw = parseFloat(row.querySelector(".inv-item-qty")?.value);
      const priceRaw = parseFloat(row.querySelector(".inv-item-price")?.value);

      const qty = isNaN(qtyRaw) || qtyRaw < 0 ? 0 : qtyRaw;
      const price = isNaN(priceRaw) || priceRaw < 0 ? 0 : priceRaw;

      const rowTotal = qty * price;
      const rowTotalEl = row.querySelector(".inv-item-total");
      if (rowTotalEl) rowTotalEl.textContent = formatMoney(rowTotal);
      subtotal += rowTotal;
    });

    let taxRate = parseFloat(taxRateInput?.value);
    if (isNaN(taxRate) || taxRate < 0) taxRate = 0;
    if (taxRate > 100) taxRate = 100;

    let discount = parseFloat(discountInput?.value);
    if (isNaN(discount) || discount < 0) discount = 0;

    const discountAmount = Math.min(subtotal, discount);
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = (taxableAmount * taxRate) / 100;
    const grandTotal = taxableAmount + taxAmount;

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (taxEl) taxEl.textContent = formatMoney(taxAmount);
    if (discountEl) discountEl.textContent = `-${formatMoney(discountAmount)}`;
    if (grandTotalEl) grandTotalEl.textContent = formatMoney(grandTotal);
  }

  function addRow(desc = "", qty = 1, price = 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="text" class="form-control inv-item-desc" placeholder="Item description" style="min-height:42px; padding:4px 8px;" aria-label="Item description">
      </td>
      <td style="width: 70px;">
        <input type="number" class="form-control inv-item-qty" value="${qty}" min="1" step="1" style="min-height:42px; padding:4px 8px; text-align:center;" aria-label="Quantity">
      </td>
      <td style="width: 100px;">
        <input type="number" class="form-control inv-item-price" value="${price}" min="0" step="10" style="min-height:42px; padding:4px 8px; text-align:right;" aria-label="Unit price">
      </td>
      <td style="width: 90px; text-align: right; font-weight: 600;" class="inv-item-total">
        ${formatMoney(qty * price)}
      </td>
      <td style="width: 48px; text-align: center;">
        <button type="button" class="btn btn-secondary btn-delete-row" title="Remove item" aria-label="Remove item" style="min-height:42px; min-width:42px; padding:0; color: var(--accent-danger);">✕</button>
      </td>
    `;

    const descInput = tr.querySelector(".inv-item-desc");
    descInput.value = desc;

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
    addRow("", 1, 0);
  });

  taxRateInput?.addEventListener("input", calculateTotals);
  discountInput?.addEventListener("input", calculateTotals);
  currencySelect?.addEventListener("change", calculateTotals);

  // Generate plain text receipt slip
  function generateTextReceipt() {
    const bizName = document.getElementById("invBizName")?.value.trim() || "FreeBiz Services";
    const bizPhone = document.getElementById("invBizContact")?.value.trim() || "";
    const clientName = document.getElementById("invClientName")?.value.trim() || "Valued Customer";
    const invNum = document.getElementById("invNumber")?.value.trim() || `REC-${Date.now().toString().slice(-4)}`;
    const invDate = document.getElementById("invDate")?.value || new Date().toISOString().split("T")[0];
    const notes = document.getElementById("invNotes")?.value.trim() || "";
    const sym = getCurrencySymbol();

    let lines = [];
    lines.push(`========================================`);
    lines.push(`             RECEIPT SLIP               `);
    lines.push(`========================================`);
    lines.push(`Merchant: ${bizName}`);
    if (bizPhone) lines.push(`Contact:  ${bizPhone}`);
    lines.push(`Receipt#: ${invNum}`);
    lines.push(`Date:     ${invDate}`);
    lines.push(`Client:   ${clientName}`);
    lines.push(`Currency: ${currencySelect?.value || "PKR"}`);
    lines.push(`----------------------------------------`);
    lines.push(`ITEMS:`);

    const rows = itemsTbody.querySelectorAll("tr");
    rows.forEach(row => {
      const desc = row.querySelector(".inv-item-desc")?.value.trim() || "Item";
      const qty = parseFloat(row.querySelector(".inv-item-qty")?.value) || 1;
      const price = parseFloat(row.querySelector(".inv-item-price")?.value) || 0;
      const total = qty * price;
      lines.push(` • ${desc} (x${qty} @ ${sym}${price.toFixed(2)}) = ${sym}${total.toFixed(2)}`);
    });

    lines.push(`----------------------------------------`);
    lines.push(`Subtotal:    ${subtotalEl?.textContent || "0.00"}`);
    lines.push(`Discount:    ${discountEl?.textContent || "-0.00"}`);
    lines.push(`Tax:         ${taxEl?.textContent || "0.00"}`);
    lines.push(`GRAND TOTAL: ${grandTotalEl?.textContent || "0.00"}`);
    lines.push(`----------------------------------------`);
    if (notes) {
      lines.push(`Notes: ${notes}`);
    }
    lines.push(`========================================`);
    lines.push(`Customer receipt template. Not a tax invoice.`);
    return lines.join("\n");
  }

  // Copy Receipt Text
  document.getElementById("btnCopyInvoiceText")?.addEventListener("click", () => {
    const txt = generateTextReceipt();
    copyTextToClipboard(txt, "Receipt slip copied to clipboard!");
  });

  // Download Receipt File
  document.getElementById("btnDownloadInvoiceTxt")?.addEventListener("click", () => {
    const txt = generateTextReceipt();
    const invNum = document.getElementById("invNumber")?.value.trim() || "receipt";
    const safeName = invNum.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadTextFile(`${safeName}.txt`, txt);
  });

  // Print Invoice / Save as PDF (Honest feedback)
  document.getElementById("btnPrintInvoice")?.addEventListener("click", () => {
    showToast("Print dialog opened — select 'Save as PDF' to save.", "normal", 4000);
    window.print();
  });

  // Load Sample Invoice Data
  document.getElementById("btnLoadInvoiceExample")?.addEventListener("click", () => {
    document.getElementById("invBizName").value = "Al-Rehman Graphics & Printing";
    document.getElementById("invBizContact").value = "+92 300 1234567 | Lahore, Pakistan";
    document.getElementById("invClientName").value = "Tariq Mahmood";
    document.getElementById("invNumber").value = "REC-2026-081";
    document.getElementById("invTaxRate").value = "0";
    document.getElementById("invDiscount").value = "0";
    document.getElementById("invNotes").value = "Payment received with thanks via JazzCash.";

    itemsTbody.innerHTML = "";
    addRow("Flex Banner Printing (10x4 ft)", 2, 1800);
    addRow("Visiting Cards Printing (1000 Pcs)", 1, 2200);
    addRow("Social Media Logo & Post Kit", 1, 7500);
    calculateTotals();
    showToast("Loaded sample invoice data!", "normal");
  });

  // Start with 1 clean empty row
  addRow("", 1, 0);
}

/* ==========================================================================
   PART 6: MOBILE TESTING GUIDE & PERSISTENT CHECKLIST
   ========================================================================== */

function initMobileTestingGuide() {
  const phoneQrCanvas = document.getElementById("phoneTestQrCanvas");
  const phoneUrlText = document.getElementById("phoneTestUrlText");

  if (phoneQrCanvas) {
    const currentUrl = window.location.href;
    if (phoneUrlText) phoneUrlText.textContent = currentUrl;
    QRCode.toCanvas(phoneQrCanvas, currentUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M"
    }).catch(err => {
      console.warn("Could not render guide QR code:", err);
    });
  }

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
   PART 7: NAVIGATION CONTROLLER
   ========================================================================== */

function initNavigation() {
  const views = {
    qr: document.getElementById("qrToolView"),
    bio: document.getElementById("bioToolView"),
    product: document.getElementById("productToolView"),
    invoice: document.getElementById("invoiceToolView"),
    guide: document.getElementById("guideToolView"),
    about: document.getElementById("aboutToolView")
  };

  const desktopNavLinks = document.querySelectorAll(".desktop-nav .nav-link");
  const bottomNavItems = document.querySelectorAll(".bottom-nav-item");

  function switchTab(tabKey) {
    Object.keys(views).forEach(key => {
      if (views[key]) {
        views[key].classList.toggle("active", key === tabKey);
      }
    });

    desktopNavLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.tab === tabKey);
    });

    bottomNavItems.forEach(item => {
      item.classList.toggle("active", item.dataset.tab === tabKey);
    });

    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  desktopNavLinks.forEach(link => {
    link.addEventListener("click", () => switchTab(link.dataset.tab));
  });

  bottomNavItems.forEach(item => {
    item.addEventListener("click", () => switchTab(item.dataset.tab));
  });

  document.getElementById("btnHeaderTestPhone")?.addEventListener("click", () => {
    switchTab("guide");
  });

  document.querySelectorAll("[data-footer-jump]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.footerJump);
    });
  });

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
