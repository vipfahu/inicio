En Cursos, «Nuevo semestre» (pestaña Semestres, solo administración) ofrece copiar la oferta de otro semestre en el mismo paso.

- **Qué pasó (2026-11-26):** la persona pidió «poder generar un nuevo semestre y que plantee copiar información del anterior».
  Ambas cosas ya existían, pero separadas: crear en *Semestres* y copiar con «Copiar desde otro semestre…» en *Oferta*. El pedido
  revelaba que el flujo en dos pasos no se descubría. Se integró la copia al formulario de creación.
- **Diseño:** propone el semestre siguiente al más reciente y, como origen, el más reciente con cursos; «solo vigentes» por omisión;
  casillas para conservar profesor/a, horario y sala, cupos y comentarios (comentarios desmarcado). Lo copiado queda `vigente`.
  Si la copia falla, el semestre ya creado queda vacío y el aviso remite a «Copiar desde otro semestre…».
- **Código:** `filasCopia(origen, destino, opc)` en `cursos-formacion/admin.html` la usan la creación y la copia desde *Oferta*
  (esta última copia todo, como antes). Es una página de Claude Design editada en el repo: replicar si se regenera.
- **Por qué importa:** ante un pedido de algo que «ya existe», revisar si el problema es de descubrimiento antes de responder
  «ya está»; decirlo igualmente a la persona.
