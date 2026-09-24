// legality.js
import { isLink, isPend } from "./cards.js";
import { card, count, deck, fmt, S } from "./store.js";
import { uid } from "./util.js";

const PRESETS = {
  "TCG":         { banlist: "tcg",  pool: "TCG" },
  "OCG":         { banlist: "ocg",  pool: "OCG" },
  "Goat":        { banlist: "goat", pool: "GOAT" },
  "Master Duel": { banlist: "none", pool: "Master Duel" },
  "Genesys":     { banlist: "none", pool: "TCG", points: true, pointsList: "gp",  cap: 100, noLinkPend: true },
  "Genesys OCG": { banlist: "none", pool: "OCG", points: true, pointsList: "gpo", cap: 100, noLinkPend: true },
  "Unlimited":   { banlist: "none", pool: "any" }
};
function newFormat(preset = "TCG", name) {
  return Object.assign({ id: uid(), name: name || preset, min: 40, max: 60, extraMax: 15, sideMax: 15, copies: 3,
    banlist: "tcg", pool: "any", points: false, pointsList: "gp", cap: 100, noLinkPend: false, over: {}, pover: {} },
    JSON.parse(JSON.stringify(PRESETS[preset] || {})));
}
/* ================= legality ================= */
function limitOf(c, f = fmt()) {
  if (f.over[c.id] != null) return f.over[c.id];
  if (f.noLinkPend && (isLink(c) || isPend(c))) return 0;
  let l = f.copies;
  if (f.banlist !== "none") {
    const b = c.ban[f.banlist];
    if (b === "Banned" || b === "Forbidden") l = 0;
    else if (b === "Limited") l = Math.min(l, 1);
    else if (b === "Semi-Limited") l = Math.min(l, 2);
  }
  return l;
}
function inPool(c, f = fmt()) {
  if (f.pool === "any" || !c.formats.length) return true;
  return c.formats.includes(f.pool.toLowerCase());
}
function pointsOf(c, f = fmt()) {
  if (f.pover[c.id] != null) return f.pover[c.id];
  return (S[f.pointsList] || {})[c.id] || 0;
}
function totalCopies(d, id) { return (d.main[id] || 0) + (d.extra[id] || 0) + (d.side[id] || 0); }
function deckPoints(d = deck(), f = fmt()) {
  let p = 0; for (const s of ["main", "extra", "side"]) for (const [id, n] of Object.entries(d[s])) { const c = card(id); if (c) p += n * pointsOf(c, f); }
  return p;
}
function validate(d = deck(), f = fmt()) {
  const out = [], m = count(d.main), e = count(d.extra), s = count(d.side);
  if (m < f.min) out.push({ lvl: "err", msg: `Main Deck has ${m} cards; the minimum is ${f.min}.` });
  if (m > f.max) out.push({ lvl: "err", msg: `Main Deck has ${m} cards; the maximum is ${f.max}.` });
  if (e > f.extraMax) out.push({ lvl: "err", msg: `Extra Deck has ${e} cards; the maximum is ${f.extraMax}.` });
  if (s > f.sideMax) out.push({ lvl: "err", msg: `Side Deck has ${s} cards; the maximum is ${f.sideMax}.` });
  const ids = new Set([...Object.keys(d.main), ...Object.keys(d.extra), ...Object.keys(d.side)]);
  for (const id of ids) {
    const c = card(id); if (!c) { out.push({ lvl: "warn", msg: `Unknown card id ${id}.` }); continue; }
    const n = totalCopies(d, id), l = limitOf(c, f);
    if (n > l) out.push({ lvl: "err", id: c.id, msg: l === 0 ? `${c.name} is not allowed.` : `${c.name}: ${n} copies, limit ${l}.` });
    if (!inPool(c, f)) out.push({ lvl: "warn", id: c.id, msg: `${c.name} is not in the ${f.pool} card pool.` });
  }
  if (f.points) { const p = deckPoints(d, f); if (p > f.cap) out.push({ lvl: "err", msg: `${p} points; the cap is ${f.cap}.` }); }
  return out;
}
/* ================= deck editing ================= */
// Human-readable limit status, or null when the card is at the format's normal copy count.
function limitLabel(c, f = fmt()) {
  const l = limitOf(c, f);
  if (l >= f.copies) return null;
  if (f.over[c.id] == null && f.noLinkPend && (isLink(c) || isPend(c))) return { text: "Not allowed", cls: "forb", l };
  if (l === 0) return { text: "Forbidden", cls: "forb", l };
  if (l === 1) return { text: "Limited", cls: "lim", l };
  if (l === 2) return { text: "Semi-Limited", cls: "semi", l };
  return { text: `Max ${l}`, cls: "semi", l };
}

export { deckPoints, inPool, limitLabel, limitOf, newFormat, pointsOf, PRESETS, totalCopies, validate };
