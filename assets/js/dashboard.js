// 대시보드 탭 + 포트폴리오 데이터 로드
// 데이터 소스: GitHub Public repo (k_sdv) RAW URL — 어디서든 브라우저로 열면 최신 스냅샷 fetch
// 개선(Order_001): ETF 분류, KPI 5그룹, 통화기호, RSI/MACD 색상, 기준일시 과거 빨강

let PORTFOLIO_DATA = null;

const TAB_CLASS = {
  kr: { grid: 'grid-kr', filter: a => a.market === 'KR' && a.type !== 'ETF' },
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

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('ko-KR');
  return v;
}

// 통화 기호
function ccy(a) {
  if (a.market === 'US') return '$';
  if (a.market === 'CRYPTO') return '';
  return '₩';
}
// RSI 색상 클래스 (지시서: ≥70 빨강, 50 흰색, 51~69 파랑, 31~49 보라, ≤30 초록)
function rsiCls(r) {
  if (r == null) return '';
  if (r >= 70) return 'rsi-over';
  if (r <= 30) return 'rsi-under';
  if (r >= 51 && r <= 69) return 'rsi-blue';
  if (r >= 31 && r <= 49) return 'rsi-purple';
  if (r === 50) return 'rsi-white';
  return '';
}
// MACD cross 색상
function macdCls(cross) {
  if (cross === '골든') return 'macd-gold';
  if (cross === '데드') return 'macd-dead';
  return '';
}
// 카드 기준일시가 당일이 아닌 과거면 빨강
function isStale(asOf) {
  if (!asOf) return false;
  const today = new Date().toISOString().slice(0, 10);
  return !asOf.includes(today);
}

function assetCard(a) {
  const plCls = (a.change || 0) >= 0 ? 'up' : 'down';
  const plSign = (a.change || 0) >= 0 ? '+' : '';
  const ind = a.indicators || {};
  const maArr = ind.ma && ind.ma.arrangement ? ind.ma.arrangement : '';
  const rsi = ind.rsi14 != null ? ind.rsi14 : null;
  const macdCross = ind.macd && ind.macd.cross ? ind.macd.cross : '';
  const chips = [];
  if (maArr) chips.push(`<span class="chip">${maArr}</span>`);
  if (rsi != null) chips.push(`<span class="chip ${rsiCls(rsi)}">RSI ${rsi}</span>`);
  if (macdCross) chips.push(`<span class="chip ${macdCls(macdCross)}">MACD ${macdCross}</span>`);
  const sym = ccy(a);
  const asOfCls = isStale(a.price_as_of) ? 'asof stale' : 'asof';
  const subLabel = sym === '$' ? '현재가(USD)' : sym === '₩' ? '현재가(KRW)' : '현재가';
  return `
  <div class="asset-card clickable" data-name="${a.name}">
    <div class="name"><span>${a.name}</span><span class="broker">${a.broker || ''}</span></div>
    <div class="price">${sym}${fmt(a.price)} <span class="${plCls}">${plSign}${fmt(a.change_rate)}%</span></div>
    <div class="price-sub">${subLabel}</div>
    <div class="pl ${plCls}">${plSign}${sym}${fmt(a.change)} (${a.qty || ''}주)</div>
    <div class="${asOfCls}">기준: ${a.price_as_of || '—'}</div>
    <div class="indicators">${chips.join('')}</div>
  </div>`;
}

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
    Object.values(TAB_CLASS).forEach(({ grid }) => {
      document.getElementById(grid).innerHTML =
        '<div class="empty">데이터 없음 — 수집 스크립트를 실행하세요.</div>';
    });
  }
}

// KPI 그룹별 평가/손익 계산
function groupStats(assets, pred) {
  const list = assets.filter(pred);
  const evalAmt = list.reduce((s, a) => s + (a.value || 0), 0);
  const cost = list.reduce((s, a) => s + ((a.seed_price || a.price || 0)) * (a.qty || 0), 0);
  const pnl = evalAmt - cost;
  const pnlPct = cost ? (pnl / cost * 100) : 0;
  return { evalAmt, cost, pnl, pnlPct };
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
  // 시장 상태 배지 (각 KPI 카드에 표시용)
  const mk = data.markets || {};
  const badge = (m) => {
    const s = mk[m]; if (!s) return '';
    const cls = s.status === 'OPEN' ? 'open' : 'closed';
    return `<span class="mkt-badge ${cls}">${m} ${s.status === 'OPEN' ? '개장' : '마감'} · ${s.note}</span>`;
  };

  const total = groupStats(assets, () => true);
  const kr = groupStats(assets, a => a.market === 'KR' && a.type !== 'ETF');
  const us = groupStats(assets, a => a.market === 'US');
  const crypto = groupStats(assets, a => a.market === 'CRYPTO');
  const etf = groupStats(assets, a => a.type === 'ETF');

  const setKpi = (id, st, mktKey) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.kpi-eval').textContent = fmt(st.evalAmt) + '원';
    el.querySelector('.kpi-pnl').textContent = (st.pnl >= 0 ? '+' : '') + fmt(st.pnl) + '원';
    el.querySelector('.kpi-pnlpct').textContent = (st.pnl >= 0 ? '+' : '') + fmt(Math.round(st.pnlPct)) + '%';
    const pe = el.querySelector('.kpi-pl-cls');
    pe.className = 'kpi-pnlpct ' + (st.pnl >= 0 ? 'up' : 'down');
    if (mktKey) {
      const b = el.querySelector('.mkt-badge-slot');
      if (b) b.innerHTML = badge(mktKey);
    }
  };
  setKpi('kpiTotal', total);
  setKpi('kpiKr', kr, 'KR');
  setKpi('kpiUs', us, 'US');
  setKpi('kpiCrypto', crypto, 'CRYPTO');
  setKpi('kpiEtf', etf);
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
  renderChart1h(a);
}
function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

function renderDrawer(a) {
  const plCls = (a.change || 0) >= 0 ? 'up' : 'down';
  document.getElementById('dName').textContent = a.name;
  document.getElementById('dSub').textContent = `${a.code || a.coin || ''} · ${a.broker || ''} · 기준 ${a.price_as_of || '—'}`;
  const avg = a.avg_price != null ? a.avg_price : a.seed_price;
  const pnl = a.total_pnl != null ? a.total_pnl : ((a.price || 0) - (avg || 0)) * (a.qty || 0);
  const pnlPct = a.total_pnl_pct != null ? a.total_pnl_pct : (avg ? (a.price - avg) / avg * 100 : 0);
  const evalAmt = a.value != null ? a.value : (a.price || 0) * (a.qty || 0);
  const pnCls = pnl >= 0 ? 'up' : 'down';
  const cost = (avg || 0) * (a.qty || 0);
  document.getElementById('pnlHeader').innerHTML = `
    <div class="pnl-price">${ccy(a)}${fmt(a.price)} <span class="${plCls}">${plSign(a.change_rate)}%</span></div>
    <div class="pnl-grid">
      <div><span class="lbl">평단가</span><span class="val">${ccy(a)}${fmt(avg)}</span></div>
      <div><span class="lbl">보유수량</span><span class="val">${fmt(a.qty)}</span></div>
      <div><span class="lbl">총 투자금액</span><span class="val">${ccy(a)}${fmt(cost)}</span></div>
      <div><span class="lbl">평가금액</span><span class="val">${ccy(a)}${fmt(evalAmt)}</span></div>
      <div><span class="lbl">총 손익</span><span class="val ${pnCls}">${pnCls === 'up' ? '+' : ''}${ccy(a)}${fmt(pnl)} (${pnCls === 'up' ? '+' : ''}${fmt(Math.round(pnlPct))}%)</span></div>
    </div>`;
  renderTech(a);
  renderFund(a);
  renderMarket(a);
  renderPnl(a, avg, pnl, pnlPct, evalAmt, cost);
  document.querySelectorAll('.dtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dpanel').forEach(p => p.classList.remove('active'));
  document.querySelector('.dtab[data-dtab="tech"]').classList.add('active');
  document.getElementById('dpanel-tech').classList.add('active');
}

function plSign(v) { return (v || 0) >= 0 ? '+' : ''; }

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
    document.getElementById('dpanel-fund').innerHTML = '<div class="empty">펀더멘털/수급 데이터 없음 (평일 장 중 수집)</div>';
    return;
  }
  const w = ccy(a);
  const rows = [
    ['시가총액', f.market_cap != null ? fmt(f.market_cap) + '억' : '—'],
    ['PER', f.per != null ? f.per : '—'],
    ['PBR', f.pbr != null ? f.pbr : '—'],
    ['배당수익률', f.dividend_yield != null ? f.dividend_yield + '%' : '—'],
    ['52주 고가', f.high52 != null ? w + fmt(f.high52) : '—'],
    ['52주 저가', f.low52 != null ? w + fmt(f.low52) : '—'],
    ['외국인 순매수', f.foreign_net_buy != null ? fmt(f.foreign_net_buy) + '주' : '—'],
  ];
  document.getElementById('dpanel-fund').innerHTML =
    `<div class="fund-grid">${rows.map(([k, v]) => `<div class="fund-cell"><span class="lbl">${k}</span><span class="val">${v}</span></div>`).join('')}</div>`;
}

function renderMarket(a) {
  const m = a.market_context || {};
  if (!Object.keys(m).length) {
    document.getElementById('dpanel-market').innerHTML = '<div class="empty">시황/수급 데이터 미연결</div>';
    return;
  }
  document.getElementById('dpanel-market').innerHTML =
    `<div class="mkt-info">코스피 대비 ${fmt(m.vsKospi)}% · 섹터 대비 ${fmt(m.vsSector)}%</div>`;
}

function renderPnl(a, avg, pnl, pnlPct, evalAmt, cost) {
  const rows = [
    ['평단가', avg], ['현재가', a.price], ['보유수량', a.qty],
    ['총 투자금액', cost], ['평가금액', evalAmt],
    ['총 손익', `${pnl >= 0 ? '+' : ''}${fmt(pnl)} (${pnl >= 0 ? '+' : ''}${fmt(Math.round(pnlPct))}%)`],
    ['비중', a.weight_pct != null ? a.weight_pct + '%' : '—'],
  ];
  document.getElementById('dpanel-pnl').innerHTML =
    `<div class="pnl-table">${rows.map(([k, v]) => `<div class="pnl-row"><span class="lbl">${k}</span><span class="val">${v != null ? fmt(v) : '—'}</span></div>`).join('')}</div>
     <div class="pnl-actions"><button class="btn-act buy">매수</button><button class="btn-act buy">추가매수</button><button class="btn-act sell">일부매도</button><button class="btn-act danger">전량매도</button></div>`;
}

// 1시간봉 캔들 차트 (순수 canvas, 이평선+평단가선 plot)
function renderChart1h(a) {
  const el = document.getElementById('dpanel-chart');
  if (!el) return;
  const ohlc = a.chart_1h || [];
  if (!ohlc.length) {
    el.innerHTML = '<div class="empty">1시간봉 차트 데이터 없음 (평일 장 중 수집)</div>';
    return;
  }
  el.innerHTML = '<canvas id="c1h" width="600" height="300"></canvas>';
  const cv = document.getElementById('c1h');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, pad = 30;
  const closes = ohlc.map(d => d.close);
  const lows = ohlc.map(d => d.low), highs = ohlc.map(d => d.high);
  const min = Math.min(...lows), max = Math.max(...highs);
  const sx = i => pad + i * (W - 2 * pad) / (ohlc.length - 1);
  const sy = v => H - pad - (v - min) / (max - min) * (H - 2 * pad);
  // 캔들
  ohlc.forEach((d, i) => {
    const up = d.close >= d.open;
    ctx.strokeStyle = up ? '#e23c3c' : '#2f6bff';
    ctx.fillStyle = up ? '#e23c3c' : '#2f6bff';
    ctx.beginPath(); ctx.moveTo(sx(i), sy(d.high)); ctx.lineTo(sx(i), sy(d.low)); ctx.stroke();
    ctx.fillRect(sx(i) - 2, sy(d.open), 4, Math.max(1, sy(d.close) - sy(d.open)));
  });
  // 이평선 MA20 / MA200
  const drawMA = (period, color) => {
    if (ohlc.length < period) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = period - 1; i < ohlc.length; i++) {
      const ma = closes.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
      const x = sx(i), y = sy(ma);
      i === period - 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  drawMA(20, '#2f6bff');
  drawMA(200, '#e23c3c');
  // 평단가 수평선
  const avg = a.avg_price != null ? a.avg_price : a.seed_price;
  if (avg && avg >= min && avg <= max) {
    ctx.strokeStyle = '#ffae00'; ctx.setLineDash([6, 4]); ctx.beginPath();
    ctx.moveTo(pad, sy(avg)); ctx.lineTo(W - pad, sy(avg)); ctx.stroke(); ctx.setLineDash([]);
  }
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
document.querySelectorAll('.dtab').forEach(t => {
  t.addEventListener('click', () => {
    const key = t.dataset.dtab;
    document.querySelectorAll('.dtab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.dpanel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('dpanel-' + key).classList.add('active');
  });
});
