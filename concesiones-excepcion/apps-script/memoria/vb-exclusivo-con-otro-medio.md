El V°B° a la respuesta del Comité es exclusivo del Vicedecano/a, con salida «aprueba por otro medio» para la analista (medio y fecha obligatorios) y recordatorio automático.

Tipo: enfoque confirmado (pedido de la persona, 2026-10-09)

- La exclusividad se aplica en el servidor (`api_cambiarEstado` con `requiereVicedecano(desde)`), no solo ocultando botones: el panel es
  una interfaz, la regla vive en Flujo.gs.
- La alternativa «otro medio» existe porque en la práctica el Vicedecano/a aprueba por correo, STD o en persona; sin ella el flujo se
  traba. El texto del medio queda en la bitácora junto al correo de quien registró: la trazabilidad reemplaza la firma.
- Recordatorio `recordatorio_vb` tras `plazo_vb_dias` (2) días hábiles desde que el caso entró a `vb`, con copia a la analista.
- Administración cambia nombre (`vicedecano_nombre`) y correo: se reactiva/crea la cuenta nueva con rol Vicedecano/a y se desactiva la
  anterior (nunca se borra). Riesgo: si quien cambia es la cuenta saliente, pierde acceso.

**Por qué importa:** una versión anterior con exclusividad (sin «otro medio») se revirtió el 2026-10-08; la diferencia que la persona
aceptó es la válvula de escape para la analista. No quitarla sin pedirlo.
