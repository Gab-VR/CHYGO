// cards.js
import { idb, S } from "./store.js";

/* ================= utilities ================= */
/* Card data is served from this site's own data/ folder (built by scripts/update-cards.mjs).
   The app never contacts YGOPRODeck or any other third party. */
const DATA = "data/";
/* ================= card model ================= */
const isMonster = c => c.type.includes("Monster");
const isSpell = c => c.type === "Spell Card";
const isTrap = c => c.type === "Trap Card";
const isExtra = c => /fusion|synchro|xyz|link/.test(c.frame);
const isPend = c => c.frame.includes("pendulum");
const isLink = c => c.frame.startsWith("link");
const baseFrame = c => c.frame.replace("_pendulum", "");
const DARK_FRAMES = new Set(["xyz", "link", "fusion", "ritual", "spell", "trap"]);
function frameColor(c) { const f = baseFrame(c); return `var(--f-${["normal","effect","ritual","fusion","synchro","xyz","link","spell","trap"].includes(f) ? f : "token"})`; }
function sortKey(c) {
  const f = baseFrame(c);
  const order = isExtra(c) ? ["fusion","synchro","xyz","link"].indexOf(f) : isMonster(c) ? 0 : isSpell(c) ? 1 : 2;
  return String(order) + (isMonster(c) ? String(12 - (c.level || 0)).padStart(2, "0") : "00") + c.name;
}
function subLine(c) {
  if (isMonster(c)) {
    const lv = isLink(c) ? `Link-${c.link}` : baseFrame(c) === "xyz" ? `Rank ${c.level}` : `Lv ${c.level}`;
    const st = isLink(c) ? `${fmtStat(c.atk)}` : `${fmtStat(c.atk)}/${fmtStat(c.def)}`;
    return `${c.attr || ""} ${lv}  ${c.race}  ${st}`;
  }
  return `${c.race} ${isSpell(c) ? "Spell" : "Trap"}`;
}
const fmtStat = v => v == null || v < 0 ? "?" : v;
/* ================= card database ================= */
async function loadDB() {
  const blob = await idb.get("db");
  if (!blob) return false;
  ingest(blob); return true;
}
function ingest(blob) {
  S.cards.clear(); S.alias.clear();
  for (const c of blob.cards) { S.cards.set(c.id, c); for (const a of c.alts || []) if (a !== c.id) S.alias.set(a, c.id); }
  S.list = blob.cards.filter(c => c.frame !== "skill" && c.frame !== "token").sort((a, b) => a.name.localeCompare(b.name));
  S.races = [...new Set(S.list.filter(isMonster).map(c => c.race))].sort();
  S.gp = blob.gp || {}; S.gpo = blob.gpo || {};
  S.setNames = blob.setNames || null; S.rarities = blob.rarities || [];
  S.meta = { version: blob.version, fetched: blob.fetched, source: blob.source, n: blob.cards.length, schema: blob.schema || 1 };
}
async function storeDB(blob) {
  if (!blob || !Array.isArray(blob.cards) || !blob.version) throw new Error("that file isn't a card-data file for this app");
  for (const c of blob.cards) c.formats = (c.formats || []).map(s => s.toLowerCase());
  await idb.set("db", blob); ingest(blob);
}
// Checks data/meta.json (tiny) and downloads data/cards.json only when the version changed.
async function syncData(status = () => {}, force = false) {
  let meta;
  try {
    const r = await fetch(DATA + "meta.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(`meta.json: HTTP ${r.status}`);
    meta = await r.json();
  } catch (e) { return { ok: !!S.meta, reachable: false, err: e.message }; }
  if (!force && S.meta && S.meta.version === meta.version && (S.meta.schema || 1) >= (meta.schema || 1)) return { ok: true, reachable: true, updated: false };
  status("Downloading card data…");
  const r = await fetch(DATA + "cards.json", { cache: "no-cache" });
  if (!r.ok) throw new Error(`cards.json: HTTP ${r.status}`);
  status("Saving to this browser…");
  await storeDB(await r.json());
  return { ok: true, reachable: true, updated: true };
}
async function loadDataFile(file) { await storeDB(JSON.parse(await file.text())); }
/* Stat sorts group cards first: effect > normal > link > xyz > synchro > fusion > spell > trap,
   then order by the stat inside each group. Cards without the stat go to the end of their group. */
function kindRank(c) {
  if (isSpell(c)) return 6;
  if (isTrap(c)) return 7;
  const f = baseFrame(c);
  if (f === "link") return 2; if (f === "xyz") return 3; if (f === "synchro") return 4; if (f === "fusion") return 5;
  return f === "normal" ? 1 : 0;                      // effect, ritual and pendulum effect monsters
}
const releaseDate = c => c.tcg || c.ocg || null;
const levelOf = c => isLink(c) ? c.link : c.level;
const statOk = v => v != null && v >= 0;

/* Card info text, one line each:
     cardKind  "Effect | Gemini", "Synchro Effect | Tuner", "Quick-Play Spell"
     cardLevel "Lv 4 Light Spellcaster", "Rank 4 Dark Machine", "Link-2 Light Cyberse"
     cardStats "1850/1000", or "2300" for Link monsters                                    */
const FRAME_WORDS = ["Fusion", "Synchro", "XYZ", "Link", "Ritual", "Pendulum"];
const SUPERTYPES = ["Gemini", "Toon", "Union", "Spirit", "Flip", "Tuner"];
function cardKind(c) {
  if (!isMonster(c)) return `${c.race === "Normal" ? "" : c.race + " "}${isSpell(c) ? "Spell" : "Trap"}`;
  const words = c.type.replace(/\bMonster\b/, "").split(/\s+/).filter(Boolean);
  const frames = words.filter(w => FRAME_WORDS.includes(w)).map(w => w === "XYZ" ? "Xyz" : w);
  const supers = words.filter(w => SUPERTYPES.includes(w));
  // Gemini, Toon, Union, Spirit and Flip monsters are Effect monsters even when their type omits it.
  const base = words.includes("Normal") ? "Normal"
    : words.includes("Effect") || supers.some(w => w !== "Tuner") ? "Effect" : null;
  const main = [...frames, base].filter(Boolean).join(" ") || "Monster";
  return supers.length ? `${main} | ${supers.join(" | ")}` : main;
}
const titleCase = s => s ? s.charAt(0) + s.slice(1).toLowerCase() : "";
function cardLevel(c) {
  if (!isMonster(c)) return "";
  const lv = isLink(c) ? `Link-${c.link}` : baseFrame(c) === "xyz" ? `Rank ${c.level}` : `Lv ${c.level}`;
  return [lv, titleCase(c.attr), c.race].filter(Boolean).join(" ");
}
function cardStats(c) {
  if (!isMonster(c)) return "";
  return isLink(c) ? `${fmtStat(c.atk)}` : `${fmtStat(c.atk)}/${fmtStat(c.def)}`;
}

export { cardKind, cardLevel, cardStats, baseFrame, DARK_FRAMES, DATA, fmtStat, frameColor, ingest, isExtra, isLink, isMonster, isPend, isSpell, isTrap, kindRank, levelOf, loadDataFile, loadDB, releaseDate, sortKey, statOk, storeDB, subLine, syncData };
