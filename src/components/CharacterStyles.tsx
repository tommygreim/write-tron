import { useEffect } from 'react';
import { Character } from '../types';

const STYLE_TAG_ID = 'wt-character-dialogue-styles';

/**
 * Injects a <style> tag into <head> that applies each character's dialogue
 * colour and font to their marked spans.  The tag is updated whenever the
 * characters array changes, so edits in the Lore panel are reflected
 * immediately in the editor without touching TipTap's content.
 */
export default function CharacterStyles({ characters }: { characters: Character[] }) {
  useEffect(() => {
    let el = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_TAG_ID;
      document.head.appendChild(el);
    }

    const rules = characters
      .filter((c) => c.dialogueColor || c.dialogueFont)
      .map((c) => {
        const decls: string[] = [];
        if (c.dialogueColor) decls.push(`color: ${c.dialogueColor}`);
        if (c.dialogueFont) decls.push(`font-family: ${c.dialogueFont}`);
        return `span[data-character-id="${c.id}"] { ${decls.join('; ')} }`;
      });

    el.textContent = rules.join('\n');

    return () => {
      // Leave the tag alive on unmount so styles don't flash off during
      // re-renders; it will be overwritten on the next effect run.
    };
  }, [characters]);

  return null;
}
