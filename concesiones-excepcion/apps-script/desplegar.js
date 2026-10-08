// Sube el código a Apps Script y actualiza la implementación publicada SIN cambiar la URL. Un solo comando.
// Uso (desde esta carpeta):
//   node desplegar.js <ID_DE_LA_IMPLEMENTACIÓN>   la primera vez (queda guardado en .despliegue.json, fuera del repositorio)
//   node desplegar.js                             las siguientes
// El ID de la implementación es el tramo de la URL entre «/s/» y «/exec» (empieza con AKfycb…).
// Antes de subir corre las pruebas; si alguna falla, no sube nada.
// La planilla se pone al día sola en la primera visita al panel o al formulario (ya no hace falta «CAE → Actualizar»).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CLASP = ['-y', '@google/clasp@3.4.1'];
const aqui = __dirname;
const archivo = path.join(aqui, '.despliegue.json');
const win = process.platform === 'win32';

function correr(cmd, args, titulo) {
  console.log('\n▶ ' + titulo);
  // En Windows npx es un .cmd y necesita la consola; node se llama directo.
  const consola = win && cmd === 'npx';
  if (consola) args = args.map(a => /\s/.test(a) ? '"' + a.replace(/"/g, '') + '"' : a);
  const r = spawnSync(cmd, args, { cwd: aqui, stdio: 'inherit', shell: consola });
  if (r.status !== 0) {
    console.error('\n✖ Falló: ' + titulo + '. No se continuó; la versión publicada sigue siendo la anterior.');
    process.exit(r.status || 1);
  }
}

if (!fs.existsSync(path.join(aqui, '.clasp.json'))) {
  console.error('Falta .clasp.json. Ejecute primero: node configurar-clasp.js <ID_DEL_SCRIPT>');
  process.exit(1);
}

let id = String(process.argv[2] || '').trim();
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
correr('npx', CLASP.concat(['push', '--force']), 'Subiendo el código a Apps Script');
correr('npx', CLASP.concat(['redeploy', id, '-d', descripcion]), 'Publicando nueva versión en la misma URL');

const url = 'https://script.google.com/a/macros/usach.cl/s/' + id + '/exec';
console.log('\n✔ Listo. Panel: ' + url + '\n  Formulario: ' + url + '?v=solicitud\n  Seguimiento: ' + url + '?v=seguimiento' +
  '\n  Compruebe en una ventana de incógnito (con una cuenta del equipo) que el panel carga.');
