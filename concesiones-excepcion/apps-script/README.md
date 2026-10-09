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

**Actualizar el código más adelante:** `node desplegar.js` (la primera vez, `node desplegar.js <ID de la implementación>`): corre las pruebas, sube el código y publica una versión nueva en la misma URL. La planilla se pone al día sola en la primera visita al panel o al formulario (agrega lo nuevo sin tocar las plantillas que el equipo haya editado y lo anota en la Bitácora); *CAE → Actualizar* queda como respaldo.

## Cómo opera

**Cuentas.** Una cuenta es una fila en «Cuentas» (correo, nombre, rol, nivel, programas, activo, correos que recibe). No hay contraseñas:
se ingresa con Google. Niveles: `sin_acceso` (solo recibe correos) · `consulta` (bandeja y expedientes, sin fundamentación ni archivos)
· `edicion` (tramita, anota, sube archivos, edita plantillas) · `administracion` (además cuentas, programas y parámetros).
Cada llamada del panel vuelve a leer la matriz, así que un cambio rige en la siguiente acción de esa persona. Las cuentas se desactivan,
no se borran. La cuenta institucional es administradora fija y no se puede dejar el sistema sin otra administración activa.

**Flujo.** Recibida → En revisión de admisibilidad → Admisible para análisis / Rechazada / No procede → Informe de Registro Curricular
→ Pronunciamiento del programa (solicitado vía STD; la plataforma solo registra el estado, sin correo) → V°B° a la respuesta del Comité
(o devolución al programa vía STD, con observación) → decisión del V°B°: CAE admisible o CAE rechazada (ambas siguen a Registro
Curricular por STD, que elabora y distribuye la resolución; correo al estudiante con el estado y el aviso de que la resolución está en
elaboración) → Resuelto / Negado (sin correo). Al cerrar (Resuelto / Negado) se anota N° y fecha de la resolución y se puede cargar
su archivo, que queda en el expediente con la categoría «Resolución».

**Usuarios.** El panel es solo para el equipo del Vicedecanato (analistas y Vicedecano/a). Las direcciones de programa y Registro Curricular no entran: solo reciben correos.

**Ingreso y cierre de sesión.** El panel abre con una página «Iniciar sesión» que muestra la cuenta de Google con que la persona está
conectada (nombre, rol y nivel) y el botón «Ingresar como …», o «Usar otra cuenta USACH» (selector de cuentas de Google). Si la cuenta
no tiene acceso, lo dice y ofrece cambiar de cuenta. Dentro, «Cerrar sesión» ofrece: *Salir del panel* (vuelve a la página de ingreso;
la cuenta de Google sigue abierta) o *Cerrar sesión de Google en este equipo* (cierra todas las cuentas de Google del navegador;
recomendado en equipos compartidos). La identidad la da siempre Google (`Session.getActiveUser()`); la página de ingreso no agrega
contraseñas ni seguridad adicional: es un paso explícito de entrada y salida. El ingreso se recuerda solo en esa pestaña.

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
