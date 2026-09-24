#!/usr/bin/env node
// Fills a local image folder with card images from YGOPRODeck, once.
//
// YGOPRODeck asks that images be downloaded once and stored, never hotlinked
// (https://ygoprodeck.com/api-guide/). This script:
//   * only downloads images the folder doesn't already have (safe to re-run or resume);
//   * goes slowly: 2 at a time, at most ~4 per second;
//   * backs off on errors and stops completely if the server starts refusing.
//
// Usage (Node 18+), from the repo folder:
//   node scripts/download-images.mjs /mnt/c/YgoImages/pics
//   node scripts/download-images.mjs /mnt/c/YgoImages/pics --size full    # 421x614 instead of 168x246
//   node scripts/download-images.mjs /mnt/c/YgoImages/pics --dry-run     # just count what's missing
//
// The images are copyrighted by Konami: keep them for personal use and
// don't commit them to a public repository.

import { readFile, writeFile, rename, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith("--"));
const size = args.includes("--size") ? args[args.indexOf("--size") + 1] : "small";
const dryRun = args.includes("--dry-run");
if (!dir || !["small", "full"].includes(size)) {
  console.error("Usage: node scripts/download-images.mjs <folder> [--size small|full] [--dry-run]");
  process.exit(1);
}
const BASE = size === "full" ? "https://images.ygoprodeck.com/images/cards/" : "https://images.ygoprodeck.com/images/cards_small/";
const CONCURRENCY = 2, MIN_GAP_MS = 250;   // => never more than ~4 requests per second
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Which passcodes to fetch: every card in data/cards.json (main artwork only).
const blob = JSON.parse(await readFile(new URL("../data/cards.json", import.meta.url), "utf8"));
const wanted = blob.cards.filter(c => c.frame !== "token").map(c => c.id);

await mkdir(dir, { recursive: true });
const have = new Set();
for (const f of await readdir(dir)) { const m = /^(\d+)\.(jpe?g|png|webp)$/i.exec(f); if (m) have.add(+m[1]); }
// A card counts as present if any of its artworks is already in the folder (the app uses alternates too).
const todo = blob.cards.filter(c => c.frame !== "token" && ![c.id, ...(c.alts || [])].some(id => have.has(id))).map(c => c.id);

console.log(`${wanted.length} cards, ${wanted.length - todo.length} already have an image, ${todo.length} to download (${size}).`);
if (dryRun || !todo.length) process.exit(0);
const est = Math.ceil(todo.length / 4 / 60);
console.log(`At ~4 per second this takes about ${est} minute${est === 1 ? "" : "s"}. Ctrl+C stops it; re-running resumes.\n`);

let next = 0, done = 0, failed = 0, lastStart = 0, stop = false;
const missing = [];

/* ---------- progress bar ---------- */
const t0 = Date.now(), tty = process.stdout.isTTY;
const fmtTime = s => s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, "0")}m`
  : s >= 60 ? `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, "0")}s` : `${Math.floor(s)}s`;
let lastDraw = 0;
function drawBar(final = false) {
  const now = Date.now(); if (!final && now - lastDraw < 200) return; lastDraw = now;
  const n = done + failed, frac = n / todo.length, secs = (now - t0) / 1000, rate = n / Math.max(secs, 1e-3);
  const eta = rate > 0 ? (todo.length - n) / rate : 0;
  const info = ` ${(100 * frac).toFixed(1).padStart(5)}%  ${n}/${todo.length}  ${rate.toFixed(1)}/s  ` +
    (final ? `took ${fmtTime(secs)}` : `ETA ${fmtTime(eta)}`) +
    (missing.length ? `  ${missing.length} no image` : "") + (failed > missing.length ? `  ${failed - missing.length} errors` : "");
  if (!tty) { if (final || n % 500 === 0) console.log(info.trim()); return; }
  const width = Math.max(10, Math.min(40, (process.stdout.columns || 80) - info.length - 3));
  const full = Math.floor(frac * width), part = Math.floor((frac * width - full) * 8);
  const bar = "█".repeat(full) + (full < width ? " ▏▎▍▌▋▊▉"[part] : "") + " ".repeat(Math.max(0, width - full - 1));
  process.stdout.write(`\r[${bar}]${info}\x1b[K`);
}
process.on("SIGINT", () => { drawBar(true); console.log(`\n\nStopped. ${done} downloaded so far; run the same command again to resume.`); process.exit(130); });

async function fetchOne(id) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = lastStart + MIN_GAP_MS - Date.now();      // global pacing across both workers
    lastStart = Math.max(Date.now(), lastStart + MIN_GAP_MS);
    if (wait > 0) await sleep(wait);
    let r;
    try { r = await fetch(`${BASE}${id}.jpg`, { headers: { "User-Agent": "A-deckbuilder-image-fetch (personal, one-time)" } }); }
    catch { await sleep(2000 * attempt); continue; }
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      const tmp = join(dir, `${id}.jpg.part`);
      await writeFile(tmp, buf); await rename(tmp, join(dir, `${id}.jpg`));
      return true;
    }
    if (r.status === 404) { missing.push(id); return false; }          // no image for this card
    if (r.status === 403) { stop = true; console.error("\nServer returned 403 Forbidden: stopping. Wait a day before trying again."); return false; }
    await sleep(r.status === 429 ? 30000 : 3000 * attempt);            // rate-limited or server error: back off
  }
  return false;
}

async function worker() {
  while (!stop && next < todo.length) {
    const id = todo[next++];
    (await fetchOne(id)) ? done++ : failed++;
    drawBar();
  }
}
drawBar(true);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
drawBar(true);
console.log(`\n\nDownloaded ${done}. ${missing.length} have no image on the server${failed - missing.length > 0 ? `, ${failed - missing.length} failed (re-run to retry)` : ""}.`);
