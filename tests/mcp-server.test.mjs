/**
 * Comprehensive Automated Test Suite for AI PDF Workspace & Official MCP Server
 * Tests protocol initialization, tool discovery, all 13 MCP tools,
 * document parsing, citations, authorization, and error handling.
 */

import assert from 'node:assert/strict';
import {
  MCP_TOOLS,
  executeMcpTool,
  authenticateMcpRequest,
  DEFAULT_MCP_API_KEY
} from '../src/server/mcp-server.js';
import {
  addSampleDocument,
  listUserDocuments,
  getUserDocument,
  searchDocumentText,
  getPageContent,
  getChapterContent
} from '../src/server/pdf-workspace.js';
import {
  listDrivePdfs,
  searchDriveFiles,
  importDrivePdfDocument
} from '../src/server/drive-service.js';
import {
  askPdfQuestion,
  summarizePdf,
  generatePdfQuestions,
  generatePdfMcqs,
  createStudyNotes,
  exportPdfContent
} from '../src/server/ai-service.js';
import { ADSTERRA_CONFIG } from '../src/config/adsterra.js';
import { AdsterraBanner, AdsterraNativeBanner } from '../src/components/index.js';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n=======================================================');
console.log('AI PDF WORKSPACE & MCP SERVER — PHASE 3 TEST SUITE');
console.log('=======================================================\n');

// Initialize sample document for tests
const testUser = 'user_test_suite_123';
const otherUser = 'user_stranger_456';
const testDocId = 'doc_test_biology';

addSampleDocument(
  testUser,
  testDocId,
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

const validAuth = {
  userId: testUser,
  authenticated: true,
  token: 'mcp_test_valid_token'
};

const unauthorizedAuth = {
  userId: 'unauthenticated',
  authenticated: false
};

const otherUserAuth = {
  userId: otherUser,
  authenticated: true,
  token: 'user_other'
};

// -------------------------------------------------------------------------
console.log('TEST SUITE 1: MCP Server Tool Registry & Schemas');
// -------------------------------------------------------------------------

it('Registers exactly 13 official MCP tools', () => {
  assert.equal(MCP_TOOLS.length, 13);
});

const requiredToolNames = [
  'drive_list_pdfs',
  'drive_search_files',
  'pdf_import_document',
  'pdf_get_metadata',
  'pdf_search',
  'pdf_get_page',
  'pdf_get_chapter',
  'pdf_ask_question',
  'pdf_summarize',
  'pdf_generate_questions',
  'pdf_generate_mcqs',
  'pdf_create_study_notes',
  'pdf_export_content'
];

for (const toolName of requiredToolNames) {
  it(`Tool '${toolName}' exists with description and schema`, () => {
    const tool = MCP_TOOLS.find(t => t.name === toolName);
    assert.ok(tool, `Tool ${toolName} not found`);
    assert.ok(tool.description.length > 10, 'Tool description too short');
    assert.equal(tool.inputSchema.type, 'object');
  });
}

// -------------------------------------------------------------------------
console.log('\nTEST SUITE 2: MCP Authentication & Authorization');
// -------------------------------------------------------------------------

it('Validates Bearer token authentication header', () => {
  const auth = authenticateMcpRequest({ authorization: `Bearer ${DEFAULT_MCP_API_KEY}` });
  assert.equal(auth.authenticated, true);
  assert.equal(auth.userId, 'user_default');
});

it('Validates x-mcp-api-key header', () => {
  const auth = authenticateMcpRequest({ 'x-mcp-api-key': DEFAULT_MCP_API_KEY });
  assert.equal(auth.authenticated, true);
});

it('Rejects unauthorized requests without valid token', () => {
  const auth = authenticateMcpRequest({ authorization: 'Bearer invalid_wrong_token' });
  assert.equal(auth.authenticated, false);
});

await itAsync('Rejects MCP tool execution when unauthenticated', async () => {
  await assert.rejects(
    async () => {
      await executeMcpTool('pdf_get_metadata', { documentId: testDocId }, unauthorizedAuth);
    },
    /Authentication required/
  );
});

// -------------------------------------------------------------------------
console.log('\nTEST SUITE 3: Google Drive Integration Tools via MCP');
// -------------------------------------------------------------------------

await itAsync('Tool: drive_list_pdfs returns authorized Drive files', async () => {
  const res = await executeMcpTool('drive_list_pdfs', {}, validAuth);
  assert.ok(res.content && res.content[0]);
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.files.length >= 2, 'Expected at least 2 drive files');
  assert.ok(parsed.files.some(f => f.mimeType === 'application/pdf'));
});

await itAsync('Tool: drive_search_files filters by filename keyword', async () => {
  const res = await executeMcpTool('drive_search_files', { query: 'biology' }, validAuth);
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.files.length >= 1);
  assert.ok(parsed.files[0].name.toLowerCase().includes('biology'));
});

await itAsync('Tool: pdf_import_document imports authorized Drive file', async () => {
  const res = await executeMcpTool(
    'pdf_import_document',
    { fileId: 'drive_file_financial_audit' },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.status, 'imported');
  assert.ok(parsed.document.id);
  assert.equal(parsed.document.driveFileId, 'drive_file_financial_audit');
});

// -------------------------------------------------------------------------
console.log('\nTEST SUITE 4: PDF Document Navigation & Search Tools via MCP');
// -------------------------------------------------------------------------

await itAsync('Tool: pdf_get_metadata returns verified document details', async () => {
  const res = await executeMcpTool('pdf_get_metadata', { documentId: testDocId }, validAuth);
  const meta = JSON.parse(res.content[0].text);
  assert.equal(meta.id, testDocId);
  assert.equal(meta.totalPages, 4);
  assert.equal(meta.chapters.length, 2);
  assert.equal(meta.isScanned, false);
});

await itAsync('Tool: pdf_search finds text and returns exact page citations', async () => {
  const res = await executeMcpTool(
    'pdf_search',
    { documentId: testDocId, query: 'mitochondria' },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.matches.length >= 1, 'Expected search match for mitochondria');
  assert.equal(parsed.matches[0].pageNumber, 2, 'Mitochondria should be cited on Page 2');
  assert.ok(parsed.matches[0].snippet.includes('mitochondria'));
});

await itAsync('Tool: pdf_get_page retrieves specific page text', async () => {
  const res = await executeMcpTool(
    'pdf_get_page',
    { documentId: testDocId, pageNumber: 3 },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.pageNumber, 3);
  assert.ok(parsed.text.includes('Deoxyribonucleic acid'));
});

await itAsync('Tool: pdf_get_page rejects out-of-bounds page numbers', async () => {
  const res = await executeMcpTool(
    'pdf_get_page',
    { documentId: testDocId, pageNumber: 99 },
    validAuth
  );
  assert.equal(res.isError, true);
  assert.ok(res.content[0].text.includes('out of bounds'));
});

await itAsync('Tool: pdf_get_chapter retrieves chapter boundaries and content', async () => {
  const res = await executeMcpTool(
    'pdf_get_chapter',
    { documentId: testDocId, chapter: 'Chapter 2' },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.chapter.title.includes('Chapter 2'));
  assert.equal(parsed.chapter.startPage, 3);
  assert.ok(parsed.content.includes('[Page 3]'));
});

// -------------------------------------------------------------------------
console.log('\nTEST SUITE 5: AI Grounding, Q&A, and Study Material Tools via MCP');
// -------------------------------------------------------------------------

await itAsync('Tool: pdf_ask_question answers with source page citations', async () => {
  const res = await executeMcpTool(
    'pdf_ask_question',
    { documentId: testDocId, question: 'Where does cellular respiration occur and what does it produce?' },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.answer.length > 20);
  assert.equal(parsed.grounded, true);
  assert.ok(parsed.citations.length >= 1);
  assert.equal(parsed.citations[0].pageNumber, 2);
});

await itAsync('Tool: pdf_ask_question reports when info is not in document', async () => {
  const res = await executeMcpTool(
    'pdf_ask_question',
    { documentId: testDocId, question: 'What is the quantum spin of a Higgs Boson particle?' },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.answer.includes('not found in the available document text'));
  assert.equal(parsed.grounded, false);
});

await itAsync('Tool: pdf_summarize produces executive summary and page citations', async () => {
  const res = await executeMcpTool(
    'pdf_summarize',
    { documentId: testDocId, startPage: 1, endPage: 2 },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.summary.length > 30);
  assert.ok(parsed.keyPoints.length >= 2);
  assert.ok(parsed.citations.length >= 1);
});

await itAsync('Tool: pdf_generate_questions creates grounded questions', async () => {
  const res = await executeMcpTool(
    'pdf_generate_questions',
    { documentId: testDocId, count: 4 },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.questions.length, 4);
  assert.ok(parsed.questions[0].sourcePage >= 1);
  assert.ok(parsed.questions[0].citation.length > 5);
});

await itAsync('Tool: pdf_generate_mcqs generates 4-option MCQs with answer keys', async () => {
  const res = await executeMcpTool(
    'pdf_generate_mcqs',
    { documentId: testDocId, count: 3 },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.mcqs.length, 3);
  const first = parsed.mcqs[0];
  assert.equal(first.options.length, 4);
  assert.equal(typeof first.correctOptionIndex, 'number');
  assert.ok(first.explanation.length > 10);
  assert.ok(first.sourcePage >= 1);
});

await itAsync('Tool: pdf_create_study_notes creates revision notes with sections', async () => {
  const res = await executeMcpTool(
    'pdf_create_study_notes',
    { documentId: testDocId },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.sections.length >= 2);
  assert.ok(parsed.keyTerms.length >= 1);
  assert.equal(parsed.documentId, testDocId);
});

await itAsync('Tool: pdf_export_content exports in markdown format', async () => {
  const res = await executeMcpTool(
    'pdf_export_content',
    {
      documentId: testDocId,
      format: 'markdown',
      content: { note: 'Sample revision content' }
    },
    validAuth
  );
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.format, 'markdown');
  assert.equal(parsed.mimeType, 'text/markdown');
  assert.ok(parsed.content.includes('# Exported Study Material'));
});

// -------------------------------------------------------------------------
console.log('\nTEST SUITE 6: Document Ownership & Cross-User Security');
// -------------------------------------------------------------------------

it('Cross-user document isolation: Other user cannot access testUser document', () => {
  const doc = getUserDocument(otherUser, testDocId);
  assert.equal(doc, null, 'Document must not be visible to unauthorized user');
});

await itAsync('Tool rejects access to another user document without leaking existence', async () => {
  await assert.rejects(
    async () => {
      await executeMcpTool(
        'pdf_get_metadata',
        { documentId: testDocId },
        otherUserAuth
      );
    },
    /Document not found or access denied/
  );
});

it('Rejects missing parameters with clear McpError', async () => {
  await assert.rejects(
    async () => {
      await executeMcpTool('pdf_search', { documentId: testDocId }, validAuth);
    },
    /Parameter.*required/i
  );
});

// -------------------------------------------------------------------------
console.log('\nTEST SUITE 7: Adsterra Banner & Native Banner Advertisements');
// -------------------------------------------------------------------------

it('Configures the exact official Adsterra banner script URL', () => {
  assert.equal(
    ADSTERRA_CONFIG.banner.scriptUrl,
    'https://pl31915705.profitableratecpmnetwork.com/d7/8d/64/d78d648ad19b642e3c73593076404d42.js'
  );
  assert.equal(ADSTERRA_CONFIG.banner.enabled, true);
});

it('Configures native banner placeholder with container ID', () => {
  assert.equal(typeof ADSTERRA_CONFIG.nativeBanner.containerId, 'string');
  assert.ok(ADSTERRA_CONFIG.nativeBanner.containerId.length > 0);
  assert.equal(typeof ADSTERRA_CONFIG.nativeBanner.scriptUrl, 'string');
});

it('Exports reusable React components AdsterraBanner and AdsterraNativeBanner', () => {
  assert.equal(typeof AdsterraBanner, 'function');
  assert.equal(typeof AdsterraNativeBanner, 'function');
});

it('Verifies HTML contains responsive ad containers below QR generator and result', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.ok(html.includes('id="adsterraBannerGeneratorContainer"'), 'Banner container below QR generator exists');
  assert.ok(html.includes('id="adsterraNativeBannerResultContainer"'), 'Native banner container below QR result exists');
  assert.ok(html.includes('id="adsterra-banner-slot"'), 'Banner ad slot exists');
  assert.ok(html.includes('id="adsterra-native-slot"'), 'Native ad slot exists');
  assert.ok(html.includes('aria-label="Advertisement"'), 'Contains accessible Advertisement region label');
});

it('Verifies advertisement labels and container isolation in CSS', () => {
  const css = fs.readFileSync(path.resolve('style.css'), 'utf8');
  assert.ok(css.includes('.adsterra-ad-container'), 'Contains .adsterra-ad-container CSS');
  assert.ok(css.includes('.adsterra-ad-label'), 'Contains .adsterra-ad-label CSS');
  assert.ok(css.includes('@media print'), 'Contains print media query');
});

console.log('\n=======================================================');
console.log(`TOTAL MCP TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=======================================================\n');

if (failed > 0) {
  process.exit(1);
}
