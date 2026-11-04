En Supabase la confirmación de correo está desactivada: una cuenta con contraseña no prueba que el correo @usach.cl sea de quien la usa; el dominio solo se verifica con el ingreso con Google.

Tipo: seguridad (verificado 2026-11-04 en /auth/v1/settings: mailer_autoconfirm = true, solo proveedor email activo)

- Por eso `nuevo_usuario()` deja crear cuentas sin invitación solo si el correo es @usach.cl y el proveedor es Google; con contraseña sigue exigiendo invitación.
- `es_usach_verificada()` exige el proveedor `google` en el JWT (o un perfil activo del equipo) para leer `ce_*`.
- Activar el ingreso con Google es tarea de la persona (Google Cloud + Supabase); mientras no esté activo, Comisiones solo la ven las cuentas del equipo.
- No activar «Confirm email» sin SMTP propio: con el correo por defecto de Supabase (límite bajo por hora) se bloquearían las altas y recuperaciones.

**Por qué importa:** cualquier módulo futuro «para toda la USACH» debe apoyarse en Google, no en el dominio del correo declarado.
