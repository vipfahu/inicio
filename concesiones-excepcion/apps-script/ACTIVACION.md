# Activación de la plataforma CAE · cuentas, notificaciones y formulario

Instrucciones para dejar operativo todo lo construido, **a partir del estado actual**: instalación inicial hecha (pasos 1 y 2),
panel publicado y migración de las 37 solicitudes completada. Tiempo estimado: 60–90 minutos.

Convenciones: **[Inst.]** = con la sesión de `viceinvestigacionfahu@usach.cl` · **[Panel]** = desde el panel, con una cuenta de nivel
Administración · `URL` = dirección del panel (termina en `/exec`).

---

## Fase A · Subir la versión nueva del código (15 min) [Inst.]

1. Descargar el código actualizado y descomprimirlo:
   https://github.com/vipfahu/inicio/archive/refs/heads/claude/github-claude-app-setup-hztxq1.zip
2. Abrir una terminal en la carpeta `concesiones-excepcion/apps-script` y ejecutar:
   ```
   node configurar-clasp.js <ID del script>
   npx @google/clasp@3.4.1 login
   npx @google/clasp@3.4.1 status
   npx @google/clasp@3.4.1 push --force
   ```
   - El ID está en el editor de Apps Script → engranaje (*Configuración del proyecto*) → «ID de la secuencia de comandos».
   - En `login`, elegir la cuenta institucional.
   - `status` debe listar **15 archivos**: 11 `.gs` (incluido `Formulario.gs`), `Panel.html`, `Seguimiento.html`, `Solicitud.html` y `appsscript.json`.
3. En el editor de Apps Script: **Implementar → Gestionar implementaciones → lápiz → Versión: «Nueva versión» → Implementar**.
   La URL no cambia.
4. En la planilla (recargarla): **CAE → Actualizar (tras subir código nuevo)**. Debe informar que agregó:
   - columnas `origen` y `fundamentacion` en Solicitudes;
   - parámetros `max_mb_antecedente` y `max_solicitudes_dia`;
   - plantillas `nueva_solicitud` e `inicio_autorizado`, y el texto nuevo de las plantillas que el equipo no haya editado;
   - y mostrar la dirección del formulario: `URL?v=solicitud`.
5. En el editor, ícono de reloj (**Activadores**): deben existir **solo dos**, `alRecibirFormulario` y `tareaDiaria`.

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
   - Revisar `plazo_programa_dias` (2), `recordatorio_cada_dias` (2), `recordatorios_max` (3), `max_mb_antecedente` (10),
     `max_solicitudes_dia` (3), `vicedecano_nombre`.
3. **Feriados** [Inst., en la planilla, pestaña «Feriados»]: agregar los feriados móviles de 2026 y 2027 (formato `AAAA-MM-DD`).
   Solo vienen cargados los de fecha fija. Se usan para contar los días hábiles del plazo del programa.
4. **Plantillas de correo** [Panel → Plantillas]: revisar los 15 textos. Si se edita alguno, mantener las variables entre llaves
   (`{folio}`, `{enlace}`, etc.); «Restaurar original» deshace los cambios.
5. [Inst.] **CAE → Diagnóstico**: no debe quedar nada pendiente salvo los accesos directos a la planilla (Fase F) y las solicitudes
   por revisar (Fase F).

---

## Fase D · Flujo y correos (referencia)

Flujo: **Recibida** → *(Vicedecano/a autoriza el inicio)* → **En análisis · solicitud de antecedentes** → **Informe académico de
Registro Curricular** → **V°B° al informe** → **Pronunciamiento del programa** → *(V°B° del Vicedecano/a)* → **Presentación aceptada**
→ **Resolución en trámite** → **Resuelto / Negado**. La autorización de inicio y el V°B° a la respuesta del programa solo los puede
registrar una cuenta con rol Vicedecano/a; el resto del equipo ve «Pendiente del Vicedecano/a».

Todos salen desde la cuenta institucional; las respuestas llegan a la analista del caso.

| Momento | Correo | Para | Copia |
|---|---|---|---|
| Llega una solicitud | Recepción (folio + enlace de seguimiento) | Estudiante | — |
| Llega una solicitud | Nueva solicitud CAE (pendiente de autorización) | Todas las cuentas activas con acceso al panel | — |
| Llega una solicitud con analista por programa, o se asigna/reasigna en el expediente | Solicitud asignada | Analista asignada | — |
| **Vicedecano/a autoriza el inicio** (exclusivo) | Inicio autorizado | Analista asignada (o todas las analistas, si no hay) | — |
| No procede (Vicedecano/a al inicio, o analista en el análisis) | No procede (con `enlace_rc`) | Estudiante | — |
| Rechazo en el análisis (pide motivo) | Rechazada | Estudiante | Dirección de programa |
| Informe académico → V°B° al informe | V°B° informe | Vicedecano/a | — |
| Envío al programa | Pronunciamiento | Dirección de programa | Analista |
| Respuesta del programa → V°B° (pide propuesta del Comité) | V°B° Comité | Vicedecano/a | — |
| **V°B° del Vicedecano/a** (exclusivo): presentación aceptada | Aceptada | Estudiante | Dirección de programa |
| **V°B° del Vicedecano/a** (exclusivo): presentación rechazada (pide motivo) | Rechazada | Estudiante | Dirección de programa |
| **V°B° del Vicedecano/a** (exclusivo): devolución al programa (pide observación) | Devolución | Dirección de programa | Analista |
| Resolución en trámite (requiere N° STD) | Registro | Registro Curricular | Estudiante |
| Resuelto / Negado (pide resolución) | Resolución | Estudiante | Dirección de programa |
| Plazo del programa vencido (automático) | Recordatorio | Dirección de programa | Analista |
| Falla un correo automático | Aviso de falla | Analista del caso, Administración, cuenta institucional | — |

Además, cada cuenta recibe copia de los eventos marcados en «Recibe copia de estos correos». Todo correo que no es automático se
muestra antes de enviarse, se puede editar y no sale si falta un destinatario o un dato.

---

## Fase E · Prueba de punta a punta (15 min)

1. Abrir `URL?v=solicitud` con una cuenta USACH personal (no la institucional). Completar el formulario con «PRUEBA» en los nombres,
   un programa **con correo de dirección y analista**, y un PDF pequeño. Enviar.
2. Verificar:
   - En pantalla: folio (el siguiente correlativo del año).
   - Estudiante: correo «Confirmación de recepción · Solicitud CAE NN/2026» con el enlace de seguimiento.
   - Todas las cuentas del panel: «Nueva solicitud CAE · NN/2026 · programa».
   - Analista del programa: «Nueva solicitud CAE asignada · NN/2026».
   - `URL?v=seguimiento` con la cuenta del estudiante: aparece la solicitud en «Recibida».
3. En el panel, con la cuenta del Vicedecano/a: abrir el expediente → «Autorizar inicio del análisis» → confirmar. Debe llegar
   «Inicio autorizado» a la analista. Con una cuenta de analista: comprobar que en «Recibida» solo ve «Pendiente del Vicedecano/a».
   Luego, como analista: ver la fundamentación y el PDF → pasar a «No procede» → revisar la vista previa → confirmar. Debe llegar el
   correo al estudiante y quedar todo en la Bitácora.
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
- **Feriados:** cada diciembre, cargar los del año siguiente.
- **Código nuevo:** repetir la Fase A (pasos 1–4).
- **Correo de cuota:** la cuenta institucional puede enviar ~1.500 destinatarios/día desde Apps Script; *Diagnóstico* muestra lo que queda.

## Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| «Google no entregó su correo» | Sesión con otra cuenta o cuenta fuera de `usach.cl` | Abrir en ventana privada e ingresar con la cuenta USACH |
| «Su cuenta no tiene el nivel requerido» | Cuenta inexistente, inactiva o con nivel insuficiente | Panel → Cuentas |
| «No se puede enviar: falta correo de dirección de …» | Programa sin correo | Configuración → Programas |
| «variables sin completar: {std}» | Falta el N° STD | Guardarlo en el expediente antes de pasar a «Resolución en trámite» |
| Una analista no aparece para asignar | No tiene rol Analista o está inactiva; o el panel no se recargó | Cuentas; recargar |
| El estudiante no ve su caso en Seguimiento | Ingresó con otra cuenta | Debe usar la cuenta con que envió el formulario |
| «Ya registró 3 solicitudes en las últimas 24 horas» | Límite anti-abuso | Esperar o subir `max_solicitudes_dia` |
