import { describe, expect, it } from 'vitest';
import { createArticle, defaultSettings, MAX_ARTICLES } from './model';
import { loadWorkspaceFrom, parseSavedWorkspace, saveWorkspaceTo, WORKSPACE_STORAGE_KEY } from './persistence';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
    values,
  };
}

describe('persistencia local', () => {
  it('restaura artículos y formato tras simular una recarga del navegador', () => {
    const article = createArticle({
      id: 'local-1',
      partNumber: 'PART-123',
      description: 'Artículo de prueba',
      location: 'E-28',
      date: '2026-11-03',
    });
    const workspace = {
      articles: [article],
      settings: { ...defaultSettings, format: 'large' as const, paper: 'a4' as const, qrContent: 'all' as const, showDate: false },
    };
    const { storage, values } = memoryStorage();

    expect(saveWorkspaceTo(storage, workspace)).toBe(true);
    expect(values.has(WORKSPACE_STORAGE_KEY)).toBe(true);
    expect(loadWorkspaceFrom(storage)).toEqual(workspace);
  });

  it('eliminar la carga persiste inventario vacío y conserva los ajustes', () => {
    const workspace = {
      articles: [createArticle({ id: 'local-1', partNumber: 'PART-123', description: 'Desc', location: 'E-28' })],
      settings: { ...defaultSettings, format: 'large' as const },
    };
    const { storage } = memoryStorage();
    expect(saveWorkspaceTo(storage, workspace)).toBe(true);

    const cleared = { articles: [], settings: workspace.settings };
    expect(saveWorkspaceTo(storage, cleared)).toBe(true);
    expect(loadWorkspaceFrom(storage)).toEqual(cleared);
  });

  it('usa inventario vacío si el contenido local está corrupto o tiene una versión desconocida', () => {
    expect(parseSavedWorkspace('{datos incompletos')).toEqual({ articles: [], settings: defaultSettings });
    expect(parseSavedWorkspace(JSON.stringify({ version: 2, articles: [{ id: 'old' }], settings: {} })))
      .toEqual({ articles: [], settings: defaultSettings });
  });

  it('restaura borradores editables, descarta formas inválidas y limita filas al máximo', () => {
    const raw = JSON.stringify({
      version: 1,
      articles: [
        { id: 'draft', partNumber: '', description: '', location: '', date: '' },
        { id: 4, partNumber: 'malformed', description: '', location: '', date: '' },
        ...Array.from({ length: MAX_ARTICLES + 2 }, (_, index) => ({
          id: `row-${index}`, partNumber: `PN-${index}`, description: 'Desc', location: 'LOC', date: '2026-11-03',
        })),
      ],
      settings: {},
    });

    const restored = parseSavedWorkspace(raw);
    expect(restored.articles[0]).toEqual({ id: 'draft', partNumber: '', description: '', location: '', date: '' });
    expect(restored.articles).toHaveLength(MAX_ARTICLES);
  });
});
