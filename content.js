
(function () {

  // If URL includes #laranote=<id>, after restore try to scroll to that highlight.
  function scrollToHighlightById(id) {
    const el = document.querySelector(`.yh-highlight[data-yh-id="${id}"]`);
    if (!el) return false;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Pulse animation
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

  const AR = { highlight: "تظليل", note: "ملاحظة", copy: "نسخ", remove: "إزالة", saved: "تم الحفظ", addNotePlaceholder: "اكتب ملاحظتك هنا...", notes: "ملاحظات", cancel: "إلغاء", save: "حفظ" };
  const KEY_PREFIX = "yh_notes_v1::"; const PAGE_KEY = KEY_PREFIX + location.origin + location.pathname;
  let toolbarEl = null, notePopEl = null, currentRange = null;

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
      const toWrap = []; while (walker.nextNode()) {
        const tn = walker.currentNode; if (!tn.nodeValue || !tn.nodeValue.trim()) continue;
        if (range.intersectsNode && !range.intersectsNode(tn)) continue;
        let s = 0, e2 = tn.nodeValue.length; if (tn === range.startContainer) s = range.startOffset; if (tn === range.endContainer) e2 = range.endOffset; if (s >= e2) continue;
        toWrap.push({ tn, startOffset: s, endOffset: e2 });
      }
      let first = null; toWrap.forEach(({ tn, startOffset, endOffset }) => {
        const before = tn.splitText(startOffset); const after = before.splitText(endOffset - startOffset);
        const wrap = document.createElement("span"); wrap.className = "yh-highlight"; wrap.dataset.yhId = id; before.parentNode.replaceChild(wrap, before); wrap.appendChild(before); if (!first) first = wrap;
      });
      return first;
    }
  }
  async function saveRecord(r) { const data = (await chrome.storage.local.get(PAGE_KEY))[PAGE_KEY] || []; data.push(r); await chrome.storage.local.set({ [PAGE_KEY]: data }); }
  async function getRecords() { return (await chrome.storage.local.get(PAGE_KEY))[PAGE_KEY] || []; }
  async function setRecords(l) { await chrome.storage.local.set({ [PAGE_KEY]: l }); }
  function selectionClientPoint(range) { const rect = range.getBoundingClientRect(); return { x: Math.max(12, rect.left + window.scrollX), y: Math.max(12, rect.top + window.scrollY) - 40 }; }
  async function onToolbarClick(e) {
    const btn = e.target.closest("button"); if (!btn || !currentRange) return; const action = btn.dataset.action;
    if (action === "highlight") { const text = currentRange.toString(); const id = makeId(); const el = wrapRangeWithSpan(currentRange, id); if (el) { await saveRecord({ id, text, note: "", createdAt: Date.now() }); } hideToolbar(); window.getSelection()?.removeAllRanges(); }
    if (action === "copy") { try { await navigator.clipboard.writeText(currentRange.toString()); } catch (err) { } hideToolbar(); window.getSelection()?.removeAllRanges(); }
    if (action === "note") { const text = currentRange.toString(); const id = makeId(); const el = wrapRangeWithSpan(currentRange, id); if (el) { showNotePopup(el, id, text); } hideToolbar(); window.getSelection()?.removeAllRanges(); }
    if (action === "remove") { removeHighlightAtRange(currentRange); hideToolbar(); window.getSelection()?.removeAllRanges(); }
  }
  function removeHighlightAtRange(range) {
    const start = range.startContainer; const span = start.nodeType === 1 ? start.closest(".yh-highlight") : start.parentElement?.closest(".yh-highlight");
    if (span) {
      const id = span.dataset.yhId; unwrapSpan(span); document.querySelectorAll(`.yh-highlight[data-yh-id="${id}"]`).forEach(unwrapSpan);
      getRecords().then(list => setRecords(list.filter(r => r.id !== id)));
    }
  }
  function unwrapSpan(span) { while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span); span.remove(); }
  function showNotePopup(anchor, id, selectedText) {
    hideNotePopup(); const rect = anchor.getBoundingClientRect(); const pop = document.createElement("div"); pop.className = "yh-note-pop";
    pop.style.left = (rect.left + window.scrollX) + "px"; pop.style.top = (rect.bottom + window.scrollY + 6) + "px";
    pop.innerHTML = `<div class="yh-badge">"${selectedText.slice(0, 40)}${selectedText.length > 40 ? '…' : ''}"</div>
      <div style="margin-top:6px;"><textarea data-act="addNotePlaceholder" placeholder="${AR.addNotePlaceholder}"></textarea></div>
      <div style="margin-top:8px; display:flex; gap:8px; justify-content:flex-end;"><button class="yh-cancel" data-act="cancel">${AR.cancel}</button><button class="yh-save" data-act="save">${AR.save}</button></div>
      <div class="yh-note-list" hidden></div>`;
    document.body.appendChild(pop); notePopEl = pop;
    pop.querySelector(".yh-cancel").addEventListener("click", hideNotePopup);
    pop.querySelector(".yh-save").addEventListener("click", async () => {
      const note = pop.querySelector("textarea").value.trim();
      await saveRecord({ id, text: selectedText, note, createdAt: Date.now() }); addPin(anchor); hideNotePopup();
    });
  }
  function addPin(el) {
    if (el.querySelector(".yh-note-pin")) return; const pin = document.createElement("sup"); pin.className = "yh-note-pin"; pin.textContent = "📌"; pin.title = "Note attached";
    pin.addEventListener("click", async (e) => {
      e.stopPropagation(); const id = el.dataset.yhId; const list = await getRecords(); const items = list.filter(r => r.id === id && r.note); if (!items.length) return;
      const rect = el.getBoundingClientRect(); const pop = document.createElement("div"); pop.className = "yh-note-pop"; pop.style.left = (rect.left + window.scrollX) + "px"; pop.style.top = (rect.bottom + window.scrollY + 6) + "px";
      pop.innerHTML = `<div style="font-weight:600; margin-bottom:6px;" data-act="notes">${AR.notes}</div>`; const wrap = document.createElement("div"); wrap.className = "yh-note-list";
      items.forEach(it => { const d = new Date(it.createdAt); const item = document.createElement("div"); item.className = "yh-note-item"; item.innerHTML = `<div>${escapeHtml(it.note)}</div><small>${d.toLocaleString()}</small>`; wrap.appendChild(item); });
      pop.appendChild(wrap); document.body.appendChild(pop); function close() { pop.remove(); document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", onDoc, true); }
      function onDoc(ev) { if (!pop.contains(ev.target)) close(); } document.addEventListener("mousedown", onDoc); window.addEventListener("scroll", onDoc, true);
    });
    el.appendChild(pin);
  }
  function hideNotePopup() { if (notePopEl) { notePopEl.remove(); notePopEl = null; } }
  function escapeHtml(s) { return s.replace(/[&<>"'`=\/]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;", "/": "&#x2F;", "`": "&#x60;", "=": "&#x3D;" }[c])); }
  async function restore() {
    const list = await getRecords(); if (!list.length) return; const map = new Map(); list.forEach(r => { if (!map.has(r.id)) map.set(r.id, []); map.get(r.id).push(r); });
    for (const [id, items] of map.entries()) { const text = items[0].text; const el = findAndWrapFirst(text, id); if (el && items.some(it => it.note)) addPin(el); }
  }
  function findAndWrapFirst(text, id) {
    if (!text || text.length < 2) return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode(n) { if (!n.nodeValue) return NodeFilter.FILTER_REJECT; if (n.parentElement && n.parentElement.closest(".yh-toolbar,.yh-note-pop")) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
    while (walker.nextNode()) { const tn = walker.currentNode; const idx = tn.nodeValue.indexOf(text); if (idx !== -1) { const before = tn.splitText(idx); before.splitText(text.length); const wrap = document.createElement("span"); wrap.className = "yh-highlight"; wrap.dataset.yhId = id; before.parentNode.replaceChild(wrap, before); wrap.appendChild(before); return wrap; } } return null;
  }
  document.addEventListener("mouseup", () => { setTimeout(() => { const r = getSelectionRangeSafe(); if (!r) { hideToolbar(); currentRange = null; return; } currentRange = r; const pt = selectionClientPoint(r); showToolbarAt(pt.x, pt.y); }, 0); });
  document.addEventListener("mousedown", e => { if (toolbarEl && !toolbarEl.contains(e.target)) hideToolbar(); if (notePopEl && !notePopEl.contains(e.target)) hideNotePopup(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { hideToolbar(); hideNotePopup(); window.getSelection()?.removeAllRanges(); } });
  restore().then(() => {
    const targetId = getLaranoteHashId();
    if (targetId) {
      // In case layout needs a tick post-restore
      setTimeout(() => { scrollToHighlightById(targetId); }, 300);
    }
  });
})();

/* === v4.9: force toolbar language to follow Settings === */
(function () {
  const MAP = {
    ar: { remove: "إزالة", copy: "نسخ", note: "ملاحظة", highlight: "تظليل", addNotePlaceholder: "اكتب ملاحظتك هنا...", cancel: "إلغاء", save: "حفظ", notes: "ملاحظات" },
    en: { remove: "Remove", copy: "Copy", note: "Note", highlight: "Highlight", addNotePlaceholder: "Write your note...", cancel: "Cancel", save: "Save", notes: "Notes" }
  };
  function applyToolbarLang() {
    try {
      chrome.storage.sync.get({ laranote_lang: "ar" }, ({ laranote_lang }) => {
        const T = MAP[laranote_lang] || MAP.ar;
        const dir = laranote_lang === "ar" ? "rtl" : "ltr";
        // set direction on toolbars
        document.querySelectorAll(".yh-toolbar").forEach(tb => tb.setAttribute("dir", dir));
        // find any element that opts into translation via data-act
        document.querySelectorAll('[data-act]').forEach(el => {
          const act = el.getAttribute('data-act');
          if (!act) return;
          const val = T[act];
          if (!val) return;
          // Set direction for elements that should inherit language direction
          try { el.setAttribute('dir', dir); } catch (e) { }
          // Inputs / textareas: set placeholder
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.setAttribute('placeholder', val);
            // For textareas we want user typing language: force LTR for English
            if (el.tagName === 'TEXTAREA') {
              try { el.setAttribute('dir', laranote_lang === 'ar' ? 'rtl' : 'ltr'); } catch (e) { }
            }
            return;
          }
          // Buttons: set textContent
          if (el.tagName === 'BUTTON') {
            el.textContent = val;
            return;
          }
          // Other elements: set textContent
          el.textContent = val;
        });
      });
    } catch (e) { }
  }
  applyToolbarLang();
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.laranote_lang) applyToolbarLang();
    });
  }
  const mo = new MutationObserver((m) => applyToolbarLang());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();


/* v4.14: quote-based anchoring (prefix/exact/suffix) for robust reapply */
function ln_getSelectionQuote(range) {
  try {
    const exact = range.toString();
    // Get up to 40 chars of prefix/suffix from document text around the range
    function collect(dir) {
      const r = range.cloneRange();
      const max = 40;
      if (dir === "prefix") {
        r.setStart(document.body, 0);
        const s = r.toString();
        return s.slice(-max);
      } else {
        r.setEndAfter(document.body);
        const s = r.toString();
        const idx = s.indexOf(exact);
        if (idx === -1) return "";
        return s.slice(idx + exact.length, idx + exact.length + max);
      }
    }
    const prefix = collect("prefix");
    const suffix = collect("suffix");
    return { exact, prefix, suffix };
  } catch (e) { return { exact: range.toString() }; }
}

// Walk the DOM's text nodes and find the first occurrence of `exact` bounded by optional prefix/suffix
function ln_findQuoteRange(quote) {
  if (!quote || !quote.exact) return null;
  const { exact, prefix = "", suffix = "" } = quote;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node, acc = "", nodes = [];
  while ((node = walker.nextNode())) {
    const t = node.nodeValue || "";
    nodes.push(node);
    acc += t;
  }
  // Build the haystack and search
  const hay = acc;
  let startIdx = -1;
  if (prefix) {
    const pIdx = hay.indexOf(prefix);
    if (pIdx >= 0) {
      startIdx = hay.indexOf(exact, pIdx + prefix.length - 1);
    }
  }
  if (startIdx === -1) {
    startIdx = hay.indexOf(exact);
  }
  if (startIdx === -1) return null;
  const endIdx = startIdx + exact.length;

  // Map the [startIdx, endIdx) into nodes
  let si = startIdx, ei = endIdx, cur = 0;
  const range = document.createRange();
  let gotStart = false, gotEnd = false;
  for (const n of nodes) {
    const len = (n.nodeValue || "").length;
    const next = cur + len;
    if (!gotStart && si >= cur && si <= next) {
      range.setStart(n, si - cur);
      gotStart = true;
    }
    if (!gotEnd && ei >= cur && ei <= next) {
      range.setEnd(n, ei - cur);
      gotEnd = true;
      break;
    }
    cur = next;
  }
  return (gotStart && gotEnd) ? range : null;
}

// On hash navigation, if highlight element not present, try to re-anchor using stored quote
async function ln_tryReanchorFromStorage(id) {
  try {
    const all = await chrome.storage.local.get(null);
    // find the array by url key
    const key = KEY_PREFIX + location.origin + location.pathname;
    const arr = all[key];
    if (!Array.isArray(arr)) return;
    const rec = arr.find(r => r.id === id);
    if (!rec || !rec.quote || !rec.quote.exact) return;
    const r = ln_findQuoteRange(rec.quote);
    if (!r) return;
    // wrap it again
    const span = document.createElement('span');
    span.className = 'yh-highlight';
    span.setAttribute('data-laranote-id', id);
    r.surroundContents(span);
    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) { }
}

// Hook into existing on-load deep-link handler (if any)
(function () {
  const idFromHash = (location.hash.match(/laranote=([^&]+)/) || [])[1];
  if (idFromHash) {
    // if not found, try reanchor
    setTimeout(() => {
      const existing = document.querySelector('[data-laranote-id="' + idFromHash + '"]');
      if (!existing) {
        ln_tryReanchorFromStorage(idFromHash);
      }
    }, 300);
  }
})();


// v4.14 attach quote when saving selection (best-effort)
try {
  if (typeof selection !== 'undefined' && selection && selection.rangeCount) {
    const __r = selection.getRangeAt(0).cloneRange();
    const __q = ln_getSelectionQuote(__r);
    if (pendingRecord && !pendingRecord.quote) { pendingRecord.quote = __q; }
  }
} catch (e) { }


/* v4.15: apply ALL stored highlights on load with normalization */
function ln_norm(s) {
  if (!s) return "";
  return s.replace(/\s+/g, ' ').replace(/[\u200f\u200e]/g, '').trim(); // collapse whitespace + strip RLM/LRM
}
function ln_findQuoteRangeNormalized(q) {
  if (!q || !q.exact) return null;
  const exact = ln_norm(q.exact);
  if (!exact) return null;
  // collect text nodes
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
  // Map back into nodes
  let cur = 0;
  const range = document.createRange();
  let gotS = false, gotE = false;
  for (let i = 0; i < nodes.length; i++) {
    const len = (parts[i] || '').length;
    const next = cur + len;
    if (!gotS && idx >= cur && idx <= next) {
      // find raw offset within original node by scanning
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

async function ln_applyAllFromStorage() {
  try {
    const all = await chrome.storage.local.get(null);
    const key = KEY_PREFIX + location.origin + location.pathname;
    const arr = all[key];
    if (!Array.isArray(arr)) return;
    for (const rec of arr) {
      if (!rec || !rec.id) continue;
      if (document.querySelector('[data-laranote-id="' + rec.id + '"]')) continue;
      let range = null;
      if (rec.quote) range = ln_findQuoteRangeNormalized(rec.quote);
      if (!range && rec.text) {
        range = ln_findQuoteRangeNormalized({ exact: rec.text });
      }
      if (range) {
        const span = document.createElement('span');
        span.className = 'yh-highlight';
        span.setAttribute('data-laranote-id', rec.id);
        try { range.surroundContents(span); } catch (e) { /* fallback: wrap using extract/insert */
          const frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
        }
      }
    }
  } catch (e) { }
}

// Run on ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ln_applyAllFromStorage);
} else {
  ln_applyAllFromStorage();
}

