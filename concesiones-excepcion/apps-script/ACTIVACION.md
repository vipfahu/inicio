# Activación de la plataforma CAE · cuentas, notificaciones y formulario

Instrucciones para dejar operativo todo lo construido, **a partir del estado actual**: instalación inicial hecha (pasos 1 y 2),
panel publicado y migración de las 37 solicitudes completada. Tiempo estimado: 60–90 minutos.

Convenciones: **[Inst.]** = con la sesión de `viceinvestigacionfahu@usach.cl` · **[Panel]** = desde el panel, con una cuenta de nivel
Administración · `URL` = dirección del panel (termina en `/exec`).

---

## Fase A · Subir la versión nueva del código (5 min) [Inst.]

1. Obtener el código (la primera vez `git clone https://github.com/vipfahu/inicio.git` y `git checkout claude/github-claude-app-setup-hztxq1`;
   después, `git pull`). Abrir una terminal en `concesiones-excepcion/apps-script`.
2. Solo la primera vez en cada computador:
   ```
   node configurar-clasp.js <ID del script>
   npx @google/clasp@3.4.1 login
   ```
   - El ID está en el editor de Apps Script → engranaje (*Configuración del proyecto*) → «ID de la secuencia de comandos».
   - En `login`, elegir la cuenta institucional.
3. Subir y publicar, **un solo comando**:
   ```
   node desplegar.js <ID de la implementación>    ← la primera vez (tramo de la URL entre /s/ y /exec)
   node desplegar.js                              ← las siguientes
   ```
   En macOS, las siguientes veces basta **doble clic en `actualizar.command`** (en Finder, dentro de esta carpeta): hace `git pull`
   y `node desplegar.js` sin abrir la terminal a mano.
   Corre las pruebas (si alguna falla, no sube nada), hace `clasp push --force` y publica una versión nueva **en la misma URL**
   (`clasp redeploy`). Si la publicación falla, el respaldo manual es: editor de Apps Script → **Implementar → Gestionar
   implementaciones → lápiz → Versión: «Nueva versión» → Implementar**.
4. **La planilla se pone al día sola**: la primera visita al panel o al formulario después de publicar agrega columnas, parámetros y
   plantillas nuevas, retira las que ya no se usan y actualiza el texto de las que el equipo no editó (las editadas se conservan).
   Queda una fila «Actualización automática…» en la Bitácora. El menú **CAE → Actualizar** sigue disponible para forzarlo.
5. Comprobar en una ventana de incógnito, con una cuenta del equipo, que el panel carga. En el editor, ícono de reloj (**Activadores**):
   deben existir **solo dos**, `alRecibirFormulario` y `tareaDiaria`.

---

## Fase B · Cuentas (15 min) [Panel → Cuentas]

El panel es solo para el equipo del Vicedecanato. Se ingresa con la cuenta Google USACH (no hay contraseñas); la matriz define qué
puede hacer cada persona y qué correos recibe. Los cambios rigen desde la siguiente acción de esa persona.

| Persona | Rol | Nivel | Programas que ve |
|---|---|---|---|
| Vicedecano/a | Vicedecano/a | Administración | Todos |
| Cada analista del Vicedecanato | Analista | Edición | Todos (o los suyos) |
| Registro Curricular | Registro Curricular | Sin acceso (solo recibe correos) | Todos |
| Otras personas que solo deben mirar | Consulta | Consulta | Todos |

Para cada persona: **Agregar cuenta** → correo `@usach.cl`, nombre, rol, nivel, programas, «Cuenta activa» marcada → **Crear cuenta** →
aceptar el envío del enlace de acceso.

Revisar también:
- Las cuentas precargadas por la migración (analistas de la planilla antigua) tienen rol **Analista** y están activas.
- «Recibe copia de estos correos»: solo para quien deba recibir avisos además de los de su rol (por ejemplo, Registro Curricular
  marcando `nueva_solicitud`, si lo quieren enterado desde el inicio).
- Las cuentas no se borran: se desactivan (desmarcar «Cuenta activa»).

Al terminar, **recargar el panel** (la lista de analistas para asignar se lee al abrirlo).

---

## Fase C · Configuración (15 min) [Panel → Configuración]

1. **Programas** (una fila por programa, botón «Guardar» en cada una):
   - **Correo dirección** — obligatorio. Sin él no salen los correos que van a la dirección de programa o la llevan en copia.
   - **Analista** — opcional. Si se elige, las solicitudes de ese programa se asignan solas a esa analista; si se deja «Sin asignar»,
     se asignan a mano desde el expediente.
   - **Activo** — los programas inactivos no aparecen en el formulario.
2. **Parámetros** → «Guardar parámetros»:
   - `enlace_rc`: enlace a la plataforma de Registro Curricular (lo usa el correo «No procede»).
   - Revisar `plazo_admisibilidad_dias` (2), `primer_aviso_admisibilidad_dias` (1), `plazo_programa_dias` (2), `plazo_vb_dias` (2), `recordatorio_cada_dias` (2), `recordatorios_max` (3), `max_mb_antecedente` (10),
     `max_solicitudes_dia` (3).
   - En «Cuentas», la del Vicedecano/a debe tener su **nombre** completo: es el que aparece en los correos.
   - **Visor de Word en el panel:** usa el servicio avanzado de Drive, que `appsscript.json` ya declara y `clasp push` activa. No pide
     permisos nuevos (usa el de Drive que ya existe). Si el Diagnóstico dice «Servicio avanzado de Drive no activo», en el editor de Apps
     Script: **Servicios (+) → Drive API → Agregar**, y vuelva a publicar.
3. **Días hábiles y feriados (automáticos):** los plazos cuentan de lunes a viernes descontando los feriados de Chile, que la plataforma
   obtiene sola del calendario público de feriados de Chile de Google y renueva cada mes (año en curso y siguiente). No se cargan a
   mano. Configuración → «Feriados (automáticos)» muestra los próximos; *CAE → Diagnóstico* indica la fuente o si falló la consulta.
   Si existe una pestaña «Feriados» de una instalación anterior, ya no se usa y se puede borrar.
   **Permiso nuevo:** esta función lee calendarios (`calendar.readonly`). Tras publicar esta versión, la cuenta institucional debe
   autorizarla **una vez**: en la planilla, *CAE → Diagnóstico* → «Revisar permisos» → aceptar. Hasta entonces, el panel, el formulario
   y la tarea diaria pueden pedir autorización o fallar.
4. **Plantillas de correo** [Panel → Plantillas]: revisar los 15 textos. Si se edita alguno, mantener las variables entre llaves
   (`{folio}`, `{enlace}`, etc.); «Restaurar original» deshace los cambios.
5. [Inst.] **CAE → Diagnóstico**: no debe quedar nada pendiente salvo los accesos directos a la planilla (Fase F) y las solicitudes
   por revisar (Fase F).

---

## Fase D · Quién recibe qué correo (referencia)

Flujo: **Recibida** → **En revisión de admisibilidad** → **Admisible para análisis** (o Rechazada / No procede) → **Informe de
Registro Curricular** → **Pronunciamiento del programa (solicitado vía STD)** → **V°B° a respuesta del Comité** (o devolución al
programa vía STD) → decisión: **CAE admisible** o **CAE rechazada** (en ambos casos el trámite sigue a Registro Curricular por el STD;
Registro Curricular elabora y distribuye la resolución; el estudiante recibe un correo con el estado y el aviso de que la resolución está
en elaboración) → **Resuelto / Negado** (se anota la resolución emitida y se puede cargar su archivo; sin correo). La solicitud al programa y la devolución se tramitan en el STD:
la plataforma solo registra el estado (sin correo) y el estudiante lo ve en su seguimiento. El diagrama completo está en el flujograma publicado.

Todos salen desde la cuenta institucional; las respuestas llegan a la analista del caso.

| Momento | Correo | Para | Copia |
|---|---|---|---|
| Llega una solicitud | Recepción (folio + enlace de seguimiento) | Estudiante | — |
| Llega una solicitud | Nueva solicitud CAE | Todas las cuentas activas con acceso al panel | — |
| Llega una solicitud con analista por programa, o se asigna/reasigna en el expediente | Solicitud asignada | Analista asignada | — |
| Admisible para análisis | Admisible para análisis | Estudiante | Dirección de programa |
| Presentación rechazada (pide motivo) | Rechazada | Estudiante | Dirección de programa |
| No procede | No procede (con `enlace_rc`) | Estudiante | — |
| Paso a Informe de Registro Curricular (exige N° STD registrado; genera el PDF del formulario de solicitud y lo ofrece para descarga) | *(sin correo)* | — | — |
| Registro de solicitud de pronunciamiento al programa (STD) | *(sin correo)* | — | — |
| Registro de devolución al programa vía STD (pide observación) | *(sin correo)* | — | — |
| V°B° a respuesta del Comité (pide propuesta) | V°B° Comité | Vicedecano/a | — |
| V°B° · CAE admisible (sigue a Registro Curricular vía STD) | CAE admisible · resolución en tramitación | Estudiante | — |
| V°B° · CAE rechazada (sigue a Registro Curricular vía STD) | CAE rechazada · resolución en tramitación | Estudiante | — |
| Resuelto / Negado (pide N° y fecha de la resolución de Registro Curricular; permite cargar el archivo de la resolución) | *(sin correo; el estudiante ve el estado)* | — | — |
| Caso que sigue «Recibida»: primer aviso al día hábil siguiente a la recepción (`primer_aviso_admisibilidad_dias` = 1), luego cada 2 días hábiles, hasta 3 (automático; indica el vencimiento del plazo de `plazo_admisibilidad_dias` = 2) | Recordatorio de admisibilidad | Analista asignada; si no hay, cuentas con nivel Edición o Administración | — |
| Pronunciamiento del programa sin respuesta tras `plazo_programa_dias` (2) días hábiles desde que se registró la solicitud por STD (automático; luego cada 2 días hábiles, hasta 3) | Recordatorio de pronunciamiento (pide responder por el STD) | Dirección de programa | Analista del caso |
| Caso en V°B° sin respuesta tras `plazo_vb_dias` (2) días hábiles desde que entró al V°B° (automático; luego cada 2 días hábiles, hasta 3) | Recordatorio de V°B° pendiente | Vicedecano/a | Analista del caso |
| Falla un correo automático | Aviso de falla | Analista del caso, Administración, cuenta institucional | — |

Las tres salidas del V°B° (CAE admisible, CAE rechazada, devolución) solo las registra la cuenta con rol Vicedecano/a. Si dio el V°B° por
otro medio, la analista marca «Vicedecano/a aprueba por otro medio» e indica medio y fecha (queda en la bitácora con su nombre). Configuración
→ «Vicedecano/a» muestra el nombre y la cuenta del Vicedecano/a sin permitir editarlos: se cambian solo en «Cuentas» (nombre de la cuenta
con rol Vicedecano/a; para un relevo, se activa la cuenta nueva con ese rol y se desactiva la anterior). El Diagnóstico avisa si hay
más de una cuenta activa con ese rol o si no tiene nombre.

Además, cada cuenta recibe copia de los eventos marcados en «Recibe copia de estos correos». Todo correo que no es automático se
muestra antes de enviarse, se puede editar y no sale si falta el destinatario principal o un dato. Si falta uno en copia (por ejemplo, el correo de dirección del programa), sale igual y la vista previa lo advierte.

---

## Fase E · Prueba de punta a punta (15 min)

0. Ingreso: abrir `URL` → debe aparecer «Iniciar sesión» con la cuenta conectada → «Ingresar como …». Probar «Cerrar sesión →
   Salir del panel» (vuelve a la página de ingreso) y, con una cuenta sin acceso, que la página lo indique y ofrezca otra cuenta.

1. Abrir `URL?v=solicitud` con una cuenta USACH personal (no la institucional). Completar el formulario con «PRUEBA» en los nombres,
   un programa **con correo de dirección y analista**, y un PDF pequeño. Enviar.
2. Verificar:
   - En pantalla: folio (el siguiente correlativo del año).
   - Estudiante: correo «Confirmación de recepción · Solicitud CAE NN/2026» con el enlace de seguimiento.
   - Todas las cuentas del panel: «Nueva solicitud CAE · NN/2026 · programa».
   - Analista del programa: «Nueva solicitud CAE asignada · NN/2026».
   - `URL?v=seguimiento` con la cuenta del estudiante: aparece la solicitud en «Recibida».
3. En el panel (cuenta de analista): abrir el expediente → ver la fundamentación y el PDF → pasar a «En revisión» → pasar a
   «No procede» → revisar la vista previa → confirmar. Debe llegar el correo al estudiante y quedar todo en la Bitácora.
4. Con una cuenta de nivel Consulta: el expediente se ve **sin** fundamentación ni archivos.
5. Limpiar la prueba [Inst.]: borrar su fila en «Solicitudes», sus filas en «Bitácora» y «Archivos», y la carpeta
   `Plataforma CAE · NO COMPARTIR / Expedientes / 2026 / NN-2026`. El folio queda libre para el siguiente caso real.

Si algún correo no llega: revisar la Bitácora (las filas «ERROR · no se envió…» dicen el motivo) y *CAE → Diagnóstico*.

---

## Fase F · Puesta en marcha (15 min)

1. **Formulario de Google anterior** [Inst.]: *Respuestas → desactivar «Aceptar respuestas»* y, en el mensaje para quienes lo abran,
   indicar la nueva dirección `URL?v=solicitud`.
2. **Difundir** a estudiantes: `URL?v=solicitud` (presentar) y `URL?v=seguimiento` (seguir). Opcional: actualizar la tarjeta 05 del
   portal VIP con ambos enlaces.
3. **Accesos directos a la planilla** [Inst.]: quitar de «Compartir» a quienes hoy la editan; el equipo trabaja en el panel. Si alguien
   debe conservar acceso directo, agregar su correo en Parámetros → `compartido_permitido`. La tarea diaria avisa si aparece un acceso
   no autorizado.
4. **Solicitudes migradas por revisar** (24/2026, 29/2026, 32/2026, 34/2026, 35/2026): en la bandeja, filtro «Por revisar»; en cada
   expediente leer el aviso amarillo, corregir lo necesario y marcar «revisado» → «Guardar cambios». Si al estudiante de 34/2026 se le
   había comunicado el folio 31/2026, avisarle del cambio.
5. **Cerrar la sesión de clasp** en el computador: `npx @google/clasp@3.4.1 logout`.
6. [Inst.] **CAE → Diagnóstico** final: debe decir «Sin pendientes».

---

## Mantenimiento

- **Altas y bajas del equipo:** Panel → Cuentas (agregar o desactivar).
- **Programa nuevo:** agregarlo en Configuración → Programas; aparece en el formulario web si está activo.
- **Código nuevo:** repetir la Fase A (pasos 1–4).
- **Correo de cuota:** la cuenta institucional puede enviar ~1.500 destinatarios/día desde Apps Script; *Diagnóstico* muestra lo que queda.

## Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| «Google no entregó su correo» | Sesión con otra cuenta o cuenta fuera de `usach.cl` | Abrir en ventana privada e ingresar con la cuenta USACH |
| «Su cuenta no tiene el nivel requerido» | Cuenta inexistente, inactiva o con nivel insuficiente | Panel → Cuentas |
| «No se puede enviar: falta correo de dirección de …» | Programa sin correo | Configuración → Programas |
| Una analista no aparece para asignar | No tiene rol Analista o está inactiva; o el panel no se recargó | Cuentas; recargar |
| El estudiante no ve su caso en Seguimiento | Ingresó con otra cuenta | Debe usar la cuenta con que envió el formulario |
| «Ya registró 3 solicitudes en las últimas 24 horas» | Límite anti-abuso | Esperar o subir `max_solicitudes_dia` |
