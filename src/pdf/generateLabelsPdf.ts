import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
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

// Base font sizes / spacings at scale 1.0
const BASE_TITLE_SIZE = 12;
const BASE_INGREDIENT_SIZE = 8.5;
const BASE_COOL_SIZE = 8;
const BASE_COOL_LINE_HEIGHT = 12; // text size + leading, applied as y-decrement after the cool line
const FOOTER_FONT_MAX = 7.5;
const FOOTER_FONT_MIN = 6;
const FOOTER_GAP = 2; // minimum gap between last ingredient baseline and footer

// Scaling search parameters
const SCALE_MAX = 1.0;
const SCALE_MIN = 0.3;
const SCALE_STEP = 0.025;

function splitWord(word: string, maxWidth: number, font: PDFFont, size: number): string[] {
  if (!word) return [];

  const parts: string[] = [];
  let current = '';

  for (const char of word) {
    const next = `${current}${char}`;
    if (!current || font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    parts.push(current);
    current = char;
  }

  if (current) parts.push(current);
  return parts;
}

/** Splits "Pilz-Gemüse-Aufstrich" → ["Pilz-", "Gemüse-", "Aufstrich"] (hyphen stays with preceding segment). */
function splitAtHyphens(word: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (const char of word) {
    current += char;
    if (char === '-') { parts.push(current); current = ''; }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number, wordSplitAllowed = true): string[] {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!paragraphs.length) return [];

  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let line = '';

    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      const wordPrefix = wi === 0 ? '' : ' ';

      // Build atoms: units that must not be broken further.
      // Consecutive atoms from the same word are joined WITHOUT a separator;
      // atoms from different words are joined with a space (wordPrefix).
      type Atom = { text: string; prefix: string };
      let atoms: Atom[];

      if (!wordSplitAllowed) {
        // Break only at hyphens that are already present in the word.
        const hParts = splitAtHyphens(word);
        atoms = hParts.map((p, i) => ({ text: p, prefix: i === 0 ? wordPrefix : '' }));
      } else if (font.widthOfTextAtSize(word, size) > maxWidth) {
        // Fall back to character-level splitting for oversized words.
        const cParts = splitWord(word, maxWidth, font, size);
        atoms = cParts.map((p, i) => ({ text: p, prefix: i === 0 ? wordPrefix : '' }));
      } else {
        atoms = [{ text: word, prefix: wordPrefix }];
      }

      for (const atom of atoms) {
        const candidate = line ? `${line}${atom.prefix}${atom.text}` : atom.text;
        if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
        } else {
          lines.push(line);
          line = atom.text; // new line — never starts with a prefix
        }
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function ellipsizeText(text: string, maxWidth: number, font: PDFFont, size: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;

  const ellipsis = '…';
  if (font.widthOfTextAtSize(ellipsis, size) > maxWidth) return '';

  let result = normalized;
  while (result && font.widthOfTextAtSize(`${result}${ellipsis}`, size) > maxWidth) {
    result = result.slice(0, -1).trimEnd();
  }

  return result ? `${result}${ellipsis}` : ellipsis;
}

interface FitResult {
  titleSize: number;
  titleLineHeight: number;
  titleLines: string[];
  coolSize: number;
  coolLineHeight: number;
  ingredientSize: number;
  ingredientLineHeight: number;
  ingredientLines: string[];
}

/**
 * Finds the largest uniform scale factor (applied to all base font sizes) such that
 * the complete title + optional cool-line + all ingredient lines fit within `availableHeight`.
 * Nothing is ever truncated.
 *
 * Height model (y decreases downward in PDF space):
 *   - first title baseline : topY - titleSize
 *   - after N title lines  : descend N * titleLineHeight
 *   - after cool line      : descend coolLineHeight (if keepCooled)
 *   - N ingredient lines at y, y-iLH, …, y-(M-1)*iLH
 *
 * Constraint: titleSize + N*tLH + coolLH + (M-1)*iLH ≤ availableHeight
 */
function fitContent(
  titleText: string,
  ingredientText: string,
  keepCooled: boolean,
  availableHeight: number,
  contentWidth: number,
  bold: PDFFont,
  regular: PDFFont,
): FitResult {
  let fallback: FitResult | null = null;

  for (let scale = SCALE_MAX; scale >= SCALE_MIN - SCALE_STEP / 2; scale -= SCALE_STEP) {
    const s = Math.max(SCALE_MIN, scale);
    const titleSize = BASE_TITLE_SIZE * s;
    const titleLineHeight = titleSize + 1;
    const ingredientSize = BASE_INGREDIENT_SIZE * s;
    const ingredientLineHeight = ingredientSize + 1.5;
    const coolSize = BASE_COOL_SIZE * s;
    const coolLineHeight = BASE_COOL_LINE_HEIGHT * s;

    const titleLines = wrapText(titleText, contentWidth, bold, titleSize, false);
    const ingredientLines = wrapText(ingredientText, contentWidth, regular, ingredientSize);

    const heightUsed =
      titleSize +
      titleLines.length * titleLineHeight +
      (keepCooled ? coolLineHeight : 0) +
      Math.max(0, ingredientLines.length - 1) * ingredientLineHeight;

    const result: FitResult = {
      titleSize, titleLineHeight, titleLines,
      coolSize, coolLineHeight,
      ingredientSize, ingredientLineHeight, ingredientLines,
    };

    if (heightUsed <= availableHeight) return result;
    if (!fallback) fallback = result; // smallest attempted → last-resort fallback
  }

  return fallback!;
}

function fitSingleLine(text: string, maxWidth: number, font: PDFFont, preferredSize: number, minSize: number) {
  for (let size = preferredSize; size >= minSize; size -= 0.25) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size };
  }

  return {
    text: ellipsizeText(text, maxWidth, font, minSize),
    size: minSize,
  };
}

function drawCenteredText(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number, width: number, color?: { r: number; g: number; b: number; }) {
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
      const pad = mmToPt(2);
      const contentWidth = w - pad * 2;
      const topY = yTop - pad;               // top edge of content area
      const contentHeight = h - 2 * pad;    // total usable height

      const titleText = data.title.trim() || 'Product name';
      const ingredientText = data.ingredients.trim() || 'Ingredients';
      const footer = `${formatManufacturedDate(data.productionMonth)} · ${normalizeBatchNumber(data.batchNumber)}`;

      // Footer is always a short fixed-format line; shrink font if needed.
      const footerLayout = fitSingleLine(footer, contentWidth, regular, FOOTER_FONT_MAX, FOOTER_FONT_MIN);

      // Space available for the body (title + cool + ingredients); footer + gap sit below.
      const availableHeight = contentHeight - footerLayout.size - FOOTER_GAP;

      const {
        titleSize, titleLineHeight, titleLines,
        coolSize, coolLineHeight,
        ingredientSize, ingredientLineHeight, ingredientLines,
      } = fitContent(titleText, ingredientText, data.keepCooled, availableHeight, contentWidth, bold, regular);

      // --- Relative layout simulation (y = 0 at first title baseline) ---
      // Tracks how far each element is below the first title baseline.
      let yRel = 0;
      let lastYRel = 0;
      for (const _ of titleLines)     { lastYRel = yRel; yRel -= titleLineHeight; }
      if (data.keepCooled)             { lastYRel = yRel; yRel -= coolLineHeight; }
      for (const _ of ingredientLines) { lastYRel = yRel; yRel -= ingredientLineHeight; }

      // Footer sits FOOTER_GAP below the last drawn element's baseline.
      // We subtract footerSize so the footer's cap height clears the content above by FOOTER_GAP.
      const footerRelY = lastYRel - footerLayout.size - FOOTER_GAP;

      // Visual block height: from cap of title (≈ titleSize above first baseline)
      // down to the footer baseline.
      const blockHeight = titleSize - footerRelY; // footerRelY ≤ 0, so this is positive

      // Vertical centering: push block down so equal whitespace appears top and bottom.
      const topPadding = Math.max(0, (contentHeight - blockHeight) / 2);

      // Absolute position of first title baseline.
      const firstTitleBaseline = topY - topPadding - titleSize;

      // --- Draw ---
      let y = firstTitleBaseline;
      for (const line of titleLines) {
        drawCenteredText(page, line, bold, titleSize, x, y, w);
        y -= titleLineHeight;
      }

      if (data.keepCooled) {
        drawCenteredText(page, '(kühl lagern)', regular, coolSize, x, y, w);
        y -= coolLineHeight;
      }

      for (const line of ingredientLines) {
        drawCenteredText(page, line, regular, ingredientSize, x, y, w);
        y -= ingredientLineHeight;
      }

      // Footer: right after the ingredients, centered.
      drawCenteredText(page, footerLayout.text, regular, footerLayout.size,
        x, firstTitleBaseline + footerRelY, w, { r: 0.25, g: 0.25, b: 0.25 });
    }
  }
  const bytes = await pdf.save();
  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  return new Blob([blobBytes], { type: 'application/pdf' });
}
