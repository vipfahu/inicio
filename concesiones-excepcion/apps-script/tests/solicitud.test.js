// Formulario web para estudiantes (Solicitud.gs / Solicitud.html). Datos sintéticos.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../Logica.gs');
const { preparar, instalar } = require('./escenario');

const tabla = (env, n) => {
  const [enc, ...filas] = env.libro.getSheetByName(n).getDataRange().getValues();
  return filas.filter(f => f.some(x => x !== '')).map(f => Object.fromEntries(enc.map((k, j) => [k, f[j]])));
};
const base = () => ({
  apellido1: 'Pérez', apellido2: 'Soto', nombres: 'Ana', run: '12.345.678-9', telefono: '+56 9 1234 5678', correo: 'ana.perez@usach.cl',
  programa: 'Magíster en Prueba A', anio: new Date().getFullYear(), semestre: 'Semestre II',
  tipos: ['Prórroga de Periodo Lectivo', 'tipo inventado'], otro: '', fundamentacion: 'Fundamentación suficientemente extensa para el trámite.'
});
const b64 = mb => Buffer.alloc(Math.round(mb * 1048576), 1).toString('base64');

test('validación de la solicitud', () => {
  const ctx = { programas: ['Magíster en Prueba A'], anio: 2026 };
  const ok = L.validarSolicitud({ ...base(), anio: 2026 }, ctx);
  assert.equal(ok.error, undefined);
  assert.equal(ok.datos.tipo_catalogo, 'Prórroga de Periodo Lectivo', 'los tipos fuera del catálogo se descartan');
  assert.match(L.validarSolicitud({ ...base(), anio: 2026, nombres: ' ' }, ctx).error, /nombres/);
  assert.match(L.validarSolicitud({ ...base(), anio: 2026, programa: 'Otro' }, ctx).error, /programa/);
  assert.match(L.validarSolicitud({ ...base(), anio: 2030 }, ctx).error, /año/);
  assert.match(L.validarSolicitud({ ...base(), anio: 2026, semestre: '' }, ctx).error, /semestre/);
  assert.match(L.validarSolicitud({ ...base(), anio: 2026, tipos: [], otro: '' }, ctx).error, /Otros/);
  assert.equal(L.validarSolicitud({ ...base(), anio: 2026, tipos: [], otro: 'Matrícula fuera de plazo' }, ctx).datos.tipo_texto_libre, 'Matrícula fuera de plazo');
  assert.match(L.validarSolicitud({ ...base(), anio: 2026, correo: 'no-es-correo' }, ctx).error, /correo/);
});

test('envío completo: folio, antecedentes en el expediente, correos, fundamentación visible para el equipo', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'ana.perez@usach.cl';
  const ini = ctx.api_inicioSolicitud();
  assert.equal(ini.identidad, true);
  assert.ok(ini.programas.includes('Magíster en Prueba A'));
  const a1 = ctx.api_subirAntecedente('carta.pdf', 'application/pdf', b64(1));
  const a2 = ctx.api_subirAntecedente('certificado.pdf', 'application/pdf', b64(2));
  const n = estado.correos.length;
  const r = ctx.api_enviarSolicitud(base(), [a1.id, a2.id]);
  assert.equal(r.folio, '07/2026');
  assert.equal(r.archivos, 2);
  const s = tabla(env, 'Solicitudes').pop();
  assert.equal(s.origen, 'Formulario web');
  assert.equal(s.correo_verificado, 'ana.perez@usach.cl');
  assert.equal(s.fila_respuesta, '');
  assert.equal(s.analista, 'analista.uno@usach.cl');
  // Correos: recepción, aviso al equipo, asignación
  const nuevos = estado.correos.slice(n).map(m => m.subject);
  assert.equal(nuevos.length, 3);
  assert.match(nuevos[0], /Confirmación de recepción · Solicitud CAE 07\/2026/);
  assert.match(nuevos[1], /Nueva solicitud CAE · 07\/2026/);
  assert.match(nuevos[2], /asignada · 07\/2026/);
  // Archivos movidos a la carpeta del caso y registrados
  const carpeta = estado.carpetas[s.carpeta_id];
  assert.equal(carpeta.archivosIn.length, 2);
  assert.equal(tabla(env, 'Archivos').filter(a => a.folio === '07/2026').length, 2);
  // El equipo ve la fundamentación (guardada en Solicitudes, no en las respuestas del Formulario)
  estado.usuario = 'analista.uno@usach.cl';
  const e = ctx.api_expediente('07/2026');
  assert.match(e.fundamentacion, /suficientemente extensa/);
  assert.equal(e.archivos.length, 2);
  // Consulta no recibe la fundamentación aunque esté en «Solicitudes»
  estado.usuario = 'consulta@usach.cl';
  assert.equal(ctx.api_expediente('07/2026').fundamentacion, undefined);
  // Y el estudiante lo ve en su seguimiento
  estado.usuario = 'ana.perez@usach.cl';
  assert.deepEqual([...ctx.api_misSolicitudes().solicitudes.map(x => x.folio)], ['07/2026']);
});

test('sin cuenta: no se puede subir ni enviar', () => {
  const env = instalar(preparar());
  env.estado.usuario = '';
  assert.equal(env.ctx.api_inicioSolicitud().identidad, false);
  assert.throws(() => env.ctx.api_subirAntecedente('x.pdf', 'application/pdf', b64(0.1)), /SIN_IDENTIDAD/);
  assert.throws(() => env.ctx.api_enviarSolicitud(base(), []), /SIN_IDENTIDAD/);
});

test('antecedentes: límites y propiedad', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'ana.perez@usach.cl';
  assert.throws(() => ctx.api_subirAntecedente('grande.zip', 'application/zip', b64(11)), /máximo por archivo es 10/);
  const propios = [1, 2, 3, 4].map(i => ctx.api_subirAntecedente('a' + i + '.pdf', 'application/pdf', b64(0.1)).id);
  assert.throws(() => ctx.api_enviarSolicitud(base(), propios), /hasta 3/);
  // Un archivo subido por otra persona no se puede adjuntar
  estado.usuario = 'otra@usach.cl';
  const ajeno = ctx.api_subirAntecedente('ajeno.pdf', 'application/pdf', b64(0.1)).id;
  estado.usuario = 'ana.perez@usach.cl';
  assert.throws(() => ctx.api_enviarSolicitud(base(), [ajeno]), /no válido/);
  // Ni un archivo de un expediente existente
  const exp = Object.keys(estado.archivos).find(id => estado.archivos[id].nombre === 'antecedentes.zip');
  assert.throws(() => ctx.api_enviarSolicitud(base(), [exp]), /no válido/);
  // Total sobre 20 MB
  const g = [9.5, 9.5, 2].map((mb, i) => ctx.api_subirAntecedente('g' + i + '.pdf', 'application/pdf', b64(mb)).id);
  assert.throws(() => ctx.api_enviarSolicitud(base(), g), /máximo es 20/);
  assert.equal(tabla(env, 'Solicitudes').length, 6, 'ningún intento fallido crea solicitudes');
});

test('máximo de solicitudes por cuenta en 24 horas', () => {
  const env = instalar(preparar());
  const { ctx, estado } = env;
  estado.usuario = 'ana.perez@usach.cl';
  ctx.api_enviarSolicitud(base(), []);
  ctx.api_enviarSolicitud(base(), []);
  ctx.api_enviarSolicitud(base(), []);
  assert.throws(() => ctx.api_enviarSolicitud(base(), []), /últimas 24 horas/);
});

test('limpieza de temporales y actualización de una instalación anterior', () => {
  const env = instalar(preparar());
  const { ctx, estado, libro } = env;
  estado.usuario = 'ana.perez@usach.cl';
  const viejo = ctx.api_subirAntecedente('viejo.pdf', 'application/pdf', b64(0.1)).id;
  const nuevo = ctx.api_subirAntecedente('nuevo.pdf', 'application/pdf', b64(0.1)).id;
  estado.archivos[viejo].creado = new Date(Date.now() - 3 * 86400000);
  estado.usuario = '';
  ctx.tareaDiaria();
  assert.equal(estado.archivos[viejo].papelera, true);
  assert.equal(estado.archivos[nuevo].papelera, false);
  // Instalación anterior sin las columnas ni parámetros nuevos
  const h = libro.getSheetByName('Solicitudes');
  const enc = h.datos[0];
  const i = enc.indexOf('origen');
  h.datos.forEach(f => f.splice(i, 2));
  const p = libro.getSheetByName('Parámetros');
  p.datos = p.datos.filter(f => f[0] !== 'max_mb_antecedente');
  estado.usuario = estado.duenia;
  ctx.actualizarInstalacion();
  assert.ok(h.datos[0].includes('origen') && h.datos[0].includes('fundamentacion'));
  assert.ok(p.datos.some(f => f[0] === 'max_mb_antecedente'));
});
