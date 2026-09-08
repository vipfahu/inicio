# Gestión de Información VIP — FAHU USACH

Carpeta `vipfahu/` = raíz del sitio. Sitio estático publicado en Netlify: https://vipfahu.netlify.app (repo `vipfahu/inicio`; estos archivos van en la raíz del repo).

## Estructura
- `index.html` — portal de entrada (tarjetas de los tres subsistemas + accesos a los paneles del equipo).
- `normativa-postgrados/` — Normativa Postgrados: `index.html` público, `admin.html` panel, `data/`, `support.js`, `assets/`.
- `cursos-formacion/` — Cursos de Formación Multidisciplinar: `index.html` oferta pública por semestre + estadísticas, `admin.html` panel (programas, semestres, cuentas), `data/`, `support.js`, `assets/`.
- `trayectorias-academicas/` — Trayectorias Académicas: `index.html` (todo requiere cuenta; sin vista pública), `data/supabase/config.js`, `support.js`, `assets/`.
- `netlify.toml` — cabeceras, caché y rutas cortas: `/normativa`, `/admin`, `/cursos`, `/cursos/admin`, `/trayectorias`.
- `404.html` — página de error propia.

## Datos (Supabase, un solo proyecto para los tres subsistemas)
Los scripts SQL viven en el proyecto de diseño (no se publican). Orden de ejecución, una sola vez cada uno, en SQL Editor:
1. `normativa-postgrados/data/supabase/setup.sql` — perfiles, invitaciones, documentos, actividad, funciones `es_editor()` / `es_admin()`.
2. `cursos-formacion/data/supabase/setup-cursos.sql` → `seed-cursos.sql` → `migracion-programas-cuentas.sql`.
3. `trayectorias-academicas/data/supabase/setup-trayectorias.sql` → `seed-trayectorias.sql` → `migracion-encasillamiento.sql` → `migracion-archivos.sql`.

Los archivos con datos personales (`seed-trayectorias.sql`, `catalogo.js` de trayectorias) **nunca** se copian a esta carpeta.

## Cuentas y niveles
Una sola tabla `perfiles` para todo el sistema; el rol se interpreta por subsistema:

| rol            | Normativa                     | Cursos                                        | Trayectorias            |
|----------------|-------------------------------|-----------------------------------------------|-------------------------|
| administrador  | todo + cuentas                | todo: programas, semestres, cuentas, oferta   | todo + cuentas + sistema |
| editor         | carga y edita documentos      | cursos de sus programas asignados             | solo visión             |

Alta siempre por invitación (pestaña Cuentas/Usuarios de cualquier panel); la persona crea su contraseña con «Primera vez». La primera cuenta registrada queda administradora.

## Mantenimiento
- Trayectorias ▸ **Sistema**: estado de migraciones, registro de actividad y depuración de archivos huérfanos del depósito privado.
- Trayectorias ▸ **Respaldos**: migración manual de los enlaces de Drive al depósito (abrir → descargar → cargar).
- Regenerar esta carpeta desde el espacio de diseño tras cada cambio y hacer `git push`; Netlify despliega solo.

Última generación: ver `?v=` en los `<script>` de cada `index.html`.
