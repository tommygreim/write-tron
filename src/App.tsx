import { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, Settings as SettingsIcon, Zap, Loader2, AlertCircle } from 'lucide-react';
import StoryEditor, { StoryEditorHandle } from './components/StoryEditor';
import LorePanel from './components/LorePanel';
import SettingsPanel from './components/SettingsPanel';
import { Lore, Settings, RelevanceResult } from './types';
import { callOpenRouter, extractJSON } from './api/openrouter';
import { htmlToPlainText, countWords, getLastNWords, plainTextToHTML } from './utils/text';
import {
  buildRelevanceMessages,
  buildStoryMessages,
  buildLoreUpdateMessages,
} from './utils/prompts';

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

// ─── Status bar ───────────────────────────────────────────────────────────────

type StatusKind = 'idle' | 'working' | 'error' | 'updated';

interface StatusState {
  kind: StatusKind;
  message: string;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const editorRef = useRef<StoryEditorHandle>(null);

  const [lore, setLore] = useState<Lore>(() => loadFromStorage('wt_lore', DEFAULT_LORE));
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

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('wt_lore', JSON.stringify(lore));
  }, [lore]);
  useEffect(() => {
    localStorage.setItem('wt_settings', JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem('wt_queryCount', JSON.stringify(queryCount));
  }, [queryCount]);

  // ─── Lore helper: has any lore to send? ───────────────────────────────────

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
        return {
          includePremise: parsed.includePremise ?? false,
          characterIds: Array.isArray(parsed.characterIds) ? parsed.characterIds : [],
          locationIds: Array.isArray(parsed.locationIds) ? parsed.locationIds : [],
        };
      } catch {
        // If JSON parse fails, include everything as a fallback
        return {
          includePremise: true,
          characterIds: lore.characters.map((c) => c.id),
          locationIds: lore.locations.map((l) => l.id),
        };
      }
    },
    [lore, settings.apiKey, settings.loreModel]
  );

  // ─── Lore update check (runs every 5 queries) ─────────────────────────────

  const checkLoreUpdate = useCallback(
    async (storyText: string) => {
      if (!hasLore()) return;

      setStatus({ kind: 'working', message: 'Reviewing lore for updates…' });
      const windowSize = settings.outputWordCount * 5;
      const recentPassage = getLastNWords(storyText, windowSize);

      const messages = buildLoreUpdateMessages(lore, recentPassage);
      const raw = await callOpenRouter(settings.apiKey, settings.loreModel, messages);

      try {
        const result = extractJSON(raw) as {
          updates: boolean;
          premise?: string | null;
          characters?: typeof lore.characters;
          locations?: typeof lore.locations;
        };

        if (!result.updates) return;

        setLore((prev) => {
          const next = { ...prev };

          if (result.premise != null) {
            next.premise = result.premise;
          }

          if (result.characters?.length) {
            const updatesById = Object.fromEntries(result.characters.map((c) => [c.id, c]));
            next.characters = prev.characters.map((c) => updatesById[c.id] ?? c);
          }

          if (result.locations?.length) {
            const updatesById = Object.fromEntries(result.locations.map((l) => [l.id, l]));
            next.locations = prev.locations.map((l) => updatesById[l.id] ?? l);
          }

          return next;
        });

        setStatus({ kind: 'updated', message: 'Lore entries updated based on story progress.' });
        setTimeout(() => setStatus({ kind: 'idle', message: '' }), 4000);
      } catch {
        // Silently ignore parse failures for lore updates
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

    setIsGenerating(true);
    setStreamingText('');

    try {
      // Step 1: Relevance check (only if lore exists)
      let relevance: RelevanceResult = {
        includePremise: false,
        characterIds: [],
        locationIds: [],
      };

      if (hasLore()) {
        setStatus({ kind: 'working', message: 'Checking lore relevance…' });
        const last500 = getLastNWords(storyText, 500);
        relevance = await checkRelevance(last500);
      }

      // Step 2: Build story prompt and stream
      setStatus({ kind: 'working', message: 'Generating…' });
      const messages = buildStoryMessages(lore, relevance, storyText, settings.outputWordCount);

      let accumulated = '';
      await callOpenRouter(settings.apiKey, settings.mainModel, messages, (chunk) => {
        accumulated += chunk;
        setStreamingText(accumulated);
      });

      // Step 3: Insert generated text into the editor
      if (accumulated) {
        const insertHTML = plainTextToHTML(accumulated);
        editorRef.current?.appendHTML(insertHTML);
      }
      setStreamingText('');

      // Step 4: Increment query count
      const newCount = queryCount + 1;
      setQueryCount(newCount);

      const wordCount = countWords(accumulated);
      setStatus({ kind: 'idle', message: `Generated ${wordCount} words.` });

      // Step 5: Every 5 queries, run lore update check
      if (newCount % 5 === 0 && hasLore()) {
        const updatedHTML = editorRef.current?.getHTML() ?? '';
        const updatedText = htmlToPlainText(updatedHTML);
        await checkLoreUpdate(updatedText);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', message: msg });
      setStreamingText('');
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

  // ─── Word count (live) ────────────────────────────────────────────────────
  const [wordCount, setWordCount] = useState(0);
  const handleEditorChange = useCallback(() => {
    const html = editorRef.current?.getHTML() ?? '';
    setWordCount(countWords(htmlToPlainText(html)));
  }, []);

  // Poll word count while not generating
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
                {lore.characters.length + lore.locations.length + (lore.premise ? 1 : 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setSettingsPanelOpen(true)}
            className="rounded-lg border border-surface-500 p-1.5 text-slate-400 transition-colors hover:border-accent hover:text-accent"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      {/* ── Editor ── */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <StoryEditor ref={editorRef} readOnly={isGenerating} />

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
        {/* Status */}
        <div className="flex min-w-0 items-center gap-2 text-sm">
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

        {/* Generate button */}
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

      {/* ── Panels ── */}
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
