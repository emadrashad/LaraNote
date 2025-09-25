
const DEFAULT_LANG = 'ar';

async function load() {
  const { laranote_per_page } = await chrome.storage.sync.get({ laranote_per_page: 10 });
  document.getElementById('perpage').value = laranote_per_page;
  const { laranote_lang } = await chrome.storage.sync.get({ laranote_lang: DEFAULT_LANG });
  document.getElementById('lang').value = laranote_lang || DEFAULT_LANG;
}
async function save() {
  const pp = Math.max(5, Math.min(50, parseInt(document.getElementById('perpage').value||'10',10)));
  const v = document.getElementById('lang').value;
  await chrome.storage.sync.set({ laranote_lang: v, laranote_per_page: pp });
  const status = document.getElementById('status');
  status.textContent = 'Saved';
  setTimeout(()=> status.textContent = '', 1200);
}
document.getElementById('save').addEventListener('click', save);
load();
