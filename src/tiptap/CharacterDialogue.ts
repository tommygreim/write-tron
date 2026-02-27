import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * A TipTap inline mark that tags a span of text as dialogue spoken by a
 * specific character.  Attributes:
 *   characterId  – the Character.id from the lore
 *   side         – 'left' | 'right'  (which gutter the portrait appears in)
 */
export const CharacterDialogue = Mark.create({
  name: 'characterDialogue',

  // Marks can span across inline content but not block nodes
  spanning: true,
  inclusive: false, // don't extend the mark when typing after it

  addAttributes() {
    return {
      characterId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-character-id'),
        renderHTML: (attrs) =>
          attrs.characterId ? { 'data-character-id': attrs.characterId } : {},
      },
      side: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-side') ?? 'left',
        renderHTML: (attrs) => ({ 'data-side': attrs.side }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-character-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ class: 'char-dialogue' }, HTMLAttributes),
      0,
    ];
  },
});
