import { useState, useRef } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp, ImagePlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Character, Location, Lore, Relationship, SpatialRelation } from '../types';

type Tab = 'premise' | 'characters' | 'locations';

interface Props {
  lore: Lore;
  onChange: (lore: Lore) => void;
  onClose: () => void;
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-surface-500 bg-surface-800 p-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded bg-accent/20 px-2 py-0.5 text-xs text-accent"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="hover:text-red-400"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
        placeholder={placeholder ?? 'Add tag, press Enter'}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

// ─── Character entry ──────────────────────────────────────────────────────────

const PORTRAIT_FONTS = [
  { label: 'Default (inherit)', value: '' },
  { label: 'Georgia (serif)', value: 'Georgia, serif' },
  { label: 'Palatino (serif)', value: "'Palatino Linotype', Palatino, serif" },
  { label: 'Times New Roman (serif)', value: "'Times New Roman', Times, serif" },
  { label: 'Arial (sans-serif)', value: 'Arial, sans-serif' },
  { label: 'Verdana (sans-serif)', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New (mono)', value: "'Courier New', Courier, monospace" },
  { label: 'Trebuchet (sans-serif)', value: "'Trebuchet MS', sans-serif" },
  { label: 'Comic Sans (casual)', value: "'Comic Sans MS', cursive" },
];

/** Resize an uploaded image to fit within maxW×maxH while keeping aspect ratio. */
function resizeImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function CharacterEntry({
  char,
  allChars,
  onChange,
  onDelete,
}: {
  char: Character;
  allChars: Character[];
  onChange: (c: Character) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Character>(key: K, val: Character[K]) =>
    onChange({ ...char, [key]: val });

  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Resize to max 416×608 (half of 832×1216) to keep localStorage manageable
      const dataUrl = await resizeImage(file, 416, 608);
      set('portrait', dataUrl);
    } catch {
      // ignore
    }
    e.target.value = '';
  };

  // Guard: AI-returned objects may omit array fields
  const aliases = char.aliases ?? [];
  const relationships = char.relationships ?? [];

  const addRel = () => {
    const other = allChars.find((c) => c.id !== char.id);
    if (!other) return;
    const rel: Relationship = { id: uuidv4(), targetId: other.id, description: '' };
    set('relationships', [...relationships, rel]);
  };

  const updateRel = (id: string, patch: Partial<Relationship>) => {
    set(
      'relationships',
      relationships.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const deleteRel = (id: string) =>
    set(
      'relationships',
      relationships.filter((r) => r.id !== id)
    );

  const otherChars = allChars.filter((c) => c.id !== char.id);

  return (
    <div className="rounded-xl border border-surface-500 bg-surface-700">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-slate-100">
          {char.name || <span className="italic text-slate-500">Unnamed character</span>}
        </span>
        <div className="flex items-center gap-2">
          <span onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-1 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </span>
          {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-surface-500 p-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
            <input
              className="input-field"
              value={char.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Character name"
            />
          </div>

          {/* Aliases */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Aliases <span className="text-slate-600">(press Enter to add)</span>
            </label>
            <TagInput tags={aliases} onChange={(v) => set('aliases', v)} placeholder="Add alias…" />
          </div>

          {/* Personality */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Personality</label>
            <textarea
              className="input-field h-24 resize-y"
              value={char.personality}
              onChange={(e) => set('personality', e.target.value)}
              placeholder="Describe the character's personality, mannerisms, speech patterns…"
            />
          </div>

          {/* Appearance (booru tags) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Appearance <span className="text-slate-600">(booru-style tags)</span>
            </label>
            <textarea
              className="input-field h-20 resize-y font-mono text-xs"
              value={char.appearance}
              onChange={(e) => set('appearance', e.target.value)}
              placeholder="blue_eyes, long_hair, tall, scar_on_cheek, …"
            />
          </div>

          {/* Portrait */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Portrait{' '}
              <span className="text-slate-600">(2:3 aspect ratio, shown beside dialogue)</span>
            </label>
            <input
              ref={portraitInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePortraitUpload}
            />
            {char.portrait ? (
              <div className="flex items-start gap-3">
                <img
                  src={char.portrait}
                  alt="Portrait preview"
                  className="rounded-lg object-cover shadow"
                  style={{ width: 72, height: 105 }}
                />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => portraitInputRef.current?.click()}
                    className="rounded-lg border border-surface-500 px-3 py-1.5 text-xs text-slate-400 hover:border-accent hover:text-accent transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => set('portrait', null)}
                    className="rounded-lg border border-surface-500 px-3 py-1.5 text-xs text-slate-400 hover:border-red-500 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => portraitInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-dashed border-surface-500 px-4 py-3 text-sm text-slate-500 transition-colors hover:border-accent hover:text-accent"
              >
                <ImagePlus size={16} /> Upload portrait
              </button>
            )}
          </div>

          {/* Dialogue styling */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">
              Dialogue styling
            </label>
            <div className="flex items-center gap-3">
              {/* Color swatch */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Color</label>
                <div className="relative h-8 w-8 overflow-hidden rounded border border-surface-500">
                  <input
                    type="color"
                    value={char.dialogueColor || '#e2e8f0'}
                    onChange={(e) => set('dialogueColor', e.target.value)}
                    className="absolute -inset-1 h-12 w-12 cursor-pointer border-0 p-0 opacity-100"
                    title="Dialogue text colour"
                  />
                </div>
                {char.dialogueColor && (
                  <button
                    type="button"
                    onClick={() => set('dialogueColor', '')}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                    title="Clear colour"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Font selector */}
              <div className="flex flex-1 items-center gap-2">
                <label className="shrink-0 text-xs text-slate-500">Font</label>
                <select
                  className="select-field flex-1 text-xs"
                  value={char.dialogueFont || ''}
                  onChange={(e) => set('dialogueFont', e.target.value)}
                >
                  {PORTRAIT_FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live preview */}
            {(char.dialogueColor || char.dialogueFont) && (
              <p
                className="mt-2 rounded bg-surface-800 px-3 py-2 text-sm"
                style={{
                  color: char.dialogueColor || undefined,
                  fontFamily: char.dialogueFont || undefined,
                }}
              >
                "This is how {char.name || 'this character'}'s dialogue will look."
              </p>
            )}
          </div>

          {/* Relationships */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">Relationships</label>
            {relationships.length === 0 && (
              <p className="mb-2 text-xs text-slate-600 italic">No relationships defined.</p>
            )}
            <div className="space-y-2">
              {relationships.map((rel) => (
                <div key={rel.id} className="flex items-center gap-2">
                  <select
                    className="select-field w-40 shrink-0"
                    value={rel.targetId}
                    onChange={(e) => updateRel(rel.id, { targetId: e.target.value })}
                  >
                    {otherChars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || '(unnamed)'}
                      </option>
                    ))}
                    {otherChars.length === 0 && <option value="">No other characters</option>}
                  </select>
                  <input
                    className="input-field flex-1"
                    placeholder="Describe relationship…"
                    value={rel.description}
                    onChange={(e) => updateRel(rel.id, { description: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => deleteRel(rel.id)}
                    className="shrink-0 rounded p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRel}
              disabled={otherChars.length === 0}
              className="mt-2 flex items-center gap-1 text-xs text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={12} /> Add relationship
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Location entry ───────────────────────────────────────────────────────────

function LocationEntry({
  loc,
  allLocs,
  onChange,
  onDelete,
}: {
  loc: Location;
  allLocs: Location[];
  onChange: (l: Location) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const set = <K extends keyof Location>(key: K, val: Location[K]) =>
    onChange({ ...loc, [key]: val });

  // Guard: AI-returned objects may omit array fields
  const spatialRelations = loc.spatialRelations ?? [];

  const addRel = () => {
    const other = allLocs.find((l) => l.id !== loc.id);
    if (!other) return;
    const rel: SpatialRelation = { id: uuidv4(), targetId: other.id, description: '' };
    set('spatialRelations', [...spatialRelations, rel]);
  };

  const updateRel = (id: string, patch: Partial<SpatialRelation>) => {
    set(
      'spatialRelations',
      spatialRelations.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const deleteRel = (id: string) =>
    set(
      'spatialRelations',
      spatialRelations.filter((r) => r.id !== id)
    );

  const otherLocs = allLocs.filter((l) => l.id !== loc.id);

  return (
    <div className="rounded-xl border border-surface-500 bg-surface-700">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-slate-100">
          {loc.name || <span className="italic text-slate-500">Unnamed location</span>}
        </span>
        <div className="flex items-center gap-2">
          <span onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-1 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </span>
          {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-surface-500 p-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
            <input
              className="input-field"
              value={loc.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Location name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
            <textarea
              className="input-field h-28 resize-y"
              value={loc.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe this location: atmosphere, notable features, history…"
            />
          </div>

          {/* Spatial Relations */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">Spatial relations</label>
            {spatialRelations.length === 0 && (
              <p className="mb-2 text-xs text-slate-600 italic">No spatial relations defined.</p>
            )}
            <div className="space-y-2">
              {spatialRelations.map((rel) => (
                <div key={rel.id} className="flex items-center gap-2">
                  <select
                    className="select-field w-40 shrink-0"
                    value={rel.targetId}
                    onChange={(e) => updateRel(rel.id, { targetId: e.target.value })}
                  >
                    {otherLocs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name || '(unnamed)'}
                      </option>
                    ))}
                    {otherLocs.length === 0 && <option value="">No other locations</option>}
                  </select>
                  <input
                    className="input-field flex-1"
                    placeholder="e.g. two days' ride north of…"
                    value={rel.description}
                    onChange={(e) => updateRel(rel.id, { description: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => deleteRel(rel.id)}
                    className="shrink-0 rounded p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRel}
              disabled={otherLocs.length === 0}
              className="mt-2 flex items-center gap-1 text-xs text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={12} /> Add spatial relation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function LorePanel({ lore, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('premise');

  const addCharacter = () => {
    const newChar: Character = {
      id: uuidv4(),
      name: '',
      aliases: [],
      personality: '',
      appearance: '',
      relationships: [],
      portrait: null,
      dialogueColor: '',
      dialogueFont: '',
    };
    onChange({ ...lore, characters: [...lore.characters, newChar] });
  };

  const updateCharacter = (id: string, updated: Character) => {
    onChange({
      ...lore,
      characters: lore.characters.map((c) => (c.id === id ? updated : c)),
    });
  };

  const deleteCharacter = (id: string) => {
    onChange({
      ...lore,
      characters: lore.characters
        .filter((c) => c.id !== id)
        .map((c) => ({
          ...c,
          relationships: c.relationships.filter((r) => r.targetId !== id),
        })),
    });
  };

  const addLocation = () => {
    const newLoc: Location = {
      id: uuidv4(),
      name: '',
      description: '',
      spatialRelations: [],
    };
    onChange({ ...lore, locations: [...lore.locations, newLoc] });
  };

  const updateLocation = (id: string, updated: Location) => {
    onChange({
      ...lore,
      locations: lore.locations.map((l) => (l.id === id ? updated : l)),
    });
  };

  const deleteLocation = (id: string) => {
    onChange({
      ...lore,
      locations: lore.locations
        .filter((l) => l.id !== id)
        .map((l) => ({
          ...l,
          spatialRelations: (l.spatialRelations ?? []).filter((r) => r.targetId !== id),
        })),
    });
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'premise', label: 'Premise' },
    { key: 'characters', label: 'Characters', count: lore.characters.length },
    { key: 'locations', label: 'Locations', count: lore.locations.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-surface-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-600 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-100">Lore</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-600 hover:text-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-600">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className="rounded-full bg-surface-600 px-1.5 py-0.5 text-xs text-slate-400">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'premise' && (
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">
                Setting & Premise
              </label>
              <textarea
                className="input-field h-64 resize-y"
                value={lore.premise}
                onChange={(e) => onChange({ ...lore, premise: e.target.value })}
                placeholder="Describe the general setting, world, time period, tone, and central premise of your story…"
              />
              <p className="mt-2 text-xs text-slate-600">
                This will be included when marked relevant to the current passage. Keep it focused
                on persistent world details rather than plot specifics.
              </p>
            </div>
          )}

          {tab === 'characters' && (
            <div className="space-y-4">
              {lore.characters.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600 italic">
                  No characters yet. Add one to get started.
                </p>
              )}
              {lore.characters.map((char) => (
                <CharacterEntry
                  key={char.id}
                  char={char}
                  allChars={lore.characters}
                  onChange={(updated) => updateCharacter(char.id, updated)}
                  onDelete={() => deleteCharacter(char.id)}
                />
              ))}
              <button
                type="button"
                onClick={addCharacter}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-surface-500 py-3 text-sm text-slate-500 transition-colors hover:border-accent hover:text-accent"
              >
                <Plus size={16} /> Add character
              </button>
            </div>
          )}

          {tab === 'locations' && (
            <div className="space-y-4">
              {lore.locations.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600 italic">
                  No locations yet. Add one to get started.
                </p>
              )}
              {lore.locations.map((loc) => (
                <LocationEntry
                  key={loc.id}
                  loc={loc}
                  allLocs={lore.locations}
                  onChange={(updated) => updateLocation(loc.id, updated)}
                  onDelete={() => deleteLocation(loc.id)}
                />
              ))}
              <button
                type="button"
                onClick={addLocation}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-surface-500 py-3 text-sm text-slate-500 transition-colors hover:border-accent hover:text-accent"
              >
                <Plus size={16} /> Add location
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
