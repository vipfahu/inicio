En Apps Script un `.gs` y un `.html` no pueden compartir nombre base; `clasp push` falla entero («A file with this name already exists»).

Tipo: técnico

Pasó con Solicitud.gs/Solicitud.html; se renombró a Formulario.gs y hay una prueba que lo impide. El simulador Node no lo detectaba por sí solo.

**Por qué importa:** Google rechaza la subida completa: no llega ningún archivo y el menú/panel quedan con código viejo.
