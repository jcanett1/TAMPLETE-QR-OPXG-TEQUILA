import { defaultSettings, MAX_ARTICLES, type Article, type LabelSettings } from './model';

export const WORKSPACE_STORAGE_KEY = 'qr-pxg-tequila:workspace:v1';

export interface SavedWorkspace {
  articles: Article[];
  settings: LabelSettings;
}

export interface WorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function emptyWorkspace(): SavedWorkspace {
  return { articles: [], settings: { ...defaultSettings } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArticle(value: unknown): value is Article {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.partNumber === 'string'
    && typeof value.description === 'string'
    && typeof value.location === 'string'
    && typeof value.date === 'string';
}

function restoreSettings(value: unknown): LabelSettings {
  if (!isRecord(value)) return { ...defaultSettings };
  const qrContent = value.qrContent === 'partNumber' || value.qrContent === 'partLocation' || value.qrContent === 'all'
    ? value.qrContent
    : defaultSettings.qrContent;
  return {
    format: value.format === 'large' || value.format === 'small' ? value.format : defaultSettings.format,
    paper: value.paper === 'a4' || value.paper === 'letter' ? value.paper : defaultSettings.paper,
    qrContent,
    showDate: typeof value.showDate === 'boolean' ? value.showDate : defaultSettings.showDate,
  };
}

export function parseSavedWorkspace(raw: string | null): SavedWorkspace {
  if (!raw) return emptyWorkspace();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return emptyWorkspace();
    const articles = Array.isArray(parsed.articles)
      ? parsed.articles.filter(isArticle).slice(0, MAX_ARTICLES)
      : [];
    return { articles, settings: restoreSettings(parsed.settings) };
  } catch {
    return emptyWorkspace();
  }
}

export function loadWorkspaceFrom(storage: Pick<WorkspaceStorage, 'getItem'>): SavedWorkspace {
  try {
    return parseSavedWorkspace(storage.getItem(WORKSPACE_STORAGE_KEY));
  } catch {
    return emptyWorkspace();
  }
}

export function serializeSavedWorkspace(workspace: SavedWorkspace): string {
  return JSON.stringify({ version: 1, articles: workspace.articles, settings: workspace.settings });
}

export function saveWorkspaceTo(storage: Pick<WorkspaceStorage, 'setItem'>, workspace: SavedWorkspace): boolean {
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, serializeSavedWorkspace(workspace));
    return true;
  } catch {
    return false;
  }
}

export function loadSavedWorkspace(): SavedWorkspace {
  if (typeof window === 'undefined') return emptyWorkspace();
  try {
    return loadWorkspaceFrom(window.localStorage);
  } catch {
    return emptyWorkspace();
  }
}

export function saveWorkspace(workspace: SavedWorkspace): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return saveWorkspaceTo(window.localStorage, workspace);
  } catch {
    return false;
  }
}
