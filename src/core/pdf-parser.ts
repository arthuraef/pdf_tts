import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFPageContent, ChapterOutlineItem } from '../types';
import { dehyphenate } from '../oscar-engine/sanitizer/dehyphenator';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ExtractionResult {
  pages: PDFPageContent[];
  totalCharacters: number;
  chapters: ChapterOutlineItem[];
  coverUrl?: string;
}

export async function extractTextFromPDF(
  file: File,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();

  // 🛡️ Camada 3.1: Validação de segurança contra "PDFs Bomba" (assinatura %PDF-)
  const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5));
  const headerString = String.fromCharCode(...headerBytes);
  if (!headerString.startsWith('%PDF-')) {
    throw new Error(
      'Arquivo inválido: o cabeçalho não corresponde a um documento PDF autêntico (%PDF-).'
    );
  }

  // 🛡️ Camada 3.1: Desarmamento de código malicioso e fontes externas
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
  } as unknown as Parameters<typeof pdfjsLib.getDocument>[0]);

  const pdfDocument = await loadingTask.promise;
  const pages: PDFPageContent[] = [];
  let totalCharacters = 0;

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    if (signal?.aborted) {
      throw new DOMException('Operação de leitura de PDF abortada pelo usuário', 'AbortError');
    }

    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();

    const strings: string[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const text = item.str.trim();
        if (text) {
          // Se o item anterior terminou com hífen ("deso -", "deso-") e o próximo é a continuação:
          if (strings.length > 0) {
            const last = strings[strings.length - 1];
            if (/[-–—\u00AD\u2010\u2011\u2012\u2212]$/.test(last) && /^[a-zà-ú]/i.test(text)) {
              strings[strings.length - 1] = last.replace(/\s*[-–—\u00AD\u2010\u2011\u2012\u2212]$/, '') + text;
              continue;
            }
          }
          strings.push(text);
        }
      }
    }

    const rawJoined = strings.join(' ').replace(/\s+/g, ' ').trim();
    const pageText = dehyphenate(rawJoined);
    totalCharacters += pageText.length;

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });
  }

  // 🚀 Inovação 2: Extrator Instantâneo de Capítulos (Outline / Sumário Nativo)
  const chapters: ChapterOutlineItem[] = [];
  try {
    const rawOutline = await pdfDocument.getOutline();
    if (rawOutline && Array.isArray(rawOutline) && rawOutline.length > 0) {
      for (const item of rawOutline) {
        if (!item.title) continue;

        let resolvedPageNumber = 1;
        try {
          let dest = item.dest;
          if (typeof dest === 'string') {
            dest = await pdfDocument.getDestination(dest);
          }
          if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            const pageIndex = await pdfDocument.getPageIndex(pageRef);
            resolvedPageNumber = pageIndex + 1;
          }
        } catch {
          // Destino complexo, mantém fallback
        }

        chapters.push({
          title: item.title.trim(),
          pageNumber: resolvedPageNumber,
        });
      }
    }
  } catch (err) {
    console.warn('[PDFParser] Falha ao extrair sumário nativo:', err);
  }

  // Heurística de fallback: Se o PDF não tiver Outline embutido, detecta títulos nas páginas
  if (chapters.length === 0) {
    const headingRegex = /^(?:Cap[ií]tulo|Se[cç][aã]o|Parte|Livro|M[oó]dulo)\s+[\dIVX]+/i;
    pages.forEach((p) => {
      const lines = p.text.split(/[.\n]/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (headingRegex.test(trimmed) && trimmed.length < 80) {
          chapters.push({
            title: trimmed,
            pageNumber: p.pageNumber,
          });
          break;
        }
      }
    });
  }

  // 🎨 Geração de capa em miniatura da página 1 do PDF
  let coverUrl: string | undefined;
  if (typeof document !== 'undefined') {
    try {
      const firstPage = await pdfDocument.getPage(1);
      const viewport = firstPage.getViewport({ scale: 0.6 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await (firstPage.render({ canvasContext: ctx, viewport } as any) as any).promise;
        coverUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (err) {
      console.warn('[PDFParser] Não foi possível renderizar a capa da página 1:', err);
    }
  }

  return {
    pages,
    totalCharacters,
    chapters,
    coverUrl,
  };
}
