Se trabaja directamente en `main`: la persona lo pidió al ver que `git pull` en `main` no traía lo que estaba solo en la rama de trabajo.

Tipo: preferencia

Hasta el 2026-10-09 los cambios iban a la rama `claude/github-claude-app-setup-hztxq1` y se fusionaban a `main` por pull request; la
persona trabaja desde `main` en su computador, así que lo no fusionado no le llegaba y creyó que la actualización había fallado. Desde
entonces: commits y push a `main` (con pruebas en verde antes de cada push). Si una sesión en la nube exige otra rama, avisar a la
persona y fusionar a `main` al terminar.

**Por qué importa:** `node desplegar.js` publica lo que haya en la copia local; si `main` queda atrás, se publica una versión vieja.
