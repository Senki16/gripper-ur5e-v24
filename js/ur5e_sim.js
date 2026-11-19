// Simulación del gripper V31 en un UR5e: brazo con la cinemática DH del UR5e, gripper del CAD,
// dedos que giran en sus ejes MCP y PIP reales y un ciclo de tomar y dejar una pieza.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const DEG = Math.PI / 180;
// UR5e, parámetros DH estándar (m, rad)
const DH = {
  a: [0, -0.425, -0.3922, 0, 0, 0],
  d: [0.1625, 0, 0, 0.1333, 0.0997, 0.0996],
  al: [Math.PI / 2, 0, 0, Math.PI / 2, -Math.PI / 2, 0],
};
// Poses calculadas con cinemática inversa (brida hacia abajo), en grados
const P = {
  home: [-0.04, -102.5, 102.18, -89.68, -90, -0.04],
  sobreA: [14.05, -88.23, 99.66, -101.43, -90, 14.05],
  agarreA: [14.05, -79.14, 115.1, -125.96, -90, 14.05],
  sobreB: [-45.79, -96.49, 107.54, -101.05, -90, -45.79],
  agarreB: [-45.79, -86.69, 123.9, -127.21, -90, -45.79],
};

// Ejes del gripper en coordenadas del CAD (m): MCP y PIP de cada dedo, giro alrededor de X
const DEDOS = {
  1: { mcp: [0.1438, 0.0167], pip: [0.1936, 0.0229] },
  2: { mcp: [0.1439, 0.0912], pip: [0.194, 0.0912] },
  3: { mcp: [0.1438, 0.0167], pip: [0.1939, 0.0198] },
};
const EJE = { x: 0.0522, z: 0.0505 };   // eje central del gripper
const AGARRE_Y = 0.195;                // altura del centro de agarre sobre la base del acople
const OBJ = { r: 0.018, h: 0.1 };       // cilindro de 36 mm × 100 mm
const ABIERTO = { mcp: -14 * DEG, pip: -12 * DEG };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// --------------------------------------------------------------- fases del ciclo
function fases(o, d) {
  // o: almohadilla de origen ("A" | "B"), d: destino
  return [
    { n: "reposo", dur: 1.2, robot: "En reposo", g: "Reposo", q: ["home", "home"], grip: 0 },
    { n: "ir", dur: 2.6, robot: `Moviendo sobre ${o}`, g: "Reposo", q: ["home", "sobre" + o], grip: 0 },
    { n: "bajar", dur: 1.4, robot: `Bajando a ${o}`, g: "Reposo", q: ["sobre" + o, "agarre" + o], grip: 0 },
    { n: "mcp", dur: 1.0, robot: `Agarrando en ${o}`, g: "Cerrando", q: ["agarre" + o, "agarre" + o], grip: [0, 1], cmd: ["CLOSE 4"] },
    { n: "pip", dur: 1.0, robot: `Agarrando en ${o}`, g: "Cerrando", q: ["agarre" + o, "agarre" + o], grip: [1, 2], cmd: ["CLOSE 1", "CLOSE 2", "CLOSE 3"] },
    { n: "sujeta", dur: 0.5, robot: `Agarrando en ${o}`, g: "Sujetando", q: ["agarre" + o, "agarre" + o], grip: 2, lleva: true },
    { n: "subir", dur: 1.3, robot: "Subiendo con la pieza", g: "Sujetando", q: ["agarre" + o, "sobre" + o], grip: 2, lleva: true, cmd: ["PING"] },
    { n: "llevar", dur: 2.8, robot: `Llevando a ${d}`, g: "Sujetando", q: ["sobre" + o, "sobre" + d], grip: 2, lleva: true, cmd: ["PING"] },
    { n: "bajar2", dur: 1.4, robot: `Bajando a ${d}`, g: "Sujetando", q: ["sobre" + d, "agarre" + d], grip: 2, lleva: true },
    { n: "abrePip", dur: 0.7, robot: `Soltando en ${d}`, g: "Abriendo", q: ["agarre" + d, "agarre" + d], grip: [2, 1], cmd: ["OPEN 1", "OPEN 2", "OPEN 3"] },
    { n: "abreMcp", dur: 0.7, robot: `Soltando en ${d}`, g: "Abriendo", q: ["agarre" + d, "agarre" + d], grip: [1, 0], cmd: ["OPEN 4"] },
    { n: "subir2", dur: 1.3, robot: `Subiendo desde ${d}`, g: "Reposo", q: ["agarre" + d, "sobre" + d], grip: 0 },
    { n: "volver", dur: 2.4, robot: "Volviendo a reposo", g: "Reposo", q: ["sobre" + d, "home"], grip: 0 },
  ];
}
const CICLO = [...fases("A", "B").map((f) => ({ ...f, de: "A", a: "B" })), ...fases("B", "A").map((f) => ({ ...f, de: "B", a: "A" }))];
let acc = 0;
for (const f of CICLO) { f.t0 = acc; acc += f.dur; }
const TOTAL = acc;
const half = CICLO.length / 2;
const IDX = { suelta1: CICLO.findIndex((f) => f.n === "abrePip"), toma2: half + CICLO.slice(half).findIndex((f) => f.n === "sujeta") };

// --------------------------------------------------------------- utilidades de geometría
function cil(r, z0, z1, mat, x = 0, y = 0, seg = 40) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), seg), mat);
  m.geometry.rotateX(Math.PI / 2);
  m.position.set(x, y, (z0 + z1) / 2);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function tuboX(r, x0, x1, z, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(x1 - x0), 36), mat);
  m.geometry.rotateZ(Math.PI / 2);
  m.position.set((x0 + x1) / 2, 0, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// carcasa de articulación con tapas oscuras en los extremos
function carcasa(r, z0, z1, x, mats) {
  const g = new THREE.Group();
  g.add(cil(r, z0 + 0.012, z1 - 0.012, mats.cuerpo, x));
  g.add(cil(r * 1.015, z1 - 0.012, z1, mats.tapa, x));
  g.add(cil(r * 1.015, z0, z0 + 0.012, mats.tapa, x));
  return g;
}

function etiqueta(txt) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#141414"; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#fbfaf8"; x.font = "600 72px Inter, system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(txt, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t }));
  s.scale.set(0.035, 0.035, 1);
  return s;
}

// --------------------------------------------------------------- brazo UR5e
function brazo() {
  const mats = {
    cuerpo: new THREE.MeshStandardMaterial({ color: 0xd9dadc, metalness: 0.35, roughness: 0.38 }),
    tubo: new THREE.MeshStandardMaterial({ color: 0xc9cbce, metalness: 0.55, roughness: 0.32 }),
    tapa: new THREE.MeshStandardMaterial({ color: 0x3a4f63, metalness: 0.2, roughness: 0.5 }),
    brida: new THREE.MeshStandardMaterial({ color: 0x6d7177, metalness: 0.7, roughness: 0.3 }),
  };
  const raiz = new THREE.Group();
  raiz.rotation.x = -Math.PI / 2; // marco del robot con z hacia arriba
  raiz.add(cil(0.075, 0, 0.012, mats.tapa), cil(0.064, 0.012, 0.09, mats.cuerpo));

  const j = [], off = [];
  let padre = raiz;
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); padre.add(g); j.push(g);
    const o = new THREE.Group(); o.position.set(DH.a[i], 0, DH.d[i]); o.rotation.x = DH.al[i];
    g.add(o); off.push(o); padre = o;
  }
  // base que gira (q1)
  j[0].add(carcasa(0.062, 0.07, DH.d[0] - 0.045, 0, mats));
  // hombro (eje q2) y brazo
  off[0].add(carcasa(0.062, -0.065, 0.075, 0, mats));
  j[1].add(carcasa(0.058, 0.075, 0.2, 0, mats));
  j[1].add(tuboX(0.045, -0.04, DH.a[1] + 0.04, 0.138, mats.tubo));
  j[1].add(carcasa(0.05, 0.06, 0.19, DH.a[1], mats));
  // codo y antebrazo
  j[2].add(carcasa(0.046, -0.045, 0.06, 0, mats));
  j[2].add(tuboX(0.036, -0.03, DH.a[2] + 0.03, 0.007, mats.tubo));
  j[2].add(carcasa(0.04, -0.04, 0.05, DH.a[2], mats));
  // muñecas
  j[3].add(carcasa(0.04, 0.05, DH.d[3] + 0.0, 0, mats));
  off[3].add(carcasa(0.04, -0.045, 0.045, 0, mats));
  j[4].add(carcasa(0.04, 0.045, DH.d[4] + 0.0, 0, mats));
  off[4].add(carcasa(0.04, -0.045, 0.045, 0, mats));
  j[5].add(cil(0.034, 0.045, DH.d[5], mats.brida));
  return { raiz, j, brida: off[5] };
}

// --------------------------------------------------------------- simulador
class Sim {
  constructor(el, ui) {
    this.el = el; this.ui = ui;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(r.domElement);

    const sc = (this.scene = new THREE.Scene());
    sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    this.cam = new THREE.PerspectiveCamera(34, 1, 0.01, 20);
    this.ctl = new OrbitControls(this.cam, r.domElement);
    Object.assign(this.ctl, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.15, maxDistance: 4, maxPolarAngle: Math.PI * 0.49 });

    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(0.9, 1.6, 1.1); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.radius = 5;
    Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 5 });
    sc.add(key, new THREE.HemisphereLight(0xffffff, 0xd9d6cf, 0.6));

    // mesa
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.05), new THREE.MeshStandardMaterial({ color: 0xe8e5de, roughness: 0.9 }));
    mesa.position.set(-0.3, -0.02, 0); mesa.receiveShadow = true; sc.add(mesa);
    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), new THREE.ShadowMaterial({ opacity: 0.16 }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.set(-0.3, 0.0005, 0); sombra.receiveShadow = true; sc.add(sombra);

    this.arm = brazo(); sc.add(this.arm.raiz);
    this.q = P.home.map((v) => v * DEG);
    this.t = 0; this.play = true; this.vel = 1; this.vista = "general"; this.listo = false;
    this.ultimaFase = -1;

    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    this.encuadre("general", true);
    let prev = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - prev) / 1000, 0.25); prev = now;
      if (this.listo && this.play && this.visible !== false) this.setT((this.t + dt * this.vel) % TOTAL);
      if (this.visible !== false) { this.seguir(); this.ctl.update(); r.render(sc, this.cam); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  }

  setQ(q) {
    this.q = q;
    q.forEach((v, i) => (this.arm.j[i].rotation.z = v));
    this.arm.raiz.updateMatrixWorld(true);
  }

  async cargarGripper(url, onProgress) {
    const g = await new GLTFLoader().loadAsync(url, (e) => e.total && onProgress?.(e.loaded / e.total));
    const m = g.scene;
    m.updateMatrixWorld(true);
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const centro = (o) => box.setFromObject(o).getCenter(c).clone();
    const mallas = [];
    m.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; mallas.push(o); } });
    const ud = (o) => (Object.keys(o.userData).length ? o.userData : o.parent?.userData || {});

    // pivotes de los dedos
    this.dedos = {};
    for (const [k, D] of Object.entries(DEDOS)) {
      const mcp = new THREE.Group(); mcp.position.set(0, D.mcp[0], D.mcp[1]); m.add(mcp);
      const pip = new THREE.Group(); pip.position.set(0, D.pip[0], D.pip[1]); m.add(pip);
      m.updateMatrixWorld(true); mcp.attach(pip);
      this.dedos[k] = { mcp, pip, sgn: 1, contP: [], contD: [], gusano: null };
    }
    // engranajes que giran
    this.engr = [];
    const pivEng = (malla, eje) => {
      const p = new THREE.Group(); p.position.copy(centro(malla)); m.add(p); m.updateMatrixWorld(true); p.attach(malla);
      return p;
    };
    const asignar = [];
    for (const o of mallas) {
      const u = ud(o), p = centro(o), parte = u.parte || "", dedo = +u.dedo || 0;
      if (dedo) {
        const distal = /Falange_Distal|Huella_D|Corona_14T/.test(parte) || (/Iman/.test(parte) && p.y > 0.19);
        asignar.push([o, dedo, distal, parte]);
      } else if (p.y > 0.185) {
        // tornillería del eje PIP: va con la falange proximal del dedo más cercano
        let best = 1, bd = 1e9;
        for (const [k, D] of Object.entries(DEDOS)) { const dd = Math.abs(p.z - D.pip[1]) + Math.abs(p.y - D.pip[0]); if (dd < bd) { bd = dd; best = +k; } }
        if (Math.abs(p.z - DEDOS[best].pip[1]) < 0.02) asignar.push([o, best, false, parte]);
      } else if (/Pinon_28T/.test(parte)) this.engr.push({ p: pivEng(o), k: 1 });
      else if (/Pinon_21T|Acople_motor/.test(parte)) this.engr.push({ p: pivEng(o), k: -28 / 21 });
    }
    for (const [o, dedo, distal, parte] of asignar) {
      const D = this.dedos[dedo];
      if (/Tornillo_sinfin_PIP/.test(parte)) { const g = pivEng(o); D.mcp.attach(g); D.gusano = g; continue; }
      (distal ? D.pip : D.mcp).attach(o);
      if (/Huella_P/.test(parte)) D.contP.push(o);
      if (/Huella_D/.test(parte)) D.contD.push(o);
    }

    // montaje en la brida: +y del gripper sobre el eje de la herramienta
    const giro = new THREE.Group(); giro.rotation.x = Math.PI / 2;
    m.position.set(-EJE.x, -0.0009, -EJE.z);
    giro.add(m); this.arm.brida.add(giro);
    this.gripper = m;
    this.ancla = new THREE.Object3D(); this.ancla.position.set(EJE.x, AGARRE_Y, EJE.z); m.add(this.ancla);

    this.calcularContactos();
    this.prepararEscena();
    this.listo = true;
    this.setT(0);
  }

  // ángulos de contacto con el cilindro, calculados con la geometría de las yemas
  calcularContactos() {
    const verts = (mallas, ref) => {
      const out = [], v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(ref.matrixWorld).invert();
      for (const o of mallas) {
        o.updateMatrixWorld(true);
        const M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), pos = o.geometry.attributes.position;
        const paso = Math.max(1, Math.floor(pos.count / 400));
        for (let i = 0; i < pos.count; i += paso) out.push(v.fromBufferAttribute(pos, i).applyMatrix4(M).clone());
      }
      return out;
    };
    const m = this.gripper; m.updateMatrixWorld(true);
    const yMin = AGARRE_Y - OBJ.h / 2 + 0.006, yMax = AGARRE_Y + OBJ.h / 2 + 0.006;
    const dist = (p) => Math.hypot(p.x - EJE.x, p.z - EJE.z);
    const rotX = (p, c, a) => { // gira p alrededor del eje X que pasa por c=(y,z)
      const y = p.y - c[0], z = p.z - c[1], s = Math.sin(a), co = Math.cos(a);
      return new THREE.Vector3(p.x, c[0] + y * co - z * s, c[1] + y * s + z * co);
    };
    const minDist = (pts) => pts.reduce((mn, p) => (p.y > yMin && p.y < yMax ? Math.min(mn, dist(p)) : mn), 1);
    let mcpC = 60 * DEG;
    for (const [k, D] of Object.entries(this.dedos)) {
      const P0 = verts(D.contP, m), Dd0 = verts(D.contD, m), De = DEDOS[k];
      // sentido de cierre: el que acerca la yema al eje
      D.sgn = minDist(P0.map((p) => rotX(p, De.mcp, 5 * DEG))) < minDist(P0) ? 1 : -1;
      D.P0 = P0; D.D0 = Dd0;
      const pose = (a, b) => {
        const pip = rotX(new THREE.Vector3(0, De.pip[0], De.pip[1]), De.mcp, D.sgn * a);
        return {
          P: P0.map((p) => rotX(p, De.mcp, D.sgn * a)),
          D: Dd0.map((p) => rotX(rotX(p, De.pip, D.sgn * b), De.mcp, D.sgn * a)),
        };
      };
      D.pose = pose;
      for (let a = ABIERTO.mcp; a < 60 * DEG; a += 0.25 * DEG) {
        const s = pose(a, ABIERTO.pip);
        if (Math.min(minDist(s.P), minDist(s.D)) <= OBJ.r + 0.0004) { mcpC = Math.min(mcpC, a); break; }
      }
    }
    this.mcpCierre = mcpC;
    for (const D of Object.values(this.dedos)) {
      D.pipCierre = 45 * DEG;
      for (let b = ABIERTO.pip; b < 45 * DEG; b += 0.25 * DEG) {
        if (minDist(D.pose(mcpC, b).D) <= OBJ.r + 0.0004) { D.pipCierre = b; break; }
      }
      delete D.P0; delete D.D0;
    }
  }

  prepararEscena() {
    const sc = this.scene;
    const pos = (q) => { this.setQ(q.map((v) => v * DEG)); return this.ancla.getWorldPosition(new THREE.Vector3()); };
    this.pads = { A: pos(P.agarreA), B: pos(P.agarreB) };
    const matPad = new THREE.MeshStandardMaterial({ color: 0xd3d0c8, roughness: 0.8 });
    for (const [k, p] of Object.entries(this.pads)) {
      const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.003, 48), matPad);
      disco.position.set(p.x, 0.0015, p.z); disco.receiveShadow = true; sc.add(disco);
      const anillo = new THREE.Mesh(new THREE.RingGeometry(0.041, 0.045, 64), new THREE.MeshBasicMaterial({ color: 0xef6a1a }));
      anillo.rotation.x = -Math.PI / 2; anillo.position.set(p.x, 0.0032, p.z); sc.add(anillo);
      const e = etiqueta(k); e.position.set(p.x + 0.07, 0.02, p.z + 0.05); sc.add(e);
    }
    const pieza = new THREE.Mesh(new THREE.CylinderGeometry(OBJ.r, OBJ.r, OBJ.h, 48),
      new THREE.MeshStandardMaterial({ color: 0x2f6f8f, metalness: 0.4, roughness: 0.35 }));
    pieza.castShadow = pieza.receiveShadow = true; sc.add(pieza);
    this.pieza = pieza;
    // transformación pieza respecto al ancla en el momento del agarre (igual en A y B)
    this.setQ(P.agarreA.map((v) => v * DEG));
    const mp = new THREE.Matrix4().makeTranslation(this.pads.A.x, OBJ.h / 2, this.pads.A.z);
    this.rel = new THREE.Matrix4().copy(this.ancla.matrixWorld).invert().multiply(mp);
  }

  setGrip(g) {
    // g: 0 abierto, 1 MCP cerrado, 2 MCP y PIP cerrados
    const a = lerp(ABIERTO.mcp, this.mcpCierre, Math.min(g, 1));
    const rel = Math.min(Math.max(g - 1, 0), 1);
    let pipProm = 0;
    for (const D of Object.values(this.dedos)) {
      const b = lerp(ABIERTO.pip, D.pipCierre, rel);
      D.mcp.rotation.x = D.sgn * a; D.pip.rotation.x = D.sgn * b;
      if (D.gusano) D.gusano.rotation.y = b * 14;
      pipProm += b / 3;
    }
    for (const e of this.engr) e.p.rotation.y = a * 12 * e.k;
    this.angMcp = a; this.angPip = pipProm;
  }

  setT(t) {
    this.t = t;
    let i = CICLO.findIndex((f) => t < f.t0 + f.dur); if (i < 0) i = CICLO.length - 1;
    const f = CICLO[i], u = (t - f.t0) / f.dur, e = ease(Math.min(Math.max(u, 0), 1));
    const q0 = P[f.q[0]], q1 = P[f.q[1]];
    this.setQ(q0.map((v, k) => lerp(v, q1[k], e) * DEG));
    this.setGrip(Array.isArray(f.grip) ? lerp(f.grip[0], f.grip[1], e) : f.grip);
    this.gripper.updateMatrixWorld(true);
    // la pieza: en el gripper mientras lo lleva; si no, en A (primer ciclo) o en B (segundo)
    if (f.lleva) {
      this.pieza.matrixAutoUpdate = false;
      this.pieza.matrix.multiplyMatrices(this.ancla.matrixWorld, this.rel);
      this.pieza.matrixWorldNeedsUpdate = true;
    } else {
      const base = i >= IDX.suelta1 && i < IDX.toma2 ? this.pads.B : this.pads.A;
      this.pieza.matrixAutoUpdate = true;
      this.pieza.position.set(base.x, OBJ.h / 2, base.z); this.pieza.rotation.set(0, 0, 0);
    }
    if (i !== this.ultimaFase) {
      if (f.cmd && (this.ultimaFase === -1 || i === (this.ultimaFase + 1) % CICLO.length)) this.ui.comandos?.(f.cmd);
      this.ultimaFase = i;
    }
    this.ui.estado?.(f, this.q, this.angMcp, this.angPip, t / TOTAL);
  }

  encuadre(v, inmediato) {
    this.vista = v;
    if (v === "general") {
      const lejos = this.cam.aspect < 1 ? 1.45 : 1;
      this.ctl.target.set(-0.22, 0.24, 0.0);
      this.cam.position.set(-0.22 + 0.95 * lejos, 0.24 + 0.55 * lejos, 1.35 * lejos);
      this.anclaPrev = null;
    } else if (this.ancla) {
      const a = this.ancla.getWorldPosition(new THREE.Vector3());
      this.ctl.target.copy(a); this.cam.position.copy(a).add(new THREE.Vector3(0.3, 0.14, 0.4));
      this.anclaPrev = a.clone();
    }
    this.ctl.update(); void inmediato;
  }

  seguir() {
    if (this.vista !== "gripper" || !this.ancla || !this.anclaPrev) return;
    const a = this.ancla.getWorldPosition(new THREE.Vector3()), d = a.clone().sub(this.anclaPrev);
    this.ctl.target.add(d); this.cam.position.add(d); this.anclaPrev = a;
  }
}

// --------------------------------------------------------------- interfaz
const $ = (s) => document.querySelector(s);
const stage = $("#sim-stage");
if (stage) {
  const log = $("#sim-log"), juntas = $("#sim-q"), est = $("#sim-estado"), rob = $("#sim-robot"), dedos = $("#sim-dedos"), barra = $("#sim-t"), fase = $("#sim-fase");
  let arrastrando = false;
  const lineas = ["<span class=\"c\"># UR5e: set_tool_communication(True, 115200, 0, 1, 1.5, 3.5)</span>"];
  const pintarLog = () => (log.innerHTML = lineas.slice(-7).join("<br>"));
  pintarLog();
  const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).padStart(5, " ").replace(/ /g, "&nbsp;");
  const ui = {
    comandos(cs) { for (const c of cs) lineas.push(`<span class="p">&gt;</span> ${c}`); pintarLog(); },
    estado(f, q, mcp, pip, frac) {
      est.textContent = f.g; est.dataset.g = f.g;
      rob.textContent = f.robot;
      juntas.innerHTML = q.map((v, i) => `<div><dt>q${i + 1}</dt><dd>${fmt(v / DEG)}°</dd></div>`).join("");
      dedos.innerHTML = `<div><dt>MCP</dt><dd>${fmt(mcp / DEG)}°</dd></div><div><dt>PIP</dt><dd>${fmt(pip / DEG)}°</dd></div>`;
      if (!arrastrando) barra.value = String(frac);
      fase.textContent = `${(frac * TOTAL).toFixed(1)} s / ${TOTAL.toFixed(0)} s`;
    },
  };
  const sim = new Sim(stage, ui);
  window.__sim = sim;
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const btnPlay = $("#sim-play");
  const setPlay = (v) => { sim.play = v; btnPlay.textContent = v ? "Pausa" : "Reproducir"; btnPlay.setAttribute("aria-pressed", String(!v)); };
  btnPlay.addEventListener("click", () => setPlay(!sim.play));
  $("#sim-reset").addEventListener("click", () => { lineas.length = 1; pintarLog(); sim.ultimaFase = -1; sim.setT(0); setPlay(true); });
  document.querySelectorAll("[data-vel]").forEach((b) => b.addEventListener("click", () => {
    sim.vel = +b.dataset.vel;
    document.querySelectorAll("[data-vel]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  document.querySelectorAll("[data-simvista]").forEach((b) => b.addEventListener("click", () => {
    sim.encuadre(b.dataset.simvista);
    document.querySelectorAll("[data-simvista]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  barra.addEventListener("input", () => { arrastrando = true; setPlay(false); sim.ultimaFase = -2; sim.setT(+barra.value * TOTAL * 0.99999); });
  barra.addEventListener("change", () => (arrastrando = false));

  let iniciado = false;
  const arrancar = async () => {
    if (iniciado) return; iniciado = true;
    try {
      await sim.cargarGripper("assets/3d/gripper_v31.glb", (p) => ($("#sim-load-bar").style.width = `${Math.round(p * 100)}%`));
      $("#sim-loading").classList.add("done");
      if (reducido) setPlay(false);
    } catch (e) {
      $("#sim-load-txt").textContent = "No se pudo cargar el modelo 3D.";
      console.error(e);
    }
  };
  new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); arrancar(); } }, { rootMargin: "400px" }).observe(stage);
  if (document.readyState === "complete") setTimeout(arrancar, 1500);
  else addEventListener("load", () => setTimeout(arrancar, 1500)); // respaldo si el observador no se dispara
  // pausa cuando la simulación no está a la vista
  new IntersectionObserver((es) => { for (const e of es) sim.visible = e.isIntersecting; }).observe(stage);
}
