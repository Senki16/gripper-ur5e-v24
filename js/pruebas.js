// Selector de pruebas de Working Model: cambia la captura y la tabla de resultados.
(() => {
  const D = {
    pinch: { name: "Pinch", cap: "Pinch con contacto en la punta (T): A se opone a B, C libre. Motor central 1.028 N·m.", sh: ["50 %", "50 %", "0 %"],
      N: [39.24, 39.24, 0], mcp: [3.698, 3.698, 0.005], pip: [1.510, 1.510, 0.001], T: [0.629, 0.629, 0.000] },
    power120: { name: "Power 120°", cap: "Power con contacto en D y los tres dedos a 120°: reparto igual. Motor central 0.863 N·m.", sh: ["33.3 %", "33.3 %", "33.3 %"],
      N: [26.16, 26.16, 26.16], mcp: [2.072, 2.072, 2.072], pip: [0.611, 0.611, 0.611], T: [0.255, 0.255, 0.255] },
    plano: { name: "Power plano", cap: "Power con la disposición real del plano V2.4: A opuesto a B y C, N_A = N_B + N_C. Motor central 0.863 N·m.", sh: ["50 %", "25 %", "25 %"],
      N: [39.24, 19.62, 19.62], mcp: [3.105, 1.555, 1.555], pip: [0.917, 0.459, 0.459], T: [0.382, 0.191, 0.191] },
    desigual: { name: "Desigual", cap: "Carga desigual 40/35/25 % con contacto en T. Motor central 1.028 N·m.", sh: ["40 %", "35 %", "25 %"],
      N: [31.39, 27.47, 19.62], mcp: [2.960, 2.590, 1.852], pip: [1.208, 1.057, 0.756], T: [0.503, 0.441, 0.315] },
  };
  const img = document.getElementById("test-img"), cap = document.getElementById("test-cap");
  const body = document.querySelector("#test-tbl tbody"), tabs = document.querySelectorAll(".seg button");
  const row = (l, v, u, d = 3) => `<tr><td>${l}</td>${v.map((x) => `<td>${typeof x === "string" ? x : x.toFixed(d) + " " + u}</td>`).join("")}</tr>`;
  function show(k) {
    const c = D[k];
    img.src = `assets/img/wm_${k}.webp`; img.alt = `Working Model 2D, prueba ${c.name}`; cap.textContent = c.cap;
    body.innerHTML = row("Reparto de carga", c.sh) + row("Fuerza normal N", c.N, "N", 2) + row("τMCP", c.mcp, "N·m") + row("τPIP", c.pip, "N·m") + row("Motor N20", c.T, "N·m");
    tabs.forEach((b) => { const on = b.dataset.k === k; b.setAttribute("aria-selected", on); b.classList.toggle("on", on); });
  }
  tabs.forEach((b) => b.addEventListener("click", () => show(b.dataset.k)));
  Object.keys(D).forEach((k) => { const i = new Image(); i.src = `assets/img/wm_${k}.webp`; });
  show("pinch");
})();
