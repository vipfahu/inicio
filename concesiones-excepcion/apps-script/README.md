# Plataforma CAE · Google Workspace (Apps Script)

Gestión de las Concesiones Académicas de Excepción (CAE) del Vicedecanato de Investigación y Postgrado FAHU,
montada sobre la planilla y el Formulario de Google que ya se usan, en la cuenta `viceinvestigacionfahu@usach.cl`.

- **Ingreso de solicitudes:** formulario propio con la estética VIP (`…/exec?v=solicitud`), con ingreso por cuenta USACH. Los antecedentes
  (hasta 3 archivos, 10 MB c/u, 20 MB en total) quedan en la carpeta del expediente. El Formulario de Google anterior sigue conectado
  mientras se mantenga abierto; ambos comparten el mismo correlativo de folios.
- **Base de datos:** pestañas nuevas en la misma planilla (privada; solo la cuenta institucional tiene acceso directo).
- **Panel del equipo:** aplicación web de Apps Script. La identidad la da la cuenta Google USACH; los privilegios, la pestaña «Cuentas».
- **Correos:** salen desde la cuenta institucional; las respuestas llegan a la analista del caso.
- **Archivos:** carpeta `Plataforma CAE · NO COMPARTIR / Expedientes / AAAA / NN-AAAA` en el Drive institucional.
- **Seguimiento del estudiante:** la misma aplicación web con `?v=seguimiento`; cada estudiante ve solo las solicitudes enviadas desde su cuenta.

Este directorio no contiene datos personales y no se publica en el sitio (ver `netlify.toml`).

## Archivos

| Archivo | Contenido |
|---|---|
| `Logica.gs` | Reglas puras: estados, transiciones, folios, migración, destinatarios, días hábiles, validación de cuentas |
| `Config.gs` | Pestañas, columnas, parámetros y textos iniciales de los 15 correos |
| `Datos.gs` | Lectura/escritura de pestañas como tablas |
| `Cuentas.gs` | Identidad, niveles y pantalla «Cuentas» |
| `Correo.gs` | Plantillas, variables y envío |
| `Archivos.gs` | Carpetas por expediente, subida y descarga |
| `Flujo.gs` | Recepción del Formulario, bandeja, expediente, cambios de estado |
| `Web.gs` | Puntos de entrada web, configuración y seguimiento |
| `Formulario.gs`, `Solicitud.html` | Formulario web para estudiantes (validación, antecedentes, límite de 3 solicitudes por cuenta al día) |
| `Diario.gs` | Recordatorios (admisibilidad y plazo del programa) y control de compartición (08:00) |
| `Feriados.gs` | Feriados de Chile automáticos (calendario público de Google, caché mensual) para los días hábiles |
| `Instalar.gs` | Menú «CAE», instalación en dos pasos y diagnóstico |
| `Panel.html`, `Seguimiento.html` | Panel del equipo y seguimiento del estudiante |
| `appsscript.json` | Manifiesto (zona horaria, permisos, publicación web) |
| `tests/` | Pruebas en Node con un simulador de los servicios de Google |
| `.claspignore`, `configurar-clasp.js`, `desplegar.js` | Subida del código con `clasp` (lo que no se sube; creación de `.clasp.json`; subir y publicar en un comando) |

## Instalación (cuenta institucional, ~20 minutos)

Todo se hace **con la sesión de `viceinvestigacionfahu@usach.cl`**. La instalación no borra nada: crea un respaldo de valores,
agrega pestañas y oculta (no elimina) las columnas de gestión antiguas.

1. **Abrir el editor.** En la planilla «Concesión Académica de Excepción Postgrado (Respuestas)»: *Extensiones → Apps Script*.
2. **Subir el código con `clasp`** (requiere Node.js en el computador):
   - Una vez, con la sesión institucional: activar «Google Apps Script API» en https://script.google.com/home/usersettings
   - Copiar el «ID de la secuencia de comandos» desde *Configuración del proyecto* (engranaje) del editor.
   - En una terminal, dentro de esta carpeta:
     ```
     node configurar-clasp.js <ID>
     npx @google/clasp@3.4.1 login
     npx @google/clasp@3.4.1 status
     npx @google/clasp@3.4.1 push --force
     ```
     `status` debe listar 15 archivos (11 de código, 3 páginas y `appsscript.json`); `--force` reemplaza el manifiesto.
   - Al terminar la instalación: `npx @google/clasp@3.4.1 logout` (borra la credencial del computador).
   - Alternativa sin `clasp`: en *Configuración del proyecto* marque «Mostrar el archivo de manifiesto», cree un archivo por cada
     `.gs` y `.html` con el mismo nombre y pegue el contenido; reemplace `appsscript.json`.
3. **Paso 1.** Vuelva a la planilla y recárguela. Aparece el menú **CAE**. Ejecute *CAE → Instalación · paso 1* y autorice
   los permisos que Google solicita (Drive, Hojas, Formularios, envío de correo, disparadores).
4. **Completar a mano** en la planilla:
   - **Cuentas:** el correo `@usach.cl` de cada analista que aparece (se precargan por nombre desde la planilla antigua),
     y agregue al Vicedecano/a (`administracion`), a Registro Curricular (rol «Registro Curricular», nivel `sin_acceso`)
     y a quien corresponda. Debe haber al menos una persona con nivel `administracion`.
   - **Programas:** `correo_direccion` y `analista` (correo) de cada programa.
   - **Parámetros:** `enlace_rc` (plataforma de Registro Curricular).
5. **Publicar el panel (antes del paso 2).** En el editor: *Implementar → Nueva implementación → Aplicación web*.
   «Ejecutar como: **yo**» · «Quién tiene acceso: **cualquier usuario de usach.cl**». Copie la URL.
   Este orden importa: la dirección del panel es el enlace de seguimiento que llevan los correos al estudiante, y el paso 2 se niega
   a ejecutarse sin ella.
6. **Paso 2.** *CAE → Instalación · paso 2*: migra las solicitudes existentes (regla: vale el último estado registrado, de derecha
   a izquierda ESTADO ACTUAL → ESTADO → Estado de Presentación), corrige folios, crea los expedientes en Drive, oculta las columnas
   antiguas y activa los disparadores. **No envía correos.** Desde aquí, cada solicitud nueva recibe su correo de recepción.
7. **Probar la identidad (crítico).** Abra la URL con la cuenta USACH de una analista (no la institucional).
   Debe ver la bandeja con su nombre arriba a la derecha. Si ve «Google no entregó su correo», el dominio no está entregando
   la identidad a aplicaciones ejecutadas como la cuenta dueña: **no use el sistema** y avise (ver «Riesgos»).
8. **Diagnóstico.** *CAE → Diagnóstico* lista lo que falte (correos, disparadores, feriados automáticos, accesos no autorizados).
9. **Retirar accesos directos.** Quite de «Compartir» a quienes hoy editan la planilla: desde ahora trabajan en el panel.
   La tarea diaria avisará por correo si vuelve a aparecer un acceso no autorizado.
10. **Formulario para estudiantes.** Comparta `URL?v=solicitud` (y `URL?v=seguimiento`). Cuando el formulario web esté probado, cierre el
    Formulario de Google (*Respuestas → No aceptar respuestas*) con un mensaje que indique la nueva dirección.

**Actualizar el código más adelante:** en macOS, doble clic en `actualizar.command` (`git pull` + `node desplegar.js`); o bien `node desplegar.js` (la primera vez, `node desplegar.js <ID de la implementación>`): corre las pruebas, sube el código y publica una versión nueva en la misma URL. La planilla se pone al día sola en la primera visita al panel o al formulario (agrega lo nuevo sin tocar las plantillas que el equipo haya editado y lo anota en la Bitácora); *CAE → Actualizar* queda como respaldo.

## Cómo opera

**Cuentas.** Una cuenta es una fila en «Cuentas» (correo, nombre, rol, nivel, programas, activo, correos que recibe). No hay contraseñas:
se ingresa con Google. Niveles: `sin_acceso` (solo recibe correos) · `consulta` (bandeja y expedientes, sin fundamentación ni archivos)
· `edicion` (tramita, anota, sube archivos, edita plantillas, se asigna o asigna casos a otra analista, edita el correo de dirección de los programas) · `administracion` (además cuentas, programas y parámetros).
Cada llamada del panel vuelve a leer la matriz, así que un cambio rige en la siguiente acción de esa persona. Para suspender una
cuenta se desactiva; «Eliminar» borra su fila (`api_eliminarCuenta(correo, fila)`, pensado para registros duplicados, que la lista
marca) y lo anota en la bitácora. La cuenta institucional es administradora fija y no se puede dejar el sistema sin otra administración activa.

**Flujo.** Recibida → En revisión de admisibilidad → Admisible para análisis / Rechazada / No procede → Informe de Registro Curricular
→ Pronunciamiento del programa (solicitado vía STD; la plataforma solo registra el estado, sin correo) → V°B° a la respuesta del Comité
(o devolución al programa vía STD, con observación) → decisión del V°B°: CAE admisible o CAE rechazada (ambas siguen a Registro
Curricular por STD, que elabora y distribuye la resolución; correo al estudiante con el estado y el aviso de que la resolución está en
elaboración) → Resuelto / Negado (sin correo). Al cerrar (Resuelto / Negado) se puede escribir un «Comentario para su registro» (opcional; queda en la bitácora) y cargar
su archivo, que queda en el expediente con la categoría «Resolución». Al registrar Resuelto / Negado, el panel recuerda **en negrita**
que la resolución debe enviarse inmediatamente a la Unidad de Registro Curricular para su distribución.

**Paso a Informe de Registro Curricular.** Exige el N° STD ya registrado (el botón queda bloqueado hasta guardarlo; el servidor también
lo valida). Antes del cambio se genera automáticamente el **PDF del formulario de solicitud** (lo que el estudiante envió: datos, programa,
requerimiento, fundamentación y lista de antecedentes), que queda en el expediente con la categoría «Formulario de solicitud (PDF)» y se
ofrece para ver o descargar; si no se puede generar, el estado no cambia. Analistas y administración también pueden pedirlo con
«PDF del formulario de solicitud» en «Archivos del expediente». Se genera **una sola vez** por solicitud: si ya existe, una ventana
informa cuándo y quién lo generó y ofrece verlo o descargarlo (solo si su archivo se borró de Drive se vuelve a generar). La
generación a pedido toma el cerrojo del script y vuelve a comprobar, para que dos pedidos simultáneos no produzcan dos PDF. Si un
expediente tiene más de un PDF del formulario (generados antes de esta regla), la plataforma usa siempre el **original** (el más
antiguo) y la misma ventana ofrece «Quitar copias» (`api_quitarPdfDuplicados`: las demás van a la papelera de Drive y salen de
«Archivos», con constancia en la bitácora); el Diagnóstico lista los folios con copias.

**V°B° exclusivo del Vicedecano/a.** Las tres salidas del V°B° (CAE admisible, CAE rechazada, devolución al programa) solo las registra
la cuenta con rol Vicedecano/a; el servidor rechaza a cualquier otra. Si el Vicedecano/a dio el V°B° por otro medio (correo, STD, en
persona), una analista marca «Vicedecano/a aprueba por otro medio» e indica obligatoriamente el medio y la fecha; la bitácora deja
constancia de ese medio y de quién lo registró. Si el caso sigue en V°B° tras `plazo_vb_dias` (2) días hábiles, sale un recordatorio
automático al Vicedecano/a con copia a la analista (luego cada `recordatorio_cada_dias`, hasta `recordatorios_max`). El nombre
del Vicedecano/a ({vicedecano} en los correos) es el de su cuenta activa con rol Vicedecano/a en «Cuentas». Configuración → «Vicedecano/a»
solo lo muestra, sin campos editables: para cambiarlo se edita esa cuenta, y el cambio queda registrado con el nombre de quien lo hizo.
Los correos dicen «por especial encargo {encargo_vicedecano}», que se arma según cómo esté escrito ese nombre: con grado académico,
«del Dr. …» / «del Mg. …» / «del Lic. …» (o «de la Dra. …» si el grado escrito es femenino); sin grado, «de …».

**Archivos del expediente.** Con «Ver» se abren en una ventana dentro del panel: PDF, imágenes (PNG, JPG, GIF, WebP), texto y
Word (.doc, .docx, .odt, .rtf, que el servidor convierte a PDF en una copia temporal de la carpeta «Temporal» y borra en el acto).
Un ZIP («Ver contenido») muestra la lista de sus documentos y cada uno se abre igual, sin descargar ni descomprimir (hasta 45 MB, el
límite de Apps Script). El resto se descarga. Los PDF se dibujan con pdf.js (cdnjs, versión fija 3.11.174, con
`isEvalSupported: false`), que se carga solo al abrir el primer PDF. La conversión de Word usa el servicio avanzado de Drive
(declarado en `appsscript.json`; el Diagnóstico avisa si no está activo).

**Verificar migración.** Configuración → «Migración» → «Verificar migración» (Administración; también CAE → Verificar migración en la
planilla) compara cada fila de la hoja de respuestas con su solicitud por `fila_respuesta`: datos del formulario (deben coincidir) y
datos de gestión (estado migrado, analista, N° STD, comentarios, observación, resolución; pueden haberse editado después). El detalle
queda en la hoja «Verificación migración». Si las diferencias se repiten fila tras fila (los datos coinciden con la fila siguiente o
anterior), en la hoja de respuestas se insertaron, borraron u ordenaron filas: «Realinear filas» (en el mismo diálogo, o CAE →
Realinear filas migradas) vuelve a enlazar cada solicitud con una fila del mismo estudiante (correo verificado o apellido y nombres);
si el estudiante envió más de una solicitud, desempata por fecha de envío, programa, año, semestre, tipo, RUN y teléfono, asignando
en conjunto (una fila por solicitud, de mayor a menor coincidencia), y deja constancia en la bitácora. Las filas que aun así quedan
sin solicitud (p. ej., segundos envíos de un mismo estudiante) se incorporan con «Importar filas» (`importarFilasSinSolicitud_`,
también en el menú CAE): una solicitud por fila con los mismos criterios de la migración (`solicitudDesdeFila_`), marcada
«Por revisar», sin correo; si el folio de la planilla ya está en uso se asigna el siguiente y se anota el original, y la nota indica
con qué folios comparte estudiante. El sistema conserva todas las solicitudes, también las repetidas: la decisión queda en la ficha.
La importación **realinea antes** y se niega si queda alguna solicitud sin fila resuelta o dos apuntando a la misma fila: importar en
ese estado crea copias de folios atascados. Si eso ya ocurrió, «Reparar importación» (`repararImportacion_`, también en el menú)
elimina las importadas que solo duplican un folio atascado (mismo estudiante, folio original fuera de su fila, sin trámite propio),
restaura el folio en la columna A y realinea; las importadas legítimas se conservan. El folio de «Solicitudes» se escribe siempre con
formato de texto (`anexarVarias_`/`actualizar_`): sin eso Sheets convierte «03/2025» en una fecha y la ficha deja de enlazar con su
bitácora; la actualización automática corrige los que hayan quedado así. La hoja de respuestas se protege en cada actualización automática
(`protegerHojaRespuestas_`: solo la cuenta dueña edita; sin edición por dominio) y el Diagnóstico avisa si dejó de estarlo. Las filas sin solicitud se informan y no se importan solas. Para cada una, la
verificación indica su fecha de envío y si pertenece al mismo estudiante que algún folio existente (posible envío repetido) o a nadie
conocido (respuesta llegada después de la migración o fila nunca importada). La fundamentación de los casos migrados se lee de su fila original y, antes de mostrarla o
ponerla en el PDF, se comprueba que la fila siga siendo de la misma persona; si no, se muestra una alerta en vez del texto.

**No notificar.** En la vista previa de cualquier cambio de estado con correo se puede marcar «No enviar notificación»: el cambio
queda hecho y registrado, sin correo ni copias; la bitácora anota quién lo decidió y, si se escribe, el motivo. Los datos obligatorios
del paso (p. ej., el motivo de un rechazo) se siguen exigiendo. Los correos automáticos (recepción, recordatorios) no tienen esta opción.

**Usuarios.** El panel es para el equipo del Vicedecanato (analistas y Vicedecano/a) y, en modo de solo lectura, para Registro
Curricular: rol «Registro Curricular» (registradora curricular) o «Analista de Registro Curricular», con nivel «Consulta» (ven el
Panorama y los expedientes sin fundamentación ni archivos) o «Sin acceso» (solo reciben copias); nunca Edición. «Programas que ve»
define también de qué programas recibe copias una cuenta. Un tercer tipo, «Cuenta de Registro Curricular del programa», es el correo de
RC propio de un programa. En Configuración cada programa tiene asignadas una **analista de Registro Curricular** y una **cuenta de
Registro Curricular del programa** (se eligen entre las existentes o se crean ahí mismo con «+ Añadir nueva…», nivel Sin acceso), que reciben copia de las comunicaciones de sus casos (parámetro `eventos_copia_rc`; por defecto
admisible para análisis, rechazada, no procede, CAE admisible y CAE rechazada). Toda copia que recibe una analista de Registro Curricular
llega también a Registro Curricular (registradora). Las direcciones de programa no entran: solo reciben correos.

**CAE admisible → Registro Curricular → estudiante.** Tras el V°B° «CAE admisible», el caso pasa a «CAE admisible · notificar a
Registro Curricular»; la analista registra la notificación a Registro Curricular (fecha y medio, p. ej. N° STD) para que esa unidad
informe al estudiante los pasos a seguir y eventuales pagos («Registro Curricular notificado»), y solo después notifica al estudiante
que la resolución está en elaboración (correo `cae_admisible`).

**Seguimiento y Panorama.** El estudiante ve todos los pasos de su ruta agrupados por fase, con la fase actual y «paso k de N». La
pestaña «Panorama» muestra a todo nivel con acceso al panel el avance de cada caso de sus programas, con filtros por fase y programa.

**Ingreso y cierre de sesión.** El panel abre con una página «Iniciar sesión» que muestra la cuenta de Google con que la persona está
conectada (nombre, rol y nivel) y el botón «Ingresar como …», o «Usar otra cuenta USACH» (selector de cuentas de Google). Si la cuenta
no tiene acceso, lo dice y ofrece cambiar de cuenta. Dentro, «Cerrar sesión» ofrece: *Salir del panel* (vuelve a la página de ingreso;
la cuenta de Google sigue abierta) o *Cerrar sesión de Google en este equipo* (cierra todas las cuentas de Google del navegador;
recomendado en equipos compartidos). La identidad la da siempre Google (`Session.getActiveUser()`); la página de ingreso no agrega
contraseñas ni seguridad adicional: es un paso explícito de entrada y salida. El ingreso se recuerda solo en esa pestaña.

**Documento de identidad.** El formulario pide elegir RUN o pasaporte. El RUN se valida con su dígito verificador (módulo 11) en el
navegador y otra vez en el servidor, y se guarda como «12.345.678-5»; el pasaporte acepta letras y números (5 a 20). La columna
`tipo_documento` de «Solicitudes» indica cuál es. Las solicitudes del Formulario de Google antiguo no se validan.

**Bandeja.** Filtros por estado (grupo), programa y analista, y búsqueda por folio, nombre, RUN o tipo. Se ordena por cualquier
columna haciendo clic en su encabezado (segundo clic invierte); por omisión, por fecha de recepción descendente. Las analistas
parten en «En curso»; el Vicedecano/a parte con la planilla completa («Todos los estados»), con el conteo de pendientes de V°B° en
el resumen y el filtro «Pendiente V°B°» a mano.

**Eliminar registros: solo Administración.** Una sola regla para todo lo que borra: cuentas (`api_eliminarCuenta`), solicitudes
(`api_eliminarSolicitud`: borra la ficha y sus registros de archivos, manda la carpeta del expediente a la papelera de Drive y
conserva la bitácora del folio con una entrada final que resume lo eliminado; la fila de la hoja de respuestas no se toca y se
puede volver a importar), archivos de un expediente (`api_eliminarArchivo`: los del equipo y los PDF generados van a la papelera;
de los antecedentes del Formulario solo se quita el acceso directo y el registro, el archivo del estudiante no se toca), copias del
PDF del formulario (`api_quitarPdfDuplicados`) y la reparación de importaciones. Todas exigen motivo y quedan en la bitácora; la
eliminación de una solicitud pide además escribir el folio para confirmar. Edición no ve esos controles y el servidor los rechaza.

**Volver a un paso anterior.** En la ficha (Gestión del trámite → «Volver a un paso anterior») se puede devolver la solicitud a
cualquier paso por el que ya pasó (`api_retroceder(folio, hacia, motivo)`): exige motivo, no envía correo, conserva STD, comentarios,
observación y resolución, y queda en la bitácora como «Retroceso: A → B · Motivo». Si la solicitud ya tenía V°B° (pasó por «CAE
admisible» o «CAE rechazada»), volver a «V°B°» o a un paso anterior lo deshace, y eso solo lo puede hacer el Vicedecano/a o una
cuenta de administración. Los pasos siguientes vuelven a ser los del estado al que se volvió.

**Al llegar una solicitud** salen tres correos automáticos: recepción al estudiante; «Nueva solicitud CAE» a **todas las cuentas activas con acceso al panel** (Vicedecano/a, analistas y consulta; no a las de nivel `sin_acceso`, como Registro Curricular); y, si el programa tiene analista en Configuración (y esa persona tiene cuenta activa con rol Analista), «Nueva solicitud CAE asignada» a esa analista. Si el programa no tiene analista, el caso queda «Sin asignar» (filtro en la bandeja) y se asigna desde el expediente; **cada asignación o reasignación envía el aviso a la analista asignada**. Solo se puede asignar a cuentas activas con rol Analista.

**Correos.** Automáticos solo: recepción (estudiante), nueva solicitud (equipo), asignación (analista) y recordatorios: de admisibilidad (interno), si el caso sigue «Recibida» al día hábil siguiente a la recepción (`primer_aviso_admisibilidad_dias` = 1; el plazo es `plazo_admisibilidad_dias` = 2), a la analista asignada o, si no hay, a las cuentas con nivel edición o administración, y del programa, cuando vencen los `plazo_programa_dias` (2) días hábiles desde que se registró la solicitud por STD (a la dirección de programa, con copia a la analista; pide responder por el STD)
(tras el plazo, cada `recordatorio_cada_dias`, hasta `recordatorios_max`). Si uno de ellos no sale, se avisa de inmediato
por correo a la analista del caso, a la administración y a la cuenta institucional (además de quedar en la bitácora).
Todo correo dirigido al estudiante (recepción, admisible para análisis, rechazada, no procede, CAE admisible, CAE rechazada) lleva el enlace de seguimiento
`URL?v=seguimiento`; el estudiante ve sus casos ingresando con la cuenta USACH con que envió el formulario. Todo otro correo sale al cambiar de estado
en el panel, tras una vista previa editable; si falta el destinatario principal o una variable (por ejemplo `{std}`), no se envía; si falta uno en copia (por ejemplo, un programa sin correo de dirección), el correo sale igual y la vista previa lo advierte; si el envío
falla, el estado no cambia. Los destinatarios son roles que se traducen al enviar:

| Rol | Se convierte en |
|---|---|
| Estudiante | cuenta USACH con que inició sesión en el formulario (el campo «correo» se llena con ella y no se puede modificar; el servidor la impone). En casos migrados del Formulario de Google, también el correo escrito allí, sin repetir |
| Analista | analista asignada/o al caso |
| Vicedecano/a, Registro Curricular | cuentas activas con ese rol |
| Dirección de programa | `correo_direccion` del programa |
| (copias) | cuentas activas con el evento en `recibe_eventos` |

`resumenCuenta(cuenta, ctx)` (Logica.gs) deriva de estas mismas reglas qué programas ve una cuenta y qué correos recibe con su
motivo; el panel lo muestra en «Editar cuenta» (`api_cuentas` lo trae para todas; `api_resumenCuenta` lo calcula para el formulario
sin guardar) y advierte si una cuenta recibe copias de un programa que no tiene entre los que ve.

**Archivos.** Las analistas suben informe académico, acta del Comité, resolución, etc. (máx. `max_mb_archivo`, 20 MB) y pueden
adjuntarlos al correo de un cambio de estado (máx. 24 MB por correo). Los antecedentes del Formulario (hasta 100 MB) se vinculan con
un acceso directo; si superan el máximo de descarga por el panel, se concede acceso de lectura a ese archivo a quien lo pide, y queda en la bitácora.

## Riesgos y límites conocidos

- **Identidad en la aplicación web.** El diseño depende de que Google entregue el correo de quien usa el panel cuando la aplicación se
  ejecuta como la cuenta institucional. La documentación de Google indica que esto ocurre cuando ambas cuentas son del mismo dominio de
  Workspace, pero no lo garantiza para todas las configuraciones: por eso el paso 7. Si falla, el panel no muestra datos (falla cerrado).
- **Cuotas de Gmail para Apps Script** (Workspace, según la documentación vigente al escribir esto): 1.500 destinatarios/día, 25 MB por
  correo. *CAE → Diagnóstico* muestra la cuota restante.
- **Feriados automáticos.** Vienen del calendario público de feriados de Chile de Google (`Feriados.gs`): si Google no publica un
  interferiado o lo publica tarde, ese día se cuenta como hábil. Si la consulta falla, se usa la última lista guardada; sin ninguna,
  se cuenta de lunes a viernes. Requiere el permiso `calendar.readonly` (autorización única de la cuenta institucional).
- **La planilla sigue siendo editable por la cuenta institucional.** Quien la abra directamente puede alterar datos sin pasar por las
  reglas del panel; el historial de versiones de Google Sheets es el respaldo.

## Pruebas

```
node --test concesiones-excepcion/apps-script/tests/*.test.js
```

`tests/logica.test.js` cubre las reglas puras. `tests/solicitud.test.js` cubre el formulario web. `tests/flujo.test.js` ejecuta el código real contra un simulador de Sheets, Drive, Gmail,
sesiones y disparadores (`tests/simulador.js`), con un escenario sintético que reproduce los problemas de la planilla original
(folio guardado como fecha, folio duplicado, folio vacío, estados en conflicto, «En trámite», tipos en texto libre). El simulador no
reemplaza la prueba real del paso 7.
