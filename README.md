# Gripper robótico de tres dedos UR5e V2.4

Diseño de detalle (puntos 3.1, 3.3 y 3.4): cálculos estáticos, cinemáticos y dinámicos del gripper de tres dedos para el UR5e, validados contra Working Model 2D.

- **Sitio web** (`index.html`, `css/`, `js/`, `assets/`): página estática con los resultados, las pruebas en Working Model y un simulador que replica los modelos de WM en el navegador. No necesita compilación; se despliega en Vercel como sitio estático.
- **Informe LaTeX** (`latex/`): `informe_gripper_v24.tex` con sus tablas y figuras, y el PDF compilado. Compilar con `pdflatex informe_gripper_v24.tex` (tres pasadas).

## Ver en local

```bash
python -m http.server 5173
```

y abrir http://localhost:5173 (los módulos JS no cargan con `file://`).

Universidad EAFIT · Entrega Final
