Una cuenta es una fila en «Cuentas» que autoriza un correo @usach.cl: sin contraseñas, nivel releído en cada llamada; se suspende desactivándola y se puede eliminar por fila (duplicados).

Tipo: diseño

La institucional es administradora fija; no se puede quitar la última administración. Las plantillas apuntan a roles y se resuelven a correos al enviar.

Lo que una cuenta ve y recibe sale de cuatro fuentes (rol en las plantillas, `recibe_eventos`, asignaciones por programa en
«Programas», y la herencia de analista de RC → Registro Curricular); la persona no puede componerlas de cabeza. Por eso
`resumenCuenta` las deriva con las mismas reglas que el envío y el panel las muestra en «Editar cuenta» (2026-10-13).

Corrección (2026-10-13): un doble clic en «Crear cuenta» produjo dos registros con el mismo correo; el ingreso usa el primero y el
segundo queda invisible. Respuesta: el botón se bloquea hasta que responde el servidor, la lista marca «Duplicada», y
`api_eliminarCuenta(correo, fila)` elimina por fila (no por correo), con las mismas salvaguardas que la edición. Lección: toda acción
que crea registros debe bloquear su botón mientras espera, y cuando puede haber duplicados la identidad es la fila, no el correo.

**Por qué importa:** Permite rotación de personal sin tocar código, y evita que se marquen copias a mano para «asegurarse» de algo
que el rol ya garantiza.
