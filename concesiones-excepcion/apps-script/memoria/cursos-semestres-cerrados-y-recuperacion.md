En Cursos, los semestres cerrados solo los modifica la administración, y el panel tiene «Olvidé mi contraseña» con un paso propio para definir la nueva.

- **Origen (2026-11-26):** al redactar las instrucciones para cuentas de edición se vio que estas podían modificar cursos de su
  programa en semestres cerrados (historial) y que no había recuperación de contraseña. La persona pidió cerrar ambas cosas.
- **Bloqueo en la base, no solo en la página:** `cf_periodo_abierto(periodo)` (admin de cursos o semestre no cerrado) se suma a
  `cf_puede(programa)` en las políticas de inserción, edición y eliminación de `cf_cursos`
  (`supabase/migraciones/2026-11-26-cursos-semestres-cerrados.sql`, aplicada). La página oculta «Editar», «✕» y el formulario.
- **Recuperación:** `resetPasswordForEmail` con `redirectTo` a la misma página; al volver con `type=recovery`
  (o el evento `PASSWORD_RECOVERY`) se pide la contraseña nueva antes de entrar, en vez de entrar con la sesión temporal.
- **Por qué importa:** escribir instrucciones para terceros revela huecos del sistema; decirlos primero en vez de esconderlos en el texto.
- **Por confirmar:** que `https://vipfahu.netlify.app/**` esté entre las Redirect URLs de Supabase Auth.
