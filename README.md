# Gripper robótico de tres dedos UR5e V2.4

Diseño de detalle (puntos 3.1, 3.3 y 3.4): cálculos estáticos, cinemáticos y dinámicos del gripper de tres dedos para el UR5e, validados contra Working Model 2D.

**Página web:** https://gripper-ur5e-v24.vercel.app · **Informe PDF:** [latex/informe_gripper_v24.pdf](latex/informe_gripper_v24.pdf)

<p align="center"><img src="docs/img/render_gripper.jpg" width="820" alt="Render del gripper de tres dedos V2.4"></p>
<p align="center"><sub>Render generado con IA a partir del ensamble CAD.</sub></p>

## Resultado clave

| Caso | Energía por ciclo | Potencia media | N20 típico (298:1) |
|---|---:|---:|---|
| Power 1 kg | 6.4 J | 0.77 W | ✅ Continuo |
| Power 4 kg | 34.4 J | 4.14 W | ⚠️ Solo picos cortos |
| Pinch 1 kg | 13.5 J | 1.62 W | ✅ Continuo |
| Pinch 4 kg | 128 J | 15.45 W | ❌ No viable: necesita 0.444 N·m, por encima de su par de bloqueo de 0.39 N·m |

Ciclo de 8.3 s (cierre 1.5 s, apriete 0.3 s, retención 5 s, apertura 1.5 s) con motores típicos de catálogo. El cálculo analítico coincide con Working Model 2D con un error máximo de 0.034 % en 180 configuraciones.

## Modelo de SolidWorks

Vistas exportadas del ensamble `Gripper_V2_4_Tren_pasador.SLDASM`.

<table>
<tr>
<td align="center"><img src="docs/img/solidworks/ensamble_isometrica.jpg" width="260"><br><sub>Isométrica</sub></td>
<td align="center"><img src="docs/img/solidworks/ensamble_trimetrica.jpg" width="260"><br><sub>Trimétrica</sub></td>
<td align="center"><img src="docs/img/solidworks/ensamble_frontal.jpg" width="260"><br><sub>Frontal</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/img/solidworks/ensamble_lateral.jpg" width="260"><br><sub>Lateral</sub></td>
<td align="center"><img src="docs/img/solidworks/ensamble_superior.jpg" width="260"><br><sub>Superior</sub></td>
<td align="center"><img src="docs/img/solidworks/palma_isometrica.jpg" width="260"><br><sub>Palma (subensamble)</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/img/solidworks/falange_proximal_isometrica.jpg" width="260"><br><sub>Falange proximal</sub></td>
<td align="center"><img src="docs/img/solidworks/falange_distal_isometrica.jpg" width="260"><br><sub>Falange distal</sub></td>
<td align="center"><img src="docs/img/solidworks/rueda_z30_isometrica.jpg" width="200"> <img src="docs/img/solidworks/sinfin_B_isometrica.jpg" width="120"><br><sub>Rueda z30 y sinfín B</sub></td>
</tr>
</table>

## Working Model 2D

Los modelos están en [`working_model/`](working_model): `Gripper_V24_Estatica.wm2d` (estático, con controles y medidores) y `Gripper_V24_Agarre.wm2d` (agarre dinámico).

<table>
<tr>
<td align="center"><img src="docs/img/working_model/modelo_estatico.jpg" width="400"><br><sub>Modelo estático</sub></td>
<td align="center"><img src="docs/img/working_model/modelo_dinamico_agarre.jpg" width="400"><br><sub>Modelo dinámico sosteniendo 1 kg</sub></td>
</tr>
</table>

Pruebas en el modelo estático (4 kg, μ = 0.5, η = 0.6, θMCP = θPIP = 15°):

<table>
<tr>
<td align="center"><img src="docs/img/working_model/prueba_pinch.jpg" width="400"><br><sub><b>Pinch</b> · T<sub>c</sub> 1.028 N·m · N20 0.629 N·m</sub></td>
<td align="center"><img src="docs/img/working_model/prueba_power120.jpg" width="400"><br><sub><b>Power 120°</b> · T<sub>c</sub> 0.863 N·m · N20 0.255 N·m</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/img/working_model/prueba_plano.jpg" width="400"><br><sub><b>Power plano V2.4</b> · N<sub>A</sub> = N<sub>B</sub> + N<sub>C</sub></sub></td>
<td align="center"><img src="docs/img/working_model/prueba_desigual.jpg" width="400"><br><sub><b>Carga desigual 40/35/25</b> · T<sub>c</sub> 1.028 N·m</sub></td>
</tr>
</table>

## Diagramas de cálculo

<table>
<tr>
<td align="center"><img src="docs/img/diagramas/D6_vista_lateral_DCL.jpg" width="260"><br><sub>3.1 Vista lateral</sub></td>
<td align="center"><img src="docs/img/diagramas/D5_vista_superior.jpg" width="260"><br><sub>3.1 Vista superior</sub></td>
<td align="center"><img src="docs/img/diagramas/D7_vista_frontal_DCL.jpg" width="260"><br><sub>3.1 Vista frontal</sub></td>
</tr>
<tr>
<td align="center" colspan="3"><img src="docs/img/diagramas/D9_diagrama_cinematico.jpg" width="800"><br><sub>3.3 Diagrama cinemático del dedo</sub></td>
</tr>
<tr>
<td align="center" colspan="3"><img src="docs/img/diagramas/D10_DCL_dinamico.jpg" width="800"><br><sub>3.4 Diagrama de cuerpo libre dinámico</sub></td>
</tr>
</table>

## Página web

Capturas de https://gripper-ur5e-v24.vercel.app (1440 px de ancho).

<table>
<tr>
<td align="center"><img src="docs/img/web/01_inicio.jpg" width="400"><br><sub>Inicio</sub></td>
<td align="center"><img src="docs/img/web/02_arquitectura.jpg" width="400"><br><sub>Arquitectura</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/img/web/03_estatica.jpg" width="400"><br><sub>3.1 Estática</sub></td>
<td align="center"><img src="docs/img/web/04_cinematica.jpg" width="400"><br><sub>3.3 Cinemática</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/img/web/05_dinamica.jpg" width="400"><br><sub>3.4 Dinámica</sub></td>
<td align="center"><img src="docs/img/web/06_consumo.jpg" width="400"><br><sub>Consumo eléctrico</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/img/web/07_simulador.jpg" width="400"><br><sub>Simulador tipo Working Model</sub></td>
<td align="center"><img src="docs/img/web/08_pruebas_wm.jpg" width="400"><br><sub>Pruebas en Working Model</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/img/web/09_validacion.jpg" width="400"><br><sub>Validación</sub></td>
<td align="center"><img src="docs/img/web/10_graficas.jpg" width="400"><br><sub>Gráficas del barrido</sub></td>
</tr>
</table>

<p align="center"><img src="docs/img/web/11_movil.jpg" width="240" alt="Página en un teléfono"><br><sub>Vista en el teléfono</sub></p>

## Contenido del repositorio

| Ruta | Contenido |
|---|---|
| `index.html`, `css/`, `js/`, `assets/` | Sitio web estático (sin compilación); se despliega en Vercel. |
| `latex/` | Informe LaTeX (`informe_gripper_v24.tex`, `tablas/`, `figuras/`) y el PDF compilado. Compilar con `pdflatex` (tres pasadas). |
| `working_model/` | Modelos de Working Model 2D (`.wm2d`). |
| `docs/img/` | Imágenes de este README: SolidWorks, Working Model, diagramas y capturas de la web. |

## Ver la web en local

```bash
python -m http.server 5173
```

y abrir http://localhost:5173 (los módulos JS no cargan con `file://`).

Universidad EAFIT · Entrega Final
