/**
 * FreeBiz Tools — Production JavaScript Engine
 * 100% Client-Side • Zero AI APIs • Zero External Tracking
 * 
 * Secure, accessible, mobile-first controller connecting UI elements
 * to verified core business logic in src/core.js.
 */

import QRCode from "qrcode";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
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
  safeRemoveStorage,
  isSafeUrlToOpen,
  decodeQrPixels,
  parseQrPayload,
  createQrPngBlob,
  triggerBlobDownload
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

  // Save a QR image through Android's native share sheet in Capacitor,
  // or through a browser download outside the native app.
  async function saveOrShareQrPng(blob, filename, intent = "download") {
    if (Capacitor.isNativePlatform()) {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read generated PNG"));
        reader.readAsDataURL(blob);
      });
      const base64 = dataUrl.split(",")[1];
      if (!base64) throw new Error("Could not encode PNG for Android");
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true
      });
      await Share.share({
        title: "FreeBiz QR Code",
        text: `QR code image — ${currentQRData}`,
        url: saved.uri,
        dialogTitle: intent === "download" ? "Save QR image" : "Share QR image"
      });
      showToast("QR image is ready. Choose a save destination in the Android share menu.", "success");
      return true;
    }

    if (intent === "share" && navigator.canShare) {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "FreeBiz QR Code", text: currentQRData });
        showToast("QR image shared.", "success");
        return true;
      }
    }

    const ok = triggerBlobDownload(filename, blob);
    if (!ok) throw new Error("Browser blocked the download. Try Share / Save Image instead.");
    showToast(`Download started: ${filename}`, "success");
    return true;
  }

  btnDownloadPng?.addEventListener("click", async () => {
    if (!currentQRData) {
      showToast("Please enter content to generate a QR code first.", "error");
      return;
    }
    const filename = `freebiz-qr-${activeType}-${Date.now()}.png`;
    btnDownloadPng.disabled = true;
    try {
      const blobRes = await createQrPngBlob(canvas);
      if (!blobRes.success || !blobRes.blob) throw new Error(blobRes.error || "PNG generation failed");
      await saveOrShareQrPng(blobRes.blob, filename, "download");
    } catch (err) {
      console.error("PNG save error:", err);
      if (err?.name !== "AbortError") showToast("Image not saved: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      btnDownloadPng.disabled = false;
    }
  });

  const btnShareQrImage = document.getElementById("btnShareQrImage");
  btnShareQrImage?.addEventListener("click", async () => {
    if (!currentQRData) {
      showToast("Please enter content to generate a QR code first.", "error");
      return;
    }
    const filename = `freebiz-qr-${activeType}-${Date.now()}.png`;
    btnShareQrImage.disabled = true;
    try {
      const blobRes = await createQrPngBlob(canvas);
      if (!blobRes.success || !blobRes.blob) throw new Error(blobRes.error || "PNG generation failed");
      await saveOrShareQrPng(blobRes.blob, filename, "share");
    } catch (err) {
      console.error("Share error:", err);
      if (err?.name !== "AbortError") showToast("Could not share image: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      btnShareQrImage.disabled = false;
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
   PART 2.5: QR CODE SCANNER & IMAGE DECODER ENGINE
   ========================================================================== */

export function initQrScannerTool() {
  const video = document.getElementById("scannerVideo");
  const canvas = document.getElementById("scannerVideoCanvas");
  const ctx = canvas?.getContext("2d", { willReadFrequently: true });
  const overlay = document.getElementById("scannerOverlay");
  const stoppedState = document.getElementById("scannerStoppedState");
  const statusNotice = document.getElementById("cameraStatusNotice");
  const statusText = document.getElementById("cameraStatusText");
  const statusBadge = document.getElementById("scannerStatusBadge");

  const btnToggleCamera = document.getElementById("btnToggleCamera");
  const btnToggleCameraText = document.getElementById("btnToggleCameraText");
  const btnToggleCameraIcon = document.getElementById("btnToggleCameraIcon");
  const btnStartOverlay = document.getElementById("btnStartCameraOverlay");
  const btnSwitchCamera = document.getElementById("btnSwitchCamera");
  const btnToggleTorch = document.getElementById("btnToggleTorch");

  const tabCamera = document.getElementById("tabScannerCamera");
  const tabImage = document.getElementById("tabScannerImage");
  const panelCamera = document.getElementById("scannerCameraPanel");
  const panelImage = document.getElementById("scannerImagePanel");

  const fileInput = document.getElementById("scannerFileInput");
  const dropZone = document.getElementById("scannerDropZone");
  const btnBrowseFile = document.getElementById("btnBrowseFile");
  const imgPreviewContainer = document.getElementById("imagePreviewContainer");
  const imgPreview = document.getElementById("scannerImagePreview");
  const btnClearImage = document.getElementById("btnClearImage");

  const emptyState = document.getElementById("scannerEmptyState");
  const activeResult = document.getElementById("scannerActiveResult");
  const typeIcon = document.getElementById("scanTypeIcon");
  const typeLabel = document.getElementById("scanTypeLabel");
  const resultTime = document.getElementById("scanResultTime");
  const resultDetails = document.getElementById("scanResultDetails");
  const resultRaw = document.getElementById("scanResultRaw");

  const btnCopyResult = document.getElementById("btnCopyScanResult");
  const btnOpenLink = document.getElementById("btnOpenScanLink");
  const btnShareResult = document.getElementById("btnShareScanResult");
  const btnResetScan = document.getElementById("btnResetScan");
  const historyList = document.getElementById("scannerHistoryList");
  const btnClearHistory = document.getElementById("btnClearScanHistory");

  let mediaStream = null;
  let videoTrack = null;
  let scanAnimationId = null;
  let isScanning = false;
  let currentCameraFacing = "environment";
  let torchEnabled = false;
  let currentScanResult = null;

  // Local History Storage
  const HISTORY_KEY = "freebiz_scan_history_v1";

  function loadHistory() {
    const raw = safeGetStorage(HISTORY_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveScanToHistory(payload) {
    const history = loadHistory();
    const item = {
      id: Date.now(),
      raw: payload.raw,
      type: payload.type,
      typeLabel: payload.typeLabel,
      icon: payload.icon,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toLocaleDateString()
    };
    const filtered = history.filter(h => h.raw !== item.raw);
    filtered.unshift(item);
    safeSetStorage(HISTORY_KEY, JSON.stringify(filtered.slice(0, 20)));
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    const history = loadHistory();
    historyList.innerHTML = "";
    if (history.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size: 0.78rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0;";
      empty.textContent = "No previous scans saved.";
      historyList.appendChild(empty);
      return;
    }

    history.forEach(item => {
      const row = document.createElement("div");
      row.className = "scanner-history-item";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Load scanned ${item.typeLabel}: ${item.raw}`);

      const left = document.createElement("div");
      left.style.cssText = "display: flex; align-items: center; gap: 0.5rem; overflow: hidden; flex: 1;";

      const badge = document.createElement("span");
      badge.textContent = item.icon || "📄";
      left.appendChild(badge);

      const content = document.createElement("span");
      content.className = "hist-content";
      content.textContent = item.raw;
      left.appendChild(content);

      const time = document.createElement("span");
      time.className = "hist-time";
      time.textContent = item.timestamp;

      row.appendChild(left);
      row.appendChild(time);

      row.addEventListener("click", () => {
        handleSuccessfulDecode(item.raw, false);
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSuccessfulDecode(item.raw, false);
        }
      });

      historyList.appendChild(row);
    });
  }

  btnClearHistory?.addEventListener("click", () => {
    safeRemoveStorage(HISTORY_KEY);
    renderHistory();
    showToast("Scan history cleared", "normal");
  });

  // Display decoded result in UI
  function displayResult(parsed) {
    currentScanResult = parsed;
    if (emptyState) emptyState.style.display = "none";
    if (activeResult) activeResult.style.display = "block";
    if (statusBadge) {
      statusBadge.textContent = "Decoded Successfully";
      statusBadge.style.color = "var(--success)";
    }

    if (typeIcon) typeIcon.textContent = parsed.icon;
    if (typeLabel) typeLabel.textContent = parsed.typeLabel;
    if (resultTime) {
      resultTime.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    if (resultRaw) {
      resultRaw.textContent = parsed.raw;
    }

    // Render structured key-value details safely via DOM
    if (resultDetails) {
      resultDetails.innerHTML = "";
      const entries = Object.entries(parsed.details || {});
      if (entries.length > 0) {
        entries.forEach(([key, val]) => {
          const row = document.createElement("div");
          row.className = "scan-detail-row";

          const kSpan = document.createElement("span");
          kSpan.className = "scan-detail-key";
          kSpan.textContent = key;

          const vSpan = document.createElement("span");
          vSpan.className = "scan-detail-val";
          vSpan.textContent = String(val);

          row.appendChild(kSpan);
          row.appendChild(vSpan);
          resultDetails.appendChild(row);
        });
        resultDetails.style.display = "flex";
      } else {
        resultDetails.style.display = "none";
      }
    }

    // Open Link action (Safe URL strictly enforced)
    if (btnOpenLink) {
      if (parsed.isSafeUrl && parsed.safeUrl) {
        btnOpenLink.href = parsed.safeUrl;
        btnOpenLink.style.display = "inline-flex";
        btnOpenLink.textContent = "";
        const icon = document.createElement("span");
        icon.textContent = "🔗 ";
        btnOpenLink.appendChild(icon);
        btnOpenLink.appendChild(document.createTextNode("Open Link"));
      } else {
        btnOpenLink.style.display = "none";
        btnOpenLink.removeAttribute("href");
      }
    }
  }

  function handleSuccessfulDecode(rawText, shouldSave = true) {
    const parsed = parseQrPayload(rawText);
    displayResult(parsed);
    if (shouldSave) {
      saveScanToHistory(parsed);
      try {
        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      } catch {}
      showToast(`Scanned ${parsed.typeLabel}!`, "success");
    }
  }

  // Camera Management
  async function startCamera() {
    if (isScanning) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser or environment.");
      }

      setCameraUIState("starting");
      
      const constraints = {
        video: {
          facingMode: { ideal: currentCameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback: try basic video without constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (video) {
        video.srcObject = mediaStream;
        await video.play();
      }

      videoTrack = mediaStream.getVideoTracks()[0];
      isScanning = true;
      setCameraUIState("active");

      // Check device capabilities
      checkCameraCapabilities();

      // Start scan loop
      requestScanFrame();
    } catch (err) {
      console.error("Camera access error:", err);
      stopCamera();
      handleCameraError(err);
    }
  }

  function stopCamera() {
    isScanning = false;
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      mediaStream = null;
    }
    videoTrack = null;
    if (video) video.srcObject = null;
    setCameraUIState("stopped");
  }

  function setCameraUIState(state) {
    if (state === "active") {
      if (stoppedState) stoppedState.style.display = "none";
      if (overlay) overlay.style.display = "flex";
      if (btnToggleCameraText) btnToggleCameraText.textContent = "Stop Camera";
      if (btnToggleCameraIcon) btnToggleCameraIcon.textContent = "⏹️";
      if (statusText) statusText.textContent = "Camera active: Align any QR code within the cyan corners to scan.";
      if (statusNotice) {
        statusNotice.className = "notice-box notice-info";
        statusNotice.style.display = "flex";
      }
    } else if (state === "starting") {
      if (statusText) statusText.textContent = "Requesting camera permission...";
    } else {
      // Stopped
      if (stoppedState) stoppedState.style.display = "flex";
      if (overlay) overlay.style.display = "none";
      if (btnToggleCameraText) btnToggleCameraText.textContent = "Start Camera";
      if (btnToggleCameraIcon) btnToggleCameraIcon.textContent = "▶️";
      if (btnToggleTorch) btnToggleTorch.style.display = "none";
    }
  }

  function handleCameraError(err) {
    let msg = "Could not start camera.";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      msg = "Camera permission was denied. Please allow camera access in your browser/device settings, or decode using 'Decode from Image'.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      msg = "No camera found on this device. You can decode any QR code using 'Decode from Image'.";
    } else if (err.name === "NotReadableError") {
      msg = "Camera is currently being used by another application. Please close other camera apps and retry.";
    } else {
      msg = err.message || "Camera unavailable.";
    }

    if (statusText) statusText.textContent = msg;
    if (statusNotice) {
      statusNotice.className = "notice-box notice-warning";
      statusNotice.style.display = "flex";
    }
    showToast(msg, "error", 4500);
  }

  async function checkCameraCapabilities() {
    if (!videoTrack) return;
    try {
      const caps = typeof videoTrack.getCapabilities === "function" ? videoTrack.getCapabilities() : {};
      if ("torch" in caps && btnToggleTorch) {
        btnToggleTorch.style.display = "inline-flex";
      } else if (btnToggleTorch) {
        btnToggleTorch.style.display = "none";
      }
    } catch {}

    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === "videoinput");
        if (videoInputs.length > 1 && btnSwitchCamera) {
          btnSwitchCamera.style.display = "inline-flex";
        } else if (btnSwitchCamera) {
          btnSwitchCamera.style.display = "none";
        }
      }
    } catch {}
  }

  // Camera torch toggle
  btnToggleTorch?.addEventListener("click", async () => {
    if (!videoTrack) return;
    try {
      torchEnabled = !torchEnabled;
      await videoTrack.applyConstraints({
        advanced: [{ torch: torchEnabled }]
      });
      btnToggleTorch.classList.toggle("active", torchEnabled);
      showToast(torchEnabled ? "Torch on" : "Torch off", "normal");
    } catch (err) {
      console.warn("Torch error:", err);
      showToast("Torch control unsupported on this device", "error");
    }
  });

  // Switch camera front/back
  btnSwitchCamera?.addEventListener("click", () => {
    currentCameraFacing = currentCameraFacing === "environment" ? "user" : "environment";
    stopCamera();
    startCamera();
  });

  // Continuous Video Scan Loop
  function requestScanFrame() {
    if (!isScanning) return;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decodeRes = decodeQrPixels(imgData.data, canvas.width, canvas.height);

      if (decodeRes.success && decodeRes.data) {
        handleSuccessfulDecode(decodeRes.data, true);
        stopCamera();
        return;
      }
    }
    scanAnimationId = requestAnimationFrame(requestScanFrame);
  }

  // Camera toggle buttons
  btnToggleCamera?.addEventListener("click", () => {
    if (isScanning) stopCamera();
    else startCamera();
  });
  btnStartOverlay?.addEventListener("click", () => {
    startCamera();
  });

  // Mode Tabs Switching
  tabCamera?.addEventListener("click", () => {
    tabCamera.classList.add("active");
    tabCamera.setAttribute("aria-selected", "true");
    tabImage?.classList.remove("active");
    tabImage?.setAttribute("aria-selected", "false");
    if (panelCamera) panelCamera.style.display = "block";
    if (panelImage) panelImage.style.display = "none";
  });

  tabImage?.addEventListener("click", () => {
    tabImage.classList.add("active");
    tabImage.setAttribute("aria-selected", "true");
    tabCamera?.classList.remove("active");
    tabCamera?.setAttribute("aria-selected", "false");
    if (panelImage) panelImage.style.display = "block";
    if (panelCamera) panelCamera.style.display = "none";
    stopCamera();
  });

  // Image File Decoding
  function decodeImageFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Please choose an image file (PNG, JPG, WebP)", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (imgPreview) imgPreview.src = img.src;
        if (imgPreviewContainer) imgPreviewContainer.style.display = "block";

        const offCanvas = document.createElement("canvas");
        offCanvas.width = img.naturalWidth || img.width;
        offCanvas.height = img.naturalHeight || img.height;
        const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
        if (!offCtx) {
          showToast("Could not allocate canvas for image processing", "error");
          return;
        }

        offCtx.drawImage(img, 0, 0);
        const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const result = decodeQrPixels(imgData.data, offCanvas.width, offCanvas.height);

        if (result.success && result.data) {
          handleSuccessfulDecode(result.data, true);
        } else {
          showToast("No readable QR code found in this image. Ensure the code is clear and unblurred.", "error", 4500);
          if (statusBadge) {
            statusBadge.textContent = "Unreadable Code";
            statusBadge.style.color = "var(--danger)";
          }
        }
      };
      img.onerror = () => {
        showToast("Could not read image file", "error");
      };
      if (typeof e.target?.result === "string") {
        img.src = e.target.result;
      }
    };
    reader.onerror = () => {
      showToast("Failed to read file from storage", "error");
    };
    reader.readAsDataURL(file);
  }

  // File input change
  fileInput?.addEventListener("change", (e) => {
    const target = e.target;
    const file = target?.files?.[0];
    if (file) decodeImageFile(file);
  });

  btnBrowseFile?.addEventListener("click", () => {
    fileInput?.click();
  });

  // Dropzone interactions
  dropZone?.addEventListener("click", (e) => {
    if (e.target !== btnBrowseFile) fileInput?.click();
  });
  dropZone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput?.click();
    }
  });
  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone?.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) decodeImageFile(file);
  });

  btnClearImage?.addEventListener("click", () => {
    if (fileInput) fileInput.value = "";
    if (imgPreview) imgPreview.src = "";
    if (imgPreviewContainer) imgPreviewContainer.style.display = "none";
  });

  // Result card actions
  btnCopyResult?.addEventListener("click", () => {
    if (!currentScanResult || !currentScanResult.raw) {
      showToast("No decoded content to copy", "error");
      return;
    }
    copyTextToClipboard(currentScanResult.raw, "Scanned content copied to clipboard!");
  });

  btnShareResult?.addEventListener("click", async () => {
    if (!currentScanResult || !currentScanResult.raw) {
      showToast("No decoded content to share", "error");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Scanned ${currentScanResult.typeLabel}`,
          text: currentScanResult.raw
        });
        showToast("Shared successfully", "success");
      } catch (err) {
        if (err.name !== "AbortError") {
          copyTextToClipboard(currentScanResult.raw, "Copied content to clipboard instead");
        }
      }
    } else {
      copyTextToClipboard(currentScanResult.raw, "Sharing unsupported: Copied content to clipboard!");
    }
  });

  btnResetScan?.addEventListener("click", () => {
    currentScanResult = null;
    if (emptyState) emptyState.style.display = "block";
    if (activeResult) activeResult.style.display = "none";
    if (statusBadge) {
      statusBadge.textContent = "Awaiting Scan";
      statusBadge.style.color = "var(--text-muted)";
    }
    if (panelCamera && panelCamera.style.display !== "none") {
      startCamera();
    }
  });

  // Initial render of history
  renderHistory();

  return {
    stopCamera
  };
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
    // Prevent zero or negative quantity items from being added
    const safeQty = Math.max(1, validateQuantity(qty) || 1);
    const safePrice = Math.max(0, validatePrice(price) || 0);

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

    // td 2: Quantity (strictly >= 1)
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
    inputQty.value = String(safeQty);

    inputQty.addEventListener("input", () => {
      const val = Number(inputQty.value);
      if (!Number.isFinite(val) || val < 1) {
        inputQty.style.borderColor = "var(--accent-danger)";
      } else {
        inputQty.style.borderColor = "";
      }
      calculateTotals();
    });

    inputQty.addEventListener("blur", () => {
      const val = Number(inputQty.value);
      if (!Number.isFinite(val) || val < 1) {
        inputQty.value = "1";
        inputQty.style.borderColor = "";
        calculateTotals();
      } else {
        inputQty.value = String(Math.floor(val));
      }
    });

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
    inputPrice.value = String(safePrice);

    inputPrice.addEventListener("input", () => {
      const val = Number(inputPrice.value);
      if (!Number.isFinite(val) || val < 0) {
        inputPrice.style.borderColor = "var(--accent-danger)";
      } else {
        inputPrice.style.borderColor = "";
      }
      calculateTotals();
    });

    inputPrice.addEventListener("blur", () => {
      const val = Number(inputPrice.value);
      if (!Number.isFinite(val) || val < 0) {
        inputPrice.value = "0";
        inputPrice.style.borderColor = "";
        calculateTotals();
      }
    });

    tdPrice.appendChild(inputPrice);

    // td 4: Row Total
    const tdTotal = document.createElement("td");
    tdTotal.style.width = "90px";
    tdTotal.style.textAlign = "right";
    tdTotal.style.fontWeight = "600";
    tdTotal.className = "inv-item-total";
    tdTotal.textContent = formatCurrency(safeQty * safePrice, getCurrencySymbol());

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

export function initNavigation(scannerController = null) {
  const views = {
    scanner: document.getElementById("scannerToolView"),
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
    // If navigating away from scanner, stop the camera
    if (tabKey !== "scanner" && scannerController && typeof scannerController.stopCamera === "function") {
      scannerController.stopCamera();
    }

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
    linkOrBtnListener(item, () => switchTab(item.dataset.tab));
  });

  function linkOrBtnListener(el, fn) {
    el.addEventListener("click", fn);
  }

  document.getElementById("btnHeaderScanner")?.addEventListener("click", () => {
    switchTab("scanner");
  });

  document.getElementById("btnJumpToScanner")?.addEventListener("click", () => {
    switchTab("scanner");
  });

  document.getElementById("btnJumpToGenerator")?.addEventListener("click", () => {
    switchTab("qr");
  });

  document.querySelectorAll("[data-footer-jump]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.footerJump);
    });
  });

  // Default initial active tab
  switchTab("qr");
}

// Global DOM Ready Initialization
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const scanner = initQrScannerTool();
    initNavigation(scanner);
    initQRCodeTool();
    initBioTool();
    initProductDescTool();
    initInvoiceTool();
    initMobileTestingGuide();
  });
}
