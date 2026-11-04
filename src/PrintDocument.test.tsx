import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PrintDocument from './PrintDocument';
import { createArticle, defaultSettings, type LabelSettings } from './lib/model';
import type { PrintJob } from './PrintDocument';

function makeJob(count: number, overrides: Partial<LabelSettings> = {}): PrintJob {
  const articles = Array.from({ length: count }, (_, index) => createArticle({
    id: `print-${index + 1}`,
    partNumber: `PART-${String(index + 1).padStart(2, '0')}`,
    description: `Description ${index + 1}`,
    location: `BIN-${index + 1}`,
    date: '2026-11-03',
  }));
  const codes = Object.fromEntries(articles.map((article) => [article.id, 'data:image/png;base64,cXI=']));
  return { articles, codes, settings: { ...defaultSettings, ...overrides } };
}

describe('PrintDocument', () => {
  it('imprime todos los artículos compactos en varias páginas y conserva 8 celdas por hoja', () => {
    const job = makeJob(9);
    const html = renderToStaticMarkup(<PrintDocument job={job} />);
    expect(html.match(/class="print-sheet print-sheet-letter"/g)).toHaveLength(2);
    expect(html.match(/class="print-cell print-cell-small/g)).toHaveLength(16);
    expect(html.match(/class="print-cell-qr"/g)).toHaveLength(9);
    expect(html).toContain('PART-09');
    expect(html).toContain('data:image/png;base64,cXI=');
    expect(html).not.toContain('PART-10');
  });

  it('respeta A4 y completa la distribución ampliada de 3 celdas por página', () => {
    const job = makeJob(4, { format: 'large', paper: 'a4', showDate: false });
    const html = renderToStaticMarkup(<PrintDocument job={job} />);
    expect(html.match(/class="print-sheet print-sheet-a4"/g)).toHaveLength(2);
    expect(html.match(/class="print-cell print-cell-large/g)).toHaveLength(6);
    expect(html.match(/class="print-cell-qr"/g)).toHaveLength(4);
    expect(html).toContain('PART-04');
    expect(html).not.toContain('2026-11-03');
  });
});
