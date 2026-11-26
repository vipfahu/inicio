Todo correo al estudiante (recepción, admisible, rechazada, no procede, CAE admisible, CAE rechazada) lleva copia a la analista asignada.

Tipo: decisión de la persona (2026-11-26)

- Antes la analista solo figuraba como dirección de respuesta (`replyTo`) y no recibía lo enviado al estudiante; una analista preguntó si le llegaban copias.
- Se resolvió en las plantillas (`cc` = «Analista» en `PLANTILLAS_INICIALES`), no con `recibe_eventos` de la cuenta: esa casilla copia por todos los casos del programa, no solo los asignados.
- `aplicarActualizacion_` actualiza `para` y `cc` de las plantillas instaladas aunque el equipo haya editado su texto; no hace falta paso manual.
- Sin analista asignada, la copia se omite y la vista previa lo avisa («Se enviará sin copia a: analista asignada/o»); no bloquea.

**Por qué importa:** si se agrega un correo nuevo al estudiante, debe llevar «Analista» en copia para mantener la regla.
