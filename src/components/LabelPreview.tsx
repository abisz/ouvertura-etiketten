import type { LabelData } from '../types';
import { formatManufacturedDate, normalizeBatchNumber } from '../formatting';

export function LabelPreview({ data }: { data: LabelData }) {
  return <div className="label-preview">
    <h2>{data.title || 'Product name'}</h2>
    {data.keepCooled && <strong className="cool">(kühl lagern)</strong>}
    <p>{data.ingredients || 'Ingredients will appear here.'}</p>
    <footer>{formatManufacturedDate(data.productionMonth)} · {normalizeBatchNumber(data.batchNumber)}</footer>
  </div>;
}
