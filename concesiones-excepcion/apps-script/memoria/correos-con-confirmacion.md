Ningún correo sale por editar una celda: cambio de estado = vista previa editable; el estado solo cambia si el envío funciona; si falta el destinatario principal o una variable, no se envía; si falta uno en copia (p. ej. correo de dirección del programa), sale igual con aviso (pedido de la persona: que el estudiante no quede sin notificar).

Tipo: diseño

Automáticos solo: recepción, aviso al equipo, asignación y recordatorios: admisibilidad (interno) (caso «Recibida»: primer aviso al día hábil siguiente a la recepción, plazo de 2 días hábiles; a la analista o, sin ella, a quienes pueden asignar) y plazo del programa vencido (2 días hábiles desde el registro vía STD): a la dirección de programa con copia a la analista, pidiendo responder por el STD. Si falla un automático: aviso a analista, administración e institucional, y fila en Bitácora.

Correo del estudiante (pedidos sucesivos de la persona): primero se pidió enviar a la cuenta de sesión y a la escrita; luego se cambió
la definición: el campo «correo» del formulario se llena con la cuenta de sesión, es de solo lectura y el servidor la impone
(`api_enviarSolicitud`). La resolución de destinatarios sigue uniendo `correo_verificado` y `correo` sin repetir, para casos migrados.

Desde 2026-10-13 la vista previa permite «No enviar notificación» (pedido de la persona): el estado cambia sin correo y la bitácora
registra quién lo decidió y el motivo opcional; los campos obligatorios del paso se siguen exigiendo.

**Por qué importa:** Control humano sobre lo que llega a estudiantes.
