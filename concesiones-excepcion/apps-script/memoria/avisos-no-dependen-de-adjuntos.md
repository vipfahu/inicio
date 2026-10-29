# Registrada una solicitud, nada posterior puede impedir sus avisos: los fallos van a la bitácora

**Reporte (2026-10-29).** «Se registró una solicitud nueva y no recibí el aviso.» Revisión: los avisos se enviaban al final de
`api_enviarSolicitud`, después de mover los adjuntos. Un fallo de Drive en ese paso dejaba la solicitud registrada, cero correos, sin
rastro en la bitácora y con un error en pantalla para el estudiante (que tendería a reenviarla). Reproducido en el simulador.

**Corrección.** Pasos posteriores al registro en try/catch por archivo (`errorTrasRegistro_` anota en la bitácora); los avisos siempre
salen; el adjunto no movido queda en Temporal con la marca `PENDIENTE_EXPEDIENTE`, que `limpiarTemporales_` respeta. Igual en
`alRecibirFormulario`.

**Regla.** Tras un registro irreversible, todo paso secundario es tolerante a fallos y deja constancia; las notificaciones no dependen de él.
No se pudo confirmar desde la sesión que esta fuera la causa del caso real: la bitácora del folio lo dice.
