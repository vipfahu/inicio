«Nueva implementación» crea otra URL; para conservarla: editar la existente → «Nueva versión», o `clasp redeploy`.

Tipo: técnico

Así cambió la URL de `AKfycby6…` a `AKfycbwQ…` (vigente). La antigua seguía activa y `getUrl()` la devolvía en los correos; se corrigió fijando la URL al desplegar y se archiva con `./actualizar.command --archivar-antiguas` (ver `url-del-panel-fijada-al-desplegar.md`).

**Por qué importa:** Con dos implementaciones activas, los enlaces de los correos pueden apuntar a la equivocada.
