export function getCurrentYearMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function formatManufacturedDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return 'herg. MM/YYYY';
  const [, year, month] = match;
  return `herg. ${month}/${year}`;
}

export function normalizeBatchNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(-4);
  return `LP${digits.padStart(4, '0')}`;
}

