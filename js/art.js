import { simulate, judge, wallFor, presets, GOAL } from "./physics.js?v=20261004c";
import { $, $$, fmt } from "./util.js?v=20261004c";

const SPOTS = (() => {
  const P = presets();
  return {
    ronaldo: { ball: P.ronaldo.ball, label: "Ronaldo's spot" },
    messi: { ball: P.messi.ball, label: "Messi's spot" },
    carlos: { ball: P.carlos.ball, label: "Carlos's spot" },
  };
})();

// tiny deterministic RNG so each poster is reproducible
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function initArt() {
  const cv = $("#artCanvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const prog = $("#artProgress"), stats = $("#artStats");
  let job = 0;
  let spotKey = "ronaldo";

  function render(key) {
    spotKey = key;
    const my = ++job;
    const spot = SPOTS[key];
    const [bx, bz] = spot.ball;
    const wall = wallFor(spot.ball, 4);
    const rand = rng(1234 + Math.round(bx * 10) * 7 + Math.round(bz * 10));

    // ----- layout -----
    ctx.globalCompositeOperation = "source-over"; // a previous unfinished poster may have left additive mode on
    ctx.fillStyle = "#070b0a";
    ctx.fillRect(0, 0, W, H);
    const top = { x: 60, y: 270, w: W - 120, h: 640 };
    const back = { x: 60, y: 960, w: W - 120, h: 440 };

    // top view mapping (sideways stretched x2)
    const zMax = bz + 1.5;
    const sz = top.h / zMax;
    const sxs = sz * 2;
    const T = (x, z) => [top.x + top.w / 2 + (x - bx * 0.5) * sxs, top.y + z * sz];
    // behind view (perspective)
    const cam = { x: bx * 0.9, y: 3.4, z: bz + 13 };
    const dirx = -bx, dirz = -bz, dl = Math.hypot(dirx, dirz);
    const fx = dirx / dl, fz = dirz / dl; // forward
    const rx = -fz, rz = fx; // right
    const focal = back.w * 2.1;
    // pinhole camera behind the kicker, aimed at the middle of the goal mouth
    const gDepth = (0 - cam.x) * fx + (0 - cam.z) * fz;
    const gSide = (0 - cam.x) * rx + (0 - cam.z) * rz;
    const B = (x, y, z) => {
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
      const depth = dx * fx + dz * fz;
      const side = dx * rx + dz * rz;
      const k = depth / gDepth;
      const cs = gSide * k, cy = (1.2 - cam.y) * k;
      return [back.x + back.w / 2 + ((side - cs) * focal) / depth, back.y + back.h * 0.5 - ((dy - cy) * focal) / depth, depth];
    };

    // ----- frame: title + guides -----
    ctx.fillStyle = "#d4ff3a";
    ctx.font = "900 92px Archivo, sans-serif";
    ctx.fillText("THE SHAPE", 60, 120);
    ctx.fillStyle = "#e9f0ec";
    ctx.fillText("OF POSSIBLE", 60, 190);
    ctx.font = "500 22px JetBrains Mono, monospace";
    ctx.fillStyle = "rgba(233,240,236,0.6)";
    ctx.fillText(`${spot.label}, ${fmt(Math.hypot(bx, bz))} m, every simulated kick that scores`, 60, 238);

    // top view guides
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    const [gl, gy] = T(-GOAL.half, 0), [gr] = T(GOAL.half, 0);
    ctx.beginPath(); ctx.moveTo(top.x, gy); ctx.lineTo(top.x + top.w, gy); ctx.stroke();
    const [pbL, pbY] = T(-20.16, 16.5), [pbR] = T(20.16, 16.5);
    ctx.strokeRect(pbL, gy, pbR - pbL, pbY - gy);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(gl, gy); ctx.lineTo(gr, gy); ctx.stroke();
    ctx.strokeStyle = "rgba(233,240,236,0.5)"; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(...T(...wall.a)); ctx.lineTo(...T(...wall.b)); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.font = "500 16px JetBrains Mono, monospace";
    ctx.fillStyle = "rgba(233,240,236,0.45)";
    ctx.fillText("from above (sideways ×2)", top.x, top.y + top.h + 30);
    ctx.fillText("from behind the kicker", back.x, back.y + 4);

    // behind view guides
    const goalPoly = [B(-GOAL.half, 0, 0), B(-GOAL.half, GOAL.bar, 0), B(GOAL.half, GOAL.bar, 0), B(GOAL.half, 0, 0)];
    const drawGoal = (alpha) => {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = 4;
      ctx.beginPath(); goalPoly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    };
    drawGoal(0.9);
    const ground = B(0, 0, -30)[1];
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(back.x, ground); ctx.lineTo(back.x + back.w, ground); ctx.stroke();
    // wall players as silhouettes
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.5) / 4;
      const px = wall.a[0] + (wall.b[0] - wall.a[0]) * f, pz = wall.a[1] + (wall.b[1] - wall.a[1]) * f;
      const [x0, y0] = B(px, 0, pz), [, y1] = B(px, 1.85, pz);
      const w = (0.46 * focal) / B(px, 0, pz)[2];
      ctx.fillStyle = "rgba(233,240,236,0.16)";
      ctx.fillRect(x0 - w / 2, y1, w, y0 - y1);
    }

    // ----- search -----
    const MAX_TRIES = 40000, TARGET = 650;
    let tried = 0, goals = 0, left = 0, right = 0;
    const speeds = [];
    ctx.globalCompositeOperation = "lighter";
    const batch = 260;
    function step() {
      if (my !== job) return;
      const end = Math.min(MAX_TRIES, tried + batch);
      for (; tried < end && goals < TARGET; tried++) {
        const kick = {
          ball: spot.ball,
          speed: 18 + rand() * 18,
          elev: 4 + rand() * 24,
          aim: (rand() - 0.5) * 34,
          side: (rand() - 0.5) * 32,
          top: -1 + rand() * 9,
          knuckle: 0,
        };
        const sim = simulate(kick, { dt: 1 / 90, tMax: 2.6 });
        if (!sim.crossed) continue;
        const res = judge(sim, wall);
        if (res.result !== "goal") continue;
        goals++;
        kick.side < 0 ? left++ : right++;
        speeds.push(sim.crossed.v);
        const f = (kick.speed - 18) / 18;
        const col = kick.side < 0 ? [217, 87, 138] : [58, 139, 219];
        const lit = 0.55 + 0.45 * f;
        ctx.strokeStyle = `rgba(${Math.round(col[0] * lit)},${Math.round(col[1] * lit)},${Math.round(col[2] * lit)},0.08)`;
        ctx.lineWidth = 1.6;
        ctx.save();
        ctx.beginPath(); ctx.rect(top.x, top.y - 20, top.w, top.h + 20); ctx.clip();
        ctx.beginPath();
        sim.pts.forEach((p, i) => { const [x, y] = T(p.x, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(back.x, back.y, back.w, back.h); ctx.clip();
        ctx.beginPath();
        sim.pts.forEach((p, i) => { const [x, y] = B(p.x, p.y, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
        ctx.restore();
        // landing dot on the goal face
        const [lx, ly] = B(sim.crossed.x, sim.crossed.y, 0);
        ctx.fillStyle = "rgba(212,255,58,0.35)";
        ctx.fillRect(lx - 1.5, ly - 1.5, 3, 3);
      }
      prog.style.width = 100 * Math.max(goals / TARGET, tried / MAX_TRIES) + "%";
      stats.innerHTML = `tried <b>${tried.toLocaleString()}</b> kicks, <b>${goals}</b> scored (${fmt((100 * goals) / Math.max(1, tried), 1)}%)<br>` +
        `bending left <b>${left}</b>, bending right <b>${right}</b>`;
      if (tried < MAX_TRIES && goals < TARGET) requestAnimationFrame(step);
      else finish();
    }
    function finish() {
      ctx.globalCompositeOperation = "source-over";
      drawGoal(0.9);
      const [bxS, byS] = T(bx, bz);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bxS, byS, 9, 0, Math.PI * 2); ctx.fill();
      ctx.font = "500 20px JetBrains Mono, monospace";
      ctx.fillStyle = "rgba(233,240,236,0.75)";
      ctx.fillText(`${goals} of ${tried.toLocaleString()} random kicks score: ${fmt((100 * goals) / tried, 1)}%`, 60, H - 46);
      ctx.fillStyle = "rgba(233,240,236,0.4)";
      ctx.textAlign = "right";
      ctx.fillText("pink bends left, blue bends right", W - 60, H - 46);
      ctx.textAlign = "left";
      prog.style.width = "0";
    }
    requestAnimationFrame(step);
  }

  $$("#art .presets button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#art .presets button").forEach((x) => x.classList.toggle("on", x === b));
      render(b.dataset.spot);
    })
  );
  $("#artSave").addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = `shape-of-possible-${spotKey}.png`;
    a.href = cv.toDataURL("image/png");
    a.click();
  });
  document.fonts?.ready.then(() => render("ronaldo")) ?? render("ronaldo");
}
