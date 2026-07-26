// 화이트/다크 테마 토글
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const saved = localStorage.getItem('theme') || 'dark';
  apply(saved);
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    localStorage.setItem('theme', next);
  });
  function apply(t) {
    root.setAttribute('data-theme', t);
    btn.textContent = t === 'dark' ? '🌙 다크' : '☀️ 화이트';
  }
})();
