// Comportamiento común de todas las páginas: aparición, menú móvil, tablas en celular y panel de piezas.
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { rootMargin: "0px 0px -8% 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Menú desplegable en celular
const nav = document.querySelector(".nav"), btn = document.querySelector(".menu-btn");
btn?.addEventListener("click", () => {
  const open = !nav.classList.contains("open");
  nav.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("no-scroll", open);
});
nav?.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); document.body.classList.remove("no-scroll"); }));

// Tablas: cada celda recibe la etiqueta de su columna para mostrarse como filas en celular
document.querySelectorAll(".tbl table").forEach((t) => {
  const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
  if (!heads.length) return;
  t.classList.add("stack");
  t.querySelectorAll("tbody tr, tfoot tr").forEach((tr) => [...tr.children].forEach((td, i) => td.setAttribute("data-label", heads[i] || "")));
});

// Panel de piezas del visor (celular)
const side = document.getElementById("side");
document.getElementById("parts-btn")?.addEventListener("click", () => side.classList.add("open"));
side?.querySelector(".sheet-close")?.addEventListener("click", () => side.classList.remove("open"));
