# El movimiento del panel sirve para no perder el lugar y ver qué cambió; nada de animaciones entre pantallas

**Contexto (2026-10-28).** La persona pidió revisar el «movimiento» de la app (la skill «transitions» que mencionó no existe en la
sesión ni en su cuenta). Hallazgo: cero transiciones, y tras cada acción la ficha se recargaba con pantalla intermedia y volvía arriba.

**Decisiones.** Redibujar en el sitio conservando el desplazamiento; resaltar estado, bitácora y archivos nuevos; entradas cortas de
diálogos y avisos; hover de 120 ms; `prefers-reduced-motion` deja solo opacidad y color. Descartadas: transiciones entre vistas y
esqueletos animados (Apps Script tarda 1–2 s y la animación alarga la espera percibida).

**Regla.** Movimiento solo cuando informa (continuidad o cambio); siempre con variante para reducir movimiento.
