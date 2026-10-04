import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { simulate, judge, wallFor, presets, GOAL, BALL } from "./physics.js?v=20261004c";
import { $, $$, goalAngle, fmt } from "./util.js?v=20261004c";
import { loadModel, prob } from "./data.js?v=20261004c";

const ACCENT = 0xd4ff3a;

export async function initLab() {
  await loadModel().catch(() => null);
  const canvas = $("#labCanvas");
  const stage = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070c10);
  scene.fog = new THREE.Fog(0x070c10, 60, 140);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 2;
  controls.maxDistance = 90;

  // lights: stadium night
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x1a3020, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-20, 40, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 45, bottom: -10, near: 1, far: 120 });
  scene.add(sun);

  // ---------- pitch ----------
  const pitchTex = makePitchTexture();
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(80, 70), new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0, 30);
  pitch.receiveShadow = true;
  scene.add(pitch);

  // stands (simple dark blocks with light dots)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x0d151c, roughness: 1 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(90, 14, 6), standMat);
  stand.position.set(0, 4, -12);
  scene.add(stand);
  const crowd = new THREE.Points(
    (() => {
      const g = new THREE.BufferGeometry(), n = 2600, a = new Float32Array(n * 3), c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        a[i * 3] = (Math.random() - 0.5) * 88; a[i * 3 + 1] = 1 + Math.random() * 10; a[i * 3 + 2] = -9 - Math.random() * 0.5;
        const col = new THREE.Color().setHSL(Math.random(), 0.5, 0.35 + Math.random() * 0.4);
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      }
      g.setAttribute("position", new THREE.BufferAttribute(a, 3));
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      return g;
    })(),
    new THREE.PointsMaterial({ size: 0.28, vertexColors: true })
  );
  scene.add(crowd);
  // advertising boards
  const board = new THREE.Mesh(new THREE.BoxGeometry(70, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0x1b2a6b, emissive: 0x0d1640 }));
  board.position.set(0, 0.45, -4.5);
  scene.add(board);

  // ---------- goal ----------
  const goal = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const r = 0.06;
  const postGeo = new THREE.CylinderGeometry(r, r, GOAL.bar, 16);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(sx * GOAL.half, GOAL.bar / 2, 0);
    p.castShadow = true;
    goal.add(p);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, GOAL.half * 2 + 2 * r, 16), postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL.bar, 0);
  bar.castShadow = true;
  goal.add(bar);
  // net
  const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const netPts = [];
  const D = 2.0;
  for (let x = -GOAL.half; x <= GOAL.half + 1e-6; x += 0.25) { netPts.push(x, GOAL.bar, 0, x, GOAL.bar * 0.6, -D, x, GOAL.bar * 0.6, -D, x, 0, -D); }
  for (let y = 0; y <= GOAL.bar * 0.6 + 1e-6; y += 0.25) netPts.push(-GOAL.half, y, -D, GOAL.half, y, -D);
  for (let z = 0; z >= -D; z -= 0.25) {
    const y = GOAL.bar + ((GOAL.bar * 0.6 - GOAL.bar) * -z) / D;
    netPts.push(-GOAL.half, y, z, GOAL.half, y, z);
    for (const sx of [-1, 1]) netPts.push(sx * GOAL.half, 0, z, sx * GOAL.half, y, z);
  }
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute("position", new THREE.Float32BufferAttribute(netPts, 3));
  goal.add(new THREE.LineSegments(netGeo, netMat));
  scene.add(goal);

  // ---------- players ----------
  function makePlayer(color, h = 1.85) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, h - 0.75, 6, 12), mat);
    body.position.y = (h - 0.75) / 2 + 0.24 + 0.05;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc89878 }));
    head.position.y = h - 0.13;
    head.castShadow = true;
    g.add(body, head);
    return g;
  }
  const wallGroup = new THREE.Group();
  scene.add(wallGroup);
  const keeper = makePlayer(0xff4fa3, 1.9);
  scene.add(keeper);

  // ---------- ball ----------
  const ballTex = makeBallTexture();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.r, 32, 24), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45 }));
  ball.castShadow = true;
  scene.add(ball);

  // ---------- trails ----------
  const ghosts = [];
  let trail = null;
  function newTrail(pts) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    const segs = Math.max(2, pts.length - 1);
    const geo = new THREE.TubeGeometry(curve, segs, 0.045, 6, false);
    geo.setDrawRange(0, 0);
    const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 1 }));
    line.userData.perSeg = 6 * 6;
    scene.add(line);
    // ground shadow of the path (top-view projection)
    const g2 = new THREE.BufferGeometry();
    const a2 = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { a2[i * 3] = p.x; a2[i * 3 + 1] = 0.02; a2[i * 3 + 2] = p.z; });
    g2.setAttribute("position", new THREE.BufferAttribute(a2, 3));
    g2.setDrawRange(0, 0);
    const shadowLine = new THREE.Line(g2, new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, dashSize: 0.4, gapSize: 0.3 }));
    shadowLine.computeLineDistances();
    scene.add(shadowLine);
    return { line, shadowLine, n: pts.length };
  }
  function clearTrails() {
    for (const g of ghosts) { scene.remove(g.line, g.shadowLine); g.line.geometry.dispose(); g.shadowLine.geometry.dispose(); }
    ghosts.length = 0;
  }

  // ---------- state + UI ----------
  const P = presets();
  const state = { ...P.ronaldo, wall: 4 };
  const ui = {
    speed: $("#kSpeed"), elev: $("#kElev"), aim: $("#kAim"), side: $("#kSide"), top: $("#kTop"), wall: $("#kWall"),
    knuckle: $("#kKnuckle"), ghost: $("#kGhost"),
  };
  const fmtOut = {
    speed: (v) => `${v} m/s (${Math.round(v * 3.6)} km/h)`,
    elev: (v) => `${v}°`,
    aim: (v) => (v == 0 ? "0°" : `${Math.abs(v)}° ${v < 0 ? "left" : "right"}`),
    side: (v) => (v == 0 ? "none" : `${Math.abs(v)} rev/s, bends ${v < 0 ? "left" : "right"}`),
    top: (v) => (v == 0 ? "none" : v > 0 ? `${v} rev/s topspin` : `${-v} rev/s backspin`),
    wall: (v) => `${v}`,
  };
  function syncUI() {
    for (const k of ["speed", "elev", "aim", "side", "top", "wall"]) {
      ui[k].value = state[k];
      $(`output[data-for="${k}"]`).textContent = fmtOut[k](+state[k]);
    }
    ui.knuckle.checked = state.knuckle > 0;
  }
  for (const k of ["speed", "elev", "aim", "side", "top", "wall"]) {
    ui[k].addEventListener("input", () => {
      state[k] = +ui[k].value;
      $(`output[data-for="${k}"]`).textContent = fmtOut[k](state[k]);
      $$(".lab .presets button").forEach((b) => b.classList.remove("on"));
      if (k === "wall") placeScene();
      drawMini();
    });
  }
  ui.knuckle.addEventListener("change", () => { state.knuckle = ui.knuckle.checked ? 1 : 0; });
  $$(".lab .presets button").forEach((b) =>
    b.addEventListener("click", () => {
      const p = P[b.dataset.preset];
      Object.assign(state, p, { wall: 4 });
      $$(".lab .presets button").forEach((x) => x.classList.toggle("on", x === b));
      syncUI();
      placeScene();
      drawMini();
      setCam(camMode, true);
      kick();
    })
  );

  // place ball, wall, keeper
  let wallInfo = null;
  function placeScene() {
    const [bx, bz] = state.ball;
    ball.position.set(bx, BALL.r, bz);
    wallGroup.clear();
    wallInfo = wallFor(state.ball, state.wall);
    for (let i = 0; i < state.wall; i++) {
      const f = (i + 0.5) / state.wall;
      const pl = makePlayer(0xe9f0ec);
      pl.position.set(wallInfo.a[0] + (wallInfo.b[0] - wallInfo.a[0]) * f, 0, wallInfo.a[1] + (wallInfo.b[1] - wallInfo.a[1]) * f);
      pl.lookAt(bx, 0, bz);
      wallGroup.add(pl);
    }
    keeper.position.set(-Math.sign(bx || 1) * 0.6, 0, 0.4);
    keeper.rotation.set(0, 0, 0);
    updatePosRead();
  }

  // ---------- cameras ----------
  let camMode = "behind";
  const camTarget = new THREE.Vector3();
  function setCam(mode, snap = false) {
    camMode = mode;
    $$(".cam-btns button").forEach((b) => b.classList.toggle("on", b.dataset.cam === mode));
    const [bx, bz] = state.ball;
    const dir = new THREE.Vector3(-bx, 0, -bz).normalize();
    let pos, look;
    if (mode === "behind") { pos = new THREE.Vector3(bx - dir.x * 7, 2.4, bz - dir.z * 7); look = new THREE.Vector3(0, 1.2, 0); }
    if (mode === "side") { pos = new THREE.Vector3(Math.max(bx, 0) + 24, 4, bz / 2); look = new THREE.Vector3(0, 1.5, bz / 2); }
    if (mode === "top") { pos = new THREE.Vector3(0, 46, bz / 2 + 2); look = new THREE.Vector3(0, 0, bz / 2); }
    if (mode === "keeper") { pos = new THREE.Vector3(0, 1.6, -3.2); look = new THREE.Vector3(bx, 1, bz); }
    if (mode === "follow") { pos = new THREE.Vector3(bx - dir.x * 3, 1.2, bz - dir.z * 3); look = new THREE.Vector3(0, 1.2, 0); }
    camera.position.copy(pos);
    controls.target.copy(look);
    camTarget.copy(look);
    controls.update();
  }
  $$(".cam-btns button").forEach((b) => b.addEventListener("click", () => setCam(b.dataset.cam)));

  // ---------- kicking ----------
  let flight = null;
  function kick() {
    placeScene(); // keeper and wall back to their starting places
    const k = { ...state, seed: Math.random() * 100 };
    const sim = simulate(k);
    const res = judge(sim, wallInfo);
    // trim the path where it is stopped
    let pts = sim.pts;
    if (res.result === "wall" && res.i) pts = pts.slice(0, res.i + 1);
    if (res.result === "saved") {
      const ci = pts.findIndex((p) => p.z <= 0.3);
      if (ci > 0) pts = pts.slice(0, ci + 1);
    }
    if (!ui.ghost.checked) clearTrails();
    else ghosts.forEach((g) => { g.line.material.opacity = Math.max(0.12, g.line.material.opacity * 0.55); g.line.material.color.set(0x9fb3aa); });
    if (trail) ghosts.push(trail);
    trail = newTrail(pts);
    flight = { pts, res, start: performance.now(), sim, keeperFrom: keeper.position.clone() };
    $("#kickResult").className = "verdict";
    $("#kickResult").textContent = "…";
    placeWallJump(0);
    showStats(sim, res, pts);
  }
  $("#kickBtn").addEventListener("click", kick);
  $("#clearBtn").addEventListener("click", () => {
    clearTrails();
    if (trail) { scene.remove(trail.line, trail.shadowLine); trail.line.geometry.dispose(); trail.shadowLine.geometry.dispose(); trail = null; }
    flight = null; // stop animating the deleted path
    placeScene(); // ball, wall and keeper back to the start
    placeWallJump(0);
    $("#kickResult").className = "verdict";
    $("#kickResult").innerHTML = "Press <b>Kick</b>";
  });

  function placeWallJump(h) { wallGroup.children.forEach((p) => (p.position.y = h)); }

  function showStats(sim, res, pts) {
    const maxY = Math.max(...pts.map((p) => p.y));
    // sideways bend: max distance of the top-view path from the straight chord
    const a = pts[0], b = pts[pts.length - 1];
    const cx = b.x - a.x, cz = b.z - a.z, L = Math.hypot(cx, cz) || 1;
    let bend = 0;
    for (const p of pts) bend = Math.max(bend, Math.abs(((p.x - a.x) * cz - (p.z - a.z) * cx) / L));
    const c = sim.crossed;
    const pg = window.__noModel ? null : safeProb(state.ball);
    $("#hudStats").innerHTML =
      `flight <b>${c ? fmt(c.t, 2) + " s" : "-"}</b>, arrives at <b>${c ? Math.round(c.v * 3.6) + " km/h" : "-"}</b><br>` +
      `highest <b>${fmt(maxY, 2)} m</b>, sideways bend <b>${fmt(bend, 2)} m</b><br>` +
      (pg != null ? `model chance from this spot <b>${fmt(100 * pg, 1)}%</b>` : "");
  }
  function safeProb(b) { try { return prob(b[0], b[1]); } catch { return null; } }

  // ---------- minimap ----------
  const mini = $("#miniMap"), mctx = mini.getContext("2d");
  const MW = mini.width, MH = mini.height;
  const mScale = MW / 60; // 60 m wide view
  const toMini = (x, z) => [MW / 2 + x * mScale, 10 + z * mScale];
  const fromMini = (px, py) => [(px - MW / 2) / mScale, (py - 10) / mScale];
  function drawMini() {
    mctx.fillStyle = "#12301f";
    mctx.fillRect(0, 0, MW, MH);
    // model heat (light)
    if (safeProb([0, 20]) != null) {
      for (let z = 0; z < 40; z += 1) for (let x = -30; x < 30; x += 1) {
        if (Math.abs(x + 0.5) < 20.16 && z + 0.5 < 16.5) continue;
        const p = safeProb([x + 0.5, z + 0.5]);
        const [px, py] = toMini(x, z);
        mctx.fillStyle = `rgba(212,255,58,${Math.min(0.55, p * 1.8)})`;
        mctx.fillRect(px, py, mScale + 0.5, mScale + 0.5);
      }
    }
    mctx.strokeStyle = "rgba(255,255,255,0.6)";
    mctx.lineWidth = 1.5;
    const rect = (x, z, w, h) => { const [a, b] = toMini(x, z); mctx.strokeRect(a, b, w * mScale, h * mScale); };
    rect(-20.16, 0, 40.32, 16.5);
    rect(-9.16, 0, 18.32, 5.5);
    const [l0x, l0y] = toMini(-30, 0), [l1x] = toMini(30, 0);
    mctx.beginPath(); mctx.moveTo(l0x, l0y); mctx.lineTo(l1x, l0y); mctx.stroke();
    mctx.strokeStyle = "#fff"; mctx.lineWidth = 4;
    const [g0] = toMini(-GOAL.half, 0), [g1] = toMini(GOAL.half, 0);
    mctx.beginPath(); mctx.moveTo(g0, l0y); mctx.lineTo(g1, l0y); mctx.stroke();
    // wall
    if (wallInfo && state.wall > 0) {
      mctx.strokeStyle = "#e9f0ec"; mctx.lineWidth = 5; mctx.lineCap = "round";
      mctx.beginPath(); mctx.moveTo(...toMini(...wallInfo.a)); mctx.lineTo(...toMini(...wallInfo.b)); mctx.stroke();
    }
    // goal angle wedge
    const [bx, bz] = toMini(...state.ball);
    mctx.fillStyle = "rgba(212,255,58,0.18)";
    mctx.beginPath(); mctx.moveTo(bx, bz); mctx.lineTo(g0, l0y); mctx.lineTo(g1, l0y); mctx.closePath(); mctx.fill();
    // ball
    mctx.fillStyle = "#fff";
    mctx.beginPath(); mctx.arc(bx, bz, 6, 0, Math.PI * 2); mctx.fill();
    mctx.strokeStyle = "#000"; mctx.lineWidth = 1.5; mctx.stroke();
  }
  function updatePosRead() {
    const [x, z] = state.ball;
    $("#posRead").innerHTML = `distance <b>${fmt(Math.hypot(x, z))} m</b>, goal angle <b>${fmt(goalAngle(x, z))}°</b>` +
      (safeProb(state.ball) != null ? `, model <b>${fmt(100 * safeProb(state.ball), 1)}%</b>` : "");
  }
  let dragging = false;
  const miniMove = (e) => {
    if (!dragging) return;
    const r = mini.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * MW, py = ((e.clientY - r.top) / r.height) * MH;
    let [x, z] = fromMini(px, py);
    x = Math.max(-28, Math.min(28, x));
    z = Math.max(11, Math.min(38, z));
    // free kicks are outside the penalty area
    if (Math.abs(x) < 20.16 && z < 16.5) z = 16.6;
    state.ball = [+x.toFixed(1), +z.toFixed(1)];
    $$(".lab .presets button").forEach((b) => b.classList.remove("on"));
    placeScene();
    drawMini();
    if (camMode !== "top") setCam(camMode);
  };
  mini.addEventListener("pointerdown", (e) => { dragging = true; mini.setPointerCapture(e.pointerId); miniMove(e); });
  mini.addEventListener("pointermove", miniMove);
  mini.addEventListener("pointerup", () => (dragging = false));

  // ---------- resize + loop ----------
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const SLOW = 0.55; // slow motion so you can follow the ball
  const tmp = new THREE.Vector3();
  function loop(now) {
    requestAnimationFrame(loop);
    if (flight && trail) {
      const t = ((now - flight.start) / 1000) * SLOW;
      const pts = flight.pts;
      let i = pts.findIndex((p) => p.t >= t);
      const done = i === -1;
      if (done) i = pts.length - 1;
      const p = pts[i];
      ball.position.set(p.x, p.y, p.z);
      ball.rotation.y += 0.25 * (state.side || 0.5) * 0.05;
      ball.rotation.x -= 0.25 * (state.top || 0.5) * 0.05;
      trail.line.geometry.setDrawRange(0, i * trail.line.userData.perSeg);
      trail.shadowLine.geometry.setDrawRange(0, i + 1);
      // wall jump around t = 0.15..0.6
      const jt = (t - 0.12) / 0.5;
      placeWallJump(jt > 0 && jt < 1 ? Math.sin(jt * Math.PI) * 0.35 : 0);
      // keeper dive toward where the ball will cross
      const c = flight.sim.crossed, save = flight.res.save;
      if (c && save) {
        const t0 = save.tWall + 0.25;
        const target = Math.max(-GOAL.half, Math.min(GOAL.half, c.x));
        const dir = Math.sign(target - save.kx);
        const move = Math.max(0, Math.min(Math.abs(target - save.kx) - 0.4, (t - t0) * 3.0));
        keeper.position.x = save.kx + dir * Math.max(0, move);
        const lean = Math.min(1, Math.max(0, (t - t0) / 0.5));
        keeper.rotation.z = -dir * lean * (c.y > 1.2 ? 1.0 : 1.35);
        keeper.position.y = lean * (c.y > 1.2 ? 0.55 : 0.15);
      }
      if (camMode === "follow") {
        const nxt = pts[Math.min(pts.length - 1, i + 6)];
        tmp.set(p.x - (nxt.x - p.x) * 6, p.y + 0.5, p.z - (nxt.z - p.z) * 6 + 0.01);
        camera.position.lerp(tmp, 0.25);
        controls.target.lerp(new THREE.Vector3(nxt.x, nxt.y, nxt.z), 0.3);
      }
      if (done && !flight.shown) {
        flight.shown = true;
        const v = $("#kickResult");
        v.textContent = flight.res.label;
        v.className = "verdict " + (flight.res.result === "goal" ? "goal" : "miss");
        if (flight.res.result === "goal") netPulse = 1;
      }
    }
    if (netPulse > 0) { netMat.opacity = 0.22 + netPulse * 0.6; netPulse = Math.max(0, netPulse - 0.02); }
    controls.update();
    renderer.render(scene, camera);
  }
  let netPulse = 0;

  syncUI();
  placeScene();
  drawMini();
  setCam("behind", true);
  $('.lab .presets button[data-preset="ronaldo"]').classList.add("on");
  requestAnimationFrame(loop);
  setTimeout(kick, 600);
}

function makePitchTexture() {
  const c = document.createElement("canvas");
  const S = 16; // px per metre
  c.width = 80 * S; c.height = 70 * S;
  const g = c.getContext("2d");
  for (let i = 0; i < 70; i += 5.5) {
    g.fillStyle = (i / 5.5) % 2 === 0 ? "#1f5a33" : "#1a4f2d";
    g.fillRect(0, i * S, c.width, 5.5 * S);
  }
  // plane is centred at z = 30, so canvas row 0 is z = -5
  const X = (x) => (x + 40) * S, Z = (z) => (z + 5) * S;
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 0.12 * S;
  g.beginPath(); g.moveTo(X(-40), Z(0)); g.lineTo(X(40), Z(0)); g.stroke();
  g.strokeRect(X(-20.16), Z(0), 40.32 * S, 16.5 * S);
  g.strokeRect(X(-9.16), Z(0), 18.32 * S, 5.5 * S);
  g.beginPath(); g.arc(X(0), Z(11), 0.2 * S, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
  const a = Math.acos(5.5 / 9.15);
  g.beginPath(); g.arc(X(0), Z(11), 9.15 * S, Math.PI / 2 - a, Math.PI / 2 + a); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeBallTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#f5f5f5"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#1a1a1a";
  for (let i = 0; i < 10; i++) {
    const x = (i * 53) % 256, y = 20 + ((i * 37) % 90);
    g.beginPath();
    for (let k = 0; k < 5; k++) { const an = (k / 5) * Math.PI * 2; g.lineTo(x + 12 * Math.cos(an), y + 12 * Math.sin(an)); }
    g.fill();
  }
  g.fillStyle = "#d4ff3a"; g.fillRect(0, 60, 256, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
