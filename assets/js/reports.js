// 시황 리포트 리스트 + 전체보기 (마크다운 렌더)
// 리포트 소스: data/주식시황_YYYYMMDD.md (매일 크론 생성)

const REPORT_DIR = 'data/'; // 리포트는 data/ 아래 주식시황_*.md

async function loadReports() {
  const listEl = document.getElementById('reportList');
  try {
    // reports.json 은 수집 스크립트가 생성하는 인덱스 (날짜/파일명 목록)
    const res = await fetch(REPORT_DIR + 'reports.json?' + Date.now());
    const index = res.ok ? await res.json() : null;
    if (index && Array.isArray(index.reports) && index.reports.length) {
      listEl.innerHTML = index.reports.map(r => `
        <div class="report-item" data-file="${r.file}">
          <div><div class="date">${r.date}</div><div class="meta">${r.title || '시황 분석 보고서'}</div></div>
          <div class="meta">보기 →</div>
        </div>`).join('');
    } else {
      listEl.innerHTML = '<div class="empty">리포트 인덱스 없음 — reports.json 생성 필요</div>';
    }
  } catch (e) {
    listEl.innerHTML = '<div class="empty">리포트 로드 실패</div>';
  }
  // 클릭 → 전체보기
  listEl.querySelectorAll('.report-item').forEach(item => {
    item.addEventListener('click', () => openReport(item.dataset.file));
  });
}

async function openReport(file) {
  const body = document.getElementById('modalBody');
  try {
    const res = await fetch(REPORT_DIR + file + '?' + Date.now());
    if (!res.ok) throw new Error();
    const md = await res.text();
    body.innerHTML = renderMarkdown(md);
    document.getElementById('modal').classList.add('open');
  } catch (e) {
    body.innerHTML = '<p>리포트를 불러올 수 없습니다.</p>';
  }
}

document.getElementById('modalClose').addEventListener('click', () =>
  document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') document.getElementById('modal').classList.remove('open');
});

// 최소 마크다운 렌더 (헤딩/테이블/굵게)
function renderMarkdown(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = esc(md);
  // 테이블
  html = html.replace(/((?:^\|.*\|\n)+)/gm, m => {
    const rows = m.trim().split('\n');
    const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => `<td>${c.trim()}</td>`).join('');
    const body = rows.filter(r => !/^\|[-:\s|]+\|$/.test(r)).map(r => `<tr>${cells(r)}</tr>`).join('');
    return `<table>${body}</table>`;
  });
  // 헤딩
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
            .replace(/^## (.*)$/gm, '<h2>$1</h2>')
            .replace(/^# (.*)$/gm, '<h1>$1</h1>');
  // 굵게
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 줄바꿈
  html = html.replace(/\n/g, '<br>');
  return html;
}

loadReports();
