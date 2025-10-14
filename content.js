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

  [lang="ar"] .yh-toolbar,
  [lang="ar"] .yh-note-pop,
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

  [lang="ar"] .yh-toolbar {
    font-size: 14px;
    line-height: 1.4;
  }

  [lang="ar"] .yh-note-pop {
    font-size: 14px;
    line-height: 1.5;
  }

  [lang="ar"] .yh-note-pop textarea {
    font-family: 'Playpen Sans Arabic', system-ui, Segoe UI, Roboto, Arial, sans-serif !important;
    font-size: 14px;
    line-height: 1.5;
  }

  [lang="ar"] .yh-badge {
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

function getSelectionRangeSafe() { const s = window.getSelection(); if (!s || s.rangeCount === 0) return null; const r = s.getRangeAt(0); return r.collapsed ? null : r; }
function createToolbar() {
  if (toolbarEl) return toolbarEl; const el = document.createElement("div"); el.className = "yh-toolbar"; el.style.display = "none";
  el.innerHTML = `\n      <span class="yh-brand"><img src="${chrome.runtime.getURL('icons/icon16.png')}" alt="Laranote" title="Laranote" /></span>
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
function showToolbarAt(x, y) { const t = createToolbar(); t.style.left = x + "px"; t.style.top = y + "px"; t.style.display = "flex"; }
function hideToolbar() { if (toolbarEl) toolbarEl.style.display = "none"; }
function makeId() { return "yh_" + Math.random().toString(36).slice(2, 9); }
function wrapRangeWithSpan(range, id) {
  const span = document.createElement("span"); span.className = "yh-highlight"; span.dataset.yhId = id;
  try { range.surroundContents(span); return span; } catch (e) {
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    const toWrap = []; 
    while (walker.nextNode()) {
      const tn = walker.currentNode; if (!tn.nodeValue || !tn.nodeValue.trim()) continue;
      if (range.intersectsNode && !range.intersectsNode(tn)) continue;
      
      let s = 0, e2 = tn.nodeValue.length; 
      if (tn === range.startContainer) s = range.startOffset; 
      if (tn === range.endContainer) e2 = range.endOffset; 
      
      if (s < e2) toWrap.push({ tn, startOffset: s, endOffset: e2 });
    }
    
    let first = null; 
    toWrap.forEach(({ tn, startOffset, endOffset }) => {
      const before = tn.splitText(startOffset); 
      const after = before.splitText(endOffset - startOffset);
      
      const wrap = document.createElement("span"); 
      wrap.className = "yh-highlight"; 
      wrap.dataset.yhId = id; 
      
      before.parentNode.replaceChild(wrap, before); 
      wrap.appendChild(before); 
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
    return result.singleNodeValue;
  } catch (e) {
    return null;
  }
}

function getDOMAnchor(range) {
  if (!range || range.collapsed) return null;
  return {
    startContainerXPath: getUniqueXPath(range.startContainer),
    startOffset: range.startOffset,
    endContainerXPath: getUniqueXPath(range.endContainer),
    endOffset: range.endOffset,
    exact: range.toString(), 
  };
}

function ln_recreateRangeFromAnchor(anchor) {
  if (!anchor || !anchor.startContainerXPath || !anchor.endContainerXPath) return null;

  const startNode = getNodeFromXPath(anchor.startContainerXPath);
  const endNode = getNodeFromXPath(anchor.endContainerXPath);

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, anchor.startOffset || 0);
    range.setEnd(endNode, anchor.endOffset || 0);
    return range;
  } catch (e) {
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
    const id = makeId(); 
    const el = wrapRangeWithSpan(currentRange, id); 
    if (el) { 
      await saveRecord({ id, text, note: "", createdAt: Date.now(), quote: anchor }); 
    } 
    hideToolbar(); 
    window.getSelection()?.removeAllRanges(); 
  }
  if (action === "copy") { 
    try { await navigator.clipboard.writeText(text); } catch (err) { } 
    hideToolbar(); 
    window.getSelection()?.removeAllRanges(); 
  }
  if (action === "note") { 
    const id = makeId(); 
    const el = wrapRangeWithSpan(currentRange, id); 
    if (el) { 
      showNotePopup(el, id, text, anchor); 
    } 
    hideToolbar(); 
    window.getSelection()?.removeAllRanges(); 
  }
  if (action === "remove") { 
    removeHighlightAtRange(currentRange); 
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
  return s.normalize('NFC').replace(/\s+/g, ' ').replace(/[\u200f\u200e]/g, '').trim(); 
}

function ln_findQuoteRangeNormalized(q) {
  if (!q || !q.exact) return null;
  const exact = ln_norm(q.exact);
  if (!exact) return null;
  
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node; const nodes = []; const parts = [];
  while ((node = walker.nextNode())) {
    nodes.push(node);
    parts.push(ln_norm(node.nodeValue || ''));
  }
  const hay = parts.join('');
  let idx = -1;
  if (q.prefix) {
    const p = ln_norm(q.prefix);
    const pIdx = hay.indexOf(p);
    if (pIdx >= 0) idx = hay.indexOf(exact, Math.max(0, pIdx + p.length - 1));
  }
  if (idx === -1) idx = hay.indexOf(exact);
  if (idx === -1) return null;
  const end = idx + exact.length;
  
  let cur = 0;
  const range = document.createRange();
  let gotS = false, gotE = false;
  for (let i = 0; i < nodes.length; i++) {
    const len = (parts[i] || '').length;
    const next = cur + len;
    if (!gotS && idx >= cur && idx <= next) {
      const raw = (nodes[i].nodeValue || '');
      const rawOffset = Math.min(raw.length, idx - cur);
      range.setStart(nodes[i], rawOffset);
      gotS = true;
    }
    if (!gotE && end >= cur && end <= next) {
      const raw = (nodes[i].nodeValue || '');
      const rawOffset = Math.min(raw.length, end - cur);
      range.setEnd(nodes[i], rawOffset);
      gotE = true; break;
    }
    cur = next;
  }
  return (gotS && gotE) ? range : null;
}

// --- Main Restore and Language Logic ---

async function ln_applyAllFromStorage() {
  try {
    const all = await chrome.storage.local.get(null);
    const key = PAGE_KEY;
    const arr = all[key];
    if (!Array.isArray(arr)) return;
    
    for (const rec of arr) {
      if (!rec || !rec.id) continue;
      if (document.querySelector('[data-yh-id="' + rec.id + '"]')) continue;
      
      let range = null;

      // 1. PRIMARY: Try XPath/Offset anchoring (NEW, reliable method)
      if (rec.quote && rec.quote.startContainerXPath) {
        range = ln_recreateRangeFromAnchor(rec.quote);
      }
      
      // 2. FALLBACK: Fall back to old string-based anchoring (for legacy data)
      if (!range && rec.quote) {
        range = ln_findQuoteRangeNormalized(rec.quote); 
      }
      if (!range && rec.text) {
        range = ln_findQuoteRangeNormalized({ exact: rec.text });
      }
      
      if (range) {
        const span = wrapRangeWithSpan(range, rec.id); 
        if (span && rec.note) {
           addPin(span);
        }
      }
    }
  } catch (e) { console.error("Error applying stored highlights:", e); }
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
    if (rec.quote.startContainerXPath) {
      range = ln_recreateRangeFromAnchor(rec.quote);
    }
    if (!range) {
      range = ln_findQuoteRangeNormalized(rec.quote);
    }
    
    if (!range) return;
    
    const span = wrapRangeWithSpan(range, id);
    if (span) {
       span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (e) { }
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
      
      // Set lang attribute on document element for CSS selectors
      document.documentElement.lang = laranote_lang;
      document.documentElement.dir = dir;
      
      document.querySelectorAll(".yh-toolbar").forEach(tb => tb.setAttribute("dir", dir));
      
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

// 1. Setup Toolbar Listeners
document.addEventListener("mouseup", () => { setTimeout(() => { const r = getSelectionRangeSafe(); if (!r) { hideToolbar(); currentRange = null; return; } currentRange = r; const pt = selectionClientPoint(r); showToolbarAt(pt.x, pt.y); }, 0); });
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

// 3. Run Main Restore Logic
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