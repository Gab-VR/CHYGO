// tabs/hands.js
import { frameColor, sortKey } from "../cards.js";
import { addCategory, customCats, MAX_CUSTOM_CATS, removeCategory } from "../deck.js";
import { handOdds, sampleHand } from "../prob.js";
import { card, deck, save } from "../store.js";
import { catChips, tile } from "../ui.js";
import { $, $$, h, pct, uid } from "../util.js";

/* ================= hands tab ================= */
let lastSample = null;
function resetSample() { lastSample = null; }
function renderHands() {
  const root = $("#tab-hands"), d = deck(), hs = d.hand;
  const odds = handOdds(d, hs);
  const rerender = () => { save(); renderHands(); };
  // categories
  const cats = h("div", { class: "panel" },
    h("h2", {}, "Categories"),
    h("p", { class: "dim", style: { fontSize: "13px" } }, "A card can belong to several categories. Overlaps are handled exactly."),
    d.cats.map(k => h("div", { class: "cat-row" },
      h("input", { type: "color", value: k.color, "aria-label": "Colour", oninput: e => { k.color = e.target.value; save(); }, onchange: rerender }),
      k.builtin ? h("span", { class: "grow", style: { padding: "5px 8px" }, title: k.hint || "" }, k.name,
        k.hint && k.name === "Half Starter" ? h("span", { class: "dim", style: { fontSize: "11px" } }, " (needs a fodder)") : null)
        : h("input", { value: k.name, class: "grow", maxlength: 24, "aria-label": "Category name", onchange: e => { k.name = e.target.value.trim() || k.name; rerender(); } }),
      k.builtin ? null : h("button", { class: "small ghost", title: "Delete category", onclick: () => {
        removeCategory(d, k.id); rerender(); } }, "✕"))),
    h("div", { class: "row" },
      h("button", { disabled: customCats(d).length >= MAX_CUSTOM_CATS, onclick: () => { if (addCategory(d, "New category")) rerender(); } }, "Add category"),
      h("span", { class: "dim", style: { fontSize: "12px" } }, `${customCats(d).length} of ${MAX_CUSTOM_CATS} custom`)),
    h("h3", { style: { marginTop: "16px" } }, "Hand size"),
    h("div", { class: "row" },
      h("div", { class: "seg" }, [[5, "Going first"], [6, "Going second"]].map(([n, l]) => h("button", { "aria-pressed": hs === n, onclick: () => { d.hand = n; rerender(); } }, l))),
      h("input", { type: "number", min: 1, max: 20, value: hs, style: { width: "64px" }, "aria-label": "Hand size", onchange: e => { d.hand = Math.max(1, +e.target.value || 5); rerender(); } })),
    h("h3", { style: { marginTop: "16px" } }, "Per category"),
    h("table", {}, h("tr", {}, h("th", {}, ""), h("th", { class: "num" }, "copies"), h("th", { class: "num" }, "≥1"), h("th", { class: "num" }, "≥2"), h("th", { class: "num" }, "avg")),
      d.cats.map((k, j) => {
        const copies = Object.entries(d.main).reduce((a, [id, n]) => a + ((d.tags[id] || []).includes(k.id) ? n : 0), 0), r = odds.cat[j];
        return h("tr", {}, h("td", {}, h("span", { style: { color: k.color } }, "● "), k.name), h("td", { class: "num" }, copies),
          h("td", { class: "num" }, pct(r.ge1)), h("td", { class: "num" }, pct(r.ge2)), h("td", { class: "num" }, r.e.toFixed(2)));
      })));
  // assignment
  const rows = Object.entries(d.main).map(([id, n]) => [card(id), n]).filter(([c]) => c).sort((a, b) => sortKey(a[0]).localeCompare(sortKey(b[0])));
  const assign = h("div", { class: "panel" },
    h("h2", {}, "Tag your Main Deck"),
    rows.length ? h("table", {}, rows.map(([c, n]) => h("tr", {},
      h("td", { style: { width: "40%" } }, h("span", { style: { color: frameColor(c) } }, "▍"), c.name, h("span", { class: "dim" }, ` ×${n}`)),
      h("td", {}, catChips(c.id, rerender)))))
      : h("p", { class: "dim" }, "Your Main Deck is empty. Add cards in the Build tab, then tag them here."));
  // scenarios
  const catOpts = sel => d.cats.map(k => h("option", { value: k.id, selected: k.id === sel }, k.name));
  const scen = h("div", { class: "panel" },
    h("h2", {}, "Hands you want"),
    h("p", { class: "dim", style: { fontSize: "13px" } }, `Each scenario needs all of its conditions. Drawing ${hs} from ${odds.N} cards.`),
    h("div", { class: "row", style: { margin: "8px 0 12px" } }, h("div", { class: "big" }, odds.N >= hs && d.scen.length ? pct(odds.any) : "–"), h("div", { class: "dim" }, "chance to open at least one of these scenarios")),
    d.scen.map((s, i) => h("div", { class: "scen" },
      h("div", { class: "row" }, h("input", { value: s.name, class: "grow", "aria-label": "Scenario name", onchange: e => { s.name = e.target.value; save(); } }),
        h("span", { class: "p" }, odds.N >= hs && s.conds.length ? pct(odds.scen[i]) : "–"),
        h("button", { class: "small ghost", title: "Delete scenario", onclick: () => { d.scen.splice(i, 1); rerender(); } }, "✕")),
      s.conds.map((c, ci) => h("div", { class: "cond" },
        h("select", { onchange: e => { c.cat = e.target.value; rerender(); }, "aria-label": "Category" }, catOpts(c.cat)),
        h("select", { onchange: e => { c.op = e.target.value; rerender(); }, "aria-label": "Comparison" }, [[">=", "at least"], ["<=", "at most"], ["=", "exactly"]].map(([v, l]) => h("option", { value: v, selected: c.op === v }, l))),
        h("input", { type: "number", min: 0, max: 20, value: c.n, style: { width: "56px" }, "aria-label": "Count", onchange: e => { c.n = Math.max(0, +e.target.value || 0); rerender(); } }),
        h("button", { class: "small ghost", title: "Remove condition", onclick: () => { s.conds.splice(ci, 1); rerender(); } }, "✕"))),
      d.cats.length ? h("button", { class: "small", onclick: () => { s.conds.push({ cat: d.cats[0].id, op: ">=", n: 1 }); rerender(); } }, "Add condition") : null)),
    h("button", { onclick: () => { d.scen.push({ id: uid(), name: "New scenario", conds: d.cats.length ? [{ cat: d.cats[0].id, op: ">=", n: 1 }] : [] }); rerender(); } }, "Add scenario"),
    h("h3", { style: { marginTop: "18px" } }, "Test hand"),
    h("button", { disabled: odds.N < hs, onclick: () => { lastSample = sampleHand(d, hs); renderHands(); } }, "Draw a hand"),
    lastSample ? h("div", { class: "hand-sample" }, lastSample.map(id => card(id)).filter(Boolean).map(c => tile(c, 1, "main"))) : null);
  root.className = "tab on hands"; root.replaceChildren(cats, assign, scen);
  $$(".hand-sample .cnt", root).forEach(e => e.remove());
}

export { lastSample, renderHands, resetSample };
