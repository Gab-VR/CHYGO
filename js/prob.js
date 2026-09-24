// prob.js
import { binom } from "./util.js";

/* ================= hand probabilities =================
   Main deck is partitioned into "atoms": cards with identical category sets.
   A hand is a vector x of atom counts; P(x) = prod C(n_i, x_i) / C(N, h)
   (multivariate hypergeometric). We enumerate all x with |x| = h. */
function handModel(d) {
  const idx = new Map(d.cats.map((k, i) => [k.id, i])), atoms = new Map(); let N = 0;
  for (const [id, n] of Object.entries(d.main)) {
    let mask = 0; for (const t of d.tags[id] || []) if (idx.has(t)) mask |= 1 << idx.get(t);
    atoms.set(mask, (atoms.get(mask) || 0) + n); N += n;
  }
  return { N, idx, k: d.cats.length, atoms: [...atoms].map(([mask, n]) => ({ mask, n })) };
}
function enumerateHands(M, hs, visit) {
  const A = M.atoms, total = binom(M.N, hs); if (!A.length || hs > M.N || hs < 0) return;
  const x = new Array(A.length).fill(0), cc = new Array(M.k).fill(0);
  const leaf = w => { cc.fill(0); for (let i = 0; i < A.length; i++) if (x[i]) for (let j = 0; j < M.k; j++) if (A[i].mask >> j & 1) cc[j] += x[i]; visit(cc, w / total); };
  (function rec(i, left, w) {
    if (i === A.length - 1) { if (left > A[i].n) return; x[i] = left; leaf(w * binom(A[i].n, left)); return; }
    const top = Math.min(left, A[i].n);
    for (let t = 0; t <= top; t++) { x[i] = t; rec(i + 1, left - t, w * binom(A[i].n, t)); }
    x[i] = 0;
  })(0, hs, 1);
}
const OPS = { ">=": (a, b) => a >= b, "<=": (a, b) => a <= b, "=": (a, b) => a === b };
function handOdds(d, hs) {
  const M = handModel(d), scen = d.scen.map(s => s.conds.map(c => ({ j: M.idx.get(c.cat), op: OPS[c.op], n: +c.n })).filter(c => c.j != null));
  const res = { scen: scen.map(() => 0), any: 0, cat: d.cats.map(() => ({ ge1: 0, ge2: 0, e: 0, zero: 0 })), N: M.N };
  enumerateHands(M, hs, (cc, p) => {
    let any = false;
    scen.forEach((conds, i) => { if (conds.length && conds.every(c => c.op(cc[c.j], c.n))) { res.scen[i] += p; any = true; } });
    if (any) res.any += p;
    cc.forEach((v, j) => { const r = res.cat[j]; r.e += v * p; if (v >= 1) r.ge1 += p; if (v >= 2) r.ge2 += p; });
  });
  return res;
}
function sampleHand(d, hs) {
  const pile = Object.entries(d.main).flatMap(([id, n]) => Array(n).fill(+id));
  for (let i = pile.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pile[i], pile[j]] = [pile[j], pile[i]]; }
  return pile.slice(0, hs);
}

export { enumerateHands, handModel, handOdds, OPS, sampleHand };
