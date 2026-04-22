// WriteTron Editor - WYSIWYG word processor
(function () {
  'use strict';

  // ---- DOM refs ----
  const page = document.getElementById('page');
  const editorScroll = document.getElementById('editor-scroll');
  const sidebar = document.getElementById('sidebar');
  const sidebarList = document.getElementById('sidebar-list');
  const statusBar = document.getElementById('status-bar');
  const wordCountDisplay = document.getElementById('word-count-display');
  const dailyStatsDisplay = document.getElementById('daily-stats-display');

  const fontFamilySelect = document.getElementById('font-family');
  const fontSizeSelect = document.getElementById('font-size');
  const lineSpacingSelect = document.getElementById('line-spacing');
  const paragraphSpacingSelect = document.getElementById('paragraph-spacing');
  const pageWidthSlider = document.getElementById('page-width-slider');
  const pageWidthLabel = document.getElementById('page-width-label');

  const btnBold = document.getElementById('btn-bold');
  const btnItalic = document.getElementById('btn-italic');
  const btnStrikethrough = document.getElementById('btn-strikethrough');
  const btnHeading = document.getElementById('btn-heading');
  const btnExcludeWC = document.getElementById('btn-exclude-wc');
  const btnIndent = document.getElementById('btn-indent');
  const btnOutdent = document.getElementById('btn-outdent');
  const btnFirstLineIndent = document.getElementById('btn-first-line-indent');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnToggleStats = document.getElementById('btn-toggle-stats');

  // ---- State ----
  let paragraphIdCounter = 1;
  let statsVisible = true;
  let sidebarVisible = true;

  // Daily word tracking
  const STORAGE_KEY_SNAPSHOT = 'writetron_daily_snapshot';
  const STORAGE_KEY_SNAPSHOT_DATE = 'writetron_snapshot_date';
  const STORAGE_KEY_ADDED = 'writetron_added_today';
  const STORAGE_KEY_REMOVED = 'writetron_removed_today';
  let lastKnownWordCount = null;

  // ---- Utilities ----
  function generateParagraphId() {
    return 'p-' + (++paragraphIdCounter);
  }

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Count words in a text string */
  function countWordsInText(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  /** Get all paragraph elements */
  function getAllParagraphs() {
    return Array.from(page.querySelectorAll('.paragraph'));
  }

  /** Get the paragraph element that contains the current selection */
  function getActiveParagraph() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.anchorNode;
    while (node && node !== page) {
      if (node.nodeType === 1 && node.classList && node.classList.contains('paragraph')) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  /** Get indent level (0-5) from paragraph class */
  function getIndentLevel(para) {
    for (let i = 5; i >= 1; i--) {
      if (para.classList.contains('indent-' + i)) return i;
    }
    return 0;
  }

  /** Set indent level on a paragraph */
  function setIndentLevel(para, level) {
    for (let i = 1; i <= 5; i++) {
      para.classList.remove('indent-' + i);
    }
    if (level >= 1 && level <= 5) {
      para.classList.add('indent-' + level);
    }
  }

  // ---- Page width ----
  function applyPageWidth(pct) {
    editorScroll.style.width = pct + '%';
    pageWidthLabel.textContent = pct + '%';
  }

  pageWidthSlider.addEventListener('input', () => {
    applyPageWidth(pageWidthSlider.value);
    localStorage.setItem('writetron_page_width', pageWidthSlider.value);
  });

  // Restore saved page width
  const savedWidth = localStorage.getItem('writetron_page_width');
  if (savedWidth) {
    pageWidthSlider.value = savedWidth;
    applyPageWidth(savedWidth);
  } else {
    applyPageWidth(pageWidthSlider.value);
  }

  // ---- Line spacing ----
  function applyLineSpacing(val) {
    page.style.lineHeight = val;
  }

  lineSpacingSelect.addEventListener('change', () => {
    applyLineSpacing(lineSpacingSelect.value);
    localStorage.setItem('writetron_line_spacing', lineSpacingSelect.value);
  });

  const savedLineSpacing = localStorage.getItem('writetron_line_spacing');
  if (savedLineSpacing) {
    lineSpacingSelect.value = savedLineSpacing;
    applyLineSpacing(savedLineSpacing);
  }

  // ---- Paragraph spacing ----
  function applyParagraphSpacing(val) {
    document.documentElement.style.setProperty('--paragraph-spacing', val + 'pt');
  }

  paragraphSpacingSelect.addEventListener('change', () => {
    applyParagraphSpacing(paragraphSpacingSelect.value);
    localStorage.setItem('writetron_para_spacing', paragraphSpacingSelect.value);
  });

  const savedParaSpacing = localStorage.getItem('writetron_para_spacing');
  if (savedParaSpacing) {
    paragraphSpacingSelect.value = savedParaSpacing;
    applyParagraphSpacing(savedParaSpacing);
  }

  // ---- Font controls ----
  fontFamilySelect.addEventListener('change', () => {
    document.execCommand('fontName', false, fontFamilySelect.value);
    page.focus();
  });

  fontSizeSelect.addEventListener('change', () => {
    // execCommand fontSize only supports 1-7, so we use a span approach
    applyFontSize(fontSizeSelect.value + 'pt');
    page.focus();
  });

  function applyFontSize(size) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      // Insert a zero-width space with the new size so subsequent typing uses it
      const span = document.createElement('span');
      span.style.fontSize = size;
      span.textContent = '\u200B';
      range.insertNode(span);
      // Place cursor after the zero-width space
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    // Wrap selected text
    const span = document.createElement('span');
    span.style.fontSize = size;
    try {
      range.surroundContents(span);
    } catch (e) {
      // If surroundContents fails (partial node selection), use execCommand fallback
      document.execCommand('fontSize', false, '7');
      // Replace the font size 7 elements with our desired size
      const fontElements = page.querySelectorAll('font[size="7"]');
      fontElements.forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = size;
      });
    }
  }

  // ---- Formatting buttons ----
  btnBold.addEventListener('click', () => {
    document.execCommand('bold');
    page.focus();
    updateToolbarState();
  });

  btnItalic.addEventListener('click', () => {
    document.execCommand('italic');
    page.focus();
    updateToolbarState();
  });

  btnStrikethrough.addEventListener('click', () => {
    document.execCommand('strikeThrough');
    page.focus();
    updateToolbarState();
  });

  // ---- Section heading toggle ----
  btnHeading.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    para.classList.toggle('section-heading');
    updateSidebar();
    page.focus();
    updateToolbarState();
  });

  // ---- Exclude from word count ----
  btnExcludeWC.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    para.classList.toggle('exclude-wc');
    updateWordCount();
    page.focus();
    updateToolbarState();
  });

  // ---- Indent / Outdent ----
  btnIndent.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    const level = getIndentLevel(para);
    if (level < 5) setIndentLevel(para, level + 1);
    page.focus();
  });

  btnOutdent.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    const level = getIndentLevel(para);
    if (level > 0) setIndentLevel(para, level - 1);
    page.focus();
  });

  // ---- First-line indent toggle ----
  btnFirstLineIndent.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    para.classList.toggle('first-line-indent');
    page.focus();
    updateToolbarState();
  });

  // ---- Sidebar toggle ----
  btnToggleSidebar.addEventListener('click', () => {
    sidebarVisible = !sidebarVisible;
    sidebar.classList.toggle('hidden', !sidebarVisible);
    btnToggleSidebar.classList.toggle('active', sidebarVisible);
  });
  btnToggleSidebar.classList.add('active');

  // ---- Stats toggle ----
  btnToggleStats.addEventListener('click', () => {
    statsVisible = !statsVisible;
    statusBar.classList.toggle('stats-hidden', !statsVisible);
    btnToggleStats.classList.toggle('active', statsVisible);
    localStorage.setItem('writetron_stats_visible', statsVisible ? '1' : '0');
  });

  const savedStatsVisible = localStorage.getItem('writetron_stats_visible');
  if (savedStatsVisible === '0') {
    statsVisible = false;
    statusBar.classList.add('stats-hidden');
  } else {
    btnToggleStats.classList.add('active');
  }

  // ---- Keyboard shortcuts ----
  page.addEventListener('keydown', (e) => {
    // Ctrl+B / Cmd+B = Bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold');
      updateToolbarState();
      return;
    }
    // Ctrl+I / Cmd+I = Italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic');
      updateToolbarState();
      return;
    }
    // Ctrl+D = Strikethrough
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      document.execCommand('strikeThrough');
      updateToolbarState();
      return;
    }
    // Ctrl+H = Toggle heading
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault();
      const para = getActiveParagraph();
      if (para) {
        para.classList.toggle('section-heading');
        updateSidebar();
        updateToolbarState();
      }
      return;
    }
    // Tab = first-line indent, Shift+Tab = remove first-line indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const para = getActiveParagraph();
      if (!para) return;
      if (e.shiftKey) {
        para.classList.remove('first-line-indent');
      } else {
        para.classList.add('first-line-indent');
      }
      updateToolbarState();
      return;
    }
    // Enter = create new paragraph
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertNewParagraph();
      return;
    }
  });

  /** Insert a new paragraph block at the cursor position */
  function insertNewParagraph() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const currentPara = getActiveParagraph();
    if (!currentPara) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    // Split: everything after cursor goes to new paragraph
    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(currentPara, currentPara.childNodes.length);
    const afterContent = afterRange.extractContents();

    const newPara = document.createElement('div');
    newPara.className = 'paragraph';
    newPara.dataset.paragraphId = generateParagraphId();

    // Inherit indent from previous paragraph
    const indentLevel = getIndentLevel(currentPara);
    if (indentLevel > 0) setIndentLevel(newPara, indentLevel);

    // Inherit first-line indent
    if (currentPara.classList.contains('first-line-indent')) {
      newPara.classList.add('first-line-indent');
    }

    // Inherit exclude-wc status
    if (currentPara.classList.contains('exclude-wc')) {
      newPara.classList.add('exclude-wc');
    }

    if (afterContent.textContent.length > 0) {
      newPara.appendChild(afterContent);
    } else {
      newPara.innerHTML = '<br>';
    }

    // Ensure current para isn't empty
    if (!currentPara.textContent && !currentPara.querySelector('br')) {
      currentPara.innerHTML = '<br>';
    }

    currentPara.after(newPara);

    // Move cursor to start of new paragraph
    const newRange = document.createRange();
    newRange.setStart(newPara, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    scheduleUpdates();
  }

  // ---- Ensure editor always has at least one paragraph ----
  function ensureStructure() {
    const paras = page.querySelectorAll('.paragraph');
    if (paras.length === 0) {
      const p = document.createElement('div');
      p.className = 'paragraph';
      p.dataset.paragraphId = generateParagraphId();
      p.innerHTML = '<br>';
      page.appendChild(p);
    }
    // Remove any stray text nodes directly under page
    Array.from(page.childNodes).forEach(node => {
      if (node.nodeType === 3 && node.textContent.trim()) {
        const p = document.createElement('div');
        p.className = 'paragraph';
        p.dataset.paragraphId = generateParagraphId();
        p.textContent = node.textContent;
        page.replaceChild(p, node);
      } else if (node.nodeType === 3) {
        page.removeChild(node);
      } else if (node.nodeType === 1 && !node.classList.contains('paragraph')) {
        // Wrap non-paragraph elements
        const p = document.createElement('div');
        p.className = 'paragraph';
        p.dataset.paragraphId = generateParagraphId();
        page.replaceChild(p, node);
        p.appendChild(node);
      }
    });
  }

  // ---- Sidebar: update section list ----
  function updateSidebar() {
    sidebarList.innerHTML = '';
    const headings = page.querySelectorAll('.paragraph.section-heading');
    headings.forEach(h => {
      const text = h.textContent.trim() || '(empty heading)';
      const item = document.createElement('div');
      item.className = 'sidebar-item depth-1';
      item.textContent = text;
      item.addEventListener('click', () => {
        h.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief highlight
        h.style.background = '#fff3cd';
        setTimeout(() => { h.style.background = ''; }, 1200);
      });
      sidebarList.appendChild(item);
    });

    if (headings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sidebar-item';
      empty.textContent = 'No sections yet';
      empty.style.color = '#999';
      empty.style.fontStyle = 'italic';
      sidebarList.appendChild(empty);
    }
  }

  // ---- Word count & daily stats ----
  function getWordCount() {
    let total = 0;
    const paras = getAllParagraphs();
    paras.forEach(p => {
      if (p.classList.contains('exclude-wc')) return;
      total += countWordsInText(p.textContent);
    });
    return total;
  }

  function getTotalWordCountIncludingExcluded() {
    let total = 0;
    const paras = getAllParagraphs();
    paras.forEach(p => {
      total += countWordsInText(p.textContent);
    });
    return total;
  }

  function updateWordCount() {
    const count = getWordCount();
    wordCountDisplay.textContent = count.toLocaleString() + ' words';
    updateDailyStats(count);
  }

  function updateDailyStats(currentCount) {
    const today = getToday();
    const snapshotDate = localStorage.getItem(STORAGE_KEY_SNAPSHOT_DATE);

    // New day: reset cumulative tallies
    if (!snapshotDate || snapshotDate < today) {
      localStorage.setItem(STORAGE_KEY_SNAPSHOT_DATE, today);
      localStorage.setItem(STORAGE_KEY_SNAPSHOT, currentCount.toString());
      localStorage.setItem(STORAGE_KEY_ADDED, '0');
      localStorage.setItem(STORAGE_KEY_REMOVED, '0');
      lastKnownWordCount = currentCount;
    }

    // Accumulate deltas from each change
    if (lastKnownWordCount !== null && currentCount !== lastKnownWordCount) {
      const delta = currentCount - lastKnownWordCount;
      if (delta > 0) {
        const prev = parseInt(localStorage.getItem(STORAGE_KEY_ADDED) || '0', 10);
        localStorage.setItem(STORAGE_KEY_ADDED, (prev + delta).toString());
      } else {
        const prev = parseInt(localStorage.getItem(STORAGE_KEY_REMOVED) || '0', 10);
        localStorage.setItem(STORAGE_KEY_REMOVED, (prev + Math.abs(delta)).toString());
      }
    }
    lastKnownWordCount = currentCount;

    const added = parseInt(localStorage.getItem(STORAGE_KEY_ADDED) || '0', 10);
    const removed = parseInt(localStorage.getItem(STORAGE_KEY_REMOVED) || '0', 10);
    dailyStatsDisplay.textContent = '+' + added.toLocaleString() + ' / -' + removed.toLocaleString() + ' today';
  }

  // ---- Toolbar state reflection ----
  function updateToolbarState() {
    btnBold.classList.toggle('active', document.queryCommandState('bold'));
    btnItalic.classList.toggle('active', document.queryCommandState('italic'));
    btnStrikethrough.classList.toggle('active', document.queryCommandState('strikeThrough'));

    const para = getActiveParagraph();
    if (para) {
      btnHeading.classList.toggle('active', para.classList.contains('section-heading'));
      btnExcludeWC.classList.toggle('active', para.classList.contains('exclude-wc'));
      btnFirstLineIndent.classList.toggle('active', para.classList.contains('first-line-indent'));
    }
  }

  // ---- Debounced update scheduling ----
  let updateTimer = null;
  function scheduleUpdates() {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      ensureStructure();
      updateSidebar();
      updateWordCount();
    }, 200);
  }

  // ---- Input / mutation listener ----
  page.addEventListener('input', () => {
    scheduleUpdates();
  });

  // Update toolbar on selection change
  document.addEventListener('selectionchange', () => {
    updateToolbarState();
  });

  // ---- Handle paste: clean up and normalize into paragraphs ----
  page.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const lines = text.split(/\r?\n/);
    const currentPara = getActiveParagraph();

    if (lines.length === 1) {
      // Single line: just insert text
      const textNode = document.createTextNode(lines[0]);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // Multi-line: split current paragraph and insert new ones
      // Insert first line at cursor
      const firstText = document.createTextNode(lines[0]);
      range.insertNode(firstText);

      let lastInserted = currentPara;
      for (let i = 1; i < lines.length; i++) {
        const newPara = document.createElement('div');
        newPara.className = 'paragraph';
        newPara.dataset.paragraphId = generateParagraphId();
        newPara.textContent = lines[i] || '\u00A0';
        lastInserted.after(newPara);
        lastInserted = newPara;
      }

      // Move cursor to end of last paragraph
      const newRange = document.createRange();
      newRange.selectNodeContents(lastInserted);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    scheduleUpdates();
  });

  // ---- Handle backspace at start of paragraph: merge with previous ----
  page.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return; // let default handle selection delete

      const para = getActiveParagraph();
      if (!para) return;

      // Check if cursor is at the very start of the paragraph
      const preRange = document.createRange();
      preRange.setStart(para, 0);
      preRange.setEnd(range.startContainer, range.startOffset);
      const textBefore = preRange.toString();

      if (textBefore.length === 0) {
        const prevPara = para.previousElementSibling;
        if (prevPara && prevPara.classList.contains('paragraph')) {
          e.preventDefault();
          // If para is empty, just remove it
          if (!para.textContent || para.textContent === '\n') {
            para.remove();
            // Place cursor at end of previous paragraph
            const newRange = document.createRange();
            newRange.selectNodeContents(prevPara);
            newRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(newRange);
          } else {
            // Merge: move all content of current para into previous
            // Remove trailing BR from previous if present
            const lastChild = prevPara.lastChild;
            if (lastChild && lastChild.nodeName === 'BR') {
              lastChild.remove();
            }
            // Mark position for cursor
            const marker = document.createTextNode('');
            prevPara.appendChild(marker);
            // Move all children
            while (para.firstChild) {
              prevPara.appendChild(para.firstChild);
            }
            para.remove();
            // Place cursor at merge point
            const newRange = document.createRange();
            newRange.setStartAfter(marker);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            marker.remove();
          }
          scheduleUpdates();
        }
      }
    }
  });

  // ---- Large document support ----
  // Use a MutationObserver to monitor structure and only update what's needed
  const observer = new MutationObserver(() => {
    scheduleUpdates();
  });
  observer.observe(page, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // ---- Save & Load (localStorage for dev, file system for Electron) ----
  const STORAGE_KEY_DOC = 'writetron_document';
  const AUTOSAVE_INTERVAL = 3000;

  function serializeDocument() {
    const paras = getAllParagraphs();
    return paras.map(p => ({
      id: p.dataset.paragraphId || generateParagraphId(),
      html: p.innerHTML,
      classes: Array.from(p.classList).filter(c => c !== 'paragraph').join(' '),
    }));
  }

  function loadDocument(data) {
    page.innerHTML = '';
    if (!data || !data.length) {
      const p = document.createElement('div');
      p.className = 'paragraph';
      p.dataset.paragraphId = generateParagraphId();
      p.innerHTML = '<br>';
      page.appendChild(p);
      return;
    }
    // Use DocumentFragment for performance with large docs
    const fragment = document.createDocumentFragment();
    data.forEach(item => {
      const p = document.createElement('div');
      p.className = 'paragraph';
      if (item.classes) {
        item.classes.split(' ').forEach(c => {
          if (c) p.classList.add(c);
        });
      }
      p.dataset.paragraphId = item.id || generateParagraphId();
      p.innerHTML = item.html;
      fragment.appendChild(p);
    });
    page.appendChild(fragment);
    // Update counter to be higher than any existing id
    data.forEach(item => {
      if (item.id) {
        const num = parseInt(item.id.replace('p-', ''), 10);
        if (num > paragraphIdCounter) paragraphIdCounter = num;
      }
    });
  }

  function autoSave() {
    const doc = serializeDocument();
    try {
      localStorage.setItem(STORAGE_KEY_DOC, JSON.stringify(doc));
    } catch (e) {
      // localStorage full — in Electron, we'd use fs instead
      console.warn('Autosave failed:', e.message);
    }
  }

  function autoLoad() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOC);
      if (raw) {
        const data = JSON.parse(raw);
        loadDocument(data);
      }
    } catch (e) {
      console.warn('Load failed:', e.message);
    }
  }

  // Autosave on interval
  setInterval(autoSave, AUTOSAVE_INTERVAL);

  // Save before unload
  window.addEventListener('beforeunload', autoSave);

  // ---- Initialize ----
  autoLoad();
  ensureStructure();
  updateSidebar();
  // Seed lastKnownWordCount from storage before first updateWordCount call
  // so loading the document doesn't register as new words written today.
  lastKnownWordCount = getWordCount();
  updateWordCount();
  updateToolbarState();
  page.focus();

})();
