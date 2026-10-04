// Free-kick flight model: gravity + aerodynamic drag + Magnus (spin) force.
// Coordinates (metres): goal line is z = 0, goal centre at x = 0, y is height,
// the kicker stands at positive z and shoots toward -z. From the kicker's view, +x is right.

export const BALL = { m: 0.43, r: 0.11, A: Math.PI * 0.11 * 0.11 };
export const AIR = 1.2;
export const G = 9.81;
export const GOAL = { half: 3.66, bar: 2.44 };
export const WALL_DIST = 9.15;

// Drag coefficient falls at high speed (the "drag crisis" of a smooth sphere).
export function dragCoef(v) {
  return 0.22 + 0.25 / (1 + Math.exp((v - 13) / 1.6));
}

// Lift coefficient from the spin parameter S = r*omega / v (Sawicki-style fit).
export function liftCoef(S) {
  if (S <= 1e-6) return 0;
  return Math.min(0.4, 1 / (2 + 1 / S));
}

// Smooth pseudo-random noise for the knuckleball wobble.
function noise1(t, seed) {
  // fixed frequencies (a few wobbles per second); the seed only shifts the phases
  const f = [3.1, 5.7, 9.3], ph = [1.7, 2.9, 4.3];
  let s = 0;
  for (let k = 0; k < 3; k++) s += Math.sin(t * f[k] + seed * ph[k]) / (k + 1);
  return s / 1.83;
}

/**
 * kick = {
 *   ball: [x, z]     position on the pitch (m)
 *   speed            launch speed (m/s)
 *   elev             launch elevation angle (deg)
 *   aim              horizontal aim angle (deg, + = right of the line to goal centre)
 *   side             sidespin (rev/s, + = ball bends to the kicker's right)
 *   top              topspin (rev/s, + = extra dip)
 *   knuckle          0..1 strength of the no-spin wobble
 *   seed             wobble seed
 * }
 */
export function simulate(kick, opts = {}) {
  const dt = opts.dt ?? 1 / 240;
  const tMax = opts.tMax ?? 4;
  const [bx, bz] = kick.ball;
  const p = [bx, BALL.r, bz];

  // direction toward goal centre, rotated by aim
  const base = Math.atan2(-bx, -bz); // angle of the vector (-bx, -bz) measured from +z toward +x
  const yaw = base - (kick.aim * Math.PI) / 180;
  const el = (kick.elev * Math.PI) / 180;
  const dir = [Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)];
  const v = dir.map((c) => c * kick.speed);

  // spin vector: sidespin about the vertical axis, topspin about the "right" axis
  const flat = norm([dir[0], 0, dir[2]]);
  const right = norm(cross(flat, [0, 1, 0]));
  const ws = -kick.side * 2 * Math.PI;
  const wt = -kick.top * 2 * Math.PI;
  const w = [right[0] * wt, ws, right[2] * wt];
  const spinDecay = 0.06; // per second

  const pts = [{ t: 0, x: p[0], y: p[1], z: p[2], v: kick.speed }];
  let t = 0;
  let wallHit = null;
  const k = (0.5 * AIR * BALL.A) / BALL.m;
  const knuckle = kick.knuckle ?? 0;
  const seed = kick.seed ?? 1;
  // Dupeux et al. (2010) lift law: Magnus force proportional to omega * v (not v^2),
  // calibrated so the launch curvature matches the normal model. Used for the "endless pitch" experiment.
  const w0 = Math.hypot(w[0], w[1], w[2]);
  const kLin = opts.linearMagnus && w0 > 0 ? (k * liftCoef((BALL.r * w0) / kick.speed) * kick.speed) / w0 : 0;

  const acc = (pp, vv, tt, ww) => {
    const sp = Math.hypot(vv[0], vv[1], vv[2]);
    const a = [0, opts.float ? 0 : -G, 0];
    const cd = dragCoef(sp);
    for (let i = 0; i < 3; i++) a[i] -= k * cd * sp * vv[i];
    const wm = Math.hypot(ww[0], ww[1], ww[2]);
    if (wm > 0 && sp > 0) {
      const m = norm(cross(ww, vv));
      const mag = kLin ? kLin * wm * sp : k * liftCoef((BALL.r * wm) / sp) * sp * sp;
      for (let i = 0; i < 3; i++) a[i] += mag * m[i];
    }
    if (knuckle > 0 && sp > 0) {
      // sideways and vertical wobble perpendicular to velocity
      const u = norm(vv);
      const s1 = norm(cross(u, [0, 1, 0]));
      const s2 = cross(s1, u);
      const c = 0.045 * knuckle * sp * sp * k * 3 * Math.min(1, tt / 0.45); // the wake becomes unstable after launch
      const n1 = noise1(tt, seed);
      const n2 = noise1(tt + 11.7, seed + 3);
      for (let i = 0; i < 3; i++) a[i] += c * (n1 * s1[i] + 0.6 * n2 * s2[i]);
    }
    return a;
  };

  const wallZ = bz - WALL_DIST * Math.cos(Math.atan2(-bx, -bz)) * 1; // approx plane of the wall
  let crossed = null;
  while (t < tMax) {
    const ww = w.map((c) => c * Math.exp(-spinDecay * t));
    // RK4
    const a1 = acc(p, v, t, ww);
    const p2 = add(p, scale(v, dt / 2)), v2 = add(v, scale(a1, dt / 2));
    const a2 = acc(p2, v2, t + dt / 2, ww);
    const p3 = add(p, scale(v2, dt / 2)), v3 = add(v, scale(a2, dt / 2));
    const a3 = acc(p3, v3, t + dt / 2, ww);
    const p4 = add(p, scale(v3, dt)), v4 = add(v, scale(a3, dt));
    const a4 = acc(p4, v4, t + dt, ww);
    const prevZ = p[2], prevP = [...p];
    for (let i = 0; i < 3; i++) {
      p[i] += (dt / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]);
      v[i] += (dt / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]);
    }
    t += dt;
    const sp = Math.hypot(v[0], v[1], v[2]);
    pts.push({ t, x: p[0], y: p[1], z: p[2], v: sp });
    if (!opts.noStop && prevZ > 0 && p[2] <= 0) {
      const f = prevZ / (prevZ - p[2]);
      crossed = { t: t - dt + f * dt, x: prevP[0] + f * (p[0] - prevP[0]), y: prevP[1] + f * (p[1] - prevP[1]), v: sp };
      break;
    }
    if (!opts.float && p[1] < BALL.r && v[1] < 0) {
      // bounce, damped
      p[1] = BALL.r;
      v[1] = -v[1] * 0.55;
      v[0] *= 0.8; v[2] *= 0.8;
    }
  }
  return { pts, crossed, wallZ };
}

// Wall: n players, centred so that it covers the near post side.
export function wallFor(ball, n = 4) {
  const [bx, bz] = ball;
  const d = Math.hypot(bx, bz);
  const ux = -bx / d, uz = -bz / d; // unit toward goal centre
  const cx = bx + ux * WALL_DIST, cz = bz + uz * WALL_DIST;
  // perpendicular (kicker's right)
  const px = -uz, pz = ux;
  const width = n * 0.52;
  // shift toward the near post (the post on the ball's side)
  const shiftSign = bx >= 0 ? 1 : -1;
  const near = [shiftSign * GOAL.half, 0];
  // angle subtended: shift centre toward the near-post line
  const nx = near[0] - bx, nz = near[1] - bz, nd = Math.hypot(nx, nz);
  const nearAtWall = [bx + (nx / nd) * WALL_DIST, bz + (nz / nd) * WALL_DIST];
  const off = (nearAtWall[0] - cx) * px + (nearAtWall[1] - cz) * pz;
  const centreOff = off - shiftSign * (width / 2 - 0.35);
  const mx = cx + px * centreOff, mz = cz + pz * centreOff;
  return {
    centre: [mx, mz],
    a: [mx - (px * width) / 2, mz - (pz * width) / 2],
    b: [mx + (px * width) / 2, mz + (pz * width) / 2],
    height: 1.85,
    jump: 0.2,
    n,
  };
}

// Judge a simulated shot.
export function judge(sim, wall, keeper = true) {
  const { pts, crossed } = sim;
  // wall check: find where the path crosses the wall segment line
  const [ax, az] = wall.a, [bx, bz] = wall.b;
  const nx = -(bz - az), nz = bx - ax;
  const side = (q) => (q.x - ax) * nx + (q.z - az) * nz;
  let tWall = 0.35;
  for (let i = 1; i < pts.length && wall.n > 0; i++) {
    const s0 = side(pts[i - 1]), s1 = side(pts[i]);
    if (s0 === 0 || Math.sign(s0) !== Math.sign(s1)) {
      const f = s0 / (s0 - s1);
      const x = pts[i - 1].x + f * (pts[i].x - pts[i - 1].x);
      const z = pts[i - 1].z + f * (pts[i].z - pts[i - 1].z);
      const y = pts[i - 1].y + f * (pts[i].y - pts[i - 1].y);
      tWall = pts[i - 1].t + f * (pts[i].t - pts[i - 1].t);
      const len = Math.hypot(bx - ax, bz - az);
      const along = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len;
      if (along > -BALL.r && along < len + BALL.r && y < wall.height + wall.jump + BALL.r) {
        return { result: "wall", label: "Blocked by the wall", at: { x, y, z }, i };
      }
      break;
    }
  }
  if (!crossed) return { result: "short", label: "Did not reach the goal" };
  const inX = Math.abs(crossed.x) < GOAL.half - BALL.r;
  const inY = crossed.y < GOAL.bar - BALL.r && crossed.y > 0;
  if (!inY && crossed.y >= GOAL.bar - BALL.r) return { result: "over", label: "Over the bar", crossed };
  if (!inX) return { result: "wide", label: "Wide of the post", crossed };
  if (keeper) {
    const kx = -Math.sign(sim.pts[0].x || 1) * 0.6;
    const save = keeperCanReach(crossed, tWall, kx);
    if (save.saved) return { result: "saved", label: "Saved by the keeper", crossed, save };
    return { result: "goal", label: "GOAL", crossed, save };
  }
  return { result: "goal", label: "GOAL", crossed };
}

// Simple keeper: stands a little toward the far post (the wall covers the near post),
// cannot see the ball until it passes the wall, reacts 0.25 s later, then dives at about 3 m/s.
export function keeperCanReach(c, tWall = 0.35, kx = 0) {
  const reach = 0.8;
  const dx = Math.abs(c.x - kx);
  const need = dx + Math.max(0, c.y - 2.0) * 0.6;
  const avail = Math.max(0, c.t - tWall - 0.25) * 3.0 + reach;
  return { saved: need < avail, need, avail, kx, tWall };
}

export function presets() {
  return {
    messi: {
      name: "Messi vs Liverpool, 2019",
      foot: "left",
      ball: [-0.6, 31.5], speed: 30, elev: 20.75, aim: -12, side: 7, top: 3.5, knuckle: 0, seed: 1,
    },
    ronaldo: {
      name: "Ronaldo vs Spain, 2018",
      foot: "right",
      ball: [3.6, 22.5], speed: 26.0, elev: 18.75, aim: 11.5, side: -5.5, top: 2.5, knuckle: 0, seed: 1,
    },
    carlos: {
      name: "Roberto Carlos vs France, 1997",
      foot: "left (outside)",
      ball: [3.0, 34.5], speed: 38.0, elev: 10.75, aim: 16.25, side: -18, top: 0, knuckle: 0, seed: 1,
    },
    knuckle: {
      name: "Knuckleball (almost no spin)",
      foot: "right",
      ball: [-1.5, 27], speed: 26, elev: 18, aim: -5, side: 0, top: 0, knuckle: 1, seed: 4,
    },
  };
}

// small vector helpers
export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

// curvature of the top-down (x,z) path at each sample, used for the spiral chart
export function planCurvature(pts, step = 6) {
  const out = [];
  let s = 0;
  for (let i = step; i < pts.length - step; i += step) {
    const a = pts[i - step], b = pts[i], c = pts[i + step];
    const abx = b.x - a.x, abz = b.z - a.z, bcx = c.x - b.x, bcz = c.z - b.z;
    const acx = c.x - a.x, acz = c.z - a.z;
    const area2 = abx * bcz - abz * bcx;
    const k = (2 * area2) / (Math.hypot(abx, abz) * Math.hypot(bcx, bcz) * Math.hypot(acx, acz));
    s += Math.hypot(abx, abz);
    out.push({ s, k, v: b.v, x: b.x, z: b.z });
  }
  return out;
}
