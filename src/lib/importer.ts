import { Workbook, type Cell, type Worksheet } from 'exceljs';
import * as Papa from 'papaparse';
import {
  Article,
  MAX_ARTICLES,
  createArticle,
  downloadBlob,
  today,
} from './model';

export interface ImportData {
  headers: string[];
  rows: string[][];
  sheetName: string;
}

export type ColumnMapping = {
  partNumber: string;
  description: string;
  location: string;
  quantity: string;
  po: string;
  date: string;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_FILE_NAME = 'plantilla-inventario.xlsx';

const EMPTY_MAPPING: ColumnMapping = {
  partNumber: '',
  description: '',
  location: '',
  quantity: '',
  po: '',
  date: '',
};

const MAPPING_ALIASES: Record<keyof ColumnMapping, string[]> = {
  partNumber: [
    'numero de parte',
    'numero parte',
    'número de parte',
    'número parte',
    'no de parte',
    'no. de parte',
    'num de parte',
    'num parte',
    'part number',
    'part no',
    'part number sku',
    'part #',
    'part',
    'sku',
    'stock keeping unit',
    'pn',
    'p/n',
    'item number',
    'item no',
    'item #',
    'codigo',
    'código',
  ],
  description: [
    'descripcion',
    'descripción',
    'description',
    'desc',
    'item description',
    'product description',
    'nombre del producto',
    'nombre',
    'detalle',
  ],
  location: [
    'locacion',
    'locación',
    'ubicacion',
    'ubicación',
    'location',
    'loc',
    'bin',
    'shelf',
    'warehouse location',
    'storage location',
  ],
  quantity: [
    'cantidad',
    'quantity',
    'qty',
    'q.t.y.',
    'units',
    'unit count',
    'stock',
    'inventario',
    'count',
  ],
  po: [
    'po',
    'p.o.',
    'purchase order',
    'purchaseorder',
    'orden de compra',
    'orden compra',
    'oc',
  ],
  date: [
    'fecha',
    'date',
    'received date',
    'inventory date',
    'fecha de ingreso',
    'fecha ingreso',
    'created date',
    'created at',
  ],
};

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  sept: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value).trim();
  }
  return String(value).trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNonEmptyRow(row: string[]): boolean {
  return row.some((value) => cleanString(value) !== '');
}

function assertArticleLimit(rows: string[][]): void {
  const realRows = rows.filter(isNonEmptyRow).length;
  if (realRows > MAX_ARTICLES) {
    throw new Error(`El archivo contiene ${realRows} filas de inventario; el máximo permitido es ${MAX_ARTICLES}.`);
  }
}

function validateFile(file: File): string {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('El archivo supera el límite de 15 MB.');
  }

  const fileName = typeof file.name === 'string' ? file.name : '';
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  if (extension === 'xls') {
    throw new Error('Los archivos .xls no son compatibles. Convierte el archivo a .xlsx o .csv.');
  }
  if (extension !== 'xlsx' && extension !== 'csv') {
    throw new Error('Tipo de archivo no compatible. Selecciona un archivo .xlsx o .csv.');
  }
  return extension;
}

function dateParts(year: number, month: number, day: number): string | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return undefined;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateFromDateObject(value: Date): string | undefined {
  if (Number.isNaN(value.getTime())) return undefined;
  return dateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

function dateFromExcelSerial(value: number): string | undefined {
  if (!Number.isFinite(value) || value < 1 || value > 2958465) return undefined;
  const milliseconds = Math.round(value * 24 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(1899, 11, 30) + milliseconds);
  return dateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function isDateNumberFormat(format: string | undefined): boolean {
  if (!format) return false;
  const withoutLiterals = format
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
  return /[dmy]/i.test(withoutLiterals);
}

function formulaResult(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if ('result' in value) return (value as { result?: unknown }).result;
  if ('richText' in value) return value;
  return value;
}

function richTextToString(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('richText' in value)) return undefined;
  const richText = (value as { richText?: Array<{ text?: string }> }).richText;
  if (!Array.isArray(richText)) return undefined;
  return richText.map((part) => part.text ?? '').join('');
}

function cellToString(cell: Cell): string {
  const rawValue = formulaResult(cell.value);
  if (rawValue === null || rawValue === undefined) return '';

  if (rawValue instanceof Date) {
    return dateFromDateObject(rawValue) ?? cleanString(rawValue);
  }

  if (typeof rawValue === 'number' && isDateNumberFormat(cell.numFmt)) {
    return dateFromExcelSerial(rawValue) ?? cleanString(cell.text || rawValue);
  }

  const richText = richTextToString(rawValue);
  if (richText !== undefined) return richText.trim();

  const displayed = cleanString(cell.text);
  if (displayed && typeof rawValue !== 'object' && !displayed.startsWith('=')) {
    return displayed;
  }
  return cleanString(rawValue);
}

function worksheetColumnCount(worksheet: Worksheet): number {
  let count = Math.max(worksheet.actualColumnCount, worksheet.getRow(1).cellCount, 1);
  for (let rowNumber = 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    count = Math.max(count, worksheet.getRow(rowNumber).cellCount);
  }
  return count;
}

function readWorksheet(worksheet: Worksheet): ImportData {
  const columnCount = worksheetColumnCount(worksheet);
  const headerRow = worksheet.getRow(1);
  const headers = Array.from({ length: columnCount }, (_, index) => cleanString(cellToString(headerRow.getCell(index + 1))));
  const rows: string[][] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = Array.from({ length: columnCount }, (_, index) => cellToString(row.getCell(index + 1)));
    if (isNonEmptyRow(values)) rows.push(values);
  }

  if (headers.length === 0 || !headers.some((header) => header !== '')) {
    throw new Error('El archivo no contiene una fila de encabezados.');
  }
  assertArticleLimit(rows);
  return { headers, rows, sheetName: worksheet.name || 'Hoja 1' };
}

async function readXlsx(file: File): Promise<ImportData> {
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('El archivo Excel no contiene ninguna hoja.');
  return readWorksheet(worksheet);
}

function csvParseError(errors: Papa.ParseError[]): Papa.ParseError | undefined {
  return errors.find((error) => error.code !== 'TooFewFields' && error.code !== 'TooManyFields');
}

async function readCsv(file: File): Promise<ImportData> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  return new Promise<ImportData>((resolve, reject) => {
    Papa.parse<string[]>(text, {
      delimiter: '',
      quoteChar: '"',
      escapeChar: '"',
      skipEmptyLines: false,
      dynamicTyping: false,
      complete: (result) => {
        const parseError = csvParseError(result.errors);
        if (parseError) {
          reject(new Error(`No se pudo leer el CSV: ${parseError.message}.`));
          return;
        }

        const parsedRows = result.data.map((row) =>
          (Array.isArray(row) ? row : [row]).map((value) => cleanString(value)),
        );
        const headers = parsedRows.shift() ?? [];
        if (headers.length === 0 || !headers.some((header) => header !== '')) {
          reject(new Error('El archivo no contiene una fila de encabezados.'));
          return;
        }

        const rows = parsedRows.filter(isNonEmptyRow);
        assertArticleLimit(rows);
        resolve({ headers, rows, sheetName: file.name || 'CSV' });
      },
      error: (error: Error) => reject(new Error(`No se pudo leer el CSV: ${error.message}.`)),
    });
  });
}

export async function readInventoryFile(file: File): Promise<ImportData> {
  const extension = validateFile(file);
  try {
    return extension === 'xlsx' ? await readXlsx(file) : await readCsv(file);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('El archivo')) throw error;
    if (error instanceof Error && error.message.startsWith('Los archivos')) throw error;
    if (error instanceof Error && error.message.startsWith('Tipo de archivo')) throw error;
    if (error instanceof Error && error.message.startsWith('El archivo supera')) throw error;
    if (error instanceof Error && error.message.startsWith('El archivo contiene')) throw error;
    throw new Error(`No se pudo leer el archivo: ${errorMessage(error)}.`);
  }
}

function matchingHeader(headers: string[], aliases: string[]): string {
  const normalizedAliases = aliases.map(normalizeText);
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeText(header);
    if (!normalizedHeader) return;
    const aliasIndex = normalizedAliases.indexOf(normalizedHeader);
    if (aliasIndex >= 0 && aliasIndex < bestScore) {
      bestIndex = index;
      bestScore = aliasIndex;
    }
  });

  return bestIndex >= 0 ? headers[bestIndex] : '';
}

export function suggestMapping(headers: string[]): ColumnMapping {
  return (Object.keys(EMPTY_MAPPING) as Array<keyof ColumnMapping>).reduce(
    (mapping, field) => {
      mapping[field] = matchingHeader(headers, MAPPING_ALIASES[field]);
      return mapping;
    },
    { ...EMPTY_MAPPING },
  );
}

function columnIndex(headers: string[], selectedHeader: string): number {
  if (!selectedHeader) return -1;
  const exact = headers.indexOf(selectedHeader);
  if (exact >= 0) return exact;
  const normalized = normalizeText(selectedHeader);
  return headers.findIndex((header) => normalizeText(header) === normalized);
}

function mappedValue(row: string[], headers: string[], selectedHeader: string): string {
  const index = columnIndex(headers, selectedHeader);
  return index >= 0 ? cleanString(row[index] ?? '') : '';
}

function parseQuantity(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 1;

  const compact = trimmed.replace(/\u00a0/g, ' ').replace(/\s+/g, '');
  const groupedInteger = /^[+-]?\d{1,3}(?:,\d{3})+$/.test(compact);
  const numericText = groupedInteger ? compact.replace(/,/g, '') : compact;
  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeDate(value: string): string {
  const raw = value.trim();
  if (!raw) return today();

  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/);
  if (iso) return dateParts(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? raw;

  const numeric = raw.match(/^(\d{1,2})[\s./-](\d{1,2})[\s./-](\d{4})$/);
  if (numeric) return dateParts(Number(numeric[3]), Number(numeric[2]), Number(numeric[1])) ?? raw;

  const wordDate = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/^(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+de)?\s+(\d{4})$/);
  if (wordDate) {
    const month = SPANISH_MONTHS[wordDate[2]];
    if (month) return dateParts(Number(wordDate[3]), month, Number(wordDate[1])) ?? raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /[a-z]/i.test(raw)) {
    return dateFromDateObject(parsed) ?? raw;
  }
  return raw;
}

export function mapImportRows(data: ImportData, mapping: ColumnMapping): Article[] {
  const realRows = data.rows.filter(isNonEmptyRow);
  assertArticleLimit(realRows);

  return realRows.map((row, index) => {
    const partNumber = mappedValue(row, data.headers, mapping.partNumber);
    const description = mappedValue(row, data.headers, mapping.description);
    const location = mappedValue(row, data.headers, mapping.location);
    const quantity = parseQuantity(mappedValue(row, data.headers, mapping.quantity));
    const po = mappedValue(row, data.headers, mapping.po);
    const date = normalizeDate(mappedValue(row, data.headers, mapping.date));

    return createArticle({
      partNumber,
      description,
      location,
      quantity,
      po,
      date,
      fifo: index + 1,
    });
  });
}

function styleTemplate(worksheet: Worksheet): void {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = 'A1:F3';
  worksheet.getRow(1).height = 28;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9E2F3' } },
      left: { style: 'thin', color: { argb: 'FFD9E2F3' } },
      bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
      right: { style: 'thin', color: { argb: 'FFD9E2F3' } },
    };
  });

  [2, 3].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFD9E2F3' } },
        left: { style: 'hair', color: { argb: 'FFD9E2F3' } },
        bottom: { style: 'hair', color: { argb: 'FFD9E2F3' } },
        right: { style: 'hair', color: { argb: 'FFD9E2F3' } },
      };
      if (rowNumber === 3) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FA' } };
      }
    });
  });

  worksheet.getColumn(1).width = 22;
  worksheet.getColumn(2).width = 46;
  worksheet.getColumn(3).width = 16;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 15;
  worksheet.getColumn(1).numFmt = '@';
  worksheet.getColumn(3).numFmt = '@';
  worksheet.getColumn(4).numFmt = '0';
  worksheet.getColumn(5).numFmt = '@';
  worksheet.getColumn(6).numFmt = '@';
  worksheet.getCell('D2').alignment = { vertical: 'middle', horizontal: 'right' };
  worksheet.getCell('D3').alignment = { vertical: 'middle', horizontal: 'right' };
}

export async function downloadExcelTemplate(): Promise<void> {
  const workbook = new Workbook();
  workbook.creator = 'QR Labels';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Inventario', { properties: { tabColor: { argb: 'FF1F4E78' } } });
  worksheet.addRow(['Numero de parte', 'Descripcion', 'Locacion', 'Cantidad', 'PO', 'Fecha']);
  worksheet.addRow([
    'DEMO-001',
    'Artículo de muestra — bolsa deportiva',
    'A-01',
    1,
    'DEMO-PO-001',
    today(),
  ]);
  worksheet.addRow([
    'DEMO-002',
    'Artículo de muestra — caja de pelotas',
    'A-02',
    1,
    'DEMO-PO-002',
    today(),
  ]);
  styleTemplate(worksheet);

  const workbookBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([workbookBuffer as BlobPart], { type: XLSX_MIME });
  downloadBlob(blob, TEMPLATE_FILE_NAME);
}
