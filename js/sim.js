// Simulador estilo Working Model 2D del gripper V2.4 (vista lateral, gripper hacia abajo).
import { kinematics, rot, L1_SHAPE, L2_SHAPE, solve, SHARES, cicloidal, dynamicsAt, fingerStatics, I_MCP, G, M1, M2 } from "./model.js";

const MCPX = { A: 42.49, B: -31.96, C: -31.96 };
const S = { A: 1, B: -1, C: -1 };
const RUEDA_Y = 7.79;
const OBJ = { x: 5.265, y: -68, r: 23 };
const CONTACT = ["P", "D", "T"];

// ---------------------------------------------------------------- entradas
const INPUTS = {
  est: [
    { id: "q1", label: "theta MCP [deg]", min: 0, max: 60, step: 1, v: 15 },
    { id: "q2A", label: "theta PIP A [deg]", min: 0, max: 45, step: 1, v: 15 },
    { id: "q2B", label: "theta PIP B [deg]", min: 0, max: 45, step: 1, v: 15 },
    { id: "q2C", label: "theta PIP C [deg]", min: 0, max: 45, step: 1, v: 15 },
    { id: "m", label: "masa objeto [kg]", min: 0, max: 4, step: 0.1, v: 4 },
    { id: "mu", label: "mu", min: 0.1, max: 1, step: 0.05, v: 0.5 },
    { id: "eta", label: "eficiencia eta", min: 0.3, max: 1, step: 0.05, v: 0.6 },
    { id: "cont", label: "contacto 1=P 2=D 3=T", min: 1, max: 3, step: 1, v: 3 },
    { id: "agarre", label: "agarre", select: [["pinch", "Pinch A-B"], ["power", "Power 120°"], ["plano", "Power según plano"], ["desigual", "Desigual 40/35/25"]], v: "pinch" },
  ],
  din: [
    { id: "Tc", label: "T central [N.m]", min: 0, max: 2, step: 0.01, v: 0.5 },
    { id: "m", label: "masa objeto [kg]", min: 0, max: 4, step: 0.1, v: 1 },
    { id: "mu", label: "mu", min: 0.1, max: 1, step: 0.05, v: 0.5 },
    { id: "eta", label: "eficiencia eta", min: 0.3, max: 1, step: 0.05, v: 0.6 },
    { id: "tc", label: "tiempo de cierre [s]", min: 0.3, max: 3, step: 0.1, v: 1 },
  ],
};
let mode = "est";
const val = {};
const $ = (s) => document.querySelector(s);
const fmt = (x, d = 3) => (Math.abs(x) < 5e-4 && d >= 3 ? (x === 0 ? "0.000" : x.toExponential(2)) : x.toFixed(d));

function buildInputs() {
  const box = $("#wm-inputs");
  box.innerHTML = "";
  for (const def of INPUTS[mode]) {
    const w = document.createElement("div");
    w.className = "wm-in";
    if (def.select) {
      w.innerHTML = `<label for="in-${def.id}">${def.label}</label><select id="in-${def.id}">${def.select.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>`;
      box.appendChild(w);
      const el = w.querySelector("select"); el.value = val[def.id] ?? def.v; val[def.id] = el.value;
      el.addEventListener("change", () => { val[def.id] = el.value; onChange(); });
      continue;
    }
    if (val[def.id] === undefined || val.__mode !== mode) val[def.id] = def.v;
    w.innerHTML = `<label for="in-${def.id}">${def.label}</label><input type="range" id="in-${def.id}" min="${def.min}" max="${def.max}" step="${def.step}" value="${val[def.id]}"><output id="out-${def.id}">${(+val[def.id]).toFixed(2)}</output>`;
    box.appendChild(w);
    const el = w.querySelector("input");
    el.addEventListener("input", () => { val[def.id] = +el.value; w.querySelector("output").textContent = (+el.value).toFixed(2); onChange(); });
  }
  val.__mode = mode;
}

// ---------------------------------------------------------------- medidores
function meters(groups) {
  $("#wm-meters").innerHTML = groups.map(([title, rows]) =>
    `<div class="meter"><div class="meter-h">${title}</div>${rows.map(([k, v, cls = ""]) => `<div class="meter-r ${cls}"><b>${k}</b><span>${v}</span></div>`).join("")}</div>`).join("");
}

// ---------------------------------------------------------------- lienzo
const cv = $("#wm-canvas"), ctx = cv.getContext("2d");
let view = { s: 4, ox: 0, oy: 0 };
function fitCanvas() {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.max(300, r.width * dpr); cv.height = Math.max(240, r.height * dpr);
  const W = 175, H = 165;                       // mm visibles
  view.s = Math.min(cv.width / W, cv.height / H);
  view.ox = cv.width / 2 - 5.265 * view.s;
  view.oy = cv.height * 0.2;                    // y = 0 (MCP) cerca de la parte superior
}
const X = (x) => view.ox + x * view.s;
const Y = (y) => view.oy - y * view.s;

// coordenadas de dedo (y', z') -> mundo (X, Y) mm
const toWorld = (k, p) => [MCPX[k] + S[k] * p[1], -p[0]];
function linkPoly(k, shape, base, q) { return shape.map((v) => toWorld(k, [base[0] + rot(v, q)[0], base[1] + rot(v, q)[1]])); }

function poly(pts, fill, stroke = "#000", lw = 1) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke();
}
function circle(x, y, r, fill, stroke = "#000") {
  ctx.beginPath(); ctx.arc(X(x), Y(y), r * view.s, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
}
function pinIcon(x, y) {
  const r = Math.max(4, 1.6 * view.s);
  ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, 2 * Math.PI); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(X(x), Y(y), r * 0.35, 0, 2 * Math.PI); ctx.fillStyle = "#000"; ctx.fill();
}
function gearIcon(x, y) {
  const r = Math.max(5, 1.9 * view.s), cx = X(x), cy = Y(y);
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = "#3b1d1d";
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-r * 0.18, -r * 1.05, r * 0.36, r * 0.5); }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, 2 * Math.PI); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 2 * Math.PI); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore();
}
function arrow(x, y, fx, fy, color, scale, label) {
  const x2 = x + fx * scale, y2 = y + fy * scale;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
  const a = Math.atan2(Y(y2) - Y(y), X(x2) - X(x)), h = 9;
  ctx.beginPath(); ctx.moveTo(X(x2), Y(y2)); ctx.lineTo(X(x2) - h * Math.cos(a - 0.4), Y(y2) - h * Math.sin(a - 0.4)); ctx.lineTo(X(x2) - h * Math.cos(a + 0.4), Y(y2) - h * Math.sin(a + 0.4)); ctx.fill();
  if (label) { ctx.font = `${Math.max(10, 3 * view.s)}px Segoe UI, sans-serif`; ctx.fillText(label, X(x2) + 4, Y(y2) - 4); }
}

function drawGripper(q1, q2s, extra) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  // palma, eje del sinfín y ruedas z30
  poly([[-44.735, 22], [55.265, 22], [55.265, 30], [-44.735, 30]], "#9ec4f7");
  pinIcon(5.265, 26);
  const ruedas = { A: MCPX.A - 19.5, B: MCPX.B + 19.5 };
  circle(ruedas.B, RUEDA_Y, 15, "#ffff9e"); circle(ruedas.A, RUEDA_Y, 15, "#ffff9e"); circle(0, RUEDA_Y, 8, "#ffff9e");
  ctx.strokeStyle = "#20b020"; ctx.lineWidth = 1;
  for (const k of ["A", "B"]) {
    ctx.beginPath(); ctx.moveTo(X(0), Y(RUEDA_Y)); ctx.lineTo(X(ruedas[k]), Y(RUEDA_Y)); ctx.lineTo(X(MCPX[k]), Y(0)); ctx.stroke();
  }
  gearIcon(ruedas.A, RUEDA_Y); gearIcon(ruedas.B, RUEDA_Y); gearIcon(0, RUEDA_Y);
  if (extra?.obj) {
    const o = extra.obj, pts = [];
    for (let i = 0; i < 24; i++) pts.push([o.x + OBJ.r * Math.cos((i + 0.5) * Math.PI / 12), o.y + OBJ.r * Math.sin((i + 0.5) * Math.PI / 12)]);
    poly(pts, "#8ee8ee");
    ctx.beginPath(); ctx.moveTo(X(o.x), Y(o.y)); ctx.lineTo(X(o.x + OBJ.r), Y(o.y)); ctx.strokeStyle = "#000"; ctx.stroke();
  }
  for (const k of ["C", "B", "A"]) {
    const qa = (q1 * Math.PI) / 180, qb = qa + (q2s[k] * Math.PI) / 180;
    const p = kinematics(q1, q2s[k]);
    poly(linkPoly(k, L1_SHAPE, [0, 0], qa), "#8ee8ee");
    poly(linkPoly(k, L2_SHAPE, p.PIP, qb), "#8ee8ee");
    if (k !== "C") { pinIcon(...toWorld(k, [0, 0])); pinIcon(...toWorld(k, p.PIP)); }
  }
  extra?.after?.();
}

// ---------------------------------------------------------------- modo estático
let frame = 0;
function staticState() {
  const contact = CONTACT[Math.round(val.cont) - 1];
  const r = solve({ q1: val.q1, q2A: val.q2A, q2B: val.q2B, q2C: val.q2C, m: val.m, mu: val.mu, eta: val.eta, contact, shares: SHARES[val.agarre] });
  return { r, contact };
}
function renderStatic() {
  const { r, contact } = staticState();
  const q2s = { A: val.q2A, B: val.q2B, C: val.q2C };
  drawGripper(val.q1, q2s, {
    after: () => {
      for (const k of ["A", "B"]) {
        const L = r.loads[k]; if (!L.N) continue;
        const p = kinematics(val.q1, q2s[k])[contact];
        const [wx, wy] = toWorld(k, p);
        arrow(wx, wy, S[k] * L.N, -L.Ft, "#d1495b", 0.45, k === "A" ? `N=${L.N.toFixed(1)} N` : "");
      }
    },
  });
  const A = r.res.A, toW = (v) => [v[1], -v[0]];
  const [Rx, Ry] = toW(A.RmcpV), [Px, Py] = toW(A.RpipV);
  const Nmin = (val.m * G) / (2 * val.mu);
  meters([
    ["Torques motores [N.m]", [["Central(ideal)", fmt(r.motorsIdeal.Tc)], ["Central(eta)", fmt(r.motors.Tc)], ["MotorA(eta)", fmt(r.motors.TA)], ["MotorB(eta)", fmt(r.motors.TB)], ["MotorC(eta)", fmt(r.motors.TC)]]],
    ["Torque MCP [N.m]", [["MCP A", fmt(A.tauMCP) + " N-m"], ["MCP B", fmt(r.res.B.tauMCP) + " N-m"], ["MCP C", fmt(r.res.C.tauMCP) + " N-m"]]],
    ["Torque PIP [N.m]", [["PIP A", fmt(A.tauPIP) + " N-m"], ["PIP B", fmt(r.res.B.tauPIP) + " N-m"], ["PIP C", fmt(r.res.C.tauPIP) + " N-m"]]],
    ["Reaccion MCP A [N]", [["|R|", A.Rmcp.toFixed(3) + " N"], ["Rx", Rx.toFixed(3) + " N"], ["Ry", Ry.toFixed(3) + " N"]]],
    ["Reaccion PIP A [N]", [["|R|", A.Rpip.toFixed(3) + " N"], ["Rx", Px.toFixed(3) + " N"], ["Ry", Py.toFixed(3) + " N"]]],
    ["Contacto dedo A [N]", [["Normal N", r.loads.A.N.toFixed(3)], ["Tangencial Ft", r.loads.A.Ft.toFixed(3)], ["N minima pinch", Nmin.toFixed(3)]]],
  ]);
}

// ---------------------------------------------------------------- modo dinámico
const dist2seg = (p, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy)));
  const cx = a[0] + t * vx, cy = a[1] + t * vy;
  return { d: Math.hypot(p[0] - cx, p[1] - cy), c: [cx, cy] };
};
function contactOf(q1, q2) {
  // distancia mínima del eje del objeto a los contornos del dedo A (en mundo)
  const qa = (q1 * Math.PI) / 180, qb = qa + (q2 * Math.PI) / 180, p = kinematics(q1, q2);
  const polys = [linkPoly("A", L1_SHAPE, [0, 0], qa), linkPoly("A", L2_SHAPE, p.PIP, qb)];
  let best = { d: 1e9 };
  for (const pl of polys) for (let i = 0; i < pl.length; i++) {
    const r = dist2seg([OBJ.x, OBJ.y], pl[i], pl[(i + 1) % pl.length]);
    if (r.d < best.d) best = r;
  }
  return best;
}
const RATIO = 0.75;     // θPIP = 0.75 θMCP durante el cierre (0→60°/45°)
let din = null;
function resetDin() {
  // ángulo de contacto: primer θMCP en que el contorno toca el objeto
  let qc = 60;
  for (let q = 0; q <= 60; q += 0.05) { if (contactOf(q, RATIO * q).d <= OBJ.r) { qc = q; break; } }
  din = { t: 0, q1: 0, phase: "cierre", qc, objY: OBJ.y, vObj: 0, hold: null, info: null };
}
function holdCheck() {
  const c = contactOf(din.qc, RATIO * din.qc);
  // punto de contacto en el marco del dedo A: z' = X - MCPx, y' = -Y
  const yc = -c.c[1], zc = c.c[0] - MCPX.A;
  const W = val.m * G;
  const tauAvail = (I_MCP * val.eta * val.Tc) / 2 * 1000;              // N·mm por dedo (A y B en contacto)
  const g = fingerStatics(din.qc, RATIO * din.qc, []);
  const tauG = g.tauMCP * 1000;
  // τ = y·N − z·(W/2) + τg  ->  N disponible
  const Nav = Math.max(0, (tauAvail + zc * (W / 2) - tauG) / yc);
  const Nmin = W / (2 * val.mu);
  return { Nav, Nmin, hold: 2 * val.mu * Nav >= W, yc, zc, tauAvail: tauAvail / 1000 };
}
function stepDin(dt) {
  const tc = val.tc, h1 = (60 * Math.PI) / 180;
  if (din.phase === "cierre") {
    din.t += dt;
    const k = cicloidal(Math.min(din.t, tc), tc, h1);
    const q1 = (k.q * 180) / Math.PI;
    if (q1 >= din.qc) {
      din.q1 = din.qc; din.phase = "agarre"; din.hold = holdCheck(); din.tContact = din.t;
    } else din.q1 = q1;
    din.kin = { w: k.w, a: k.a };
  } else if (din.phase === "agarre") {
    din.t += dt;
    if (!din.hold.hold && din.t - din.tContact > 0.3) din.phase = "cae";
  } else if (din.phase === "cae") {
    din.t += dt; din.vObj -= 9810 * dt; din.objY += din.vObj * dt;   // mm
    if (din.objY < -400) din.phase = "fin";
  }
}
function renderDin() {
  const q2 = RATIO * din.q1;
  drawGripper(din.q1, { A: q2, B: q2, C: q2 }, { obj: { x: OBJ.x, y: din.objY } });
  const k = din.kin || { w: 0, a: 0 };
  const w1 = din.phase === "cierre" ? k.w : 0, a1 = din.phase === "cierre" ? k.a : 0;
  const dyn = dynamicsAt([(din.q1 * Math.PI) / 180, (q2 * Math.PI) / 180], [w1, RATIO * w1], [a1, RATIO * a1]);
  const p = kinematics(din.q1, q2);
  const J = (() => { const e = 1e-4, pa = kinematics(din.q1 + e, RATIO * (din.q1 + e)); return Math.hypot(pa.T[0] - p.T[0], pa.T[1] - p.T[1]) / e * (180 / Math.PI) / 1000; })();
  const hold = din.hold;
  const status = din.phase === "cierre" ? "cerrando" : hold ? (hold.hold ? "SOSTIENE" : "CAE") : "-";
  meters([
    ["Torques de motor [N.m]", [["Central", fmt(val.Tc)], ["Motor A", "0.000"], ["Motor B", "0.000"], ["Motor C", "0.000"]]],
    ["Cinematica MCP", [["t [s]", din.t.toFixed(3)], ["theta MCP [deg]", din.q1.toFixed(2)], ["theta PIP [deg]", q2.toFixed(2)], ["omega MCP [rad/s]", fmt(w1)], ["alfa MCP [rad/s2]", fmt(a1)], ["|v| punta [m/s]", fmt(J * w1)]]],
    ["Dinamica dedo A", [["tau MCP inercia [N.m]", fmt(dyn.tauIn[0])], ["tau MCP gravedad [N.m]", fmt(dyn.tauG[0])], ["P servo 3 dedos [W]", fmt(Math.max(0, 3 * dyn.P[0]) / val.eta)]]],
    ["Agarre (criterio 2 mu N >= W)", hold ? [
      ["tau MCP disponible [N.m]", fmt(hold.tauAvail)], ["N disponible [N]", hold.Nav.toFixed(3)], ["N minima [N]", hold.Nmin.toFixed(3)],
      ["estado", status, hold.hold ? "ok" : "hi"]] : [["estado", status]]],
    ["Objeto", [["y objeto [m]", (din.objY / 1000).toFixed(3)], ["W [N]", (val.m * G).toFixed(3)]]],
  ]);
  $("#wm-frame").textContent = Math.round(din.t / 0.01);
}

// ---------------------------------------------------------------- bucle
let running = false, last = 0;
function loop(ts) {
  if (!running) return;
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016); last = ts;
  if (mode === "din") { stepDin(dt); renderDin(); if (din.phase === "fin") stop(); }
  else { frame++; $("#wm-frame").textContent = frame; renderStatic(); }
  requestAnimationFrame(loop);
}
function run() { running = true; last = performance.now(); $("#wm-status").textContent = "Computing frame…"; $("#btn-run").disabled = true; $("#btn-stop").disabled = false; requestAnimationFrame(loop); }
function stop() { running = false; $("#wm-status").textContent = "Ready"; $("#btn-run").disabled = false; $("#btn-stop").disabled = true; }
function reset() { stop(); frame = 0; $("#wm-frame").textContent = "0"; if (mode === "din") { resetDin(); renderDin(); } else renderStatic(); }
function onChange() { if (mode === "din") { if (!running) { resetDin(); renderDin(); } } else renderStatic(); }

function setMode(m) {
  mode = m; stop();
  $("#tab-est").classList.toggle("on", m === "est"); $("#tab-est").setAttribute("aria-selected", m === "est");
  $("#tab-din").classList.toggle("on", m === "din"); $("#tab-din").setAttribute("aria-selected", m === "din");
  $("#wm-file").textContent = `Working Model - [${m === "est" ? "Gripper_V24_Estatica" : "Gripper_V24_Agarre"}.wm2d]`;
  buildInputs(); reset();
}

$("#btn-run").addEventListener("click", run);
$("#btn-stop").addEventListener("click", stop);
$("#btn-reset").addEventListener("click", reset);
$("#tab-est").addEventListener("click", () => setMode("est"));
$("#tab-din").addEventListener("click", () => setMode("din"));
window.addEventListener("resize", () => { fitCanvas(); mode === "din" ? renderDin() : renderStatic(); });
fitCanvas();
setMode("est");
$("#btn-stop").disabled = true;
