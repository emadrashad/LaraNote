
// Laranote popup v4.13 — clean build
const KEY_PREFIX = "yh_notes_v1::";
const DEFAULT_LANG = "en";

const I18N = {
  ar: {
    export: "تصدير JSON",
    empty: "لا توجد ملاحظات بعد. قم بتظليل نص على صفحة لإضافة ملاحظات.",
    highlight: "تظليل",
    note: "ملاحظة",
    prev: "السابق",
    next: "التالي",
    page: "صفحة",
    of: "من",
    // Settings translations
    settings_title: "الإعدادات",
    items_per_page: "الملاحظات لكل صفحة",
    items_per_page_hint: "عدد الملاحظات لكل صفحة.",
    language: "اللغة",
    language_hint: "لغة الواجهة.",
    export_json: "تصدير JSON",
    import_json: "استيراد JSON",
    data_management: "إدارة البيانات",
    data_management_hint: "نسخ احتياطي واستعادة الملاحظات الخاصة بك عبر الأجهزة.",
    save_settings: "حفظ الإعدادات"
  },
  en: {
    export: "Export JSON",
    empty: "No notes yet. Select text on a page to add highlights & notes.",
    highlight: "Highlight",
    note: "Note",
    prev: "Prev",
    next: "Next",
    page: "Page",
    of: "of",
    // Settings translations
    settings_title: "Settings",
    items_per_page: "Items per page",
    items_per_page_hint: "How many notes to show per page.",
    language: "Language",
    language_hint: "Interface language.",
    export_json: "Export JSON",
    import_json: "Import JSON",
    data_management: "Data Management",
    data_management_hint: "Backup and restore your highlights across devices.",
    save_settings: "Save Settings"
  }
};

async function getLang() {
  const { laranote_lang } = await chrome.storage.sync.get({ laranote_lang: DEFAULT_LANG });
  return laranote_lang || DEFAULT_LANG;
}
async function getPerPage() {
  const { laranote_per_page } = await chrome.storage.sync.get({ laranote_per_page: 5 });
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

// Pagination state - moved to global scope

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

  if (!items.length) {
    root.innerHTML = `<div class="empty">${T.empty}</div>`;
    renderPager();
    return;
  }
  items.forEach((it) => {
    const d = new Date(it.createdAt);
    const el = document.createElement("div");
    el.className = "card";
    
    // Detect if note content contains Arabic text
    const noteContent = it.hasNote ? it.notes[0] : (it.text || "");
    const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(noteContent);
    
    el.innerHTML = `
      <div class="url">${it.url}</div>
      <div class="note" dir="auto" ${hasArabic ? 'lang="ar"' : ''}>${trimText(noteContent, 100)}</div>
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

// Footer & buttons - removed as export moved to settings

async function start() {
  try {
    
    __lang = await getLang();
    document.documentElement.setAttribute("dir", __lang === "ar" ? "rtl" : "ltr");
    __perPage = await getPerPage();
    __allItems = await loadAll();
    __page = 1;
    rerender();
    
    // Check if settings button exists after rendering
    const settingsBtn = document.getElementById('settings-btn');
    
    if (settingsBtn) {
      // Add event listener here as a backup
      settingsBtn.addEventListener('click', () => {
        // Find the showSettings function from the closure
        if (typeof showSettings === 'function') {
          showSettings();
        }
      });
    }
  } catch (e) {
    const root = document.getElementById("list");
    if (root) root.innerHTML = '<div class="empty">Error loading notes. See console.</div>';
  }
}

// Events

// Export functionality moved to settings popup

// Global variables for settings
let settingsBtn, settingsPopup, settingsBack, settingsSave, settingsExport, settingsImport, settingsImportFile, settingsStatus;
let isSaving = false;

// Global variables for main functionality
let __perPage = 5;
let __lang = 'en';
let __items = [];
let __filtered = [];
let __page = 1;
let __search = '';
let __sort = 'newest';
let __allItems = [];

// Settings popup functionality
function initSettings() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsInternal);
  } else {
    initSettingsInternal();
  }
}

function initSettingsInternal() {
  settingsBtn = document.getElementById('settings-btn');
  settingsPopup = document.getElementById('settings-popup');
  settingsBack = document.getElementById('settings-back');
  settingsSave = document.getElementById('settings-save');
  settingsExport = document.getElementById('settings-export');
  settingsImport = document.getElementById('settings-import');
  settingsImportFile = document.getElementById('settings-import-file');
  settingsStatus = document.getElementById('settings-status');
  
  // Load current settings
  loadSettings();
  
  // Setup event listeners
  setupSettingsEventListeners();
  setupSaveButton();
  
}

// Update settings translations
function updateSettingsTranslations(lang) {
  const T = I18N[lang] || I18N[DEFAULT_LANG];
  
  // Update all elements with data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (T[key]) {
      element.textContent = T[key];
    }
  });
  
  // Fix back arrow direction for RTL
  const backButton = document.getElementById('settings-back');
  if (backButton) {
    const svg = backButton.querySelector('svg polyline');
    if (svg) {
      svg.setAttribute('points', lang === 'ar' ? '9 18 15 12 9 6' : '15 18 9 12 15 6');
    }
  }
  
  // Apply Arabic font when language is Arabic
  if (lang === 'ar') {
    document.documentElement.setAttribute('lang', 'ar');
    document.body.classList.add('arabic-font-loaded');
    document.body.classList.remove('arabic-font-loading');
  } else {
    document.documentElement.setAttribute('lang', 'en');
    document.body.classList.remove('arabic-font-loaded');
  }
}
  
// Load current settings into settings popup
async function loadSettings() {
  const { laranote_per_page } = await chrome.storage.sync.get({ laranote_per_page: 5 });
  const { laranote_lang } = await chrome.storage.sync.get({ laranote_lang: DEFAULT_LANG });
  
  document.getElementById('settings-perpage').value = laranote_per_page;
  document.getElementById('settings-lang').value = laranote_lang;
  
  // Update translations for current language
  updateSettingsTranslations(laranote_lang);
}
  
// Show settings popup
function showSettings() {
  loadSettings();
  settingsPopup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Update export button state based on items count
  updateExportButtonState();
  
  // Add a small delay to prevent immediate mouse events
  setTimeout(() => {
    settingsPopup.style.pointerEvents = 'auto';
    // Add a flag to prevent auto-hiding
    settingsPopup.dataset.preventHide = 'true';
    // Remove the flag after a short delay
    setTimeout(() => {
      delete settingsPopup.dataset.preventHide;
    }, 500);
  }, 50);
}
  
// Hide settings popup
function hideSettings() {
  // Don't hide if preventHide flag is set
  if (settingsPopup && settingsPopup.dataset.preventHide === 'true') {
    return;
  }
  if (settingsPopup) {
    settingsPopup.style.display = 'none';
    settingsPopup.style.pointerEvents = 'none';
  }
  document.body.style.overflow = '';
  if (settingsStatus) settingsStatus.textContent = '';
}
  
// Save settings
async function saveSettings(e) {
  // Prevent any event bubbling and multiple saves
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  // Prevent multiple saves
  if (isSaving) {
    return;
  }
  isSaving = true;
  
  // Set preventHide flag for the entire save process
  if (settingsPopup) settingsPopup.dataset.preventHide = 'true';
  
  const perPage = parseInt(document.getElementById('settings-perpage').value || '5', 10);
  const lang = document.getElementById('settings-lang').value;
  
  await chrome.storage.sync.set({ 
    laranote_lang: lang, 
    laranote_per_page: perPage 
  });
  
  // Update the current session
  __perPage = perPage;
  __lang = lang;
  document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  
  // Apply Arabic font and language attributes
  if (lang === 'ar') {
    document.documentElement.setAttribute('lang', 'ar');
    document.body.classList.add('arabic-font-loaded');
    document.body.classList.remove('arabic-font-loading');
    // Add lang attribute to specific popup elements for consistency
    document.querySelectorAll('header, main, footer, .settings-panel').forEach(el => {
      el.setAttribute('lang', 'ar');
    });
  } else {
    document.documentElement.setAttribute('lang', 'en');
    document.body.classList.remove('arabic-font-loaded');
    // Remove lang attribute from specific popup elements
    document.querySelectorAll('header, main, footer, .settings-panel').forEach(el => {
      el.removeAttribute('lang');
    });
  }
  
  // Update translations
  updateSettingsTranslations(lang);
  
  // Show success message in current language
  const T = I18N[lang] || I18N[DEFAULT_LANG];
  if (settingsStatus) {
    settingsStatus.textContent = lang === 'ar' ? 'تم الحفظ!' : 'Saved!';
    settingsStatus.style.color = '#28a745'; // Green color for success
  }
  
  // Disable the save button to prevent double-clicks
  const saveBtn = document.getElementById('settings-save');
  if (saveBtn) saveBtn.disabled = true;
  
  // Temporarily disable pointer events on overlay to prevent accidental clicks
  if (settingsPopup) settingsPopup.style.pointerEvents = 'none';
  
  setTimeout(() => {
    if (settingsStatus) {
      settingsStatus.textContent = '';
      settingsStatus.style.color = ''; // Reset to default color
    }
    // Clear the preventHide flag
    if (settingsPopup) delete settingsPopup.dataset.preventHide;
    // Re-enable pointer events
    if (settingsPopup) settingsPopup.style.pointerEvents = 'auto';
    // Re-enable the save button and reset flag
    if (saveBtn) saveBtn.disabled = false;
    isSaving = false;
    // Refresh the main view (but keep popup open)
    rerender();
  }, 1200);
}
  
// Export functionality
async function exportData() {
  try {
    // Get all data from storage
    const allData = await chrome.storage.local.get(null);
    const exportData = {};
    
    // Collect all highlights with KEY_PREFIX
    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith(KEY_PREFIX)) {
        const url = key.replace(KEY_PREFIX, '');
        exportData[url] = value;
      }
    }
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'laranote_backup.json';
    a.click();
    URL.revokeObjectURL(url);
    
    // Show success message in current language
    const T = I18N[__lang] || I18N[DEFAULT_LANG];
    if (settingsStatus) {
      settingsStatus.textContent = __lang === 'ar' ? 'تم التصدير!' : 'Exported!';
      settingsStatus.style.color = '#17a2b8'; // Blue color for export
      setTimeout(() => {
        if (settingsStatus) {
          settingsStatus.textContent = '';
          settingsStatus.style.color = ''; // Reset to default color
        }
      }, 1200);
    }
  } catch (err) {
    // Export error handled silently
  }
}

// Import functionality
async function importData(file) {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate the import data structure
    if (typeof importData !== 'object' || !importData) {
      throw new Error('Invalid JSON format');
    }
    
    // Import each URL's highlights - merge with existing data
    let importedCount = 0;
    for (const [url, highlights] of Object.entries(importData)) {
      if (Array.isArray(highlights)) {
        const storageKey = KEY_PREFIX + url;
        
        // Get existing data for this URL
        const existingData = await chrome.storage.local.get(storageKey);
        const existingHighlights = existingData[storageKey] || [];
        
        // Merge new highlights with existing ones (avoid duplicates)
        const mergedHighlights = [...existingHighlights];
        
        for (const newHighlight of highlights) {
          // Check if this highlight already exists (by text content and position)
          const exists = existingHighlights.some(existing => 
            existing.text === newHighlight.text && 
            existing.startOffset === newHighlight.startOffset &&
            existing.endOffset === newHighlight.endOffset
          );
          
          if (!exists) {
            mergedHighlights.push(newHighlight);
            importedCount++;
          }
        }
        
        await chrome.storage.local.set({ [storageKey]: mergedHighlights });
      }
    }
    
    // Show success message
    const T = I18N[__lang] || I18N[DEFAULT_LANG];
    if (settingsStatus) {
      settingsStatus.textContent = __lang === 'ar' ? `تم استيراد ${importedCount} عنصر!` : `Imported ${importedCount} items!`;
      settingsStatus.style.color = '#28a745'; // Green color for success
      setTimeout(() => {
        if (settingsStatus) {
          settingsStatus.textContent = '';
          settingsStatus.style.color = '';
        }
      }, 2000);
    }
    
    // Refresh the main view and update export button
    __allItems = await loadAll();
    rerender();
    updateExportButtonState();
    
  } catch (err) {
    // Show error message
    const T = I18N[__lang] || I18N[DEFAULT_LANG];
    if (settingsStatus) {
      settingsStatus.textContent = __lang === 'ar' ? 'فشل الاستيراد!' : 'Import failed!';
      settingsStatus.style.color = '#dc3545'; // Red color for error
      setTimeout(() => {
        if (settingsStatus) {
          settingsStatus.textContent = '';
          settingsStatus.style.color = '';
        }
      }, 2000);
    }
  }
}
  
// Event listeners setup function
function setupSettingsEventListeners() {
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettings);

  }
  
  if (settingsBack) {
    settingsBack.addEventListener('click', hideSettings);

  }
  
  if (settingsExport) {
    settingsExport.addEventListener('click', exportData);

  }
  
  if (settingsImport) {
    settingsImport.addEventListener('click', () => {
      settingsImportFile.click();
    });
  }
  
  if (settingsImportFile) {
    settingsImportFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importData(file);
      }
    });
  }
  
  // Close settings when clicking outside
  if (settingsPopup) {
    settingsPopup.addEventListener('click', (e) => {
      if (e.target === settingsPopup && !settingsPopup.dataset.preventHide && !isSaving) {
        hideSettings();
      }
    });

  }
  
  // Close settings on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPopup && settingsPopup.style.display === 'flex') {
      hideSettings();
    }
  });


}

// Setup save button with retry mechanism
function setupSaveButton() {
  const saveButton = document.getElementById('settings-save');
  
  if (saveButton) {
    saveButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveSettings(e);
    });
  }
}

setupSettingsEventListeners();
setupSaveButton();

// Fallback: Use event delegation for save button clicks
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'settings-save') {
    e.preventDefault();
    e.stopPropagation();
    saveSettings(e);
  }
});

start();
initSettings();

// Simple function to count highlights/highlights with notes
async function hasAnyNotes() {
  try {
    const data = await chrome.storage.local.get(null);
    const keys = Object.keys(data);
    
    // Count items with KEY_PREFIX (highlights)
    let count = 0;
    for (const key of keys) {
      if (key.startsWith(KEY_PREFIX)) {
        const items = data[key];
        if (Array.isArray(items)) {
          count += items.length;
        }
      }
    }
    
    return count > 0;
  } catch (err) {
    return false;
  }
}

// Update export button state (enable/disable based on items)
async function updateExportButtonState() {
  try {
    const settingsExport = document.getElementById('settings-export');
    if (!settingsExport) return;
    
    const hasItems = await hasAnyNotes();
    settingsExport.disabled = !hasItems;
  } catch (err) {
    return;
  }
}
