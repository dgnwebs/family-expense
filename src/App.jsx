import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPA_URL = "https://draniousnxunkgqdxxvw.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYW5pb3Vzbnh1bmtncWR4eHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTUwODgsImV4cCI6MjA5ODIzMTA4OH0.GxRgqdfM7ybBN4mQhARCqOeL6AR8XZAX_O8s9Oq7dts";
const BASE_H = { "Content-Type": "application/json", apikey: SUPA_KEY };
const AH = (t) => ({ ...BASE_H, Authorization: "Bearer " + (t || SUPA_KEY), Prefer: "return=representation" });

// cache: 'no-store' on every call — without it, fetch() can silently serve a
// stale cached GET response instead of hitting the network, which made
// pull-to-refresh (and the general data load) appear to do nothing until a
// full app restart forced a genuinely fresh request. Same lesson as the
// service worker fix for stale app-shell bundles, applied to the data layer.
const api = {
  get:   (p, t)    => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: AH(t), cache: "no-store" }).then(r => r.json()),
  post:  (p, b, t) => fetch(`${SUPA_URL}/rest/v1/${p}`, { method: "POST",   headers: AH(t), body: JSON.stringify(b), cache: "no-store" }).then(r => r.json()),
  patch: (p, b, t) => fetch(`${SUPA_URL}/rest/v1/${p}`, { method: "PATCH",  headers: AH(t), body: JSON.stringify(b), cache: "no-store" }).then(r => r.json()),
  del:   (p, t)    => fetch(`${SUPA_URL}/rest/v1/${p}`, { method: "DELETE", headers: AH(t), cache: "no-store" }),
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

// ─── EmailJS — notifies the admin of new sign-up requests ─────────────────────
// Fill these in after setting up a free account at emailjs.com (see chat for
// step-by-step instructions). Notification is skipped silently until then.
const EMAILJS_SERVICE_ID  = "service_719cp8i";
const EMAILJS_TEMPLATE_ID = "template_syyjtm8";
const EMAILJS_PUBLIC_KEY  = "cOUKaUxAIPXowhLDH";

const notifyAdminSignup = (name, email) => {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return;
  fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: { user_name: name, user_email: email },
    }),
  }).catch(() => {}); // best-effort — never block sign-up on this
};

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

// Matches only at the start of the text or the start of one of its words —
// e.g. "ac" matches "Academy Fee" (word "Academy" starts with it) but not
// "Snacks" (the "ac" only appears mid-word, which a plain .includes() would
// wrongly treat as a match).
const matchesBuf = (text, buf) => {
  if (!buf) return true;
  const lower = text.toLowerCase();
  return lower.startsWith(buf) || lower.split(/\s+/).some(w => w.startsWith(buf));
};

// Frequency-ranked notes from the persistent note_history table (survives
// expense deletion — see note-history.sql), optionally scoped to one category
function rankedHistory(noteHistory, categoryId, buf) {
  return noteHistory
    .filter(h => (!categoryId || h.category_id === categoryId) && matchesBuf(h.text, buf))
    .sort((a, b) => b.count - a.count || (b.last_used || "").localeCompare(a.last_used || ""))
    .map(h => h.text);
}

// Suggestions for the text currently being typed on the last line of a note.
// With nothing typed yet, surfaces this category's most frequently used
// notes (e.g. picking "Credit Card" shows "SBI Bank", "ICICI Bank"…) — the
// more it's used, the more these habits get learned and prioritized. This
// history persists even if the expenses that originally created it get
// deleted, since it's tracked in its own table rather than derived live.
function noteSuggestions(buf, noteHistory, categoryId) {
  if (!buf) return rankedHistory(noteHistory, categoryId, "").slice(0, 4);

  // History is a small, category-scoped list, so even a 1-character prefix
  // is a useful match (e.g. "f" -> "Fuel").
  const fromCatHistory = rankedHistory(noteHistory, categoryId, buf).slice(0, 3);
  const fromAllHistory = categoryId
    ? rankedHistory(noteHistory, null, buf).filter(t => !fromCatHistory.includes(t)).slice(0, 2)
    : [];

  const out = [...fromCatHistory, ...fromAllHistory];

  // The generic lexicon is a pure cold-start fallback for before the family
  // has ever entered a single real note anywhere in the app. The moment any
  // real history exists, suggestions rely solely on actual entered habits —
  // never guessed generic items, even for a brand-new category.
  const fromLexicon = [];
  if (noteHistory.length === 0 && buf.length >= 2) {
    for (const item of NOTE_LEXICON) {
      if (matchesBuf(item.name, buf) || buf.includes(item.name)) {
        const cap = titleCase(item.name);
        if (item.basket) {
          fromLexicon.push(`For ${cap}`);
        } else {
          (QTY_BY_UNIT[item.unit] || [1]).slice(0, 2).forEach(q => fromLexicon.push(`${q}${item.unit} ${cap}`));
          fromLexicon.push(`For ${cap}`);
        }
      }
    }
  }

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

const FONT_SIZES = [
  { id: "small",   lbl: "Small",   scale: 0.9 },
  { id: "default", lbl: "Default", scale: 1   },
  { id: "big",     lbl: "Big",     scale: 1.15 },
  { id: "large",   lbl: "Large",   scale: 1.3 },
  { id: "huge",    lbl: "Huge",    scale: 1.5 },
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
// "Today" is always India Standard Time (Asia/Kolkata), not the device's own
// timezone — this is a family-only app for an India-based household, so
// "today" should mean today in India regardless of where a phone's clock is
// set (or briefly is, while traveling). en-CA formats as YYYY-MM-DD directly.
const todayS = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const curM   = () => todayS().slice(0, 7);
const mLabel = m  => { const [y, mo] = m.split("-"); return `${MONTHS[+mo - 1]} ${y}`; };
// Pure calendar-date arithmetic on a YYYY-MM-DD string — parsed and
// serialized entirely in UTC so there's no local-device-timezone round-trip
// distortion. (The previous version parsed as local midnight then serialized
// via toISOString(), which silently shifted dates back a day for any
// timezone ahead of UTC — IST included — since local midnight there falls
// on the previous UTC calendar day.)
const addDays = (d, n) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};
const startOfWeek = d => {
  const dt = new Date(`${d}T00:00:00Z`);
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return dt.toISOString().slice(0, 10);
};
const dayLabel = d => {
  if (d === todayS()) return "Today";
  if (d === addDays(todayS(), -1)) return "Yesterday";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
};
const weekRangeLabel = start => {
  const end = addDays(start, 6);
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
  return s.getMonth() === e.getMonth()
    ? `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}`
    : `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
};
const shortDate    = d => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" });
const monthShort   = m => MONTHS[+m.split("-")[1] - 1];
const prevMonthStr = m => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nextMonthStr = m => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo);     return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const relMonthLabel = m => {
  if (m === curM()) return "This month";
  const [cy, cm] = curM().split("-").map(Number), [my, mo] = m.split("-").map(Number);
  const diff = (cy - my) * 12 + (cm - mo);
  if (diff === 1) return "Last month";
  if (diff === -1) return "Next month";
  return diff > 0 ? `${diff} months ago` : `In ${-diff} months`;
};
const relWeekLabel = weeksBack => weeksBack === 0 ? "This week" : weeksBack === 1 ? "Last week" : `${weeksBack} weeks ago`;

// ─── Global CSS ───────────────────────────────────────────────────────────────
const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  :root {
    --p: #1E3A8A; --ps: #EFF6FF; --g: #22C55E; --am: #F59E0B; --rd: #EF4444;
    --bg: #EFF6FF; --card: #FFFFFF; --tx: #1A1A2E; --mu: #6B7280; --br: #E5E7EB;
  }
  :root[data-theme="dark"] {
    /* Lighter blue than the light-theme navy — navy-on-near-black has poor
       contrast when used as text/icon color (not just button fills) */
    --p: #5B8DEF;
    --bg: #0D1117; --card: #161B22; --tx: #E6EDF3; --mu: #8B949E; --br: #30363D; --ps: #1C2A4A;
  }
  :root[data-theme="dark"] input,
  :root[data-theme="dark"] select { color-scheme: dark; }
  html, body, #root { height: 100%; background: var(--bg); }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }
  #root { display: flex; justify-content: center; align-items: center; }
  .app { display: flex; flex-direction: column; height: 100vh; width: 100%; max-width: 430px; position: relative; background: var(--bg); overflow: hidden; }
  .scr { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
  .scr::-webkit-scrollbar { display: none; }

  /* Nav */
  nav { display: flex; background: var(--card); border-top: 1px solid var(--br); padding: 8px 0 20px; flex-shrink: 0; }
  .ni { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px 6px; border: none; background: none; color: var(--mu); font-size: 10px; font-weight: 600; cursor: pointer; font-family: inherit; position: relative; }
  .ni.on { color: var(--p); }
  .ni.on::before { content: ""; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 26px; height: 2.5px; border-radius: 2px; background: var(--p); }
  .ni svg { width: 22px; height: 22px; margin-bottom: 1px; }
  .nadd { flex: 1; display: flex; align-items: center; justify-content: center; }
  .addbtn { width: 54px; height: 54px; border-radius: 50%; background: var(--p); border: none; cursor: pointer; color: #fff; font-size: 28px; box-shadow: 0 4px 16px rgba(30,58,138,.4); margin-top: -18px; display: flex; align-items: center; justify-content: center; }
  .addbtn:active { transform: scale(.93); }

  /* Cards */
  .card { background: var(--card); border-radius: 16px; padding: 18px; margin: 0 16px 12px; box-shadow: 0 1px 8px rgba(0,0,0,.06); }
  .hero { background: linear-gradient(135deg, #1E3A8A, #3B5FBF); border-radius: 20px; margin: 0 16px 14px; padding: 22px; color: #fff; }
  .hd { padding: 20px 20px 14px; }
  .hd h1 { font-size: 19px; font-weight: 700; color: var(--tx); }
  .hd p { font-size: 13px; color: var(--mu); margin-top: 2px; }

  /* Form */
  .fi { width: 100%; max-width: 100%; min-width: 0; padding: 15px; border: 1.5px solid var(--br); border-radius: 10px; font-size: 16px; color: var(--tx); background: var(--bg); outline: none; font-family: inherit; transition: border-color .15s; }
  /* iOS renders the native date-picker control's own internal layout, which
     doesn't always shrink to a width:100% parent the way text inputs do —
     max-width is the property iOS actually respects to cap it. */
  .fi[type="date"] { max-width: 100%; }
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
  .mo { background: var(--card); border-radius: 24px 24px 0 0; padding: 22px 20px 36px; width: 100%; max-height: 88vh; overflow-y: auto; overflow-x: hidden; }
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
  .cg { display: grid; grid-template-columns: repeat(auto-fit, minmax(78px, 1fr)); gap: 10px; }
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

  /* Compact Today/Week/Month segmented control — sits inline next to a
     screen title instead of its own full-width row */
  .seg { display: flex; gap: 2px; background: var(--bg); padding: 3px; border-radius: 99px; flex-shrink: 0; }
  .seg button { padding: 6px 11px; border-radius: 99px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; background: transparent; color: var(--mu); transition: all .15s; white-space: nowrap; }
  .seg button.on { background: var(--p); color: #fff; }

  /* Date nav card — prev (with preview) | current label | next (with preview) */
  .drange { background: var(--card); border-radius: 16px; margin: 0 16px 14px; padding: 10px 4px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 8px rgba(0,0,0,.06); }
  .drange-side { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 12px; color: var(--mu); font-family: inherit; min-width: 56px; }
  .drange-side .arrow { font-size: 18px; line-height: 1; color: var(--tx); }
  .drange-side .preview { font-size: 11px; font-weight: 600; }
  .drange-center { text-align: center; flex: 1; }
  .drange-main { font-size: 18px; font-weight: 800; color: var(--tx); }
  .drange-sub { font-size: 12px; color: var(--mu); margin-top: 2px; }

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
  .fpbody { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 20px 16px 36px; }
  .fpbody::-webkit-scrollbar { display: none; }

  /* Sidebar brand/user elements — hidden on phone, shown on tablet */
  .sidebar-brand { display: none; }
  .sidebar-user  { display: none; }
  .dash-tablet-hd { display: none; }

  /* ── Tablet layout (≥768px) ────────────────────────────────────────────── */
  @media (min-width: 768px) {
    /* Full-width: remove the 430px phone cap, switch to row layout */
    .app { max-width: none; flex-direction: row; }

    /* Left sidebar nav */
    nav {
      order: -1;  /* DOM order puts nav after .scr, this pulls it left without changing DOM */
      flex-direction: column; align-items: stretch; justify-content: flex-start;
      flex-shrink: 0; width: 210px; min-width: 210px;
      min-height: 0;  /* prevents flex item growing past parent; required for overflow-y to work */
      border-top: none; border-right: 1px solid var(--br);
      padding: 0; overflow-y: auto;
    }

    /* Sidebar brand header */
    .sidebar-brand {
      display: flex; align-items: center; gap: 12px;
      padding: 22px 18px 18px; border-bottom: 1px solid var(--br);
    }
    .sidebar-brand-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: var(--p); color: #fff; font-size: 14px; font-weight: 800;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sidebar-brand-name { font-size: 15px; font-weight: 800; color: var(--tx); }
    .sidebar-brand-sub  { font-size: 11px; color: var(--mu); margin-top: 2px; }

    /* Nav items area */
    .sidebar-nav-items { padding: 12px 0; flex: 1; }

    /* "+ New expense" button */
    .nadd { order: 0; flex: 0; padding: 12px 16px 4px; justify-content: stretch; }
    .addbtn {
      width: 100%; height: 44px; border-radius: 10px;
      margin-top: 0; font-size: 15px; font-weight: 700;
      box-shadow: 0 2px 8px rgba(30,58,138,.25);
      letter-spacing: 0.2px;
    }

    /* Nav items: icon + label in a row, pill active style */
    .ni {
      flex-direction: row; justify-content: flex-start;
      gap: 12px; padding: 11px 12px 11px 16px;
      font-size: 13px; border-top: none;
      margin: 1px 10px; width: calc(100% - 20px); border-radius: 9px;
    }
    .ni svg { width: 19px; height: 19px; }
    .ni.on { background: var(--ps); color: var(--p); border-radius: 9px; }
    .ni.on::before { display: none; } /* pill replaces the border indicator */

    /* Sidebar user footer */
    .sidebar-user {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; border-top: 1px solid var(--br);
      margin-top: auto;
    }
    .sidebar-user-info { flex: 1; min-width: 0; }
    .sidebar-user-name { font-size: 13px; font-weight: 700; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sidebar-user-role { font-size: 11px; color: var(--mu); margin-top: 1px; }
    .sidebar-user-gear { background: none; border: none; cursor: pointer; color: var(--mu); font-size: 16px; padding: 4px; border-radius: 6px; }
    .sidebar-user-gear:hover { color: var(--tx); }

    /* Dashboard phone header + phone date nav card: hidden on tablet */
    .dash-hd { display: none; }
    .dash-drange { display: none; }  /* was .drange.dash-drange — wrong: needed wrapper class only */
    .dash-tablet-hd {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 24px 14px; flex-wrap: wrap; gap: 12px;
    }
    .dash-title-group h1 { font-size: 22px; font-weight: 800; color: var(--tx); margin: 0; }
    .dash-title-group .dash-date-sub { font-size: 12px; color: var(--mu); margin-top: 3px; }
    .dash-tablet-controls { display: flex; align-items: center; gap: 10px; }
    .dash-inline-nav { display: flex; align-items: center; gap: 4px; }
    .dash-inline-nav button { background: var(--card); border: 1.5px solid var(--br); border-radius: 8px; width: 32px; height: 32px; cursor: pointer; font-size: 16px; color: var(--tx); display: flex; align-items: center; justify-content: center; font-family: inherit; }
    .dash-inline-nav span { font-size: 14px; font-weight: 700; color: var(--tx); padding: 0 10px; white-space: nowrap; }

    /* 2-column grid: chart-col (right, col 2 row 1) + recent-col (left, col 1 row 1).
       Source order is chart first then recent, but explicit grid-column/row
       placements flip them visually so phone order is unchanged. */
    .dash-twocol { display: grid; grid-template-columns: 1fr 1fr; margin: 0 20px; gap: 14px 0; }
    .dash-twocol > * { grid-column: 1 / -1; } /* full-width default for everything */
    .dash-chart-col  { grid-column: 2 !important; grid-row: 1; }
    .dash-recent-col { grid-column: 1 !important; grid-row: 1; }
    /* Cards inside grid columns need no side margins (the column itself provides spacing) */
    .dash-chart-col .card  { margin: 0 0 0 8px; }
    /* Recent col gets a white card container to match the reference design */
    .dash-recent-col { background: var(--card); border-radius: 16px; box-shadow: 0 1px 8px rgba(0,0,0,.06); overflow: hidden; padding-bottom: 8px; margin-right: 8px; }

    /* Global spacing inside content area */
    .card  { margin: 0 20px 14px; }
    .drange { margin: 0 20px 14px; }
    .hero  { margin: 0 20px 14px; }
    .toast { left: 226px; }
  }
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
  const [name,  setName]  = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");
  const [invalidLogin, setInvalidLogin] = useState(false);

  // Supabase's error shape isn't consistent across endpoints (some use
  // {error: {message}}, the password-grant token endpoint uses
  // {error_code, msg} with no top-level "error" at all) — pull whatever
  // message field is actually present instead of assuming one shape.
  const errMsg = res => res.error_description || res.msg || res.error?.message || (typeof res.error === "string" ? res.error : null);

  // Creates the pending-approval record. Best-effort — if it fails (e.g. the
  // table doesn't exist yet), the app's own approval check will retry this
  // on next login rather than block sign-up entirely.
  const createProfile = (token, userId) =>
    api.post("profiles", { id: userId, email, name: name.trim(), status: "pending" }, token).catch(() => {});

  // Handles a previously-removed member trying to get back in: if their
  // profile is missing (insert never ran) or was declined/revoked, this
  // (re)creates it as pending and notifies the admin. Only called from an
  // explicit sign-in/sign-up attempt — never from passive session
  // restoration on page load, so a refresh can't resurrect a decline.
  const reactivateIfRevoked = async (token, userId, em) => {
    const res = await api.get(`profiles?id=eq.${userId}`, token);
    const p = Array.isArray(res) ? res[0] : null;
    const nm = p?.name || em.split("@")[0];
    if (p && p.status !== "approved" && p.status !== "pending") {
      await api.patch(`profiles?id=eq.${userId}`, { status: "pending" }, token).catch(() => {});
      notifyAdminSignup(nm, em);
    } else if (!p) {
      await api.post("profiles", { id: userId, email: em, name: nm, status: "pending" }, token).catch(() => {});
      notifyAdminSignup(nm, em);
    }
  };

  const go = async () => {
    setErr(""); setInvalidLogin(false); setBusy(true);
    if (isNew) {
      if (!name.trim()) { setErr("Please enter your name"); setBusy(false); return; }
      const res = await signUp(email, pass);
      if (res.access_token) {
        await createProfile(res.access_token, res.user.id);
        notifyAdminSignup(name.trim(), email);
        onLogin(res.access_token, res.user, res.expires_in, res.refresh_token);
        return;
      }
      // No immediate token — either email confirmation is required, or this
      // email is already registered (e.g. a previously removed member
      // trying to rejoin). Either way, try signing in with the same
      // credentials rather than dead-ending on "already registered".
      const res2 = await signIn(email, pass);
      setBusy(false);
      if (res2.access_token) {
        await reactivateIfRevoked(res2.access_token, res2.user.id, email);
        onLogin(res2.access_token, res2.user, res2.expires_in, res2.refresh_token);
        return;
      }
      // Both signup AND the sign-in fallback failed — almost always means
      // the password typed here doesn't match the original account's
      // password. Showing Supabase's raw "User already registered" here
      // would be misleading since it implies nothing can be done; the
      // actionable message is "use the right password instead".
      setErr("This email is already registered. Enter the correct (original) password above and try Sign in, or ask the account owner for help if you've forgotten it.");
      setIsNew(false); return;
    }
    const res = await signIn(email, pass);
    setBusy(false);
    if (!res.access_token) {
      setInvalidLogin(true);
      setPass("");
      return;
    }
    await reactivateIfRevoked(res.access_token, res.user.id, email);
    onLogin(res.access_token, res.user, res.expires_in, res.refresh_token);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:24 }}>
      <img src={`${import.meta.env.BASE_URL}icon-512.png`} alt="" style={{ width:88, height:88, borderRadius:22, marginBottom:14, boxShadow:"0 6px 20px rgba(30,58,138,.3)" }} />
      <div style={{ fontSize:26, fontWeight:800, color:"var(--tx)", marginBottom:4 }}>Family Expenses</div>
      <div style={{ fontSize:13, color:"var(--mu)", marginBottom:32 }}>Track spending together · {_currCode}</div>

      <div style={{ width:"100%", background:"var(--card)", borderRadius:18, padding:22, boxShadow:"0 4px 24px rgba(30,58,138,.12)" }}>
        <div style={{ fontSize:17, fontWeight:700, color:"var(--tx)", marginBottom:18 }}>
          {isNew ? "Create account" : "Welcome back"}
        </div>
        {invalidLogin && (
          <div style={{ background:"#FEF2F2", color:"var(--rd)", padding:"11px 13px", borderRadius:8, fontSize:13, marginBottom:12, fontWeight:500, lineHeight:1.6 }}>
            Incorrect details<br /><strong>Sign up if you're logging in for the first time.</strong>
          </div>
        )}
        {err && <div style={{ background:"#FEF2F2", color:"var(--rd)", padding:"11px 13px", borderRadius:8, fontSize:13, marginBottom:12, fontWeight:500 }}>{err}</div>}
        {isNew && <input className="fi" style={{ marginBottom:10 }} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />}
        <input className="fi" style={{ marginBottom:10 }} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="fi" style={{ marginBottom:18 }} placeholder="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} />
        <button className="bp" onClick={go} disabled={busy || !email || !pass || (isNew && !name.trim())}>
          {busy ? "Please wait…" : isNew ? "Sign up" : "Sign in"}
        </button>
        <button onClick={() => { setIsNew(v => !v); setErr(""); setInvalidLogin(false); }}
          style={{ width:"100%", marginTop:10, background:"none", border:"none", color:"var(--p)", fontSize:13, fontWeight:600, cursor:"pointer", padding:"9px 0", fontFamily:"inherit" }}>
          {isNew ? "Already have an account? Sign in" : "No account? Sign up"}
        </button>
      </div>
      <div style={{ fontSize:11, color:"var(--mu)", marginTop:20, textAlign:"center", lineHeight:1.6 }}>
        All family members sign in here.<br />New sign-ups need the account owner's approval before they can start.
      </div>
    </div>
  );
}

// ─── Awaiting Approval Screen ──────────────────────────────────────────────
function AwaitingApproval({ name, onOut }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:24, textAlign:"center" }}>
      <div style={{ fontSize:50, marginBottom:14 }}>⏳</div>
      <div style={{ fontSize:20, fontWeight:800, color:"var(--tx)", marginBottom:8 }}>Awaiting approval</div>
      <div style={{ fontSize:14, color:"var(--mu)", lineHeight:1.6, marginBottom:24, maxWidth:280 }}>
        Hi{name ? ` ${name}` : ""}! Your account has been created. The account owner needs to approve you before you can start adding expenses.
      </div>
      <button className="bg" onClick={onOut} style={{ maxWidth:240 }}>Sign out</button>
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
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("fe_fontsize") || "default");
  const fontScale = FONT_SIZES.find(f => f.id === fontSize)?.scale || 1;

  const [tab,    setTab]    = useState("dashboard");
  const [adminTab, setAdminTab] = useState("members"); // ScreenAdm's active sub-tab, lifted so the dashboard's settings shortcut can jump straight to it
  const [lastViewedExp, setLastViewedExp] = useState(null); // timestamp of last time this user viewed the Expenses tab
  const openSettings = () => { setTab("admin"); setAdminTab("settings"); };
  const [modal,  setModal]  = useState(null);
  const [sel,    setSel]    = useState(null);
  const [toast,  setToast]  = useState(null);
  const [month,  setMonth]  = useState(curM());
  const [expenses, setExp]  = useState([]);
  const [cats,   setCats]   = useState([]);
  const [members, setMems]  = useState([]);
  const [budgets, setBuds]  = useState([]);
  const [noteHist, setNoteHist] = useState([]); // persists across expense deletion — see note-history.sql
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
  const handleFontSize = id => {
    setFontSize(id); localStorage.setItem("fe_fontsize", id);
  };
  const handleLogin = (t, u, expires_in, refresh) => {
    saveSession(t, u, expires_in, refresh); setToken(t); setUser(u);
  };
  const handleOut = () => {
    clearSession(); setToken(null); setUser(null);
  };

  const pop = msg => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const T = token;
  const isAdminUser = user?.email === ADMIN_EMAIL;

  // ── Sign-up approval gate ────────────────────────────────────────────────
  const [myProfile, setMyProfile] = useState(null);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const isApproved = isAdminUser || myProfile?.status === "approved";

  // Anything other than "approved" or "pending" means access was explicitly
  // pulled (declined, or revoked via member removal) — checked by name
  // instead of just "not approved" so a brand-new pending row never trips it.
  const isRevoked = p => p && p.status !== "approved" && p.status !== "pending";
  // Tracks the last known status outside of React state so the polling
  // interval's closure (set up once per effect run) always compares against
  // the latest value instead of whatever myProfile was when it was created.
  const lastStatusRef = useRef(null);
  useEffect(() => { lastStatusRef.current = myProfile?.status ?? null; }, [myProfile]);

  useEffect(() => {
    if (!T || !user) return;
    if (isAdminUser) { setCheckingApproval(false); return; } // admin bypasses approval entirely
    setCheckingApproval(true);
    api.get(`profiles?id=eq.${user.id}`, T).then(async res => {
      let p = Array.isArray(res) ? res[0] : null;
      if (isRevoked(p)) { handleOut(); return; } // explicit decision — don't resurrect on refresh
      if (!p) {
        // No profile row at all — the sign-up insert itself failed (declines
        // and revocations are a status, not a deletion, so this never
        // happens from those). Recreate a pending one so the admin sees it.
        const created = await api.post("profiles", { id: user.id, email: user.email, name: user.email.split("@")[0], status: "pending" }, T).catch(() => null);
        p = Array.isArray(created) ? created[0] : null;
      }
      setMyProfile(p);
      setCheckingApproval(false);
    }).catch(() => setCheckingApproval(false));
  }, [T, user, isAdminUser]);

  // Keep polling for as long as the user is logged in — not just while
  // waiting for approval — so that revoking an already-approved member's
  // access (e.g. removing them from Manage -> Members) signs them out within
  // one poll cycle instead of leaving their session usable until they
  // happen to sign out manually. Database access is already blocked
  // instantly via RLS regardless; this just makes the UI reflect it.
  useEffect(() => {
    if (!T || !user || isAdminUser || checkingApproval) return;
    const id = setInterval(() => {
      api.get(`profiles?id=eq.${user.id}`, T).then(res => {
        const p = Array.isArray(res) ? res[0] : null;
        if (!p || isRevoked(p)) { handleOut(); return; }
        if (p.status === "approved" && lastStatusRef.current !== "approved") pop("✅ You've been approved!");
        setMyProfile(p);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [T, user, isAdminUser, checkingApproval]);

  const load = useCallback(async () => {
    if (!T) return;
    setLoad(true);
    try {
      const calls = [
        api.get("categories?order=name", T),
        api.get("members?order=name", T),
        api.get("expenses?order=date.desc,created_at.desc&limit=300", T),
        api.get("budgets?order=created_at", T),
        api.get("note_history?order=count.desc", T),
      ];
      if (isAdminUser) calls.push(api.get("profiles?status=eq.pending&order=created_at", T));
      const [c, m, e, b, nh, pend] = await Promise.all(calls);
      if (Array.isArray(c)) setCats(c);
      if (Array.isArray(m)) setMems(m);
      if (Array.isArray(e)) setExp(e);
      if (Array.isArray(b)) setBuds(b);
      if (Array.isArray(nh)) setNoteHist(nh);
      if (isAdminUser && Array.isArray(pend)) setPendingProfiles(pend);
    } catch { pop("⚠️ Error loading data"); }
    setLoad(false);
  }, [T, isAdminUser]);

  useEffect(() => { if (T && isApproved) load(); }, [T, isApproved, load]);

  // ── New-expense badge ──────────────────────────────────────────────────────
  // Initialise "last viewed" from localStorage once the user is known.
  // First visit: stamp "now" so all existing data is treated as already seen.
  useEffect(() => {
    if (!user?.id) return;
    const stored = parseFloat(localStorage.getItem(`fe_exp_view_${user.id}`));
    setLastViewedExp(!stored || isNaN(stored) ? Date.now() : stored);
  }, [user?.id]);

  // Count expenses added by OTHER users since this user last viewed the tab.
  // Uses created_at (UTC epoch) — accurate regardless of timezone.
  const newExpCount = useMemo(() => {
    if (!lastViewedExp || !user?.id || tab === "expenses") return 0;
    return expenses.filter(e =>
      e.created_by && e.created_by !== user.id &&
      new Date(e.created_at).getTime() > lastViewedExp
    ).length;
  }, [expenses, lastViewedExp, user?.id, tab]);

  // Clear the badge and persist the "seen" timestamp for this user.
  const markExpensesSeen = useCallback(() => {
    if (!user?.id) return;
    const ts = Date.now();
    setLastViewedExp(ts);
    localStorage.setItem(`fe_exp_view_${user.id}`, String(ts));
  }, [user?.id]);

  // Auto-clear whenever the Expenses tab becomes active, regardless of
  // which code path triggered the navigation.
  useEffect(() => { if (tab === "expenses") markExpensesSeen(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch data when the app is resumed (switched back to, or reopened
  // from the background) — "new pushed changes" usually means new data too
  // (e.g. an expense someone else added while this device was idle), not
  // just new app code. Guarded so rapid app-switching doesn't fire repeated
  // requests back to back.
  const lastVisibleRefresh = useRef(Date.now());
  useEffect(() => {
    if (!T || !isApproved) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastVisibleRefresh.current < 30000) return;
      lastVisibleRefresh.current = Date.now();
      load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [T, isApproved, load]);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  // PWAs running in standalone mode don't get the browser's native
  // pull-to-refresh, so this re-implements it: pulling down while already
  // scrolled to the top re-fetches all data.
  const PULL_THRESHOLD = 70;
  const PULL_MAX = 110;
  // Natural finger jitter during an ordinary tap is rarely perfectly 0px of
  // vertical movement — without a dead zone, tapping any button near the top
  // of the page (e.g. the date nav's prev/next buttons) was triggering a
  // pull state update and CSS transform on .scr mid-tap, which could shift
  // the button under the finger and cause double-fires or missed taps.
  const PULL_DEAD_ZONE = 12;
  const scrRef = useRef(null);
  const touchStartY = useRef(null);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = e => {
    touchStartY.current = scrRef.current && scrRef.current.scrollTop <= 0 ? e.touches[0].clientY : null;
  };
  const onTouchMove = e => {
    if (touchStartY.current === null || refreshing) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > PULL_DEAD_ZONE && scrRef.current.scrollTop <= 0) setPullY(Math.min((dy - PULL_DEAD_ZONE) * 0.5, PULL_MAX));
    else if (dy < 0) { touchStartY.current = null; setPullY(0); }
    // dy between 0 and the dead zone: still ambiguous (could be a tap or the
    // start of a pull) — leave pullY untouched so a simple tap's click isn't
    // disturbed by an unnecessary re-render.
  };
  const onTouchEnd = async () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    if (pullY >= PULL_THRESHOLD) {
      setRefreshing(true);
      await load();
      setRefreshing(false);
    }
    setPullY(0);
  };
  // iOS can fire touchcancel instead of touchend if a gesture is interrupted
  // (e.g. a system swipe) — without this, pullY/touchStartY could get stuck
  // in a non-zero state, leaving .scr visually offset and taps misaligned
  // until the next full touch cycle happened to reset it.
  const onTouchCancel = () => { touchStartY.current = null; setPullY(0); };

  const approveProfile = async profile => {
    let newMember = null;
    if (profile.member_id) {
      // Re-approving someone previously removed — reuse their original
      // member row (un-archive it) instead of creating a duplicate.
      const res = await api.patch(`members?id=eq.${profile.member_id}`, { archived: false }, T);
      newMember = Array.isArray(res) && res[0];
      if (newMember) setMems(p => p.map(m => m.id === newMember.id ? newMember : m));
    }
    if (!newMember) {
      const ini = profile.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
      const color = PALETTE[members.length % PALETTE.length];
      const res = await api.post("members", { name: profile.name, color, initials: ini, email: profile.email }, T);
      newMember = Array.isArray(res) && res[0];
      if (newMember) setMems(p => [...p, newMember]);
    }
    const pRes = await api.patch(`profiles?id=eq.${profile.id}`, { status: "approved", member_id: newMember?.id || null }, T);
    if (Array.isArray(pRes) && pRes[0]) {
      setPendingProfiles(p => p.filter(x => x.id !== profile.id));
      pop(`✅ ${profile.name} approved`);
    }
  };
  const declineProfile = async profile => {
    // Soft status, not a delete — a deleted row is indistinguishable from a
    // failed sign-up insert, which the app auto-recovers from. That caused
    // a decline -> refresh -> resurrected-as-pending loop.
    await api.patch(`profiles?id=eq.${profile.id}`, { status: "declined" }, T);
    setPendingProfiles(p => p.filter(x => x.id !== profile.id));
    pop("🗑️ Request declined");
  };

  const mExp  = useMemo(() => expenses.filter(e => e.date?.startsWith(month)), [expenses, month]);
  // catS stays month-scoped — it's what budgets (always monthly limits) compare against,
  // used by both the Budgets screen and the Dashboard's Budget Alerts card.
  const catS  = useMemo(() => { const m = {}; mExp.forEach(e => { m[e.category_id] = (m[e.category_id] || 0) + Number(e.amount); }); return m; }, [mExp]);

  const getCat = id => cats.find(c => c.id === id)    || { name:"Other",   icon:"📌", color:"#607D8B" };
  const getMem = id => members.find(m => m.id === id) || { name:"Unknown", color:"#999", initials:"?" };

  const prevM = () => { const [y,m]=month.split("-").map(Number),d=new Date(y,m-2); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const nextM = () => { const [y,m]=month.split("-").map(Number),d=new Date(y,m);   setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };

  // ── Dashboard date-range selector (Today / Week / Month) — independent of
  // the Budgets screen's `month`, except "Month" mode which shares it ──────
  const [dashMode, setDashMode] = useState("month"); // "today" | "week" | "month"
  const [dashDate, setDashDate] = useState(todayS());
  const [weeksBack, setWeeksBack] = useState(0); // 0 = this week, capped at 4 weeks back

  const weekStart = useMemo(() => startOfWeek(addDays(todayS(), -7 * weeksBack)), [weeksBack]);
  const weekEnd   = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const rangeExp = useMemo(() => {
    if (dashMode === "today") return expenses.filter(e => e.date === dashDate);
    if (dashMode === "week")  return expenses.filter(e => e.date >= weekStart && e.date <= weekEnd);
    return mExp;
  }, [dashMode, expenses, dashDate, weekStart, weekEnd, mExp]);
  const rangeTotal = useMemo(() => rangeExp.reduce((s, e) => s + Number(e.amount), 0), [rangeExp]);
  const rangeCatS  = useMemo(() => { const m = {}; rangeExp.forEach(e => { m[e.category_id] = (m[e.category_id] || 0) + Number(e.amount); }); return m; }, [rangeExp]);
  const rangeMemS  = useMemo(() => { const m = {}; rangeExp.forEach(e => { m[e.paid_by]     = (m[e.paid_by]     || 0) + Number(e.amount); }); return m; }, [rangeExp]);

  const prevDay  = () => setDashDate(d => addDays(d, -1));
  const nextDay  = () => setDashDate(d => { const n = addDays(d, 1); return n > todayS() ? d : n; });
  const prevWeek = () => setWeeksBack(w => Math.min(w + 1, 4));
  const nextWeek = () => setWeeksBack(w => Math.max(w - 1, 0));

  // ── CRUD ──────────────────────────────────────────────────────────────────
  // Records each note line into the persistent note_history table, incrementing
  // its count if already seen for this category. Kept separate from `expenses`
  // so suggestions keep working — and keep improving — even after the expense
  // that originally produced a note gets deleted.
  const recordNoteHistory = async (categoryId, noteText) => {
    const lines = [...new Set((noteText || "").split("\n").map(l => l.trim()).filter(Boolean))];
    for (const line of lines) {
      const existing = noteHist.find(h => h.category_id === categoryId && h.text.toLowerCase() === line.toLowerCase());
      const res = existing
        ? await api.patch(`note_history?id=eq.${existing.id}`, { count: existing.count + 1, last_used: todayS() }, T)
        : await api.post("note_history", { category_id: categoryId, text: line, count: 1, last_used: todayS() }, T);
      if (Array.isArray(res) && res[0]) {
        setNoteHist(p => existing ? p.map(h => h.id === existing.id ? res[0] : h) : [...p, res[0]]);
      } else {
        // Surface the actual Supabase error (e.g. missing table, RLS denial)
        // instead of failing silently — check the browser console if notes
        // aren't being remembered.
        console.error("note_history save failed for", JSON.stringify(line), "response:", res);
      }
    }
  };
  const addExp = async exp => {
    const res = await api.post("expenses", exp, T);
    if (Array.isArray(res) && res[0]) setExp(p => [res[0], ...p]);
    if (exp.note) recordNoteHistory(exp.category_id, exp.note); // fire-and-forget, don't block the save toast
    pop("✅ Expense saved");
  };
  const delExp = async id => {
    await api.del(`expenses?id=eq.${id}`, T);
    setExp(p => p.filter(e => e.id !== id));
    setModal(null); setSel(null); pop("🗑️ Deleted");
  };
  const bulkDeleteExp = async ids => {
    if (ids.length === 0) return;
    await api.del(`expenses?id=in.(${ids.join(",")})`, T);
    setExp(p => p.filter(e => !ids.includes(e.id)));
    pop(`🗑️ ${ids.length} expense${ids.length === 1 ? "" : "s"} deleted`);
  };
  const addMem = async m => {
    const res = await api.post("members", m, T);
    if (Array.isArray(res) && res[0]) setMems(p => [...p, res[0]]);
    setModal(null); pop("👤 Member added");
  };
  const archiveMember = async id => {
    const res = await api.patch(`members?id=eq.${id}`, { archived: true }, T);
    if (Array.isArray(res) && res[0]) setMems(p => p.map(m => m.id === id ? res[0] : m));
    // If this member has their own login (approved via the sign-up flow),
    // revoke it too — otherwise they'd keep full read/write access despite
    // no longer being a selectable payee. Database access is blocked
    // instantly via RLS; the user's own session is polled and signed out
    // within ~10s by the effect above. No-op for manually-added members
    // with no linked login.
    await api.patch(`profiles?member_id=eq.${id}`, { status: "revoked" }, T).catch(() => {});
    pop("👤 Member removed");
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
    // Budgets are recurring — one limit per category, applying to every
    // month — not re-entered each month. Edits go straight to the existing
    // row by id. New budgets fall back to updating any pre-existing row for
    // that category instead of inserting a duplicate (Supabase upsert can't
    // resolve on category_id alone without an on_conflict target, so we
    // handle it explicitly here).
    const existing = b.id ? null : budgets.find(x => x.category_id === b.category_id);
    const targetId = b.id || existing?.id;
    const res = targetId
      ? await api.patch(`budgets?id=eq.${targetId}`, { category_id:b.category_id, limit_amount:b.limit_amount }, T)
      : await api.post("budgets", { category_id:b.category_id, limit_amount:b.limit_amount }, T);
    if (Array.isArray(res) && res[0]) setBuds(p => [...p.filter(x => x.category_id !== b.category_id), res[0]]);
    setModal(null); pop("💰 Budget saved");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // Scaling via `transform` rather than the non-standard `zoom` property —
  // zoom's interaction with vw/vh units on the element it's applied to is
  // unspecified and behaved inconsistently in practice (content overflowing
  // the screen edge at larger sizes). transform is a standard, predictable
  // paint-time operation that never affects how any element computes its own
  // box size, so there's no ambiguity: pre-shrink .app by the scale factor,
  // then transform: scale() it back up. #root centers it on both axes, and
  // since transform scales from the element's own center by default, the
  // final rendered box lands exactly on the true viewport edges every time.
  const appStyle = {
    width: `calc(100vw / ${fontScale})`,
    height: `calc(100vh / ${fontScale})`,
    transform: `scale(${fontScale})`,
    // maxWidth deliberately left to CSS: 430px (phone via .app class) or
    // none (tablet via @media — inline styles can't be overridden by media
    // queries, so it has to live in the stylesheet, not here).
  };

  if (booting) return (
    <>
      <style>{STYLES}</style>
      <div className="app" style={appStyle}><div className="center" style={{ height:"100%" }}><div className="spin" /></div></div>
    </>
  );

  if (!T) return (
    <>
      <style>{STYLES}</style>
      <div className="app" style={appStyle}><Login onLogin={handleLogin} /></div>
    </>
  );

  if (checkingApproval) return (
    <>
      <style>{STYLES}</style>
      <div className="app" style={appStyle}><div className="center" style={{ height:"100%" }}><div className="spin" /></div></div>
    </>
  );

  if (!isApproved) return (
    <>
      <style>{STYLES}</style>
      <div className="app" style={appStyle}><AwaitingApproval name={myProfile?.name} onOut={handleOut} /></div>
    </>
  );

  return (
    <>
      <style>{STYLES}</style>
      <div className="app" style={appStyle}>
        {toast && <div className="toast">{toast}</div>}

        {/* Modals */}
        {modal === "add"  && <ModalAdd  cats={cats} members={members.filter(m => !m.archived)} noteHist={noteHist} isAdmin={isAdminUser} onSave={async e => { await addExp(e); setModal(null); }} onClose={() => setModal(null)} />}
        {modal === "det"  && sel && <ModalDet  exp={sel} getCat={getCat} getMem={getMem} onDel={delExp} onClose={() => { setModal(null); setSel(null); }} user={user} isAdmin={isAdminUser} />}
        {modal === "addM" && <ModalMem  onSave={addMem} onClose={() => setModal(null)} />}
        {modal === "eC"   && sel && <ModalCat  cat={sel} onSave={updCat} onDel={delCat} onClose={() => { setModal(null); setSel(null); }} />}
        {modal === "newC" && <ModalCat  cat={{ name:"", icon:"📌", color:PALETTE[0] }} onSave={addCat} onClose={() => setModal(null)} isNew />}
        {modal === "eB"   && sel && <ModalBud  bud={sel} cats={cats} onSave={saveBud} onClose={() => { setModal(null); setSel(null); }} />}

        {/* Pull-to-refresh indicator */}
        {(pullY > 12 || refreshing) && (
          <div style={{ position:"absolute", top: Math.min(pullY, PULL_MAX) - 46, left:0, right:0, display:"flex", justifyContent:"center", zIndex:50, pointerEvents:"none", opacity: refreshing ? 1 : Math.min(pullY / PULL_THRESHOLD, 1) }}>
            <div className="spin" style={{ width:26, height:26 }} />
          </div>
        )}

        {/* Screen */}
        <div className="scr" ref={scrRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}
          style={{ transform: pullY ? `translateY(${pullY}px)` : undefined, transition: pullY ? "none" : "transform .25s" }}>
          {loading && <div className="center"><div className="spin" /><span style={{ fontSize:13, color:"var(--mu)" }}>Loading…</span></div>}
          {!loading && tab === "dashboard" && <ScreenDash rangeExp={rangeExp} rangeTotal={rangeTotal} rangeCatS={rangeCatS} rangeMemS={rangeMemS} catS={catS} cats={cats} members={members} buds={budgets} getCat={getCat} getMem={getMem} dashMode={dashMode} setDashMode={setDashMode} dashDate={dashDate} prevDay={prevDay} nextDay={nextDay} weeksBack={weeksBack} weekStart={weekStart} weekEnd={weekEnd} prevWeek={prevWeek} nextWeek={nextWeek} month={month} prevM={prevM} nextM={nextM} onE={e => { setSel(e); setModal("det"); }} onAll={() => setTab("expenses")} onSettings={openSettings} />}
          {!loading && tab === "expenses"  && <ScreenExp  expenses={expenses} cats={cats} getCat={getCat} getMem={getMem} onE={e => { setSel(e); setModal("det"); }} isAdmin={isAdminUser} onBulkDelete={bulkDeleteExp} />}
          {!loading && tab === "budgets"   && <ScreenBud  buds={budgets} cats={cats} catS={catS} getCat={getCat} month={month} prevM={prevM} nextM={nextM} onEdit={b => { setSel(b); setModal("eB"); }} onAdd={() => { setSel({ category_id: cats.find(c => !budgets.some(b => b.category_id === c.id))?.id || cats[0]?.id, limit_amount: 200 }); setModal("eB"); }} />}
          {!loading && tab === "admin"     && <ScreenAdm  cats={cats} members={members} expenses={expenses} budgets={budgets} noteHist={noteHist} pendingProfiles={pendingProfiles} onApprove={approveProfile} onDecline={declineProfile} onArchiveMember={archiveMember} getCat={getCat} getMem={getMem} onEC={c => { setSel(c); setModal("eC"); }} onNewCat={() => setModal("newC")} onAM={() => setModal("addM")} onE={e => { setSel(e); setModal("det"); }} onOut={handleOut} user={user} darkMode={darkMode} toggleDark={toggleDark} currency={currency} onCurrency={handleCurrency} fontSize={fontSize} onFontSize={handleFontSize} t={adminTab} setT={setAdminTab} />}
        </div>

        {/* Bottom Nav (becomes left sidebar on tablet) */}
        <nav>
          {/* App brand — tablet only */}
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">FE</div>
            <div>
              <div className="sidebar-brand-name">Family Expense</div>
              <div className="sidebar-brand-sub">Track Spends Together</div>
            </div>
          </div>

          {/* New expense button */}
          <div className="nadd">
            <button className="addbtn" onClick={() => setModal("add")}>＋</button>
          </div>

          {/* Nav items */}
          {[{ id:"dashboard", lbl:"Dashboard", Ico:IcoDash }, { id:"expenses", lbl:"Expenses", Ico:IcoExp }].map(t => (
            <button key={t.id} className={`ni${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
              <div style={{ position:"relative", display:"inline-flex" }}>
                <t.Ico />
                {t.id === "expenses" && newExpCount > 0 && (
                  <span style={{ position:"absolute", top:-5, right:-7, background:"var(--rd)", color:"#fff", borderRadius:99, fontSize:9, fontWeight:800, minWidth:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px", lineHeight:1, boxShadow:"0 1px 4px rgba(0,0,0,.3)", pointerEvents:"none" }}>
                    {newExpCount > 9 ? "9+" : newExpCount}
                  </span>
                )}
              </div>
              {t.lbl}
            </button>
          ))}
          {[{ id:"budgets", lbl:"Budgets", Ico:IcoBud }, { id:"admin", lbl:"Manage", Ico:IcoAdm }].map(t => (
            <button key={t.id} className={`ni${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
              <t.Ico />
              {t.lbl}
            </button>
          ))}

          {/* User identity footer — tablet only */}
          {(() => {
            const nm = myProfile?.name || user?.email?.split("@")[0] || "User";
            const ini = nm.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
            return (
              <div className="sidebar-user">
                <div className="av" style={{ width:34, height:34, fontSize:12, background: isAdminUser ? "var(--p)" : "#64748B", flexShrink:0 }}>{ini}</div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{nm}</div>
                  {isAdminUser && <div className="sidebar-user-role">Admin</div>}
                </div>
                <button className="sidebar-user-gear" onClick={openSettings} title="Settings">⚙️</button>
              </div>
            );
          })()}
        </nav>
      </div>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
// ─── Shared: Today / Week / Month (+ optional All) range selector ─────────────
// Compact segmented Today/Week/Month control — sits inline next to a screen title
function RangeModeTabs({ mode, setMode, modes = ["today", "week", "month"], showAll }) {
  const labels = { all:"All", today:"Today", week:"Week", month:"Month" };
  const tabs = [...(showAll ? ["all"] : []), ...modes].map(id => ({ id, lbl: labels[id] }));
  return (
    <div className="seg">
      {tabs.map(t => (
        <button key={t.id} className={mode === t.id ? "on" : ""} onClick={() => setMode(t.id)}>{t.lbl}</button>
      ))}
    </div>
  );
}

// prev (with preview) | current label + subtitle | next (with preview)
function RangeNavCard({ mainLabel, subLabel, prevLabel, nextLabel, onPrev, onNext, prevDisabled, nextDisabled }) {
  return (
    <div className="drange">
      <button className="drange-side" onClick={onPrev} disabled={prevDisabled} style={prevDisabled ? { opacity:.35, cursor:"default" } : {}}>
        <span className="arrow">‹</span>
        {prevLabel && <span className="preview">{prevLabel}</span>}
      </button>
      <div className="drange-center">
        <div className="drange-main">{mainLabel}</div>
        {subLabel && <div className="drange-sub">{subLabel}</div>}
      </div>
      <button className="drange-side" onClick={onNext} disabled={nextDisabled} style={nextDisabled ? { opacity:.35, cursor:"default" } : {}}>
        {nextLabel && <span className="preview">{nextLabel}</span>}
        <span className="arrow">›</span>
      </button>
    </div>
  );
}

function ScreenDash({ rangeExp, rangeTotal, rangeCatS, rangeMemS, catS, cats, members, buds, getCat, getMem, dashMode, setDashMode, dashDate, prevDay, nextDay, weeksBack, weekStart, weekEnd, prevWeek, nextWeek, month, prevM, nextM, onE, onAll, onSettings }) {
  const top  = useMemo(() => Object.entries(rangeCatS).map(([id, a]) => ({ ...getCat(id), amt: a })).sort((a, b) => b.amt - a.amt).slice(0, 5), [rangeCatS]);
  const maxC = top[0]?.amt || 1;

  // Month mode: 4 weekly buckets. Week mode: 7 daily bars. Today mode: no chart.
  // Last bucket extends to the actual end of the month (28-31 days), not a
  // hardcoded day 28 — otherwise expenses dated 29-31 silently fell into no
  // bucket at all and showed as a flat zero despite a correct Total Spent.
  const daysInMonth = useMemo(() => { const [y, mo] = month.split("-").map(Number); return new Date(y, mo, 0).getDate(); }, [month]);
  const wk = dashMode === "month"
    ? [0,1,2,3].map(i => { const s = i*7+1, e = i === 3 ? daysInMonth : s+6; return rangeExp.filter(x => { const d = parseInt(x.date?.slice(8) || 0); return d >= s && d <= e; }).reduce((s, x) => s + Number(x.amount), 0); })
    : [];
  const days = dashMode === "week" ? [0,1,2,3,4,5,6].map(i => addDays(weekStart, i)) : [];
  const dy   = dashMode === "week" ? days.map(d => rangeExp.filter(e => e.date === d).reduce((s, e) => s + Number(e.amount), 0)) : [];
  const chartVals  = dashMode === "month" ? wk : dy;
  const chartLbls  = dashMode === "month" ? wk.map((_, i) => `W${i + 1}`) : days.map(d => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday:"short" }));
  const maxChart   = Math.max(...chartVals, 1);

  const alerts = dashMode === "month" ? buds.filter(b => (catS[b.category_id] || 0) / b.limit_amount > 0.8) : [];

  const atToday = dashDate >= todayS();
  const atThisWeek = weeksBack <= 0;
  const nav = dashMode === "today"
    ? { main: dayLabel(dashDate), sub: new Date(dashDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"long" }), prev: shortDate(addDays(dashDate, -1)), next: atToday ? null : shortDate(addDays(dashDate, 1)) }
    : dashMode === "week"
    ? { main: weekRangeLabel(weekStart), sub: relWeekLabel(weeksBack), prev: shortDate(addDays(weekStart, -7)), next: atThisWeek ? null : shortDate(addDays(weekStart, 7)) }
    : { main: mLabel(month), sub: relMonthLabel(month), prev: monthShort(prevMonthStr(month)), next: monthShort(nextMonthStr(month)) };

  const todaySubtitle = new Date().toLocaleDateString("en-US", { timeZone:"Asia/Kolkata", weekday:"long", month:"long", day:"numeric", year:"numeric" }).replace(/,\s*(\d{4})$/, " · $1");
  const prevFn = dashMode === "today" ? prevDay : dashMode === "week" ? prevWeek : prevM;
  const nextFn = dashMode === "today" ? nextDay : dashMode === "week" ? nextWeek : nextM;
  const prevDis = dashMode === "week" && weeksBack >= 4;
  const nextDis = (dashMode === "today" && atToday) || (dashMode === "week" && atThisWeek);

  return (
    <div>
      {/* Phone header — hidden on tablet */}
      <div className="hd dash-hd">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <RangeModeTabs mode={dashMode} setMode={setDashMode} />
          <button onClick={onSettings} className="theme-btn" style={{ padding:"7px 10px" }}>⚙️</button>
        </div>
      </div>
      <div className="dash-drange">
        <RangeNavCard
          mainLabel={nav.main} subLabel={nav.sub} prevLabel={nav.prev} nextLabel={nav.next}
          onPrev={prevFn} onNext={nextFn} prevDisabled={prevDis} nextDisabled={nextDis}
        />
      </div>

      {/* Tablet header — hidden on phone */}
      <div className="dash-tablet-hd">
        <div className="dash-title-group">
          <h1>Overview</h1>
          <div className="dash-date-sub">{todaySubtitle}</div>
        </div>
        <div className="dash-tablet-controls">
          <RangeModeTabs mode={dashMode} setMode={setDashMode} />
          <div className="dash-inline-nav">
            <button onClick={prevFn} disabled={prevDis} style={prevDis ? { opacity:.35, cursor:"default" } : {}}>‹</button>
            <span>{nav.main}</span>
            <button onClick={nextFn} disabled={nextDis} style={nextDis ? { opacity:.35, cursor:"default" } : {}}>›</button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="hero">
        <div style={{ fontSize:12, fontWeight:500, opacity:.8, textTransform:"uppercase", letterSpacing:.5 }}>Total spent</div>
        <div style={{ fontSize:38, fontWeight:800, letterSpacing:-1, margin:"6px 0 2px" }}>{fmt(rangeTotal)}</div>
        <div style={{ fontSize:13, opacity:.75 }}>{rangeExp.length} transactions · {_currCode}</div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:18 }}>
          {[{ v: members.length, l:"Members" }, { v: fmt(rangeTotal / Math.max(rangeExp.length, 1)), l:"Avg/expense" }, { v: buds.length, l:"Budgets" }].map((s, i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:17, fontWeight:700 }}>{s.v}</div>
              <div style={{ fontSize:11, opacity:.75, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-col grid on tablet: chart (col 2) + recent (col 1) side-by-side;
          categories/who-paid/alerts auto-span full width below.
          Source order is unchanged so phone layout stays the same. */}
      <div className="dash-twocol">
      <div className="dash-chart-col">
      {/* Spending chart — weekly buckets in Month mode, daily bars in Week mode */}
      {dashMode !== "today" && (
        <div className="card">
          <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>{dashMode === "week" ? "Daily spending" : "Weekly spending"}</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:110, padding:"0 2px" }}>
            {chartVals.map((v, i) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5, height:"100%", justifyContent:"flex-end" }}>
                <div style={{ fontSize:9, color:"var(--mu)", fontWeight:600 }}>{v > 0 ? fmt(v) : ""}</div>
                <div style={{ width:"100%", borderRadius:"5px 5px 0 0", minHeight:4, background:"var(--p)", opacity: v === Math.max(...chartVals) && v > 0 ? 1 : .35, height: Math.max((v / maxChart) * 85, v > 0 ? 5 : 0) + "px" }} />
                <div style={{ fontSize:10, color:"var(--mu)", fontWeight:500 }}>{chartLbls[i]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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
                <span style={{ fontSize:14, fontWeight:700, color:"var(--tx)" }}>{fmt(c.amt)}</span>
                <span style={{ fontSize:11, color:"var(--mu)" }}>{Math.round(c.amt / rangeTotal * 100)}%</span>
              </div>
              <div className="lbb"><div className="lb" style={{ width: (c.amt / maxC * 100) + "%", background: c.color }} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Who paid */}
      {members.filter(m => rangeMemS[m.id]).length > 0 && (
        <>
          <div style={{ padding:"6px 20px 10px", fontSize:15, fontWeight:700, color:"var(--tx)" }}>Who paid</div>
          <div style={{ padding:"0 16px 12px", display:"flex", flexDirection:"column", gap:8 }}>
            {members.filter(m => rangeMemS[m.id]).map(m => {
              const a = rangeMemS[m.id] || 0;
              return (
                <div key={m.id} style={{ background:"var(--card)", borderRadius:12, padding:"13px 15px", display:"flex", alignItems:"center", gap:11, boxShadow:"0 1px 5px rgba(0,0,0,.05)" }}>
                  <div className="av" style={{ width:40, height:40, fontSize:13, background:m.color }}>{m.initials}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:"var(--tx)" }}>{m.name}</div>
                    <div style={{ fontSize:12, color:"var(--mu)" }}>{Math.round(a / rangeTotal * 100)}% of total</div>
                  </div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--tx)" }}>{fmt(a)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Budget alerts — only meaningful against the full month's spend */}
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

      {/* Recent — in left column on tablet, bottom on phone */}
      <div className="dash-recent-col">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 20px 10px" }}>
          <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)" }}>Recent</div>
          <button style={{ background:"none", border:"none", color:"var(--p)", fontSize:13, fontWeight:600, cursor:"pointer" }} onClick={onAll}>See all</button>
        </div>
        {rangeExp.length === 0
          ? <div className="center"><span style={{ fontSize:44 }}>🧾</span><div style={{ fontSize:17, fontWeight:700, color:"var(--tx)" }}>No expenses yet</div><div style={{ fontSize:13 }}>Tap + to add your first one</div></div>
          : <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:8, paddingBottom:24 }}>{rangeExp.slice(0, 6).map(e => <ERow key={e.id} e={e} cat={getCat(e.category_id)} mem={getMem(e.paid_by)} onClick={() => onE(e)} />)}</div>
        }
      </div>
      </div>{/* end dash-twocol */}
    </div>
  );
}

// ─── Expenses Screen ──────────────────────────────────────────────────────────
function ScreenExp({ expenses, cats, getCat, getMem, onE, isAdmin, onBulkDelete }) {
  const [filt, setFilt] = useState("all");
  const [q,    setQ]    = useState("");
  const [dateMode, setDateMode] = useState("all"); // "all" | "today" | "week" | "month"
  const [expDate, setExpDate] = useState(todayS());
  const [expWeeksBack, setExpWeeksBack] = useState(0);
  const [expMonth, setExpMonth] = useState(curM());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState(() => new Set());

  const weekStart = useMemo(() => startOfWeek(addDays(todayS(), -7 * expWeeksBack)), [expWeeksBack]);
  const weekEnd   = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const prevDay   = () => setExpDate(d => addDays(d, -1));
  const nextDay   = () => setExpDate(d => { const n = addDays(d, 1); return n > todayS() ? d : n; });
  const prevWeek  = () => setExpWeeksBack(w => Math.min(w + 1, 4));
  const nextWeek  = () => setExpWeeksBack(w => Math.max(w - 1, 0));
  const prevMonth = () => { const [y,m]=expMonth.split("-").map(Number),d=new Date(y,m-2); setExpMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const nextMonth = () => { const [y,m]=expMonth.split("-").map(Number),d=new Date(y,m);   setExpMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };

  const list = useMemo(() => {
    let r = [...expenses];
    if (dateMode === "today")      r = r.filter(e => e.date === expDate);
    else if (dateMode === "week")  r = r.filter(e => e.date >= weekStart && e.date <= weekEnd);
    else if (dateMode === "month") r = r.filter(e => e.date?.startsWith(expMonth));
    if (filt !== "all") r = r.filter(e => e.category_id === filt);
    if (q) r = r.filter(e => (e.note || "").toLowerCase().includes(q.toLowerCase()));
    return r;
  }, [expenses, dateMode, expDate, weekStart, weekEnd, expMonth, filt, q]);

  const grp = useMemo(() => {
    const g = {};
    list.forEach(e => { if (!g[e.date]) g[e.date] = []; g[e.date].push(e); });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

  const fd = d => new Date(d + "T00:00:00").toLocaleDateString("en-CA", { weekday:"short", month:"short", day:"numeric" });

  const toggleSelect = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const confirmBulkDelete = () => { onBulkDelete([...selected]); exitSelect(); };

  return (
    <div>
      <div className="hd">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ fontSize:14, fontWeight:700, color:"var(--tx)" }}>{list.length} of {expenses.length} total</p>
          {isAdmin && (
            <button onClick={() => selectMode ? exitSelect() : setSelectMode(true)} className="theme-btn">
              {selectMode ? "Cancel" : "Select"}
            </button>
          )}
        </div>
      </div>
      <div style={{ padding:"0 16px 11px" }}>
        <input className="fi" placeholder="🔍  Search…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div style={{ padding:"0 16px 12px", display:"flex", justifyContent:"center" }}>
        <RangeModeTabs mode={dateMode} setMode={setDateMode} showAll />
      </div>
      {dateMode !== "all" && (() => {
        const atToday = expDate >= todayS(), atThisWeek = expWeeksBack <= 0;
        const nav = dateMode === "today"
          ? { main: dayLabel(expDate), sub: new Date(expDate + "T00:00:00").toLocaleDateString("en-US", { weekday:"long" }), prev: shortDate(addDays(expDate, -1)), next: atToday ? null : shortDate(addDays(expDate, 1)) }
          : dateMode === "week"
          ? { main: weekRangeLabel(weekStart), sub: relWeekLabel(expWeeksBack), prev: shortDate(addDays(weekStart, -7)), next: atThisWeek ? null : shortDate(addDays(weekStart, 7)) }
          : { main: mLabel(expMonth), sub: relMonthLabel(expMonth), prev: monthShort(prevMonthStr(expMonth)), next: monthShort(nextMonthStr(expMonth)) };
        return (
          <RangeNavCard
            mainLabel={nav.main} subLabel={nav.sub} prevLabel={nav.prev} nextLabel={nav.next}
            onPrev={dateMode === "today" ? prevDay : dateMode === "week" ? prevWeek : prevMonth}
            onNext={dateMode === "today" ? nextDay : dateMode === "week" ? nextWeek : nextMonth}
            prevDisabled={dateMode === "week" && expWeeksBack >= 4}
            nextDisabled={(dateMode === "today" && atToday) || (dateMode === "week" && atThisWeek)}
          />
        );
      })()}

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
              {items.map(e => <ERow key={e.id} e={e} cat={getCat(e.category_id)} mem={getMem(e.paid_by)} onClick={() => selectMode ? toggleSelect(e.id) : onE(e)} selectMode={selectMode} selected={selected.has(e.id)} />)}
            </div>
          </div>
        ))
      }
      <div style={{ height: selectMode && selected.size > 0 ? 90 : 24 }} />

      {selectMode && selected.size > 0 && (
        // position:fixed here binds to .app (it has `transform` set, which per spec
        // establishes a containing block for fixed descendants too) rather than the
        // true viewport — same effect as .toast — so it sits above the nav bar and
        // doesn't scroll away with .scr's content.
        <div style={{ position:"fixed", left:16, right:16, bottom:88, background:"var(--p)", borderRadius:14, padding:"13px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", boxShadow:"0 4px 16px rgba(0,0,0,.25)", zIndex:150 }}>
          <span style={{ color:"#fff", fontSize:14, fontWeight:700 }}>{selected.size} selected</span>
          <button onClick={confirmBulkDelete} style={{ background:"#fff", color:"var(--rd)", border:"none", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑️ Delete</button>
        </div>
      )}
    </div>
  );
}

// ─── Budgets Screen ───────────────────────────────────────────────────────────
function ScreenBud({ buds, cats, catS, getCat, month, prevM, nextM, onEdit, onAdd }) {
  const tb = buds.reduce((s, b) => s + Number(b.limit_amount), 0);
  const ts = buds.reduce((s, b) => s + (catS[b.category_id] || 0), 0);

  return (
    <div>
      <div className="hd"><p style={{ fontSize:14, fontWeight:700, color:"var(--tx)" }}>Monthly limits per category</p></div>
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
function ScreenAdm({ cats, members, expenses, budgets, noteHist, pendingProfiles, onApprove, onDecline, onArchiveMember, getCat, getMem, onEC, onNewCat, onAM, onE, onOut, user, darkMode, toggleDark, currency, onCurrency, fontSize, onFontSize, t, setT }) {
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const isAdmin = user?.email === ADMIN_EMAIL;
  const mt = members.filter(m => !m.archived).map(m => ({ ...m, total: expenses.filter(e => e.paid_by === m.id).reduce((s, e) => s + Number(e.amount), 0), cnt: expenses.filter(e => e.paid_by === m.id).length }));
  const mx = Math.max(...mt.map(m => m.total), 1);

  // ── Reports: Week/Month range + comparisons ────────────────────────────────
  const [repMode, setRepMode] = useState("month"); // "week" | "month"
  const [repWeeksBack, setRepWeeksBack] = useState(0);
  const [repMonth, setRepMonth] = useState(curM());

  const repWeekStart = useMemo(() => startOfWeek(addDays(todayS(), -7 * repWeeksBack)), [repWeeksBack]);
  const repWeekEnd   = useMemo(() => addDays(repWeekStart, 6), [repWeekStart]);
  const repPrevWeek   = () => setRepWeeksBack(w => Math.min(w + 1, 4));
  const repNextWeek   = () => setRepWeeksBack(w => Math.max(w - 1, 0));
  const repPrevMonth  = () => { const [y,m]=repMonth.split("-").map(Number),d=new Date(y,m-2); setRepMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const repNextMonth  = () => { const [y,m]=repMonth.split("-").map(Number),d=new Date(y,m);   setRepMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };

  const repExp = useMemo(() => (
    repMode === "week"
      ? expenses.filter(e => e.date >= repWeekStart && e.date <= repWeekEnd)
      : expenses.filter(e => e.date?.startsWith(repMonth))
  ), [expenses, repMode, repWeekStart, repWeekEnd, repMonth]);

  // Same-length prior period, for the "vs last week/month" comparison
  const prevRepExp = useMemo(() => {
    if (repMode === "week") {
      const pStart = addDays(repWeekStart, -7), pEnd = addDays(repWeekEnd, -7);
      return expenses.filter(e => e.date >= pStart && e.date <= pEnd);
    }
    const [y, m] = repMonth.split("-").map(Number);
    const d = new Date(y, m - 2);
    const pMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return expenses.filter(e => e.date?.startsWith(pMonth));
  }, [expenses, repMode, repWeekStart, repWeekEnd, repMonth]);

  const repTotal     = repExp.reduce((s, e) => s + Number(e.amount), 0);
  const prevRepTotal = prevRepExp.reduce((s, e) => s + Number(e.amount), 0);
  const repChange    = prevRepTotal > 0 ? Math.round((repTotal - prevRepTotal) / prevRepTotal * 100) : null;

  const repCatS = useMemo(() => { const m = {}; repExp.forEach(e => { m[e.category_id] = (m[e.category_id] || 0) + Number(e.amount); }); return m; }, [repExp]);

  // Budgets are recurring limits (same every month) — in Week mode this
  // shows how much of the limit this single week alone has already
  // consumed (a pace check), not a month-specific budget value.
  const repOverBudget = useMemo(() => budgets
    .map(b => ({ ...b, cat: getCat(b.category_id), spent: repCatS[b.category_id] || 0 }))
    .filter(b => b.spent / b.limit_amount >= 0.8)
    .sort((a, b) => (b.spent / b.limit_amount) - (a.spent / a.limit_amount))
  , [budgets, repCatS]);

  const repBiggest = repExp.reduce((max, e) => (!max || Number(e.amount) > Number(max.amount)) ? e : max, null);

  return (
    <div>
      <div className="hd">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ fontSize:14, fontWeight:700, color:"var(--tx)" }}>{user?.email}</p>
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
          {isAdmin && pendingProfiles.length > 0 && (
            <div style={{ padding:"0 16px", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--am)", marginBottom:10 }}>⏳ Pending approval ({pendingProfiles.length})</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {pendingProfiles.map(p => (
                  <div key={p.id} style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:12, padding:13 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#1A1A2E" }}>{p.name}</div>
                    <div style={{ fontSize:12, color:"#78716C", marginBottom:10 }}>{p.email}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => onApprove(p)} style={{ flex:1, background:"var(--p)", color:"#fff", border:"none", borderRadius:8, padding:"9px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✅ Approve</button>
                      <button onClick={() => onDecline(p)} style={{ flex:1, background:"none", border:"1.5px solid #FDE68A", borderRadius:8, padding:"9px 0", fontSize:13, fontWeight:700, color:"#78716C", cursor:"pointer", fontFamily:"inherit" }}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                  {isAdmin && (
                    <button onClick={() => onArchiveMember(m.id)} style={{ width:"100%", marginTop:12, background:"none", border:"1.5px solid var(--br)", borderRadius:8, padding:"8px 0", fontSize:12, fontWeight:600, color:"var(--mu)", cursor:"pointer", fontFamily:"inherit" }}>
                      Remove member
                    </button>
                  )}
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
        <div>
          <div style={{ padding:"0 16px 12px", display:"flex", justifyContent:"center" }}>
            <RangeModeTabs mode={repMode} setMode={setRepMode} modes={["week", "month"]} />
          </div>
          <RangeNavCard
            mainLabel={repMode === "week" ? weekRangeLabel(repWeekStart) : mLabel(repMonth)}
            subLabel={repMode === "week" ? relWeekLabel(repWeeksBack) : relMonthLabel(repMonth)}
            prevLabel={repMode === "week" ? shortDate(addDays(repWeekStart, -7)) : monthShort(prevMonthStr(repMonth))}
            nextLabel={repMode === "week" ? (repWeeksBack <= 0 ? null : shortDate(addDays(repWeekStart, 7))) : monthShort(nextMonthStr(repMonth))}
            onPrev={repMode === "week" ? repPrevWeek : repPrevMonth}
            onNext={repMode === "week" ? repNextWeek : repNextMonth}
            prevDisabled={repMode === "week" && repWeeksBack >= 4}
            nextDisabled={repMode === "week" && repWeeksBack <= 0}
          />

          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>
              {repMode === "week" ? "This week" : "This month"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
              {[
                { icon:"💳", val: fmt(repTotal), lbl:"Total spent" },
                { icon:"📊", val: repExp.length, lbl:"Transactions" },
                { icon:"📅", val: fmt(repTotal / Math.max(repExp.length, 1)), lbl:"Avg/expense" },
                { icon:"🗂️", val: Object.keys(repCatS).length, lbl:"Active categories" },
              ].map((s, i) => (
                <div key={i} style={{ background:"var(--bg)", borderRadius:10, padding:13 }}>
                  <div style={{ fontSize:22, marginBottom:5 }}>{s.icon}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:"var(--tx)" }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"var(--mu)", marginTop:2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            {repChange !== null && (
              <div style={{ marginTop:13, display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700, color: repChange > 0 ? "var(--rd)" : repChange < 0 ? "var(--g)" : "var(--mu)" }}>
                <span>{repChange > 0 ? "▲" : repChange < 0 ? "▼" : "–"}</span>
                <span>{Math.abs(repChange)}% vs last {repMode === "week" ? "week" : "month"}</span>
              </div>
            )}
          </div>

          {repOverBudget.length > 0 && (
            <div className="card" style={{ marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>⚠️ Over budget watch</div>
              {repOverBudget.map(b => {
                const ov = b.spent > b.limit_amount;
                return (
                  <div key={b.id} style={{ marginBottom:13 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:17 }}>{b.cat.icon}</span>
                      <span style={{ flex:1, fontSize:14, fontWeight:600, color:"var(--tx)" }}>{b.cat.name}</span>
                      <span style={{ fontSize:13, fontWeight:700, color: ov ? "var(--rd)" : "var(--am)" }}>
                        {ov ? `Over by ${fmt(b.spent - b.limit_amount)}` : `${fmt(b.limit_amount - b.spent)} left`}
                      </span>
                    </div>
                    <div className="bb"><div className="bf" style={{ width: Math.min(b.spent / b.limit_amount * 100, 100) + "%", background: ov ? "var(--rd)" : "var(--am)" }} /></div>
                  </div>
                );
              })}
            </div>
          )}

          {repBiggest && (
            <div className="card" style={{ marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>Biggest expense</div>
              <ERow e={repBiggest} cat={getCat(repBiggest.category_id)} mem={getMem(repBiggest.paid_by)} onClick={() => onE(repBiggest)} />
            </div>
          )}

          <div className="card" style={{ marginBottom:24 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>
              Top categories ({repMode === "week" ? "this week" : "this month"})
            </div>
            {Object.keys(repCatS).length === 0
              ? <div style={{ fontSize:13, color:"var(--mu)" }}>No expenses in this period yet.</div>
              : Object.entries(repCatS).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, amt]) => {
                const c = getCat(id);
                return (
                  <div key={id} style={{ marginBottom:13 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:17 }}>{c.icon}</span>
                      <span style={{ flex:1, fontSize:14, fontWeight:600, color:"var(--tx)" }}>{c.name}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:"var(--tx)" }}>{fmt(amt)}</span>
                      <span style={{ fontSize:11, color:"var(--mu)" }}>{Math.round(amt / repTotal * 100)}%</span>
                    </div>
                    <div className="lbb"><div className="lb" style={{ width: (amt / repTotal * 100) + "%", background: c.color }} /></div>
                  </div>
                );
              })
            }
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
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:4 }}>Text size</div>
            <div style={{ fontSize:12, color:"var(--mu)", marginBottom:14 }}>Make everything bigger and easier to read</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {FONT_SIZES.map(f => (
                <button key={f.id} onClick={() => onFontSize(f.id)} style={{ flex:"1 1 auto", padding:"10px 6px", borderRadius:10, border:`1.5px solid ${fontSize === f.id ? "var(--p)" : "var(--br)"}`, background: fontSize === f.id ? "var(--ps)" : "var(--bg)", cursor:"pointer", fontFamily:"inherit" }}>
                  <div style={{ fontSize: 13 * f.scale, fontWeight: fontSize === f.id ? 800 : 600, color: fontSize === f.id ? "var(--p)" : "var(--tx)" }}>Aa</div>
                  <div style={{ fontSize:11, color:"var(--mu)", marginTop:4 }}>{f.lbl}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ margin:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:14 }}>Currency</div>
            <div onClick={() => setCurrencyOpen(o => !o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 13px", borderRadius:10, border:"1.5px solid var(--p)", background:"var(--ps)", cursor:"pointer" }}>
              <div>
                <span style={{ fontSize:14, fontWeight:600, color:"var(--tx)" }}>{currency.symbol} — {currency.code}</span>
                <span style={{ fontSize:12, color:"var(--mu)", marginLeft:8 }}>{currency.name}</span>
              </div>
              <span style={{ color:"var(--p)", fontWeight:700, fontSize:12, transform: currencyOpen ? "rotate(180deg)" : "none", display:"inline-block" }}>▾</span>
            </div>
            {currencyOpen && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
                {CURRENCIES.filter(c => c.code !== currency.code).map(c => (
                  <div key={c.code} onClick={() => { onCurrency(c); setCurrencyOpen(false); }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 13px", borderRadius:10, border:"1.5px solid var(--br)", background:"var(--bg)", cursor:"pointer" }}>
                    <div>
                      <span style={{ fontSize:14, fontWeight:600, color:"var(--tx)" }}>{c.symbol} — {c.code}</span>
                      <span style={{ fontSize:12, color:"var(--mu)", marginLeft:8 }}>{c.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ margin:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--tx)", marginBottom:8 }}>Note suggestions</div>
            {noteHist.length === 0
              ? (
                <div style={{ fontSize:13, color:"var(--mu)", lineHeight:1.5 }}>
                  No learned phrases yet. If you've already added expenses with notes and still see this, the <code>note_history</code> table probably hasn't been created — run <strong>note-history.sql</strong> in your Supabase SQL Editor once.
                </div>
              )
              : <div style={{ fontSize:13, color:"var(--mu)" }}>{noteHist.length} learned phrase{noteHist.length === 1 ? "" : "s"} across {new Set(noteHist.map(h => h.category_id)).size} categories</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared: Expense Row ──────────────────────────────────────────────────────
function ERow({ e, cat, mem, onClick, selectMode, selected }) {
  return (
    <div className="er" onClick={onClick}>
      {selectMode && (
        <div style={{ width:22, height:22, borderRadius:6, border: selected ? "none" : "2px solid var(--br)", background: selected ? "var(--p)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#fff", fontSize:13, fontWeight:800 }}>
          {selected && "✓"}
        </div>
      )}
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
function ModalAdd({ cats, members, noteHist, isAdmin, onSave, onClose }) {
  const [amt,  setAmt]  = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayS());
  const [cid,  setCid]  = useState(cats[0]?.id || "");
  const [pid,  setPid]  = useState(members[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [pickingCat, setPickingCat] = useState(true);
  const selectedCat = cats.find(c => c.id === cid);
  const minDate = isAdmin ? "" : addDays(todayS(), -30); // 30-day backdate limit for non-admin

  const suggestions = useMemo(() => {
    const lines = note.split("\n");
    const buf = lines[lines.length - 1].trim().toLowerCase();
    return noteSuggestions(buf, noteHist, cid);
  }, [note, noteHist, cid]);

  const pickSuggestion = s => {
    const lines = note.split("\n");
    lines[lines.length - 1] = s;
    setNote(lines.join("\n") + "\n");
  };

  const go = async () => {
    if (!amt || isNaN(+amt)) return;
    if (!isAdmin && minDate && date < minDate) return; // silently blocked — the date picker min attr already prevents this visually
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
            <input style={{ width:"100%", maxWidth:170, minWidth:0, fontSize:30, fontWeight:800, color:"var(--tx)", border:"none", background:"none", outline:"none", textAlign:"center", fontFamily:"inherit" }} type="number" inputMode="decimal" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} autoFocus />
          </div>
        </div>

        {cats.length > 0 && (
          <div className="fg">
            <label className="fl">Category</label>
            {pickingCat ? (
              <div className="cg">
                {cats.map(c => (
                  <div key={c.id} className={`ci${cid === c.id ? " on" : ""}`} onClick={() => { setCid(c.id); setPickingCat(false); }}>
                    <div style={{ fontSize:26 }}>{c.icon}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--mu)", textAlign:"center", lineHeight:1.2 }}>{c.name}</div>
                  </div>
                ))}
              </div>
            ) : selectedCat && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                <div style={{ width:"50%", minWidth:150, display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:"22px 10px", borderRadius:16, border:"2.5px solid var(--p)", background:"var(--ps)" }}>
                  <div style={{ fontSize:42 }}>{selectedCat.icon}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"var(--tx)", textAlign:"center", lineHeight:1.3 }}>{selectedCat.name}</div>
                </div>
                <button type="button" className="chip" onClick={() => setPickingCat(true)}>Change category</button>
              </div>
            )}
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
        <div className="fg">
          <label className="fl">Date{!isAdmin && <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, marginLeft:6, color:"var(--mu)" }}>— up to 30 days back</span>}</label>
          <input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)} min={minDate} max={todayS()} style={{ display:"block", width:"90%", maxWidth:"90%", margin:"0 auto" }} />
        </div>

        {members.length === 0 && <div style={{ background:"#FFFBEB", borderRadius:8, padding:11, fontSize:13, color:"var(--am)", marginBottom:14 }}>⚠️ Add a family member first in Manage → Members</div>}

        <button className="bp" onClick={go} disabled={!amt || busy || members.length === 0}>{busy ? "Saving…" : "Save expense"}</button>
      </div>
    </div>
  );
}

// ─── Modal: Expense Detail ────────────────────────────────────────────────────
function ModalDet({ exp, getCat, getMem, onDel, onClose, user, isAdmin }) {
  const cat = getCat(exp.category_id);
  const mem = getMem(exp.paid_by);
  const isOwn = exp.created_by && exp.created_by === user?.id;
  const withinWindow = exp.created_at && (Date.now() - new Date(exp.created_at).getTime()) < 30 * 24 * 3600 * 1000;
  const canDelete = isAdmin || (isOwn && withinWindow);
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
        {canDelete
          ? <button className="bd" onClick={() => onDel(exp.id)}>🗑️  Delete expense</button>
          : <div style={{ background:"var(--bg)", border:"1.5px solid var(--br)", borderRadius:10, padding:11, fontSize:12, color:"var(--mu)", textAlign:"center" }}>
              🔒 {isOwn ? "Only deletable within 30 days of adding it" : "Only the account owner can delete this expense"}
            </div>
        }
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
function ModalBud({ bud, cats, onSave, onClose }) {
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
            <input className="fi" type="number" inputMode="decimal" placeholder="200.00" value={lim} onChange={e => setLim(e.target.value)} style={{ fontSize:21, fontWeight:700 }} />
          </div>
        </div>
        <button className="bp" onClick={() => { if (lim) onSave({ ...bud, category_id: cid, limit_amount: +lim }); }} disabled={!lim}>Save budget</button>
        <div style={{ height:9 }} /><button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
