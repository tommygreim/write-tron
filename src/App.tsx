import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Settings as SettingsIcon,
  Zap,
  Loader2,
  AlertCircle,
  Download,
  Upload,
} from 'lucide-react';
import StoryEditor, { StoryEditorHandle } from './components/StoryEditor';
import LorePanel from './components/LorePanel';
import SettingsPanel from './components/SettingsPanel';
import CharacterStyles from './components/CharacterStyles';
import { Lore, Settings, RelevanceResult } from './types';
import { callOpenRouter, extractJSON } from './api/openrouter';
import { htmlToPlainText, countWords, getLastNWords } from './utils/text';
import {
  buildRelevanceMessages,
  buildStoryMessages,
  buildLoreUpdateMessages,
} from './utils/prompts';
import { normalizeCharacter, normalizeLocation, normalizeLore } from './utils/normalize';
import { log } from './utils/logger';
import { parseDialogueMarkers, assignSides, segmentsToHTML, hasDialogueMarkers } from './utils/parseDialogue';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_LORE: Lore = { premise: '', characters: [], locations: [] };

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  mainModel: 'anthropic/claude-sonnet-4-5',
  loreModel: 'anthropic/claude-haiku-3-5',
  outputWordCount: 300,
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ─── Export / import helpers ──────────────────────────────────────────────────

const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  story: string;
  lore: Lore;
}

function exportSave(storyHTML: string, lore: Lore) {
  const payload: SaveFile = { version: SAVE_VERSION, story: storyHTML, lore };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `write-tron-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  log.info('Exported save file', { words: countWords(htmlToPlainText(storyHTML)), loreEntries: lore.characters.length + lore.locations.length });
}

function readSaveFile(file: File): Promise<SaveFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as SaveFile;
        resolve(parsed);
      } catch {
        reject(new Error('Invalid save file — could not parse JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

// ─── Status helpers ───────────────────────────────────────────────────────────

type StatusKind = 'idle' | 'working' | 'error' | 'updated';
interface StatusState { kind: StatusKind; message: string }

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const editorRef = useRef<StoryEditorHandle>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Normalise lore on load to guard against old/malformed localStorage data
  const [lore, setLore] = useState<Lore>(() =>
    normalizeLore(loadFromStorage<Partial<Lore>>('wt_lore', DEFAULT_LORE))
  );
  const [settings, setSettings] = useState<Settings>(() =>
    loadFromStorage('wt_settings', DEFAULT_SETTINGS)
  );
  const [queryCount, setQueryCount] = useState<number>(() =>
    loadFromStorage('wt_queryCount', 0)
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [status, setStatus] = useState<StatusState>({ kind: 'idle', message: '' });

  const [lorePanelOpen, setLorePanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  // Persist to localStorage
  useEffect(() => { localStorage.setItem('wt_lore', JSON.stringify(lore)); }, [lore]);
  useEffect(() => { localStorage.setItem('wt_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('wt_queryCount', JSON.stringify(queryCount)); }, [queryCount]);

  // ─── Export ───────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? '';
    exportSave(html, lore);
    setStatus({ kind: 'idle', message: 'Saved to file.' });
    setTimeout(() => setStatus({ kind: 'idle', message: '' }), 2500);
  }, [lore]);

  // ─── Import ───────────────────────────────────────────────────────────────

  const handleImport = useCallback(async (file: File) => {
    try {
      const save = await readSaveFile(file);
      const restoredLore = normalizeLore(save.lore ?? DEFAULT_LORE);
      setLore(restoredLore);
      editorRef.current?.setContent(save.story ?? '');
      setQueryCount(0);
      setStatus({ kind: 'idle', message: 'Session imported.' });
      log.info('Imported save file', {
        version: save.version,
        chars: restoredLore.characters.length,
        locs: restoredLore.locations.length,
      });
      setTimeout(() => setStatus({ kind: 'idle', message: '' }), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', message: `Import failed: ${msg}` });
      log.error('Import failed', err);
    }
  }, []);

  // ─── Lore helper ──────────────────────────────────────────────────────────

  const hasLore = useCallback(
    () => !!(lore.premise || lore.characters.length || lore.locations.length),
    [lore]
  );

  // ─── Relevance check ──────────────────────────────────────────────────────

  const checkRelevance = useCallback(
    async (recentPassage: string): Promise<RelevanceResult> => {
      const messages = buildRelevanceMessages(lore, recentPassage);
      const raw = await callOpenRouter(settings.apiKey, settings.loreModel, messages);
      try {
        const parsed = extractJSON(raw) as RelevanceResult;
        const result: RelevanceResult = {
          includePremise: parsed.includePremise ?? false,
          characterIds: Array.isArray(parsed.characterIds) ? parsed.characterIds : [],
          locationIds: Array.isArray(parsed.locationIds) ? parsed.locationIds : [],
        };
        log.table('Relevance result', {
          includePremise: result.includePremise,
          characters: lore.characters.filter(c => result.characterIds.includes(c.id)).map(c => c.name),
          locations: lore.locations.filter(l => result.locationIds.includes(l.id)).map(l => l.name),
        });
        return result;
      } catch {
        // Fallback: include everything
        log.warn('Relevance check JSON parse failed — including all lore as fallback');
        return {
          includePremise: true,
          characterIds: lore.characters.map((c) => c.id),
          locationIds: lore.locations.map((l) => l.id),
        };
      }
    },
    [lore, settings.apiKey, settings.loreModel]
  );

  // ─── Lore update check (every 5 queries) ──────────────────────────────────

  const checkLoreUpdate = useCallback(
    async (storyText: string) => {
      if (!hasLore()) return;

      setStatus({ kind: 'working', message: 'Reviewing lore for updates…' });
      const windowSize = settings.outputWordCount * 5;
      const recentPassage = getLastNWords(storyText, windowSize);

      log.group(`Lore update check (window: ${windowSize} words)`);
      log.info('Sending to lore model…');

      const messages = buildLoreUpdateMessages(lore, recentPassage);
      const raw = await callOpenRouter(settings.apiKey, settings.loreModel, messages);

      try {
        const result = extractJSON(raw) as {
          updates: boolean;
          premise?: string | null;
          updatedCharacters?: ReturnType<typeof normalizeCharacter>[];
          updatedLocations?: ReturnType<typeof normalizeLocation>[];
          newCharacters?: Partial<ReturnType<typeof normalizeCharacter>>[];
          newLocations?: Partial<ReturnType<typeof normalizeLocation>>[];
        };

        if (!result.updates) {
          log.info('No lore updates needed.');
          log.groupEnd();
          setStatus({ kind: 'idle', message: '' });
          return;
        }

        const updatedCharNames: string[] = [];
        const updatedLocNames: string[] = [];
        const newCharNames: string[] = [];
        const newLocNames: string[] = [];

        setLore((prev) => {
          const next = { ...prev };

          // Update premise
          if (typeof result.premise === 'string') {
            next.premise = result.premise;
          }

          // Update existing characters
          if (result.updatedCharacters?.length) {
            const byId = Object.fromEntries(
              result.updatedCharacters.map((c) => [c.id, normalizeCharacter(c)])
            );
            next.characters = prev.characters.map((c) => {
              if (byId[c.id]) {
                updatedCharNames.push(byId[c.id].name || c.name);
                return byId[c.id];
              }
              return c;
            });
          }

          // Update existing locations
          if (result.updatedLocations?.length) {
            const byId = Object.fromEntries(
              result.updatedLocations.map((l) => [l.id, normalizeLocation(l)])
            );
            next.locations = prev.locations.map((l) => {
              if (byId[l.id]) {
                updatedLocNames.push(byId[l.id].name || l.name);
                return byId[l.id];
              }
              return l;
            });
          }

          // Create new characters
          if (result.newCharacters?.length) {
            const created = result.newCharacters.map((c) => {
              const norm = normalizeCharacter({ ...c, id: undefined });
              newCharNames.push(norm.name);
              return norm;
            });
            next.characters = [...(next.characters ?? prev.characters), ...created];
          }

          // Create new locations
          if (result.newLocations?.length) {
            const created = result.newLocations.map((l) => {
              const norm = normalizeLocation({ ...l, id: undefined });
              newLocNames.push(norm.name);
              return norm;
            });
            next.locations = [...(next.locations ?? prev.locations), ...created];
          }

          return next;
        });

        log.info('Updated characters:', updatedCharNames);
        log.info('Updated locations:', updatedLocNames);
        log.info('New characters:', newCharNames);
        log.info('New locations:', newLocNames);
        log.groupEnd();

        const parts: string[] = [];
        if (updatedCharNames.length || updatedLocNames.length) {
          parts.push(`Updated: ${[...updatedCharNames, ...updatedLocNames].join(', ')}`);
        }
        if (newCharNames.length || newLocNames.length) {
          parts.push(`New entries: ${[...newCharNames, ...newLocNames].join(', ')}`);
        }

        setStatus({
          kind: 'updated',
          message: parts.join(' · ') || 'Lore updated.',
        });
        setTimeout(() => setStatus({ kind: 'idle', message: '' }), 5000);
      } catch (err) {
        log.error('Lore update JSON parse failed', err, '\nRaw response:', raw);
        log.groupEnd();
      }
    },
    [hasLore, lore, settings.apiKey, settings.loreModel, settings.outputWordCount]
  );

  // ─── Main generate handler ────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;

    if (!settings.apiKey) {
      setSettingsPanelOpen(true);
      setStatus({ kind: 'error', message: 'Please enter your OpenRouter API key in Settings.' });
      return;
    }
    if (!settings.mainModel) {
      setStatus({ kind: 'error', message: 'Please set a story model in Settings.' });
      return;
    }

    const html = editorRef.current?.getHTML() ?? '';
    const storyText = htmlToPlainText(html);
    const newCount = queryCount + 1;

    log.group(`Generate #${newCount}`);
    log.info('Story words so far:', countWords(storyText));
    log.info('Story model:', settings.mainModel);
    log.info('Lore model:', settings.loreModel);

    setIsGenerating(true);
    setStreamingText('');

    try {
      // Step 1: Relevance check
      let relevance: RelevanceResult = {
        includePremise: false,
        characterIds: [],
        locationIds: [],
      };

      if (hasLore()) {
        setStatus({ kind: 'working', message: 'Checking lore relevance…' });
        const last500 = getLastNWords(storyText, 500);
        relevance = await checkRelevance(last500);
      } else {
        log.info('No lore defined — skipping relevance check.');
      }

      // Step 2: Stream story continuation
      setStatus({ kind: 'working', message: 'Generating…' });
      const messages = buildStoryMessages(lore, relevance, storyText, settings.outputWordCount);
      log.info('Sending story prompt…');

      let accumulated = '';
      await callOpenRouter(settings.apiKey, settings.mainModel, messages, (chunk) => {
        accumulated += chunk;
        setStreamingText(accumulated);
      });

      // Step 3: Parse dialogue markers and insert into editor
      if (accumulated) {
        const knownIds = new Set(lore.characters.map((c) => c.id));

        if (hasDialogueMarkers(accumulated)) {
          const segments = parseDialogueMarkers(accumulated, knownIds);
          const existingSides = editorRef.current?.getExistingSides() ?? new Map();
          const sideMap = assignSides(segments, existingSides);
          const html = segmentsToHTML(segments, sideMap);
          log.info('Dialogue annotation parsed', {
            segments: segments.length,
            dialogueSegments: segments.filter((s) => s.characterId).length,
            sideMap: Object.fromEntries(sideMap),
          });
          editorRef.current?.appendHTML(html);
        } else {
          // No markers — insert as plain paragraphs
          const paras = accumulated
            .split(/\n{2,}/)
            .map((p) => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
            .join('');
          editorRef.current?.appendHTML(paras);
        }
      }
      setStreamingText('');

      const generatedWords = countWords(accumulated);
      log.info(`Generated ${generatedWords} words.`);
      log.groupEnd();

      setQueryCount(newCount);
      setStatus({ kind: 'idle', message: `Generated ${generatedWords} words.` });

      // Step 4: Every 5 queries, run lore update check
      if (newCount % 5 === 0) {
        const updatedHTML = editorRef.current?.getHTML() ?? '';
        const updatedText = htmlToPlainText(updatedHTML);
        await checkLoreUpdate(updatedText);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', message: msg });
      setStreamingText('');
      log.error('Generate failed:', err);
      log.groupEnd();
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    settings,
    lore,
    queryCount,
    hasLore,
    checkRelevance,
    checkLoreUpdate,
  ]);

  // ─── Keyboard shortcut: Ctrl/Cmd+Enter ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGenerate]);

  // ─── Live word count ──────────────────────────────────────────────────────
  const [wordCount, setWordCount] = useState(0);
  const handleEditorChange = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? '';
    setWordCount(countWords(htmlToPlainText(html)));
  }, []);

  useEffect(() => {
    if (isGenerating) return;
    const id = setInterval(handleEditorChange, 500);
    return () => clearInterval(id);
  }, [isGenerating, handleEditorChange]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const statusIcon = () => {
    if (status.kind === 'error') return <AlertCircle size={14} className="shrink-0 text-red-400" />;
    if (status.kind === 'updated') return <span className="text-green-400">✦</span>;
    if (status.kind === 'working') return <Loader2 size={14} className="shrink-0 animate-spin text-accent" />;
    return null;
  };

  const nextLoreCheck = queryCount > 0 ? 5 - (queryCount % 5) : 5;
  const loreEntryCount = lore.characters.length + lore.locations.length + (lore.premise ? 1 : 0);

  return (
    <div className="flex h-screen flex-col bg-surface-900 text-slate-200">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-surface-600 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-slate-100">
            Write<span className="text-accent">-Tron</span>
          </span>
          {queryCount > 0 && (
            <span className="rounded-full border border-surface-500 px-2 py-0.5 text-xs text-slate-600">
              query #{queryCount} &middot; lore check in {nextLoreCheck}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export */}
          <button
            onClick={handleExport}
            title="Export story + lore to JSON"
            className="rounded-lg border border-surface-500 p-1.5 text-slate-400 transition-colors hover:border-accent hover:text-accent"
          >
            <Download size={16} />
          </button>

          {/* Import */}
          <button
            onClick={() => importInputRef.current?.click()}
            title="Import story + lore from JSON"
            className="rounded-lg border border-surface-500 p-1.5 text-slate-400 transition-colors hover:border-accent hover:text-accent"
          >
            <Upload size={16} />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />

          {/* Lore */}
          <button
            onClick={() => setLorePanelOpen(true)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              hasLore()
                ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                : 'border-surface-500 text-slate-400 hover:border-accent hover:text-accent'
            }`}
          >
            <BookOpen size={15} />
            Lore
            {hasLore() && (
              <span className="rounded-full bg-accent/30 px-1.5 py-0.5 text-xs">
                {loreEntryCount}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setSettingsPanelOpen(true)}
            className="rounded-lg border border-surface-500 p-1.5 text-slate-400 transition-colors hover:border-accent hover:text-accent"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      {/* Inject per-character dialogue CSS */}
      <CharacterStyles characters={lore.characters} />

      {/* ── Editor ── */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <StoryEditor ref={editorRef} readOnly={isGenerating} characters={lore.characters} />

        {/* Streaming preview */}
        {streamingText && (
          <div className="shrink-0 border-t border-dashed border-accent/30 bg-surface-800/80 px-8 py-4 backdrop-blur-sm">
            <div className="mx-auto max-w-3xl">
              <div className="mb-1 flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-accent" />
                <span className="text-xs text-accent">Generating…</span>
              </div>
              <p className="whitespace-pre-wrap font-serif text-lg leading-8 text-slate-300/80">
                {streamingText}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <footer className="flex shrink-0 items-center justify-between border-t border-surface-600 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {statusIcon()}
          <span
            className={`truncate text-xs ${
              status.kind === 'error'
                ? 'text-red-400'
                : status.kind === 'updated'
                ? 'text-green-400'
                : status.kind === 'working'
                ? 'text-accent'
                : 'text-slate-500'
            }`}
          >
            {status.message || `${wordCount.toLocaleString()} words`}
          </span>
          {status.message && status.kind === 'idle' && (
            <span className="text-xs text-slate-600">&middot; {wordCount.toLocaleString()} words</span>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          title="Generate (Ctrl+Enter)"
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Zap size={15} />
              Generate
              <span className="ml-1 rounded border border-white/20 px-1 py-0.5 text-xs opacity-60">
                ⌘↵
              </span>
            </>
          )}
        </button>
      </footer>

      {lorePanelOpen && (
        <LorePanel lore={lore} onChange={setLore} onClose={() => setLorePanelOpen(false)} />
      )}
      {settingsPanelOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsPanelOpen(false)}
        />
      )}
    </div>
  );
}
