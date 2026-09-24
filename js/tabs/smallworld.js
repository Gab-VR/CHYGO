// tabs/smallworld.js
import { isExtra, isMonster, statOk } from "../cards.js";
import { card, deck, save } from "../store.js";
import { cardPicker } from "../ui.js";
import { $, h } from "../util.js";

/* ================= small world ================= */
const SW = { view: "graph", hand: null, target: null, sim: null, hover: null };
const ATTR_COL = { DARK: "#8e6bc9", LIGHT: "#e8d77a", EARTH: "#a47a4e", WATER: "#4f9ad8", FIRE: "#e0664a", WIND: "#6cc58b", DIVINE: "#72d5c8" };
function swShared(a, b) {
  const s = [];
  if (a.race === b.race) s.push("Type");
  if (a.attr === b.attr) s.push("Attribute");
  if (a.level != null && a.level === b.level) s.push("Level");
  if (statOk(a.atk) && a.atk === b.atk) s.push("ATK");
  if (statOk(a.def) && a.def === b.def) s.push("DEF");
  return s;
}
function swPool(d = deck()) {
  const ids = new Set();
  for (const id of Object.keys(d.main)) { const c = card(id); if (c && isMonster(c) && !isExtra(c)) ids.add(c.id); }
  for (const id of d.swPool) { const c = card(id); if (c) ids.add(c.id); }
  return [...ids].map(card).sort((a, b) => a.name.localeCompare(b.name));
}
function swAdj(P) {
  const n = P.length, A = Array.from({ length: n }, () => new Array(n).fill(null));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const s = swShared(P[i], P[j]); if (s.length === 1) A[i][j] = A[j][i] = s[0]; }
  return A;
}
// bridges(i -> k) = { j : A[i][j] && A[j][k] }  (entries of A^2)
function bridges(P, A, i, k) { const out = []; for (let j = 0; j < P.length; j++) if (A[i][j] && A[j][k]) out.push(j); return out; }
function renderSW() {
  const root = $("#tab-sw"), d = deck(), P = swPool(d), A = swAdj(P);
  const ix = new Map(P.map((c, i) => [c.id, i]));
  if (SW.hand != null && !ix.has(SW.hand)) SW.hand = null;
  if (SW.target != null && !ix.has(SW.target)) SW.target = null;
  const setView = v => { SW.view = v; renderSW(); };
  let main;
  if (!P.length) main = h("div", { class: "panel" }, h("h2", {}, "No monsters yet"), h("p", { class: "dim" }, "The graph uses the Main Deck monsters in this deck, plus any extras you add to the pool on the right."));
  else if (SW.view === "graph") { const cv = h("canvas", { "aria-label": "Small World graph" }); main = h("div", { class: "panel" }, cv, h("p", { class: "dim", style: { fontSize: "12px", margin: "6px 0 0" } }, "Nodes are coloured by Attribute. Click a monster to reveal it from hand: gold rings mark every card it can reach. Drag to rearrange.")); requestAnimationFrame(() => startGraph(cv, P, A)); }
  else {
    const M = P.map((_, i) => P.map((_, k) => bridges(P, A, i, k).length)), mx = Math.max(1, ...M.flat());
    main = h("div", { class: "panel" }, h("p", { class: "dim", style: { fontSize: "13px", marginTop: 0 } }, "Rows: revealed from hand. Columns: card added from Deck. Each entry counts the bridges, i.e. the matrix A² of the Small World graph."),
      h("div", { class: "matrix-wrap" }, h("table", { class: "matrix" },
        h("tr", {}, h("th", {}), P.map(c => h("th", { class: "ch", title: c.name }, c.name))),
        P.map((c, i) => h("tr", {}, h("th", { class: "rh", title: c.name }, c.name), P.map((t, k) => h("td", {
          style: { background: M[i][k] ? `rgba(47,181,165,${0.18 + 0.82 * M[i][k] / mx})` : "transparent", color: M[i][k] / mx > .5 ? "#06201d" : "" },
          title: `${c.name} → ${t.name}: ${M[i][k]} bridge${M[i][k] === 1 ? "" : "s"}`,
          onclick: () => { SW.hand = c.id; SW.target = t.id; renderSW(); } }, M[i][k] || "")))))));
  }
  // side panel: bridge finder
  const opt = (sel) => [h("option", { value: "" }, "Choose a monster"), ...P.map(c => h("option", { value: c.id, selected: c.id === sel }, c.name))];
  let found = null;
  if (SW.hand != null) {
    const i = ix.get(SW.hand);
    if (SW.target != null) {
      const k = ix.get(SW.target), br = bridges(P, A, i, k);
      found = br.length ? br.map(j => h("div", { class: "bridge" }, h("b", {}, P[j].name), h("div", { class: "dim" }, `${A[i][j]} with ${P[i].name}, ${A[j][k]} with ${P[k].name}`)))
        : h("p", { class: "dim" }, "No bridge in this pool connects these two.");
    } else {
      const reach = P.map((c, k) => [c, bridges(P, A, i, k)]).filter(([, b]) => b.length).sort((a, b) => b[1].length - a[1].length);
      found = reach.length ? [h("p", { class: "dim" }, `${reach.length} reachable card${reach.length > 1 ? "s" : ""}. Click one to see its bridges.`),
        ...reach.map(([c, b]) => h("div", { class: "bridge", style: { cursor: "pointer" }, onclick: () => { SW.target = c.id; renderSW(); } }, h("b", {}, c.name), h("span", { class: "dim" }, `  via ${b.map(j => P[j].name).join(", ")}`)))]
        : h("p", { class: "dim" }, "Nothing is reachable from this card in the current pool.");
    }
  }
  const poolExtras = d.swPool.map(card).filter(Boolean);
  const side = h("aside", { class: "panel" },
    h("h2", {}, "Bridge finder"),
    h("label", { class: "dim", style: { fontSize: "12px" } }, "Reveal from hand"), h("select", { style: { width: "100%" }, onchange: e => { SW.hand = e.target.value ? +e.target.value : null; renderSW(); } }, opt(SW.hand)),
    h("label", { class: "dim", style: { fontSize: "12px", display: "block", marginTop: "6px" } }, "Add from Deck"), h("select", { style: { width: "100%" }, onchange: e => { SW.target = e.target.value ? +e.target.value : null; renderSW(); } }, opt(SW.target)),
    h("div", { style: { marginTop: "10px" } }, found),
    h("h3", { style: { marginTop: "18px" } }, "Pool extras"),
    h("p", { class: "dim", style: { fontSize: "12px" } }, "Monsters you're considering that aren't in the Main Deck yet."),
    cardPicker(c => { if (isMonster(c) && !isExtra(c) && !d.swPool.includes(c.id)) { d.swPool.push(c.id); save(); renderSW(); } }, c => isMonster(c) && !isExtra(c)),
    poolExtras.map(c => h("div", { class: "row", style: { marginTop: "4px" } }, h("span", { class: "grow" }, c.name), h("button", { class: "small ghost", title: "Remove from pool", onclick: () => { d.swPool = d.swPool.filter(x => x !== c.id); save(); renderSW(); } }, "✕"))));
  root.className = "tab on";
  root.replaceChildren(h("div", { class: "row", style: { marginBottom: "10px" } },
    h("div", { class: "seg" }, [["graph", "Graph"], ["matrix", "Bridge matrix"]].map(([v, l]) => h("button", { "aria-pressed": SW.view === v, onclick: () => setView(v) }, l))),
    h("span", { class: "dim" }, `${P.length} monsters, ${A.flat().filter(Boolean).length / 2} links`)),
  h("div", { class: "sw" }, main, side));
}
function startGraph(cv, P, A) {
  if (SW.sim) cancelAnimationFrame(SW.sim.raf);
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const old = SW.sim && SW.sim.pos || new Map();
  const N = P.map((c, i) => { const o = old.get(c.id); const a = 2 * Math.PI * i / P.length;
    return { c, x: o ? o.x : W / 2 + Math.cos(a) * W / 3, y: o ? o.y : H / 2 + Math.sin(a) * H / 3, vx: 0, vy: 0 }; });
  const E = []; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (A[i][j]) E.push([i, j, A[i][j]]);
  const hi = SW.hand != null ? P.findIndex(c => c.id === SW.hand) : -1;
  const reach = new Set(); if (hi >= 0) for (let k = 0; k < P.length; k++) if (bridges(P, A, hi, k).length) reach.add(k);
  const sim = SW.sim = { raf: 0, heat: old.size ? 0.4 : 1, drag: null, hover: -1, pos: new Map() };
  const step = () => {
    const k = sim.heat, rep = 22000 * Math.max(0.5, Math.min(1.5, 30 / Math.max(1, N.length)));
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const a = N[i], b = N[j]; let dx = a.x - b.x, dy = a.y - b.y; const d2 = Math.max(100, dx * dx + dy * dy), d = Math.sqrt(d2), f = rep / d2 * k;
      dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const [i, j] of E) { const a = N[i], b = N[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = 0.04 * (d - 120) * k;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; }
    for (const n of N) {
      if (sim.drag === n) { n.vx = n.vy = 0; continue; }
      n.vx += (W / 2 - n.x) * 0.006 * k; n.vy += (H / 2 - n.y) * 0.006 * k;
      n.vx *= 0.6; n.vy *= 0.6; n.x = Math.max(20, Math.min(W - 20, n.x + n.vx)); n.y = Math.max(20, Math.min(H - 34, n.y + n.vy)); }
    sim.heat = Math.max(0.02, sim.heat * 0.99);
  };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    const hv = sim.hover, focus = hv >= 0 ? hv : hi;
    for (const [i, j, lab] of E) {
      const on = focus >= 0 && (i === focus || j === focus);
      g.strokeStyle = on ? "rgba(114,213,200,.9)" : focus >= 0 ? "rgba(159,162,168,.12)" : "rgba(159,162,168,.35)";
      g.lineWidth = on ? 1.8 : 1; g.beginPath(); g.moveTo(N[i].x, N[i].y); g.lineTo(N[j].x, N[j].y); g.stroke();
      if (on) { g.fillStyle = "#72d5c8"; g.font = "11px system-ui"; g.textAlign = "center"; g.fillText(lab, (N[i].x + N[j].x) / 2, (N[i].y + N[j].y) / 2 - 3); }
    }
    N.forEach((n, i) => {
      g.beginPath(); g.arc(n.x, n.y, 9, 0, 2 * Math.PI); g.fillStyle = ATTR_COL[n.c.attr] || "#999"; g.fill();
      if (reach.has(i)) { g.lineWidth = 3; g.strokeStyle = "#72d5c8"; g.beginPath(); g.arc(n.x, n.y, 13, 0, 2 * Math.PI); g.stroke(); }
      if (i === hi) { g.lineWidth = 2; g.strokeStyle = "#fff"; g.beginPath(); g.arc(n.x, n.y, 16, 0, 2 * Math.PI); g.stroke(); }
      g.fillStyle = i === focus || reach.has(i) || focus < 0 ? "#e8e8e6" : "rgba(232,232,230,.35)";
      g.font = (i === focus ? "600 " : "") + "12px system-ui"; g.textAlign = "center"; g.fillText(n.c.name.length > 26 ? n.c.name.slice(0, 25) + "…" : n.c.name, n.x, n.y + 24);
    });
  };
  const loop = () => { if (!cv.isConnected) return; if (sim.heat > 0.03 || sim.drag) step(); draw(); N.forEach(n => sim.pos.set(n.c.id, { x: n.x, y: n.y })); sim.raf = requestAnimationFrame(loop); };
  const at = e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return N.findIndex(n => (n.x - x) ** 2 + (n.y - y) ** 2 < 180); };
  let downAt = null;
  cv.onpointerdown = e => { const i = at(e); downAt = { x: e.clientX, y: e.clientY, i }; if (i >= 0) { sim.drag = N[i]; cv.setPointerCapture(e.pointerId); } };
  cv.onpointermove = e => { const r = cv.getBoundingClientRect();
    if (sim.drag) { sim.drag.x = e.clientX - r.left; sim.drag.y = e.clientY - r.top; sim.heat = Math.max(sim.heat, 0.3); }
    else sim.hover = at(e); };
  cv.onpointerup = e => { const moved = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4;
    if (downAt && !moved) { const i = downAt.i; SW.hand = i >= 0 && P[i].id !== SW.hand ? P[i].id : null; SW.target = null; sim.drag = null; renderSW(); return; }
    sim.drag = null; downAt = null; };
  cv.onpointerleave = () => sim.hover = -1;
  loop();
}

export { ATTR_COL, bridges, renderSW, startGraph, SW, swAdj, swPool, swShared };
