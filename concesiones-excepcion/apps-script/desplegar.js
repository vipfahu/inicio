// Sube el código a Apps Script y actualiza la implementación publicada SIN cambiar la URL. Un solo comando.
// Uso (desde esta carpeta):
//   node desplegar.js <ID_DE_LA_IMPLEMENTACIÓN>   la primera vez (queda guardado en .despliegue.json, fuera del repositorio)
//   node desplegar.js                             las siguientes
//   node desplegar.js --archivar-antiguas         además archiva las otras implementaciones (no la vigente ni @HEAD)
// El ID de la implementación es el tramo de la URL entre «/s/» y «/exec» (empieza con AKfycb…).
// Antes de subir corre las pruebas; si alguna falla, no sube nada.
// Al subir genera Implementacion.gs con la URL de esta implementación (los correos la usan en vez de getUrl(), que con varias
// implementaciones activas puede devolver una antigua). El archivo se borra al terminar: no va al repositorio.
// La planilla se pone al día sola en la primera visita al panel o al formulario (ya no hace falta «CAE → Actualizar»).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CLASP = ['-y', '@google/clasp@3.4.1'];
const aqui = __dirname;
const archivo = path.join(aqui, '.despliegue.json');
const win = process.platform === 'win32';

const generado = path.join(aqui, 'Implementacion.gs');
function limpiar() { try { fs.unlinkSync(generado); } catch (e) { /* no existía */ } }

function ejecutar(cmd, args, capturar) {
  // En Windows npx es un .cmd y necesita la consola; node se llama directo.
  const consola = win && cmd === 'npx';
  if (consola) args = args.map(a => /\s/.test(a) ? '"' + a.replace(/"/g, '') + '"' : a);
  return spawnSync(cmd, args, capturar ? { cwd: aqui, encoding: 'utf8', shell: consola } : { cwd: aqui, stdio: 'inherit', shell: consola });
}

function correr(cmd, args, titulo) {
  console.log('\n▶ ' + titulo);
  const r = ejecutar(cmd, args);
  if (r.status !== 0) {
    limpiar();
    console.error('\n✖ Falló: ' + titulo + '. No se continuó; la versión publicada sigue siendo la anterior.');
    process.exit(r.status || 1);
  }
}

if (!fs.existsSync(path.join(aqui, '.clasp.json'))) {
  console.error('Falta .clasp.json. Ejecute primero: node configurar-clasp.js <ID_DEL_SCRIPT>');
  process.exit(1);
}

const opciones = process.argv.slice(2).filter(a => a.indexOf('--') === 0);
const desconocidas = opciones.filter(o => o !== '--archivar-antiguas');
if (desconocidas.length) {
  console.error('Opción desconocida: ' + desconocidas.join(' ') + '. La única disponible es --archivar-antiguas.');
  process.exit(1);
}
const archivar = opciones.indexOf('--archivar-antiguas') >= 0;
let id = String(process.argv.slice(2).filter(a => a.indexOf('--') !== 0)[0] || '').trim();
if (id) {
  if (!/^AKfycb[\w-]{20,}$/.test(id)) {
    console.error('El ID de la implementación no tiene el formato esperado (AKfycb…).');
    process.exit(1);
  }
  fs.writeFileSync(archivo, JSON.stringify({ implementacion: id }, null, 2) + '\n');
} else if (fs.existsSync(archivo)) {
  id = JSON.parse(fs.readFileSync(archivo, 'utf8')).implementacion;
} else {
  console.error('Falta el ID de la implementación. La primera vez: node desplegar.js <ID> (tramo de la URL entre /s/ y /exec).');
  process.exit(1);
}

const fecha = new Date().toISOString().slice(0, 16).replace('T', ' ');
const git = spawnSync('git', ['log', '-1', '--format=%h %s'], { cwd: aqui, encoding: 'utf8' });
const descripcion = ('CAE ' + fecha + ' · ' + (git.status === 0 ? git.stdout.trim() : 'sin git')).slice(0, 90);

const pruebas = fs.readdirSync(path.join(aqui, 'tests')).filter(f => f.endsWith('.test.js')).map(f => path.join('tests', f));
correr(process.execPath, ['--test'].concat(pruebas), 'Pruebas automáticas');
const url = 'https://script.google.com/a/macros/usach.cl/s/' + id + '/exec';
fs.writeFileSync(generado, '// Generado por desplegar.js al subir; no se guarda en el repositorio.\nconst URL_IMPLEMENTACION = ' + JSON.stringify(url) + ';\n');
correr('npx', CLASP.concat(['push', '--force']), 'Subiendo el código a Apps Script');
correr('npx', CLASP.concat(['redeploy', id, '-d', descripcion]), 'Publicando nueva versión en la misma URL');
limpiar();

// ID que enlaza el portal (index.html del repositorio): nunca se archiva la implementación que el portal usa.
let idPortal = '';
try { idPortal = (fs.readFileSync(path.join(aqui, '..', '..', 'index.html'), 'utf8').match(/\/s\/(AKfycb[\w-]{20,})\/exec/) || [])[1] || ''; } catch (e) { /* sin portal en esta copia */ }
const otrasFiltro = x => x.id !== idPortal;
// Otras implementaciones activas: con más de una, Google puede entregar la antigua. Se informan y, si se pide, se archivan.
console.log('\n▶ Revisando otras implementaciones activas');
const lista = ejecutar('npx', CLASP.concat(['deployments']), true);
if (lista.status !== 0) {
  console.log('  No se pudo listar las implementaciones (' + String(lista.stderr || '').trim().split('\n')[0] + '). La publicación sí terminó.');
} else {
  const otras = String(lista.stdout || '').split('\n')
    .map(l => ({ linea: l.trim(), id: (l.match(/AKfycb[\w-]{20,}/) || [])[0] }))
    .filter(x => x.id && x.id !== id && !/@HEAD/i.test(x.linea)).filter(otrasFiltro);
  if (!otras.length) console.log('  Solo está activa la vigente. Bien.');
  else if (archivar && idPortal && idPortal !== id) {
    console.log('  ✖ No se archivó nada: .despliegue.json guarda ' + id.slice(0, 12) + '…, pero el portal (index.html) enlaza ' + idPortal.slice(0, 12) + '….' +
      '\n    Archivar ahora podría dejar sin panel al portal. Corrija el ID con: ./actualizar.command ' + idPortal);
  } else if (!archivar) {
    console.log('  Hay ' + otras.length + ' implementación(es) además de la vigente:\n' + otras.map(x => '   ' + x.linea).join('\n') +
      '\n  Para archivarlas: ./actualizar.command --archivar-antiguas  (o node desplegar.js --archivar-antiguas)');
  } else {
    let hechas = 0;
    otras.forEach(x => {
      console.log('\n▶ Archivando implementación antigua ' + x.id.slice(0, 12) + '…');
      if (ejecutar('npx', CLASP.concat(['undeploy', x.id])).status === 0) hechas++;
      else console.log('  No se pudo archivar ' + x.id.slice(0, 12) + '…; la vigente sigue publicada. Puede archivarla en el editor: Implementar → Gestionar implementaciones.');
    });
    console.log('  Archivadas: ' + hechas + ' de ' + otras.length + '. Sus enlaces directos ya no abren; los que pasan por la página intermedia del portal llevan a la vigente.');
  }
}
console.log('\n✔ Listo. Panel: ' + url + '\n  Formulario: ' + url + '?v=solicitud\n  Seguimiento: ' + url + '?v=seguimiento' +
  '\n  Compruebe en una ventana de incógnito (con una cuenta del equipo) que el panel carga.');
