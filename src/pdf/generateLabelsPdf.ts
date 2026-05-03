import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { LabelData } from '../types';
import { formatManufacturedDate, normalizeBatchNumber } from '../formatting';
import { A4, mmToPt } from './measurements';

const FIXED_LAYOUT = {
  rows: 8,
  columns: 6,
  marginTopMm: 5,
  marginLeftMm: 5,
  gapXMm: 0,
  gapYMm: 0,
};

const LABEL_WIDTH_MM = (A4.widthMm - FIXED_LAYOUT.marginLeftMm * 2 - FIXED_LAYOUT.gapXMm * (FIXED_LAYOUT.columns - 1)) / FIXED_LAYOUT.columns;
const LABEL_HEIGHT_MM = (A4.heightMm - FIXED_LAYOUT.marginTopMm * 2 - FIXED_LAYOUT.gapYMm * (FIXED_LAYOUT.rows - 1)) / FIXED_LAYOUT.rows;

function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCenteredText(page: any, text: string, font: any, size: number, x: number, y: number, width: number, color?: { r: number; g: number; b: number; }) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y,
    size,
    font,
    ...(color ? { color: rgb(color.r, color.g, color.b) } : {}),
  });
}

export async function generateLabelsPdf(data: LabelData) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([mmToPt(A4.widthMm), mmToPt(A4.heightMm)]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageHeight = mmToPt(A4.heightMm);

  for (let r = 0; r < FIXED_LAYOUT.rows; r++) {
    for (let c = 0; c < FIXED_LAYOUT.columns; c++) {
      const x = mmToPt(FIXED_LAYOUT.marginLeftMm + c * (LABEL_WIDTH_MM + FIXED_LAYOUT.gapXMm));
      const yTop = pageHeight - mmToPt(FIXED_LAYOUT.marginTopMm + r * (LABEL_HEIGHT_MM + FIXED_LAYOUT.gapYMm));
      const w = mmToPt(LABEL_WIDTH_MM);
      const h = mmToPt(LABEL_HEIGHT_MM);
      const pad = mmToPt(4);
      let y = yTop - pad - 12;

      const titleLines = wrapText(data.title || 'Product name', w - pad * 2, bold, 12).slice(0, 2);
      for (const line of titleLines) {
        drawCenteredText(page, line, bold, 12, x, y, w);
        y -= 13;
      }
      if (data.keepCooled) {
        drawCenteredText(page, '(kühl lagern)', regular, 8, x, y, w);
        y -= 12;
      }
      const ingredientLines = wrapText(data.ingredients || 'Ingredients', w - pad * 2, regular, 8.5).slice(0, 8);
      for (const line of ingredientLines) {
        drawCenteredText(page, line, regular, 8.5, x, y, w);
        y -= 10;
      }
      const footer = `${formatManufacturedDate(data.productionMonth)} · ${normalizeBatchNumber(data.batchNumber)}`;
      drawCenteredText(page, footer, regular, 7.5, x, yTop - h + pad, w, { r: 0.25, g: 0.25, b: 0.25 });
    }
  }
  const bytes = await pdf.save();
  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  return new Blob([blobBytes], { type: 'application/pdf' });
}
