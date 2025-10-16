/* This is the final, complete, and CSP-compliant content script.
   It eliminates all inline script execution wrappers to fix the 'script-src none' errors. */

// Arabic font CSS injection
const arabicFontCSS = `
  @font-face {
    font-family: 'Playpen Sans Arabic';
    src: url('${chrome.runtime.getURL("fonts/PlaypenSansArabic-VariableFont_wght.ttf")}') format('truetype');
    font-weight: 300 800;
    font-style: normal;
  }

  .yh-toolbar[lang="ar"],
  .yh-note-pop[lang="ar"],
  [lang="ar"] .yh-badge,
  [lang="ar"] .meta {
    font-family: 'Playpen Sans Arabic', system-ui, Segoe UI, Roboto, Arial, sans-serif !important;
  }

  /* Exclude note content and header text from Arabic font - MORE SPECIFIC */
  body[lang="ar"] .note,
  body[lang="ar"] header .tit p,
  body[lang="ar"] .note[dir="auto"],
  body[lang="ar"] .url,
  html[lang="ar"] body .note,
  html[lang="ar"] body header .tit p,
  html[lang="ar"] body .url {
    font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif !important;
  }

  .yh-toolbar[lang="ar"] {
    font-size: 14px;
    line-height: 1.4;
  }

  .yh-note-pop[lang="ar"] {
    font-size: 14px;
    line-height: 1.5;
  }

  .yh-note-pop[lang="ar"] textarea {
    font-family: 'Playpen Sans Arabic', system-ui, Segoe UI, Roboto, Arial, sans-serif !important;
    font-size: 14px;
    line-height: 1.5;
  }

  .yh-badge[lang="ar"] {
    font-size: 12px;
    font-weight: 500;
  }

  /* Remove underline on hover for toolbar buttons */
  .yh-toolbar button {
    text-decoration: none !important;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 6px 12px;
    margin: 0;
    font: inherit;
    color: inherit;
  }

  .yh-toolbar button:hover,
  .yh-toolbar button:focus {
    text-decoration: none !important;
    outline: none;
    background: rgba(0, 0, 0, 0.05);
  }

  /* Additional hover state cleanup */
  .yh-toolbar button::-moz-focus-inner {
    border: 0;
    padding: 0;
    margin: 0;
  }

  /* Ensure toolbar container doesn't inherit unwanted styles */
  .yh-toolbar {
    all: initial;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 8px;
    background: white;
    border: 1px solid #ccc;
    padding: 8px;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    position: absolute;
    z-index: 10000;
  }
`;

// Inject Arabic font CSS
function injectArabicFontCSS() {
  if (document.getElementById('yh-arabic-fonts')) return;
  
  const style = document.createElement('style');
  style.id = 'yh-arabic-fonts';
  style.textContent = arabicFontCSS;
  document.head.appendChild(style);
}

// Removed conflicting applyArabicFont function - now handled by applyToolbarLang

const AR = { highlight: "تظليل", note: "ملاحظة", copy: "نسخ", remove: "إزالة", saved: "تم الحفظ", addNotePlaceholder: "اكتب ملاحظتك هنا...", notes: "ملاحظات", cancel: "إلغاء", save: "حفظ" };
const KEY_PREFIX = "yh_notes_v1::"; 
const PAGE_KEY = KEY_PREFIX + location.origin + location.pathname;
let toolbarEl = null, notePopEl = null, currentRange = null;

// Initialize Arabic font support
injectArabicFontCSS();
// applyArabicFont() removed - now handled by applyToolbarLang

function scrollToHighlightById(id) {
  const el = document.querySelector(`.yh-highlight[data-yh-id="${id}"]`);
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "box-shadow 0.3s ease";
    el.style.boxShadow = "0 0 0 4px rgba(59,130,246,.45)";
    setTimeout(() => { el.style.boxShadow = "0 0 0 0 rgba(0,0,0,0)"; }, 1200);
    return true;
  } catch (e) { }
  return false;
}

function getLaranoteHashId() {
  try {
    const m = location.hash.match(/[#&]laranote=([a-z0-9_]+)/i);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

function getSelectionRangeSafe() { const s = window.getSelection(); if (!s || s.rangeCount === 0) return null; const r = s.getRangeAt(0); return r.collapsed ? null: r; }

// HTML Complexity Detection and Warning System
function analyzeSelectionComplexity(range) {
  if (!range) return { isComplex: false, reason: '', severity: 0 };
  
  let complexityScore = 0;
  let reasons = [];
  
  // Get common ancestor container
  const container = range.commonAncestorContainer;
  const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  
  // Check for cross-paragraph selection
  const startElement = range.startContainer.nodeType === Node.TEXT_NODE ? 
    range.startContainer.parentElement : range.startContainer;
  const endElement = range.endContainer.nodeType === Node.TEXT_NODE ? 
    range.endContainer.parentElement : range.endContainer;
    
  if (startElement !== endElement) {
    complexityScore += 3;
    reasons.push('cross_element');
  }
  
  // Check for multiple paragraph elements
  const paragraphs = element.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, td');
  if (paragraphs.length > 1) {
    complexityScore += 4;
    reasons.push('multiple_paragraphs');
  }
  
  // Check for inline formatting elements
  const inlineElements = element.querySelectorAll('span, a, strong, em, b, i, u, mark, code, sup, sub');
  if (inlineElements.length > 5) {
    complexityScore += 2;
    reasons.push('heavy_formatting');
  }
  
  // Check for nested structures
  let maxDepth = 0;
  let current = element;
  while (current && current !== document.body) {
    maxDepth++;
    current = current.parentElement;
  }
  if (maxDepth > 8) {
    complexityScore += 2;
    reasons.push('deep_nesting');
  }
  
  // Check for table structures
  if (element.querySelectorAll('table, tr, td, th').length > 0) {
    complexityScore += 3;
    reasons.push('table_content');
  }
  
  // Check for list structures
  if (element.querySelectorAll('ul, ol, li').length > 3) {
    complexityScore += 2;
    reasons.push('list_content');
  }
  
  // Check for media elements
  if (element.querySelectorAll('img, video, audio, iframe, embed').length > 0) {
    complexityScore += 1;
    reasons.push('media_content');
  }
  
  // Check text length vs element complexity
  const selectedText = range.toString().trim();
  const textLength = selectedText.length;
  if (textLength > 500 && inlineElements.length > 3) {
    complexityScore += 2;
    reasons.push('long_formatted_text');
  }
  
  return {
    isComplex: complexityScore >= 5,
    reason: reasons[0] || '',
    severity: Math.min(complexityScore, 10),
    allReasons: reasons,
    textLength: textLength
  };
}

async function shouldShowWarning(complexity, lang = 'en') {
  // Check user preference first
  const result = await chrome.storage.sync.get({ laranote_complex_warning: true });
  if (!result.laranote_complex_warning) return false;
  
  return complexity.isComplex && complexity.severity >= 5;
}

function getWarningMessage(complexity, lang = 'en') {
  const messages = {
    en: {
      title: 'Complex Selection Detected',
      message: 'This selection contains complex HTML structure that may cause highlighting issues. The highlight might not appear correctly or may behave unexpectedly.',
      reasons: {
        cross_element: 'Spans multiple elements',
        multiple_paragraphs: 'Multiple paragraphs selected',
        heavy_formatting: 'Heavy formatting detected',
        deep_nesting: 'Deep HTML nesting',
        table_content: 'Contains table elements',
        list_content: 'Contains list structures',
        media_content: 'Contains media elements',
        long_formatted_text: 'Long formatted text'
      },
      continue: 'Continue Anyway',
      cancel: 'Cancel'
    },
    ar: {
      title: 'تم اكتشاف تحديد معقد',
      message: 'يحتوي هذا التحديد على هيكل HTML معقد قد يسبب مشاكل في التظليل. قد لا يظهر التظليل بشكل صحيح أو قد يتصرف بشكل غير متوقع.',
      reasons: {
        cross_element: 'يحتوي علي عناصر متعددة',
        multiple_paragraphs: 'تم تحديد فقرات متعددة',
        heavy_formatting: 'تم اكتشاف تنسيق ثقيل',
        deep_nesting: 'تداخل HTML عميق',
        table_content: 'يحتوي على عناصر جدول',
        list_content: 'يحتوي على هياكل القوائم',
        media_content: 'يحتوي على عناصر وسائط',
        long_formatted_text: 'نص منسوق طويل'
      },
      continue: 'متابعة على أي حال',
      cancel: 'إلغاء'
    }
  };
  
  return messages[lang] || messages.en;
}
function createToolbar() {
  if (toolbarEl) return toolbarEl; const el = document.createElement("div"); el.className = "yh-toolbar"; el.style.display = "none";
  el.innerHTML = `\n      <span class="yh-brand"><img src="${chrome.runtime.getURL('icons/Laranote-main.png')}" alt="LaraNote" title="LaraNote" /></span>
      <button data-action="highlight" data-act="highlight">${AR.highlight}</button>
      <button data-action="note" data-act="note">${AR.note}</button>
      <div class="yh-toolbar-sep"></div>
      <button data-action="copy" data-act="copy">${AR.copy}</button>
      <button data-action="remove" data-act="remove">${AR.remove}</button>
  `;
  el.addEventListener("mousedown", e => e.preventDefault());
  el.addEventListener("click", onToolbarClick);
  document.body.appendChild(el); toolbarEl = el; return el;
}

function createWarningDialog() {
  let dialog = document.getElementById('yh-warning-dialog');
  if (dialog) return dialog;
  
  dialog = document.createElement('div');
  dialog.id = 'yh-warning-dialog';
  dialog.className = 'yh-warning-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #ff6b35;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 400px;
    font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    display: none;
  `;
  
  dialog.innerHTML = `
    <div class="yh-warning-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
      <img src="${chrome.runtime.getURL('icons/Laranote-main.png')}" alt="Warning" style="width: 50px; height: 50px; border-radius: 10px;">
      <h3 class="yh-warning-title" style="margin: 0; color: #ff6b35; font-size: 16px;"></h3>
    </div>
    <p class="yh-warning-message" style="margin: 0 0 15px 0; color: #333;"></p>
    <div class="yh-warning-reasons" style="margin: 0 0 15px 0; font-size: 12px; color: #666;"></div>
    <div class="yh-warning-buttons" style="display: flex; gap: 10px; justify-content: flex-end;">
      <button class="yh-warning-cancel" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;"></button>
      <button class="yh-warning-continue" style="padding: 8px 16px; border: none; background: #ff6b35; color: white; border-radius: 4px; cursor: pointer;"></button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  return dialog;
}

function showWarningDialog(complexity, lang = 'en', onContinue, onCancel) {
  try {
    const dialog = createWarningDialog();
    if (!dialog) {
      console.error('LaraNote: Failed to create warning dialog');
      if (onContinue) onContinue(); // Fallback to continue if dialog fails
      return;
    }
    
    const messages = getWarningMessage(complexity, lang);
    
    // Set language for proper font rendering and direction
    dialog.setAttribute('lang', lang);
    dialog.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    
    const titleEl = dialog.querySelector('.yh-warning-title');
    const messageEl = dialog.querySelector('.yh-warning-message');
    const reasonsEl = dialog.querySelector('.yh-warning-reasons');
    const cancelBtn = dialog.querySelector('.yh-warning-cancel');
    const continueBtn = dialog.querySelector('.yh-warning-continue');
    
    if (!titleEl || !messageEl || !reasonsEl || !cancelBtn || !continueBtn) {
      console.error('LaraNote: Warning dialog elements not found');
      if (onContinue) onContinue(); // Fallback to continue
      return;
    }
    
    titleEl.textContent = messages.title;
    messageEl.textContent = messages.message;
    
    // Show reasons
    if (complexity.allReasons && complexity.allReasons.length > 0) {
      const reasonList = complexity.allReasons.map(reason => 
        `• ${messages.reasons[reason] || reason}`
      ).join('<br>');
      reasonsEl.innerHTML = reasonList;
      reasonsEl.style.display = 'block';
    } else {
      reasonsEl.style.display = 'none';
    }
    
    cancelBtn.textContent = messages.cancel;
    continueBtn.textContent = messages.continue;
    
    // Remove any existing event listeners
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newContinueBtn = continueBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
    
    const cleanup = () => {
      dialog.style.display = 'none';
    };
    
    const handleCancel = () => {
      cleanup();
      if (onCancel) onCancel();
    };
    
    const handleContinue = () => {
      cleanup();
      if (onContinue) onContinue();
    };
    
    newCancelBtn.addEventListener('click', handleCancel);
    newContinueBtn.addEventListener('click', handleContinue);
    
    // Show dialog
    dialog.style.display = 'block';
    
  } catch (error) {
    console.error('LaraNote: Error showing warning dialog:', error);
    if (onContinue) onContinue(); // Fallback to continue on any error
  }
}
function showToolbarAt(x, y) { const t = createToolbar(); t.style.left = x + "px"; t.style.top = y + "px"; t.style.display = "flex"; }
function hideToolbar() { if (toolbarEl) toolbarEl.style.display = "none"; }
function makeId() { return "yh_" + Math.random().toString(36).slice(2, 9); }
async function wrapRangeWithSpan(range, id) {
  // Get the current language setting first
  let lang = 'en';
  let dir = 'ltr';
  
  try {
    // Use await to get the language synchronously
    const result = await chrome.storage.sync.get({ laranote_lang: "en" });
    lang = result.laranote_lang;
    
    // Detect the actual language of the selected text
    const selectedText = range.toString();
    
    // More robust Arabic detection - check for any Arabic Unicode blocks
    const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(selectedText);
    
    // Also check if the text is primarily Latin/English
    const hasLatin = /[a-zA-Z]/.test(selectedText);
    const latinRatio = hasLatin ? (selectedText.match(/[a-zA-Z]/g) || []).length / selectedText.length : 0;
    
    
    // Apply direction based on text content, not extension language
    if (hasArabic && !hasLatin) {
      // Pure Arabic text
      dir = "rtl";
      lang = "ar";
    } else if (hasArabic && latinRatio < 0.5) {
      // Mixed text but more Arabic than Latin
      dir = "rtl";
      lang = "ar";
    } else if (hasLatin || selectedText.match(/^[\s\w\.,!?;:'"-]+$/)) {
      // English/Latin text or text with mostly Latin characters and punctuation
      dir = "ltr";
      lang = "en";
    } else {
      // Default to extension language for ambiguous cases
      dir = lang === "ar" ? "rtl" : "ltr";
    }
    
   
  } catch (e) {
    // Fallback to LTR if chrome.storage is not available
    dir = "ltr";
    lang = "en";
  }
  
  const span = document.createElement("span"); 
  span.className = "yh-highlight"; 
  span.dataset.yhId = id;
  span.setAttribute("lang", lang);
  span.setAttribute("dir", dir);
  
  try { 
    range.surroundContents(span); 
    return span; 
  } catch (e) {
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    const toWrap = []; 
    while (walker.nextNode()) {
      const tn = walker.currentNode; 
      if (!tn.nodeValue || !tn.nodeValue.trim()) continue;
      if (range.intersectsNode && !range.intersectsNode(tn)) continue;
      
      let s = 0, e2 = tn.nodeValue.length; 
      if (tn === range.startContainer) s = range.startOffset; 
      if (tn === range.endContainer) e2 = range.endOffset; 
      
      if (s < e2) toWrap.push({ tn, startOffset: s, endOffset: e2 });
    }
    
    let first = null; 
    toWrap.forEach(({ tn, startOffset, endOffset }) => {
      // Skip if the text node no longer exists or has been modified
      if (!tn.parentNode || !tn.nodeValue) return;
      
      // Ensure the offsets are valid
      const textLength = tn.nodeValue.length;
      if (startOffset >= textLength || endOffset > textLength || startOffset >= endOffset) return;
      
      // Split the text node at the start offset
      const middleText = tn.splitText(startOffset);
      // Split the middle text at the end offset to isolate the highlighted portion
      const afterText = middleText.splitText(endOffset - startOffset);
      
      // Ensure the middle text node still exists before wrapping
      if (!middleText.parentNode) return;
      
      const wrap = document.createElement("span"); 
      wrap.className = "yh-highlight"; 
      wrap.dataset.yhId = id;
      wrap.setAttribute("lang", lang);
      wrap.setAttribute("dir", dir);
      
      // Replace the middle text node with the wrapper
      middleText.parentNode.replaceChild(wrap, middleText); 
      // Move the middle text into the wrapper
      wrap.appendChild(middleText); 
      if (!first) first = wrap;
    });
    return first;
  }
}

async function saveRecord(r) { 
  const data = (await chrome.storage.local.get(PAGE_KEY))[PAGE_KEY] || []; 
  data.push(r); 
  await chrome.storage.local.set({ [PAGE_KEY]: data }); 
}
async function getRecords() { return (await chrome.storage.local.get(PAGE_KEY))[PAGE_KEY] || []; }
async function setRecords(l) { await chrome.storage.local.set({ [PAGE_KEY]: l }); }
function selectionClientPoint(range) { const rect = range.getBoundingClientRect(); return { x: Math.max(12, rect.left + window.scrollX), y: Math.max(12, rect.top + window.scrollY) - 40 }; }

// --- XPath/Offset Anchoring Utilities ---

function getUniqueXPath(node, rootNode = document.body) {
  if (!node || node === rootNode) return '';
  if (node.nodeType === Node.DOCUMENT_NODE) return '';

  const parts = [];
  let current = node;

  while (current && current !== rootNode) {
    let part = current.tagName ? current.tagName.toLowerCase() : '';

    if (current.nodeType === Node.TEXT_NODE) {
      let textIndex = 1;
      let sibling = current;
      while (sibling = sibling.previousSibling) {
        if (sibling.nodeType === Node.TEXT_NODE) textIndex++;
      }
      part = `text()[${textIndex}]`;
    } else {
      let index = 1;
      let sibling = current;
      while (sibling = sibling.previousElementSibling) {
        if (sibling.tagName === current.tagName) index++;
      }
      part += `[${index}]`;
    }

    parts.unshift(part);
    current = current.parentNode;
  }
  
  // ****** تم تصحيح هذا السطر: إضافة فاصل مائل بين rootPath ومسار الأجزاء ******
  const rootPath = (rootNode === document.body) ? '/html/body' : '';
  
  // نضمن وجود المسار النهائي (body/main/...) حتى لو كان rootPath فارغًا
  let finalPath = parts.join('/');
  
  if (rootPath && finalPath) {
      finalPath = rootPath + '/' + finalPath;
  } else if (rootPath) {
      finalPath = rootPath; // في حال كان التظليل على مستوى الـ body نفسه
  }
  
  return finalPath;
}

function getNodeFromXPath(xpathString) {
  if (!xpathString) return null;
  let path = xpathString.startsWith('/') ? xpathString : '//' + xpathString;
  try {
    const result = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    let node = result.singleNodeValue;
    
    // If we can't find the exact text node, try to find a fallback
    if (!node && xpathString.includes('/text()[')) {
      // Try to find the parent element instead
      const parentPath = xpathString.replace(/\/text\(\)\[\d+\]/g, '');
      const parentResult = document.evaluate(parentPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const parent = parentResult.singleNodeValue;
      
      if (parent && parent.firstChild) {
        // Return the first text node child as fallback
        for (let child = parent.firstChild; child; child = child.nextSibling) {
          if (child.nodeType === Node.TEXT_NODE) {
            return child;
          }
        }
        // If no text node found, return the parent element (will be handled by range logic)
        return parent;
      }
    }
    
    return node;
  } catch (e) {
    return null;
  }
}

function getDOMAnchor(range) {
  if (!range || range.collapsed) return null;
  
  // Get the text content, handling Arabic text properly
  let exactText = range.toString();
  
  // For Arabic text, we need to handle it more carefully
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(exactText);
  if (hasArabic) {
    // For Arabic text, we might need to normalize it to preserve proper ordering
    exactText = exactText.normalize('NFC');
  }
  
  return {
    startContainerXPath: getUniqueXPath(range.startContainer),
    startOffset: range.startOffset,
    endContainerXPath: getUniqueXPath(range.endContainer),
    endOffset: range.endOffset,
    exact: exactText, 
  };
}

function ln_recreateRangeFromAnchor(anchor) {
  if (!anchor || !anchor.startContainerXPath || !anchor.endContainerXPath) return null;

  const startNode = getNodeFromXPath(anchor.startContainerXPath);
  const endNode = getNodeFromXPath(anchor.endContainerXPath);

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, Math.min(anchor.startOffset || 0, startNode.textContent?.length || 0));
    range.setEnd(endNode, Math.min(anchor.endOffset || 0, endNode.textContent?.length || 0));
    return range;
  } catch (e) {
    // Fallback: if start and end are in the same parent but different text nodes,
    // try to create a range from the start of the first to the end of the last
    try {
      if (startNode.parentNode === endNode.parentNode && startNode !== endNode) {
        const range = document.createRange();
        range.setStart(startNode, Math.min(anchor.startOffset || 0, startNode.textContent?.length || 0));
        range.setEnd(endNode, Math.min(anchor.endOffset || 0, endNode.textContent?.length || 0));
        return range;
      }
    } catch (e2) {
      // Final fallback: try string-based search
      return ln_findQuoteRangeNormalized(anchor);
    }
    return null;
  }
}

// --- Toolbar Click Handler ---

async function onToolbarClick(e) {
  const btn = e.target.closest("button"); 
  if (!btn || !currentRange) return; 
  const action = btn.dataset.action;
  
  const anchor = getDOMAnchor(currentRange);
  const text = currentRange.toString();

  if (action === "highlight") { 
    await handleHighlightAction(text, anchor);
  }
  if (action === "copy") { 
    try { await navigator.clipboard.writeText(text); } catch (err) { } 
    hideToolbar(); 
    window.getSelection()?.removeAllRanges(); 
  }
  if (action === "note") { 
    await handleNoteAction(text, anchor);
  }
  if (action === "remove") { 
    removeHighlightAtRange(currentRange); 
    hideToolbar(); 
    window.getSelection()?.removeAllRanges(); 
  }
}

async function handleHighlightAction(text, anchor) {
  try {
    // Analyze complexity and check if warning should be shown
    const complexity = analyzeSelectionComplexity(currentRange);
    
    // Get current language
    const { laranote_lang: lang = 'en' } = await chrome.storage.sync.get({ laranote_lang: 'en' });
    const { laranote_complex_warning: warningEnabled = true } = await chrome.storage.sync.get({ laranote_complex_warning: true });
    
    // If complex and warnings enabled, show dialog
    if (complexity.isComplex && warningEnabled && complexity.severity >= 5) {
      showWarningDialog(complexity, lang, 
        async () => {
          // User chose to continue
          const id = makeId(); 
          const el = await wrapRangeWithSpan(currentRange, id); 
          if (el) { 
            await saveRecord({ id, text, note: "", createdAt: Date.now(), quote: anchor }); 
          } 
          hideToolbar(); 
          window.getSelection()?.removeAllRanges();
        },
        () => {
          // User chose to cancel
          hideToolbar(); 
          window.getSelection()?.removeAllRanges();
        }
      );
    } else {
      // No warning needed, proceed directly
      const id = makeId(); 
      const el = await wrapRangeWithSpan(currentRange, id); 
      if (el) { 
        await saveRecord({ id, text, note: "", createdAt: Date.now(), quote: anchor }); 
      } 
      hideToolbar(); 
      window.getSelection()?.removeAllRanges();
    }
  } catch (error) {
    console.error('LaraNote: Error in handleHighlightAction:', error);
    // Fallback: proceed with highlight anyway
    const id = makeId(); 
    const el = await wrapRangeWithSpan(currentRange, id); 
    if (el) { 
      await saveRecord({ id, text, note: "", createdAt: Date.now(), quote: anchor }); 
    } 
    hideToolbar(); 
    window.getSelection()?.removeAllRanges();
  }
}

async function handleNoteAction(text, anchor) {
  try {
    // Analyze complexity and check if warning should be shown
    const complexity = analyzeSelectionComplexity(currentRange);
    
    // Get current language
    const { laranote_lang: lang = 'en' } = await chrome.storage.sync.get({ laranote_lang: 'en' });
    const { laranote_complex_warning: warningEnabled = true } = await chrome.storage.sync.get({ laranote_complex_warning: true });
    
    // If complex and warnings enabled, show dialog
    if (complexity.isComplex && warningEnabled && complexity.severity >= 5) {
      showWarningDialog(complexity, lang, 
        async () => {
          // User chose to continue
          const id = makeId(); 
          const el = await wrapRangeWithSpan(currentRange, id); 
          if (el) { 
            showNotePopup(el, id, text, anchor); 
          } 
          hideToolbar(); 
          window.getSelection()?.removeAllRanges();
        },
        () => {
          // User chose to cancel
          hideToolbar(); 
          window.getSelection()?.removeAllRanges();
        }
      );
    } else {
      // No warning needed, proceed directly
      const id = makeId(); 
      const el = await wrapRangeWithSpan(currentRange, id); 
      if (el) { 
        showNotePopup(el, id, text, anchor); 
      } 
      hideToolbar(); 
      window.getSelection()?.removeAllRanges();
    }
  } catch (error) {
    console.error('LaraNote: Error in handleNoteAction:', error);
    // Fallback: proceed with note anyway
    const id = makeId(); 
    const el = await wrapRangeWithSpan(currentRange, id); 
    if (el) { 
      showNotePopup(el, id, text, anchor); 
    } 
    hideToolbar(); 
    window.getSelection()?.removeAllRanges();
  }
}

function removeHighlightAtRange(range) {
  const start = range.startContainer; 
  const span = start.nodeType === 1 ? start.closest(".yh-highlight") : start.parentElement?.closest(".yh-highlight");
  if (span) {
    const id = span.dataset.yhId; 
    unwrapSpan(span); 
    document.querySelectorAll(`.yh-highlight[data-yh-id="${id}"]`).forEach(unwrapSpan);
    getRecords().then(list => setRecords(list.filter(r => r.id !== id)));
  }
}
function unwrapSpan(span) { while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span); span.remove(); }

function showNotePopup(anchorEl, id, selectedText, anchor) {
  hideNotePopup(); 
  const rect = anchorEl.getBoundingClientRect(); 
  const pop = document.createElement("div"); 
  pop.className = "yh-note-pop";
  pop.style.left = (rect.left + window.scrollX) + "px"; 
  pop.style.top = (rect.bottom + window.scrollY + 6) + "px";
  pop.innerHTML = `<div class="yh-badge">"${selectedText.slice(0, 40)}${selectedText.length > 40 ? '…' : ''}"</div>
    <div style="margin-top:6px;"><textarea data-act="addNotePlaceholder" placeholder="${AR.addNotePlaceholder}"></textarea></div>
    <div style="margin-top:8px; display:flex; gap:8px; justify-content:flex-end;"><button class="yh-cancel" data-act="cancel">${AR.cancel}</button><button class="yh-save" data-act="save">${AR.save}</button></div>
    <div class="yh-note-list" hidden></div>`;
  document.body.appendChild(pop); 
  notePopEl = pop;
  
  pop.querySelector(".yh-cancel").addEventListener("click", hideNotePopup);
  pop.querySelector(".yh-save").addEventListener("click", async () => {
    const note = pop.querySelector("textarea").value.trim();
    await saveRecord({ id, text: selectedText, note, createdAt: Date.now(), quote: anchor }); 
    addPin(anchorEl); 
    hideNotePopup();
  });
}

function addPin(el) {
  if (el.querySelector(".yh-note-pin")) return; 
  const pin = document.createElement("sup"); 
  pin.className = "yh-note-pin"; 
  pin.textContent = "📌"; 
  pin.title = "Note attached";
  pin.addEventListener("click", async (e) => {
    e.stopPropagation(); 
    const id = el.dataset.yhId; 
    const list = await getRecords(); 
    const items = list.filter(r => r.id === id && r.note); 
    if (!items.length) return;
    const rect = el.getBoundingClientRect(); 
    const pop = document.createElement("div"); 
    pop.className = "yh-note-pop"; 
    pop.style.left = (rect.left + window.scrollX) + "px"; 
    pop.style.top = (rect.bottom + window.scrollY + 6) + "px";
    pop.innerHTML = `<div style="font-weight:600; margin-bottom:6px;" data-act="notes">${AR.notes}</div>`; 
    const wrap = document.createElement("div"); 
    wrap.className = "yh-note-list";
    items.forEach(it => { 
      const d = new Date(it.createdAt); 
      const item = document.createElement("div"); 
      item.className = "yh-note-item"; 
      item.innerHTML = `<div>${escapeHtml(it.note)}</div><small>${d.toLocaleString()}</small>`; 
      wrap.appendChild(item); 
    });
    pop.appendChild(wrap); 
    document.body.appendChild(pop); 
    
    function close() { pop.remove(); document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", onDoc, true); }
    function onDoc(ev) { if (!pop.contains(ev.target)) close(); } 
    
    document.addEventListener("mousedown", onDoc); 
    window.addEventListener("scroll", onDoc, true);
  });
  el.appendChild(pin);
}

function hideNotePopup() { if (notePopEl) { notePopEl.remove(); notePopEl = null; } }
function escapeHtml(s) { return s.replace(/[&<>"'`=\/]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;", "/": "&#x2F;", "`": "&#x60;", "=": "&#x3D;" }[c])); }


// --- FALLBACK UTILITIES (for old records only) ---

function ln_norm(s) {
  if (!s) return "";
  
  // Check if text contains Arabic characters
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(s);
  
  // Normalize the text
  let normalized = s.normalize('NFC').replace(/\s+/g, ' ').trim();
  
  // For Arabic text, be more careful with direction control characters
  if (hasArabic) {
    // Keep RTL direction for Arabic text, but clean up direction markers
    normalized = normalized.replace(/[\u200e]/g, ''); // Remove LTR marks but keep RTL marks for Arabic
  } else {
    // For non-Arabic text, remove all direction control characters
    normalized = normalized.replace(/[\u200f\u200e]/g, '');
  }
  
  return normalized; 
}

function ln_findQuoteRangeNormalized(q) {
  if (!q || !q.exact) return null;
  
  // Enhanced normalization for complex text with embedded scripts/ads
  const normalizeForSearch = (text) => {
    let normalized = ln_norm(text);
    
    // Remove common ad insertion patterns that might not be in current DOM
    normalized = normalized.replace(/if\s*\(\s*window\s*&&\s*window\.foxstrike[\s\S]*?}\s*else\s*{[\s\S]*?console\.error\('[\s\S]*?'\);[\s\S]*?}/g, '');
    normalized = normalized.replace(/window\.foxstrike\.cmd\.push\([\s\S]*?}\);/g, '');
    normalized = normalized.replace(/Strike\.insertAd\([\s\S]*?\);/g, '');
    
    // Remove extra whitespace created by script removal
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  };
  
  // Fuzzy matching for partial text matches - now works on text nodes directly
  const findFuzzyMatchInNodes = (searchText, minMatchRatio = 0.7) => {
    const words = searchText.split(' ');
    let bestMatch = { ratio: 0, startNode: null, startOffset: 0, endNode: null, endOffset: 0 };
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const nodeText = ln_norm(node.nodeValue || '');
      
      // Try to find the search text in this node
      for (let start = 0; start <= nodeText.length - searchText.length + 1; start++) {
        const substring = nodeText.substring(start, start + searchText.length);
        const substringWords = substring.split(' ');
        
        // Count matching words
        let matchedWords = 0;
        for (let i = 0; i < Math.min(words.length, substringWords.length); i++) {
          if (words[i] && substringWords[i] && words[i] === substringWords[i]) {
            matchedWords++;
          }
        }
        
        const ratio = matchedWords / words.length;
        if (ratio > bestMatch.ratio && ratio >= minMatchRatio) {
          bestMatch = { 
            ratio, 
            startNode: node, 
            startOffset: start, 
            endNode: node, 
            endOffset: start + substring.length 
          };
        }
      }
    }
    
    return bestMatch.ratio >= minMatchRatio ? bestMatch : null;
  };
  
  const exact = normalizeForSearch(q.exact);
  if (!exact) return null;
  
  // ENHANCED APPROACH: Handle multi-node selections first
  // This addresses the issue where highlights span across multiple text nodes
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (node.nodeValue && node.nodeValue.trim().length > 0) {
      textNodes.push(node);
    }
  }
  
  
  // Try to find the text by checking combinations of adjacent nodes (for multi-node selections)
  for (let startIdx = 0; startIdx < textNodes.length; startIdx++) {
    let combinedText = '';
    let combinedNodes = [];
    
    // Build up text by combining adjacent nodes
    for (let endIdx = startIdx; endIdx < textNodes.length; endIdx++) {
      const nodeText = ln_norm(textNodes[endIdx].nodeValue || '');
      combinedText += (combinedText ? ' ' : '') + nodeText;
      combinedNodes.push(textNodes[endIdx]);
      
      // Check if our exact text is found in the combined text
      const searchIdx = combinedText.indexOf(exact);
      if (searchIdx !== -1) {
        
        // Calculate the exact positions within the combined text
        let currentPos = 0;
        let startNode = null;
        let endNode = null;
        let startOffset = 0;
        let endOffset = 0;
        
        for (let i = 0; i < combinedNodes.length; i++) {
          const nodeText = ln_norm(combinedNodes[i].nodeValue || '');
          const nodeStart = currentPos;
          const nodeEnd = currentPos + nodeText.length;
          
          // Check if this node contains the start of our match
          if (!startNode && nodeEnd > searchIdx) {
            startNode = combinedNodes[i];
            startOffset = searchIdx - nodeStart;
          }
          
          // Check if this node contains the end of our match
          if (nodeEnd >= searchIdx + exact.length) {
            endNode = combinedNodes[i];
            endOffset = (searchIdx + exact.length) - nodeStart;
            break;
          }
          
          currentPos = nodeEnd + 1; // +1 for space between nodes
        }
        
        if (startNode && endNode) {
          try {
            const range = document.createRange();
            range.setStart(startNode, Math.min(startOffset, startNode.nodeValue.length));
            range.setEnd(endNode, Math.min(endOffset, endNode.nodeValue.length));
            
            return range;
          } catch (e) {
          }
        }
      }
      
      // Limit the number of nodes we combine to prevent excessive searching
      // Increased from 5 to 20 to handle longer multi-node selections
      if (combinedNodes.length > 20) {
        break;
      }
    }
  }
  
  
  // FALLBACK: Try single-node search (existing logic)
  let foundRange = null;
  let method = 'exact';
  
  // Reset walker for single-node search
  walker.currentNode = document.body;
  
  // 1. Try exact match in individual text nodes
  while (node = walker.nextNode()) {
    const nodeText = ln_norm(node.nodeValue || '');
    const idx = nodeText.indexOf(exact);
    
    if (idx !== -1) {
      // Found exact match in this text node
      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + exact.length);
        foundRange = range;
        method = 'exact';
        break;
      } catch (e) {
      }
    }
  }
  
  // 2. Try fuzzy matching if exact match failed
  if (!foundRange) {
    const fuzzyMatch = findFuzzyMatchInNodes(exact, 0.7);
    if (fuzzyMatch) {
      try {
        const range = document.createRange();
        range.setStart(fuzzyMatch.startNode, fuzzyMatch.startOffset);
        range.setEnd(fuzzyMatch.endNode, fuzzyMatch.endOffset);
        foundRange = range;
        method = 'fuzzy';
      } catch (e) {
      }
    }
  }
  
  // 3. Try partial phrase matching as final fallback
  if (!foundRange) {
    const words = exact.split(' ');
    for (let wordCount = words.length; wordCount >= 3; wordCount--) {
      for (let start = 0; start <= words.length - wordCount; start++) {
        const phrase = words.slice(start, start + wordCount).join(' ');
        
        // Search for this phrase in text nodes
        walker.currentNode = document.body; // Reset walker
        while (node = walker.nextNode()) {
          const nodeText = ln_norm(node.nodeValue || '');
          const phraseIdx = nodeText.indexOf(phrase);
          
          if (phraseIdx !== -1) {
            try {
              const range = document.createRange();
              range.setStart(node, phraseIdx);
              range.setEnd(node, phraseIdx + phrase.length);
              foundRange = range;
              method = 'partial';
              break;
            } catch (e) {
            }
          }
        }
        if (foundRange) break;
      }
      if (foundRange) break;
    }
  }
  
  if (!foundRange) {
    return null;
  }
  
  return foundRange;
}

// Helper function to create a DOM range from text positions
function ln_createRangeFromTextPosition(startPos, endPos) {
  if (startPos < 0 || endPos <= startPos) return null;
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let currentPos = 0;
  let startNode = null;
  let endNode = null;
  let startOffset = 0;
  let endOffset = 0;
  
  let node;
  while (node = walker.nextNode()) {
    const nodeLength = (node.nodeValue || '').length;
    
    // Find start node
    if (!startNode && currentPos + nodeLength >= startPos) {
      startNode = node;
      startOffset = startPos - currentPos;
    }
    
    // Find end node
    if (!endNode && currentPos + nodeLength >= endPos) {
      endNode = node;
      endOffset = endPos - currentPos;
      break;
    }
    
    currentPos += nodeLength;
  }
  
  // If we found both nodes, create the range
  if (startNode && endNode) {
    try {
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOffset, startNode.nodeValue?.length || 0));
      range.setEnd(endNode, Math.min(endOffset, endNode.nodeValue?.length || 0));
      return range;
    } catch (e) {
      return null;
    }
  }
  
  return null;
}

// --- Main Restore and Language Logic ---

async function ln_applyAllFromStorage() {
  try {
    const all = await chrome.storage.local.get(null);
    const key = PAGE_KEY;
    const arr = all[key];
    if (!Array.isArray(arr)) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const rec of arr) {
      if (!rec || !rec.id) continue;
      if (document.querySelector('[data-yh-id="' + rec.id + '"]')) {
        successCount++;
        continue;
      }
      
      let range = null;
      let methodUsed = 'none';

      // SPECIAL CASE: For multi-text-node selections (common in Vue.js/Nuxt.js)
      // Try string-based search FIRST for better reliability
      if (rec.quote && rec.quote.startContainerXPath && rec.quote.endContainerXPath) {
        const startPath = rec.quote.startContainerXPath;
        const endPath = rec.quote.endContainerXPath;
        
        // Check if this spans different paragraphs (cross-paragraph selection)
        const startParaMatch = startPath.match(/\/p\[(\d+)\]/);
        const endParaMatch = endPath.match(/\/p\[(\d+)\]/);
        
        // Check if this spans multiple text nodes within same paragraph
        const startTextMatch = startPath.match(/\/text\(\)\[(\d+)\]$/);
        const endTextMatch = endPath.match(/\/text\(\)\[(\d+)\]$/);
        
        const isCrossParagraph = startParaMatch && endParaMatch && startParaMatch[1] !== endParaMatch[1];
        const isMultiTextNode = startTextMatch && endTextMatch && startTextMatch[1] !== endTextMatch[1];
        
        // ADDITIONAL CHECK: Even if XPaths point to same text node, verify if the text length
        // exceeds what's available in the resolved text node (handles split text nodes)
        let isTextLengthMismatch = false;
        if (!isCrossParagraph && !isMultiTextNode && rec.quote.exact && rec.quote.endOffset) {
          try {
            const testNode = getNodeFromXPath(startPath);
            if (testNode && testNode.nodeType === Node.TEXT_NODE) {
              const availableLength = (testNode.nodeValue || '').length;
              const requiredEndOffset = rec.quote.endOffset;
              if (requiredEndOffset > availableLength) {
                isTextLengthMismatch = true;
              }
            }
          } catch (e) {
          }
        }
        
        if (isCrossParagraph || isMultiTextNode || isTextLengthMismatch) {
          // Complex selection - use string search first
          const selectionType = isCrossParagraph ? 'cross-paragraph' : (isMultiTextNode ? 'multi-text-node' : 'text-length-mismatch');
          if (rec.quote) {
            range = ln_findQuoteRangeNormalized(rec.quote);
            if (range) methodUsed = isCrossParagraph ? 'string-cross-para' : (isMultiTextNode ? 'string-multi' : 'string-length-mismatch');
          }
          if (!range && rec.text) {
            range = ln_findQuoteRangeNormalized({ exact: rec.text });
            if (range) methodUsed = isCrossParagraph ? 'text-cross-para' : (isMultiTextNode ? 'text-multi' : 'text-length-mismatch');
          }
        }
      }
      
      // 1. PRIMARY: Try XPath/Offset anchoring (for single text nodes or if multi-node failed)
      if (!range && rec.quote && rec.quote.startContainerXPath) {
        range = ln_recreateRangeFromAnchor(rec.quote);
        if (range) methodUsed = 'xpath';
      }
      
      // 2. FALLBACK: Final string-based anchoring (for legacy data or if XPath failed)
      if (!range && rec.quote) {
        range = ln_findQuoteRangeNormalized(rec.quote); 
        if (range) methodUsed = 'string-fallback';
      }
      if (!range && rec.text) {
        range = ln_findQuoteRangeNormalized({ exact: rec.text });
        if (range) methodUsed = 'text-fallback';
      }
      
      if (range) {
        try {
          const span = await wrapRangeWithSpan(range, rec.id); 
          if (span) {
            successCount++;
            if (rec.note) {
              addPin(span);
            }
          } else {
            failCount++;
          }
        } catch (wrapError) {
          failCount++;
        }
      } else {
        failCount++;
      }
    }
    
  } catch (e) { 
  }
}

async function ln_tryReanchorFromStorage(id) {
  try {
    const all = await chrome.storage.local.get(null);
    const key = PAGE_KEY;
    const arr = all[key];
    if (!Array.isArray(arr)) return;
    const rec = arr.find(r => r.id === id);
    if (!rec || !rec.quote || !rec.quote.exact) return;

    let range = null;
    let methodUsed = 'none';

    // SPECIAL CASE: For multi-text-node selections (common in Vue.js/Nuxt.js)
    // Try string-based search FIRST for better reliability
    if (rec.quote && rec.quote.startContainerXPath && rec.quote.endContainerXPath) {
      const startPath = rec.quote.startContainerXPath;
      const endPath = rec.quote.endContainerXPath;
      
      // Check if this spans different paragraphs (cross-paragraph selection)
      const startParaMatch = startPath.match(/\/p\[(\d+)\]/);
      const endParaMatch = endPath.match(/\/p\[(\d+)\]/);
      
      // Check if this spans multiple text nodes within same paragraph
      const startTextMatch = startPath.match(/\/text\(\)\[(\d+)\]$/);
      const endTextMatch = endPath.match(/\/text\(\)\[(\d+)\]$/);
      
      const isCrossParagraph = startParaMatch && endParaMatch && startParaMatch[1] !== endParaMatch[1];
      const isMultiTextNode = startTextMatch && endTextMatch && startTextMatch[1] !== endTextMatch[1];
      
      // ADDITIONAL CHECK: Even if XPaths point to same text node, verify if the text length
      // exceeds what's available in the resolved text node (handles split text nodes)
      let isTextLengthMismatch = false;
      if (!isCrossParagraph && !isMultiTextNode && rec.quote.exact && rec.quote.endOffset) {
        try {
          const testNode = getNodeFromXPath(startPath);
          if (testNode && testNode.nodeType === Node.TEXT_NODE) {
            const availableLength = (testNode.nodeValue || '').length;
            const requiredEndOffset = rec.quote.endOffset;
            if (requiredEndOffset > availableLength) {
              isTextLengthMismatch = true;
            }
          }
        } catch (e) {
        }
      }
      
      if (isCrossParagraph || isMultiTextNode || isTextLengthMismatch) {
        // Complex selection - use string search first
        const selectionType = isCrossParagraph ? 'cross-paragraph' : (isMultiTextNode ? 'multi-text-node' : 'text-length-mismatch');
        if (rec.quote) {
          range = ln_findQuoteRangeNormalized(rec.quote);
          if (range) methodUsed = isCrossParagraph ? 'string-cross-para' : (isMultiTextNode ? 'string-multi' : 'string-length-mismatch');
        }
        if (!range && rec.text) {
          range = ln_findQuoteRangeNormalized({ exact: rec.text });
          if (range) methodUsed = isCrossParagraph ? 'text-cross-para' : (isMultiTextNode ? 'text-multi' : 'text-length-mismatch');
        }
      }
    }
    
    // Try XPath method first (for single text nodes or if multi-node failed)
    if (!range && rec.quote.startContainerXPath) {
      range = ln_recreateRangeFromAnchor(rec.quote);
      if (range) methodUsed = 'xpath';
    }
    
    // Fallback to string-based search (final fallback)
    if (!range) {
      range = ln_findQuoteRangeNormalized(rec.quote);
      if (range) methodUsed = 'string-fallback';
    }
    
    if (!range) {
      return;
    }
    
    const span = await wrapRangeWithSpan(range, id);
    if (span) {
      
      // Enhanced scrolling with retry logic
      setTimeout(() => {
        try {
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add visual feedback
          span.style.transition = 'box-shadow 0.3s ease';
          span.style.boxShadow = '0 0 0 4px rgba(59,130,246,.45)';
          setTimeout(() => { 
            span.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)'; 
          }, 1200);
        } catch (scrollError) {
        }
      }, 100);
    }
  } catch (e) { 
  }
}

// --- Language Handling (v4.9) ---

const LANG_MAP = {
  ar: { remove: "إزالة", copy: "نسخ", note: "ملاحظة", highlight: "تظليل", addNotePlaceholder: "اكتب ملاحظتك هنا...", cancel: "إلغاء", save: "حفظ", notes: "ملاحظات" },
  en: { remove: "Remove", copy: "Copy", note: "Note", highlight: "Highlight", addNotePlaceholder: "Write your note...", cancel: "Cancel", save: "Save", notes: "Notes" }
};

function applyToolbarLang() {
  try {
    chrome.storage.sync.get({ laranote_lang: "en" }, ({ laranote_lang }) => {
      const T = LANG_MAP[laranote_lang] || LANG_MAP.en;
      const dir = laranote_lang === "ar" ? "rtl" : "ltr";
      
      // Only apply direction to LaraNote elements, not the entire document
      
      // Apply lang and dir attributes to LaraNote UI elements only
      document.querySelectorAll(".yh-toolbar").forEach(tb => {
        tb.setAttribute("lang", laranote_lang);
        tb.setAttribute("dir", dir);
      });
      
      document.querySelectorAll(".yh-note-pop").forEach(np => {
        np.setAttribute("lang", laranote_lang);
        np.setAttribute("dir", dir);
      });
      
      // DO NOT override highlight language - they use text-based detection in wrapRangeWithSpan
      // Only update highlight text content for toolbar buttons, not lang/dir attributes
      
      document.querySelectorAll('[data-act]').forEach(el => {
        const act = el.getAttribute('data-act');
        if (!act) return;
        const val = T[act];
        if (!val) return;
        
        try { el.setAttribute('dir', dir); } catch (e) { }
        
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.setAttribute('placeholder', val);
          if (el.tagName === 'TEXTAREA') {
            try { el.setAttribute('dir', laranote_lang === 'ar' ? 'rtl' : 'ltr'); } catch (e) { }
          }
          return;
        }
        
        if (el.tagName === 'BUTTON') {
          el.textContent = val;
          return;
        }
        
        el.textContent = val;
      });
    });
  } catch (e) { }
}




// --- Event Listeners and Initial Execution Flow ---

// Function to check if toolbar should be shown
async function shouldShowToolbar() {
  try {
    const { laranote_show_toolbar } = await chrome.storage.sync.get({ laranote_show_toolbar: true });
    return laranote_show_toolbar;
  } catch (e) {
    return true; // Default to showing toolbar if there's an error
  }
}

// 1. Setup Toolbar Listeners
document.addEventListener("mouseup", async () => { 
  setTimeout(async () => { 
    const r = getSelectionRangeSafe(); 
    if (!r) { 
      hideToolbar(); 
      currentRange = null; 
      return; 
    } 
    
    // Check if toolbar should be shown based on settings
    const showToolbar = await shouldShowToolbar();
    if (!showToolbar) {
      hideToolbar();
      return;
    }
    
    currentRange = r; 
    const pt = selectionClientPoint(r); 
    showToolbarAt(pt.x, pt.y); 
  }, 0); 
});
document.addEventListener("mousedown", e => { if (toolbarEl && !toolbarEl.contains(e.target)) hideToolbar(); if (notePopEl && !notePopEl.contains(e.target)) hideNotePopup(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { hideToolbar(); hideNotePopup(); window.getSelection()?.removeAllRanges(); } });

// 2. Setup Language Listeners (CSP safe)
applyToolbarLang();
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.laranote_lang) applyToolbarLang();
  });
}
const mo = new MutationObserver((m) => applyToolbarLang());
mo.observe(document.documentElement, { childList: true, subtree: true });


// 4. Run Main Restore Logic
ln_applyAllFromStorage().then(() => {
  const targetId = getLaranoteHashId();
  if (targetId) {
    // Check for deep-link target after restore
    setTimeout(() => { 
      const existing = document.querySelector('[data-yh-id="' + targetId + '"]');
      if (!existing) {
        ln_tryReanchorFromStorage(targetId);
      } else {
        scrollToHighlightById(targetId);
      }
    }, 300);
  }
});