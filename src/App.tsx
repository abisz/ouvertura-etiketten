import {useState} from 'react';
import type {LabelData} from './types';
import {generateLabelsPdf} from './pdf/generateLabelsPdf';
import {LabelPreview} from './components/LabelPreview';
import {getCurrentYearMonthValue, normalizeBatchNumber} from './formatting';
// @ts-ignore
import './styles.css';

const defaultData: LabelData = {
    title: 'Pilz-Gemüse-Aufstrich',
    keepCooled: true,
    ingredients: 'Melanzani, Tomate, Kräuterseitling, Shiitake, Nameko, Sonnenblumenöl und -kerne, Zwiebel, Knoblauch, Zitrone, Salz, Pfeffer, Oregano, Lorbeer.',
    productionMonth: getCurrentYearMonthValue(),
    batchNumber: 'LP0395'
};

export default function App() {
    const [data, setData] = useState(defaultData);
    const updateData = (patch: Partial<LabelData>) => setData(d => ({...d, ...patch}));

    async function downloadPdf() {
        const blob = await generateLabelsPdf(data);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.title || 'labels'}-${data.batchNumber || 'batch'}.pdf`;
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
                <label>Chagennummer<input value={data.batchNumber}
                                                   onChange={e => updateData({batchNumber: normalizeBatchNumber(e.target.value)})}/></label>
                <p className="hint fixed-sheet">Für Etikettenpapier: A4, 8 Zeilen x 6 Spalten (48 Etiketten).</p>
                <button type="button" onClick={downloadPdf}>Download A4 PDF</button>
            </form>
            <aside className="card"><h2>Vorschau</h2><LabelPreview data={data}/><p className="hint">PDF enthält 48
                Etiketten auf einer A4 Seite.</p></aside>
        </section>
    </main>;
}
