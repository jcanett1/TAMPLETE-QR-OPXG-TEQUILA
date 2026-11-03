import { Workbook } from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { downloadExcelTemplate, mapImportRows, readInventoryFile, suggestMapping, type ImportData } from './importer';

function asFile(content: string | ArrayBuffer, name: string): File {
  return new File([content], name);
}

describe('suggestMapping', () => {
  it('reconoce encabezados habituales en español e inglés', () => {
    expect(suggestMapping(['SKU', 'Descripción', 'Ubicación', 'Fecha'])).toEqual({
      partNumber: 'SKU', description: 'Descripción', location: 'Ubicación', date: 'Fecha',
    });
  });

  it('deja sin asignar las columnas que no reconoce, incluidas las antiguas', () => {
    expect(suggestMapping(['Producto', 'Notas', 'Cantidad', 'PO', 'FIFO'])).toEqual({
      partNumber: '', description: '', location: '', date: '',
    });
  });
});

describe('mapImportRows', () => {
  const data: ImportData = {
    headers: ['PN', 'Descripcion', 'Locacion', 'Cantidad', 'PO', 'FIFO', 'Fecha'],
    rows: [
      ['000123', '', 'A-01', 'no es número', 'PO-7', '17', '15 de febrero de 2024'],
      ['', 'Artículo sin parte', '', '', '', '', ''],
    ],
    sheetName: 'Inventario',
  };
  const mapping = { partNumber: 'PN', description: 'Descripcion', location: 'Locacion', date: 'Fecha' };

  it('conserva datos mapeados y no incorpora Cantidad/PO/FIFO al Article', () => {
    const articles = mapImportRows(data, mapping);
    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({ partNumber: '000123', description: '', location: 'A-01', date: '2024-02-15' });
    expect(articles[0]).not.toHaveProperty('quantity');
    expect(articles[0]).not.toHaveProperty('po');
    expect(articles[0]).not.toHaveProperty('fifo');
    expect(Object.keys(articles[0]).sort()).toEqual(['date', 'description', 'id', 'location', 'partNumber']);
  });

  it('usa la fecha de hoy solo cuando la celda está vacía', () => {
    expect(mapImportRows(data, mapping)[1].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('readInventoryFile', () => {
  it('lee CSV UTF-8 delimitado con valores entrecomillados y ceros iniciales', async () => {
    const csv = [
      'SKU;Descripción;Ubicación;Cantidad;PO;FIFO;Fecha',
      '000123;"Bolsa; negra";A-01;2;PO-1;9;31/12/2024',
      '000002;"Fila con parte faltante";;;;;2024-01-03',
      '',
    ].join('\n');
    const data = await readInventoryFile(asFile(csv, 'inventario.csv'));
    expect(data.sheetName).toBe('inventario.csv');
    expect(data.headers).toEqual(['SKU', 'Descripción', 'Ubicación', 'Cantidad', 'PO', 'FIFO', 'Fecha']);
    expect(data.rows).toEqual([
      ['000123', 'Bolsa; negra', 'A-01', '2', 'PO-1', '9', '31/12/2024'],
      ['000002', 'Fila con parte faltante', '', '', '', '', '2024-01-03'],
    ]);
  });

  it('lee XLSX desde File, preserva formato de ceros, resultados de fórmulas y fechas', async () => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Conteo');
    worksheet.addRow(['SKU', 'Descripción', 'Ubicación', 'Cantidad', 'PO', 'FIFO', 'Fecha']);
    worksheet.addRow(['000007', 'Producto', 'B-02', 0, 'PO-2', 1, new Date(Date.UTC(2024, 1, 3))]);
    worksheet.getCell('A2').numFmt = '@';
    worksheet.getCell('D2').value = { formula: '2+3', result: 5 };
    worksheet.getCell('G2').numFmt = 'dd/mm/yyyy';
    const buffer = await workbook.xlsx.writeBuffer();
    const data = await readInventoryFile(asFile(buffer as ArrayBuffer, 'inventario.xlsx'));
    expect(data.sheetName).toBe('Conteo');
    expect(data.rows[0][0]).toBe('000007');
    expect(data.rows[0][3]).toBe('5');
    expect(data.rows[0][6]).toBe('2024-02-03');
  });

  it('rechaza la extensión .xls con una instrucción explícita', async () => {
    await expect(readInventoryFile(asFile('contenido', 'inventario.xls'))).rejects.toThrow('Convierte el archivo a .xlsx o .csv');
  });
});

describe('downloadExcelTemplate', () => {
  it('descarga un Blob XLSX real con cuatro encabezados y autofiltro', async () => {
    let downloadedBlob: Blob | undefined;
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const createObjectURL = vi.fn((blob: Blob) => { downloadedBlob = blob; return 'blob:plantilla'; });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } });
    await downloadExcelTemplate();
    expect(anchor.download).toBe('plantilla-inventario.xlsx');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(downloadedBlob).toBeInstanceOf(Blob);
    const workbook = new Workbook();
    await workbook.xlsx.load(await downloadedBlob!.arrayBuffer());
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).values).toEqual([, 'Numero de parte', 'Descripcion', 'Locacion', 'Fecha']);
    expect(sheet.autoFilter).toBe('A1:D3');
    expect(sheet.getCell('A2').value).toBe('DEMO-001');
    expect(sheet.getCell('A2').numFmt).toBe('@');
    expect(sheet.getCell('D2').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    vi.unstubAllGlobals();
  });
});
