El panel es del equipo del Vicedecanato; Registro Curricular entra solo en lectura (nivel Consulta: Panorama y expedientes sin datos sensibles) o recibe copias (Sin acceso); programas y estudiantes no entran.

Tipo: corrección (2026-10-08) actualizada por pedido de la persona (2026-10-13)

Primero la persona restringió el panel al Vicedecanato. Luego pidió que todos los perfiles del Vicedecanato y de Registro Curricular
vean el avance de cada caso. Se resolvió con roles de RC limitados a «Sin acceso» o «Consulta» (validado en `validarCuenta`): nunca
tramitan, y Consulta no ve fundamentación ni archivos (datos de salud). Rol (qué correos recibe) y nivel (qué puede hacer) siguen
siendo ejes distintos; «Programas que ve» filtra también las copias.

Copias por programa (2026-10-13): Configuración asigna a cada programa una analista de RC y una «Cuenta de Registro Curricular del
programa»; reciben copia de los eventos de `eventos_copia_rc`, y toda copia a una analista de RC arrastra a la registradora (pedido literal).

**Por qué importa:** ampliar el acceso expone datos; el límite de nivel para RC es la salvaguarda, no quitarlo sin pedirlo.
