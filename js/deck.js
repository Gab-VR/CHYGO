// deck.js
import { isExtra, sortKey } from "./cards.js";
import { limitLabel, limitOf, totalCopies } from "./legality.js";
import { card, changed, deck, fmt, S } from "./store.js";
import { emit, toast, uid } from "./util.js";

const DEFAULT_CATS = [
  ["Starter", "#e6b24a"], ["Extender", "#5aa7e8"], ["Follow-up", "#a68bf0"], ["Hand trap", "#62c78f"], ["Brick", "#e0665c"]
];
function newDeck(name = "New deck") {
  const cats = DEFAULT_CATS.map(([n, c]) => ({ id: uid(), name: n, color: c, builtin: true }));
  const [st, ex, , , br] = cats;
  return { id: uid(), name, main: {}, extra: {}, side: {}, order: {}, tags: {}, cats, catsV: 2, hand: 5, swPool: [],
    scen: [
      { id: uid(), name: "Can play", conds: [{ cat: st.id, op: ">=", n: 1 }] },
      { id: uid(), name: "Starter + extender", conds: [{ cat: st.id, op: ">=", n: 1 }, { cat: ex.id, op: ">=", n: 1 }] },
      { id: uid(), name: "Brick-free opener", conds: [{ cat: st.id, op: ">=", n: 1 }, { cat: br.id, op: "<=", n: 0 }] }
    ] };
}
const SECTIONS = ["main", "extra", "side"];
// Custom order: one list of passcodes per section; cards missing from it go at the end in card-type order.
function ensureOrder(d = deck()) {
  d.order ||= {};
  for (const s of SECTIONS) {
    const ids = Object.keys(d[s]).map(Number), have = new Set(ids);
    const kept = (d.order[s] || []).filter(id => have.has(id)), inList = new Set(kept);
    const rest = ids.filter(id => !inList.has(id)).map(card).filter(Boolean).sort((a, b) => sortKey(a).localeCompare(sortKey(b))).map(c => c.id);
    d.order[s] = kept.concat(rest);
  }
  return d.order;
}
function placeInOrder(d, sec, id, before) {
  const o = ensureOrder(d)[sec].filter(x => x !== id);
  const i = before != null ? o.indexOf(+before) : -1;
  i >= 0 ? o.splice(i, 0, id) : o.push(id);
  d.order[sec] = o;
}
function add(id, sec, n = 1, opt = {}) {
  const d = deck(), c = card(id); if (!c) return false;
  id = c.id;
  if (!sec) sec = isExtra(c) ? "extra" : "main";
  if (sec === "main" && isExtra(c)) sec = "extra";
  if (sec === "extra" && !isExtra(c)) sec = "main";
  if (n > 0 && !S.ui.overrideLimit) {
    const l = limitOf(c), have = totalCopies(d, id);
    if (have + n > l) {
      const lab = limitLabel(c);
      toast(l === 0 ? `${c.name} is ${lab ? lab.text : "not allowed"} in ${fmt().name}.`
        : `${c.name} is ${lab ? lab.text : `limited to ${l}`} (${l} cop${l === 1 ? "y" : "ies"}). Turn on "Override card limit" to add more.`);
      S.sel = id; emit("select"); return false;
    }
  }
  const isNew = !d[sec][id];
  d[sec][id] = (d[sec][id] || 0) + n;
  if (d[sec][id] <= 0) { delete d[sec][id]; ensureOrder(d); }
  else if (isNew || opt.before != null) placeInOrder(d, sec, id, opt.before);
  S.sel = id; if (!opt.quiet) changed(); return true;
}
function move(id, from, to, before) {
  const d = deck(); if (!d[from][id]) return;
  add(id, from, -1, { quiet: true });
  if (!add(id, to, 1, { before, quiet: true })) add(id, from, 1, { quiet: true });   // put it back if refused
  changed();
}
function reorder(sec, id, before) { if (+id === +before) return; placeInOrder(deck(), sec, +id, before); changed(); }
/* ---- categories: the five built-ins plus up to five of your own ---- */
const MAX_CUSTOM_CATS = 5;
const customCats = d => d.cats.filter(k => !k.builtin);
function addCategory(d, name) {
  if (customCats(d).length >= MAX_CUSTOM_CATS) { toast(`You can add up to ${MAX_CUSTOM_CATS} custom categories.`); return null; }
  const used = new Set(d.cats.map(k => k.color));
  const color = ["#e87fb0", "#6fd0d0", "#c9d45a", "#f0955a", "#8fa6ff", "#b98a6a"].find(c => !used.has(c)) || "#bbbbbb";
  const k = { id: uid(), name: name.trim().slice(0, 24) || "New category", color };
  d.cats.push(k); return k;
}
// A card's box in the Categories view: the first of its categories in list order.
function primaryCat(d, id) { const t = d.tags[id] || []; return d.cats.find(k => t.includes(k.id)) || null; }

export { add, addCategory, customCats, DEFAULT_CATS, ensureOrder, MAX_CUSTOM_CATS, move, newDeck, placeInOrder, primaryCat, reorder, SECTIONS };
