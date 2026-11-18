import { Visor, CAT } from "./viewer.js";


const COLOR = { pla: "#e6e3db", pla2: "#cccbc7", gear: "#f56b12", acople: "#2c2e33", tpu: "#1f1f21", steel: "#9ea3aa", magnet: "#c7c9cc", motor: "#414347", pcb: "#1a5c38" };
const $ = (s) => document.querySelector(s);
const stage = $("#stage"), info = $("#info"), plist = $("#plist");
let catalogo = [], seleccion = null, dedo = 0;

const visor = new Visor(stage, {
  onProgress: (p) => ($("#load-bar").style.width = `${Math.round(p * 100)}%`),
  onSelect: (ud) => elegir(ud?.parte || null),
});

function fichaInfo(parte) {
  const p = catalogo.find((c) => c.parte === parte);
  if (!parte || !p) {
    info.innerHTML = `<p class="k">Selección</p><h3>Gripper V31 completo</h3>
      <p style="color:var(--ink-2);font-size:14px;margin-top:8px">${visor.parts.length} componentes · ${catalogo.length} piezas distintas. Toca una pieza en el modelo o en la lista.</p>`;
    $("#btn-pieza").disabled = true;
    return;
  }
  const n = visor.parts.filter((m) => m.userData.parte === parte).length;
  info.innerHTML = `<p class="k">${CAT[p.cat] || p.cat}</p><h3>${p.nombre}</h3>
    <dl><dt>Cantidad</dt><dd>${n}</dd><dt>Envolvente</dt><dd>${p.dims.join(" × ")} mm</dd><dt>Archivo</dt><dd class="mono" style="font-size:12px">${p.parte}</dd></dl>
    <div class="actions"><button data-act="solo">Ver sola en 3D</button><button data-act="todo">Ver ensamble</button></div>`;
  $("#btn-pieza").disabled = false;
}

function elegir(parte) {
  seleccion = parte;
  if (visor.mode === "asm") visor.resaltar(parte);
  plist.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.parte === parte)));
  fichaInfo(parte);
}

info.addEventListener("click", (e) => {
  const a = e.target.closest("button")?.dataset.act;
  if (a === "solo") modo("pieza");
  if (a === "todo") modo("asm");
});

async function modo(m) {
  document.querySelectorAll("#seg-modo button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === m)));
  if (m === "pieza" && seleccion) {
    const p = catalogo.find((c) => c.parte === seleccion);
    await visor.pieza(`assets/3d/${p.slug}.glb`, { parte: p.parte, cat: p.cat });
    $("#exp").disabled = true;
  } else if (m === "asm" && visor.mode !== "asm") {
    await cargarEnsamble();
    elegir(seleccion);
  }
}

function lista() {
  const cuenta = {};
  visor.parts.forEach((m) => (cuenta[m.userData.parte] = (cuenta[m.userData.parte] || 0) + 1));
  const orden = ["pla", "acople", "pla2", "gear", "tpu", "motor", "pcb", "magnet", "steel"];
  plist.innerHTML = orden.map((cat) => {
    const ps = catalogo.filter((p) => p.cat === cat && cuenta[p.parte]);
    if (!ps.length) return "";
    return `<h5>${CAT[cat]}</h5>` + ps.map((p) => `<button data-parte="${p.parte}" aria-current="false"><span class="sw" style="background:${COLOR[cat]}"></span>${p.nombre}<span class="q">×${cuenta[p.parte]}</span></button>`).join("");
  }).join("");
}
plist.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-parte]");
  if (!b) return;
  const p = b.dataset.parte === seleccion ? null : b.dataset.parte;
  if (visor.mode !== "asm") { seleccion = p; modo("pieza"); plist.querySelectorAll("button").forEach((x) => x.setAttribute("aria-current", String(x.dataset.parte === p))); fichaInfo(p); return; }
  elegir(p);
});

async function cargarEnsamble() {
  $("#loading").classList.remove("done");
  await visor.ensamble("assets/3d/gripper_v31.glb");
  $("#loading").classList.add("done");
  $("#exp").disabled = false; $("#exp").value = 0;
  visor.setHardware($("#btn-hw").getAttribute("aria-pressed") === "true");
  aplicarDedo();
}

function aplicarDedo() {
  const hw = $("#btn-hw").getAttribute("aria-pressed") === "true";
  visor.filtro((u) => (dedo === 0 || u.dedo === dedo) && (hw || !["steel", "magnet"].includes(u.cat)));
}

// Controles
document.querySelectorAll("#seg-modo button").forEach((b) => b.addEventListener("click", () => modo(b.dataset.modo)));
document.querySelectorAll("[data-vista]").forEach((b) => b.addEventListener("click", () => visor.vista(b.dataset.vista)));
$("#exp").addEventListener("input", (e) => visor.setExplode(+e.target.value));
$("#btn-hw").addEventListener("click", (e) => {
  const v = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(v)); aplicarDedo();
});
$("#btn-rot").addEventListener("click", (e) => {
  const v = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(v)); visor.autoRotar(v);
});
document.querySelectorAll("[data-dedo]").forEach((b) => b.addEventListener("click", () => {
  dedo = +b.dataset.dedo;
  document.querySelectorAll("[data-dedo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  if (visor.mode === "asm") aplicarDedo();
}));

// Carga diferida: el ensamble se descarga cuando el visor se acerca a la pantalla
let iniciado = false;
const arrancar = async () => {
  if (iniciado) return; iniciado = true;
  catalogo = await (await fetch("assets/3d/piezas.json")).json();
  await cargarEnsamble();
  visor.autoRotar(true);
  lista(); fichaInfo(null);
};
new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); arrancar(); } }, { rootMargin: "600px" }).observe(stage);
addEventListener("load", () => setTimeout(arrancar, 2500)); // respaldo si el observador no se dispara
window.__visor = visor;
