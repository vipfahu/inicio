La actualización de la planilla se aplica desde el panel (botón «Aplicar actualización», administración); el menú de la planilla exige la cuenta institucional.

- **Qué pasó (2026-11-26):** tras publicar la copia a la analista, la plantilla «Recepción» no mostró el CC. La actualización automática
  (`actualizarSiCorresponde_`) tragaba los errores con `console.error`, así que nadie supo si falló. El menú *CAE → Actualizar* lo
  ejecutó una cuenta distinta de la institucional y respondió «La plataforma ya fue instalada por …» (`soloDuenia_`): correcto como
  protección, inútil como instrucción para el equipo.
- **Regla:** no dar como instrucción «use el menú de la planilla» a quien no entra con la cuenta institucional. La vía es el panel:
  `api_aplicarActualizacion` (nivel administración; la Web App ya corre como la cuenta institucional) devuelve la lista de cambios.
- **Fallos visibles:** el error de la automática queda en la propiedad `error_actualizacion` y `api_inicio` entrega
  `actualizacion: { pendiente, error }` solo a administración; el panel lo muestra en una franja superior y en *Configuración*.
- **Por qué importa:** un fallo silencioso de actualización deja correos saliendo con destinatarios antiguos sin que nadie lo note.
- **Pendiente de saber:** la causa del fallo original; el botón la mostrará la primera vez que se use tras publicar.
