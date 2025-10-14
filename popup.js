// Laranote popup v4.13 — clean build
const KEY_PREFIX = "yh_notes_v1::";
const DEFAULT_LANG = "ar";

const I18N = {
  ar: {
    refresh: "تحديث",
    export: "تصدير JSON",
    options: "الإعدادات",
    enableToolbar: "تفعيل الشريط",
    empty: "لا توجد ملاحظات بعد. قم بتظليل نص على صفحة لإضافة ملاحظات.",
    highlight: "تظليل",
    note: "ملاحظة",
    prev: "السابق",
    next: "التالي",
    page: "صفحة",
    of: "من",
    made: "❤️ By Emad Rashad",
  },
  en: {
    refresh: "Refresh",
    export: "Export JSON",
    options: "Options",
    enableToolbar: "Enable Toolbar",
    empty: "No notes yet. Select text on a page to add highlights & notes.",
    highlight: "Highlight",
    note: "Note",
    prev: "Prev",
    next: "Next",
    page: "Page",
    of: "of",
    made: "By Emad Rashad ❤️",
  }
};

async function getLang() {
  const { laranote_lang } = await chrome.storage.sync.get({ laranote_lang: DEFAULT_LANG });
  return laranote_lang || DEFAULT_LANG;
}
async function getPerPage() {
  const { laranote_per_page } = await chrome.storage.sync.get({ laranote_per_page: 10 });
  let n = parseInt(laranote_per_page, 10);
  if (isNaN(n) || n < 5) n = 5;
  if (n > 50) n = 50;
  return n;
}
function trimText(s, n = 100) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}
function buildTextFragment(text) {
  if (!text) return "";
  try {
    const enc = encodeURIComponent(text);
    return `#:~:text=${enc}`;
  } catch (e) { return ""; }
}

// Load & group by (url + id) so we can determine which ones have notes
async function loadAll() {
  const all = await chrome.storage.local.get(null);
  const byKey = new Map();
  for (const [k, arr] of Object.entries(all)) {
    if (!k.startsWith(KEY_PREFIX) || !Array.isArray(arr)) continue;
    const url = k.replace(KEY_PREFIX, "");
    for (const rec of arr) {
      const key = url + "|" + (rec.id || "_");
      const ex = byKey.get(key) || { url, id: rec.id, text: rec.text || "", hasNote: false, notes: [], createdAt: rec.createdAt || Date.now() };
      if (rec.note && rec.note.trim()) {
        ex.hasNote = true;
        ex.notes.push(rec.note.trim());
      }
      if (rec.createdAt && rec.createdAt > ex.createdAt) ex.createdAt = rec.createdAt;
      if (!ex.text && rec.text) ex.text = rec.text;
      byKey.set(key, ex);
    }
  }
  const out = Array.from(byKey.values());
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

// Pagination state
let __allItems = [];
let __page = 1;
let __perPage = 10;
let __lang = DEFAULT_LANG;

function totalPages() {
  return Math.max(1, Math.ceil(__allItems.length / __perPage));
}
function sliceItems() {
  const start = (__page - 1) * __perPage;
  return __allItems.slice(start, start + __perPage);
}

function render(items, lang) {
  const T = I18N[lang] || I18N[DEFAULT_LANG];
  const root = document.getElementById("list");
  root.innerHTML = "";
  // toggle export visibility based on items
  const expBtn = document.getElementById("export");
  if (expBtn) expBtn.style.display = (items && items.length ? "inline-block" : "none");

  if (!items.length) {
    root.innerHTML = `<div class="empty">${T.empty}</div>`;
    renderPager();
    return;
  }
  items.forEach((it) => {
    const d = new Date(it.createdAt);
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <div class="url">${it.url}</div>
      <div class="note" dir="auto">${trimText((it.hasNote ? it.notes[0] : (it.text || "")), 100)}</div>
      <div class="meta"><span>${d.toLocaleString()}</span><span>${it.hasNote ? `${T.highlight} · ${T.note}` : T.highlight}</span></div>
    `;
    el.addEventListener("click", () => {
      const frag = buildTextFragment((it.text || "").slice(0, 150));
      const deep = `#laranote=${it.id || ""}`;
      const finalUrl = it.url + deep + frag;
      chrome.tabs.create({ url: finalUrl });
    });
    root.appendChild(el);
  });
  renderPager();
}

function renderPager() {
  const T = I18N[__lang] || I18N[DEFAULT_LANG];
  const el = document.getElementById("pager");
  if (!el) return;
  const tp = totalPages();
  if (__allItems.length <= __perPage) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <button id="pg-prev">${T.prev}</button>
    <span class="info">${T.page} ${__page} ${T.of} ${tp}</span>
    <button id="pg-next">${T.next}</button>
  `;
  document.getElementById("pg-prev").addEventListener("click", () => { if (__page > 1) { __page--; rerender(); } });
  document.getElementById("pg-next").addEventListener("click", () => { if (__page < tp) { __page++; rerender(); } });
}

function rerender() {
  render(sliceItems(), __lang);
}

// Footer & buttons
function setFooterAndButtons() {
  const T = I18N[__lang] || I18N[DEFAULT_LANG];
  const r = document.getElementById("refresh"); if (r) r.textContent = T.refresh;
  const e = document.getElementById("export"); if (e) { e.textContent = T.export; e.style.display = "none"; }
  const o = document.getElementById("optionsBtn"); if (o) o.textContent = T.options || "Options";
  const tl = document.getElementById("toggleToolbarLabel"); if (tl) tl.textContent = T.enableToolbar || "Enable Toolbar";
  const tw = document.querySelector("label.toggle"); if (tw) tw.title = T.enableToolbar || "Enable Toolbar";
  const made = document.getElementById("made");
  if (made) {
    made.textContent = T.made;
    made.href = "https://github.com/emadrashad";
    made.onclick = (ev) => { ev.preventDefault(); chrome.tabs.create({ url: "https://github.com/emadrashad" }); };
  }
  const mv = chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
  const version = mv && mv.version ? "v" + mv.version : "v—";
  const vb = document.getElementById("verBadge"); if (vb) vb.textContent = version;
}

async function start() {
  try {
    __lang = await getLang();
    document.documentElement.setAttribute("dir", __lang === "ar" ? "rtl" : "ltr");
    __perPage = await getPerPage();
    setFooterAndButtons();

    const tgl = document.getElementById("toggleToolbar");
    if (tgl && chrome?.storage?.sync) {
      try {
        const { laranote_toolbar_enabled } = await chrome.storage.sync.get({ laranote_toolbar_enabled: true });
        tgl.checked = !!laranote_toolbar_enabled;
      } catch (e) { /* ignore */ }
      tgl.addEventListener("change", async (ev) => {
        try {
          await chrome.storage.sync.set({ laranote_toolbar_enabled: !!ev.target.checked });
        } catch (e) { /* ignore */ }
      });
    }

    __allItems = await loadAll();
    __page = 1;
    rerender();
  } catch (e) {
    console.error("Laranote popup start error:", e);
    const root = document.getElementById("list");
    if (root) root.innerHTML = '<div class="empty">Error loading notes. See console.</div>';
  }
}

// Events
document.getElementById("refresh").addEventListener("click", start);
document.getElementById("export").addEventListener("click", async () => {
  const items = await loadAll();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "laranote-export.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const optBtn = document.getElementById("optionsBtn");
if (optBtn && chrome.runtime && chrome.runtime.openOptionsPage) {
  optBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
}

start();
