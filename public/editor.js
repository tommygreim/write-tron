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

  const btnNew = document.getElementById('btn-new');
  const btnOpen = document.getElementById('btn-open');
  const btnSave = document.getElementById('btn-save');
  const btnSaveAs = document.getElementById('btn-save-as');
  const fileInput = document.getElementById('file-input');
  const docNameEl = document.getElementById('doc-name');
  const dirtyIndicatorEl = document.getElementById('dirty-indicator');

  // ---- State ----
  let paragraphIdCounter = 1;
  let statsVisible = true;
  let sidebarVisible = true;

  const STORAGE_KEY_SNAPSHOT = 'writetron_daily_snapshot';
  const STORAGE_KEY_SNAPSHOT_DATE = 'writetron_snapshot_date';
  const STORAGE_KEY_ADDED = 'writetron_added_today';
  const STORAGE_KEY_REMOVED = 'writetron_removed_today';
  let lastKnownWordCount = null;

  // File state
  let currentFilePath = null;
  let isDirty = false;

  const isElectron = (() => {
    try { return typeof require !== 'undefined' && !!require('electron').ipcRenderer; } catch (e) { return false; }
  })();
  const ipcRenderer = isElectron ? require('electron').ipcRenderer : null;

  // ---- Utilities ----
  function generateParagraphId() {
    return 'p-' + (++paragraphIdCounter);
  }

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function countWordsInText(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function getAllParagraphs() {
    return Array.from(page.querySelectorAll('.paragraph'));
  }

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

  function getIndentLevel(para) {
    for (let i = 5; i >= 1; i--) {
      if (para.classList.contains('indent-' + i)) return i;
    }
    return 0;
  }

  function setIndentLevel(para, level) {
    for (let i = 1; i <= 5; i++) {
      para.classList.remove('indent-' + i);
    }
    if (level >= 1 && level <= 5) {
      para.classList.add('indent-' + level);
    }
  }

  // ---- Dirty state & document title ----
  function setDirty(value) {
    isDirty = value;
    if (dirtyIndicatorEl) dirtyIndicatorEl.textContent = value ? ' ●' : '';
  }

  function updateDocTitle(filePath) {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled';
    if (docNameEl) docNameEl.textContent = name;
    document.title = 'WriteTron — ' + name;
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
    applyFontSize(fontSizeSelect.value + 'pt');
    page.focus();
  });

  function applyFontSize(size) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = size;
      span.textContent = '​';
      range.insertNode(span);
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    const span = document.createElement('span');
    span.style.fontSize = size;
    try {
      range.surroundContents(span);
    } catch (e) {
      document.execCommand('fontSize', false, '7');
      page.querySelectorAll('font[size="7"]').forEach(el => {
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
    setDirty(true);
    updateSidebar();
    page.focus();
    updateToolbarState();
  });

  // ---- Exclude from word count ----
  btnExcludeWC.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    para.classList.toggle('exclude-wc');
    setDirty(true);
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
    setDirty(true);
    page.focus();
  });

  btnOutdent.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    const level = getIndentLevel(para);
    if (level > 0) setIndentLevel(para, level - 1);
    setDirty(true);
    page.focus();
  });

  // ---- First-line indent toggle ----
  btnFirstLineIndent.addEventListener('click', () => {
    const para = getActiveParagraph();
    if (!para) return;
    para.classList.toggle('first-line-indent');
    setDirty(true);
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

  // ---- Page-level keyboard shortcuts ----
  page.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold');
      updateToolbarState();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic');
      updateToolbarState();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      document.execCommand('strikeThrough');
      updateToolbarState();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault();
      const para = getActiveParagraph();
      if (para) {
        para.classList.toggle('section-heading');
        setDirty(true);
        updateSidebar();
        updateToolbarState();
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const para = getActiveParagraph();
      if (!para) return;
      if (e.shiftKey) {
        para.classList.remove('first-line-indent');
      } else {
        para.classList.add('first-line-indent');
      }
      setDirty(true);
      updateToolbarState();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertNewParagraph();
      return;
    }
  });

  // ---- Global keyboard shortcuts (file ops) ----
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'n') { e.preventDefault(); newDocument(); return; }
    if (e.key === 'o') { e.preventDefault(); openDocumentFile(); return; }
    if (e.key === 's') { e.preventDefault(); saveDocumentFile(e.shiftKey); return; }
  });

  // ---- Insert new paragraph ----
  function insertNewParagraph() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const currentPara = getActiveParagraph();
    if (!currentPara) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(currentPara, currentPara.childNodes.length);
    const afterContent = afterRange.extractContents();

    const newPara = document.createElement('div');
    newPara.className = 'paragraph';
    newPara.dataset.paragraphId = generateParagraphId();

    const indentLevel = getIndentLevel(currentPara);
    if (indentLevel > 0) setIndentLevel(newPara, indentLevel);

    if (currentPara.classList.contains('first-line-indent')) {
      newPara.classList.add('first-line-indent');
    }
    if (currentPara.classList.contains('exclude-wc')) {
      newPara.classList.add('exclude-wc');
    }

    if (afterContent.textContent.length > 0) {
      newPara.appendChild(afterContent);
    } else {
      newPara.innerHTML = '<br>';
    }

    if (!currentPara.textContent && !currentPara.querySelector('br')) {
      currentPara.innerHTML = '<br>';
    }

    currentPara.after(newPara);

    const newRange = document.createRange();
    newRange.setStart(newPara, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setDirty(true);
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
        const p = document.createElement('div');
        p.className = 'paragraph';
        p.dataset.paragraphId = generateParagraphId();
        page.replaceChild(p, node);
        p.appendChild(node);
      }
    });
  }

  // ---- Sidebar ----
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
        h.style.background = 'rgba(91, 142, 240, 0.1)';
        setTimeout(() => { h.style.background = ''; }, 1200);
      });
      sidebarList.appendChild(item);
    });

    if (headings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sidebar-item';
      empty.textContent = 'No sections yet';
      empty.style.color = '#3d4154';
      empty.style.fontStyle = 'italic';
      sidebarList.appendChild(empty);
    }
  }

  // ---- Word count & daily stats ----
  function getWordCount() {
    let total = 0;
    getAllParagraphs().forEach(p => {
      if (!p.classList.contains('exclude-wc')) total += countWordsInText(p.textContent);
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

    if (!snapshotDate || snapshotDate < today) {
      localStorage.setItem(STORAGE_KEY_SNAPSHOT_DATE, today);
      localStorage.setItem(STORAGE_KEY_SNAPSHOT, currentCount.toString());
      localStorage.setItem(STORAGE_KEY_ADDED, '0');
      localStorage.setItem(STORAGE_KEY_REMOVED, '0');
      lastKnownWordCount = currentCount;
    }

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

  // ---- Toolbar state ----
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

  // ---- Debounced updates ----
  let updateTimer = null;
  function scheduleUpdates() {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      ensureStructure();
      updateSidebar();
      updateWordCount();
    }, 200);
  }

  // ---- Content event listeners ----
  page.addEventListener('input', () => {
    setDirty(true);
    scheduleUpdates();
  });

  document.addEventListener('selectionchange', () => {
    updateToolbarState();
  });

  // ---- Paste handler ----
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
      const textNode = document.createTextNode(lines[0]);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      const firstText = document.createTextNode(lines[0]);
      range.insertNode(firstText);

      let lastInserted = currentPara;
      for (let i = 1; i < lines.length; i++) {
        const newPara = document.createElement('div');
        newPara.className = 'paragraph';
        newPara.dataset.paragraphId = generateParagraphId();
        newPara.textContent = lines[i] || ' ';
        lastInserted.after(newPara);
        lastInserted = newPara;
      }

      const newRange = document.createRange();
      newRange.selectNodeContents(lastInserted);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    setDirty(true);
    scheduleUpdates();
  });

  // ---- Backspace: merge paragraphs ----
  page.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace') return;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;

    const para = getActiveParagraph();
    if (!para) return;

    const preRange = document.createRange();
    preRange.setStart(para, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const textBefore = preRange.toString();

    if (textBefore.length === 0) {
      const prevPara = para.previousElementSibling;
      if (prevPara && prevPara.classList.contains('paragraph')) {
        e.preventDefault();
        if (!para.textContent || para.textContent === '\n') {
          para.remove();
          const newRange = document.createRange();
          newRange.selectNodeContents(prevPara);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          const lastChild = prevPara.lastChild;
          if (lastChild && lastChild.nodeName === 'BR') lastChild.remove();
          const marker = document.createTextNode('');
          prevPara.appendChild(marker);
          while (para.firstChild) prevPara.appendChild(para.firstChild);
          para.remove();
          const newRange = document.createRange();
          newRange.setStartAfter(marker);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          marker.remove();
        }
        setDirty(true);
        scheduleUpdates();
      }
    }
  });

  // ---- MutationObserver ----
  const observer = new MutationObserver(() => {
    scheduleUpdates();
  });
  observer.observe(page, { childList: true, subtree: true, characterData: true });

  // ---- localStorage crash-recovery persistence ----
  const STORAGE_KEY_DOC = 'writetron_document';
  const AUTOSAVE_INTERVAL = 3000;

  function serializeDocument() {
    return getAllParagraphs().map(p => ({
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
    const fragment = document.createDocumentFragment();
    data.forEach(item => {
      const p = document.createElement('div');
      p.className = 'paragraph';
      if (item.classes) {
        item.classes.split(' ').forEach(c => { if (c) p.classList.add(c); });
      }
      p.dataset.paragraphId = item.id || generateParagraphId();
      p.innerHTML = item.html;
      fragment.appendChild(p);
    });
    page.appendChild(fragment);
    data.forEach(item => {
      if (item.id) {
        const num = parseInt(item.id.replace('p-', ''), 10);
        if (num > paragraphIdCounter) paragraphIdCounter = num;
      }
    });
  }

  function autoSave() {
    try {
      localStorage.setItem(STORAGE_KEY_DOC, JSON.stringify(serializeDocument()));
    } catch (e) {
      console.warn('Autosave failed:', e.message);
    }
  }

  function autoLoad() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOC);
      if (raw) loadDocument(JSON.parse(raw));
    } catch (e) {
      console.warn('Load failed:', e.message);
    }
  }

  setInterval(autoSave, AUTOSAVE_INTERVAL);
  window.addEventListener('beforeunload', autoSave);

  // ---- File operations ----
  async function newDocument() {
    if (isDirty && !confirm('You have unsaved changes. Create a new document anyway?')) return;
    page.innerHTML = '';
    currentFilePath = null;
    setDirty(false);
    updateDocTitle(null);
    localStorage.removeItem(STORAGE_KEY_DOC);
    ensureStructure();
    updateSidebar();
    lastKnownWordCount = 0;
    updateWordCount();
    page.focus();
  }

  async function openDocumentFile() {
    if (isDirty && !confirm('You have unsaved changes. Open another document anyway?')) return;
    if (ipcRenderer) {
      const result = await ipcRenderer.invoke('dialog:open');
      if (!result) return;
      try {
        const data = JSON.parse(result.content);
        loadDocument(data);
        currentFilePath = result.filePath;
        setDirty(false);
        updateDocTitle(currentFilePath);
        ensureStructure();
        updateSidebar();
        lastKnownWordCount = getWordCount();
        updateWordCount();
        page.focus();
      } catch (err) {
        alert('Failed to open file: ' + err.message);
      }
    } else {
      fileInput.click();
    }
  }

  async function saveDocumentFile(saveAs = false) {
    const content = JSON.stringify(serializeDocument(), null, 2);
    if (ipcRenderer) {
      const channel = (saveAs || !currentFilePath) ? 'dialog:save-as' : 'dialog:save';
      const result = await ipcRenderer.invoke(channel, { content, filePath: currentFilePath });
      if (result) {
        currentFilePath = result;
        setDirty(false);
        updateDocTitle(currentFilePath);
      }
    } else {
      // Browser fallback: trigger download
      const filename = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'document.wtron';
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setDirty(false);
    }
  }

  // Browser-mode file open via <input type="file">
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        loadDocument(data);
        currentFilePath = null;
        setDirty(false);
        updateDocTitle(file.name);
        ensureStructure();
        updateSidebar();
        lastKnownWordCount = getWordCount();
        updateWordCount();
        page.focus();
      } catch (err) {
        alert('Failed to open file: ' + err.message);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  btnNew.addEventListener('click', newDocument);
  btnOpen.addEventListener('click', openDocumentFile);
  btnSave.addEventListener('click', () => saveDocumentFile(false));
  btnSaveAs.addEventListener('click', () => saveDocumentFile(true));

  // ---- Initialize ----
  autoLoad();
  ensureStructure();
  updateSidebar();
  lastKnownWordCount = getWordCount();
  updateWordCount();
  updateToolbarState();
  updateDocTitle(null);
  page.focus();

})();
