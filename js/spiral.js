import { el, clear, $, fmt } from "./util.js?v=20261004c";
import { simulate, presets, planCurvature, wallFor, GOAL } from "./physics.js?v=20261004c";

const ACCENT = "#d4ff3a";

/* ---------------- 2.5 the Carlos spiral ---------------- */
export function initSpiral() {
  const cv = $("#spiralCanvas"), ctx = cv.getContext("2d");
  const toggle = $("#spEndless") || { checked: false, addEventListener() {} };
  const carlos = presets().carlos;
  let raf = null;

  function run() {
    cancelAnimationFrame(raf);
    const endless = toggle.checked;
    const sim = endless
      ? simulate({ ...carlos, elev: 0 }, { tMax: 9, noStop: true, float: true, linearMagnus: true, dt: 1 / 240 })
      : simulate(carlos);
    const pts = sim.pts;
    const curv = planCurvature(pts, 8);
    drawKappa(planCurvature(simulate(carlos).pts, 8));

    const W = cv.width, H = cv.height, pad = 70;
    let toScreen, exaggeration = 1;
    if (endless) {
      // equal scale, fit bounds
      const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
      const minX = Math.min(...xs, -4), maxX = Math.max(...xs, 4), minZ = Math.min(...zs, 0), maxZ = Math.max(...zs);
      const s = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxZ - minZ));
      const ox = (W - s * (maxX - minX)) / 2, oz = (H - s * (maxZ - minZ)) / 2;
      toScreen = (x, z) => [ox + (x - minX) * s, oz + (z - minZ) * s];
      toScreen.s = s;
    } else {
      // distance along the pitch horizontally, sideways deviation vertically (exaggerated)
      exaggeration = 4;
      const z0 = carlos.ball[1];
      const s = (W - 2 * pad) / z0;
      toScreen = (x, z) => [pad + (z0 - z) * s, H / 2 + 60 - (x - carlos.ball[0]) * s * exaggeration];
      toScreen.s = s;
    }

    let i = 0;
    const total = pts.length;
    const speed = Math.max(2, Math.round(total / 140));
    const frame = () => {
      i = Math.min(total, i + speed);
      ctx.fillStyle = "#12301f";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let g = 0; g < W; g += 90) ctx.fillRect(g, 0, 45, H);

      ctx.font = "600 20px JetBrains Mono, monospace";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      if (endless) {
        ctx.fillText("Top view, true scale, gravity switched off", 24, 36);
        ctx.fillText("(spin force grows with ω times v, as in Dupeux et al. 2010)", 24, 62);
        // goal
        const [g1x, g1y] = toScreen(-GOAL.half, 0), [g2x, g2y] = toScreen(GOAL.half, 0);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(g1x, g1y); ctx.lineTo(g2x, g2y); ctx.stroke();
      } else {
        ctx.fillText(`Path seen from above, sideways scale ×${exaggeration}`, 24, 36);
        // goal line + wall markers
        const [gx] = toScreen(0, 0);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
        const [, py1] = toScreen(GOAL.half, 0), [, py2] = toScreen(-GOAL.half, 0);
        ctx.beginPath(); ctx.moveTo(gx, py1); ctx.lineTo(gx, py2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText("goal", gx - 60, py2 + 28);
        const w = wallFor(carlos.ball);
        const [wx1, wy1] = toScreen(w.a[0], w.a[1]), [wx2, wy2] = toScreen(w.b[0], w.b[1]);
        ctx.strokeStyle = "#e9f0ec"; ctx.lineWidth = 12; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(wx1, wy1); ctx.lineTo(wx2, wy2); ctx.stroke();
        ctx.fillText("wall", wx1 + 14, Math.max(wy1, wy2) + 30);
        // straight aim line
        const [bx, by] = toScreen(carlos.ball[0], carlos.ball[1]);
        ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.35)";
        const p1 = pts[Math.min(20, total - 1)];
        const [ax, ay] = toScreen(p1.x, p1.z);
        const k = 12;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + (ax - bx) * k, by + (ay - by) * k); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("where it was aimed", Math.min(W - 230, bx + (ax - bx) * 9 + 14), Math.max(60, by + (ay - by) * 9));
      }

      // osculating circles (true scale only)
      if (endless) {
        for (const c of [0.12, 0.35, 0.55, 0.72, 0.86].map((f) => curv[Math.floor(f * (curv.length - 1))])) {
          const idx = pts.findIndex((p) => p.x === c.x && p.z === c.z);
          if (idx > i) continue;
          const R = 1 / Math.abs(c.k);
          // centre: perpendicular to velocity toward the inside
          const a = pts[Math.max(0, idx - 4)], b = pts[Math.min(total - 1, idx + 4)];
          const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz);
          let nx = -tz / tl, nz = tx / tl;
          if (Math.sign(c.k) < 0) { nx = -nx; nz = -nz; }
          const [sx, sy] = toScreen(c.x + nx * R, c.z + nz * R);
          ctx.strokeStyle = "rgba(217,87,138,0.75)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx, sy, R * toScreen.s, 0, Math.PI * 2); ctx.stroke();
          const [px, py] = toScreen(c.x, c.z);
          ctx.fillStyle = "#d9578a";
          ctx.fillText(`R ≈ ${Math.round(R)} m`, px + 12, py - 10);
        }
      }

      // path coloured by speed
      ctx.lineWidth = 6; ctx.lineCap = "round";
      for (let j = 1; j < i; j++) {
        const a = pts[j - 1], b = pts[j];
        const [x1, y1] = toScreen(a.x, a.z), [x2, y2] = toScreen(b.x, b.z);
        const f = Math.min(1, b.v / carlos.speed);
        ctx.strokeStyle = `rgba(${Math.round(212 * f + 217 * (1 - f))},${Math.round(255 * f + 87 * (1 - f))},${Math.round(58 * f + 138 * (1 - f))},1)`;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      const cur = pts[i - 1];
      const [cx, cy] = toScreen(cur.x, cur.z);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();

      // curvature labels along the real path
      if (!endless) {
        ctx.fillStyle = "#fff";
        for (const f of [0.15, 0.5, 0.85]) {
          const c = curv[Math.floor(f * (curv.length - 1))];
          const idx = pts.findIndex((p) => p.x === c.x && p.z === c.z);
          if (idx > i) continue;
          const [px, py] = toScreen(c.x, c.z);
          ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillText(`R ≈ ${Math.round(1 / Math.abs(c.k))} m, ${fmt(c.v, 0)} m/s`, px - 100, py + (f === 0.5 ? -22 : 40));
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(`t = ${fmt(cur.t, 2)} s   speed ${fmt(cur.v, 1)} m/s`, 24, H - 28);
      if (i < total) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  toggle.addEventListener("change", run);
  cv.addEventListener("click", run);
  run();
}

function drawKappa(curv) {
  const svg = $("#kappaSvg");
  if (!svg) return;
  clear(svg);
  const W = 520, H = 220, m = { l: 66, r: 16, t: 22, b: 34 };
  const sMax = curv[curv.length - 1].s;
  const ks = curv.map((c) => Math.abs(c.k));
  const kMax = Math.max(...ks) * 1.1;
  const sx = (s) => m.l + (s / sMax) * (W - m.l - m.r);
  const sy = (k) => H - m.b - (k / kMax) * (H - m.t - m.b);
  for (let i = 0; i <= 4; i++) {
    const k = (kMax * i) / 4;
    el("line", { x1: m.l, x2: W - m.r, y1: sy(k), y2: sy(k), stroke: "rgba(255,255,255,0.08)" }, svg);
    el("text", { x: m.l - 8, y: sy(k) + 4, "font-size": 11, fill: "#84978e", "text-anchor": "end", text: k.toFixed(3) }, svg);
  }
  for (let s = 0; s <= sMax; s += 5) el("text", { x: sx(s), y: H - m.b + 16, "font-size": 11, fill: "#84978e", "text-anchor": "middle", text: s }, svg);
  el("text", { x: (W + m.l) / 2, y: H - 2, "font-size": 11, fill: "#b8c7bf", "text-anchor": "middle", text: "distance travelled (m)" }, svg);
  el("text", { x: 12, y: (H - m.b) / 2, "font-size": 11, fill: "#b8c7bf", "text-anchor": "middle", transform: `rotate(-90 12 ${(H - m.b) / 2})`, text: "curvature κ (1/m)" }, svg);
  const d = curv.map((c, i) => `${i ? "L" : "M"} ${sx(c.s).toFixed(1)} ${sy(Math.abs(c.k)).toFixed(1)}`).join(" ");
  el("path", { d, fill: "none", stroke: ACCENT, "stroke-width": 2, "stroke-linejoin": "round" }, svg);
  // speed annotations (text, not a second axis)
  for (const f of [0.05, 0.5, 0.95]) {
    const c = curv[Math.floor(f * (curv.length - 1))];
    el("circle", { cx: sx(c.s), cy: sy(Math.abs(c.k)), r: 4, fill: ACCENT, stroke: "#15201c", "stroke-width": 2 }, svg);
    el("text", { x: sx(c.s) + (f > 0.9 ? -8 : 8), y: sy(Math.abs(c.k)) - 10, "font-size": 11, fill: "#e9f0ec", "text-anchor": f > 0.9 ? "end" : "start", text: `${c.v.toFixed(0)} m/s, R ≈ ${Math.round(1 / Math.abs(c.k))} m` }, svg);
  }
}

/* ---------------- knuckleball fan ---------------- */
export function initKnuckle() {
  const cv = $("#knuckleCanvas"), ctx = cv.getContext("2d");
  const base = presets().knuckle;
  const W = cv.width, H = cv.height;
  // simple perspective camera behind the ball
  // camera raised behind the ball, looking at the middle of the goal
  const cam = { x: base.ball[0] * 0.8, y: 5.5, z: base.ball[1] + 9 };
  const f = 2300;
  const look = { x: -1, y: 1.0, z: 0 };
  const proj = (x, y, z) => {
    const dz = cam.z - z;
    const k = dz / (cam.z - look.z);
    const cx = cam.x + (look.x - cam.x) * k, cy = cam.y + (look.y - cam.y) * k;
    return [W / 2 + ((x - cx) * f) / dz, H * 0.5 - ((y - cy) * f) / dz];
  };
  let raf;
  function run() {
    cancelAnimationFrame(raf);
    const seeds = Array.from({ length: 12 }, () => Math.random() * 100);
    const sims = seeds.map((seed) => simulate({ ...base, seed }));
    const wall = wallFor(base.ball);
    let t = 0;
    const tEnd = Math.max(...sims.map((s) => s.pts[s.pts.length - 1].t));
    const start = performance.now();
    const frame = (now) => {
      t = Math.min(tEnd, ((now - start) / 1000) * 0.6);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0b1620"); sky.addColorStop(0.42, "#13202a"); sky.addColorStop(0.42, "#1b3a26"); sky.addColorStop(1, "#12301f");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      const hz = proj(0, 0, -400)[1];
      ctx.fillStyle = "#1b3a26"; ctx.fillRect(0, hz, W, H - hz);
      // goal
      const p = (x, y) => proj(x, y, 0);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(...p(-GOAL.half, 0)); ctx.lineTo(...p(-GOAL.half, GOAL.bar)); ctx.lineTo(...p(GOAL.half, GOAL.bar)); ctx.lineTo(...p(GOAL.half, 0));
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.moveTo(...p(-GOAL.half, 0)); ctx.lineTo(...p(-GOAL.half, GOAL.bar)); ctx.lineTo(...p(GOAL.half, GOAL.bar)); ctx.lineTo(...p(GOAL.half, 0)); ctx.fill();
      // wall
      const n = 4;
      for (let k = 0; k < n; k++) {
        const fx = wall.a[0] + ((wall.b[0] - wall.a[0]) * (k + 0.5)) / n, fz = wall.a[1] + ((wall.b[1] - wall.a[1]) * (k + 0.5)) / n;
        const [x0, y0] = proj(fx - 0.22, 0, fz), [x1, y1] = proj(fx + 0.22, 1.85, fz);
        ctx.fillStyle = "rgba(233,240,236,0.85)";
        ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
      }
      // paths
      sims.forEach((s, j) => {
        ctx.strokeStyle = `hsla(${(j * 29) % 360}, 0%, ${70 + (j % 3) * 10}%, 0.85)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let last = null;
        for (const q of s.pts) {
          if (q.t > t) break;
          const [x, y] = proj(q.x, q.y, q.z);
          last ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          last = [x, y, q];
        }
        ctx.stroke();
        if (last) {
          const r = Math.max(3, 0.11 * f / (cam.z - last[2].z));
          ctx.fillStyle = s.crossed && last[2].t >= s.crossed.t - 0.01 ? ACCENT : "#fff";
          ctx.beginPath(); ctx.arc(last[0], last[1], r, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.font = "600 18px JetBrains Mono, monospace";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("12 knuckleballs, identical launch", 20, 32);
      if (t >= tEnd - 1e-3) {
        const xs = sims.filter((s) => s.crossed).map((s) => s.crossed.x), ys = sims.filter((s) => s.crossed).map((s) => s.crossed.y);
        if (xs.length) ctx.fillText(`spread at the goal: ${fmt(Math.max(...xs) - Math.min(...xs), 1)} m sideways, ${fmt(Math.max(...ys) - Math.min(...ys), 1)} m up/down`, 20, 58);
      }
      if (t < tEnd) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  $("#knuckleAgain").addEventListener("click", run);
  run();
}
