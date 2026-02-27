/**
 * Utilities for parsing {{char:ID}}...{{/char}} markers that the AI embeds in
 * generated text, and converting the result to TipTap-compatible HTML with the
 * CharacterDialogue mark applied.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DialogueSegment {
  text: string;
  characterId?: string; // undefined = narration
}

// ─── Marker regex ─────────────────────────────────────────────────────────────

// Matches {{char:SOME-ID}}...{{/char}}  (non-greedy, allows newlines)
const MARKER_RE = /\{\{char:([^}]+)\}\}([\s\S]*?)\{\{\/char\}\}/g;

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Split raw text into narration and dialogue segments.
 * Markers that reference an unrecognised character ID are kept as narration.
 */
export function parseDialogueMarkers(
  raw: string,
  knownIds?: Set<string>
): DialogueSegment[] {
  const segments: DialogueSegment[] = [];
  let lastIndex = 0;
  MARKER_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKER_RE.exec(raw)) !== null) {
    // Narration before this marker
    if (match.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, match.index) });
    }

    const charId = match[1].trim();
    const spoken = match[2];

    if (!knownIds || knownIds.has(charId)) {
      segments.push({ text: spoken, characterId: charId });
    } else {
      // Unknown ID – treat as narration so we don't silently drop text
      segments.push({ text: spoken });
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing narration
  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex) });
  }

  return segments;
}

/**
 * Returns true if the raw text contains at least one dialogue marker.
 */
export function hasDialogueMarkers(raw: string): boolean {
  MARKER_RE.lastIndex = 0;
  return MARKER_RE.test(raw);
}

// ─── Side assignment ──────────────────────────────────────────────────────────

/**
 * Given an existing characterId → side map (from the document) and a list of
 * segments from the new generation, extend the map so every character that
 * speaks gets a side.
 *
 * Rule: first speaker encountered (globally) = left; second unique = right;
 * further characters alternate starting from left.
 */
export function assignSides(
  segments: DialogueSegment[],
  existing: Map<string, 'left' | 'right'>
): Map<string, 'left' | 'right'> {
  const map = new Map(existing);

  for (const seg of segments) {
    if (!seg.characterId || map.has(seg.characterId)) continue;

    const leftCount = [...map.values()].filter((s) => s === 'left').length;
    const rightCount = [...map.values()].filter((s) => s === 'right').length;
    map.set(seg.characterId, leftCount <= rightCount ? 'left' : 'right');
  }

  return map;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert parsed segments into TipTap-insertable HTML.
 *
 * Each double-newline in narration creates a paragraph break.  Dialogue spans
 * stay inline within their surrounding paragraph.  The resulting HTML is a
 * sequence of <p> elements.
 */
export function segmentsToHTML(
  segments: DialogueSegment[],
  sideMap: Map<string, 'left' | 'right'>
): string {
  // Build a list of "inline items" interspersed with paragraph-break signals.
  type Item =
    | { kind: 'text'; html: string }
    | { kind: 'span'; html: string }
    | { kind: 'break' };

  const items: Item[] = [];

  for (const seg of segments) {
    if (seg.characterId) {
      const side = sideMap.get(seg.characterId) ?? 'left';
      const inner = escapeHtml(seg.text.replace(/\n/g, ' ').trim());
      if (inner) {
        items.push({
          kind: 'span',
          html: `<span data-character-id="${seg.characterId}" data-side="${side}" class="char-dialogue">${inner}</span>`,
        });
      }
    } else {
      // Split narration on paragraph breaks
      const parts = seg.text.split(/\n{2,}/);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) items.push({ kind: 'break' });
        const t = escapeHtml(parts[i].replace(/\n/g, ' '));
        if (t.trim()) items.push({ kind: 'text', html: t });
      }
    }
  }

  // Assemble items into <p> elements
  const paragraphs: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) paragraphs.push(`<p>${trimmed}</p>`);
    current = '';
  };

  for (const item of items) {
    if (item.kind === 'break') {
      flush();
    } else {
      current += item.html;
    }
  }
  flush();

  return paragraphs.join('');
}
