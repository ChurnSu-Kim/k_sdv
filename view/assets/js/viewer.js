// 개발팀(신재호) — 주식시황 뷰어 로직 (fetch 기반, 원문 마크다운 완전 렌더링)
// 크론이 data/*.md 저장 + reports.json 갱신만 하면 자동 반영 (빌드 스크립트 불필요)
// file:// 더블클릭은 안 되고, GitHub Pages(https URL)로 열어야 fetch 정상 동작

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

// 마크다운 → HTML (원문 그대로, 하나도 빼지 않음)
function renderMarkdown(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = esc(md);

  // 코드블록 (``` ... ```) — 가장 먼저 처리해서 안에 있는 마크다운 무시
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) =>
    `<pre><code class="lang-${lang || ''}">${esc(code)}</code></pre>`);

  // 인라인 코드 (`...`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 헤더
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
            .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
            .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
            .replace(/^### (.*)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // 표 (| 헤더 | / |---|---| / | 데이터 |)
  html = html.replace(/((?:^|\n)\|.*\|\n(?:\|[-: |]+\|\n)?(?:\|.*\|\n?)+)/g, (table) => {
    const rows = table.trim().split('\n');
    const isHeader = r => /^[\s|]*[-:]+[-|:\s]*$/.test(r);
    const parse = r => r.replace(/^\||\|$/g, '').split('|').map(c => `<td>${c.trim()}</td>`).join('');
    let body = '';
    let headerHtml = '';
    rows.forEach(r => {
      if (isHeader(r)) return;
      if (!r.trim().startsWith('|')) return;
      const cells = r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!headerHtml && rows.indexOf(r) === 0) {
        headerHtml = `<tr>${cells.map(c => `<th>${c}</th>`).join('')}</tr>`;
      } else {
        body += `<tr>${parse(r)}</tr>`;
      }
    });
    if (headerHtml) return `<table><thead>${headerHtml}</thead><tbody>${body}</tbody></table>`;
    return `<table><tbody>${body}</tbody></table>`;
  });

  // 굵게/기울임
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 리스트 (순서 있는/없는)
  html = html.replace(/^\n?(-|\*|\d+\.)\s+(.*)$/gm, (m, mark, content) => {
    if (/^\d/.test(mark)) return `<li>${content}</li>`;
    return `<li>${content}</li>`;
  });
  // ul/ol 래핑
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (lis) => {
    if (lis.includes('1.') || /^\d/.test(lis)) return `<ol>${lis.trim()}</ol>`;
    return `<ul>${lis.trim()}</ul>`;
  });

  // 구분선
  html = html.replace(/^---$/gm, '<hr>');

  // 블록따옴표
  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

  // 링크 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 이미지 ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');

  // 줄바꿈 → <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

// 목록 로드 (fetch reports.json)
async function loadList() {
  const listEl = document.getElementById('fileList');
  let reports = [];
  try {
    const res = await fetch('data/reports.json?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    reports = json.reports || [];
  } catch (e) {
    listEl.innerHTML = '<div class="file-item"><div class="date">목록을 불러올 수 없습니다</div><div class="title">GitHub Pages URL로 접속해 주세요</div></div>';
    return;
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

// 보고서 열기 (fetch .md 파일, 원문 그대로 렌더링)
async function openReport(file) {
  const titleEl = document.getElementById('docTitle');
  const dateEl = document.getElementById('docDate');
  const prev = document.getElementById('preview');
  titleEl.textContent = '로딩 중…';
  prev.innerHTML = '<div class="placeholder">불러오는 중…</div>';
  try {
    const res = await fetch('data/' + file + '?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const md = await res.text();
    const m = file.match(/주식시황_(\d{8})\.md/);
    if (m) { const ymd = m[1]; dateEl.textContent = `${ymy.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`; }
    titleEl.textContent = '주식시황 분석 보고서';
    prev.innerHTML = `<div class="md">${renderMarkdown(md)}</div>`;
    prev.scrollTop = 0;
  } catch (e) {
    titleEl.textContent = '오류';
    prev.innerHTML = '<div class="placeholder">보고서를 불러올 수 없습니다.<br>GitHub Pages URL로 접속해 주세요.</div>';
  }
}

loadList();