/* Apply the stored theme before first paint; keep preferences on the official site. */
(() => {
  const key = 'saotie-official-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch { /* Storage may be disabled. */ }
  if (!['light', 'dark'].includes(preference)) preference = null;
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('themeToggle');
    if (button) {
      button.textContent = theme === 'dark' ? '浅色' : '暗色';
      button.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到暗色主题');
    }
  }
  apply(preference || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', event => {
    if (!preference) apply(event.matches ? 'dark' : 'light');
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(preference);
      try { localStorage.setItem(key, preference); } catch { /* Still works for this page. */ }
    });
    const menu = document.getElementById('menuToggle');
    const nav = document.getElementById('pageNav');
    if (!menu || !nav) return;
    function setMenu(open) {
      nav.classList.toggle('is-open', open);
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? '收起' : '菜单';
    }
    menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menu.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.site-nav')) setMenu(false);
    });
    window.matchMedia('(max-width: 1000px)').addEventListener('change', () => setMenu(false));
  });
})();
