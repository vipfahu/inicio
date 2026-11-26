Los correos de resolución al estudiante (admisible, rechazada, no procede, CAE admisible, CAE rechazada) llevan copia a la analista asignada; la confirmación de recepción no.

Tipo: decisión de la persona (2026-11-26)

- Antes la analista solo figuraba como dirección de respuesta (`replyTo`) y no recibía lo enviado al estudiante; una analista preguntó si le llegaban copias.
- Se resolvió en las plantillas (`cc` = «Analista» en `PLANTILLAS_INICIALES`), no con `recibe_eventos` de la cuenta: esa casilla copia por todos los casos del programa, no solo los asignados.
- `aplicarActualizacion_` actualiza `para` y `cc` de las plantillas instaladas aunque el equipo haya editado su texto; no hace falta paso manual.
- Sin analista asignada, la copia se omite y la vista previa lo avisa («Se enviará sin copia a: analista asignada/o»); no bloquea.

- **Corrección (2026-11-26, mismo día):** la persona pidió quitar la copia de la confirmación de recepción y que las analistas reciban «Nueva solicitud». Ya lo recibían: `nueva_solicitud` va a «Equipo» (toda cuenta activa con acceso al panel). No se añadió «Analista» en copia a ese aviso: sería redundante y, sin analista asignada, sumaría un «omitido» en cada solicitud.

**Por qué importa:** un correo nuevo de resolución al estudiante debe llevar «Analista» en copia; antes de agregar un destinatario, revisar si ya lo recibe por otro rol.
