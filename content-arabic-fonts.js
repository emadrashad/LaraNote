/* Arabic Font Enhancement for LaraNote Content Script */

// Arabic Font CSS Injection
const arabicFontCSS = `
  @font-face {
    font-family: 'Playpen Sans Arabic';
    src: url('${chrome.runtime.getURL("fonts/PlaypenSansArabic-VariableFont_wght.ttf")}') format('truetype');
    font-weight: 100 900;
    font-style: normal;
    font-display: swap;
  }
  
  /* Arabic Font for Toolbar and Notes */
  [lang="ar"] .yh-toolbar,
  [lang="ar"] .yh-toolbar *,
  [lang="ar"] .yh-note-pop,
  [lang="ar"] .yh-note-pop *,
  [lang="ar"] .yh-note-item,
  [lang="ar"] .yh-badge,
  [lang="ar"] .meta {
    font-family: 'Playpen Sans Arabic', 'Segoe UI', 'Arial', sans-serif !important;
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
  
  /* Enhanced Arabic Typography */
  [lang="ar"] .yh-toolbar {
    font-weight: 500;
    letter-spacing: 0.5px;
  }
  
  [lang="ar"] .yh-note-pop {
    font-weight: 400;
    line-height: 1.6;
  }
  
  [lang="ar"] .yh-note-pop textarea {
    font-family: 'Playpen Sans Arabic', 'Segoe UI', 'Arial', sans-serif !important;
    font-weight: 400;
    line-height: 1.5;
  }
  
  [lang="ar"] .yh-note-item {
    font-weight: 400;
    line-height: 1.5;
  }
  
  [lang="ar"] .yh-badge {
    font-weight: 500;
    font-size: 11px;
  }
  
  /* Arabic Highlight Text - REMOVED: Don't apply Arabic font to highlighted text */
  /* [lang="ar"] .yh-highlight {
    font-family: 'Playpen Sans Arabic', 'Segoe UI', 'Arial', sans-serif;
    font-weight: 400;
  } */
  
  /* Arabic Font Loading Animation */
  .arabic-font-loading {
    font-family: 'Segoe UI', 'Arial', sans-serif;
    transition: font-family 0.3s ease;
  }
  
  .arabic-font-loaded {
    font-family: 'Playpen Sans Arabic', 'Segoe UI', 'Arial', sans-serif;
  }
`;

// Function to inject Arabic font CSS
function injectArabicFontCSS() {
  if (!document.getElementById('laranote-arabic-fonts')) {
    const style = document.createElement('style');
    style.id = 'laranote-arabic-fonts';
    style.textContent = arabicFontCSS;
    document.head.appendChild(style);
  }
}

// Function to apply Arabic font based on language
function applyArabicFont(lang) {
  if (lang === 'ar') {
    document.documentElement.setAttribute('lang', 'ar');
    document.body.classList.add('arabic-font-loaded');
    document.body.classList.remove('arabic-font-loading');
    
    // Apply to existing toolbars and note pops
    document.querySelectorAll('.yh-toolbar, .yh-note-pop').forEach(el => {
      el.classList.add('arabic-font-loaded');
    });
  } else {
    document.documentElement.setAttribute('lang', 'en');
    document.body.classList.remove('arabic-font-loaded');
    
    document.querySelectorAll('.yh-toolbar, .yh-note-pop').forEach(el => {
      el.classList.remove('arabic-font-loaded');
    });
  }
}

// Function to get current language from storage
async function getCurrentLanguage() {
  try {
    const result = await chrome.storage.sync.get({ laranote_lang: 'en' });
    return result.laranote_lang;
  } catch (error) {
    return 'en';
  }
}

// Initialize Arabic font support
async function initArabicFontSupport() {
  injectArabicFontCSS();
  const lang = await getCurrentLanguage();
  applyArabicFont(lang);
}

// Listen for language changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.laranote_lang) {
    applyArabicFont(changes.laranote_lang.newValue);
  }
});

// Export for use in content script
window.LaraNoteArabic = {
  initArabicFontSupport,
  applyArabicFont,
  getCurrentLanguage
};