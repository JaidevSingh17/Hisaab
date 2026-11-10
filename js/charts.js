'use strict';
/* GaronchiHisaab — small hand-built charts. Each returns an HTML string; [data-tip] drives the tooltip. */

const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

/* parts: [{label, value, cls}] — cls is c1/c2/c3 */
function donutChart(parts, midTop, midBottom) {
  const R = 60, C = 2 * Math.PI * R, total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const colors = { c1: 'var(--s1)', c2: 'var(--s2)', c3: 'var(--s3)' };
  let off = 0, segs = '';
  if (total > 0) for (const p of parts) {
    if (p.value <= 0) continue;
    const len = p.value / total * C, gap = len > 6 ? 3 : 0;
    segs += `<circle cx="74" cy="74" r="${R}" fill="none" stroke="${colors[p.cls]}" stroke-width="18"
      stroke-dasharray="${(len - gap).toFixed(2)} ${(C - len + gap).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
      data-tip="${attr(p.label + '\n' + rs(p.value) + ' · ' + Math.round(p.value / total * 100) + '%')}"/>`;
    off += len;
  }
  return `<div class="donut"><svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label="${attr(parts.map(p => p.label + ' ' + rs(p.value)).join(', '))}">
    <circle cx="74" cy="74" r="${R}" fill="none" stroke="var(--track)" stroke-width="18"/>
    <g transform="rotate(-90 74 74)">${segs}</g></svg>
    <div class="mid"><b>${midTop}</b><span>${midBottom}</span></div></div>`;
}

function axis(max) {
  return `<div class="yax"><span>${rsShort(max)}</span><span>${rsShort(max / 2)}</span><span>0</span></div>`;
}
const GRID = '<span class="grid" style="top:0"></span><span class="grid" style="top:50%"></span>';

/* one column per day of the month */
function dailyChart(ym) {
  const n = daysIn(ym), v = new Array(n).fill(0);
  for (const t of monthTx(ym)) if (t.type === 'expense') v[Number(t.date.slice(8)) - 1] += t.amount;
  const max = niceMax(Math.max(...v));
  const cols = v.map((x, i) => `<div class="col" data-tip="${attr(shortDate(ym + '-' + pad(i + 1)) + '\n' + (x ? rs(x) + ' spent' : 'Nothing spent'))}"><i style="height:${(x / max * 100).toFixed(1)}%"></i></div>`).join('');
  const ticks = v.map((_, i) => `<span>${(i === 0 || (i + 1) % 5 === 0) && i + 1 <= n ? i + 1 : ''}</span>`).join('');
  return `<div class="plot" role="img" aria-label="Spending for each day of ${attr(monthName(ym))}">${axis(max)}<div class="area">${GRID}<div class="cols">${cols}</div></div><div class="xax">${ticks}</div></div>`;
}

/* last six months: needs + wants + saved stack up to income; the tick marks income */
function sixMonthChart(endYm) {
  const months = []; for (let i = 5; i >= 0; i--) months.push(addMonths(endYm, -i));
  const data = months.map(m => ({ m, t: totals(m) }));
  const max = niceMax(Math.max(...data.map(d => Math.max(d.t.income, d.t.spent))));
  const h = x => (Math.max(0, x) / max * 100).toFixed(1);
  const cols = data.map(({ m, t }) => {
    const saved = Math.max(0, t.saved);
    const tip = `${monthName(m)}\nCame in ${rs(t.income)}\nNeeds ${rs(t.needs)}\nWants ${rs(t.wants)}\n${t.saved >= 0 ? 'Saved ' + rs(t.saved) : 'Overspent ' + rs(-t.saved)}`;
    const segs = [[saved, 'c3'], [t.wants, 'c2'], [t.needs, 'c1']].filter(s => s[0] > 0)
      .map(s => `<div class="seg ${s[1]}" style="height:${h(s[0])}%"></div>`).join('');
    const inc = t.income > 0 ? `<span class="inc" style="bottom:${h(t.income)}%"></span>` : '';
    return `<div class="col" data-tip="${attr(tip)}">${segs}${inc}</div>`;
  }).join('');
  const ticks = months.map(m => `<span>${monthName(m, true)}</span>`).join('');
  return `<div class="plot wide" role="img" aria-label="Income, spending and savings for the last six months">${axis(max)}<div class="area">${GRID}<div class="cols">${cols}</div></div><div class="xax">${ticks}</div></div>
  <div class="legend" style="margin-top:12px"><span><i class="c1"></i>Needs</span><span><i class="c2"></i>Wants</span><span><i class="c3"></i>Saved</span><span><i class="tick"></i>Income</span></div>`;
}
