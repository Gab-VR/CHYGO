import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { limitOf, limitLabel, validate, deckPoints, inPool } from "../js/legality.js";
import { card } from "../js/store.js";
import { reset } from "./helpers.js";

let f, d;
beforeEach(() => ({ d, f } = reset("TCG")));

test("TCG list: Limited 1, Semi-Limited 2, Banned 0, others 3", () => {
  assert.equal(limitOf(card(1)), 3);
  assert.equal(limitOf(card(3)), 1);
  assert.equal(limitOf(card(4)), 2);
  assert.equal(limitOf(card(5)), 0);
});

test("the OCG list reads the OCG column", () => {
  f.banlist = "ocg";
  assert.equal(limitOf(card(5)), 1);
  assert.equal(limitOf(card(3)), 3);
});

test("labels spell out the status", () => {
  assert.equal(limitLabel(card(1)), null);
  assert.equal(limitLabel(card(3)).text, "Limited");
  assert.equal(limitLabel(card(4)).text, "Semi-Limited");
  assert.equal(limitLabel(card(5)).text, "Forbidden");
});

test("a per-card override beats the list", () => {
  f.over[5] = 2;
  assert.equal(limitOf(card(5)), 2);
});

test("Genesys bans Link and Pendulum monsters and counts points", () => {
  ({ d, f } = reset("Genesys"));
  assert.equal(limitOf(card(6)), 0);
  assert.equal(limitOf(card(7)), 0);
  assert.equal(limitLabel(card(6)).text, "Not allowed");
  d.main[1] = 3; d.side[3] = 1;
  assert.equal(deckPoints(d, f), 3 * 15 + 33);
});

test("validate reports deck size and copies over the limit", () => {
  d.main[1] = 3; d.main[3] = 2;
  const msgs = validate(d, f).map(i => i.msg).join(" | ");
  assert.match(msgs, /Main Deck has 5 cards; the minimum is 40/);
  assert.match(msgs, /Limited C: 2 copies, limit 1/);
});

test("validate reports the Genesys point cap", () => {
  ({ d, f } = reset("Genesys"));
  d.main[3] = 3; d.main[1] = 3;                 // 3·33 + 3·15 = 144 points
  assert.match(validate(d, f).map(i => i.msg).join(" | "), /144 points; the cap is 100/);
});

test("card pool check uses the format's pool", () => {
  assert.equal(inPool(card(11)), false);
  f.pool = "OCG";
  assert.equal(inPool(card(11)), true);
});

/* ---- Card info lines ---- */
import { cardKind, cardLevel, cardStats } from "../js/cards.js";
const m = (type, extra = {}) => ({ type, frame: "effect", race: "Spellcaster", attr: "LIGHT", level: 4, atk: 1850, def: 1000, ...extra });

test("kind line: Effect/Normal, frame words, and supertypes after a bar", () => {
  assert.equal(cardKind(m("Effect Monster")), "Effect");
  assert.equal(cardKind(m("Normal Monster")), "Normal");
  assert.equal(cardKind(m("Gemini Monster")), "Effect | Gemini");
  assert.equal(cardKind(m("Toon Monster")), "Effect | Toon");
  assert.equal(cardKind(m("Union Effect Monster")), "Effect | Union");
  assert.equal(cardKind(m("Normal Tuner Monster")), "Normal | Tuner");
  assert.equal(cardKind(m("Synchro Tuner Effect Monster", { frame: "synchro" })), "Synchro Effect | Tuner");
  assert.equal(cardKind(m("XYZ Pendulum Effect Monster", { frame: "xyz_pendulum" })), "Xyz Pendulum Effect");
  assert.equal(cardKind(m("Link Monster", { frame: "link" })), "Link");
  assert.equal(cardKind({ type: "Spell Card", frame: "spell", race: "Quick-Play" }), "Quick-Play Spell");
  assert.equal(cardKind({ type: "Trap Card", frame: "trap", race: "Normal" }), "Trap");
});

test("level and stats lines", () => {
  assert.equal(cardLevel(m("Effect Monster")), "Lv 4 Light Spellcaster");
  assert.equal(cardLevel(m("XYZ Monster", { frame: "xyz", attr: "DARK", race: "Machine" })), "Rank 4 Dark Machine");
  assert.equal(cardLevel(m("Link Monster", { frame: "link", link: 2, race: "Cyberse" })), "Link-2 Light Cyberse");
  assert.equal(cardStats(m("Effect Monster")), "1850/1000");
  assert.equal(cardStats(m("Link Monster", { frame: "link", atk: 2300, def: null })), "2300");
  assert.equal(cardStats(m("Effect Monster", { atk: -1, def: 0 })), "?/0");
});
