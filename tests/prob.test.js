import { test } from "node:test";
import assert from "node:assert/strict";
import { handOdds, handModel, enumerateHands } from "../js/prob.js";
import { binom } from "../js/util.js";

// A deck object as the Hands tab builds it: counts in main, categories, tags and scenarios.
function deckWith(cards, cats, scen = []) {
  const main = {}, tags = {};
  cards.forEach(([id, n, t]) => { main[id] = n; tags[id] = t; });
  return { main, tags, cats: cats.map(c => ({ id: c, name: c })), scen };
}
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("P(at least one of 3 copies in a 5-card hand from 40) matches the hypergeometric formula", () => {
  const d = deckWith([[1, 3, ["S"]], [2, 37, []]], ["S"], [{ name: "s", conds: [{ cat: "S", op: ">=", n: 1 }] }]);
  const r = handOdds(d, 5);
  close(r.scen[0], 1 - binom(37, 5) / binom(40, 5));
  close(r.cat[0].ge1, 1 - binom(37, 5) / binom(40, 5));
});

test("expected number of a category in hand is h·n/N", () => {
  const d = deckWith([[1, 9, ["S"]], [2, 31, []]], ["S"]);
  close(handOdds(d, 6).cat[0].e, 6 * 9 / 40);
});

test("probabilities over all possible hands sum to 1", () => {
  const d = deckWith([[1, 3, ["A"]], [2, 4, ["A", "B"]], [3, 6, ["B"]], [4, 27, []]], ["A", "B"]);
  let total = 0;
  enumerateHands(handModel(d), 5, (_, p) => { total += p; });
  close(total, 1);
});

test("a card in two categories is counted once, not twice", () => {
  // Card 1 is both Starter and Extender; "Starter and Extender" is then just "at least one card 1".
  const d = deckWith([[1, 3, ["S", "E"]], [2, 37, []]], ["S", "E"],
    [{ name: "both", conds: [{ cat: "S", op: ">=", n: 1 }, { cat: "E", op: ">=", n: 1 }] }]);
  close(handOdds(d, 5).scen[0], 1 - binom(37, 5) / binom(40, 5));
});

test("'at most 0' of a category equals drawing none of it", () => {
  const d = deckWith([[1, 4, ["B"]], [2, 36, []]], ["B"], [{ name: "no brick", conds: [{ cat: "B", op: "<=", n: 0 }] }]);
  close(handOdds(d, 5).scen[0], binom(36, 5) / binom(40, 5));
});

test("'exactly 2' uses C(n,2)·C(N−n,h−2)/C(N,h)", () => {
  const d = deckWith([[1, 3, ["X"]], [2, 37, []]], ["X"], [{ name: "two", conds: [{ cat: "X", op: "=", n: 2 }] }]);
  close(handOdds(d, 5).scen[0], binom(3, 2) * binom(37, 3) / binom(40, 5));
});

test("the union of scenarios is not the sum when they overlap", () => {
  const d = deckWith([[1, 3, ["A"]], [2, 3, ["B"]], [3, 34, []]], ["A", "B"],
    [{ name: "a", conds: [{ cat: "A", op: ">=", n: 1 }] }, { name: "b", conds: [{ cat: "B", op: ">=", n: 1 }] }]);
  const r = handOdds(d, 5);
  close(r.any, 1 - binom(34, 5) / binom(40, 5));
  assert.ok(r.any < r.scen[0] + r.scen[1]);
});

test("a hand bigger than the deck gives no hands", () => {
  const d = deckWith([[1, 3, ["A"]]], ["A"], [{ name: "a", conds: [{ cat: "A", op: ">=", n: 1 }] }]);
  assert.equal(handOdds(d, 5).any, 0);
});
