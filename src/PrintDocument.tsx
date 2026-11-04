import type { Article, LabelSettings } from './lib/model';

export interface PrintJob {
  articles: Article[];
  settings: LabelSettings;
  codes: Record<string, string>;
}

export default function PrintDocument({ job }: { job: PrintJob }) {
  const perPage = job.settings.format === 'small' ? 8 : 3;
  const pageCount = Math.ceil(job.articles.length / perPage);

  return (
    <div id="print-root" className="print-root" aria-hidden="true">
      {Array.from({ length: pageCount }, (_, pageIndex) => (
        <section
          className={`print-sheet print-sheet-${job.settings.paper}`}
          key={`${job.settings.paper}-${job.settings.format}-${pageIndex}`}
        >
          <div className={`print-grid print-grid-${job.settings.format}`}>
            {Array.from({ length: perPage }, (_, cellIndex) => {
              const article = job.articles[pageIndex * perPage + cellIndex];
              const formatClass = `print-cell-${job.settings.format}`;
              if (!article) {
                return <article className={`print-cell ${formatClass} print-cell-empty`} key={`empty-${pageIndex}-${cellIndex}`} />;
              }

              return (
                <article className={`print-cell ${formatClass}`} key={`${pageIndex}-${article.id}`}>
                  <strong className="print-cell-part">{article.partNumber}</strong>
                  <span className="print-cell-description">{article.description}</span>
                  <span className="print-cell-location">{article.location}</span>
                  {job.settings.showDate && <span className="print-cell-date">{article.date}</span>}
                  <img className="print-cell-qr" src={job.codes[article.id]} alt={`Código QR de ${article.partNumber}`} />
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
