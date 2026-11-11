El V°B° a la respuesta del Comité es exclusivo del Vicedecano/a, con salida «aprueba por otro medio» para la analista (medio y fecha obligatorios) y recordatorio automático.

Tipo: enfoque confirmado (pedido de la persona, 2026-10-09)

- La exclusividad se aplica en el servidor (`api_cambiarEstado` con `requiereVicedecano(desde)`), no solo ocultando botones: el panel es
  una interfaz, la regla vive en Flujo.gs.
- La alternativa «otro medio» existe porque en la práctica el Vicedecano/a aprueba por correo, STD o en persona; sin ella el flujo se
  traba. El texto del medio queda en la bitácora junto al correo de quien registró: la trazabilidad reemplaza la firma.
- Recordatorio `recordatorio_vb` tras `plazo_vb_dias` (2) días hábiles desde que el caso entró a `vb`, con copia a la analista.
- El nombre ({vicedecano}) sale de la cuenta activa con rol Vicedecano/a. Configuración solo lo replica, sin edición (pedido de la
  persona, 2026-10-09: «elimina la posibilidad de ser apropiado»). Se quitó el parámetro `vicedecano_nombre` y la tarjeta editable que
  existió unas horas: una sola fuente de verdad, y todo cambio pasa por «Cuentas», que deja registro de quién lo hizo.
- Vector que sigue abierto: una cuenta de administración puede asignarse el rol Vicedecano/a en «Cuentas». No se restringió (no se pidió).

**Por qué importa:** una versión anterior con exclusividad (sin «otro medio») se revirtió el 2026-10-08; la diferencia que la persona
aceptó es la válvula de escape para la analista. No quitarla sin pedirlo.

**Corrección (2026-11-11, folio 36, analista):** se quitó la casilla «Vicedecano/a aprueba por otro medio» que habilitaba los botones. Era estado del navegador: al redibujar la ficha (p. ej., tras «Guardar cambios» en la misma tarjeta) quedaba desmarcada y los botones deshabilitados sin aviso, y la analista creía haber registrado el V°B°. Ahora los botones están siempre activos para quien no es Vicedecano/a; el diálogo exige el medio y la fecha y el servidor lo valida. La vista previa también bloquea «Confirmar» si el correo tiene variables sin completar (antes fallaba recién al confirmar). Lección: no condicionar una acción a un estado de interfaz que se pierde al redibujar; la validación debe vivir en el paso que confirma.
