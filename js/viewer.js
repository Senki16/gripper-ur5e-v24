// Visor 3D del gripper V31: ensamble con vista explosionada, selección de piezas y piezas sueltas.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const CAT = {
  pla: "PLA · estructura", pla2: "PLA · falanges", gear: "PLA · transmisión", acople: "PLA · acople UR5e",
  tpu: "TPU 95A · yemas", steel: "Tornillería y ejes", magnet: "Imanes N52", motor: "Motor DC", pcb: "PCB",
};
const HARDWARE = new Set(["steel", "magnet"]);

export class Visor {
  constructor(el, { onSelect, onProgress } = {}) {
    this.el = el; this.onSelect = onSelect; this.onProgress = onProgress;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.001, 50);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, autoRotateSpeed: 0.9, minDistance: 0.03, maxDistance: 2 });

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.25, 0.5, 0.35); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 6;
    Object.assign(key.shadow.camera, { left: -0.2, right: 0.2, top: 0.2, bottom: -0.2, near: 0.01, far: 2 });
    this.key = key; this.scene.add(key, key.target, new THREE.HemisphereLight(0xffffff, 0xd9d6cf, 0.55));
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: 0.14 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.scene.add(this.ground);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.loader = new GLTFLoader();
    this.parts = []; this.explode = 0; this.mode = "asm"; this.selected = null;

    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); let down = null;
    r.domElement.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
    r.domElement.addEventListener("pointerup", (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) this.pick(e);
    });
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => { this.controls.update(); r.render(this.scene, this.camera); requestAnimationFrame(loop); };
    loop();
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  async cargar(url) {
    const g = await this.loader.loadAsync(url, (e) => e.total && this.onProgress?.(e.loaded / e.total));
    return g.scene;
  }

  limpiar() {
    this.root.clear(); this.parts = []; this.selected = null;
  }

  async ensamble(url) {
    this.limpiar(); this.mode = "asm";
    const s = await this.cargar(url);
    s.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.material = o.material.clone();
      const ex = o.parent?.userData && Object.keys(o.userData).length ? o.userData : o.parent?.userData || {};
      o.userData = { ...ex };
      this.parts.push(o);
    });
    this.root.add(s);
    // Centro del ensamble y dirección de explosión de cada pieza
    const box = new THREE.Box3().setFromObject(s), c = box.getCenter(new THREE.Vector3());
    this.box = box; this.center = c;
    const tmp = new THREE.Box3(), pc = new THREE.Vector3();
    for (const m of this.parts) {
      tmp.setFromObject(m).getCenter(pc);
      const d = pc.clone().sub(c);
      d.y *= 1.25; // abrir más en la vertical: dedos hacia arriba, acople hacia abajo
      m.userData.dir = d; m.userData.base = m.position.clone();
    }
    this.encuadrar(box, [1, 0.55, 1.15]);
    return this.parts;
  }

  async pieza(url, meta) {
    this.limpiar(); this.mode = "pieza";
    const s = await this.cargar(url);
    s.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData = { ...meta }; this.parts.push(o); } });
    this.root.add(s);
    const box = new THREE.Box3().setFromObject(s);
    // apoyar la pieza en el suelo
    s.position.y -= box.min.y; box.setFromObject(s);
    this.encuadrar(box, [1, 0.7, 1.2]);
  }

  encuadrar(box, dir = [1, 0.6, 1.1]) {
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const r = size.length() / 2;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.12 / Math.min(1, this.camera.aspect * 0.9);
    const v = new THREE.Vector3(...dir).normalize();
    this.camera.position.copy(c).addScaledVector(v, dist);
    this.camera.near = dist / 100; this.camera.far = dist * 20; this.camera.updateProjectionMatrix();
    this.controls.target.copy(c); this.controls.update();
    this.ground.position.y = box.min.y - 0.0005;
    this.key.position.copy(c).add(new THREE.Vector3(0.25, 0.55, 0.3).multiplyScalar(Math.max(r * 4, 0.1)));
    this.key.target.position.copy(c);
    const s = Math.max(r * 2.2, 0.03);
    Object.assign(this.key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: r * 30 + 1 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.fit = { c, dist };
  }

  vista(nombre) {
    if (!this.fit) return;
    const d = { iso: [1, 0.55, 1.15], frente: [0, 0.08, 1], arriba: [0.0001, 1, 0.0001], lado: [1, 0.08, 0] }[nombre];
    const v = new THREE.Vector3(...d).normalize();
    this.camera.position.copy(this.fit.c).addScaledVector(v, this.fit.dist * (1 + this.explode * 0.8));
    this.controls.target.copy(this.fit.c); this.controls.update();
  }

  setExplode(t) {
    this.explode = t;
    for (const m of this.parts) if (m.userData.dir) m.position.copy(m.userData.base).addScaledVector(m.userData.dir, t * 0.95);
  }

  setHardware(v) { for (const m of this.parts) if (HARDWARE.has(m.userData.cat)) m.visible = v; }

  filtro(fn) { for (const m of this.parts) m.visible = fn(m.userData); }

  resaltar(parte) {
    for (const m of this.parts) {
      const on = !parte || m.userData.parte === parte;
      m.material.transparent = !on; m.material.opacity = on ? 1 : 0.12; m.material.depthWrite = on;
      m.material.emissive?.set(parte && on ? 0x3a1a05 : 0x000000);
    }
  }

  pick(e) {
    const rc = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const hit = this.ray.intersectObjects(this.parts.filter((m) => m.visible && m.material.opacity > 0.5), false)[0];
    const ud = hit ? hit.object.userData : null;
    if (this.mode === "asm") this.resaltar(ud?.parte || null);
    this.onSelect?.(ud);
  }

  autoRotar(v) { this.controls.autoRotate = v; }
  captura() { return this.renderer.domElement.toDataURL("image/png"); }
}

export { CAT };
