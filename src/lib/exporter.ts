import QRCode from 'qrcode';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  LineRuleType,
  PageOrientation,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import {
  Article,
  LabelSettings,
  MAX_ARTICLES,
  downloadBlob,
  pageGeometry,
  qrPayload,
  today,
  validateArticle,
} from './model';

const MARGIN_MM = 12.7;
const TRAILING_PARAGRAPH_MM = 4;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' } as const;
const FONT = 'Arial';

type PageLayout = ReturnType<typeof pageGeometry> & {
  pageWidthTwips: number;
  pageHeightTwips: number;
  marginTwips: number;
  trailingParagraphTwips: number;
  tableWidthTwips: number;
  columnWidthsTwips: number[];
  rowHeightsTwips: number[];
};

function mmToPixels(mm: number): number {
  return Math.max(1, Math.round((mm / 25.4) * 96));
}

function safeText(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function truncate(value: unknown, maximum: number): string {
  const text = safeText(value);
  return text.length > maximum ? `${text.slice(0, Math.max(0, maximum - 1)).trimEnd()}…` : text;
}

function validateSettings(settings: LabelSettings): void {
  if (!settings || typeof settings !== 'object') throw new Error('Ajustes de etiquetas inválidos');
  if (settings.format !== 'small' && settings.format !== 'large') throw new Error('Formato de etiqueta inválido');
  if (settings.paper !== 'letter' && settings.paper !== 'a4') throw new Error('Papel inválido');
  if (!['partNumber', 'partLocation', 'all'].includes(settings.qrContent)) throw new Error('Contenido QR inválido');
}

function validateArticles(articles: Article[]): Article[] {
  if (!Array.isArray(articles)) throw new Error('Los artículos deben ser una lista');
  if (articles.length === 0) throw new Error('No hay artículos para exportar');
  if (articles.length > MAX_ARTICLES) throw new Error(`No se pueden exportar más de ${MAX_ARTICLES} artículos`);

  const errors: string[] = [];
  articles.forEach((article, index) => {
    try {
      const articleErrors = validateArticle(article);
      articleErrors.forEach((error) => errors.push(`Fila ${index + 1}: ${error}`));
    } catch {
      errors.push(`Fila ${index + 1}: datos de artículo inválidos`);
    }
  });
  if (errors.length) throw new Error(errors.join('; '));
  return articles;
}

function makePageLayout(settings: LabelSettings): PageLayout {
  const geometry = pageGeometry(settings);
  const pageWidthTwips = convertMillimetersToTwip(geometry.width);
  const pageHeightTwips = convertMillimetersToTwip(geometry.height);
  const marginTwips = convertMillimetersToTwip(MARGIN_MM);
  const trailingParagraphTwips = convertMillimetersToTwip(TRAILING_PARAGRAPH_MM);
  const tableWidthTwips = pageWidthTwips - marginTwips * 2;
  const tableHeightTwips = pageHeightTwips - marginTwips * 2 - trailingParagraphTwips;
  const baseColumnWidth = Math.floor(tableWidthTwips / geometry.columns);
  const extraColumns = tableWidthTwips - baseColumnWidth * geometry.columns;
  const columnWidthsTwips = Array.from({ length: geometry.columns }, (_, index) => baseColumnWidth + (index < extraColumns ? 1 : 0));
  const baseRowHeight = Math.floor(tableHeightTwips / geometry.rows);
  const extraRows = tableHeightTwips - baseRowHeight * geometry.rows;
  const rowHeightsTwips = Array.from({ length: geometry.rows }, (_, index) => baseRowHeight + (index < extraRows ? 1 : 0));

  return {
    ...geometry,
    pageWidthTwips,
    pageHeightTwips,
    marginTwips,
    trailingParagraphTwips,
    tableWidthTwips,
    columnWidthsTwips,
    rowHeightsTwips,
  };
}

function textSizeForPart(article: Article, settings: LabelSettings): number {
  const base = settings.format === 'small' ? 24 : 48;
  const minimum = settings.format === 'small' ? 15 : 26;
  const lengthPenalty = Math.max(0, article.partNumber.length - (settings.format === 'small' ? 18 : 22));
  return Math.max(minimum, Math.round(base - lengthPenalty * (settings.format === 'small' ? 0.5 : 0.75)));
}

function textSizeForDescription(article: Article, settings: LabelSettings): number {
  const base = settings.format === 'small' ? 20 : 22;
  const minimum = settings.format === 'small' ? 14 : 15;
  const lengthPenalty = Math.max(0, article.description.length - 65);
  return Math.max(minimum, Math.round(base - lengthPenalty * 0.05));
}

function paragraphSpacing(after = 0, line?: number) {
  return line === undefined
    ? { before: 0, after }
    : { before: 0, after, line, lineRule: LineRuleType.AT_LEAST };
}

function labelParagraph(
  text: string,
  options: { size: number; bold?: boolean; color?: string; after?: number; line?: number },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: paragraphSpacing(options.after, options.line),
    children: [
      new TextRun({
        text,
        bold: options.bold,
        color: options.color,
        font: FONT,
        size: options.size,
      }),
    ],
  });
}

function imageParagraph(article: Article, qr: string, settings: LabelSettings): Paragraph {
  const sizeMm = settings.format === 'small' ? 22 : 25;
  const px = mmToPixels(sizeMm);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: paragraphSpacing(20),
    children: [
      new ImageRun({
        type: 'png',
        data: qr,
        transformation: { width: px, height: px },
        altText: { title: `Código QR ${article.partNumber}`, description: qrPayload(article, settings.qrContent) },
      }),
    ],
  });
}

function inventoryParagraph(article: Article, settings: LabelSettings): Paragraph[] {
  const part = truncate(article.partNumber, 80);
  const description = truncate(article.description, 180);
  const location = truncate(article.location, 40);
  const isLarge = settings.format === 'large';
  const descriptionSize = textSizeForDescription(article, settings);
  const locationSize = isLarge ? 28 : 22;
  const paragraphs: Paragraph[] = [
    labelParagraph(part, {
      size: textSizeForPart(article, settings),
      bold: true,
      after: isLarge ? 50 : 25,
    }),
    labelParagraph(description, {
      size: descriptionSize,
      after: isLarge ? 45 : 25,
      line: isLarge ? 250 : 220,
    }),
  ];

  paragraphs.push(labelParagraph(location, {
    size: locationSize,
    bold: true,
    color: '1F2937',
    after: settings.showDate ? (isLarge ? 38 : 24) : 0,
    line: isLarge ? 260 : 230,
  }));

  if (settings.showDate) {
    paragraphs.push(labelParagraph(article.date, {
      size: isLarge ? 18 : 15,
      after: 0,
      line: isLarge ? 220 : 190,
    }));
  }

  return paragraphs;
}

function makeEmptyCell(widthTwips: number): TableCell {
  return new TableCell({
    width: { size: widthTwips, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    children: [new Paragraph({ spacing: { before: 0, after: 0 } })],
  });
}

function makeLabelCell(article: Article, qr: string, settings: LabelSettings, widthTwips: number): TableCell {
  return new TableCell({
    width: { size: widthTwips, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    children: [...inventoryParagraph(article, settings), imageParagraph(article, qr, settings)],
  });
}

function makePageTable(
  articles: readonly (Article | undefined)[],
  qrs: readonly (string | undefined)[],
  settings: LabelSettings,
  layout: PageLayout,
): Table {
  const rows: TableRow[] = [];
  for (let rowIndex = 0; rowIndex < layout.rows; rowIndex += 1) {
    const cells: TableCell[] = [];
    for (let columnIndex = 0; columnIndex < layout.columns; columnIndex += 1) {
      const index = rowIndex * layout.columns + columnIndex;
      const article = articles[index];
      const qr = qrs[index];
      const columnWidth = layout.columnWidthsTwips[columnIndex];
      cells.push(article && qr ? makeLabelCell(article, qr, settings, columnWidth) : makeEmptyCell(columnWidth));
    }
    rows.push(new TableRow({
      children: cells,
      cantSplit: true,
      height: { value: layout.rowHeightsTwips[rowIndex], rule: HeightRule.EXACT },
    }));
  }

  return new Table({
    rows,
    width: { size: layout.tableWidthTwips, type: WidthType.DXA },
    columnWidths: layout.columnWidthsTwips,
    layout: TableLayoutType.FIXED,
    borders: {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
      insideHorizontal: BORDER,
      insideVertical: BORDER,
    },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    cellSpacing: { value: 0, type: WidthType.DXA },
  });
}

function trailingParagraph(layout: PageLayout): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: layout.trailingParagraphTwips, lineRule: LineRuleType.EXACT },
    children: [new TextRun({ text: '\u00a0', size: 2, vanish: true, font: FONT })],
  });
}

export async function qrDataUrl(article: Article, mode: LabelSettings['qrContent'], width = 512): Promise<string> {
  return QRCode.toDataURL(qrPayload(article, mode), {
    type: 'image/png',
    errorCorrectionLevel: 'H',
    margin: 4,
    width,
  });
}

export async function buildWordDocument(articles: Article[], settings: LabelSettings): Promise<Blob> {
  validateSettings(settings);
  const validated = validateArticles(articles);
  const layout = makePageLayout(settings);
  const qrs: string[] = [];
  for (const article of validated) qrs.push(await qrDataUrl(article, settings.qrContent));

  const sections = [];
  for (let pageStart = 0; pageStart < validated.length; pageStart += layout.perPage) {
    const pageArticles = validated.slice(pageStart, pageStart + layout.perPage);
    const pageQrs = qrs.slice(pageStart, pageStart + layout.perPage);
    while (pageArticles.length < layout.perPage) pageArticles.push(undefined as never);
    while (pageQrs.length < layout.perPage) pageQrs.push(undefined as never);
    sections.push({
      properties: {
        type: pageStart === 0 ? undefined : SectionType.NEXT_PAGE,
        page: {
          size: { width: layout.pageWidthTwips, height: layout.pageHeightTwips, orientation: PageOrientation.PORTRAIT },
          margin: { top: layout.marginTwips, right: layout.marginTwips, bottom: layout.marginTwips, left: layout.marginTwips },
        },
      },
      children: [makePageTable(pageArticles, pageQrs, settings, layout), trailingParagraph(layout)],
    });
  }

  const document = new Document({
    creator: 'QR Studio PXG',
    title: `Etiquetas PXG ${settings.format}`,
    subject: 'Etiquetas QR de inventario',
    sections,
  });
  return Packer.toBlob(document);
}

export async function exportWord(articles: Article[], settings: LabelSettings): Promise<void> {
  const blob = await buildWordDocument(articles, settings);
  const size = settings.format === 'small' ? 'chicas' : 'grandes';
  downloadBlob(blob, `etiquetas-pxg-${size}-${today()}.docx`);
}
