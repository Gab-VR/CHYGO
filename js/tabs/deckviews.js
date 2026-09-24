// tabs/deckviews.js
// Two of the Build tab's deck views: Table (full card miniatures, like cards on a playmat)
// and Sheet (Konami's deck registration form, filled in, with PDF export).
// The third view, Categories, lives in build.js.
import { ensureOrder } from "../deck.js";
import { card, count, deck, S, save } from "../store.js";
import { cardIsBad, deckCardEvents, dropZone, mini } from "../ui.js";
import { KDE_FILE, MAIN_ROWS, SIDE_ROWS, SHEET_FIELDS, sheetData, fillKde, kdeTemplate, setKdeTemplate } from "../decklist.js";
import { download, h } from "../util.js";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
// [card, copies] in the deck's own order.
function orderedItems(d, key) {
  const o = ensureOrder(d)[key];
  return o.filter(id => d[key][id]).map(id => [card(id), d[key][id]]).filter(([c]) => c);
}
const EMPTY_HINT = { main: "Right-click a search result to add it here, or drag it in.", extra: "Extra Deck monsters go here automatically.",
  side: "Middle-click a search result to add it here, or drag it in." };

// "Main Deck  40 cards (…)" heading shared by the Table and Categories views.
function sectionHeader(label, key, info = "") {
  return h("div", { class: "section-h" }, h("h2", {}, label), h("span", { class: "dim" }, plural(count(deck()[key]), "card"), info || ""));
}

/* ---------- Table ---------- */
function tableSection(key, label, info = "") {
  const d = deck(), items = orderedItems(d, key);
  const mat = h("div", { class: "mat" + (items.length ? "" : " mat-empty") },
    items.length ? items.flatMap(([c, n]) => Array.from({ length: n }, () => mini(c, key))) : h("div", { class: "mat-hint" }, EMPTY_HINT[key]));
  return h("div", { class: "section" }, sectionHeader(label, key, info), dropZone(mat, key));
}

/* ---------- Sheet ---------- */
// One column of the form: header, numbered slots (quantity + name), and the total line.
// Cards past the last slot are still listed, highlighted, so nothing silently disappears.
function sheetColumn(title, rows, slots, sec, totalLabel, total) {
  const row = (r, over) => {
    if (!r) return h("div", { class: "kde-row" }, h("span", { class: "q" }), h("span", { class: "n" }));
    const [c, n] = r;
    return h("div", Object.assign({ class: ["kde-row filled", S.sel === c.id && "sel", cardIsBad(c) && "illegal", over && "over"].filter(Boolean).join(" ") },
      deckCardEvents(c, sec), over ? { title: `${c.name}\nThere's no slot for this card on the paper form.` } : {}),
      h("span", { class: "q" }, n), h("span", { class: "n" }, c.name));
  };
  return h("div", { class: "kde-col" },
    h("div", { class: "kde-colh" }, title),
    Array.from({ length: Math.max(slots, rows.length) }, (_, i) => row(rows[i], i >= slots)),
    h("div", { class: "kde-total" }, h("span", { class: "q" }, total), h("span", { class: "n" }, `<<< ${totalLabel}`)));
}
function sheetView() {
  const d = deck(), data = sheetData(d), info = (S.ui.sheet ||= {}), t = data.totals;
  const initial = h("b", {}, (info.last || "").trim().charAt(0).toUpperCase() || "\u00a0");
  const field = ([key, label]) => h("label", { class: "kde-field" }, h("span", {}, label),
    h("input", { value: info[key] || "", type: key === "date" ? "date" : "text", maxlength: key === "cgid" ? 10 : null,
      inputmode: key === "cgid" ? "numeric" : null, spellcheck: false, autocomplete: "off",
      oninput: e => { info[key] = e.target.value; save(); if (key === "last") initial.textContent = e.target.value.trim().charAt(0).toUpperCase() || "\u00a0"; } }));
  const status = h("p", {}, data.overflow.length ? h("span", { class: "warn" }, `Doesn't fit on the form: ${data.overflow.join("; ")}.`) : null);
  const picker = h("input", { type: "file", accept: ".pdf,application/pdf", hidden: true, onchange: async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    setKdeTemplate(new Uint8Array(await f.arrayBuffer())); exportPdf(); } });
  async function exportPdf() {
    status.textContent = "Filling in the form…";
    try {
      const bytes = await fillKde(await kdeTemplate(), d, info);
      download(new Blob([bytes], { type: "application/pdf" }), `${d.name.replace(/[\\/:*?"<>|]/g, "_")} - decklist.pdf`);
      status.replaceChildren(data.overflow.length ? h("span", { class: "warn" }, `Exported, but some cards don't fit: ${data.overflow.join("; ")}.`) : "Exported. The fields stay editable in the PDF.");
    } catch (e) {
      status.replaceChildren(h("span", { class: "warn" }, `${e.message}. `), `Add the form to the app folder as ${KDE_FILE}, or `,
        h("button", { class: "small", onclick: () => picker.click() }, "choose the form file"), ".");
    }
  }
  return h("div", { class: "section kde" },
    h("div", { class: "kde-top" },
      h("div", { class: "kde-note" }, "Deck registration sheet. Fill in your details; the card slots follow your deck. Drag cards to reorder, right-click to remove."),
      h("div", { class: "kde-fields" }, SHEET_FIELDS.map(field)),
      h("div", { class: "kde-judge" },
        h("div", {}, h("span", {}, "Last name initial"), initial),
        h("div", {}, h("span", {}, "Main Deck total"), h("b", {}, t.main)))),
    dropZone(h("div", { class: "kde-main" },
      sheetColumn("MONSTER CARDS", data.monsters, MAIN_ROWS, "main", "TOTAL MONSTER CARDS", t.monsters),
      sheetColumn("SPELL CARDS", data.spells, MAIN_ROWS, "main", "TOTAL SPELL CARDS", t.spells),
      sheetColumn("TRAP CARDS", data.traps, MAIN_ROWS, "main", "TOTAL TRAP CARDS", t.traps)), "main"),
    h("div", { class: "kde-bottom" },
      dropZone(sheetColumn("SIDE DECK", data.side, SIDE_ROWS, "side", "TOTAL SIDE DECK", t.side), "side"),
      dropZone(sheetColumn("EXTRA DECK", data.extra, SIDE_ROWS, "extra", "TOTAL EXTRA DECK", t.extra), "extra"),
      h("div", { class: "kde-export" },
        h("button", { class: "primary", onclick: exportPdf }, "Export PDF"),
        h("p", {}, "Fills in Konami's form. You can still edit every field in the PDF afterwards."),
        status, picker)));
}

export { EMPTY_HINT, orderedItems, sectionHeader, sheetView, tableSection };
