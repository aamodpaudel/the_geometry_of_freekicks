import { el, $, svgPoint, goalAngle, isoCircle, drawPitch, showTip, hideTip, fmt } from "./util.js?v=20261004c";

const COL = { goal: "#d9578a", other: "#3a8bdb", wall: "#7e9a14" };
export let MODEL = null;

export function prob(x, z, c = MODEL) {
  const th = goalAngle(x, z), d = Math.hypot(x, z);
  return 1 / (1 + Math.exp(-(c.b0 + c.b_theta * th + c.b_d * d)));
}

export async function loadModel() {
  if (MODEL) return MODEL;
  const D = await fetch("data/freekicks.json").then((r) => r.json());
  MODEL = D.summary.coef;
  MODEL.data = D;
  return MODEL;
}

const setHTML = (sel, html) => { const n = $(sel); if (n) n.innerHTML = html; };

export async function initData() {
  await loadModel();
  const D = MODEL.data;
  const S = D.summary;
  const messi = D.shots.filter((s) => s.messi);
  const blocked = messi.filter((s) => s.out === "Blocked").length;
  const posts = messi.filter((s) => /Post/.test(s.out)).length;
  setHTML("#dN", S.n.toLocaleString());

  setHTML("#statRow", [
    [messi.length, "direct free kicks by Messi in La Liga"],
    [S.messi_goals, `goals (${fmt((100 * S.messi_goals) / messi.length)}% of attempts)`],
    [blocked, `blocked by the wall (${Math.round((100 * blocked) / messi.length)}%)`],
    [posts, "hit the post or bar"],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join(""));

  const cat = (s) => (s.goal ? "goal" : s.out === "Blocked" ? "wall" : "other");
  const outLabel = (s) => (s.goal ? "Goal" : s.out === "Blocked" ? "Blocked by the wall" : s.out === "Off T" ? "Off target" : s.out);

  /* ---------- map of locations ---------- */
  const map = $("#mapSvg");
  if (map) {
  map.setAttribute("viewBox", "-30 -3 60 44");
  drawPitch(map, { depth: 41 });
  const defs = el("defs", {}, map);
  const cp = el("clipPath", { id: "mapClip" }, defs);
  el("rect", { x: -30, y: 0, width: 60, height: 41 }, cp);
  const iso = el("g", { "clip-path": "url(#mapClip)", fill: "none", stroke: "rgba(255,255,255,0.22)", "stroke-width": 0.1, "stroke-dasharray": "0.5 0.4" }, map);
  for (const th of [10, 15, 20, 30]) {
    const { R, zc } = isoCircle(th);
    el("circle", { cx: 0, cy: zc, r: R }, iso);
    el("text", { x: 0.4, y: zc + R - 0.4, "font-size": 1.1, fill: "rgba(255,255,255,0.5)", stroke: "none", text: th + "°" }, iso);
  }
  const order = { other: 0, wall: 1, goal: 2 };
  const dots = el("g", {}, map);
  [...messi].sort((a, b) => order[cat(a)] - order[cat(b)]).forEach((s) => {
    const c = el("circle", { cx: s.x, cy: s.z, r: cat(s) === "goal" ? 0.62 : 0.48, fill: COL[cat(s)], stroke: "#12301f", "stroke-width": 0.14 }, dots);
    c.addEventListener("pointerenter", (e) => {
      c.setAttribute("r", 0.9);
      showTip(`<b>${outLabel(s)}</b>${s.season} vs ${s.opp}<br>distance ${fmt(s.d)} m, angle ${fmt(s.th)}°<br>model chance ${fmt(100 * prob(s.x, s.z), 1)}%`, e.clientX, e.clientY);
    });
    c.addEventListener("pointermove", (e) => showTip(document.getElementById("tip").innerHTML, e.clientX, e.clientY));
    c.addEventListener("pointerleave", () => { c.setAttribute("r", cat(s) === "goal" ? 0.62 : 0.48); hideTip(); });
  });

  }

  /* ---------- goal face ---------- */
  const face = $("#faceSvg");
  if (face) {
  face.setAttribute("viewBox", "-6.4 -1.2 12.8 4.6");
  const GY = 3.0, Y = (h) => GY - h;
  el("rect", { x: -6.4, y: GY, width: 12.8, height: 0.6, fill: "#1b3a26" }, face);
  el("rect", { x: -3.66, y: Y(2.44), width: 7.32, height: 2.44, fill: "rgba(255,255,255,0.04)" }, face);
  // thirds guides
  for (const gx of [-1.22, 1.22]) el("line", { x1: gx, y1: Y(0), x2: gx, y2: Y(2.44), stroke: "rgba(255,255,255,0.1)", "stroke-width": 0.03, "stroke-dasharray": "0.1 0.08" }, face);
  el("line", { x1: -3.66, y1: Y(1.22), x2: 3.66, y2: Y(1.22), stroke: "rgba(255,255,255,0.1)", "stroke-width": 0.03, "stroke-dasharray": "0.1 0.08" }, face);
  el("path", { d: `M -3.66 ${GY} L -3.66 ${Y(2.44)} L 3.66 ${Y(2.44)} L 3.66 ${GY}`, fill: "none", stroke: "#fff", "stroke-width": 0.12 }, face);
  const onFace = messi.filter((s) => s.ey != null && s.ez != null && s.out !== "Blocked");
  const fg = el("g", {}, face);
  [...onFace].sort((a, b) => a.goal - b.goal).forEach((s) => {
    // StatsBomb end y is measured with +y to the kicker's right, same as our x
    const x = Math.max(-6.2, Math.min(6.2, s.ey)), h = Math.min(4.0, s.ez);
    const c = el("circle", { cx: x, cy: Y(h), r: s.goal ? 0.13 : 0.1, fill: s.goal ? COL.goal : COL.other, stroke: "#101a16", "stroke-width": 0.035, opacity: s.goal ? 1 : 0.8 }, fg);
    c.addEventListener("pointerenter", (e) => showTip(`<b>${outLabel(s)}</b>${s.season} vs ${s.opp}<br>${fmt(Math.abs(s.ey), 2)} m ${s.ey < 0 ? "left" : "right"} of centre, ${fmt(s.ez, 2)} m high`, e.clientX, e.clientY));
    c.addEventListener("pointerleave", hideTip);
  });
  el("text", { x: 0, y: Y(2.44) - 0.25, "font-size": 0.26, fill: "rgba(255,255,255,0.6)", "text-anchor": "middle", text: "crossbar 2.44 m" }, face);
  const goals = messi.filter((s) => s.goal && s.ey != null);
  const corner = goals.filter((s) => Math.abs(s.ey) > 1.22).length;
  const high = goals.filter((s) => s.ez != null && s.ez > 1.22).length;
  setHTML("#faceNote", `${corner} of his ${goals.length} goals went into the outer thirds of the goal and ${high} into the top half. Geometry again: the corners are the points farthest from where the keeper stands.`);
  }

  /* ---------- model ---------- */
  const c = S.coef;
  const eq = $("#modelEq");
  if (eq) eq.innerHTML = `$$P(\\text{goal}) = \\frac{1}{1 + e^{-(${c.b0.toFixed(2)} \\; + \\; ${c.b_theta.toFixed(3)}\\,\\theta \\; ${c.b_d < 0 ? "-" : "+"} \\; ${Math.abs(c.b_d).toFixed(3)}\\,d)}}$$`;
  if (eq) window.typesetMath?.(eq);

  const names = { "distance only": "Distance only", "angle only": "Goal angle only", "angle + distance": "Angle + distance" };
  const best = Object.entries(S.cv).sort((a, b) => b[1].auc - a[1].auc)[0][0];
  setHTML("#aucTable", `<tr><th>Features</th><th>AUC (higher is better)</th><th>Brier (lower is better)</th></tr>` +
    Object.entries(S.cv).map(([k, v]) => `<tr class="${k === best ? "best" : ""}"><td>${names[k]}</td><td>${v.auc.toFixed(3)}</td><td>${v.brier.toFixed(4)}</td></tr>`).join(""));

  setHTML("#messiCallout", `<b>Messi vs the geometry.</b> From the exact spots Messi shot from, the model expects <strong>${S.messi_expected}</strong> goals. He scored <strong>${S.messi_goals}</strong>. Everyone else in these matches scored on ${fmt(100 * S.others_rate)}% of their free kicks, compared with his ${fmt((100 * S.messi_goals) / messi.length)}%. One honest catch: his 420 kicks are about a third of the training data, so the model has partly learned from Messi himself.`);

  // heat map
  const heat = $("#heatSvg");
  if (!heat) return;
  heat.setAttribute("viewBox", "-30 -3 60 44");
  const cells = el("g", {}, heat);
  let pMax = 0;
  for (let z = 0.5; z < 41; z += 1) for (let x = -29.5; x < 30; x += 1) {
    const outsideBox = !(Math.abs(x) < 20.16 && z < 16.5);
    if (outsideBox) pMax = Math.max(pMax, prob(x, z));
  }
  pMax = Math.ceil(pMax * 20) / 20;
  const lo = [22, 58, 38], hi = [230, 255, 122];
  const ramp = (t) => {
    t = Math.max(0, Math.min(1, t));
    const e = Math.pow(t, 0.8);
    return `rgb(${lo.map((l, i) => Math.round(l + (hi[i] - l) * e)).join(",")})`;
  };
  for (let z = 0; z < 41; z += 1) for (let x = -30; x < 30; x += 1) {
    el("rect", { x, y: z, width: 1.02, height: 1.02, fill: ramp(prob(x + 0.5, z + 0.5) / pMax) }, cells);
  }
  // penalty box shade
  el("rect", { x: -20.16, y: 0, width: 40.32, height: 16.5, fill: "rgba(12,19,17,0.72)" }, heat);
  el("text", { x: 0, y: 9, "font-size": 1.4, fill: "rgba(255,255,255,0.75)", "text-anchor": "middle", text: "penalty area" }, heat);
  el("text", { x: 0, y: 11, "font-size": 1.1, fill: "rgba(255,255,255,0.55)", "text-anchor": "middle", text: "(a foul here is a penalty, not a free kick)" }, heat);
  drawPitch(heat, { depth: 41 });
  // probability contours as labelled iso-lines (marching on the grid is overkill: trace with level sets)
  const contours = el("g", { fill: "none", stroke: "rgba(12,19,17,0.65)", "stroke-width": 0.14 }, heat);
  for (const lvl of [0.05, 0.1, 0.15]) {
    let d = "";
    for (let x = -29.5; x <= 29.5; x += 0.5) {
      // find z where prob crosses lvl along this column (prob decreases with z)
      let zLo = 1, zHi = 60;
      if (prob(x, zLo) < lvl) continue;
      for (let k = 0; k < 30; k++) { const m = (zLo + zHi) / 2; prob(x, m) > lvl ? (zLo = m) : (zHi = m); }
      d += (d ? " L " : "M ") + x + " " + zLo.toFixed(2);
    }
    if (d) {
      el("path", { d }, contours);
      let zc = 1, zh = 60;
      for (let k = 0; k < 30; k++) { const m = (zc + zh) / 2; prob(0, m) > lvl ? (zc = m) : (zh = m); }
      if (zc < 40) el("text", { x: 0, y: zc + 1.5, "font-size": 1.2, fill: "#0c1311", stroke: "none", "font-weight": 700, "text-anchor": "middle", text: `${Math.round(lvl * 100)}%` }, contours);
    }
  }
  $("#rampBar").style.background = `linear-gradient(90deg, ${ramp(0)}, ${ramp(0.5)}, ${ramp(1)})`;
  $("#rampMax").textContent = Math.round(pMax * 100) + "%";
  const hover = el("circle", { r: 0.7, fill: "none", stroke: "#fff", "stroke-width": 0.2, opacity: 0 }, heat);
  heat.addEventListener("pointermove", (e) => {
    const p = svgPoint(heat, e);
    if (p.y < 0 || p.y > 41) { hideTip(); hover.setAttribute("opacity", 0); return; }
    hover.setAttribute("cx", p.x); hover.setAttribute("cy", p.y); hover.setAttribute("opacity", 1);
    showTip(`<b>${fmt(100 * prob(p.x, p.y), 1)}% chance</b>distance ${fmt(Math.hypot(p.x, p.y))} m, angle ${fmt(goalAngle(p.x, p.y))}°`, e.clientX, e.clientY);
  });
  heat.addEventListener("pointerleave", () => { hideTip(); hover.setAttribute("opacity", 0); });
}
