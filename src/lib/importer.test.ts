import { Workbook } from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import {
  downloadExcelTemplate,
  mapImportRows,
  readInventoryFile,
  suggestMapping,
  type ImportData,
} from './importer';

function asFile(content: string | ArrayBuffer, name: string): File {
  return new File([content], name);
}

describe('suggestMapping', () => {
  it('reconoce encabezados habituales en español e inglés', () => {
    expect(
      suggestMapping(['SKU', 'Descripción', 'Ubicación', 'QTY', 'Orden de compra', 'Fecha']),
    ).toEqual({
      partNumber: 'SKU',
      description: 'Descripción',
      location: 'Ubicación',
      quantity: 'QTY',
      po: 'Orden de compra',
      date: 'Fecha',
    });
  });

  it('deja sin asignar las columnas que no reconoce', () => {
    expect(suggestMapping(['Producto', 'Notas'])).toEqual({
      partNumber: '',
      description: '',
      location: '',
      quantity: '',
      po: '',
      date: '',
    });
  });
});

describe('mapImportRows', () => {
  const data: ImportData = {
    headers: ['PN', 'Descripcion', 'Locacion', 'Cantidad', 'PO', 'Fecha'],
    rows: [
      ['000123', '', 'A-01', 'no es número', 'PO-7', '15 de febrero de 2024'],
      ['', 'Artículo sin parte', '', '', '', ''],
    ],
    sheetName: 'Inventario',
  };
  const mapping = {
    partNumber: 'PN',
    description: 'Descripcion',
    location: 'Locacion',
    quantity: 'Cantidad',
    po: 'PO',
    date: 'Fecha',
  };

  it('conserva campos requeridos en blanco para revisión y no convierte cantidad inválida en 1', () => {
    const articles = mapImportRows(data, mapping);

    expect(articles).toHaveLength(2);
    expect(articles[0].partNumber).toBe('000123');
    expect(articles[0].description).toBe('');
    expect(Number.isNaN(articles[0].quantity)).toBe(true);
    expect(articles[0].date).toBe('2024-02-15');
  });

  it('usa cantidad 1 y la fecha de hoy solo cuando las celdas están vacías', () => {
    const article = mapImportRows(data, mapping)[1];
    expect(article.quantity).toBe(1);
    expect(article.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('readInventoryFile', () => {
  it('lee CSV UTF-8 con delimitador detectado y valores entrecomillados', async () => {
    const csv = [
      'SKU;Descripción;Ubicación;QTY;PO;Fecha',
      '000123;"Bolsa; negra";A-01;2;PO-1;31/12/2024',
      ';"Fila con parte faltante";;;' + ';',
      '',
    ].join('\n');
    const data = await readInventoryFile(asFile(csv, 'inventario.csv'));

    expect(data.sheetName).toBe('inventario.csv');
    expect(data.headers).toEqual(['SKU', 'Descripción', 'Ubicación', 'QTY', 'PO', 'Fecha']);
    expect(data.rows).toEqual([
      ['000123', 'Bolsa; negra', 'A-01', '2', 'PO-1', '31/12/2024'],
      ['', 'Fila con parte faltante', '', '', '', ''],
    ]);
  });

  it('lee XLSX desde File, preserva formato de ceros y usa resultados de fórmulas', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Conteo');
    worksheet.addRow(['SKU', 'Descripción', 'Ubicación', 'QTY', 'PO', 'Fecha']);
    worksheet.addRow(['000007', 'Producto', 'B-02', 0, 'PO-2', new Date(Date.UTC(2024, 1, 3))]);
    worksheet.getCell('A2').numFmt = '@';
    worksheet.getCell('D2').value = { formula: '2+3', result: 5 };
    worksheet.getCell('F2').numFmt = 'dd/mm/yyyy';

    const buffer = await workbook.xlsx.writeBuffer();
    const data = await readInventoryFile(asFile(buffer as ArrayBuffer, 'inventario.xlsx'));

    expect(data.sheetName).toBe('Conteo');
    expect(data.rows[0][0]).toBe('000007');
    expect(data.rows[0][3]).toBe('5');
    expect(data.rows[0][5]).toBe('2024-02-03');
  });

  it('rechaza la extensión .xls con una instrucción explícita', async () => {
    await expect(readInventoryFile(asFile('contenido', 'inventario.xls'))).rejects.toThrow(
      'Convierte el archivo a .xlsx o .csv',
    );
  });
});

describe('downloadExcelTemplate', () => {
  it('genera y descarga una plantilla XLSX', async () => {
    const anchor = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    };
    const createObjectURL = vi.fn(() => 'blob:plantilla');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    });

    await downloadExcelTemplate();

    expect(anchor.download).toBe('plantilla-inventario.xlsx');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
