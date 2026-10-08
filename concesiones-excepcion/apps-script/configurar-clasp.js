// Crea .clasp.json con el ID del proyecto de Apps Script de la planilla CAE.
// Uso (desde esta carpeta):  node configurar-clasp.js <ID_DEL_SCRIPT>
// El ID está en el editor de Apps Script → Configuración del proyecto (engranaje) → «ID de la secuencia de comandos».
const fs = require('fs');
const path = require('path');

const id = String(process.argv[2] || '').trim();
if (!/^[\w-]{20,}$/.test(id)) {
  console.error('Falta el ID o no tiene el formato esperado.\nUso: node configurar-clasp.js <ID_DEL_SCRIPT>');
  process.exit(1);
}
const destino = path.join(__dirname, '.clasp.json');
fs.writeFileSync(destino, JSON.stringify({ scriptId: id, rootDir: '.' }, null, 2) + '\n');
console.log('Listo: ' + destino + '\nSiguiente: npx @google/clasp@3.4.1 login');
