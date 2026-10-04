import { el, clear, $, svgPoint, goalAngle, isoCircle, drawPitch, fmt } from "./util.js?v=20261004c";
import { simulate } from "./physics.js?v=20261004c";

const ACCENT = "#d4ff3a";
const SIMPLE = document.body.classList.contains("simple");
const G = 9.81;

/* ---------------- 2.1 goal angle + inscribed angle circles ---------------- */
export function initAngle() {
  const svg = $("#angleSvg");
  const ro = $("#angleReadout");
  let ball = [6, 20];

  const defs = el("defs", {}, svg);
  const cp = el("clipPath", { id: "fieldClip" }, defs);
  el("rect", { x: -30, y: 0, width: 60, height: 44 }, cp);

  drawPitch(svg);
  // 9.15 m wall circle hint
  const faint = el("g", { "clip-path": "url(#fieldClip)", fill: "none", stroke: "rgba(255,255,255,0.28)", "stroke-width": 0.1, "stroke-dasharray": "0.5 0.4" }, svg);
  for (const th of [10, 15, 20, 30, 45]) {
    const { R, zc } = isoCircle(th);
    el("circle", { cx: 0, cy: zc, r: R }, faint);
    const lz = zc + R;
    if (lz < 40) el("text", { x: 0.4, y: lz - 0.4, fill: "rgba(255,255,255,0.55)", "font-size": 1.1, stroke: "none", text: th + "°" }, faint);
  }
  const live = el("g", {}, svg);

  function render() {
    clear(live);
    const [x, z] = ball;
    const th = goalAngle(x, z);
    const { R, zc } = isoCircle(th);
    el("circle", { cx: 0, cy: zc, r: R, fill: "none", stroke: ACCENT, "stroke-width": 0.22, "clip-path": "url(#fieldClip)", opacity: 0.95 }, live);
    // wall circle
    el("circle", { cx: x, cy: z, r: 9.15, fill: "none", stroke: "rgba(255,255,255,0.35)", "stroke-width": 0.1, "stroke-dasharray": "0.3 0.3" }, live);
    // angle wedge
    el("path", { d: `M ${x} ${z} L -3.66 0 L 3.66 0 Z`, fill: "rgba(212,255,58,0.16)", stroke: "none" }, live);
    el("line", { x1: x, y1: z, x2: -3.66, y2: 0, stroke: "#fff", "stroke-width": 0.14 }, live);
    el("line", { x1: x, y1: z, x2: 3.66, y2: 0, stroke: "#fff", "stroke-width": 0.14 }, live);
    // arc at ball
    const a1 = Math.atan2(0 - z, -3.66 - x), a2 = Math.atan2(0 - z, 3.66 - x);
    const r = 2.6;
    el("path", { d: `M ${x + r * Math.cos(a1)} ${z + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${x + r * Math.cos(a2)} ${z + r * Math.sin(a2)}`, fill: "none", stroke: ACCENT, "stroke-width": 0.18 }, live);
    el("text", { x: x + 1.2, y: z - 3.2, fill: ACCENT, "font-size": 1.5, "font-weight": 600, text: `θ = ${fmt(th)}°` }, live);
    // same angle point straight ahead
    const zf = zc + R;
    if (zf < 40) {
      el("circle", { cx: 0, cy: zf, r: 0.45, fill: "none", stroke: ACCENT, "stroke-width": 0.15 }, live);
    }
    // ball (big hit area)
    el("circle", { cx: x, cy: z, r: 2.2, fill: "transparent", style: "cursor:grab" }, live);
    el("circle", { cx: x, cy: z, r: 0.7, fill: "#fff", stroke: "#000", "stroke-width": 0.1 }, live);
    const d = Math.hypot(x, z);
    if (SIMPLE) {
      ro.innerHTML = `distance to the goal <b>${fmt(d)} m</b>, angle you can see <b>${fmt(th)}°</b><br>` +
        (zf < 60 ? `that is the same view as standing <b>${fmt(zf)} m</b> straight in front of the goal (the small ring)` : "");
      return;
    }
    ro.innerHTML = `distance to goal centre <b>${fmt(d)} m</b>, goal angle <b>${fmt(th)}°</b><br>` +
      `circle radius R = 3.66 / sin θ = <b>${fmt(R)} m</b><br>` +
      (zf < 60 ? `same view as a ball <b>${fmt(zf)} m</b> straight in front of goal (ring)` : "");
  }
  let drag = false;
  const move = (e) => {
    if (!drag) return;
    e.preventDefault();
    const p = svgPoint(svg, e);
    ball = [Math.max(-28, Math.min(28, p.x)), Math.max(1.5, Math.min(38, p.y))];
    render();
  };
  svg.addEventListener("pointerdown", (e) => { drag = true; svg.setPointerCapture(e.pointerId); move(e); });
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", () => (drag = false));
  render();
}

/* ---------------- 2.2 the wall's shadow ---------------- */
export function initShadow() {
  const svg = $("#shadowSvg");
  svg.setAttribute("viewBox", "-1.5 -1.2 41 20");
  const GY = 17.6, Y = (h) => GY - 2 * h; // heights drawn 2x taller
  const input = $("#shadowD"), out = $("#shadowOut"), ro = $("#shadowReadout");
  const WALL = 2.05;
  function render() {
    const d = Number(input.value);
    out.textContent = d + " m";
    clear(svg);
    el("line", { x1: -1.5, y1: GY, x2: 40, y2: GY, stroke: "rgba(255,255,255,0.5)", "stroke-width": 0.06 }, svg);
    // metre ticks
    for (let m = 0; m <= 38; m += 5) {
      el("line", { x1: m, y1: GY, x2: m, y2: GY + 0.25, stroke: "rgba(255,255,255,0.4)", "stroke-width": 0.05 }, svg);
      el("text", { x: m, y: GY + 0.85, "font-size": 0.75, fill: "rgba(255,255,255,0.6)", "text-anchor": "middle", text: m + " m" }, svg);
    }
    const hGoal = (WALL * d) / 9.15;
    // shadow region
    el("path", { d: `M 9.15 ${Y(WALL)} L ${d} ${Y(hGoal)} L ${d} ${GY} L 9.15 ${GY} Z`, fill: "rgba(0,0,0,0.35)" }, svg);
    el("text", { x: (9.15 + d) / 2, y: GY - 0.5, "font-size": 0.75, fill: "rgba(255,255,255,0.55)", "text-anchor": "middle", text: "the wall's shadow" }, svg);
    // wall
    el("rect", { x: 8.9, y: Y(WALL), width: 0.5, height: 2 * WALL, fill: "#e9f0ec", rx: 0.12 }, svg);
    el("text", { x: 9.15, y: Y(WALL) - 0.35, "font-size": 0.75, fill: "#fff", "text-anchor": "middle", text: "wall 2.05 m" }, svg);
    // goal
    el("line", { x1: d, y1: GY, x2: d, y2: Y(2.44), stroke: "#fff", "stroke-width": 0.14 }, svg);
    el("line", { x1: d, y1: Y(2.44), x2: d + 1.4, y2: Y(2.44), stroke: "#fff", "stroke-width": 0.1 }, svg);
    el("text", { x: d + 0.3, y: Y(2.44) + 0.7, "font-size": 0.7, fill: "rgba(255,255,255,0.7)", text: "bar 2.44" }, svg);
    // the straight line
    el("line", { x1: 0, y1: GY, x2: d, y2: Y(hGoal), stroke: ACCENT, "stroke-width": 0.1, "stroke-dasharray": "0.35 0.2" }, svg);
    el("circle", { cx: d, cy: Y(hGoal), r: 0.22, fill: hGoal > 2.33 ? "#ff8a8a" : ACCENT }, svg);
    el("text", { x: d - 0.4, y: Y(hGoal) - 0.4, "font-size": 0.85, fill: hGoal > 2.33 ? "#ff8a8a" : ACCENT, "text-anchor": "end", text: `${fmt(hGoal, 2)} m` }, svg);
    // similar triangles labels
    el("line", { x1: 9.15, y1: GY + 1.2, x2: 9.15, y2: GY + 1.2, stroke: "none" }, svg);
    el("circle", { cx: 0, cy: GY - 0.22, r: 0.3, fill: "#fff" }, svg);
    el("text", { x: 39.4, y: -0.2, "font-size": 0.7, fill: "rgba(255,255,255,0.45)", "text-anchor": "end", text: "heights drawn 2× taller" }, svg);
    el("text", { x: 0, y: GY - 0.6, "font-size": 0.75, fill: "#fff", "text-anchor": "middle", text: "ball" }, svg);
    const over = hGoal - 2.33;
    ro.innerHTML = (SIMPLE ? `height at the goal = 2.05 × ${d} ÷ 9.15 = <b>${fmt(hGoal, 2)} m</b><br>` : `h<sub>goal</sub> = 2.05 × ${d} / 9.15 = <b>${fmt(hGoal, 2)} m</b><br>`) +
      (over > 0 ? `<span class="bad">${fmt(over, 2)} m too high: a straight shot that clears the wall goes over the bar.</span>`
                : `<span class="good">Under the bar. Only possible when the ball is this close.</span>`);
  }
  input.addEventListener("input", render);
  render();
}

/* ---------------- 2.3 parabola + feasible window ---------------- */
export function initParabola() {
  const svg = $("#pbSvg"), win = $("#windowSvg") || document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "-1.5 -1.2 41 14");
  const GY = 11.6, Y = (h) => GY - 2 * h; // heights drawn 2x taller
  const iv = $("#pbV"), ia = $("#pbA"), id = $("#pbD"), real = $("#pbReal") || { checked: false, addEventListener() {} };
  const ro = $("#pbReadout");
  const WALL = 2.05, R = 0.11;

  const yAt = (x, v, a) => R + x * Math.tan(a) - (G * x * x) / (2 * v * v * Math.cos(a) ** 2);
  const ok = (v, aDeg, d) => {
    const a = (aDeg * Math.PI) / 180;
    const yw = yAt(9.15, v, a), yg = yAt(d, v, a);
    return yw >= WALL + R && yg <= 2.44 - R && yg >= R;
  };

  // window chart
  const W = 520, H = 260, m = { l: 46, r: 12, t: 10, b: 36 };
  const vMin = 10, vMax = 36, aMin = 0, aMax = 40;
  const sx = (v) => m.l + ((v - vMin) / (vMax - vMin)) * (W - m.l - m.r);
  const sy = (a) => H - m.b - ((a - aMin) / (aMax - aMin)) * (H - m.t - m.b);
  let lastD = null, cells = null, closeV = null;
  function drawWindow(v, aDeg, d) {
    if (d !== lastD) {
      lastD = d;
      clear(win);
      // grid
      for (let a = 0; a <= 40; a += 10) {
        el("line", { x1: m.l, x2: W - m.r, y1: sy(a), y2: sy(a), stroke: "rgba(255,255,255,0.08)" }, win);
        el("text", { x: m.l - 8, y: sy(a) + 4, "font-size": 11, fill: "#84978e", "text-anchor": "end", text: a + "°" }, win);
      }
      for (let s = 10; s <= 36; s += 5) {
        el("text", { x: sx(s), y: H - m.b + 16, "font-size": 11, fill: "#84978e", "text-anchor": "middle", text: s }, win);
      }
      el("text", { x: (W + m.l) / 2, y: H - 4, "font-size": 11, fill: "#b8c7bf", "text-anchor": "middle", text: "launch speed (m/s)" }, win);
      el("text", { x: 12, y: (H - m.b) / 2, "font-size": 11, fill: "#b8c7bf", "text-anchor": "middle", transform: `rotate(-90 12 ${(H - m.b) / 2})`, text: "launch angle" }, win);
      // feasible cells
      cells = el("g", {}, win);
      closeV = null;
      const dv = 0.25, da = 0.25;
      for (let s = vMin; s < vMax; s += dv) {
        let any = false;
        for (let a = aMin; a < aMax; a += da) {
          if (ok(s + dv / 2, a + da / 2, d)) {
            any = true;
            el("rect", { x: sx(s), y: sy(a + da), width: sx(s + dv) - sx(s) + 0.4, height: sy(a) - sy(a + da) + 0.4, fill: "rgba(212,255,58,0.55)" }, cells);
          }
        }
        if (any) closeV = s + dv;
      }
      if (closeV) {
        el("line", { x1: sx(closeV), x2: sx(closeV), y1: m.t, y2: H - m.b, stroke: "#ff8a8a", "stroke-dasharray": "4 4" }, win);
        el("text", { x: sx(closeV) + 6, y: m.t + 14, "font-size": 11, fill: "#ff8a8a", text: `window closes ≈ ${fmt(closeV, 1)} m/s` }, win);
      }
      win.marker = el("g", {}, win);
    }
    clear(win.marker);
    el("circle", { cx: sx(v), cy: sy(aDeg), r: 6, fill: "none", stroke: "#fff", "stroke-width": 2 }, win.marker);
    el("circle", { cx: sx(v), cy: sy(aDeg), r: 2, fill: "#fff" }, win.marker);
  }

  function render() {
    const v = +iv.value, aDeg = +ia.value, d = +id.value;
    $("#pbVout").textContent = `${v} m/s (${Math.round(v * 3.6)} km/h)`;
    $("#pbAout").textContent = aDeg + "°";
    $("#pbDout").textContent = d + " m";
    const a = (aDeg * Math.PI) / 180;
    clear(svg);
    el("line", { x1: -1.5, y1: GY, x2: 40, y2: GY, stroke: "rgba(255,255,255,0.5)", "stroke-width": 0.06 }, svg);
    el("rect", { x: 8.9, y: Y(WALL), width: 0.5, height: 2 * WALL, fill: "#e9f0ec", rx: 0.12 }, svg);
    el("line", { x1: d, y1: GY, x2: d, y2: Y(2.44), stroke: "#fff", "stroke-width": 0.14 }, svg);
    el("line", { x1: d, y1: Y(2.44), x2: d + 1.4, y2: Y(2.44), stroke: "#fff", "stroke-width": 0.1 }, svg);
    // window marks
    el("line", { x1: 9.15, y1: Y(WALL + R), x2: 9.15, y2: Y(5.5), stroke: ACCENT, "stroke-width": 0.08, opacity: 0.5 }, svg);
    el("line", { x1: d - 0.15, y1: Y(R), x2: d - 0.15, y2: Y(2.44 - R), stroke: ACCENT, "stroke-width": 0.12, opacity: 0.6 }, svg);
    // vacuum parabola
    let dpath = "";
    for (let x = 0; x <= d + 0.01; x += 0.2) {
      const y = yAt(x, v, a);
      if (y < 0) break;
      dpath += (dpath ? " L " : "M ") + x.toFixed(2) + " " + Y(y).toFixed(3);
    }
    const good = ok(v, aDeg, d);
    el("text", { x: 39.4, y: -0.2, "font-size": 0.7, fill: "rgba(255,255,255,0.45)", "text-anchor": "end", text: "heights drawn 2× taller" }, svg);
    el("circle", { cx: 0, cy: Y(R), r: 0.3, fill: "#fff" }, svg);
    el("path", { d: dpath, fill: "none", stroke: good ? ACCENT : "#ff8a8a", "stroke-width": 0.1 }, svg);
    // real flight
    let realTxt = "";
    if (real.checked) {
      const sim = simulate({ ball: [0, d], speed: v, elev: aDeg, aim: 0, side: 0, top: 3, knuckle: 0 }, { tMax: 3 });
      let rp = "";
      for (const [j, p] of sim.pts.entries()) {
        const x = d - p.z;
        if (x > d || (j > 5 && p.y <= 0.12)) break;
        rp += (rp ? " L " : "M ") + x.toFixed(2) + " " + Y(p.y).toFixed(3);
      }
      el("path", { d: rp, fill: "none", stroke: "#3a8bdb", "stroke-width": 0.1, "stroke-dasharray": "0.3 0.15" }, svg);
      const peak = sim.pts.reduce((b, p) => (p.y > b.y ? p : b), sim.pts[0]);
      const xr = d - peak.z;
      realTxt = sim.crossed
        ? `<br><span style="color:#3a8bdb">real flight</span>: arrives at <b>${fmt(sim.crossed.y, 2)} m</b> after ${fmt(sim.crossed.t, 2)} s. Peak at ${fmt(xr)} m of ${d} m (${Math.round((100 * xr) / d)}%: not the middle)`
        : `<br><span style="color:#3a8bdb">real flight</span>: drops short of the goal`;
    }
    const yw = yAt(9.15, v, a), yg = yAt(d, v, a);
    const t = d / (v * Math.cos(a));
    if (SIMPLE) {
      ro.innerHTML = `over the wall? <b>${fmt(yw, 2)} m</b> high ${yw >= WALL + R ? "✓ yes" : '<span class="bad">✗ hits the wall</span>'}<br>` +
        `under the bar? <b>${fmt(yg, 2)} m</b> high at the goal ${yg <= 2.33 && yg >= R ? "✓ yes" : '<span class="bad">✗ misses</span>'}<br>` +
        `time in the air: <b>${fmt(t, 2)} s</b>`;
      drawWindow(v, aDeg, d);
      return;
    }
    ro.innerHTML = `parabola: at the wall <b>${fmt(yw, 2)} m</b> ${yw >= WALL + R ? "✓" : '<span class="bad">✗ hits wall</span>'}, at the goal <b>${fmt(yg, 2)} m</b> ${yg <= 2.33 && yg >= R ? "✓" : '<span class="bad">✗ misses</span>'}, flight ${fmt(t, 2)} s` + realTxt;
    drawWindow(v, aDeg, d);
  }
  [iv, ia, id, real].forEach((i) => i.addEventListener("input", render));
  render();
}

/* ---------------- 2.4 circle + sagitta ---------------- */
export function initCircle() {
  const svg = $("#ciSvg");
  svg.setAttribute("viewBox", "-12 -3 24 40");
  const iR = $("#ciR"), iC = $("#ciC"), ro = $("#ciReadout");
  function render() {
    const R = +iR.value, c = +iC.value;
    $("#ciRout").textContent = R + " m";
    $("#ciCout").textContent = c + " m";
    clear(svg);
    drawPitch(svg, { depth: 40, halfW: 12 });
    // ball and target (top-left corner from the kicker's view)
    const B = [3.2, c], T = [-2.9, 0];
    const mx = (B[0] + T[0]) / 2, mz = (B[1] + T[1]) / 2;
    const L = Math.hypot(T[0] - B[0], T[1] - B[1]);
    const ux = (T[0] - B[0]) / L, uz = (T[1] - B[1]) / L;
    const nx = -uz, nz = ux; // normal pointing to kicker's right (bulge side)
    const half = L / 2;
    const sag = R - Math.sqrt(Math.max(0, R * R - half * half));
    // circle centre on the opposite side of the bulge
    const off = Math.sqrt(Math.max(0, R * R - half * half));
    const cx = mx - nx * off, cz = mz - nz * off;
    // chord
    el("line", { x1: B[0], y1: B[1], x2: T[0], y2: T[1], stroke: "rgba(255,255,255,0.5)", "stroke-width": 0.1, "stroke-dasharray": "0.4 0.3" }, svg);
    // wall (perpendicular to chord at 9.15 m)
    const wx = B[0] + ux * 9.15, wz = B[1] + uz * 9.15;
    el("line", { x1: wx - nx * 1.3, y1: wz - nz * 1.3, x2: wx + nx * 0.9, y2: wz + nz * 0.9, stroke: "#e9f0ec", "stroke-width": 0.55, "stroke-linecap": "round" }, svg);
    // arc
    el("path", { d: `M ${B[0]} ${B[1]} A ${R} ${R} 0 0 0 ${T[0]} ${T[1]}`, fill: "none", stroke: ACCENT, "stroke-width": 0.2 }, svg);
    // sagitta
    el("line", { x1: mx, y1: mz, x2: mx + nx * sag, y2: mz + nz * sag, stroke: "#d9578a", "stroke-width": 0.16 }, svg);
    el("text", { x: mx + nx * sag + 0.5, y: mz + nz * sag, "font-size": 0.9, fill: "#d9578a", text: `s = ${fmt(sag, 2)} m` }, svg);
    // offset at the wall
    const u = 9.15 - half; // distance from chord midpoint along the chord
    const offW = Math.sqrt(Math.max(0, R * R - u * u)) - off;
    el("circle", { cx: wx + nx * offW, cy: wz + nz * offW, r: 0.25, fill: ACCENT }, svg);
    el("circle", { cx: B[0], cy: B[1], r: 0.45, fill: "#fff" }, svg);
    // centre direction hint
    el("text", { x: -11.5, y: 36.5, "font-size": 0.85, fill: "rgba(255,255,255,0.6)", text: `centre of the circle is ${fmt(R)} m away` }, svg);
    if (SIMPLE) {
      ro.innerHTML = `the ball bends <b>${fmt(sag, 2)} m</b> away from a straight line<br>` +
        `quick check: ${fmt(L, 0)} × ${fmt(L, 0)} ÷ (8 × ${R}) = <b>${fmt((L * L) / (8 * R), 2)} m</b> (close!)`;
      return;
    }
    ro.innerHTML = `chord c = <b>${fmt(L, 1)} m</b>, exact sagitta <b>${fmt(sag, 2)} m</b>, approximation c²/8R = <b>${fmt((L * L) / (8 * R), 2)} m</b><br>sideways bend when passing the wall: <b>${fmt(offW, 2)} m</b>`;
  }
  [iR, iC].forEach((i) => i.addEventListener("input", render));
  render();
}
