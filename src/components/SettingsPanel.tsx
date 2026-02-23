import { useState } from 'react';
import { X, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Settings } from '../types';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

const MODEL_SUGGESTIONS = [
  'anthropic/claude-opus-4-5',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-haiku-3-5',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3.1-70b-instruct',
  'mistralai/mistral-large',
  'deepseek/deepseek-r1',
];

function ModelInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <p className="mb-1.5 text-xs text-slate-600">{hint}</p>
      <div className="relative">
        <input
          className="input-field pr-24"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="provider/model-name"
          spellCheck={false}
          autoComplete="off"
        />
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-surface-500 bg-surface-700 shadow-xl">
            {MODEL_SUGGESTIONS.filter(
              (m) => !value || m.toLowerCase().includes(value.toLowerCase())
            ).map((m) => (
              <button
                key={m}
                type="button"
                className="block w-full px-3 py-2 text-left text-xs font-mono text-slate-300 hover:bg-surface-600 transition-colors"
                onMouseDown={() => onChange(m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  const [showKey, setShowKey] = useState(false);
  const set = <K extends keyof Settings>(key: K, val: Settings[K]) =>
    onChange({ ...settings, [key]: val });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-surface-500 bg-surface-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-600 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-100">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-600 hover:text-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* API Key */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              OpenRouter API Key
            </label>
            <p className="mb-1.5 text-xs text-slate-600">
              Your key is stored only in localStorage—never sent anywhere except OpenRouter.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className="input-field pr-10"
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)}
                  placeholder="sk-or-…"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-surface-500 px-3 text-xs text-slate-400 hover:border-accent hover:text-accent transition-colors whitespace-nowrap"
              >
                Get key <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Main model */}
          <ModelInput
            label="Story model"
            hint="Used for generating story continuations. Larger / more creative models work best."
            value={settings.mainModel}
            onChange={(v) => set('mainModel', v)}
          />

          {/* Lore model */}
          <ModelInput
            label="Lore model"
            hint="Used for relevance checks and lore updates. A smaller, faster model is fine here."
            value={settings.loreModel}
            onChange={(v) => set('loreModel', v)}
          />

          {/* Output word count */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Target output words
            </label>
            <p className="mb-1.5 text-xs text-slate-600">
              How many words to generate per submission. Also determines the window for periodic
              lore-update checks (5&times; this value).
            </p>
            <input
              className="input-field w-32"
              type="number"
              min={50}
              max={4000}
              step={50}
              value={settings.outputWordCount}
              onChange={(e) => set('outputWordCount', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="border-t border-surface-600 px-6 py-4 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
