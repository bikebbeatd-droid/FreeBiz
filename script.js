/**
 * FreeBiz Tools — Production JavaScript Engine
 * 100% Client-Side • Zero AI APIs • Zero External Tracking
 * 
 * Secure, accessible, mobile-first controller connecting UI elements
 * to verified core business logic in src/core.js.
 */

import QRCode from "qrcode";
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
  safeRemoveStorage
} from "./src/core.js";

/* ==========================================================================
   PART 1: TOAST NOTIFICATIONS & CLIPBOARD UTILITIES (SAFE DOM)
   ========================================================================== */

/**
 * Displays a toast notification with strict safe DOM element creation (Zero XSS).
 * @param {string} message
 * @param {"normal" | "success" | "error"} [type="normal"]
 * @param {number} [duration=3000]
 */
export function showToast(message, type = "normal", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  
  const iconSpan = document.createElement("span");
  iconSpan.style.fontWeight = "700";
  iconSpan.setAttribute("aria-hidden", "true");
  iconSpan.textContent = icon;

  const msgSpan = document.createElement("span");
  msgSpan.textContent = message; // Safe plain text insertion

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/**
 * Robust Cross-Browser Copy with honest user feedback.
 * @param {string} text
 * @param {string} [successMessage="Copied to clipboard!"]
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text, successMessage = "Copied to clipboard!") {
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
    console.warn("Navigator clipboard write failed, attempting execCommand fallback:", err);
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

/**
 * Downloads plain text / markup file with meaningful filename.
 * @param {string} filename
 * @param {string} content
 * @param {string} [mimeType="text/plain;charset=utf-8"]
 */
export function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
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

/* ==========================================================================
   PART 2: QR CODE TOOL CONTROLLER
   ========================================================================== */

let currentQRData = "";

export function initQRCodeTool() {
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

  // Extract payload using pure validation routines
  function getPayload() {
    switch (activeType) {
      case "url": {
        const val = document.getElementById("qrUrlInput")?.value.trim() || "";
        if (!val) return null;
        const res = validateAndFormatUrl(val);
        return res.valid ? res.url : null;
      }
      case "phone": {
        const raw = document.getElementById("qrPhoneInput")?.value.trim() || "";
        if (!raw) return null;
        const res = validatePhoneNumber(raw);
        return res.valid ? `tel:${res.phone}` : null;
      }
      case "whatsapp": {
        const rawPhone = document.getElementById("qrWaPhone")?.value.trim() || "";
        if (!rawPhone) return null;
        const rawMsg = document.getElementById("qrWaMsg")?.value.trim() || "";
        const res = formatWhatsAppPayload(rawPhone, rawMsg);
        return res.valid ? res.payload : null;
      }
      case "wifi": {
        const ssid = document.getElementById("qrWifiSsid")?.value.trim() || "";
        if (!ssid) return null;
        const enc = document.getElementById("qrWifiEnc")?.value || "WPA";
        const pass = document.getElementById("qrWifiPass")?.value || "";
        const isHidden = document.getElementById("qrWifiHidden")?.checked || false;
        const res = formatWifiPayload({ ssid, password: pass, encryption: enc, isHidden });
        return res.valid ? res.payload : null;
      }
      case "vcard": {
        const name = document.getElementById("qrCardName")?.value.trim() || "";
        const org = document.getElementById("qrCardOrg")?.value.trim() || "";
        const tel = document.getElementById("qrCardTel")?.value.trim() || "";
        const email = document.getElementById("qrCardEmail")?.value.trim() || "";
        const title = document.getElementById("qrCardTitle")?.value.trim() || "";
        const res = formatVcardPayload({ name, org, tel, email, title });
        return res.valid ? res.payload : null;
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
    let fg = fgColorInput?.value || "#0f172a";
    let bg = bgColorInput?.value || "#ffffff";
    if (!isValidHexColor(fg)) fg = "#0f172a";
    if (!isValidHexColor(bg)) bg = "#ffffff";

    const size = parseInt(sizeSelect?.value || "280", 10);
    const ec = ecSelect?.value || "M";

    // Validate WCAG color contrast
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

  // Bind input listeners
  const inputsToWatch = document.querySelectorAll(
    "#qrFieldsUrl input, #qrFieldsPhone input, #qrFieldsWhatsapp input, #qrFieldsWhatsapp textarea, #qrFieldsWifi input, #qrFieldsWifi select, #qrFieldsVcard input, #qrFieldsText textarea, #qrFgColor, #qrBgColor, #qrSize, #qrEcLevel, #qrWifiHidden"
  );
  inputsToWatch.forEach(el => {
    el.addEventListener("input", updateQR);
    el.addEventListener("change", updateQR);
  });

  // Wi-Fi security toggle: hide password when open
  document.getElementById("qrWifiEnc")?.addEventListener("change", e => {
    const passGroup = document.getElementById("qrWifiPassGroup");
    if (passGroup) {
      passGroup.style.display = e.target.value === "nopass" ? "none" : "block";
    }
  });

  // Foreground swatches: strictly binds to [data-swatch-fg]
  document.querySelectorAll("[data-swatch-fg]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (fgColorInput) fgColorInput.value = btn.dataset.swatchFg;
      updateQR();
    });
  });

  // Background swatches: strictly binds to [data-swatch-bg]
  document.querySelectorAll("[data-swatch-bg]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (bgColorInput) bgColorInput.value = btn.dataset.swatchBg;
      updateQR();
    });
  });

  // Download PNG
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

  // Download SVG
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

  // Copy QR Image (Honest browser detection)
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

  // Print QR Code
  btnPrint?.addEventListener("click", () => {
    if (!currentQRData) {
      showToast("Please enter content to generate a QR code before printing.", "error");
      return;
    }
    window.print();
  });

  // Explicit Sample Data Loader
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

  // Starts with clean empty inputs
  updateQR();
}

/* ==========================================================================
   PART 3: BUSINESS BIO GENERATOR (Predefined Templates, Safe DOM)
   ========================================================================== */

export function initBioTool() {
  const form = document.getElementById("bioGeneratorForm");
  const resultsContainer = document.getElementById("bioResultsList");
  if (!form || !resultsContainer) return;

  function generateBios() {
    const name = document.getElementById("bioBizName")?.value;
    const niche = document.getElementById("bioNiche")?.value;
    const benefit = document.getElementById("bioBenefit")?.value;
    const location = document.getElementById("bioLocation")?.value;
    const audience = document.getElementById("bioAudience")?.value;
    const cta = document.getElementById("bioCta")?.value;
    const tone = document.getElementById("bioTone")?.value;
    const platform = document.getElementById("bioPlatform")?.value;

    const res = generateBioOutputs({ name, niche, benefit, location, audience, cta, tone, platform });
    if (!res.valid) {
      showToast(res.error, "error");
      return;
    }

    resultsContainer.innerHTML = "";

    const platformNames = {
      instagram: "Instagram & TikTok",
      google: "Google Business",
      linkedin: "LinkedIn / Professional",
      twitter: "Twitter / X (<160 chars)",
      website: "Website About Us"
    };

    res.results.forEach((item, idx) => {
      // Build safe DOM tree using document.createElement (Zero XSS)
      const card = document.createElement("div");
      card.className = "result-card";

      const meta = document.createElement("div");
      meta.className = "result-meta";

      const tag = document.createElement("span");
      tag.className = "result-tag";
      tag.textContent = `Option ${idx + 1} • ${platformNames[platform] || "Bio"}`;

      const counter = document.createElement("span");
      counter.className = "char-counter";
      counter.textContent = `${item.charCount} chars · ${item.wordCount} words`;

      meta.appendChild(tag);
      meta.appendChild(counter);

      const textarea = document.createElement("textarea");
      textarea.className = "result-text-area";
      textarea.rows = 4;
      textarea.setAttribute("aria-label", `Editable bio option ${idx + 1}`);
      textarea.value = item.text; // Safe value assignment

      textarea.addEventListener("input", () => {
        const curChar = textarea.value.length;
        const curWord = textarea.value.split(/\s+/).filter(Boolean).length;
        counter.textContent = `${curChar} chars · ${curWord} words`;
      });

      const actions = document.createElement("div");
      actions.className = "result-actions";

      const btnCopy = document.createElement("button");
      btnCopy.type = "button";
      btnCopy.className = "btn btn-secondary btn-sm";
      btnCopy.innerHTML = `<span aria-hidden="true">📋</span> Copy Bio`;
      btnCopy.addEventListener("click", () => {
        copyTextToClipboard(textarea.value, "Bio copied to clipboard!");
      });

      const btnDownload = document.createElement("button");
      btnDownload.type = "button";
      btnDownload.className = "btn btn-secondary btn-sm";
      btnDownload.innerHTML = `<span aria-hidden="true">💾</span> Save TXT`;
      btnDownload.addEventListener("click", () => {
        const safeName = (name || "business").toLowerCase().replace(/[^a-z0-9]/g, "-");
        downloadTextFile(`${safeName}-bio-${idx + 1}.txt`, textarea.value);
      });

      actions.appendChild(btnCopy);
      actions.appendChild(btnDownload);

      card.appendChild(meta);
      card.appendChild(textarea);
      card.appendChild(actions);

      resultsContainer.appendChild(card);
    });

    showToast(`Generated 3 ${platform} bio drafts!`, "success");
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    generateBios();
  });

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
   PART 4: PRODUCT DESCRIPTION GENERATOR (Safe DOM, Zero XSS)
   ========================================================================== */

export function initProductDescTool() {
  const form = document.getElementById("productDescForm");
  const resultsContainer = document.getElementById("productDescResults");
  if (!form || !resultsContainer) return;

  function generateProductDescription() {
    const name = document.getElementById("prodName")?.value;
    const category = document.getElementById("prodCategory")?.value;
    const rawFeatures = document.getElementById("prodFeatures")?.value;
    const benefit = document.getElementById("prodBenefit")?.value;
    const priceOffer = document.getElementById("prodOffer")?.value;
    const style = document.getElementById("prodStyle")?.value;

    const res = generateProductDescriptionOutputs({
      name,
      category,
      rawFeatures,
      benefit,
      priceOffer,
      style
    });

    if (!res.valid) {
      showToast(res.error, "error");
      return;
    }

    resultsContainer.innerHTML = "";

    // Build DOM safely without raw user HTML interpolation (Zero XSS)
    const card = document.createElement("div");
    card.className = "result-card";

    const meta = document.createElement("div");
    meta.className = "result-meta";

    const tag = document.createElement("span");
    tag.className = "result-tag";
    tag.textContent = `${name.trim()} • ${style.toUpperCase()} Style`;

    const counter = document.createElement("span");
    counter.className = "char-counter";
    counter.textContent = `${res.charCount} chars · ${res.wordCount} words`;

    meta.appendChild(tag);
    meta.appendChild(counter);

    const textarea = document.createElement("textarea");
    textarea.id = "productDescTextarea";
    textarea.className = "result-text-area";
    textarea.rows = 8;
    textarea.setAttribute("aria-label", "Editable product description");
    textarea.value = res.plainText; // Safe value assignment

    textarea.addEventListener("input", () => {
      const curChar = textarea.value.length;
      const curWord = textarea.value.split(/\s+/).filter(Boolean).length;
      counter.textContent = `${curChar} chars · ${curWord} words`;
    });

    const actions = document.createElement("div");
    actions.className = "result-actions";
    actions.style.flexWrap = "wrap";

    const btnCopyDesc = document.createElement("button");
    btnCopyDesc.type = "button";
    btnCopyDesc.id = "btnCopyProductDesc";
    btnCopyDesc.className = "btn btn-primary btn-sm";
    btnCopyDesc.innerHTML = `<span aria-hidden="true">📋</span> Copy Description`;
    btnCopyDesc.addEventListener("click", () => {
      copyTextToClipboard(textarea.value, "Product description copied to clipboard!");
    });

    const btnCopyHtml = document.createElement("button");
    btnCopyHtml.type = "button";
    btnCopyHtml.id = "btnCopyProductHtml";
    btnCopyHtml.className = "btn btn-secondary btn-sm";
    btnCopyHtml.innerHTML = `<span aria-hidden="true">🌐</span> Copy HTML`;
    btnCopyHtml.addEventListener("click", () => {
      // res.htmlSnippet has all user values safely escaped via escapeHtml()
      copyTextToClipboard(res.htmlSnippet, "HTML snippet copied to clipboard!");
    });

    const btnDownloadTxt = document.createElement("button");
    btnDownloadTxt.type = "button";
    btnDownloadTxt.id = "btnDownloadProductTxt";
    btnDownloadTxt.className = "btn btn-secondary btn-sm";
    btnDownloadTxt.innerHTML = `<span aria-hidden="true">💾</span> Save TXT`;
    btnDownloadTxt.addEventListener("click", () => {
      const safeName = (name || "product").toLowerCase().replace(/[^a-z0-9]/g, "-");
      downloadTextFile(`${safeName}-description.txt`, textarea.value);
    });

    actions.appendChild(btnCopyDesc);
    actions.appendChild(btnCopyHtml);
    actions.appendChild(btnDownloadTxt);

    card.appendChild(meta);
    card.appendChild(textarea);
    card.appendChild(actions);

    resultsContainer.appendChild(card);
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

export function initInvoiceTool() {
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

  // Initialize with client's current local date
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }

  function getCurrencySymbol() {
    const selected = currencySelect?.options[currencySelect.selectedIndex];
    return selected?.dataset.symbol || "Rs. ";
  }

  function getCurrencyCode() {
    return currencySelect?.value || "PKR";
  }

  function calculateTotals() {
    const sym = getCurrencySymbol();
    const rows = itemsTbody.querySelectorAll("tr");
    const rawItems = [];

    rows.forEach(row => {
      const desc = row.querySelector(".inv-item-desc")?.value || "";
      const qty = row.querySelector(".inv-item-qty")?.value;
      const price = row.querySelector(".inv-item-price")?.value;
      rawItems.push({ desc, qty, price });
    });

    const summary = calculateInvoiceSummary(
      rawItems,
      taxRateInput?.value,
      discountInput?.value
    );

    // Update row item totals
    rows.forEach((row, i) => {
      const rowTotalEl = row.querySelector(".inv-item-total");
      if (rowTotalEl && summary.items[i]) {
        rowTotalEl.textContent = formatCurrency(summary.items[i].total, sym);
      }
    });

    if (subtotalEl) subtotalEl.textContent = formatCurrency(summary.subtotal, sym);
    if (taxEl) taxEl.textContent = formatCurrency(summary.taxAmount, sym);
    if (discountEl) discountEl.textContent = `-${formatCurrency(summary.discount, sym)}`;
    if (grandTotalEl) grandTotalEl.textContent = formatCurrency(summary.grandTotal, sym);

    return summary;
  }

  function addRow(desc = "", qty = 1, price = 0) {
    const tr = document.createElement("tr");

    // td 1: Description
    const tdDesc = document.createElement("td");
    const inputDesc = document.createElement("input");
    inputDesc.type = "text";
    inputDesc.className = "form-control inv-item-desc";
    inputDesc.placeholder = "Item description";
    inputDesc.style.minHeight = "42px";
    inputDesc.style.padding = "4px 8px";
    inputDesc.setAttribute("aria-label", "Item description");
    inputDesc.value = desc;
    tdDesc.appendChild(inputDesc);

    // td 2: Quantity
    const tdQty = document.createElement("td");
    tdQty.style.width = "70px";
    const inputQty = document.createElement("input");
    inputQty.type = "number";
    inputQty.className = "form-control inv-item-qty";
    inputQty.min = "1";
    inputQty.step = "1";
    inputQty.style.minHeight = "42px";
    inputQty.style.padding = "4px 8px";
    inputQty.style.textAlign = "center";
    inputQty.setAttribute("aria-label", "Quantity");
    inputQty.value = String(qty);
    tdQty.appendChild(inputQty);

    // td 3: Unit Price
    const tdPrice = document.createElement("td");
    tdPrice.style.width = "100px";
    const inputPrice = document.createElement("input");
    inputPrice.type = "number";
    inputPrice.className = "form-control inv-item-price";
    inputPrice.min = "0";
    inputPrice.step = "10";
    inputPrice.style.minHeight = "42px";
    inputPrice.style.padding = "4px 8px";
    inputPrice.style.textAlign = "right";
    inputPrice.setAttribute("aria-label", "Unit price");
    inputPrice.value = String(price);
    tdPrice.appendChild(inputPrice);

    // td 4: Row Total
    const tdTotal = document.createElement("td");
    tdTotal.style.width = "90px";
    tdTotal.style.textAlign = "right";
    tdTotal.style.fontWeight = "600";
    tdTotal.className = "inv-item-total";
    tdTotal.textContent = formatCurrency(validateQuantity(qty) * validatePrice(price), getCurrencySymbol());

    // td 5: Delete button
    const tdDel = document.createElement("td");
    tdDel.style.width = "48px";
    tdDel.style.textAlign = "center";
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn btn-secondary btn-delete-row";
    btnDel.title = "Remove item";
    btnDel.setAttribute("aria-label", "Remove item");
    btnDel.style.minHeight = "42px";
    btnDel.style.minWidth = "42px";
    btnDel.style.padding = "0";
    btnDel.style.color = "var(--accent-danger)";
    btnDel.textContent = "✕";

    btnDel.addEventListener("click", () => {
      if (itemsTbody.children.length > 1) {
        tr.remove();
        calculateTotals();
      } else {
        showToast("Invoice must contain at least 1 item", "error");
      }
    });

    tdDel.appendChild(btnDel);

    tr.appendChild(tdDesc);
    tr.appendChild(tdQty);
    tr.appendChild(tdPrice);
    tr.appendChild(tdTotal);
    tr.appendChild(tdDel);

    // Live recalculation on typing
    tr.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", calculateTotals);
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

  function getReceiptSlipText() {
    const rows = itemsTbody.querySelectorAll("tr");
    const rawItems = [];
    rows.forEach(row => {
      const desc = row.querySelector(".inv-item-desc")?.value || "";
      const qty = row.querySelector(".inv-item-qty")?.value;
      const price = row.querySelector(".inv-item-price")?.value;
      rawItems.push({ desc, qty, price });
    });

    return generateReceiptTextSlip({
      bizName: document.getElementById("invBizName")?.value,
      bizContact: document.getElementById("invBizContact")?.value,
      clientName: document.getElementById("invClientName")?.value,
      invNumber: document.getElementById("invNumber")?.value,
      invDate: document.getElementById("invDate")?.value,
      notes: document.getElementById("invNotes")?.value,
      currencyCode: getCurrencyCode(),
      currencySymbol: getCurrencySymbol(),
      items: rawItems,
      taxRate: taxRateInput?.value,
      discount: discountInput?.value
    });
  }

  // Copy Receipt Text
  document.getElementById("btnCopyInvoiceText")?.addEventListener("click", () => {
    const txt = getReceiptSlipText();
    copyTextToClipboard(txt, "Receipt slip copied to clipboard!");
  });

  // Download Receipt File
  document.getElementById("btnDownloadInvoiceTxt")?.addEventListener("click", () => {
    const txt = getReceiptSlipText();
    const invNum = document.getElementById("invNumber")?.value.trim() || "receipt";
    const safeName = invNum.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadTextFile(`${safeName}.txt`, txt);
  });

  // Print Invoice / Save as PDF
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

export function initMobileTestingGuide() {
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
    const saved = safeGetStorage(`freebiz_check_${idx}`);
    if (saved === "true") cb.checked = true;

    cb.addEventListener("change", () => {
      safeSetStorage(`freebiz_check_${idx}`, cb.checked ? "true" : "false");
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
      safeRemoveStorage(`freebiz_check_${idx}`);
    });
    updateChecklistProgress();
    showToast("Checklist reset", "normal");
  });

  updateChecklistProgress();
}

/* ==========================================================================
   PART 7: NAVIGATION CONTROLLER
   ========================================================================== */

export function initNavigation() {
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
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initQRCodeTool();
    initBioTool();
    initProductDescTool();
    initInvoiceTool();
    initMobileTestingGuide();
  });
}
