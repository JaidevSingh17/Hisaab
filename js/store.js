'use strict';
/* GaronchiHisaab — data, dates, money and all the arithmetic. No UI in this file. */

const BASE_KEY = 'garonchi-hisaab-v1';
let KEY = BASE_KEY;          /* becomes BASE_KEY:uid once someone signs in */
let onStateSaved = null;     /* app.js sets this so every save is also sent online */
const MODES = ['UPI', 'Cash', 'Card', 'Bank'];

const DEFAULT_CATS = [
  { id: 'groceries', name: 'Groceries', type: 'expense', group: 'needs', icon: 'cart' },
  { id: 'rent', name: 'Rent & hostel', type: 'expense', group: 'needs', icon: 'home' },
  { id: 'transport', name: 'Transport', type: 'expense', group: 'needs', icon: 'bus' },
  { id: 'mobile', name: 'Mobile & internet', type: 'expense', group: 'needs', icon: 'wifi' },
  { id: 'health', name: 'Health', type: 'expense', group: 'needs', icon: 'heart' },
  { id: 'education', name: 'Courses & books', type: 'expense', group: 'needs', icon: 'book' },
  { id: 'family', name: 'Family', type: 'expense', group: 'needs', icon: 'users' },
  { id: 'food', name: 'Food & eating out', type: 'expense', group: 'wants', icon: 'food' },
  { id: 'shopping', name: 'Shopping', type: 'expense', group: 'wants', icon: 'bag' },
  { id: 'fun', name: 'Entertainment', type: 'expense', group: 'wants', icon: 'play' },
  { id: 'subs', name: 'Subscriptions', type: 'expense', group: 'wants', icon: 'repeat' },
  { id: 'other', name: 'Other spending', type: 'expense', group: 'wants', icon: 'box' },
  { id: 'stipend', name: 'Internship stipend', type: 'income', icon: 'briefcase' },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: 'laptop' },
  { id: 'pocket', name: 'Pocket money', type: 'income', icon: 'wallet' },
  { id: 'gift', name: 'Gift', type: 'income', icon: 'gift' },
  { id: 'refund', name: 'Refund', type: 'income', icon: 'undo' },
  { id: 'otherinc', name: 'Other income', type: 'income', icon: 'pluscircle' },
];
const LOCKED_CATS = ['stipend', 'other', 'otherinc'];

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => iso(new Date());
const curYm = () => today().slice(0, 7);
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
function addMonths(ym, n) { const d = toDate(ym + '-01'); d.setMonth(d.getMonth() + n); return iso(d).slice(0, 7); }
function daysIn(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function monthName(ym, short) {
  return toDate(ym + '-01').toLocaleDateString('en-IN', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
}
const niceDate = s => toDate(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDate = s => toDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
/* days of the month that have happened so far (whole month for past months) */
function elapsedDays(ym) { return ym === curYm() ? new Date().getDate() : ym < curYm() ? daysIn(ym) : 0; }

/* ---------- money ---------- */
const INR0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const INR2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
function rs(n) { n = r2(n); return (Number.isInteger(n) ? INR0 : INR2).format(n); }
function rsShort(n) {
  n = Math.round(n);
  if (n >= 100000) return '₹' + +(n / 100000).toFixed(1) + 'L';
  if (n >= 10000) return '₹' + +(n / 1000).toFixed(1) + 'K';
  return '₹' + n.toLocaleString('en-IN');
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- state ---------- */
let S;
function freshState() {
  return {
    v: 1,
    updatedAt: 0,    // when this device last changed anything
    epoch: 0,        // bumped by Erase and Restore, so a reset is never merged back with old entries
    trash: [],       // ids of deleted entries, so a delete on one device is not undone by another
    settings: { stipend: 0, stipendDay: 1, split: { needs: 50, wants: 30, savings: 20 }, theme: 'auto', pin: null, lastBackup: null, createdAt: today() },
    cats: DEFAULT_CATS.map(c => ({ ...c })),
    tx: [],          // {id, type, amount, cat, date, mode, note, rid?}
    budgets: {},     // catId -> monthly limit
    recurring: [],   // {id, type, amount, cat, day, mode, note, active, lastApplied, startYm}
    goals: [{ id: 'emergency', name: 'Emergency fund', target: 0, deadline: '', saved: 0, createdAt: today() }],
  };
}
/* Rebuild state field by field so a damaged or hand-edited file can never inject markup or bad types. */
function adopt(data) {
  const f = freshState(), d = data && typeof data === 'object' ? data : {};
  const okId = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
  const okDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const num = (v, min = 0, max = 1e12) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min; };
  const str = (v, n) => String(v ?? '').slice(0, n);
  const arr = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
  const kind = v => v === 'income' ? 'income' : 'expense';
  const mode = v => MODES.includes(v) ? v : 'UPI';

  const st = d.settings || {}, sp = st.split || {};
  let needs = Math.round(num(sp.needs ?? 50, 0, 100)), wants = Math.round(num(sp.wants ?? 30, 0, 100));
  if (needs + wants > 100) { needs = 50; wants = 30; }
  f.settings = {
    stipend: r2(num(st.stipend)), stipendDay: Math.round(num(st.stipendDay ?? 1, 1, 31)),
    split: { needs, wants, savings: 100 - needs - wants },
    theme: ['auto', 'light', 'dark'].includes(st.theme) ? st.theme : 'auto',
    pin: typeof st.pin === 'string' && /^[0-9a-f]{1,8}$/.test(st.pin) ? st.pin : null,
    lastBackup: okDate(st.lastBackup) ? st.lastBackup : null,
    createdAt: okDate(st.createdAt) ? st.createdAt : today(),
  };
  const cats = arr(d.cats).filter(c => okId(c.id) && c.name).map(c => {
    const def = DEFAULT_CATS.find(x => x.id === c.id);
    const o = { id: c.id, name: str(c.name, 30), type: kind(c.type), icon: def ? def.icon : (Object.hasOwn(ICONS, c.icon) ? c.icon : 'tag') };
    if (o.type === 'expense') o.group = c.group === 'needs' ? 'needs' : 'wants';
    return o;
  });
  for (const c of DEFAULT_CATS) if (!cats.some(x => x.id === c.id)) cats.push({ ...c });
  f.cats = cats;
  f.tx = arr(d.tx).filter(t => okDate(t.date) && num(t.amount) > 0).map(t => {
    const o = { id: okId(t.id) ? t.id : uid(), type: kind(t.type), amount: r2(num(t.amount)), cat: okId(t.cat) ? t.cat : 'other', date: t.date, mode: mode(t.mode), note: str(t.note, 80) };
    if (okId(t.rid)) o.rid = t.rid;
    return o;
  });
  f.budgets = {};
  if (d.budgets && typeof d.budgets === 'object') for (const k of Object.keys(d.budgets)) if (okId(k) && num(d.budgets[k]) > 0) f.budgets[k] = r2(num(d.budgets[k]));
  f.recurring = arr(d.recurring).filter(r => okId(r.id) && num(r.amount) > 0).map(r => ({
    id: r.id, type: kind(r.type), amount: r2(num(r.amount)), cat: okId(r.cat) ? r.cat : 'other', day: Math.round(num(r.day, 1, 31)), mode: mode(r.mode), note: str(r.note, 80),
    active: r.active !== false, lastApplied: /^\d{4}-\d{2}$/.test(r.lastApplied) ? r.lastApplied : null, startYm: /^\d{4}-\d{2}$/.test(r.startYm) ? r.startYm : curYm(),
  }));
  const goals = arr(d.goals).filter(g => okId(g.id)).map(g => ({
    id: g.id, name: g.id === 'emergency' ? 'Emergency fund' : str(g.name, 40) || 'Goal', target: r2(num(g.target)), saved: r2(num(g.saved)),
    deadline: okDate(g.deadline) ? g.deadline : '', createdAt: okDate(g.createdAt) ? g.createdAt : today(),
  }));
  if (!goals.some(g => g.id === 'emergency')) goals.unshift(f.goals[0]);
  f.goals = goals;
  f.updatedAt = num(d.updatedAt); f.epoch = num(d.epoch);
  f.trash = Array.isArray(d.trash) ? d.trash.filter(okId).slice(-3000) : [];
  return f;
}
function load() {
  try { const raw = localStorage.getItem(KEY); S = raw ? adopt(JSON.parse(raw)) : freshState(); }
  catch (e) { S = freshState(); }
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
}
function save() {
  S.updatedAt = Date.now();
  const ok = saveLocal();
  if (ok && onStateSaved) onStateSaved();
  return ok;
}
/* switch to one account's data. The first account to sign in on a device adopts anything recorded before sign-in existed. */
function setUser(uid) {
  KEY = uid ? BASE_KEY + ':' + uid : BASE_KEY;
  try {
    if (uid && !localStorage.getItem(KEY) && localStorage.getItem(BASE_KEY)) {
      localStorage.setItem(KEY, localStorage.getItem(BASE_KEY)); localStorage.removeItem(BASE_KEY);
    }
  } catch (e) { /* storage blocked: carry on with an empty state */ }
  load();
}
/* Combine this device's state with the online copy.
   Entries are united by id, so two devices adding entries while offline both keep theirs.
   Everything else (settings, budgets, goals, categories, repeating entries) comes from whichever side changed last. */
function mergeStates(a, b) {
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? a : b;
  const newer = b.updatedAt >= a.updatedAt ? b : a, older = newer === a ? b : a;
  const trash = new Set([...a.trash, ...b.trash]), byId = new Map();
  for (const t of older.tx) byId.set(t.id, t);
  for (const t of newer.tx) byId.set(t.id, t);
  const seen = new Set();
  const tx = [...byId.values()].filter(t => {
    if (trash.has(t.id)) return false;
    if (!t.rid) return true;
    const k = t.rid + '|' + t.date.slice(0, 7);   /* the same repeating entry added by two devices */
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  return adopt({ ...newer, tx, trash: [...trash], updatedAt: Math.max(a.updatedAt, b.updatedAt) });
}
function validBackup(d) {
  return d && typeof d === 'object' && Array.isArray(d.tx) && Array.isArray(d.cats) &&
    d.tx.every(t => t && typeof t.amount === 'number' && typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
}

function cat(id) { return S.cats.find(c => c.id === id) || { id, name: 'Removed category', type: 'expense', group: 'wants', icon: 'box' }; }
const catsOf = type => S.cats.filter(c => c.type === type);
const monthTx = ym => S.tx.filter(t => t.date.startsWith(ym));
const stipendTx = ym => S.tx.find(t => t.type === 'income' && t.cat === 'stipend' && t.date.startsWith(ym));
function pinHash(p) { let h = 2166136261; for (const c of 'gh:' + p) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

/* ---------- monthly totals ---------- */
function totals(ym) {
  const o = { income: 0, spent: 0, needs: 0, wants: 0, byCat: {}, count: 0 };
  for (const t of monthTx(ym)) {
    o.count++;
    if (t.type === 'income') { o.income += t.amount; continue; }
    o.spent += t.amount;
    o[cat(t.cat).group === 'needs' ? 'needs' : 'wants'] += t.amount;
    o.byCat[t.cat] = (o.byCat[t.cat] || 0) + t.amount;
  }
  for (const k of ['income', 'spent', 'needs', 'wants']) o[k] = r2(o[k]);
  o.saved = r2(o.income - o.spent);
  o.rate = o.income > 0 ? o.saved / o.income * 100 : 0;
  return o;
}

/* ---------- repeating entries ---------- */
function applyRecurring() {
  const now = today(), cur = curYm();
  let added = 0;
  for (const r of S.recurring) {
    if (!r.active) continue;
    let ym = r.lastApplied ? addMonths(r.lastApplied, 1) : r.startYm;
    for (let guard = 0; ym <= cur && guard < 60; guard++, ym = addMonths(ym, 1)) {
      const date = ym + '-' + pad(Math.min(r.day, daysIn(ym)));
      if (date > now) break;
      S.tx.push({ id: uid(), type: r.type, amount: r.amount, cat: r.cat, date, mode: r.mode, note: r.note, rid: r.id });
      r.lastApplied = ym; added++;
    }
  }
  if (added) save();
  return added;
}
/* a new repeating entry starts on its next due date, so today's manual entry is never doubled */
function recurringStart(day) { return day > new Date().getDate() ? curYm() : addMonths(curYm(), 1); }

/* ---------- budgets ---------- */
function budgetStatus(id, ym) {
  const limit = S.budgets[id] || 0, spent = totals(ym).byCat[id] || 0;
  const pct = limit ? spent / limit * 100 : 0;
  const monthPct = elapsedDays(ym) / daysIn(ym) * 100;
  const state = pct > 100 ? 'over' : pct >= 80 ? 'near' : 'ok';
  const fast = ym === curYm() && state !== 'over' && pct > monthPct + 15 && pct >= 40;
  return { limit, spent, pct, state, fast, monthPct };
}

/* ---------- the plan ---------- */
function plan(ym) {
  const t = totals(ym), sp = S.settings.split;
  const base = t.income || S.settings.stipend || 0;
  return {
    t, base, usingStipend: !t.income && base > 0,
    needs: { plan: base * sp.needs / 100, actual: t.needs, pct: sp.needs },
    wants: { plan: base * sp.wants / 100, actual: t.wants, pct: sp.wants },
    savings: { plan: base * sp.savings / 100, actual: t.saved, pct: sp.savings },
  };
}
/* what you can still spend per day this month while keeping the savings share */
function dailyAllowance(ym) {
  if (ym !== curYm()) return null;
  const p = plan(ym); if (!p.t.income) return null;
  const left = p.t.income - p.savings.plan - p.t.spent;
  const days = daysIn(ym) - new Date().getDate() + 1;
  return { left, perDay: left / days, days };
}
function avgMonthlySpend() {
  const vals = [];
  for (let i = 0, ym = curYm(); i < 6 && vals.length < 3; i++, ym = addMonths(ym, -1)) {
    const s = totals(ym).spent; if (s > 0) vals.push(s);
  }
  if (vals.length) return vals.reduce((a, b) => a + b, 0) / vals.length;
  const sp = S.settings.split; return S.settings.stipend * (sp.needs + sp.wants) / 100;
}
function goalInfo(g) {
  const target = g.id === 'emergency' && !g.target ? Math.round(avgMonthlySpend() * 3 / 100) * 100 : g.target;
  const left = Math.max(0, target - g.saved);
  const o = { target, left, pct: target ? Math.min(100, g.saved / target * 100) : 0, done: target > 0 && left === 0, status: '', perMonth: 0 };
  if (g.deadline && !o.done) {
    const now = new Date(), end = toDate(g.deadline), start = toDate(g.createdAt || today());
    if (end < toDate(today())) { o.status = 'late'; return o; }
    const months = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth() + (end.getDate() >= now.getDate() ? 0 : -1) + 1);
    o.perMonth = left / months; o.months = months;
    const frac = end > start ? Math.min(1, (now - start) / (end - start)) : 1;
    o.status = g.saved + 1 >= target * frac ? 'ontrack' : 'behind';
  }
  return o;
}

/* ---------- report ---------- */
function score(ym) {
  const p = plan(ym), t = p.t, parts = [];
  const sv = t.income > 0 && p.savings.pct > 0 ? Math.max(0, Math.min(1, t.rate / p.savings.pct)) : (t.income > 0 && t.saved >= 0 ? 1 : 0);
  parts.push({ label: 'Saving', max: 40, got: Math.round(sv * 40),
    note: t.income > 0 ? `You kept ${Math.round(t.rate)}% of your income. The plan asks for ${p.savings.pct}%.` : 'No income recorded this month.' });

  const ids = Object.keys(S.budgets).filter(id => S.budgets[id] > 0);
  if (ids.length) {
    const ok = ids.filter(id => budgetStatus(id, ym).state !== 'over').length;
    parts.push({ label: 'Staying in budget', max: 30, got: Math.round(ok / ids.length * 30), note: `${ok} of ${ids.length} budgets kept.` });
  } else parts.push({ label: 'Staying in budget', max: 30, got: 10, note: 'No budgets set yet. Set limits in Budgets to earn the rest.' });

  const w = p.wants.plan > 0 ? Math.max(0, Math.min(1, 1 - (t.wants - p.wants.plan) / p.wants.plan)) : (t.wants ? 0 : 1);
  parts.push({ label: 'Wants under control', max: 15, got: Math.round(w * 15),
    note: t.wants <= p.wants.plan ? 'Wants stayed inside the plan.' : `Wants ran ${rs(t.wants - p.wants.plan)} over the plan.` });

  const days = new Set(monthTx(ym).map(x => x.date)).size, el = Math.max(1, elapsedDays(ym));
  const hb = Math.min(1, days / (el * 0.5));
  parts.push({ label: 'Tracking habit', max: 15, got: Math.round(hb * 15), note: `You recorded entries on ${days} of ${el} days.` });
  return { total: parts.reduce((a, x) => a + x.got, 0), parts };
}
function verdict(n) { return n >= 85 ? 'Excellent month' : n >= 70 ? 'Good month' : n >= 50 ? 'Getting there' : 'Needs attention'; }

function insights(ym) {
  const t = totals(ym), prevYm = addMonths(ym, -1), p = totals(prevYm), out = [];
  if (!t.count) return out;
  if (t.income > 0) out.push(t.saved >= 0 ? `You kept ${rs(t.saved)}, which is ${Math.round(t.rate)}% of what came in.` : `You spent ${rs(-t.saved)} more than came in.`);
  const cats = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]);
  if (cats.length) out.push(`${cat(cats[0][0]).name} was your biggest category: ${rs(cats[0][1])}, ${Math.round(cats[0][1] / t.spent * 100)}% of all spending.`);
  /* month-against-month comparisons only make sense once the month is over */
  const whole = ym < curYm();
  let up = null, down = null;
  for (const [id, v] of whole ? cats : []) {
    const was = p.byCat[id] || 0; if (!was) continue;
    const d = v - was, ch = d / was;
    if (ch >= .2 && d >= 200 && (!up || d > up.d)) up = { id, d, ch };
    if (ch <= -.2 && d <= -200 && (!down || d < down.d)) down = { id, d, ch };
  }
  if (up) out.push(`${cat(up.id).name} is up ${Math.round(up.ch * 100)}% on ${monthName(prevYm, true)}: ${rs(up.d)} more.`);
  if (down) out.push(`${cat(down.id).name} is down ${Math.round(-down.ch * 100)}% on ${monthName(prevYm, true)}: ${rs(-down.d)} less.`);
  if (whole && p.spent > 0 && t.spent > 0) {
    const d = t.spent - p.spent;
    if (Math.abs(d) >= 100) out.push(`Total spending is ${rs(Math.abs(d))} ${d > 0 ? 'higher' : 'lower'} than ${monthName(prevYm, true)}.`);
  }
  const wd = [0, 0, 0, 0, 0, 0, 0], spendDays = new Set();
  for (const x of monthTx(ym)) if (x.type === 'expense') { wd[toDate(x.date).getDay()] += x.amount; spendDays.add(x.date); }
  const top = wd.indexOf(Math.max(...wd));
  if (wd[top] > 0 && spendDays.size >= 4) out.push(`${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][top]} cost you the most: ${rs(wd[top])} this month.`);
  const el = elapsedDays(ym);
  if (t.spent > 0 && el > 0) {
    out.push(`You spent ${rs(Math.round(t.spent / el))} a day on average.`);
    if (el - spendDays.size > 0) out.push(`${el - spendDays.size} ${el - spendDays.size === 1 ? 'day' : 'days'} with no spending at all.`);
  }
  const rec = S.recurring.filter(r => r.active && r.type === 'expense').reduce((a, r) => a + r.amount, 0);
  if (rec > 0) out.push(`Your repeating payments add up to ${rs(rec)} a month, which is ${rs(rec * 12)} a year.`);
  return out;
}

/* ---------- export ---------- */
function toCsv(list) {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Date', 'Type', 'Category', 'Amount (INR)', 'Paid by', 'Note']];
  for (const t of [...list].sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([t.date, t.type === 'income' ? 'Income' : 'Expense', cat(t.cat).name, t.amount, t.mode || '', t.note || '']);
  return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
}
