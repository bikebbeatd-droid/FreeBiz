# AI PDF Workspace + Model Context Protocol (MCP) Server ⚡

> **Production-grade AI PDF Workspace, Google Drive Integration & Official MCP Server**  
> Powered by `@modelcontextprotocol/sdk` with Streamable HTTP transport at `/mcp`, Google Gemini (`@google/genai`), and mobile-first business utilities.

---

## 🏛️ Architecture & Highlights

- **Native MCP Streamable HTTP Transport (`/mcp`):** Built with the official `@modelcontextprotocol/sdk` (`StreamableHTTPServerTransport`), providing protocol negotiation, tool discovery, and tool invocation over HTTP/SSE.
- **13 Registered Official MCP Tools:**
  1. `drive_list_pdfs` — List authorized PDF files from Google Drive.
  2. `drive_search_files` — Search authorized Drive files by name.
  3. `pdf_import_document` — Securely import a Drive PDF by file ID.
  4. `pdf_get_metadata` — Verified metadata, total pages, chapters, and extraction status.
  5. `pdf_search` — Search extracted text and return snippets with exact page citations.
  6. `pdf_get_page` — Retrieve verified text from a specific page.
  7. `pdf_get_chapter` — Retrieve chapter content within identified boundaries.
  8. `pdf_ask_question` — Answer questions strictly grounded in document text with page citations.
  9. `pdf_summarize` — Executive summaries and key points with citations.
  10. `pdf_generate_questions` — Generate short and long answer questions.
  11. `pdf_generate_mcqs` — Generate 4-option MCQs with answer keys and citations.
  12. `pdf_create_study_notes` — Structured revision notes with terminology and source pages.
  13. `pdf_export_content` — Export content in Markdown, JSON, TXT, or CSV formats.
- **Strict Source Grounding:** All AI answers cite exact `[Page X]` locations and never fabricate citations or document content. If information cannot be found, it explicitly states so.
- **User Document Isolation & Security:** Documents and Drive files are isolated per user; cross-user access attempts are rejected without disclosing file existence.
- **Full-Stack Node.js Architecture:** Express server (`server.ts`) hosting the `/mcp` transport, REST endpoints (`/api/pdf/*`, `/api/drive/*`, `/api/mcp/*`), and Vite middleware in development.

---

## 🚀 Getting Started & Local Development

### 1. Prerequisites
- Node.js 22+
- npm or bun

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key environment variables:
- `GEMINI_API_KEY`: API key for Gemini models (injected automatically in AI Studio).
- `MCP_API_KEY`: Key used by external MCP clients to authenticate with `/mcp` (Default: `mcp_workspace_dev_key_2026`).
- `PORT`: HTTP port (Default: `3000`).

### 3. Start Development Server
```bash
npm run dev
```
Starts the full-stack server on `http://0.0.0.0:3000` with the Streamable HTTP MCP transport live at `http://0.0.0.0:3000/mcp`.

### 4. Run Test Suite
```bash
npm test
```
Runs both test suites:
- **FreeBiz Utility Suite:** 256/256 passing unit & security tests.
- **AI PDF Workspace & MCP Server Suite:** 36/36 passing protocol, tool, authorization, and grounding tests.
- **Total:** 292 passing automated tests.

---

## 🔌 Connecting External MCP Clients

### Claude Desktop Configuration
Add the following to your `claude_desktop_config.json` (Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ai-pdf-workspace": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-mcp-api-key": "mcp_workspace_dev_key_2026"
      }
    }
  }
}
```

### Cursor / Windsurf / MCP Inspector
Connect using Streamable HTTP transport:
- **Transport Type:** Streamable HTTP (or SSE)
- **URL:** `http://localhost:3000/mcp`
- **Header:** `Authorization: Bearer mcp_workspace_dev_key_2026` or `x-mcp-api-key: mcp_workspace_dev_key_2026`

---

## 📡 MCP Tools Reference

| Tool Name | Parameters | Description |
|-----------|------------|-------------|
| `drive_list_pdfs` | `{ maxResults?: number }` | List authorized PDFs in Google Drive |
| `drive_search_files` | `{ query: string }` | Filter Drive PDFs by keyword |
| `pdf_import_document` | `{ fileId: string }` | Ingest Drive PDF into workspace |
| `pdf_get_metadata` | `{ documentId: string }` | Return verified metadata & chapters |
| `pdf_search` | `{ documentId: string, query: string }` | Text search with page citations |
| `pdf_get_page` | `{ documentId: string, pageNumber: number }` | Fetch single page text |
| `pdf_get_chapter` | `{ documentId: string, chapter: string }` | Fetch chapter text content |
| `pdf_ask_question` | `{ documentId: string, question: string }` | Grounded Q&A with citations |
| `pdf_summarize` | `{ documentId: string, startPage?: number, endPage?: number }` | Section or full summary |
| `pdf_generate_questions` | `{ documentId: string, count?: number }` | Short & long answer questions |
| `pdf_generate_mcqs` | `{ documentId: string, count?: number }` | 4-option MCQs with answer keys |
| `pdf_create_study_notes` | `{ documentId: string }` | Comprehensive revision guide |
| `pdf_export_content` | `{ documentId: string, format: string, content: any }` | Export to Markdown/JSON/TXT/CSV |

---

## 🛠️ Also Included: FreeBiz Client-Side Suite
1. **Live QR & Barcode Scanner:** Camera scanner with rear-camera preference, throttled frames, and direct image photo decoding.
2. **QR Code Generator:** URLs, Wi-Fi, vCard, WhatsApp, phone, text with contrast auditing and direct PNG/SVG saving.
3. **Business Bio & Profile Generator:** Instagram, TikTok, LinkedIn, and Google Business profiles.
4. **Product Description Generator:** E-commerce copy with clean escaped HTML.
5. **Instant Receipt & Mini-Invoice Calculator:** Multi-currency math with tax, discount capping, and printable slips.
