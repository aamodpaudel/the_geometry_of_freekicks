import { $, $$, onVisible } from "./util.js?v=20261004c";
import { initAngle, initShadow, initParabola, initCircle } from "./geometry.js?v=20261004c";
import { initSpiral, initKnuckle } from "./spiral.js?v=20261004c";
import { initData } from "./data.js?v=20261004c";
import { initArt } from "./art.js?v=20261004c";
import { initVerdict } from "./verdict.js?v=20261004c";

// ---------- maths typesetting ----------
function typeset() {
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
}
typeset();
window.typesetMath = (node) =>
  window.renderMathInElement?.(node, {
    delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
    throwOnError: false,
  });

// ---------- nav + progress ----------
const nav = $("#nav"), bar = $("#progress");
const sections = ["notice", "explain", "verdict", "create", "reflect"].map((id) => document.getElementById(id)).filter(Boolean);
function onScroll() {
  const h = document.documentElement;
  bar.style.width = (100 * h.scrollTop) / (h.scrollHeight - h.clientHeight) + "%";
  nav.classList.toggle("solid", h.scrollTop > 60);
  let cur = null;
  for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s.id;
  $$(".links a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + cur));
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------- reveal on scroll ----------
const io = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { threshold: 0.12 });
$$(".clip, .feature, .name-card, .questions, .chapter, .aside-knuckle, .stat-row, .lab, .art, .r-card, .prose, .step, .gloss-card, .rm-grid, .pieces, .recipe, .catch, .verdict-fig").forEach((n) => {
  n.classList.add("reveal");
  io.observe(n);
});

// ---------- hero ball follows the curve ----------
{
  const path = $("#heroPath"), ball = $("#heroBall");
  const L = path.getTotalLength();
  const start = performance.now() + 400;
  const dur = 2600;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / dur));
    const p = path.getPointAtLength(ease(t) * L);
    ball.setAttribute("cx", p.x);
    ball.setAttribute("cy", p.y);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- clips: play while visible, slow motion ----------
$$("[data-clip]").forEach((card) => {
  const v = $("video", card);
  v.playbackRate = 0.5;
  const vis = new IntersectionObserver((es) => {
    for (const e of es) {
      if (e.isIntersecting) { v.playbackRate = Number($(".speed-ctl .on", card).dataset.rate); v.play().catch(() => {}); }
      else v.pause();
    }
  }, { threshold: 0.4 });
  vis.observe(v);
  $$(".speed-ctl button", card).forEach((b) =>
    b.addEventListener("click", () => {
      $$(".speed-ctl button", card).forEach((x) => x.classList.toggle("on", x === b));
      v.playbackRate = Number(b.dataset.rate);
      v.play().catch(() => {});
    })
  );
});

// ---------- tracked Ronaldo trail ----------
async function initTrail() {
  const cv = $("#trailCanvas"), ctx = cv.getContext("2d");
  const [meta, img] = await Promise.all([
    fetch("media/ronaldo_points.json").then((r) => r.json()),
    new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "media/ronaldo_still.jpg"; }),
  ]);
  const S = cv.width / meta.w; // scale image to canvas
  cv.height = Math.round(meta.h * S);
  const pts = meta.points.map(([x, y]) => [x * S, y * S]);
  const after = pts.slice(4); // points after the wall
  let shown = 0, fit = "none", anim = null;

  // least-squares fits in screen coordinates (y as a function of x is bad here, so fit x as a function of y for line/parabola)
  const fits = {
    line() {
      const n = after.length;
      let sy = 0, sx = 0, syy = 0, sxy = 0;
      for (const [x, y] of after) { sy += y; sx += x; syy += y * y; sxy += x * y; }
      const b = (n * sxy - sx * sy) / (n * syy - sy * sy), a = (sx - b * sy) / n;
      return { f: (y) => a + b * y, err: rms((p) => p[0] - (a + b * p[1])) };
    },
    parabola() {
      const A = after.map(([, y]) => [1, y, y * y]), bb = after.map(([x]) => x);
      const c = lstsq(A, bb);
      return { f: (y) => c[0] + c[1] * y + c[2] * y * y, err: rms((p) => p[0] - (c[0] + c[1] * p[1] + c[2] * p[1] ** 2)) };
    },
    circle() {
      const A = after.map(([x, y]) => [2 * x, 2 * y, 1]), bb = after.map(([x, y]) => x * x + y * y);
      const [cx, cy, k] = lstsq(A, bb);
      const r = Math.sqrt(k + cx * cx + cy * cy);
      return { cx, cy, r, err: rms((p) => Math.hypot(p[0] - cx, p[1] - cy) - r) };
    },
  };
  function rms(fn) { return Math.sqrt(after.reduce((s, p) => s + fn(p) ** 2, 0) / after.length); }
  const results = Object.fromEntries(Object.entries(fits).map(([k, f]) => [k, f()]));

  function draw() {
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, cv.width, cv.height);
    // fitted shape
    if (fit !== "none" && shown >= pts.length) {
      const r = results[fit];
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = fit === "circle" ? "#d4ff3a" : "#ff9a9a";
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      if (fit === "circle") ctx.arc(r.cx, r.cy, r.r, 0, Math.PI * 2);
      else {
        const y0 = after[after.length - 1][1] - 40, y1 = after[0][1] + 120;
        for (let y = y0; y <= y1; y += 4) { const x = r.f(y); y === y0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      }
      ctx.stroke();
      ctx.restore();
    }
    // dots + connecting path
    ctx.save();
    ctx.strokeStyle = "rgba(212,255,58,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.slice(0, shown).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    pts.slice(0, shown).forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, i < 4 ? 6 : 7, 0, Math.PI * 2);
      ctx.fillStyle = i < 4 ? "rgba(255,255,255,0.75)" : "#fff";
      ctx.shadowColor = "#d4ff3a"; ctx.shadowBlur = 14;
      ctx.fill();
    });
    ctx.restore();
    ctx.font = "600 22px JetBrains Mono, monospace";
    ctx.fillStyle = "#d4ff3a";
    ctx.fillText(`frame ${Math.min(shown, pts.length)} / ${pts.length}`, 18, 34);
  }
  function play() {
    cancelAnimationFrame(anim);
    shown = 0;
    let last = 0;
    const step = (t) => {
      if (t - last > 110) { shown++; last = t; draw(); }
      if (shown < pts.length) anim = requestAnimationFrame(step);
      else draw();
    };
    anim = requestAnimationFrame(step);
  }
  const ro = $("#fitReadout");
  const label = { line: "Straight line", parabola: "Parabola", circle: "Circle" };
  $$("#trail .fit-btns button").forEach((b) =>
    b.addEventListener("click", () => {
      fit = b.dataset.fit;
      $$("#trail .fit-btns button").forEach((x) => x.classList.toggle("on", x === b));
      if (shown < pts.length) shown = pts.length;
      draw();
      if (fit === "none") { ro.innerHTML = "Press a shape to fit it to the 15 points after the wall."; return; }
      const rows = ["line", "parabola", "circle"].map((k) => `${k === fit ? "<b>" : ""}${label[k].padEnd(14, " ")} average miss ${(results[k].err / S).toFixed(1)} px${k === fit ? "</b>" : ""}`);
      ro.innerHTML = rows.join("<br>") + (fit === "circle" ? "<br>The circle is the closest fit." : "");
    })
  );
  $("#trailReplay").addEventListener("click", play);
  draw();
  onVisible(cv, play, "-20%");
}

function lstsq(A, b) {
  // normal equations, 3x3
  const n = A[0].length;
  const M = Array.from({ length: n }, () => Array(n + 1).fill(0));
  A.forEach((row, r) => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i][j] += row[i] * row[j];
      M[i][n] += row[i] * b[r];
    }
  });
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

if ($("#trailCanvas")) initTrail();
if ($("#angleSvg")) initAngle();
if ($("#shadowSvg")) initShadow();
if ($("#pbSvg")) initParabola();
if ($("#ciSvg")) initCircle();
if ($("#spiralCanvas")) onVisible($("#spiralCanvas"), initSpiral);
if ($("#knuckleCanvas")) onVisible($("#knuckleCanvas"), initKnuckle);
if ($("#statRow") || $("#mapSvg")) initData();
if ($("#lab")) onVisible($("#lab"), () => import("./lab.js?v=20261004c").then((m) => m.initLab()), "400px");
if ($("#verdictSvg")) initVerdict();
if ($("#art")) onVisible($("#art"), initArt, "300px");
