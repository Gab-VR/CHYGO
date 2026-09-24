// ydk.js
import { isExtra, sortKey } from "./cards.js";
import { newDeck } from "./deck.js";
import { card, changed, deck, S } from "./store.js";
import { download, toast } from "./util.js";

/* ================= .ydk / ydke ================= */
function parseYdk(text) {
  const d = newDeck(), unknown = []; let sec = "main";
  for (let line of text.split(/\r?\n/)) {
    line = line.trim(); if (!line) continue;
    if (/^#main/i.test(line)) { sec = "main"; continue; }
    if (/^#extra/i.test(line)) { sec = "extra"; continue; }
    if (/^!side/i.test(line)) { sec = "side"; continue; }
    if (line.startsWith("#") || line.startsWith("!")) continue;
    const id = parseInt(line, 10); if (!id) continue;
    const c = card(id); if (!c) { unknown.push(id); continue; }
    const s = sec === "side" ? "side" : isExtra(c) ? "extra" : "main";
    d[s][c.id] = (d[s][c.id] || 0) + 1;
  }
  return { d, unknown };
}
function importDeck(d, unknown, name) {
  d.name = name; S.decks.push(d); S.deckId = d.id; S.sel = null; changed();
  toast(unknown.length ? `Imported, ${unknown.length} unknown id${unknown.length > 1 ? "s" : ""} skipped` : `Imported ${name}`);
}
function ydkText(d = deck()) {
  const ids = sec => Object.entries(d[sec]).map(([id, n]) => [card(id), n]).filter(([c]) => c).sort((a, b) => sortKey(a[0]).localeCompare(sortKey(b[0]))).flatMap(([c, n]) => Array(n).fill(c.id));
  return ["#created by A deckbuilder", "#main", ...ids("main"), "#extra", ...ids("extra"), "!side", ...ids("side"), ""].join("\n");
}
function exportYdk() {
  download(new Blob([ydkText()], { type: "text/plain" }), deck().name.replace(/[\\/:*?"<>|]/g, "_") + ".ydk");
}
function toYdke(d = deck()) {
  const enc = sec => { const ids = Object.entries(d[sec]).flatMap(([id, n]) => Array(n).fill(+id)); const u = new Uint32Array(ids); let s = ""; new Uint8Array(u.buffer).forEach(b => s += String.fromCharCode(b)); return btoa(s); };
  return `ydke://${enc("main")}!${enc("extra")}!${enc("side")}!`;
}
function fromYdke(url) {
  const parts = url.trim().replace(/^ydke:\/\//, "").split("!");
  const dec = s => { if (!s) return []; const b = atob(s), u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); return [...new Uint32Array(u8.buffer, 0, u8.length >> 2)]; };
  const lines = ["#main", ...dec(parts[0]), "#extra", ...dec(parts[1]), "!side", ...dec(parts[2])];
  return parseYdk(lines.join("\n"));
}

export { exportYdk, fromYdke, importDeck, parseYdk, toYdke, ydkText };
