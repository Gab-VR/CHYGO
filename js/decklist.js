// decklist.js
// Konami's deck registration sheet (assets/KDE_DeckList.pdf): which card goes in
// which slot, and the filled-in PDF. The fields stay editable in the exported file.
import { isMonster, isSpell, isTrap } from "./cards.js";
import { ensureOrder } from "./deck.js";
import { card, S } from "./store.js";

const KDE_FILE = "assets/KDE_DeckList.pdf";
const MAIN_ROWS = 18, SIDE_ROWS = 15;            // slots per column on the form
const MAX_COUNT = 9;                              // the quantity boxes hold one character

// The player/event fields shown in the app, and the form field each one fills.
const SHEET_FIELDS = [
  ["first", "First & Middle Name(s)", "First  Middle Names"],
  ["last", "Last Name(s)", "Last Names"],
  ["cgid", "Card Game ID", "CARD GAME ID"],
  ["date", "Event date", null],                 // split into Month / Day / Year below
  ["country", "Country of Residency", "Country of Residency"],
  ["event", "Event Name", "Event Name"]
];

// Rows are [card, copies] in the deck's own order, grouped the way the form groups them.
function sheetData(d) {
  const order = ensureOrder(d);
  const rows = key => order[key].filter(id => d[key][id]).map(id => [card(id), d[key][id]]).filter(([c]) => c);
  const main = rows("main"), total = rs => rs.reduce((a, [, n]) => a + n, 0);
  const data = { monsters: main.filter(([c]) => isMonster(c)), spells: main.filter(([c]) => isSpell(c)),
    traps: main.filter(([c]) => isTrap(c)), side: rows("side"), extra: rows("extra") };
  data.totals = { monsters: total(data.monsters), spells: total(data.spells), traps: total(data.traps),
    main: total(main), side: total(data.side), extra: total(data.extra) };
  // Anything the paper form has no room for, so the app can say so.
  data.overflow = [];
  for (const [key, label, max] of [["monsters", "Monster", MAIN_ROWS], ["spells", "Spell", MAIN_ROWS], ["traps", "Trap", MAIN_ROWS], ["side", "Side Deck", SIDE_ROWS], ["extra", "Extra Deck", SIDE_ROWS]])
    if (data[key].length > max) data.overflow.push(`${data[key].length - max} ${label} card name${data[key].length - max > 1 ? "s" : ""} past slot ${max}`);
  for (const [c, n] of [...main, ...data.side, ...data.extra]) if (n > MAX_COUNT) data.overflow.push(`${c.name} (${n} copies) — the quantity box holds one digit`);
  return data;
}

// The form's font (Helvetica, Windows-1252 encoding) can't show every character; pdf-lib would
// refuse the whole export. Keep what it can show, strip accents it can't, and use "?" otherwise.
const CP1252_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
function printable(s) {
  return [...String(s)].map(ch => {
    const u = ch.codePointAt(0);
    if ((u >= 32 && u < 127) || (u >= 0xA0 && u <= 0xFF) || CP1252_EXTRA.has(ch)) return ch;
    if (ch === "★" || ch === "☆") return "*";
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return base && base.codePointAt(0) < 0x100 ? base : "?";
  }).join("");
}

// Form field name -> text, for this deck and the player info.
function kdeValues(d, info = S.ui.sheet || {}) {
  const data = sheetData(d), v = {};
  data.monsters.slice(0, MAIN_ROWS).forEach(([c, k], i) => { v[`Monster ${i + 1}`] = c.name; v[`Monster Card ${i + 1} Count`] = String(Math.min(k, MAX_COUNT)); });
  data.spells.slice(0, MAIN_ROWS).forEach(([c, k], i) => { v[`Spell ${i + 1}`] = c.name; v[`Spell Card ${i + 1} Count`] = String(Math.min(k, MAX_COUNT)); });
  data.traps.slice(0, MAIN_ROWS).forEach(([c, k], i) => { v[`Trap ${i + 1}`] = c.name; v[`Trap Card ${i + 1} Count`] = String(Math.min(k, MAX_COUNT)); });
  data.side.slice(0, SIDE_ROWS).forEach(([c, k], i) => { v[`Side Deck ${i + 1}`] = c.name; v[`Side Deck ${i + 1} Count`] = String(Math.min(k, MAX_COUNT)); });
  data.extra.slice(0, SIDE_ROWS).forEach(([c, k], i) => { v[`Extra Deck ${i + 1}`] = c.name; v[`Extra Deck ${i + 1} Count`] = String(Math.min(k, MAX_COUNT)); });
  for (const k in v) v[k] = printable(v[k]);
  const t = data.totals;
  Object.assign(v, { "Total Monster Cards": String(t.monsters), "Total Spell Cards": String(t.spells), "Total Trap Cards": String(t.traps),
    "Total Side Deck": String(t.side), "Total Extra Deck": String(t.extra), "Main Deck Total": String(t.main) });
  for (const [key, , field] of SHEET_FIELDS) if (field && info[key]) v[field] = printable(info[key]);
  if (info.cgid) v["CARD GAME ID"] = String(info.cgid).replace(/\s+/g, "").slice(0, 10);
  if (info.last) v["Last Name Initial"] = printable(info.last.trim().charAt(0).toUpperCase());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(info.date || "");
  if (m) Object.assign(v, { "Event Date - Month": m[2], "Event Date - Day": m[3], "Event Date - Year": m[1] });
  return v;
}

// Fills the form. `template` is the bytes of KDE_DeckList.pdf; returns the new PDF's bytes.
async function fillKde(template, d, info) {
  const { PDFDocument, StandardFonts, TextAlignment } = await import("./vendor/pdf-lib.esm.min.js");
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm(), values = kdeValues(d, info);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [name, text] of Object.entries(values)) {
    let field; try { field = form.getTextField(name); } catch { continue; }     // a different form version: skip unknown fields
    const max = field.getMaxLength(), value = max ? text.slice(0, max) : text;
    field.setText(value);
    // Even sizes: names 9 pt (smaller only if a long name needs it), quantities and totals 10 pt.
    if (/Count$|^Total |^Main Deck Total$/.test(name)) { field.setFontSize(10); if (!max) field.setAlignment(TextAlignment.Center); }
    else if (/^(Monster|Spell|Trap|Side Deck|Extra Deck) \d+$/.test(name)) {
      const w = field.acroField.getWidgets()[0].getRectangle().width - 4;
      field.setFontSize(Math.max(5, Math.min(9, 9 * w / font.widthOfTextAtSize(value, 9))));
    } else if (!max) field.setFontSize(11);
  }
  form.updateFieldAppearances(font);
  pdf.setTitle(`${d.name} decklist`); pdf.setProducer("A deckbuilder");
  return pdf.save();
}

// The form from the app folder (cached for the session), or from a file the user picks.
let templateBytes = null;
async function kdeTemplate() {
  if (templateBytes) return templateBytes;
  const r = await fetch(KDE_FILE);
  if (!r.ok) throw new Error(`${KDE_FILE} wasn't found`);
  return templateBytes = new Uint8Array(await r.arrayBuffer());
}
function setKdeTemplate(bytes) { templateBytes = bytes; }

export { printable, KDE_FILE, MAIN_ROWS, SIDE_ROWS, MAX_COUNT, SHEET_FIELDS, sheetData, kdeValues, fillKde, kdeTemplate, setKdeTemplate };
