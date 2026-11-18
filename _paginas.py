"""Genera el sitio por páginas a partir de la versión de una sola página (_fuente_una_pagina.html).

Páginas: index (visor 3D primero), proyecto, mecanica, electronica, robot, documentos.
"""
import re, os

H = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(H, "_fuente_una_pagina.html"), encoding="utf-8").read()


def bloque(nombre):
    m = re.search(r"<!-- =+ " + re.escape(nombre) + r" =+ -->\s*(.*?)(?=\n<!-- =+ |\n<footer)", src, re.S)
    assert m, nombre
    return m.group(1).strip()


def limpiar(html):
    html = re.sub(r'<p class="eyebrow"><b>\d\d</b> ', '<p class="eyebrow"><b>●</b> ', html)
    return html


head = src[:src.index("<body")]
head = re.sub(r"<title>.*?</title>", "<title>{titulo}</title>", head)

PAGS = [
    ("index.html", "Inicio"),
    ("proyecto.html", "Proyecto"),
    ("mecanica.html", "Mecánica"),
    ("electronica.html", "Electrónica y control"),
    ("robot.html", "En el UR5e"),
    ("documentos.html", "Documentos"),
]


def nav(actual):
    links = "".join(f'<a href="{f}"{" class=\"on\" aria-current=\"page\"" if f == actual else ""}>{t}</a>' for f, t in PAGS)
    return f'''<nav class="nav">
  <div class="wrap">
    <a class="brand" href="index.html"><span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M7 3v8a5 5 0 0 0 10 0V3M12 16v5M7 7h3M14 7h3"/></svg></span>Gripper UR5e</a>
    <div class="nav-links">{links}</div>
    <a class="nav-cta" href="index.html#visor">Ver en 3D</a>
  </div>
</nav>'''


def siguiente(actual):
    i = [f for f, _ in PAGS].index(actual)
    if i + 1 >= len(PAGS):
        return ""
    f, t = PAGS[i + 1]
    return f'''<section class="next"><div class="wrap"><a href="{f}"><span class="eyebrow">Siguiente</span><span class="t">{t} →</span></a></div></section>'''


foot = '<footer class="foot"><div class="wrap"><span>Gripper de 3 dedos para el UR5e · Universidad EAFIT · 2026 · Grupo 1</span><span class="mono">CAD V31 · SolidWorks → glTF</span></div></footer>'


def page_head(eyebrow, titulo, lead):
    return f'''<header class="page-head"><div class="wrap">
  <p class="eyebrow"><b>●</b> {eyebrow}</p>
  <h1>{titulo}</h1>
  <p class="lead">{lead}</p>
</div></header>'''


def escribir(archivo, titulo_doc, cuerpo, scripts):
    html = head.replace("{titulo}", titulo_doc) + f'<body>\n\n{nav(archivo)}\n\n<main>\n{cuerpo}\n</main>\n\n{siguiente(archivo)}\n{foot}\n\n{scripts}\n</body>\n</html>\n'
    open(os.path.join(H, archivo), "w", encoding="utf-8").write(html)
    print(archivo, len(html))


REV = '<script src="js/reveal.js" defer></script>'

# ---------- Inicio: visor primero ----------
visor = bloque("VISOR 3D")
visor = visor.replace('<section class="sec viewer-sec" id="visor">', '<section class="viewer-sec viewer-first" id="visor">')
visor = re.sub(r'<div class="sec-head">.*?</p>\s*</div>', '''<div class="home-head">
      <div><p class="eyebrow"><b>●</b> Universidad EAFIT · 2026 · Grupo 1</p><h1>Gripper de 3 dedos para el <em>UR5e</em></h1></div>
      <p class="lead">Explora el ensamble V31 exportado del CAD: gira, acerca, separa las piezas y toca cualquiera para saber qué es.</p>
    </div>''', visor, count=1, flags=re.S)
hero = bloque("HERO")
stats = re.search(r'<div class="stats">.*?</div>\s*</div>\s*(?=</div>)', hero, re.S).group(0)
explora = '''<section class="sec explore">
  <div class="wrap">
    <div class="sec-head"><div><p class="eyebrow"><b>●</b> Explora el proyecto</p><h2>Todo el gripper, por partes.</h2></div>
      <p class="lead">Mueve tres dedos, mide la fuerza de agarre y se comunica con el robot usando solo los 24 V del puerto de herramienta del UR5e.</p></div>
    <div class="cards6">
      <a class="card lnk reveal" href="proyecto.html"><span class="k">01</span><h3>Proyecto</h3><p>El reto, el alcance, la arquitectura del sistema y el proceso de diseño.</p><p class="go">Ver →</p></a>
      <a class="card lnk reveal" href="mecanica.html"><span class="k">02</span><h3>Mecánica</h3><p>Cómo cierran los dedos, por qué sostiene sin energía y cómo se imprimió.</p><p class="go">Ver →</p></a>
      <a class="card lnk reveal" href="electronica.html"><span class="k">03</span><h3>Electrónica y control</h3><p>Las dos tarjetas, los sensores y el programa del ESP32-S3.</p><p class="go">Ver →</p></a>
      <a class="card lnk reveal" href="robot.html"><span class="k">04</span><h3>En el UR5e</h3><p>Cómo se monta en el robot y qué toma de su puerto de herramienta.</p><p class="go">Ver →</p></a>
      <a class="card lnk reveal" href="documentos.html"><span class="k">05</span><h3>Documentos</h3><p>Cálculos, validación en Working Model, informe y equipo.</p><p class="go">Ver →</p></a>
      <a class="card lnk reveal hero-card" href="proyecto.html"><img src="assets/img/hero_v31.webp" alt="Render del gripper V31" loading="lazy"></a>
    </div>
  </div>
</section>'''
escribir("index.html", "Gripper de 3 dedos para el UR5e · EAFIT",
         limpiar(visor) + f'\n<section class="sec stats-sec"><div class="wrap">{stats}</div></section>\n' + explora,
         REV + '\n<script type="module" src="js/site.js"></script>')

# ---------- Proyecto ----------
escribir("proyecto.html", "Proyecto · Gripper UR5e",
         page_head("Proyecto", "El reto y la arquitectura.", "Qué se pidió, qué se construyó y cómo se organizan sus partes.")
         + "\n" + limpiar(bloque("RETO")) + "\n" + limpiar(bloque("ARQUITECTURA")) + "\n" + limpiar(bloque("EQUIPO")), REV)

# ---------- Mecánica ----------
escribir("mecanica.html", "Mecánica · Gripper UR5e",
         page_head("Mecánica", "Mecanismo y fabricación.", "Transmisiones autobloqueantes, yemas intercambiables e impresión 3D en una Bambu Lab A1 mini.")
         + "\n" + limpiar(bloque("MECÁNICA")) + "\n" + limpiar(bloque("MANUFACTURA")), REV)

# ---------- Electrónica y control ----------
escribir("electronica.html", "Electrónica y control · Gripper UR5e",
         page_head("Electrónica y control", "Dos tarjetas y un programa.", "Distribución de potencia, sensores, enlace con el servo y el firmware del ESP32-S3.")
         + "\n" + limpiar(bloque("ELECTRÓNICA")) + "\n" + limpiar(bloque("SOFTWARE")), REV)

# ---------- En el UR5e ----------
escribir("robot.html", "En el UR5e · Gripper UR5e",
         page_head("En el UR5e", "Se monta en la brida del robot.", "La energía y los datos salen del conector de herramienta: no necesita cables externos.")
         + "\n" + limpiar(bloque("UR5e")), REV)

# ---------- Documentos ----------
escribir("documentos.html", "Documentos · Gripper UR5e",
         page_head("Documentos", "Cálculos, validación e informes.", "El análisis de ingeniería detrás del diseño, con sus documentos descargables.")
         + "\n" + limpiar(bloque("ANÁLISIS")), REV)
