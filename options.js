
const DEFAULT_LANG = 'en';

async function load() {
  const { laranote_per_page } = await chrome.storage.sync.get({ laranote_per_page: 5 });
  document.getElementById('perpage').value = laranote_per_page;
  const { laranote_lang } = await chrome.storage.sync.get({ laranote_lang: DEFAULT_LANG });
  document.getElementById('lang').value = laranote_lang || DEFAULT_LANG;
  
  // Load complex warning setting
  const { laranote_complex_warning } = await chrome.storage.sync.get({ laranote_complex_warning: true });
  document.getElementById('complexWarning').checked = laranote_complex_warning;
  
  // Apply language to body for CSS switching
  document.body.setAttribute('lang', laranote_lang || DEFAULT_LANG);
}
async function save() {
  const pp = Math.max(5, Math.min(50, parseInt(document.getElementById('perpage').value||'10',10)));
  const v = document.getElementById('lang').value;
  const warningEnabled = document.getElementById('complexWarning').checked;
  await chrome.storage.sync.set({ laranote_lang: v, laranote_per_page: pp, laranote_complex_warning: warningEnabled });
  
  // Update body language for CSS switching
  document.body.setAttribute('lang', v);
  
  const status = document.getElementById('status');
  status.textContent = v === 'ar' ? 'تم الحفظ' : 'Saved';
  setTimeout(()=> status.textContent = '', 1200);
}
document.getElementById('save').addEventListener('click', save);
load();
