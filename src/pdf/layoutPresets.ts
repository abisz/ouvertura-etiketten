import type { LabelSheetPreset } from '../types';

export type LabelShape = 'rectangle' | 'round';

export type LabelSheetLayout = {
  shape: LabelShape;
  rows: number;
  columns: number;
  marginTopMm: number;
  marginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
  uiName: string;
  uiHint: string;
  // Safe content area inside a circle, expressed as fraction of diameter.
  roundSafeAreaFactor?: number;
};

export const LABEL_SHEET_LAYOUTS: Record<LabelSheetPreset, LabelSheetLayout> = {
  'rect-8x6': {
    shape: 'rectangle',
    rows: 8,
    columns: 6,
    marginTopMm: 5,
    marginLeftMm: 5,
    gapXMm: 0,
    gapYMm: 0,
    uiName: 'A4 Rechteckig (8 x 6)',
    uiHint: 'Für Etikettenpapier: A4, 8 Zeilen x 6 Spalten (48 Etiketten).',
  },
  'round-6x4': {
    shape: 'round',
    rows: 6,
    columns: 4,
    marginTopMm: 5,
    marginLeftMm: 5,
    gapXMm: 0,
    gapYMm: 0,
    roundSafeAreaFactor: 0.7,
    uiName: 'A4 Rund (6 x 4)',
    uiHint: 'Für Rundetiketten: A4, 6 Zeilen x 4 Spalten (24 Etiketten).',
  },
};

export function getLabelSheetLayout(preset: LabelSheetPreset): LabelSheetLayout {
  return LABEL_SHEET_LAYOUTS[preset];
}

