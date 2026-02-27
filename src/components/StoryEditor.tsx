import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { forwardRef, useImperativeHandle, useEffect, useRef, useState, useCallback } from 'react';
import { CharacterDialogue } from '../tiptap/CharacterDialogue';
import { Character } from '../types';

// ─── Portrait layer ────────────────────────────────────────────────────────────

// Portrait display dimensions – maintain 832:1216 aspect ratio
const PORTRAIT_W = 120;
const PORTRAIT_H = Math.round(PORTRAIT_W * (1216 / 832)); // ≈ 175

interface PortraitPos {
  characterId: string;
  side: 'left' | 'right';
  /** px from the top of the *document* (scroll container content), not the viewport */
  top: number;
}

/**
 * Scan the editor's DOM for `span[data-character-id]` elements and compute
 * one portrait position per continuous run of the same character.
 */
function computePortraitPositions(container: HTMLElement): PortraitPos[] {
  const scrollTop = container.scrollTop;
  const containerRect = container.getBoundingClientRect();

  const spans = Array.from(
    container.querySelectorAll<HTMLElement>('span[data-character-id]')
  );

  const positions: PortraitPos[] = [];
  let prevCharId: string | null = null;

  for (const span of spans) {
    const charId = span.getAttribute('data-character-id');
    const side = (span.getAttribute('data-side') ?? 'left') as 'left' | 'right';
    if (!charId) continue;

    // New block starts whenever the character changes
    if (charId !== prevCharId) {
      const spanRect = span.getBoundingClientRect();
      // Position in document space (scrollTop compensates for any scrolling)
      const top = spanRect.top - containerRect.top + scrollTop;
      positions.push({ characterId: charId, side, top });
    }
    prevCharId = charId;
  }

  return positions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Walk existing document marks and build a characterId → side map.
 * Used by App.tsx when deciding which side to assign new speakers.
 */
export function getExistingSides(editor: Editor): Map<string, 'left' | 'right'> {
  const map = new Map<string, 'left' | 'right'>();
  editor.state.doc.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'characterDialogue') {
        const { characterId, side } = mark.attrs as { characterId: string; side: 'left' | 'right' };
        if (characterId && !map.has(characterId)) map.set(characterId, side);
      }
    }
  });
  return map;
}

// ─── Handle ───────────────────────────────────────────────────────────────────

export interface StoryEditorHandle {
  getHTML: () => string;
  getText: () => string;
  appendHTML: (html: string) => void;
  setContent: (html: string) => void;
  focus: () => void;
  getExistingSides: () => Map<string, 'left' | 'right'>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialContent?: string;
  readOnly?: boolean;
  characters?: Character[];
}

// ─── Component ────────────────────────────────────────────────────────────────

const StoryEditor = forwardRef<StoryEditorHandle, Props>(
  ({ initialContent = '', readOnly = false, characters = [] }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [portraits, setPortraits] = useState<PortraitPos[]>([]);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Placeholder.configure({
          placeholder:
            'Begin your story here, then press Generate to have the AI continue it…',
        }),
        Typography,
        CharacterDialogue,
      ],
      content: initialContent || '<p></p>',
      editable: !readOnly,
      editorProps: {
        attributes: {
          class:
            'min-h-full w-full outline-none text-slate-200 font-serif text-lg leading-8 prose prose-invert max-w-none',
          spellcheck: 'true',
        },
      },
    });

    // Sync readOnly
    useEffect(() => {
      if (editor && readOnly !== !editor.isEditable) {
        editor.setEditable(!readOnly);
      }
    }, [editor, readOnly]);

    // Recompute portrait positions whenever the editor content or scroll changes
    const recompute = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      setPortraits(computePortraitPositions(container));
    }, []);

    useEffect(() => {
      if (!editor) return;
      editor.on('update', recompute);
      editor.on('transaction', recompute);
      return () => {
        editor.off('update', recompute);
        editor.off('transaction', recompute);
      };
    }, [editor, recompute]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      container.addEventListener('scroll', recompute, { passive: true });
      window.addEventListener('resize', recompute, { passive: true });
      return () => {
        container.removeEventListener('scroll', recompute);
        window.removeEventListener('resize', recompute);
      };
    }, [recompute]);

    // Expose handle
    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() ?? '',
      getText: () => editor?.getText() ?? '',
      appendHTML: (html: string) => {
        if (!editor) return;
        editor.commands.focus('end');
        editor.commands.insertContent(html);
        // Recompute after insert (next tick, after DOM updates)
        setTimeout(recompute, 50);
      },
      setContent: (html: string) => {
        if (!editor) return;
        editor.commands.setContent(html || '<p></p>');
        setTimeout(recompute, 50);
      },
      focus: () => editor?.commands.focus(),
      getExistingSides: () => (editor ? getExistingSides(editor) : new Map()),
    }));

    // Build a lookup from characterId → Character for portrait rendering
    const charById = new Map(characters.map((c) => [c.id, c]));

    return (
      <div ref={containerRef} className="relative flex-1 overflow-y-auto">
        {/* ── Portrait layer ── */}
        {portraits.map((pos, i) => {
          const char = charById.get(pos.characterId);
          if (!char?.portrait) return null;

          const style: React.CSSProperties = {
            position: 'absolute',
            top: pos.top,
            width: PORTRAIT_W,
            height: PORTRAIT_H,
            objectFit: 'cover',
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            // Nudge portraits slightly so they clear the text box edges
            ...(pos.side === 'left'
              ? { left: 8 }
              : { right: 8 }),
            // Smooth position transitions as new dialogue appears
            transition: 'top 0.2s ease',
          };

          return (
            <img
              key={`${pos.characterId}-${i}`}
              src={char.portrait}
              alt={char.name}
              style={style}
              className="pointer-events-none select-none"
            />
          );
        })}

        {/* ── Editor content ── */}
        <div className="mx-auto max-w-3xl px-8 py-10">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }
);

StoryEditor.displayName = 'StoryEditor';
export default StoryEditor;
