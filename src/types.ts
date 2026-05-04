export type LabelSheetPreset = 'rect-8x6' | 'round-6x4';

export type LabelData = {
    title: string;
    keepCooled: boolean;
    ingredients: string;
    productionMonth: string;
    batchNumber: string;
    labelSheetPreset: LabelSheetPreset;
};
