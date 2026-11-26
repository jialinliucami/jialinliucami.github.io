(() => {
  const button = document.querySelector('.lang');
  function setLang(lang) {
    document.documentElement.lang = lang;
    button.textContent = lang === 'en' ? '中文' : 'English';
    button.lang = lang === 'en' ? 'zh-CN' : 'en';
    button.setAttribute('aria-label', lang === 'en' ? '切换为中文' : 'Switch to English');
    document.title = lang === 'en' ? 'Jialin Liu (Camilla) · Research & Publications' : 'Jialin Liu (Camilla) · 学术主页';
  }
  let initial = 'en';
  try { if (localStorage.getItem('profile-language') === 'zh-CN') initial = 'zh-CN'; } catch {}
  setLang(initial);
  button.addEventListener('click', () => {
    const lang = document.documentElement.lang === 'en' ? 'zh-CN' : 'en';
    setLang(lang);
    try { localStorage.setItem('profile-language', lang); } catch {}
  });
})();
