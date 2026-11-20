«Copiar enlace» de un PDF copia un enlace a la plataforma que abre el visor (`?doc=`, `?ref=`, `?res=`, `?archivo=`), nunca la URL del archivo.

Tipo: decisión (pedido de la persona, 2026-11-20: todos los módulos salvo CAE)

- Público (Normativa, Grupos): el enlace abre el documento sin sesión. Si el PDF se reemplaza, el enlace sigue sirviendo porque apunta al registro.
- Privado (Comisiones, Trayectorias): el enlace exige iniciar sesión con una cuenta autorizada. No se comparte la URL firmada (vence en 1 hora y entregaría datos personales a quien tenga el enlace). El aviso al copiar lo dice.
- En Comisiones el ingreso con Google conserva la consulta (`redirectTo` incluye `location.search`) para volver al documento tras iniciar sesión.
- Utilidades en `comun/vip.js` (`copiarTexto`, `copiarEnlace`, tercer argumento de `verArchivo`); Normativa y Trayectorias (entorno de diseño) tienen su propia copia de `copiarTexto`.

**Por qué importa:** un «enlace público» a un respaldo de Trayectorias sería una filtración; si alguien lo pide, la respuesta es el enlace con sesión.
