import * as fs from 'fs';
import * as path from 'path';
import { cloudQdrantStore, ChunkMetadata } from './cloudQdrantStore';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Set up PDF.js worker
GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { db } from '../db';
import { manualChunks } from '../../shared/schema';

export interface ProcessingResult {
  success: boolean;
  chunksCreated: number;
  error?: string;
  textLength?: number;
  processingTime?: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pages: number;
}

export class DocumentProcessor {
  private uploadDir = path.join(process.cwd(), 'uploads', 'manuals');

  constructor() {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Process a PDF file and extract text content
   */
  async processPDFFile(filePath: string, manualId: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Read file
      const dataBuffer = fs.readFileSync(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();

      let text = '';
      let numPages = 1;

      let pdfData: any = null;

      if (fileExtension === '.pdf') {
        // Parse PDF using pdfjs-dist
        try {
          console.log('🔄 Using pdfjs-dist to parse PDF...');
          const loadingTask = getDocument({ data: new Uint8Array(dataBuffer) });
          const pdf = await loadingTask.promise;
          
          numPages = pdf.numPages;
          console.log(`✅ PDF loaded successfully: ${numPages} pages`);
          
          // Extract text from all pages
          const pageTexts: string[] = [];
          
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              
              // Combine text items
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              
              if (pageText.trim().length > 0) {
                pageTexts.push(pageText);
              }
            } catch (pageError) {
              console.warn(`⚠️  Warning: Could not extract text from page ${pageNum}:`, pageError.message);
              // Add empty page to maintain page count
              pageTexts.push('');
            }
          }
          
          // Combine all page texts
          text = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
          console.log(`✅ PDF text extraction complete: ${text.length} characters extracted`);
          
          // Create mock pdfData to maintain compatibility
          pdfData = {
            text,
            numpages: numPages,
            info: {
              Title: path.basename(filePath, path.extname(filePath)),
              Author: 'Unknown',
              Subject: 'Service Manual',
              Creator: 'ContainerGenie RAG System',
              Producer: 'pdfjs-dist',
              CreationDate: new Date().toISOString()
            }
          };
          
        } catch (pdfError) {
          console.error('❌ PDF parsing failed, treating as text file:', pdfError);
          text = dataBuffer.toString('utf8');
          pdfData = null;
          numPages = 1; // Assume single page for text files
        }
      } else {
        // Treat as text file
        text = dataBuffer.toString('utf8');
        pdfData = null;
        numPages = 1;
      }

      // Clean text to remove problematic characters
      text = text.replace(/\0/g, ''); // Remove null bytes
      text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters

      console.log(`Processing file: ${numPages} pages, ${text.length} characters`);

      // Extract metadata
      const docMetadata: DocumentMetadata = {
        title: pdfData?.info?.Title || path.basename(filePath, path.extname(filePath)),
        author: pdfData?.info?.Author || 'Unknown',
        subject: pdfData?.info?.Subject || 'Service Manual',
        creator: pdfData?.info?.Creator || 'ContainerGenie RAG System',
        producer: pdfData?.info?.Producer || 'ContainerGenie RAG System',
        creationDate: pdfData?.info?.CreationDate || new Date().toISOString(),
        modificationDate: pdfData?.info?.ModDate,
        pages: numPages,
        fileSize: dataBuffer.length,
        contentType: fileExtension === '.pdf' ? 'application/pdf' : 'text/plain'
      };

      // Extract text by pages
      const pages = this.extractPages(text, numPages);

      // Process each page
      const allChunks: Array<{ text: string; metadata: ChunkMetadata; id: string }> = [];

      for (let i = 0; i < pages.length; i++) {
        const pageText = pages[i];
        if (pageText.trim().length === 0) continue;

        // Extract metadata from page content
        const pageMetadata = this.extractPageMetadata(pageText, docMetadata);

        // Create base metadata for this page
        const baseMetadata: ChunkMetadata = {
          manualId,
          pageNum: i + 1,
          brand: pageMetadata.brand,
          model: pageMetadata.model,
          alarmCodes: pageMetadata.alarmCodes,
          partNumbers: pageMetadata.partNumbers,
        };

        // Process text into chunks
        const chunks = await cloudQdrantStore.processText(pageText, baseMetadata);
        allChunks.push(...chunks);
      }

      // Store chunks in Qdrant cloud ONLY (NOT PostgreSQL)
      if (allChunks.length > 0) {
        await cloudQdrantStore.addChunks(allChunks);
        // NOTE: Chunks are stored ONLY in Qdrant cloud, not PostgreSQL
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        chunksCreated: allChunks.length,
        textLength: text.length,
        processingTime,
      };

    } catch (error) {
      console.error('Error processing PDF file:', error);
      return {
        success: false,
        chunksCreated: 0,
        error: error.message,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Process plain text content
   */
  async processTextContent(text: string, manualId: string, metadata: Partial<ChunkMetadata> = {}): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Create base metadata
      const baseMetadata: ChunkMetadata = {
        manualId,
        ...metadata,
      };

      // Process text into chunks
      const chunks = await cloudQdrantStore.processText(text, baseMetadata);

      // Store chunks in Qdrant cloud ONLY (NOT PostgreSQL)
      if (chunks.length > 0) {
        await cloudQdrantStore.addChunks(chunks);
        // NOTE: Chunks are stored ONLY in Qdrant cloud, not PostgreSQL
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        chunksCreated: chunks.length,
        textLength: text.length,
        processingTime,
      };

    } catch (error) {
      console.error('Error processing text content:', error);
      return {
        success: false,
        chunksCreated: 0,
        error: error.message,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract pages from PDF text (pdfjs-dist gives us all text with page breaks)
   */
  private extractPages(fullText: string, numPages: number): string[] {
    // Split by the page break marker we added during extraction
    const pageBreakMarker = '\n\n--- PAGE BREAK ---\n\n';
    
    if (fullText.includes(pageBreakMarker)) {
      // Use the page breaks we added during extraction
      const pages = fullText.split(pageBreakMarker);
      return pages.map(page => page.trim()).filter(page => page.length > 0);
    } else {
      // Fallback to simple character-based splitting
      const pages: string[] = [];
      const avgCharsPerPage = Math.ceil(fullText.length / numPages);

      let currentPos = 0;
      for (let i = 0; i < numPages; i++) {
        const pageStart = currentPos;
        const pageEnd = i === numPages - 1 ? fullText.length : Math.min(
          fullText.length,
          pageStart + avgCharsPerPage + 1000 // Add some buffer
        );

        // Try to find a good page break (look for page headers/footers)
        let actualEnd = pageEnd;
        const pageBreakIndicators = ['Page ', 'PAGE ', '\f', '\n\n\n'];

        for (const indicator of pageBreakIndicators) {
          const indicatorIndex = fullText.lastIndexOf(indicator, pageEnd);
          if (indicatorIndex > pageStart && indicatorIndex < pageEnd + 2000) {
            actualEnd = indicatorIndex;
            break;
          }
        }

        const pageText = fullText.substring(pageStart, actualEnd).trim();
        if (pageText.length > 0) {
          pages.push(pageText);
        }

        currentPos = actualEnd;
      }

      return pages;
    }
  }

  /**
   * Extract metadata from page content using regex patterns
   */
  private extractPageMetadata(text: string, docMetadata: DocumentMetadata): {
    brand?: string;
    model?: string;
    alarmCodes?: string[];
    partNumbers?: string[];
  } {
    const metadata: any = {};

    // Extract brand information
    const brandPatterns = [
      /Thermo King/i,
      /Carrier Transicold/i,
      /Carrier/i,
      /Daikin/i,
      /Starcool/i,
    ];

    for (const pattern of brandPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.brand = match[0];
        break;
      }
    }

    // Extract model information
    const modelPatterns = [
      /SL-(\d+)/i,
      /SL(\d+)/i,
      /MD-(\d+)/i,
      /MD(\d+)/i,
      /Spectrum/i,
      /Vector/i,
      /Transicold/i,
    ];

    for (const pattern of modelPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.model = match[0];
        break;
      }
    }

    // Extract alarm codes
    const alarmPatterns = [
      /Alarm (\d+)/gi,
      /Code (\d+)/gi,
      /Error (\d+)/gi,
      /Fault (\d+)/gi,
    ];

    const alarmCodes: string[] = [];
    for (const pattern of alarmPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const code = match.replace(/\D/g, '');
          if (code && !alarmCodes.includes(code)) {
            alarmCodes.push(code);
          }
        });
      }
    }
    metadata.alarmCodes = alarmCodes;

    // Extract part numbers (basic pattern)
    const partPatterns = [
      /\b\d{2}-\d{4}-\d{3}\b/g, // XX-XXXX-XXX format
      /\b[A-Z]{2,}\d{3,}\b/g,  // Letters followed by numbers
      /\b\d{6,}\b/g,           // Long numbers
    ];

    const partNumbers: string[] = [];
    for (const pattern of partPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!partNumbers.includes(match)) {
            partNumbers.push(match);
          }
        });
      }
    }
    metadata.partNumbers = partNumbers.slice(0, 10); // Limit to 10 parts per page

    return metadata;
  }

  /**
   * Store chunks in relational database as backup
   */
  private async storeChunksInDatabase(chunks: Array<{ text: string; metadata: ChunkMetadata; id: string }>): Promise<void> {
    try {
      const dbChunks = chunks.map(chunk => ({
        id: chunk.id,
        manualId: chunk.metadata.manualId,
        chunkText: chunk.text,
        chunkEmbeddingId: chunk.id, // Use chunk ID as embedding ID
        pageNum: chunk.metadata.pageNum,
        startOffset: chunk.metadata.startOffset,
        endOffset: chunk.metadata.endOffset,
        metadata: {
          heading: chunk.metadata.heading,
          section: chunk.metadata.section,
          alarmCodes: chunk.metadata.alarmCodes,
          partNumbers: chunk.metadata.partNumbers,
          model: chunk.metadata.model,
          brand: chunk.metadata.brand,
        },
        createdAt: new Date(),
      }));

      // DISABLED: Do NOT store chunks in PostgreSQL - all data goes to Qdrant cloud
      // This prevents Neon database storage issues
      // Chunks are stored in Qdrant via vectorStore.addChunks() only
      
      console.log(`Skipped PostgreSQL storage - ${chunks.length} chunks stored in Qdrant only`);
    } catch (error) {
      console.error('Error storing chunks in database:', error);
      // Don't throw - vector store is the primary storage
    }
  }

  /**
   * Save uploaded file to disk
   */
  async saveUploadedFile(file: Express.Multer.File, manualId: string): Promise<string> {
    const fileName = `${manualId}_${Date.now()}_${file.originalname}`;
    const filePath = path.join(this.uploadDir, fileName);

    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);

    return filePath;
  }

  /**
   * Clean up temporary files
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    totalFiles: number;
    totalChunks: number;
    vectorStoreStats: any;
  }> {
    try {
      const vectorStats = await cloudQdrantStore.getStats();

      // Count files in upload directory
      const files = fs.readdirSync(this.uploadDir);
      const totalFiles = files.filter(file => file.endsWith('.pdf')).length;

      return {
        totalFiles,
        totalChunks: vectorStats.count,
        vectorStoreStats: vectorStats,
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return {
        totalFiles: 0,
        totalChunks: 0,
        vectorStoreStats: { count: 0, manuals: [] },
      };
    }
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();
