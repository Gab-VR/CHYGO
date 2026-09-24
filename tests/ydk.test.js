import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { parseYdk, ydkText, toYdke, fromYdke } from "../js/ydk.js";
import { reset } from "./helpers.js";

let d;
beforeEach(() => ({ d } = reset("TCG")));

test("parses Main, Extra and Side, and maps alternate artworks to the card", () => {
  const { d: p, unknown } = parseYdk("#created by someone\n#main\n1\n1\n80\n9\n#extra\n!side\n10\n99999\n");
  assert.deepEqual(p.main, { 1: 2, 8: 1 });
  assert.deepEqual(p.extra, { 9: 1 });        // a Fusion listed under #main still lands in the Extra Deck
  assert.deepEqual(p.side, { 10: 1 });
  assert.deepEqual(unknown, [99999]);
});

test("export then import gives the same deck", () => {
  d.main = { 1: 3, 10: 2 }; d.extra = { 9: 1 }; d.side = { 3: 1 };
  const { d: back } = parseYdk(ydkText(d));
  assert.deepEqual([back.main, back.extra, back.side], [d.main, d.extra, d.side]);
  assert.match(ydkText(d), /^#created by A deckbuilder\n#main\n/);
});

test("ydke:// links round-trip", () => {
  d.main = { 1: 3, 2: 1 }; d.extra = { 9: 2 }; d.side = {};
  const url = toYdke(d);
  assert.match(url, /^ydke:\/\/.*!.*!.*!$/);
  const { d: back } = fromYdke(url);
  assert.deepEqual([back.main, back.extra, back.side], [d.main, d.extra, d.side]);
});
