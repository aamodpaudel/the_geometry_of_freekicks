export const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") e.textContent = v;
    else e.setAttribute(k, v);
  }
  if (parent) parent.appendChild(e);
  return e;
}

export function clear(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const tipEl = () => document.getElementById("tip");
export function showTip(html, x, y) {
  const t = tipEl();
  t.innerHTML = html;
  t.classList.add("show");
  const w = t.offsetWidth, h = t.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > innerWidth - 8) left = x - w - 14;
  if (top + h > innerHeight - 8) top = y - h - 14;
  t.style.left = left + "px";
  t.style.top = top + "px";
}
export function hideTip() { tipEl().classList.remove("show"); }

// Convert a pointer event to SVG user coordinates
export function svgPoint(svg, evt) {
  const p = svg.createSVGPoint();
  const e = evt.touches ? evt.touches[0] : evt;
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

// Goal angle (degrees) seen from (x, z); posts at (+-3.66, 0)
export function goalAngle(x, z) {
  const ax = -3.66 - x, az = -z, bx = 3.66 - x, bz = -z;
  return Math.abs((Math.atan2(ax * bz - az * bx, ax * bx + az * bz) * 180) / Math.PI);
}

// Circle through both posts that sees the goal at angle theta (deg); centre on z axis
export function isoCircle(thetaDeg) {
  const t = (thetaDeg * Math.PI) / 180;
  const R = 3.66 / Math.sin(t);
  const zc = 3.66 / Math.tan(t);
  return { R, zc };
}

// Draw the attacking third of a pitch (top view, metres; goal line at y = 0, goal at top)
export function drawPitch(svg, { depth = 38, halfW = 30 } = {}) {
  const g = el("g", { class: "pitch-lines", fill: "none", stroke: "rgba(255,255,255,0.55)", "stroke-width": 0.12 }, svg);
  // mowing stripes
  const stripes = el("g", {}, svg);
  svg.insertBefore(stripes, g);
  for (let i = 0; i < depth; i += 5.5) {
    if ((i / 5.5) % 2 === 0) el("rect", { x: -halfW, y: i, width: halfW * 2, height: 5.5, fill: "rgba(255,255,255,0.025)" }, stripes);
  }
  el("line", { x1: -halfW, y1: 0, x2: halfW, y2: 0 }, g);
  el("rect", { x: -20.16, y: 0, width: 40.32, height: 16.5 }, g); // penalty box
  el("rect", { x: -9.16, y: 0, width: 18.32, height: 5.5 }, g); // six-yard box
  el("circle", { cx: 0, cy: 11, r: 0.2, fill: "rgba(255,255,255,0.7)", stroke: "none" }, g);
  // penalty arc: radius 9.15 around the spot, outside the box
  const a = Math.acos((16.5 - 11) / 9.15);
  const x1 = 9.15 * Math.sin(a);
  el("path", { d: `M ${-x1} 16.5 A 9.15 9.15 0 0 0 ${x1} 16.5` }, g);
  // goal
  el("rect", { x: -3.66, y: -1.6, width: 7.32, height: 1.6, fill: "rgba(255,255,255,0.08)", stroke: "#fff", "stroke-width": 0.18 }, svg);
  return g;
}

export function fmt(n, d = 1) { return Number(n).toFixed(d); }

// Observe visibility once, then run fn
export function onVisible(node, fn, margin = "200px") {
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(node);
}
