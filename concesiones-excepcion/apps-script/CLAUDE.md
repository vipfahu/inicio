# Plataforma CAE (Apps Script) · contexto para Claude Code

Plataforma de Concesiones Académicas de Excepción del Vicedecanato de Investigación y Postgrado FAHU (USACH): Google Apps Script
vinculado a la planilla de respuestas, propiedad de la cuenta institucional. Leer `README.md` (diseño) y `ACTIVACION.md` (operación)
antes de cambiar algo.

**Memoria del proyecto:** `memoria/README.md` (índice; una lección por archivo). Leerla al iniciar la sesión. Al aprender algo
nuevo (una corrección o un enfoque confirmado), agregar o actualizar la nota correspondiente; borrar las que resulten erróneas.

## Reglas
- El repositorio es **público**: nunca escribir datos personales, folios reales con nombres, correos de estudiantes ni contenido de
  la planilla (que incluye datos de salud). Las pruebas usan solo datos sintéticos.
- No cambiar permisos de compartición de la planilla ni de la carpeta «Plataforma CAE · NO COMPARTIR» sin pedirlo explícitamente.
- No guardar credenciales en el repositorio. `.clasp.json` y `.despliegue.json` son locales (están en `.gitignore`).
- Trabajar en la rama `claude/github-claude-app-setup-hztxq1`; no abrir PR salvo que se pida.
- Funciones terminadas en `_` son privadas; toda `api_*` debe empezar con `requiere_(nivel)`, `soloSistema_()` o `soloDuenia_()`.
- Un `.gs` y un `.html` no pueden compartir nombre (lo verifica una prueba).

## Comandos
- Pruebas: `node --test tests/*.test.js` (lógica pura + simulador de Apps Script).
- Subir y publicar en la misma URL: `node desplegar.js` (corre las pruebas antes; pide confirmación de cada comando a la persona).
- La planilla se actualiza sola en la primera visita tras publicar (`actualizarSiCorresponde_` en `Instalar.gs`).

## Flujo vigente (resumen)
Recibida → revisión de admisibilidad → admisible para análisis (id `aceptada`) / rechazada / no procede → informe RC → programa (solicitado vía STD; solo se registra,
sin correo) → V°B° a la respuesta del Comité (o devolución vía STD con observación) → resolución → resuelto / negado. Una versión con autorización de inicio
y decisión exclusiva del Vicedecano/a se probó y se revirtió a pedido (ver `memoria/flujo-cae-vigente.md`).
