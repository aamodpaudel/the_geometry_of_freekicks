import { el, $ } from "./util.js?v=20261004c";
import { simulate, presets, wallFor, GOAL } from "./physics.js?v=20261004c";

const ACCENT = "#d4ff3a";
const RED = "#ff8a8a";
const PINK = "#d9578a";

// numbered badge
function badge(svg, x, y, n) {
  el("circle", { cx: x, cy: y, r: 15, fill: ACCENT }, svg);
  el("text", { x, y: y + 5, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "#0c1311", text: n }, svg);
}
function label(svg, x, y, text, anchor = "start", fill = "#e9f0ec", size = 14) {
  el("text", { x, y, "text-anchor": anchor, "font-size": size, fill, text }, svg);
}

// The recipe drawn on one real simulated goal (Ronaldo's 2018 kick)
export function initVerdict() {
  const svg = $("#verdictSvg");
  if (!svg) return;
  const kick = presets().ronaldo;
  const sim = simulate(kick);
  const pts = sim.pts;
  const [bx, bz] = kick.ball;
  const wall = wallFor(kick.ball, 4);

  /* ---------- left: from above ---------- */
  const L = { x: 20, y: 40, w: 440, h: 440 };
  el("rect", { x: L.x, y: L.y, width: L.w, height: L.h, rx: 14, fill: "#12301f" }, svg);
  label(svg, L.x + 16, L.y + 28, "FROM ABOVE", "start", "rgba(233,240,236,0.6)", 12);
  const sz = (L.h - 80) / 24, sx = sz * 2.2; // sideways stretched so the bend is visible
  const T = (x, z) => [L.x + L.w / 2 + (x - 0.6) * sx, L.y + 50 + z * sz];
  // goal + box
  el("line", { x1: L.x, y1: T(0, 0)[1], x2: L.x + L.w, y2: T(0, 0)[1], stroke: "rgba(255,255,255,0.4)", "stroke-width": 1.5 }, svg);
  el("line", { x1: T(-GOAL.half, 0)[0], y1: T(0, 0)[1], x2: T(GOAL.half, 0)[0], y2: T(0, 0)[1], stroke: "#fff", "stroke-width": 6 }, svg);
  // 1: the angle wedge
  const [Bx, By] = T(bx, bz);
  el("path", { d: `M ${Bx} ${By} L ${T(-GOAL.half, 0).join(" ")} L ${T(GOAL.half, 0).join(" ")} Z`, fill: "rgba(212,255,58,0.10)" }, svg);
  // straight line blocked by the wall
  const aimX = -0.0, [Ax, Ay] = T(aimX, 0);
  el("line", { x1: Bx, y1: By, x2: Ax, y2: Ay, stroke: RED, "stroke-width": 2, "stroke-dasharray": "6 6" }, svg);
  // wall
  el("line", { x1: T(...wall.a)[0], y1: T(...wall.a)[1], x2: T(...wall.b)[0], y2: T(...wall.b)[1], stroke: "#e9f0ec", "stroke-width": 9, "stroke-linecap": "round" }, svg);
  const [wcx, wcy] = T(...wall.centre);
  el("text", { x: wcx - 14, y: wcy + 26, "font-size": 22, fill: RED, "font-weight": 700, text: "✗" }, svg);
  // keeper
  const kx = -Math.sign(bx) * 0.6;
  el("circle", { cx: T(kx, 0.6)[0], cy: T(kx, 0.6)[1], r: 8, fill: PINK }, svg);
  label(svg, T(kx, 0.6)[0] - 14, T(kx, 0.6)[1] + 5, "keeper", "end", PINK, 12);
  // the real path
  el("path", { d: pts.map((p, i) => `${i ? "L" : "M"} ${T(p.x, p.z).map((v) => v.toFixed(1)).join(" ")}`).join(" "), fill: "none", stroke: ACCENT, "stroke-width": 4, "stroke-linecap": "round" }, svg);
  el("circle", { cx: Bx, cy: By, r: 8, fill: "#fff" }, svg);
  const end = sim.crossed;
  el("circle", { cx: T(end.x, 0)[0], cy: T(end.x, 0)[1], r: 7, fill: "#fff", stroke: ACCENT, "stroke-width": 3 }, svg);
  // badges
  badge(svg, Bx - 46, By - 30, "1");
  label(svg, Bx - 66, By + 6, "pick a spot with a big angle", "end", "#e9f0ec", 13);
  badge(svg, wcx - 60, wcy - 6, "2");
  label(svg, wcx - 80, wcy - 2, "straight line is blocked", "end", RED, 13);
  const mid = pts[Math.floor(pts.length * 0.55)];
  const [mx, my] = T(mid.x, mid.z);
  badge(svg, mx + 30, my, "4");
  label(svg, mx + 50, my - 6, "spin bends", "start", "#e9f0ec", 13);
  label(svg, mx + 50, my + 11, "it around", "start", "#e9f0ec", 13);
  badge(svg, T(end.x, 0)[0] - 30, T(end.x, 0)[1] + 70, "6");
  label(svg, T(end.x, 0)[0] - 52, T(end.x, 0)[1] + 75, "far corner from the keeper", "end", "#e9f0ec", 13);
  label(svg, L.x + 16, L.y + L.h - 14, "sideways distances stretched ×2.2", "start", "rgba(233,240,236,0.45)", 11);

  /* ---------- right: from the side ---------- */
  const R = { x: 500, y: 40, w: 480, h: 440 };
  el("rect", { x: R.x, y: R.y, width: R.w, height: R.h, rx: 14, fill: "#101c26" }, svg);
  label(svg, R.x + 16, R.y + 28, "FROM THE SIDE", "start", "rgba(233,240,236,0.6)", 12);
  const dist = Math.hypot(bx, bz);
  const groundY = R.y + R.h - 70;
  const hx = (R.w - 70) / dist, hy = 42; // heights stretched so they are readable
  const S = (s, h) => [R.x + 36 + s * hx, groundY - h * hy];
  el("rect", { x: R.x, y: groundY, width: R.w, height: R.h - (groundY - R.y), fill: "#163222" }, svg);
  el("line", { x1: R.x, y1: groundY, x2: R.x + R.w, y2: groundY, stroke: "rgba(255,255,255,0.5)" }, svg);
  // wall + goal
  const [w0x] = S(9.15, 0), [, wTop] = S(9.15, 2.05);
  el("rect", { x: w0x - 5, y: wTop, width: 10, height: groundY - wTop, rx: 4, fill: "#e9f0ec" }, svg);
  const [gx] = S(dist, 0), [, barY] = S(dist, 2.44);
  el("line", { x1: gx, y1: groundY, x2: gx, y2: barY, stroke: "#fff", "stroke-width": 5 }, svg);
  el("line", { x1: gx, y1: barY, x2: gx + 22, y2: barY, stroke: "#fff", "stroke-width": 4 }, svg);
  // straight line over the wall top, too high at the goal
  const hGoal = (2.05 * dist) / 9.15;
  const [sx0, sy0] = S(0, 0), [sx1, sy1] = S(dist, hGoal);
  el("line", { x1: sx0, y1: sy0, x2: sx1, y2: sy1, stroke: RED, "stroke-width": 2, "stroke-dasharray": "6 6" }, svg);
  label(svg, sx1 - 8, sy1 - 10, `straight: ${hGoal.toFixed(1)} m high, over the bar`, "end", RED, 12);
  // real path (distance travelled along the ground vs height)
  const d0 = pts.map((p) => Math.hypot(p.x - bx, p.z - bz));
  el("path", { d: pts.map((p, i) => `${i ? "L" : "M"} ${S(d0[i], p.y).map((v) => v.toFixed(1)).join(" ")}`).join(" "), fill: "none", stroke: ACCENT, "stroke-width": 4, "stroke-linecap": "round" }, svg);
  el("circle", { cx: sx0, cy: sy0 - 4, r: 7, fill: "#fff" }, svg);
  badge(svg, w0x + 6, wTop - 70, "3");
  label(svg, w0x + 28, wTop - 66, "up over the wall, then dip", "start", "#e9f0ec", 13);
  label(svg, w0x + 28, wTop - 48, "(gravity + topspin)", "start", "rgba(233,240,236,0.6)", 12);
  label(svg, gx - 6, barY + 24, `arrives ${end.y.toFixed(1)} m`, "end", ACCENT, 12);
  label(svg, gx - 6, barY + 40, "under the 2.44 m bar", "end", ACCENT, 12);
  label(svg, R.x + 16, R.y + R.h - 14, `real flight time ${end.t.toFixed(2)} s, heights stretched`, "start", "rgba(233,240,236,0.45)", 11);
  badge(svg, R.x + R.w - 40, groundY + 36, "5");
  label(svg, R.x + R.w - 62, groundY + 41, "from far away, the bend tightens (spiral)", "end", "#e9f0ec", 12);
}
