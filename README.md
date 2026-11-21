# Gripper de tres dedos para el UR5e · V31

Proyecto de la línea de énfasis (DIST) de la Universidad EAFIT, Grupo 1, 2026. Es un gripper de tres dedos impreso en 3D para el brazo colaborativo UR5e. Mide la fuerza de agarre y se comunica con el robot usando solo los 24 V del puerto de herramienta.

- **Página web:** https://gripper-ur5e-v24.vercel.app
- **Documentos de todas las entregas:** [gripper-ur5e-v24.vercel.app/documentos.html](https://gripper-ur5e-v24.vercel.app/documentos.html#entregas)
- **Monitor de telemetría en vivo:** https://grafana-gripper.dis.eafit.edu.co/

<p align="center"><img src="assets/img/hero_v31.webp" width="720" alt="Render del gripper de tres dedos V31"></p>
<p align="center"><sub>Render generado con IA a partir del ensamble CAD V31.</sub></p>

## El diseño final (V31)

| | |
|---|---|
| **Mecánica** | Dos dedos lado a lado y uno opuesto. Un servo Dynamixel AX-18A cierra los tres dedos a la vez en el MCP: mueve un piñón 21T que engrana con tres piñones 28T con sinfín. En cada dedo, un motor Pololu 1595 mueve la falange distal (PIP) con un sinfín y una corona 14T. Los sinfines son autobloqueantes, así que el gripper sostiene la pieza sin gastar energía. |
| **Yemas** | TPU 95A con sensor de fuerza FSR. Se sujetan con imanes N52, así que se cambian rápido. |
| **Electrónica** | Dos tarjetas de una sola cara. La PCB1 de potencia recibe 24 V y los reparte en ramas protegidas con fusible: 12 V para el servo, 6 V para los motores y 5 V para la lógica. La PCB2 de control lleva el ESP32-S3, los drivers TC1508A, el enlace RS-485 con el UR5e y el bus Dynamixel a 1 Mbps. |
| **Firmware** | Responde a órdenes de una línea (`OPEN n`, `CLOSE n`, `STOP`, `GET n`, `PING`). Si en 500 ms no llega una orden válida, detiene todo. |
| **Telemetría** | Cada 500 ms, y con cada orden, el ESP32 envía un JSON por HTTPS a un servidor de la universidad. Node-RED lo valida, InfluxDB lo guarda y Grafana lo muestra, junto con una interfaz (HMI) propia del equipo. |
| **Fabricación** | Impreso en una Bambu Lab A1 mini en unas 20 h 30 min, con 430 g de PLA, 16 g de TPU y 24 imanes. |

<table>
<tr>
<td align="center"><img src="assets/img/v31_iso.png" width="250"><br><sub>Ensamble CAD V31</sub></td>
<td align="center"><img src="assets/img/v31_explosionado.png" width="250"><br><sub>Vista explosionada</sub></td>
<td align="center"><img src="assets/img/montaje/montaje_frontal.webp" width="250"><br><sub>Prototipo montado</sub></td>
</tr>
</table>

## La página web

Es un sitio estático de seis páginas, que también funciona en el celular.

| Página | Qué tiene |
|---|---|
| **Inicio** | Visor 3D del ensamble V31 (126 componentes) exportado del CAD: se gira, se separan las piezas con la vista explosionada y se toca cada pieza para ver qué es. |
| **Proyecto** | El reto, el objetivo y la arquitectura del sistema. |
| **Mecánica** | Cómo cierran los dedos, la tabla de impresión por placas y una galería del prototipo con fotos y videos de la impresión, el ensamble y las pruebas. |
| **Electrónica y control** | Las dos tarjetas, el programa del ESP32-S3 y el monitor de telemetría con su arquitectura, el tablero y el enlace al monitor en vivo. |
| **En el UR5e** | Simulación del gripper montado en un UR5e tomando y dejando una pieza, más los datos de la brida y del puerto de herramienta. |
| **Documentos** | Todas las entregas del proyecto en PDF y el análisis de ingeniería de la versión V2.4. |

### Inicio

<table>
<tr>
<td align="center"><img src="docs/img/web_v31/01_inicio_visor3d.jpg" width="420"><br><sub>Visor 3D del ensamble</sub></td>
<td align="center"><img src="docs/img/web_v31/02_inicio_explora.jpg" width="420"><br><sub>Cifras y secciones</sub></td>
</tr>
</table>

### Proyecto

<table>
<tr>
<td align="center"><img src="docs/img/web_v31/03_proyecto_reto.jpg" width="420"><br><sub>El reto y el objetivo</sub></td>
<td align="center"><img src="docs/img/web_v31/04_proyecto_arquitectura.jpg" width="420"><br><sub>Arquitectura del sistema</sub></td>
</tr>
</table>

### Mecánica

<table>
<tr>
<td align="center"><img src="docs/img/web_v31/05_mecanica_diseno.jpg" width="420"><br><sub>Diseño mecánico</sub></td>
<td align="center"><img src="docs/img/web_v31/06_mecanica_manufactura.jpg" width="420"><br><sub>Impresión en la A1 mini</sub></td>
</tr>
<tr>
<td align="center" colspan="2"><img src="docs/img/web_v31/07_mecanica_galeria.jpg" width="640"><br><sub>Galería del prototipo: impresión, ensamble y pruebas</sub></td>
</tr>
</table>

### Electrónica y control

<table>
<tr>
<td align="center"><img src="docs/img/web_v31/08_electronica.jpg" width="420"><br><sub>Distribución de potencia y tarjetas</sub></td>
<td align="center"><img src="docs/img/web_v31/09_software.jpg" width="420"><br><sub>Órdenes del firmware</sub></td>
</tr>
<tr>
<td align="center" colspan="2"><img src="docs/img/web_v31/10_monitor_telemetria.jpg" width="640"><br><sub>Monitor de telemetría</sub></td>
</tr>
</table>

### En el UR5e: simulación

El brazo toma un cilindro de 36 mm en A, lo lleva a B y lo devuelve. Los ángulos del UR5e salen de su cinemática (parámetros DH e inversa) y el gripper es el modelo CAD V31. Primero el servo cierra los tres dedos en el MCP y después cada motor cierra su falange distal, hasta que las yemas tocan la pieza. El panel muestra las órdenes RS-485 que envía el robot (`CLOSE 4`, `CLOSE 1`…) y los ángulos de cada articulación.

<table>
<tr>
<td align="center"><img src="docs/img/web_v31/11_simulacion_ur5e.jpg" width="420"><br><sub>Simulación en el UR5e</sub></td>
<td align="center"><img src="docs/img/web_v31/12_interfaz_ur5e.jpg" width="420"><br><sub>Montaje en la brida del robot</sub></td>
</tr>
</table>

### Documentos y celular

<table>
<tr>
<td align="center"><img src="docs/img/web_v31/13_documentos.jpg" width="420"><br><sub>Entregas del proyecto</sub></td>
<td align="center"><img src="docs/img/web_v31/14_analisis_v24.jpg" width="420"><br><sub>Análisis de ingeniería V2.4</sub></td>
</tr>
<tr>
<td align="center" colspan="2"><img src="docs/img/web_v31/15_movil.jpg" width="640"><br><sub>Vista en el celular</sub></td>
</tr>
</table>

## Entregas

Todos los PDF están en [`assets/entregas/`](assets/entregas) y en la página de Documentos.

| Entrega | Documentos |
|---|---|
| **Entrega final** | Informe de la entrega final · Planos de fabricación (15 hojas A3) · Presentación final · Brochure · Guía del monitor de telemetría · Informe compilado de todas las entregas |
| **Avance 3** | Presentación de diseño de detalle · Presentación del prototipo alfa · Informe técnico electrónico · Informe técnico informático · Guía de Working Model 2D |
| **Avance 2** | Presentación de diseño conceptual · Cronograma |
| **Avance 1** | Informe (brief, PDS y QFD) · Presentación · Especificaciones de diseño |

## Análisis de ingeniería (Avance 3, versión V2.4)

La página [`analisis.html`](https://gripper-ur5e-v24.vercel.app/analisis.html) conserva los cálculos estáticos, cinemáticos y dinámicos de la versión V2.4 y un simulador tipo Working Model. Los cálculos se validaron contra Working Model 2D, con un error máximo de 0,034 % en 180 configuraciones. El informe está en [latex/informe_gripper_v24.pdf](latex/informe_gripper_v24.pdf) y los modelos `.wm2d` en [`working_model/`](working_model).

| Caso | Energía por ciclo | Potencia media | N20 típico (298:1) |
|---|---:|---:|---|
| Power 1 kg | 6,4 J | 0,77 W | ✅ Continuo |
| Power 4 kg | 34,4 J | 4,14 W | ⚠️ Solo picos cortos |
| Pinch 1 kg | 13,5 J | 1,62 W | ✅ Continuo |
| Pinch 4 kg | 128 J | 15,45 W | ❌ No viable: necesita 0,444 N·m, por encima de su par de bloqueo de 0,39 N·m |

<table>
<tr>
<td align="center"><img src="docs/img/working_model/modelo_estatico.jpg" width="400"><br><sub>Modelo estático en Working Model 2D</sub></td>
<td align="center"><img src="docs/img/web/07_simulador.jpg" width="400"><br><sub>Simulador de la página</sub></td>
</tr>
</table>

## Contenido del repositorio

| Ruta | Contenido |
|---|---|
| `index.html`, `proyecto.html`, `mecanica.html`, `electronica.html`, `robot.html`, `documentos.html` | Páginas del sitio V31 (estático, sin compilación; se despliega en Vercel). |
| `analisis.html` | Análisis de ingeniería de la V2.4 con el simulador. |
| `css/site.css` · `css/styles.css` | Estilos del sitio V31 y de la página de análisis. |
| `js/viewer.js`, `js/site.js` | Visor 3D del ensamble (three.js). |
| `js/ur5e_sim.js` | Simulación del gripper en el UR5e. |
| `js/sim.js`, `js/model.js` | Simulador y modelo analítico de la V2.4. |
| `assets/3d/` | Modelos 3D en `.glb` (glTF binario): el ensamble `gripper_v31.glb` y cada pieza por separado. |
| `assets/entregas/` | PDF de todas las entregas. |
| `assets/img/` | Imágenes del sitio, incluidas las fotos y videos del prototipo (`montaje/`) y del monitor (`monitor/`). |
| `latex/` | Informe LaTeX de la V2.4 y su PDF. Se compila con `pdflatex` (tres pasadas). |
| `working_model/` | Modelos de Working Model 2D (`.wm2d`). |
| `docs/img/` | Imágenes de este README. |

## Ver la web en local

```bash
python -m http.server 5173
```

Luego abre http://localhost:5173. Hace falta un servidor porque los módulos de JavaScript no cargan con `file://`.

Universidad EAFIT · Grupo 1 · 2026
