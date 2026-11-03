export interface Article {
  id: string;
  partNumber: string;
  description: string;
  location: string;
  date: string;
}

export interface LabelSettings {
  format: 'small' | 'large';
  paper: 'letter' | 'a4';
  qrContent: 'partNumber' | 'partLocation' | 'all';
  showDate: boolean;
}

export const MAX_ARTICLES = 1000;
export const defaultSettings: LabelSettings = {
  format: 'small', paper: 'letter', qrContent: 'partNumber', showDate: true,
};
export function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function createArticle(values: Partial<Article> = {}): Article {
  return {
    id: values.id ?? crypto.randomUUID(),
    partNumber: values.partNumber ?? '',
    description: values.description ?? '',
    location: values.location ?? '',
    date: values.date ?? today(),
  };
}
export function validateArticle(article: Article): string[] {
  const errors: string[] = [];
  if (!article.partNumber.trim()) errors.push('Falta el número de parte');
  if (!article.description.trim()) errors.push('Falta la descripción');
  if (!article.location.trim()) errors.push('Falta la locación');
  if (article.partNumber.length > 80) errors.push('Número de parte: máximo 80 caracteres');
  if (article.description.length > 180) errors.push('Descripción: máximo 180 caracteres');
  if (article.location.length > 40) errors.push('Locación: máximo 40 caracteres');
  const dateMatch = article.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateMatch ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))) : undefined;
  if (!date || date.getUTCFullYear() !== Number(dateMatch?.[1]) || date.getUTCMonth() + 1 !== Number(dateMatch?.[2]) || date.getUTCDate() !== Number(dateMatch?.[3])) errors.push('Fecha inválida');
  return errors;
}
export function qrPayload(article: Article, mode: LabelSettings['qrContent']): string {
  if (mode === 'partLocation') return JSON.stringify({ partNumber: article.partNumber, location: article.location });
  if (mode === 'all') return JSON.stringify({ partNumber: article.partNumber, description: article.description, location: article.location, date: article.date });
  return JSON.stringify({ partNumber: article.partNumber });
}
export function pageGeometry(settings: LabelSettings) {
  const width = settings.paper === 'letter' ? 215.9 : 210;
  const height = settings.paper === 'letter' ? 279.4 : 297;
  const margin = 12.7;
  const columns = settings.format === 'small' ? 2 : 1;
  const rows = settings.format === 'small' ? 4 : 3;
  const usableWidth = width - 2 * margin;
  // 4 mm below the table reserves Word's mandatory trailing paragraph.
  const usableHeight = height - 2 * margin - 4;
  return { width, height, margin, columns, rows, perPage: columns * rows, cellWidth: usableWidth / columns, cellHeight: usableHeight / rows };
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
export const demoArticles: Article[] = [
  ['DEMO-001', 'Artículo de muestra — bolsa deportiva', 'A-01'],
  ['DEMO-002', 'Artículo de muestra — caja de pelotas', 'A-02'],
  ['DEMO-003', 'Artículo de muestra — marcador', 'B-06'],
  ['DEMO-004', 'Artículo de muestra — gorra verde', 'C-01'],
  ['DEMO-005', 'Artículo de muestra — gorra de malla azul', 'C-02'],
  ['DEMO-006', 'Artículo de muestra — sombrero gris', 'C-03'],
  ['DEMO-007', 'Artículo de muestra — accesorio negro', 'D-02'],
  ['DEMO-008', 'Artículo de muestra — accesorio blanco', 'D-03'],
].map(([partNumber, description, location]) => createArticle({ partNumber, description, location }));
