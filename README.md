# FreeBiz Tools ⚡

> **100% Free, Private, Mobile-First Business Utilities**  
> Run completely client-side in your web browser. Zero accounts, zero subscription fees, zero external AI APIs, and zero tracking.

---

## 🛠️ Included Tools

1. **QR Code Generator**
   - Supports: Website/Profile URLs, Phone Calls, WhatsApp direct chats, Wi-Fi networks (with MECARD special character escaping), vCard 3.0 digital business cards, and Plain text.
   - High-contrast pattern and background color selection with automatic WCAG contrast warning.
   - Error correction levels L (7%), M (15%), Q (25%), and H (30%).
   - Exports: PNG download, vector SVG download, copy image/link to clipboard, and print-ready card.
   - Verified against camera decoders and automated `jsQR` scan suites.

2. **Business Bio & Profile Generator**
   - Predefined, high-converting copy templates for Instagram & TikTok (under 150 characters), Google Business / Local, LinkedIn / Professional, Twitter / X, and Website About Us.
   - Selectable brand tones: Friendly, Professional, Modern, Minimalist, Bold.
   - In-place editable textareas with live character and word counters.
   - 1-click clipboard copy and `.txt` file export.

3. **Product Description Generator**
   - Structured e-commerce copy templates: Standard E-Commerce Listing, Artisan Storytelling, Short Social Ad Copy, and Marketplace Classified.
   - Generates headlines, narrative hooks, bulleted highlights, and calls to action.
   - 1-click copy for plain text, rich HTML snippet, and `.txt` export.

4. **Instant Receipt & Mini-Invoice Calculator**
   - Configurable currencies with **Pakistani Rupee (`PKR` / `Rs. `)** as default, plus USD (`$`), EUR (`€`), GBP (`£`), AED, SAR, and INR.
   - Automatic local date initialization.
   - Real-time subtotal, editable tax rate %, discount capping, and grand total calculations.
   - Clean printable view (`window.print()`) formatted for receipt paper and standard print-to-PDF without navigation or button clutter.
   - Plain text receipt slip export and `.txt` download.

5. **Mobile Testing & QA Checklist**
   - Live QR code pointing to the current applet URL for instant phone camera scanning.
   - Step-by-step instructions for Android (Chrome), iOS (Safari), and desktop DevTools emulation.
   - 5-point interactive checklist with persistent `localStorage` progress tracking.

6. **Transparent About & Privacy Disclosure**
   - Clear architectural explanation of 100% client-side execution.
   - Explains that zero personal data is ever collected, transmitted, or stored on external servers.

---

## 🔒 Privacy & Architecture

- **No Remote Backend Required:** All barcode generation, template assembly, math calculations, and file downloads execute inside the user's browser sandbox using HTML5 Canvas, SVG, and modern Web APIs.
- **Offline / Airplane Mode Capable:** Once loaded, FreeBiz operates with zero internet connection.
- **No Analytics / Telemetry:** No cookies, trackers, tracking pixels, or third-party ads.

---

## 📱 Mobile-First Design Specifications

- Tested on viewports from **320px** (narrow mobile) to **430px** (modern flagship smartphones) through tablets and desktops.
- Minimum **44–48px** touch hitboxes on all interactive buttons, swatches, and inputs.
- Clean single primary mobile navigation anchored to the bottom thumb zone with device safe-area (`env(safe-area-inset-bottom)`) clearance.
- No horizontal scrolling, no text clipping, and visible `:focus-visible` outlines for keyboard and screen-reader accessibility.

---

## 🚀 Development & Testing Commands

### Prerequisites
- Node.js 18+ or Bun

### Install Dependencies
```bash
npm install
```

### Run Local Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### Run Automated Test Suite
```bash
npm test
```
Executes 41 automated tests verifying QR generation, independent `jsQR` decoding across all error correction levels, Wi-Fi escaping, contrast ratios, invoice math, and DOM element ID integrity.

### Production Build
```bash
npm run build
```

---

## ⚠️ Known Limitations

1. **Clipboard Image Writing (`ClipboardItem`):** In certain restricted browser environments (e.g. non-HTTPS iframes or browsers without image clipboard permissions), writing binary PNG blobs to the system clipboard is blocked by browser security. In such cases, FreeBiz detects the restriction and copies the QR content text while displaying an explicit notice.
2. **Receipt Template Notice:** Receipts generated are intended for point-of-sale customer slips and internal business records; they do not constitute legally certified tax invoices.
