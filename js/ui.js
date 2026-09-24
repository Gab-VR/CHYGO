// ui.js
import { baseFrame, DARK_FRAMES, frameColor, isMonster, isPend, loadDataFile, subLine, syncData } from "./cards.js";
import { add, move, reorder } from "./deck.js";
import { artPos, canRememberFolder, chooseImages, connectFolder, folderReport, IMG_ART, imgOn, IMGS } from "./images.js";
import { deckPoints, inPool, limitLabel, limitOf, pointsOf, totalCopies, validate } from "./legality.js";
import { changed, deck, fmt, S, save } from "./store.js";
import { $, $$, h, toast } from "./util.js";

/* ================= header ================= */
function renderHeader() {
  const ds = $("#deckSel"); ds.replaceChildren(...S.decks.map(d => h("option", { value: d.id, selected: d.id === S.deckId }, d.name)));
  const fs = $("#fmtSel"); fs.replaceChildren(...S.formats.map(f => h("option", { value: f.id, selected: f.id === S.fmtId }, f.name)));
  const f = fmt(); $("#ptsToggle").checked = f.points;
  const meter = $("#meter"); meter.hidden = !f.points;
  if (f.points) {
    const p = deckPoints(); meter.classList.toggle("over", p > f.cap);
    $("i", meter).style.width = Math.min(100, 100 * p / Math.max(1, f.cap)) + "%";
    $("span", meter).textContent = `${p}/${f.cap}`;
  }
  const iss = S.cards.size ? validate() : [], errs = iss.filter(i => i.lvl === "err").length;
  const pill = $("#legalPill");
  pill.className = "pill " + (errs ? "bad" : "ok");
  pill.textContent = !S.cards.size ? "No card data" : errs ? `${errs} issue${errs > 1 ? "s" : ""}` : iss.length ? "Legal, with notes" : "Legal";
  $("#legalPop").replaceChildren(...iss.map(i => h("li", { class: i.lvl === "warn" ? "warn" : "" }, i.msg)));
}
function setTab(t) {
  S.tab = t; $$("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  $$(".tab").forEach(s => s.classList.toggle("on", s.id === "tab-" + t)); save(); renderTab();
}
// Tabs register themselves from main.js, so this module never imports them.
const TABS = {};
function registerTab(name, render) { TABS[name] = render; }
function renderTab() {
  if (!S.cards.size && S.tab !== "format") return renderSplash($("#tab-" + S.tab));
  TABS[S.tab]?.();
}
function renderSplash(root) {
  const st = h("p", { class: "dim" });
  const file = h("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await loadDataFile(f); toast(`Loaded ${S.meta.n} cards`); changed(); } catch (err) { st.textContent = `Couldn't load it: ${err.message}.`; }
  } });
  root.replaceChildren(h("div", { class: "splash panel" },
    h("h2", {}, "No card data yet"),
    h("p", {}, "A deckbuilder reads its card list from data/cards.json next to this page. That file is built by the update script, so run it once (see the README)."),
    h("p", { class: "dim" }, "Opened this page straight from your disk? Browsers don't let file:// pages read neighbouring files, so either serve the folder locally or load cards.json by hand."),
    h("div", { class: "row" },
      h("button", { class: "primary", onclick: () => file.click() }, "Load cards.json"),
      h("button", { onclick: async () => { st.textContent = "Checking…"; try { const r = await syncData(m => st.textContent = m); if (r.updated) { toast(`Loaded ${S.meta.n} cards`); changed(); } else st.textContent = `data/meta.json isn't reachable (${r.err || "no data"}).`; } catch (err) { st.textContent = err.message; } } }, "Try again")),
    st, file));
}
/* One place that always says what the pictures are doing, so a problem is never silent. */
function imageState() {
  if (S.ui.img === "off") return { text: "Pictures are off.", cls: "dim" };
  if (S.ui.img === "path") {
    if (IMGS.pathMisses && !IMGS.pathHits) return { text: `No pictures found at ${S.ui.imgTpl}.`, cls: "warn" };
    return { text: `Pictures from ${S.ui.imgTpl}.`, cls: "dim" };
  }
  if (IMGS.reading) return { text: `Reading picture folder… ${IMGS.reading}`, cls: "dim" };
  if (!canRememberFolder() && !IMGS.urls.size) return { text: location.protocol === "file:"
      ? "Opened as a file, so the folder must be chosen each visit. Serve the app on localhost to have it remembered (see README)."
      : `On ${location.origin} the folder must be chosen each visit. Open the app at http://localhost:${location.port || 80} to have it remembered.`, cls: "dim", btn: "Choose image folder" };
  if (IMGS.needsPermission) return { text: "Edge needs your permission to read the picture folder again.", cls: "warn", btn: "Reconnect image folder" };
  if (!IMGS.urls.size) return IMGS.diag ? { text: folderReport(), cls: "warn", btn: "Choose image folder" } : { text: "No picture folder chosen yet.", cls: "warn", btn: "Choose image folder" };
  if (IMGS.pathMisses) return { text: folderReport(), cls: "warn", btn: "Choose image folder" };
  return { text: `${IMGS.urls.size.toLocaleString()} pictures from "${IMGS.folderName || "your folder"}"${IMGS.session ? " (for this session)" : ""}.`, cls: "dim" };
}
function imageStatus() {
  const st = imageState();
  return h("span", { class: "row img-status", id: "imgStatus" },
    st.btn ? h("button", { class: "small primary", onclick: connectFolder }, st.btn) : null,
    h("span", { class: st.cls + " imgnote" }, st.text));
}
function refreshImageStatus() { const el = $("#imgStatus"); if (el) el.replaceWith(imageStatus()); }
function imageSelect() {
  return h("select", { "aria-label": "Card images", onchange: e => chooseImages(e.target.value) },
    [["off", "Off"], ["folder", "Image folder"], ["path", "Image URL path"]].map(([v, l]) => h("option", { value: v, selected: S.ui.img === v }, l)));
}
function dragData(e, id, from, cat) { e.dataTransfer.setData("text/plain", JSON.stringify({ id, from, cat })); e.dataTransfer.effectAllowed = "copyMove"; }
const dropData = e => { try { return JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return null; } };
function bubbles(c, f = fmt()) {
  const lab = limitLabel(c, f), p = f.points ? pointsOf(c) : 0;
  if (!lab && !p) return null;
  return h("span", { class: "bubs" },
    lab ? h("span", { class: "bub " + lab.cls, title: `${lab.text}: ${lab.l} cop${lab.l === 1 ? "y" : "ies"} allowed` }, lab.text) : null,
    p ? h("span", { class: "bub pts", title: `${f.name} points` }, `${p} pts`) : null);
}
/* Copies are drawn as cards stacked behind the tile, each peeking out STEP px lower and a little
   narrower and darker, so 1, 2 and 3 copies read at a glance. Box-shadows need no extra DOM. */
const STACK_STEP = 8, STACK_MAX = 4;   // at most 4 cards drawn behind; the badge gives the exact count
function stackStyle(n, bad) {
  const layers = Math.min(n, STACK_MAX + 1) - 1, sh = [];
  if (bad) sh.push("inset 0 0 0 2px var(--bad)");
  for (let k = 1; k <= layers; k++) {
    const y = k * STACK_STEP + k, shrink = k;                         // +k offsets the negative spread
    const tone = `color-mix(in srgb, var(--fc) ${88 - 12 * k}%, #000)`;
    sh.push(`0 ${y}px 0 ${-shrink}px ${tone}`, `0 ${y + 1}px 0 ${-shrink}px rgba(0,0,0,.55)`);
  }
  return sh.length ? { boxShadow: sh.join(", "), marginBottom: layers * STACK_STEP + "px" } : {};
}
function tile(c, n, sec, boxCat) {
  const d = deck(), f = fmt(), dark = DARK_FRAMES.has(baseFrame(c));
  const tags = d.cats.filter(k => (d.tags[c.id] || []).includes(k.id));
  const bad = totalCopies(d, c.id) > limitOf(c) || !inPool(c);
  const p = f.points ? pointsOf(c) : 0;
  const t = h("div", { class: ["tile", n > 1 && "stacked", dark && "dark", isPend(c) && "pend", S.sel === c.id && "sel", bad && "illegal", imgOn() && IMG_ART(c.id) && "art"].filter(Boolean).join(" "),
    style: Object.assign({ "--fc": frameColor(c) }, stackStyle(n, bad), imgOn() && IMG_ART(c.id) ? Object.assign({ backgroundImage: `url("${IMG_ART(c.id)}")` }, artPos()) : {}),
    draggable: true, tabindex: 0, title: `${c.name}\nClick to select. Right-click (or Shift-click) removes one.`,
    oncontextmenu: e => { if (!e.currentTarget.closest(".section")) return; e.preventDefault(); add(c.id, sec, -1); },
    ondragstart: e => dragData(e, c.id, sec, boxCat === undefined ? undefined : boxCat ? boxCat.id : null),
    ondrop: e => {                       // Custom order: dropping on a card puts the dragged card before it
      if (S.ui.deckSort !== "custom" || !e.currentTarget.closest(".section")) return;
      e.preventDefault(); e.stopPropagation(); e.currentTarget.closest(".section").classList.remove("drop");
      try { const { id, from } = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (from === sec) reorder(sec, id, c.id); else if (from) move(id, from, sec, c.id); else add(id, sec, 1, { before: c.id }); } catch {}
    },
    onclick: e => { if (e.shiftKey) add(c.id, sec, -1); else { S.sel = c.id; renderTab(); } },
    onkeydown: e => { if (e.key === "Enter") { S.sel = c.id; renderTab(); } if (e.key === "Delete" || e.key === "-") add(c.id, sec, -1); if (e.key === "+") add(c.id, sec, 1); } },
    tags.length ? h("div", { class: "tags" }, tags.map(k => h("i", { style: { background: k.color } }))) : null,
    h("div", { class: "nm" }, c.name), h("div", { class: "sub" }, isMonster(c) ? subLine(c).replace(c.race, "").replace(/\s+/g, " ") : c.race),
    h("span", { class: "cnt" }, "×" + n), p ? h("span", { class: "pts" }, p * n + "pt") : null);
  return t;
}
function catChips(id, after) {
  const d = deck(), cur = d.tags[id] || [];
  return h("div", { class: "chips" }, d.cats.map(k => h("button", { class: "chip" + (cur.includes(k.id) ? " on" : ""), style: { "--c": k.color }, "aria-pressed": cur.includes(k.id),
    onclick: () => { const t = new Set(d.tags[id] || []); t.has(k.id) ? t.delete(k.id) : t.add(k.id); d.tags[id] = [...t]; save(); after ? after() : renderTab(); } }, k.name)));
}
function cardPicker(onPick, filter = () => true) {
  const inp = h("input", { placeholder: "Search a card", style: { width: "100%" }, "aria-label": "Search a card" }), menu = h("div", { class: "menu", hidden: true });
  inp.addEventListener("input", () => {
    const q = inp.value.toLowerCase().trim(); if (q.length < 2) { menu.hidden = true; return; }
    const hits = []; for (const c of S.list) { if (c.name.toLowerCase().includes(q) && filter(c)) { hits.push(c); if (hits.length >= 12) break; } }
    menu.replaceChildren(...hits.map(c => h("div", { onmousedown: e => { e.preventDefault(); onPick(c); inp.value = ""; menu.hidden = true; } }, c.name)));
    menu.hidden = !hits.length;
  });
  inp.addEventListener("blur", () => setTimeout(() => menu.hidden = true, 150));
  return h("div", { class: "sugg" }, inp, menu);
}

export { bubbles, cardPicker, catChips, dragData, dropData, imageSelect, imageState, imageStatus, refreshImageStatus, registerTab, renderHeader, renderSplash, renderTab, setTab, STACK_STEP, stackStyle, TABS, tile };
