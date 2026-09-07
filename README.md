# Gestión de Información VIP — FAHU USACH

Carpeta `vipfahu/` = raíz del sitio. Sitio estático publicado en Netlify: https://vipfahu.netlify.app (repo `vipfahu/inicio`; estos archivos van en la raíz del repo).

- `index.html` — portal de entrada a los subsistemas.
- `normativa-postgrados/` — Normativa Postgrados (`index.html` público, `admin.html` panel de actualización, `data/`, `support.js`, `assets/`).
- `cursos-formacion/` — Cursos de Formación Multidisciplinar (`index.html` oferta pública por semestre + estadísticas, `admin.html` panel, `data/`, `support.js`, `assets/`).
- `trayectorias-academicas/` — subsistema futuro (por construir).
- `netlify.toml` — cabeceras, caché y rutas cortas (`/normativa`, `/admin`, `/cursos`, `/cursos/admin`).

Los datos de Normativa viven en Supabase; `data/normativa/catalogo.js` es el respaldo estático.

Última generación: 2026-09-07T16:41:10.275Z
