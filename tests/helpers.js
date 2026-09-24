// Shared test fixtures: a tiny card pool loaded through the app's own ingest().
import { ingest } from "../js/cards.js";
import { S } from "../js/store.js";
import { newFormat } from "../js/legality.js";
import { newDeck } from "../js/deck.js";

const mon = (id, name, extra = {}) => ({ id, name, type: "Effect Monster", frame: "effect", desc: "", race: "Dragon",
  attr: "DARK", atk: 1000, def: 1000, level: 4, ban: { tcg: null, ocg: null, goat: null }, formats: ["tcg", "ocg"], ...extra });

export const CARDS = [
  mon(1, "Starter A"),
  mon(2, "Extender B"),
  mon(3, "Limited C", { ban: { tcg: "Limited", ocg: null, goat: null } }),
  mon(4, "Semi D", { ban: { tcg: "Semi-Limited", ocg: null, goat: null } }),
  mon(5, "Banned E", { ban: { tcg: "Banned", ocg: "Limited", goat: null } }),
  mon(6, "Link F", { type: "Link Monster", frame: "link", level: undefined, link: 2, def: undefined }),
  mon(7, "Pendulum G", { type: "Pendulum Effect Monster", frame: "effect_pendulum", scale: 4 }),
  mon(8, "Alt Art H", { alts: [80] }),
  mon(9, "Fusion I", { type: "Fusion Monster", frame: "fusion", level: 8 }),
  { id: 10, name: "Pot J", type: "Spell Card", frame: "spell", desc: "", race: "Normal", ban: { tcg: null, ocg: null, goat: null }, formats: ["tcg"] },
  mon(11, "OCG only K", { formats: ["ocg"] }),
];

// Fresh app state before each test: the card pool, one empty deck and the given format.
export function reset(preset = "TCG") {
  ingest({ version: "test", fetched: "2026-01-01", cards: structuredClone(CARDS), gp: { 1: 15, 3: 33 }, gpo: {} });
  const d = newDeck("Test"), f = newFormat(preset);
  S.decks = [d]; S.deckId = d.id; S.formats = [f]; S.fmtId = f.id;
  S.ui.overrideLimit = false;
  return { d, f };
}
