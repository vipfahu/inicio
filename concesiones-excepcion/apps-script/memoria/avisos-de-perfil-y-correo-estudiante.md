# Todo cambio de perfil de una cuenta se avisa a esa persona; cambiar el correo del estudiante le avisa en la dirección nueva

**Pedido (2026-10-28).** (1) Administración puede modificar el correo de los estudiantes y el estudiante recibe un aviso de su registro
en la plataforma; (2) asignar a una analista como administradora y notificarla; (3) toda asignación o cambio de perfil se notifica.

**Decisiones.**
- Perfil = rol, nivel, programas, activo y copias (`CAMPOS_PERFIL`). Nombre y notas no avisan. El aviso sale tras soltar el cerrojo y
  nunca revierte el guardado: un fallo de correo queda en la bitácora. Se quitó la pregunta «¿enviar enlace?» al crear: ahora es automático.
- El correo del estudiante cambia `correo` y `correo_verificado` a la vez: si solo cambiara el de contacto, el estudiante no vería su
  caso en el seguimiento (se identifica por `correo_verificado`).
- La asignación concreta de una persona no se hace desde el código: el repositorio es público y no debe llevar correos reales; la hace
  Administración en el panel, y el aviso automático cubre la notificación.

**Regla.** Pedidos que nombran a una persona real se resuelven con la función genérica más la instrucción de uso en el panel, nunca
escribiendo su correo en el repositorio.
