import { useState, useEffect, useMemo, useCallback } from "react";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPA_URL = "https://draniousnxunkgqdxxvw.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYW5pb3Vzbnh1bmtncWR4eHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTUwODgsImV4cCI6MjA5ODIzMTA4OH0.GxRgqdfM7ybBN4mQhARCqOeL6AR8XZAX_O8s9Oq7dts";
const BASE_H = { "Content-Type": "application/json", apikey: SUPA_KEY };
const AH = (t) => ({ ...BASE_H, Authorization: "Bearer " + (t || SUPA_KEY), Prefer: "return=representation" });

const api = {
  get:    (p, t)    => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: AH(t) }).then(r => r.json()),
  post:   (p, b, t) => fetch(`${SUPA_URL}/rest/v1/${p}`, { method: "POST",   headers: AH(t), body: JSON.stringify(b) }).then(r => r.json()),
  patch:  (p, b, t) => fetch(`${SUPA_URL}/rest/v1/${p}`, { method: "PATCH",  headers: AH(t), body: JSON.stringify(b) }).then(r => r.json()),
  del:    (p, t)    => fetch(`${SUPA_URL}/rest/v1/${p}`, { method: "DELETE", headers: AH(t) }),
  upsert: (p, b, t) => fetch(`${SUPA_URL}/rest/v1/${p}`, { method: "POST",   headers: { ...AH(t), Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(b) }).then(r => r.json()),
};
const signIn       = (e, p) => fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`,    { method: "POST", headers: BASE_H, body: JSON.stringify({ email: e, password: p }) }).then(r => r.json());
const signUp       = (e, p) => fetch(`${SUPA_URL}/auth/v1/signup`,                        { method: "POST", headers: BASE_H, body: JSON.stringify({ email: e, password: p }) }).then(r => r.json());
const refreshAccess = rt   => fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: BASE_H, body: JSON.stringify({ refresh_token: rt }) }).then(r => r.json());

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CATS = [
  { name: "Groceries",     icon: "🛒", color: "#4CAF50" },
  { name: "Dining",        icon: "🍽️", color: "#FF9800" },
  { name: "Transport",     icon: "🚗", color: "#2196F3" },
  { name: "Utilities",     icon: "💡", color: "#9C27B0" },
  { name: "Entertainment", icon: "🎬", color: "#E91E63" },
  { name: "Health",        icon: "💊", color: "#F44336" },
  { name: "Shopping",      icon: "🛍️", color: "#00BCD4" },
  { name: "Education",     icon: "📚", color: "#795548" },
  { name: "Travel",        icon: "✈️", color: "#009688" },
  { name: "Other",         icon: "📌", color: "#607D8B" },
];
const PALETTE    = ["#1E3A8A","#3B82F6","#FF6584","#43CFBE","#F59E0B","#EF4444","#22C55E","#EC4899"];
const MONTHS     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Only this account may create, edit, or delete categories (also enforced via Supabase RLS)
const ADMIN_EMAIL = "dgnwebs@gmail.com";

// { e: emoji, k: searchable keywords }
const EMOJI_LIB = [
  { e:"🛒", k:"grocery groceries cart shopping" },
  { e:"🍽️", k:"dining restaurant food plate eat" },
  { e:"🍕", k:"pizza food" },
  { e:"🍔", k:"burger food fast food" },
  { e:"🍟", k:"fries food fast food" },
  { e:"🍜", k:"noodles food ramen" },
  { e:"🥗", k:"salad food healthy" },
  { e:"☕", k:"coffee cafe drink" },
  { e:"🍻", k:"beer drinks alcohol bar" },
  { e:"🍷", k:"wine drinks alcohol" },
  { e:"🚗", k:"car transport vehicle drive" },
  { e:"🚕", k:"taxi cab transport ride" },
  { e:"🚌", k:"bus transport public" },
  { e:"🚆", k:"train transport metro subway" },
  { e:"⛽", k:"fuel gas petrol diesel station" },
  { e:"🅿️", k:"parking transport" },
  { e:"✈️", k:"flight travel airplane plane" },
  { e:"🏨", k:"hotel travel stay lodging" },
  { e:"🏖️", k:"vacation beach holiday travel" },
  { e:"🧳", k:"luggage travel trip" },
  { e:"💡", k:"electricity utility bill light power" },
  { e:"💧", k:"water utility bill" },
  { e:"🔥", k:"gas utility bill heating" },
  { e:"📶", k:"internet wifi utility broadband" },
  { e:"📱", k:"phone mobile bill recharge" },
  { e:"☎️", k:"phone landline bill" },
  { e:"🏠", k:"home house rent" },
  { e:"🏡", k:"home house property" },
  { e:"🔧", k:"repair maintenance tools fix" },
  { e:"🛠️", k:"tools repair maintenance" },
  { e:"🧰", k:"toolbox repair maintenance" },
  { e:"🛍️", k:"shopping bags retail" },
  { e:"👕", k:"clothes clothing shopping shirt" },
  { e:"👗", k:"clothes dress shopping fashion" },
  { e:"👟", k:"shoes shopping footwear" },
  { e:"💄", k:"makeup beauty cosmetics" },
  { e:"💊", k:"medicine health pharmacy drugs" },
  { e:"🏥", k:"hospital health medical clinic" },
  { e:"🩺", k:"doctor health medical checkup" },
  { e:"🦷", k:"dental dentist health teeth" },
  { e:"🧴", k:"toiletries personal care lotion" },
  { e:"💇", k:"haircut salon personal care barber" },
  { e:"🎬", k:"movie entertainment cinema film" },
  { e:"🎮", k:"gaming entertainment games" },
  { e:"🎵", k:"music entertainment songs" },
  { e:"🎤", k:"karaoke music entertainment" },
  { e:"🎟️", k:"tickets entertainment event" },
  { e:"📺", k:"tv streaming subscription entertainment" },
  { e:"📚", k:"books education school reading" },
  { e:"🎓", k:"education school graduation tuition fees" },
  { e:"✏️", k:"stationery school supplies pencil" },
  { e:"🎒", k:"school bag backpack education" },
  { e:"👶", k:"baby child kids" },
  { e:"🧸", k:"toys kids child" },
  { e:"🐾", k:"pets animal" },
  { e:"🐶", k:"dog pet" },
  { e:"🐱", k:"cat pet" },
  { e:"⚽", k:"sports football fitness" },
  { e:"🏋️", k:"gym fitness exercise workout" },
  { e:"🏊", k:"swimming sports fitness pool" },
  { e:"🚴", k:"cycling sports fitness bike" },
  { e:"💻", k:"computer tech electronics laptop" },
  { e:"🖨️", k:"printer electronics office" },
  { e:"📷", k:"camera electronics photography" },
  { e:"💳", k:"credit card payment finance" },
  { e:"🏦", k:"bank finance loan" },
  { e:"💰", k:"money savings finance" },
  { e:"📈", k:"investment finance stocks" },
  { e:"🧾", k:"receipt bill invoice" },
  { e:"🎁", k:"gift present" },
  { e:"🎂", k:"birthday cake celebration" },
  { e:"🎉", k:"party celebration event" },
  { e:"💍", k:"wedding jewelry ring" },
  { e:"⚖️", k:"legal lawyer fees" },
  { e:"🧹", k:"cleaning household chores" },
  { e:"🛡️", k:"insurance protection" },
  { e:"🐕‍🦺", k:"pet vet animal care" },
  { e:"🌿", k:"garden plants lawn" },
  { e:"📌", k:"other misc pin general" },
];

// ─── Note autocomplete: common items + typical units, used to suggest clean,
// consistent note text as the user types (e.g. "milk" → "1l Milk", "For Milk").
// "basket" items (vegetables, fruits, snacks…) are composites of many small
// purchases — quantity suggestions don't make sense there, just "For X" does.
const QTY_BY_UNIT = {
  kg: [1, 2, 0.5], l: [1, 2], g: [250, 500], ml: [100, 200],
  pcs: [1, 2], dozen: [1], pack: [1, 2],
};
const NOTE_LEXICON = [
  { name:"milk", unit:"l" }, { name:"bread", unit:"pcs" }, { name:"eggs", unit:"dozen" },
  { name:"rice", unit:"kg" }, { name:"atta", unit:"kg" }, { name:"wheat flour", unit:"kg" },
  { name:"sugar", unit:"kg" }, { name:"salt", unit:"kg" }, { name:"cooking oil", unit:"l" },
  { name:"ghee", unit:"kg" }, { name:"butter", unit:"g" }, { name:"cheese", unit:"g" },
  { name:"paneer", unit:"g" }, { name:"curd", unit:"kg" }, { name:"yogurt", unit:"kg" },
  { name:"tea", unit:"g" }, { name:"coffee", unit:"g" }, { name:"vegetables", basket:true },
  { name:"onion", unit:"kg" }, { name:"potato", unit:"kg" }, { name:"tomato", unit:"kg" },
  { name:"fruits", basket:true }, { name:"banana", unit:"dozen" }, { name:"apple", unit:"kg" },
  { name:"chicken", unit:"kg" }, { name:"mutton", unit:"kg" }, { name:"fish", unit:"kg" },
  { name:"biscuits", unit:"pack" }, { name:"snacks", basket:true }, { name:"detergent", unit:"kg" },
  { name:"soap", unit:"pcs" }, { name:"shampoo", unit:"ml" }, { name:"toothpaste", unit:"pcs" },
  { name:"tissue", unit:"pack" }, { name:"diapers", unit:"pack" }, { name:"baby formula", unit:"pack" },
  { name:"water", unit:"l" }, { name:"juice", unit:"l" }, { name:"soft drinks", unit:"pack" },
  { name:"medicine", basket:true }, { name:"petrol", unit:"l" }, { name:"diesel", unit:"l" },
  { name:"gas cylinder", unit:"pcs" }, { name:"newspaper", unit:"pcs" }, { name:"stationery", basket:true },
];
const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());

// Frequency-ranked notes from history, optionally scoped to one category
function rankedHistory(expenses, categoryId, buf) {
  const freq = {};
  expenses.forEach(e => {
    if (categoryId && e.category_id !== categoryId) return;
    (e.note || "").split("\n").forEach(l => {
      const t = l.trim();
      if (!t) return;
      if (buf && !t.toLowerCase().includes(buf)) return;
      if (!freq[t]) freq[t] = { count: 0, last: e.date || "" };
      freq[t].count++;
      if ((e.date || "") > freq[t].last) freq[t].last = e.date;
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))
    .map(([t]) => t);
}

// Suggestions for the text currently being typed on the last line of a note.
// With nothing typed yet, surfaces this category's most frequently used
// notes (e.g. picking "Credit Card" shows "SBI Bank", "ICICI Bank"…) — the
// more it's used, the more these habits get learned and prioritized.
function noteSuggestions(buf, expenses, categoryId) {
  if (!buf) return rankedHistory(expenses, categoryId, "").slice(0, 4);
  if (buf.length < 2) return [];

  const fromCatHistory = rankedHistory(expenses, categoryId, buf).slice(0, 3);
  const fromAllHistory = categoryId
    ? rankedHistory(expenses, null, buf).filter(t => !fromCatHistory.includes(t)).slice(0, 2)
    : [];

  const fromLexicon = [];
  for (const item of NOTE_LEXICON) {
    if (item.name.includes(buf) || buf.includes(item.name)) {
      const cap = titleCase(item.name);
      if (item.basket) {
        fromLexicon.push(`For ${cap}`);
      } else {
        (QTY_BY_UNIT[item.unit] || [1]).slice(0, 2).forEach(q => fromLexicon.push(`${q}${item.unit} ${cap}`));
        fromLexicon.push(`For ${cap}`);
      }
    }
  }

  const out = [...fromCatHistory, ...fromAllHistory];
  for (const s of fromLexicon) {
    if (out.length >= 6) break;
    if (!out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, 6);
}

const CURRENCIES = [
  { code: "CAD", symbol: "$",  name: "Canadian Dollar" },
  { code: "USD", symbol: "$",  name: "US Dollar" },
  { code: "GBP", symbol: "£",  name: "British Pound" },
  { code: "EUR", symbol: "€",  name: "Euro" },
  { code: "INR", symbol: "₹",  name: "Indian Rupee" },
  { code: "PKR", symbol: "₨",  name: "Pakistani Rupee" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
];

// ─── Module-level currency (avoids prop-drilling fmt everywhere) ───────────────
let _currSym  = "₹";
let _currCode = "INR";
try {
  const c = JSON.parse(localStorage.getItem("fe_currency") || "null");
  if (c) { _currSym = c.symbol; _currCode = c.code; }
} catch {}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt    = n  => `${_currSym}${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const todayS = () => new Date().toISOString().slice(0, 10);
const curM   = () => new Date().toISOString().slice(0, 7);
const mLabel = m  => { const [y, mo] = m.split("-"); return `${MONTHS[+mo - 1]} ${y}`; };

// ─── Global CSS ───────────────────────────────────────────────────────────────
const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  :root {
    --p: #1E3A8A; --ps: #EFF6FF; --g: #22C55E; --am: #F59E0B; --rd: #EF4444;
    --bg: #EFF6FF; --card: #FFFFFF; --tx: #1A1A2E; --mu: #6B7280; --br: #E5E7EB;
  }
  :root[data-theme="dark"] {
    --bg: #0D1117; --card: #161B22; --tx: #E6EDF3; --mu: #8B949E; --br: #30363D; --ps: #1C2A4A;
  }
  html, body, #root { height: 100%; background: var(--bg); }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }
  #root { display: flex; justify-content: center; }
  .app { display: flex; flex-direction: column; height: 100vh; width: 100%; max-width: 430px; position: relative; background: var(--bg); overflow: hidden; }
  .scr { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .scr::-webkit-scrollbar { display: none; }

  /* Nav */
  nav { display: flex; background: var(--card); border-top: 1px solid var(--br); padding: 8px 0 20px; flex-shrink: 0; }
  .ni { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border: none; background: none; color: var(--mu); font-size: 10px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .ni.on { color: var(--p); }
  .ni svg { width: 22px; height: 22px; margin-bottom: 1px; }
  .nadd { flex: 1; display: flex; align-items: center; justify-content: center; }
  .addbtn { width: 54px; height: 54px; border-radius: 50%; background: var(--p); border: none; cursor: pointer; color: #fff; font-size: 28px; box-shadow: 0 4px 16px rgba(30,58,138,.4); margin-top: -18px; display: flex; align-items: center; justify-content: center; }
  .addbtn:active { transform: scale(.93); }

  /* Cards */
  .card { background: var(--card); border-radius: 16px; padding: 18px; margin: 0 16px 12px; box-shadow: 0 1px 8px rgba(0,0,0,.06); }
  .hero { background: linear-gradient(135deg, #1E3A8A, #3B5FBF); border-radius: 20px; margin: 0 16px 14px; padding: 22px; color: #fff; }
  .hd { padding: 18px 20px 10px; }
  .hd h1 { font-size: 24px; font-weight: 700; color: var(--tx); }
  .hd p { font-size: 13px; color: var(--mu); margin-top: 2px; }

  /* Form */
  .fi { width: 100%; padding: 15px; border: 1.5px solid var(--br); border-radius: 10px; font-size: 16px; color: var(--tx); background: var(--bg); outline: none; font-family: inherit; transition: border-color .15s; }
  .fi:focus { border-color: var(--p); }
  .fl { display: block; font-size: 11px; font-weight: 700; color: var(--mu); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 7px; }
  .fg { margin-bottom: 14px; }

  /* Buttons */
  .bp { width: 100%; padding: 17px; background: var(--p); color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity .15s; }
  .bp:disabled { opacity: .5; cursor: not-allowed; }
  .bp:active:not(:disabled) { opacity: .85; }
  .bd { width: 100%; padding: 14px; background: #FEF2F2; color: var(--rd); border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .bg { width: 100%; padding: 14px; background: none; border: 1.5px solid var(--br); border-radius: 10px; font-size: 15px; font-weight: 600; color: var(--mu); cursor: pointer; font-family: inherit; }

  /* Modal */
  .ov { position: absolute; inset: 0; background: rgba(0,0,0,.45); z-index: 200; display: flex; align-items: flex-end; }
  .mo { background: var(--card); border-radius: 24px 24px 0 0; padding: 22px 20px 36px; width: 100%; max-height: 88vh; overflow-y: auto; }
  .mo::-webkit-scrollbar { display: none; }
  .mh { width: 38px; height: 4px; background: var(--br); border-radius: 99px; margin: 0 auto 18px; }

  /* Expense row */
  .er { background: var(--card); border-radius: 10px; padding: 13px 15px; display: flex; align-items: center; gap: 11px; cursor: pointer; box-shadow: 0 1px 5px rgba(0,0,0,.05); }
  .er:active { background: var(--bg); }
  .eic { width: 42px; height: 42px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }

  /* Chips & filters */
  .chip { padding: 8px 13px; border-radius: 99px; border: 2px solid var(--br); background: var(--card); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; color: var(--tx); transition: all .15s; }
  .tabs { display: flex; gap: 6px; padding: 0 16px 12px; overflow-x: auto; }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { padding: 8px 15px; border-radius: 99px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; background: var(--card); color: var(--mu); transition: all .15s; }
  .tab.on { background: var(--p); color: #fff; }

  /* Category grid */
  .cg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .ci { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px; border-radius: 12px; border: 2px solid var(--br); cursor: pointer; background: var(--card); transition: all .15s; }
  .ci.on { border-color: var(--p); background: var(--ps); }

  /* Budget bar */
  .bb { height: 9px; background: var(--br); border-radius: 99px; overflow: hidden; }
  .bf { height: 100%; border-radius: 99px; transition: width .4s; }

  /* Avatar */
  .av { border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; flex-shrink: 0; }

  /* Month nav */
  .mnav { display: flex; align-items: center; padding: 0 20px 14px; gap: 10px; }
  .mnav button { width: 34px; height: 34px; border-radius: 50%; background: var(--card); border: 1.5px solid var(--br); font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: inherit; color: var(--tx); }
  .mnav span { flex: 1; text-align: center; font-size: 15px; font-weight: 700; color: var(--tx); }

  /* Detail row */
  .dr { display: flex; justify-content: space-between; align-items: center; padding: 13px 0; border-bottom: 1px solid var(--br); }

  /* Misc */
  .lbb { height: 6px; background: var(--br); border-radius: 99px; overflow: hidden; margin-top: 3px; }
  .lb  { height: 100%; border-radius: 99px; }
  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; gap: 12px; color: var(--mu); text-align: center; }
  .toast { position: absolute; top: 56px; left: 16px; right: 16px; background: #1A1A2E; color: #fff; padding: 13px 16px; border-radius: 10px; font-size: 14px; font-weight: 600; z-index: 999; text-align: center; animation: tsin .2s ease; }
  @keyframes tsin { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  .spin { width: 36px; height: 36px; border: 3px solid var(--ps); border-top-color: var(--p); border-radius: 50%; animation: rot .7s linear infinite; margin: 0 auto; }
  @keyframes rot { to { transform: rotate(360deg); } }

  /* Theme toggle */
  .theme-btn { background: var(--bg); border: 1.5px solid var(--br); border-radius: 99px; padding: 6px 13px; font-size: 14px; cursor: pointer; color: var(--tx); font-family: inherit; display: flex; align-items: center; gap: 6px; }

  /* Full-page screens (e.g. Add Expense) */
  .fpage { position: absolute; inset: 0; z-index: 200; background: var(--bg); display: flex; flex-direction: column; }
  .fphd { display: flex; align-items: center; gap: 14px; padding: 16px; border-bottom: 1px solid var(--br); background: var(--card); flex-shrink: 0; }
  .fphd .back { width: 36px; height: 36px; border-radius: 50%; background: var(--bg); border: 1.5px solid var(--br); font-size: 18px; cursor: pointer; color: var(--tx); display: flex; align-items: center; justify-content: center; font-family: inherit; flex-shrink: 0; }
  .fphd h2 { font-size: 18px; font-weight: 700; color: var(--tx); }
  .fpbody { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px 16px 36px; }
  .fpbody::-webkit-scrollbar { display: none; }
`;

// ─── SVG Icons (currentColor inherits from CSS) ───────────────────────────────
const IcoDash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const IcoExp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
  </svg>
);
const IcoBud = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);
const IcoAdm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M20 21a8 8 0 10-16 0"/>
  </svg>
);

// ─── Session helpers (30-day persistent login via refresh token) ──────────────
const THIRTY_DAYS = 30 * 24 * 3600;
const SESSION_KEY = "fe_session";

const getRawSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
};
const saveSession = (token, user, expires_in, refresh) => {
  const existing = getRawSession();
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token, user, refresh,
    expires_at: Date.now() / 1000 + (expires_in || 3600),
    // Preserve the original 30-day window; only stamp fresh on first login
    session_expires_at: existing?.session_expires_at || Date.now() / 1000 + THIRTY_DAYS,
  }));
};
const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ─── Login Screen ─────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  const go = async () => {
    setErr(""); setBusy(true);
    if (isNew) {
      const res = await signUp(email, pass);
      if (res.error) { setErr(res.error.message || "Error"); setBusy(false); return; }
      if (res.access_token) { onLogin(res.access_token, res.user, res.expires_in, res.refresh_token); return; }
      // No immediate token — attempt sign-in with same credentials
      const res2 = await signIn(email, pass);
      setBusy(false);
      if (res2.access_token) { onLogin(res2.access_token, res2.user, res2.expires_in, res2.refresh_token); return; }
      setErr(res2.error?.message || "Account created — please sign in.");
      setIsNew(false); return;
    }
    const res = await signIn(email, pass);
    setBusy(false);
    if (res.error) { setErr(res.error.message || "Error"); return; }
    if (res.access_token) onLogin(res.access_token, res.user, res.expires_in, res.refresh_token);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:24 }}>
      <div style={{ fontSize:60, marginBottom:10 }}>💰</div>
      <div style={{ fontSize:26, fontWeight:800, color:"var(--tx)", marginBottom:4 }}>Family Expenses</div>
      <div style={{ fontSize:13, color:"var(--mu)", marginBottom:32 }}>Track spending together · {_currCode}</div>

      <div style={{ width:"100%", background:"var(--card)", borderRadius:18, padding:22, boxShadow:"0 4px 24px rgba(30,58,138,.12)" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"var(--tx)", marginBottom:18 }}>
          {isNew ? "Create account" : "Welcome back"}
        </div>
        {err && <div style={{ background:"#FEF2F2", color:"var(--rd)", padding:"11px 13px", borderRadius:8, fontSize:13, marginBottom:12, fontWeight:500 }}>{err}</div>}
        <input className="fi" style={{ marginBottom:10 }} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="fi" style={{ marginBottom:18 }} placeholder="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} />
        <button className="bp" onClick={go} disabled={busy || !email || !pass}>
          {busy ? "Please wait…" : isNew ? "Sign up" : "Sign in"}
        </button>
        <button onClick={() => { setIsNew(v => !v); setErr(""); }}
          style={{ width:"100%", marginTop:10, background:"none", border:"none", color:"var(--p)", fontSize:13, fontWeight:600, cursor:"pointer", padding:"9px 0", fontFamily:"inherit" }}>
          {isNew ? "Already have an account? Sign in" : "No account? Sign up"}
        </button>
      </div>
      <div style={{ fontSize:11, color:"var(--mu)", marginTop:20, textAlign:"center", lineHeight:1.6 }}>
        All family members sign in here.<br />You share one live Supabase database.
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Read stored session once synchronously
  const _s = getRawSession();
  const _sessionAlive = _s && (!_s.session_expires_at || _s.session_expires_at > Date.now() / 1000);
  const _tokenFresh   = _sessionAlive && _s.expires_at > Date.now() / 1000 + 30;

  const [token,    setToken] = useState(_tokenFresh ? _s.token : null);
  const [user,     setUser]  = useState(_sessionAlive ? _s.user : null);
  // booting = we have a live session but access token is stale → need async refresh
  const [booting,  setBoot]  = useState(_sessionAlive && !_tokenFresh);
  const [darkMode, setDark]  = useState(() => localStorage.getItem("fe_dark") === "1");
  const [currency, setCurr]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("fe_currency") || "null") || CURRENCIES.find(c => c.code === "INR"); }
    catch { return CURRENCIES.find(c => c.code === "INR"); }
  });

  const [tab,    setTab]    = useState("dashboard");
  const [modal,  setModal]  = useState(null);
  const [sel,    setSel]    = useState(null);
  const [toast,  setToast]  = useState(null);
  const [month,  setMonth]  = useState(curM());
  const [expenses, setExp]  = useState([]);
  const [cats,   setCats]   = useState([]);
  const [members, setMems]  = useState([]);
  const [budgets, setBuds]  = useState([]);
  const [loading, setLoad]  = useState(false);

  // Silent token refresh on mount when access token has expired but session is still within 30 days
  useEffect(() => {
    if (!booting) return;
    const s = getRawSession();
    if (!s?.refresh) { clearSession(); setBoot(false); return; }
    refreshAccess(s.refresh).then(res => {
      if (res.access_token) {
        saveSession(res.access_token, res.user || s.user, res.expires_in, res.refresh_token || s.refresh);
        setToken(res.access_token);
        setUser(res.user || s.user);
      } else {
        clearSession(); // refresh token itself has expired — force re-login
      }
      setBoot(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply dark mode to <html> so CSS vars cascade to body/root backgrounds
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Keep module-level currency in sync
  useEffect(() => {
    _currSym  = currency.symbol;
    _currCode = currency.code;
  }, [currency]);

  const toggleDark = () => {
    setDark(d => { localStorage.setItem("fe_dark", d ? "" : "1"); return !d; });
  };
  const handleCurrency = c => {
    _currSym = c.symbol; _currCode = c.code;
    setCurr(c); localStorage.setItem("fe_currency", JSON.stringify(c));
  };
  const handleLogin = (t, u, expires_in, refresh) => {
    saveSession(t, u, expires_in, refresh); setToken(t); setUser(u);
  };
  const handleOut = () => {
    clearSession(); setToken(null); setUser(null);
  };

  const pop = msg => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const T = token;

  const load = useCallback(async () => {
    if (!T) return;
    setLoad(true);
    try {
      const [c, m, e, b] = await Promise.all([
        api.get("categories?order=name", T),
        api.get("members?order=name", T),
        api.get("expenses?order=date.desc,created_at.desc&limit=300", T),
        api.get("budgets?order=created_at", T),
      ]);
      if (Array.isArray(c)) setCats(c);
      if (Array.isArray(m)) setMems(m);
      if (Array.isArray(e)) setExp(e);
      if (Array.isArray(b)) setBuds(b);
    } catch { pop("⚠️ Error loading data"); }
    setLoad(false);
  }, [T]);

  useEffect(() => { if (T) load(); }, [T, load]);

  const mExp  = useMemo(() => expenses.filter(e => e.date?.startsWith(month)), [expenses, month]);
  const total = useMemo(() => mExp.reduce((s, e) => s + Number(e.amount), 0), [mExp]);
  const catS  = useMemo(() => { const m = {}; mExp.forEach(e => { m[e.category_id] = (m[e.category_id] || 0) + Number(e.amount); }); return m; }, [mExp]);
  const memS  = useMemo(() => { const m = {}; mExp.forEach(e => { m[e.paid_by]     = (m[e.paid_by]     || 0) + Number(e.amount); }); return m; }, [mExp]);

  const getCat = id => cats.find(c => c.id === id)    || { name:"Other",   icon:"📌", color:"#607D8B" };
  const getMem = id => members.find(m => m.id === id) || { name:"Unknown", color:"#999", initials:"?" };

  const prevM = () => { const [y,m]=month.split("-").map(Number),d=new Date(y,m-2); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const nextM = () => { const [y,m]=month.split("-").map(Number),d=new Date(y,m);   setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addExp = async exp => {
    const res = await api.post("expenses", exp, T);
    if (Array.isArray(res) && res[0]) setExp(p => [res[0], ...p]);
    pop("✅ Expense saved");
  };
  const delExp = async id => {
    await api.del(`expenses?id=eq.${id}`, T);
    setExp(p => p.filter(e => e.id !== id));
    setModal(null); setSel(null); pop("🗑️ Deleted");
  };
  const addMem = async m => {
    const res = await api.post("members", m, T);
    if (Array.isArray(res) && res[0]) setMems(p => [...p, res[0]]);
    setModal(null); pop("👤 Member added");
  };
  const updCat = async c => {
    await api.patch(`categories?id=eq.${c.id}`, { name:c.name, icon:c.icon, color:c.color }, T);
    setCats(p => p.map(x => x.id === c.id ? c : x));
    setModal(null); pop("✏️ Updated");
  };
  const delCat = async id => {
    await api.del(`categories?id=eq.${id}`, T);
    setCats(p => p.filter(c => c.id !== id));
    setModal(null); pop("🗑️ Deleted");
  };
  const addCat = async c => {
    const res = await api.post("categories", c, T);
    if (Array.isArray(res) && res[0]) setCats(p => [...p, res[0]]);
    setModal(null); pop("✅ Category added");
  };
  const saveBud = async b => {
    const res = await api.upsert("budgets", { category_id:b.category_id, month:b.month, limit_amount:b.limit_amount }, T);
    if (Array.isArray(res) && res[0]) setBuds(p => [...p.filter(x => !(x.category_id === b.category_id && x.month === b.month)), res[0]]);
    setModal(null); pop("💰 Budget saved");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (booting) return (
    <>
      <style>{STYLES}</style>
      <div className="app"><div className="center" style={{ height:"100%" }}><div className="spin" /></div></div>
    </>
  );

  if (!T) return (
    <>
      <style>{STYLES}</style>
      <div className="app"><Login onLogin={handleLogin} /></div>
    </>
  );

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        {toast && <div className="toast">{toast}</div>}

        {/* Modals */}
        {modal === "add"  && <ModalAdd  cats={cats} members={members} expenses={expenses} onSave={async e => { await addExp(e); setModal(null); }} onClose={() => setModal(null)} />}
        {modal === "det"  && sel && <ModalDet  exp={sel} getCat={getCat} getMem={getMem} onDel={delExp} onClose={() => { setModal(null); setSel(null); }} />}
        {modal === "addM" && <ModalMem  onSave={addMem} onClose={() => setModal(null)} />}
        {modal === "eC"   && sel && <ModalCat  cat={sel} onSave={updCat} onDel={delCat} onClose={() => { setModal(null); setSel(null); }} />}
        {modal === "newC" && <ModalCat  cat={{ name:"", icon:"📌", color:PALETTE[0] }} onSave={addCat} onClose={() => setModal(null)} isNew />}
        {modal === "eB"   && sel && <ModalBud  bud={sel} cats={cats} month={month} onSave={saveBud} onClose={() => { setModal(null); setSel(null); }} />}

        {/* Screen */}
        <div className="scr">
          {loading && <div className="center"><div className="spin" /><span style={{ fontSize:13, color:"var(--mu)" }}>Loading…</span></div>}
          {!loading && tab === "dashboard" && <ScreenDash mExp={mExp} total={total} cats={cats} members={members} buds={budgets.filter(b => b.month === month)} catS={catS} memS={memS} getCat={getCat} getMem={getMem} month={month} prevM={prevM} nextM={nextM} onE={e => { setSel(e); setModal("det"); }} onAll={() => setTab("expenses")} onRefresh={load} darkMode={darkMode} toggleDark={toggleDark} />}
          {!loading && tab === "expenses"  && <ScreenExp  expenses={expenses} cats={cats} getCat={getCat} getMem={getMem} onE={e => { setSel(e); setModal("det"); }} />}
          {!loading && tab === "budgets"   && <ScreenBud  buds={budgets.filter(b => b.month === month)} cats={cats} catS={catS} getCat={getCat} month={month} prevM={prevM} nextM={nextM} onEdit={b => { setSel(b); setModal("eB"); }} onAdd={() => { setSel({ category_id: cats[0]?.id, month, limit_amount: 200 }); setModal("eB"); }} />}
          {!loading && tab === "admin"     && <ScreenAdm  cats={cats} members={members} expenses={expenses} budgets={budgets} getCat={getCat} getMem={getMem} onEC={c => { setSel(c); setModal("eC"); }} onNewCat={() => setModal("newC")} onAM={() => setModal("addM")} onOut={handleOut} user={user} darkMode={darkMode} toggleDark={toggleDark} currency={currency} onCurrency={handleCurrency} />}
        </div>

        {/* Bottom Nav */}
        <nav>
          {[{ id:"dashboard", lbl:"Dashboard", Ico:IcoDash }, { id:"expenses", lbl:"Expenses", Ico:IcoExp }].map(t => (
            <button key={t.id} className={`ni${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
              <t.Ico />
              {t.lbl}
            </button>
          ))}
          <div className="nadd">
            <button className="addbtn" onClick={() => setModal("add")}>＋</button>
          </div>
          {[{ id:"budgets", lbl:"Budgets", Ico:IcoBud }, { id:"admin", lbl:"Manage", Ico:IcoAdm }].map(t => (
            <button key={t.id} className={`ni${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
              <t.Ico />
              {t.lbl}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function ScreenDash({ mExp, total, cats, members, buds, catS, memS, getCat, getMem, month, prevM, nextM, onE, onAll, onRefresh, darkMode, toggleDark }) {
  const top  = useMemo(() => Object.entries(catS).map(([id, a]) => ({ ...getCat(id), amt: a })).sort((a, b) => b.amt - a.amt).slice(0, 5), [catS]);
  const maxC = top[0]?.amt || 1;
  const wk   = [0,1,2,3].map(i => { const s = i*7+1, e = s+6; return mExp.filter(x => { const d = parseInt(x.date?.slice(8) || 0); return d >= s && d <= e; }).reduce((s, x) => s + Number(x.amount), 0); });
  const maxW = Math.max(...wk, 1);
  const alerts = buds.filter(b => (catS[b.category_id] || 0) / b.limit_amount > 0.8);

  return (
    <div>
      <div className="hd">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, color:"var(--mu)", fontWeight:500, marginBottom:2 }}>Family Expenses</div>
            <h1>Overview</h1>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={toggleDark} className="theme-btn">{darkMode ? "☀️" : "🌙"}</button>
            <button onClick={onRefresh} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"var(--p)" }}>↻</button>
          </div>
        </div>
      </div>

      <div className="mnav">
        <button onClick={prevM}>‹</button>
        <span>{mLabel(month)}</span>
        <button onClick={nextM}>›</button>
      </div>

      {/* Hero */}
      <div className="hero">
        <div style={{ fontSize:12, fontWeight:500, opacity:.8, textTransform:"uppercase", letterSpacing:.5 }}>Total spent</div>
        <div style={{ fontSize:38, fontWeight:800, letterSpacing:-1, margin:"6px 0 2px" }}>{fmt(total)}</div>
        <div style={{ fontSize:13, opacity:.75 }}>{mExp.length} transactions · {_currCode}</div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
          {[{ v: members.length, l:"Members" }, { v: fmt(total / Math.max(mExp.length, 1)), l:"Avg/expense" }, { v: buds.length, l:"Budgets" }].map((s, i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:17, fontWeight:700 }}>{s.v}</div>
              <div style={{ fontSize:11, opacity:.75, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly bars */}
      <div className="card">
        <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>Weekly spending</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:110, padding:"0 2px" }}>
          {wk.map((v, i) => (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5, height:"100%", justifyContent:"flex-end" }}>
              <div style={{ fontSize:9, color:"var(--mu)", fontWeight:600 }}>{v > 0 ? fmt(v) : ""}</div>
              <div style={{ width:"100%", borderRadius:"5px 5px 0 0", minHeight:4, background:"var(--p)", opacity: v === Math.max(...wk) && v > 0 ? 1 : .35, height: Math.max((v / maxW) * 85, v > 0 ? 5 : 0) + "px" }} />
              <div style={{ fontSize:10, color:"var(--mu)", fontWeight:500 }}>W{i + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      {top.length > 0 && (
        <div className="card">
          <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>By category</div>
          {top.map(c => (
            <div key={c.id} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <span style={{ fontSize:17 }}>{c.icon}</span>
                <span style={{ flex:1, fontSize:14, fontWeight:600, color:"var(--tx)" }}>{c.name}</span>
                <span style={{ fontSize:14, fontWeight:700 }}>{fmt(c.amt)}</span>
                <span style={{ fontSize:11, color:"var(--mu)" }}>{Math.round(c.amt / total * 100)}%</span>
              </div>
              <div className="lbb"><div className="lb" style={{ width: (c.amt / maxC * 100) + "%", background: c.color }} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Who paid */}
      {members.filter(m => memS[m.id]).length > 0 && (
        <>
          <div style={{ padding:"6px 20px 10px", fontSize:15, fontWeight:700, color:"var(--tx)" }}>Who paid</div>
          <div style={{ padding:"0 16px 12px", display:"flex", flexDirection:"column", gap:8 }}>
            {members.filter(m => memS[m.id]).map(m => {
              const a = memS[m.id] || 0;
              return (
                <div key={m.id} style={{ background:"var(--card)", borderRadius:12, padding:"13px 15px", display:"flex", alignItems:"center", gap:11, boxShadow:"0 1px 5px rgba(0,0,0,.05)" }}>
                  <div className="av" style={{ width:40, height:40, fontSize:13, background:m.color }}>{m.initials}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:"var(--tx)" }}>{m.name}</div>
                    <div style={{ fontSize:12, color:"var(--mu)" }}>{Math.round(a / total * 100)}% of total</div>
                  </div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--tx)" }}>{fmt(a)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Budget alerts */}
      {alerts.length > 0 && (
        <>
          <div style={{ padding:"6px 20px 10px", fontSize:15, fontWeight:700, color:"var(--tx)" }}>⚠️ Budget alerts</div>
          <div style={{ padding:"0 16px 12px", display:"flex", flexDirection:"column", gap:8 }}>
            {alerts.map(b => {
              const sp = catS[b.category_id] || 0, ov = sp > b.limit_amount, cat = getCat(b.category_id);
              return (
                <div key={b.id} style={{ background: ov ? "#FEF2F2" : "#FFFBEB", borderRadius:12, padding:"12px 15px", border: `1px solid ${ov ? "#FECACA" : "#FDE68A"}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:17 }}>{cat.icon}</span>
                    <span style={{ flex:1, fontSize:14, fontWeight:600, color:"var(--tx)" }}>{cat.name}</span>
                    <span style={{ fontSize:13, fontWeight:700, color: ov ? "var(--rd)" : "var(--am)" }}>{ov ? `Over ${fmt(sp - b.limit_amount)}` : `${fmt(b.limit_amount - sp)} left`}</span>
                  </div>
                  <div className="bb"><div className="bf" style={{ width: Math.min(sp / b.limit_amount * 100, 100) + "%", background: ov ? "var(--rd)" : "var(--am)" }} /></div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recent */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 20px 10px" }}>
        <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)" }}>Recent</div>
        <button style={{ background:"none", border:"none", color:"var(--p)", fontSize:13, fontWeight:600, cursor:"pointer" }} onClick={onAll}>See all</button>
      </div>
      {mExp.length === 0
        ? <div className="center"><span style={{ fontSize:44 }}>🧾</span><div style={{ fontSize:17, fontWeight:700, color:"var(--tx)" }}>No expenses yet</div><div style={{ fontSize:13 }}>Tap + to add your first one</div></div>
        : <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:8, paddingBottom:24 }}>{mExp.slice(0, 6).map(e => <ERow key={e.id} e={e} cat={getCat(e.category_id)} mem={getMem(e.paid_by)} onClick={() => onE(e)} />)}</div>
      }
    </div>
  );
}

// ─── Expenses Screen ──────────────────────────────────────────────────────────
function ScreenExp({ expenses, cats, getCat, getMem, onE }) {
  const [filt, setFilt] = useState("all");
  const [q,    setQ]    = useState("");

  const list = useMemo(() => {
    let r = [...expenses];
    if (filt !== "all") r = r.filter(e => e.category_id === filt);
    if (q) r = r.filter(e => (e.note || "").toLowerCase().includes(q.toLowerCase()));
    return r;
  }, [expenses, filt, q]);

  const grp = useMemo(() => {
    const g = {};
    list.forEach(e => { if (!g[e.date]) g[e.date] = []; g[e.date].push(e); });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

  const fd = d => new Date(d + "T00:00:00").toLocaleDateString("en-CA", { weekday:"short", month:"short", day:"numeric" });

  return (
    <div>
      <div className="hd"><h1>Expenses</h1><p>{expenses.length} total</p></div>
      <div style={{ padding:"0 16px 11px" }}>
        <input className="fi" placeholder="🔍  Search…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="tabs">
        <button className="chip" style={filt === "all" ? { background:"var(--p)", color:"#fff", borderColor:"var(--p)" } : {}} onClick={() => setFilt("all")}>All</button>
        {cats.map(c => (
          <button key={c.id} className="chip" style={filt === c.id ? { background:c.color, color:"#fff", borderColor:c.color } : {}} onClick={() => setFilt(filt === c.id ? "all" : c.id)}>{c.icon} {c.name}</button>
        ))}
      </div>
      {grp.length === 0
        ? <div className="center"><span style={{ fontSize:40 }}>🔍</span><div style={{ fontSize:16, fontWeight:700, color:"var(--tx)" }}>No expenses found</div></div>
        : grp.map(([date, items]) => (
          <div key={date}>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 20px 5px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--mu)" }}>{fd(date)}</div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--tx)" }}>{fmt(items.reduce((s, e) => s + Number(e.amount), 0))}</div>
            </div>
            <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:7, marginBottom:6 }}>
              {items.map(e => <ERow key={e.id} e={e} cat={getCat(e.category_id)} mem={getMem(e.paid_by)} onClick={() => onE(e)} />)}
            </div>
          </div>
        ))
      }
      <div style={{ height:24 }} />
    </div>
  );
}

// ─── Budgets Screen ───────────────────────────────────────────────────────────
function ScreenBud({ buds, cats, catS, getCat, month, prevM, nextM, onEdit, onAdd }) {
  const tb = buds.reduce((s, b) => s + Number(b.limit_amount), 0);
  const ts = buds.reduce((s, b) => s + (catS[b.category_id] || 0), 0);

  return (
    <div>
      <div className="hd"><h1>Budgets</h1><p>Monthly limits per category</p></div>
      <div className="mnav"><button onClick={prevM}>‹</button><span>{mLabel(month)}</span><button onClick={nextM}>›</button></div>

      {tb > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            <div><div style={{ fontSize:12, color:"var(--mu)" }}>Total budget</div><div style={{ fontSize:21, fontWeight:800, color:"var(--tx)" }}>{fmt(tb)}</div></div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:12, color:"var(--mu)" }}>Spent</div><div style={{ fontSize:21, fontWeight:800, color: ts > tb ? "var(--rd)" : "var(--g)" }}>{fmt(ts)}</div></div>
          </div>
          <div className="bb"><div className="bf" style={{ width: Math.min(ts / tb * 100, 100) + "%", background: ts > tb ? "var(--rd)" : "var(--p)" }} /></div>
          <div style={{ fontSize:12, color:"var(--mu)", marginTop:6 }}>{fmt(Math.max(tb - ts, 0))} remaining this month</div>
        </div>
      )}

      {buds.length === 0
        ? <div className="center"><span style={{ fontSize:40 }}>💰</span><div style={{ fontSize:16, fontWeight:700, color:"var(--tx)" }}>No budgets set yet</div></div>
        : (
          <div className="card">
            {buds.map(b => {
              const cat = getCat(b.category_id), sp = catS[b.category_id] || 0;
              const pct = Math.min(sp / b.limit_amount * 100, 100), ov = sp > b.limit_amount, wn = pct > 80 && !ov;
              return (
                <div key={b.id} style={{ marginBottom:18, cursor:"pointer" }} onClick={() => onEdit(b)}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:15, fontWeight:600, color:"var(--tx)" }}><span style={{ fontSize:19 }}>{cat.icon}</span>{cat.name}</div>
                    <div style={{ fontSize:13, color:"var(--mu)" }}>{fmt(sp)} / {fmt(b.limit_amount)}</div>
                  </div>
                  <div className="bb"><div className="bf" style={{ width: pct + "%", background: ov ? "var(--rd)" : wn ? "var(--am)" : cat.color }} /></div>
                  <div style={{ fontSize:11, fontWeight:600, marginTop:4, color: ov ? "var(--rd)" : wn ? "var(--am)" : "var(--g)" }}>
                    {ov ? `⚠️ Over by ${fmt(sp - b.limit_amount)}` : wn ? `⚡ ${fmt(b.limit_amount - sp)} left` : `✓ ${fmt(b.limit_amount - sp)} remaining`}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
      <div style={{ padding:"8px 16px 24px" }}><button className="bp" onClick={onAdd}>+ Add budget</button></div>
    </div>
  );
}

// ─── Admin Screen ─────────────────────────────────────────────────────────────
function ScreenAdm({ cats, members, expenses, budgets, getCat, getMem, onEC, onNewCat, onAM, onOut, user, darkMode, toggleDark, currency, onCurrency }) {
  const [t, setT] = useState("members");
  const isAdmin = user?.email === ADMIN_EMAIL;
  const mt = members.map(m => ({ ...m, total: expenses.filter(e => e.paid_by === m.id).reduce((s, e) => s + Number(e.amount), 0), cnt: expenses.filter(e => e.paid_by === m.id).length }));
  const mx = Math.max(...mt.map(m => m.total), 1);

  return (
    <div>
      <div className="hd">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><h1>Manage</h1><p>{user?.email}</p></div>
          <button onClick={onOut} style={{ background:"#FEF2F2", border:"none", color:"var(--rd)", borderRadius:8, padding:"8px 13px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
        </div>
      </div>
      <div className="tabs">
        {["members","categories","reports","settings"].map(x => (
          <button key={x} className={`tab${t === x ? " on" : ""}`} onClick={() => setT(x)}>{x[0].toUpperCase() + x.slice(1)}</button>
        ))}
      </div>

      {t === "members" && (
        <>
          <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
            {mt.length === 0
              ? <div className="center"><span style={{ fontSize:36 }}>👤</span><div style={{ fontSize:15, fontWeight:700, color:"var(--tx)" }}>No members yet</div></div>
              : mt.map(m => (
                <div key={m.id} style={{ background:"var(--card)", borderRadius:12, padding:16, boxShadow:"0 1px 5px rgba(0,0,0,.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:11 }}>
                    <div className="av" style={{ width:50, height:50, fontSize:15, background:m.color }}>{m.initials}</div>
                    <div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:700, color:"var(--tx)" }}>{m.name}</div><div style={{ fontSize:12, color:"var(--mu)" }}>{m.cnt} expenses</div></div>
                    <div style={{ fontSize:19, fontWeight:800, color:"var(--tx)" }}>{fmt(m.total)}</div>
                  </div>
                  <div className="bb"><div className="bf" style={{ width: (m.total / mx * 100) + "%", background: m.color }} /></div>
                </div>
              ))
            }
          </div>
          <div style={{ padding:"0 16px 24px" }}><button className="bp" onClick={onAM}>+ Add family member</button></div>
        </>
      )}

      {t === "categories" && (
        <>
          {!isAdmin && <div style={{ margin:"0 16px 12px", background:"var(--bg)", border:"1.5px solid var(--br)", borderRadius:10, padding:11, fontSize:12, color:"var(--mu)" }}>🔒 Only the account owner can add or edit categories.</div>}
          <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {cats.map(c => {
              const tot = expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0);
              const cnt = expenses.filter(e => e.category_id === c.id).length;
              return (
                <div key={c.id} style={{ background:"var(--card)", borderRadius:12, padding:"13px 15px", display:"flex", alignItems:"center", gap:11, cursor: isAdmin ? "pointer" : "default", boxShadow:"0 1px 5px rgba(0,0,0,.05)" }} onClick={() => isAdmin && onEC(c)}>
                  <div style={{ width:42, height:42, borderRadius:11, background:c.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:21 }}>{c.icon}</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:600, color:"var(--tx)" }}>{c.name}</div><div style={{ fontSize:12, color:"var(--mu)" }}>{cnt} expenses · {fmt(tot)}</div></div>
                  {isAdmin && <div style={{ fontSize:16, color:"var(--mu)" }}>›</div>}
                </div>
              );
            })}
          </div>
          {isAdmin && <div style={{ padding:"0 16px 24px" }}><button className="bp" onClick={onNewCat}>+ Add category</button></div>}
        </>
      )}

      {t === "reports" && (
        <div style={{ padding:"0 16px" }}>
          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>All-time summary</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
              {[
                { icon:"💳", val: fmt(expenses.reduce((s,e) => s + Number(e.amount), 0)), lbl:"Total spent" },
                { icon:"📊", val: expenses.length, lbl:"Transactions" },
                { icon:"📅", val: fmt(expenses.reduce((s,e) => s + Number(e.amount), 0) / Math.max(expenses.length,1)), lbl:"Avg/expense" },
                { icon:"👥", val: members.length, lbl:"Family members" },
              ].map((s, i) => (
                <div key={i} style={{ background:"var(--bg)", borderRadius:10, padding:13 }}>
                  <div style={{ fontSize:22, marginBottom:5 }}>{s.icon}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:"var(--tx)" }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"var(--mu)", marginTop:2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ marginBottom:24 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>Top categories (all time)</div>
            {(() => {
              const m = {}; expenses.forEach(e => { m[e.category_id] = (m[e.category_id] || 0) + Number(e.amount); });
              const tot = expenses.reduce((s, e) => s + Number(e.amount), 0) || 1;
              return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, amt]) => {
                const c = getCat(id);
                return (
                  <div key={id} style={{ marginBottom:13 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:17 }}>{c.icon}</span>
                      <span style={{ flex:1, fontSize:14, fontWeight:600, color:"var(--tx)" }}>{c.name}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:"var(--tx)" }}>{fmt(amt)}</span>
                      <span style={{ fontSize:11, color:"var(--mu)" }}>{Math.round(amt / tot * 100)}%</span>
                    </div>
                    <div className="lbb"><div className="lb" style={{ width: (amt / tot * 100) + "%", background: c.color }} /></div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {t === "settings" && (
        <div style={{ padding:"0 16px 24px", display:"flex", flexDirection:"column", gap:12 }}>
          <div className="card" style={{ margin:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>Appearance</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:"var(--tx)" }}>{darkMode ? "Dark mode" : "Light mode"}</div>
                <div style={{ fontSize:12, color:"var(--mu)", marginTop:2 }}>Switch colour theme</div>
              </div>
              <button onClick={toggleDark} style={{ background: darkMode ? "var(--p)" : "var(--bg)", border:"1.5px solid var(--br)", borderRadius:99, padding:"8px 18px", fontSize:14, cursor:"pointer", color: darkMode ? "#fff" : "var(--tx)", fontFamily:"inherit", fontWeight:600 }}>
                {darkMode ? "☀️ Light" : "🌙 Dark"}
              </button>
            </div>
          </div>

          <div className="card" style={{ margin:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>Currency</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {CURRENCIES.map(c => (
                <div key={c.code} onClick={() => onCurrency(c)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 13px", borderRadius:10, border:`1.5px solid ${currency.code === c.code ? "var(--p)" : "var(--br)"}`, background: currency.code === c.code ? "var(--ps)" : "var(--bg)", cursor:"pointer" }}>
                  <div>
                    <span style={{ fontSize:14, fontWeight:600, color:"var(--tx)" }}>{c.symbol} — {c.code}</span>
                    <span style={{ fontSize:12, color:"var(--mu)", marginLeft:8 }}>{c.name}</span>
                  </div>
                  {currency.code === c.code && <span style={{ color:"var(--p)", fontWeight:700 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared: Expense Row ──────────────────────────────────────────────────────
function ERow({ e, cat, mem, onClick }) {
  return (
    <div className="er" onClick={onClick}>
      <div className="eic" style={{ background: cat.color + "22" }}>{cat.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:600, color:"var(--tx)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.note || cat.name}</div>
        <div style={{ fontSize:12, color:"var(--mu)", marginTop:2 }}>{cat.name} · {e.date}</div>
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)" }}>{fmt(e.amount)}</div>
        <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end", marginTop:2 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background: mem?.color || "#999" }} />
          <span style={{ fontSize:11, color:"var(--mu)" }}>{mem?.name || "?"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Expense ───────────────────────────────────────────────────────
function ModalAdd({ cats, members, expenses, onSave, onClose }) {
  const [amt,  setAmt]  = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayS());
  const [cid,  setCid]  = useState(cats[0]?.id || "");
  const [pid,  setPid]  = useState(members[0]?.id || "");
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => {
    const lines = note.split("\n");
    const buf = lines[lines.length - 1].trim().toLowerCase();
    return noteSuggestions(buf, expenses, cid);
  }, [note, expenses, cid]);

  const pickSuggestion = s => {
    const lines = note.split("\n");
    lines[lines.length - 1] = s;
    setNote(lines.join("\n") + "\n");
  };

  const go = async () => {
    if (!amt || isNaN(+amt)) return;
    setBusy(true);
    await onSave({ amount: +amt, note: note.trim(), date, category_id: cid, paid_by: pid, tags: [] });
    setBusy(false);
  };

  return (
    <div className="fpage">
      <div className="fphd">
        <button className="back" onClick={onClose}>←</button>
        <h2>Add expense</h2>
      </div>
      <div className="fpbody">
        <div style={{ textAlign:"center", background:"var(--card)", borderRadius:14, padding:"10px 16px", marginBottom:18 }}>
          <div style={{ fontSize:11, color:"var(--mu)", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 }}>Amount ({_currCode})</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:30, fontWeight:800, color:"var(--mu)" }}>{_currSym}</span>
            <input style={{ width:170, fontSize:30, fontWeight:800, color:"var(--tx)", border:"none", background:"none", outline:"none", textAlign:"center", fontFamily:"inherit" }} type="number" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} autoFocus />
          </div>
        </div>

        {cats.length > 0 && (
          <div className="fg">
            <label className="fl">Category</label>
            <div className="cg">
              {cats.map(c => (
                <div key={c.id} className={`ci${cid === c.id ? " on" : ""}`} onClick={() => setCid(c.id)}>
                  <div style={{ fontSize:26 }}>{c.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--mu)", textAlign:"center", lineHeight:1.2 }}>{c.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {members.length > 0 && (
          <div className="fg">
            <label className="fl">Paid by</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {members.map(m => (
                <button key={m.id} className="chip" style={pid === m.id ? { background:m.color, color:"#fff", borderColor:m.color } : {}} onClick={() => setPid(m.id)}>{m.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="fg">
          <label className="fl">Note</label>
          <textarea className="fi" rows={3} style={{ resize:"vertical", lineHeight:1.5, fontFamily:"inherit" }} placeholder="Type an item, e.g. 'milk' — we'll suggest a clean entry" value={note} onChange={e => setNote(e.target.value)} />
          {suggestions.length > 0 && (
            <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginTop:9 }}>
              {suggestions.map(s => (
                <button key={s} type="button" className="chip" style={{ background:"var(--ps)", borderColor:"var(--p)", color:"var(--p)" }} onClick={() => pickSuggestion(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>

        {members.length === 0 && <div style={{ background:"#FFFBEB", borderRadius:8, padding:11, fontSize:13, color:"var(--am)", marginBottom:14 }}>⚠️ Add a family member first in Manage → Members</div>}

        <button className="bp" onClick={go} disabled={!amt || busy || members.length === 0}>{busy ? "Saving…" : "Save expense"}</button>
      </div>
    </div>
  );
}

// ─── Modal: Expense Detail ────────────────────────────────────────────────────
function ModalDet({ exp, getCat, getMem, onDel, onClose }) {
  const cat = getCat(exp.category_id);
  const mem = getMem(exp.paid_by);
  return (
    <div className="ov" onClick={onClose}>
      <div className="mo" onClick={e => e.stopPropagation()}>
        <div className="mh" />
        <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:18 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>{cat.icon}</div>
          <div>
            <div style={{ fontSize:12, color:"var(--mu)", fontWeight:500 }}>{cat.name}</div>
            <div style={{ fontSize:26, fontWeight:800, color:"var(--tx)" }}>{fmt(exp.amount)}</div>
          </div>
        </div>
        {exp.note && (
          <div className="dr" style={{ alignItems:"flex-start" }}>
            <span style={{ fontSize:13, color:"var(--mu)", fontWeight:500, flexShrink:0, marginTop:2 }}>Note</span>
            <span style={{ fontSize:14, color:"var(--tx)", fontWeight:600, textAlign:"right", whiteSpace:"pre-line", marginLeft:12 }}>{exp.note}</span>
          </div>
        )}
        {[
          { l:"Date",     v: new Date(exp.date + "T00:00:00").toLocaleDateString("en-CA", { weekday:"long", month:"long", day:"numeric", year:"numeric" }) },
          { l:"Paid by",  v: mem?.name || "Unknown" },
          { l:"Category", v: `${cat.icon} ${cat.name}` },
        ].map(r => (
          <div key={r.l} className="dr">
            <span style={{ fontSize:13, color:"var(--mu)", fontWeight:500 }}>{r.l}</span>
            <span style={{ fontSize:14, color:"var(--tx)", fontWeight:600, textAlign:"right" }}>{r.v}</span>
          </div>
        ))}
        <div style={{ height:22 }} />
        <button className="bd" onClick={() => onDel(exp.id)}>🗑️  Delete expense</button>
        <div style={{ height:9 }} /><button className="bg" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ─── Modal: Add Member ────────────────────────────────────────────────────────
function ModalMem({ onSave, onClose }) {
  const [name,  setName]  = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const ini = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="ov" onClick={onClose}>
      <div className="mo" onClick={e => e.stopPropagation()}>
        <div className="mh" />
        <div style={{ fontSize:20, fontWeight:700, color:"var(--tx)", marginBottom:18 }}>Add family member</div>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:18 }}>
          <div className="av" style={{ width:60, height:60, fontSize:18, background:color }}>{ini}</div>
        </div>
        <div className="fg"><label className="fl">Name</label><input className="fi" placeholder="First name" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="fg">
          <label className="fl">Colour</label>
          <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
            {PALETTE.map(c => <div key={c} onClick={() => setColor(c)} style={{ width:38, height:38, borderRadius:"50%", background:c, cursor:"pointer", border: color === c ? "3px solid var(--tx)" : "3px solid transparent" }} />)}
          </div>
        </div>
        <button className="bp" onClick={() => { if (name) onSave({ name, color, initials: ini === "?" ? name.slice(0, 2).toUpperCase() : ini }); }} disabled={!name}>Add member</button>
        <div style={{ height:9 }} /><button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Modal: Edit / Add Category ───────────────────────────────────────────────
function ModalCat({ cat, onSave, onDel, onClose, isNew }) {
  const [name,  setName]  = useState(cat.name);
  const [icon,  setIcon]  = useState(cat.icon);
  const [color, setColor] = useState(cat.color);
  const [iconQ, setIconQ] = useState("");

  const iconResults = useMemo(() => {
    if (!iconQ.trim()) return EMOJI_LIB;
    const q = iconQ.trim().toLowerCase();
    return EMOJI_LIB.filter(x => x.k.includes(q));
  }, [iconQ]);

  return (
    <div className="ov" onClick={onClose}>
      <div className="mo" onClick={e => e.stopPropagation()}>
        <div className="mh" />
        <div style={{ fontSize:20, fontWeight:700, color:"var(--tx)", marginBottom:16 }}>{isNew ? "Add category" : "Edit category"}</div>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30 }}>{icon || "📌"}</div>
        </div>
        <div className="fg"><label className="fl">Name</label><input className="fi" value={name} placeholder="Category name" onChange={e => setName(e.target.value)} /></div>
        <div className="fg">
          <label className="fl">Icon</label>
          <input className="fi" style={{ marginBottom:10 }} placeholder="🔍  Search icons… (e.g. food, travel, gym)" value={iconQ} onChange={e => setIconQ(e.target.value)} />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", maxHeight:220, overflowY:"auto" }}>
            {iconResults.length === 0
              ? <div style={{ fontSize:13, color:"var(--mu)", padding:"8px 2px" }}>No icons match "{iconQ}"</div>
              : iconResults.map(({ e }) => <div key={e} onClick={() => setIcon(e)} style={{ width:46, height:46, border: icon === e ? "2.5px solid var(--p)" : "1.5px solid var(--br)", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, cursor:"pointer", background: icon === e ? "var(--ps)" : "var(--bg)", flexShrink:0 }}>{e}</div>)
            }
          </div>
        </div>
        <div className="fg">
          <label className="fl">Colour</label>
          <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
            {[...PALETTE, "#4CAF50","#FF9800","#9C27B0","#00BCD4","#607D8B"].map(c => (
              <div key={c} onClick={() => setColor(c)} style={{ width:38, height:38, borderRadius:"50%", background:c, cursor:"pointer", border: color === c ? "3.5px solid var(--tx)" : "3px solid transparent" }} />
            ))}
          </div>
        </div>
        <button className="bp" disabled={!name} onClick={() => { if (name) onSave({ ...cat, name, icon: icon || "📌", color }); }}>{isNew ? "Add category" : "Save changes"}</button>
        <div style={{ height:9 }} />
        {!isNew && <><button className="bd" onClick={() => onDel(cat.id)}>Delete category</button><div style={{ height:9 }} /></>}
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Modal: Edit Budget ───────────────────────────────────────────────────────
function ModalBud({ bud, cats, month, onSave, onClose }) {
  const [cid, setCid] = useState(bud.category_id || cats[0]?.id);
  const [lim, setLim] = useState(String(bud.limit_amount || ""));

  return (
    <div className="ov" onClick={onClose}>
      <div className="mo" onClick={e => e.stopPropagation()}>
        <div className="mh" />
        <div style={{ fontSize:20, fontWeight:700, color:"var(--tx)", marginBottom:18 }}>{bud.limit_amount ? "Edit budget" : "New budget"}</div>
        <div className="fg">
          <label className="fl">Category</label>
          <div className="cg">
            {cats.map(c => (
              <div key={c.id} className={`ci${cid === c.id ? " on" : ""}`} onClick={() => setCid(c.id)}>
                <div style={{ fontSize:26 }}>{c.icon}</div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--mu)", textAlign:"center", lineHeight:1.2 }}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="fg">
          <label className="fl">Monthly limit ({_currCode})</label>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:22, fontWeight:700, color:"var(--mu)" }}>{_currSym}</span>
            <input className="fi" type="number" placeholder="200.00" value={lim} onChange={e => setLim(e.target.value)} style={{ fontSize:21, fontWeight:700 }} />
          </div>
        </div>
        <button className="bp" onClick={() => { if (lim) onSave({ ...bud, category_id: cid, month, limit_amount: +lim }); }} disabled={!lim}>Save budget</button>
        <div style={{ height:9 }} /><button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
