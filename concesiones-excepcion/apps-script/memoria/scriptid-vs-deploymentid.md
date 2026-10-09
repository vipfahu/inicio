`scriptId` (engranaje del editor; va en `.clasp.json`) ≠ `deploymentId` (`AKfycb…`, tramo de la URL entre /s/ y /exec; va en `desplegar.js`).

Tipo: técnico

En un clon nuevo `desplegar.js` falla con «Falta .clasp.json»: crearlo con `node configurar-clasp.js <scriptId>` o copiar el `.clasp.json` de la carpeta anterior. `clasp login` es global y sirve para cualquier carpeta.

**Por qué importa:** Confusión recurrente; dar siempre la tabla de cuál es cuál.
