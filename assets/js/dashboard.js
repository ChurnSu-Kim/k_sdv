// 대시보드 탭 + 포트폴리오 데이터 로드
// 데이터 소스: scripts/fetch_kis.py + fetch_bithumb.py 가 생성하는 data/cache/portfolio.json
// 골격 단계에서는 포트폴리오 파일이 없으면 빈 카드를 표시 (더미 데이터 사용 안 함)

let PORTFOLIO_DATA = null;

const TAB_CLASS = {
  kr: { grid: 'grid-kr', filter: a => a.market === 'KR' },
  us: { grid: 'grid-us', filter: a => a.market === 'US' },
  etf: { grid: 'grid-etf', filter: a => a.type === 'ETF' },
  crypto: { grid: 'grid-crypto', filter: a => a.market === 'CRYPTO' }
};

// 탭 전환
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

function assetCard(a) {
  const plCls = (a.change || 0) >= 0 ? 'up' : 'down';
  const plSign = (a.change || 0) >= 0 ? '+' : '';
  const ind = a.indicators || {};
  const maArr = ind.ma && ind.ma.arrangement ? ind.ma.arrangement : '';
  const rsi = ind.rsi14 != null ? `RSI ${ind.rsi14}` : '';
  const macdCross = ind.macd && ind.macd.cross ? `MACD ${ind.macd.cross}` : '';
  const chips = [maArr, rsi, macdCross].filter(Boolean).map(t => `<span class="chip">${t}</span>`).join('');
  const asOf = a.price_as_of ? `<div class="asof">기준: ${a.price_as_of}</div>` : '';
  return `
  <div class="asset-card clickable" data-name="${a.name}">
    <div class="name"><span>${a.name}</span><span class="broker">${a.broker || ''}</span></div>
    <div class="price">${fmt(a.price)} <span class="${plCls}">${fmt(a.change_rate)}%</span></div>
    <div class="pl ${plCls}">${plSign}${fmt(a.change)} (${a.qty || ''})</div>
    ${asOf}
    <div class="indicators">${chips}</div>
  </div>`;
}

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('ko-KR');
  return v;
}

// 데이터 소스: GitHub Public repo (k_sdv) RAW URL — 어디서든 브라우저로 열면 최신 스냅샷 fetch
const DATA_URL = 'https://raw.githubusercontent.com/ChurnSu-Kim/k_sdv/main/data.json';

async function loadPortfolio() {
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('no data');
    const data = await res.json();
    PORTFOLIO_DATA = data;
    renderPortfolio(data);
    document.getElementById('updated').textContent = '갱신: ' + (data.updated || '—');
  } catch (e) {
    // 데이터 파일 없음 → 안내 표시 (더미 없음)
    Object.values(TAB_CLASS).forEach(({ grid }) => {
      document.getElementById(grid).innerHTML =
        '<div class="empty">데이터 없음 — API 키 셋업 후 수집 스크립트를 실행하세요.<br>(config/api_keys.json)</div>';
    });
  }
}

function renderPortfolio(data) {
  const assets = data.assets || [];
  Object.entries(TAB_CLASS).forEach(([key, { grid, filter }]) => {
    const list = assets.filter(filter);
    const el = document.getElementById(grid);
    el.innerHTML = list.length
      ? list.map(assetCard).join('')
      : '<div class="empty">보유 종목 없음</div>';
  });
  // 시장 상태 배지
  const mk = data.markets || {};
  const badge = (m) => {
    const s = mk[m]; if (!s) return '';
    const cls = s.status === 'OPEN' ? 'open' : 'closed';
    return `<span class="mkt-badge ${cls}">${m} ${s.status==='OPEN'?'개장':'마감'} · ${s.note}</span>`;
  };
  const old = document.getElementById('marketBadges');
  if (old) old.remove();
  const bar = document.createElement('div');
  bar.id = 'marketBadges';
  bar.className = 'mkt-bar';
  bar.innerHTML = badge('KR') + badge('US') + badge('CRYPTO');
  document.querySelector('.tabs').before(bar);
  // KPI
  const tot = assets.reduce((s, a) => s + (a.value || 0), 0);
  const pl = assets.reduce((s, a) => s + ((a.price||0) * (a.qty||0) - (a.seed_price||a.price||0) * (a.qty||0)), 0);
  document.getElementById('kpiTotal').textContent = fmt(tot) + '원';
  document.getElementById('kpiPl').textContent = (pl >= 0 ? '+' : '') + fmt(pl) + '원';
  document.getElementById('kpiPl').className = 'value ' + (pl >= 0 ? 'up' : 'down');
  const crypto = assets.filter(a => a.market === 'CRYPTO').reduce((s, a) => s + (a.value || 0), 0);
  const kr = assets.filter(a => a.market === 'KR').reduce((s, a) => s + (a.value || 0), 0);
  document.getElementById('kpiCrypto').textContent = fmt(crypto) + '원';
  document.getElementById('kpiKr').textContent = fmt(kr) + '원';
}

loadPortfolio();

// ===== 종목 상세 드로어 =====
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawerOverlay');

function openDrawer(name) {
  const assets = (PORTFOLIO_DATA && PORTFOLIO_DATA.assets) || [];
  const a = assets.find(x => x.name === name);
  if (!a) return;
  renderDrawer(a);
  drawer.classList.add('open');
  drawerOverlay.classList.add('open');
}
function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

function renderDrawer(a) {
  const plCls = (a.change || 0) >= 0 ? 'up' : 'down';
  document.getElementById('dName').textContent = a.name;
  document.getElementById('dSub').textContent = `${a.code || a.coin || ''} · ${a.broker || ''} · 기준 ${a.price_as_of || '—'}`;
  // Block A: 손익 헤더
  const avg = a.avg_price != null ? a.avg_price : a.seed_price;
  const pnl = a.total_pnl != null ? a.total_pnl : ((a.price||0) - (avg||0)) * (a.qty||0);
  const pnlPct = a.total_pnl_pct != null ? a.total_pnl_pct : (avg ? (a.price - avg)/avg*100 : 0);
  const evalAmt = a.value != null ? a.value : (a.price||0)*(a.qty||0);
  const pnCls = pnl >= 0 ? 'up' : 'down';
  document.getElementById('pnlHeader').innerHTML = `
    <div class="pnl-price">${fmt(a.price)} <span class="${plCls}">${fmt(a.change_rate)}%</span></div>
    <div class="pnl-grid">
      <div><span class="lbl">평단가</span><span class="val">${fmt(avg)}</span></div>
      <div><span class="lbl">보유수량</span><span class="val">${fmt(a.qty)}</span></div>
      <div><span class="lbl">평가금액</span><span class="val">${fmt(evalAmt)}</span></div>
      <div><span class="lbl">총 손익</span><span class="val ${pnCls}">${pnCls==='up'?'+':''}${fmt(pnl)} (${pnCls==='up'?'+':''}${fmt(pnlPct)}%)</span></div>
    </div>`;
  // Block B: AI 전망 (데이터 없으면 숨김)
  const ai = a.ai_signal;
  const aiBanner = document.getElementById('aiBanner');
  if (ai && ai.signal) {
    const map = {BUY:'매수',HOLD:'보유',SELL:'매도',WATCH:'관망'};
    const cls = {BUY:'ai-buy',HOLD:'ai-hold',SELL:'ai-sell',WATCH:'ai-watch'}[ai.signal] || 'ai-hold';
    const reasons = (ai.rationale || []).map(r => `<li>${r}</li>`).join('');
    aiBanner.style.display = 'block';
    aiBanner.innerHTML = `
      <div class="ai-row"><span class="ai-signal ${cls}">${map[ai.signal]||ai.signal}</span>
        <span class="ai-conf">신뢰도 ${ai.confidence != null ? ai.confidence : '—'}%</span></div>
      <ul class="ai-reasons">${reasons}</ul>
      <div class="ai-prices">${ai.target_sell?`목표매도 ${fmt(ai.target_sell)}`:''} ${ai.stop_loss?`· 손절 ${fmt(ai.stop_loss)}`:''}</div>`;
  } else {
    aiBanner.style.display = 'none';
  }
  renderTech(a);
  renderFund(a);
  renderMarket(a);
  renderPnl(a, avg, pnl, pnlPct, evalAmt);
  // 탭 초기화
  document.querySelectorAll('.dtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dpanel').forEach(p => p.classList.remove('active'));
  document.querySelector('.dtab[data-dtab="tech"]').classList.add('active');
  document.getElementById('dpanel-tech').classList.add('active');
}

function indicatorCard(title, value, state) {
  const stCls = state ? ` ind-${state}` : '';
  return `<div class="ind-card${stCls}"><div class="ind-t">${title}</div><div class="ind-v">${value}</div></div>`;
}

function renderTech(a) {
  const ind = a.indicators || {};
  const ma = ind.ma || {};
  const macd = ind.macd || {};
  const boll = ind.bollinger || {};
  const stoch = ind.stochastic || {};
  const cards = [];
  cards.push(indicatorCard('RSI(14)', ind.rsi14 != null ? ind.rsi14 : '—',
    ind.rsi14 >= 70 ? 'over' : ind.rsi14 <= 30 ? 'under' : ''));
  cards.push(indicatorCard('MACD', macd.cross ? macd.cross : '—',
    macd.cross === '골든' ? 'gold' : macd.cross === '데드' ? 'dead' : ''));
  cards.push(indicatorCard('이동평균 배열', ma.arrangement || '—',
    ma.arrangement === '정배열' ? 'gold' : ma.arrangement === '역배열' ? 'dead' : ''));
  cards.push(indicatorCard('MA5 / MA20 / MA60',
    `${fmt(ma.ma5)} / ${fmt(ma.ma20)} / ${fmt(ma.ma60)}`, ''));
  cards.push(indicatorCard('볼린저밴드', boll.position || '—',
    boll.position === '상단근접' || boll.position === '상단돌파' ? 'over' : ''));
  cards.push(indicatorCard('스토캐스틱', stoch.state || '—',
    stoch.state === '과매수' ? 'over' : stoch.state === '과매도' ? 'under' : ''));
  document.getElementById('dpanel-tech').innerHTML =
    `<div class="ind-grid">${cards.join('')}</div>
     <div class="ind-note">기준시각: ${ind.updated || a.price_as_of || '—'} · KIS/빗썸 무료 시세 기반</div>`;
}

function renderFund(a) {
  const f = a.fundamental || {};
  if (!Object.keys(f).length) {
    document.getElementById('dpanel-fund').innerHTML = '<div class="empty">펀더멘털 데이터 없음 (KIS 시세 응답 연동 시 표시)</div>';
    return;
  }
  const rows = [
    ['PER', f.per], ['PBR', f.pbr], ['ROE', f.roe],
    ['부채비율', f.debt_ratio], ['배당수익률', f.div_yield],
    ['시가총액', f.market_cap], ['52주 고가', f.high52], ['52주 저가', f.low52],
  ];
  document.getElementById('dpanel-fund').innerHTML =
    `<div class="fund-grid">${rows.map(([k,v]) => `<div class="fund-cell"><span class="lbl">${k}</span><span class="val">${v != null ? fmt(v) : '—'}</span></div>`).join('')}</div>`;
}

function renderMarket(a) {
  const m = a.market_context || {};
  if (!Object.keys(m).length) {
    document.getElementById('dpanel-market').innerHTML = '<div class="empty">시황/수급 데이터 미연결 (Phase 3 예정)</div>';
    return;
  }
  document.getElementById('dpanel-market').innerHTML =
    `<div class="mkt-info">코스피 대비 ${fmt(m.vsKospi)}% · 섹터 대비 ${fmt(m.vsSector)}%</div>`;
}

function renderPnl(a, avg, pnl, pnlPct, evalAmt) {
  const rows = [
    ['평단가', avg], ['현재가', a.price], ['보유수량', a.qty],
    ['평가금액', evalAmt], ['총 손익', `${pnl>=0?'+':''}${fmt(pnl)} (${pnl>=0?'+':''}${fmt(pnlPct)}%)`],
    ['비중', a.weight_pct != null ? a.weight_pct + '%' : '—'],
  ];
  document.getElementById('dpanel-pnl').innerHTML =
    `<div class="pnl-table">${rows.map(([k,v]) => `<div class="pnl-row"><span class="lbl">${k}</span><span class="val">${v != null ? fmt(v) : '—'}</span></div>`).join('')}</div>
     <div class="pnl-actions"><button class="btn-act buy">매수</button><button class="btn-act buy">추가매수</button><button class="btn-act sell">일부매도</button><button class="btn-act danger">전량매도</button></div>`;
}

// 카드 클릭 → 드로어
document.querySelectorAll('.asset-grid').forEach(grid => {
  grid.addEventListener('click', e => {
    const card = e.target.closest('.asset-card.clickable');
    if (card) openDrawer(card.dataset.name);
  });
});
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);
// 상세 탭 전환
document.querySelectorAll('.dtab').forEach(t => {
  t.addEventListener('click', () => {
    const key = t.dataset.dtab;
    document.querySelectorAll('.dtab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.dpanel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('dpanel-' + key).classList.add('active');
  });
});

// loadPortfolio 에서 PORTFOLIO_DATA 보관
const _origLoad = loadPortfolio;