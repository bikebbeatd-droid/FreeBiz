/**
 * Full-Stack Express Server with Native MCP Streamable HTTP Transport at /mcp
 * Integrates Vite middleware in development and static file serving in production.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import {
  authenticateMcpRequest,
  createMcpServer,
  MCP_TOOLS,
  executeMcpTool,
  DEFAULT_MCP_API_KEY
} from './src/server/mcp-server.js';
import {
  parsePdfBuffer,
  addSampleDocument,
  listUserDocuments,
  getUserDocument,
  searchDocumentText,
  getPageContent,
  getChapterContent
} from './src/server/pdf-workspace.js';
import {
  listDrivePdfs,
  searchDriveFiles,
  importDrivePdfDocument
} from './src/server/drive-service.js';
import {
  askPdfQuestion,
  summarizePdf,
  generatePdfQuestions,
  generatePdfMcqs,
  createStudyNotes,
  exportPdfContent
} from './src/server/ai-service.js';
import { videoAiRouter } from './src/server/video-ai-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Seed initial sample textbook document for seamless out-of-the-box testing
addSampleDocument(
  'user_default',
  'doc_default_biology',
  'Cell_Biology_and_Genetics_Textbook.pdf',
  [
    {
      pageNumber: 1,
      text: 'Cell Biology and Genetics — Chapter 1: The Cellular Foundation.\nAll living organisms are composed of cells, the basic structural and functional units of life. The plasma membrane consists of a phospholipid bilayer with embedded transport proteins, regulating the internal cellular environment through selective permeability.'
    },
    {
      pageNumber: 2,
      text: 'Cellular respiration occurs primarily within mitochondria, producing ATP via glycolysis, the Krebs cycle, and oxidative phosphorylation. Chemiosmosis harnesses a proton gradient generated across the inner mitochondrial membrane to drive ATP synthase.'
    },
    {
      pageNumber: 3,
      text: 'Chapter 2: Genetic Replication and Protein Synthesis.\nDeoxyribonucleic acid (DNA) stores hereditary instructions in a double helix sequence of four nitrogenous bases: adenine, thymine, cytosine, and guanine. Transcription in the nucleus yields messenger RNA (mRNA), which is then translated by ribosomes in the cytoplasm into polypeptide chains.'
    },
    {
      pageNumber: 4,
      text: 'Mendelian genetics illustrates the law of segregation and the law of independent assortment. Alleles segregate during meiosis into gametes, yielding predictable phenotypic ratios such as the classic 3:1 dominant to recessive monohybrid cross ratio.'
    }
  ],
  'drive_file_biology_ch1'
);

// Security & CORS Configuration
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-mcp-api-key', 'mcp-session-id', 'last-event-id']
  })
);

// Body parsers with safe limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CineAI Studio Video AI Routes
app.use('/api/video-editor', videoAiRouter);

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mcpEndpoint: '/mcp',
    toolsCount: MCP_TOOLS.length
  });
});

// =========================================================================
// 1. Model Context Protocol (MCP) Streamable HTTP Transport at /mcp
// =========================================================================

app.all('/mcp', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);

  // Handle unauthorized requests
  if (!auth.authenticated) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Provide valid Authorization: Bearer <token> or x-mcp-api-key header'
      },
      id: null
    });
    return;
  }

  try {
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true
    });

    const mcpServer = createMcpServer(auth);
    await mcpServer.connect(transport);

    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error('Error handling /mcp request:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Internal MCP Error: ${err.message || 'Stream processing failed'}`
        },
        id: null
      });
    }
  }
});

// =========================================================================
// 2. REST API Endpoints for MCP Inspection & Frontend Testing
// =========================================================================

// MCP Server Status & Discovery
app.get('/api/mcp/status', (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  res.json({
    serverName: 'ai-pdf-workspace-mcp',
    version: '1.0.0',
    protocol: 'Streamable HTTP (2024-11-05 / standard)',
    endpoint: '/mcp',
    authenticated: auth.authenticated,
    user: auth.userId,
    toolCount: MCP_TOOLS.length,
    defaultApiKey: DEFAULT_MCP_API_KEY
  });
});

// List All 13 Registered MCP Tools
app.get('/api/mcp/tools', (_req: Request, res: Response) => {
  res.json({
    tools: MCP_TOOLS,
    total: MCP_TOOLS.length
  });
});

// Test/Execute MCP Tool via REST
app.post('/api/mcp/call', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const { tool, arguments: args } = req.body;

  if (!tool) {
    res.status(400).json({ error: 'Missing tool name' });
    return;
  }

  try {
    const result = await executeMcpTool(tool, args || {}, auth);
    res.json({ success: true, tool, result });
  } catch (err: any) {
    res.status(err.code ? 400 : 500).json({
      success: false,
      tool,
      error: err.message || 'Failed to execute tool'
    });
  }
});

// =========================================================================
// 3. REST API Endpoints for PDF Workspace
// =========================================================================

// List documents
app.get('/api/pdf/documents', (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const docs = listUserDocuments(auth.userId);
  res.json({ documents: docs, total: docs.length });
});

// Upload and ingest PDF document
app.post('/api/pdf/upload', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const { filename, base64Content } = req.body;

  if (!filename || !base64Content) {
    res.status(400).json({ error: 'filename and base64Content are required' });
    return;
  }

  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const doc = await parsePdfBuffer(buffer, filename, auth.userId);
    const { pages, fullText, ...meta } = doc;
    res.json({ success: true, document: meta });
  } catch (err: any) {
    res.status(422).json({ error: `PDF Processing Error: ${err.message}` });
  }
});

// Get document details
app.get('/api/pdf/:docId', (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const docId = String(req.params.docId);
  const doc = getUserDocument(auth.userId, docId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found or access denied' });
    return;
  }
  const { fullText, ...safeData } = doc;
  res.json(safeData);
});

// Search inside document with page citations
app.post('/api/pdf/:docId/search', (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const docId = String(req.params.docId);
  const { query } = req.body;
  try {
    const searchRes = searchDocumentText(auth.userId, docId, query || '');
    res.json(searchRes);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Ask grounded question with citations
app.post('/api/pdf/:docId/ask', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const docId = String(req.params.docId);
  const { question } = req.body;
  try {
    const answer = await askPdfQuestion(auth.userId, docId, question);
    res.json(answer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Generate summary with citations
app.post('/api/pdf/:docId/summarize', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const docId = String(req.params.docId);
  const { startPage, endPage, focusTopic } = req.body;
  try {
    const summary = await summarizePdf(auth.userId, docId, {
      startPage,
      endPage,
      focusTopic
    });
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Generate MCQs
app.post('/api/pdf/:docId/mcqs', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const docId = String(req.params.docId);
  const { count } = req.body;
  try {
    const mcqs = await generatePdfMcqs(auth.userId, docId, count);
    res.json(mcqs);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Generate Study Notes
app.post('/api/pdf/:docId/study-notes', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const docId = String(req.params.docId);
  try {
    const notes = await createStudyNotes(auth.userId, docId);
    res.json(notes);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 4. REST API Endpoints for Google Drive Integration
// =========================================================================

// List Google Drive files
app.get('/api/drive/files', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const files = await listDrivePdfs(auth.userId, auth.token);
  res.json(files);
});

// Import Google Drive file
app.post('/api/drive/import', async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(req.headers as Record<string, string | string[] | undefined>);
  const { fileId } = req.body;
  if (!fileId) {
    res.status(400).json({ error: 'fileId is required' });
    return;
  }
  try {
    const doc = await importDrivePdfDocument(auth.userId, fileId, auth.token);
    const { pages, fullText, ...meta } = doc;
    res.json({ success: true, document: meta });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// =========================================================================
// 5. Frontend Integration (Vite Middleware in Dev / Static in Prod)
// =========================================================================

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MCP Server] Running at http://0.0.0.0:${PORT}`);
    console.log(`[MCP Server] Streamable HTTP Transport active at http://0.0.0.0:${PORT}/mcp`);
    console.log(`[MCP Server] ${MCP_TOOLS.length} official tools registered and ready`);
  });

  // Graceful shutdown
  const handleShutdown = () => {
    console.log('\n[MCP Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[MCP Server] Server closed cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  return server;
}

startServer().catch(err => {
  console.error('[MCP Server] Failed to start server:', err);
  process.exit(1);
});
