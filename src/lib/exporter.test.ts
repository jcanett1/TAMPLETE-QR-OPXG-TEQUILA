import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createArticle, defaultSettings, qrPayload, validateArticle, type Article, type LabelSettings } from './model';
import { buildWordDocument, qrDataUrl } from './exporter';

type ZipFile = { name: string; data: Buffer };

function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocd = buffer.lastIndexOf(eocdSignature);
  if (eocd < 0) throw new Error('ZIP end record not found');

  const entries = buffer.readUInt16LE(eocd + 10);
  let centralOffset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error('ZIP central directory entry not found');
    const compression = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString('utf8');

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('ZIP local file entry not found');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    const data = compression === 0 ? compressed : inflateRawSync(compressed);
    files.set(name, Buffer.from(data));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function documentFiles(blob: Blob): Promise<Map<string, Buffer>> {
  return unzip(Buffer.from(await blob.arrayBuffer()));
}

function article(index: number): Article {
  return createArticle({
    id: `article-${index}`,
    partNumber: `PART-${String(index).padStart(2, '0')}`,
    description: `Descripción del artículo ${index}`,
    location: `RACK-${index}`,
    quantity: 100 + index,
    po: `PO-${index}`,
    date: '2026-11-03',
    fifo: 900 + index,
  });
}

function settings(overrides: Partial<LabelSettings> = {}): LabelSettings {
  return { ...defaultSettings, ...overrides };
}

function xmlFrom(files: Map<string, Buffer>): string {
  const xml = files.get('word/document.xml');
  if (!xml) throw new Error('word/document.xml missing');
  return xml.toString('utf8');
}

function count(xml: string, expression: RegExp): number {
  return xml.match(expression)?.length ?? 0;
}

describe('exporter', () => {
  it('returns a PNG QR data URL whose payload follows qrPayload', async () => {
    const item = article(1);
    const dataUrl = await qrDataUrl(item, 'all');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const png = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(qrPayload(item, 'all')).toContain('"partNumber":"PART-01"');
    expect(qrPayload(item, 'all')).toContain('"fifo":901');
    expect(qrPayload(item, 'partLocation')).toContain('"quantity":101');
  });

  it('writes Letter geometry, eight fixed cells, and empty bordered cells', async () => {
    const files = await documentFiles(await buildWordDocument(Array.from({ length: 9 }, (_, index) => article(index)), settings()));
    const xml = xmlFrom(files);
    expect(xml).toContain('w:w="12240"');
    expect(xml).toContain('w:h="15840"');
    expect(count(xml, /<w:pgMar\b/g)).toBe(2);
    expect(xml).toMatch(/<w:pgMar[^>]*w:top="720"[^>]*w:right="720"[^>]*w:bottom="720"[^>]*w:left="720"/);
    expect(count(xml, /<w:tbl(?:\s|>)/g)).toBe(2);
    expect(count(xml, /<w:tr(?:\s|>)/g)).toBe(8);
    expect(count(xml, /<w:tc(?:\s|>)/g)).toBe(16);
    expect(count(xml, /<w:trHeight[^>]*w:hRule="exact"/g)).toBe(8);
    expect(count(xml, /<w:cantSplit\b/g)).toBe(8);
    expect(count(xml, /<w:tblLayout[^>]*w:type="fixed"/g)).toBe(2);
    expect(count(xml, /<w:tcBorders\b/g)).toBe(16);
  });

  it('writes A4 large pages and preserves all visible article data', async () => {
    const item = article(1);
    const files = await documentFiles(await buildWordDocument([item], settings({ format: 'large', paper: 'a4', fifoStart: 42 })));
    const xml = xmlFrom(files);
    expect(xml).toContain('w:w="11905"');
    expect(xml).toContain('w:h="16837"');
    expect(count(xml, /<w:tbl(?:\s|>)/g)).toBe(1);
    expect(count(xml, /<w:tr(?:\s|>)/g)).toBe(3);
    expect(count(xml, /<w:tc(?:\s|>)/g)).toBe(3);
    expect(xml).toContain('PART-01');
    expect(xml).toContain('Descripción del artículo 1');
    expect(xml).toContain('INV. ID: 42');
    expect(xml).toContain('LOCATION: RACK-1');
    expect(xml).toContain('2026-11-03');
    expect(xml).toContain('PO-1');
    expect(xml).toContain('QTY 101');
    expect(xml).toContain('FIFO 42');
    expect(xml.indexOf('PART-01')).toBeLessThan(xml.indexOf('<w:drawing>'));
    expect(xml.indexOf('LOCATION: RACK-1')).toBeLessThan(xml.indexOf('<w:drawing>'));
    expect(xml).toContain('w:line="226"');
  });

  it('numbers labels from fifoStart and embeds one PNG per article, not per quantity', async () => {
    const items = [article(1), article(2)];
    items[0].quantity = 1000000;
    items[1].quantity = 2;
    const files = await documentFiles(await buildWordDocument(items, settings({ fifoStart: 7 })));
    const xml = xmlFrom(files);
    const media = [...files.keys()].filter((name) => name.startsWith('word/media/') && name.endsWith('.png'));
    expect(media).toHaveLength(2);
    expect(xml).toContain('INV. ID: 7');
    expect(xml).toContain('INV. ID: 8');
    for (const name of media) expect(files.get(name)?.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it('omits inventory footer fields when showInventory is disabled', async () => {
    const files = await documentFiles(await buildWordDocument([article(1)], settings({ showInventory: false })));
    const xml = xmlFrom(files);
    expect(xml).not.toContain('INV. ID: 1');
    expect(xml).toContain('LOCATION: RACK-1');
    expect(xml).not.toContain('2026-11-03');
    expect(xml).not.toContain('PO-1');
    expect(xml).not.toContain('QTY 101');
  });

  it('rejects empty, invalid, and oversized batches before generating a document', async () => {
    await expect(buildWordDocument([], settings())).rejects.toThrow('No hay artículos');
    const invalid = article(1);
    invalid.description = '';
    await expect(buildWordDocument([invalid], settings())).rejects.toThrow('descripción');
    const tooMany = Array.from({ length: 1001 }, (_, index) => article(index));
    await expect(buildWordDocument(tooMany, settings())).rejects.toThrow('1000');
  });

  it('rejects impossible calendar dates before export', () => {
    const invalidDate = article(1);
    invalidDate.date = '2026-02-31';
    expect(validateArticle(invalidDate)).toContain('Fecha inválida');
  });
});
