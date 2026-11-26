La actualización de la planilla se aplica desde el panel (botón «Aplicar actualización», administración); el menú de la planilla exige la cuenta institucional.

- **Qué pasó (2026-11-26):** tras «publicar» la copia a la analista, la plantilla «Recepción» no mostró el CC. Se sospechó un fallo
  silencioso de `actualizarSiCorresponde_`; la causa real fue que el despliegue había fallado con `invalid_grant` (sesión de clasp
  caducada) y se informó como «✔ Listo». Con el despliegue efectivo, la automática aplicó el cambio sola y el botón respondió
  «ya estaba al día». De paso, el menú *CAE → Actualizar* ejecutado con otra cuenta respondió «La plataforma ya fue instalada por …».
- **Lección de diagnóstico:** si un cambio publicado «no se ve», primero confirmar que el despliegue llegó (última línea literal del
  Terminal, o un elemento nuevo visible en el panel) antes de buscar fallos en la actualización de la planilla.
- **Regla:** no dar como instrucción «use el menú de la planilla» a quien no entra con la cuenta institucional. La vía es el panel:
  `api_aplicarActualizacion` (nivel administración; la Web App ya corre como la cuenta institucional) devuelve la lista de cambios.
- **Fallos visibles:** el error de la automática queda en la propiedad `error_actualizacion` y `api_inicio` entrega
  `actualizacion: { pendiente, error }` solo a administración; el panel lo muestra en una franja superior y en *Configuración*.
- **Por qué importa:** un fallo silencioso de actualización deja correos saliendo con destinatarios antiguos sin que nadie lo note.
- **Destinatarios:** `aplicarActualizacion_` pone al día «Para» y «CC» aunque el equipo haya editado el texto; solo asunto y cuerpo se conservan.
