// tabs/build.js
import { frameColor, isExtra, isLink, isMonster, isSpell, isTrap, kindRank, levelOf, releaseDate, sortKey, statOk, subLine } from "../cards.js";
import { add, addCategory, customCats, MAX_CUSTOM_CATS, move, newDeck, primaryCat } from "../deck.js";
import { artPos, hideBroken, IMG_ART, IMG_FULL, imgOn } from "../images.js";
import { inPool, limitLabel, limitOf, pointsOf, totalCopies } from "../legality.js";
import { card, changed, deck, fmt, S, save } from "../store.js";
import { bubbles, catChips, dragData, dropData, dropZone, imageSelect, imageStatus, tile } from "../ui.js";
import { EMPTY_HINT, orderedItems, sectionHeader, sheetView, tableSection } from "./deckviews.js";
import { $, $$, h, toast, uid } from "../util.js";
import { exportYdk, fromYdke, importDeck, toYdke } from "../ydk.js";

/* ================= build tab ================= */
const Q = { q: "", kind: "all", attr: "", race: "", lvMin: "", lvMax: "", atk: "", def: "", arch: "", legal: false, limit: 150 };
function searchCards() {
  const words = Q.q.toLowerCase().split(/\s+/).filter(Boolean), arch = Q.arch.toLowerCase();
  const out = [];
  for (const c of S.list) {
    if (Q.kind === "monster" && !(isMonster(c) && !isExtra(c))) continue;
    if (Q.kind === "extra" && !isExtra(c)) continue;
    if (Q.kind === "spell" && !isSpell(c)) continue;
    if (Q.kind === "trap" && !isTrap(c)) continue;
    if (Q.attr && c.attr !== Q.attr) continue;
    if (Q.race && c.race !== Q.race) continue;
    if (Q.lvMin !== "" && !(c.level >= +Q.lvMin)) continue;
    if (Q.lvMax !== "" && !(c.level <= +Q.lvMax)) continue;
    if (Q.atk !== "" && c.atk !== +Q.atk) continue;
    if (Q.def !== "" && c.def !== +Q.def) continue;
    if (arch && !(c.arch || "").toLowerCase().includes(arch)) continue;
    if (words.length) {
      const hay = S.ui.textSearch ? (c.name + " " + c.desc).toLowerCase() : c.name.toLowerCase();
      if (!words.every(w => hay.includes(w))) continue;
    }
    if (Q.legal && (limitOf(c) === 0 || !inPool(c))) continue;
    out.push(c);
  }
  return out;
}
function resultRow(c) {
  // Left click only shows the card; right click adds to Main/Extra, middle click adds to Side.
  const select = () => { S.sel = c.id; $$(".res.sel").forEach(r => r.classList.remove("sel")); row.classList.add("sel"); renderDetail(); };
  const row = h("div", { class: "res" + (S.sel === c.id ? " sel" : ""), draggable: true, tabindex: 0,
    title: `${c.name}\nClick to view. Right-click adds to the ${isExtra(c) ? "Extra" : "Main"} Deck, middle-click adds to the Side Deck, or drag it.`,
    ondragstart: e => dragData(e, c.id, null),
    onclick: select,
    oncontextmenu: e => { e.preventDefault(); add(c.id, null); },
    onmousedown: e => { if (e.button === 1) e.preventDefault(); },          // stop the middle-button autoscroll
    onauxclick: e => { if (e.button === 1) { e.preventDefault(); add(c.id, "side"); } },
    onkeydown: e => { if (e.key === "Enter") select(); else if (e.key === "+") add(c.id, null); else if (e.key.toLowerCase() === "s") add(c.id, "side"); } },
    imgOn() && IMG_ART(c.id) ? h("img", { src: IMG_ART(c.id), alt: "", loading: "lazy", style: Object.assign({ background: frameColor(c) }, artPos().backgroundSize ? { objectPosition: "50% 28%" } : {}), onerror: e => { e.target.replaceWith(h("span", { class: "sw", style: { background: frameColor(c) } })); } }) : h("span", { class: "sw", style: { background: frameColor(c) } }),
    h("div", { style: { minWidth: 0 } }, h("div", { class: "nm" }, c.name), h("div", { class: "sub" }, subLine(c))),
    bubbles(c));
  return row;
}
const byName = (a, b) => a.name.localeCompare(b.name);
const byType = (a, b) => sortKey(a).localeCompare(sortKey(b));
const SEARCH_SORTS = {
  alpha: { label: "Alphabetic" },
  date:  { label: "Release date", key: releaseDate, grouped: false },
  atk:   { label: "ATK", key: c => statOk(c.atk) ? c.atk : null, grouped: true },
  def:   { label: "DEF", key: c => isLink(c) || !statOk(c.def) ? null : c.def, grouped: true },
  level: { label: "Level / Rank / Rating", key: c => levelOf(c) ?? null, grouped: true }
};
function sortResults(res, mode, dir) {
  const s = SEARCH_SORTS[mode] || SEARCH_SORTS.alpha, sign = dir === "desc" ? -1 : 1;
  if (!s.key) return res.sort((a, b) => sign * byName(a, b));
  return res.sort((a, b) => {
    if (s.grouped) { const g = kindRank(a) - kindRank(b); if (g) return g; }
    const ka = s.key(a), kb = s.key(b);
    if (ka == null || kb == null) return ka == null && kb == null ? byName(a, b) : ka == null ? 1 : -1;   // missing: always last
    return sign * (ka < kb ? -1 : ka > kb ? 1 : 0) || byName(a, b);
  });
}
function renderResults() {
  const box = $("#results"); if (!box) return;
  const res = sortResults(searchCards(), S.ui.searchSort, S.ui.searchDir);
  $("#resCount").textContent = `${res.length} card${res.length === 1 ? "" : "s"}`;
  box.replaceChildren(...res.slice(0, Q.limit).map(resultRow),
    res.length > Q.limit ? h("button", { class: "ghost", style: { width: "100%" }, onclick: () => { Q.limit += 150; renderResults(); } }, "Show more") : null);
}
/* Dropping a card on a category box: move it to that section if needed, then swap the category it
   was shown under for the new one ("Not in a category" clears its categories). */
function dropOnCategory(data, key, k) {
  if (!data) return;
  const d = deck(), c = card(data.id); if (!c) return;
  if (data.from !== key) {
    if (data.from) move(c.id, data.from, key); else if (!add(c.id, key, 1, { quiet: true })) return;
  }
  if (!d[key][c.id] && !(isExtra(c) && key === "main")) { changed(); return; }   // e.g. refused by the card limit
  let tags = d.tags[c.id] || [];
  if (!k) tags = [];
  else { const was = data.cat ?? (primaryCat(d, c.id) || {}).id; tags = tags.filter(t => t !== was && t !== k.id); tags.unshift(k.id); }
  d.tags[c.id] = tags; S.sel = c.id; changed();
}
/* Categories view: Main Deck cards in one box per category (drag between boxes to recategorize);
   the Extra and Side Deck as tiles in the deck's own order. */
function sectionEl(key, label, extraInfo) {
  const d = deck(), mode = key === "main" ? "cats" : "custom";
  const items = orderedItems(d, key);
  let body;
  if (!items.length) body = h("div", { class: "grid" }, h("div", { class: "empty" }, EMPTY_HINT[key]));
  else if (mode === "cats") body = null;
  if (mode === "cats") {
    // Every category gets a box, even when empty, so cards can be dragged between them.
    const groups = new Map(d.cats.map(k => [k.id, []])), none = [];
    for (const it of items) { const k = primaryCat(d, it[0].id); k ? groups.get(k.id).push(it) : none.push(it); }
    const box = (k, its) => {
      const el = h("div", { class: "catbox" + (its.length ? "" : " empty-box"), style: { "--c": k ? k.color : "#8b8fa3" },
        ondragover: e => { e.preventDefault(); e.stopPropagation(); el.classList.add("drop"); },
        ondragleave: e => { if (!el.contains(e.relatedTarget)) el.classList.remove("drop"); },
        ondrop: e => { e.preventDefault(); e.stopPropagation(); el.classList.remove("drop"); dropOnCategory(dropData(e), key, k); },
        title: its.length ? null : `Drag cards here to put them in ${k ? k.name : "no category"}` },
        h("div", { class: "catbox-h" }, h("b", {}, k ? k.name : "Not in a category"),
          h("span", { class: "dim" }, its.length ? (n => `${n} card${n === 1 ? "" : "s"}`)(its.reduce((a, [, n]) => a + n, 0)) : "Drag cards here")),
        its.length ? h("div", { class: "grid" }, its.map(([c, n]) => tile(c, n, key, k))) : null);
      return el;
    };
    const full = d.cats.filter(k => groups.get(k.id).length), empty = d.cats.filter(k => !groups.get(k.id).length);
    body = [...full.map(k => box(k, groups.get(k.id))), none.length ? box(null, none) : null,
      h("div", { class: "empty-boxes" }, empty.map(k => box(k, [])), none.length ? null : box(null, []))];
  }
  if (!body && mode !== "cats") body = h("div", { class: "grid" }, items.map(([c, n]) => tile(c, n, key)));
  return dropZone(h("div", { class: "section" }, sectionHeader(label, key, extraInfo), body), key);
}
function mainInfo() {
  const d = deck(); let m = 0, s = 0, t = 0;
  for (const [id, n] of Object.entries(d.main)) { const c = card(id); if (!c) continue; isMonster(c) ? m += n : isSpell(c) ? s += n : t += n; }
  return `  (${m} monsters, ${s} spells, ${t} traps)`;
}
function setDirButton(b) {
  const desc = S.ui.searchDir === "desc";
  b.textContent = desc ? "▼" : "▲";
  b.title = desc ? "Descending (click for ascending)" : "Ascending (click for descending)";
  b.setAttribute("aria-label", desc ? "Sort descending" : "Sort ascending");
}
const DECK_VIEWS = [
  ["table", "Table", "Every card as a full miniature"],
  ["sheet", "Sheet", "Decklist form you can fill in and export as a PDF"],
  ["cats", "Categories", "Main Deck grouped by category"]
];
function deckView() {
  const view = S.ui.deckView;
  if (view === "sheet") return [sheetView()];
  const section = view === "cats" ? sectionEl : tableSection;
  return [section("main", "Main Deck", mainInfo()), section("extra", "Extra Deck"), section("side", "Side Deck")];
}
function renderBuild() {
  const root = $("#tab-build"), d = deck(), f = fmt();
  const keepFocus = document.activeElement && document.activeElement.id;
  if (!$("#results", root)) {
    const inp = (k, attrs = {}) => h("input", Object.assign({ value: Q[k], oninput: e => { Q[k] = e.target.value; Q.limit = 150; renderResults(); } }, attrs));
    const sel = (k, opts, attrs = {}) => h("select", Object.assign({ onchange: e => { Q[k] = e.target.value; Q.limit = 150; renderResults(); } }, attrs), opts.map(([v, l]) => h("option", { value: v, selected: Q[k] === v }, l)));
    const search = h("aside", { class: "panel search" },
      h("div", { class: "row" }, h("h2", { class: "grow" }, "Search"), h("span", { class: "dim", id: "resCount" })),
      h("div", { class: "filters" },
        inp("q", { id: "q", class: "full", placeholder: "Card name", type: "search", "aria-label": "Card name" }),
        sel("kind", [["all", "All cards"], ["monster", "Main Deck monsters"], ["extra", "Extra Deck"], ["spell", "Spells"], ["trap", "Traps"]], { "aria-label": "Card kind" }),
        sel("attr", [["", "Any attribute"], ...["DARK","LIGHT","EARTH","WATER","FIRE","WIND","DIVINE"].map(a => [a, a])], { "aria-label": "Attribute" }),
        sel("race", [["", "Any type"], ...S.races.map(r => [r, r])], { "aria-label": "Monster type" }),
        inp("arch", { placeholder: "Archetype", "aria-label": "Archetype" }),
        inp("lvMin", { type: "number", placeholder: "Level from", min: 0, max: 13, "aria-label": "Minimum level" }),
        inp("lvMax", { type: "number", placeholder: "Level to", min: 0, max: 13, "aria-label": "Maximum level" }),
        inp("atk", { type: "number", placeholder: "ATK =", step: 50, "aria-label": "ATK" }),
        inp("def", { type: "number", placeholder: "DEF =", step: 50, "aria-label": "DEF" }),
        h("label", { class: "row" },
          h("input", { type: "checkbox", checked: S.ui.textSearch, onchange: e => { S.ui.textSearch = e.target.checked; save(); renderResults(); } }), "Match card text"),
        h("label", { class: "row" },
          h("input", { type: "checkbox", checked: Q.legal, onchange: e => { Q.legal = e.target.checked; renderResults(); } }), "Legal only"),
        h("div", { class: "row full" }, h("label", { for: "searchSort" }, "Sort"),
          h("select", { id: "searchSort", class: "grow", onchange: e => { S.ui.searchSort = e.target.value; save(); renderResults(); } },
            Object.entries(SEARCH_SORTS).map(([v, s]) => h("option", { value: v, selected: S.ui.searchSort === v }, s.label))),
          h("button", { class: "dir", id: "searchDir", "aria-label": "Sort direction", onclick: e => {
            S.ui.searchDir = S.ui.searchDir === "desc" ? "asc" : "desc"; save(); setDirButton(e.currentTarget); renderResults(); } }))),
      h("div", { id: "results", class: "results" }));
    root.replaceChildren(search, h("div", { id: "deckArea" }), h("aside", { id: "detail", class: "panel detail" }));
    root.className = "tab on build";
    setDirButton($("#searchDir")); renderResults();
  }
  // deck area
  $("#deckArea", root).replaceChildren(
    h("div", { class: "deckbar" },
      h("button", { onclick: () => { const n = newDeck(); S.decks.push(n); S.deckId = n.id; S.sel = null; changed(); } }, "New deck"),
      h("button", { onclick: () => { const n = prompt("Deck name", d.name); if (n) { d.name = n.trim() || d.name; changed(); } } }, "Rename"),
      h("button", { onclick: () => { const c = JSON.parse(JSON.stringify(d)); c.id = uid(); c.name = d.name + " (copy)"; S.decks.push(c); S.deckId = c.id; changed(); } }, "Duplicate"),
      h("button", { onclick: () => { if (!confirm(`Delete "${d.name}"?`)) return; S.decks = S.decks.filter(x => x !== d); if (!S.decks.length) S.decks.push(newDeck()); S.deckId = S.decks[0].id; changed(); } }, "Delete"),
      h("span", { class: "grow" }),
      h("button", { onclick: () => $("#fileIn").click() }, "Import .ydk"),
      h("button", { onclick: exportYdk }, "Export .ydk"),
      h("button", { onclick: ydkeDialog }, "YDKE"),
      h("label", { class: "row" }, "Images", imageSelect()),
      imageStatus(),
      h("span", { style: { flexBasis: "100%", height: 0 } }),
      h("div", { class: "seg", role: "group", "aria-label": "Deck view" }, DECK_VIEWS.map(([v, l, tip]) =>
        h("button", { "aria-pressed": S.ui.deckView === v, title: tip, onclick: () => { S.ui.deckView = v; save(); renderBuild(); } }, l))),
      h("span", { class: "dim imgnote" }, "Drag cards to reorder. Right-click removes one."),
      h("span", { class: "grow" }),
      h("button", { class: "toggle", "aria-pressed": !!S.ui.overrideLimit, title: "Allow more copies than the format's limit (the deck is still flagged as illegal)",
        onclick: () => { S.ui.overrideLimit = !S.ui.overrideLimit; save(); renderBuild(); toast(S.ui.overrideLimit ? "Card limits overridden" : "Card limits enforced"); } }, "Override card limit")),
    ...deckView(),);
  renderDetail();
  if (keepFocus === "q") $("#q").focus();
}
function extraInfo(c) {
  const rows = [["Passcode", c.id]];
  if (c.alts && c.alts.length) rows.push(["Alternate artworks", c.alts.join(", ")]);
  if (c.tcg) rows.push(["TCG release", c.tcg]);
  if (c.ocg) rows.push(["OCG release", c.ocg]);
  if (c.arch) rows.push(["Archetype", c.arch]);
  let prints;
  if (!S.setNames) prints = h("p", { class: "dim" }, "Printing details arrive with the next card-data update.");
  else if (!c.sets || !c.sets.length) prints = h("p", { class: "dim" }, "No printings recorded. The card may be OCG-only or not released yet.");
  else prints = h("div", { class: "prints" }, h("table", {},
    h("tr", {}, h("th", {}, "Set"), h("th", {}, "Code"), h("th", {}, "Rarity")),
    c.sets.map(([code, si, ri]) => h("tr", {}, h("td", {}, S.setNames[si] || "?"), h("td", { class: "code" }, code), h("td", {}, S.rarities[ri] || "")))));
  return h("details", { class: "xinfo", open: S.ui.xinfoOpen !== false, ontoggle: e => { S.ui.xinfoOpen = e.target.open; save(); } },
    h("summary", {}, h("h3", {}, "Extra information")),
    h("table", { class: "kv" }, rows.map(([k, v]) => h("tr", {}, h("th", {}, k), h("td", {}, String(v))))),
    h("h3", { style: { fontSize: "14px", margin: "10px 0 4px" } }, `Printings${c.sets && c.sets.length ? ` (${c.sets.length})` : ""}`), prints);
}
function renderDetail() {
  const box = $("#detail"); if (!box) return;
  const c = S.sel && card(S.sel), d = deck(), f = fmt();
  if (!c) return box.replaceChildren(h("h2", {}, "Card"), h("p", { class: "dim" }, "Select a card in your deck or the search results to see its text, limits and categories."));
  const sec = isExtra(c) ? "extra" : "main", l = limitOf(c), n = totalCopies(d, c.id), lab = limitLabel(c);
  const ban = f.banlist !== "none" ? c.ban[f.banlist] : null, pts = f.points ? pointsOf(c) : 0;
  const mark = pts ? h("span", { class: "gp-mark", title: `${f.name} points` }, h("b", {}, pts), h("small", {}, "pts")) : null;
  const room = customCats(d).length < MAX_CUSTOM_CATS;
  box.replaceChildren(
    imgOn() && IMG_FULL(c.id) ? h("div", { class: "zoom" }, h("img", { src: IMG_FULL(c.id), alt: c.name, onerror: hideBroken }), mark) : null,
    h("div", { class: "name-row" }, h("h2", {}, c.name), imgOn() && IMG_FULL(c.id) ? null : mark),
    h("div", { class: "typeline" }, [c.type, isMonster(c) ? subLine(c) : null, c.scale != null ? `Scale ${c.scale}` : null].filter(Boolean).join(", ")),
    h("div", { class: "desc" }, c.desc),
    h("p", { class: "row", style: { gap: "6px" } },
      lab ? h("span", { class: "bub " + lab.cls }, lab.text) : h("span", {}, `Up to ${l} copies,`),
      ban && !lab ? h("span", { class: "dim" }, ` (${ban} on ${f.banlist.toUpperCase()})`) : "",
      f.over[c.id] != null ? h("span", { class: "dim" }, "(format override)") : "",
      h("span", {}, `${n} in deck`), !inPool(c) ? h("span", { class: "warn" }, `Not in the ${f.pool} pool.`) : ""),
    h("div", { class: "btns" },
      h("button", { onclick: () => add(c.id, sec) }, `Add to ${sec === "main" ? "Main" : "Extra"}`),
      h("button", { onclick: () => add(c.id, sec, -1), disabled: !d[sec][c.id] }, `Remove from ${sec === "main" ? "Main" : "Extra"}`),
      h("button", { onclick: () => add(c.id, "side") }, "Add to Side"),
      h("button", { onclick: () => add(c.id, "side", -1), disabled: !d.side[c.id] }, "Remove from Side"),
      h("button", { onclick: () => move(c.id, sec, "side"), disabled: !d[sec][c.id] }, "Move to Side"),
      h("button", { onclick: () => move(c.id, "side", sec), disabled: !d.side[c.id] }, "Move from Side")),
    h("div", {}, h("h3", {}, "Categories"), catChips(c.id),
      h("div", { class: "row", style: { marginTop: "6px" } },
        room ? h("button", { class: "small", onclick: () => { const name = prompt("Name for the new category"); if (!name) return;
          const k = addCategory(d, name); if (!k) return; d.tags[c.id] = [...(d.tags[c.id] || []), k.id]; changed(); } }, "New category") : null,
        h("span", { class: "dim", style: { fontSize: "12px" } }, `${customCats(d).length} of ${MAX_CUSTOM_CATS} custom categories used.`))),
    isMonster(c) && !isExtra(c) ? h("button", { class: "ghost", style: { marginTop: "8px" }, onclick: () => { if (!d.swPool.includes(c.id)) d.swPool.push(c.id); changed(); toast("Added to Small World pool"); } }, "Add to Small World pool") : null,
    extraInfo(c));
}
function ydkeDialog() {
  const ta = h("textarea", { readOnly: false }, toYdke());
  const body = $("#dlgBody");
  body.replaceChildren(h("h2", {}, "YDKE link"), h("p", { class: "dim" }, "Copy this to share the current deck, or paste a ydke:// link and import it as a new deck."), ta,
    h("div", { class: "row", style: { marginTop: "10px", justifyContent: "flex-end" } },
      h("button", { type: "button", onclick: () => { navigator.clipboard?.writeText(ta.value); toast("Copied"); } }, "Copy"),
      h("button", { type: "button", class: "primary", onclick: () => { try { const { d, unknown } = fromYdke(ta.value); $("#dlg").close(); importDeck(d, unknown, "Imported deck"); } catch { toast("That doesn't look like a ydke:// link"); } } }, "Import as new deck"),
      h("button", {}, "Close")));
  $("#dlg").showModal(); ta.select();
}

export { byName, byType, DECK_VIEWS, deckView, dropOnCategory, extraInfo, mainInfo, Q, renderBuild, renderDetail, renderResults, resultRow, SEARCH_SORTS, searchCards, sectionEl, setDirButton, sortResults, ydkeDialog };
