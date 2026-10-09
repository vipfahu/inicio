La página «Iniciar sesión» y el botón «Cerrar sesión» del panel son pasos de interfaz: la identidad la entrega siempre Google.

Tipo: diseño

Con la Web App «ejecutar como yo» + acceso «dominio», Google exige la cuenta @usach.cl antes de cargar la página y
`Session.getActiveUser()` da el correo; no hay contraseñas propias. La página de ingreso muestra la cuenta conectada y pide confirmar
(«Ingresar como …») o cambiar de cuenta (AccountChooser de Google). «Salir del panel» solo vuelve a esa página (sessionStorage de la
pestaña); «Cerrar sesión de Google» usa accounts.google.com/Logout y cierra todas las cuentas del navegador (avisarlo). Pedido de la
persona al trabajar «sobre las cuentas».

**Por qué importa:** no prometer más seguridad de la que hay; el control real es la pestaña «Cuentas» (nivel y activo) que se relee en cada llamada.
