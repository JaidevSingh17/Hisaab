'use strict';
/* GaronchiHisaab — screens, forms and events. Data and maths live in store.js, charts in charts.js. */

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = { tab: 'home', ym: curYm(), filters: { q: '', type: '', cat: '', mode: '', scope: 'month' }, freshStamp: false, undo: null, restore: null };

/* bridge to js/cloud.js, which fills in signIn, signOut, reauth and push once Firebase has loaded */
const Cloud = window.HisaabCloud = { on: CLOUD_ON, booted: false, user: null, status: '', loginMsg: '', signIn: null, signOut: null, reauth: null, push: null, onStatus: null, fallback: null };
onStateSaved = () => { if (Cloud.push) Cloud.push(); };

/* ================= screens ================= */

function txRow(t, withDate) {
  const c = cat(t.cat);
  const sub = [t.note ? c.name : '', withDate ? shortDate(t.date) : '', t.mode, t.rid ? 'repeats monthly' : ''].filter(Boolean).join(', ');
  return `<li><button type="button" class="row" data-action="edit-tx" data-id="${t.id}">
    <span class="ic">${icon(c.icon)}</span>
    <span class="t"><b>${esc(t.note || c.name)}</b><span>${esc(sub)}</span></span>
    <span class="a ${t.type === 'income' ? 'in' : ''}">${t.type === 'income' ? '+' : '−'} ${rs(t.amount)}</span></button></li>`;
}

function vHome() {
  const ym = UI.ym, t = totals(ym), isCur = ym === curYm(), st = S.settings;
  let h = '';

  if (!S.tx.length && !st.stipend) {
    h += `<section class="banner span"><p><strong>Start with your stipend</strong>Tell the app how much you earn each month so it can build your plan.</p>
      <button type="button" class="btn primary" data-action="stipend-settings">Set up stipend</button></section>`;
  }
  if (isCur && st.stipend > 0 && !stipendTx(ym)) {
    const late = new Date().getDate() > st.stipendDay;
    h += `<section class="banner span"><p><strong>${late ? 'Stipend is later than usual' : 'Stipend not received yet'}</strong>
      ${rs(st.stipend)} usually arrives around the ${ordinal(st.stipendDay)}. ${late ? 'The numbers below only count money that has actually arrived.' : ''}</p>
      <button type="button" class="btn primary" data-action="stipend-received">Mark as received</button></section>`;
  }
  const sinceBackup = st.lastBackup ? (toDate(today()) - toDate(st.lastBackup)) / 864e5 : (toDate(today()) - toDate(st.createdAt)) / 864e5;
  if (S.tx.length >= 5 && sinceBackup >= 14 && !Cloud.user) {
    h += `<section class="banner span"><p><strong>Time for a backup</strong>${st.lastBackup ? 'Your last backup was ' + Math.round(sinceBackup) + ' days ago.' : 'You have not saved a backup yet.'} Your entries exist only on this device.</p>
      <button type="button" class="btn" data-action="backup">Save backup file</button></section>`;
  }

  /* the sum */
  const stx = stipendTx(ym), al = dailyAllowance(ym), sp = st.split;
  let foot = '';
  if (al) foot = al.left > 0
    ? `You can spend about <b>${rs(Math.floor(al.perDay))}</b> a day for the next ${al.days} ${al.days === 1 ? 'day' : 'days'} and still save ${sp.savings}%.`
    : `You have used ${rs(-al.left)} of the ${sp.savings}% you planned to save.`;
  else if (t.income > 0) foot = t.saved >= 0 ? `You kept ${Math.round(t.rate)}% of what came in.` : 'You spent more than came in this month.';
  else if (t.spent > 0) foot = 'No income recorded for this month yet.';
  h += `<section class="card sum">
    <table><caption class="sr">Summary for ${esc(monthName(ym))}</caption>
      <tr><th scope="row">Came in${stx ? `<span class="got">${icon('check', 's')}Stipend received ${esc(shortDate(stx.date))}</span>` : ''}</th><td class="in">+ ${rs(t.income)}</td></tr>
      <tr><th scope="row">Went out</th><td>− ${rs(t.spent)}</td></tr>
      <tr class="total"><th scope="row">${t.saved < 0 ? 'Overspent' : 'Saved'}</th><td class="${t.saved < 0 ? 'neg' : ''}">${rs(Math.abs(t.saved))}</td></tr>
    </table>${foot ? `<p class="foot">${foot}</p>` : ''}</section>`;
  UI.freshStamp = false;

  if (!t.count) {
    h += `<section class="card empty"><h2>Nothing recorded for ${esc(monthName(ym))}</h2><p>Add what you earned or spent and this page fills in.</p>
      <button type="button" class="btn primary" data-action="add-entry">Add entry</button></section>`;
  } else {
    /* needs / wants / saved */
    const base = t.income > 0 ? t.income : t.spent, share = v => base > 0 ? Math.round(v / base * 100) + '%' : '';
    const parts = [{ label: 'Needs', value: t.needs, cls: 'c1' }, { label: 'Wants', value: t.wants, cls: 'c2' }, { label: 'Saved', value: Math.max(0, t.saved), cls: 'c3' }];
    h += `<section class="card"><div class="card-head"><div><h2>How the month split</h2><p class="sub">${t.income > 0 ? 'Share of what came in' : 'Share of what you spent'}</p></div></div>
      <div class="donut-wrap">${donutChart(parts, rs(t.spent), 'spent')}
      <ul class="split-list">${parts.map(p => `<li><i class="${p.cls}"></i><span>${p.label}</span><b>${rs(p.value)}<small>${share(p.value)}</small></b></li>`).join('')}</ul></div></section>`;

    /* categories */
    const cats = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]);
    if (cats.length) {
      const shown = cats.slice(0, 6), rest = cats.slice(6).reduce((a, c) => a + c[1], 0), top = cats[0][1];
      const li = (name, v) => `<li><span class="nm">${name}</span><span class="amt">${rs(v)}<small>${Math.round(v / t.spent * 100)}%</small></span><span class="bar"><i style="width:${(v / top * 100).toFixed(1)}%"></i></span></li>`;
      h += `<section class="card"><div class="card-head"><div><h2>Where it went</h2><p class="sub">Spending by category</p></div></div>
        <ul class="rank">${shown.map(([id, v]) => li(icon(cat(id).icon, 's') + esc(cat(id).name), v)).join('')}${rest ? li('Everything else', rest) : ''}</ul></section>`;
    }
    if (t.spent > 0) h += `<section class="card"><div class="card-head"><div><h2>Day by day</h2><p class="sub">What you spent each day</p></div></div>${dailyChart(ym)}</section>`;
  }

  if (S.tx.length) h += `<section class="card"><div class="card-head"><div><h2>Last six months</h2><p class="sub">Each column adds up to that month's income</p></div></div>${sixMonthChart(ym)}</section>`;

  const big = monthTx(ym).filter(x => x.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
  if (big.length) h += `<section class="card"><div class="card-head"><h2>Biggest expenses</h2></div><ul class="rows">${big.map(x => txRow(x, true)).join('')}</ul></section>`;
  return h;
}

function filteredTx() {
  const f = UI.filters, q = f.q.trim().toLowerCase();
  return S.tx.filter(t =>
    (f.scope === 'all' || t.date.startsWith(UI.ym)) && (!f.type || t.type === f.type) && (!f.cat || t.cat === f.cat) && (!f.mode || t.mode === f.mode) &&
    (!q || (t.note || '').toLowerCase().includes(q) || cat(t.cat).name.toLowerCase().includes(q) || String(t.amount).includes(q))
  ).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function txListHtml() {
  const list = filteredTx();
  if (!list.length) {
    const filtered = UI.filters.q || UI.filters.type || UI.filters.cat || UI.filters.mode;
    return `<div class="empty"><h2>${filtered ? 'No entries match' : 'No entries yet'}</h2><p>${filtered ? 'Try clearing a filter or searching for something else.' : 'Add your first entry to start your hisaab.'}</p>
      ${filtered ? '<button type="button" class="btn" data-action="clear-filters">Clear filters</button>' : '<button type="button" class="btn primary" data-action="add-entry">Add entry</button>'}</div>`;
  }
  let h = '', inc = 0, out = 0;
  const days = new Map();
  for (const t of list) { if (!days.has(t.date)) days.set(t.date, []); days.get(t.date).push(t); t.type === 'income' ? inc += t.amount : out += t.amount; }
  h += `<p class="note" style="margin-bottom:12px">${list.length} ${list.length === 1 ? 'entry' : 'entries'}: ${rs(inc)} in, ${rs(out)} out</p>`;
  for (const [d, items] of days) {
    const net = items.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0);
    h += `<div class="day-head"><span>${esc(niceDate(d))}${UI.filters.scope === 'all' ? ' ' + d.slice(0, 4) : ''}</span><span class="num">${net >= 0 ? '+' : '−'} ${rs(Math.abs(net))}</span></div><ul class="rows">${items.map(t => txRow(t)).join('')}</ul>`;
  }
  return h;
}
function vEntries() {
  const f = UI.filters, opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
  return `<div><h1 class="page-title">Entries</h1><p class="lede">Tap any entry to change or delete it.</p></div>
  <div class="filters">
    <input class="wide" type="search" id="f-q" placeholder="Search notes, categories, amounts" aria-label="Search entries" value="${esc(f.q)}">
    <select id="f-scope" aria-label="Period">${opt('month', monthName(UI.ym), f.scope)}${opt('all', 'All months', f.scope)}</select>
    <select id="f-type" aria-label="Type">${opt('', 'Income and expenses', f.type)}${opt('expense', 'Expenses only', f.type)}${opt('income', 'Income only', f.type)}</select>
    <select id="f-cat" aria-label="Category">${opt('', 'All categories', f.cat)}${S.cats.map(c => opt(c.id, c.name, f.cat)).join('')}</select>
    <select id="f-mode" aria-label="Paid by">${opt('', 'Any payment', f.mode)}${MODES.map(m => opt(m, m, f.mode)).join('')}</select>
  </div>
  <section class="card" id="tx-list">${txListHtml()}</section>`;
}

function stateLine(b) {
  if (b.state === 'over') return `<p class="state over"><span class="dot">${icon('x', 's')}</span>Over by ${rs(b.spent - b.limit)}</p>`;
  if (b.state === 'near') return `<p class="state near"><span class="dot">${icon('alert', 's')}</span>Nearly used up: ${rs(b.limit - b.spent)} left</p>`;
  if (b.fast) return `<p class="state near"><span class="dot">${icon('alert', 's')}</span>Going fast: ${Math.round(b.pct)}% used with ${Math.round(b.monthPct)}% of the month gone</p>`;
  return `<p class="state ok"><span class="dot">${icon('check', 's')}</span>${rs(b.limit - b.spent)} left</p>`;
}
function vBudgets() {
  const ym = UI.ym, t = totals(ym), isCur = ym === curYm();
  const cats = catsOf('expense').map(c => ({ c, b: budgetStatus(c.id, ym) }));
  const set = cats.filter(x => x.b.limit > 0).sort((a, b) => b.b.pct - a.b.pct), unset = cats.filter(x => !x.b.limit).sort((a, b) => b.b.spent - a.b.spent);
  const limitSum = set.reduce((a, x) => a + x.b.limit, 0), spentSum = set.reduce((a, x) => a + x.b.spent, 0);
  let h = `<div><h1 class="page-title">Budgets</h1><p class="lede">A monthly limit for each category.${isCur && set.length ? ' The thin line on each bar shows how much of the month has passed.' : ''}</p></div>`;
  if (set.length) {
    const pct = limitSum ? spentSum / limitSum * 100 : 0;
    h += `<section class="card"><div class="bud-top"><b>All budgets together</b><span class="num"><b>${rs(spentSum)}</b> of ${rs(limitSum)}</span></div>
      <div class="meter ${pct > 100 ? 'over' : pct >= 80 ? 'near' : ''}"><i style="width:${Math.min(100, pct).toFixed(1)}%"></i></div>
      ${t.spent - spentSum > 0 ? `<p class="state"><span>${rs(t.spent - spentSum)} more was spent in categories without a limit.</span></p>` : ''}</section>
    <section class="card">${set.map(({ c, b }) => `<div class="bud">
      <div class="bud-top"><b class="ttl">${icon(c.icon, 's')}${esc(c.name)}</b><span class="num"><b>${rs(b.spent)}</b> of ${rs(b.limit)}</span></div>
      <div class="meter ${b.state === 'ok' ? (b.fast ? 'near' : '') : b.state}"><i style="width:${Math.min(100, b.pct).toFixed(1)}%"></i>${isCur ? `<span class="mark" style="left:${b.monthPct.toFixed(1)}%"></span>` : ''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${stateLine(b)}<button type="button" class="link" data-action="set-budget" data-id="${c.id}">Change</button></div>
    </div>`).join('')}</section>`;
  } else {
    h += `<section class="card empty"><h2>No limits set yet</h2><p>Pick a category below and decide the most you want to spend on it each month.</p></section>`;
  }
  h += `<section class="card"><div class="card-head"><div><h2>Categories without a limit</h2><p class="sub">Spending shown for ${esc(monthName(ym))}</p></div></div>
    ${unset.length ? unset.map(({ c, b }) => `<div class="set-row"><div class="t"><b class="ttl">${icon(c.icon, 's')}${esc(c.name)}</b><span>${b.spent ? rs(b.spent) + ' spent' : 'Nothing spent'}</span></div>
      <button type="button" class="btn small" data-action="set-budget" data-id="${c.id}">Set limit</button></div>`).join('') : '<p class="note">Every category has a limit.</p>'}</section>`;
  return h;
}

function goalCard(g) {
  const i = goalInfo(g);
  let status = '';
  if (i.done) status = `<p class="state ok"><span class="dot">${icon('check', 's')}</span>Goal reached</p>`;
  else if (!i.target) status = `<p class="state"><span>Record a month of spending and the target sets itself.</span></p>`;
  else if (i.status === 'late') status = `<p class="state over"><span class="dot">${icon('x', 's')}</span>The date has passed. ${rs(i.left)} still to go.</p>`;
  else if (i.status) status = `<p class="state ${i.status === 'ontrack' ? 'ok' : 'near'}"><span class="dot">${icon(i.status === 'ontrack' ? 'check' : 'alert', 's')}</span>${i.status === 'ontrack' ? 'On track.' : 'Behind.'} Put aside ${rs(Math.ceil(i.perMonth))} a month to reach it by ${esc(shortDate(g.deadline))} ${g.deadline.slice(0, 4)}.</p>`;
  else status = `<p class="state"><span>${rs(i.left)} to go</span></p>`;
  return `<div class="bud"><div class="bud-top"><b>${esc(g.name)}</b><span class="num"><b>${rs(g.saved)}</b> of ${rs(i.target)}</span></div>
    <div class="meter plain"><i style="width:${i.pct.toFixed(1)}%"></i></div>${status}
    ${g.id === 'emergency' ? `<p class="note" style="margin-top:6px">${g.target ? 'Your own target.' : 'Target is three months of your usual spending.'}</p>` : ''}
    <div class="btn-row" style="margin-top:10px"><button type="button" class="btn small primary" data-action="goal-money" data-id="${g.id}">Add money</button>
    <button type="button" class="btn small" data-action="edit-goal" data-id="${g.id}">Edit</button></div></div>`;
}
function vPlan() {
  const p = plan(UI.ym), sp = S.settings.split;
  let h = `<div><h1 class="page-title">Plan</h1><p class="lede">Split what comes in three ways, then check how the month is really going.</p></div>`;
  if (!p.base) {
    h += `<section class="card empty"><h2>Your plan needs an income</h2><p>Set your stipend, or record some income for ${esc(monthName(UI.ym))}.</p>
      <button type="button" class="btn primary" data-action="stipend-settings">Set up stipend</button></section>`;
  } else {
    const row = (name, o, kind) => {
      const pct = o.plan > 0 ? o.actual / o.plan * 100 : 0;
      let cls = 'plain', line;
      if (kind === 'save') {
        line = o.actual >= o.plan ? `<p class="state ok"><span class="dot">${icon('check', 's')}</span>Target met${o.actual > o.plan ? ', with ' + rs(o.actual - o.plan) + ' extra' : ''}</p>`
          : `<p class="state near"><span class="dot">${icon('alert', 's')}</span>${rs(o.plan - Math.max(0, o.actual))} short of the target</p>`;
      } else {
        cls = pct > 100 ? 'over' : pct >= 85 ? 'near' : '';
        line = pct > 100 ? `<p class="state over"><span class="dot">${icon('x', 's')}</span>${rs(o.actual - o.plan)} over</p>` : `<p class="state ok"><span class="dot">${icon('check', 's')}</span>${rs(o.plan - o.actual)} left</p>`;
      }
      return `<div class="plan-row"><div class="bud-top"><b>${name} <span style="font-weight:500;color:var(--ink2)">${o.pct}%</span></b><span class="num"><b>${rs(Math.max(0, o.actual))}</b> of ${rs(o.plan)}</span></div>
        <div class="meter ${cls}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div>${line}</div>`;
    };
    const adv = [];
    if (p.t.income > 0) {
      if (p.wants.actual > p.wants.plan) adv.push(`Wants are ${rs(p.wants.actual - p.wants.plan)} over. This is the easiest place to cut back.`);
      if (p.needs.actual > p.needs.plan) adv.push(`Needs are ${rs(p.needs.actual - p.needs.plan)} over. If these costs are fixed, lower your Wants share to make room.`);
      if (p.t.saved < 0) adv.push(`You have spent ${rs(-p.t.saved)} more than came in. Pause the wants until the next stipend.`);
      else if (p.savings.actual < p.savings.plan && UI.ym !== curYm()) adv.push(`Savings finished ${rs(p.savings.plan - p.savings.actual)} below target.`);
      if (!adv.length) adv.push('You are inside the plan this month. Keep going.');
    }
    h += `<section class="card"><div class="card-head"><div><h2>${esc(monthName(UI.ym))} against the plan</h2>
      <p class="sub">${p.usingStipend ? 'Nothing has come in yet, so this uses your stipend of ' + rs(p.base) : 'Based on ' + rs(p.base) + ' that came in'}</p></div>
      <button type="button" class="btn small" data-action="edit-split">Change split</button></div>
      ${row('Needs', p.needs)}${row('Wants', p.wants)}${row('Savings', p.savings, 'save')}
      <p class="note">Needs are things like rent, groceries and travel. Wants are eating out, shopping and subscriptions.</p>
      ${adv.length ? `<ul class="advice">${adv.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}</section>`;
    const first = (S.settings.stipend || p.base) * sp.savings / 100;
    h += `<section class="card"><h2>Pay yourself first</h2><p style="margin-top:8px">The day your stipend arrives, move <b>${rs(Math.round(first))}</b> into savings before you spend anything. What stays in your account is yours to spend without guilt.</p></section>`;
  }
  h += `<section class="card"><div class="card-head"><div><h2>Goals</h2><p class="sub">Money you have put aside for something</p></div>
    <button type="button" class="btn small" data-action="new-goal">New goal</button></div>${S.goals.map(goalCard).join('')}</section>`;
  return h;
}

function vReport() {
  const ym = UI.ym, t = totals(ym);
  let h = `<div><h1 class="page-title">Report</h1><p class="lede">How ${esc(monthName(ym))} went, in plain words.</p></div>`;
  if (!t.count) return h + `<section class="card empty"><h2>No report for ${esc(monthName(ym))}</h2><p>There are no entries in this month.</p></section>`;
  const sc = score(ym), ins = insights(ym);
  h += `<section class="card"><div class="score"><p class="big">${sc.total}<small> / 100</small></p><div><h2>${verdict(sc.total)}</h2><p class="sub">${ym === curYm() ? 'So far this month' : 'Final score'}</p></div></div>
    <ul class="parts">${sc.parts.map(p => `<li><div class="pt"><b>${p.label}</b><span>${p.got} / ${p.max}</span></div><div class="meter plain"><i style="width:${p.got / p.max * 100}%"></i></div><p>${esc(p.note)}</p></li>`).join('')}</ul></section>
  <section class="card"><div class="card-head"><h2>What stands out</h2></div><ul class="insights">${ins.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>
  <section class="card"><h2>Take it with you</h2><p class="sub" style="margin-bottom:12px">Opens in Excel or Google Sheets.</p>
    <button type="button" class="btn" data-action="export-month">Download ${esc(monthName(ym))} as a spreadsheet</button></section>`;
  return h;
}

const SYNC_TEXT = {
  synced: 'All changes saved online',
  saving: 'Saving online',
  connecting: 'Connecting',
  offline: 'Offline. Changes are kept on this device and sent when you are back online.',
  error: 'Could not save online. Trying again shortly.',
  denied: 'The database rules do not allow this account. Check firestore.rules.',
};
function accountCard() {
  if (!Cloud.on) return `<section class="card"><div class="set-row"><div class="t"><b>Sign-in and sync</b><span>Not set up yet, so entries stay on this device. The steps are in SETUP.md.</span></div></div></section>`;
  const u = Cloud.user;
  if (!u) return `<section class="card"><div class="set-row"><div class="t"><b>Offline</b><span>Showing the entries saved on this device. Sync starts again when you are online.</span></div></div></section>`;
  return `<section class="card"><div class="set-row"><div class="t"><b>${esc(u.name || 'Signed in')}</b><span>${esc(u.email)}</span><span>${SYNC_TEXT[Cloud.status] || ''}</span></div>
    <button type="button" class="btn small" data-action="sign-out">Sign out</button></div></section>`;
}

function vSettings() {
  const st = S.settings, seg = (name, opts, cur) => `<div class="seg-ctl" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  const custom = S.cats.filter(c => !DEFAULT_CATS.some(d => d.id === c.id));
  return `<div><h1 class="page-title">Settings</h1></div>
  ${accountCard()}
  <section class="card"><div class="set-row"><div class="t"><b>Stipend</b><span>${st.stipend ? rs(st.stipend) + ', usually around the ' + ordinal(st.stipendDay) : 'Not set'}</span></div>
    <button type="button" class="btn small" data-action="stipend-settings">${st.stipend ? 'Change' : 'Set up'}</button></div>
    <div class="set-row"><div class="t"><b>Savings split</b><span>${st.split.needs}% needs, ${st.split.wants}% wants, ${st.split.savings}% savings</span></div>
    <button type="button" class="btn small" data-action="edit-split">Change</button></div></section>

  <section class="card"><div class="card-head"><div><h2>Repeating entries</h2><p class="sub">Added by themselves every month on the day you choose</p></div>
    <button type="button" class="btn small" data-action="new-recurring">Add</button></div>
    ${S.recurring.length ? `<ul class="rows">${S.recurring.map(r => `<li><button type="button" class="row" data-action="edit-recurring" data-id="${r.id}">
      <span class="ic">${icon(cat(r.cat).icon)}</span><span class="t"><b>${esc(r.note || cat(r.cat).name)}</b><span>${r.active ? 'Every month on the ' + ordinal(r.day) : 'Paused'}</span></span>
      <span class="a ${r.type === 'income' ? 'in' : ''}">${r.type === 'income' ? '+' : '−'} ${rs(r.amount)}</span></button></li>`).join('')}</ul>` : '<p class="note">Nothing repeats yet. Good for rent, recharges and subscriptions.</p>'}</section>

  <section class="card"><div class="card-head"><div><h2>Your categories</h2><p class="sub">The built-in ones stay. Add your own here.</p></div>
    <button type="button" class="btn small" data-action="new-cat">Add</button></div>
    ${custom.length ? custom.map(c => `<div class="set-row"><div class="t"><b class="ttl">${icon(c.icon, 's')}${esc(c.name)}</b><span>${c.type === 'income' ? 'Income' : c.group === 'needs' ? 'Expense, a need' : 'Expense, a want'}</span></div>
      <button type="button" class="btn small danger" data-action="delete-cat" data-id="${c.id}" data-confirm="Tap again to remove">Remove</button></div>`).join('') : '<p class="note">You have not added any categories.</p>'}</section>

  <section class="card"><div class="field"><span class="lbl">Appearance</span><div id="theme-ctl">${seg('theme', [['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']], st.theme)}</div></div></section>

  <section class="card"><div class="set-row"><div class="t"><b>PIN lock</b><span>${st.pin ? 'On, asked each time you open the app.' : 'Off.'} It keeps casual eyes out but does not encrypt your data.</span></div>
    <button type="button" class="btn small" data-action="pin">${st.pin ? 'Change or remove' : 'Set a PIN'}</button></div></section>

  <section class="card"><div class="card-head"><div><h2>Your data</h2><p class="sub">${S.tx.length} ${S.tx.length === 1 ? 'entry' : 'entries'} ${Cloud.user ? 'saved on this device and in your Google account' : 'stored on this device only'}. ${st.lastBackup ? 'Last backup ' + esc(shortDate(st.lastBackup)) + '.' : 'No backup saved yet.'}</p></div></div>
    <div class="btn-row"><button type="button" class="btn primary" data-action="backup">Save backup file</button>
    <button type="button" class="btn" data-action="restore">Restore from backup</button>
    <button type="button" class="btn" data-action="export-all">Download everything as a spreadsheet</button></div>
    <p class="note" style="margin:12px 0">${Cloud.user ? 'Signing in on another phone or laptop brings your entries with you. A backup file is still a good spare copy.' : 'Deleting the app from your home screen or clearing browser data erases your entries. A backup file lets you bring them back.'}</p>
    <button type="button" class="btn danger" data-action="erase" data-confirm="Tap again to erase everything">Erase all data</button></section>`;
}

const VIEWS = { home: vHome, entries: vEntries, budgets: vBudgets, plan: vPlan, report: vReport, settings: vSettings };

function renderChrome() {
  $('#month-label').textContent = toDate(UI.ym + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  $('#next-month').disabled = UI.ym >= curYm();
  $('#month-switch').style.visibility = UI.tab === 'settings' ? 'hidden' : '';
  document.querySelectorAll('.tabs button').forEach(b => b.dataset.tab === UI.tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  moveTabBg();
}
function render() {
  renderChrome();
  const v = $('#view'); v.removeAttribute('aria-busy'); v.className = UI.tab === 'home' ? 'cols2' : ''; v.innerHTML = VIEWS[UI.tab]();
  hideTip();
}
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}

/* ================= sheets (forms) ================= */

const sheet = $('#sheet');
function openSheet(title, body) {
  sheet.innerHTML = `<div class="sheet"><div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2>
    <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Close">${icon('x')}</button></div>${body}</div>`;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
function closeSheet() { if (sheet.open) sheet.close(); sheet.innerHTML = ''; }
const radios = (name, opts, cur) => `<div class="seg-ctl" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}" ${v === cur ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
const catChips = (type, cur) => catsOf(type).map(c => `<label><input type="radio" name="cat" value="${esc(c.id)}" ${c.id === cur ? 'checked' : ''}><span>${icon(c.icon, 's')}${esc(c.name)}</span></label>`).join('');
const amountField = (v, label = 'Amount in ₹', name = 'amount') => `<div class="field"><label for="f-${name}">${label}</label><input class="amount" id="f-${name}" name="${name}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" value="${v || ''}" required></div>`;
const ERR = '<p class="err" role="alert"></p>';

function txSheet(t) {
  const e = t || { type: 'expense', cat: '', date: UI.ym === curYm() ? today() : UI.ym + '-01', mode: 'UPI', note: '' };
  openSheet(t ? 'Edit entry' : 'Add entry', `<form class="stack" data-form="tx" data-id="${t ? t.id : ''}" novalidate>
    ${radios('type', [['expense', 'Money out'], ['income', 'Money in']], e.type)}
    ${amountField(e.amount)}
    <div class="field"><span class="lbl">Category</span><div class="chips" id="cat-chips">${catChips(e.type, e.cat)}</div></div>
    <div class="field"><label for="f-date">Date</label><input id="f-date" name="date" type="date" max="${today()}" value="${e.date}" required></div>
    <div class="field"><span class="lbl">Paid by</span>${radios('mode', MODES.map(m => [m, m]), e.mode || 'UPI')}</div>
    <div class="field"><label for="f-note">Note <span style="font-weight:400">(optional)</span></label><input id="f-note" name="note" type="text" maxlength="60" placeholder="Chai with friends" value="${esc(e.note)}"></div>
    ${t ? '' : '<label class="check"><input type="checkbox" name="repeat"><span>Repeat this every month on the same day</span></label>'}
    ${ERR}<button class="btn primary block">Save entry</button>
    ${t ? '<button type="button" class="btn danger block" data-action="delete-tx" data-id="' + t.id + '">Delete entry</button>' : ''}</form>`);
  if (!t) $('#f-amount').focus();
}
function recurringSheet(r) {
  const e = r || { type: 'expense', cat: '', day: 1, mode: 'UPI', note: '', active: true };
  openSheet(r ? 'Edit repeating entry' : 'Add repeating entry', `<form class="stack" data-form="recurring" data-id="${r ? r.id : ''}" novalidate>
    ${radios('type', [['expense', 'Money out'], ['income', 'Money in']], e.type)}
    ${amountField(e.amount)}
    <div class="field"><span class="lbl">Category</span><div class="chips" id="cat-chips">${catChips(e.type, e.cat)}</div></div>
    <div class="field"><label for="f-day">Day of the month</label><input id="f-day" name="day" type="number" inputmode="numeric" min="1" max="31" value="${e.day}" required>
      <span class="hint">In shorter months it uses the last day. ${r ? '' : 'It starts on the next time this day comes round.'}</span></div>
    <div class="field"><span class="lbl">Paid by</span>${radios('mode', MODES.map(m => [m, m]), e.mode)}</div>
    <div class="field"><label for="f-note">Name</label><input id="f-note" name="note" type="text" maxlength="60" placeholder="Phone recharge" value="${esc(e.note)}"></div>
    ${r ? `<label class="check"><input type="checkbox" name="active" ${e.active ? 'checked' : ''}><span>Keep adding this every month</span></label>` : ''}
    ${ERR}<button class="btn primary block">Save repeating entry</button>
    ${r ? '<button type="button" class="btn danger block" data-action="delete-recurring" data-id="' + r.id + '" data-confirm="Tap again to delete">Delete repeating entry</button><p class="note">Entries it already added stay in your hisaab.</p>' : ''}</form>`);
}
function stipendReceivedSheet() {
  openSheet('Stipend received', `<form class="stack" data-form="stipend-received" novalidate>
    ${amountField(S.settings.stipend)}
    <div class="field"><label for="f-date">Date it arrived</label><input id="f-date" name="date" type="date" max="${today()}" min="${curYm()}-01" value="${today()}" required></div>
    ${ERR}<button class="btn primary block">Mark as received</button></form>`);
}
function stipendSettingsSheet() {
  openSheet('Your stipend', `<form class="stack" data-form="stipend-settings" novalidate>
    ${amountField(S.settings.stipend, 'Monthly stipend in ₹')}
    <div class="field"><label for="f-day">Day it usually arrives</label><input id="f-day" name="day" type="number" inputmode="numeric" min="1" max="31" value="${S.settings.stipendDay}" required>
      <span class="hint">A rough date is fine. You mark the real date each month when the money lands.</span></div>
    ${ERR}<button class="btn primary block">Save stipend</button></form>`);
}
function budgetSheet(id) {
  const c = cat(id), cur = S.budgets[id] || '', spent = totals(UI.ym).byCat[id] || 0;
  openSheet(c.name + ' limit', `<form class="stack" data-form="budget" data-id="${esc(id)}" novalidate>
    ${amountField(cur, 'Most to spend each month, in ₹')}
    <p class="note">You have spent ${rs(spent)} on this in ${esc(monthName(UI.ym))}.</p>
    ${ERR}<button class="btn primary block">Save limit</button>
    ${cur ? '<button type="button" class="btn danger block" data-action="remove-budget" data-id="' + esc(id) + '">Remove limit</button>' : ''}</form>`);
}
function splitSheet() {
  const sp = S.settings.split;
  openSheet('Change split', `<form class="stack" data-form="split" novalidate>
    <div class="two"><div class="field"><label for="f-needs">Needs %</label><input id="f-needs" name="needs" type="number" inputmode="numeric" min="0" max="100" value="${sp.needs}" required></div>
    <div class="field"><label for="f-wants">Wants %</label><input id="f-wants" name="wants" type="number" inputmode="numeric" min="0" max="100" value="${sp.wants}" required></div></div>
    <p>Savings gets the rest: <b id="split-rest">${sp.savings}%</b></p>
    <p class="note">50, 30 and 20 is the usual starting point. Living at home with few fixed costs? Try a bigger savings share.</p>
    ${ERR}<button class="btn primary block">Save split</button></form>`);
}
function goalSheet(g) {
  const em = g && g.id === 'emergency';
  openSheet(g ? 'Edit goal' : 'New goal', `<form class="stack" data-form="goal" data-id="${g ? g.id : ''}" novalidate>
    ${em ? '' : `<div class="field"><label for="f-name">What are you saving for?</label><input id="f-name" name="name" type="text" maxlength="40" placeholder="New laptop" value="${esc(g ? g.name : '')}" required></div>`}
    ${amountField(g ? g.target : '', em ? 'Target in ₹ (leave empty for three months of spending)' : 'Target in ₹', 'target')}
    ${em ? '' : `<div class="field"><label for="f-deadline">Target date <span style="font-weight:400">(optional)</span></label><input id="f-deadline" name="deadline" type="date" min="${today()}" value="${g ? g.deadline : ''}"></div>`}
    ${ERR}<button class="btn primary block">Save goal</button>
    ${g && !em ? '<button type="button" class="btn danger block" data-action="delete-goal" data-id="' + g.id + '" data-confirm="Tap again to delete">Delete goal</button>' : ''}</form>`);
}
function goalMoneySheet(g) {
  openSheet(g.name, `<form class="stack" data-form="goal-money" data-id="${g.id}" novalidate>
    <p class="note">${rs(g.saved)} put aside so far.</p>
    ${amountField('')}
    ${ERR}<button class="btn primary block" name="dir" value="in">Add to goal</button>
    ${g.saved > 0 ? '<button class="btn block" name="dir" value="out">Take out of goal</button>' : ''}</form>`);
  $('#f-amount').focus();
}
function catSheet() {
  openSheet('Add category', `<form class="stack" data-form="cat" novalidate>
    <div class="field"><label for="f-name">Name</label><input id="f-name" name="name" type="text" maxlength="24" placeholder="Gym" required></div>
    <div class="field"><span class="lbl">Icon</span><div class="chips">${Object.keys(PICKABLE).map((k, n) => `<label><input type="radio" name="icon" value="${k}" aria-label="${PICKABLE[k]}" ${n ? '' : 'checked'}><span>${icon(k)}</span></label>`).join('')}</div></div>
    <div class="field"><span class="lbl">Kind</span>${radios('kind', [['needs', 'Expense: need'], ['wants', 'Expense: want'], ['income', 'Income']], 'wants')}</div>
    ${ERR}<button class="btn primary block">Add category</button></form>`);
}
function pinSheet() {
  const has = !!S.settings.pin;
  openSheet(has ? 'Change PIN' : 'Set a PIN', `<form class="stack" data-form="pin" novalidate autocomplete="off">
    ${has ? '<div class="field"><label for="f-old">Current PIN</label><input id="f-old" name="old" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></div>' : ''}
    <div class="field"><label for="f-new">New 4-digit PIN</label><input id="f-new" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></div>
    <p class="note">There is no way to recover a forgotten PIN. You would have to erase the app and restore a backup.</p>
    ${ERR}<button class="btn primary block" name="act" value="set">Save PIN</button>
    ${has ? '<button class="btn danger block" name="act" value="remove">Remove PIN</button>' : ''}</form>`);
}
function restoreSheet(d) {
  UI.restore = d;
  openSheet('Restore this backup?', `<div class="stack"><p>The file holds <b>${d.tx.length} ${d.tx.length === 1 ? 'entry' : 'entries'}</b>${d.exportedAt ? ', saved on ' + esc(shortDate(d.exportedAt)) : ''}.</p>
    <p>It replaces the ${S.tx.length} ${S.tx.length === 1 ? 'entry' : 'entries'} on this device. This cannot be undone.</p>
    <button type="button" class="btn primary block" data-action="confirm-restore">Replace with backup</button>
    <button type="button" class="btn block" data-action="close-sheet">Keep what I have</button></div>`);
}

/* each handler returns an error string to show, or nothing on success */
const amt = v => r2(parseFloat(v));
const FORMS = {
  tx(fd, form) {
    const amount = amt(fd.get('amount')), c = fd.get('cat'), date = fd.get('date'), type = fd.get('type');
    if (!(amount > 0)) return 'Enter an amount greater than zero.';
    if (!c) return 'Pick a category.';
    if (!date) return 'Pick a date.';
    if (date > today()) return 'The date cannot be in the future.';
    const rec = { type, amount, cat: c, date, mode: fd.get('mode') || 'UPI', note: (fd.get('note') || '').trim() };
    const id = form.dataset.id;
    if (id) Object.assign(S.tx.find(t => t.id === id), rec);
    else {
      const tx = { id: uid(), ...rec };
      if (fd.get('repeat')) {
        const rid = uid(); tx.rid = rid;
        S.recurring.push({ id: rid, type, amount, cat: c, day: Number(date.slice(8)), mode: rec.mode, note: rec.note, active: true, lastApplied: curYm() > date.slice(0, 7) ? addMonths(curYm(), -1) : date.slice(0, 7), startYm: date.slice(0, 7) });
      }
      S.tx.push(tx);
      if (type === 'income' && c === 'stipend' && date.startsWith(curYm())) UI.freshStamp = true;
    }
    UI.ym = date.slice(0, 7);
    done(id ? 'Entry saved' : fd.get('repeat') ? 'Entry saved. It will repeat every month.' : 'Entry added');
    applyRecurring(); render();
  },
  recurring(fd, form) {
    const amount = amt(fd.get('amount')), c = fd.get('cat'), day = parseInt(fd.get('day'), 10);
    if (!(amount > 0)) return 'Enter an amount greater than zero.';
    if (!c) return 'Pick a category.';
    if (!(day >= 1 && day <= 31)) return 'Day must be between 1 and 31.';
    const rec = { type: fd.get('type'), amount, cat: c, day, mode: fd.get('mode') || 'UPI', note: (fd.get('note') || '').trim() };
    const id = form.dataset.id;
    if (id) Object.assign(S.recurring.find(r => r.id === id), rec, { active: !!fd.get('active') });
    else S.recurring.push({ id: uid(), ...rec, active: true, lastApplied: null, startYm: recurringStart(day) });
    done('Repeating entry saved');
  },
  'stipend-received'(fd) {
    const amount = amt(fd.get('amount')), date = fd.get('date');
    if (!(amount > 0)) return 'Enter the amount that arrived.';
    if (!date || date > today()) return 'Pick the date it arrived. It cannot be in the future.';
    S.tx.push({ id: uid(), type: 'income', amount, cat: 'stipend', date, mode: 'Bank', note: '' });
    if (!S.settings.stipend) S.settings.stipend = amount;
    UI.freshStamp = true; UI.ym = date.slice(0, 7); UI.tab = 'home';
    done('Stipend marked as received');
  },
  'stipend-settings'(fd) {
    const amount = amt(fd.get('amount')), day = parseInt(fd.get('day'), 10);
    if (!(amount > 0)) return 'Enter your monthly stipend.';
    if (!(day >= 1 && day <= 31)) return 'Day must be between 1 and 31.';
    S.settings.stipend = amount; S.settings.stipendDay = day;
    done('Stipend saved');
  },
  budget(fd, form) {
    const amount = amt(fd.get('amount'));
    if (!(amount > 0)) return 'Enter a limit greater than zero.';
    S.budgets[form.dataset.id] = amount;
    done('Limit saved');
  },
  split(fd) {
    const needs = parseInt(fd.get('needs'), 10), wants = parseInt(fd.get('wants'), 10);
    if (!(needs >= 0) || !(wants >= 0)) return 'Enter both percentages.';
    if (needs + wants > 100) return 'Needs and wants together cannot be more than 100%.';
    S.settings.split = { needs, wants, savings: 100 - needs - wants };
    done('Split saved');
  },
  goal(fd, form) {
    const id = form.dataset.id, target = amt(fd.get('target')) || 0;
    if (id === 'emergency') { S.goals.find(g => g.id === id).target = target > 0 ? target : 0; return done('Goal saved'); }
    const name = (fd.get('name') || '').trim(), deadline = fd.get('deadline') || '';
    if (!name) return 'Give the goal a name.';
    if (!(target > 0)) return 'Enter a target greater than zero.';
    if (id) Object.assign(S.goals.find(g => g.id === id), { name, target, deadline });
    else S.goals.push({ id: uid(), name, target, deadline, saved: 0, createdAt: today() });
    done('Goal saved');
  },
  'goal-money'(fd, form, submitter) {
    const g = S.goals.find(x => x.id === form.dataset.id), amount = amt(fd.get('amount'));
    if (!(amount > 0)) return 'Enter an amount greater than zero.';
    if (submitter && submitter.value === 'out') {
      if (amount > g.saved) return `Only ${rs(g.saved)} is in this goal.`;
      g.saved = r2(g.saved - amount); return done(rs(amount) + ' taken out');
    }
    g.saved = r2(g.saved + amount);
    done(rs(amount) + ' added to ' + g.name);
  },
  cat(fd) {
    const name = (fd.get('name') || '').trim(), kind = fd.get('kind');
    if (!name) return 'Give the category a name.';
    if (S.cats.some(c => c.name.toLowerCase() === name.toLowerCase())) return 'You already have a category with that name.';
    const c = { id: 'c' + uid(), name, type: kind === 'income' ? 'income' : 'expense', icon: Object.hasOwn(PICKABLE, fd.get('icon')) ? fd.get('icon') : 'tag' };
    if (c.type === 'expense') c.group = kind;
    S.cats.push(c);
    done('Category added');
  },
  pin(fd, form, submitter) {
    if (S.settings.pin && pinHash(fd.get('old') || '') !== S.settings.pin) return 'The current PIN is not right.';
    if (submitter && submitter.value === 'remove') { S.settings.pin = null; return done('PIN removed'); }
    const p = fd.get('pin') || '';
    if (!/^\d{4}$/.test(p)) return 'The PIN must be exactly 4 digits.';
    S.settings.pin = pinHash(p);
    done('PIN saved');
  },
};
function done(msg) {
  if (!save()) { toast('Could not save. Your browser storage may be full or blocked.'); return; }
  closeSheet(); render(); toast(msg);
}

/* ================= actions ================= */

const byId = (list, el) => list.find(x => x.id === el.dataset.id);
const ACTIONS = {
  'add-entry': () => txSheet(),
  'edit-tx': el => txSheet(byId(S.tx, el)),
  'delete-tx'(el) {
    const t = byId(S.tx, el); S.tx = S.tx.filter(x => x !== t); S.trash.push(t.id); save(); closeSheet(); render();
    toast('Entry deleted', 'Undo', () => { S.trash = S.trash.filter(id => id !== t.id); S.tx.push(t); save(); render(); toast('Entry restored'); });
  },
  'close-sheet': closeSheet,
  'prev-month'() { go(() => { UI.ym = addMonths(UI.ym, -1); }); },
  'next-month'() { if (UI.ym < curYm()) go(() => { UI.ym = addMonths(UI.ym, 1); }); },
  'stipend-received': stipendReceivedSheet,
  'stipend-settings': stipendSettingsSheet,
  'set-budget': el => budgetSheet(el.dataset.id),
  'remove-budget'(el) { delete S.budgets[el.dataset.id]; done('Limit removed'); },
  'edit-split': splitSheet,
  'new-goal': () => goalSheet(),
  'edit-goal': el => goalSheet(byId(S.goals, el)),
  'goal-money': el => goalMoneySheet(byId(S.goals, el)),
  'delete-goal'(el) { S.goals = S.goals.filter(g => g.id !== el.dataset.id); done('Goal deleted'); },
  'new-recurring': () => recurringSheet(),
  'edit-recurring': el => recurringSheet(byId(S.recurring, el)),
  'delete-recurring'(el) { S.recurring = S.recurring.filter(r => r.id !== el.dataset.id); done('Repeating entry deleted'); },
  'new-cat': catSheet,
  'delete-cat'(el) {
    const id = el.dataset.id, c = cat(id), fallback = c.type === 'income' ? 'otherinc' : 'other';
    S.tx.forEach(t => { if (t.cat === id) t.cat = fallback; });
    S.recurring.forEach(r => { if (r.cat === id) r.cat = fallback; });
    delete S.budgets[id]; S.cats = S.cats.filter(x => x.id !== id);
    done('Category removed. Its entries moved to ' + cat(fallback).name + '.');
  },
  'pin': pinSheet,
  'clear-filters'() { UI.filters = { q: '', type: '', cat: '', mode: '', scope: UI.filters.scope }; render(); },
  'export-month'() { download(`hisaab-${UI.ym}.csv`, toCsv(monthTx(UI.ym)), 'text/csv'); },
  'export-all'() { download('hisaab-all-entries.csv', toCsv(S.tx), 'text/csv'); },
  'backup'() {
    S.settings.lastBackup = today(); save();
    download(`hisaab-backup-${today()}.json`, JSON.stringify({ ...S, exportedAt: today() }, null, 1), 'application/json');
    render(); toast('Backup file saved. Keep it somewhere safe.');
  },
  'restore'() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { const d = JSON.parse(await f.text()); if (!validBackup(d)) throw 0; restoreSheet(d); }
      catch (e) { toast('That file is not a GaronchiHisaab backup.'); }
    };
    inp.click();
  },
  'confirm-restore'() { const d = UI.restore; UI.restore = null; delete d.exportedAt; closeSheet(); fullLoader('Restoring your backup', 900, () => { S = adopt(d); S.epoch = Date.now(); applyTheme(); done('Backup restored'); }); },
  'erase'() { fullLoader('Erasing your data', 900, () => { S = freshState(); S.epoch = Date.now(); UI.ym = curYm(); applyTheme(); done('All data erased'); }); },
  'sign-in'(el) {
    if (!Cloud.signIn) { $('#login-err').textContent = 'Still connecting. Try again in a moment.'; return; }
    $('#login-err').textContent = '';
    el.classList.add('loading'); Cloud.signIn().finally(() => el.classList.remove('loading'));
  },
  'sign-out'(el) {
    if (!Cloud.signOut) return;
    el.classList.add('loading'); Cloud.signOut().catch(() => { el.classList.remove('loading'); toast('Could not sign out. Check your connection.'); });
  },
  'forgot-pin'(el) {
    if (Cloud.user && Cloud.reauth) {
      /* with an account, signing in to Google again is the proof; nothing has to be erased */
      Cloud.reauth().then(ok => { if (ok) { S.settings.pin = null; save(); unlock(); render(); toast('PIN removed'); } else $('#lock-err').textContent = 'Sign in with the same Google account to remove the PIN.'; })
        .catch(() => { $('#lock-err').textContent = 'Could not reach Google. Try again when you are online.'; });
      return;
    }
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Tap again to erase everything and unlock'; return; }
    S = freshState(); save(); unlock(); render();
  },
};

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { if (tab.dataset.tab !== UI.tab) go(() => { UI.tab = tab.dataset.tab; }); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-action]');
  if (el && ACTIONS[el.dataset.action]) {
    if (el.dataset.confirm && !el.dataset.armed) {
      const old = el.textContent; el.dataset.armed = '1'; el.textContent = el.dataset.confirm;
      setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 3500);
      return;
    }
    if (BUSY_ACTIONS.includes(el.dataset.action) && el.classList.contains('btn')) { buttonLoad(el, () => ACTIONS[el.dataset.action](el)); return; }
    ACTIONS[el.dataset.action](el);
    return;
  }
  if (e.target === sheet) closeSheet(); /* tap outside the sheet */
});

document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]'); if (!form) return;
  e.preventDefault();
  const btn = e.submitter || $('button.primary', form), box = $('.err', form);
  if (box) box.textContent = '';
  buttonLoad(btn, () => {
    const err = FORMS[form.dataset.form](new FormData(form), form, e.submitter);
    if (err && box) { box.textContent = err; box.scrollIntoView({ block: 'nearest' }); }
  });
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'type' && t.form && $('#cat-chips', t.form)) $('#cat-chips', t.form).innerHTML = catChips(t.value, '');
  if (t.name === 'theme') { S.settings.theme = t.value; save(); applyTheme(); }
  const f = { 'f-scope': 'scope', 'f-type': 'type', 'f-cat': 'cat', 'f-mode': 'mode' }[t.id];
  if (f) { UI.filters[f] = t.value; $('#tx-list').innerHTML = txListHtml(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'f-q') { UI.filters.q = t.value; $('#tx-list').innerHTML = txListHtml(); }
  if (t.id === 'f-needs' || t.id === 'f-wants') {
    const rest = 100 - (parseInt($('#f-needs').value, 10) || 0) - (parseInt($('#f-wants').value, 10) || 0);
    $('#split-rest').textContent = rest >= 0 ? rest + '%' : 'more than 100% used';
  }
  if (t.id === 'lock-pin' && t.value.length === 4) {
    if (pinHash(t.value) === S.settings.pin) unlock();
    else { $('#lock-err').textContent = 'That PIN is not right. Try again.'; t.value = ''; }
  }
});
sheet.addEventListener('close', () => { sheet.innerHTML = ''; });

/* ================= small helpers ================= */

let toastTimer;
function toast(msg, actionLabel, fn) {
  const el = $('#toast'); el.innerHTML = `<span>${esc(msg)}</span>`;
  if (actionLabel) { const b = document.createElement('button'); b.type = 'button'; b.textContent = actionLabel; b.onclick = () => { el.hidden = true; fn(); }; el.append(b); }
  el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 6000 : 2800);
}

function download(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => {}); return;
    }
  } catch (e) { /* fall through to a normal download */ }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* chart tooltip */
const tip = $('#tip');
function hideTip() { tip.hidden = true; document.querySelectorAll('.col.on').forEach(c => c.classList.remove('on')); }
function showTip(el) {
  hideTip(); tip.textContent = el.dataset.tip; tip.hidden = false; el.classList.add('on');
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, hgt = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tip.style.top = Math.max(8, r.top - hgt - 8) + 'px';
}
document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el); else if (!tip.hidden) hideTip(); });
window.addEventListener('scroll', hideTip, { passive: true });

/* PIN lock */
function lock() { $('[data-action="forgot-pin"]').textContent = Cloud.user ? 'Forgot PIN? Sign in with Google again to remove it' : "Forgot PIN? Erase this device's data"; delete $('[data-action="forgot-pin"]').dataset.armed; $('#lock').hidden = false; $('#app').inert = true; $('.fab').hidden = true; closeSheet(); $('#lock-pin').value = ''; $('#lock-err').textContent = ''; setTimeout(() => $('#lock-pin').focus(), 50); }
function unlock() { $('#lock').hidden = true; $('#app').inert = false; $('.fab').hidden = false; }
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (!$('#login').hidden || !$('#splash').hidden) return;
  if (S.settings.pin && hiddenAt && Date.now() - hiddenAt > 120000) lock();
  if (applyRecurring()) render();
});
$('#lock-form').addEventListener('submit', e => e.preventDefault());

/* ================= loaders ================= */
/* Everything in this app is instant, so these timings are deliberate pauses. Set any of them to 0 to switch that loader off. */
const LOAD = { screen: 240, button: 380, splash: 700, refresh: 800 };
const BUSY_ACTIONS = ['backup', 'export-month', 'export-all'];

/* progress bar */
const bar = $('#progress');
function progressStart() { bar.className = 'progress'; void bar.offsetWidth; bar.className = 'progress run'; }
function progressDone() { bar.className = 'progress run end'; setTimeout(() => { if (bar.classList.contains('end')) bar.className = 'progress'; }, 200); }

/* skeleton */
function skeletonHtml() {
  const card = inner => `<section class="card skel">${inner}</section>`;
  const line = '<div class="line"><i></i><i></i></div>';
  return card('<span class="h"></span>' + line + line + '<span class="w60"></span>') +
    card('<span class="h"></span><span class="blk"></span><span class="w80"></span>') +
    card('<span class="h"></span>' + line + line + line);
}
/* change tab or month: progress bar and skeleton first, then the real screen */
let goTimer;
function go(change) {
  change();
  if (!LOAD.screen) { render(); return; }
  renderChrome(); progressStart();
  const v = $('#view'); v.className = UI.tab === 'home' ? 'cols2' : ''; v.setAttribute('aria-busy', 'true'); v.innerHTML = skeletonHtml();
  clearTimeout(goTimer);
  goTimer = setTimeout(() => { render(); progressDone(); }, LOAD.screen);
}

/* button loader: also stops a double tap from saving twice */
function buttonLoad(btn, work) {
  if (!btn || !LOAD.button) { work(); return; }
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading'); btn.setAttribute('aria-busy', 'true');
  setTimeout(() => { work(); if (btn.isConnected) { btn.classList.remove('loading'); btn.removeAttribute('aria-busy'); } }, LOAD.button);
}

/* full-screen loader */
function fullLoader(text, ms, work) {
  const el = $('#splash'); $('#splash-text').textContent = text; el.hidden = false;
  setTimeout(() => { work(); el.hidden = true; }, ms);
}

/* pull to refresh (touch screens): re-reads saved data, adds any due repeating entries, checks for an app update */
const ptr = $('#ptr'), PULL_AT = 70;
let pullStart = null, pull = 0, refreshing = false;
function setPull(px) {
  pull = px;
  ptr.style.transform = `translateY(${px}px)`; ptr.style.opacity = Math.min(1, px / 40);
  ptr.firstElementChild.style.transform = px ? `rotate(${px * 4}deg)` : '';
  ptr.classList.toggle('ready', px >= PULL_AT);
}
function refresh() {
  if (refreshing) return;
  refreshing = true; ptr.classList.add('settle', 'on'); setPull(64); ptr.firstElementChild.style.transform = ''; progressStart();
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  setTimeout(() => {
    load(); applyTheme(); const added = applyRecurring(); render(); progressDone();
    ptr.classList.remove('on'); setPull(0); refreshing = false;
    toast(added ? `Up to date. ${added} repeating ${added === 1 ? 'entry' : 'entries'} added.` : 'Up to date');
  }, LOAD.refresh);
}
document.addEventListener('touchstart', e => {
  pullStart = !refreshing && window.scrollY <= 0 && !sheet.open && $('#lock').hidden && e.touches.length === 1 ? e.touches[0].clientY : null;
  ptr.classList.remove('settle');
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (pullStart === null) return;
  const dy = e.touches[0].clientY - pullStart;
  if (dy <= 0 || window.scrollY > 0) { if (pull) setPull(0); return; }
  setPull(Math.min(110, dy * 0.5));
}, { passive: true });
document.addEventListener('touchend', () => {
  if (pullStart === null) return;
  pullStart = null; ptr.classList.add('settle');
  if (pull >= PULL_AT) refresh(); else setPull(0);
}, { passive: true });

/* ================= tab bar highlight ================= */
/* One shared pill slides behind the tabs: it follows the mouse on hover and rests on the open tab. */
const tabsEl = $('.tabs');
let tabBg = null;
function moveTabBg(btn, instant) {
  if (!tabBg) { tabBg = document.createElement('span'); tabBg.className = 'tab-bg'; tabBg.setAttribute('aria-hidden', 'true'); tabsEl.prepend(tabBg); instant = true; }
  btn = btn || $('button[aria-current="page"]', tabsEl);
  if (!btn) return;
  const inset = matchMedia('(min-width: 900px)').matches ? 0 : 4;
  if (instant) tabBg.style.transition = 'none';
  tabBg.style.width = btn.offsetWidth - inset * 2 + 'px';
  tabBg.style.height = btn.offsetHeight - inset * 2 + 'px';
  tabBg.style.transform = `translate(${btn.offsetLeft + inset}px, ${btn.offsetTop + inset}px)`;
  if (instant) { void tabBg.offsetWidth; tabBg.style.transition = ''; }
}
tabsEl.addEventListener('pointerover', e => { const b = e.pointerType === 'mouse' && e.target.closest('button'); if (b) moveTabBg(b); });
tabsEl.addEventListener('pointerleave', () => moveTabBg());
tabsEl.addEventListener('focusin', e => { const b = e.target.closest('button'); if (b && b.matches(':focus-visible')) moveTabBg(b); });
tabsEl.addEventListener('focusout', () => moveTabBg());
window.addEventListener('resize', () => moveTabBg(null, true));

/* ================= start ================= */
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
/* open one account's data (uid) or, with sign-in switched off, this device's data (no uid) */
function startSession(uid) {
  setUser(uid || null);
  applyTheme(); applyRecurring();
  UI.tab = 'home'; UI.ym = curYm();
  $('#login').hidden = true; unlock(); render();
  if (S.settings.pin) lock();
  $('#splash').hidden = true;
}
function showLogin(msg) {
  closeSheet();
  $('#lock').hidden = true; $('#login').hidden = false; $('#app').inert = true; $('.fab').hidden = true;
  $('#login-err').textContent = msg || '';
  $('#splash').hidden = true;
}
/* called by cloud.js with the newest online copy (a JSON string, or null when nothing is stored online yet) */
function cloudApply(json) {
  let remote = null;
  try { if (json) remote = adopt(JSON.parse(json)); } catch (e) { /* unreadable copy online: this device's data replaces it */ }
  if (!remote) return { push: true };
  const merged = mergeStates(adopt(S), remote);
  if (JSON.stringify(merged) !== JSON.stringify(adopt(S))) {
    S = merged; saveLocal(); applyTheme();
    if (!applyRecurring()) { /* applyRecurring saves and re-sends by itself when it adds something */ }
    render();
  }
  return { push: JSON.stringify(adopt(S)) !== JSON.stringify(remote) };
}
const cloudPayload = () => JSON.stringify(adopt(S));
Cloud.onStatus = () => { if (UI.tab === 'settings' && $('#login').hidden && !sheet.open) render(); };
/* cloud.js could not load Firebase (offline, first visit): open the last account's saved data if there is one */
Cloud.fallback = () => {
  if (Cloud.booted) return;
  Cloud.booted = true;
  let last = null; try { last = localStorage.getItem('gh-last-uid'); } catch (e) {}
  if (last) startSession(last); else showLogin('You are offline. Connect to the internet to sign in for the first time.');
};

load();
applyTheme();
if (Cloud.on) {
  /* stay behind the opening screen until cloud.js knows whether someone is signed in */
  $('#app').inert = true; $('.fab').hidden = true;
  setTimeout(() => Cloud.fallback(), 8000);
} else {
  applyRecurring();
  render();
  if (S.settings.pin) lock();
  setTimeout(() => { $('#splash').hidden = true; }, LOAD.splash);
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* iOS Safari only shows :active press styles when a touch listener exists */
document.addEventListener('touchstart', () => {}, { passive: true });
