/**
 * Extract plain text from TipTap HTML output, preserving paragraph breaks.
 */
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  // Replace <br> tags with newlines before extracting text
  div.querySelectorAll('br').forEach((br) => {
    br.replaceWith('\n');
  });

  // Replace block elements with double newlines
  div.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li').forEach((el) => {
    el.insertAdjacentText('afterend', '\n\n');
  });

  return (div.textContent ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Count words in a plain text string.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Return the last n words from a plain text string.
 */
export function getLastNWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  return words.slice(-n).join(' ');
}

/**
 * Convert plain text (with \n\n paragraph breaks) to TipTap-compatible HTML.
 */
export function plainTextToHTML(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
