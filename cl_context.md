# WriteTron — AI Agent Context Document

## Project Overview

**write-tron** is a WYSIWYG word processor built as a single-page web app intended to run inside Electron. It has no framework dependencies — all editor logic is vanilla JavaScript. A minimal Express dev server is included for browser-based testing without Electron.

**Primary target runtime:** Electron (desktop app, file at `public/index.html` loaded directly via `file://`)  
**Dev fallback:** Express server at `localhost:3000` (`npm start`)

---

## File Map

```
write-tron/
├── main.js              # Electron main process — creates BrowserWindow, loads public/index.html
├── server.js            # Express dev server — serves public/ on port 3000
├── package.json         # name: write-tron, main: main.js, deps: express; devDeps: electron
├── public/
│   ├── index.html       # Single-page app shell: toolbar, sidebar, editor area, status bar
│   ├── styles.css       # All styling (no preprocessor)
│   └── editor.js        # All editor logic (self-contained IIFE, vanilla JS)
└── README.md            # Placeholder only (one line: "# write-tron")
```

---

## Architecture

### Electron Entry (`main.js`)
- Creates a 1400×900 `BrowserWindow`
- `nodeIntegration: true`, `contextIsolation: false` — the renderer has full Node.js access
- Loads `public/index.html` directly via `loadFile()`
- Standard macOS lifecycle handling (`window-all-closed`, `activate`)

### Dev Server (`server.js`)
- Express static file server; serves `public/` on port 3000
- Used only during development; has no API routes

### UI Shell (`public/index.html`)
Three layout regions:
1. **`#toolbar`** — flex row of controls (font family/size, bold/italic/strikethrough, heading, word-count exclusion, indent/outdent/first-line-indent, line spacing, paragraph spacing, page width slider, sidebar toggle, stats toggle)
2. **`#main-container`** — flex row of `#sidebar` + `#editor-wrapper`
   - `#sidebar` → `#sidebar-list` (section heading navigation)
   - `#editor-wrapper` → `#editor-scroll` → `#page` (the `contenteditable` editing surface)
3. **`#status-bar`** — fixed footer with word count and daily delta stats

The editor is initialized with one empty paragraph div: `<div class="paragraph" data-paragraph-id="p-1"><br></div>`.

---

## Editor Logic (`public/editor.js`)

Wrapped in a strict-mode IIFE; no module system, no build step.

### Core Data Model

The document is a flat list of `<div class="paragraph">` elements inside `#page`. Each paragraph has:
- `data-paragraph-id` — unique identifier (format: `"p-N"`, auto-incremented)
- CSS classes that encode block-level formatting:
  - `section-heading` — marks a paragraph as a navigable section header (no visual style; purely structural)
  - `indent-1` through `indent-5` — block indent levels (0.5in steps)
  - `first-line-indent` — adds `text-indent: 0.5in`
  - `exclude-wc` — excluded from word count (shown with an amber left-border + "WC excluded" label)

Inline formatting (bold, italic, strikethrough, font family, font size) is applied via `document.execCommand` or manual `<span>` wrapping.

### State Variables

| Variable | Purpose |
|---|---|
| `paragraphIdCounter` | Monotonically increasing integer for paragraph IDs |
| `statsVisible` | Whether the status bar word count is displayed |
| `sidebarVisible` | Whether the sidebar is shown |
| `lastKnownWordCount` | Previous word count, used to compute daily deltas |

### Key Functions

| Function | Description |
|---|---|
| `generateParagraphId()` | Returns next `"p-N"` id |
| `getToday()` | Returns `"YYYY-MM-DD"` string |
| `countWordsInText(text)` | Splits trimmed text on `\s+`; returns 0 for empty |
| `getAllParagraphs()` | `querySelectorAll('.paragraph')` on `#page` |
| `getActiveParagraph()` | Walks selection anchor up the DOM to find nearest `.paragraph` |
| `getIndentLevel(para)` | Returns 0-5 based on `indent-N` class |
| `setIndentLevel(para, level)` | Clears all `indent-N`, sets the new one |
| `applyPageWidth(pct)` | Sets `editorScroll.style.width`, updates label |
| `applyLineSpacing(val)` | Sets `page.style.lineHeight` |
| `applyParagraphSpacing(val)` | Sets CSS var `--paragraph-spacing` on `:root` |
| `applyFontSize(size)` | Wraps selection in `<span style="font-size:...">` or inserts zero-width-space span at cursor |
| `insertNewParagraph()` | Splits current paragraph at cursor; new paragraph inherits indent, first-line-indent, exclude-wc classes |
| `ensureStructure()` | Guarantees at least one `.paragraph` exists; wraps stray text nodes and non-paragraph elements |
| `updateSidebar()` | Rebuilds `#sidebar-list` from all `.section-heading` paragraphs |
| `getWordCount()` | Sums `countWordsInText` over all non-`exclude-wc` paragraphs |
| `updateWordCount()` | Updates `#word-count-display` and triggers `updateDailyStats` |
| `updateDailyStats(count)` | Accumulates added/removed word deltas in localStorage; resets on new day |
| `updateToolbarState()` | Reflects `queryCommandState` and paragraph classes onto toolbar button active states |
| `scheduleUpdates()` | Debounced 200ms call to `ensureStructure + updateSidebar + updateWordCount` |
| `serializeDocument()` | Returns array of `{id, html, classes}` objects for all paragraphs |
| `loadDocument(data)` | Rebuilds `#page` from serialized data using a `DocumentFragment` |
| `autoSave()` | `JSON.stringify(serializeDocument())` → `localStorage[STORAGE_KEY_DOC]` |
| `autoLoad()` | Parses and calls `loadDocument()` from localStorage on startup |

### Persistence (localStorage)

All persistence is client-side localStorage:

| Key | Value |
|---|---|
| `writetron_document` | JSON array of serialized paragraph objects |
| `writetron_page_width` | Number string (30–100), percent |
| `writetron_line_spacing` | Number string (1, 1.15, 1.5, 2, 2.5, 3) |
| `writetron_para_spacing` | Number string in pt (0, 6, 8, 12, 18, 24) |
| `writetron_stats_visible` | `"1"` or `"0"` |
| `writetron_daily_snapshot` | Word count at start of current day |
| `writetron_snapshot_date` | ISO date string `"YYYY-MM-DD"` |
| `writetron_added_today` | Cumulative words added today |
| `writetron_removed_today` | Cumulative words removed today |

Autosave fires every 3000ms (`AUTOSAVE_INTERVAL`) and on `beforeunload`.

Note: the code contains a comment indicating that in a full Electron build, `fs` (Node.js filesystem API) would replace localStorage for document storage — this has not been implemented yet.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+B` | Bold |
| `Ctrl/Cmd+I` | Italic |
| `Ctrl/Cmd+D` | Strikethrough |
| `Ctrl/Cmd+H` | Toggle section heading on current paragraph |
| `Tab` | Add first-line indent to current paragraph |
| `Shift+Tab` | Remove first-line indent from current paragraph |
| `Enter` | Insert new paragraph (custom handler; default browser behavior suppressed) |
| `Backspace` at start of paragraph | Merge paragraph into previous (or delete if empty) |

### Event Wiring

- `page` `input` → `scheduleUpdates()`
- `document` `selectionchange` → `updateToolbarState()`
- `page` `paste` → custom plain-text paste that splits on newlines into multiple paragraphs
- `page` `keydown` — handles Enter, Backspace, Tab, and formatting shortcuts
- `MutationObserver` on `#page` (childList + subtree + characterData) → `scheduleUpdates()`

---

## Styling (`public/styles.css`)

No preprocessor; plain CSS. Key design decisions:

- **Layout:** `#toolbar` (fixed height ~42px) + `#main-container` (flex, fills remaining height minus status bar) + `#status-bar` (fixed 28px)
- **Page width:** Controlled by inline style on `#editor-scroll` (width set directly); default 60%, slider range 30–100%
- **Line spacing:** CSS var `--line-spacing` on `#page` (not used in the stylesheet directly; `applyLineSpacing` sets `page.style.lineHeight` inline)
- **Paragraph spacing:** CSS var `--paragraph-spacing` on `:root`; consumed by `.paragraph { margin-bottom: var(--paragraph-spacing, 8pt) }`
- **Section headings:** `.paragraph.section-heading` has an empty rule — headings have no visual differentiation from body text by design (structural only)
- **Indent levels:** `.paragraph.indent-1` through `.indent-5` at 0.5in increments
- **Exclude-WC visual:** amber left border + absolute-positioned "WC excluded" label in top-right of paragraph
- **Sidebar collapse:** `.sidebar.hidden` sets `width: 0; min-width: 0` with a CSS transition
- **Toolbar active state:** `.toolbar-btn.active { background: #cde; border-color: #89a }`
- **Scrollbars:** Custom WebKit scrollbar styling on `#editor-wrapper` and `#sidebar-list`

---

## Known Gaps / Future Work

- **No file system persistence:** `autoSave`/`autoLoad` use localStorage. The code comments acknowledge that a production Electron build should use `fs`. This is the most significant missing feature.
- **No undo/redo beyond browser default:** No custom undo stack.
- **No export:** No PDF, `.docx`, or plain text export.
- **Section heading visual style:** The `.section-heading` CSS rule is intentionally empty — headings are indistinguishable from body text visually. Whether this is intentional or a planned future feature is unclear.
- **Font size via execCommand:** `applyFontSize` has a `surroundContents` fallback using the deprecated `font[size="7"]` approach; this is a known quirk of cross-browser contenteditable font size handling.
- **`nodeIntegration: true`:** Security model is permissive (appropriate for a local-only desktop app, but worth noting if the app ever loads remote content).

---

## Running the App

```bash
# Dev mode (browser)
npm start
# → http://localhost:3000

# Electron
npm run electron
# or: npx electron main.js
```

Dependencies: `express` (runtime), `electron` (devDependency). Install with `npm install`.
