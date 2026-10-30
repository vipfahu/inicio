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
- Trabajar directamente en `main` (pedido de la persona, 2026-10-09): commits y push a `main`; no abrir PR salvo que se pida.
  La rama `claude/github-claude-app-setup-hztxq1` quedó solo como historial.
- Funciones terminadas en `_` son privadas; toda `api_*` debe empezar con `requiere_(nivel)`, `soloSistema_()` o `soloDuenia_()`.
- Un `.gs` y un `.html` no pueden compartir nombre (lo verifica una prueba).
- Acceso a la planilla solo por `Datos.gs`: `leer_` cachea cada hoja durante la ejecución; `anexar_`, `actualizar_` y `borrarFilas_`
  invalidan. Nunca `deleteRow` ni `setValue` directos sobre una pestaña de `HOJAS` (si no hay alternativa, llamar
  `invalidarLecturas_(hoja)` después). Al escribir en «Solicitudes» pasar el folio esperado como cuarto argumento de `actualizar_`.
  Toda escritura que dependa de números de fila o de folios correlativos va dentro de `conCerrojo_` o de un cerrojo propio.

## Comandos
- Pruebas: `node --test tests/*.test.js` (lógica pura + simulador de Apps Script).
- Subir y publicar en la misma URL: `node desplegar.js` (corre las pruebas antes; pide confirmación de cada comando a la persona).
- La planilla se actualiza sola en la primera visita tras publicar (`actualizarSiCorresponde_` en `Instalar.gs`).

## Flujo vigente (resumen)
Recibida → revisión de admisibilidad → admisible para análisis (id `aceptada`) / rechazada / no procede → informe RC → programa (solicitado vía STD; solo se registra,
sin correo; rechazada y no procede siguen disponibles en estos tres pasos, antes del V°B°; desde la revisión y estos tres pasos, el
rechazo puede proponerse al Vicedecano/a para su V°B°: estado `vb_rechazo`, que rechaza o devuelve al paso de origen) → V°B° a la respuesta del Comité (exclusivo del Vicedecano/a, o analista con «aprueba por otro medio»): CAE admisible (→ notificar a Registro Curricular → RC notificado → correo al estudiante) / CAE rechazada (ambas a Registro Curricular vía STD, que numera y distribuye la
resolución; correo al estudiante con el estado) / devolución vía STD → proyecto de resolución enviado a Decanato para firma (fecha y N° STD obligatorios; ids `firma_decanato` /
`rechazo_firma_decanato`; sin correo) → resolución recibida de RC (N° y fecha obligatorios; ids `res_recibida` / `res_rechazo_recibida`) → resuelto / negado (sin correo). Cada V°B° avisa por correo automático (`vb_dado`) a la analista del caso. Una versión con autorización de inicio
del Vicedecano/a se probó y se revirtió a pedido; la exclusividad en el V°B° volvió el 2026-10-09 con la válvula «otro medio» (ver `memoria/vb-exclusivo-con-otro-medio.md`).
