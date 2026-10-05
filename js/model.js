// Modelo analítico del gripper V2.4 (traducción de gripper_model.py).
// Marco palma-fijo del dedo: y' a lo largo del dedo recto, z' hacia el dorso; cierre positivo.
export const G = 9.81;
export const M1 = 31.49e-3, M2 = 12.35e-3;            // kg
export const I_MCP = 12, I_PIP = 4;                     // relaciones de transmisión

export const R_MCP = {
  G1: [26.52, 0.89], P: [31.0, -13.0], PIP: [50.0, -4.0],
  G2: [66.19, -4.11], D: [71.45, -13.0], T: [85.0, -13.0], W30: [-7.79, -19.5],
};
export const R_PIP = { G2: [16.19, -0.11], D: [21.45, -9.0], T: [35.0, -9.0] };

// contornos (visuales) de las falanges en coordenadas locales (y', z') [mm]
export const L1_SHAPE = [[-6, 6], [50, 6], [50, -6], [42, -13], [20, -13], [-6, -6]];
export const L2_SHAPE = [[-4, 5], [33, 5], [37, 0], [35, -9], [8, -9], [-4, -4]];

const rad = (d) => (d * Math.PI) / 180;

export function rot(v, q) {
  const c = Math.cos(q), s = Math.sin(q);
  return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c];
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

export function kinematics(q1d, q2d) {
  const q1 = rad(q1d), q2 = rad(q2d);
  const p = {};
  for (const k of ["G1", "P", "PIP", "W30"]) p[k] = rot(R_MCP[k], q1);
  for (const k of ["G2", "D", "T"]) p[k] = add(p.PIP, rot(R_PIP[k], q1 + q2));
  return p;
}

const moment = (r, F) => r[0] * F[1] - r[1] * F[0];   // N·mm, positivo = cierre

/** contacts: [{pt:"P"|"D"|"T", fy, fz}] fuerzas del objeto sobre el dedo [N] */
export function fingerStatics(q1d, q2d, contacts = []) {
  const p = kinematics(q1d, q2d);
  const W1 = [M1 * G, 0], W2 = [M2 * G, 0];            // gripper hacia abajo: g = +y'
  let tm = moment(p.G1, W1) + moment(p.G2, W2);
  let tp = moment(sub(p.G2, p.PIP), W2);
  const tgm = tm / 1000, tgp = tp / 1000;
  let FL1 = [0, 0], FL2 = [0, 0];
  for (const c of contacts) {
    const F = [c.fy, c.fz];
    tm += moment(p[c.pt], F);
    if (c.pt === "P") FL1 = add(FL1, F);
    else { tp += moment(sub(p[c.pt], p.PIP), F); FL2 = add(FL2, F); }
  }
  const Rpip = [-(FL2[0] + W2[0]), -(FL2[1] + W2[1])];
  const Rmcp = [-(FL1[0] + FL2[0] + W1[0] + W2[0]), -(FL1[1] + FL2[1] + W1[1] + W2[1])];
  return {
    p, tauMCP: tm / 1000, tauPIP: tp / 1000, tauG_MCP: tgm, tauG_PIP: tgp,
    Rmcp: Math.hypot(...Rmcp), Rpip: Math.hypot(...Rpip), RmcpV: Rmcp, RpipV: Rpip,
  };
}

/** reparto de carga: shares {A,B,C} (suman 1); N = s·W/μ, F_t = s·W */
export function graspLoads(m, mu, contact, shares) {
  const W = m * G, out = {};
  for (const k of ["A", "B", "C"]) {
    const N = (shares[k] * W) / mu, Ft = shares[k] * W;
    out[k] = { N, Ft, contacts: N > 0 ? [{ pt: contact, fy: Ft, fz: N }] : [] };
  }
  return out;
}

export function motorTorques(tm, tp, eta) {
  return {
    Tc: (tm.A + tm.B + tm.C) / (I_MCP * eta),
    TA: tp.A / (I_PIP * eta), TB: tp.B / (I_PIP * eta), TC: tp.C / (I_PIP * eta),
  };
}

export const SHARES = {
  pinch: { A: 0.5, B: 0.5, C: 0 },
  power: { A: 1 / 3, B: 1 / 3, C: 1 / 3 },
  plano: { A: 0.5, B: 0.25, C: 0.25 },
  desigual: { A: 0.4, B: 0.35, C: 0.25 },
};

/** caso completo: posturas iguales en los tres dedos (modo central) o PIP independientes */
export function solve({ q1, q2A, q2B, q2C, m, mu, eta, contact, shares }) {
  const L = graspLoads(m, mu, contact, shares);
  const q2 = { A: q2A, B: q2B, C: q2C };
  const res = {};
  for (const k of ["A", "B", "C"]) res[k] = fingerStatics(q1, q2[k], L[k].contacts);
  const tm = { A: res.A.tauMCP, B: res.B.tauMCP, C: res.C.tauMCP };
  const tp = { A: res.A.tauPIP, B: res.B.tauPIP, C: res.C.tauPIP };
  return { res, loads: L, motors: motorTorques(tm, tp, eta), motorsIdeal: motorTorques(tm, tp, 1) };
}

// --------------------------- cinemática y dinámica del cierre
export function cicloidal(t, T, h) {
  const s = t / T;
  return {
    q: h * (s - Math.sin(2 * Math.PI * s) / (2 * Math.PI)),
    w: (h / T) * (1 - Math.cos(2 * Math.PI * s)),
    a: ((h / (T * T)) * 2 * Math.PI) * Math.sin(2 * Math.PI * s),
  };
}

function jacPoint(q1, q2, rMcp, rPip) {
  const d = (v, q) => { const c = Math.cos(q), s = Math.sin(q); return [(-v[0] * s + v[1] * c) / 1000, (-v[0] * c - v[1] * s) / 1000]; };
  if (!rPip) { const a = d(rMcp, q1); return [[a[0], 0], [a[1], 0]]; }
  const j2 = d(rPip, q1 + q2), j1 = add(d(R_MCP.PIP, q1), j2);
  return [[j1[0], j2[0]], [j1[1], j2[1]]];
}
function JTJ(J) {
  const a = J[0][0] ** 2 + J[1][0] ** 2, b = J[0][0] * J[0][1] + J[1][0] * J[1][1], c = J[0][1] ** 2 + J[1][1] ** 2;
  return [[a, b], [b, c]];
}
const I1C = 8941e-9, I2C = 1826e-9;
export function massMatrix(q1, q2) {
  const A = JTJ(jacPoint(q1, q2, R_MCP.G1)), B = JTJ(jacPoint(q1, q2, null, R_PIP.G2));
  return [[M1 * A[0][0] + I1C + M2 * B[0][0] + I2C, M1 * A[0][1] + M2 * B[0][1] + I2C],
          [M1 * A[1][0] + M2 * B[1][0] + I2C, M1 * A[1][1] + M2 * B[1][1] + I2C]];
}
function potential(q1, q2) {
  const p = kinematics((q1 * 180) / Math.PI, (q2 * 180) / Math.PI);
  return (-G * (M1 * p.G1[0] + M2 * p.G2[0])) / 1000;
}
/** torques (inercia + gravedad) y potencias en un instante del cierre */
export function dynamicsAt(q, qd, qdd) {
  const h = 1e-6, E = [[1, 0], [0, 1]];
  const M = massMatrix(q[0], q[1]);
  const dM = E.map((e) => {
    const Mp = massMatrix(q[0] + h * e[0], q[1] + h * e[1]), Mm = massMatrix(q[0] - h * e[0], q[1] - h * e[1]);
    return [[(Mp[0][0] - Mm[0][0]) / (2 * h), (Mp[0][1] - Mm[0][1]) / (2 * h)], [(Mp[1][0] - Mm[1][0]) / (2 * h), (Mp[1][1] - Mm[1][1]) / (2 * h)]];
  });
  const Md = [[dM[0][0][0] * qd[0] + dM[1][0][0] * qd[1], dM[0][0][1] * qd[0] + dM[1][0][1] * qd[1]],
              [dM[0][1][0] * qd[0] + dM[1][1][0] * qd[1], dM[0][1][1] * qd[0] + dM[1][1][1] * qd[1]]];
  const quad = (A) => qd[0] * (A[0][0] * qd[0] + A[0][1] * qd[1]) + qd[1] * (A[1][0] * qd[0] + A[1][1] * qd[1]);
  const dT = [0.5 * quad(dM[0]), 0.5 * quad(dM[1])];
  const dV = E.map((e) => (potential(q[0] + h * e[0], q[1] + h * e[1]) - potential(q[0] - h * e[0], q[1] - h * e[1])) / (2 * h));
  const tin = [M[0][0] * qdd[0] + M[0][1] * qdd[1] + Md[0][0] * qd[0] + Md[0][1] * qd[1] - dT[0],
               M[1][0] * qdd[0] + M[1][1] * qdd[1] + Md[1][0] * qd[0] + Md[1][1] * qd[1] - dT[1]];
  const tau = [tin[0] + dV[0], tin[1] + dV[1]];
  return { tauIn: tin, tauG: dV, tau, P: [tau[0] * qd[0], tau[1] * qd[1]] };
}
