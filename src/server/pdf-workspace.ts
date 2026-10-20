/**
 * PDF Workspace Core Module
 * Handles PDF document storage, page-level extraction, chapter parsing,
 * text searching with exact page citations, and user-isolated document state.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export interface DocumentMetadata {
  id: string;
  userId: string;
  filename: string;
  driveFileId?: string;
  fileSize: number;
  mimeType: string;
  totalPages: number;
  uploadedAt: string;
  isScanned: boolean;
  ocrApplied: boolean;
  chapters: ChapterInfo[];
}

export interface ChapterInfo {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
}

export interface StoredDocument extends DocumentMetadata {
  pages: { pageNumber: number; text: string }[];
  fullText: string;
}

export interface SearchMatch {
  pageNumber: number;
  snippet: string;
  matchIndex: number;
}

// In-memory isolated store per user
const documentStore: Map<string, StoredDocument> = new Map();

/**
 * Extract text per page and identify chapter headings
 */
export async function parsePdfBuffer(
  buffer: Buffer,
  filename: string,
  userId: string,
  driveFileId?: string
): Promise<StoredDocument> {
  const pages: { pageNumber: number; text: string }[] = [];
  let pageCounter = 0;

  // Custom pagerender to isolate individual page text and maintain page boundaries
  const renderOptions = {
    pagerender: function (pageData: any) {
      pageCounter++;
      const currentNumber = pageCounter;
      return pageData.getTextContent().then(function (textContent: any) {
        let lastY: number | null = null;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === null) {
            text += item.str + ' ';
          } else {
            text += '\n' + item.str + ' ';
          }
          lastY = item.transform[5];
        }
        const cleaned = text.trim();
        pages.push({
          pageNumber: currentNumber,
          text: cleaned
        });
        return cleaned;
      });
    }
  };

  let parsed: any;
  try {
    parsed = await (pdfParse as any)(buffer, renderOptions);
  } catch (err: any) {
    // If standard parsing fails, create a structured error
    throw new Error(`Failed to decode PDF: ${err.message || 'Corrupted or unsupported PDF stream'}`);
  }

  // Ensure pages are sorted by pageNumber
  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  // If pdf-parse fallback didn't populate per-page array, split full text evenly
  if (pages.length === 0 && parsed.text) {
    const rawPages = parsed.text.split(/\f|\n(?=Page \d+)/i);
    for (let i = 0; i < rawPages.length; i++) {
      pages.push({
        pageNumber: i + 1,
        text: rawPages[i].trim()
      });
    }
  }

  const totalPages = pages.length > 0 ? pages.length : (parsed.numpages || 1);
  const fullText = pages.map(p => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');

  // Detect chapters heuristically from text
  const chapters: ChapterInfo[] = [];
  const chapterRegex = /(?:chapter|unit|section|part)\s+([0-9ivxlcdm]+|\w+)[:.\-\s]+([^\n\r]{3,80})/gi;

  for (const p of pages) {
    let match: RegExpExecArray | null;
    while ((match = chapterRegex.exec(p.text)) !== null) {
      const title = `${match[0].trim()}`;
      chapters.push({
        id: `ch_${chapters.length + 1}`,
        title,
        startPage: p.pageNumber,
        endPage: p.pageNumber
      });
    }
  }

  // Set endPage for detected chapters
  for (let i = 0; i < chapters.length; i++) {
    if (i < chapters.length - 1) {
      chapters[i].endPage = Math.max(chapters[i].startPage, chapters[i + 1].startPage - 1);
    } else {
      chapters[i].endPage = totalPages;
    }
  }

  // Check if document might be scanned (almost no text extracted)
  const totalCharacters = pages.reduce((acc, p) => acc + p.text.length, 0);
  const isScanned = totalCharacters < 50 && totalPages > 0;

  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const storedDoc: StoredDocument = {
    id: docId,
    userId,
    filename,
    driveFileId,
    fileSize: buffer.length,
    mimeType: 'application/pdf',
    totalPages,
    uploadedAt: new Date().toISOString(),
    isScanned,
    ocrApplied: false,
    chapters,
    pages,
    fullText
  };

  documentStore.set(docId, storedDoc);
  return storedDoc;
}

/**
 * Add a synthetic / sample document for testing or onboarding
 */
export function addSampleDocument(
  userId: string,
  docId: string,
  filename: string,
  pagesContent: { pageNumber: number; text: string }[],
  driveFileId?: string
): StoredDocument {
  const totalPages = pagesContent.length;
  const fullText = pagesContent.map(p => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');

  const chapters: ChapterInfo[] = [
    { id: 'ch_1', title: 'Chapter 1: Overview & Foundation', startPage: 1, endPage: Math.min(2, totalPages) }
  ];
  if (totalPages >= 3) {
    chapters.push({ id: 'ch_2', title: 'Chapter 2: Advanced Principles', startPage: 3, endPage: totalPages });
  }

  const doc: StoredDocument = {
    id: docId,
    userId,
    filename,
    driveFileId,
    fileSize: 45000,
    mimeType: 'application/pdf',
    totalPages,
    uploadedAt: new Date().toISOString(),
    isScanned: false,
    ocrApplied: false,
    chapters,
    pages: pagesContent,
    fullText
  };

  documentStore.set(docId, doc);
  return doc;
}

/**
 * List all documents owned by user
 */
export function listUserDocuments(userId: string): DocumentMetadata[] {
  const result: DocumentMetadata[] = [];
  for (const doc of documentStore.values()) {
    if (doc.userId === userId) {
      const { pages, fullText, ...meta } = doc;
      result.push(meta);
    }
  }
  return result;
}

/**
 * Get document with strict ownership verification
 */
export function getUserDocument(userId: string, documentId: string): StoredDocument | null {
  const doc = documentStore.get(documentId);
  if (!doc) return null;
  // Strict authorization: do not disclose existence if not owned
  if (doc.userId !== userId) return null;
  return doc;
}

/**
 * Search document text with accurate page citation snippets
 */
export function searchDocumentText(
  userId: string,
  documentId: string,
  query: string
): { matches: SearchMatch[]; totalMatches: number; documentId: string; filename: string } {
  const doc = getUserDocument(userId, documentId);
  if (!doc) {
    throw new Error('Document not found or access denied');
  }

  if (!query || query.trim().length === 0) {
    return { matches: [], totalMatches: 0, documentId, filename: doc.filename };
  }

  const cleanQuery = query.trim().toLowerCase();
  const matches: SearchMatch[] = [];

  for (const p of doc.pages) {
    const lower = p.text.toLowerCase();
    let pos = 0;
    while ((pos = lower.indexOf(cleanQuery, pos)) !== -1) {
      const snippetStart = Math.max(0, pos - 60);
      const snippetEnd = Math.min(p.text.length, pos + cleanQuery.length + 80);
      let snippet = p.text.substring(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();
      if (snippetStart > 0) snippet = '...' + snippet;
      if (snippetEnd < p.text.length) snippet = snippet + '...';

      matches.push({
        pageNumber: p.pageNumber,
        snippet,
        matchIndex: pos
      });

      pos += cleanQuery.length;
      if (matches.length >= 25) break; // Limit top 25 matches
    }
    if (matches.length >= 25) break;
  }

  return {
    matches,
    totalMatches: matches.length,
    documentId,
    filename: doc.filename
  };
}

/**
 * Retrieve text for a specific page with validation
 */
export function getPageContent(
  userId: string,
  documentId: string,
  pageNumber: number
): { pageNumber: number; text: string; totalPages: number; filename: string } {
  const doc = getUserDocument(userId, documentId);
  if (!doc) {
    throw new Error('Document not found or access denied');
  }

  if (pageNumber < 1 || pageNumber > doc.totalPages) {
    throw new Error(`Requested page ${pageNumber} is out of bounds (Document has ${doc.totalPages} pages)`);
  }

  const found = doc.pages.find(p => p.pageNumber === pageNumber);
  return {
    pageNumber,
    text: found ? found.text : '',
    totalPages: doc.totalPages,
    filename: doc.filename
  };
}

/**
 * Retrieve text for a specific chapter
 */
export function getChapterContent(
  userId: string,
  documentId: string,
  chapterIdentifier: string | number
): { chapter: ChapterInfo; content: string; filename: string } {
  const doc = getUserDocument(userId, documentId);
  if (!doc) {
    throw new Error('Document not found or access denied');
  }

  if (doc.chapters.length === 0) {
    throw new Error('No chapter boundaries were detected in this document. Use page navigation instead.');
  }

  let selected: ChapterInfo | undefined;
  if (typeof chapterIdentifier === 'number') {
    selected = doc.chapters[chapterIdentifier - 1];
  } else {
    const q = chapterIdentifier.toLowerCase();
    selected = doc.chapters.find(c => c.id.toLowerCase() === q || c.title.toLowerCase().includes(q));
  }

  if (!selected) {
    throw new Error(`Chapter '${chapterIdentifier}' not found in document`);
  }

  const chapterPages = doc.pages.filter(
    p => p.pageNumber >= selected!.startPage && p.pageNumber <= selected!.endPage
  );

  const content = chapterPages
    .map(p => `[Page ${p.pageNumber}]\n${p.text}`)
    .join('\n\n');

  return {
    chapter: selected,
    content,
    filename: doc.filename
  };
}
