import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { sheetData, kdeValues, fillKde, printable, MAIN_ROWS } from "../js/decklist.js";
import { ingest } from "../js/cards.js";
import { CARDS, reset } from "./helpers.js";

let d;
beforeEach(() => ({ d } = reset("TCG")));
const info = { first: "Carlos Gabriel", last: "Valenzuela Ruiz", cgid: "0012345678", date: "2026-10-03", country: "Canada", event: "Regional" };
const FORM = new URL("../assets/KDE_DeckList.pdf", import.meta.url);

test("cards go to the Monster, Spell and Trap columns; Extra and Side separately", () => {
  d.main = { 1: 3, 10: 2, 2: 1 }; d.extra = { 9: 2 }; d.side = { 3: 1 };
  d.order = { main: [1, 10, 2] };            // the sheet follows the deck's own order
  const s = sheetData(d);
  assert.deepEqual(s.monsters.map(([c, n]) => [c.id, n]), [[1, 3], [2, 1]]);
  assert.deepEqual(s.spells.map(([c]) => c.id), [10]);
  assert.deepEqual(s.totals, { monsters: 4, spells: 2, traps: 0, main: 6, side: 1, extra: 2 });
});

test("form field values: names, counts, totals, player details and the split date", () => {
  d.main = { 1: 3, 10: 2 }; d.extra = { 9: 1 }; d.side = { 3: 1 };
  const v = kdeValues(d, info);
  assert.equal(v["Monster 1"], "Starter A");
  assert.equal(v["Monster Card 1 Count"], "3");
  assert.equal(v["Spell 1"], "Pot J");
  assert.equal(v["Extra Deck 1"], "Fusion I");
  assert.equal(v["Side Deck 1 Count"], "1");
  assert.equal(v["Main Deck Total"], "5");
  assert.equal(v["Total Spell Cards"], "2");
  assert.equal(v["Last Name Initial"], "V");
  assert.equal(v["First  Middle Names"], "Carlos Gabriel");
  assert.deepEqual([v["Event Date - Month"], v["Event Date - Day"], v["Event Date - Year"]], ["10", "03", "2026"]);
});

test("more than 18 different monsters: the extra ones are reported, not dropped silently", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ ...CARDS[0], id: 100 + i, name: `Monster ${i}` }));
  ingest({ version: "t", fetched: "x", cards: [...CARDS, ...many], gp: {}, gpo: {} });
  d.main = Object.fromEntries(many.map(c => [c.id, 1]));
  d.order = { main: many.map(c => c.id) };
  const v = kdeValues(d, info);
  assert.equal(v[`Monster ${MAIN_ROWS}`], `Monster ${MAIN_ROWS - 1}`);
  assert.equal(v[`Monster ${MAIN_ROWS + 1}`], undefined);
  assert.match(sheetData(d).overflow.join(), /2 Monster card names past slot 18/);
});

test("characters the form's font can't show are replaced", () => {
  assert.equal(printable("Böse ★ Glut"), "Böse * Glut");
  assert.equal(printable("Ωmega"), "?mega");
  assert.equal(printable("Łukasz"), "?ukasz");
  assert.equal(printable("“quoted” – fine"), "“quoted” – fine");
});

test("fills Konami's form and the values read back", { skip: !existsSync(FORM) && "KDE_DeckList.pdf not in the repo" }, async () => {
  const PDFLib = await import("../js/vendor/pdf-lib.esm.min.js");
  d.main = { 1: 3, 10: 2 }; d.extra = { 9: 1 };
  const bytes = await fillKde(new Uint8Array(readFileSync(FORM)), d, { ...info, event: "Regional ★ Qualifier" });
  const form = (await PDFLib.PDFDocument.load(bytes)).getForm();
  assert.equal(form.getTextField("Monster 1").getText(), "Starter A");
  assert.equal(form.getTextField("CARD GAME ID").getText(), "0012345678");
  assert.equal(form.getTextField("Main Deck Total").getText(), "5");
  assert.equal(form.getTextField("Event Name").getText(), "Regional * Qualifier");
});
