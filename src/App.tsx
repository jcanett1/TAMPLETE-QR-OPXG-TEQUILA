import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, FileSpreadsheet, FileText, Layers3, PackagePlus, RotateCcw, Settings2, Sparkles, Tag, Upload, X } from 'lucide-react';
import type { Article, LabelSettings } from './lib/model';
import { createArticle, defaultSettings, demoArticles, MAX_ARTICLES, validateArticle } from './lib/model';
import type { ColumnMapping, ImportData } from './lib/importer';
import './App.css';

const columns: { key: keyof Article; title: string; width: string }[] = [
  { key: 'partNumber', title: 'NÚMERO DE PARTE', width: '185px' },
  { key: 'description', title: 'DESCRIPCIÓN', width: '1fr' }, { key: 'location', title: 'LOCACIÓN', width: '100px' },
  { key: 'date', title: 'FECHA', width: '130px' },
];
const freshSettings = (): LabelSettings => ({ ...defaultSettings });

export default function App() {
  const [articles, setArticles] = useState<Article[]>(() => demoArticles.map(a => ({ ...a })));
  const [settings, setSettings] = useState<LabelSettings>(freshSettings);
  const [isDemo, setIsDemo] = useState(true);
  const [mappingData, setMappingData] = useState<ImportData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<'articles' | 'format' | 'output'>('articles');
  const fileRef = useRef<HTMLInputElement>(null);
  const validCount = useMemo(() => articles.filter(a => validateArticle(a).length === 0).length, [articles]);
  const progress = articles.length ? Math.round(validCount / articles.length * 100) : 0;
  const perPage = settings.format === 'small' ? 8 : 3;
  const pageCount = Math.max(1, Math.ceil(articles.length / perPage));
  const [previewPage, setPreviewPage] = useState(0);
  const visiblePage = Math.min(previewPage, pageCount - 1);
  const pageFrom = articles.length ? visiblePage * perPage + 1 : 0;
  const pageTo = Math.min(articles.length, (visiblePage + 1) * perPage);
  const previewArticles = useMemo(() => articles.slice(visiblePage * perPage, (visiblePage + 1) * perPage), [articles, visiblePage, perPage]);
  const [previewCodes, setPreviewCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (active !== 'output') return;
    let activeEffect = true;
    void import('./lib/exporter')
      .then(({ qrDataUrl }) => Promise.all(previewArticles.map(async article => [article.id, await qrDataUrl(article, settings.qrContent)] as const)))
      .then(entries => { if (activeEffect) setPreviewCodes(Object.fromEntries(entries)); })
      .catch(() => { if (activeEffect) setPreviewCodes({}); });
    return () => { activeEffect = false; };
  }, [active, previewArticles, settings.qrContent]);

  const updateArticle = (id: string, field: keyof Article, value: string) => {
    setArticles(old => old.map(row => row.id !== id ? row : ({ ...row, [field]: value })));
    setIsDemo(false);
  };
  const addRow = () => { if (articles.length >= MAX_ARTICLES) { setNotice(`Máximo ${MAX_ARTICLES.toLocaleString('es-MX')} artículos por lote.`); return; } setArticles(old => [...old, createArticle()]); setIsDemo(false); setActive('articles'); };
  const resetDemo = () => { setArticles(demoArticles.map(a => ({ ...a }))); setIsDemo(true); setNotice('Muestra DEMO restaurada.'); };
  const loadFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setNotice('');
    try {
      const importer = await import('./lib/importer');
      const data = await importer.readInventoryFile(file);
      const suggested = importer.suggestMapping(data.headers);
      setMappingData(data); setMapping(suggested);
      setNotice(`${data.rows.length} filas encontradas${data.sheetName ? ` · Hoja: ${data.sheetName}` : ''}. Confirma el mapeo para continuar.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo leer el archivo.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const applyImport = async () => {
    if (!mappingData || !mapping) return;
    if (!mapping.partNumber || !mapping.description || !mapping.location) { setNotice('Asigna número de parte, descripción y locación antes de importar.'); return; }
    try {
      const importer = await import('./lib/importer');
      const imported = importer.mapImportRows(mappingData, mapping);
      setArticles(imported); setIsDemo(false); setMappingData(null); setMapping(null);
      setNotice(`${imported.length} artículos importados correctamente.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudieron convertir las filas.'); }
  };
  const downloadTemplate = async () => {
    setBusy(true);
    try { const { downloadExcelTemplate } = await import('./lib/importer'); await downloadExcelTemplate(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo descargar la plantilla.'); }
    finally { setBusy(false); }
  };
  const changeSetting = <K extends keyof LabelSettings>(key: K, value: LabelSettings[K]) => {
    setSettings(old => ({ ...old, [key]: value }));
  };
  const generate = async () => {
    const bad = articles.filter(a => validateArticle(a).length);
    if (!articles.length) { setNotice('Añade o importa artículos para crear las etiquetas.'); return; }
    if (bad.length) { setNotice(`${bad.length} fila(s) tienen campos inválidos. Revisa los marcadores rojos antes de exportar.`); setActive('articles'); return; }
    setBusy(true);
    try { const { exportWord } = await import('./lib/exporter'); await exportWord(articles, settings); setNotice('Documento de etiquetas listo.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo generar el documento.'); }
    finally { setBusy(false); }
  };
  const mappingFields: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
    { key: 'partNumber', label: 'Número de parte', required: true }, { key: 'description', label: 'Descripción', required: true },
    { key: 'location', label: 'Locación', required: true }, { key: 'date', label: 'Fecha', required: false },
  ];
  const selectClass = 'field-select';

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="QR Studio PXG Tequila"><span className="brand-mark"><span /><span /><span /><span /></span><span className="brand-copy"><strong>QR <b>STUDIO</b></strong><small>PXG · TEQUILA</small></span></a>
      <div className="topbar-right"><span className="live-dot" /> INVENTARIO · ETIQUETADO <span className="topbar-divider" /> <span className="topbar-muted">OPERACIONES</span></div>
    </header>
    <main className="workspace">
      <section className="intro"><div><div className="eyebrow"><span className="eyebrow-line" /> HERRAMIENTA DE ALMACÉN <span className="eyebrow-line" /></div><h1>Etiquetas que <em>mueven</em><br className="title-break" /> el inventario.</h1><p>Prepara tus artículos, define el formato y genera etiquetas QR listas para imprimir.</p></div>
        <div className="progress-card"><div className="progress-head"><span>PREPARACIÓN</span><strong>{progress}<small>%</small></strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="progress-foot"><span>{validCount} de {articles.length} artículos válidos</span><span className="status-mark"><Check size={13} /> EN CURSO</span></div></div>
      </section>
      <nav className="step-nav" aria-label="Flujo de trabajo">
        {[['articles', '01', 'Artículos', ClipboardList], ['format', '02', 'Formato', Settings2], ['output', '03', 'Salida', ArrowDownToLine]].map(([key, n, label, Icon]: any) => <button key={key} className={`step-tab ${active === key ? 'selected' : ''} ${active !== key && (key === 'format' && articles.length || key === 'output' && validCount) ? 'available' : ''}`} onClick={() => setActive(key)}><span className="step-num">{n}</span><Icon size={16} /><span>{label}</span>{active === key && <span className="tab-indicator" />}</button>)}
        <div className="nav-count"><Layers3 size={15} /> <strong>{articles.length}</strong> <span>registros</span></div>
      </nav>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={15} /></button></div>}

      {active === 'articles' && <section className="panel">
        <div className="panel-heading"><div><div className="section-kicker">01 / INVENTARIO</div><h2>Artículos <span className="heading-count">{articles.length.toString().padStart(2, '0')}</span>{isDemo && <span className="demo-pill"><Sparkles size={11} /> DEMO</span>}</h2><p>Importa Excel (.xlsx) o CSV; también puedes capturar las filas manualmente.</p></div><div className="actions"><input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv" hidden onChange={e => void loadFile(e.target.files?.[0])} /><button className="button button-outline" onClick={() => void downloadTemplate()}><FileSpreadsheet size={15} /> Plantilla Excel <ArrowDownToLine size={14} /></button><button className="button button-primary" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} /> {busy ? 'Leyendo…' : 'Cargar Excel'}</button></div></div>
        {isDemo && <div className="demo-banner"><span className="demo-icon"><Sparkles size={16} /></span><div><strong>Estás viendo datos de ejemplo</strong><p>Revisa el flujo con 8 artículos ficticios. Carga tu Excel o descarga la plantilla para empezar con tu inventario.</p></div><button onClick={resetDemo}><RotateCcw size={14} /> Restaurar muestra</button></div>}
        <div className="table-wrap"><div className="table-scroll"><div className="inventory-table table-head" style={{ gridTemplateColumns: `42px ${columns.map(c => c.width).join(' ')} 36px` }}><span className="row-index">#</span>{columns.map(c => <span key={c.key}>{c.title}</span>)}<span /></div>
          {articles.map((article, index) => { const errors = validateArticle(article); return <div className={`inventory-table table-row ${errors.length ? 'row-invalid' : ''}`} key={article.id} style={{ gridTemplateColumns: `42px ${columns.map(c => c.width).join(' ')} 36px` }}><span className="row-index">{String(index + 1).padStart(2, '0')}</span>{columns.map(c => <label key={c.key} className={`cell-input ${errors.some(e => (c.key === 'partNumber' && e.includes('parte')) || (c.key === 'description' && e.includes('Descripción')) || (c.key === 'location' && e.includes('locación')) || (c.key === 'date' && e.includes('Fecha'))) ? 'cell-error' : ''}`}><span className="sr-only">{c.title}</span><input aria-label={`${c.title}, fila ${index + 1}`} title={errors.join(' · ')} type={c.key === 'date' ? 'date' : 'text'} value={String(article[c.key])} onChange={e => updateArticle(article.id, c.key, e.target.value)} /></label>)}<button className="remove-row" aria-label={`Eliminar fila ${index + 1}`} onClick={() => { setArticles(old => old.filter(a => a.id !== article.id)); setIsDemo(false); }}><X size={15} /></button></div>; })}
          {!articles.length && <div className="empty-state"><PackagePlus size={25} /><strong>Tu inventario empieza aquí</strong><span>Carga una hoja Excel o añade una fila manualmente.</span></div>}
        </div></div>
        <div className="table-footer"><button className="add-row" onClick={addRow}><PackagePlus size={15} /> Añadir artículo</button><span><span className="validation-dot" /> {validCount === articles.length && articles.length ? 'Todos los artículos están listos' : `${articles.length - validCount} por revisar`} <span className="footer-divider">·</span> Los cambios se guardan en esta sesión</span></div>
      </section>}

      {active === 'format' && <section className="panel"><div className="panel-heading"><div><div className="section-kicker">02 / PERSONALIZACIÓN</div><h2>Formato <span className="heading-count">02</span></h2><p>Define la etiqueta, papel y datos que llevará el código QR.</p></div><span className="heading-icon"><Settings2 size={19} /></span></div>
        <div className="settings-grid"><div className="setting-block"><div className="setting-label"><span>01</span><div><strong>Tamaño de etiqueta</strong><small>Elige la densidad de impresión</small></div></div><div className="choice-grid"><button className={`choice-card ${settings.format === 'small' ? 'choice-active' : ''}`} onClick={() => changeSetting('format', 'small')}><div className="label-preview small-preview"><i /><i /><i /><i /><i /><i /><i /><i /></div><strong>Compacta</strong><small>8 por página</small>{settings.format === 'small' && <Check className="choice-check" size={16} />}</button><button className={`choice-card ${settings.format === 'large' ? 'choice-active' : ''}`} onClick={() => changeSetting('format', 'large')}><div className="label-preview large-preview"><i /><i /><i /></div><strong>Ampliada</strong><small>3 por página</small>{settings.format === 'large' && <Check className="choice-check" size={16} />}</button></div></div>
          <div className="setting-block"><div className="setting-label"><span>02</span><div><strong>Tipo de papel</strong><small>Formato de página del documento</small></div></div><div className="segmented"><button className={settings.paper === 'letter' ? 'segment-active' : ''} onClick={() => changeSetting('paper', 'letter')}>Carta <small>8.5 × 11″</small></button><button className={settings.paper === 'a4' ? 'segment-active' : ''} onClick={() => changeSetting('paper', 'a4')}>A4 <small>210 × 297 mm</small></button></div></div>
          <div className="setting-block setting-wide"><div className="setting-label"><span>03</span><div><strong>Contenido del código QR</strong><small>El número de parte siempre va incluido.</small></div></div><div className="qr-options">{([['partNumber', 'Número de parte', 'Información mínima para lectura rápida'], ['all', 'Registro completo', 'Parte, descripción, locación y fecha']] as const).map(([value, title, desc]) => <button key={value} className={`qr-option ${settings.qrContent === value ? 'qr-option-active' : ''}`} onClick={() => changeSetting('qrContent', value)}><span className="radio-dot" /><span><strong>{title}</strong><small>{desc}</small></span>{settings.qrContent === value && <Check size={16} />}</button>)}</div></div>
          <div className="setting-block"><div className="setting-label"><span>04</span><div><strong>Detalles impresos</strong><small>Información visible en la etiqueta</small></div></div><div className="inventory-detail-note"><Check size={14} /><span>Se imprimirán número de parte, descripción, locación y fecha en cada etiqueta.</span></div></div>
        </div><div className="panel-bottom"><span><AlertCircle size={15} /> Los ajustes se aplican a todas las etiquetas.</span><button className="button button-primary" onClick={() => setActive('output')}>Continuar a salida <ArrowRight size={15} /></button></div>
      </section>}

      {active === 'output' && <section className="panel"><div className="panel-heading"><div><div className="section-kicker">03 / GENERACIÓN</div><h2>Salida <span className="heading-count">03</span></h2><p>Revisa las hojas y genera tu documento listo para imprimir.</p></div><span className="heading-icon"><FileText size={19} /></span></div>
        <div className="sheet-preview-block"><div className="sheet-preview-heading"><div><span className="section-kicker">VISTA PREVIA DE IMPRESIÓN</span><strong>Hoja {visiblePage + 1} <span>·</span> {articles.length ? `etiquetas ${pageFrom}–${pageTo} de ${articles.length}` : 'sin artículos'}</strong></div><div className="preview-heading-tools"><span className="paper-chip">{settings.paper === 'letter' ? 'CARTA · 8.5 × 11″' : 'A4 · 210 × 297 MM'}</span><div className="preview-controls"><button className="preview-page-button" disabled={visiblePage === 0} aria-label="Página anterior" onClick={() => setPreviewPage(page => Math.max(0, page - 1))}><ChevronLeft size={13} />Anterior</button><span>{visiblePage + 1} / {pageCount}</span><button className="preview-page-button" disabled={visiblePage >= pageCount - 1} aria-label="Página siguiente" onClick={() => setPreviewPage(page => Math.min(pageCount - 1, page + 1))}>Siguiente<ChevronRight size={13} /></button></div></div></div>
          <div className={`sheet-preview ${settings.format === 'small' ? 'preview-small' : 'preview-large'}`}>
            {Array.from({ length: perPage }, (_, i) => { const article = previewArticles[i]; return article ? <article className={`print-label ${settings.format === 'small' ? 'print-label-small' : 'print-label-large'}`} key={article.id}>
              <strong className="print-part">{article.partNumber || 'NÚMERO DE PARTE'}</strong><span className="print-description">{article.description || 'Descripción del artículo'}</span><span className="print-location">{article.location || 'Locación'}</span>
              {settings.showDate && <span className="print-date">{article.date || '—'}</span>}
              {previewCodes[article.id] ? <img className="print-qr" src={previewCodes[article.id]} alt={`QR ${article.partNumber}`} /> : <span className="print-qr-placeholder" />}
            </article> : <article className="print-label print-label-empty" key={`empty-${i}`}><span /></article>; })}
          </div>
        </div>
        <div className="output-summary"><div className="summary-title"><span className="summary-icon"><Tag size={18} /></span><div><strong>Resumen de etiquetas</strong><small>PXG · TEQUILA / INVENTARIO</small></div><span className="summary-ready"><Check size={13} /> {validCount === articles.length && articles.length ? 'LISTO' : 'REVISAR'}</span></div><div className="summary-stats"><div><small>ARTÍCULOS</small><strong>{articles.length}</strong><span>registros en el lote</span></div><div><small>ETIQUETAS</small><strong>{validCount}</strong><span>válidas para imprimir</span></div><div><small>FORMATO</small><strong>{settings.format === 'small' ? 'Compacta' : 'Ampliada'}</strong><span>{settings.paper === 'letter' ? 'Papel Carta' : 'Papel A4'}</span></div><div><small>PÁGINAS EST.</small><strong>{Math.ceil(validCount / perPage)}</strong><span>aproximadas</span></div></div></div><div className="output-note"><span className="note-check"><Check size={14} /></span><p>Se generará un documento Word <strong>.docx</strong> con un código QR por artículo y distribución en hoja {settings.paper === 'letter' ? 'Carta' : 'A4'}.</p></div><div className="output-actions"><button className="button button-outline" onClick={() => setActive('articles')}>Volver a artículos</button><button className="button button-primary button-generate" onClick={() => void generate()} disabled={busy || !articles.length || validCount !== articles.length}><FileText size={16} /> {busy ? 'Generando documento…' : 'Generar etiquetas Word'} <ArrowRight size={15} /></button></div><div className="output-help"><FileSpreadsheet size={15} /> ¿Aún no tienes inventario? <button onClick={() => void downloadTemplate()}>Descarga la plantilla Excel <ArrowRight size={13} /></button></div></section>}
      <footer className="footer"><span>QR STUDIO <b>·</b> PXG TEQUILA</span><span>HERRAMIENTA INTERNA DE OPERACIONES</span></footer>
    </main>
    {mappingData && mapping && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { setMappingData(null); setMapping(null); } }}><section className="mapping-modal" role="dialog" aria-modal="true" aria-labelledby="mapping-title"><div className="modal-top"><div><span className="modal-kicker"><FileSpreadsheet size={14} /> IMPORTACIÓN DE INVENTARIO</span><h2 id="mapping-title">Vincula tus columnas</h2><p>Indica qué columna contiene cada dato. Los campos requeridos llevan <b>*</b>.</p></div><button className="modal-close" aria-label="Cerrar" onClick={() => { setMappingData(null); setMapping(null); }}><X size={18} /></button></div><div className="file-summary"><span className="file-icon"><FileSpreadsheet size={17} /></span><div><strong>{mappingData.sheetName || 'Archivo de inventario'}</strong><small>{mappingData.rows.length} filas · {mappingData.headers.length} columnas</small></div><Check size={16} /></div><div className="mapping-fields">{mappingFields.map(f => <label className="mapping-field" key={f.key}><span>{f.label}{f.required && <b> *</b>}</span><span className="select-wrap"><select className={selectClass} value={mapping[f.key]} onChange={e => setMapping(old => old ? { ...old, [f.key]: e.target.value } : old)}><option value="">{f.required ? 'Selecciona columna…' : 'No asignar'}</option>{mappingData.headers.map((header, i) => <option key={`${i}-${header}`} value={header}>{header}</option>)}</select><ChevronDown size={14} /></span></label>)}</div><div className="mapping-hint"><AlertCircle size={15} /> Los campos opcionales se dejarán vacíos o tomarán su valor predeterminado.</div><div className="modal-actions"><button className="button button-outline" onClick={() => { setMappingData(null); setMapping(null); }}>Cancelar</button><button className="button button-primary" onClick={() => void applyImport()}><Check size={15} /> Importar {mappingData.rows.length} filas</button></div></section></div>}
  </div>;
}
