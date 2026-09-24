import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { add, move, reorder, ensureOrder, addCategory, customCats, MAX_CUSTOM_CATS } from "../js/deck.js";
import { S } from "../js/store.js";
import { reset } from "./helpers.js";

let d;
beforeEach(() => ({ d } = reset("TCG")));

test("adding respects the card limit unless overridden", () => {
  assert.equal(add(3), true);
  assert.equal(add(3), false);          // Limited
  assert.equal(d.main[3], 1);
  S.ui.overrideLimit = true;
  assert.equal(add(3), true);
  assert.equal(d.main[3], 2);
});

test("the limit counts Main, Extra and Side together", () => {
  add(4); add(4, "side");
  assert.equal(add(4), false);          // Semi-Limited: 2 total
});

test("Extra Deck monsters go to the Extra Deck even if sent to Main", () => {
  add(9, "main");
  assert.equal(d.extra[9], 1);
  assert.equal(d.main[9], undefined);
});

test("moving to the Side keeps the total and isn't blocked by the limit", () => {
  add(3); move(3, "main", "side");
  assert.deepEqual([d.main[3], d.side[3]], [undefined, 1]);
});

test("custom order: new cards go last, reorder puts a card before another", () => {
  add(1); add(2); add(4);
  assert.deepEqual(ensureOrder(d).main, [1, 2, 4]);
  reorder("main", 4, 1);
  assert.deepEqual(d.order.main, [4, 1, 2]);
});

test("at most five custom categories", () => {
  for (let i = 0; i < 7; i++) addCategory(d, "c" + i);
  assert.equal(customCats(d).length, MAX_CUSTOM_CATS);
});
