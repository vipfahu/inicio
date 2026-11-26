clasp no está instalado como comando: toda instrucción a la persona debe ser `npx -y @google/clasp@<versión de desplegar.js> login`, nunca `clasp login`.

- **Qué pasó (2026-11-26):** `actualizar.command` falló con `invalid_grant` (sesión de clasp caducada). Indiqué `clasp login` y el
  Terminal respondió `command not found: clasp`: `desplegar.js` invoca clasp por `npx` (constante `CLASP`), no hay instalación global.
- **Regla:** antes de dictar un comando, mirar cómo lo invoca el propio repositorio. `desplegar.js` ahora imprime el comando exacto
  de inicio de sesión cuando falla un paso de clasp.
- **También:** la persona informó «terminó con ✔ Listo» cuando el Terminal decía «✖ Falló». Pedir la última línea literal del
  Terminal antes de diagnosticar el panel.
