import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

// Render the initial state without touching a browser or user inventory.
describe('inventario inicial', () => {
  it('inicia sin artículos ni controles de muestra y permite cargar Excel o capturar manualmente', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Tu inventario empieza aquí');
    expect(html).toContain('Cargar Excel');
    expect(html).toContain('Añadir artículo');
    expect(html).toContain('Plantilla Excel');
    expect(html).not.toContain('DEMO');
    expect(html).not.toContain('Restaurar muestra');
    expect(html).not.toContain('Estás viendo datos de ejemplo');
    expect(html).not.toContain('class="inventory-table table-row');
    expect(html).not.toContain('Eliminar fila');
  });
});
