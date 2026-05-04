import {useEffect, useState} from 'react';
import type {LabelData} from './types';
import {generateLabelsPdf} from './pdf/generateLabelsPdf';
import {getCurrentYearMonthValue, normalizeBatchNumber} from './formatting';
import {LABEL_SHEET_LAYOUTS} from './pdf/layoutPresets';
// @ts-ignore
import './styles.css';

const LABEL_DATA_STORAGE_KEY = 'farm-label-maker.label-data';

const defaultData: LabelData = {
    title: 'Pilz-Gemüse-Aufstrich',
    keepCooled: true,
    ingredients: 'Melanzani, Tomate, Kräuterseitling, Shiitake, Nameko, Sonnenblumenöl und -kerne, Zwiebel, Knoblauch, Zitrone, Salz, Pfeffer, Oregano, Lorbeer.',
    productionMonth: getCurrentYearMonthValue(),
    batchNumber: 'LP0395',
    labelSheetPreset: 'rect-8x6'
};

function normalizeSheetPreset(value: unknown): LabelData['labelSheetPreset'] {
    return value === 'round-6x4' ? 'round-6x4' : 'rect-8x6';
}

function loadStoredData(): LabelData {
    if (typeof window === 'undefined') return defaultData;

    try {
        const raw = window.localStorage.getItem(LABEL_DATA_STORAGE_KEY);
        if (!raw) return defaultData;

        const parsed = JSON.parse(raw) as Partial<LabelData>;
        return {
            title: typeof parsed.title === 'string' ? parsed.title : defaultData.title,
            keepCooled: typeof parsed.keepCooled === 'boolean' ? parsed.keepCooled : defaultData.keepCooled,
            ingredients: typeof parsed.ingredients === 'string' ? parsed.ingredients : defaultData.ingredients,
            productionMonth: typeof parsed.productionMonth === 'string' ? parsed.productionMonth : defaultData.productionMonth,
            batchNumber: normalizeBatchNumber(typeof parsed.batchNumber === 'string' ? parsed.batchNumber : defaultData.batchNumber),
            labelSheetPreset: normalizeSheetPreset(parsed.labelSheetPreset),
        };
    } catch {
        return defaultData;
    }
}

export default function App() {
    const [data, setData] = useState<LabelData>(() => loadStoredData());
    const updateData = (patch: Partial<LabelData>) => setData(d => ({...d, ...patch}));

    useEffect(() => {
        window.localStorage.setItem(LABEL_DATA_STORAGE_KEY, JSON.stringify(data));
    }, [data]);

    async function downloadPdf() {
        const blob = await generateLabelsPdf(data);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.batchNumber || 'batch'} ${data.title || 'labels'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return <main>
        <header><h1>Ouvertura Etiketten</h1></header>
        <section className="grid">
            <form className="card" onSubmit={e => e.preventDefault()}>
                <label>Produkt Titel<input value={data.title}
                                           onChange={e => updateData({title: e.target.value})}/></label>
                <label className="check"><input type="checkbox" checked={data.keepCooled}
                                                onChange={e => updateData({keepCooled: e.target.checked})}/>Kühl lagern</label>
                <label>Zutaten<textarea rows={5} value={data.ingredients}
                                            onChange={e => updateData({ingredients: e.target.value})}/></label>
                <label>Herstellungsmonat<input type="month" value={data.productionMonth}
                                                onChange={e => updateData({productionMonth: e.target.value})}/></label>
                <label>Chargennummer<input value={data.batchNumber}
                                                   onChange={e => updateData({batchNumber: normalizeBatchNumber(e.target.value)})}/></label>
                <label>Etikettenpapier
                    <select value={data.labelSheetPreset}
                            onChange={e => updateData({labelSheetPreset: normalizeSheetPreset(e.target.value)})}>
                        {Object.entries(LABEL_SHEET_LAYOUTS).map(([key, layout]) => (
                            <option key={key} value={key}>{layout.uiName}</option>
                        ))}
                    </select>
                </label>
                <p className="hint fixed-sheet">{LABEL_SHEET_LAYOUTS[data.labelSheetPreset].uiHint}</p>
                <button type="button" onClick={downloadPdf}>Download A4 PDF</button>
            </form>
        </section>
    </main>;
}
