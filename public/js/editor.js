/**
 * Write-Tron — WYSIWYG editor core
 *
 * Approach: the editor surface is a contenteditable <div>.  Formatting is
 * applied in two ways depending on the control:
 *
 *   1. Selection-based (font family, font size, bold/italic/underline):
 *      Wraps the current selection in a <span> (or <b>/<i>/<u>) via
 *      document.execCommand or manual range manipulation so that different
 *      parts of the document can use different fonts/sizes.
 *
 *   2. Document-wide (line spacing): Applied as a CSS property on the
 *      editor element itself, affecting all content uniformly.
 */

(function () {
  'use strict';

  // ── DOM refs ─────────────────────────────────────────
  const editor       = document.getElementById('editor');
  const fontFamily   = document.getElementById('font-family');
  const fontSize     = document.getElementById('font-size');
  const lineSpacing  = document.getElementById('line-spacing');
  const btnBold      = document.getElementById('btn-bold');
  const btnItalic    = document.getElementById('btn-italic');
  const btnUnderline = document.getElementById('btn-underline');

  // ── Helpers ──────────────────────────────────────────

  /** Re-focus the editor without disturbing the selection. */
  function refocusEditor() {
    if (document.activeElement !== editor) {
      editor.focus();
    }
  }

  /**
   * Apply a font-related style to the current selection by using
   * execCommand with fontSize (which creates <font> tags) and then
   * normalizing those into styled <span> elements.
   */
  function applyFontToSelection(property, value) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // If nothing is selected, execCommand will still set the "insertion"
    // style so the *next* typed characters pick it up.
    // We use a temporary fontSize command to get a wrapping element, then
    // restyle it.  This is the classic trick for contenteditable styling.
    document.execCommand('fontSize', false, '7'); // size 7 = largest, easy to find

    // Find all <font size="7"> elements the command just created and
    // convert them to spans with the desired style.
    const fonts = editor.querySelectorAll('font[size="7"]');
    fonts.forEach((fontEl) => {
      const span = document.createElement('span');
      span.innerHTML = fontEl.innerHTML;

      // Carry over any existing inline styles from a parent span so we
      // don't lose the other property when setting one.
      const parentSpan = fontEl.closest('span');
      if (parentSpan) {
        span.style.cssText = parentSpan.style.cssText;
      }

      span.style[property] = value;
      fontEl.replaceWith(span);
    });
  }

  // ── Font family ──────────────────────────────────────
  fontFamily.addEventListener('change', () => {
    refocusEditor();
    const value = fontFamily.value;
    const sel = window.getSelection();

    if (sel && sel.toString().length > 0) {
      applyFontToSelection('fontFamily', value);
    } else {
      // No selection — change the default for new text by setting it on the
      // editor element.  Any already-styled spans keep their own font.
      editor.style.fontFamily = value;
    }
  });

  // ── Font size ────────────────────────────────────────
  fontSize.addEventListener('change', () => {
    refocusEditor();
    const value = fontSize.value + 'pt';
    const sel = window.getSelection();

    if (sel && sel.toString().length > 0) {
      applyFontToSelection('fontSize', value);
    } else {
      editor.style.fontSize = value;
    }
  });

  // ── Line spacing (document-wide) ────────────────────
  lineSpacing.addEventListener('change', () => {
    editor.style.lineHeight = lineSpacing.value;
    refocusEditor();
  });

  // ── Bold / Italic / Underline ────────────────────────
  function toggleInlineCommand(command, button) {
    refocusEditor();
    document.execCommand(command, false, null);
    button.classList.toggle('active', document.queryCommandState(command));
  }

  btnBold.addEventListener('click',      () => toggleInlineCommand('bold', btnBold));
  btnItalic.addEventListener('click',    () => toggleInlineCommand('italic', btnItalic));
  btnUnderline.addEventListener('click', () => toggleInlineCommand('underline', btnUnderline));

  // Keep toggle-button highlights in sync as the caret moves.
  editor.addEventListener('keyup',     updateToggleStates);
  editor.addEventListener('mouseup',   updateToggleStates);
  editor.addEventListener('click',     updateToggleStates);

  function updateToggleStates() {
    btnBold.classList.toggle('active',      document.queryCommandState('bold'));
    btnItalic.classList.toggle('active',    document.queryCommandState('italic'));
    btnUnderline.classList.toggle('active', document.queryCommandState('underline'));
  }

  // ── Sync toolbar dropdowns with caret position ──────
  editor.addEventListener('keyup',   syncToolbarToSelection);
  editor.addEventListener('mouseup', syncToolbarToSelection);
  editor.addEventListener('click',   syncToolbarToSelection);

  function syncToolbarToSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    if (!node || !editor.contains(node)) return;

    const computed = window.getComputedStyle(node);

    // Reflect font size — round to nearest integer pt.
    const pxSize = parseFloat(computed.fontSize);
    const ptSize = Math.round(pxSize * 72 / 96); // 96 DPI assumed
    // Pick the closest option in the dropdown.
    const sizeOption = [...fontSize.options].find((o) => Number(o.value) === ptSize);
    if (sizeOption) {
      fontSize.value = sizeOption.value;
    }

    // Reflect font family — match against dropdown values (first family token).
    const rawFamily = computed.fontFamily;
    const match = [...fontFamily.options].find((o) => {
      const first = o.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
      return rawFamily.toLowerCase().includes(first);
    });
    if (match) {
      fontFamily.value = match.value;
    }
  }

  // ── Initialize defaults ──────────────────────────────
  editor.style.fontFamily  = fontFamily.value;
  editor.style.fontSize    = fontSize.value + 'pt';
  editor.style.lineHeight  = lineSpacing.value;
})();
