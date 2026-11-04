import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createArticle, defaultSettings, qrPayload, validateArticle, type Article, type LabelSettings } from './model';
import { buildWordDocument, qrDataUrl } from './exporter';

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
    date: '2026-11-03',
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

function expectNoRemovedFields(xml: string): void {
  expect(xml).not.toMatch(/FIFO|INV\. ID|QTY|PO-LEGACY|quantity|fifo|&quot;po&quot;/);
}

describe('exporter', () => {
  it('returns a PNG QR data URL whose payload follows the simplified model', async () => {
    const item = article(1);
    const dataUrl = await qrDataUrl(item, 'all');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const png = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(511);
    const printDataUrl = await qrDataUrl(item, 'all', 256);
    const printPng = Buffer.from(printDataUrl.slice('data:image/png;base64,'.length), 'base64');
    expect(printPng.readUInt32BE(16)).toBe(255);
    expect(qrPayload(item, 'partNumber')).toBe('PART-01\nRACK-1');
    expect(qrPayload(item, 'partLocation')).toBe('PART-01\nRACK-1');
    expect(qrPayload(item, 'all')).toBe('PART-01\nDescripción del artículo 1\nRACK-1\n2026-11-03');
    for (const mode of ['partNumber', 'partLocation', 'all'] as const) {
      const payload = qrPayload(item, mode);
      expect(payload).toContain('PART-01');
      expect(payload).toContain('RACK-1');
      expect(payload).not.toContain('partNumber');
      expect(payload.includes('{')).toBe(false);
      expect(payload.includes('}')).toBe(false);
      expect(payload.includes('"')).toBe(false);
    }
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
    expect(xml).not.toMatch(/<w:fitText\b/);
    expectNoRemovedFields(xml);
  });

  it('keeps long label text intact and lets Word wrap naturally instead of spacing characters', async () => {
    const longItem = createArticle({
      ...article(2),
      partNumber: 'A-SHAFT-ADAPTER-DRIVER-HYBRID-2026',
      description: 'Driver Shaft Adapter for Hybrid Right Hand Replacement Components',
      location: 'E-28-RACK-12-BIN-04',
    });
    const xml = xmlFrom(await documentFiles(await buildWordDocument([longItem], settings())));
    expect(xml).toContain(longItem.partNumber);
    expect(xml).toContain(longItem.description);
    expect(xml).toContain(longItem.location);
    expect(xml).not.toContain('LOCATION:');
    expect(xml).not.toMatch(/<w:fitText\b/);
    expect(xml).not.toMatch(/<w:noWrap\b/);
  });

  it('writes A4 large pages and preserves the remaining visible article data', async () => {
    const files = await documentFiles(await buildWordDocument([article(1)], settings({ format: 'large', paper: 'a4' })));
    const xml = xmlFrom(files);
    expect(xml).toContain('w:w="11905"');
    expect(xml).toContain('w:h="16837"');
    expect(count(xml, /<w:tbl(?:\s|>)/g)).toBe(1);
    expect(count(xml, /<w:tr(?:\s|>)/g)).toBe(3);
    expect(count(xml, /<w:tc(?:\s|>)/g)).toBe(3);
    expect(xml).toContain('PART-01');
    expect(xml).toContain('Descripción del artículo 1');
    expect(xml).toContain('RACK-1');
    expect(xml).not.toContain('LOCATION:');
    expect(xml).toContain('2026-11-03');
    expect(xml.indexOf('PART-01')).toBeLessThan(xml.indexOf('<w:drawing>'));
    expect(xml.indexOf('RACK-1')).toBeLessThan(xml.indexOf('<w:drawing>'));
    expectNoRemovedFields(xml);
  });

  it('embeds one PNG per article and no inventory sequence', async () => {
    const files = await documentFiles(await buildWordDocument([article(1), article(2)], settings()));
    const xml = xmlFrom(files);
    const media = [...files.keys()].filter((name) => name.startsWith('word/media/') && name.endsWith('.png'));
    expect(media).toHaveLength(2);
    expectNoRemovedFields(xml);
    for (const name of media) expect(files.get(name)?.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it('omits the printed date when showDate is disabled', async () => {
    const xml = xmlFrom(await documentFiles(await buildWordDocument([article(1)], settings({ showDate: false }))));
    expect(xml).toContain('RACK-1');
    expect(xml).not.toContain('LOCATION:');
    expect(xml).not.toContain('2026-11-03');
    expectNoRemovedFields(xml);
  });

  it('does not encode or print removed fields from legacy objects in any QR mode or format', async () => {
    const legacy = { ...article(1), quantity: 999, po: 'PO-LEGACY', fifo: 888 };
    expect(createArticle(legacy)).toEqual(article(1));
    for (const mode of ['partNumber', 'partLocation', 'all'] as const) {
      const payload = qrPayload(legacy, mode);
      expect(payload).toContain('PART-01');
      expect(payload).toContain('RACK-1');
      expect(payload).not.toContain('partNumber');
      expect(payload).not.toContain('999');
      expect(payload).not.toContain('PO-LEGACY');
      expect(payload).not.toContain('888');
      expect(payload.includes('{')).toBe(false);
      expect(payload.includes('}')).toBe(false);
      expect(payload.includes('"')).toBe(false);
      for (const format of ['small', 'large'] as const) {
        const xml = xmlFrom(await documentFiles(await buildWordDocument([legacy], settings({ qrContent: mode, format }))));
        expectNoRemovedFields(xml);
      }
    }
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
