# Gestión de Información VIP — FAHU USACH

Carpeta `vipfahu/` = raíz del sitio. Sitio estático publicado en Netlify: https://vipfahu.netlify.app (repo `vipfahu/inicio`; estos archivos van en la raíz del repo).

## Estructura
- `index.html` — portal de entrada (tarjetas de los tres subsistemas + accesos a los paneles del equipo).
- `normativa-postgrados/` — Normativa Postgrados: `index.html` público, `admin.html` panel, `data/`, `support.js`, `assets/`.
- `cursos-formacion/` — Cursos de Formación Multidisciplinar: `index.html` oferta pública por semestre + estadísticas, `admin.html` panel (programas, semestres, cuentas), `data/`, `support.js`, `assets/`.
- `trayectorias-academicas/` — Trayectorias Académicas: `index.html` (todo requiere cuenta; sin vista pública), `data/supabase/config.js`, `support.js`, `assets/`.
- `concesiones-excepcion/apps-script/` — Concesiones Académicas de Excepción: plataforma en Google Workspace (Apps Script sobre la planilla y el Formulario de la cuenta institucional). No se publica en el sitio; instalación en su `README.md`. En el portal, la tarjeta 05 y el acceso «Concesiones ↗» del encabezado enlazan al formulario (`URL?v=solicitud`) y al panel interno (Web App de Apps Script). **Esta tarjeta se editó directamente en el repositorio:** si el sitio se regenera desde el espacio de diseño, hay que llevar ahí el mismo cambio.
- `grupos-investigacion/` — Grupos y Programas Centro de Investigación: `index.html` catálogo **público** (instancias con sus resoluciones de creación, modificación, normativa interna e integrantes; reglamentos internos y modelos de resolución), `admin.html` panel (plataforma `grupos` en la matriz de accesos). Depósito público `grupos`.
- `comisiones-evaluacion/` — Comisiones de Evaluación Académica (Procesos de Jerarquización): `index.html` único. Lectura para cuentas **@usach.cl que entran con Google** y para el equipo; edición para quien tenga Edición/Administración en la plataforma `comisiones`. Composición vigente por unidad (por puntaje), de Facultad (por criterios) y especial, consulta a una fecha, historial y resumen de la norma (D.U. 26/1986, 123/1987, 848/1988). No guarda evaluaciones. Depósito privado `comisiones` (URL firmadas).
- `comun/` — `vip.css` y `vip.js`, compartidos por Grupos y Comisiones. **Estos dos módulos son HTML y JS simples, no salen del espacio de diseño**: no se regeneran desde ahí ni dependen de `support.js`.
- `supabase/migraciones/` — SQL aplicado en el proyecto (registro; Netlify no lo publica). `2026-11-04-grupos-y-comisiones.sql`: tablas `gi_*` y `ce_*`, permisos, depósitos, plataformas `grupos` y `comisiones` en `accesos`, alta de cuentas @usach.cl con Google.
- `netlify.toml` — cabeceras, caché y rutas cortas: `/normativa`, `/admin`, `/cursos`, `/cursos/admin`, `/trayectorias`, `/grupos`, `/grupos/admin`, `/comisiones`.
- `404.html` — página de error propia.

## Datos (Supabase, un solo proyecto para los tres subsistemas)
Los scripts SQL viven en el proyecto de diseño (no se publican). Orden de ejecución, una sola vez cada uno, en SQL Editor:
1. `normativa-postgrados/data/supabase/setup.sql` — perfiles, invitaciones, documentos, actividad, funciones `es_editor()` / `es_admin()`. Luego `migracion-mi-cuenta.sql` (sep 2026): cada persona edita su propio nombre, correo y contraseña desde «Mi cuenta» en los tres paneles. Al final de todo, `migracion-accesos.sql` (sep 2026): accesos diferenciados por plataforma (Sin acceso / Consulta / Edición / Administración por cuenta y plataforma; `perfiles.rol` queda como rol general). Después de accesos, `trayectorias-academicas/data/supabase/migracion-bajas.sql` (oct 2026): desactivación reversible de fichas y catálogo de motivos (Acogido a retiro, Destitución, Renuncia).
2. `cursos-formacion/data/supabase/setup-cursos.sql` → `seed-cursos.sql` → `migracion-programas-cuentas.sql`.
3. `trayectorias-academicas/data/supabase/setup-trayectorias.sql` → `seed-trayectorias.sql` → `migracion-encasillamiento.sql` → `migracion-archivos.sql`.

Los archivos con datos personales (`seed-trayectorias.sql`, `catalogo.js` de trayectorias) **nunca** se copian a esta carpeta.

## Cuentas y niveles
Una sola cuenta (correo + contraseña) para todo el sistema, con un **nivel por plataforma** que se fija en la matriz «Acceso por plataforma» de la pestaña Usuarios/Cuentas de cualquier panel: Sin acceso · Consulta · Edición · Administración. El **rol general** «Admin. general» (columna rol de la lista de cuentas) administra cuentas y accesos de las tres plataformas; solo otra administración general puede otorgarlo. Invitar desde un panel autoriza únicamente esa plataforma.
Una sola tabla `perfiles` para todo el sistema; el rol se interpreta por subsistema:

| rol            | Normativa                     | Cursos                                        | Trayectorias            |
|----------------|-------------------------------|-----------------------------------------------|-------------------------|
| administrador  | todo + cuentas                | todo: programas, semestres, cuentas, oferta   | todo + cuentas + sistema |
| editor         | carga y edita documentos      | cursos de sus programas asignados             | solo visión             |

Alta siempre por invitación (pestaña Cuentas/Usuarios de cualquier panel); la persona crea su contraseña con «Primera vez». La primera cuenta registrada queda administradora.

**Excepción (nov 2026):** una cuenta @usach.cl que entra **con Google** se crea sin invitación y sin perfil: solo puede leer Comisiones; no entra a ningún panel. Las cuentas con contraseña siguen exigiendo invitación, porque el proyecto no confirma correos (cualquiera podría registrar una dirección @usach.cl ajena). Para que el ingreso con Google funcione hay que habilitar el proveedor Google en Supabase (Authentication → Sign In / Providers → Google) con un cliente OAuth de Google Cloud y agregar `https://vipfahu.netlify.app/**` en Authentication → URL Configuration → Redirect URLs. Si se invita a alguien que ya entró con Google, su perfil se crea al invitarlo.

## Mantenimiento
- Trayectorias ▸ **Sistema**: estado de migraciones, registro de actividad y depuración de archivos huérfanos del depósito privado.
- Trayectorias ▸ **Respaldos**: migración manual de los enlaces de Drive al depósito (abrir → descargar → cargar).
- Regenerar esta carpeta desde el espacio de diseño tras cada cambio y hacer `git push`; Netlify despliega solo.

Última generación: ver `?v=` en los `<script>` de cada `index.html`.
