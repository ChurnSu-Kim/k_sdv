// 개발팀(신재호) — 주식시황 뷰어 로직 (포터블: file:// 더블클릭 지원)
// 우선: window.REPORTS / window.REPORT_DATA (임베디드) → 없으면 fetch 폴백

(function () {
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const saved = localStorage.getItem('viewer-theme') || 'dark';
  apply(saved);
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next); localStorage.setItem('viewer-theme', next);
  });
  function apply(t) { root.setAttribute('data-theme', t); btn.textContent = t === 'dark' ? '🌙' : '☀️'; }
})();

function renderMarkdown(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = esc(md);
  html = html.replace(/((?:^\|.*\|\n)+)/gm, m => {
    const rows = m.trim().split('\n');
    const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => `<td>${c.trim()}</td>`).join('');
    const body = rows.filter(r => !/^\|[-:\s|]+\|$/.test(r)).map(r => `<tr>${cells(r)}</tr>`).join('');
    return `<table>${body}</table>`;
  });
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
  return html;
}

async function openReport(file) {
  const titleEl = document.getElementById('docTitle');
  const dateEl = document.getElementById('docDate');
  const prev = document.getElementById('preview');
  if (window.REPORT_DATA && window.REPORT_DATA[file]) {
    const md = window.REPORT_DATA[file];
    const m = file.match(/주식시황_(\d{8})\.md/);
    if (m) { const ymd = m[1]; dateEl.textContent = `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`; }
    titleEl.textContent = '주식시황 분석 보고서';
    prev.innerHTML = `<div class="md">${renderMarkdown(md)}</div>`;
    prev.scrollTop = 0;
    return;
  }
  // 폴백: http 모드
  try {
    const res = await fetch('data/' + file + '?' + Date.now());
    if (!res.ok) throw new Error();
    const md = await res.text();
    titleEl.textContent = '주식시황 분석 보고서';
    prev.innerHTML = `<div class="md">${renderMarkdown(md)}</div>`;
  } catch (e) {
    prev.innerHTML = '<div class="placeholder">보고서를 불러올 수 없습니다.</div>';
  }
}

async function loadList() {
  const listEl = document.getElementById('fileList');
  let reports = window.REPORTS;
  if (!reports) {
    try {
      const res = await fetch('data/reports.json?' + Date.now());
      reports = (await res.json()).reports || [];
    } catch (e) { reports = []; }
  }
  if (!reports.length) {
    listEl.innerHTML = '<div class="file-item"><div class="date">보고서 없음</div></div>';
    return;
  }
  listEl.innerHTML = reports.map(r => `
    <div class="file-item" data-file="${r.file}">
      <div class="date">${r.date}</div>
      <div class="title">${r.title || '시황 분석 보고서'}</div>
    </div>`).join('');
  listEl.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', () => {
      listEl.querySelectorAll('.file-item').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      openReport(item.dataset.file);
    });
  });
  const first = listEl.querySelector('.file-item');
  if (first) { first.classList.add('active'); openReport(first.dataset.file); }
}

loadList();
