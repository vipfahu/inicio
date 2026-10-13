Regla de migración: «el último estado es el definitivo» = columna no vacía más a la derecha (ESTADO ACTUAL → ESTADO → Estado de Presentación). Verificable con «Verificar migración».

Tipo: confirmado

Los casos ambiguos quedan `revisar = SÍ` (filtro «Por revisar»). La migración real coincidió con la copia de prueba (5 casos por revisar).

Revisión de correspondencia (2026-10-13, pedido de la persona): lo que la migración copia y lo que no.
- Copiado a «Solicitudes»: marca temporal (si no era fecha, se usó la fecha de la migración), correo verificado, apellidos, nombres, RUN
  (sin normalizar), correo (si vacío, el verificado), teléfono, programa, año, semestre (normalizado a «Semestre I/II»), tipos (catálogo /
  texto libre), estado (regla de arriba), analista (nombre → correo de Cuentas; sin cuenta → revisar), N° STD («0»/«-» → vacío y se
  corta en «/»), comentarios, observación Vicedecano/a, «archivo resolución» + «Archivo CAE» → texto en `resolucion` (no como archivos).
- No copiado: la **fundamentación** (se lee en vivo de la fila original por `fila_respuesta`; por eso ordenar o borrar filas en la hoja
  de respuestas rompe la correspondencia; `fundamentacionDe_` lo detecta y muestra alerta en vez de texto ajeno) y OBSERVACIONES EXTRAS /
  columnas sin nombre (van solo a la bitácora como notas).
- Ambigüedad que la herramienta no resuelve: «Rechazado» legado → `rechazada` (rechazo de admisibilidad) y «Aprobado» → `aceptada`;
  si en la planilla original significaban rechazo/aprobación de la CAE tras el Comité, hay que corregirlos a mano.

Hallazgo real (2026-10-13): la verificación mostró todos los campos corridos una fila desde la fila 3: en la hoja de respuestas se
insertó (o quedó por orden de fecha) una fila nueva después de la migración. Ningún dato se perdió; `fila_respuesta` quedó desfasado
y una fila quedó sin solicitud. Respuesta: `realinearMigracion_` (por correo verificado o nombre, solo coincidencia única). Lección:
nunca pedir a la persona que corrija números de fila a mano; y el «estado migrado» se busca en la bitácora por texto, no por `quien`.
Tras realinear quedaron cinco filas sin solicitud (no una): el diagnóstico de «una fila insertada» era incompleto. Lección: cuando una
herramienta deja filas huérfanas, debe explicarlas por sí misma (`explicarHuerfana_`: fecha de envío y si coinciden con un folio por
correo o nombre), porque la persona no debe pegar datos personales en el chat para que se interpreten.
Segunda corrección: las cinco huérfanas eran de estudiantes con **dos envíos**; «solo coincidencia única» no decidía, y «ya está
bien» se daba por cierto si la solicitud apuntaba a cualquier fila del estudiante (dos folios quedaron cruzados). Ahora la
realineación puntúa cada par (fecha, programa, año, semestre, tipo, RUN, teléfono) y asigna en conjunto, una fila por solicitud.
Lección: la identidad de una fila migrada es estudiante **+ envío**, no solo estudiante; y una regla de «no tocar si hay duda»
debe decir qué duda queda, no dejar el caso a medias.

Cierre (2026-10-13): el Formulario de Google se cerró (ya no llegan filas); a pedido de la persona, la hoja de respuestas queda
protegida por el script (solo la cuenta dueña edita), porque el único riesgo restante para la fundamentación migrada era una
edición manual. Cambiar permisos solo se hace con pedido explícito: aquí lo hubo («Sí, protege la hoja»).

**Por qué importa:** La planilla original tenía tres columnas de estado contradictorias, y la fundamentación migrada depende del
número de fila: la verificación y la alerta son las salvaguardas.
