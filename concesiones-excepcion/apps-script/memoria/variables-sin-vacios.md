Una variable de plantilla nunca puede valer «»: `rellenar` deja `{x}` sin reemplazar y `enviar_` bloquea el correo. Las frases que cambian según haya o no analista se resuelven en `variables_()`.

Tipo: diseño

Las frases que cambian según haya o no analista asignada (`{contacto}`, `{destino_respuesta}`, `{firmante}`) se arman completas en
`variables_()` (Correo.gs), con la preposición y la puntuación incluidas, en vez de anteponer un texto fijo a `{analista}`. Así no
aparece «La analista a cargo, Vicedecanato de Investigación y Postgrado,» ni la firma con el Vicedecanato repetido. El primer intento
de este cambio dejó `{firmante}` vacío cuando no había analista, y tres pruebas fallaron por «variables sin completar».
`{analista}` conserva su respaldo por si alguna plantilla editada por el equipo todavía la usa.

**Por qué importa:** una plantilla que se lee mal con un caso sin analista llega igual al estudiante; una variable vacía hace que no salga.
